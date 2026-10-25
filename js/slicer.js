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

// Devuelve los ejes (axisA, axisB, axisC, axisCommon, is3Axes) para la modalidad Puzzle 3D
function getPuzzleAxesConfig() {
  if (state.puzzleAxes === 'xyz') {
    return { axisA: 'x', axisB: 'y', axisC: 'z', axisCommon: 'z', is3Axes: true };
  }
  if (state.puzzleAxes === 'xz') {
    return { axisA: 'x', axisB: 'z', axisC: null, axisCommon: 'y', is3Axes: false };
  }
  if (state.puzzleAxes === 'yz') {
    return { axisA: 'y', axisB: 'z', axisC: null, axisCommon: 'x', is3Axes: false };
  }
  return { axisA: 'x', axisB: 'y', axisC: null, axisCommon: 'z', is3Axes: false };
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
  if (state.constructionMode === 'puzzle3d') {
    // En el modo Puzzle 3D, activar por defecto Eliminar Islas Pequeñas y Rellenar Huecos Internos
    state.filterSmallIslands = true;
    state.fillInternalHoles = true;
    updateFilteredIslandsUI();
    if (!state._puzzleAxesEvaluatedForCurrentMesh && state.baseVertices && state.baseVertices.length > 0) {
      autoSelectBestPuzzleAxes(true);
      return;
    }
  }
  syncConstructionModeUI();
  rebuildGhostAndSlices();
}

function setPuzzleAxes(axesPair) {
  if (axesPair === 'xy' || axesPair === 'xz' || axesPair === 'yz' || axesPair === 'xyz') {
    state.puzzleAxes = axesPair;
    state._puzzleAxesEvaluatedForCurrentMesh = true;
  }
  syncConstructionModeUI();
  if (state.constructionMode === 'puzzle3d') {
    rebuildGhostAndSlices();
  }
}

// Evalúa cuantitativamente un conjunto de costillas Puzzle 3D según 4 criterios geométricos y estructurales (0..100 pts)
function computePuzzleAxesCandidateScore(slices, totalSlots) {
  let activeCount = 0;
  let multiSlotCount = 0;      // costillas con >= 2 ranuras (estabilidad rotacional)
  let singleSlotCount = 0;     // costillas con 1 sola ranura (voladizo inestable / giro libre)
  let zeroSlotActiveCount = 0; // costillas activas con 0 ranuras (piezas sueltas)
  let extraIslands = 0;        // islas adicionales por fragmentación tras tallar ranuras
  let boxyRibsCount = 0;       // costillas tipo "peine rectangular" sin silueta (Area / (W*H) > 0.80)
  let exprSum = 0;

  (slices || []).forEach((s) => {
    const baseOuters = (s.baseLoops || []).filter((l) => !l.isHole);
    const finalOuters = (s.loops || []).filter((l) => !l.isHole);
    if (finalOuters.length === 0) return;

    activeCount++;
    const sl = (s.slots || []).length;
    if (sl >= 2) multiSlotCount++;
    else if (sl === 1) singleSlotCount++;
    else zeroSlotActiveCount++;

    extraIslands += Math.max(0, finalOuters.length - 1);

    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, area = 0;
    baseOuters.forEach((l) => {
      area += l.absArea || 0;
      (l.points || []).forEach((p) => {
        if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
        if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
      });
    });
    const bboxA = Math.max(1, (x1 - x0) * (y1 - y0));
    const rectRatio = Math.min(1, area / bboxA);
    if (rectRatio > 0.80) boxyRibsCount++;
    const expr = Math.max(0, 1.0 - Math.abs(rectRatio - 0.58) / 0.52);
    exprSum += expr;
  });

  if (activeCount === 0 || !slices || slices.length === 0) {
    return { totalScore: 0, stabilityPts: 0, silhouettePts: 0, cohesionPts: 0, densityPts: 0, activeCount: 0, multiSlotCount: 0, singleSlotCount: 0, boxyRibsCount: 0, extraIslands: 0, totalSlots: 0 };
  }

  // 1. Estabilidad rotacional de encajes (35 pts): premia >= 2 ranuras por costilla, penaliza 1 o 0 ranuras
  const stabilityRatio = Math.max(0, (multiSlotCount - 1.2 * singleSlotCount - 2.5 * zeroSlotActiveCount) / activeCount);
  const stabilityPts = 35 * stabilityRatio;

  // 2. Expresividad morfológica de silueta / ausencia de "peines rectangulares" (30 pts)
  const avgExpr = exprSum / activeCount;
  const boxyPenaltyRatio = boxyRibsCount / activeCount;
  const silhouettePts = 30 * Math.max(0, avgExpr * (1 - 0.75 * boxyPenaltyRatio));

  // 3. Cohesión topológica / ausencia de islas fragmentadas (20 pts)
  const cohesionPts = 20 * (1 / (1 + 0.45 * extraIslands));

  // 4. Densidad de cruces y cobertura de costillas activas (15 pts)
  const coverageRatio = activeCount / slices.length;
  const slotDensity = Math.min(1, (totalSlots || 0) / Math.max(1, activeCount * 4.5));
  const densityPts = 15 * (0.5 * coverageRatio + 0.5 * slotDensity);

  const totalScore = Number((stabilityPts + silhouettePts + cohesionPts + densityPts).toFixed(1));
  return {
    totalScore,
    stabilityPts: Number(stabilityPts.toFixed(1)),
    silhouettePts: Number(silhouettePts.toFixed(1)),
    cohesionPts: Number(cohesionPts.toFixed(1)),
    densityPts: Number(densityPts.toFixed(1)),
    activeCount,
    multiSlotCount,
    singleSlotCount,
    boxyRibsCount,
    extraIslands,
    totalSlots: totalSlots || 0
  };
}

// Evalúa las 3 combinaciones ('xy', 'xz', 'yz') sobre la malla actual y selecciona automáticamente la combinación óptima
function autoSelectBestPuzzleAxes(silent = false) {
  if (!state.baseVertices || state.baseVertices.length === 0) return null;
  const verts = getScaledTriangles();
  const countA = Math.max(2, state.puzzleCountA || 7);
  const countB = Math.max(2, state.puzzleCountB || 7);
  const candidates = [
    { pair: 'xy', axisA: 'x', axisB: 'y' },
    { pair: 'xz', axisA: 'x', axisB: 'z' },
    { pair: 'yz', axisA: 'y', axisB: 'z' }
  ];

  const prevMode = state.constructionMode;
  state.constructionMode = 'puzzle3d';
  const results = {};
  let bestPair = state.puzzleAxes || 'xy';
  let bestScore = -1;

  candidates.forEach((cand) => {
    const spanA = state.dimsMM[cand.axisA] || 100;
    const spanB = state.dimsMM[cand.axisB] || 100;
    const coordInfoA = computePuzzleAxisSliceCoords(spanA, countA, state.puzzleStartOffsetAMM, state.puzzleStartMode, state.puzzleRibOffsetsAMM);
    const coordInfoB = computePuzzleAxisSliceCoords(spanB, countB, state.puzzleStartOffsetBMM, state.puzzleStartMode, state.puzzleRibOffsetsBMM);
    const slicesA = [];
    const slicesB = [];

    for (let i = 0; i < countA; i++) {
      const coordA = coordInfoA.coords[i];
      const rawLoops = sliceTrianglesAtPlane(verts, cand.axisA, coordA, spanA);
      const filtered = filterLoopsByMinIslandSize(rawLoops).loops;
      slicesA.push({
        index: i, coord: coordA, sliceAxis: cand.axisA, puzzleSeries: 'A', seriesIndex: i,
        puzzleCode: cand.axisA.toUpperCase() + (i + 1),
        rawLoops, rawBaseLoops: filtered, baseLoops: filtered, loops: filtered, slots: [], slotRects: []
      });
    }
    for (let j = 0; j < countB; j++) {
      const coordB = coordInfoB.coords[j];
      const rawLoops = sliceTrianglesAtPlane(verts, cand.axisB, coordB, spanB);
      const filtered = filterLoopsByMinIslandSize(rawLoops).loops;
      slicesB.push({
        index: countA + j, coord: coordB, sliceAxis: cand.axisB, puzzleSeries: 'B', seriesIndex: j,
        puzzleCode: cand.axisB.toUpperCase() + (j + 1),
        rawLoops, rawBaseLoops: filtered, baseLoops: filtered, loops: filtered, slots: [], slotRects: []
      });
    }
    carveInterlockingPuzzleSlots(slicesA, slicesB, cand.axisA, cand.axisB);
    const allSlices = slicesA.concat(slicesB);
    const metrics = computePuzzleAxesCandidateScore(allSlices, state.puzzleTotalSlotsCount);
    results[cand.pair] = metrics;
    if (metrics.totalScore > bestScore) {
      bestScore = metrics.totalScore;
      bestPair = cand.pair;
    }
  });

  state.constructionMode = prevMode;
  state.puzzleAxes = bestPair;
  state.puzzleAxesAutoScores = { ...results, bestPair };
  state._puzzleAxesEvaluatedForCurrentMesh = true;

  syncConstructionModeUI();
  rebuildGhostAndSlices();
  return state.puzzleAxesAutoScores;
}
if (typeof window !== 'undefined') {
  window.autoSelectBestPuzzleAxes = autoSelectBestPuzzleAxes;
  window.computePuzzleAxesCandidateScore = computePuzzleAxesCandidateScore;
}

function onPuzzleCountChange(which, val) {
  const n = Math.max(2, Math.min(60, parseInt(val, 10) || 7));
  if (which === 'a') {
    state.puzzleCountA = n;
    const lbl = document.getElementById('puzzleCountALabel');
    if (lbl) lbl.textContent = n;
    const sA = document.getElementById('puzzleCountASlider');
    if (sA) sA.value = n;
    const inA = document.getElementById('puzzleCountAInput');
    if (inA) inA.value = n;
  } else if (which === 'c') {
    state.puzzleCountC = n;
    const lbl = document.getElementById('puzzleCountCLabel');
    if (lbl) lbl.textContent = n;
    const sC = document.getElementById('puzzleCountCSlider');
    if (sC) sC.value = n;
    const inC = document.getElementById('puzzleCountCInput');
    if (inC) inC.value = n;
  } else {
    state.puzzleCountB = n;
    const lbl = document.getElementById('puzzleCountBLabel');
    if (lbl) lbl.textContent = n;
    const sB = document.getElementById('puzzleCountBSlider');
    if (sB) sB.value = n;
    const inB = document.getElementById('puzzleCountBInput');
    if (inB) inB.value = n;
  }
  syncConstructionModeUI();
  if (state.constructionMode === 'puzzle3d') {
    rebuildGhostAndSlices();
  }
}

