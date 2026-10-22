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
// Devuelve el código identificador visible de una lasca o costilla (ej. "#1" o "X1", "Y2" en modo Puzzle 3D)
function getSliceDisplayCode(slice, islandIdx, totalIslands) {
  if (!slice) return '#?';
  const baseCode = slice.puzzleCode ? slice.puzzleCode : ('#' + (slice.index + 1));
  if (typeof totalIslands === 'number' && totalIslands > 1 && typeof islandIdx === 'number') {
    return baseCode + '.' + (islandIdx + 1);
  }
  return baseCode;
}

// Devuelve los ejes (axisA, axisB, axisCommon) para la modalidad Puzzle 3D
function getPuzzleAxesConfig() {
  if (state.puzzleAxes === 'xz') {
    return { axisA: 'x', axisB: 'z', axisCommon: 'y' };
  }
  if (state.puzzleAxes === 'yz') {
    return { axisA: 'y', axisB: 'z', axisCommon: 'x' };
  }
  return { axisA: 'x', axisB: 'y', axisCommon: 'z' };
}

// Determina qué eje 2D ('x' o 'y') del plano de una lasca corresponde al eje de cruce (u) y cuál al eje de deslizamiento de la ranura (v)
function getPuzzleSlice2DAxes(sliceAxis, otherAxis) {
  // En sliceTrianglesAtPlane:
  // sliceAxis === 'x' -> 2D x = Y, 2D y = Z
  // sliceAxis === 'y' -> 2D x = X, 2D y = Z
  // sliceAxis === 'z' -> 2D x = X, 2D y = Y
  if (sliceAxis === 'x') {
    return otherAxis === 'y'
      ? { uAxis: 'x', vAxis: 'y' }
      : { uAxis: 'y', vAxis: 'x' };
  }
  if (sliceAxis === 'y') {
    return otherAxis === 'x'
      ? { uAxis: 'x', vAxis: 'y' }
      : { uAxis: 'y', vAxis: 'x' };
  }
  return otherAxis === 'x'
    ? { uAxis: 'x', vAxis: 'y' }
    : { uAxis: 'y', vAxis: 'x' };
}

function setConstructionMode(mode) {
  state.constructionMode = mode === 'puzzle3d' ? 'puzzle3d' : 'stacked';
  syncConstructionModeUI();
  rebuildGhostAndSlices();
}

function setPuzzleAxes(axesPair) {
  if (axesPair === 'xy' || axesPair === 'xz' || axesPair === 'yz') {
    state.puzzleAxes = axesPair;
  }
  syncConstructionModeUI();
  if (state.constructionMode === 'puzzle3d') {
    rebuildGhostAndSlices();
  }
}

function onPuzzleCountChange(which, val) {
  const n = Math.max(2, Math.min(60, parseInt(val, 10) || 7));
  if (which === 'a') {
    state.puzzleCountA = n;
    const lbl = document.getElementById('puzzleCountALabel');
    if (lbl) lbl.textContent = n;
  } else {
    state.puzzleCountB = n;
    const lbl = document.getElementById('puzzleCountBLabel');
    if (lbl) lbl.textContent = n;
  }
  if (state.constructionMode === 'puzzle3d') {
    rebuildGhostAndSlices();
  }
}

function onPuzzleSlotParamsChange() {
  const thEl = document.getElementById('puzzleThicknessInput');
  const clEl = document.getElementById('puzzleClearanceInput');
  if (thEl) {
    const th = parseFloat(thEl.value);
    if (Number.isFinite(th) && th >= 0.3) state.puzzleMaterialThicknessMM = th;
  }
  if (clEl) {
    const cl = parseFloat(clEl.value);
    if (Number.isFinite(cl) && cl >= -5 && cl <= 10) state.puzzleSlotClearanceMM = cl;
  }
  syncConstructionModeUI();
  if (state.constructionMode === 'puzzle3d') {
    rebuildGhostAndSlices();
  }
}

function setPuzzleThicknessPreset(thMM, clearanceMM) {
  state.puzzleMaterialThicknessMM = thMM;
  state.puzzleSlotClearanceMM = clearanceMM;
  syncConstructionModeUI();
  if (state.constructionMode === 'puzzle3d') {
    rebuildGhostAndSlices();
  }
}

function syncConstructionModeUI() {
  const isPuzzle = state.constructionMode === 'puzzle3d';
  const btnStacked = document.getElementById('constModeBtn_stacked');
  const btnPuzzle = document.getElementById('constModeBtn_puzzle3d');
  const boxStacked = document.getElementById('stackedControlsBox');
  const boxPuzzle = document.getElementById('puzzle3dControlsBox');
  const badge = document.getElementById('constructionModeBadge');

  if (btnStacked) {
    btnStacked.className = !isPuzzle
      ? 'py-1.5 px-2 rounded-lg border border-sky-500 bg-sky-500/20 text-[11px] font-bold text-sky-300 transition flex items-center justify-center gap-1'
      : 'py-1.5 px-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 transition flex items-center justify-center gap-1';
  }
  if (btnPuzzle) {
    btnPuzzle.className = isPuzzle
      ? 'py-1.5 px-2 rounded-lg border border-amber-500 bg-amber-500/20 text-[11px] font-bold text-amber-300 transition flex items-center justify-center gap-1'
      : 'py-1.5 px-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[11px] font-bold text-amber-300/80 transition flex items-center justify-center gap-1';
  }
  if (boxStacked) boxStacked.classList.toggle('hidden', isPuzzle);
  if (boxPuzzle) boxPuzzle.classList.toggle('hidden', !isPuzzle);
  if (badge) {
    badge.textContent = isPuzzle ? 'Puzzle 3D (2 Ejes)' : 'Apilado 1 Eje';
    badge.className = isPuzzle
      ? 'text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
      : 'text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold';
  }

  // Ocultar opciones exclusivas de apilado (guías #N+1/#N-1 y varillas) cuando está en modo Puzzle 3D
  const stackedOnlyBox = document.getElementById('stackedOnlyAssemblyBox');
  if (stackedOnlyBox) stackedOnlyBox.classList.toggle('hidden', isPuzzle);
  const modalStackedGuides = document.getElementById('modalStackedGuidesBox');
  if (modalStackedGuides) modalStackedGuides.classList.toggle('hidden', isPuzzle);
  const nestGuideRow = document.getElementById('nestEngraveGuideTypeRow');
  if (nestGuideRow) nestGuideRow.classList.toggle('hidden', isPuzzle);
  const legNext = document.getElementById('legendNextGuide');
  const legPrev = document.getElementById('legendPrevGuide');
  const legSlots = document.getElementById('legendPuzzleSlots');
  if (legNext) legNext.classList.toggle('hidden', isPuzzle);
  if (legPrev) legPrev.classList.toggle('hidden', isPuzzle);
  if (legSlots) {
    legSlots.classList.toggle('hidden', !isPuzzle);
    legSlots.classList.toggle('flex', isPuzzle);
  }

  ['xy', 'xz', 'yz'].forEach((pair) => {
    const b = document.getElementById('puzzleAxesBtn_' + pair);
    if (!b) return;
    b.className = state.puzzleAxes === pair
      ? 'py-1 px-1.5 rounded border border-amber-500 bg-amber-500/20 text-[10px] font-bold text-amber-300 transition'
      : 'py-1 px-1.5 rounded border border-slate-700 bg-slate-950 text-[10px] font-semibold text-slate-300 hover:bg-slate-800 transition';
  });

  const cfg = getPuzzleAxesConfig();
  const lblA = document.getElementById('puzzleAxisALabel');
  const lblB = document.getElementById('puzzleAxisBLabel');
  if (lblA) lblA.textContent = 'Costillas Serie A (Eje ' + cfg.axisA.toUpperCase() + ' · Ranura ⊔):';
  if (lblB) lblB.textContent = 'Costillas Serie B (Eje ' + cfg.axisB.toUpperCase() + ' · Ranura ⊓):';

  const sA = document.getElementById('puzzleCountASlider');
  const sB = document.getElementById('puzzleCountBSlider');
  const cA = document.getElementById('puzzleCountALabel');
  const cB = document.getElementById('puzzleCountBLabel');
  if (sA) sA.value = state.puzzleCountA;
  if (sB) sB.value = state.puzzleCountB;
  if (cA) cA.textContent = state.puzzleCountA;
  if (cB) cB.textContent = state.puzzleCountB;

  const thEl = document.getElementById('puzzleThicknessInput');
  const clEl = document.getElementById('puzzleClearanceInput');
  if (thEl) thEl.value = state.puzzleMaterialThicknessMM;
  if (clEl) clEl.value = state.puzzleSlotClearanceMM;

  const slotW = Math.max(0.4, state.puzzleMaterialThicknessMM + state.puzzleSlotClearanceMM);
  const sumBadge = document.getElementById('puzzleSummaryBadge');
  if (sumBadge) {
    sumBadge.innerHTML =
      'Ancho ranura: <strong>' + slotW.toFixed(2) + ' mm</strong> · ' +
      (state.puzzleCountA + state.puzzleCountB) + ' costillas (' +
      state.puzzleCountA + ' ' + cfg.axisA.toUpperCase() + ' + ' +
      state.puzzleCountB + ' ' + cfg.axisB.toUpperCase() + ')' +
      (state.puzzleTotalSlotsCount > 0 ? (' · <strong>' + state.puzzleTotalSlotsCount + ' encajes</strong>') : '');
  }
}

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

// =========================================================================
// MOTOR GEOMÉTRICO DE RANURAS DE ENCAJE (PUZZLE 3D SIN PEGAMENTO)
// =========================================================================

// Devuelve los intervalos 1D [vMin, vMax] donde una línea u = uVal atraviesa material sólido en loops
function getSolidIntervalsAlongLine(loops, uAxis, vAxis, uVal) {
  const crossings = [];
  (loops || []).forEach((loop) => {
    const pts = loop.points;
    if (!pts || pts.length < 3) return;
    for (let i = 0, n = pts.length; i < n; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const u1 = p1[uAxis];
      const u2 = p2[uAxis];
      if ((u1 <= uVal && u2 > uVal) || (u2 <= uVal && u1 > uVal)) {
        const t = (uVal - u1) / (u2 - u1);
        const v = p1[vAxis] + t * (p2[vAxis] - p1[vAxis]);
        crossings.push(v);
      }
    }
  });
  crossings.sort((a, b) => a - b);
  const intervals = [];
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    if (crossings[i + 1] - crossings[i] > 1e-3) {
      intervals.push([crossings[i], crossings[i + 1]]);
    }
  }
  return intervals;
}

// Interseca dos listas de intervalos 1D ordenados
function intersect1DIntervalLists(listA, listB) {
  const out = [];
  for (let i = 0; i < listA.length; i++) {
    const a0 = listA[i][0], a1 = listA[i][1];
    for (let j = 0; j < listB.length; j++) {
      const b0 = listB[j][0], b1 = listB[j][1];
      const lo = Math.max(a0, b0);
      const hi = Math.min(a1, b1);
      if (hi - lo > 1e-3) {
        out.push([lo, hi]);
      }
    }
  }
  return out;
}

// Comprueba si un punto 2D está dentro del material sólido definido por un conjunto de loops (regla par-impar)
function isPointInLoopsSolid(pt, loops) {
  let count = 0;
  for (let i = 0; i < loops.length; i++) {
    const pts = loops[i].points;
    if (pts && pts.length >= 3 && isPointInPolygon(pt, pts)) {
      count++;
    }
  }
  return (count % 2) === 1;
}

// Encadena segmentos dirigidos ({ from, to }) con coincidencia exacta en los vértices de corte booleano
function chainDirectedBooleanSegments(segments) {
  const used = new Uint8Array(segments.length);
  const tolSq = 1e-6; // 0.001 mm
  const loops = [];

  const distSq = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  };

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const poly = [segments[i].from, segments[i].to];

    let extended = true;
    while (extended) {
      extended = false;
      const tail = poly[poly.length - 1];
      if (poly.length >= 4 && distSq(poly[0], tail) <= tolSq) {
        break;
      }

      let bestIdx = -1;
      let bestD = tolSq * 4;

      for (let j = 0; j < segments.length; j++) {
        if (used[j]) continue;
        // Priorizar coincidencia exacta de referencia de vértice compartido
        if (segments[j].from === tail) {
          bestIdx = j;
          bestD = 0;
          break;
        }
        const d0 = distSq(tail, segments[j].from);
        if (d0 < bestD) {
          bestD = d0;
          bestIdx = j;
        }
      }

      if (bestIdx !== -1) {
        used[bestIdx] = 1;
        poly.push(segments[bestIdx].to);
        extended = true;
      }
    }

    // Conservar únicamente lazos cerrados válidos para evitar cuerdas diagonales espurias en la triangulación
    if (poly.length >= 4 && distSq(poly[0], poly[poly.length - 1]) <= tolSq * 9) {
      poly.pop();
      if (poly.length >= 3) {
        loops.push(poly);
      }
    }
  }
  return loops;
}

