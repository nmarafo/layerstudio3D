/**
 * LayerStudio 3D - Geometric Slicing Engine & Layer Guides
 * Intersección plano-malla X/Y/Z, filtro de islas pequeñas, extrusión 3D y guías de pegado (#N+1 / #N-1).
 *
 * Copyright (C) 2026 Norberto Martín Afonso <normaafo@gmail.com>
 * Repository: https://github.com/nmarafo/layerstudio3D
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Under Section 7(b) of the GNU Affero General Public License, any redistribution
 * or derivative work must preserve this copyright notice and author attribution
 * to Norberto Martín Afonso in the source code, documentation, and visible
 * application notices.
 */
// =========================================================================
// MOTOR DE CORTE Y LAMINADO GEOMÉTRICO (X, Y, Z)
// =========================================================================
function setSliceAxis(ax) {
  state.axis = ax;
  ['x', 'y', 'z'].forEach((k) => {
    const btn = document.getElementById('axisBtn_' + k);
    if (k === ax) {
      btn.className = 'py-1.5 rounded-lg border border-sky-500 bg-sky-500/20 text-xs font-bold text-sky-300 transition';
    } else {
      const col = k === 'x' ? 'text-rose-400' : (k === 'y' ? 'text-emerald-400' : 'text-sky-400');
      btn.className = 'py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs font-bold ' + col + ' hover:bg-slate-800 transition';
    }
  });
  rebuildGhostAndSlices();
}

function setSliceMode(m) {
  state.mode = m;
  document.getElementById('countControlBox').classList.toggle('hidden', m !== 'count');
  document.getElementById('thicknessControlBox').classList.toggle('hidden', m !== 'thickness');
  document.getElementById('modeBtn_count').className = m === 'count'
    ? 'py-1 rounded-md border border-sky-500 bg-sky-500/20 text-[11px] font-semibold text-sky-300'
    : 'py-1 rounded-md border border-slate-700 bg-slate-900 text-[11px] font-semibold text-slate-400';
  document.getElementById('modeBtn_thickness').className = m === 'thickness'
    ? 'py-1 rounded-md border border-sky-500 bg-sky-500/20 text-[11px] font-semibold text-sky-300'
    : 'py-1 rounded-md border border-slate-700 bg-slate-900 text-[11px] font-semibold text-slate-400';
  rebuildGhostAndSlices();
}

function onSliceCountInput(v) {
  state.sliceCount = Math.max(2, Math.min(400, parseInt(v, 10) || 24));
  document.getElementById('sliceCountLabel').textContent = state.sliceCount;
  rebuildGhostAndSlices();
}

function onThicknessInput(v) {
  const th = parseFloat(v);
  if (!Number.isFinite(th) || th <= 0.1) return;
  state.thickness = th;
  document.getElementById('thicknessInput').value = th;
  rebuildGhostAndSlices();
}

function rebuildGhostAndSlices() {
  if (!state.baseVertices) return;
  const verts = getScaledTriangles();

  // Actualizar malla fantasma 3D
  if (ghostMesh3D) {
    scene.remove(ghostMesh3D);
    ghostMesh3D.geometry.dispose();
  }
  const gGeom = new THREE.BufferGeometry();
  gGeom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  gGeom.computeVertexNormals();
  const gMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.14,
    roughness: 0.4,
    depthWrite: false
  });
  ghostMesh3D = new THREE.Mesh(gGeom, gMat);
  ghostMesh3D.visible = state.showGhost;
  scene.add(ghostMesh3D);

  // Calcular número de capas y grosor según eje activo
  const axisSpan = state.dimsMM[state.axis];
  if (state.mode === 'count') {
    state.thickness = axisSpan / state.sliceCount;
  } else {
    state.sliceCount = Math.max(2, Math.min(450, Math.floor(axisSpan / state.thickness)));
    document.getElementById('sliceCountSlider').value = state.sliceCount;
    document.getElementById('sliceCountLabel').textContent = state.sliceCount;
  }
  document.getElementById('computedThicknessInfo').textContent = state.thickness.toFixed(2) + ' mm (' + state.sliceCount + ' capas)';

  // Intersección plano-malla para cada lasca
  const minCoord = -axisSpan / 2;
  const step = axisSpan / state.sliceCount;
  const newSlices = [];
  let totalRemovedIslands = 0;

  for (let i = 0; i < state.sliceCount; i++) {
    const planeCoord = minCoord + step * (i + 0.5);
    const rawLoops = sliceTrianglesAtPlane(verts, state.axis, planeCoord, axisSpan);
    const filteredRes = filterLoopsByMinIslandSize(rawLoops);
    totalRemovedIslands += filteredRes.removedCount;
    newSlices.push({
      index: i,
      coord: planeCoord,
      selected: true,
      rawLoops: rawLoops,
      loops: filteredRes.loops
    });
  }

  state.slices = newSlices;
  state.filteredIslandsCount = totalRemovedIslands;
  updateFilteredIslandsUI();

  if (state.activeSliceIndex >= state.slices.length) {
    state.activeSliceIndex = Math.max(0, state.slices.length - 1);
  }

  build3DSlicesMesh();
  if (state.nestingEnabled) {
    recomputeBoardNesting();
  } else {
    document.getElementById('currentSliceSlider').max = Math.max(0, state.slices.length - 1);
    document.getElementById('currentSliceSlider').value = state.activeSliceIndex;
  }
  renderSliceStripUI();
  selectActiveSlice(state.activeSliceIndex);
}

