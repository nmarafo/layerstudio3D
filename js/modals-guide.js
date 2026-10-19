/**
 * LayerStudio 3D - Board Inspector & Vector-Illustrated Step-by-Step Assembly Guide
 * Modales de detalle de láminas por tablero y guía interactiva ilustrada algorítmicamente
 * a partir de los tableros anidados y vectores 2D (sin uso de IA).
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
// MOTOR DE ILUSTRACIÓN VECTORIAL AUTOMÁTICA (SVG GEOMÉTRICO SIN IA)
// =========================================================================

function escapeGuideXml(val) {
  return String(val == null ? '' : val)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildClosedPolyPathD(pts, toX, toY) {
  if (!pts || pts.length < 3) return '';
  let d = 'M ' + toX(pts[0].x) + ' ' + toY(pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    d += ' L ' + toX(pts[i].x) + ' ' + toY(pts[i].y);
  }
  return d + ' Z';
}

function buildOpenPolyPathD(pts, toX, toY) {
  if (!pts || pts.length < 2) return '';
  let d = 'M ' + toX(pts[0].x) + ' ' + toY(pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    d += ' L ' + toX(pts[i].x) + ' ' + toY(pts[i].y);
  }
  return d;
}

/**
 * 1. ILUSTRACIÓN VECTORIAL DE UN TABLERO ANIDADO
 * - Si opts.highlightSliceIndex === null: muestra el plano completo del tablero con todas sus islas coloreadas por altura.
 * - Si opts.highlightSliceIndex es un número: atenúa el resto del tablero y resalta con un marco localizador
 *   las islas pertenecientes a esa lámina (#N), indicando su posición (x, y) y si están rotadas 90°.
 */