// Consolida puntos de corte muy próximos en una arista reutilizando el mismo objeto vértice
function consolidateEdgeSplits(splits) {
  splits.sort((x, y) => x.t - y.t);
  const clean = [splits[0]];
  for (let k = 1; k < splits.length; k++) {
    const prev = clean[clean.length - 1];
    if (splits[k].t - prev.t < 1e-7) {
      splits[k].pt = prev.pt;
    } else {
      clean.push(splits[k]);
    }
  }
  return clean;
}

// Resta booleana 2D exacta de un rectángulo alineado a los ejes [minX, maxX] x [minY, maxY] sobre los contornos de una lasca
function subtractSingleRectFromLoops(loops, rect) {
  if (!loops || loops.length === 0) return [];
  const rx0 = rect.minX, rx1 = rect.maxX, ry0 = rect.minY, ry1 = rect.maxY;
  if (!(rx1 > rx0 + 1e-5 && ry1 > ry0 + 1e-5)) return loops;
  const eps = 1e-5;

  // Asegurar que cada lazo de entrada tenga orientación canónica (CCW exterior, CW hueco)
  const nudgedLoops = loops.map((l) => {
    const pts = l.points.map((p) => {
      const nudgeVal = (v, lineVal) => (Math.abs(v - lineVal) < eps ? (v >= lineVal ? lineVal + eps : lineVal - eps) : v);
      return {
        x: nudgeVal(nudgeVal(p.x, rx0), rx1),
        y: nudgeVal(nudgeVal(p.y, ry0), ry1)
      };
    });
    const sArea = computeSignedArea(pts);
    if ((!l.isHole && sArea < 0) || (l.isHole && sArea > 0)) {
      pts.reverse();
    }
    return {
      points: pts,
      isHole: Boolean(l.isHole),
      absArea: Math.abs(sArea)
    };
  });

  // Recolectar aristas dirigidas del polígono (el material sólido queda a la izquierda de cada arista)
  const polyEdges = [];
  nudgedLoops.forEach((l) => {
    const pts = l.points;
    for (let i = 0, n = pts.length; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      if ((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) > 1e-10) {
        polyEdges.push({ a, b, splits: [{ t: 0, pt: a }, { t: 1, pt: b }] });
      }
    }
  });

  // Las 4 aristas del rectángulo de ranura recorridas en sentido HORARIO (CW)
  // para que el interior del sólido restante quede a la izquierda de cada arista de corte
  const c00 = { x: rx0, y: ry0 };
  const c01 = { x: rx0, y: ry1 };
  const c11 = { x: rx1, y: ry1 };
  const c10 = { x: rx1, y: ry0 };
  const rectEdges = [
    { a: c00, b: c01, splits: [{ t: 0, pt: c00 }, { t: 1, pt: c01 }] },
    { a: c01, b: c11, splits: [{ t: 0, pt: c01 }, { t: 1, pt: c11 }] },
    { a: c11, b: c10, splits: [{ t: 0, pt: c11 }, { t: 1, pt: c10 }] },
    { a: c10, b: c00, splits: [{ t: 0, pt: c10 }, { t: 1, pt: c00 }] }
  ];

  // Intersecar cada arista del polígono con las 4 aristas del rectángulo compartiendo el objeto vértice exacto
  for (let i = 0; i < polyEdges.length; i++) {
    const pe = polyEdges[i];
    const pMinX = Math.min(pe.a.x, pe.b.x), pMaxX = Math.max(pe.a.x, pe.b.x);
    const pMinY = Math.min(pe.a.y, pe.b.y), pMaxY = Math.max(pe.a.y, pe.b.y);
    if (pMaxX < rx0 || pMinX > rx1 || pMaxY < ry0 || pMinY > ry1) continue;

    const rX = pe.b.x - pe.a.x;
    const rY = pe.b.y - pe.a.y;

    for (let j = 0; j < 4; j++) {
      const re = rectEdges[j];
      const sX = re.b.x - re.a.x;
      const sY = re.b.y - re.a.y;
      const denom = rX * sY - rY * sX;
      if (Math.abs(denom) < 1e-11) continue;

      const qpX = re.a.x - pe.a.x;
      const qpY = re.a.y - pe.a.y;
      const tP = (qpX * sY - qpY * sX) / denom;
      const tR = (qpX * rY - qpY * rX) / denom;

      if (tP >= 0 && tP <= 1 && tR >= 0 && tR <= 1) {
        const sharedPt = {
          x: pe.a.x + tP * rX,
          y: pe.a.y + tP * rY
        };
        pe.splits.push({ t: tP, pt: sharedPt });
        re.splits.push({ t: tR, pt: sharedPt });
      }
    }
  }

  const outSegments = [];
  const isStrictlyInsideRect = (pt) => (
    pt.x > rx0 + 1e-7 && pt.x < rx1 - 1e-7 &&
    pt.y > ry0 + 1e-7 && pt.y < ry1 - 1e-7
  );

  // 1. Conservar los subsegmentos dirigidos del polígono original que quedan FUERA del rectángulo de ranura
  for (let i = 0; i < polyEdges.length; i++) {
    const splits = consolidateEdgeSplits(polyEdges[i].splits);
    for (let k = 0; k < splits.length - 1; k++) {
      const p0 = splits[k].pt;
      const p1 = splits[k + 1].pt;
      if (p0 === p1) continue;
      const mid = { x: (p0.x + p1.x) * 0.5, y: (p0.y + p1.y) * 0.5 };
      if (!isStrictlyInsideRect(mid)) {
        outSegments.push({ from: p0, to: p1 });
      }
    }
  }

  // 2. Conservar los subsegmentos dirigidos del borde de la ranura que caen DENTRO del material sólido de la lasca
  for (let j = 0; j < 4; j++) {
    const splits = consolidateEdgeSplits(rectEdges[j].splits);
    for (let k = 0; k < splits.length - 1; k++) {
      const p0 = splits[k].pt;
      const p1 = splits[k + 1].pt;
      if (p0 === p1) continue;
      const mid = { x: (p0.x + p1.x) * 0.5, y: (p0.y + p1.y) * 0.5 };
      if (isPointInLoopsSolid(mid, nudgedLoops)) {
        outSegments.push({ from: p0, to: p1 });
      }
    }
  }

  const rawChained = chainDirectedBooleanSegments(outSegments);
  return classifyLoopsOuterAndHoles(rawChained);
}

// Recorta un conjunto de contornos al rango interior [uMin, uMax] a lo largo del eje uAxis ('x' o 'y')
function clipLoopsToAxisRange(loops, uAxis, uMin, uMax) {
  if (!loops || loops.length === 0 || !(uMax > uMin)) return loops;
  const INF = 1e5;
  let clipped = loops;
  if (uAxis === 'x') {
    clipped = subtractSingleRectFromLoops(clipped, { minX: -INF, maxX: uMin, minY: -INF, maxY: INF });
    clipped = subtractSingleRectFromLoops(clipped, { minX: uMax, maxX: INF, minY: -INF, maxY: INF });
  } else {
    clipped = subtractSingleRectFromLoops(clipped, { minX: -INF, maxX: INF, minY: -INF, maxY: uMin });
    clipped = subtractSingleRectFromLoops(clipped, { minX: -INF, maxX: INF, minY: uMax, maxY: INF });
  }
  return clipped;
}

// Talla todas las ranuras de encaje a media madera entre las costillas de la Serie A y las de la Serie B
function carveInterlockingPuzzleSlots(slicesA, slicesB, axisA, axisB) {
  const slotW = Math.max(0.4, state.puzzleMaterialThicknessMM + state.puzzleSlotClearanceMM);
  const halfW = slotW * 0.5;
  const infoA = getPuzzleSlice2DAxes(axisA, axisB);
  const infoB = getPuzzleSlice2DAxes(axisB, axisA);

  // Cuando una serie tiene 3 o más láminas, la 1.ª y la última lámina actúan como tapas exteriores cerradas:
  // - No reciben ranuras que las atraviesen.
  // - Las costillas del otro eje se recortan para no sobresalir más allá de la cara interior de dichas tapas.
  const hasCapsA = slicesA.length >= 3;
  const hasCapsB = slicesB.length >= 3;
  const capMargin = Math.max(0.2, state.puzzleMaterialThicknessMM * 0.5);
  const uClipMinForB = hasCapsA ? (slicesA[0].coord + capMargin) : -Infinity;
  const uClipMaxForB = hasCapsA ? (slicesA[slicesA.length - 1].coord - capMargin) : Infinity;
  const uClipMinForA = hasCapsB ? (slicesB[0].coord + capMargin) : -Infinity;
  const uClipMaxForA = hasCapsB ? (slicesB[slicesB.length - 1].coord - capMargin) : Infinity;

  slicesA.forEach((s, idxA) => {
    const rawBase = s.rawBaseLoops || s.baseLoops || s.loops || [];
    s.rawBaseLoops = rawBase;
    const isOuterCapA = hasCapsA && (idxA === 0 || idxA === slicesA.length - 1);
    s.isOuterCap = isOuterCapA;
    s.baseLoops = (!isOuterCapA && hasCapsB && uClipMaxForA > uClipMinForA)
      ? clipLoopsToAxisRange(rawBase, infoA.uAxis, uClipMinForA, uClipMaxForA)
      : rawBase.slice();
    s.slots = [];
    s.puzzleSlots = s.slots;
    s.slotRects = [];
  });

  slicesB.forEach((s, idxB) => {
    const rawBase = s.rawBaseLoops || s.baseLoops || s.loops || [];
    s.rawBaseLoops = rawBase;
    const isOuterCapB = hasCapsB && (idxB === 0 || idxB === slicesB.length - 1);
    s.isOuterCap = isOuterCapB;
    s.baseLoops = (hasCapsA && uClipMaxForB > uClipMinForB)
      ? clipLoopsToAxisRange(rawBase, infoB.uAxis, uClipMinForB, uClipMaxForB)
      : rawBase.slice();
    s.slots = [];
    s.puzzleSlots = s.slots;
    s.slotRects = [];
  });

  let totalSlots = 0;

  for (let i = 0; i < slicesA.length; i++) {
    // No ranurar la 1.ª ni la última lámina de la Serie A (quedan como fachadas exteriores limpias)
    if (hasCapsA && (i === 0 || i === slicesA.length - 1)) continue;
    const sA = slicesA[i];
    if (!sA.baseLoops || sA.baseLoops.length === 0) continue;

    for (let j = 0; j < slicesB.length; j++) {
      // No ranurar la 1.ª ni la última lámina de la Serie B si existen tapas exteriores en B
      if (hasCapsB && (j === 0 || j === slicesB.length - 1)) continue;
      const sB = slicesB[j];
      if (!sB.baseLoops || sB.baseLoops.length === 0) continue;

      const intervalsA = getSolidIntervalsAlongLine(sA.baseLoops, infoA.uAxis, infoA.vAxis, sB.coord);
      const intervalsB = getSolidIntervalsAlongLine(sB.baseLoops, infoB.uAxis, infoB.vAxis, sA.coord);
      if (intervalsA.length === 0 || intervalsB.length === 0) continue;

      const commonIntervals = intersect1DIntervalLists(intervalsA, intervalsB);
      for (let k = 0; k < commonIntervals.length; k++) {
        const vMin = commonIntervals[k][0];
        const vMax = commonIntervals[k][1];
        const span = vMax - vMin;
        if (span < Math.max(1.5, slotW * 0.75)) continue;

        const vMid = (vMin + vMax) * 0.5;
        const relief = Math.min(0.2, span * 0.02);

        // Localizar el intervalo propio de sA y sB que contiene [vMin, vMax] para no invadir islas vecinas
        let idxIntA = -1;
        for (let ia = 0; ia < intervalsA.length; ia++) {
          if (intervalsA[ia][0] <= vMin + 1e-3 && intervalsA[ia][1] >= vMax - 1e-3) {
            idxIntA = ia;
            break;
          }
        }
        let idxIntB = -1;
        for (let ib = 0; ib < intervalsB.length; ib++) {
          if (intervalsB[ib][0] <= vMin + 1e-3 && intervalsB[ib][1] >= vMax - 1e-3) {
            idxIntB = ib;
            break;
          }
        }

        // Si sA continúa más allá de vMax (porque sB terminó antes), la ranura en sA debe detenerse en vMax + relief
        // Si vMax coincide con el borde exterior de sA, extender solo lo justo sin tocar el siguiente intervalo de sA
        let safeMaxVA = vMax + relief;
        if (idxIntA !== -1 && Math.abs(intervalsA[idxIntA][1] - vMax) < 0.25) {
          const openExtA = Math.min(2.0, slotW * 0.6);
          safeMaxVA = (idxIntA + 1 < intervalsA.length)
            ? Math.min(vMax + openExtA, (vMax + intervalsA[idxIntA + 1][0]) * 0.5)
            : (vMax + openExtA);
        }

        let safeMinVB = vMin - relief;
        if (idxIntB !== -1 && Math.abs(intervalsB[idxIntB][0] - vMin) < 0.25) {
          const openExtB = Math.min(2.0, slotW * 0.6);
          safeMinVB = (idxIntB > 0)
            ? Math.max(vMin - openExtB, (vMin + intervalsB[idxIntB - 1][1]) * 0.5)
            : (vMin - openExtB);
        }

        // Rectángulo de ranura en sA (Serie A: abre hacia +v, desde vMid hasta safeMaxVA)
        const rectA = infoA.uAxis === 'x'
          ? { minX: sB.coord - halfW, maxX: sB.coord + halfW, minY: vMid - relief, maxY: safeMaxVA }
          : { minX: vMid - relief, maxX: safeMaxVA, minY: sB.coord - halfW, maxY: sB.coord + halfW };

        sA.slotRects.push(rectA);
        sA.slots.push({
          targetCode: sB.puzzleCode,
          targetSliceIndex: sB.index,
          uAxis: infoA.uAxis,
          vAxis: infoA.vAxis,
          uCenter: sB.coord,
          vMid: vMid,
          vMouth: vMax,
          x: sB.coord,
          yStart: vMid,
          yEnd: vMax,
          mx: infoA.uAxis === 'x' ? sB.coord : vMax,
          my: infoA.uAxis === 'x' ? vMax : sB.coord,
          bx: infoA.uAxis === 'x' ? sB.coord : vMid,
          by: infoA.uAxis === 'x' ? vMid : sB.coord,
          fromTop: true,
          openPositive: true,
          slotWidth: slotW,
          rect: rectA
        });

        // Rectángulo de ranura complementaria en sB (Serie B: abre hacia -v, desde safeMinVB hasta vMid)
        const rectB = infoB.uAxis === 'x'
          ? { minX: sA.coord - halfW, maxX: sA.coord + halfW, minY: safeMinVB, maxY: vMid + relief }
          : { minX: safeMinVB, maxX: vMid + relief, minY: sA.coord - halfW, maxY: sA.coord + halfW };

        sB.slotRects.push(rectB);
        sB.slots.push({
          targetCode: sA.puzzleCode,
          targetSliceIndex: sA.index,
          uAxis: infoB.uAxis,
          vAxis: infoB.vAxis,
          uCenter: sA.coord,
          vMid: vMid,
          vMouth: vMin,
          x: sA.coord,
          yStart: vMin,
          yEnd: vMid,
          mx: infoB.uAxis === 'x' ? sA.coord : vMin,
          my: infoB.uAxis === 'x' ? vMin : sA.coord,
          bx: infoB.uAxis === 'x' ? sA.coord : vMid,
          by: infoB.uAxis === 'x' ? vMid : sA.coord,
          fromTop: false,
          openPositive: false,
          slotWidth: slotW,
          rect: rectB
        });

        totalSlots += 2;
      }
    }
  }

  // Tallar geométricamente todas las ranuras en los contornos 2D de cada costilla
  const allPuzzleSlices = slicesA.concat(slicesB);
  allPuzzleSlices.forEach((slice) => {
    let currentLoops = slice.baseLoops.slice();
    for (let r = 0; r < slice.slotRects.length; r++) {
      currentLoops = subtractSingleRectFromLoops(currentLoops, slice.slotRects[r]);
    }
    slice.loops = currentLoops;
  });

  state.puzzleTotalSlotsCount = totalSlots;
  return totalSlots;
}