// Evalúa si una isla cumple el tamaño mínimo configurado por el usuario
function doesIslandPassMinSizeFilter(widthMM, heightMM, areaMM2) {
  if (!state.filterSmallIslands || state.minIslandSizeMM <= 0) return true;
  const threshold = state.minIslandSizeMM;
  if (state.minIslandCriteria === 'min_dim') {
    return Math.min(widthMM, heightMM) >= threshold;
  }
  if (state.minIslandCriteria === 'area') {
    return areaMM2 >= threshold;
  }
  // Por defecto ('max_dim'): se elimina si tanto el ancho como el alto son inferiores al umbral
  return Math.max(widthMM, heightMM) >= threshold;
}

// Filtra los contornos de una lasca eliminando las islas pequeñas y sus huecos internos asociados
function filterLoopsByMinIslandSize(rawLoops) {
  if (!rawLoops || rawLoops.length === 0) {
    return { loops: [], removedCount: 0 };
  }
  if (!state.filterSmallIslands || state.minIslandSizeMM <= 0) {
    return { loops: rawLoops.slice(), removedCount: 0 };
  }

  const outers = rawLoops.filter((l) => !l.isHole);
  const holes = rawLoops.filter((l) => l.isHole);
  const keptLoops = [];
  let removedCount = 0;

  outers.forEach((outer, oIdx) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    outer.points.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
    const w = Math.max(0, maxX - minX);
    const h = Math.max(0, maxY - minY);

    if (!doesIslandPassMinSizeFilter(w, h, outer.absArea)) {
      removedCount++;
      return;
    }

    keptLoops.push(outer);

    // Conservar únicamente los huecos que pertenecen directamente a esta isla válida
    holes.forEach((hole) => {
      if (!isPointInPolygon(hole.points[0], outer.points)) return;
      let insideSmallerOuter = false;
      for (let k = 0; k < outers.length; k++) {
        if (k !== oIdx && outers[k].absArea < outer.absArea) {
          if (isPointInPolygon(hole.points[0], outers[k].points)) {
            insideSmallerOuter = true;
            break;
          }
        }
      }
      if (!insideSmallerOuter) {
        keptLoops.push(hole);
      }
    });
  });

  return { loops: keptLoops, removedCount };
}

// Reaplica el filtro de tamaño mínimo de isla sobre todas las lascas sin recalcular la intersección 3D
function applyIslandFilterToExistingSlices() {
  let totalRemoved = 0;
  state.slices.forEach((slice) => {
    const base = slice.rawLoops || slice.loops || [];
    const res = filterLoopsByMinIslandSize(base);
    slice.loops = res.loops;
    totalRemoved += res.removedCount;
  });
  state.filteredIslandsCount = totalRemoved;
  updateFilteredIslandsUI();

  build3DSlicesMesh();
  if (state.nestingEnabled) {
    recomputeBoardNesting();
  }
  renderSliceStripUI();
  update2DInspectorHeader();
  render2DSlice();
}

function updateFilteredIslandsUI() {
  const c1 = document.getElementById('filterSmallIslandsCheck');
  const c2 = document.getElementById('nestFilterSmallCheck');
  const c3 = document.getElementById('modalFilterSmallCheck');
  if (c1) c1.checked = state.filterSmallIslands;
  if (c2) c2.checked = state.filterSmallIslands;
  if (c3) c3.checked = state.filterSmallIslands;

  const i1 = document.getElementById('minIslandSizeInput');
  const i2 = document.getElementById('nestMinIslandSizeInput');
  const i3 = document.getElementById('modalMinIslandSizeInput');
  if (i1) i1.value = state.minIslandSizeMM;
  if (i2) i2.value = state.minIslandSizeMM;
  if (i3) i3.value = state.minIslandSizeMM;

  const critSel = document.getElementById('minIslandCriteriaSelect');
  if (critSel) critSel.value = state.minIslandCriteria;

  const unitSuffix = state.minIslandCriteria === 'area' ? 'mm²' : 'mm';
  const lbl = document.getElementById('minIslandSizeLabel');
  if (lbl) {
    lbl.textContent = state.minIslandCriteria === 'area' ? 'Área mínima (mm²):' : 'Tamaño mínimo (mm):';
  }
  const nestUnit = document.getElementById('nestMinIslandUnitSpan');
  if (nestUnit) nestUnit.textContent = unitSuffix;

  const box = document.getElementById('filterSmallIslandsBox');
  if (box) box.classList.toggle('opacity-45', !state.filterSmallIslands);

  const badge = document.getElementById('filteredIslandsBadge');
  if (badge) {
    if (!state.filterSmallIslands) {
      badge.className = 'text-[10px] text-slate-400 text-center pt-0.5';
      badge.textContent = 'Filtro desactivado (0 islas eliminadas)';
    } else if (state.filteredIslandsCount > 0) {
      badge.className = 'text-[10px] text-rose-300 font-semibold text-center pt-0.5';
      badge.textContent = '🧹 ' + state.filteredIslandsCount + ' isla(s) eliminada(s) (< ' + state.minIslandSizeMM + ' ' + unitSuffix + ')';
    } else {
      badge.className = 'text-[10px] text-emerald-300 text-center pt-0.5';
      badge.textContent = '✓ Ninguna isla es inferior a ' + state.minIslandSizeMM + ' ' + unitSuffix;
    }
  }
}