function generateBoardIllustrationSVG(board, opts) {
  const options = opts || {};
  const highlightSliceIdx = typeof options.highlightSliceIndex === 'number' ? options.highlightSliceIndex : null;
  const isLight = options.theme === 'light';
  const maxH = options.maxHeightPx || 230;

  if (!board) return '';

  const bW = board.width;
  const bH = board.height;
  const margin = board.margin || 0;

  const padLeft = Math.max(18, bW * 0.055);
  const padRight = Math.max(14, bW * 0.04);
  const padTop = Math.max(16, bH * 0.065);
  const padBottom = Math.max(16, bH * 0.065);

  const vbW = bW + padLeft + padRight;
  const vbH = bH + padTop + padBottom;

  const toX = (x) => (padLeft + Number(x)).toFixed(2);
  const toY = (y) => (padTop + (bH - Number(y))).toFixed(2);

  const bgCanvas = isLight ? '#f8fafc' : '#090d16';
  const boardFill = isLight ? '#ffffff' : '#111827';
  const boardStroke = isLight ? '#475569' : '#475569';
  const gridColor = isLight ? '#e2e8f0' : '#1e293b';
  const marginColor = isLight ? '#94a3b8' : '#334155';
  const dimTextColor = isLight ? '#334155' : '#94a3b8';

  const unitFactor = getUnitFactor();
  const dec = state.unit === 'm' ? 3 : 1;
  const u = state.unit;

  const svg = [];
  svg.push(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + vbW.toFixed(2) + ' ' + vbH.toFixed(2) + '" ' +
    'style="width:100%;max-height:' + maxH + 'px;height:auto;display:block;background:' + bgCanvas + ';border-radius:8px;">'
  );

  // Cuadrícula métrica cada 50 mm o 100 mm
  const gridStep = Math.max(bW, bH) > 500 ? 100 : 50;
  svg.push('<g stroke="' + gridColor + '" stroke-width="0.6" vector-effect="non-scaling-stroke">');
  for (let gx = gridStep; gx < bW; gx += gridStep) {
    const xPos = (padLeft + gx).toFixed(2);
    svg.push('<line x1="' + xPos + '" y1="' + padTop.toFixed(2) + '" x2="' + xPos + '" y2="' + (padTop + bH).toFixed(2) + '" />');
  }
  for (let gy = gridStep; gy < bH; gy += gridStep) {
    const yPos = (padTop + (bH - gy)).toFixed(2);
    svg.push('<line x1="' + padLeft.toFixed(2) + '" y1="' + yPos + '" x2="' + (padLeft + bW).toFixed(2) + '" y2="' + yPos + '" />');
  }
  svg.push('</g>');

  // Contorno físico del tablero y margen de seguridad
  svg.push(
    '<rect x="' + padLeft.toFixed(2) + '" y="' + padTop.toFixed(2) + '" width="' + bW.toFixed(2) + '" height="' + bH.toFixed(2) + '" ' +
    'fill="' + boardFill + '" fill-opacity="0.7" stroke="' + boardStroke + '" stroke-width="1.5" vector-effect="non-scaling-stroke" rx="2" />'
  );
  if (margin > 0 && bW > margin * 2 && bH > margin * 2) {
    svg.push(
      '<rect x="' + (padLeft + margin).toFixed(2) + '" y="' + (padTop + margin).toFixed(2) + '" ' +
      'width="' + (bW - margin * 2).toFixed(2) + '" height="' + (bH - margin * 2).toFixed(2) + '" ' +
      'fill="none" stroke="' + marginColor + '" stroke-width="0.8" stroke-dasharray="4,3" vector-effect="non-scaling-stroke" />'
    );
  }

  // Cotas exteriores del tablero
  const headerFontSize = Math.max(8, Math.min(bW, bH) * 0.036).toFixed(1);
  const boardTitle = 'TABLERO #' + (board.boardIndex + 1) + ' (' + (bW / unitFactor).toFixed(dec) + ' × ' + (bH / unitFactor).toFixed(dec) + ' ' + u + ' · Uso ' + board.efficiency.toFixed(1) + '%)';
  svg.push(
    '<text x="' + (padLeft + bW * 0.5).toFixed(2) + '" y="' + (padTop * 0.62).toFixed(2) + '" ' +
    'text-anchor="middle" dominant-baseline="central" font-family="monospace, sans-serif" font-weight="bold" ' +
    'font-size="' + headerFontSize + '" fill="' + dimTextColor + '">' + escapeGuideXml(boardTitle) + '</text>'
  );

  // Origen (0,0) en esquina inferior izquierda
  const smallFont = Math.max(6.5, Math.min(bW, bH) * 0.028).toFixed(1);
  svg.push(
    '<text x="' + padLeft.toFixed(2) + '" y="' + (padTop + bH + padBottom * 0.62).toFixed(2) + '" ' +
    'text-anchor="start" dominant-baseline="central" font-family="monospace, sans-serif" ' +
    'font-size="' + smallFont + '" fill="' + dimTextColor + '">(0,0) ➔ X (' + bW.toFixed(0) + ' mm)</text>'
  );

  const totalSlicesCount = Math.max(1, state.slices.length);
  const rodR = Math.max(0.8, state.rodDiameter * 0.5);
  const targetHighlights = [];

  // Dibujar cada isla colocada en el tablero
  (board.placements || []).forEach((pl) => {
    const isl = pl.island;
    const sIdx = isl.sliceIndex;
    const isTarget = highlightSliceIdx === null || sIdx === highlightSliceIdx;
    const isSpotlight = highlightSliceIdx !== null && sIdx === highlightSliceIdx;

    // Path compuesto (contorno exterior + huecos interiores)
    let compoundD = buildClosedPolyPathD(pl.outerPoints, toX, toY);
    (pl.holes || []).forEach((h) => {
      compoundD += ' ' + buildClosedPolyPathD(h.points, toX, toY);
    });

    // Colores según modo vista general vs modo localizador de paso
    let fillCol, fillOp, strokeOuter, strokeHole, strokeW;
    if (highlightSliceIdx === null) {
      const ratio = sIdx / Math.max(1, totalSlicesCount - 1);
      const hue = Math.round(160 + ratio * 55); // De verde esmeralda (#1) a azul cielo/índigo (#N)
      fillCol = 'hsl(' + hue + ', 80%, 48%)';
      fillOp = isLight ? '0.22' : '0.24';
      strokeOuter = isLight ? '#dc2626' : '#f87171';
      strokeHole = isLight ? '#2563eb' : '#60a5fa';
      strokeW = '1.2';
    } else if (isSpotlight) {
      fillCol = '#10b981';
      fillOp = isLight ? '0.35' : '0.42';
      strokeOuter = isLight ? '#059669' : '#34d399';
      strokeHole = isLight ? '#0284c7' : '#38bdf8';
      strokeW = '2.0';
    } else {
      fillCol = isLight ? '#94a3b8' : '#475569';
      fillOp = isLight ? '0.14' : '0.12';
      strokeOuter = isLight ? '#cbd5e1' : '#334155';
      strokeHole = isLight ? '#cbd5e1' : '#334155';
      strokeW = '0.75';
    }

    if (compoundD) {
      svg.push(
        '<path d="' + compoundD + '" fill="' + fillCol + '" fill-opacity="' + fillOp + '" fill-rule="evenodd" ' +
        'stroke="' + strokeOuter + '" stroke-width="' + strokeW + '" vector-effect="non-scaling-stroke" />'
      );
    }

    // Huecos interiores y varillas si es isla activa
    if (isTarget) {
      (pl.holes || []).forEach((h) => {
        const hd = buildClosedPolyPathD(h.points, toX, toY);
        if (hd) {
          svg.push('<path d="' + hd + '" fill="none" stroke="' + strokeHole + '" stroke-width="1.0" vector-effect="non-scaling-stroke" />');
        }
      });

      // Guías de pegado grabadas sobre la isla en el tablero
      if (state.includeNextSliceGuide && pl.upperPolys && pl.upperPolys.length > 0) {
        let upD = '';
        pl.upperPolys.forEach((poly) => { upD += buildOpenPolyPathD(poly, toX, toY) + ' '; });
        if (upD.trim()) {
          svg.push(
            '<path d="' + upD.trim() + '" fill="none" stroke="#f97316" stroke-width="0.9" stroke-dasharray="3,2" vector-effect="non-scaling-stroke" />'
          );
        }
      }
      if (state.includePrevSliceGuide && pl.lowerPolys && pl.lowerPolys.length > 0) {
        let lowD = '';
        pl.lowerPolys.forEach((poly) => { lowD += buildOpenPolyPathD(poly, toX, toY) + ' '; });
        if (lowD.trim()) {
          svg.push(
            '<path d="' + lowD.trim() + '" fill="none" stroke="#a855f7" stroke-width="0.85" stroke-dasharray="1.5,2" vector-effect="non-scaling-stroke" />'
          );
        }
      }

      // Orificios de varillas guía
      (pl.rods || []).forEach((r) => {
        svg.push(
          '<circle cx="' + toX(r.x) + '" cy="' + toY(r.y) + '" r="' + rodR.toFixed(2) + '" ' +
          'fill="' + boardFill + '" stroke="#06b6d4" stroke-width="1.1" vector-effect="non-scaling-stroke" />'
        );
      });

      // Micro-uniones (holding tabs) si están activas
      if (state.tabsEnabled && typeof computeLoopWithHoldingTabs === 'function') {
        const tabRes = computeLoopWithHoldingTabs(pl.outerPoints, false);
        if (tabRes && tabRes.tabs && tabRes.tabs.length > 0) {
          const tabMarkerR = Math.max(1.2, Math.min(bW, bH) * 0.006).toFixed(2);
          tabRes.tabs.forEach((t) => {
            svg.push(
              '<circle cx="' + toX(t.mid.x) + '" cy="' + toY(t.mid.y) + '" r="' + tabMarkerR + '" ' +
              'fill="#f59e0b" stroke="#0f172a" stroke-width="0.7" vector-effect="non-scaling-stroke" />'
            );
          });
        }
      }
    }

    // Código de la isla (#N o #N.1)
    const code = isl.totalIslandsInSlice > 1
      ? '#' + (sIdx + 1) + '.' + (isl.islandIdxInSlice + 1)
      : '#' + (sIdx + 1);
    const labelStr = code + (pl.rotated ? '↻' : '');
    const cx = pl.textLayout ? pl.textLayout.x : (pl.x + pl.w * 0.5);
    const cy = pl.textLayout ? pl.textLayout.y : (pl.y + pl.h * 0.5);

    const lblSize = isSpotlight
      ? Math.max(8, Math.min(bW, bH) * 0.04).toFixed(1)
      : Math.max(6.2, Math.min(pl.w, pl.h, Math.min(bW, bH) * 0.033) * 0.35).toFixed(1);

    const lblColor = isSpotlight
      ? (isLight ? '#065f46' : '#ecfdf5')
      : (isTarget ? (isLight ? '#0f172a' : '#e2e8f0') : (isLight ? '#94a3b8' : '#64748b'));

    svg.push(
      '<text x="' + toX(cx) + '" y="' + toY(cy) + '" text-anchor="middle" dominant-baseline="central" ' +
      'font-family="monospace, sans-serif" font-weight="bold" font-size="' + lblSize + '" fill="' + lblColor + '">' +
      escapeGuideXml(labelStr) + '</text>'
    );

    if (isSpotlight) {
      targetHighlights.push({ pl, code, cx, cy });
    }
  });

  // Si estamos en modo localizador de paso, dibujar recuadro resaltado y etiqueta flotante sobre las piezas buscadas
  targetHighlights.forEach((item) => {
    const pl = item.pl;
    const rx = (padLeft + pl.x).toFixed(2);
    const ry = (padTop + (bH - (pl.y + pl.h))).toFixed(2);
    const rw = pl.w.toFixed(2);
    const rh = pl.h.toFixed(2);

    svg.push(
      '<rect x="' + rx + '" y="' + ry + '" width="' + rw + '" height="' + rh + '" ' +
      'fill="none" stroke="#f59e0b" stroke-width="1.6" stroke-dasharray="4,2" vector-effect="non-scaling-stroke" rx="2" />'
    );
  });

  svg.push('</svg>');
  return svg.join('');
}

/**
 * 2. ILUSTRACIÓN VECTORIAL DE ENCAJE Y ALINEACIÓN 2D (ORIENTACIÓN REAL 0°)
 * Muestra cómo debe orientarse y pegarse la Lámina #N sobre la Lámina #N-1 (sombra inferior),
 * dónde quedan los orificios de varilla, los puntos de presión (holding tabs) y la guía naranja superior (#N+1).
 */