// =========================================================================
// SUBDIVISIÓN MODULAR 3D EN PARTES / CONJUNTOS (GRAN FORMATO)
// =========================================================================

// Devuelve las dimensiones 2D (ancho X y alto Y en el plano de corte) según el eje perpendicular a la lasca
function getSlicePlaneSpan2D(sliceAxis) {
  const ax = sliceAxis || state.axis;
  if (ax === 'x') {
    return { spanX: state.dimsMM.y || 100, spanY: state.dimsMM.z || 100, labelX: 'Y', labelY: 'Z' };
  }
  if (ax === 'y') {
    return { spanX: state.dimsMM.x || 100, spanY: state.dimsMM.z || 100, labelX: 'X', labelY: 'Z' };
  }
  return { spanX: state.dimsMM.x || 100, spanY: state.dimsMM.y || 100, labelX: 'X', labelY: 'Y' };
}

// Calcula la cuadrícula de subdivisión 2D (columnas, filas y coordenadas de líneas de corte)
function getSliceSplitGrid(sliceAxis, sliceIndex = 0) {
  const { spanX, spanY, labelX, labelY } = getSlicePlaneSpan2D(sliceAxis);
  let cols = 1;
  let rows = 1;

  if (state.splitModelEnabled) {
    if (state.splitMode === 'grid') {
      cols = Math.max(1, Math.min(12, parseInt(state.splitCols, 10) || 2));
      rows = Math.max(1, Math.min(12, parseInt(state.splitRows, 10) || 2));
    } else {
      const maxW = Math.max(20, Number(state.splitMaxPartWidthMM) || 300);
      const maxH = Math.max(20, Number(state.splitMaxPartHeightMM) || 300);
      cols = Math.max(1, Math.min(12, Math.ceil((spanX - 0.05) / maxW)));
      rows = Math.max(1, Math.min(12, Math.ceil((spanY - 0.05) / maxH)));
    }
  }

  const minX = -spanX * 0.5;
  const maxX = spanX * 0.5;
  const minY = -spanY * 0.5;
  const maxY = spanY * 0.5;
  const partW = spanX / cols;
  const partH = spanY / rows;

  // Trabado alterno entre capas pares e impares (desplaza ligeramente la línea de unión para mayor rigidez estructural)
  let staggerX = 0;
  let staggerY = 0;
  if (state.splitModelEnabled && state.splitStaggerLayers && state.constructionMode !== 'puzzle3d') {
    const sign = (sliceIndex % 2 === 0) ? -1 : 1;
    if (cols > 1) staggerX = sign * Math.min(10, partW * 0.1);
    if (rows > 1) staggerY = sign * Math.min(10, partH * 0.1);
  }

  const xCuts = [];
  for (let c = 1; c < cols; c++) {
    xCuts.push(minX + c * partW + staggerX);
  }
  const yCuts = [];
  for (let r = 1; r < rows; r++) {
    yCuts.push(minY + r * partH + staggerY);
  }

  return {
    cols,
    rows,
    totalParts: cols * rows,
    spanX,
    spanY,
    minX,
    maxX,
    minY,
    maxY,
    partW,
    partH,
    xCuts,
    yCuts,
    labelX,
    labelY
  };
}

// Verifica si una caja delimitadora 2D está íntegramente contenida dentro del material sólido de la lasca
function isBoxInsideLoopsSolid(minX, maxX, minY, maxY, loops) {
  const samplePts = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
    { x: (minX + maxX) * 0.5, y: (minY + maxY) * 0.5 },
    { x: (minX + maxX) * 0.5, y: minY },
    { x: (minX + maxX) * 0.5, y: maxY },
    { x: minX, y: (minY + maxY) * 0.5 },
    { x: maxX, y: (minY + maxY) * 0.5 }
  ];
  for (let i = 0; i < samplePts.length; i++) {
    if (!isPointInLoopsSolid(samplePts[i], loops)) return false;
  }
  return true;
}

// Divide un conjunto de contornos 2D a lo largo de la recta x = cutVal o y = cutVal, insertando conectores cola de milano / espiga
function splitLoopsAlongLine(loops, axis, cutVal, jointType, jointDepthMM) {
  if (!loops || loops.length === 0) {
    return { negLoops: [], posLoops: [], jointsCount: 0, seamPolylines: [] };
  }
  const eps = 1e-6;
  const nudgedLoops = loops.map((l) => ({
    points: l.points.map((p) => ({
      x: axis === 'x' && Math.abs(p.x - cutVal) < eps ? (p.x >= cutVal ? cutVal + eps : cutVal - eps) : p.x,
      y: axis === 'y' && Math.abs(p.y - cutVal) < eps ? (p.y >= cutVal ? cutVal + eps : cutVal - eps) : p.y
    })),
    isHole: l.isHole,
    absArea: l.absArea,
    sectorCol: l.sectorCol,
    sectorRow: l.sectorRow,
    sectorCode: l.sectorCode
  }));

  const negSegs = [];
  const posSegs = [];
  const crossCoords = [];

  nudgedLoops.forEach((l) => {
    const pts = l.points;
    for (let i = 0, n = pts.length; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const va = (axis === 'x' ? a.x : a.y) - cutVal;
      const vb = (axis === 'x' ? b.x : b.y) - cutVal;

      if (va < 0 && vb < 0) {
        negSegs.push([a, b]);
      } else if (va > 0 && vb > 0) {
        posSegs.push([a, b]);
      } else {
        const t = va / (va - vb);
        const ix = axis === 'x' ? cutVal : a.x + t * (b.x - a.x);
        const iy = axis === 'y' ? cutVal : a.y + t * (b.y - a.y);
        const sharedNeg = { x: ix, y: iy };
        const sharedPos = { x: ix, y: iy };
        crossCoords.push(axis === 'x' ? iy : ix);

        if (va < 0) {
          negSegs.push([a, sharedNeg]);
          posSegs.push([sharedPos, b]);
        } else {
          posSegs.push([a, sharedPos]);
          negSegs.push([sharedNeg, b]);
        }
      }
    }
  });

  crossCoords.sort((a, b) => a - b);
  let jointsCount = 0;
  const seamPolylines = [];

  for (let k = 0; k + 1 < crossCoords.length; k += 2) {
    const c0 = crossCoords[k];
    const c1 = crossCoords[k + 1];
    const span = c1 - c0;
    if (span < 1e-5) continue;

    const midC = (c0 + c1) * 0.5;
    const testPt = axis === 'x' ? { x: cutVal, y: midC } : { x: midC, y: cutVal };
    if (!isPointInLoopsSolid(testPt, nudgedLoops)) continue;

    const pStartNeg = axis === 'x' ? { x: cutVal, y: c0 } : { x: c0, y: cutVal };
    const pEndNeg = axis === 'x' ? { x: cutVal, y: c1 } : { x: c1, y: cutVal };
    const pStartPos = axis === 'x' ? { x: cutVal, y: c0 } : { x: c0, y: cutVal };
    const pEndPos = axis === 'x' ? { x: cutVal, y: c1 } : { x: c1, y: cutVal };

    const d = Math.min(Math.max(2.0, Number(jointDepthMM) || 6.0), span * 0.22);
    const neckHalf = d * 0.65;
    const headHalf = jointType === 'dovetail' ? d * 1.05 : neckHalf;

    let canPlaceJoint = (jointType === 'dovetail' || jointType === 'tenon') && span >= Math.max(14, d * 3.6);
    if (canPlaceJoint) {
      const margin = 0.8;
      const boxMinX = axis === 'x' ? cutVal - margin : midC - headHalf - margin;
      const boxMaxX = axis === 'x' ? cutVal + d + margin : midC + headHalf + margin;
      const boxMinY = axis === 'y' ? cutVal - margin : midC - headHalf - margin;
      const boxMaxY = axis === 'y' ? cutVal + d + margin : midC + headHalf + margin;
      if (!isBoxInsideLoopsSolid(boxMinX, boxMaxX, boxMinY, boxMaxY, nudgedLoops)) {
        canPlaceJoint = false;
      }
    }

    if (canPlaceJoint) {
      jointsCount++;
      const makePt = (uAlong, vPerp) => (
        axis === 'x'
          ? { x: cutVal + vPerp, y: uAlong }
          : { x: uAlong, y: cutVal + vPerp }
      );

      // Si el tramo es largo (> 95 mm), colocamos 2 conectores simétricos para evitar giro en el plano
      const numJointsInSpan = (span >= Math.max(95, d * 8.5)) ? 2 : 1;
      const centers = numJointsInSpan === 2
        ? [c0 + span * 0.3, c0 + span * 0.7]
        : [midC];

      // Verificar que todos los centros candidatos estén dentro del sólido
      let allCentersValid = true;
      if (numJointsInSpan === 2) {
        for (let m = 0; m < centers.length; m++) {
          const mc = centers[m];
          const margin = 0.8;
          const bMinX = axis === 'x' ? cutVal - margin : mc - headHalf - margin;
          const bMaxX = axis === 'x' ? cutVal + d + margin : mc + headHalf + margin;
          const bMinY = axis === 'y' ? cutVal - margin : mc - headHalf - margin;
          const bMaxY = axis === 'y' ? cutVal + d + margin : mc + headHalf + margin;
          if (!isBoxInsideLoopsSolid(bMinX, bMaxX, bMinY, bMaxY, nudgedLoops)) {
            allCentersValid = false;
            break;
          }
        }
      }
      const activeCenters = allCentersValid ? centers : [midC];
      if (activeCenters.length === 2) jointsCount++; // segundo conector en el tramo

      const chainNeg = [pStartNeg];
      const chainPos = [pStartPos];
      const seamPts = [{ x: pStartNeg.x, y: pStartNeg.y }];

      for (let m = 0; m < activeCenters.length; m++) {
        const mc = activeCenters[m];
        const j1N = makePt(mc - neckHalf, 0);
        const j2N = makePt(mc - headHalf, d);
        const j3N = makePt(mc + headHalf, d);
        const j4N = makePt(mc + neckHalf, 0);
        chainNeg.push(j1N, j2N, j3N, j4N);

        const j1P = makePt(mc - neckHalf, 0);
        const j2P = makePt(mc - headHalf, d);
        const j3P = makePt(mc + headHalf, d);
        const j4P = makePt(mc + neckHalf, 0);
        chainPos.push(j1P, j2P, j3P, j4P);

        seamPts.push(
          { x: j1N.x, y: j1N.y },
          { x: j2N.x, y: j2N.y },
          { x: j3N.x, y: j3N.y },
          { x: j4N.x, y: j4N.y }
        );
      }

      chainNeg.push(pEndNeg);
      chainPos.push(pEndPos);
      seamPts.push({ x: pEndNeg.x, y: pEndNeg.y });
      seamPolylines.push(seamPts);

      for (let m = 0; m < chainNeg.length - 1; m++) {
        negSegs.push([chainNeg[m], chainNeg[m + 1]]);
        posSegs.push([chainPos[m], chainPos[m + 1]]);
      }
    } else {
      negSegs.push([pStartNeg, pEndNeg]);
      posSegs.push([pStartPos, pEndPos]);
      seamPolylines.push([
        { x: pStartNeg.x, y: pStartNeg.y },
        { x: pEndNeg.x, y: pEndNeg.y }
      ]);
    }
  }

  return {
    negLoops: classifyLoopsOuterAndHoles(chainExactBooleanSegments(negSegs)),
    posLoops: classifyLoopsOuterAndHoles(chainExactBooleanSegments(posSegs)),
    jointsCount,
    seamPolylines
  };
}