function setFilterSmallIslands(enabled) {
  state.filterSmallIslands = Boolean(enabled);
  applyIslandFilterToExistingSlices();
}

function onMinIslandFilterChange() {
  const critEl = document.getElementById('minIslandCriteriaSelect');
  const sizeEl = document.getElementById('minIslandSizeInput');
  if (critEl) state.minIslandCriteria = critEl.value;
  if (sizeEl) {
    const val = parseFloat(sizeEl.value);
    if (Number.isFinite(val) && val > 0) {
      state.minIslandSizeMM = val;
    }
  }
  applyIslandFilterToExistingSlices();
}

function onNestMinIslandInput(valStr) {
  const val = parseFloat(valStr);
  if (Number.isFinite(val) && val > 0) {
    state.minIslandSizeMM = val;
    if (!state.filterSmallIslands) {
      state.filterSmallIslands = true;
    }
    applyIslandFilterToExistingSlices();
  }
}

function setMinIslandSizePreset(valMM) {
  state.minIslandSizeMM = valMM;
  state.filterSmallIslands = true;
  applyIslandFilterToExistingSlices();
}

function sliceTrianglesAtPlane(verts, axis, planeVal, spanScale) {
  const segments = [];
  const eps = 1e-7 * Math.max(1, spanScale);

  // Mapeo de coordenadas según eje perpendicular
  const getAxisCoord = (i) => {
    if (axis === 'x') return verts[i];
    if (axis === 'y') return verts[i + 1];
    return verts[i + 2];
  };
  const get2D = (i) => {
    if (axis === 'x') return { x: verts[i + 1], y: verts[i + 2] };
    if (axis === 'y') return { x: verts[i], y: verts[i + 2] };
    return { x: verts[i], y: verts[i + 1] };
  };

  for (let i = 0; i < verts.length; i += 9) {
    const c0 = getAxisCoord(i) - planeVal;
    const c1 = getAxisCoord(i + 3) - planeVal;
    const c2 = getAxisCoord(i + 6) - planeVal;

    const d0 = Math.abs(c0) < eps ? eps : c0;
    const d1 = Math.abs(c1) < eps ? eps : c1;
    const d2 = Math.abs(c2) < eps ? eps : c2;

    if ((d0 > 0 && d1 > 0 && d2 > 0) || (d0 < 0 && d1 < 0 && d2 < 0)) continue;

    const pts = [];
    const p0 = get2D(i), p1 = get2D(i + 3), p2 = get2D(i + 6);

    if ((d0 > 0) !== (d1 > 0)) {
      const t = d0 / (d0 - d1);
      pts.push({ x: p0.x + t * (p1.x - p0.x), y: p0.y + t * (p1.y - p0.y) });
    }
    if ((d1 > 0) !== (d2 > 0)) {
      const t = d1 / (d1 - d2);
      pts.push({ x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) });
    }
    if ((d2 > 0) !== (d0 > 0)) {
      const t = d2 / (d2 - d0);
      pts.push({ x: p2.x + t * (p0.x - p2.x), y: p2.y + t * (p0.y - p2.y) });
    }

    if (pts.length === 2) {
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      if (dx * dx + dy * dy > 1e-10) {
        segments.push([pts[0], pts[1]]);
      }
    }
  }

  const rawLoops = chainSegmentsBidirectional(segments, spanScale);
  return classifyLoopsOuterAndHoles(rawLoops);
}