function stepPuzzleCount(which, delta) {
  const current = which === 'a' ? state.puzzleCountA : (which === 'c' ? (state.puzzleCountC || 4) : state.puzzleCountB);
  const next = Math.max(2, Math.min(60, (parseInt(current, 10) || 7) + (parseInt(delta, 10) || 0)));
  onPuzzleCountChange(which, next);
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

// Calcula las coordenadas 1D de las costillas de un eje en modo Puzzle 3D permitiendo mover el comienzo del laminado
// así como desplazar individualmente cualquier costilla seleccionada
function computePuzzleAxisSliceCoords(span, count, offsetMM, mode, ribOffsetsMap) {
  const safeSpan = Math.max(1, Number(span) || 100);
  const n = Math.max(2, parseInt(count, 10) || 2);
  const minCoord = -safeSpan / 2;
  const maxCoord = safeSpan / 2;
  const defaultStep = safeSpan / n;
  const defaultFirst = minCoord + defaultStep * 0.5;
  const defaultLast = maxCoord - defaultStep * 0.5;

  // Margen de seguridad mínimo respecto al borde extremo del bounding box para garantizar intersección limpia con la malla
  const safeMargin = Math.min(Math.max(0.15, safeSpan * 0.004), defaultStep * 0.45);
  const absMin = minCoord + safeMargin;
  const absMax = maxCoord - safeMargin;
  const minSpan = Math.max(1.0, Math.min(safeSpan * 0.15, n * 0.8));
  const off = Number(offsetMM) || 0;
  const adjMode = mode || state.puzzleStartMode || 'start';

  let baseFirst = defaultFirst;
  let baseLast = defaultLast;

  if (adjMode === 'symmetric') {
    const maxSymInward = Math.max(0, (defaultLast - defaultFirst - minSpan) * 0.5);
    baseFirst = Math.max(absMin, Math.min(defaultFirst + maxSymInward, defaultFirst + off));
    baseLast = Math.min(absMax, Math.max(defaultLast - maxSymInward, defaultLast - off));
  } else if (adjMode === 'shift') {
    baseFirst = Math.max(absMin, Math.min(absMax - minSpan, defaultFirst + off));
    baseLast = Math.min(absMax, Math.max(baseFirst + minSpan, defaultLast + off));
  } else {
    // 'start': mueve el comienzo del laminado (1.ª lámina) y reparte uniformemente las costillas hasta el final
    baseFirst = Math.max(absMin, Math.min(defaultLast - minSpan, defaultFirst + off));
    baseLast = defaultLast;
  }

  const baseCoords = [];
  const coords = [];
  const step = n > 1 ? ((baseLast - baseFirst) / (n - 1)) : 0;
  for (let i = 0; i < n; i++) {
    const bCoord = baseFirst + step * i;
    baseCoords.push(bCoord);
    const ribOff = (ribOffsetsMap && Number.isFinite(ribOffsetsMap[i])) ? Number(ribOffsetsMap[i]) : 0;
    const finalCoord = Math.max(absMin, Math.min(absMax, bCoord + ribOff));
    coords.push(finalCoord);
  }

  return {
    coords,
    baseCoords,
    firstCoord: coords[0],
    lastCoord: coords[coords.length - 1],
    defaultFirst,
    defaultLast,
    absMin,
    absMax,
    edgeOffsetMM: Number((absMin - defaultFirst).toFixed(2))
  };
}

function getSelectedPuzzleRibInfo() {
  const cfg = getPuzzleAxesConfig();
  const activeSlice = state.slices && state.slices[state.activeSliceIndex];
  const series = (activeSlice && activeSlice.puzzleSeries === 'C')
    ? 'C'
    : ((activeSlice && activeSlice.puzzleSeries === 'B') ? 'B' : 'A');
  const count = series === 'A'
    ? Math.max(2, state.puzzleCountA)
    : (series === 'C' ? Math.max(2, state.puzzleCountC || 4) : Math.max(2, state.puzzleCountB));
  const rawIdx = (activeSlice && typeof activeSlice.seriesIndex === 'number') ? activeSlice.seriesIndex : 0;
  const seriesIndex = Math.max(0, Math.min(count - 1, rawIdx));
  const axis = series === 'A' ? cfg.axisA : (series === 'C' ? (cfg.axisC || 'z') : cfg.axisB);
  const span = Math.max(10, (state.dimsMM && state.dimsMM[axis]) || 100);
  const startOff = series === 'A'
    ? state.puzzleStartOffsetAMM
    : (series === 'C' ? (state.puzzleStartOffsetCMM || 0) : state.puzzleStartOffsetBMM);
  const offsetsMap = series === 'A'
    ? (state.puzzleRibOffsetsAMM || {})
    : (series === 'C' ? (state.puzzleRibOffsetsCMM || {}) : (state.puzzleRibOffsetsBMM || {}));
  const coordInfo = computePuzzleAxisSliceCoords(span, count, startOff, state.puzzleStartMode, offsetsMap);
  const baseCoord = coordInfo.baseCoords[seriesIndex];
  const actualCoord = coordInfo.coords[seriesIndex];
  const ribOffset = actualCoord - baseCoord;
  const ribCode = axis.toUpperCase() + (seriesIndex + 1);

  return {
    slice: activeSlice || null,
    series,
    seriesIndex,
    axis,
    ribCode,
    coordInfo,
    baseCoord,
    actualCoord,
    ribOffset
  };
}

function isSliceHiddenInView(slice) {
  if (!slice) return false;
  if (state.constructionMode === 'puzzle3d') {
    if (slice.puzzleSeries === 'A' && state.puzzleHideSeriesA) return true;
    if (slice.puzzleSeries === 'B' && state.puzzleHideSeriesB) return true;
    if (slice.puzzleSeries === 'C' && state.puzzleHideSeriesC) return true;
    const ser = slice.puzzleSeries === 'C' ? 'C' : (slice.puzzleSeries === 'B' ? 'B' : 'A');
    if (
      state.puzzleHiddenRibs &&
      state.puzzleHiddenRibs[ser] &&
      typeof slice.seriesIndex === 'number' &&
      state.puzzleHiddenRibs[ser][slice.seriesIndex]
    ) {
      return true;
    }
  }
  return Boolean(slice.hiddenInView);
}

function togglePuzzleSeriesVisibility(which) {
  if (which === 'a') {
    state.puzzleHideSeriesA = !state.puzzleHideSeriesA;
  } else if (which === 'b') {
    state.puzzleHideSeriesB = !state.puzzleHideSeriesB;
  } else if (which === 'c') {
    state.puzzleHideSeriesC = !state.puzzleHideSeriesC;
  }
  syncPuzzleSelectedRibUI();
  update3DSlicesTransforms();
  if (typeof renderSliceStripUI === 'function') renderSliceStripUI();
  if (typeof render2DSlice === 'function') render2DSlice();
}

function toggleActivePuzzleAxisVisibility() {
  const info = getSelectedPuzzleRibInfo();
  togglePuzzleSeriesVisibility(info.series === 'C' ? 'c' : (info.series === 'B' ? 'b' : 'a'));
}

function toggleSelectedPuzzleRibVisibility() {
  const info = getSelectedPuzzleRibInfo();
  if (!state.puzzleHiddenRibs) state.puzzleHiddenRibs = { A: {}, B: {}, C: {} };
  if (!state.puzzleHiddenRibs[info.series]) state.puzzleHiddenRibs[info.series] = {};
  const currentlyHidden = Boolean(state.puzzleHiddenRibs[info.series][info.seriesIndex]);
  if (currentlyHidden) {
    delete state.puzzleHiddenRibs[info.series][info.seriesIndex];
  } else {
    state.puzzleHiddenRibs[info.series][info.seriesIndex] = true;
  }
  syncPuzzleSelectedRibUI();
  update3DSlicesTransforms();
  if (typeof renderSliceStripUI === 'function') renderSliceStripUI();
  if (typeof render2DSlice === 'function') render2DSlice();
}

function showAllPuzzleRibsInView() {
  state.puzzleHideSeriesA = false;
  state.puzzleHideSeriesB = false;
  state.puzzleHideSeriesC = false;
  state.puzzleHiddenRibs = { A: {}, B: {}, C: {} };
  syncPuzzleSelectedRibUI();
  update3DSlicesTransforms();
  if (typeof renderSliceStripUI === 'function') renderSliceStripUI();
  if (typeof render2DSlice === 'function') render2DSlice();
}

function syncPuzzleSelectedRibUI() {
  const isPuzzle = state.constructionMode === 'puzzle3d';
  const inspBox = document.getElementById('inspectorPuzzleRibMoveBox');
  if (inspBox) {
    const showInsp = Boolean(isPuzzle && !state.nestingEnabled && !state.carrierEnabled);
    inspBox.classList.toggle('hidden', !showInsp);
    inspBox.classList.toggle('flex', showInsp);
  }
  const v3dBox = document.getElementById('viewer3DPuzzleVisBox');
  if (v3dBox) {
    v3dBox.classList.toggle('hidden', !isPuzzle);
    v3dBox.classList.toggle('flex', isPuzzle);
  }
  if (!isPuzzle) return;

  const cfg = getPuzzleAxesConfig();
  const info = getSelectedPuzzleRibInfo();
  const titleEl = document.getElementById('puzzleSelectedRibTitle');
  const deltaEl = document.getElementById('puzzleSelectedRibDeltaBadge');
  const sliderEl = document.getElementById('puzzleSelectedRibSlider');
  const inputEl = document.getElementById('puzzleSelectedRibCoordInput');
  const inspInputEl = document.getElementById('inspectorPuzzleRibCoordInput');

  const isCapSelected = Boolean(info.slice && info.slice.isPuzzleSolidCap);
  if (titleEl) {
    titleEl.textContent = '🎯 Costilla ' + info.ribCode + (isCapSelected ? ' + Tapa' : '') + ' (Eje ' + info.axis.toUpperCase() + ')';
  }
  if (deltaEl) {
    const sign = info.ribOffset >= 0 ? '+' : '';
    deltaEl.textContent = 'Δ ' + sign + info.ribOffset.toFixed(1) + ' mm';
  }
  if (sliderEl) {
    sliderEl.min = String(Number(info.coordInfo.absMin.toFixed(1)));
    sliderEl.max = String(Number(info.coordInfo.absMax.toFixed(1)));
    sliderEl.value = String(Number(info.actualCoord.toFixed(1)));
  }
  if (inputEl) {
    inputEl.value = info.actualCoord.toFixed(1);
  }
  if (inspInputEl) {
    inspInputEl.value = info.actualCoord.toFixed(1);
  }

  // Sincronizar botones de ocultar/mostrar Eje A y Eje B en las cabeceras de Serie A y Serie B
  const visBtnA = document.getElementById('puzzleToggleVisBtn_a');
  if (visBtnA) {
    visBtnA.textContent = state.puzzleHideSeriesA ? ('🙈 Eje ' + cfg.axisA.toUpperCase() + ' oculto') : ('👁️ Eje ' + cfg.axisA.toUpperCase());
    visBtnA.className = state.puzzleHideSeriesA
      ? 'px-1.5 h-5 flex items-center justify-center rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-[9px] leading-none transition'
      : 'px-1.5 h-5 flex items-center justify-center rounded bg-sky-500/15 hover:bg-sky-500/30 border border-sky-500/35 text-sky-300 font-semibold text-[9px] leading-none transition';
  }
  const visBtnB = document.getElementById('puzzleToggleVisBtn_b');
  if (visBtnB) {
    visBtnB.textContent = state.puzzleHideSeriesB ? ('🙈 Eje ' + cfg.axisB.toUpperCase() + ' oculto') : ('👁️ Eje ' + cfg.axisB.toUpperCase());
    visBtnB.className = state.puzzleHideSeriesB
      ? 'px-1.5 h-5 flex items-center justify-center rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-[9px] leading-none transition'
      : 'px-1.5 h-5 flex items-center justify-center rounded bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/35 text-amber-300 font-semibold text-[9px] leading-none transition';
  }
  const visBtnC = document.getElementById('puzzleToggleVisBtn_c');
  if (visBtnC && cfg.axisC) {
    visBtnC.textContent = state.puzzleHideSeriesC ? ('🙈 Eje ' + cfg.axisC.toUpperCase() + ' oculto') : ('👁️ Eje ' + cfg.axisC.toUpperCase());
    visBtnC.className = state.puzzleHideSeriesC
      ? 'px-1.5 h-5 flex items-center justify-center rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-[9px] leading-none transition'
      : 'px-1.5 h-5 flex items-center justify-center rounded bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-500/35 text-emerald-300 font-semibold text-[9px] leading-none transition';
  }

  // Sincronizar botones de ocultar/mostrar costilla seleccionada y eje activo
  const isRibIndivHidden = Boolean(
    state.puzzleHiddenRibs &&
    state.puzzleHiddenRibs[info.series] &&
    state.puzzleHiddenRibs[info.series][info.seriesIndex]
  );
  const isActiveAxisHidden = info.series === 'C'
    ? Boolean(state.puzzleHideSeriesC)
    : (info.series === 'B' ? Boolean(state.puzzleHideSeriesB) : Boolean(state.puzzleHideSeriesA));
  const hasAnyHidden = Boolean(
    state.puzzleHideSeriesA ||
    state.puzzleHideSeriesB ||
    (cfg.is3Axes && state.puzzleHideSeriesC) ||
    (state.puzzleHiddenRibs && (
      Object.keys(state.puzzleHiddenRibs.A || {}).length > 0 ||
      Object.keys(state.puzzleHiddenRibs.B || {}).length > 0 ||
      Object.keys(state.puzzleHiddenRibs.C || {}).length > 0
    ))
  );

  const btnRibVis = document.getElementById('puzzleToggleSelectedRibVisBtn');
  if (btnRibVis) {
    btnRibVis.textContent = isRibIndivHidden ? ('🙈 Mostrar ' + info.ribCode) : ('👁️ Ocultar ' + info.ribCode);
    btnRibVis.className = isRibIndivHidden
      ? 'flex-1 py-1 px-1.5 rounded border border-rose-500/50 bg-rose-500/20 hover:bg-rose-500/30 text-[9px] font-bold text-rose-300 transition truncate'
      : 'flex-1 py-1 px-1.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[9px] font-semibold text-slate-200 transition truncate';
  }

  const btnAxisVis = document.getElementById('puzzleToggleActiveAxisVisBtn');
  if (btnAxisVis) {
    const axName = info.axis.toUpperCase();
    btnAxisVis.textContent = isActiveAxisHidden ? ('🙈 Mostrar Eje ' + axName) : ('👁️ Ocultar Eje ' + axName);
    btnAxisVis.className = isActiveAxisHidden
      ? 'flex-1 py-1 px-1.5 rounded border border-rose-500/50 bg-rose-500/20 hover:bg-rose-500/30 text-[9px] font-bold text-rose-300 transition truncate'
      : 'flex-1 py-1 px-1.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[9px] font-semibold text-slate-200 transition truncate';
  }

  const btnShowAll = document.getElementById('puzzleShowAllVisBtn');
  if (btnShowAll) {
    btnShowAll.classList.toggle('hidden', !hasAnyHidden);
  }

  const inspBtnRib = document.getElementById('inspToggleSelectedRibVisBtn');
  if (inspBtnRib) {
    inspBtnRib.textContent = isRibIndivHidden ? ('🙈 ' + info.ribCode) : ('👁️ ' + info.ribCode);
    inspBtnRib.className = isRibIndivHidden
      ? 'px-1.5 py-0 rounded bg-rose-500/25 hover:bg-rose-500/35 border border-rose-500/50 text-[9px] text-rose-300 font-bold'
      : 'px-1.5 py-0 rounded bg-slate-900 hover:bg-slate-700 border border-slate-700 text-[9px] text-slate-200 font-medium';
  }

  const inspBtnAxis = document.getElementById('inspToggleActiveAxisVisBtn');
  if (inspBtnAxis) {
    const axName = info.axis.toUpperCase();
    inspBtnAxis.textContent = isActiveAxisHidden ? ('🙈 Eje ' + axName) : ('👁️ Eje ' + axName);
    inspBtnAxis.className = isActiveAxisHidden
      ? 'px-1.5 py-0 rounded bg-rose-500/25 hover:bg-rose-500/35 border border-rose-500/50 text-[9px] text-rose-300 font-bold'
      : 'px-1.5 py-0 rounded bg-slate-900 hover:bg-slate-700 border border-slate-700 text-[9px] text-slate-200 font-medium';
  }

  const inspBtnSimp = document.getElementById('inspTogglePuzzleSimplifyBtn');
  if (inspBtnSimp) {
    inspBtnSimp.textContent = state.puzzleSimplifyCutLine
      ? ('✂️ Corte Simplificado (' + Number(state.puzzleSimplifyToleranceMM || 1.5).toFixed(1) + 'mm)')
      : '✂️ Simplificar Corte';
    inspBtnSimp.className = state.puzzleSimplifyCutLine
      ? 'px-1.5 py-0 rounded bg-cyan-500/25 hover:bg-cyan-500/35 border border-cyan-500/50 text-[9px] text-cyan-300 font-bold transition'
      : 'px-1.5 py-0 rounded bg-slate-900 hover:bg-slate-700 border border-slate-700 text-[9px] text-slate-300 font-medium transition';
  }

  // Sincronizar barra flotante en la esquina superior derecha del Visor 3D
  const v3dBtnA = document.getElementById('viewer3DVisBtn_a');
  if (v3dBtnA) {
    v3dBtnA.textContent = state.puzzleHideSeriesA ? ('🙈 Eje ' + cfg.axisA.toUpperCase()) : ('👁️ Eje ' + cfg.axisA.toUpperCase());
    v3dBtnA.className = state.puzzleHideSeriesA
      ? 'px-1.5 py-0.5 rounded bg-rose-500/25 hover:bg-rose-500/35 border border-rose-500/50 text-[10px] font-bold text-rose-300 transition'
      : 'px-1.5 py-0.5 rounded bg-sky-500/15 hover:bg-sky-500/30 border border-sky-500/35 text-[10px] font-semibold text-sky-300 transition';
  }
  const v3dBtnB = document.getElementById('viewer3DVisBtn_b');
  if (v3dBtnB) {
    v3dBtnB.textContent = state.puzzleHideSeriesB ? ('🙈 Eje ' + cfg.axisB.toUpperCase()) : ('👁️ Eje ' + cfg.axisB.toUpperCase());
    v3dBtnB.className = state.puzzleHideSeriesB
      ? 'px-1.5 py-0.5 rounded bg-rose-500/25 hover:bg-rose-500/35 border border-rose-500/50 text-[10px] font-bold text-rose-300 transition'
      : 'px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/35 text-[10px] font-semibold text-amber-300 transition';
  }
  const v3dBtnC = document.getElementById('viewer3DVisBtn_c');
  if (v3dBtnC) {
    v3dBtnC.classList.toggle('hidden', !cfg.is3Axes);
    if (cfg.is3Axes && cfg.axisC) {
      v3dBtnC.textContent = state.puzzleHideSeriesC ? ('🙈 Eje ' + cfg.axisC.toUpperCase()) : ('👁️ Eje ' + cfg.axisC.toUpperCase());
      v3dBtnC.className = state.puzzleHideSeriesC
        ? 'px-1.5 py-0.5 rounded bg-rose-500/25 hover:bg-rose-500/35 border border-rose-500/50 text-[10px] font-bold text-rose-300 transition'
        : 'px-1.5 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-500/35 text-[10px] font-semibold text-emerald-300 transition';
    }
  }
  const v3dBtnRib = document.getElementById('viewer3DVisBtn_rib');
  if (v3dBtnRib) {
    v3dBtnRib.textContent = isRibIndivHidden ? ('🙈 ' + info.ribCode) : ('👁️ ' + info.ribCode);
    v3dBtnRib.className = isRibIndivHidden
      ? 'px-1.5 py-0.5 rounded bg-rose-500/25 hover:bg-rose-500/35 border border-rose-500/50 text-[10px] font-bold text-rose-300 transition'
      : 'px-1.5 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-500/35 text-[10px] font-semibold text-emerald-300 transition';
  }
  const v3dBtnAll = document.getElementById('viewer3DVisBtn_all');
  if (v3dBtnAll) {
    v3dBtnAll.classList.toggle('hidden', !hasAnyHidden);
  }

  // Sincronizar botón individual de costilla autosustentante (en panel lateral e inspector 2D)
  const activeSlice = state.slices && state.slices[state.activeSliceIndex] ? state.slices[state.activeSliceIndex] : null;
  const countInSer = info.series === 'C' ? (state.puzzleCountC || 4) : (info.series === 'B' ? state.puzzleCountB : state.puzzleCountA);
  const isRibSelfSup = activeSlice
    ? isPuzzleRibSelfSupporting(activeSlice, countInSer)
    : isPuzzleRibSelfSupporting({ puzzleSeries: info.series, seriesIndex: info.seriesIndex, sliceAxis: info.axis }, countInSer);
  const isHorizontalRib = info.axis === 'z';

  const btnRibSelfSup = document.getElementById('puzzleToggleSelectedRibSelfSupBtn');
  if (btnRibSelfSup) {
    btnRibSelfSup.classList.toggle('hidden', isHorizontalRib);
    if (!isHorizontalRib) {
      btnRibSelfSup.textContent = isRibSelfSup
        ? ('🧲 ' + info.ribCode + ' Autosustentante (Flotante)')
        : ('⚓ ' + info.ribCode + ' Apoyada en el suelo');
      btnRibSelfSup.className = isRibSelfSup
        ? 'w-full py-1 px-1.5 rounded border border-emerald-500/60 bg-emerald-500/20 hover:bg-emerald-500/30 text-[9px] font-bold text-emerald-300 transition truncate'
        : 'w-full py-1 px-1.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[9px] font-semibold text-slate-300 transition truncate';
    }
  }

  const inspBtnSelfSup = document.getElementById('inspToggleRibSelfSupBtn');
  if (inspBtnSelfSup) {
    inspBtnSelfSup.classList.toggle('hidden', isHorizontalRib);
    if (!isHorizontalRib) {
      inspBtnSelfSup.textContent = isRibSelfSup
        ? ('🧲 ' + info.ribCode + ' Autosustentante')
        : ('⚓ ' + info.ribCode + ' Al suelo');
      inspBtnSelfSup.className = isRibSelfSup
        ? 'px-1.5 py-0 rounded bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-500/50 text-[9px] text-emerald-300 font-bold transition'
        : 'px-1.5 py-0 rounded bg-slate-900 hover:bg-slate-700 border border-slate-700 text-[9px] text-slate-300 font-medium transition';
    }
  }

  const v3dSelfSupBtn = document.getElementById('viewer3DSelfSupBtn');
  if (v3dSelfSupBtn) {
    v3dSelfSupBtn.classList.toggle('hidden', isHorizontalRib);
    if (!isHorizontalRib) {
      v3dSelfSupBtn.textContent = isRibSelfSup
        ? ('🧲 ' + info.ribCode + ' Flotante')
        : ('⚓ ' + info.ribCode + ' Al suelo');
      v3dSelfSupBtn.className = isRibSelfSup
        ? 'px-1.5 py-0.5 rounded bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-500/50 text-[10px] font-bold text-emerald-300 transition'
        : 'px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[10px] font-semibold text-slate-200 transition';
    }
  }
}

function hasAnyPuzzleSelfSupportingRib() {
  if (state.puzzleSelfSupporting) return true;
  const map = state.puzzleSelfSupportRibs;
  if (!map) return false;
  for (const ser of ['A', 'B', 'C']) {
    const sub = map[ser];
    if (sub) {
      for (const k in sub) {
        if (sub[k] === true) return true;
      }
    }
  }
  return false;
}

function isPuzzleRibSelfSupporting(slice, countInSeries) {
  if (!slice || slice.isPuzzleSolidCap) return false;
  if (slice.sliceAxis === 'z') return false; // Las plantas horizontales en Z ya flotan a su cota Z
  const ser = slice.puzzleSeries || 'A';
  const idx = typeof slice.seriesIndex === 'number' ? slice.seriesIndex : 0;
  const total = countInSeries || (ser === 'B' ? state.puzzleCountB : (ser === 'C' ? state.puzzleCountC : state.puzzleCountA)) || 2;

  if (state.puzzleSelfSupportRibs && state.puzzleSelfSupportRibs[ser] && typeof state.puzzleSelfSupportRibs[ser][idx] === 'boolean') {
    return state.puzzleSelfSupportRibs[ser][idx];
  }
  if (!state.puzzleSelfSupporting) return false;

  const target = state.puzzleSelfSupportTarget || 'outer';
  if (target === 'all') return true;
  if (target === 'series_b') return ser === 'B';
  if (target === 'series_a') return ser === 'A';
  if (target === 'outer') {
    if (total <= 2) return idx === total - 1;
    const margin = total >= 6 ? Math.max(1, Math.floor(total * 0.25)) : 1;
    return idx < margin || idx >= total - margin;
  }
  return false;
}

function toggleSelectedPuzzleRibSelfSupporting() {
  const info = getSelectedPuzzleRibInfo();
  if (info.axis === 'z') return;
  if (!state.puzzleSelfSupportRibs) {
    state.puzzleSelfSupportRibs = { A: {}, B: {}, C: {} };
  }
  if (!state.puzzleSelfSupportRibs[info.series]) {
    state.puzzleSelfSupportRibs[info.series] = {};
  }
  const countInSer = info.series === 'C' ? (state.puzzleCountC || 4) : (info.series === 'B' ? state.puzzleCountB : state.puzzleCountA);
  const currentVal = isPuzzleRibSelfSupporting({
    puzzleSeries: info.series,
    seriesIndex: info.seriesIndex,
    sliceAxis: info.axis
  }, countInSer);
  state.puzzleSelfSupportRibs[info.series][info.seriesIndex] = !currentVal;

  if (state.constructionMode === 'puzzle3d') {
    rebuildGhostAndSlices();
  }
  syncConstructionModeUI();
}

function setPuzzleSelfSupporting(enabled) {
  state.puzzleSelfSupporting = Boolean(enabled);
  if (state.constructionMode === 'puzzle3d') {
    rebuildGhostAndSlices();
  } else {
    syncConstructionModeUI();
  }
}

function setPuzzleSelfSupportTarget(target) {
  state.puzzleSelfSupportTarget = target || 'outer';
  state.puzzleSelfSupporting = true;
  // Limpiar overrides manuales para que el objetivo grupal se aplique limpiamente
  state.puzzleSelfSupportRibs = { A: {}, B: {}, C: {} };
  if (state.constructionMode === 'puzzle3d') {
    rebuildGhostAndSlices();
  } else {
    syncConstructionModeUI();
  }
}

function onPuzzleSelfSupportParamsChange() {
  const styleEl = document.getElementById('puzzleSelfSupportStyleSelect');
  const clearEl = document.getElementById('puzzleSelfSupportClearanceInput');
  const dropEl = document.getElementById('puzzleDropUnconnectedCheck');
  if (styleEl && styleEl.value) {
    state.puzzleSelfSupportStyle = styleEl.value;
  }
  if (clearEl) {
    const val = parseFloat(clearEl.value);
    if (Number.isFinite(val) && val >= 0) {
      state.puzzleSelfSupportClearanceMM = Math.max(0, Math.min(250, Number(val.toFixed(1))));
    }
  }
  if (dropEl) {
    state.puzzleDropUnconnectedIslands = Boolean(dropEl.checked);
  }
  if (state.constructionMode === 'puzzle3d') {
    rebuildGhostAndSlices();
  } else {
    syncConstructionModeUI();
  }
}

function onPuzzleSelfSupportClearanceInput(val) {
  const parsed = parseFloat(val);
  if (!Number.isFinite(parsed) || parsed < 0) return;
  state.puzzleSelfSupportClearanceMM = Math.max(0, Math.min(250, Number(parsed.toFixed(1))));
  if (!state.puzzleSelfSupporting && !hasAnyPuzzleSelfSupportingRib()) {
    state.puzzleSelfSupporting = true;
  }
  if (state.constructionMode === 'puzzle3d') {
    rebuildGhostAndSlices();
  } else {
    syncConstructionModeUI();
  }
}

function stepPuzzleSelfSupportClearance(deltaMM) {
  const cur = Number(state.puzzleSelfSupportClearanceMM) || 22.0;
  const spanZ = (state.dimsMM && state.dimsMM.z) ? state.dimsMM.z : 100;
  const next = Math.max(2, Math.min(Math.round(spanZ * 0.8), Number((cur + (Number(deltaMM) || 0)).toFixed(1))));
  state.puzzleSelfSupportClearanceMM = next;
  if (!state.puzzleSelfSupporting && !hasAnyPuzzleSelfSupportingRib()) {
    state.puzzleSelfSupporting = true;
  }
  if (state.constructionMode === 'puzzle3d') {
    rebuildGhostAndSlices();
  } else {
    syncConstructionModeUI();
  }
}

function setPuzzleSelfSupportPreset(target, style, clearanceRatioOrMM) {
  state.puzzleSelfSupporting = true;
  if (target) {
    state.puzzleSelfSupportTarget = target;
    state.puzzleSelfSupportRibs = { A: {}, B: {}, C: {} };
  }
  if (style) {
    state.puzzleSelfSupportStyle = style;
  }
  if (typeof clearanceRatioOrMM === 'number' && clearanceRatioOrMM > 0) {
    const spanZ = (state.dimsMM && state.dimsMM.z) ? state.dimsMM.z : 100;
    const mm = clearanceRatioOrMM <= 1.0
      ? Math.max(8, Math.round(spanZ * clearanceRatioOrMM))
      : clearanceRatioOrMM;
    state.puzzleSelfSupportClearanceMM = mm;
  }
  if (state.constructionMode === 'puzzle3d') {
    rebuildGhostAndSlices();
  } else {
    syncConstructionModeUI();
  }
}

function resetAllPuzzleSelfSupportRibs() {
  state.puzzleSelfSupportRibs = { A: {}, B: {}, C: {} };
  state.puzzleSelfSupporting = false;
  if (state.constructionMode === 'puzzle3d') {
    rebuildGhostAndSlices();
  } else {
    syncConstructionModeUI();
  }
}

function onSelectedPuzzleRibCoordChange(val) {
  const parsed = parseFloat(val);
  if (!Number.isFinite(parsed)) return;
  const info = getSelectedPuzzleRibInfo();
  const clampedCoord = Math.max(info.coordInfo.absMin, Math.min(info.coordInfo.absMax, parsed));
  const newDelta = Number((clampedCoord - info.baseCoord).toFixed(2));

  if (info.series === 'A') {
    if (!state.puzzleRibOffsetsAMM) state.puzzleRibOffsetsAMM = {};
    state.puzzleRibOffsetsAMM[info.seriesIndex] = newDelta;
  } else if (info.series === 'C') {
    if (!state.puzzleRibOffsetsCMM) state.puzzleRibOffsetsCMM = {};
    state.puzzleRibOffsetsCMM[info.seriesIndex] = newDelta;
  } else {
    if (!state.puzzleRibOffsetsBMM) state.puzzleRibOffsetsBMM = {};
    state.puzzleRibOffsetsBMM[info.seriesIndex] = newDelta;
  }

  if (state.constructionMode === 'puzzle3d') {
    rebuildGhostAndSlices();
  }
  syncPuzzleSelectedRibUI();
  if (typeof syncSidebarTabsUI === 'function') syncSidebarTabsUI();
}

function stepSelectedPuzzleRib(deltaMM) {
  const info = getSelectedPuzzleRibInfo();
  const stepVal = Number(deltaMM) || 0;
  onSelectedPuzzleRibCoordChange(info.actualCoord + stepVal);
}

function resetSelectedPuzzleRibOffset() {
  const info = getSelectedPuzzleRibInfo();
  if (info.series === 'A' && state.puzzleRibOffsetsAMM) {
    delete state.puzzleRibOffsetsAMM[info.seriesIndex];
  } else if (info.series === 'C' && state.puzzleRibOffsetsCMM) {
    delete state.puzzleRibOffsetsCMM[info.seriesIndex];
  } else if (info.series === 'B' && state.puzzleRibOffsetsBMM) {
    delete state.puzzleRibOffsetsBMM[info.seriesIndex];
  }
  if (state.constructionMode === 'puzzle3d') {
    rebuildGhostAndSlices();
  }
  syncPuzzleSelectedRibUI();
  if (typeof syncSidebarTabsUI === 'function') syncSidebarTabsUI();
}

function resetAllPuzzleRibOffsets() {
  state.puzzleRibOffsetsAMM = {};
  state.puzzleRibOffsetsBMM = {};
  state.puzzleRibOffsetsCMM = {};
  if (state.constructionMode === 'puzzle3d') {
    rebuildGhostAndSlices();
  }
  syncPuzzleSelectedRibUI();
  if (typeof syncSidebarTabsUI === 'function') syncSidebarTabsUI();
}

function onPuzzleStartOffsetChange(which, val) {
  const parsed = parseFloat(val);
  if (!Number.isFinite(parsed)) return;
  const cfg = getPuzzleAxesConfig();
  const ax = which === 'a' ? cfg.axisA : cfg.axisB;
  const span = Math.max(1, (state.dimsMM && state.dimsMM[ax]) || 100);
  const clamped = Math.max(-span * 0.85, Math.min(span * 0.85, Number(parsed.toFixed(2))));

  if (which === 'a') {
    state.puzzleStartOffsetAMM = clamped;
  } else {
    state.puzzleStartOffsetBMM = clamped;
  }
  syncConstructionModeUI();
  if (state.constructionMode === 'puzzle3d') {
    rebuildGhostAndSlices();
  }
}

function setPuzzleStartAtEdge(which) {
  const cfg = getPuzzleAxesConfig();
  const ax = which === 'a' ? cfg.axisA : cfg.axisB;
  const count = which === 'a' ? state.puzzleCountA : state.puzzleCountB;
  const span = Math.max(1, (state.dimsMM && state.dimsMM[ax]) || 100);
  const res = computePuzzleAxisSliceCoords(span, count, 0, state.puzzleStartMode);
  if (which === 'a') {
    state.puzzleStartOffsetAMM = res.edgeOffsetMM;
  } else {
    state.puzzleStartOffsetBMM = res.edgeOffsetMM;
  }
  syncConstructionModeUI();
  if (state.constructionMode === 'puzzle3d') {
    rebuildGhostAndSlices();
  }
}

function resetPuzzleStartOffset(which) {
  if (which === 'a') {
    state.puzzleStartOffsetAMM = 0;
  } else if (which === 'b') {
    state.puzzleStartOffsetBMM = 0;
  } else {
    state.puzzleStartOffsetAMM = 0;
    state.puzzleStartOffsetBMM = 0;
  }
  syncConstructionModeUI();
  if (state.constructionMode === 'puzzle3d') {
    rebuildGhostAndSlices();
  }
}

function setPuzzleStartMode(mode) {
  if (mode === 'start' || mode === 'symmetric' || mode === 'shift') {
    state.puzzleStartMode = mode;
  }
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
    const is3Ax = state.puzzleAxes === 'xyz';
    badge.textContent = isPuzzle ? (is3Ax ? 'Puzzle 3D (3 Ejes)' : 'Puzzle 3D (2 Ejes)') : 'Apilado 1 Eje';
    badge.className = isPuzzle
      ? 'text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
      : 'text-[9px] px-1.5 py-1 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold';
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

  ['xy', 'xz', 'yz', 'xyz'].forEach((pair) => {
    const b = document.getElementById('puzzleAxesBtn_' + pair);
    if (!b) return;
    b.className = state.puzzleAxes === pair
      ? 'py-1 px-1.5 rounded border border-amber-500 bg-amber-500/20 text-[10px] font-bold text-amber-300 transition'
      : 'py-1 px-1.5 rounded border border-slate-700 bg-slate-950 text-[10px] font-semibold text-slate-300 hover:bg-slate-800 transition';
  });

  const autoScoreEl = document.getElementById('puzzleAxesAutoScoreBadge');
  if (autoScoreEl) {
    const sc = state.puzzleAxesAutoScores;
    if (sc && sc.xy && sc.xz && sc.yz) {
      const fmt = (k, lbl) => {
        const val = sc[k] ? sc[k].totalScore.toFixed(1) : '0.0';
        return sc.bestPair === k ? `<strong>${lbl}: ${val}★</strong>` : `${lbl}: ${val}`;
      };
      autoScoreEl.innerHTML = `Índice Estructural → ${fmt('xy', 'X×Y')} · ${fmt('xz', 'X×Z')} · ${fmt('yz', 'Y×Z')}`;
      autoScoreEl.classList.remove('hidden');
    } else {
      autoScoreEl.classList.add('hidden');
    }
  }

  const cfg = getPuzzleAxesConfig();
  const lblA = document.getElementById('puzzleAxisALabel');
  const lblB = document.getElementById('puzzleAxisBLabel');
  const lblC = document.getElementById('puzzleAxisCLabel');
  const boxC = document.getElementById('puzzleSeriesCBox');
  if (lblA) lblA.textContent = 'Costillas Serie A (Eje ' + cfg.axisA.toUpperCase() + ' · Ranura ⊔):';
  if (lblB) lblB.textContent = 'Costillas Serie B (Eje ' + cfg.axisB.toUpperCase() + ' · Ranura ⊓):';
  if (lblC && cfg.axisC) lblC.textContent = 'Costillas Serie C (Eje ' + cfg.axisC.toUpperCase() + ' · Plantas ⊞):';
  if (boxC) boxC.classList.toggle('hidden', !cfg.is3Axes);

  const sA = document.getElementById('puzzleCountASlider');
  const sB = document.getElementById('puzzleCountBSlider');
  const sC = document.getElementById('puzzleCountCSlider');
  const inA = document.getElementById('puzzleCountAInput');
  const inB = document.getElementById('puzzleCountBInput');
  const inC = document.getElementById('puzzleCountCInput');
  const cA = document.getElementById('puzzleCountALabel');
  const cB = document.getElementById('puzzleCountBLabel');
  const cC = document.getElementById('puzzleCountCLabel');
  if (sA) sA.value = state.puzzleCountA;
  if (sB) sB.value = state.puzzleCountB;
  if (sC) sC.value = state.puzzleCountC || 4;
  if (inA) inA.value = state.puzzleCountA;
  if (inB) inB.value = state.puzzleCountB;
  if (inC) inC.value = state.puzzleCountC || 4;
  if (cA) cA.textContent = state.puzzleCountA;
  if (cB) cB.textContent = state.puzzleCountB;
  if (cC) cC.textContent = state.puzzleCountC || 4;

  const spanA = Math.max(10, (state.dimsMM && state.dimsMM[cfg.axisA]) || 100);
  const spanB = Math.max(10, (state.dimsMM && state.dimsMM[cfg.axisB]) || 100);
  const coordInfoA = computePuzzleAxisSliceCoords(spanA, state.puzzleCountA, state.puzzleStartOffsetAMM, state.puzzleStartMode, state.puzzleRibOffsetsAMM);
  const coordInfoB = computePuzzleAxisSliceCoords(spanB, state.puzzleCountB, state.puzzleStartOffsetBMM, state.puzzleStartMode, state.puzzleRibOffsetsBMM);

  const stLblA = document.getElementById('puzzleStartALabel');
  const stLblB = document.getElementById('puzzleStartBLabel');
  if (stLblA) stLblA.textContent = 'Comienzo laminado Eje ' + cfg.axisA.toUpperCase() + ':';
  if (stLblB) stLblB.textContent = 'Comienzo laminado Eje ' + cfg.axisB.toUpperCase() + ':';

  const stBadgeA = document.getElementById('puzzleStartACoordBadge');
  const stBadgeB = document.getElementById('puzzleStartBCoordBadge');
  if (stBadgeA) {
    stBadgeA.textContent = '1.ª: ' + coordInfoA.firstCoord.toFixed(1) + ' mm · Últ: ' + coordInfoA.lastCoord.toFixed(1) + ' mm';
  }
  if (stBadgeB) {
    stBadgeB.textContent = '1.ª: ' + coordInfoB.firstCoord.toFixed(1) + ' mm · Últ: ' + coordInfoB.lastCoord.toFixed(1) + ' mm';
  }

  const stSliderA = document.getElementById('puzzleStartASlider');
  const stSliderB = document.getElementById('puzzleStartBSlider');
  const stInputA = document.getElementById('puzzleStartAInput');
  const stInputB = document.getElementById('puzzleStartBInput');
  if (stSliderA) {
    stSliderA.min = String(Math.floor(coordInfoA.edgeOffsetMM - 2));
    stSliderA.max = String(Math.ceil(spanA * 0.65));
    stSliderA.value = String(state.puzzleStartOffsetAMM || 0);
  }
  if (stSliderB) {
    stSliderB.min = String(Math.floor(coordInfoB.edgeOffsetMM - 2));
    stSliderB.max = String(Math.ceil(spanB * 0.65));
    stSliderB.value = String(state.puzzleStartOffsetBMM || 0);
  }
  if (stInputA) stInputA.value = Number(state.puzzleStartOffsetAMM || 0).toFixed(1);
  if (stInputB) stInputB.value = Number(state.puzzleStartOffsetBMM || 0).toFixed(1);

  ['start', 'symmetric', 'shift'].forEach((m) => {
    const mBtn = document.getElementById('puzzleStartModeBtn_' + m);
    if (!mBtn) return;
    mBtn.className = (state.puzzleStartMode || 'start') === m
      ? 'py-1 px-1 rounded border border-amber-500 bg-amber-500/20 text-[9px] font-bold text-amber-300 transition'
      : 'py-1 px-1 rounded border border-slate-700 bg-slate-950 text-[9px] font-semibold text-slate-300 hover:bg-slate-800 transition';
  });

  const thEl = document.getElementById('puzzleThicknessInput');
  const clEl = document.getElementById('puzzleClearanceInput');
  if (thEl) thEl.value = state.puzzleMaterialThicknessMM;
  if (clEl) clEl.value = state.puzzleSlotClearanceMM;

  // Sincronizar controles de simplificación de la línea de corte en Puzzle 3D
  const simpChk = document.getElementById('puzzleSimplifyCutCheck');
  if (simpChk) simpChk.checked = Boolean(state.puzzleSimplifyCutLine);

  const simpBox = document.getElementById('puzzleSimplifyCutBox');
  if (simpBox) {
    simpBox.classList.toggle('hidden', !state.puzzleSimplifyCutLine);
    simpBox.classList.toggle('opacity-45', !state.puzzleSimplifyCutLine);
  }

  const simpModeSel = document.getElementById('puzzleSimplifyModeSelect');
  if (simpModeSel) simpModeSel.value = state.puzzleSimplifyMode || 'rdp';

  const simpTolSlider = document.getElementById('puzzleSimplifyTolSlider');
  const simpTolInput = document.getElementById('puzzleSimplifyTolInput');
  const tolVal = Number(state.puzzleSimplifyToleranceMM || 1.5);
  if (simpTolSlider) simpTolSlider.value = String(tolVal);
  if (simpTolInput) simpTolInput.value = tolVal.toFixed(1);

  const simpStatsBadge = document.getElementById('puzzleSimplifyStatsBadge');
  if (simpStatsBadge) {
    const rawV = state.puzzleRawVerticesCount || 0;
    const simpV = state.puzzleSimplifiedVerticesCount || 0;
    if (!state.puzzleSimplifyCutLine) {
      simpStatsBadge.className = 'text-[9px] text-slate-400 text-center pt-0.5';
      simpStatsBadge.textContent = 'Desactivado (' + rawV + ' vértices originales en costillas)';
    } else if (rawV > 0) {
      const savedPct = Math.max(0, Math.round((1 - simpV / rawV) * 100));
      simpStatsBadge.className = 'text-[9px] text-cyan-300 font-semibold text-center pt-0.5';
      simpStatsBadge.textContent = '✂️ ' + rawV + ' → ' + simpV + ' vértices (−' + savedPct + '%) · Ranuras intactas';
    } else {
      simpStatsBadge.className = 'text-[9px] text-cyan-300 text-center pt-0.5';
      simpStatsBadge.textContent = '✂️ Línea de corte simplificada (tol. ' + tolVal.toFixed(1) + ' mm)';
    }
  }

  // Sincronizar controles de Costilla Autosustentante (sin bajar al suelo)
  const anySelfSup = hasAnyPuzzleSelfSupportingRib();
  const selfSupChk = document.getElementById('puzzleSelfSupportingCheck');
  if (selfSupChk) selfSupChk.checked = Boolean(state.puzzleSelfSupporting || anySelfSup);

  const selfSupBox = document.getElementById('puzzleSelfSupportBox');
  if (selfSupBox) {
    selfSupBox.classList.toggle('hidden', !anySelfSup);
    selfSupBox.classList.toggle('opacity-45', !anySelfSup);
  }

  ['outer', 'series_b', 'series_a', 'all'].forEach((tKey) => {
    const tBtn = document.getElementById('puzzleSelfSupTargetBtn_' + tKey);
    if (!tBtn) return;
    if (tKey === 'series_b') {
      tBtn.textContent = 'Serie B (' + cfg.axisB.toUpperCase() + ')';
    } else if (tKey === 'series_a') {
      tBtn.textContent = 'Serie A (' + cfg.axisA.toUpperCase() + ')';
    }
    const isSelected = state.puzzleSelfSupporting && (state.puzzleSelfSupportTarget || 'outer') === tKey;
    tBtn.className = isSelected
      ? 'py-1 px-1.5 rounded border border-emerald-500 bg-emerald-500/20 text-[9px] font-bold text-emerald-300 transition'
      : 'py-1 px-1.5 rounded border border-slate-700 bg-slate-950 text-[9px] font-semibold text-slate-300 hover:bg-slate-800 transition';
  });

  const selfSupStyleSel = document.getElementById('puzzleSelfSupportStyleSelect');
  if (selfSupStyleSel) selfSupStyleSel.value = state.puzzleSelfSupportStyle || 'trim_union';

  const spanZ = Math.max(15, (state.dimsMM && state.dimsMM.z) ? state.dimsMM.z : 100);
  const clearVal = Number(state.puzzleSelfSupportClearanceMM || 22.0);
  const selfSupClearSlider = document.getElementById('puzzleSelfSupportClearanceSlider');
  const selfSupClearInput = document.getElementById('puzzleSelfSupportClearanceInput');
  if (selfSupClearSlider) {
    selfSupClearSlider.max = String(Math.max(30, Math.round(spanZ * 0.78)));
    selfSupClearSlider.value = String(clearVal);
  }
  if (selfSupClearInput) selfSupClearInput.value = clearVal.toFixed(1);

  const dropIslandsChk = document.getElementById('puzzleDropUnconnectedCheck');
  if (dropIslandsChk) dropIslandsChk.checked = state.puzzleDropUnconnectedIslands !== false;

  const selfSupStats = document.getElementById('puzzleSelfSupportStatsBadge');
  if (selfSupStats) {
    const floatCnt = state.puzzleSelfSupportCount || 0;
    if (!anySelfSup) {
      selfSupStats.className = 'text-[9px] text-slate-400 text-center pt-0.5';
      selfSupStats.textContent = 'Desactivado (todas las costillas apoyan desde el suelo)';
    } else if (floatCnt > 0) {
      selfSupStats.className = 'text-[9px] text-emerald-300 font-semibold text-center pt-0.5';
      selfSupStats.textContent = '🧲 ' + floatCnt + (floatCnt === 1 ? ' costilla elevada' : ' costillas elevadas') + ' sobre el suelo · Sujetas por la unión';
    } else {
      selfSupStats.className = 'text-[9px] text-emerald-300/80 text-center pt-0.5';
      selfSupStats.textContent = '🧲 Modo autosustentante activo (sin pedestal forzado al suelo)';
    }
  }

  const slotW = Math.max(0.4, state.puzzleMaterialThicknessMM + state.puzzleSlotClearanceMM);
  const sumBadge = document.getElementById('puzzleSummaryBadge');
  if (sumBadge) {
    const countC = cfg.is3Axes ? (state.puzzleCountC || 4) : 0;
    const totalRibs = state.puzzleCountA + state.puzzleCountB + countC;
    const breakdown = cfg.is3Axes
      ? (state.puzzleCountA + ' ' + cfg.axisA.toUpperCase() + ' + ' + state.puzzleCountB + ' ' + cfg.axisB.toUpperCase() + ' + ' + countC + ' ' + cfg.axisC.toUpperCase())
      : (state.puzzleCountA + ' ' + cfg.axisA.toUpperCase() + ' + ' + state.puzzleCountB + ' ' + cfg.axisB.toUpperCase());
    sumBadge.innerHTML =
      'Ancho ranura: <strong>' + slotW.toFixed(2) + ' mm</strong> · ' +
      totalRibs + ' costillas (' + breakdown + ')' +
      (state.puzzleTotalSlotsCount > 0 ? (' · <strong>' + state.puzzleTotalSlotsCount + ' encajes</strong>') : '') +
      ((state.puzzleSelfSupportCount || 0) > 0 ? (' · <strong>🧲 ' + state.puzzleSelfSupportCount + ' autosustentantes</strong>') : '') +
      (state.puzzleSimplifyCutLine ? ' · <strong>✂️ Corte simplificado</strong>' : '');
  }
  syncPuzzleSelectedRibUI();
  if (typeof syncSidebarTabsUI === 'function') syncSidebarTabsUI();
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

// Devuelve únicamente las siluetas exteriores con relleno 100% completo (sin huecos internos), ideal para tapas exteriores de grabado
function getFullFilledSolidLoops(loops) {
  if (!loops || loops.length === 0) return [];
  const outers = loops
    .filter((l) => !l.isHole && l.points && l.points.length >= 3)
    .slice()
    .sort((a, b) => (b.absArea || 0) - (a.absArea || 0));

  const solidOuters = [];
  outers.forEach((outer) => {
    const absorbedByParent = solidOuters.some((parent) =>
      (parent.absArea || 0) > (outer.absArea || 0) && isPointInPolygon(outer.points[0], parent.points)
    );
    if (!absorbedByParent) {
      solidOuters.push({
        points: outer.points.map((p) => ({ x: p.x, y: p.y })),
        absArea: outer.absArea,
        signedArea: outer.signedArea,
        isHole: false
      });
    }
  });
  return solidOuters;
}

// =========================================================================
// SIMPLIFICACIÓN DE LA LÍNEA DE CORTE EN EL MODO PUZZLE 3D
// =========================================================================

// Distancia perpendicular al cuadrado desde el punto p al segmento ab
function pointToSegmentDistSqPuzzle2D(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-12) {
    const ex = p.x - a.x;
    const ey = p.y - a.y;
    return ex * ex + ey * ey;
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  const ox = p.x - projX;
  const oy = p.y - projY;
  return ox * ox + oy * oy;
}

// Simplificación Ramer-Douglas-Peucker sobre una cadena abierta de puntos 2D
function rdpSimplifyOpenChainPuzzle2D(chain, epsSq) {
  if (!chain || chain.length <= 2) return chain ? chain.slice() : [];
  let maxDistSq = 0;
  let maxIdx = -1;
  const first = chain[0];
  const last = chain[chain.length - 1];

  for (let i = 1; i < chain.length - 1; i++) {
    const dSq = pointToSegmentDistSqPuzzle2D(chain[i], first, last);
    if (dSq > maxDistSq) {
      maxDistSq = dSq;
      maxIdx = i;
    }
  }

  if (maxDistSq > epsSq && maxIdx !== -1) {
    const left = rdpSimplifyOpenChainPuzzle2D(chain.slice(0, maxIdx + 1), epsSq);
    const right = rdpSimplifyOpenChainPuzzle2D(chain.slice(maxIdx), epsSq);
    return left.slice(0, left.length - 1).concat(right);
  }
  return [first, last];
}

// Elimina vértices duplicados consecutivos y vértices colineales intermedios preservando esquinas de 90° (como las ranuras)
function cleanCollinearVerticesInPolygon2D(pts, colTolMM = 1e-3) {
  if (!pts || pts.length < 3) return pts ? pts.slice() : [];
  const minDistSq = 1e-6;
  const dedup = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const prev = dedup.length > 0 ? dedup[dedup.length - 1] : pts[pts.length - 1];
    const dx = p.x - prev.x;
    const dy = p.y - prev.y;
    if (dx * dx + dy * dy > minDistSq) {
      dedup.push({ x: p.x, y: p.y });
    }
  }
  if (dedup.length <= 3) return dedup;

  const tolSq = colTolMM * colTolMM;
  const out = [];
  const n = dedup.length;
  for (let i = 0; i < n; i++) {
    const prev = out.length > 0 ? out[out.length - 1] : dedup[(i - 1 + n) % n];
    const curr = dedup[i];
    const next = dedup[(i + 1) % n];

    const ux = curr.x - prev.x;
    const uy = curr.y - prev.y;
    const vx = next.x - curr.x;
    const vy = next.y - curr.y;
    const dot = ux * vx + uy * vy;

    // Solo eliminar si avanza en la misma dirección y cae sobre la recta prev->next dentro de la tolerancia
    if (dot > 0 && pointToSegmentDistSqPuzzle2D(curr, prev, next) <= tolSq && (out.length + (n - i - 1)) >= 3) {
      continue;
    }
    out.push(curr);
  }
  return out.length >= 3 ? out : dedup;
}

function cleanCollinearVerticesInLoops(loops, colTolMM = 1e-3) {
  if (!loops || loops.length === 0) return [];
  const out = [];
  loops.forEach((l) => {
    const cleanedPts = cleanCollinearVerticesInPolygon2D(l.points || [], colTolMM);
    if (cleanedPts.length < 3) return;
    const sArea = computeSignedArea(cleanedPts);
    if (Math.abs(sArea) < 1e-3) return;
    out.push({
      ...l,
      points: cleanedPts,
      signedArea: sArea,
      absArea: Math.abs(sArea)
    });
  });
  return out;
}

// Simplificación Ramer-Douglas-Peucker para un polígono cerrado dividiéndolo por sus dos vértices antípodas más lejanos
function simplifyClosedPolygonPuzzle2D(pts, toleranceMM) {
  const cleaned = cleanCollinearVerticesInPolygon2D(pts, 0.01);
  if (cleaned.length <= 4 || !(toleranceMM > 0.01)) return cleaned;

  const n = cleaned.length;
  let idxA = 0;
  let bestDistA = -1;
  const p0 = cleaned[0];
  for (let i = 1; i < n; i++) {
    const dx = cleaned[i].x - p0.x;
    const dy = cleaned[i].y - p0.y;
    const d = dx * dx + dy * dy;
    if (d > bestDistA) {
      bestDistA = d;
      idxA = i;
    }
  }

  let idxB = (idxA + Math.floor(n / 2)) % n;
  let bestDistB = -1;
  const pA = cleaned[idxA];
  for (let i = 0; i < n; i++) {
    if (i === idxA) continue;
    const dx = cleaned[i].x - pA.x;
    const dy = cleaned[i].y - pA.y;
    const d = dx * dx + dy * dy;
    if (d > bestDistB) {
      bestDistB = d;
      idxB = i;
    }
  }

  if (idxA === idxB) return cleaned;

  const chain1 = [];
  for (let i = idxA; ; i = (i + 1) % n) {
    chain1.push(cleaned[i]);
    if (i === idxB) break;
  }
  const chain2 = [];
  for (let i = idxB; ; i = (i + 1) % n) {
    chain2.push(cleaned[i]);
    if (i === idxA) break;
  }

  const epsSq = toleranceMM * toleranceMM;
  const s1 = rdpSimplifyOpenChainPuzzle2D(chain1, epsSq);
  const s2 = rdpSimplifyOpenChainPuzzle2D(chain2, epsSq);
  let combined = s1.slice(0, s1.length - 1).concat(s2.slice(0, s2.length - 1));

  // Verificar si los propios puntos de partición quedaron casi colineales con sus vecinos
  if (combined.length > 3) {
    combined = cleanCollinearVerticesInPolygon2D(combined, Math.min(toleranceMM * 0.45, 0.8));
  }
  return combined.length >= 3 ? combined : cleaned.slice(0, 3);
}

// Suavizado de esquinas de Chaikin sobre un polígono cerrado
function smoothClosedPolygonChaikinPuzzle2D(pts, passes = 1) {
  let current = pts ? pts.slice() : [];
  const numPasses = Math.max(1, Math.min(3, parseInt(passes, 10) || 1));
  for (let p = 0; p < numPasses; p++) {
    const n = current.length;
    if (n < 3 || n > 1200) break;
    const next = [];
    for (let i = 0; i < n; i++) {
      const a = current[i];
      const b = current[(i + 1) % n];
      next.push(
        { x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y },
        { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y }
      );
    }
    current = next;
  }
  return current;
}

// Envolvente convexa 2D (Monotone Chain) en sentido antihorario (CCW)
function computeConvexHullPuzzle2D(pts) {
  if (!pts || pts.length <= 3) return pts ? pts.slice() : [];
  const sorted = pts.map((p) => ({ x: p.x, y: p.y })).sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  const hull = lower.concat(upper);
  return hull.length >= 3 ? hull : pts.slice();
}

// Puentea y cierra entrantes cóncavos / muescas estrechas en el contorno exterior antes de simplificar
function bridgeConcavitiesPuzzle2D(pts, toleranceMM, isHole) {
  if (!pts || pts.length < 5 || isHole) {
    return simplifyClosedPolygonPuzzle2D(pts, toleranceMM);
  }
  let ring = simplifyClosedPolygonPuzzle2D(pts, Math.max(0.15, toleranceMM * 0.35));
  if (ring.length < 5) return ring;

  // Asegurar sentido antihorario (CCW) para que las concavidades queden hacia la izquierda de la cuerda puente
  if (computeSignedArea(ring) < 0) {
    ring.reverse();
  }

  const maxBridgeSpan = Math.max(2.0, toleranceMM * 4.0);
  const maxBridgeSpanSq = maxBridgeSpan * maxBridgeSpan;
  const bridged = [];
  const n = ring.length;
  let i = 0;

  while (i < n) {
    const pStart = ring[i];
    bridged.push(pStart);
    let bestJump = -1;
    const maxLookahead = Math.min(Math.floor(n * 0.4), 24);

    for (let step = maxLookahead; step >= 2; step--) {
      if (i + step >= n) continue;
      const pEnd = ring[i + step];
      const dx = pEnd.x - pStart.x;
      const dy = pEnd.y - pStart.y;
      const chordSq = dx * dx + dy * dy;
      if (chordSq > maxBridgeSpanSq || chordSq < 1e-4) continue;

      // Comprobar que todos los vértices intermedios se adentran hacia el interior (izquierda de pStart->pEnd en CCW)
      let allConcaveInward = true;
      let arcLen = 0;
      for (let k = i; k < i + step; k++) {
        arcLen += Math.hypot(ring[k + 1].x - ring[k].x, ring[k + 1].y - ring[k].y);
        if (k > i) {
          const pk = ring[k];
          const crossVal = dx * (pk.y - pStart.y) - dy * (pk.x - pStart.x);
          if (crossVal <= 0) {
            allConcaveInward = false;
            break;
          }
        }
      }
      const chordLen = Math.sqrt(chordSq);
      if (allConcaveInward && arcLen > chordLen * 1.25) {
        bestJump = i + step;
        break;
      }
    }

    if (bestJump !== -1) {
      i = bestJump;
    } else {
      i++;
    }
  }

  return simplifyClosedPolygonPuzzle2D(bridged.length >= 3 ? bridged : ring, toleranceMM);
}

function countLoopsVertices(loops) {
  let count = 0;
  (loops || []).forEach((l) => {
    if (l && l.points) count += l.points.length;
  });
  return count;
}

// Simplifica la lista de contornos base de una costilla del Puzzle 3D antes de tallar las ranuras
function simplifyPuzzleLoopsList(rawBaseLoops) {
  if (!rawBaseLoops || rawBaseLoops.length === 0) return [];
  if (!state.puzzleSimplifyCutLine) return rawBaseLoops.slice();

  const tolMM = Math.max(0.05, Number(state.puzzleSimplifyToleranceMM) || 1.5);
  const mode = state.puzzleSimplifyMode || 'rdp';
  const smoothPasses = Math.max(1, Math.min(3, parseInt(state.puzzleSimplifySmoothPasses, 10) || 1));

  const simplifiedLoops = [];
  rawBaseLoops.forEach((loop) => {
    const pts = loop.points;
    if (!pts || pts.length < 3) return;
    const isHole = Boolean(loop.isHole);
    let outPts = pts.slice();

    if (mode === 'convex' && !isHole) {
      outPts = computeConvexHullPuzzle2D(outPts);
      outPts = simplifyClosedPolygonPuzzle2D(outPts, tolMM * 0.5);
    } else if (mode === 'bridge') {
      outPts = bridgeConcavitiesPuzzle2D(outPts, tolMM, isHole);
    } else if (mode === 'smooth') {
      outPts = simplifyClosedPolygonPuzzle2D(outPts, tolMM);
      outPts = smoothClosedPolygonChaikinPuzzle2D(outPts, smoothPasses);
      outPts = cleanCollinearVerticesInPolygon2D(outPts, Math.max(0.03, tolMM * 0.1));
    } else {
      // 'rdp' (Poligonal limpia)
      outPts = simplifyClosedPolygonPuzzle2D(outPts, tolMM);
    }

    if (!outPts || outPts.length < 3) {
      outPts = pts.slice();
    }

    let sArea = computeSignedArea(outPts);
    if ((!isHole && sArea < 0) || (isHole && sArea > 0)) {
      outPts.reverse();
      sArea = -sArea;
    }
    const absA = Math.abs(sArea);
    if (absA < 0.05) return;

    simplifiedLoops.push({
      ...loop,
      points: outPts,
      signedArea: sArea,
      absArea: absA,
      isHole: isHole
    });
  });

  return simplifiedLoops;
}

function recomputePuzzleCutLineSimplification() {
  if (state.constructionMode === 'puzzle3d' && state.slices && state.slices.length > 0) {
    applyIslandFilterToExistingSlices();
  } else {
    syncConstructionModeUI();
  }
}

function setPuzzleSimplifyCutLine(enabled) {
  state.puzzleSimplifyCutLine = Boolean(enabled);
  recomputePuzzleCutLineSimplification();
}

function onPuzzleSimplifyParamsChange() {
  const modeEl = document.getElementById('puzzleSimplifyModeSelect');
  const tolEl = document.getElementById('puzzleSimplifyTolInput');
  if (modeEl && modeEl.value) {
    state.puzzleSimplifyMode = modeEl.value;
  }
  if (tolEl) {
    const val = parseFloat(tolEl.value);
    if (Number.isFinite(val) && val >= 0.05) {
      state.puzzleSimplifyToleranceMM = Math.max(0.05, Math.min(30, Number(val.toFixed(2))));
    }
  }
  recomputePuzzleCutLineSimplification();
}

function onPuzzleSimplifyTolInput(val) {
  const parsed = parseFloat(val);
  if (!Number.isFinite(parsed) || parsed < 0.05) return;
  state.puzzleSimplifyToleranceMM = Math.max(0.05, Math.min(30, Number(parsed.toFixed(2))));
  if (!state.puzzleSimplifyCutLine) {
    state.puzzleSimplifyCutLine = true;
  }
  recomputePuzzleCutLineSimplification();
}

function stepPuzzleSimplifyTolerance(deltaMM) {
  const cur = Number(state.puzzleSimplifyToleranceMM) || 1.5;
  const next = Math.max(0.1, Math.min(30, Number((cur + (Number(deltaMM) || 0)).toFixed(1))));
  state.puzzleSimplifyToleranceMM = next;
  state.puzzleSimplifyCutLine = true;
  recomputePuzzleCutLineSimplification();
}

function setPuzzleSimplifyPreset(mode, tolMM) {
  state.puzzleSimplifyCutLine = true;
  if (mode) state.puzzleSimplifyMode = mode;
  if (typeof tolMM === 'number' && tolMM > 0) {
    state.puzzleSimplifyToleranceMM = tolMM;
  }
  recomputePuzzleCutLineSimplification();
}

// Recorta la base inferior de las costillas marcadas como "Autosustentantes" para que no apoyen en el suelo
// y se sostengan exclusivamente mediante sus ranuras de encaje a media madera con las costillas perpendiculares.
function applyPuzzleSelfSupportingTrim(slicesA, slicesB, axisA, axisB, slicesC = null, axisC = null) {
  const slotW = Math.max(0.4, state.puzzleMaterialThicknessMM + state.puzzleSlotClearanceMM);
  const spanZ = Math.max(10, (state.dimsMM && state.dimsMM.z) ? state.dimsMM.z : 100);
  const baseZ = -spanZ * 0.5;
  const clearanceMM = Math.max(0, Number(state.puzzleSelfSupportClearanceMM) || 0);
  const style = state.puzzleSelfSupportStyle || 'trim_union';
  const minEngagement = Math.max(slotW * 2.4, 9.0);

  const hasC = Boolean(slicesC && slicesC.length > 0 && axisC);
  const allPuzzleSlices = hasC ? slicesA.concat(slicesB, slicesC) : slicesA.concat(slicesB);

  allPuzzleSlices.forEach((s) => {
    const countInSer = s.puzzleSeries === 'C'
      ? (slicesC ? slicesC.length : 0)
      : (s.puzzleSeries === 'B' ? slicesB.length : slicesA.length);
    s.isSelfSupporting = isPuzzleRibSelfSupporting(s, countInSer);
    s.selfSupportClearanceAppliedMM = 0;
  });

  if (!hasAnyPuzzleSelfSupportingRib()) return;

  allPuzzleSlices.forEach((s) => {
    if (!s.isSelfSupporting || s.sliceAxis === 'z' || s.isPuzzleSolidCap) return;
    if (!s.baseLoops || s.baseLoops.length === 0) return;

    // Si el estilo es 'natural' y el usuario no forzó manualmente esta costilla individual,
    // basta con no haber proyectado el pedestal hasta el suelo en sliceTrianglesAtPlane
    const hasManualOverride = Boolean(
      state.puzzleSelfSupportRibs &&
      state.puzzleSelfSupportRibs[s.puzzleSeries] &&
      state.puzzleSelfSupportRibs[s.puzzleSeries][s.seriesIndex] === true
    );
    if (style === 'natural' && !hasManualOverride) return;
    if (clearanceMM < 1.0) return;

    // Medir cota vertical Z (eje Y en el plano 2D de una costilla vertical X o Y)
    let ribMinY = Infinity;
    let ribMaxY = -Infinity;
    let ribMinX = Infinity;
    let ribMaxX = -Infinity;
    s.baseLoops.forEach((l) => {
      if (l.isHole) return;
      (l.points || []).forEach((p) => {
        if (p.y < ribMinY) ribMinY = p.y;
        if (p.y > ribMaxY) ribMaxY = p.y;
        if (p.x < ribMinX) ribMinX = p.x;
        if (p.x > ribMaxX) ribMaxX = p.x;
      });
    });
    if (!(ribMaxY > ribMinY + minEngagement + 2.0)) return;

    // Localizar las costillas perpendiculares que cruzan esta costilla para proteger el solape de las uniones
    const perpLists = [];
    if (s.puzzleSeries === 'A') {
      perpLists.push({ list: slicesB, ax: axisB });
      if (hasC) perpLists.push({ list: slicesC, ax: axisC });
    } else if (s.puzzleSeries === 'B') {
      perpLists.push({ list: slicesA, ax: axisA });
      if (hasC) perpLists.push({ list: slicesC, ax: axisC });
    } else if (s.puzzleSeries === 'C') {
      perpLists.push({ list: slicesA, ax: axisA });
      perpLists.push({ list: slicesB, ax: axisB });
    }

    const validCrossings = [];
    perpLists.forEach((grp) => {
      if (grp.ax === 'z') return; // Las plantas Z tienen cota fija
      const infoS = getPuzzleSlice2DAxes(s.sliceAxis, grp.ax);
      const infoP = getPuzzleSlice2DAxes(grp.ax, s.sliceAxis);
      if (infoS.vAxis !== 'y') return;

      for (let j = 0; j < grp.list.length; j++) {
        const pSlice = grp.list[j];
        if (!pSlice.baseLoops || pSlice.baseLoops.length === 0) continue;
        const intS = getSolidIntervalsAlongLine(s.baseLoops, infoS.uAxis, infoS.vAxis, pSlice.coord);
        const intP = getSolidIntervalsAlongLine(pSlice.baseLoops, infoP.uAxis, infoP.vAxis, s.coord);
        if (intS.length === 0 || intP.length === 0) continue;
        const common = intersect1DIntervalLists(intS, intP);
        for (let k = 0; k < common.length; k++) {
          const cMin = common[k][0];
          const cMax = common[k][1];
          if (cMax - cMin >= minEngagement * 0.65) {
            validCrossings.push({ uCoord: pSlice.coord, vMin: cMin, vMax: cMax });
          }
        }
      }
    });

    // Calcular la cota máxima de recorte inferior vCut que garantiza al menos una unión sólida de soporte
    let maxAllowedCutY = ribMaxY - minEngagement;
    if (validCrossings.length > 0) {
      let highestCrossingSafeCut = -Infinity;
      const safeCuts = [];
      for (let c = 0; c < validCrossings.length; c++) {
        const sc = validCrossings[c].vMax - minEngagement;
        safeCuts.push(sc);
        if (sc > highestCrossingSafeCut) highestCrossingSafeCut = sc;
      }
      safeCuts.sort((a, b) => b - a);
      // Garantizar al menos 2 apoyos de unión (si existen >=2 cruces) o el apoyo principal
      const targetSafeCut = safeCuts.length >= 2 ? safeCuts[1] : highestCrossingSafeCut;
      maxAllowedCutY = Math.min(maxAllowedCutY, targetSafeCut);
    }

    const desiredCutY = baseZ + clearanceMM;
    const vCut = Math.min(desiredCutY, maxAllowedCutY);
    if (!(vCut > ribMinY + 0.5)) return;

    let trimmedLoops = clipLoopsToAxisRange(s.baseLoops, 'y', vCut, 1e5);

    // Si el estilo es 'arch' (Arco aligerado entre uniones), elevar aún más el tramo inferior entre costillas de soporte
    if (style === 'arch' && validCrossings.length >= 1 && trimmedLoops.length > 0) {
      const pierHalfW = Math.max(slotW * 1.35, 4.5);
      const archExtraH = Math.min(
        Math.max(4.0, clearanceMM * 0.45),
        Math.max(0, (ribMaxY - minEngagement * 0.85) - vCut)
      );
      if (archExtraH > 1.5) {
        const uCoords = validCrossings.map((c) => c.uCoord).sort((a, b) => a - b);
        const spans = [];
        let curX = ribMinX - 2.0;
        for (let idx = 0; idx < uCoords.length; idx++) {
          const leftPier = uCoords[idx] - pierHalfW;
          const rightPier = uCoords[idx] + pierHalfW;
          if (leftPier > curX + 2.0) {
            spans.push([curX, leftPier]);
          }
          curX = Math.max(curX, rightPier);
        }
        if (ribMaxX + 2.0 > curX + 2.0) {
          spans.push([curX, ribMaxX + 2.0]);
        }
        for (let sp = 0; sp < spans.length; sp++) {
          const sMinX = spans[sp][0];
          const sMaxX = spans[sp][1];
          const spanW = sMaxX - sMinX;
          if (spanW < slotW * 1.2) continue;
          // Recorte escalonado en arco de 2 niveles para suavizar la transición hacia las uniones
          const step1Rect = {
            minX: sMinX,
            maxX: sMaxX,
            minY: vCut - 2.0,
            maxY: vCut + archExtraH * 0.55
          };
          trimmedLoops = subtractSingleRectFromLoops(trimmedLoops, step1Rect);
          if (spanW > slotW * 2.8) {
            const inset = spanW * 0.18;
            const step2Rect = {
              minX: sMinX + inset,
              maxX: sMaxX - inset,
              minY: vCut - 2.0,
              maxY: vCut + archExtraH
            };
            trimmedLoops = subtractSingleRectFromLoops(trimmedLoops, step2Rect);
          }
        }
      }
    }

    if (trimmedLoops && trimmedLoops.length > 0) {
      s.baseLoops = trimmedLoops;
      s.selfSupportClearanceAppliedMM = Math.max(0, Number((vCut - baseZ).toFixed(1)));
    }
  });
}

// Talla todas las ranuras de encaje a media madera entre las costillas de la Serie A, Serie B y opcionalmente Serie C (3 Ejes X×Y×Z)
function carveInterlockingPuzzleSlots(slicesA, slicesB, axisA, axisB, slicesC = null, axisC = null) {
  const slotW = Math.max(0.4, state.puzzleMaterialThicknessMM + state.puzzleSlotClearanceMM);
  const halfW = slotW * 0.5;
  const hasC = Boolean(slicesC && slicesC.length > 0 && axisC);
  const allPuzzleSlices = hasC ? slicesA.concat(slicesB, slicesC) : slicesA.concat(slicesB);

  let rawVertsTotal = 0;
  let simpVertsTotal = 0;

  allPuzzleSlices.forEach((s) => {
    const rawBase = s.rawBaseLoops || s.baseLoops || s.loops || [];
    s.rawBaseLoops = rawBase;
    rawVertsTotal += countLoopsVertices(rawBase);
    s.baseLoops = state.puzzleSimplifyCutLine ? simplifyPuzzleLoopsList(rawBase) : rawBase.slice();
    s.slots = [];
    s.puzzleSlots = s.slots;
    s.slotRects = [];
  });

  // Aplicar recorte inferior de costillas autosustentantes antes de calcular los cruces y tallar ranuras
  applyPuzzleSelfSupportingTrim(slicesA, slicesB, axisA, axisB, slicesC, axisC);

  allPuzzleSlices.forEach((s) => {
    simpVertsTotal += countLoopsVertices(s.baseLoops);
  });

  state.puzzleRawVerticesCount = rawVertsTotal;
  state.puzzleSimplifiedVerticesCount = simpVertsTotal;

  let totalSlots = 0;

  const collectPairwiseSlots = (list1, list2, ax1, ax2) => {
    const infoA = getPuzzleSlice2DAxes(ax1, ax2);
    const infoB = getPuzzleSlice2DAxes(ax2, ax1);

    for (let i = 0; i < list1.length; i++) {
      const sA = list1[i];
      if (!sA.baseLoops || sA.baseLoops.length === 0) continue;

      for (let j = 0; j < list2.length; j++) {
        const sB = list2[j];
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

        // Si sA es una costilla autosustentante flotante cuyo borde inferior empieza en vMin mientras que sB baja hacia el suelo,
        // invertimos la polaridad del encaje en este cruce para que ambas ranuras abran por sus bordes exteriores
        // (sA abre por abajo y encaja desde arriba sobre sB, evitando ventanas cerradas a mitad de sB).
        const aStartsAtVMin = idxIntA !== -1 && Math.abs(intervalsA[idxIntA][0] - vMin) < 0.35;
        const bExtendsBelowVMin = idxIntB !== -1 && intervalsB[idxIntB][0] < vMin - 0.5;
        const bEndsAtVMax = idxIntB !== -1 && Math.abs(intervalsB[idxIntB][1] - vMax) < 0.35;
        const aExtendsAboveVMax = idxIntA !== -1 && intervalsA[idxIntA][1] > vMax + 0.5;
        const flipSlotPolarity = Boolean(aStartsAtVMin && bExtendsBelowVMin && !(bEndsAtVMax && aExtendsAboveVMax));

        if (!flipSlotPolarity) {
          // Polaridad estándar: sA abre hacia +v [vMid, safeMaxVA] y sB abre hacia -v [safeMinVB, vMid]
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

          const rectB = infoB.uAxis === 'x'
            ? { minX: sA.coord - halfW, maxX: sA.coord + halfW, minY: safeMinVB, maxY: vMid + relief }
            : { minX: safeMinVB, maxX: vMid + relief, minY: sA.coord - halfW, maxY: sB.coord + halfW };

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
        } else {
          // Polaridad invertida para costilla A autosustentante flotante:
          // sA abre hacia -v [safeMinVA, vMid] y sB abre hacia +v [vMid, safeMaxVB]
          let safeMinVA = vMin - relief;
          if (idxIntA !== -1 && Math.abs(intervalsA[idxIntA][0] - vMin) < 0.25) {
            const openExtA = Math.min(2.0, slotW * 0.6);
            safeMinVA = (idxIntA > 0)
              ? Math.max(vMin - openExtA, (vMin + intervalsA[idxIntA - 1][1]) * 0.5)
              : (vMin - openExtA);
          }

          let safeMaxVB = vMax + relief;
          if (idxIntB !== -1 && Math.abs(intervalsB[idxIntB][1] - vMax) < 0.25) {
            const openExtB = Math.min(2.0, slotW * 0.6);
            safeMaxVB = (idxIntB + 1 < intervalsB.length)
              ? Math.min(vMax + openExtB, (vMax + intervalsB[idxIntB + 1][0]) * 0.5)
              : (vMax + openExtB);
          }

          const rectA = infoA.uAxis === 'x'
            ? { minX: sB.coord - halfW, maxX: sB.coord + halfW, minY: safeMinVA, maxY: vMid + relief }
            : { minX: safeMinVA, maxX: vMid + relief, minY: sB.coord - halfW, maxY: sB.coord + halfW };

          sA.slotRects.push(rectA);
          sA.slots.push({
            targetCode: sB.puzzleCode,
            targetSliceIndex: sB.index,
            uAxis: infoA.uAxis,
            vAxis: infoA.vAxis,
            uCenter: sB.coord,
            vMid: vMid,
            vMouth: vMin,
            x: sB.coord,
            yStart: vMin,
            yEnd: vMid,
            mx: infoA.uAxis === 'x' ? sB.coord : vMin,
            my: infoA.uAxis === 'x' ? vMin : sB.coord,
            bx: infoA.uAxis === 'x' ? sB.coord : vMid,
            by: infoA.uAxis === 'x' ? vMid : sB.coord,
            fromTop: false,
            openPositive: false,
            slotWidth: slotW,
            rect: rectA
          });

          const rectB = infoB.uAxis === 'x'
            ? { minX: sA.coord - halfW, maxX: sA.coord + halfW, minY: vMid - relief, maxY: safeMaxVB }
            : { minX: vMid - relief, maxX: safeMaxVB, minY: sA.coord - halfW, maxY: sB.coord + halfW };

          sB.slotRects.push(rectB);
          sB.slots.push({
            targetCode: sA.puzzleCode,
            targetSliceIndex: sA.index,
            uAxis: infoB.uAxis,
            vAxis: infoB.vAxis,
            uCenter: sA.coord,
            vMid: vMid,
            vMouth: vMax,
            x: sA.coord,
            yStart: vMid,
            yEnd: vMax,
            mx: infoB.uAxis === 'x' ? sA.coord : vMax,
            my: infoB.uAxis === 'x' ? vMax : sA.coord,
            bx: infoB.uAxis === 'x' ? sA.coord : vMid,
            by: infoB.uAxis === 'x' ? vMid : sA.coord,
            fromTop: true,
            openPositive: true,
            slotWidth: slotW,
            rect: rectB
          });
        }

        totalSlots += 2;
      }
    }
  }
  };

  collectPairwiseSlots(slicesA, slicesB, axisA, axisB);
  if (hasC) {
    collectPairwiseSlots(slicesA, slicesC, axisA, axisC);
    collectPairwiseSlots(slicesB, slicesC, axisB, axisC);
  }

  const getMaxOuterArea = (loopsList) => {
    let maxA = 0;
    for (let i = 0; i < loopsList.length; i++) {
      if (!loopsList[i].isHole && (loopsList[i].absArea || 0) > maxA) {
        maxA = loopsList[i].absArea || 0;
      }
    }
    return maxA;
  };

  const spanZ = Math.max(10, (state.dimsMM && state.dimsMM.z) ? state.dimsMM.z : 100);
  const baseZ = -spanZ * 0.5;
  const checkDropUnconnected = Boolean(state.puzzleDropUnconnectedIslands !== false && hasAnyPuzzleSelfSupportingRib());
  let floatingRibsCount = 0;

  // Tallar geométricamente todas las ranuras en los contornos 2D de cada costilla estructural
  allPuzzleSlices.forEach((slice) => {
    if (slice.isPuzzleSolidCap) {
      slice.loops = getFullFilledSolidLoops(slice.rawBaseLoops || slice.baseLoops || []);
      slice.isFloatingAboveFloor = false;
      slice.floatingClearanceMM = 0;
      return;
    }
    let currentLoops = slice.baseLoops.slice();
    for (let r = 0; r < slice.slotRects.length; r++) {
      const rect = slice.slotRects[r];
      if (!hasC) {
        currentLoops = subtractSingleRectFromLoops(currentLoops, rect);
      } else {
        // En modo 3 Ejes (X×Y×Z), si una ranura perpendicular partiría la costilla en dos pedazos grandes,
        // reducir su profundidad a una muesca de borde del 28% para conservar el alma monolítica de la pieza
        const maxAreaBefore = getMaxOuterArea(currentLoops);
        const candidateLoops = subtractSingleRectFromLoops(currentLoops, rect);
        const maxAreaAfter = getMaxOuterArea(candidateLoops);
        if (maxAreaBefore > 20 && maxAreaAfter < maxAreaBefore * 0.62 && slice.slots[r]) {
          const sl = slice.slots[r];
          const notchSpan = Math.abs(sl.vMouth - sl.vMid) * 0.52;
          const vInner = sl.openPositive ? (sl.vMouth - notchSpan) : (sl.vMouth + notchSpan);
          const safeRect = sl.uAxis === 'x'
            ? {
                minX: rect.minX,
                maxX: rect.maxX,
                minY: sl.openPositive ? vInner : rect.minY,
                maxY: sl.openPositive ? rect.maxY : vInner
              }
            : {
                minX: sl.openPositive ? vInner : rect.minX,
                maxX: sl.openPositive ? rect.maxX : vInner,
                minY: rect.minY,
                maxY: rect.maxY
              };
          sl.rect = safeRect;
          slice.slotRects[r] = safeRect;
          currentLoops = subtractSingleRectFromLoops(currentLoops, safeRect);
        } else {
          currentLoops = candidateLoops;
        }
      }
    }
    if (state.puzzleSimplifyCutLine) {
      currentLoops = cleanCollinearVerticesInLoops(currentLoops, 1e-3);
    }
    if (currentLoops.length > 1) {
      const minSliverArea = Math.max(15.0, slotW * slotW);
      const filtered = currentLoops.filter((l) => l.isHole || (l.absArea || 0) >= minSliverArea);
      if (filtered.length > 0) currentLoops = filtered;
    }

    // Si está activo el descarte de islas aéreas sin unión, descartar islas exteriores que ni tocan el suelo ni tienen encaje
    if (checkDropUnconnected && slice.sliceAxis !== 'z' && currentLoops.length > 1) {
      const outerLoops = currentLoops.filter((l) => !l.isHole);
      if (outerLoops.length > 1) {
        const keptLoops = currentLoops.filter((l) => {
          if (l.isHole) return true;
          let lMinX = Infinity, lMaxX = -Infinity, lMinY = Infinity, lMaxY = -Infinity;
          (l.points || []).forEach((p) => {
            if (p.x < lMinX) lMinX = p.x;
            if (p.x > lMaxX) lMaxX = p.x;
            if (p.y < lMinY) lMinY = p.y;
            if (p.y > lMaxY) lMaxY = p.y;
          });
          // Si apoya en el suelo, se conserva siempre
          if (lMinY <= baseZ + 1.5) return true;
          // Comprobar si alguna ranura de encaje intersecta la caja envolvente de esta isla
          const m = Math.max(1.5, slotW);
          for (let sr = 0; sr < slice.slotRects.length; sr++) {
            const r = slice.slotRects[sr];
            if (r.maxX >= lMinX - m && r.minX <= lMaxX + m && r.maxY >= lMinY - m && r.minY <= lMaxY + m) {
              return true;
            }
          }
          return false;
        });
        if (keptLoops.some((l) => !l.isHole)) {
          currentLoops = keptLoops;
        }
      }
    }

    slice.loops = currentLoops;

    // Medir si la costilla final queda suspendida sobre el suelo sostenida por sus uniones
    if (slice.sliceAxis !== 'z' && currentLoops.length > 0) {
      let finalMinY = Infinity;
      currentLoops.forEach((l) => {
        if (l.isHole) return;
        (l.points || []).forEach((p) => {
          if (p.y < finalMinY) finalMinY = p.y;
        });
      });
      const clearanceFromFloor = Number.isFinite(finalMinY) ? (finalMinY - baseZ) : 0;
      slice.isFloatingAboveFloor = clearanceFromFloor > 1.2;
      slice.floatingClearanceMM = slice.isFloatingAboveFloor ? Number(clearanceFromFloor.toFixed(1)) : 0;
      if (slice.isFloatingAboveFloor) {
        floatingRibsCount++;
      }
    } else {
      slice.isFloatingAboveFloor = false;
      slice.floatingClearanceMM = 0;
    }
  });

  state.puzzleSelfSupportCount = floatingRibsCount;
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

  if (typeof reapplyAllSliceImageEngravings === 'function') {
    reapplyAllSliceImageEngravings();
  }

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
    const coordInfoA = computePuzzleAxisSliceCoords(spanA, countA, state.puzzleStartOffsetAMM, state.puzzleStartMode, state.puzzleRibOffsetsAMM);
    const coordInfoB = computePuzzleAxisSliceCoords(spanB, countB, state.puzzleStartOffsetBMM, state.puzzleStartMode, state.puzzleRibOffsetsBMM);

    const slicesA = [];
    const slicesB = [];
    let totalRemovedIslands = 0;
    let totalFilledHoles = 0;

    for (let i = 0; i < countA; i++) {
      const coordA = coordInfoA.coords[i];
      const selfSupA = isPuzzleRibSelfSupporting({ puzzleSeries: 'A', seriesIndex: i, sliceAxis: cfg.axisA }, countA);
      const rawLoops = sliceTrianglesAtPlane(verts, cfg.axisA, coordA, spanA, selfSupA);
      const filteredRes = filterLoopsByMinIslandSize(rawLoops);
      totalRemovedIslands += filteredRes.removedCount;
      totalFilledHoles += (filteredRes.filledHolesCount || 0);
      const codeA = cfg.axisA.toUpperCase() + (i + 1);

      slicesA.push({
        index: i,
        coord: coordA,
        sliceAxis: cfg.axisA,
        puzzleSeries: 'A',
        seriesIndex: i,
        puzzleCode: codeA,
        isSelfSupporting: selfSupA,
        selected: true,
        rawLoops: rawLoops,
        rawBaseLoops: filteredRes.loops,
        baseLoops: filteredRes.loops,
        loops: filteredRes.loops,
        slots: [],
        slotRects: []
      });
    }

    for (let j = 0; j < countB; j++) {
      const coordB = coordInfoB.coords[j];
      const selfSupB = isPuzzleRibSelfSupporting({ puzzleSeries: 'B', seriesIndex: j, sliceAxis: cfg.axisB }, countB);
      const rawLoops = sliceTrianglesAtPlane(verts, cfg.axisB, coordB, spanB, selfSupB);
      const filteredRes = filterLoopsByMinIslandSize(rawLoops);
      totalRemovedIslands += filteredRes.removedCount;
      totalFilledHoles += (filteredRes.filledHolesCount || 0);
      const codeB = cfg.axisB.toUpperCase() + (j + 1);

      slicesB.push({
        index: countA + j,
        coord: coordB,
        sliceAxis: cfg.axisB,
        puzzleSeries: 'B',
        seriesIndex: j,
        puzzleCode: codeB,
        isSelfSupporting: selfSupB,
        selected: true,
        rawLoops: rawLoops,
        rawBaseLoops: filteredRes.loops,
        baseLoops: filteredRes.loops,
        loops: filteredRes.loops,
        slots: [],
        slotRects: []
      });
    }

    const slicesC = [];
    if (cfg.is3Axes && cfg.axisC) {
      const spanC = state.dimsMM[cfg.axisC] || 100;
      const countC = Math.max(2, state.puzzleCountC || 4);
      const coordInfoC = computePuzzleAxisSliceCoords(spanC, countC, state.puzzleStartOffsetCMM || 0, state.puzzleStartMode, state.puzzleRibOffsetsCMM);
      for (let k = 0; k < countC; k++) {
        const coordC = coordInfoC.coords[k];
        const selfSupC = isPuzzleRibSelfSupporting({ puzzleSeries: 'C', seriesIndex: k, sliceAxis: cfg.axisC }, countC);
        const rawLoops = sliceTrianglesAtPlane(verts, cfg.axisC, coordC, spanC, selfSupC);
        const filteredRes = filterLoopsByMinIslandSize(rawLoops);
        totalRemovedIslands += filteredRes.removedCount;
        totalFilledHoles += (filteredRes.filledHolesCount || 0);
        const codeC = cfg.axisC.toUpperCase() + (k + 1);

        slicesC.push({
          index: countA + countB + k,
          coord: coordC,
          sliceAxis: cfg.axisC,
          puzzleSeries: 'C',
          seriesIndex: k,
          puzzleCode: codeC,
          isSelfSupporting: selfSupC,
          selected: true,
          rawLoops: rawLoops,
          rawBaseLoops: filteredRes.loops,
          baseLoops: filteredRes.loops,
          loops: filteredRes.loops,
          slots: [],
          slotRects: []
        });
      }
    }

    state.slices = cfg.is3Axes ? slicesA.concat(slicesB, slicesC) : slicesA.concat(slicesB);
    state.slices.forEach((s, idx) => {
      s.index = idx;
    });

    carveInterlockingPuzzleSlots(slicesA, slicesB, cfg.axisA, cfg.axisB, cfg.is3Axes ? slicesC : null, cfg.axisC);

    state.thickness = state.puzzleMaterialThicknessMM;
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
    const slicesC = cfg.is3Axes ? state.slices.filter((s) => s.puzzleSeries === 'C') : null;
    carveInterlockingPuzzleSlots(slicesA, slicesB, cfg.axisA, cfg.axisB, slicesC, cfg.axisC);
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
  if (box) {
    box.classList.toggle('hidden', !state.filterSmallIslands);
    box.classList.toggle('opacity-45', !state.filterSmallIslands);
  }

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
  if (fhBox) {
    fhBox.classList.toggle('hidden', !state.fillInternalHoles);
    fhBox.classList.toggle('opacity-45', !state.fillInternalHoles);
  }

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

function sliceTrianglesAtPlane(verts, axis, planeVal, spanScale, isSelfSupportingRib = false) {
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
  const classified = classifyLoopsOuterAndHoles(rawLoops);
  if (axis !== 'z' && state.constructionMode === 'puzzle3d' && state.fillInternalHoles && segments.length > 20) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, netArea = 0;
    classified.forEach((l) => {
      netArea += l.isHole ? -l.absArea : l.absArea;
      (l.points || []).forEach((p) => {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      });
    });
    const bboxArea = Math.max(1, (maxX - minX) * (maxY - minY));
    const skipPedestal = Boolean(isSelfSupportingRib || state.puzzleSelfSupporting);
    if (netArea < 0.38 * bboxArea) {
      if (skipPedestal && netArea >= 0.04 * bboxArea) {
        return classified;
      }
      const baseZ = -(state.dimsMM && state.dimsMM.z ? state.dimsMM.z : 100) * 0.5;
      const solidLoops = buildSolidRibLoopFromSegments(segments, baseZ, skipPedestal);
      if (solidLoops.length > 0) return solidLoops;
    }
  }
  return classified;
}

