/**
 * LayerStudio 3D - 2D Board Nesting Engine (MaxRects)
 * Empaquetado automático multi-tablero, aprovechamiento de huecos y encaje geométrico de texto por isla.
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
// MOTOR DE DISTRIBUCIÓN DE ISLAS EN TABLERO (NESTING 2D) Y GRABADO DE ISLAS
// =========================================================================
function syncBoardInputsUI() {
  const f = getUnitFactor();
  const decimals = state.unit === 'm' ? 3 : (state.unit === 'cm' ? 1 : 0);
  const wInput = document.getElementById('boardWidthInput');
  const hInput = document.getElementById('boardHeightInput');
  if (wInput) wInput.value = Number((state.boardWidthMM / f).toFixed(decimals));
  if (hInput) hInput.value = Number((state.boardHeightMM / f).toFixed(decimals));
  const modalSub = document.getElementById('modalBoardInfoSub');
  if (modalSub) {
    modalSub.textContent = 'Agrupa y maximiza el espacio en tableros de ' +
      state.boardWidthMM.toFixed(0) + '×' + state.boardHeightMM.toFixed(0) + ' mm';
  }
}

function setBoardPresetMM(wMM, hMM) {
  state.boardWidthMM = wMM;
  state.boardHeightMM = hMM;
  syncBoardInputsUI();
  if (!state.nestingEnabled) {
    setNestingEnabled(true);
  } else {
    recomputeBoardNesting();
    update2DInspectorHeader();
    render2DSlice();
  }
}

function setNestingEnabled(val) {
  state.nestingEnabled = Boolean(val);
  const c1 = document.getElementById('nestingEnabledCheck');
  const c2 = document.getElementById('modalNestingEnabledCheck');
  const box = document.getElementById('nestingControlsBox');
  const modalSubOpts = document.getElementById('modalNestingSubOptions');
  const btnToggle = document.getElementById('btnToggleBoardView');
  const btnInfoHeader = document.getElementById('btnInspectorBoardInfo');
  const btnInfoSidebar = document.getElementById('btnSidebarBoardInfo');
  const btnGuideHeader = document.getElementById('btnInspectorAssemblyGuide');
  const btnGuideSidebar = document.getElementById('btnSidebarAssemblyGuide');

  if (c1) c1.checked = state.nestingEnabled;
  if (c2) c2.checked = state.nestingEnabled;
  if (box) box.classList.toggle('opacity-45', !state.nestingEnabled);
  if (modalSubOpts) modalSubOpts.classList.toggle('hidden', !state.nestingEnabled);

  if (btnInfoHeader) {
    btnInfoHeader.classList.toggle('hidden', !state.nestingEnabled);
    btnInfoHeader.classList.toggle('flex', state.nestingEnabled);
  }
  if (btnInfoSidebar) {
    btnInfoSidebar.classList.toggle('hidden', !state.nestingEnabled);
  }
  if (btnGuideHeader) {
    btnGuideHeader.classList.toggle('hidden', !state.nestingEnabled);
    btnGuideHeader.classList.toggle('flex', state.nestingEnabled);
  }
  if (btnGuideSidebar) {
    btnGuideSidebar.classList.toggle('hidden', !state.nestingEnabled);
  }
  const navHint = document.getElementById('boardNavHintBadge');
  if (navHint) {
    navHint.classList.toggle('hidden', !state.nestingEnabled);
    navHint.classList.toggle('flex', state.nestingEnabled);
  }

  if (btnToggle) {
    if (state.nestingEnabled) {
      btnToggle.textContent = '🧩 Vista Tablero: ON';
      btnToggle.className = 'text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold transition';
    } else {
      btnToggle.textContent = '🧩 Distribuir en Tablero: OFF';
      btnToggle.className = 'text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold transition';
    }
  }

  reset2DView(false);

  if (state.nestingEnabled) {
    recomputeBoardNesting();
    state.activeBoardIndex = 0;
    state.activeCarrierIndex = 0;
    const slider = document.getElementById('currentSliceSlider');
    if (slider) {
      slider.max = state.carrierEnabled
        ? Math.max(0, state.nestedCarriers.length - 1)
        : Math.max(0, state.nestedBoards.length - 1);
      slider.value = 0;
    }
  } else {
    if (state.carrierEnabled) {
      state.carrierEnabled = false;
      if (typeof syncCarrierUIState === 'function') syncCarrierUIState();
    }
    const slider = document.getElementById('currentSliceSlider');
    if (slider) {
      slider.max = Math.max(0, state.slices.length - 1);
      slider.value = state.activeSliceIndex;
    }
    const badge = document.getElementById('nestingSummaryBadge');
    if (badge) badge.textContent = 'Desactivado (exportación por lasca)';
  }

  renderSliceStripUI();
  update2DInspectorHeader();
  update3DSlicesTransforms();
  render2DSlice();
}

function onBoardSettingsChange() {
  const f = getUnitFactor();
  const wVal = parseFloat(document.getElementById('boardWidthInput').value);
  const hVal = parseFloat(document.getElementById('boardHeightInput').value);
  const spVal = parseFloat(document.getElementById('nestSpacingInput').value);
  const mgVal = parseFloat(document.getElementById('nestMarginInput').value);

  if (Number.isFinite(wVal) && wVal > 0) state.boardWidthMM = Math.max(20, wVal * f);
  if (Number.isFinite(hVal) && hVal > 0) state.boardHeightMM = Math.max(20, hVal * f);
  if (Number.isFinite(spVal) && spVal >= 0) state.nestSpacingMM = spVal;
  if (Number.isFinite(mgVal) && mgVal >= 0) state.nestMarginMM = mgVal;

  state.nestAllowRotate = document.getElementById('nestRotateCheck').checked;
  state.nestUseInnerHoles = document.getElementById('nestUseHolesCheck').checked;
  const clipChk = document.getElementById('nestClipOversizedCheck');
  if (clipChk) state.nestClipOversized = clipChk.checked;

  syncBoardInputsUI();
  if (state.nestingEnabled) {
    recomputeBoardNesting();
    renderSliceStripUI();
    update2DInspectorHeader();
    update3DSlicesTransforms();
    render2DSlice();
  }
}

function setNestClipOversized(v) {
  state.nestClipOversized = Boolean(v);
  const c1 = document.getElementById('nestClipOversizedCheck');
  const c2 = document.getElementById('modalNestClipOversizedCheck');
  if (c1) c1.checked = state.nestClipOversized;
  if (c2) c2.checked = state.nestClipOversized;
  if (state.nestingEnabled) {
    recomputeBoardNesting();
    renderSliceStripUI();
    update2DInspectorHeader();
    update3DSlicesTransforms();
    render2DSlice();
  }
}

function onNestEngraveSettingsChange() {
  state.nestEngraveSliceNum = document.getElementById('nestEngraveNumCheck').checked;
  state.nestEngraveGuideType = document.getElementById('nestEngraveGuideTypeCheck').checked;
  const m1 = document.getElementById('modalNestEngraveNumCheck');
  const m2 = document.getElementById('modalNestEngraveGuideCheck');
  if (m1) m1.checked = state.nestEngraveSliceNum;
  if (m2) m2.checked = state.nestEngraveGuideType;
  if (state.nestingEnabled) {
    recomputeBoardNesting();
  }
  render2DSlice();
}

function setNestEngraveNum(v) {
  state.nestEngraveSliceNum = Boolean(v);
  const c1 = document.getElementById('nestEngraveNumCheck');
  const c2 = document.getElementById('modalNestEngraveNumCheck');
  if (c1) c1.checked = state.nestEngraveSliceNum;
  if (c2) c2.checked = state.nestEngraveSliceNum;
  if (state.nestingEnabled) recomputeBoardNesting();
  render2DSlice();
}

function setNestEngraveGuideType(v) {
  state.nestEngraveGuideType = Boolean(v);
  const c1 = document.getElementById('nestEngraveGuideTypeCheck');
  const c2 = document.getElementById('modalNestEngraveGuideCheck');
  if (c1) c1.checked = state.nestEngraveGuideType;
  if (c2) c2.checked = state.nestEngraveGuideType;
  if (state.nestingEnabled) recomputeBoardNesting();
  render2DSlice();
}

// Verifica si un punto está dentro del material sólido de una isla específica
function isPointInIslandMaterial(pt, outerPts, holeLoops) {
  if (!isPointInPolygon(pt, outerPts)) return false;
  for (let i = 0; i < holeLoops.length; i++) {
    if (isPointInPolygon(pt, holeLoops[i].points)) return false;
  }
  return true;
}

// Recorta las polilíneas de una lasca adyacente (superior o inferior) exclusivamente dentro de una isla
function getGuidePolylinesForIsland(outerPts, holeLoops, guideSlice) {
  const guideLoops = guideSlice ? (guideSlice.unsplitLoops || guideSlice.loops) : null;
  if (!guideLoops) return [];
  const allPolylines = [];
  const connectTolSq = 1e-6;
  const boundaryLoops = [{ points: outerPts }].concat(holeLoops || []);

  const samePt = (p1, p2) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return (dx * dx + dy * dy) <= connectTolSq;
  };

  guideLoops.forEach((loop) => {
    if (state.guideOnlyOuter && loop.isHole) return;
    const pts = loop.points;
    if (!pts || pts.length < 3) return;
    const n = pts.length;

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

      const tValues = [0, 1];
      boundaryLoops.forEach((bLoop) => {
        const bPts = bLoop.points;
        if (!bPts || bPts.length < 3) return;
        for (let j = 0, m = bPts.length; j < m; j++) {
          const t = intersectSegmentParam(a, b, bPts[j], bPts[(j + 1) % m]);
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
        if (isPointInIslandMaterial(midPt, outerPts, holeLoops)) {
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

// Distancia mínima de un punto a un segmento AB
function distToSegmentSq(p, a, b) {
  const l2 = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
  if (l2 === 0) return (p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y);
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * (b.x - a.x);
  const projY = a.y + t * (b.y - a.y);
  return (p.x - projX) * (p.x - projX) + (p.y - projY) * (p.y - projY);
}

// Comprueba si dos segmentos 2D se cruzan
function segmentsIntersect2D(a, b, c, d) {
  const ccw = (p1, p2, p3) => (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
  return (ccw(a, c, d) !== ccw(b, c, d)) && (ccw(a, b, c) !== ccw(a, b, d));
}

// Verifica geométricamente que la caja del texto (cx, cy, w, h) esté en su totalidad dentro del material sólido de la isla
function isRectStrictlyInsideIsland(cx, cy, w, h, outerPts, holeLoops, rods, rodRadius) {
  const halfW = w * 0.5;
  const halfH = h * 0.5;
  const minX = cx - halfW, maxX = cx + halfW;
  const minY = cy - halfH, maxY = cy + halfH;

  // 1. Las 4 esquinas y los 4 puntos medios de la caja deben estar dentro del material sólido
  const checkPts = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
    { x: cx,   y: minY },
    { x: cx,   y: maxY },
    { x: minX, y: cy   },
    { x: maxX, y: cy   }
  ];
  for (let i = 0; i < checkPts.length; i++) {
    if (!isPointInIslandMaterial(checkPts[i], outerPts, holeLoops)) return false;
  }

  // 2. Ninguna perforación de varilla guía puede invadir la caja del texto
  const safeRodR = rodRadius + 0.25;
  const safeRodRSq = safeRodR * safeRodR;
  for (let r = 0; r < rods.length; r++) {
    const rx = rods[r].x, ry = rods[r].y;
    const nearX = Math.max(minX, Math.min(maxX, rx));
    const nearY = Math.max(minY, Math.min(maxY, ry));
    const dx = rx - nearX, dy = ry - nearY;
    if (dx * dx + dy * dy < safeRodRSq) return false;
  }

  // 3. Ninguna arista del contorno exterior ni de los huecos interiores puede cortar ni tocar la caja
  const rectCorners = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY }
  ];

  const checkPolyEdges = (poly) => {
    for (let i = 0, n = poly.length; i < n; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % n];
      if (p1.x < minX && p2.x < minX) continue;
      if (p1.x > maxX && p2.x > maxX) continue;
      if (p1.y < minY && p2.y < minY) continue;
      if (p1.y > maxY && p2.y > maxY) continue;

      if (p1.x >= minX && p1.x <= maxX && p1.y >= minY && p1.y <= maxY) return false;

      for (let e = 0; e < 4; e++) {
        if (segmentsIntersect2D(p1, p2, rectCorners[e], rectCorners[(e + 1) % 4])) {
          return false;
        }
      }
    }
    return true;
  };

  if (!checkPolyEdges(outerPts)) return false;
  for (let hIdx = 0; hIdx < holeLoops.length; hIdx++) {
    if (!checkPolyEdges(holeLoops[hIdx].points)) return false;
  }

  return true;
}

// Devuelve las variantes de líneas de texto (1 línea o 2 líneas) para una isla
function getIslandTextLineOptions(item) {
  let numPart = '';
  let guidePart = '';
  const sliceRef = state.slices && state.slices[item.sliceIndex];
  const baseCode = (item.puzzleCode || (sliceRef && sliceRef.puzzleCode))
    ? (item.puzzleCode || sliceRef.puzzleCode)
    : ('#' + (item.sliceIndex + 1));

  if (state.nestEngraveSliceNum) {
    if (item.customCode) {
      numPart = item.customCode;
    } else {
      numPart = item.totalIslandsInSlice > 1
        ? baseCode + '.' + (item.islandIdxInSlice + 1)
        : baseCode;
    }
  }
  if (state.nestEngraveGuideType) {
    if (state.constructionMode === 'puzzle3d' || item.puzzleSeries || (sliceRef && sliceRef.puzzleSeries)) {
      const isSolidCap = Boolean(item.isPuzzleSolidCap || (sliceRef && sliceRef.isPuzzleSolidCap));
      if (isSolidCap) {
        guidePart = '[Tapa]';
      } else {
        const series = item.puzzleSeries || (sliceRef && sliceRef.puzzleSeries);
        guidePart = series === 'A' ? '[Base]' : '[Cruce]';
      }
    } else {
      const hasSup = state.includeNextSliceGuide && item.upperPolys && item.upperPolys.length > 0;
      const hasInf = state.includePrevSliceGuide && item.lowerPolys && item.lowerPolys.length > 0;
      if (hasSup && hasInf) {
        guidePart = '[Ambas]';
      } else if (hasSup) {
        guidePart = '[Sup]';
      } else if (hasInf) {
        guidePart = '[Inf]';
      } else {
        guidePart = '[Sin guía]';
      }
    }
  }

  if (numPart && guidePart) {
    return [
      [numPart + ' ' + guidePart], // Opción 1 línea (ideal para islas alargadas horizontalmente)
      [numPart, guidePart]         // Opción 2 líneas (ideal para islas compactas o estrechas)
    ];
  }
  if (numPart) return [[numPart]];
  if (guidePart) return [[guidePart]];
  return [];
}

function formatIslandEngraveLabel(item) {
  const opts = getIslandTextLineOptions(item);
  return opts.length > 0 ? opts[0].join(' ') : '';
}

// Calcula la posición (x, y), distribución de líneas y tamaño de fuente exacto que cabe 100% dentro de la isla
function computeOptimalIslandTextLayout(outerPts, holeLoops, rods, itemMeta) {
  const lineOptions = getIslandTextLineOptions(itemMeta);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  outerPts.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  });
  const bW = Math.max(0.5, maxX - minX);
  const bH = Math.max(0.5, maxY - minY);
  const cx0 = (minX + maxX) * 0.5;
  const cy0 = (minY + maxY) * 0.5;

  if (lineOptions.length === 0) {
    return { x: cx0, y: cy0, fontSizeMM: 0, lines: [], maxBoxW: 0, maxBoxH: 0 };
  }

  const rodRadius = state.rodDiameter / 2;
  const allPolys = [outerPts].concat((holeLoops || []).map((h) => h.points));
  const candidates = [];

  // Escaneo horizontal para encontrar puntos centrales dentro de tramos sólidos
  const ySteps = 12;
  for (let iy = 1; iy < ySteps; iy++) {
    const y = minY + (bH * iy) / ySteps;
    const xInts = [];
    for (let pIdx = 0; pIdx < allPolys.length; pIdx++) {
      const poly = allPolys[pIdx];
      for (let i = 0, n = poly.length; i < n; i++) {
        const p1 = poly[i], p2 = poly[(i + 1) % n];
        if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
          const t = (y - p1.y) / (p2.y - p1.y);
          xInts.push(p1.x + t * (p2.x - p1.x));
        }
      }
    }
    xInts.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xInts.length; k += 2) {
      const x0 = xInts[k], x1 = xInts[k + 1];
      const span = x1 - x0;
      if (span > 0.4) {
        candidates.push({ x: (x0 + x1) * 0.5, y: y });
        if (span > 8) {
          candidates.push({ x: x0 + span * 0.35, y: y });
          candidates.push({ x: x0 + span * 0.65, y: y });
        }
      }
    }
  }

  // Escaneo vertical complementario
  const xSteps = 10;
  for (let ix = 1; ix < xSteps; ix++) {
    const x = minX + (bW * ix) / xSteps;
    const yInts = [];
    for (let pIdx = 0; pIdx < allPolys.length; pIdx++) {
      const poly = allPolys[pIdx];
      for (let i = 0, n = poly.length; i < n; i++) {
        const p1 = poly[i], p2 = poly[(i + 1) % n];
        if ((p1.x <= x && p2.x > x) || (p2.x <= x && p1.x > x)) {
          const t = (x - p1.x) / (p2.x - p1.x);
          yInts.push(p1.y + t * (p2.y - p1.y));
        }
      }
    }
    yInts.sort((a, b) => a - b);
    for (let k = 0; k + 1 < yInts.length; k += 2) {
      const y0 = yInts[k], y1 = yInts[k + 1];
      if (y1 - y0 > 0.4) {
        candidates.push({ x: x, y: (y0 + y1) * 0.5 });
      }
    }
  }

  if (candidates.length === 0) {
    candidates.push({ x: cx0, y: cy0 });
  }

  // Precalcular constantes de proporción ancho/alto para cada opción de líneas (con margen de seguridad interior)
  const layoutsMeta = lineOptions.map((lines) => {
    const maxChars = Math.max(...lines.map((l) => l.length));
    const kW = Math.max(1.2, maxChars * 0.68 + 0.55);
    const kH = lines.length === 1 ? 1.32 : 2.52;
    return { lines, kW, kH };
  });

  let bestFs = 0;
  let bestPt = candidates[0];
  let bestLayout = layoutsMeta[0];

  const evaluateCandidate = (pt) => {
    if (!isPointInIslandMaterial(pt, outerPts, holeLoops)) return;
    for (let r = 0; r < rods.length; r++) {
      if (Math.hypot(pt.x - rods[r].x, pt.y - rods[r].y) <= rodRadius + 0.25) return;
    }

    for (let lIdx = 0; lIdx < layoutsMeta.length; lIdx++) {
      const lay = layoutsMeta[lIdx];
      const maxCapFs = Math.min(4.8, bW / lay.kW, bH / lay.kH);
      if (maxCapFs <= bestFs) continue;

      // Comprobar primero si este punto supera al mejor tamaño encontrado hasta ahora
      const thresholdFs = Math.max(0.08, bestFs * 1.02);
      if (!isRectStrictlyInsideIsland(pt.x, pt.y, lay.kW * thresholdFs, lay.kH * thresholdFs, outerPts, holeLoops, rods, rodRadius)) {
        continue;
      }

      let lo = thresholdFs;
      let hi = maxCapFs;
      for (let iter = 0; iter < 7; iter++) {
        const mid = (lo + hi) * 0.5;
        if (isRectStrictlyInsideIsland(pt.x, pt.y, lay.kW * mid, lay.kH * mid, outerPts, holeLoops, rods, rodRadius)) {
          lo = mid;
        } else {
          hi = mid;
        }
      }

      if (lo > bestFs) {
        bestFs = lo;
        bestPt = pt;
        bestLayout = lay;
      }
    }
  };

  for (let i = 0; i < candidates.length; i++) {
    evaluateCandidate(candidates[i]);
  }

  // Refinamiento local fino alrededor del mejor punto encontrado
  const stepX = bW * 0.035;
  const stepY = bH * 0.035;
  const centerRef = { x: bestPt.x, y: bestPt.y };
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      if (dx === 0 && dy === 0) continue;
      evaluateCandidate({ x: centerRef.x + dx * stepX, y: centerRef.y + dy * stepY });
    }
  }

  return {
    x: bestPt.x,
    y: bestPt.y,
    fontSizeMM: bestFs,
    lines: bestLayout.lines,
    maxBoxW: bestLayout.kW * bestFs,
    maxBoxH: bestLayout.kH * bestFs
  };
}

// Extrae todas las islas físicas independientes de un conjunto de lascas
function extractIslandsFromSlices(targetSlices) {
  const islands = [];

  targetSlices.forEach((slice) => {
    const idx = slice.index;
    const outers = (slice.loops || []).filter((l) => !l.isHole);
    const holes = (slice.loops || []).filter((l) => l.isHole);
    if (outers.length === 0) return;

    // Obtener lascas adyacentes reales del modelo para calcular si esta isla tiene guía superior/inferior
    const isPuzzle = state.constructionMode === 'puzzle3d';
    const nextSlice = (!isPuzzle && idx + 1 < state.slices.length) ? state.slices[idx + 1] : null;
    const prevSlice = (!isPuzzle && idx - 1 >= 0) ? state.slices[idx - 1] : null;
    const sliceRods = getAlignmentHoles2D(slice);

    const isSplitMulti = Boolean(state.splitModelEnabled && slice.splitGrid && slice.splitGrid.totalParts > 1);
    const baseCode = slice.puzzleCode ? slice.puzzleCode : ('#' + (idx + 1));

    // Contar cuántas islas hay por cada sectorCode en esta lasca para numerar #1-A1 o #1-A1.1
    const sectorTotalCounts = {};
    const sectorSeenCounts = {};
    if (isSplitMulti) {
      outers.forEach((o) => {
        const sc = o.sectorCode || 'A1';
        sectorTotalCounts[sc] = (sectorTotalCounts[sc] || 0) + 1;
      });
    }

    outers.forEach((outer, oIdx) => {
      // Asignar solo los huecos que pertenecen directamente a esta isla exterior
      const islandHoles = holes.filter((h) => {
        if (!isPointInPolygon(h.points[0], outer.points)) return false;
        for (let k = 0; k < outers.length; k++) {
          if (k !== oIdx && outers[k].absArea < outer.absArea) {
            if (isPointInPolygon(h.points[0], outers[k].points)) return false;
          }
        }
        return true;
      });

      // Límites geométricos exactos de esta isla
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      outer.points.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
      const width = Math.max(0.5, maxX - minX);
      const height = Math.max(0.5, maxY - minY);
      const bounds = { minX, minY, maxX, maxY, width, height, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };

      // Varillas que caen dentro de esta isla
      const islandRods = sliceRods.filter((r) => isPointInIslandMaterial(r, outer.points, islandHoles));

      // Vectores de grabado u orla de marco que caen dentro de esta isla
      const islandEngraveLoops = (slice.engraveLoops || []).filter((el) =>
        el && el.points && el.points.length >= 3 && isPointInIslandMaterial(el.points[0], outer.points, islandHoles)
      );

      // Polilíneas de guía superior (#N+1) e inferior (#N-1) recortadas a esta isla
      const upperPolys = nextSlice ? getGuidePolylinesForIsland(outer.points, islandHoles, nextSlice) : [];
      const lowerPolys = prevSlice ? getGuidePolylinesForIsland(outer.points, islandHoles, prevSlice) : [];

      let customCode = null;
      if (isSplitMulti && outer.sectorCode) {
        const sc = outer.sectorCode;
        sectorSeenCounts[sc] = (sectorSeenCounts[sc] || 0) + 1;
        customCode = sectorTotalCounts[sc] > 1
          ? (baseCode + '-' + sc + '.' + sectorSeenCounts[sc])
          : (baseCode + '-' + sc);
      }

      const itemObj = {
        sliceIndex: idx,
        puzzleCode: slice.puzzleCode || null,
        puzzleSeries: slice.puzzleSeries || null,
        isPuzzleSolidCap: Boolean(slice.isPuzzleSolidCap),
        sliceAxis: slice.sliceAxis || state.axis,
        puzzleSlotsCount: slice.puzzleSlots ? slice.puzzleSlots.length : 0,
        sectorCode: outer.sectorCode || null,
        sectorCol: typeof outer.sectorCol === 'number' ? outer.sectorCol : null,
        sectorRow: typeof outer.sectorRow === 'number' ? outer.sectorRow : null,
        customCode: customCode,
        islandIdxInSlice: oIdx,
        totalIslandsInSlice: outers.length,
        isFrame: Boolean(outer.isFrame),
        outerPoints: outer.points,
        outerArea: outer.absArea,
        holes: islandHoles,
        rods: islandRods,
        engraveLoops: islandEngraveLoops,
        upperPolys: upperPolys,
        lowerPolys: lowerPolys,
        bounds: bounds,
        textLayout: null
      };

      itemObj.textLayout = computeOptimalIslandTextLayout(outer.points, islandHoles, islandRods, itemObj);
      islands.push(itemObj);
    });
  });

  return islands;
}

// Busca un rectángulo inscrito seguro dentro de un hueco grande para aprovecharlo con islas menores
function findInscribedFreeRectInHole(holePts, spacing) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  holePts.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  });
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 16 || h < 16) return null;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  if (!isPointInPolygon({ x: cx, y: cy }, holePts)) return null;

  // Buscar la distancia mínima desde el centro del hueco a cualquier arista del hueco
  let minDistSq = Infinity;
  for (let i = 0, n = holePts.length; i < n; i++) {
    const dSq = distToSegmentSq({ x: cx, y: cy }, holePts[i], holePts[(i + 1) % n]);
    if (dSq < minDistSq) minDistSq = dSq;
  }
  const inRadius = Math.sqrt(minDistSq);
  const halfSide = inRadius * 0.7071 - spacing;
  if (halfSide <= 4) return null;

  return {
    x: cx - halfSide,
    y: cy - halfSide,
    w: halfSide * 2 + spacing,
    h: halfSide * 2 + spacing
  };
}

// Recorta un polígono cerrado (contorno exterior o hueco) contra un rectángulo [minX, minY, maxX, maxY]
function clipPolygonToRect2D(points, minX, minY, maxX, maxY) {
  if (!points || points.length < 3) return [];

  const clipEdge = (pts, insideFn, intersectFn) => {
    const out = [];
    const n = pts.length;
    if (n === 0) return out;
    for (let i = 0; i < n; i++) {
      const curr = pts[i];
      const prev = pts[(i + n - 1) % n];
      const currIn = insideFn(curr);
      const prevIn = insideFn(prev);
      if (currIn) {
        if (!prevIn) out.push(intersectFn(prev, curr));
        out.push(curr);
      } else if (prevIn) {
        out.push(intersectFn(prev, curr));
      }
    }
    return out;
  };

  let res = points.slice();
  // Borde izquierdo: x >= minX
  res = clipEdge(res, (p) => p.x >= minX - 1e-6, (p1, p2) => {
    const t = (minX - p1.x) / ((p2.x - p1.x) || 1e-12);
    return { x: minX, y: p1.y + t * (p2.y - p1.y) };
  });
  // Borde derecho: x <= maxX
  res = clipEdge(res, (p) => p.x <= maxX + 1e-6, (p1, p2) => {
    const t = (maxX - p1.x) / ((p2.x - p1.x) || 1e-12);
    return { x: maxX, y: p1.y + t * (p2.y - p1.y) };
  });
  // Borde inferior: y >= minY
  res = clipEdge(res, (p) => p.y >= minY - 1e-6, (p1, p2) => {
    const t = (minY - p1.y) / ((p2.y - p1.y) || 1e-12);
    return { x: p1.x + t * (p2.x - p1.x), y: minY };
  });
  // Borde superior: y <= maxY
  res = clipEdge(res, (p) => p.y <= maxY + 1e-6, (p1, p2) => {
    const t = (maxY - p1.y) / ((p2.y - p1.y) || 1e-12);
    return { x: p1.x + t * (p2.x - p1.x), y: maxY };
  });

  const cleaned = [];
  for (let i = 0; i < res.length; i++) {
    const prev = cleaned[cleaned.length - 1];
    if (!prev || Math.hypot(res[i].x - prev.x, res[i].y - prev.y) > 1e-4) {
      cleaned.push(res[i]);
    }
  }
  if (
    cleaned.length > 1 &&
    Math.hypot(cleaned[0].x - cleaned[cleaned.length - 1].x, cleaned[0].y - cleaned[cleaned.length - 1].y) <= 1e-4
  ) {
    cleaned.pop();
  }
  return cleaned.length >= 3 ? cleaned : [];
}

// Recorta una polilínea abierta (guía superior o inferior) contra un rectángulo [minX, minY, maxX, maxY]
function clipPolylineToRect2D(poly, minX, minY, maxX, maxY) {
  if (!poly || poly.length < 2) return [];
  const resultPolys = [];
  let currentPoly = null;

  const clipSegment = (p1, p2) => {
    let t0 = 0, t1 = 1;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const p = [-dx, dx, -dy, dy];
    const q = [p1.x - minX, maxX - p1.x, p1.y - minY, maxY - p1.y];
    for (let i = 0; i < 4; i++) {
      if (Math.abs(p[i]) < 1e-10) {
        if (q[i] < 0) return null;
      } else {
        const t = q[i] / p[i];
        if (p[i] < 0) {
          if (t > t1) return null;
          if (t > t0) t0 = t;
        } else {
          if (t < t0) return null;
          if (t < t1) t1 = t;
        }
      }
    }
    return [
      { x: p1.x + t0 * dx, y: p1.y + t0 * dy },
      { x: p1.x + t1 * dx, y: p1.y + t1 * dy }
    ];
  };

  for (let i = 0; i < poly.length - 1; i++) {
    const seg = clipSegment(poly[i], poly[i + 1]);
    if (!seg) {
      if (currentPoly && currentPoly.length >= 2) resultPolys.push(currentPoly);
      currentPoly = null;
    } else {
      if (!currentPoly) {
        currentPoly = [seg[0], seg[1]];
      } else {
        const last = currentPoly[currentPoly.length - 1];
        if (Math.hypot(last.x - seg[0].x, last.y - seg[0].y) <= 1e-4) {
          currentPoly.push(seg[1]);
        } else {
          resultPolys.push(currentPoly);
          currentPoly = [seg[0], seg[1]];
        }
      }
    }
  }
  if (currentPoly && currentPoly.length >= 2) resultPolys.push(currentPoly);
  return resultPolys;
}

// Recorta una isla que supera las dimensiones del tablero para conservar la máxima parte que cabe
function clipOversizedIslandToUsableBoard(island, usableW, usableH, allowRot) {
  const w0 = island.bounds.width;
  const h0 = island.bounds.height;

  // Evaluar si conviene recortar pensando en orientación 0° o 90° para conservar la mayor área posible
  const fitW_norm = Math.min(w0, usableW);
  const fitH_norm = Math.min(h0, usableH);
  const fitW_rot = Math.min(w0, usableH);
  const fitH_rot = Math.min(h0, usableW);

  const preferRot = allowRot && (fitW_rot * fitH_rot > fitW_norm * fitH_norm);
  const limitW = preferRot ? usableH : usableW;
  const limitH = preferRot ? usableW : usableH;

  const cMinX = w0 > limitW ? (island.bounds.cx - limitW * 0.5) : (island.bounds.minX - 1);
  const cMaxX = w0 > limitW ? (island.bounds.cx + limitW * 0.5) : (island.bounds.maxX + 1);
  const cMinY = h0 > limitH ? (island.bounds.cy - limitH * 0.5) : (island.bounds.minY - 1);
  const cMaxY = h0 > limitH ? (island.bounds.cy + limitH * 0.5) : (island.bounds.maxY + 1);

  const clippedOuter = clipPolygonToRect2D(island.outerPoints, cMinX, cMinY, cMaxX, cMaxY);
  if (clippedOuter.length < 3) return null;

  const newArea = Math.abs(computeSignedArea(clippedOuter));
  if (newArea < 1e-2) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  clippedOuter.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  });

  const clippedHoles = [];
  (island.holes || []).forEach((h) => {
    const ch = clipPolygonToRect2D(h.points, cMinX + 0.15, cMinY + 0.15, cMaxX - 0.15, cMaxY - 0.15);
    if (ch.length >= 3) {
      const ha = Math.abs(computeSignedArea(ch));
      if (ha > 1e-2) {
        clippedHoles.push({ points: ch, absArea: ha, isHole: true });
      }
    }
  });

  const rodR = state.rodDiameter / 2;
  const clippedRods = (island.rods || []).filter((r) =>
    r.x - rodR >= cMinX &&
    r.x + rodR <= cMaxX &&
    r.y - rodR >= cMinY &&
    r.y + rodR <= cMaxY &&
    isPointInIslandMaterial(r, clippedOuter, clippedHoles)
  );

  const clippedUpper = [];
  (island.upperPolys || []).forEach((poly) => {
    clipPolylineToRect2D(poly, cMinX, cMinY, cMaxX, cMaxY).forEach((cp) => clippedUpper.push(cp));
  });

  const clippedLower = [];
  (island.lowerPolys || []).forEach((poly) => {
    clipPolylineToRect2D(poly, cMinX, cMinY, cMaxX, cMaxY).forEach((cp) => clippedLower.push(cp));
  });

  const newBounds = {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(0.5, maxX - minX),
    height: Math.max(0.5, maxY - minY),
    cx: (minX + maxX) * 0.5,
    cy: (minY + maxY) * 0.5
  };

  const clippedIsland = {
    sliceIndex: island.sliceIndex,
    islandIdxInSlice: island.islandIdxInSlice,
    totalIslandsInSlice: island.totalIslandsInSlice,
    outerPoints: clippedOuter,
    outerArea: newArea,
    holes: clippedHoles,
    rods: clippedRods,
    upperPolys: clippedUpper,
    lowerPolys: clippedLower,
    bounds: newBounds,
    isClippedToBoard: true,
    origWidth: w0,
    origHeight: h0,
    textLayout: null
  };

  clippedIsland.textLayout = computeOptimalIslandTextLayout(clippedOuter, clippedHoles, clippedRods, clippedIsland);
  return clippedIsland;
}

// Algoritmo MaxRects multi-tablero: coloca en cada tablero únicamente las piezas que caben, abriendo nuevos tableros según sea necesario
function packIslandsIntoBoards(islands, boardW, boardH, margin, spacing, allowRot, useHoles) {
  const usableW = Math.max(1, boardW - margin * 2);
  const usableH = Math.max(1, boardH - margin * 2);

  // Ordenar islas de mayor a menor área exterior para optimizar el espacio
  const sorted = islands.slice().sort((a, b) => b.outerArea - a.outerArea);
  const boards = [];
  let unfitCount = 0;
  let clippedCount = 0;

  const createNewBoard = () => {
    const b = {
      boardIndex: boards.length,
      width: boardW,
      height: boardH,
      margin: margin,
      freeRects: [{
        x: margin,
        y: margin,
        w: usableW + spacing,
        h: usableH + spacing
      }],
      placements: [],
      usedArea: 0
    };
    boards.push(b);
    return b;
  };

  const splitFreeRects = (freeRects, usedRect) => {
    const nextFree = [];
    for (let i = 0; i < freeRects.length; i++) {
      const fr = freeRects[i];
      if (
        usedRect.x >= fr.x + fr.w ||
        usedRect.x + usedRect.w <= fr.x ||
        usedRect.y >= fr.y + fr.h ||
        usedRect.y + usedRect.h <= fr.y
      ) {
        nextFree.push(fr);
        continue;
      }
      if (usedRect.x > fr.x) {
        nextFree.push({ x: fr.x, y: fr.y, w: usedRect.x - fr.x, h: fr.h });
      }
      if (usedRect.x + usedRect.w < fr.x + fr.w) {
        nextFree.push({
          x: usedRect.x + usedRect.w,
          y: fr.y,
          w: (fr.x + fr.w) - (usedRect.x + usedRect.w),
          h: fr.h
        });
      }
      if (usedRect.y > fr.y) {
        nextFree.push({ x: fr.x, y: fr.y, w: fr.w, h: usedRect.y - fr.y });
      }
      if (usedRect.y + usedRect.h < fr.y + fr.h) {
        nextFree.push({
          x: fr.x,
          y: usedRect.y + usedRect.h,
          w: fr.w,
          h: (fr.y + fr.h) - (usedRect.y + usedRect.h)
        });
      }
    }

    // Podar rectángulos libres redundantes contenidos dentro de otros mayores
    const pruned = [];
    for (let i = 0; i < nextFree.length; i++) {
      const a = nextFree[i];
      if (a.w <= spacing + 0.5 || a.h <= spacing + 0.5) continue;
      let contained = false;
      for (let j = 0; j < nextFree.length; j++) {
        if (i === j) continue;
        const b = nextFree[j];
        if (
          a.x >= b.x - 1e-4 &&
          a.y >= b.y - 1e-4 &&
          a.x + a.w <= b.x + b.w + 1e-4 &&
          a.y + a.h <= b.y + b.h + 1e-4
        ) {
          const areaA = a.w * a.h;
          const areaB = b.w * b.h;
          if (areaA < areaB - 1e-3 || (Math.abs(areaA - areaB) <= 1e-3 && i > j)) {
            contained = true;
            break;
          }
        }
      }
      if (!contained) pruned.push(a);
    }
    return pruned;
  };

  sorted.forEach((rawIsland) => {
    let island = rawIsland;
    let w0 = island.bounds.width;
    let h0 = island.bounds.height;

    // Comprobar primero si la isla cabe físicamente dentro de un tablero vacío de estas dimensiones
    const fitsNormalInEmpty = (w0 <= usableW + 1e-4 && h0 <= usableH + 1e-4);
    const fitsRotInEmpty = allowRot && (h0 <= usableW + 1e-4 && w0 <= usableH + 1e-4);
    if (!fitsNormalInEmpty && !fitsRotInEmpty) {
      if (state.nestClipOversized) {
        const clipped = clipOversizedIslandToUsableBoard(island, usableW, usableH, allowRot);
        if (!clipped) {
          unfitCount++;
          return;
        }
        island = clipped;
        w0 = island.bounds.width;
        h0 = island.bounds.height;
        // Si tras recortar al tablero el fragmento resultante es inferior al tamaño mínimo de isla permitido, se descarta
        if (!doesIslandPassMinSizeFilter(w0, h0, island.outerArea)) {
          return;
        }
        clippedCount++;
      } else {
        unfitCount++;
        return;
      }
    }

    const reqW0 = w0 + spacing;
    const reqH0 = h0 + spacing;

    let bestBoard = null;
    let bestX = 0, bestY = 0;
    let bestRotated = false;
    let bestShortSide = Infinity;
    let bestLongSide = Infinity;

    const tryFindOnBoard = (board) => {
      for (let i = 0; i < board.freeRects.length; i++) {
        const fr = board.freeRects[i];
        // Orientación 0 grados (verificando además que no exceda el límite útil del tablero)
        if (
          fr.w >= reqW0 - 1e-4 &&
          fr.h >= reqH0 - 1e-4 &&
          fr.x + w0 <= boardW - margin + 1e-3 &&
          fr.y + h0 <= boardH - margin + 1e-3
        ) {
          const remW = fr.w - reqW0;
          const remH = fr.h - reqH0;
          const shortS = Math.min(remW, remH);
          const longS = Math.max(remW, remH);
          if (shortS < bestShortSide || (shortS === bestShortSide && longS < bestLongSide)) {
            bestBoard = board;
            bestX = fr.x;
            bestY = fr.y;
            bestRotated = false;
            bestShortSide = shortS;
            bestLongSide = longS;
          }
        }
        // Orientación 90 grados si está permitido
        if (
          allowRot &&
          fr.w >= reqH0 - 1e-4 &&
          fr.h >= reqW0 - 1e-4 &&
          fr.x + h0 <= boardW - margin + 1e-3 &&
          fr.y + w0 <= boardH - margin + 1e-3
        ) {
          const remW = fr.w - reqH0;
          const remH = fr.h - reqW0;
          const shortS = Math.min(remW, remH);
          const longS = Math.max(remW, remH);
          if (shortS < bestShortSide || (shortS === bestShortSide && longS < bestLongSide)) {
            bestBoard = board;
            bestX = fr.x;
            bestY = fr.y;
            bestRotated = true;
            bestShortSide = shortS;
            bestLongSide = longS;
          }
        }
      }
    };

    // Intentar colocar en los tableros existentes donde quepa
    for (let bIdx = 0; bIdx < boards.length; bIdx++) {
      tryFindOnBoard(boards[bIdx]);
      if (bestBoard) break;
    }

    // Si no cabe en ninguno de los tableros actuales, abrir un nuevo tablero
    if (!bestBoard) {
      const nb = createNewBoard();
      tryFindOnBoard(nb);
    }

    if (!bestBoard) {
      unfitCount++;
      return;
    }

    const placedW = bestRotated ? h0 : w0;
    const placedH = bestRotated ? w0 : h0;
    const usedRect = { x: bestX, y: bestY, w: placedW + spacing, h: placedH + spacing };

    bestBoard.freeRects = splitFreeRects(bestBoard.freeRects, usedRect);
    bestBoard.usedArea += island.outerArea;

    // Transformación de coordenadas locales de la isla a su posición en el tablero
    const transformPt = (pt) => {
      const lx = pt.x - island.bounds.minX;
      const ly = pt.y - island.bounds.minY;
      if (!bestRotated) {
        return { x: bestX + lx, y: bestY + ly };
      }
      return { x: bestX + (h0 - ly), y: bestY + lx };
    };

    const placedOuter = island.outerPoints.map(transformPt);
    if (island.isFrame) placedOuter.isFrame = true;
    const placedHoles = island.holes.map((h) => {
      const hPts = h.points.map(transformPt);
      if (h.isFrame) hPts.isFrame = true;
      return { points: hPts, absArea: h.absArea, isFrame: Boolean(h.isFrame) };
    });
    const placedRods = island.rods.map(transformPt);
    const placedEngraves = (island.engraveLoops || []).map((el) => ({
      points: el.points.map(transformPt),
      isHole: Boolean(el.isHole)
    }));

    // Calcular el encaje exacto del texto en la orientación final de la isla sobre el tablero
    const placedTextLayout = computeOptimalIslandTextLayout(placedOuter, placedHoles, placedRods, island);

    const placedPlacement = {
      island: island,
      isFrame: Boolean(island.isFrame),
      x: bestX,
      y: bestY,
      w: placedW,
      h: placedH,
      rotated: bestRotated,
      isClippedToBoard: Boolean(island.isClippedToBoard),
      origWidth: island.origWidth || w0,
      origHeight: island.origHeight || h0,
      outerPoints: placedOuter,
      holes: placedHoles,
      rods: placedRods,
      engraveLoops: placedEngraves,
      upperPolys: island.upperPolys.map((poly) => poly.map(transformPt)),
      lowerPolys: island.lowerPolys.map((poly) => poly.map(transformPt)),
      textLayout: placedTextLayout
    };

    bestBoard.placements.push(placedPlacement);

    // Aprovechar huecos interiores grandes para anidar islas más pequeñas
    if (useHoles && placedPlacement.holes.length > 0) {
      placedPlacement.holes.forEach((hLoop) => {
        if (hLoop.absArea > 350) {
          const inscribed = findInscribedFreeRectInHole(hLoop.points, spacing);
          if (inscribed) {
            bestBoard.freeRects.push(inscribed);
          }
        }
      });
    }
  });

  boards.forEach((b) => {
    b.efficiency = Math.min(100, (b.usedArea / (boardW * boardH)) * 100);
  });

  return { boards, unfitCount, clippedCount };
}

function getEffectiveBoardNestMargin() {
  let effectiveMargin = Number(state.nestMarginMM) || 0;
  if (state.slicerFrameEnabled && state.slicerFrameFit === 'board') {
    const laserMode = state.slicerFrameLaserMode || 'cut_outer';
    const frameBand = laserMode === 'cut_outer'
      ? 1.5
      : (Math.max(0.5, Number(state.slicerFrameThicknessMM) || 8.0) + 1.5);
    const neededMargin = Math.max(0, Number(state.slicerFrameMarginMM) || 0) + frameBand;
    effectiveMargin = Math.max(effectiveMargin, neededMargin);
  }
  return effectiveMargin;
}

function recomputeBoardNesting() {
  const selectedSlices = state.slices.filter((s) => s.selected);
  const islands = extractIslandsFromSlices(selectedSlices);
  const effectiveMargin = getEffectiveBoardNestMargin();
  const result = packIslandsIntoBoards(
    islands,
    state.boardWidthMM,
    state.boardHeightMM,
    effectiveMargin,
    state.nestSpacingMM,
    state.nestAllowRotate,
    state.nestUseInnerHoles
  );

  state.nestedBoards = result.boards;
  state.unfitIslandsCount = result.unfitCount;
  state.clippedIslandsCount = result.clippedCount || 0;

  if (state.activeBoardIndex >= state.nestedBoards.length) {
    state.activeBoardIndex = Math.max(0, state.nestedBoards.length - 1);
  }

  recomputeCarrierNesting();

  if (state.nestingEnabled) {
    const slider = document.getElementById('currentSliceSlider');
    if (slider) {
      if (state.carrierEnabled) {
        slider.max = Math.max(0, state.nestedCarriers.length - 1);
        slider.value = state.activeCarrierIndex;
      } else {
        slider.max = Math.max(0, state.nestedBoards.length - 1);
        slider.value = state.activeBoardIndex;
      }
    }
  }

  const badge = document.getElementById('nestingSummaryBadge');
  if (badge) {
    const packedCount = state.nestedBoards.reduce((acc, b) => acc + b.placements.length, 0);
    if (state.nestedBoards.length === 0 && state.unfitIslandsCount > 0) {
      badge.innerHTML =
        '<span class="text-rose-400 font-bold block">⚠️ Ninguna pieza cabe (' + state.unfitIslandsCount + ' superan el tamaño del tablero)</span>' +
        '<button onclick="setNestClipOversized(true)" class="mt-1.5 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-bold transition">' +
          '✂️ Incluir recortando la parte que no cabe' +
        '</button>';
    } else if (state.nestedBoards.length === 0) {
      badge.textContent = '0 islas seleccionadas para empaquetar';
    } else {
      const avgEff = state.nestedBoards.reduce((acc, b) => acc + b.efficiency, 0) / state.nestedBoards.length;
      let html = '<strong>' + state.nestedBoards.length + ' Tablero(s)</strong> | ' +
        packedCount + ' Islas caben | Uso medio: ' + avgEff.toFixed(1) + '%';
      if (state.filterSmallIslands && state.filteredIslandsCount > 0) {
        html += '<br><span class="text-rose-300 text-[10px]">🧹 ' + state.filteredIslandsCount + ' isla(s) pequeña(s) descartada(s)</span>';
      }
      if (state.clippedIslandsCount > 0) {
        html += '<br><span class="text-amber-300 text-[10px]">✂️ ' + state.clippedIslandsCount + ' pieza(s) incluida(s) recortando el excedente</span>';
      }
      if (state.unfitIslandsCount > 0) {
        html +=
          '<br><span class="text-amber-300 text-[10px]">⚠️ ' + state.unfitIslandsCount + ' isla(s) exceden el tablero y no caben</span>' +
          '<button onclick="setNestClipOversized(true)" class="mt-1 block w-full py-0.5 px-2 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-semibold transition">' +
            '✂️ Recortar e incluir las ' + state.unfitIslandsCount + ' que no caben' +
          '</button>';
      }
      badge.innerHTML = html;
    }
  }
}

function update2DInspectorHeader() {
  const includeLbl = document.getElementById('inspectorIncludeSliceLabel');
  if (state.nestingEnabled && state.carrierEnabled) {
    if (includeLbl) includeLbl.classList.add('hidden');
    const totalC = state.nestedCarriers.length;
    const c = state.nestedCarriers[state.activeCarrierIndex];
    const f = getUnitFactor();
    const dec = state.unit === 'm' ? 3 : 1;

    document.getElementById('slice2DTitle').textContent =
      totalC > 0 ? ('Soporte Mayor #' + (state.activeCarrierIndex + 1) + ' / ' + totalC) : 'Sin tableros que quepan en el soporte';
    document.getElementById('slice2DCoord').textContent =
      c ? (c.boardPlacements.length + ' tablero(s) · ' + c.totalIslands + ' piezas') : '0 tableros';
    document.getElementById('slice2DStats').textContent =
      'Soporte: ' + (state.carrierWidthMM / f).toFixed(dec) + ' × ' + (state.carrierHeightMM / f).toFixed(dec) + ' ' + state.unit +
      ' | Sub-tableros: ' + (state.boardWidthMM / f).toFixed(dec) + ' × ' + (state.boardHeightMM / f).toFixed(dec) + ' ' + state.unit +
      (c ? (' | Uso soporte: ' + c.efficiency.toFixed(1) + '%') : '') +
      (state.unfitBoardsCount > 0 ? (' | ⚠️ ' + state.unfitBoardsCount + ' tablero(s) no caben') : '');
  } else if (state.nestingEnabled) {
    if (includeLbl) includeLbl.classList.add('hidden');
    const totalB = state.nestedBoards.length;
    const b = state.nestedBoards[state.activeBoardIndex];
    const f = getUnitFactor();
    const dec = state.unit === 'm' ? 3 : 1;

    document.getElementById('slice2DTitle').textContent =
      totalB > 0 ? ('Tablero #' + (state.activeBoardIndex + 1) + ' / ' + totalB) : 'Sin piezas que quepan';
    document.getElementById('slice2DCoord').textContent =
      b ? (b.placements.length + ' piezas en este tablero') : '0 piezas';
    document.getElementById('slice2DStats').textContent =
      'Tablero: ' + (state.boardWidthMM / f).toFixed(dec) + ' × ' + (state.boardHeightMM / f).toFixed(dec) + ' ' + state.unit +
      ' | Sep: ' + state.nestSpacingMM + ' mm' +
      (b ? (' | Uso tablero: ' + b.efficiency.toFixed(1) + '%') : '') +
      (state.clippedIslandsCount > 0 ? (' | ✂️ ' + state.clippedIslandsCount + ' recortada(s)') : '') +
      (state.unfitIslandsCount > 0 ? (' | ⚠️ ' + state.unfitIslandsCount + ' no caben') : '');
  } else {
    if (includeLbl) includeLbl.classList.remove('hidden');
    const slice = state.slices[state.activeSliceIndex];
    if (!slice) return;
    if (state.constructionMode === 'puzzle3d' && slice.puzzleCode) {
      const seriesLbl = slice.isPuzzleSolidCap
        ? ('Tapa Maciza de Grabado · Relleno Completo (Gemela de ' + (slice.twinCode || slice.puzzleCode) + ')')
        : (slice.puzzleSeries === 'A' ? 'Serie A ⊔ (Base con encajes)' : 'Serie B ⊓ (Cruce con encajes)');
      document.getElementById('slice2DTitle').textContent =
        (slice.isPuzzleSolidCap ? 'Tapa ' : 'Costilla ') + slice.puzzleCode + ' · ' + seriesLbl + ' (' + (state.activeSliceIndex + 1) + '/' + state.slices.length + ')';
      document.getElementById('slice2DCoord').textContent =
        (slice.sliceAxis || state.axis).toUpperCase() + ' = ' + slice.coord.toFixed(2) + ' mm';
    } else {
      document.getElementById('slice2DTitle').textContent = 'Lasca #' + (state.activeSliceIndex + 1) + ' / ' + state.slices.length;
      document.getElementById('slice2DCoord').textContent = state.axis.toUpperCase() + ' = ' + slice.coord.toFixed(2) + ' mm';
    }
    document.getElementById('currentSliceSelectedCheck').checked = slice.selected;

    const b = getSliceBounds2D(slice);
    const docB = getModelBounds2D(slice.sliceAxis);
    const f = getUnitFactor();
    const dec = state.unit === 'm' ? 3 : 1;
    const slotsStr = (state.constructionMode === 'puzzle3d' && slice.puzzleSlots)
      ? (' | Ranuras de encaje: ' + slice.puzzleSlots.length)
      : '';
    const splitStr = (state.splitModelEnabled && slice.splitGrid && slice.splitGrid.totalParts > 1)
      ? (' | 🧩 Conjuntos: ' + slice.splitGrid.cols + '×' + slice.splitGrid.rows + ' (' + (slice.splitGrid.partW / f).toFixed(dec) + '×' + (slice.splitGrid.partH / f).toFixed(dec) + ' ' + state.unit + ')')
      : '';
    document.getElementById('slice2DStats').textContent =
      'Corte: ' + (b.width / f).toFixed(dec) + ' × ' + (b.height / f).toFixed(dec) + ' ' + state.unit +
      ' | Doc SVG (Pieza): ' + (docB.width / f).toFixed(dec) + ' × ' + (docB.height / f).toFixed(dec) + ' ' + state.unit +
      ' | Contornos: ' + slice.loops.length + slotsStr + splitStr;
  }
}

function on2DSliderInput(val) {
  if (state.nestingEnabled && state.carrierEnabled) {
    state.activeCarrierIndex = Math.max(0, Math.min(state.nestedCarriers.length - 1, val));
    update2DInspectorHeader();
    highlightActiveCardInStrip();
    render2DSlice();
  } else if (state.nestingEnabled) {
    state.activeBoardIndex = Math.max(0, Math.min(state.nestedBoards.length - 1, val));
    update2DInspectorHeader();
    highlightActiveCardInStrip();
    render2DSlice();
  } else {
    selectActiveSlice(val);
  }
}

// Permite seleccionar un tablero específico desde la galería inferior
function selectActiveBoard(bIdx) {
  if (state.nestedBoards.length === 0) return;
  state.activeBoardIndex = Math.max(0, Math.min(state.nestedBoards.length - 1, bIdx));
  const slider = document.getElementById('currentSliceSlider');
  if (slider) slider.value = state.activeBoardIndex;
  update2DInspectorHeader();
  highlightActiveCardInStrip();
  render2DSlice();
}

// =========================================================================
// 6. MOTOR DE DISTRIBUCIÓN DE TABLEROS EN SOPORTE MAYOR (PLANCHA MADRE)
// =========================================================================

function syncCarrierInputsUI() {
  const f = getUnitFactor();
  const decimals = state.unit === 'm' ? 3 : (state.unit === 'cm' ? 1 : 0);
  const wInput = document.getElementById('carrierWidthInput');
  const hInput = document.getElementById('carrierHeightInput');
  if (wInput) wInput.value = Number((state.carrierWidthMM / f).toFixed(decimals));
  if (hInput) hInput.value = Number((state.carrierHeightMM / f).toFixed(decimals));

  const spInput = document.getElementById('carrierSpacingInput');
  const mgInput = document.getElementById('carrierMarginInput');
  if (spInput) spInput.value = state.carrierSpacingMM;
  if (mgInput) mgInput.value = state.carrierMarginMM;

  const rotChk = document.getElementById('carrierRotateCheck');
  if (rotChk) rotChk.checked = Boolean(state.carrierAllowRotate);
  const cutBChk = document.getElementById('carrierCutBoardBordersCheck') || document.getElementById('carrierCutBoardsCheck');
  if (cutBChk) cutBChk.checked = Boolean(state.carrierCutBoardBorders);
  const cutOChk = document.getElementById('carrierCutOuterBorderCheck') || document.getElementById('carrierCutOuterCheck');
  if (cutOChk) cutOChk.checked = Boolean(state.carrierCutOuterBorder);
  const lblChk = document.getElementById('carrierEngraveLabelsCheck');
  if (lblChk) lblChk.checked = Boolean(state.carrierEngraveBoardLabels);

  const modalSub = document.getElementById('modalCarrierInfoSub');
  if (modalSub) {
    modalSub.textContent = 'Distribuye los tableros de ' +
      state.boardWidthMM.toFixed(0) + '×' + state.boardHeightMM.toFixed(0) +
      ' mm en soportes mayores de ' +
      state.carrierWidthMM.toFixed(0) + '×' + state.carrierHeightMM.toFixed(0) + ' mm';
  }
}

function syncCarrierUIState() {
  const c1 = document.getElementById('carrierEnabledCheck');
  const c2 = document.getElementById('modalCarrierEnabledCheck');
  const box = document.getElementById('carrierControlsBox');
  const btnToggleCarrier = document.getElementById('btnToggleCarrierView');

  if (c1) c1.checked = Boolean(state.carrierEnabled);
  if (c2) c2.checked = Boolean(state.carrierEnabled);
  if (box) box.classList.toggle('opacity-45', !state.carrierEnabled);

  if (btnToggleCarrier) {
    if (state.carrierEnabled) {
      btnToggleCarrier.textContent = '📦 Soporte Mayor: ON';
      btnToggleCarrier.className = 'text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold transition';
    } else {
      btnToggleCarrier.textContent = '📦 Soporte Mayor: OFF';
      btnToggleCarrier.className = 'text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold transition';
    }
  }
}

function setCarrierPresetMM(wMM, hMM) {
  state.carrierWidthMM = wMM;
  state.carrierHeightMM = hMM;
  syncCarrierInputsUI();
  if (!state.carrierEnabled) {
    setCarrierEnabled(true);
  } else {
    recomputeCarrierNesting();
    renderSliceStripUI();
    update2DInspectorHeader();
    render2DSlice();
  }
}

function setCarrierEnabled(val) {
  state.carrierEnabled = Boolean(val);
  syncCarrierUIState();
  syncCarrierInputsUI();

  if (state.carrierEnabled && !state.nestingEnabled) {
    // Activar automáticamente la distribución en tableros (Apartado 5) para poder anidar esos tableros en el soporte mayor
    setNestingEnabled(true);
    return;
  }

  reset2DView(false);

  if (state.carrierEnabled) {
    recomputeBoardNesting();
    state.activeCarrierIndex = 0;
    const slider = document.getElementById('currentSliceSlider');
    if (slider) {
      slider.max = Math.max(0, state.nestedCarriers.length - 1);
      slider.value = 0;
    }
  } else {
    const slider = document.getElementById('currentSliceSlider');
    if (slider) {
      slider.max = state.nestingEnabled
        ? Math.max(0, state.nestedBoards.length - 1)
        : Math.max(0, state.slices.length - 1);
      slider.value = state.nestingEnabled ? state.activeBoardIndex : state.activeSliceIndex;
    }
    const badge = document.getElementById('carrierSummaryBadge');
    if (badge) badge.textContent = 'Desactivado (vista y exportación por tablero individual)';
  }

  renderSliceStripUI();
  update2DInspectorHeader();
  render2DSlice();
}

function onCarrierSettingsChange() {
  const f = getUnitFactor();
  const wEl = document.getElementById('carrierWidthInput');
  const hEl = document.getElementById('carrierHeightInput');
  const spEl = document.getElementById('carrierSpacingInput');
  const mgEl = document.getElementById('carrierMarginInput');
  const rotEl = document.getElementById('carrierRotateCheck');
  const cutBEl = document.getElementById('carrierCutBoardBordersCheck') || document.getElementById('carrierCutBoardsCheck');
  const cutOEl = document.getElementById('carrierCutOuterBorderCheck') || document.getElementById('carrierCutOuterCheck');
  const lblEl = document.getElementById('carrierEngraveLabelsCheck');

  if (wEl) {
    const wVal = parseFloat(wEl.value);
    if (Number.isFinite(wVal) && wVal > 0) state.carrierWidthMM = Math.max(40, wVal * f);
  }
  if (hEl) {
    const hVal = parseFloat(hEl.value);
    if (Number.isFinite(hVal) && hVal > 0) state.carrierHeightMM = Math.max(40, hVal * f);
  }
  if (spEl) {
    const spVal = parseFloat(spEl.value);
    if (Number.isFinite(spVal) && spVal >= 0) state.carrierSpacingMM = spVal;
  }
  if (mgEl) {
    const mgVal = parseFloat(mgEl.value);
    if (Number.isFinite(mgVal) && mgVal >= 0) state.carrierMarginMM = mgVal;
  }
  if (rotEl) state.carrierAllowRotate = Boolean(rotEl.checked);
  if (cutBEl) state.carrierCutBoardBorders = Boolean(cutBEl.checked);
  if (cutOEl) state.carrierCutOuterBorder = Boolean(cutOEl.checked);
  if (lblEl) state.carrierEngraveBoardLabels = Boolean(lblEl.checked);

  syncCarrierInputsUI();
  if (state.carrierEnabled) {
    recomputeCarrierNesting();
    renderSliceStripUI();
    update2DInspectorHeader();
    render2DSlice();
  }
}

/**
 * Empaqueta la lista de tableros (`boards`) dentro de uno o varios Soportes Mayores (`carrierW` × `carrierH` mm)
 * empleando el algoritmo MaxRects 2D y transformando todas las islas, guías y marcos al sistema de coordenadas del soporte.
 */