function chainSegmentsBidirectional(segments, spanScale) {
  const used = new Uint8Array(segments.length);
  const tol = Math.max(0.05, spanScale * 0.0025);
  const tolSq = tol * tol;
  const loops = [];

  const distSq = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  };

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const poly = [segments[i][0], segments[i][1]];

    let extended = true;
    while (extended) {
      extended = false;
      const tail = poly[poly.length - 1];
      let bestIdx = -1;
      let bestEnd = 0;
      let bestD = tolSq;

      for (let j = 0; j < segments.length; j++) {
        if (used[j]) continue;
        const d0 = distSq(tail, segments[j][0]);
        if (d0 < bestD) { bestD = d0; bestIdx = j; bestEnd = 0; }
        const d1 = distSq(tail, segments[j][1]);
        if (d1 < bestD) { bestD = d1; bestIdx = j; bestEnd = 1; }
      }

      if (bestIdx !== -1) {
        used[bestIdx] = 1;
        poly.push(bestEnd === 0 ? segments[bestIdx][1] : segments[bestIdx][0]);
        extended = true;
        if (distSq(poly[0], poly[poly.length - 1]) <= tolSq && poly.length >= 4) {
          break;
        }
      }
    }

    if (poly.length >= 3) {
      if (distSq(poly[0], poly[poly.length - 1]) <= tolSq * 4) {
        poly.pop();
      }
      if (poly.length >= 3) {
        loops.push(poly);
      }
    }
  }
  return loops;
}

function computeSignedArea(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    a += (p1.x * p2.y - p2.x * p1.y);
  }
  return a * 0.5;
}

function isPointInPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
      (pt.x < (xj - xi) * (pt.y - yi) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function classifyLoopsOuterAndHoles(rawLoops) {
  const items = rawLoops.map((pts) => {
    const signed = computeSignedArea(pts);
    return { points: pts, absArea: Math.abs(signed), signedArea: signed, isHole: false };
  }).filter((it) => it.absArea > 1e-3);

  items.sort((a, b) => b.absArea - a.absArea);

  for (let i = 0; i < items.length; i++) {
    let depth = 0;
    const testPt = items[i].points[0];
    for (let j = 0; j < i; j++) {
      if (isPointInPolygon(testPt, items[j].points)) {
        depth++;
      }
    }
    items[i].isHole = (depth % 2 === 1);
  }
  return items;
}

// =========================================================================
// CONSTRUCCIÓN DE LASCAS 3D EXTRUIDAS
// =========================================================================
function build3DSlicesMesh() {
  while (sliceGroup3D.children.length > 0) {
    const m = sliceGroup3D.children.pop();
    if (m.geometry) m.geometry.dispose();
    if (m.material) m.material.dispose();
  }

  const extrudeDepth = Math.max(0.2, state.thickness * 0.92);

  state.slices.forEach((slice, idx) => {
    const outers = slice.loops.filter((l) => !l.isHole);
    const holes = slice.loops.filter((l) => l.isHole);
    if (outers.length === 0) return;

    const shapes = outers.map((outer) => {
      const sh = new THREE.Shape();
      outer.points.forEach((pt, i) => {
        if (i === 0) sh.moveTo(pt.x, pt.y);
        else sh.lineTo(pt.x, pt.y);
      });
      sh.closePath();

      holes.forEach((h) => {
        if (isPointInPolygon(h.points[0], outer.points)) {
          const path = new THREE.Path();
          h.points.forEach((pt, i) => {
            if (i === 0) path.moveTo(pt.x, pt.y);
            else path.lineTo(pt.x, pt.y);
          });
          path.closePath();
          sh.holes.push(path);
        }
      });
      return sh;
    });

    const geom = new THREE.ExtrudeGeometry(shapes, { depth: extrudeDepth, bevelEnabled: false });
    geom.translate(0, 0, -extrudeDepth / 2);

    if (state.axis === 'x') {
      geom.rotateY(Math.PI / 2);
      geom.rotateZ(Math.PI / 2);
    } else if (state.axis === 'y') {
      geom.rotateX(Math.PI / 2);
    }

    const hue = 0.55 - (idx / Math.max(1, state.slices.length - 1)) * 0.14;
    const col = new THREE.Color().setHSL(hue, 0.75, 0.52);

    const mat = new THREE.MeshStandardMaterial({
      color: col,
      roughness: 0.35,
      metalness: 0.1,
      transparent: true,
      opacity: slice.selected ? 0.95 : 0.2
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData = { sliceIndex: idx, baseColor: col.getHex() };
    sliceGroup3D.add(mesh);
  });

  update3DSlicesTransforms();
}

function update3DSlicesTransforms() {
  const exp = state.explodeFactor / 100;
  sliceGroup3D.children.forEach((mesh) => {
    const idx = mesh.userData.sliceIndex;
    const slice = state.slices[idx];
    if (!slice) return;

    const offset = slice.coord * (1 + exp * 1.4);
    mesh.position.set(
      state.axis === 'x' ? offset : 0,
      state.axis === 'y' ? offset : 0,
      state.axis === 'z' ? offset : 0
    );

    const isActive = idx === state.activeSliceIndex;
    if (state.isolateCurrent) {
      mesh.visible = isActive;
    } else {
      mesh.visible = true;
    }

    if (isActive) {
      mesh.material.color.setHex(0xf43f5e);
      mesh.material.emissive.setHex(0x4c0519);
      mesh.material.opacity = 1.0;
    } else {
      mesh.material.color.setHex(mesh.userData.baseColor);
      mesh.material.emissive.setHex(0x000000);
      mesh.material.opacity = slice.selected ? 0.92 : 0.16;
    }
  });
}

function onExplodeInput(val) {
  state.explodeFactor = parseFloat(val) || 0;
  document.getElementById('explodeValLabel').textContent = state.explodeFactor + '%';
  update3DSlicesTransforms();
}

function toggleGhostMesh(v) {
  state.showGhost = v;
  if (ghostMesh3D) ghostMesh3D.visible = v;
}

function toggleIsolateSlice(v) {
  state.isolateCurrent = v;
  update3DSlicesTransforms();
}

function setIncludeLabels(v) {
  state.includeLabels = Boolean(v);
  const c1 = document.getElementById('includeLabelsCheck');
  const c2 = document.getElementById('modalIncludeLabelsCheck');
  if (c1) c1.checked = state.includeLabels;
  if (c2) c2.checked = state.includeLabels;
  render2DSlice();
}

function updateGuideOptionsBoxOpacity() {
  const anyGuide = state.includeNextSliceGuide || state.includePrevSliceGuide;
  const optBox = document.getElementById('nextGuideOptionsBox');
  if (optBox) optBox.classList.toggle('opacity-40', !anyGuide);
}

function setIncludeNextGuide(v) {
  state.includeNextSliceGuide = Boolean(v);
  const c1 = document.getElementById('includeNextGuideCheck');
  const c2 = document.getElementById('inspectorNextGuideCheck');
  const c3 = document.getElementById('modalNextGuideCheck');
  if (c1) c1.checked = state.includeNextSliceGuide;
  if (c2) c2.checked = state.includeNextSliceGuide;
  if (c3) c3.checked = state.includeNextSliceGuide;

  const leg = document.getElementById('legendNextGuide');
  if (leg) leg.classList.toggle('opacity-35', !state.includeNextSliceGuide);

  updateGuideOptionsBoxOpacity();
  render2DSlice();
}

function setIncludePrevGuide(v) {
  state.includePrevSliceGuide = Boolean(v);
  const c1 = document.getElementById('includePrevGuideCheck');
  const c2 = document.getElementById('inspectorPrevGuideCheck');
  const c3 = document.getElementById('modalPrevGuideCheck');
  if (c1) c1.checked = state.includePrevSliceGuide;
  if (c2) c2.checked = state.includePrevSliceGuide;
  if (c3) c3.checked = state.includePrevSliceGuide;

  const leg = document.getElementById('legendPrevGuide');
  if (leg) leg.classList.toggle('opacity-35', !state.includePrevSliceGuide);

  updateGuideOptionsBoxOpacity();
  render2DSlice();
}

function onGuideSettingsChange() {
  const upStyleEl = document.getElementById('guideUpperStyleSelect');
  const lowStyleEl = document.getElementById('guideLowerStyleSelect');
  const outerEl = document.getElementById('guideOnlyOuterCheck');
  const clipEl = document.getElementById('guideClipCheck');
  if (upStyleEl) state.upperGuideStyle = upStyleEl.value;
  if (lowStyleEl) state.lowerGuideStyle = lowStyleEl.value;
  if (outerEl) state.guideOnlyOuter = outerEl.checked;
  if (clipEl) state.guideClipToSlice = clipEl.checked;
  render2DSlice();
}

// Devuelve la lasca superior (#N+1) o inferior (#N-1) según dirección ('next' | 'prev')
function getAdjacentSlice(idx, dir) {
  if (dir === 'next' && !state.includeNextSliceGuide) return null;
  if (dir === 'prev' && !state.includePrevSliceGuide) return null;
  const targetIdx = dir === 'prev' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= state.slices.length) return null;
  const refSlice = state.slices[targetIdx];
  if (!refSlice || !refSlice.loops || refSlice.loops.length === 0) return null;
  return refSlice;
}

// Devuelve el patrón de línea en Canvas 2D según estilo elegido
function getCanvasDashPattern(style) {
  if (style === 'dashed') return [7, 4];
  if (style === 'dotted') return [2, 3.5];
  if (style === 'dashdot') return [7, 3, 1.8, 3];
  return [];
}

// Devuelve el atributo stroke-dasharray en mm para el archivo SVG según estilo
function getSvgDashAttr(style) {
  if (style === 'dashed') return ' stroke-dasharray="2.4,1.3"';
  if (style === 'dotted') return ' stroke-dasharray="0.6,1.2"';
  if (style === 'dashdot') return ' stroke-dasharray="2.4,1.0,0.5,1.0"';
  return '';
}

// Determina si un punto 2D está dentro del material sólido de la lasca (regla par-impar)
function isPointOnSliceMaterial(pt, slice) {
  if (!slice || !slice.loops) return false;
  let insideCount = 0;
  for (let i = 0; i < slice.loops.length; i++) {
    const poly = slice.loops[i].points;
    if (poly && poly.length >= 3 && isPointInPolygon(pt, poly)) {
      insideCount++;
    }
  }
  return (insideCount % 2) === 1;
}

// Intersección entre dos segmentos AB y CD; devuelve el parámetro t en [0,1] sobre AB
function intersectSegmentParam(a, b, c, d) {
  const rX = b.x - a.x, rY = b.y - a.y;
  const sX = d.x - c.x, sY = d.y - c.y;
  const denom = rX * sY - rY * sX;
  if (Math.abs(denom) < 1e-10) return null;
  const qpX = c.x - a.x, qpY = c.y - a.y;
  const t = (qpX * sY - qpY * sX) / denom;
  const u = (qpX * rY - qpY * rX) / denom;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return t;
  return null;
}

// Extrae polilíneas continuas de la guía (recortadas al contorno de la lasca actual si está activo)
function getGuidePolylinesForSlice(slice, guideSlice) {
  if (!guideSlice || !guideSlice.loops) return [];
  const allPolylines = [];
  const connectTolSq = 1e-6;

  const samePt = (p1, p2) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return (dx * dx + dy * dy) <= connectTolSq;
  };

  guideSlice.loops.forEach((loop) => {
    if (state.guideOnlyOuter && loop.isHole) return;
    const pts = loop.points;
    if (!pts || pts.length < 3) return;
    const n = pts.length;

    // Si no se recorta, devolvemos el contorno cerrado completo como un único trazo continuo
    if (!state.guideClipToSlice) {
      const closedPoly = pts.slice();
      closedPoly.push({ x: pts[0].x, y: pts[0].y });
      allPolylines.push(closedPoly);
      return;
    }

    const loopPolylines = [];
    let currentPoly = null;

    const appendSegment = (pStart, pEnd) => {
      if (currentPoly && samePt(currentPoly[currentPoly.length - 1], pStart)) {
        currentPoly.push(pEnd);
      } else {
        if (currentPoly && currentPoly.length >= 2) {
          loopPolylines.push(currentPoly);
        }
        currentPoly = [pStart, pEnd];
      }
    };

    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];

      // Buscar intersecciones del segmento guía con los bordes de la lasca actual
      const tValues = [0, 1];
      (slice.loops || []).forEach((sLoop) => {
        const sPts = sLoop.points;
        if (!sPts || sPts.length < 3) return;
        for (let j = 0, m = sPts.length; j < m; j++) {
          const t = intersectSegmentParam(a, b, sPts[j], sPts[(j + 1) % m]);
          if (t !== null && t > 1e-5 && t < 1 - 1e-5) {
            tValues.push(t);
          }
        }
      });

      tValues.sort((x, y) => x - y);

      for (let k = 0; k < tValues.length - 1; k++) {
        const t0 = tValues[k];
        const t1 = tValues[k + 1];
        if (t1 - t0 < 1e-5) continue;
        const midT = (t0 + t1) * 0.5;
        const midPt = { x: a.x + (b.x - a.x) * midT, y: a.y + (b.y - a.y) * midT };
        if (isPointOnSliceMaterial(midPt, slice)) {
          appendSegment(
            { x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 },
            { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1 }
          );
        }
      }
    }

    if (currentPoly && currentPoly.length >= 2) {
      loopPolylines.push(currentPoly);
    }

    // Unir el último tramo con el primero si son continuos a través del vértice 0
    if (loopPolylines.length > 1) {
      const first = loopPolylines[0];
      const last = loopPolylines[loopPolylines.length - 1];
      if (samePt(last[last.length - 1], first[0])) {
        for (let k = 1; k < first.length; k++) {
          last.push(first[k]);
        }
        loopPolylines.shift();
      }
    }

    loopPolylines.forEach((poly) => allPolylines.push(poly));
  });

  return allPolylines;
}