function buildSolidRibLoopFromSegments(segments, baseY, selfSupporting = false) {
  if (!segments || segments.length === 0) return [];
  let uMin = Infinity, uMax = -Infinity;
  for (let i = 0; i < segments.length; i++) {
    const p0 = segments[i][0], p1 = segments[i][1];
    if (p0.x < uMin) uMin = p0.x; if (p0.x > uMax) uMax = p0.x;
    if (p1.x < uMin) uMin = p1.x; if (p1.x > uMax) uMax = p1.x;
  }
  if (!(uMax > uMin + 1.0)) return [];

  const stepU = 0.25;
  const numBins = Math.max(4, Math.ceil((uMax - uMin) / stepU));
  const vMaxArr = new Float32Array(numBins + 1).fill(-Infinity);
  const vMinRealArr = new Float32Array(numBins + 1).fill(Infinity);
  const floorTol = 1.2;

  for (let i = 0; i < segments.length; i++) {
    const p0 = segments[i][0], p1 = segments[i][1];
    const x0 = p0.x, y0 = p0.y, x1 = p1.x, y1 = p1.y;
    const isFloorSeg = Math.abs(y0 - baseY) < floorTol && Math.abs(y1 - baseY) < floorTol;
    const b0 = Math.max(0, Math.min(numBins, Math.round((x0 - uMin) / stepU)));
    const b1 = Math.max(0, Math.min(numBins, Math.round((x1 - uMin) / stepU)));
    if (y0 > vMaxArr[b0]) vMaxArr[b0] = y0;
    if (y1 > vMaxArr[b1]) vMaxArr[b1] = y1;
    if (!isFloorSeg) {
      if (y0 > baseY + floorTol && y0 < vMinRealArr[b0]) vMinRealArr[b0] = y0;
      if (y1 > baseY + floorTol && y1 < vMinRealArr[b1]) vMinRealArr[b1] = y1;
    }
    const lo = Math.min(b0, b1), hi = Math.max(b0, b1);
    if (hi > lo && Math.abs(x1 - x0) > 1e-6) {
      for (let b = lo; b <= hi; b++) {
        const u = uMin + b * stepU;
        const t = Math.max(0, Math.min(1, (u - x0) / (x1 - x0)));
        const y = y0 + t * (y1 - y0);
        if (y > vMaxArr[b]) vMaxArr[b] = y;
        if (!isFloorSeg && y > baseY + floorTol && y < vMinRealArr[b]) {
          vMinRealArr[b] = y;
        }
      }
    }
  }

  for (let b = 1; b < numBins; b++) {
    if (vMaxArr[b] === -Infinity && vMaxArr[b - 1] > -Infinity && vMaxArr[b + 1] > -Infinity) {
      vMaxArr[b] = 0.5 * (vMaxArr[b - 1] + vMaxArr[b + 1]);
    }
    if (vMinRealArr[b] === Infinity && vMinRealArr[b - 1] < Infinity && vMinRealArr[b + 1] < Infinity) {
      vMinRealArr[b] = 0.5 * (vMinRealArr[b - 1] + vMinRealArr[b + 1]);
    }
  }

  const loops = [];
  let b = 0;
  while (b <= numBins) {
    while (b <= numBins && !(vMaxArr[b] > baseY + 1.0)) b++;
    if (b > numBins) break;
    const startB = b;
    while (b <= numBins && vMaxArr[b] > baseY + 1.0) b++;
    const endB = b - 1;
    if (endB - startB >= 4) {
      if (!selfSupporting) {
        const uStart = uMin + startB * stepU;
        const uEnd = uMin + endB * stepU;
        const pts = [
          { x: uStart, y: baseY },
          { x: uEnd, y: baseY }
        ];
        for (let k = endB; k >= startB; k--) {
          pts.push({ x: uMin + k * stepU, y: vMaxArr[k] });
        }
        loops.push(pts);
      } else {
        const pts = [];
        for (let k = startB; k <= endB; k++) {
          const topY = vMaxArr[k];
          let botY = vMinRealArr[k];
          if (!(botY < topY - 2.0)) {
            botY = Math.max(baseY, topY - Math.max(12.0, (topY - baseY) * 0.45));
          }
          pts.push({ x: uMin + k * stepU, y: botY });
        }
        for (let k = endB; k >= startB; k--) {
          pts.push({ x: uMin + k * stepU, y: vMaxArr[k] });
        }
        loops.push(pts);
      }
    }
  }
  return classifyLoopsOuterAndHoles(loops);
}