function generateStepAlignmentIllustrationSVG(slice, stepIdx, activeSlices, opts) {
  const options = opts || {};
  const isLight = options.theme === 'light';
  const maxH = options.maxHeightPx || 215;

  if (!slice || !slice.loops) return '';

  const docBounds = getModelBounds2D();
  const cutBounds = getSliceBounds2D(slice);
  const prevSlice = stepIdx > 0 ? activeSlices[stepIdx - 1] : null;
  const nextSlice = stepIdx < activeSlices.length - 1 ? activeSlices[stepIdx + 1] : null;

  const minX = docBounds.minX;
  const minY = docBounds.minY;
  const docW = Math.max(10, docBounds.width);
  const docH = Math.max(10, docBounds.height);

  const padX = Math.max(12, docW * 0.08);
  const padY = Math.max(14, docH * 0.09);
  const vbW = docW + padX * 2;
  const vbH = docH + padY * 2;

  const toX = (x) => (padX + (Number(x) - minX)).toFixed(2);
  const toY = (y) => (padY + (docH - (Number(y) - minY))).toFixed(2);

  const bgCanvas = isLight ? '#f8fafc' : '#090d16';
  const frameStroke = isLight ? '#cbd5e1' : '#1e293b';
  const prevFill = isLight ? '#94a3b8' : '#64748b';
  const prevStroke = isLight ? '#64748b' : '#94a3b8';
  const currFill = isLight ? '#0ea5e9' : '#38bdf8';
  const currOuterStroke = isLight ? '#dc2626' : '#f87171';
  const currHoleStroke = isLight ? '#2563eb' : '#60a5fa';
  const textColor = isLight ? '#0f172a' : '#f8fafc';
  const subTextColor = isLight ? '#475569' : '#94a3b8';

  const svg = [];
  svg.push(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + vbW.toFixed(2) + ' ' + vbH.toFixed(2) + '" ' +
    'style="width:100%;max-height:' + maxH + 'px;height:auto;display:block;background:' + bgCanvas + ';border-radius:8px;">'
  );

  // Marco de referencia global 2D del modelo
  svg.push(
    '<rect x="' + padX.toFixed(2) + '" y="' + padY.toFixed(2) + '" width="' + docW.toFixed(2) + '" height="' + docH.toFixed(2) + '" ' +
    'fill="none" stroke="' + frameStroke + '" stroke-width="0.9" stroke-dasharray="3,3" vector-effect="non-scaling-stroke" rx="2" />'
  );

  // Ejes centrales de referencia
  const midX = (padX + docW * 0.5).toFixed(2);
  const midY = (padY + docH * 0.5).toFixed(2);
  svg.push(
    '<line x1="' + midX + '" y1="' + padY.toFixed(2) + '" x2="' + midX + '" y2="' + (padY + docH).toFixed(2) + '" stroke="' + frameStroke + '" stroke-width="0.5" vector-effect="non-scaling-stroke" />' +
    '<line x1="' + padX.toFixed(2) + '" y1="' + midY + '" x2="' + (padX + docW).toFixed(2) + '" y2="' + midY + '" stroke="' + frameStroke + '" stroke-width="0.5" vector-effect="non-scaling-stroke" />'
  );

  // 1. Silueta de la capa inferior ya montada (#N-1) debajo para referencia visual de apoyo
  if (prevSlice && prevSlice.loops && prevSlice.loops.length > 0) {
    let prevD = '';
    prevSlice.loops.forEach((loop) => {
      prevD += buildClosedPolyPathD(loop.points, toX, toY) + ' ';
    });
    if (prevD.trim()) {
      svg.push(
        '<path d="' + prevD.trim() + '" fill="' + prevFill + '" fill-opacity="0.18" fill-rule="evenodd" ' +
        'stroke="' + prevStroke + '" stroke-width="1.0" stroke-dasharray="3,2" vector-effect="non-scaling-stroke" />'
      );
    }
  }

  // 2. Contorno y material sólido de la Lámina Actual (#N) en su orientación real 0°
  let currCompoundD = '';
  const outerLoops = [];
  const holeLoops = [];
  (slice.loops || []).forEach((loop) => {
    const d = buildClosedPolyPathD(loop.points, toX, toY);
    if (!d) return;
    currCompoundD += d + ' ';
    if (loop.isHole) holeLoops.push({ d, points: loop.points });
    else outerLoops.push({ d, points: loop.points });
  });

  if (currCompoundD.trim()) {
    svg.push(
      '<path d="' + currCompoundD.trim() + '" fill="' + currFill + '" fill-opacity="' + (isLight ? '0.24' : '0.28') + '" fill-rule="evenodd" stroke="none" />'
    );
  }
  outerLoops.forEach((ol) => {
    svg.push(
      '<path d="' + ol.d + '" fill="none" stroke="' + currOuterStroke + '" stroke-width="1.6" vector-effect="non-scaling-stroke" />'
    );
  });
  holeLoops.forEach((hl) => {
    svg.push(
      '<path d="' + hl.d + '" fill="none" stroke="' + currHoleStroke + '" stroke-width="1.2" vector-effect="non-scaling-stroke" />'
    );
  });

  // 3. Guías de pegado (Naranja #N+1 donde aplicar adhesivo para el siguiente paso, y Violeta #N-1)
  if (state.includePrevSliceGuide && prevSlice && typeof getGuidePolylinesForSlice === 'function') {
    const lowPolys = getGuidePolylinesForSlice(slice, prevSlice);
    let lowD = '';
    lowPolys.forEach((poly) => { lowD += buildOpenPolyPathD(poly, toX, toY) + ' '; });
    if (lowD.trim()) {
      svg.push(
        '<path d="' + lowD.trim() + '" fill="none" stroke="#a855f7" stroke-width="1.15" stroke-dasharray="2,2" vector-effect="non-scaling-stroke" />'
      );
    }
  }

  if (state.includeNextSliceGuide && nextSlice && typeof getGuidePolylinesForSlice === 'function') {
    const upPolys = getGuidePolylinesForSlice(slice, nextSlice);
    let upD = '';
    upPolys.forEach((poly) => { upD += buildOpenPolyPathD(poly, toX, toY) + ' '; });
    if (upD.trim()) {
      svg.push(
        '<path d="' + upD.trim() + '" fill="none" stroke="#f97316" stroke-width="1.35" stroke-dasharray="4,2" vector-effect="non-scaling-stroke" />'
      );
    }
  }

  // 4. Orificios de varillas de alineación
  const rodHoles = typeof getAlignmentHoles2D === 'function' ? getAlignmentHoles2D(slice) : [];
  const rodR = Math.max(1.0, state.rodDiameter * 0.5);
  rodHoles.forEach((h) => {
    const rx = toX(h.x);
    const ry = toY(h.y);
    svg.push(
      '<circle cx="' + rx + '" cy="' + ry + '" r="' + rodR.toFixed(2) + '" fill="' + bgCanvas + '" stroke="#06b6d4" stroke-width="1.3" vector-effect="non-scaling-stroke" />'
    );
  });

  // 5. Puntos de micro-unión (holding tabs) en el contorno
  if (state.tabsEnabled && typeof computeLoopWithHoldingTabs === 'function') {
    const tabMarkerR = Math.max(1.2, Math.min(docW, docH) * 0.012).toFixed(2);
    (slice.loops || []).forEach((loop) => {
      const tabRes = computeLoopWithHoldingTabs(loop.points, loop.isHole);
      if (tabRes && tabRes.tabs) {
        tabRes.tabs.forEach((t) => {
          svg.push(
            '<circle cx="' + toX(t.mid.x) + '" cy="' + toY(t.mid.y) + '" r="' + tabMarkerR + '" ' +
            'fill="#f59e0b" stroke="#0f172a" stroke-width="0.7" vector-effect="non-scaling-stroke" />'
          );
        });
      }
    });
  }

  // 6. Etiquetas de cada isla en orientación real 0°
  if (typeof extractIslandsFromSlices === 'function') {
    const sliceIslands = extractIslandsFromSlices([slice]);
    const fontSz = Math.max(6.5, Math.min(docW, docH) * 0.048).toFixed(1);
    sliceIslands.forEach((isl) => {
      const code = isl.totalIslandsInSlice > 1
        ? '#' + (slice.index + 1) + '.' + (isl.islandIdxInSlice + 1)
        : '#' + (slice.index + 1);
      const tx = isl.textLayout ? isl.textLayout.x : (isl.bounds.minX + isl.bounds.width * 0.5);
      const ty = isl.textLayout ? isl.textLayout.y : (isl.bounds.minY + isl.bounds.height * 0.5);
      svg.push(
        '<text x="' + toX(tx) + '" y="' + toY(ty) + '" text-anchor="middle" dominant-baseline="central" ' +
        'font-family="monospace, sans-serif" font-weight="bold" font-size="' + fontSz + '" fill="' + textColor + '">' +
        escapeGuideXml(code) + '</text>'
      );
    });
  }

  // Cabecera y leyenda de orientación 0°
  const titleSz = Math.max(6.5, Math.min(vbW, vbH) * 0.038).toFixed(1);
  svg.push(
    '<text x="' + padX.toFixed(2) + '" y="' + (padY * 0.58).toFixed(2) + '" text-anchor="start" dominant-baseline="central" ' +
    'font-family="monospace, sans-serif" font-weight="bold" font-size="' + titleSz + '" fill="' + subTextColor + '">' +
    '▲ ORIENTACIÓN 0° (Lámina #' + (slice.index + 1) + ': ' + cutBounds.width.toFixed(1) + '×' + cutBounds.height.toFixed(1) + ' mm)</text>'
  );

  if (prevSlice) {
    svg.push(
      '<text x="' + padX.toFixed(2) + '" y="' + (padY + docH + padY * 0.55).toFixed(2) + '" text-anchor="start" dominant-baseline="central" ' +
      'font-family="monospace, sans-serif" font-size="' + titleSz + '" fill="' + subTextColor + '">' +
      '--- Base inferior: #' + (prevSlice.index + 1) + (nextSlice && state.includeNextSliceGuide ? (' | Naranja: Guía #' + (nextSlice.index + 1)) : '') + '</text>'
    );
  }

  svg.push('</svg>');
  return svg.join('');
}