function onRodSettingsChange() {
  const rodCountEl = document.getElementById('rodCountSelect');
  const rodDiamEl = document.getElementById('rodDiameterInput');
  if (rodCountEl) state.rodCount = parseInt(rodCountEl.value, 10) || 0;
  if (rodDiamEl) state.rodDiameter = Math.max(1, parseFloat(rodDiamEl.value) || 4);
  if (state.nestingEnabled) recomputeBoardNesting();
  render2DSlice();
}

// =========================================================================
// MOTOR DE MICRO-UNIONES / PESTAÑAS DE SUJECIÓN POR PRESIÓN (HOLDING TABS)
// =========================================================================
/**
 * Divide un contorno cerrado 2D (pts) dejando sin cortar N puntos (puentes/pestañas
 * de sujeción de p. ej. 1.0 mm) para poder desprender la pieza del tablero haciendo presión.
 */
function computeLoopWithHoldingTabs(pts, isHole = false) {
  if (!pts || pts.length < 3) {
    return { isClosed: true, subpaths: [], tabBridges: [] };
  }
  if (!state.tabsEnabled || (isHole && !state.tabApplyToHoles)) {
    return { isClosed: true, subpaths: [pts], tabBridges: [] };
  }

  const n = pts.length;
  const edges = [];
  let totalPerimeter = 0;

  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len > 1e-6) {
      edges.push({
        p1,
        p2,
        dx,
        dy,
        len,
        startDist: totalPerimeter,
        endDist: totalPerimeter + len
      });
      totalPerimeter += len;
    }
  }

  const tabWidth = Math.max(0.15, Number(state.tabWidthMM) || 1.0);
  if (edges.length === 0 || totalPerimeter <= tabWidth * 2.2) {
    return { isClosed: true, subpaths: [pts], tabBridges: [] };
  }

  let desiredTabs = 4;
  if (state.tabMode === 'spacing') {
    const spacing = Math.max(5, Number(state.tabSpacingMM) || 60);
    desiredTabs = Math.max(2, Math.round(totalPerimeter / spacing));
  } else {
    desiredTabs = Math.max(1, parseInt(state.tabCount, 10) || 4);
  }

  // Evitar que los puentes sin cortar superen el 40% del perímetro en islas pequeñas
  const maxAllowedTabs = Math.max(1, Math.floor((totalPerimeter * 0.4) / tabWidth));
  const numTabs = Math.min(desiredTabs, maxAllowedTabs);
  if (numTabs < 1) {
    return { isClosed: true, subpaths: [pts], tabBridges: [] };
  }

  const getPointAtDist = (dist) => {
    const d = ((dist % totalPerimeter) + totalPerimeter) % totalPerimeter;
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      if (d <= e.endDist + 1e-7 || i === edges.length - 1) {
        const localT = e.len > 1e-8 ? Math.max(0, Math.min(1, (d - e.startDist) / e.len)) : 0;
        return {
          x: e.p1.x + e.dx * localT,
          y: e.p1.y + e.dy * localT
        };
      }
    }
    return { x: edges[0].p1.x, y: edges[0].p1.y };
  };

  const extractSubpathLinear = (sStart, sEnd) => {
    const poly = [];
    const pushUnique = (pt) => {
      if (poly.length === 0) {
        poly.push(pt);
        return;
      }
      const last = poly[poly.length - 1];
      if (Math.hypot(pt.x - last.x, pt.y - last.y) > 1e-5) {
        poly.push(pt);
      }
    };

    pushUnique(getPointAtDist(sStart));
    for (let i = 0; i < edges.length; i++) {
      const vDist = edges[i].startDist;
      if (vDist > sStart + 1e-5 && vDist < sEnd - 1e-5) {
        pushUnique({ x: edges[i].p1.x, y: edges[i].p1.y });
      }
    }
    pushUnique(getPointAtDist(sEnd));
    return poly;
  };

  const step = totalPerimeter / numTabs;
  const halfW = tabWidth * 0.5;
  const tabs = [];
  const tabBridges = [];

  for (let k = 0; k < numTabs; k++) {
    const centerS = (k + 0.5) * step;
    const a = centerS - halfW;
    const b = centerS + halfW;
    tabs.push({ a, b, centerS });
    const cPt = getPointAtDist(centerS);
    const pStart = getPointAtDist(a);
    const pEnd = getPointAtDist(b);
    tabBridges.push({
      x: cPt.x,
      y: cPt.y,
      pStart,
      pEnd,
      widthMM: tabWidth
    });
  }

  const subpaths = [];
  for (let k = 0; k < numTabs; k++) {
    if (k < numTabs - 1) {
      const poly = extractSubpathLinear(tabs[k].b, tabs[k + 1].a);
      if (poly.length >= 2) subpaths.push(poly);
    } else {
      const part1 = extractSubpathLinear(tabs[k].b, totalPerimeter);
      const part2 = extractSubpathLinear(0, tabs[0].a);
      const merged = part1.slice();
      for (let m = 0; m < part2.length; m++) {
        const pt = part2[m];
        const last = merged[merged.length - 1];
        if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) > 1e-5) {
          merged.push(pt);
        }
      }
      if (merged.length >= 2) subpaths.push(merged);
    }
  }

  return {
    isClosed: false,
    subpaths,
    tabBridges
  };
}