// Aplica la subdivisión modular en bloques sobre todas las lascas actuales
function applyModelSplitToExistingSlices(triggerRender = true) {
  let totalJoints = 0;
  const activeSectorsSet = new Set();

  state.slices.forEach((slice) => {
    if (!slice.unsplitLoops) {
      slice.unsplitLoops = (slice.loops || []).slice();
    }

    if (!state.splitModelEnabled) {
      slice.loops = slice.unsplitLoops.map((l) => ({
        points: l.points,
        absArea: l.absArea,
        signedArea: l.signedArea,
        isHole: l.isHole,
        isFrame: Boolean(l.isFrame)
      }));
      slice.splitGrid = null;
      slice.splitCutSeams = [];
      return;
    }

    const grid = getSliceSplitGrid(slice.sliceAxis || state.axis, slice.index);
    slice.splitGrid = grid;
    slice.splitCutSeams = [];

    if (grid.cols <= 1 && grid.rows <= 1) {
      slice.loops = slice.unsplitLoops.map((l) => ({
        points: l.points,
        absArea: l.absArea,
        signedArea: l.signedArea,
        isHole: l.isHole,
        isFrame: Boolean(l.isFrame),
        sectorCol: 0,
        sectorRow: 0,
        sectorCode: 'A1'
      }));
      if (slice.loops.some((l) => !l.isHole)) activeSectorsSet.add('A1');
      return;
    }

    // 1. Subdividir a lo largo de las líneas verticales X
    const xStrips = [{ col: 0, loops: slice.unsplitLoops.slice() }];
    for (let c = 1; c < grid.cols; c++) {
      const cutX = grid.xCuts[c - 1];
      const currentStrip = xStrips[xStrips.length - 1];
      const res = splitLoopsAlongLine(currentStrip.loops, 'x', cutX, state.splitJointType, state.splitJointDepthMM);
      currentStrip.loops = res.negLoops;
      xStrips.push({ col: c, loops: res.posLoops });
      totalJoints += res.jointsCount;
      res.seamPolylines.forEach((pl) => slice.splitCutSeams.push(pl));
    }

    // 2. Subdividir cada franja X a lo largo de las líneas horizontales Y
    const finalLoops = [];
    for (let c = 0; c < xStrips.length; c++) {
      const strip = xStrips[c];
      if (!strip.loops || strip.loops.length === 0) continue;

      const yCells = [{ row: 0, loops: strip.loops }];
      for (let r = 1; r < grid.rows; r++) {
        const cutY = grid.yCuts[r - 1];
        const currentCell = yCells[yCells.length - 1];
        const res = splitLoopsAlongLine(currentCell.loops, 'y', cutY, state.splitJointType, state.splitJointDepthMM);
        currentCell.loops = res.negLoops;
        yCells.push({ row: r, loops: res.posLoops });
        totalJoints += res.jointsCount;
        res.seamPolylines.forEach((pl) => slice.splitCutSeams.push(pl));
      }

      for (let r = 0; r < yCells.length; r++) {
        const cell = yCells[r];
        if (!cell.loops || cell.loops.length === 0) continue;
        // Etiqueta de sector: Fila superior = A, B, C... (invertimos índice Y para que A1 sea arriba-izquierda en el visor 2D)
        const displayRow = (grid.rows - 1) - cell.row;
        const rowLetter = String.fromCharCode(65 + Math.max(0, Math.min(25, displayRow)));
        const sectorCode = rowLetter + (strip.col + 1);

        let hasOuter = false;
        cell.loops.forEach((l) => {
          if (l.absArea < 0.04) return;
          if (!l.isHole) hasOuter = true;
          finalLoops.push({
            points: l.points,
            absArea: l.absArea,
            signedArea: l.signedArea,
            isHole: l.isHole,
            sectorCol: strip.col,
            sectorRow: displayRow,
            sectorCode: sectorCode
          });
        });
        if (hasOuter) activeSectorsSet.add(sectorCode);
      }
    }

    slice.loops = finalLoops;
  });

  const mainGrid = getSliceSplitGrid(state.axis, 0);
  state.splitTotalPartsCount = state.splitModelEnabled ? mainGrid.totalParts : 1;
  state.splitTotalJointsCount = state.splitModelEnabled ? totalJoints : 0;
  state.splitActiveSectorsCount = state.splitModelEnabled ? activeSectorsSet.size : 1;

  syncSplitModelUI();

  if (triggerRender) {
    build3DSlicesMesh();
    if (state.nestingEnabled) {
      recomputeBoardNesting();
    }
    renderSliceStripUI();
    update2DInspectorHeader();
    render2DSlice();
  }
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

  if (state.constructionMode === 'puzzle3d') {
    const cfg = getPuzzleAxesConfig();
    const spanA = state.dimsMM[cfg.axisA];
    const spanB = state.dimsMM[cfg.axisB];
    const countA = Math.max(2, state.puzzleCountA);
    const countB = Math.max(2, state.puzzleCountB);
    const minA = -spanA / 2;
    const stepA = spanA / countA;
    const minB = -spanB / 2;
    const stepB = spanB / countB;

    const slicesA = [];
    const slicesB = [];
    let totalRemovedIslands = 0;
    let totalFilledHoles = 0;

    for (let i = 0; i < countA; i++) {
      const coordA = minA + stepA * (i + 0.5);
      const rawLoops = sliceTrianglesAtPlane(verts, cfg.axisA, coordA, spanA);
      const filteredRes = filterLoopsByMinIslandSize(rawLoops);
      totalRemovedIslands += filteredRes.removedCount;
      totalFilledHoles += (filteredRes.filledHolesCount || 0);
      slicesA.push({
        index: i,
        coord: coordA,
        sliceAxis: cfg.axisA,
        puzzleSeries: 'A',
        seriesIndex: i,
        puzzleCode: cfg.axisA.toUpperCase() + (i + 1),
        selected: true,
        rawLoops: rawLoops,
        baseLoops: filteredRes.loops,
        loops: filteredRes.loops,
        slots: [],
        slotRects: []
      });
    }

    for (let j = 0; j < countB; j++) {
      const coordB = minB + stepB * (j + 0.5);
      const rawLoops = sliceTrianglesAtPlane(verts, cfg.axisB, coordB, spanB);
      const filteredRes = filterLoopsByMinIslandSize(rawLoops);
      totalRemovedIslands += filteredRes.removedCount;
      totalFilledHoles += (filteredRes.filledHolesCount || 0);
      slicesB.push({
        index: countA + j,
        coord: coordB,
        sliceAxis: cfg.axisB,
        puzzleSeries: 'B',
        seriesIndex: j,
        puzzleCode: cfg.axisB.toUpperCase() + (j + 1),
        selected: true,
        rawLoops: rawLoops,
        baseLoops: filteredRes.loops,
        loops: filteredRes.loops,
        slots: [],
        slotRects: []
      });
    }

    carveInterlockingPuzzleSlots(slicesA, slicesB, cfg.axisA, cfg.axisB);

    state.thickness = state.puzzleMaterialThicknessMM;
    state.slices = slicesA.concat(slicesB);
    state.slices.forEach((s) => {
      s.modelLoops = (s.loops || []).slice();
      s.unsplitLoops = (s.loops || []).slice();
    });
    state.filteredIslandsCount = totalRemovedIslands;
    state.filledHolesCount = totalFilledHoles;
    updateFilteredIslandsUI();
    syncConstructionModeUI();
  } else {
    state.puzzleTotalSlotsCount = 0;
    // Calcular número de capas y grosor según eje activo en modo apilado 1 eje
    const axisSpan = state.dimsMM[state.axis];
    if (state.mode === 'count') {
      state.thickness = axisSpan / state.sliceCount;
    } else {
      state.sliceCount = Math.max(2, Math.min(450, Math.floor(axisSpan / state.thickness)));
      document.getElementById('sliceCountSlider').value = state.sliceCount;
      document.getElementById('sliceCountLabel').textContent = state.sliceCount;
    }
    document.getElementById('computedThicknessInfo').textContent = state.thickness.toFixed(2) + ' mm (' + state.sliceCount + ' capas)';

    const minCoord = -axisSpan / 2;
    const step = axisSpan / state.sliceCount;
    const newSlices = [];
    let totalRemovedIslands = 0;
    let totalFilledHoles = 0;

    for (let i = 0; i < state.sliceCount; i++) {
      const planeCoord = minCoord + step * (i + 0.5);
      const rawLoops = sliceTrianglesAtPlane(verts, state.axis, planeCoord, axisSpan);
      const filteredRes = filterLoopsByMinIslandSize(rawLoops);
      totalRemovedIslands += filteredRes.removedCount;
      totalFilledHoles += (filteredRes.filledHolesCount || 0);
      newSlices.push({
        index: i,
        coord: planeCoord,
        sliceAxis: state.axis,
        puzzleSeries: null,
        puzzleCode: null,
        selected: true,
        rawLoops: rawLoops,
        modelLoops: filteredRes.loops.slice(),
        unsplitLoops: filteredRes.loops.slice(),
        loops: filteredRes.loops,
        slots: []
      });
    }

    state.slices = newSlices;
    state.filteredIslandsCount = totalRemovedIslands;
    state.filledHolesCount = totalFilledHoles;
    updateFilteredIslandsUI();
  }

  applyModelSplitToExistingSlices(false);
  syncSlicerFrameUI();

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

// Evalúa si un hueco interior debe rellenarse (eliminarse para dejar la pieza maciza) según la configuración
function shouldFillInternalHole(hole) {
  if (!state.fillInternalHoles || !hole || !hole.points || hole.points.length < 3) return false;
  if (state.fillHolesMode === 'all') return true;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  hole.points.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  });
  const w = Math.max(0, maxX - minX);
  const h = Math.max(0, maxY - minY);
  const threshold = Math.max(0.1, Number(state.fillHolesMaxSizeMM) || 15);

  if (state.fillHolesMode === 'area') {
    return (hole.absArea || 0) <= threshold;
  }
  return Math.max(w, h) <= threshold;
}