function chainSegmentsBidirectional(segments, spanScale) {
  const used = new Uint8Array(segments.length);
  const tol = Math.max(0.05, spanScale * 0.0025);
  const tolSq = tol * tol;
  const exactTolSq = 1e-8;
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
      const dToStart = poly.length >= 4 ? distSq(poly[0], tail) : Infinity;
      if (dToStart <= exactTolSq) break;

      let bestIdx = -1;
      let bestEnd = 0;
      let bestD = Math.min(tolSq, dToStart);

      for (let j = 0; j < segments.length; j++) {
        if (used[j]) continue;
        const d0 = distSq(tail, segments[j][0]);
        if (d0 < bestD) { bestD = d0; bestIdx = j; bestEnd = 0; if (d0 <= exactTolSq) break; }
        const d1 = distSq(tail, segments[j][1]);
        if (d1 < bestD) { bestD = d1; bestIdx = j; bestEnd = 1; if (d1 <= exactTolSq) break; }
      }

      if (bestIdx !== -1) {
        used[bestIdx] = 1;
        poly.push(bestEnd === 0 ? segments[bestIdx][1] : segments[bestIdx][0]);
        extended = true;
      }
    }

    while (distSq(poly[0], poly[poly.length - 1]) > exactTolSq) {
      const head = poly[0];
      let bestIdx = -1;
      let bestEnd = 0;
      let bestD = tolSq;
      for (let j = 0; j < segments.length; j++) {
        if (used[j]) continue;
        const d0 = distSq(head, segments[j][0]);
        if (d0 < bestD) { bestD = d0; bestIdx = j; bestEnd = 0; if (d0 <= exactTolSq) break; }
        const d1 = distSq(head, segments[j][1]);
        if (d1 < bestD) { bestD = d1; bestIdx = j; bestEnd = 1; if (d1 <= exactTolSq) break; }
      }
      if (bestIdx !== -1) {
        used[bestIdx] = 1;
        poly.unshift(bestEnd === 0 ? segments[bestIdx][1] : segments[bestIdx][0]);
      } else {
        break;
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
    if (m.children && m.children.length > 0) {
      m.children.forEach((ch) => {
        if (ch.geometry) ch.geometry.dispose();
        if (ch.material) ch.material.dispose();
      });
    }
    if (m.geometry) m.geometry.dispose();
    if (m.material) m.material.dispose();
  }

  const attachSliceEngraveLines3D = (targetMesh, slice, ax, extrudeDepth) => {
    if (
      !targetMesh ||
      !slice ||
      !slice.engraveLoops ||
      slice.engraveLoops.length === 0 ||
      typeof THREE.LineSegments !== 'function' ||
      typeof THREE.LineBasicMaterial !== 'function'
    ) {
      return;
    }
    const zFront = extrudeDepth * 0.5 + 0.08;
    const zBack = -extrudeDepth * 0.5 - 0.08;
    const coords = [];
    slice.engraveLoops.forEach((el) => {
      const pts = el.points;
      if (!pts || pts.length < 2) return;
      for (let i = 0, n = pts.length; i < n; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        coords.push(p1.x, p1.y, zFront, p2.x, p2.y, zFront);
        coords.push(p1.x, p1.y, zBack, p2.x, p2.y, zBack);
      }
    });
    if (coords.length === 0) return;
    const lGeom = new THREE.BufferGeometry();
    lGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(coords), 3));
    if (ax === 'x') {
      lGeom.rotateZ(Math.PI / 2);
      lGeom.rotateY(Math.PI / 2);
    } else if (ax === 'y') {
      lGeom.rotateX(Math.PI / 2);
    }
    const lMat = new THREE.LineBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: slice.selected ? 0.95 : 0.25
    });
    const linesMesh = new THREE.LineSegments(lGeom, lMat);
    if (typeof targetMesh.add === 'function') {
      targetMesh.add(linesMesh);
    }
  };

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
        baseCol = new THREE.Color().setHSL(hueA, slice.isPuzzleSolidCap ? 0.88 : 0.80, slice.isPuzzleSolidCap ? 0.60 : 0.50);
      } else if (slice.puzzleSeries === 'C') {
        const hueC = 0.38 - ((slice.seriesIndex || 0) / Math.max(1, (state.puzzleCountC || 4) - 1)) * 0.06;
        baseCol = new THREE.Color().setHSL(hueC, 0.82, 0.48);
      } else {
        const hueB = 0.11 - ((slice.seriesIndex || 0) / Math.max(1, state.puzzleCountB - 1)) * 0.05;
        baseCol = new THREE.Color().setHSL(hueB, slice.isPuzzleSolidCap ? 0.90 : 0.85, slice.isPuzzleSolidCap ? 0.62 : 0.54);
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
          geom.rotateZ(Math.PI / 2);
          geom.rotateY(Math.PI / 2);
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
      geom.rotateZ(Math.PI / 2);
      geom.rotateY(Math.PI / 2);
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
    attachSliceEngraveLines3D(mesh, slice, ax, extrudeDepth);
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
      // En modo Puzzle 3D, al aumentar Explosión 3D la Serie B se desliza a lo largo del eje común de encaje
      // y las tapas exteriores macizas se separan hacia fuera para dejar ver la costilla gemela ranurada
      const capExtraSpread = slice.isPuzzleSolidCap
        ? ((slice.capSide === 'start' ? -1 : 1) * exp * Math.max(12, state.puzzleMaterialThicknessMM * 4.5))
        : 0;
      const spreadCoord = slice.coord * (1 + exp * 0.3) + capExtraSpread;
      const liftSpan = state.dimsMM[puzzleCfg.axisCommon] || 100;
      const slideOffset = (slice.puzzleSeries === 'B' ? 1 : -0.15) * exp * liftSpan * 0.65;

      if (ax === 'x') px = spreadCoord;
      else if (ax === 'y') py = spreadCoord;
      else pz = spreadCoord;

      if (puzzleCfg.is3Axes) {
        if (slice.puzzleSeries === 'C') pz += exp * liftSpan * 0.65;
        else if (slice.puzzleSeries === 'B') py += exp * (state.dimsMM.y || 100) * 0.25;
      } else {
        if (puzzleCfg.axisCommon === 'x') px += slideOffset;
        else if (puzzleCfg.axisCommon === 'y') py += slideOffset;
        else pz += slideOffset;
      }
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
    const hiddenInView = isSliceHiddenInView(slice);
    if (hiddenInView) {
      mesh.visible = false;
    } else if (state.isolateCurrent) {
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
  if (optBox) {
    optBox.classList.toggle('hidden', !anyGuide);
    optBox.classList.toggle('opacity-40', !anyGuide);
  }
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

// =========================================================================
// NAVEGACIÓN POR PESTAÑAS DE FLUJO DE TRABAJO Y PANELES PLEGABLES (UI LIMPIA)
// =========================================================================

function syncSidebarTabsUI() {
  const activeTab = state.activeSidebarTab || 'cut';
  const tabMap = {
    cut: [1, 2],
    clean: [4],
    finish: [3],
    boards: [5, 6],
    all: [1, 2, 3, 4, 5, 6]
  };
  const visibleCards = tabMap[activeTab] || tabMap.cut;

  ['cut', 'clean', 'finish', 'boards', 'all'].forEach((tKey) => {
    const btn = document.getElementById('sidebarTabBtn_' + tKey);
    if (!btn) return;
    const isAct = activeTab === tKey;
    btn.className = isAct
      ? ' py-1.5 px-1 rounded-lg bg-sky-500/20 border border-sky-500/60 text-sky-300 text-[10px] font-bold transition flex flex-col items-center justify-center gap-0.5 shadow-sm'
      : ' py-1.5 px-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-[10px] font-medium transition flex flex-col items-center justify-center gap-0.5';
  });

  if (!state.collapsedSidebarCards) state.collapsedSidebarCards = {};
  for (let cNum = 1; cNum <= 6; cNum++) {
    const cardEl = document.getElementById('sidebarCard_' + cNum);
    const bodyEl = document.getElementById('sidebarCardBody_' + cNum);
    const chevEl = document.getElementById('sidebarCardChev_' + cNum);
    const inActiveTab = visibleCards.includes(cNum);
    if (cardEl) {
      cardEl.classList.toggle('hidden', !inActiveTab);
    }
    const isCollapsed = Boolean(state.collapsedSidebarCards[cNum]);
    if (bodyEl) {
      bodyEl.classList.toggle('hidden', isCollapsed);
    }
    if (chevEl) {
      chevEl.textContent = isCollapsed ? '▸' : '▾';
    }
  }
}

function setSidebarTab(tabKey) {
  state.activeSidebarTab = tabKey || 'cut';
  syncSidebarTabsUI();
}

function toggleSidebarCard(cardNum) {
  if (!state.collapsedSidebarCards) state.collapsedSidebarCards = {};
  state.collapsedSidebarCards[cardNum] = !state.collapsedSidebarCards[cardNum];
  syncSidebarTabsUI();
}

function toggle2DLegend() {
  state.legend2DCollapsed = !state.legend2DCollapsed;
  const itemsBox = document.getElementById('canvas2DLegendItems');
  const btn = document.getElementById('btnToggle2DLegend');
  if (itemsBox) {
    itemsBox.classList.toggle('hidden', state.legend2DCollapsed);
    itemsBox.classList.toggle('flex', !state.legend2DCollapsed);
  }
  if (btn) {
    btn.textContent = state.legend2DCollapsed ? '🎨 Leyenda ▸' : '🎨 Leyenda ▾';
  }
}

function toggleBottomStripCollapse() {
  state.bottomStripCollapsed = !state.bottomStripCollapsed;
  const wrap = document.getElementById('bottomStripWrapper');
  const strip = document.getElementById('sliceStripContainer');
  const btn = document.getElementById('btnToggleBottomStrip');
  if (wrap) {
    wrap.className = state.bottomStripCollapsed
      ? 'h-7 bg-slate-900 border-t border-slate-800 flex flex-col shrink-0 transition-all'
      : 'h-28 bg-slate-900 border-t border-slate-800 flex flex-col shrink-0 transition-all';
  }
  if (strip) {
    strip.classList.toggle('hidden', state.bottomStripCollapsed);
  }
  if (btn) {
    btn.textContent = state.bottomStripCollapsed ? '▲ Mostrar tira' : '▼ Compactar';
  }
  // Redimensionar visores 3D y 2D tras cambiar el alto disponible
  if (typeof onWindowResize3D === 'function') {
    setTimeout(() => onWindowResize3D(), 30);
  }
  if (typeof render2DSlice === 'function') {
    setTimeout(() => render2DSlice(), 30);
  }
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
  window.simplifyClosedPolygonPuzzle2D = simplifyClosedPolygonPuzzle2D;
  window.simplifyPuzzleLoopsList = simplifyPuzzleLoopsList;
  window.setPuzzleSimplifyCutLine = setPuzzleSimplifyCutLine;
  window.onPuzzleSimplifyParamsChange = onPuzzleSimplifyParamsChange;
  window.onPuzzleSimplifyTolInput = onPuzzleSimplifyTolInput;
  window.stepPuzzleSimplifyTolerance = stepPuzzleSimplifyTolerance;
  window.setPuzzleSimplifyPreset = setPuzzleSimplifyPreset;
  window.hasAnyPuzzleSelfSupportingRib = hasAnyPuzzleSelfSupportingRib;
  window.isPuzzleRibSelfSupporting = isPuzzleRibSelfSupporting;
  window.toggleSelectedPuzzleRibSelfSupporting = toggleSelectedPuzzleRibSelfSupporting;
  window.setPuzzleSelfSupporting = setPuzzleSelfSupporting;
  window.setPuzzleSelfSupportTarget = setPuzzleSelfSupportTarget;
  window.onPuzzleSelfSupportParamsChange = onPuzzleSelfSupportParamsChange;
  window.onPuzzleSelfSupportClearanceInput = onPuzzleSelfSupportClearanceInput;
  window.stepPuzzleSelfSupportClearance = stepPuzzleSelfSupportClearance;
  window.setPuzzleSelfSupportPreset = setPuzzleSelfSupportPreset;
  window.resetAllPuzzleSelfSupportRibs = resetAllPuzzleSelfSupportRibs;
  window.syncSidebarTabsUI = syncSidebarTabsUI;
  window.setSidebarTab = setSidebarTab;
  window.toggleSidebarCard = toggleSidebarCard;
  window.toggle2DLegend = toggle2DLegend;
  window.toggleBottomStripCollapse = toggleBottomStripCollapse;
}