function syncHoldingTabsUI() {
  const chkSidebar = document.getElementById('tabsEnabledCheck');
  const chkModal = document.getElementById('modalTabsEnabledCheck');
  const chkInspector = document.getElementById('inspectorTabsCheck');
  const panel = document.getElementById('tabsConfigPanel');
  const legendTabs = document.getElementById('legendHoldingTabs');

  if (chkSidebar) chkSidebar.checked = state.tabsEnabled;
  if (chkModal) chkModal.checked = state.tabsEnabled;
  if (chkInspector) chkInspector.checked = state.tabsEnabled;
  if (panel) panel.classList.toggle('hidden', !state.tabsEnabled);
  if (legendTabs) legendTabs.classList.toggle('hidden', !state.tabsEnabled);

  const btnModeCount = document.getElementById('btnTabModeCount');
  const btnModeSpacing = document.getElementById('btnTabModeSpacing');
  const boxCount = document.getElementById('tabCountBox');
  const boxSpacing = document.getElementById('tabSpacingBox');

  if (btnModeCount && btnModeSpacing) {
    if (state.tabMode === 'count') {
      btnModeCount.className = 'py-1 px-2 rounded bg-amber-500/20 border border-amber-500 text-amber-300 text-[11px] font-semibold';
      btnModeSpacing.className = 'py-1 px-2 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold';
    } else {
      btnModeSpacing.className = 'py-1 px-2 rounded bg-amber-500/20 border border-amber-500 text-amber-300 text-[11px] font-semibold';
      btnModeCount.className = 'py-1 px-2 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold';
    }
  }
  if (boxCount) boxCount.classList.toggle('hidden', state.tabMode !== 'count');
  if (boxSpacing) boxSpacing.classList.toggle('hidden', state.tabMode !== 'spacing');

  const countInput = document.getElementById('tabCountInput');
  const modalCountInput = document.getElementById('modalTabCountInput');
  const spacingInput = document.getElementById('tabSpacingInput');
  const widthInput = document.getElementById('tabWidthInput');
  const modalWidthInput = document.getElementById('modalTabWidthInput');
  const holesCheck = document.getElementById('tabApplyHolesCheck');
  const markersCheck = document.getElementById('tabShowMarkersCheck');
  const summaryBadge = document.getElementById('tabsSummaryBadge');

  if (countInput) countInput.value = state.tabCount;
  if (modalCountInput) modalCountInput.value = state.tabCount;
  if (spacingInput) spacingInput.value = state.tabSpacingMM;
  if (widthInput) widthInput.value = state.tabWidthMM;
  if (modalWidthInput) modalWidthInput.value = state.tabWidthMM;
  if (holesCheck) holesCheck.checked = state.tabApplyToHoles;
  if (markersCheck) markersCheck.checked = state.tabShowMarkers;

  if (summaryBadge) {
    if (!state.tabsEnabled) {
      summaryBadge.textContent = 'Corte continuo cerrado (sin puentes)';
    } else if (state.tabMode === 'count') {
      summaryBadge.textContent = state.tabCount + ' puntos de ' + state.tabWidthMM.toFixed(1) + ' mm por pieza (desprendimiento por presión)';
    } else {
      summaryBadge.textContent = '1 punto de ' + state.tabWidthMM.toFixed(1) + ' mm cada ' + state.tabSpacingMM.toFixed(0) + ' mm de perímetro';
    }
  }
}