// Filtra los contornos de una lasca eliminando las islas pequeñas y/o rellenando los huecos internos seleccionados
function filterLoopsByMinIslandSize(rawLoops) {
  if (!rawLoops || rawLoops.length === 0) {
    return { loops: [], removedCount: 0, filledHolesCount: 0 };
  }
  const filterIslandsActive = Boolean(state.filterSmallIslands && state.minIslandSizeMM > 0);
  const fillHolesActive = Boolean(state.fillInternalHoles);
  if (!filterIslandsActive && !fillHolesActive) {
    return { loops: rawLoops.slice(), removedCount: 0, filledHolesCount: 0 };
  }

  // Asegurar orden descendente por área para procesar primero los contornos exteriores padres
  const outers = rawLoops.filter((l) => !l.isHole).slice().sort((a, b) => (b.absArea || 0) - (a.absArea || 0));
  const holes = rawLoops.filter((l) => l.isHole);
  const keptLoops = [];
  const filledHolesList = [];
  let removedCount = 0;
  let filledHolesCount = 0;

  outers.forEach((outer, oIdx) => {
    // Si este contorno exterior está dentro de un hueco que ya fue rellenado, queda absorbido por la pieza maciza
    if (filledHolesList.length > 0 && outer.points && outer.points.length > 0) {
      const absorbedByFilledHole = filledHolesList.some((fh) =>
        fh.absArea > outer.absArea && isPointInPolygon(outer.points[0], fh.points)
      );
      if (absorbedByFilledHole) {
        return;
      }
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    outer.points.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
    const w = Math.max(0, maxX - minX);
    const h = Math.max(0, maxY - minY);

    if (filterIslandsActive && !doesIslandPassMinSizeFilter(w, h, outer.absArea)) {
      removedCount++;
      return;
    }

    keptLoops.push(outer);

    // Evaluar los huecos que pertenecen directamente a esta isla válida
    holes.forEach((hole) => {
      if (!hole.points || hole.points.length < 3) return;
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
        if (fillHolesActive && shouldFillInternalHole(hole)) {
          filledHolesCount++;
          filledHolesList.push(hole);
        } else {
          keptLoops.push(hole);
        }
      }
    });
  });

  return { loops: keptLoops, removedCount, filledHolesCount };
}

// Reaplica el filtro de tamaño mínimo de isla y el relleno de huecos internos sobre todas las lascas sin recalcular la intersección 3D
function applyIslandFilterToExistingSlices() {
  let totalRemoved = 0;
  let totalFilledHoles = 0;
  state.slices.forEach((slice) => {
    const base = slice.rawLoops || slice.loops || [];
    const res = filterLoopsByMinIslandSize(base);
    slice.rawBaseLoops = res.loops;
    slice.baseLoops = res.loops;
    slice.modelLoops = res.loops.slice();
    slice.unsplitLoops = res.loops.slice();
    slice.loops = res.loops;
    totalRemoved += res.removedCount;
    totalFilledHoles += (res.filledHolesCount || 0);
  });

  if (state.constructionMode === 'puzzle3d') {
    const cfg = getPuzzleAxesConfig();
    const slicesA = state.slices.filter((s) => s.puzzleSeries === 'A');
    const slicesB = state.slices.filter((s) => s.puzzleSeries === 'B');
    carveInterlockingPuzzleSlots(slicesA, slicesB, cfg.axisA, cfg.axisB);
    state.slices.forEach((s) => {
      s.modelLoops = (s.loops || []).slice();
      s.unsplitLoops = (s.loops || []).slice();
    });
    syncConstructionModeUI();
  }

  applyModelSplitToExistingSlices(false);
  syncSlicerFrameUI();

  state.filteredIslandsCount = totalRemoved;
  state.filledHolesCount = totalFilledHoles;
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

  // Sincronizar UI de Rellenar Huecos Internos
  const fhChk1 = document.getElementById('fillInternalHolesCheck');
  const fhChk2 = document.getElementById('modalFillHolesCheck');
  if (fhChk1) fhChk1.checked = Boolean(state.fillInternalHoles);
  if (fhChk2) fhChk2.checked = Boolean(state.fillInternalHoles);

  const fhBox = document.getElementById('fillInternalHolesBox');
  if (fhBox) fhBox.classList.toggle('opacity-45', !state.fillInternalHoles);

  const fhModeSel = document.getElementById('fillHolesModeSelect');
  if (fhModeSel) fhModeSel.value = state.fillHolesMode || 'all';

  const fhSizeRow = document.getElementById('fillHolesSizeRow');
  if (fhSizeRow) fhSizeRow.classList.toggle('hidden', state.fillHolesMode === 'all');

  const fhSizeLbl = document.getElementById('fillHolesSizeLabel');
  if (fhSizeLbl) {
    fhSizeLbl.textContent = state.fillHolesMode === 'area' ? 'Área máx. hueco (mm²):' : 'Tamaño máx. hueco (mm):';
  }

  const fhSizeInput = document.getElementById('fillHolesMaxSizeInput');
  if (fhSizeInput) fhSizeInput.value = state.fillHolesMaxSizeMM;

  const fhBadge = document.getElementById('filledHolesBadge');
  if (fhBadge) {
    if (!state.fillInternalHoles) {
      fhBadge.className = 'text-[10px] text-slate-400 text-center pt-0.5';
      fhBadge.textContent = 'Desactivado (se conservan los huecos internos)';
    } else if (state.filledHolesCount > 0) {
      const modeDesc = state.fillHolesMode === 'all'
        ? 'todos los huecos'
        : ('≤ ' + state.fillHolesMaxSizeMM + (state.fillHolesMode === 'area' ? ' mm²' : ' mm'));
      fhBadge.className = 'text-[10px] text-cyan-300 font-semibold text-center pt-0.5';
      fhBadge.textContent = '🧱 ' + state.filledHolesCount + ' hueco(s) interno(s) rellenado(s) (' + modeDesc + ')';
    } else {
      fhBadge.className = 'text-[10px] text-emerald-300 text-center pt-0.5';
      fhBadge.textContent = '✓ Sin huecos internos que rellenar con este criterio';
    }
  }
}

function setFilterSmallIslands(enabled) {
  state.filterSmallIslands = Boolean(enabled);
  applyIslandFilterToExistingSlices();
}

function setFillInternalHoles(enabled) {
  state.fillInternalHoles = Boolean(enabled);
  applyIslandFilterToExistingSlices();
}

function onFillHolesFilterChange() {
  const modeEl = document.getElementById('fillHolesModeSelect');
  const sizeEl = document.getElementById('fillHolesMaxSizeInput');
  if (modeEl) state.fillHolesMode = modeEl.value;
  if (sizeEl) {
    const val = parseFloat(sizeEl.value);
    if (Number.isFinite(val) && val > 0) {
      state.fillHolesMaxSizeMM = val;
    }
  }
  applyIslandFilterToExistingSlices();
}

function setFillHolesPreset(mode, maxSizeMM) {
  state.fillInternalHoles = true;
  state.fillHolesMode = mode || 'all';
  if (typeof maxSizeMM === 'number' && maxSizeMM > 0) {
    state.fillHolesMaxSizeMM = maxSizeMM;
  }
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
    const cleanPts = pts.slice();
    const signed = computeSignedArea(cleanPts);
    return { points: cleanPts, absArea: Math.abs(signed), signedArea: signed, isHole: false };
  }).filter((it) => it.absArea > 1e-3 && it.points.length >= 3);

  items.sort((a, b) => b.absArea - a.absArea);

  for (let i = 0; i < items.length; i++) {
    let depth = 0;
    const testPt = items[i].points[0];
    for (let j = 0; j < i; j++) {
      if (isPointInPolygon(testPt, items[j].points)) {
        depth++;
      }
    }
    const isHole = (depth % 2 === 1);
    items[i].isHole = isHole;
    // Normalizar orientación: contornos exteriores antihorarios (signedArea > 0) y huecos horarios (signedArea < 0)
    if (!isHole && items[i].signedArea < 0) {
      items[i].points.reverse();
      items[i].signedArea = -items[i].signedArea;
    } else if (isHole && items[i].signedArea > 0) {
      items[i].points.reverse();
      items[i].signedArea = -items[i].signedArea;
    }
  }
  return items;
}

// Determina si un hueco (hole) pertenece directamente a un contorno exterior (outer) sin estar dentro de otra isla menor
function isHoleDirectChildOfOuter(hole, outer, allOuters) {
  if (!hole || !outer || !hole.points || !hole.points.length || !outer.points || !outer.points.length) return false;
  if (hole.absArea >= outer.absArea) return false;
  if (!isPointInPolygon(hole.points[0], outer.points)) return false;
  for (let k = 0; k < allOuters.length; k++) {
    const other = allOuters[k];
    if (other !== outer && other.absArea < outer.absArea && other.absArea > hole.absArea) {
      if (isPointInPolygon(hole.points[0], other.points)) {
        return false;
      }
    }
  }
  return true;
}