/**
 * 3. ILUSTRACIÓN VECTORIAL DE ALZADO LATERAL DE APILADO (PROGRESO VERTICAL #1 -> #N)
 * Representa la sección transversal de todas las láminas apiladas de abajo a arriba,
 * destacando en verde las capas ya pegadas, en ámbar/cielo la capa actual a colocar,
 * y en línea discontinua las capas superiores pendientes.
 */
function generateStepStackElevationSVG(slice, stepIdx, activeSlices, opts) {
  const options = opts || {};
  const isLight = options.theme === 'light';
  const maxH = options.maxHeightPx || 215;

  if (!activeSlices || activeSlices.length === 0) return '';

  const docBounds = getModelBounds2D();
  const minX = docBounds.minX;
  const docW = Math.max(10, docBounds.width);
  const totalLayers = activeSlices.length;
  const layerT = Math.max(1, state.thickness);
  const totalH = Math.max(15, totalLayers * layerT);

  const padX = Math.max(16, docW * 0.14);
  const padY = Math.max(14, totalH * 0.12);
  const vbW = docW + padX * 2;
  const vbH = totalH + padY * 2;

  const toX = (x) => (padX + (Number(x) - minX));
  // Altura medida desde la mesa inferior (step = 0 abajo, step = totalLayers - 1 arriba)
  const toYFromZ = (zBottom) => (padY + (totalH - zBottom));

  const bgCanvas = isLight ? '#f8fafc' : '#090d16';
  const baseLineCol = isLight ? '#475569' : '#64748b';
  const doneFill = '#10b981';
  const doneStroke = isLight ? '#059669' : '#047857';
  const currFill = '#f59e0b';
  const currStroke = isLight ? '#d97706' : '#fbbf24';
  const pendingStroke = isLight ? '#94a3b8' : '#334155';
  const textCol = isLight ? '#0f172a' : '#f8fafc';
  const subTextCol = isLight ? '#475569' : '#94a3b8';

  const svg = [];
  svg.push(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + vbW.toFixed(2) + ' ' + vbH.toFixed(2) + '" ' +
    'style="width:100%;max-height:' + maxH + 'px;height:auto;display:block;background:' + bgCanvas + ';border-radius:8px;">'
  );

  // Línea de mesa de apoyo inferior (Base = 0.0 mm)
  const baseY = toYFromZ(0).toFixed(2);
  svg.push(
    '<line x1="' + (padX * 0.4).toFixed(2) + '" y1="' + baseY + '" x2="' + (vbW - padX * 0.4).toFixed(2) + '" y2="' + baseY + '" ' +
    'stroke="' + baseLineCol + '" stroke-width="1.8" vector-effect="non-scaling-stroke" />'
  );

  // Varillas guía verticales si están activas
  if (state.rodCount > 0 && typeof getAlignmentHoles2D === 'function') {
    const refRods = getAlignmentHoles2D(slice);
    const rodW = Math.max(0.8, state.rodDiameter);
    refRods.forEach((r) => {
      const rx = (toX(r.x) - rodW * 0.5).toFixed(2);
      const ry = toYFromZ(totalH + layerT * 0.4).toFixed(2);
      const rh = (totalH + layerT * 0.4).toFixed(2);
      svg.push(
        '<rect x="' + rx + '" y="' + ry + '" width="' + rodW.toFixed(2) + '" height="' + rh + '" ' +
        'fill="#06b6d4" fill-opacity="0.28" stroke="#06b6d4" stroke-width="0.8" vector-effect="non-scaling-stroke" />'
      );
    });
  }

  // Dibujar cada capa de abajo (k=0) hacia arriba (k=totalLayers-1)
  activeSlices.forEach((s, k) => {
    const zTop = (k + 1) * layerT;
    const yTop = toYFromZ(zTop);
    const hRect = Math.max(0.4, layerT);

    // Extraer intervalos horizontales [minX, maxX] de cada contorno exterior de esta lámina
    const outerSpans = [];
    (s.loops || []).forEach((loop) => {
      if (loop.isHole || !loop.points || loop.points.length < 3) return;
      let lMin = Infinity;
      let lMax = -Infinity;
      loop.points.forEach((pt) => {
        if (pt.x < lMin) lMin = pt.x;
        if (pt.x > lMax) lMax = pt.x;
      });
      if (lMax > lMin) outerSpans.push({ minX: lMin, maxX: lMax });
    });

    outerSpans.forEach((sp) => {
      const rx = toX(sp.minX).toFixed(2);
      const rw = Math.max(1, sp.maxX - sp.minX).toFixed(2);
      const ry = yTop.toFixed(2);
      const rh = hRect.toFixed(2);

      if (k < stepIdx) {
        // Capa inferior ya montada
        svg.push(
          '<rect x="' + rx + '" y="' + ry + '" width="' + rw + '" height="' + rh + '" ' +
          'fill="' + doneFill + '" fill-opacity="' + (isLight ? '0.55' : '0.62') + '" ' +
          'stroke="' + doneStroke + '" stroke-width="0.8" vector-effect="non-scaling-stroke" />'
        );
      } else if (k === stepIdx) {
        // Capa actual que se está colocando en este paso
        svg.push(
          '<rect x="' + rx + '" y="' + ry + '" width="' + rw + '" height="' + rh + '" ' +
          'fill="' + currFill + '" fill-opacity="0.92" ' +
          'stroke="' + currStroke + '" stroke-width="1.6" vector-effect="non-scaling-stroke" />'
        );
      } else {
        // Capas superiores pendientes
        svg.push(
          '<rect x="' + rx + '" y="' + ry + '" width="' + rw + '" height="' + rh + '" ' +
          'fill="none" stroke="' + pendingStroke + '" stroke-width="0.65" stroke-dasharray="2,2" vector-effect="non-scaling-stroke" />'
        );
      }
    });
  });

  // Indicador de nivel de la capa actual
  const currZMid = (stepIdx + 0.5) * layerT;
  const currYMid = toYFromZ(currZMid).toFixed(2);
  const accumH = ((stepIdx + 1) * layerT).toFixed(1);
  const lblFont = Math.max(6.2, Math.min(vbW, vbH) * 0.042).toFixed(1);

  svg.push(
    '<line x1="' + (padX * 0.5).toFixed(2) + '" y1="' + currYMid + '" x2="' + (vbW - padX * 0.5).toFixed(2) + '" y2="' + currYMid + '" ' +
    'stroke="#f59e0b" stroke-width="1.0" stroke-dasharray="3,2" vector-effect="non-scaling-stroke" />'
  );
  svg.push(
    '<text x="' + (vbW - padX * 0.25).toFixed(2) + '" y="' + currYMid + '" text-anchor="end" dominant-baseline="central" ' +
    'font-family="monospace, sans-serif" font-weight="bold" font-size="' + lblFont + '" fill="' + (isLight ? '#b45309' : '#fbbf24') + '">' +
    '◀ #' + (slice.index + 1) + ' (' + accumH + ' mm)</text>'
  );

  // Título superior y etiqueta de mesa inferior
  svg.push(
    '<text x="' + (vbW * 0.5).toFixed(2) + '" y="' + (padY * 0.52).toFixed(2) + '" text-anchor="middle" dominant-baseline="central" ' +
    'font-family="monospace, sans-serif" font-weight="bold" font-size="' + lblFont + '" fill="' + subTextCol + '">' +
    'ALZADO APILADO: PASO ' + (stepIdx + 1) + ' / ' + totalLayers + ' (EJE ' + state.axis.toUpperCase() + ')</text>'
  );
  svg.push(
    '<text x="' + (vbW * 0.5).toFixed(2) + '" y="' + (toYFromZ(0) + padY * 0.55).toFixed(2) + '" text-anchor="middle" dominant-baseline="central" ' +
    'font-family="monospace, sans-serif" font-size="' + lblFont + '" fill="' + textCol + '">' +
    '▲ MESA / BASE INFERIOR (Lámina #1)</text>'
  );

  svg.push('</svg>');
  return svg.join('');
}