function setTabsEnabled(val) {
  state.tabsEnabled = Boolean(val);
  syncHoldingTabsUI();
  render2DSlice();
}

function setTabMode(mode) {
  state.tabMode = mode === 'spacing' ? 'spacing' : 'count';
  syncHoldingTabsUI();
  render2DSlice();
}

function onTabSettingsChange() {
  const countInput = document.getElementById('tabCountInput');
  const spacingInput = document.getElementById('tabSpacingInput');
  const widthInput = document.getElementById('tabWidthInput');
  const holesCheck = document.getElementById('tabApplyHolesCheck');
  const markersCheck = document.getElementById('tabShowMarkersCheck');

  if (countInput) state.tabCount = Math.max(1, Math.min(32, parseInt(countInput.value, 10) || 4));
  if (spacingInput) state.tabSpacingMM = Math.max(5, Math.min(1000, parseFloat(spacingInput.value) || 60));
  if (widthInput) state.tabWidthMM = Math.max(0.15, Math.min(15, parseFloat(widthInput.value) || 1.0));
  if (holesCheck) state.tabApplyToHoles = Boolean(holesCheck.checked);
  if (markersCheck) state.tabShowMarkers = Boolean(markersCheck.checked);

  syncHoldingTabsUI();
  render2DSlice();
}

function onModalTabQuickChange() {
  const modalCountInput = document.getElementById('modalTabCountInput');
  const modalWidthInput = document.getElementById('modalTabWidthInput');
  if (modalCountInput) state.tabCount = Math.max(1, Math.min(32, parseInt(modalCountInput.value, 10) || 4));
  if (modalWidthInput) state.tabWidthMM = Math.max(0.15, Math.min(15, parseFloat(modalWidthInput.value) || 1.0));
  syncHoldingTabsUI();
  render2DSlice();
}

function setPresetTabConfig(count, widthMM) {
  state.tabsEnabled = true;
  state.tabMode = 'count';
  state.tabCount = count;
  state.tabWidthMM = widthMM;
  syncHoldingTabsUI();
  render2DSlice();
}