// =========================================================================
// CONSTRUCCIÓN DE LASCAS 3D EXTRUIDAS (APILADO 1 EJE, PUZZLE 3D Y BLOQUES MODULARES)
// =========================================================================
function build3DSlicesMesh() {
  if (!sliceGroup3D || typeof THREE === 'undefined') return;
  while (sliceGroup3D.children.length > 0) {
    const m = sliceGroup3D.children.pop();
    if (m.geometry) m.geometry.dispose();
    if (m.material) m.material.dispose();
  }

  const isPuzzle = state.constructionMode === 'puzzle3d';
  const extrudeDepth = isPuzzle
    ? Math.max(0.3, state.puzzleMaterialThicknessMM)
    : Math.max(0.2, state.thickness * 0.92);

  state.slices.forEach((slice, idx) => {
    const outers = slice.loops.filter((l) => !l.isHole);
    const holes = slice.loops.filter((l) => l.isHole);
    if (outers.length === 0) return;

    const ax = slice.sliceAxis || state.axis;
    let baseCol;
    if (isPuzzle) {
      if (slice.puzzleSeries === 'A') {
        const hueA = 0.54 - ((slice.seriesIndex || 0) / Math.max(1, state.puzzleCountA - 1)) * 0.08;
        baseCol = new THREE.Color().setHSL(hueA, 0.80, 0.50);
      } else {
        const hueB = 0.11 - ((slice.seriesIndex || 0) / Math.max(1, state.puzzleCountB - 1)) * 0.05;
        baseCol = new THREE.Color().setHSL(hueB, 0.85, 0.54);
      }
    } else {
      const hue = 0.55 - (idx / Math.max(1, state.slices.length - 1)) * 0.14;
      baseCol = new THREE.Color().setHSL(hue, 0.75, 0.52);
    }

    const isSplitMulti = Boolean(state.splitModelEnabled && slice.splitGrid && slice.splitGrid.totalParts > 1);

    if (isSplitMulti) {
      // Agrupar contornos exteriores por sector (A1, A2, B1, B2...) para poder separarlos en 3D y distinguirlos
      const sectorMap = new Map();
      outers.forEach((outer) => {
        const key = outer.sectorCode || 'A1';
        if (!sectorMap.has(key)) {
          sectorMap.set(key, {
            sectorCode: key,
            sectorCol: outer.sectorCol || 0,
            sectorRow: outer.sectorRow || 0,
            outers: []
          });
        }
        sectorMap.get(key).outers.push(outer);
      });

      sectorMap.forEach((secGroup) => {
        const shapes = secGroup.outers.map((outer) => {
          const sh = new THREE.Shape();
          outer.points.forEach((pt, i) => {
            if (i === 0) sh.moveTo(pt.x, pt.y);
            else sh.lineTo(pt.x, pt.y);
          });
          sh.closePath();

          holes.forEach((h) => {
            if (isHoleDirectChildOfOuter(h, outer, secGroup.outers)) {
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

        if (ax === 'x') {
          geom.rotateY(Math.PI / 2);
          geom.rotateZ(Math.PI / 2);
        } else if (ax === 'y') {
          geom.rotateX(Math.PI / 2);
        }

        const secCol = baseCol.clone();
        const parity = (secGroup.sectorCol + secGroup.sectorRow) % 2;
        if (parity === 1) {
          secCol.offsetHSL(0.035, 0.04, 0.07);
        }

        const mat = new THREE.MeshStandardMaterial({
          color: secCol,
          roughness: 0.35,
          metalness: 0.1,
          transparent: true,
          opacity: slice.selected ? 0.95 : 0.2
        });

        const mesh = new THREE.Mesh(geom, mat);
        mesh.userData = {
          sliceIndex: idx,
          baseColor: secCol.getHex(),
          sectorCode: secGroup.sectorCode,
          sectorCol: secGroup.sectorCol,
          sectorRow: secGroup.sectorRow,
          gridCols: slice.splitGrid.cols,
          gridRows: slice.splitGrid.rows,
          partW: slice.splitGrid.partW,
          partH: slice.splitGrid.partH
        };
        sliceGroup3D.add(mesh);
      });
      return;
    }

    const shapes = outers.map((outer) => {
      const sh = new THREE.Shape();
      outer.points.forEach((pt, i) => {
        if (i === 0) sh.moveTo(pt.x, pt.y);
        else sh.lineTo(pt.x, pt.y);
      });
      sh.closePath();

      holes.forEach((h) => {
        if (isHoleDirectChildOfOuter(h, outer, outers)) {
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

    if (ax === 'x') {
      geom.rotateY(Math.PI / 2);
      geom.rotateZ(Math.PI / 2);
    } else if (ax === 'y') {
      geom.rotateX(Math.PI / 2);
    }

    const mat = new THREE.MeshStandardMaterial({
      color: baseCol,
      roughness: 0.35,
      metalness: 0.1,
      transparent: true,
      opacity: slice.selected ? 0.95 : 0.2
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData = { sliceIndex: idx, baseColor: baseCol.getHex() };
    sliceGroup3D.add(mesh);
  });

  update3DSlicesTransforms();
}

function update3DSlicesTransforms() {
  if (!sliceGroup3D) return;
  const exp = state.explodeFactor / 100;
  const splitExp = (state.splitExplodeFactor || 0) / 100;
  const isPuzzle = state.constructionMode === 'puzzle3d';
  const puzzleCfg = isPuzzle ? getPuzzleAxesConfig() : null;

  sliceGroup3D.children.forEach((mesh) => {
    const idx = mesh.userData.sliceIndex;
    const slice = state.slices[idx];
    if (!slice) return;

    const ax = slice.sliceAxis || state.axis;
    let px = 0, py = 0, pz = 0;

    if (isPuzzle && puzzleCfg) {
      // En modo Puzzle 3D, al aumentar Explosión 3D la Serie B se desliza a lo largo del eje común de encaje saliendo de las ranuras de la Serie A
      const spreadCoord = slice.coord * (1 + exp * 0.3);
      const liftSpan = state.dimsMM[puzzleCfg.axisCommon] || 100;
      const slideOffset = (slice.puzzleSeries === 'B' ? 1 : -0.15) * exp * liftSpan * 0.65;

      if (ax === 'x') px = spreadCoord;
      else if (ax === 'y') py = spreadCoord;
      else pz = spreadCoord;

      if (puzzleCfg.axisCommon === 'x') px += slideOffset;
      else if (puzzleCfg.axisCommon === 'y') py += slideOffset;
      else pz += slideOffset;
    } else {
      const offset = slice.coord * (1 + exp * 1.4);
      if (ax === 'x') px = offset;
      else if (ax === 'y') py = offset;
      else pz = offset;
    }

    // Separación lateral entre bloques modulares (A1, A2, B1, B2...) si está activa la subdivisión
    if (state.splitModelEnabled && mesh.userData.gridCols && (mesh.userData.gridCols > 1 || mesh.userData.gridRows > 1) && splitExp > 0) {
      const gCols = mesh.userData.gridCols;
      const gRows = mesh.userData.gridRows;
      const sCol = mesh.userData.sectorCol || 0;
      const sRow = mesh.userData.sectorRow || 0;
      const yCellIdx = (gRows - 1) - sRow;

      const maxSepX = Math.max(25, (mesh.userData.partW || 120) * 0.42);
      const maxSepY = Math.max(25, (mesh.userData.partH || 120) * 0.42);
      const sepX2D = (sCol - (gCols - 1) * 0.5) * maxSepX * splitExp;
      const sepY2D = (yCellIdx - (gRows - 1) * 0.5) * maxSepY * splitExp;

      if (ax === 'z') {
        px += sepX2D;
        py += sepY2D;
      } else if (ax === 'y') {
        px += sepX2D;
        pz += sepY2D;
      } else {
        py += sepX2D;
        pz += sepY2D;
      }
    }

    mesh.position.set(px, py, pz);

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
  // En modo Puzzle 3D las piezas se unen por ranuras ortogonales sin pegamento, no por apilado paralelo
  if (state.constructionMode === 'puzzle3d') return null;
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
  const refLoops = slice ? (slice.unsplitLoops || slice.loops) : null;
  if (!refLoops) return false;
  let insideCount = 0;
  for (let i = 0; i < refLoops.length; i++) {
    const poly = refLoops[i].points;
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
  const guideLoops = guideSlice ? (guideSlice.unsplitLoops || guideSlice.loops) : null;
  if (!guideLoops) return [];
  const sliceLoops = slice ? (slice.unsplitLoops || slice.loops || []) : [];
  const allPolylines = [];
  const connectTolSq = 1e-6;

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
      sliceLoops.forEach((sLoop) => {
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
function computeLoopWithHoldingTabs(pts, isHole = false, skipTabs = false) {
  if (!pts || pts.length < 3) {
    return { isClosed: true, subpaths: [], tabBridges: [] };
  }
  // No aplicar nunca sujeción por presión (micro-uniones) al marco configurable
  if (skipTabs || pts.isFrame || !state.tabsEnabled || (isHole && !state.tabApplyToHoles)) {
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

// =========================================================================
// CONTROLADORES UI DE SUBDIVISIÓN MODULAR 3D (GRAN FORMATO)
// =========================================================================
function syncSplitModelUI() {
  const chkSidebar = document.getElementById('splitModelEnabledCheck');
  const panel = document.getElementById('splitModelConfigPanel');
  const legendSeams = document.getElementById('legendSplitSeams');
  const splitExplodeBox = document.getElementById('splitExplodeControlBox');

  if (chkSidebar) chkSidebar.checked = state.splitModelEnabled;
  if (panel) panel.classList.toggle('hidden', !state.splitModelEnabled);
  if (legendSeams) {
    legendSeams.classList.toggle('hidden', !state.splitModelEnabled);
    legendSeams.classList.toggle('flex', state.splitModelEnabled);
  }
  if (splitExplodeBox) splitExplodeBox.classList.toggle('hidden', !state.splitModelEnabled);

  const btnMaxSize = document.getElementById('btnSplitModeMaxSize');
  const btnGrid = document.getElementById('btnSplitModeGrid');
  const boxMaxSize = document.getElementById('splitMaxSizeBox');
  const boxGrid = document.getElementById('splitGridBox');

  if (btnMaxSize && btnGrid) {
    if (state.splitMode === 'max_size') {
      btnMaxSize.className = 'py-1 px-2 rounded bg-fuchsia-500/20 border border-fuchsia-500 text-fuchsia-300 text-[11px] font-semibold';
      btnGrid.className = 'py-1 px-2 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold';
    } else {
      btnGrid.className = 'py-1 px-2 rounded bg-fuchsia-500/20 border border-fuchsia-500 text-fuchsia-300 text-[11px] font-semibold';
      btnMaxSize.className = 'py-1 px-2 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold';
    }
  }
  if (boxMaxSize) boxMaxSize.classList.toggle('hidden', state.splitMode !== 'max_size');
  if (boxGrid) boxGrid.classList.toggle('hidden', state.splitMode !== 'grid');

  const wInput = document.getElementById('splitMaxPartWidthInput');
  const hInput = document.getElementById('splitMaxPartHeightInput');
  const colsInput = document.getElementById('splitColsInput');
  const rowsInput = document.getElementById('splitRowsInput');
  const jointSelect = document.getElementById('splitJointTypeSelect');
  const depthInput = document.getElementById('splitJointDepthInput');
  const staggerCheck = document.getElementById('splitStaggerCheck');
  const expSlider = document.getElementById('splitExplodeSlider');
  const expLabel = document.getElementById('splitExplodeValLabel');

  if (wInput) wInput.value = state.splitMaxPartWidthMM;
  if (hInput) hInput.value = state.splitMaxPartHeightMM;
  if (colsInput) colsInput.value = state.splitCols;
  if (rowsInput) rowsInput.value = state.splitRows;
  if (jointSelect) jointSelect.value = state.splitJointType;
  if (depthInput) depthInput.value = state.splitJointDepthMM;
  if (staggerCheck) staggerCheck.checked = state.splitStaggerLayers;
  if (expSlider) expSlider.value = state.splitExplodeFactor;
  if (expLabel) expLabel.textContent = state.splitExplodeFactor + '%';

  // Actualizar textos de botones rápidos de múltiplos (p. ej. 2×2 = 60×60 cm, 3×3 = 90×90 cm, 4×4 = 120×120 cm)
  const wCm = (state.splitMaxPartWidthMM / 10);
  const hCm = (state.splitMaxPartHeightMM / 10);
  const b2 = document.getElementById('splitScaleBtn_2x2');
  const b3 = document.getElementById('splitScaleBtn_3x3');
  const b4 = document.getElementById('splitScaleBtn_4x4');
  if (b2) b2.textContent = '2×2 (' + (wCm * 2).toFixed(0) + '×' + (hCm * 2).toFixed(0) + ' cm)';
  if (b3) b3.textContent = '3×3 (' + (wCm * 3).toFixed(0) + '×' + (hCm * 3).toFixed(0) + ' cm)';
  if (b4) b4.textContent = '4×4 (' + (wCm * 4).toFixed(0) + '×' + (hCm * 4).toFixed(0) + ' cm)';

  const badge = document.getElementById('splitSummaryBadge');
  if (badge) {
    if (!state.splitModelEnabled) {
      badge.textContent = 'Subdivisión desactivada (1 pieza entera por capa)';
    } else {
      const grid = getSliceSplitGrid(state.axis, 0);
      const figWCm = (grid.spanX / 10).toFixed(1);
      const figHCm = (grid.spanY / 10).toFixed(1);
      const partWCm = (grid.partW / 10).toFixed(1);
      const partHCm = (grid.partH / 10).toFixed(1);
      const jointLabel = state.splitJointType === 'dovetail'
        ? 'cola de milano ⏢'
        : (state.splitJointType === 'tenon' ? 'espiga ▭' : 'corte recto ∣');
      if (grid.totalParts <= 1) {
        badge.textContent = 'La figura (' + figWCm + '×' + figHCm + ' cm) cabe en 1 bloque de ' + wCm.toFixed(0) + '×' + hCm.toFixed(0) + ' cm. Pulsa 2×2 o 4×4 arriba para Gran Formato.';
      } else {
        const lastSector = String.fromCharCode(65 + grid.rows - 1) + grid.cols;
        badge.textContent = '🧩 Figura ' + figWCm + '×' + figHCm + ' cm → ' + grid.cols + '×' + grid.rows + ' (' + grid.totalParts + ' conjuntos A1..' + lastSector + ' de ' + partWCm + '×' + partHCm + ' cm · ' + jointLabel + ')';
      }
    }
  }
}

function setSplitModelEnabled(val) {
  state.splitModelEnabled = Boolean(val);
  if (state.splitModelEnabled && state.splitMode === 'max_size') {
    const { spanX, spanY } = getSlicePlaneSpan2D(state.axis);
    if (spanX <= state.splitMaxPartWidthMM + 0.1 && spanY <= state.splitMaxPartHeightMM + 0.1) {
      // Si el modelo actual es menor que el bloque máximo (ej. 12 cm vs 30 cm), escalamos automáticamente a 2×2 conjuntos (ej. 60×60 cm)
      scaleModelToSplitMultiple(2, 2);
      return;
    }
  }
  applyModelSplitToExistingSlices(true);
}

function setSplitMode(mode) {
  state.splitMode = mode === 'grid' ? 'grid' : 'max_size';
  applyModelSplitToExistingSlices(true);
}

function onSplitSettingsChange() {
  const wInput = document.getElementById('splitMaxPartWidthInput');
  const hInput = document.getElementById('splitMaxPartHeightInput');
  const colsInput = document.getElementById('splitColsInput');
  const rowsInput = document.getElementById('splitRowsInput');
  const jointSelect = document.getElementById('splitJointTypeSelect');
  const depthInput = document.getElementById('splitJointDepthInput');
  const staggerCheck = document.getElementById('splitStaggerCheck');

  if (wInput) state.splitMaxPartWidthMM = Math.max(20, Math.min(3000, parseFloat(wInput.value) || 300));
  if (hInput) state.splitMaxPartHeightMM = Math.max(20, Math.min(3000, parseFloat(hInput.value) || 300));
  if (colsInput) state.splitCols = Math.max(1, Math.min(12, parseInt(colsInput.value, 10) || 2));
  if (rowsInput) state.splitRows = Math.max(1, Math.min(12, parseInt(rowsInput.value, 10) || 2));
  if (jointSelect) state.splitJointType = jointSelect.value;
  if (depthInput) state.splitJointDepthMM = Math.max(2, Math.min(35, parseFloat(depthInput.value) || 6.0));
  if (staggerCheck) state.splitStaggerLayers = Boolean(staggerCheck.checked);

  applyModelSplitToExistingSlices(true);
}

function setSplitPartPresetMM(wMM, hMM) {
  state.splitModelEnabled = true;
  state.splitMode = 'max_size';
  state.splitMaxPartWidthMM = wMM;
  state.splitMaxPartHeightMM = hMM;
  applyModelSplitToExistingSlices(true);
}

function syncSplitWithBoardSize() {
  state.splitModelEnabled = true;
  state.splitMode = 'max_size';
  const usableW = Math.max(40, Math.round(state.boardWidthMM - state.boardMarginMM * 2));
  const usableH = Math.max(40, Math.round(state.boardHeightMM - state.boardMarginMM * 2));
  state.splitMaxPartWidthMM = usableW;
  state.splitMaxPartHeightMM = usableH;
  applyModelSplitToExistingSlices(true);
}

function scaleModelToSplitMultiple(multCols, multRows) {
  const c = Math.max(1, parseInt(multCols, 10) || 2);
  const r = Math.max(1, parseInt(multRows, 10) || 2);
  state.splitModelEnabled = true;
  state.splitMode = 'max_size';

  const targetW = c * state.splitMaxPartWidthMM;
  const targetH = r * state.splitMaxPartHeightMM;
  const ax = state.axis;
  const { spanX, spanY } = getSlicePlaneSpan2D(ax);

  const lockEl = document.getElementById('lockAspectCheckbox');
  const locked = lockEl ? lockEl.checked : true;

  if (locked) {
    const curPlanarMax = Math.max(spanX, spanY, 0.001);
    const desiredPlanarMax = Math.max(targetW, targetH);
    const ratio = desiredPlanarMax / curPlanarMax;
    state.dimsMM.x = Number(Math.max(1, state.dimsMM.x * ratio).toFixed(2));
    state.dimsMM.y = Number(Math.max(1, state.dimsMM.y * ratio).toFixed(2));
    state.dimsMM.z = Number(Math.max(1, state.dimsMM.z * ratio).toFixed(2));
  } else {
    if (ax === 'z') {
      state.dimsMM.x = targetW;
      state.dimsMM.y = targetH;
    } else if (ax === 'y') {
      state.dimsMM.x = targetW;
      state.dimsMM.z = targetH;
    } else {
      state.dimsMM.y = targetW;
      state.dimsMM.z = targetH;
    }
  }

  if (typeof syncDimensionInputsUI === 'function') syncDimensionInputsUI();
  rebuildGhostAndSlices();
  if (typeof resetCamera3D === 'function') resetCamera3D();
}

function onSplitExplodeInput(val) {
  state.splitExplodeFactor = parseFloat(val) || 0;
  const lbl = document.getElementById('splitExplodeValLabel');
  if (lbl) lbl.textContent = state.splitExplodeFactor + '%';
  update3DSlicesTransforms();
}

if (typeof window !== 'undefined') {
  window.setSplitModelEnabled = setSplitModelEnabled;
  window.setSplitMode = setSplitMode;
  window.onSplitSettingsChange = onSplitSettingsChange;
  window.setSplitPartPresetMM = setSplitPartPresetMM;
  window.syncSplitWithBoardSize = syncSplitWithBoardSize;
  window.scaleModelToSplitMultiple = scaleModelToSplitMultiple;
  window.onSplitExplodeInput = onSplitExplodeInput;
}

// =========================================================================
// MOTOR DE MARCO CONFIGURABLE 2D PARA CORTE / GRABADO ALREDEDOR DEL TABLERO
// (Exclusivo para el vectorizado 2D: Visor 2D, SVG y DXF; no altera el modelo 3D)
// =========================================================================

/**
 * Calcula las dimensiones 2D del documento/lienzo cuando se visualiza o exporta
 * una lasca individual en 2D con el marco configurable activo.
 */
function getSlicerFrameDimensionsForAxis(sliceAxis) {
  const { spanX: baseW, spanY: baseH } = getSlicePlaneSpan2D(sliceAxis || state.axis);
  const laserMode = state.slicerFrameLaserMode || 'cut_outer';
  const thicknessMM = laserMode === 'cut_outer'
    ? 0
    : Math.max(0.5, Number(state.slicerFrameThicknessMM) || 8.0);
  const marginMM = Math.max(0, Number(state.slicerFrameMarginMM) || 0);
  const radiusMM = Math.max(0, Number(state.slicerFrameRadiusMM) || 0);
  const shape = state.slicerFrameShape || 'rounded_rect';

  const innerW = Math.max(6.0, baseW + 2 * marginMM);
  const innerH = Math.max(6.0, baseH + 2 * marginMM);
  const outerW = Math.max(innerW, innerW + 2 * thicknessMM);
  const outerH = Math.max(innerH, innerH + 2 * thicknessMM);

  return {
    baseW,
    baseH,
    innerW,
    innerH,
    outerW,
    outerH,
    thicknessMM,
    marginMM,
    radiusMM,
    shape,
    laserMode
  };
}

/**
 * Genera un polígono cerrado 2D centrado en (cx, cy) con ancho w y alto h
 * según la forma ('rounded_rect', 'circle', 'octagon', 'arch', 'hexagon').
 */
function generate2DFramePolygon(cx, cy, w, h, shape, cornerRadiusMM, wantClockwise = false) {
  const hw = Math.max(2.0, w * 0.5);
  const hh = Math.max(2.0, h * 0.5);
  const r = Math.max(0, Math.min(Number(cornerRadiusMM) || 0, hw - 0.25, hh - 0.25));
  const pts = [];

  if (shape === 'circle') {
    const segs = 72;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push({ x: cx + Math.cos(a) * hw, y: cy + Math.sin(a) * hh });
    }
  } else if (shape === 'octagon') {
    const ch = r > 0.2 ? Math.min(r, hw * 0.65, hh * 0.65) : Math.min(hw, hh) * 0.22;
    pts.push(
      { x: cx - hw + ch, y: cy - hh },
      { x: cx + hw - ch, y: cy - hh },
      { x: cx + hw, y: cy - hh + ch },
      { x: cx + hw, y: cy + hh - ch },
      { x: cx + hw - ch, y: cy + hh },
      { x: cx - hw + ch, y: cy + hh },
      { x: cx - hw, y: cy + hh - ch },
      { x: cx - hw, y: cy - hh + ch }
    );
  } else if (shape === 'hexagon') {
    pts.push(
      { x: cx, y: cy - hh },
      { x: cx + hw, y: cy - hh * 0.5 },
      { x: cx + hw, y: cy + hh * 0.5 },
      { x: cx, y: cy + hh },
      { x: cx - hw, y: cy + hh * 0.5 },
      { x: cx - hw, y: cy - hh * 0.5 }
    );
  } else if (shape === 'arch') {
    const rBot = Math.min(r, hw * 0.45, hh * 0.45);
    const archH = Math.min(hw, hh * 0.82);
    const archCenterY = (cy + hh) - archH;

    if (rBot <= 0.2) {
      pts.push({ x: cx - hw, y: cy - hh }, { x: cx + hw, y: cy - hh });
    } else {
      const arcSegs = 8;
      for (let i = 0; i <= arcSegs; i++) {
        const a = Math.PI + (i / arcSegs) * (Math.PI * 0.5);
        pts.push({ x: cx - hw + rBot + Math.cos(a) * rBot, y: cy - hh + rBot + Math.sin(a) * rBot });
      }
      for (let i = 0; i <= arcSegs; i++) {
        const a = Math.PI * 1.5 + (i / arcSegs) * (Math.PI * 0.5);
        pts.push({ x: cx + hw - rBot + Math.cos(a) * rBot, y: cy - hh + rBot + Math.sin(a) * rBot });
      }
    }

    const topSegs = 36;
    for (let i = 0; i <= topSegs; i++) {
      const a = (i / topSegs) * Math.PI;
      pts.push({
        x: cx + Math.cos(a) * hw,
        y: archCenterY + Math.sin(a) * archH
      });
    }
  } else {
    // 'rounded_rect' (Rectangular Redondeado o Recto si r === 0)
    if (r <= 0.15) {
      pts.push(
        { x: cx - hw, y: cy - hh },
        { x: cx + hw, y: cy - hh },
        { x: cx + hw, y: cy + hh },
        { x: cx - hw, y: cy + hh }
      );
    } else {
      const segsPerCorner = 10;
      const corners = [
        { x0: cx + hw - r, y0: cy - hh + r, a0: -Math.PI * 0.5, a1: 0 },
        { x0: cx + hw - r, y0: cy + hh - r, a0: 0, a1: Math.PI * 0.5 },
        { x0: cx - hw + r, y0: cy + hh - r, a0: Math.PI * 0.5, a1: Math.PI },
        { x0: cx - hw + r, y0: cy - hh + r, a0: Math.PI, a1: Math.PI * 1.5 }
      ];
      corners.forEach((c) => {
        for (let i = 0; i <= segsPerCorner; i++) {
          const a = c.a0 + (i / segsPerCorner) * (c.a1 - c.a0);
          pts.push({
            x: c.x0 + Math.cos(a) * r,
            y: c.y0 + Math.sin(a) * r
          });
        }
      });
    }
  }

  const signed = computeSignedArea(pts);
  if ((!wantClockwise && signed < 0) || (wantClockwise && signed > 0)) {
    pts.reverse();
  }
  pts.isFrame = true;
  return pts;
}

/**
 * Construye la geometría 2D completa del marco configurable alrededor del tablero
 * o del lienzo 2D [minX, minY, maxX, maxY], devolviendo:
 *  - outerCutPts: contorno de corte exterior (#ff0000)
 *  - innerCutPts: contorno de ventana interior calada (#0055ff)
 *  - engraveLoops: contornos de orla decorativa grabada (#008800)
 *  - keyholePts: taladro pasante superior para colgar (#0055ff)
 */
function get2DBoardFrameGeometry(minX, minY, maxX, maxY, placementsOrLoops = null, isBoardMode = true) {
  if (!state.slicerFrameEnabled) return null;

  const shape = state.slicerFrameShape || 'rounded_rect';
  const laserMode = state.slicerFrameLaserMode || 'cut_outer';
  const fitMode = state.slicerFrameFit || 'board';
  const style = state.slicerFrameStyle || 'double_line';
  const thickness = Math.max(0.5, Number(state.slicerFrameThicknessMM) || 8.0);
  const margin = Math.max(0, Number(state.slicerFrameMarginMM) || 0);
  const radius = Math.max(0, Number(state.slicerFrameRadiusMM) || 0);

  let fMinX = minX;
  let fMinY = minY;
  let fMaxX = maxX;
  let fMaxY = maxY;

  if (fitMode === 'pieces' && Array.isArray(placementsOrLoops) && placementsOrLoops.length > 0) {
    let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
    placementsOrLoops.forEach((item) => {
      const pts = item.outerPoints || item.points || [];
      pts.forEach((p) => {
        if (p.x < pMinX) pMinX = p.x;
        if (p.y < pMinY) pMinY = p.y;
        if (p.x > pMaxX) pMaxX = p.x;
        if (p.y > pMaxY) pMaxY = p.y;
      });
    });
    if (Number.isFinite(pMinX) && Number.isFinite(pMaxX)) {
      const padOut = margin + (laserMode === 'cut_outer' ? 0 : thickness);
      fMinX = pMinX - padOut;
      fMinY = pMinY - padOut;
      fMaxX = pMaxX + padOut;
      fMaxY = pMaxY + padOut;
      if (isBoardMode) {
        fMinX = Math.max(minX + 0.2, fMinX);
        fMinY = Math.max(minY + 0.2, fMinY);
        fMaxX = Math.min(maxX - 0.2, fMaxX);
        fMaxY = Math.min(maxY - 0.2, fMaxY);
      }
    }
  } else if (isBoardMode) {
    // Ajuste alrededor del borde del tablero respetando el margen exterior configurado
    fMinX = minX + margin;
    fMinY = minY + margin;
    fMaxX = maxX - margin;
    fMaxY = maxY - margin;
  }

  const outerW = Math.max(8.0, fMaxX - fMinX);
  const outerH = Math.max(8.0, fMaxY - fMinY);
  const cx = (fMinX + fMaxX) * 0.5;
  const cy = (fMinY + fMaxY) * 0.5;
  const innerW = Math.max(4.0, outerW - 2 * thickness);
  const innerH = Math.max(4.0, outerH - 2 * thickness);

  const outerRadius = laserMode === 'cut_outer' ? radius : (radius + thickness);
  const innerRadius = radius;

  const hasOuterCut = (
    laserMode === 'cut_outer' ||
    laserMode === 'cut_and_engrave' ||
    laserMode === 'cut_window'
  );
  const hasInnerCut = (laserMode === 'cut_window');
  const hasEngrave = (
    laserMode === 'cut_and_engrave' ||
    laserMode === 'engrave_only'
  );

  const outerCutPts = hasOuterCut
    ? generate2DFramePolygon(cx, cy, outerW, outerH, shape, outerRadius, false)
    : null;

  const innerCutPts = hasInnerCut
    ? generate2DFramePolygon(cx, cy, innerW, innerH, shape, innerRadius, true)
    : null;

  const engraveLoops = [];
  if (hasEngrave) {
    const inset = laserMode === 'cut_and_engrave' ? Math.min(1.2, thickness * 0.16) : 0;
    const eOutW = Math.max(innerW + 0.8, outerW - 2 * inset);
    const eOutH = Math.max(innerH + 0.8, outerH - 2 * inset);
    const eInW = Math.max(4.0, innerW + 2 * inset);
    const eInH = Math.max(4.0, innerH + 2 * inset);
    const rOut = Math.max(0, outerRadius - inset);
    const rIn = Math.max(0, innerRadius + inset);

    if (style === 'solid_band') {
      engraveLoops.push(
        { points: generate2DFramePolygon(cx, cy, eOutW, eOutH, shape, rOut, false), isHole: false },
        { points: generate2DFramePolygon(cx, cy, eInW, eInH, shape, rIn, true), isHole: true }
      );
    } else {
      // 'double_line' o 'ornate_corners'
      const strokeW = Math.max(0.7, Math.min(2.2, thickness * 0.22));
      engraveLoops.push(
        { points: generate2DFramePolygon(cx, cy, eOutW, eOutH, shape, rOut, false), isHole: false },
        { points: generate2DFramePolygon(cx, cy, Math.max(4, eOutW - 2 * strokeW), Math.max(4, eOutH - 2 * strokeW), shape, Math.max(0, rOut - strokeW), true), isHole: true }
      );
      if (thickness >= 3.0) {
        engraveLoops.push(
          { points: generate2DFramePolygon(cx, cy, eInW + 2 * strokeW, eInH + 2 * strokeW, shape, rIn + strokeW, false), isHole: false },
          { points: generate2DFramePolygon(cx, cy, eInW, eInH, shape, rIn, true), isHole: true }
        );
      }
      if (style === 'ornate_corners') {
        const midHalfW = (innerW + outerW) * 0.25;
        const midHalfH = (innerH + outerH) * 0.25;
        const dSize = Math.max(1.2, Math.min(5.0, thickness * 0.34));
        const signs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        signs.forEach(([sx, sy]) => {
          const dx = sx * (midHalfW - (shape === 'circle' ? midHalfW * 0.29 : innerRadius * 0.35));
          const dy = sy * (midHalfH - (shape === 'circle' ? midHalfH * 0.29 : innerRadius * 0.35));
          engraveLoops.push({
            points: [
              { x: cx + dx, y: cy + dy - dSize },
              { x: cx + dx + dSize, y: cy + dy },
              { x: cx + dx, y: cy + dy + dSize },
              { x: cx + dx - dSize, y: cy + dy }
            ],
            isHole: false
          });
        });
      }
    }
  }

  let keyholePts = null;
  if (state.slicerFrameKeyhole) {
    const khRad = Math.max(0.75, Math.min(25, (Number(state.slicerFrameKeyholeDiamMM) || 5.0) * 0.5));
    const khY = (cy + outerH * 0.5) - Math.max(khRad + 1.5, thickness * 0.5);
    const segs = 28;
    keyholePts = [];
    for (let i = 0; i < segs; i++) {
      const a = -((i / segs) * Math.PI * 2);
      keyholePts.push({ x: cx + Math.cos(a) * khRad, y: khY + Math.sin(a) * khRad });
    }
    keyholePts.isFrame = true;
  }

  return {
    outerCutPts,
    innerCutPts,
    engraveLoops,
    keyholePts,
    cx,
    cy,
    outerW,
    outerH,
    innerW,
    innerH,
    fMinX,
    fMinY,
    fMaxX,
    fMaxY,
    shape,
    laserMode,
    fitMode,
    style,
    thickness,
    margin,
    radius
  };
}

/**
 * Actualiza el estado y previsualización 2D del Marco Configurable del Tablero/Vectorizado
 * SIN alterar la malla ni las lascas 3D del modelo.
 */
function applySlicerFrameToExistingSlices(triggerRender = true) {
  syncSlicerFrameUI();
  if (triggerRender) {
    if (state.nestingEnabled && typeof recomputeBoardNesting === 'function') {
      recomputeBoardNesting();
    }
    if (typeof renderSliceStripUI === 'function') renderSliceStripUI();
    if (typeof update2DInspectorHeader === 'function') update2DInspectorHeader();
    if (typeof render2DSlice === 'function') render2DSlice();
  }
}

function syncSlicerFrameUI() {
  const chkSidebar = document.getElementById('slicerFrameEnabledCheck');
  const chkBoard = document.getElementById('boardFrameEnabledCheck');
  const chkModal = document.getElementById('modalSlicerFrameCheck');
  const panel = document.getElementById('slicerFrameConfigPanel');
  const styleRow = document.getElementById('slicerFrameStyleRow');
  const thicknessBox = document.getElementById('slicerFrameThicknessBox');
  const badge = document.getElementById('slicerFrameSummaryBadge');

  if (chkSidebar) chkSidebar.checked = Boolean(state.slicerFrameEnabled);
  if (chkBoard) chkBoard.checked = Boolean(state.slicerFrameEnabled);
  if (chkModal) chkModal.checked = Boolean(state.slicerFrameEnabled);
  if (panel) panel.classList.toggle('hidden', !state.slicerFrameEnabled);

  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v;
  };
  const setChk = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.checked = Boolean(v);
  };

  setVal('slicerFrameFitSelect', state.slicerFrameFit || 'board');
  setVal('slicerFrameShapeSelect', state.slicerFrameShape || 'rounded_rect');
  setVal('slicerFrameLaserModeSelect', state.slicerFrameLaserMode || 'cut_outer');
  setVal('slicerFrameStyleSelect', state.slicerFrameStyle || 'double_line');
  setVal('slicerFrameThicknessInput', state.slicerFrameThicknessMM);
  setVal('slicerFrameMarginInput', state.slicerFrameMarginMM);
  setVal('slicerFrameRadiusInput', state.slicerFrameRadiusMM);
  setChk('slicerFrameKeyholeCheck', state.slicerFrameKeyhole);
  setVal('slicerFrameKeyholeDiamInput', state.slicerFrameKeyholeDiamMM);

  const usesEngraveStyle = (
    state.slicerFrameLaserMode === 'cut_and_engrave' ||
    state.slicerFrameLaserMode === 'engrave_only'
  );
  if (styleRow) styleRow.classList.toggle('hidden', !usesEngraveStyle);
  if (thicknessBox) thicknessBox.classList.toggle('opacity-45', state.slicerFrameLaserMode === 'cut_outer');

  if (badge) {
    if (!state.slicerFrameEnabled) {
      badge.textContent = 'Sin marco de corte en el tablero / vectorizado 2D';
    } else {
      const modeLabels = {
        cut_outer: '🔴 Corte Exterior del Tablero (#ff0000)',
        cut_and_engrave: '✂️+⚡ Corte Exterior + Orla Grabada (#008800)',
        cut_window: '🔲 Marco Calado (Ext. #ff0000 + Ventana #0055ff)',
        engrave_only: '🟢 Solo Orla Grabada (#008800)'
      };
      const fitLabel = state.slicerFrameFit === 'pieces' ? 'Alrededor de piezas' : 'Borde del tablero';
      badge.innerHTML =
        '🖼️ <strong>' + (modeLabels[state.slicerFrameLaserMode] || 'Marco 2D') + '</strong> · ' +
        fitLabel + ' (R=' + Number(state.slicerFrameRadiusMM).toFixed(0) + ' mm)';
    }
  }
}

function setSlicerFrameEnabled(val) {
  state.slicerFrameEnabled = Boolean(val);
  applySlicerFrameToExistingSlices(true);
}

function onSlicerFrameSettingsChange() {
  const fitEl = document.getElementById('slicerFrameFitSelect');
  const shapeEl = document.getElementById('slicerFrameShapeSelect');
  const laserModeEl = document.getElementById('slicerFrameLaserModeSelect');
  const styleEl = document.getElementById('slicerFrameStyleSelect');
  const thEl = document.getElementById('slicerFrameThicknessInput');
  const mgEl = document.getElementById('slicerFrameMarginInput');
  const radEl = document.getElementById('slicerFrameRadiusInput');
  const khCheck = document.getElementById('slicerFrameKeyholeCheck');
  const khDiam = document.getElementById('slicerFrameKeyholeDiamInput');

  if (fitEl) state.slicerFrameFit = fitEl.value;
  if (shapeEl) state.slicerFrameShape = shapeEl.value;
  if (laserModeEl) state.slicerFrameLaserMode = laserModeEl.value;
  if (styleEl) state.slicerFrameStyle = styleEl.value;
  if (thEl) state.slicerFrameThicknessMM = Math.max(0.5, Math.min(150, parseFloat(thEl.value) || 8.0));
  if (mgEl) {
    const mVal = parseFloat(mgEl.value);
    if (Number.isFinite(mVal)) state.slicerFrameMarginMM = Math.max(0, Math.min(200, mVal));
  }
  if (radEl) {
    const rVal = parseFloat(radEl.value);
    if (Number.isFinite(rVal)) state.slicerFrameRadiusMM = Math.max(0, Math.min(200, rVal));
  }
  if (khCheck) state.slicerFrameKeyhole = Boolean(khCheck.checked);
  if (khDiam) state.slicerFrameKeyholeDiamMM = Math.max(1.5, Math.min(40, parseFloat(khDiam.value) || 5.0));

  applySlicerFrameToExistingSlices(true);
}

function setSlicerFramePreset(shape, laserMode, thicknessMM, marginMM, radiusMM, fitMode = 'board') {
  state.slicerFrameEnabled = true;
  state.slicerFrameFit = fitMode;
  state.slicerFrameShape = shape;
  state.slicerFrameLaserMode = laserMode;
  state.slicerFrameThicknessMM = thicknessMM;
  state.slicerFrameMarginMM = marginMM;
  state.slicerFrameRadiusMM = radiusMM;
  applySlicerFrameToExistingSlices(true);
}

if (typeof window !== 'undefined') {
  window.getSlicerFrameDimensionsForAxis = getSlicerFrameDimensionsForAxis;
  window.generate2DFramePolygon = generate2DFramePolygon;
  window.get2DBoardFrameGeometry = get2DBoardFrameGeometry;
  window.applySlicerFrameToExistingSlices = applySlicerFrameToExistingSlices;
  window.syncSlicerFrameUI = syncSlicerFrameUI;
  window.setSlicerFrameEnabled = setSlicerFrameEnabled;
  window.onSlicerFrameSettingsChange = onSlicerFrameSettingsChange;
  window.setSlicerFramePreset = setSlicerFramePreset;
}