function toggleGuideIllustrations() {
  state.guideShowIllustrations = !state.guideShowIllustrations;
  const btn = document.getElementById('btnToggleGuideIllustrations');
  if (btn) {
    if (state.guideShowIllustrations) {
      btn.textContent = '📐 Planos Vectoriales: ON';
      btn.className = 'px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold transition';
    } else {
      btn.textContent = '📐 Planos Vectoriales: OFF';
      btn.className = 'px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-semibold transition';
    }
  }
  renderAssemblyGuideModalContent();
}

// =========================================================================
// MODAL DE DETALLE DE CONTENIDO POR TABLERO
// =========================================================================
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

  // 4. Construir vista vectorial del tablero + listado detallado por lámina
  listContainer.innerHTML = '';

  const vectorPreviewDiv = document.createElement('div');
  vectorPreviewDiv.className = 'p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5';
  vectorPreviewDiv.innerHTML =
    '<div class="flex items-center justify-between text-[11px]">' +
      '<span class="font-bold text-emerald-400">📐 Mapa Vectorial del Tablero #' + (board.boardIndex + 1) + '</span>' +
      '<span class="text-slate-400">Escala real 1:1 · Color gradual de base (#1) a cima (#' + state.slices.length + ')</span>' +
    '</div>' +
    generateBoardIllustrationSVG(board, { highlightSliceIndex: null, theme: 'dark', maxHeightPx: 220 });
  listContainer.appendChild(vectorPreviewDiv);

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
// GUÍA ILUSTRADA DE CORTE / IMPRESIÓN Y MONTAJE PASO A PASO (DE ABAJO A ARRIBA)
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
  // SECCIÓN 1: ORDEN DE CORTE / IMPRESIÓN Y PLANOS VECTORIALES DE TABLEROS
  // =======================================================================
  if (state.assemblyGuideTab === 'all' || state.assemblyGuideTab === 'cutting') {
    const priorityStr = plan.boardPriorityOrder.map((bIdx, i) =>
      '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-[11px]">' +
      (i + 1) + 'º → Tablero #' + (bIdx + 1) + '</span>'
    ).join('<span class="text-slate-500 mx-1">➔</span>');

    let boardsCardsHTML = '';
    state.nestedBoards.forEach((board, bIdx) => {
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

      const boardSvgHTML = state.guideShowIllustrations
        ? '<div class="pt-2">' +
            generateBoardIllustrationSVG(board, { highlightSliceIndex: null, theme: 'dark', maxHeightPx: 230 }) +
          '</div>'
        : '';

      boardsCardsHTML +=
        '<div class="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 flex flex-col justify-between gap-2.5">' +
          '<div class="flex flex-wrap items-center justify-between gap-2">' +
            '<div class="flex items-center gap-2">' +
              '<span class="px-2.5 py-0.5 rounded-md bg-emerald-600 text-white text-xs font-bold">Tablero #' + (bIdx + 1) + '</span>' +
              '<span class="text-xs text-slate-300 font-semibold">' + board.placements.length + ' piezas (' + sortedSliceNums.length + ' láminas: de #' + minSlice + ' a #' + maxSlice + ')</span>' +
            '</div>' +
            '<div class="flex items-center gap-2">' +
              '<span class="text-[11px] text-amber-300 font-mono">Uso: ' + board.efficiency.toFixed(1) + '%</span>' +
              '<button onclick="closeAssemblyGuideModal(); selectActiveBoard(' + bIdx + ');" class="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-[10px] font-semibold">Ver Tablero en 2D →</button>' +
            '</div>' +
          '</div>' +
          boardSvgHTML +
          '<div class="flex flex-wrap gap-1 pt-2 border-t border-slate-700/50">' +
            chipsHTML +
          '</div>' +
        '</div>';
    });

    html +=
      '<section class="space-y-3">' +
        '<div class="flex items-center justify-between border-b border-slate-800 pb-2">' +
          '<h4 class="text-xs font-bold uppercase tracking-wider text-amber-400">🔥 1. Planos Vectoriales de Tableros y Orden de Corte Láser</h4>' +
          '<span class="text-[11px] text-slate-400">Mapas generados automáticamente a escala 1:1 de los ' + state.nestedBoards.length + ' tableros</span>' +
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
              '<span class="text-slate-400 text-[10px]">Corta en último lugar el perímetro exterior' + (state.tabsEnabled ? ' (dejando los ' + state.tabWidthMM.toFixed(1) + ' mm de micro-unión para extraer a presión).' : ' de cada isla para evitar que la pieza se mueva.') + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<!-- Orden de los tableros y mapas vectoriales -->' +
        '<div class="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2.5">' +
          '<div class="space-y-1">' +
            '<span class="text-[11px] font-bold text-emerald-300 block">B) Secuencia Recomendada de Tableros y Planos de Distribución:</span>' +
            '<p class="text-[11px] text-slate-300">Para empezar a ensamblar desde la base (<code>Lámina #1</code>) mientras el láser sigue cortando, procesa los tableros en este orden:</p>' +
          '</div>' +
          '<div class="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-1.5">' +
            '<div class="flex flex-wrap items-center gap-1">' + priorityStr + '</div>' +
          '</div>' +
          '<div class="grid grid-cols-1 ' + (state.nestedBoards.length > 1 ? 'lg:grid-cols-2' : '') + ' gap-3 pt-1">' +
            boardsCardsHTML +
          '</div>' +
        '</div>' +
      '</section>';
  }

  // =======================================================================
  // SECCIÓN 2: GUÍA ILUSTRADA DE MONTAJE DE ABAJO A ARRIBA (CAPA #1 -> CAPA #N)
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

      // Instrucción de cómo extraer, orientar y pegar esta capa respecto a la inferior y superior
      const detachHint = state.tabsEnabled
        ? 'Presiona suavemente la pieza para desprender sus micro-uniones del tablero y repasa el borde si fuera necesario. '
        : '';

      let instructionText = '';
      if (isBase) {
        instructionText =
          '1. ' + detachHint + 'Localiza ' + (pls.length > 1 ? 'las <strong>' + pls.length + ' islas</strong> de ' : 'la pieza de ') + 'la <strong>Lámina #' + sNum + '</strong> resaltada en verde en el plano del tablero inferior y apóyala plana a <strong>0°</strong> sobre la mesa como <strong>BASE INFERIOR</strong>' +
          (state.rodCount > 0 ? ' (inserta las ' + state.rodCount + ' varillas guía de Ø' + state.rodDiameter + 'mm en sus orificios azules).' : '.') +
          (state.includeNextSliceGuide ? ' Verás grabada encima la <strong>silueta naranja (Guía Sup)</strong> donde irá pegada la Lámina #' + (sNum + 1) + '.' : '');
      } else if (isTop) {
        const prevSNumTop = activeSlices[stepIdx - 1].index + 1;
        instructionText =
          '1. ' + detachHint + 'Aplica adhesivo en la zona delimitada por la guía naranja de la <strong>Lámina #' + prevSNumTop + '</strong> (ya montada debajo). ' +
          '2. Coloca encima ' + (pls.length > 1 ? 'las piezas de ' : '') + 'la <strong>Lámina #' + sNum + '</strong> en orientación <strong>0°</strong> haciéndola coincidir con la silueta guía' +
          (state.includePrevSliceGuide ? ' (verifica el encaje con su guía inferior violeta).' : '.') +
          ' ¡Con esta capa finalizas la coronación de la pieza!';
      } else {
        const prevSNum = activeSlices[stepIdx - 1].index + 1;
        const nextSNum = activeSlices[stepIdx + 1].index + 1;
        instructionText =
          '1. ' + detachHint + 'Aplica adhesivo dentro de la silueta naranja grabada sobre la <strong>Lámina #' + prevSNum + '</strong> (montada en el paso anterior). ' +
          '2. Asienta ' + (pls.length > 1 ? 'cada isla de ' : '') + 'la <strong>Lámina #' + sNum + '</strong> a <strong>0°</strong> alineando su contorno con la capa inferior (sombra punteada en el plano central). ' +
          '3. Deja hacia arriba la cara con la guía naranja <code>[Sup]</code> para recibir después la <strong>Lámina #' + nextSNum + '</strong>.';
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
            ? '<span class="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-semibold" title="Esta pieza se giró 90° en el tablero para optimizar espacio. Gírala 90° al montarla para que coincida con el Plano de Encaje 0°.">🔄 Girada 90° en tablero (enderezar a 0° al pegar)</span>'
            : '<span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">Orientación 0° directa</span>';

          const clipBadge = p.isClippedToBoard
            ? '<span class="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-semibold">✂️ Recortada al tablero</span>'
            : '';

          return (
            '<div class="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px]">' +
              '<div class="flex items-center gap-2 flex-wrap">' +
                '<span class="font-mono font-bold text-emerald-400 text-xs">Isla ' + p.islandCode + '</span>' +
                '<span class="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-500/40 text-sky-300 font-bold">📍 Extraer de Tablero #' + (p.boardIndex + 1) + '</span>' +
                '<span class="text-slate-400 font-mono text-[10px]">Pos: (' + (p.x / f).toFixed(dec) + ', ' + (p.y / f).toFixed(dec) + ') ' + u + ' | ' + (p.w / f).toFixed(dec) + '×' + (p.h / f).toFixed(dec) + ' ' + u + '</span>' +
                clipBadge +
              '</div>' +
              '<div class="flex items-center gap-2 flex-wrap">' +
                guideBadge +
                rotWarning +
                '<button onclick="jumpToSliceAndBoardFromGuide(' + sIdx + ', ' + p.boardIndex + ')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-[10px] font-semibold">👁️ Ver en Visor</button>' +
              '</div>' +
            '</div>'
          );
        }).join('');
      }

      // Generar los 3 diagramas vectoriales automáticos del paso (1. Localización en Tablero, 2. Plano de Encaje 2D a 0°, 3. Alzado de Apilado)
      let illustrationsGridHTML = '';
      if (state.guideShowIllustrations) {
        const uniqueBoardIndices = Array.from(new Set(pls.map((p) => p.boardIndex)));
        let boardLocatorSVGs = '';
        if (uniqueBoardIndices.length === 0) {
          boardLocatorSVGs = '<div class="text-[11px] text-rose-400 p-4 text-center">Sin tablero asignado</div>';
        } else {
          boardLocatorSVGs = uniqueBoardIndices.map((bIdx) => {
            const bObj = state.nestedBoards[bIdx];
            return generateBoardIllustrationSVG(bObj, {
              highlightSliceIndex: sIdx,
              theme: 'dark',
              maxHeightPx: uniqueBoardIndices.length > 1 ? 130 : 200
            });
          }).join('<div class="h-1.5"></div>');
        }

        const alignSvg = generateStepAlignmentIllustrationSVG(slice, stepIdx, activeSlices, {
          theme: 'dark',
          maxHeightPx: 200
        });
        const stackSvg = generateStepStackElevationSVG(slice, stepIdx, activeSlices, {
          theme: 'dark',
          maxHeightPx: 200
        });

        illustrationsGridHTML =
          '<div class="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">' +
            '<div class="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/90 flex flex-col justify-between gap-1.5">' +
              '<div class="flex items-center justify-between text-[10px]">' +
                '<span class="font-bold text-emerald-400 uppercase tracking-wide">1. Localizar en Tablero</span>' +
                '<span class="text-slate-400">Pieza resaltada en verde</span>' +
              '</div>' +
              boardLocatorSVGs +
            '</div>' +
            '<div class="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/90 flex flex-col justify-between gap-1.5">' +
              '<div class="flex items-center justify-between text-[10px]">' +
                '<span class="font-bold text-sky-400 uppercase tracking-wide">2. Plano de Encaje y Guías (0°)</span>' +
                '<span class="text-slate-400">Superposición sobre #' + (stepIdx > 0 ? (activeSlices[stepIdx - 1].index + 1) : 'Base') + '</span>' +
              '</div>' +
              alignSvg +
            '</div>' +
            '<div class="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/90 flex flex-col justify-between gap-1.5">' +
              '<div class="flex items-center justify-between text-[10px]">' +
                '<span class="font-bold text-amber-400 uppercase tracking-wide">3. Alzado de Apilado</span>' +
                '<span class="text-slate-400">Cota ' + axisName + ' = ' + slice.coord.toFixed(1) + ' mm</span>' +
              '</div>' +
              stackSvg +
            '</div>' +
          '</div>';
      }

      stepsHTML +=
        '<div class="rounded-xl border p-3.5 transition space-y-2.5 ' +
          (isDone ? 'bg-emerald-950/20 border-emerald-500/40 opacity-85' : 'bg-slate-800/50 border-slate-700/80') + '">' +
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

          illustrationsGridHTML +

          '<div class="space-y-1.5">' +
            islandsLocateHTML +
          '</div>' +
        '</div>';
    });

    html +=
      '<section class="space-y-3">' +
        '<div class="flex items-center justify-between border-b border-slate-800 pb-2">' +
          '<h4 class="text-xs font-bold uppercase tracking-wider text-emerald-400">🧱 2. Secuencia Ilustrada de Montaje Paso a Paso (De Abajo a Arriba)</h4>' +
          '<span class="text-[11px] text-slate-400">Planos vectoriales de localización en tablero, encaje 2D a 0° y alzado de apilado por capa</span>' +
        '</div>' +
        '<div class="space-y-3">' +
          stepsHTML +
        '</div>' +
      '</section>';
  }

  container.innerHTML = html;
}