function packBoardsIntoCarriers(boards, carrierW, carrierH, margin, spacing, allowRot) {
  const usableW = Math.max(1, carrierW - margin * 2);
  const usableH = Math.max(1, carrierH - margin * 2);
  const carriers = [];
  let unfitBoardsCount = 0;

  const createNewCarrier = () => {
    const c = {
      carrierIndex: carriers.length,
      width: carrierW,
      height: carrierH,
      margin: margin,
      spacing: spacing,
      freeRects: [{
        x: margin,
        y: margin,
        w: usableW + spacing,
        h: usableH + spacing
      }],
      boardPlacements: [],
      totalIslands: 0,
      usedBoardsArea: 0,
      efficiency: 0
    };
    carriers.push(c);
    return c;
  };

  const splitCarrierFreeRects = (freeRects, usedRect) => {
    const nextFree = [];
    for (let i = 0; i < freeRects.length; i++) {
      const fr = freeRects[i];
      if (
        usedRect.x >= fr.x + fr.w ||
        usedRect.x + usedRect.w <= fr.x ||
        usedRect.y >= fr.y + fr.h ||
        usedRect.y + usedRect.h <= fr.y
      ) {
        nextFree.push(fr);
        continue;
      }
      if (usedRect.x > fr.x) {
        nextFree.push({ x: fr.x, y: fr.y, w: usedRect.x - fr.x, h: fr.h });
      }
      if (usedRect.x + usedRect.w < fr.x + fr.w) {
        nextFree.push({
          x: usedRect.x + usedRect.w,
          y: fr.y,
          w: (fr.x + fr.w) - (usedRect.x + usedRect.w),
          h: fr.h
        });
      }
      if (usedRect.y > fr.y) {
        nextFree.push({ x: fr.x, y: fr.y, w: fr.w, h: usedRect.y - fr.y });
      }
      if (usedRect.y + usedRect.h < fr.y + fr.h) {
        nextFree.push({
          x: fr.x,
          y: usedRect.y + usedRect.h,
          w: fr.w,
          h: (fr.y + fr.h) - (usedRect.y + usedRect.h)
        });
      }
    }

    const pruned = [];
    for (let i = 0; i < nextFree.length; i++) {
      const a = nextFree[i];
      if (a.w <= spacing + 0.5 || a.h <= spacing + 0.5) continue;
      let contained = false;
      for (let j = 0; j < nextFree.length; j++) {
        if (i === j) continue;
        const b = nextFree[j];
        if (
          a.x >= b.x - 1e-4 &&
          a.y >= b.y - 1e-4 &&
          a.x + a.w <= b.x + b.w + 1e-4 &&
          a.y + a.h <= b.y + b.h + 1e-4
        ) {
          const areaA = a.w * a.h;
          const areaB = b.w * b.h;
          if (areaA < areaB - 1e-3 || (Math.abs(areaA - areaB) <= 1e-3 && i > j)) {
            contained = true;
            break;
          }
        }
      }
      if (!contained) pruned.push(a);
    }
    return pruned;
  };

  (boards || []).forEach((board) => {
    const bw = board.width;
    const bh = board.height;
    const fitsNormal = (bw <= usableW + 1e-4 && bh <= usableH + 1e-4);
    const fitsRot = allowRot && (bh <= usableW + 1e-4 && bw <= usableH + 1e-4);

    if (!fitsNormal && !fitsRot) {
      unfitBoardsCount++;
      return;
    }

    const reqW0 = bw + spacing;
    const reqH0 = bh + spacing;

    let bestCarrier = null;
    let bestX = 0, bestY = 0;
    let bestRotated = false;
    let bestShortSide = Infinity;
    let bestLongSide = Infinity;

    const tryFindOnCarrier = (carrier) => {
      for (let i = 0; i < carrier.freeRects.length; i++) {
        const fr = carrier.freeRects[i];
        if (
          fitsNormal &&
          fr.w >= reqW0 - 1e-4 &&
          fr.h >= reqH0 - 1e-4 &&
          fr.x + bw <= carrierW - margin + 1e-3 &&
          fr.y + bh <= carrierH - margin + 1e-3
        ) {
          const remW = fr.w - reqW0;
          const remH = fr.h - reqH0;
          const shortS = Math.min(remW, remH);
          const longS = Math.max(remW, remH);
          if (shortS < bestShortSide || (shortS === bestShortSide && longS < bestLongSide)) {
            bestCarrier = carrier;
            bestX = fr.x;
            bestY = fr.y;
            bestRotated = false;
            bestShortSide = shortS;
            bestLongSide = longS;
          }
        }
        if (
          fitsRot &&
          fr.w >= reqH0 - 1e-4 &&
          fr.h >= reqW0 - 1e-4 &&
          fr.x + bh <= carrierW - margin + 1e-3 &&
          fr.y + bw <= carrierH - margin + 1e-3
        ) {
          const remW = fr.w - reqH0;
          const remH = fr.h - reqW0;
          const shortS = Math.min(remW, remH);
          const longS = Math.max(remW, remH);
          if (shortS < bestShortSide || (shortS === bestShortSide && longS < bestLongSide)) {
            bestCarrier = carrier;
            bestX = fr.x;
            bestY = fr.y;
            bestRotated = true;
            bestShortSide = shortS;
            bestLongSide = longS;
          }
        }
      }
    };

    for (let cIdx = 0; cIdx < carriers.length; cIdx++) {
      tryFindOnCarrier(carriers[cIdx]);
      if (bestCarrier) break;
    }

    if (!bestCarrier) {
      const nc = createNewCarrier();
      tryFindOnCarrier(nc);
    }

    if (!bestCarrier) {
      unfitBoardsCount++;
      return;
    }

    const placedW = bestRotated ? bh : bw;
    const placedH = bestRotated ? bw : bh;
    const usedRect = { x: bestX, y: bestY, w: placedW + spacing, h: placedH + spacing };
    bestCarrier.freeRects = splitCarrierFreeRects(bestCarrier.freeRects, usedRect);
    bestCarrier.usedBoardsArea += bw * bh;
    bestCarrier.totalIslands += board.placements.length;

    const transformBoardPt = (pt) => {
      if (!bestRotated) {
        return { x: bestX + pt.x, y: bestY + pt.y };
      }
      return { x: bestX + (bh - pt.y), y: bestY + pt.x };
    };

    const transformPtsArray = (pts) => {
      if (!pts) return null;
      const out = pts.map(transformBoardPt);
      if (pts.isFrame) out.isFrame = true;
      return out;
    };

    // Geometría de corte/grabado del borde de este sub-tablero dentro del soporte mayor
    let boardFrameGeom = null;
    if (state.slicerFrameEnabled && typeof get2DBoardFrameGeometry === 'function') {
      const rawFg = get2DBoardFrameGeometry(0, 0, bw, bh, board.placements, true);
      if (rawFg) {
        const tfOuter = transformPtsArray(rawFg.outerCutPts);
        if (tfOuter) tfOuter.isFrame = true;
        const tfInner = transformPtsArray(rawFg.innerCutPts);
        if (tfInner) tfInner.isFrame = true;
        const tfKh = transformPtsArray(rawFg.keyholePts);
        if (tfKh) tfKh.isFrame = true;
        const tfEngrave = (rawFg.engraveLoops || []).map((el) => ({
          points: transformPtsArray(el.points),
          isHole: Boolean(el.isHole)
        }));
        boardFrameGeom = {
          outerCutPts: tfOuter,
          innerCutPts: tfInner,
          keyholePts: tfKh,
          engraveLoops: tfEngrave
        };
      }
    } else if (state.carrierCutBoardBorders) {
      const rectPts = [
        { x: bestX, y: bestY },
        { x: bestX + placedW, y: bestY },
        { x: bestX + placedW, y: bestY + placedH },
        { x: bestX, y: bestY + placedH }
      ];
      rectPts.isFrame = true;
      boardFrameGeom = {
        outerCutPts: rectPts,
        innerCutPts: null,
        keyholePts: null,
        engraveLoops: []
      };
    }

    const transformedPlacements = board.placements.map((pl) => {
      const tfOuter = transformPtsArray(pl.outerPoints);
      const tfHoles = (pl.holes || []).map((h) => ({
        points: transformPtsArray(h.points),
        absArea: h.absArea,
        isFrame: Boolean(h.isFrame)
      }));
      const tfRods = (pl.rods || []).map(transformBoardPt);
      const tfEngraves = (pl.engraveLoops || []).map((el) => ({
        points: transformPtsArray(el.points),
        isHole: Boolean(el.isHole)
      }));
      const tfUpper = (pl.upperPolys || []).map((poly) => poly.map(transformBoardPt));
      const tfLower = (pl.lowerPolys || []).map((poly) => poly.map(transformBoardPt));

      let tfTextLayout = null;
      if (pl.textLayout) {
        const tCenter = transformBoardPt({ x: pl.textLayout.x, y: pl.textLayout.y });
        tfTextLayout = {
          x: tCenter.x,
          y: tCenter.y,
          fontSizeMM: pl.textLayout.fontSizeMM,
          lines: pl.textLayout.lines,
          maxBoxW: bestRotated ? pl.textLayout.maxBoxH : pl.textLayout.maxBoxW,
          maxBoxH: bestRotated ? pl.textLayout.maxBoxW : pl.textLayout.maxBoxH
        };
      }

      return {
        island: pl.island,
        isFrame: Boolean(pl.isFrame),
        outerPoints: tfOuter,
        holes: tfHoles,
        rods: tfRods,
        engraveLoops: tfEngraves,
        upperPolys: tfUpper,
        lowerPolys: tfLower,
        textLayout: tfTextLayout
      };
    });

    bestCarrier.boardPlacements.push({
      boardIndex: board.boardIndex,
      board: board,
      x: bestX,
      y: bestY,
      w: placedW,
      h: placedH,
      rotated: bestRotated,
      boardFrameGeom: boardFrameGeom,
      transformedPlacements: transformedPlacements
    });
  });

  carriers.forEach((c) => {
    c.efficiency = Math.min(100, (c.usedBoardsArea / Math.max(1, carrierW * carrierH)) * 100);
  });

  return { carriers, unfitBoardsCount };
}

