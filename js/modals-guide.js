/**
 * LayerStudio 3D (LascaStudio 3D) - Board Inspector & Step-by-Step Assembly Guide
 * Modales de detalle de láminas por tablero y guía interactiva de corte láser y montaje de abajo a arriba.
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
// Abre el modal de información detallando las láminas e islas que contiene el tablero
function openBoardInfoModal(boardIdx) {
  if (!state.nestingEnabled) {
    setNestingEnabled(true);
  }
  const targetIdx = typeof boardIdx === 'number' ? boardIdx : state.activeBoardIndex;
  if (state.nestedBoards.length > 0) {
    state.activeBoardIndex = Math.max(0, Math.min(state.nestedBoards.length - 1, targetIdx));
    const slider = document.getElementById('currentSliceSlider');
    if (slider) slider.value = state.activeBoardIndex;
    update2DInspectorHeader();
    highlightActiveCardInStrip();
    render2DSlice();
  }

  renderBoardInfoModalContent(state.activeBoardIndex);
  const modal = document.getElementById('boardInfoModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeBoardInfoModal() {
  const modal = document.getElementById('boardInfoModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function selectBoardFromModal(bIdx) {
  selectActiveBoard(bIdx);
  renderBoardInfoModalContent(state.activeBoardIndex);
}

function inspectSliceFromBoardModal(sliceIdx, bIdx) {
  state.activeSliceIndex = sliceIdx;
  state.activeBoardIndex = bIdx;
  const slider = document.getElementById('currentSliceSlider');
  if (slider) slider.value = bIdx;
  update2DInspectorHeader();
  update3DSlicesTransforms();
  highlightActiveCardInStrip();
  render2DSlice();
  closeBoardInfoModal();
}

function renderBoardInfoModalContent(bIdx) {
  const tabsBar = document.getElementById('boardInfoTabsBar');
  const metricsGrid = document.getElementById('boardInfoMetricsGrid');
  const listContainer = document.getElementById('boardInfoListContainer');
  const titleEl = document.getElementById('boardInfoModalTitle');
  const subEl = document.getElementById('boardInfoModalSub');

  const f = getUnitFactor();
  const dec = state.unit === 'm' ? 3 : (state.unit === 'cm' ? 1 : 1);
  const u = state.unit;

  if (state.nestedBoards.length === 0) {
    titleEl.textContent = 'Detalle del Tablero — Sin piezas';
    subEl.textContent = 'No hay islas empaquetadas con la configuración actual';
    tabsBar.innerHTML = '';
    metricsGrid.innerHTML = '';
    listContainer.innerHTML =
      '<div class="p-6 text-center text-xs text-rose-400 bg-rose-950/20 border border-rose-500/30 rounded-xl">' +
      (state.unfitIslandsCount > 0
        ? '⚠️ Ninguna pieza cabe en el tamaño de tablero actual (' + state.unfitIslandsCount + ' islas superan las medidas del tablero).'
        : 'No hay lascas seleccionadas para distribuir en el tablero.') +
      '</div>';
    return;
  }

  const board = state.nestedBoards[bIdx] || state.nestedBoards[0];
  titleEl.textContent = 'Detalle de Contenido — Tablero #' + (board.boardIndex + 1) + ' de ' + state.nestedBoards.length;
  subEl.textContent =
    'Dimensiones del tablero: ' + (board.width / f).toFixed(dec) + ' × ' + (board.height / f).toFixed(dec) + ' ' + u +
    ' (Margen: ' + board.margin + ' mm | Separación: ' + state.nestSpacingMM + ' mm)';

  // 1. Pestañas para cambiar entre tableros si hay varios
  tabsBar.innerHTML = '';
  state.nestedBoards.forEach((b, idx) => {
    const btn = document.createElement('button');
    const isCurrent = idx === board.boardIndex;
    btn.className = isCurrent
      ? 'px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500 text-emerald-300 text-xs font-bold shrink-0 transition'
      : 'px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium shrink-0 transition';
    btn.textContent = 'Tablero #' + (idx + 1) + ' (' + b.placements.length + ' islas)';
    btn.onclick = () => selectBoardFromModal(idx);
    tabsBar.appendChild(btn);
  });

  // 2. Agrupar las islas de este tablero por número de lámina (lasca)
  const sliceGroupsMap = new Map();
  board.placements.forEach((pl) => {
    const sIdx = pl.island.sliceIndex;
    if (!sliceGroupsMap.has(sIdx)) {
      sliceGroupsMap.set(sIdx, {
        sliceIndex: sIdx,
        coord: state.slices[sIdx] ? state.slices[sIdx].coord : 0,
        totalIslandsInSlice: pl.island.totalIslandsInSlice,
        placements: []
      });
    }
    sliceGroupsMap.get(sIdx).placements.push(pl);
  });

  const sliceGroups = Array.from(sliceGroupsMap.values()).sort((a, b) => a.sliceIndex - b.sliceIndex);
  const uniqueSlicesNums = sliceGroups.map((g) => '#' + (g.sliceIndex + 1)).join(', ');

  // 3. Resumen de métricas del tablero
  metricsGrid.innerHTML =
    '<div class="bg-slate-800/70 border border-slate-700/70 rounded-xl p-2.5">' +
      '<span class="text-[10px] text-slate-400 block uppercase font-bold">Láminas Presentes</span>' +
      '<span class="text-sm font-bold text-sky-300">' + sliceGroups.length + ' lámina(s)</span>' +
      '<span class="text-[10px] text-slate-400 truncate block" title="' + uniqueSlicesNums + '">' + uniqueSlicesNums + '</span>' +
    '</div>' +
    '<div class="bg-slate-800/70 border border-slate-700/70 rounded-xl p-2.5">' +
      '<span class="text-[10px] text-slate-400 block uppercase font-bold">Total Islas / Piezas</span>' +
      '<span class="text-sm font-bold text-emerald-300">' + board.placements.length + ' pieza(s)</span>' +
      '<span class="text-[10px] text-slate-400 block">Anidadas en este tablero</span>' +
    '</div>' +
    '<div class="bg-slate-800/70 border border-slate-700/70 rounded-xl p-2.5">' +
      '<span class="text-[10px] text-slate-400 block uppercase font-bold">Aprovechamiento</span>' +
      '<span class="text-sm font-bold text-amber-300">' + board.efficiency.toFixed(1) + '%</span>' +
      '<span class="text-[10px] text-slate-400 block">Área: ' + (board.usedArea / 100).toFixed(1) + ' cm²</span>' +
    '</div>' +
    '<div class="bg-slate-800/70 border border-slate-700/70 rounded-xl p-2.5">' +
      '<span class="text-[10px] text-slate-400 block uppercase font-bold">Eje y Grosor</span>' +
      '<span class="text-sm font-bold text-indigo-300">Eje ' + state.axis.toUpperCase() + '</span>' +
      '<span class="text-[10px] text-slate-400 block">' + state.thickness.toFixed(2) + ' mm / lámina</span>' +
    '</div>';

  // 4. Construir listado detallado por cada lámina contenida en el tablero
  listContainer.innerHTML = '';

  if (state.clippedIslandsCount > 0) {
    const clipInfoDiv = document.createElement('div');
    clipInfoDiv.className = 'p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between';
    clipInfoDiv.innerHTML =
      '<span>✂️ Se han incluido <strong>' + state.clippedIslandsCount + ' isla(s)</strong> mayores que el tablero recortando la parte que sobresalía.</span>';
    listContainer.appendChild(clipInfoDiv);
  }

  if (state.unfitIslandsCount > 0) {
    const warnDiv = document.createElement('div');
    warnDiv.className = 'p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-wrap items-center justify-between gap-2';
    warnDiv.innerHTML =
      '<span>⚠️ Hay <strong>' + state.unfitIslandsCount + ' isla(s)</strong> cuyas dimensiones superan el tamaño del tablero y no se han incluido.</span>' +
      '<button onclick="setNestClipOversized(true); renderBoardInfoModalContent(state.activeBoardIndex);" class="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[11px] font-bold transition">' +
        '✂️ Recortar e incluir' +
      '</button>';
    listContainer.appendChild(warnDiv);
  }

  sliceGroups.forEach((group) => {
    const isCompleteInThisBoard = group.placements.length === group.totalIslandsInSlice;
    const isActiveSlice = group.sliceIndex === state.activeSliceIndex;

    const card = document.createElement('div');
    card.className =
      'rounded-xl border p-3 transition cursor-pointer ' +
      (isActiveSlice
        ? 'bg-sky-500/15 border-sky-500/60'
        : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/80');
    card.onclick = () => inspectSliceFromBoardModal(group.sliceIndex, board.boardIndex);

    const statusBadge = isCompleteInThisBoard
      ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">Lámina completa (' + group.placements.length + '/' + group.totalIslandsInSlice + ' islas)</span>'
      : '<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">Parcial en este tablero (' + group.placements.length + ' de ' + group.totalIslandsInSlice + ' islas)</span>';

    let islandsRowsHTML = '';
    group.placements.forEach((pl) => {
      const isl = pl.island;
      const islandCode = isl.totalIslandsInSlice > 1
        ? '#' + (isl.sliceIndex + 1) + '.' + (isl.islandIdxInSlice + 1)
        : '#' + (isl.sliceIndex + 1);

      const hasSup = state.includeNextSliceGuide && pl.upperPolys && pl.upperPolys.length > 0;
      const hasInf = state.includePrevSliceGuide && pl.lowerPolys && pl.lowerPolys.length > 0;
      let guideTag = '<span class="text-slate-400">Sin guía</span>';
      if (hasSup && hasInf) guideTag = '<span class="text-emerald-300 font-semibold">Ambas (Sup+Inf)</span>';
      else if (hasSup) guideTag = '<span class="text-amber-300 font-semibold">Guía Sup (#N+1)</span>';
      else if (hasInf) guideTag = '<span class="text-fuchsia-300 font-semibold">Guía Inf (#N-1)</span>';

      const rotTag = pl.rotated
        ? '<span class="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px]">Rotada 90°</span>'
        : '<span class="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 text-[10px]">0° Original</span>';

      const clipTag = pl.isClippedToBoard
        ? '<span class="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-semibold" title="Tamaño original antes de recortar: ' + (pl.origWidth / f).toFixed(dec) + ' × ' + (pl.origHeight / f).toFixed(dec) + ' ' + u + '">✂️ Recortada (Orig: ' + (pl.origWidth / f).toFixed(dec) + '×' + (pl.origHeight / f).toFixed(dec) + ')</span>'
        : '';

      islandsRowsHTML +=
        '<div class="flex flex-wrap items-center justify-between gap-2 py-1.5 px-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px]">' +
          '<div class="flex items-center gap-2">' +
            '<span class="font-mono font-bold text-emerald-400">' + islandCode + '</span>' +
            '<span class="text-slate-300">Medida: <strong>' + (pl.w / f).toFixed(dec) + ' × ' + (pl.h / f).toFixed(dec) + ' ' + u + '</strong></span>' +
            clipTag +
            (pl.holes.length > 0 ? '<span class="text-sky-400 text-[10px]">(' + pl.holes.length + ' hueco' + (pl.holes.length > 1 ? 's' : '') + ')</span>' : '') +
          '</div>' +
          '<div class="flex items-center gap-2">' +
            guideTag +
            rotTag +
            '<span class="text-[10px] font-mono text-slate-400">Pos: (' + (pl.x / f).toFixed(dec) + ', ' + (pl.y / f).toFixed(dec) + ')</span>' +
          '</div>' +
        '</div>';
    });

    card.innerHTML =
      '<div class="flex flex-wrap items-center justify-between gap-2 mb-2">' +
        '<div class="flex items-center gap-2">' +
          '<span class="text-xs font-bold text-white px-2 py-0.5 rounded bg-sky-600">Lámina #' + (group.sliceIndex + 1) + '</span>' +
          '<span class="text-xs font-mono text-sky-300">' + state.axis.toUpperCase() + ' = ' + group.coord.toFixed(2) + ' mm</span>' +
        '</div>' +
        '<div class="flex items-center gap-2">' +
          statusBadge +
          '<span class="text-[11px] text-sky-400 hover:underline font-medium">Ver en 3D/2D →</span>' +
        '</div>' +
      '</div>' +
      '<div class="space-y-1">' +
        islandsRowsHTML +
      '</div>';

    listContainer.appendChild(card);
  });
}

// =========================================================================
// GUÍA DE CORTE / IMPRESIÓN Y MONTAJE PASO A PASO (DE ABAJO A ARRIBA)
// =========================================================================
function openAssemblyGuideModal() {
  if (!state.nestingEnabled) {
    setNestingEnabled(true);
  } else {
    recomputeBoardNesting();
  }
  renderAssemblyGuideModalContent();
  const modal = document.getElementById('assemblyGuideModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeAssemblyGuideModal() {
  const modal = document.getElementById('assemblyGuideModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function switchAssemblyGuideTab(tab) {
  state.assemblyGuideTab = tab;
  ['all', 'cutting', 'assembly'].forEach((k) => {
    const btn = document.getElementById('guideTab_' + k);
    if (!btn) return;
    if (k === tab) {
      btn.className = 'px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500 text-amber-300 text-xs font-bold transition';
    } else {
      btn.className = 'px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium transition';
    }
  });
  renderAssemblyGuideModalContent();
}

function toggleSliceAssembledCheck(sliceIdx, checked) {
  state.assembledSlicesDone[sliceIdx] = Boolean(checked);
  renderAssemblyGuideModalContent();
}

function resetAssemblyChecklist() {
  state.assembledSlicesDone = {};
  renderAssemblyGuideModalContent();
}

function jumpToSliceAndBoardFromGuide(sliceIdx, boardIdx) {
  state.activeSliceIndex = sliceIdx;
  if (typeof boardIdx === 'number' && boardIdx >= 0 && boardIdx < state.nestedBoards.length) {
    state.activeBoardIndex = boardIdx;
    const slider = document.getElementById('currentSliceSlider');
    if (slider) slider.value = boardIdx;
  }
  update2DInspectorHeader();
  update3DSlicesTransforms();
  highlightActiveCardInStrip();
  render2DSlice();
  closeAssemblyGuideModal();
}

// Construye el mapa de ubicación de cada lámina e isla en los tableros para la guía de montaje
function buildAssemblyAndCuttingPlan() {
  const selectedSlices = state.slices.filter((s) => s.selected && s.loops && s.loops.some((l) => !l.isHole));
  // mapa: sliceIndex -> [{ islandCode, islandIdx, boardIndex, rotated, w, h, x, y, hasSup, hasInf, holesCount }]
  const slicePlacementsMap = new Map();

  state.nestedBoards.forEach((board) => {
    board.placements.forEach((pl) => {
      const isl = pl.island;
      const sIdx = isl.sliceIndex;
      if (!slicePlacementsMap.has(sIdx)) {
        slicePlacementsMap.set(sIdx, []);
      }
      const islandCode = isl.totalIslandsInSlice > 1
        ? '#' + (sIdx + 1) + '.' + (isl.islandIdxInSlice + 1)
        : '#' + (sIdx + 1);
      const hasSup = state.includeNextSliceGuide && pl.upperPolys && pl.upperPolys.length > 0;
      const hasInf = state.includePrevSliceGuide && pl.lowerPolys && pl.lowerPolys.length > 0;

      slicePlacementsMap.get(sIdx).push({
        islandCode: islandCode,
        islandIdx: isl.islandIdxInSlice,
        totalIslandsInSlice: isl.totalIslandsInSlice,
        boardIndex: board.boardIndex,
        rotated: pl.rotated,
        isClippedToBoard: Boolean(pl.isClippedToBoard),
        origWidth: pl.origWidth || pl.w,
        origHeight: pl.origHeight || pl.h,
        w: pl.w,
        h: pl.h,
        x: pl.x,
        y: pl.y,
        hasSup: hasSup,
        hasInf: hasInf,
        holesCount: pl.holes.length
      });
    });
  });

  // Ordenar las islas dentro de cada lámina por su subíndice (#N.1, #N.2...)
  slicePlacementsMap.forEach((list) => {
    list.sort((a, b) => a.islandIdx - b.islandIdx);
  });

  // Determinar el orden recomendado de corte de tableros para poder empezar a montar desde abajo (#1 -> #N)
  const boardPriorityOrder = [];
  const seenBoards = new Set();
  selectedSlices.forEach((s) => {
    const pls = slicePlacementsMap.get(s.index) || [];
    pls.forEach((p) => {
      if (!seenBoards.has(p.boardIndex)) {
        seenBoards.add(p.boardIndex);
        boardPriorityOrder.push(p.boardIndex);
      }
    });
  });
  state.nestedBoards.forEach((b) => {
    if (!seenBoards.has(b.boardIndex)) {
      seenBoards.add(b.boardIndex);
      boardPriorityOrder.push(b.boardIndex);
    }
  });

  return {
    selectedSlices,
    slicePlacementsMap,
    boardPriorityOrder
  };
}

function renderAssemblyGuideModalContent() {
  const container = document.getElementById('assemblyGuideContent');
  const subEl = document.getElementById('assemblyGuideSub');
  const progBadge = document.getElementById('assemblyProgressBadge');
  if (!container) return;

  const f = getUnitFactor();
  const dec = state.unit === 'm' ? 3 : 1;
  const u = state.unit;
  const axisName = state.axis.toUpperCase();

  const plan = buildAssemblyAndCuttingPlan();
  const activeSlices = plan.selectedSlices;
  const totalSteps = activeSlices.length;
  const doneCount = activeSlices.filter((s) => state.assembledSlicesDone[s.index]).length;

  if (progBadge) {
    progBadge.textContent = 'Progreso montaje: ' + doneCount + ' / ' + totalSteps + ' capas';
  }

  const totalIslandsPacked = state.nestedBoards.reduce((acc, b) => acc + b.placements.length, 0);
  if (subEl) {
    subEl.textContent =
      'Pieza: ' + state.modelName + ' | Eje ' + axisName + ' (de abajo a arriba) | ' +
      totalSteps + ' láminas activas (' + totalIslandsPacked + ' islas en ' + state.nestedBoards.length + ' tableros de ' +
      (state.boardWidthMM / f).toFixed(dec) + '×' + (state.boardHeightMM / f).toFixed(dec) + ' ' + u + ')';
  }

  if (state.nestedBoards.length === 0) {
    container.innerHTML =
      '<div class="p-6 text-center text-xs text-rose-400 bg-rose-950/20 border border-rose-500/30 rounded-xl">' +
      (state.unfitIslandsCount > 0
        ? '⚠️ Ninguna pieza cabe en las dimensiones actuales del tablero. Aumenta el ancho o alto del tablero en la sección 5.'
        : 'No hay láminas seleccionadas para generar la guía de corte y montaje.') +
      '</div>';
    return;
  }

  let html = '';

  // =======================================================================
  // SECCIÓN 1: ORDEN DE CORTE / IMPRESIÓN (PARÁMETROS LÁSER Y TABLEROS)
  // =======================================================================
  if (state.assemblyGuideTab === 'all' || state.assemblyGuideTab === 'cutting') {
    const priorityStr = plan.boardPriorityOrder.map((bIdx, i) =>
      '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-[11px]">' +
      (i + 1) + 'º → Tablero #' + (bIdx + 1) + '</span>'
    ).join('<span class="text-slate-500 mx-1">➔</span>');

    let boardsCardsHTML = '';
    state.nestedBoards.forEach((board, bIdx) => {
      // Agrupar piezas por lámina para mostrar resumen claro de qué cortar en este tablero
      const bySlice = new Map();
      board.placements.forEach((pl) => {
        const sNum = pl.island.sliceIndex + 1;
        const code = pl.island.totalIslandsInSlice > 1
          ? '#' + sNum + '.' + (pl.island.islandIdxInSlice + 1)
          : '#' + sNum;
        if (!bySlice.has(sNum)) bySlice.set(sNum, []);
        bySlice.get(sNum).push({ code, rotated: pl.rotated });
      });

      const sortedSliceNums = Array.from(bySlice.keys()).sort((a, b) => a - b);
      const minSlice = sortedSliceNums[0];
      const maxSlice = sortedSliceNums[sortedSliceNums.length - 1];

      const chipsHTML = sortedSliceNums.map((sNum) => {
        const items = bySlice.get(sNum);
        const label = items.map((it) => it.code + (it.rotated ? '🔄' : '')).join(', ');
        return '<span class="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-200">' + label + '</span>';
      }).join(' ');

      boardsCardsHTML +=
        '<div class="p-3 rounded-xl bg-slate-800/60 border border-slate-700/80 flex flex-col justify-between gap-2">' +
          '<div class="flex flex-wrap items-center justify-between gap-2">' +
            '<div class="flex items-center gap-2">' +
              '<span class="px-2.5 py-0.5 rounded-md bg-emerald-600 text-white text-xs font-bold">Tablero #' + (bIdx + 1) + '</span>' +
              '<span class="text-xs text-slate-300 font-semibold">' + board.placements.length + ' piezas (' + sortedSliceNums.length + ' láminas: de #' + minSlice + ' a #' + maxSlice + ')</span>' +
            '</div>' +
            '<div class="flex items-center gap-2">' +
              '<span class="text-[11px] text-amber-300 font-mono">Uso: ' + board.efficiency.toFixed(1) + '%</span>' +
              '<button onclick="closeAssemblyGuideModal(); selectActiveBoard(' + bIdx + ');" class="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-[10px] font-semibold">Ver Tablero →</button>' +
            '</div>' +
          '</div>' +
          '<div class="flex flex-wrap gap-1 pt-1 border-t border-slate-700/50">' +
            chipsHTML +
          '</div>' +
        '</div>';
    });

    html +=
      '<section class="space-y-3">' +
        '<div class="flex items-center justify-between border-b border-slate-800 pb-2">' +
          '<h4 class="text-xs font-bold uppercase tracking-wider text-amber-400">🔥 1. Orden Recomendado de Corte / Impresión</h4>' +
          '<span class="text-[11px] text-slate-400">Configuración de capas láser y secuencia de tableros</span>' +
        '</div>' +

        '<!-- Orden de capas dentro de cada tablero para máquina láser -->' +
        '<div class="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">' +
          '<span class="text-[11px] font-bold text-sky-300 block">A) Orden de Prioridad de Capas en la Cortadora Láser (dentro de cada Tablero):</span>' +
          '<div class="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">' +
            '<div class="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30">' +
              '<span class="font-bold text-emerald-400 block">1º GRABADO TEXTO (#008800)</span>' +
              '<span class="text-slate-400 text-[10px]">Graba primero el código <code>#N</code> e indicador <code>[Sup/Inf/Ambas]</code> mientras el tablero está intacto.</span>' +
            '</div>' +
            '<div class="p-2 rounded-lg bg-amber-950/30 border border-amber-500/30">' +
              '<span class="font-bold text-amber-300 block">2º GUÍAS PEGADO (#ff8800 / #9900ff)</span>' +
              '<span class="text-slate-400 text-[10px]">Marcado vectorial continuo rápido (alta velocidad, baja potencia) de las siluetas guía.</span>' +
            '</div>' +
            '<div class="p-2 rounded-lg bg-sky-950/30 border border-sky-500/30">' +
              '<span class="font-bold text-sky-300 block">3º CORTE HUECOS (#0055ff)</span>' +
              '<span class="text-slate-400 text-[10px]">Corta siempre los agujeros internos y taladros de varilla antes de soltar el contorno exterior.</span>' +
            '</div>' +
            '<div class="p-2 rounded-lg bg-rose-950/30 border border-rose-500/30">' +
              '<span class="font-bold text-rose-400 block">4º CORTE EXTERIOR (#ff0000)</span>' +
              '<span class="text-slate-400 text-[10px]">Corta en último lugar el perímetro exterior de cada isla para evitar que la pieza se mueva.</span>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<!-- Orden de los tableros -->' +
        '<div class="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2.5">' +
          '<div class="space-y-1">' +
            '<span class="text-[11px] font-bold text-emerald-300 block">B) ¿En qué orden cortar los Tableros?</span>' +
            '<p class="text-[11px] text-slate-300">Como el anidado agrupa las islas de mayor a menor tamaño para aprovechar al máximo la madera/metacrilato, tienes dos formas de proceder:</p>' +
          '</div>' +
          '<div class="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-1.5">' +
            '<div><strong class="text-amber-300">Opción Rápida (empezar a montar desde la base mientras el láser sigue cortando):</strong> Corta los tableros en este orden para disponer primero de las capas inferiores (<code>#1, #2, #3...</code>):</div>' +
            '<div class="flex flex-wrap items-center gap-1 pt-1">' + priorityStr + '</div>' +
          '</div>' +
          '<div class="space-y-2 pt-1">' +
            boardsCardsHTML +
          '</div>' +
        '</div>' +
      '</section>';
  }

  // =======================================================================
  // SECCIÓN 2: GUÍA DE MONTAJE DE ABAJO A ARRIBA (CAPA #1 -> CAPA #N)
  // =======================================================================
  if (state.assemblyGuideTab === 'all' || state.assemblyGuideTab === 'assembly') {
    let stepsHTML = '';

    activeSlices.forEach((slice, stepIdx) => {
      const sIdx = slice.index;
      const sNum = sIdx + 1;
      const isBase = stepIdx === 0;
      const isTop = stepIdx === activeSlices.length - 1;
      const isDone = Boolean(state.assembledSlicesDone[sIdx]);
      const pls = plan.slicePlacementsMap.get(sIdx) || [];
      const accumHeightMM = (stepIdx + 1) * state.thickness;

      let roleBadge = '<span class="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-semibold">Capa Intermedia</span>';
      if (isBase) {
        roleBadge = '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">🟢 BASE INFERIOR (1ª en colocar)</span>';
      } else if (isTop) {
        roleBadge = '<span class="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold">🏁 CIMA SUPERIOR (Última capa)</span>';
      }

      // Instrucción de cómo alinear y pegar esta capa respecto a la inferior y superior
      let instructionText = '';
      if (isBase) {
        instructionText =
          '1. Localiza ' + (pls.length > 1 ? 'las <strong>' + pls.length + ' islas</strong> de ' : 'la pieza de ') + 'la <strong>Lámina #' + sNum + '</strong> y apóyala plana sobre la mesa como <strong>BASE INFERIOR</strong>' +
          (state.rodCount > 0 ? ' (inserta las ' + state.rodCount + ' varillas guía de Ø' + state.rodDiameter + 'mm en sus orificios).' : '.') +
          (state.includeNextSliceGuide ? ' Verás grabada encima la <strong>línea naranja continua (Guía Sup)</strong> donde irá pegada la Lámina #' + (sNum + 1) + '.' : '');
      } else if (isTop) {
        instructionText =
          '1. Aplica adhesivo en la zona delimitada por la guía naranja de la <strong>Lámina #' + sIdx + '</strong> (ya montada debajo). ' +
          '2. Coloca encima ' + (pls.length > 1 ? 'las piezas de ' : '') + 'la <strong>Lámina #' + sNum + '</strong> haciéndola coincidir con la silueta guía' +
          (state.includePrevSliceGuide ? ' (puedes verificar el encaje por su guía inferior violeta).' : '.') +
          ' ¡Con esta capa finalizas la coronación de la pieza!';
      } else {
        instructionText =
          '1. Aplica adhesivo dentro de la silueta naranja grabada sobre la <strong>Lámina #' + sIdx + '</strong> (montada en el paso anterior). ' +
          '2. Asienta ' + (pls.length > 1 ? 'cada isla de ' : '') + 'la <strong>Lámina #' + sNum + '</strong> alineando su contorno (y su guía inferior <code>[Inf]</code> si sobresale en voladizo) con la capa inferior. ' +
          '3. Deja hacia arriba la cara con la guía naranja <code>[Sup]</code> para recibir después la <strong>Lámina #' + (sNum + 1) + '</strong>.';
      }

      // Tarjetas de cada isla perteneciente a esta lámina indicando en qué tablero buscarla
      let islandsLocateHTML = '';
      if (pls.length === 0) {
        islandsLocateHTML =
          '<div class="p-2 rounded-lg bg-rose-950/30 border border-rose-500/40 text-rose-300 text-[11px]">' +
            '⚠️ Esta lámina supera las dimensiones del tablero actual y no ha podido ser anidada.' +
          '</div>';
      } else {
        islandsLocateHTML = pls.map((p) => {
          let guideBadge = '<span class="text-slate-400">[Sin guía]</span>';
          if (p.hasSup && p.hasInf) guideBadge = '<span class="text-emerald-300 font-semibold">[Ambas: Sup+Inf]</span>';
          else if (p.hasSup) guideBadge = '<span class="text-amber-300 font-semibold">[Guía Sup]</span>';
          else if (p.hasInf) guideBadge = '<span class="text-fuchsia-300 font-semibold">[Guía Inf]</span>';

          const rotWarning = p.rotated
            ? '<span class="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-semibold" title="Esta pieza se giró 90° en el tablero para optimizar espacio. Gírala 90° al montarla para que el texto grabado quede horizontal.">🔄 Girada 90° en tablero (enderezar al pegar)</span>'
            : '<span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">Orientación 0° directa</span>';

          const clipBadge = p.isClippedToBoard
            ? '<span class="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-semibold">✂️ Recortada al tablero</span>'
            : '';

          return (
            '<div class="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px]">' +
              '<div class="flex items-center gap-2 flex-wrap">' +
                '<span class="font-mono font-bold text-emerald-400 text-xs">Isla ' + p.islandCode + '</span>' +
                '<span class="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-500/40 text-sky-300 font-bold">📍 Buscar en Tablero #' + (p.boardIndex + 1) + '</span>' +
                '<span class="text-slate-400 font-mono text-[10px]">Pos: (' + (p.x / f).toFixed(dec) + ', ' + (p.y / f).toFixed(dec) + ') ' + u + ' | ' + (p.w / f).toFixed(dec) + '×' + (p.h / f).toFixed(dec) + ' ' + u + '</span>' +
                clipBadge +
              '</div>' +
              '<div class="flex items-center gap-2 flex-wrap">' +
                guideBadge +
                rotWarning +
                '<button onclick="jumpToSliceAndBoardFromGuide(' + sIdx + ', ' + p.boardIndex + ')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-[10px] font-semibold">👁️ Ver en Tablero</button>' +
              '</div>' +
            '</div>'
          );
        }).join('');
      }

      stepsHTML +=
        '<div class="rounded-xl border p-3.5 transition space-y-2.5 ' +
          (isDone ? 'bg-emerald-950/20 border-emerald-500/40 opacity-80' : 'bg-slate-800/50 border-slate-700/80') + '">' +
          '<div class="flex flex-wrap items-center justify-between gap-2">' +
            '<div class="flex items-center gap-2.5 flex-wrap">' +
              '<label class="flex items-center gap-2 cursor-pointer">' +
                '<input type="checkbox" ' + (isDone ? 'checked' : '') + ' onchange="toggleSliceAssembledCheck(' + sIdx + ', this.checked)" class="w-4 h-4 accent-emerald-500 rounded cursor-pointer" />' +
                '<span class="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">Paso ' + (stepIdx + 1) + ' de ' + totalSteps + '</span>' +
              '</label>' +
              '<span class="text-sm font-bold text-white">Lámina #' + sNum + '</span>' +
              roleBadge +
            '</div>' +
            '<div class="flex items-center gap-2 text-[11px] font-mono">' +
              '<span class="text-sky-300">' + axisName + ' = ' + slice.coord.toFixed(2) + ' mm</span>' +
              '<span class="text-slate-400">| Altura acum.: ' + accumHeightMM.toFixed(1) + ' mm</span>' +
            '</div>' +
          '</div>' +

          '<p class="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">' +
            instructionText +
          '</p>' +

          '<div class="space-y-1.5">' +
            islandsLocateHTML +
          '</div>' +
        '</div>';
    });

    html +=
      '<section class="space-y-3">' +
        '<div class="flex items-center justify-between border-b border-slate-800 pb-2">' +
          '<h4 class="text-xs font-bold uppercase tracking-wider text-emerald-400">🧱 2. Secuencia de Montaje Paso a Paso (De Abajo a Arriba)</h4>' +
          '<span class="text-[11px] text-slate-400">Empieza por la Lámina #1 (Base inferior) y sube en orden numérico</span>' +
        '</div>' +
        '<div class="space-y-2.5">' +
          stepsHTML +
        '</div>' +
      '</section>';
  }

  container.innerHTML = html;
}

// Genera el texto completo de la Guía de Corte y Montaje (para descargar en .TXT e incluir en el .ZIP)
function generateFullAssemblyGuideText() {
  const plan = buildAssemblyAndCuttingPlan();
  const axisName = state.axis.toUpperCase();
  const lines = [
    '========================================================================',
    'GUÍA DE CORTE / IMPRESIÓN Y MONTAJE PASO A PASO (DE ABAJO A ARRIBA)',
    '========================================================================',
    'Modelo: ' + state.modelName,
    'Dimensiones totales de la pieza: ' + state.dimsMM.x.toFixed(2) + ' x ' + state.dimsMM.y.toFixed(2) + ' x ' + state.dimsMM.z.toFixed(2) + ' mm',
    'Eje perpendicular de laminado: Eje ' + axisName + ' (Montaje de menor a mayor cota ' + axisName + ')',
    'Grosor por lámina: ' + state.thickness.toFixed(2) + ' mm',
    'Total láminas a montar: ' + plan.selectedSlices.length,
    'Varillas guía de alineación: ' + (state.rodCount > 0 ? (state.rodCount + ' varilla(s) de Ø' + state.rodDiameter + ' mm') : 'Sin varillas (alineación por guías grabadas)'),
    'Micro-uniones de sujeción (corte por presión): ' + (state.tabsEnabled
      ? (state.tabMode === 'count'
          ? ('ACTIVAS (' + state.tabCount + ' puntos sin cortar de ' + state.tabWidthMM.toFixed(1) + ' mm por pieza para desprender a presión)')
          : ('ACTIVAS (1 punto de ' + state.tabWidthMM.toFixed(1) + ' mm cada ' + state.tabSpacingMM.toFixed(0) + ' mm de perímetro)'))
      : 'Desactivadas (corte perimetral 100% continuo)'),
    'Tableros generados: ' + state.nestedBoards.length + ' tablero(s) de ' + state.boardWidthMM.toFixed(0) + ' x ' + state.boardHeightMM.toFixed(0) + ' mm',
    '',
    '------------------------------------------------------------------------',
    '1. ORDEN DE CORTE EN LÁSER / CNC (DENTRO DE CADA TABLERO)',
    '------------------------------------------------------------------------',
    'Configura tu software láser (LightBurn / RDWorks / Inkscape) en este orden de capas:',
    '  1º VERDE   (#008800) - GRABADO DE TEXTO: Graba el número #N y guía [Sup/Inf/Ambas].',
    '  2º NARANJA (#ff8800) - GUÍA LÁMINA SUPERIOR (#N+1): Marcado continuo rápido superficial.',
    '  3º VIOLETA (#9900ff) - GUÍA LÁMINA INFERIOR (#N-1): Marcado continuo rápido superficial.',
    '  4º AZUL    (#0055ff) - CORTE INTERIOR: Corta primero huecos internos y agujeros de varilla.',
    '  5º ROJO    (#ff0000) - CORTE EXTERIOR: Corta al final el contorno exterior de cada isla.',
    '',
    'ORDEN RECOMENDADO DE TABLEROS (para empezar a montar desde la base #1):',
    '  ' + plan.boardPriorityOrder.map((bIdx, i) => (i + 1) + 'º Tablero #' + (bIdx + 1)).join('  -->  '),
    ''
  ];

  state.nestedBoards.forEach((board, bIdx) => {
    const codes = board.placements.map((pl) => {
      const sNum = pl.island.sliceIndex + 1;
      const code = pl.island.totalIslandsInSlice > 1 ? ('#' + sNum + '.' + (pl.island.islandIdxInSlice + 1)) : ('#' + sNum);
      return code + (pl.rotated ? ' (Rotada 90°)' : '');
    });
    lines.push('  * TABLERO #' + (bIdx + 1) + ' (' + board.placements.length + ' piezas | Uso ' + board.efficiency.toFixed(1) + '%): ' + codes.join(', '));
  });

  lines.push('');
  lines.push('------------------------------------------------------------------------');
  lines.push('2. SECUENCIA DE MONTAJE PASO A PASO (DE ABAJO A ARRIBA: #1 -> #' + state.slices.length + ')');
  lines.push('------------------------------------------------------------------------');

  plan.selectedSlices.forEach((slice, stepIdx) => {
    const sIdx = slice.index;
    const sNum = sIdx + 1;
    const pls = plan.slicePlacementsMap.get(sIdx) || [];
    const accumH = (stepIdx + 1) * state.thickness;
    const role = stepIdx === 0 ? '[BASE INFERIOR]' : (stepIdx === plan.selectedSlices.length - 1 ? '[CIMA SUPERIOR]' : '[CAPA INTERMEDIA]');

    lines.push('');
    lines.push('PASO ' + (stepIdx + 1) + ' — LÁMINA #' + sNum + ' ' + role + ' (Cota ' + axisName + ' = ' + slice.coord.toFixed(2) + ' mm | Altura acumulada: ' + accumH.toFixed(1) + ' mm)');
    if (pls.length === 0) {
      lines.push('  ! Pieza no empaquetada (supera las dimensiones del tablero actual).');
    } else {
      pls.forEach((p) => {
        const gType = (p.hasSup && p.hasInf) ? '[Ambas Guías]' : (p.hasSup ? '[Guía Sup]' : (p.hasInf ? '[Guía Inf]' : '[Sin guía]'));
        const rotNote = p.rotated ? ' | ATENCIÓN: Cortada rotada 90° en el tablero -> Enderezar al montar' : ' | Orientación 0° directa';
        const clipNote = p.isClippedToBoard ? (' | RECORTADA AL TABLERO (Orig: ' + p.origWidth.toFixed(1) + 'x' + p.origHeight.toFixed(1) + ' mm)') : '';
        lines.push('  - Isla ' + p.islandCode + ': Extraer de TABLERO #' + (p.boardIndex + 1) + ' en pos (' + p.x.toFixed(1) + ', ' + p.y.toFixed(1) + ' mm) | Medida ' + p.w.toFixed(1) + 'x' + p.h.toFixed(1) + ' mm | ' + gType + rotNote + clipNote);
      });
    }

    if (stepIdx === 0) {
      lines.push('  > Montaje: Coloca esta lámina como BASE en la mesa. Usa su guía naranja superior (#N+1) para pegar encima el Paso 2.');
    } else if (stepIdx === plan.selectedSlices.length - 1) {
      lines.push('  > Montaje: Pega esta última capa sobre la guía naranja de la Lámina #' + sIdx + ' inferior para coronar la pieza.');
    } else {
      lines.push('  > Montaje: Pégala haciendo coincidir su base con la guía naranja de la Lámina #' + sIdx + ' inferior. Deja visible hacia arriba la guía naranja para la Lámina #' + (sNum + 1) + '.');
    }
  });

  lines.push('');
  lines.push('========================================================================');
  lines.push('CRÉDITOS, AUTORÍA Y LICENCIA — LAYERSTUDIO 3D (LASCASTUDIO 3D)');
  lines.push('========================================================================');
  lines.push('Autor: Norberto Martín Afonso <normaafo@gmail.com>');
  lines.push('Licencia: GNU Affero General Public License v3.0 (AGPL-3.0-or-later)');
  lines.push('          con cláusula de atribución obligatoria (Sección 7b).');
  lines.push('Repositorio: https://github.com/nmarafo/layerstudio3D');
  lines.push('Redes sociales:');
  lines.push('  - X (Twitter):  https://x.com/NorbertoMartnAf (@NorbertoMartnAf)');
  lines.push('  - GitHub:       https://github.com/nmarafo (@nmarafo)');
  lines.push('  - Hugging Face: https://huggingface.co/nmarafo (@nmarafo)');
  lines.push('  - Instagram:    https://instagram.com/nmar_afo (@nmar_afo)');

  return lines.join('\n');
}

function downloadAssemblyGuideTxt() {
  const txt = generateFullAssemblyGuideText();
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  triggerBrowserDownload(blob, state.modelName + '_GUIA_CORTE_Y_MONTAJE.txt');
}

// ============================================================================
// MODAL DE CRÉDITOS, AUTORÍA, LICENCIA Y REDES SOCIALES
// ============================================================================
function openCreditsModal() {
  const modal = document.getElementById('creditsModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeCreditsModal() {
  const modal = document.getElementById('creditsModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