// =========================================================================
// GENERADOR DE GUÍA ILUSTRADA AUTOCONTENIDA EN HTML / IMPRESIÓN PDF
// =========================================================================
function generateIllustratedAssemblyGuideHTML() {
  if (!state.nestingEnabled || state.nestedBoards.length === 0) {
    recomputeBoardNesting();
  }
  const plan = buildAssemblyAndCuttingPlan();
  const activeSlices = plan.selectedSlices;
  const totalSteps = activeSlices.length;
  const axisName = state.axis.toUpperCase();

  const priorityHtml = plan.boardPriorityOrder
    .map((bIdx, i) => '<span class="badge badge-emerald">' + (i + 1) + 'º → Tablero #' + (bIdx + 1) + '</span>')
    .join(' <span style="color:#64748b;font-weight:bold;">➔</span> ');

  let boardsHtml = '';
  state.nestedBoards.forEach((board, bIdx) => {
    const codes = board.placements.map((pl) => {
      const sNum = pl.island.sliceIndex + 1;
      const code = pl.island.totalIslandsInSlice > 1 ? ('#' + sNum + '.' + (pl.island.islandIdxInSlice + 1)) : ('#' + sNum);
      return '<span class="chip">' + escapeGuideXml(code + (pl.rotated ? ' (90°↻)' : '')) + '</span>';
    }).join(' ');

    const svgBoard = generateBoardIllustrationSVG(board, {
      highlightSliceIndex: null,
      theme: 'light',
      maxHeightPx: 290
    });

    boardsHtml +=
      '<div class="card board-card">' +
        '<div class="card-header">' +
          '<div><strong>Tablero #' + (bIdx + 1) + '</strong> — ' + board.placements.length + ' piezas (' + board.width.toFixed(0) + ' × ' + board.height.toFixed(0) + ' mm)</div>' +
          '<div class="badge badge-amber">Aprovechamiento: ' + board.efficiency.toFixed(1) + '%</div>' +
        '</div>' +
        '<div class="svg-box">' + svgBoard + '</div>' +
        '<div class="chips-row"><strong>Piezas incluidas:</strong> ' + codes + '</div>' +
      '</div>';
  });

  let stepsHtml = '';
  activeSlices.forEach((slice, stepIdx) => {
    const sIdx = slice.index;
    const sNum = sIdx + 1;
    const pls = plan.slicePlacementsMap.get(sIdx) || [];
    const accumH = ((stepIdx + 1) * state.thickness).toFixed(1);
    const roleLabel = stepIdx === 0
      ? 'BASE INFERIOR (1ª en colocar)'
      : (stepIdx === totalSteps - 1 ? 'CIMA SUPERIOR (Última capa)' : 'Capa Intermedia');

    const uniqueBoards = Array.from(new Set(pls.map((p) => p.boardIndex)));
    const locatorSvg = uniqueBoards.map((bIdx) =>
      generateBoardIllustrationSVG(state.nestedBoards[bIdx], {
        highlightSliceIndex: sIdx,
        theme: 'light',
        maxHeightPx: uniqueBoards.length > 1 ? 120 : 195
      })
    ).join('<div style="height:6px"></div>');

    const alignSvg = generateStepAlignmentIllustrationSVG(slice, stepIdx, activeSlices, {
      theme: 'light',
      maxHeightPx: 195
    });

    const stackSvg = generateStepStackElevationSVG(slice, stepIdx, activeSlices, {
      theme: 'light',
      maxHeightPx: 195
    });

    const rowsHtml = pls.map((p) => {
      const gType = (p.hasSup && p.hasInf) ? 'Ambas Guías (Sup+Inf)' : (p.hasSup ? 'Guía Sup (#N+1)' : (p.hasInf ? 'Guía Inf (#N-1)' : 'Sin guía'));
      const rotStr = p.rotated ? '🔄 Rotada 90° en tablero (enderezar a 0° al montar)' : 'Orientación 0° directa';
      return (
        '<tr>' +
          '<td><strong>' + escapeGuideXml(p.islandCode) + '</strong></td>' +
          '<td>Tablero #' + (p.boardIndex + 1) + '</td>' +
          '<td>(' + p.x.toFixed(1) + ', ' + p.y.toFixed(1) + ') mm</td>' +
          '<td>' + p.w.toFixed(1) + ' × ' + p.h.toFixed(1) + ' mm</td>' +
          '<td>' + gType + '</td>' +
          '<td>' + rotStr + '</td>' +
        '</tr>'
      );
    }).join('');

    stepsHtml +=
      '<div class="card step-card">' +
        '<div class="card-header">' +
          '<div>' +
            '<span class="step-num">❑ PASO ' + (stepIdx + 1) + ' DE ' + totalSteps + '</span> ' +
            '<strong>Lámina #' + sNum + '</strong> — <span style="color:#0369a1;font-weight:600;">' + roleLabel + '</span>' +
          '</div>' +
          '<div style="font-family:monospace;font-size:12px;color:#334155;">' +
            'Cota ' + axisName + ' = ' + slice.coord.toFixed(2) + ' mm | Altura acumulada: <strong>' + accumH + ' mm</strong>' +
          '</div>' +
        '</div>' +
        '<div class="diagrams-grid">' +
          '<div class="diag-box">' +
            '<div class="diag-title">1. Localización en Tablero (Verde)</div>' +
            locatorSvg +
          '</div>' +
          '<div class="diag-box">' +
            '<div class="diag-title">2. Plano de Encaje y Guías a 0°</div>' +
            alignSvg +
          '</div>' +
          '<div class="diag-box">' +
            '<div class="diag-title">3. Alzado de Apilado Vertical</div>' +
            stackSvg +
          '</div>' +
        '</div>' +
        '<table class="parts-table">' +
          '<thead><tr><th>Isla</th><th>Tablero</th><th>Posición (X, Y)</th><th>Dimensiones</th><th>Guías Grabadas</th><th>Orientación en Tablero</th></tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div>';
  });

  const tabsSummary = state.tabsEnabled
    ? (state.tabMode === 'count'
        ? (state.tabCount + ' micro-uniones de ' + state.tabWidthMM.toFixed(1) + ' mm por pieza (extracción a presión)')
        : ('1 micro-unión de ' + state.tabWidthMM.toFixed(1) + ' mm cada ' + state.tabSpacingMM.toFixed(0) + ' mm'))
    : 'Corte perimetral continuo';

  return [
    '<!DOCTYPE html>',
    '<html lang="es">',
    '<head>',
    '<meta charset="UTF-8" />',
    '<title>Guía Ilustrada de Montaje — ' + escapeGuideXml(state.modelName) + ' (LayerStudio 3D)</title>',
    '<style>',
    '  * { box-sizing: border-box; }',
    '  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; background: #f1f5f9; margin: 0; padding: 24px; line-height: 1.45; }',
    '  .container { max-width: 1120px; margin: 0 auto; background: #ffffff; padding: 28px; border-radius: 14px; border: 1px solid #cbd5e1; box-shadow: 0 4px 20px rgba(15,23,42,0.06); }',
    '  h1 { margin: 0 0 4px 0; font-size: 22px; color: #0f172a; }',
    '  h2 { margin: 24px 0 12px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 0.04em; color: #0369a1; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }',
    '  .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 14px 0; }',
    '  .meta-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; font-size: 12px; }',
    '  .meta-item strong { display: block; font-size: 10px; text-transform: uppercase; color: #64748b; }',
    '  .card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; margin-bottom: 16px; background: #ffffff; page-break-inside: avoid; break-inside: avoid; }',
    '  .card-header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 10px; font-size: 13px; }',
    '  .step-num { background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; font-weight: 800; padding: 2px 8px; border-radius: 6px; font-size: 12px; margin-right: 6px; }',
    '  .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }',
    '  .badge-emerald { background: #d1fae5; color: #065f46; border: 1px solid #34d399; }',
    '  .badge-amber { background: #fef3c7; color: #92400e; border: 1px solid #fbbf24; }',
    '  .chip { display: inline-block; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 1px 6px; font-family: monospace; font-size: 11px; margin: 2px; }',
    '  .chips-row { font-size: 11px; color: #334155; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e2e8f0; }',
    '  .diagrams-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px; }',
    '  .diag-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; }',
    '  .diag-title { font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 6px; text-transform: uppercase; }',
    '  .parts-table { width: 100%; border-collapse: collapse; font-size: 11px; }',
    '  .parts-table th, .parts-table td { border: 1px solid #e2e8f0; padding: 5px 8px; text-align: left; }',
    '  .parts-table th { background: #f8fafc; color: #475569; font-weight: 700; }',
    '  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #cbd5e1; font-size: 11px; color: #475569; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; }',
    '  .no-print-bar { display: flex; justify-content: space-between; align-items: center; background: #0f172a; color: #fff; padding: 10px 18px; border-radius: 10px; margin-bottom: 18px; }',
    '  .btn-print { background: #0284c7; color: #fff; border: none; padding: 7px 14px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 12px; }',
    '  @media print { body { background: #fff; padding: 0; } .container { border: none; box-shadow: none; padding: 0; max-width: 100%; } .no-print-bar { display: none !important; } }',
    '</style>',
    '</head>',
    '<body>',
    '<div class="container">',
    '  <div class="no-print-bar">',
    '    <div><strong>LayerStudio 3D</strong> — Guía Técnica Ilustrada de Corte y Montaje (Planos Vectoriales Automáticos)</div>',
    '    <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>',
    '  </div>',
    '  <h1>Guía Ilustrada de Corte y Montaje: ' + escapeGuideXml(state.modelName) + '</h1>',
    '  <div style="font-size:12px;color:#475569;">Planos generados algorítmicamente a escala real a partir de los tableros anidados y vectores 2D · Ensamblaje de abajo a arriba (Eje ' + axisName + ')</div>',
    '  <div class="meta-grid">',
    '    <div class="meta-item"><strong>Dimensiones del Modelo</strong>' + state.dimsMM.x.toFixed(1) + ' × ' + state.dimsMM.y.toFixed(1) + ' × ' + state.dimsMM.z.toFixed(1) + ' mm</div>',
    '    <div class="meta-item"><strong>Eje y Capas Activas</strong>Eje ' + axisName + ' · ' + totalSteps + ' láminas (' + state.thickness.toFixed(2) + ' mm / capa)</div>',
    '    <div class="meta-item"><strong>Tableros de Corte</strong>' + state.nestedBoards.length + ' tablero(s) de ' + state.boardWidthMM.toFixed(0) + ' × ' + state.boardHeightMM.toFixed(0) + ' mm</div>',
    '    <div class="meta-item"><strong>Sujeción por Presión (Tabs)</strong>' + escapeGuideXml(tabsSummary) + '</div>',
    '  </div>',
    '  <h2>1. Planos Vectoriales de Tableros y Orden de Corte</h2>',
    '  <p style="font-size:12px;margin:6px 0 12px 0;"><strong>Orden de prioridad de tableros para empezar a montar desde la Lámina #1:</strong> ' + priorityHtml + '</p>',
    boardsHtml,
    '  <h2>2. Secuencia Ilustrada de Montaje Paso a Paso (De Abajo a Arriba: #1 → #' + state.slices.length + ')</h2>',
    stepsHtml,
    '  <div class="footer">',
    '    <div><strong>LayerStudio 3D</strong> · Autor: <strong>Norberto Martín Afonso</strong> (&lt;normaafo@gmail.com&gt;) · Licencia GNU AGPL v3.0 (Sección 7b)</div>',
    '    <div>Repositorio: https://github.com/nmarafo/layerstudio3D · X: @NorbertoMartnAf · GitHub/HF: @nmarafo</div>',
    '  </div>',
    '</div>',
    '</body>',
    '</html>'
  ].join('\n');
}

function downloadIllustratedAssemblyGuideHtml() {
  const htmlContent = generateIllustratedAssemblyGuideHTML();
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  triggerBrowserDownload(blob, state.modelName + '_GUIA_ILUSTRADA_MONTAJE.html');
}

function printIllustratedAssemblyGuide() {
  const htmlContent = generateIllustratedAssemblyGuideHTML();
  const printWin = window.open('', '_blank');
  if (!printWin) {
    downloadIllustratedAssemblyGuideHtml();
    return;
  }
  printWin.document.open();
  printWin.document.write(htmlContent);
  printWin.document.close();
  setTimeout(() => {
    printWin.focus();
    printWin.print();
  }, 350);
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
  lines.push('CRÉDITOS, AUTORÍA Y LICENCIA — LAYERSTUDIO 3D');
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