function recomputeCarrierNesting() {
  const res = packBoardsIntoCarriers(
    state.nestedBoards || [],
    state.carrierWidthMM,
    state.carrierHeightMM,
    state.carrierMarginMM,
    state.carrierSpacingMM,
    state.carrierAllowRotate
  );

  state.nestedCarriers = res.carriers;
  state.unfitBoardsCount = res.unfitBoardsCount;

  if (state.activeCarrierIndex >= state.nestedCarriers.length) {
    state.activeCarrierIndex = Math.max(0, state.nestedCarriers.length - 1);
  }

  const badge = document.getElementById('carrierSummaryBadge');
  if (badge) {
    if (!state.carrierEnabled) {
      badge.textContent = 'Desactivado (vista y exportación por tablero individual)';
    } else if (state.nestedCarriers.length === 0 && state.unfitBoardsCount > 0) {
      badge.innerHTML =
        '<span class="text-rose-400 font-bold block">⚠️ El tamaño del tablero (' +
        state.boardWidthMM.toFixed(0) + '×' + state.boardHeightMM.toFixed(0) +
        ' mm) supera el área útil del Soporte Mayor (' +
        state.carrierWidthMM.toFixed(0) + '×' + state.carrierHeightMM.toFixed(0) + ' mm)</span>';
    } else if (state.nestedCarriers.length === 0) {
      badge.textContent = '0 tableros generados para colocar en el soporte mayor';
    } else {
      const totalPackedBoards = state.nestedCarriers.reduce((acc, c) => acc + c.boardPlacements.length, 0);
      const avgEff = state.nestedCarriers.reduce((acc, c) => acc + c.efficiency, 0) / state.nestedCarriers.length;
      let html =
        '🏗️ <strong>' + state.nestedCarriers.length + ' Soporte(s) Mayor(es)</strong> | ' +
        totalPackedBoards + ' Tablero(s) alojados | Uso: ' + avgEff.toFixed(1) + '%';
      if (state.unfitBoardsCount > 0) {
        html += '<br><span class="text-amber-300 text-[10px]">⚠️ ' + state.unfitBoardsCount + ' tablero(s) no caben en el soporte mayor</span>';
      }
      badge.innerHTML = html;
    }
  }
}

function selectActiveCarrier(cIdx) {
  if (state.nestedCarriers.length === 0) return;
  state.activeCarrierIndex = Math.max(0, Math.min(state.nestedCarriers.length - 1, cIdx));
  const slider = document.getElementById('currentSliceSlider');
  if (slider) slider.value = state.activeCarrierIndex;
  update2DInspectorHeader();
  highlightActiveCardInStrip();
  render2DSlice();
}

if (typeof window !== 'undefined') {
  window.syncCarrierInputsUI = syncCarrierInputsUI;
  window.syncCarrierUIState = syncCarrierUIState;
  window.setCarrierPresetMM = setCarrierPresetMM;
  window.setCarrierEnabled = setCarrierEnabled;
  window.onCarrierSettingsChange = onCarrierSettingsChange;
  window.packBoardsIntoCarriers = packBoardsIntoCarriers;
  window.recomputeCarrierNesting = recomputeCarrierNesting;
  window.selectActiveCarrier = selectActiveCarrier;
}
