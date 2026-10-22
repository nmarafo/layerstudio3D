/**
 * LayerStudio 3D - CAD/CAM Exporters (SVG, DXF, STL, ZIP, LASCA)
 * Generadores vectoriales 1:1 en mm (SVG/DXF), mallas 3D por capa (STL), paquete ZIP y proyectos .lasca.
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
// GENERADORES DE ARCHIVOS DE SALIDA (SVG VALIDADO XML, DXF, STL 3D)
// =========================================================================
function escapeXmlAttr(val) {
  return String(val == null ? '' : val)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Construye el atributo d="..." para corte láser SVG aplicando micro-uniones (holding tabs) si están activas (salvo en el marco configurable)
function buildSvgCutPathD(pts, isHole, toX, toY, skipTabs = false) {
  if (!pts || pts.length < 3) return '';
  const tabRes = computeLoopWithHoldingTabs(pts, isHole, Boolean(skipTabs || pts.isFrame));
  if (tabRes.isClosed) {
    let d = 'M ' + toX(pts[0].x) + ' ' + toY(pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      d += ' L ' + toX(pts[i].x) + ' ' + toY(pts[i].y);
    }
    return d + ' Z';
  }
  const parts = [];
  tabRes.subpaths.forEach((poly) => {
    if (!poly || poly.length < 2) return;
    let subD = 'M ' + toX(poly[0].x) + ' ' + toY(poly[0].y);
    for (let i = 1; i < poly.length; i++) {
      subD += ' L ' + toX(poly[i].x) + ' ' + toY(poly[i].y);
    }
    parts.push(subD);
  });
  return parts.join(' ');
}

// Añade entidades LINE a un documento DXF aplicando micro-uniones (holding tabs) si están activas (salvo en el marco configurable)
function pushLoopLinesWithTabsDXF(dxf, pts, isHole, layer, color, ox = 0, oy = 0, skipTabs = false) {
  if (!pts || pts.length < 3) return;
  const tabRes = computeLoopWithHoldingTabs(pts, isHole, Boolean(skipTabs || pts.isFrame));
  if (tabRes.isClosed) {
    for (let i = 0, n = pts.length; i < n; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      dxf.push(
        '0', 'LINE',
        '8', layer,
        '62', color,
        '10', (p1.x - ox).toFixed(4),
        '20', (p1.y - oy).toFixed(4),
        '30', '0.0',
        '11', (p2.x - ox).toFixed(4),
        '21', (p2.y - oy).toFixed(4),
        '31', '0.0'
      );
    }
    return;
  }
  tabRes.subpaths.forEach((poly) => {
    if (!poly || poly.length < 2) return;
    for (let i = 0; i < poly.length - 1; i++) {
      const p1 = poly[i];
      const p2 = poly[i + 1];
      dxf.push(
        '0', 'LINE',
        '8', layer,
        '62', color,
        '10', (p1.x - ox).toFixed(4),
        '20', (p1.y - oy).toFixed(4),
        '30', '0.0',
        '11', (p2.x - ox).toFixed(4),
        '21', (p2.y - oy).toFixed(4),
        '31', '0.0'
      );
    }
  });
}

function generateSliceSVG(slice, idx) {
  // El tamaño del documento SVG es siempre el tamaño total de la pieza en el eje de la lámina/costilla
  const sliceAxis = slice.sliceAxis || state.axis;
  const docBounds = getModelBounds2D(sliceAxis);
  const cutBounds = getSliceBounds2D(slice);
  const upperSlice = getAdjacentSlice(idx, 'next');
  const lowerSlice = getAdjacentSlice(idx, 'prev');

  const minX = docBounds.minX;
  const minY = docBounds.minY;
  const svgW = docBounds.width;
  const svgH = docBounds.height;

  const toX = (x) => (Number(x) - minX).toFixed(4);
  const toY = (y) => (svgH - (Number(y) - minY)).toFixed(4);

  const strokeMm = Math.max(0.15, Math.min(svgW, svgH) * 0.0025).toFixed(4);
  const fontSize = Math.max(2.5, Math.min(svgW, svgH) * 0.028).toFixed(3);

  let compoundPath = '';
  const outerPaths = [];
  const holePaths = [];

  (slice.loops || []).forEach((loop) => {
    if (!loop.points || loop.points.length < 3) return;
    const pts = loop.points;
    let dClosed = 'M ' + toX(pts[0].x) + ' ' + toY(pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      dClosed += ' L ' + toX(pts[i].x) + ' ' + toY(pts[i].y);
    }
    dClosed += ' Z';
    compoundPath += dClosed + ' ';

    const cutD = buildSvgCutPathD(pts, loop.isHole, toX, toY, Boolean(loop.isFrame));
    if (!cutD) return;
    if (loop.isHole) {
      holePaths.push(cutD);
    } else {
      outerPaths.push(cutD);
    }
  });

  // Marco configurable 2D de corte/grabado alrededor del lienzo 2D (sin micro-uniones de sujeción por presión)
  let sliceFrameEngravePath = '';
  if (state.slicerFrameEnabled && typeof get2DBoardFrameGeometry === 'function') {
    const fGeom = get2DBoardFrameGeometry(docBounds.minX, docBounds.minY, docBounds.maxX, docBounds.maxY, slice.loops, false);
    if (fGeom) {
      if (fGeom.outerCutPts && fGeom.outerCutPts.length >= 3) {
        const dOutFrame = buildSvgCutPathD(fGeom.outerCutPts, false, toX, toY, true);
        if (dOutFrame) outerPaths.push(dOutFrame);
      }
      if (fGeom.innerCutPts && fGeom.innerCutPts.length >= 3) {
        const dInFrame = buildSvgCutPathD(fGeom.innerCutPts, true, toX, toY, true);
        if (dInFrame) holePaths.push(dInFrame);
      }
      if (fGeom.keyholePts && fGeom.keyholePts.length >= 3) {
        const dKh = buildSvgCutPathD(fGeom.keyholePts, true, toX, toY, true);
        if (dKh) holePaths.push(dKh);
      }
      if (fGeom.engraveLoops && fGeom.engraveLoops.length > 0) {
        fGeom.engraveLoops.forEach((el) => {
          if (!el.points || el.points.length < 3) return;
          sliceFrameEngravePath += 'M ' + el.points.map((p) => toX(p.x) + ' ' + toY(p.y)).join(' L ') + ' Z ';
        });
      }
    }
  }

  // Construir polilíneas continuas de la guía donde va pegada la lámina superior (#N+1)
  let upperGuidePath = '';
  if (upperSlice && upperSlice.loops) {
    const upperPolys = getGuidePolylinesForSlice(slice, upperSlice);
    upperPolys.forEach((poly) => {
      if (poly.length < 2) return;
      upperGuidePath += 'M ' + toX(poly[0].x) + ' ' + toY(poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        upperGuidePath += ' L ' + toX(poly[i].x) + ' ' + toY(poly[i].y);
      }
      upperGuidePath += ' ';
    });
  }

  // Construir polilíneas continuas de la guía donde va pegada la lámina inferior (#N-1)
  let lowerGuidePath = '';
  if (lowerSlice && lowerSlice.loops) {
    const lowerPolys = getGuidePolylinesForSlice(slice, lowerSlice);
    lowerPolys.forEach((poly) => {
      if (poly.length < 2) return;
      lowerGuidePath += 'M ' + toX(poly[0].x) + ' ' + toY(poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        lowerGuidePath += ' L ' + toX(poly[i].x) + ' ' + toY(poly[i].y);
      }
      lowerGuidePath += ' ';
    });
  }

  const rodHoles = getAlignmentHoles2D(slice);
  const rodRadius = (state.rodDiameter / 2).toFixed(4);
  const displayCode = slice.puzzleCode ? slice.puzzleCode : ('#' + (idx + 1));

  // Construye la cabecera XML estándar del documento SVG
  const xmlHeader = '<' + '?xml version="1.0" encoding="UTF-8" standalone="no"?' + '>';

  const lines = [
    xmlHeader,
    '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="' + svgW.toFixed(3) + 'mm" height="' + svgH.toFixed(3) + 'mm" viewBox="0 0 ' + svgW.toFixed(4) + ' ' + svgH.toFixed(4) + '" style="background:#ffffff;max-width:100vw;max-height:95vh;">',
    '  <title>' + escapeXmlAttr('Pieza ' + displayCode + ' - Eje ' + sliceAxis.toUpperCase()) + '</title>',
    '  <desc>' + escapeXmlAttr('Documento (Pieza): ' + svgW.toFixed(2) + 'x' + svgH.toFixed(2) + 'mm | Medida corte: ' + cutBounds.width.toFixed(2) + 'x' + cutBounds.height.toFixed(2) + 'mm | Posicion ' + sliceAxis.toUpperCase() + ': ' + slice.coord.toFixed(2) + 'mm') + '</desc>'
  ];

  if (compoundPath.trim().length > 0) {
    lines.push('  <g id="VISTA_PREVIA_PIEZA">');
    lines.push('    <path d="' + compoundPath.trim() + '" fill="#0ea5e9" fill-opacity="0.14" fill-rule="evenodd" stroke="none" />');
    lines.push('  </g>');
  }

  lines.push('  <g id="CORTE_EXTERIOR" fill="none" stroke="#ff0000" stroke-width="' + strokeMm + '" stroke-linecap="round" stroke-linejoin="round">');
  outerPaths.forEach((d, pIdx) => {
    lines.push('    <path id="ext_' + (pIdx + 1) + '" d="' + d + '" vector-effect="non-scaling-stroke" />');
  });
  lines.push('  </g>');

  if (holePaths.length > 0 || rodHoles.length > 0) {
    lines.push('  <g id="CORTE_INTERIOR_HUECOS" fill="none" stroke="#0055ff" stroke-width="' + strokeMm + '" stroke-linecap="round" stroke-linejoin="round">');
    holePaths.forEach((d, hIdx) => {
      lines.push('    <path id="hueco_' + (hIdx + 1) + '" d="' + d + '" vector-effect="non-scaling-stroke" />');
    });
    rodHoles.forEach((h, rIdx) => {
      lines.push('    <circle id="varilla_' + (rIdx + 1) + '" cx="' + toX(h.x) + '" cy="' + toY(h.y) + '" r="' + rodRadius + '" fill="#ffffff" vector-effect="non-scaling-stroke" />');
    });
    lines.push('  </g>');
  }

  // Capa SVG de Grabado Vectorial procedente de imagen PNG/BMP si la lasca lo incluye
  if (slice.hatchPolylines && slice.hatchPolylines.length > 0 && slice.engraveStyle === 'vector_hatch') {
    let dHatch = '';
    slice.hatchPolylines.forEach((seg) => {
      dHatch += 'M ' + toX(seg[0].x) + ' ' + toY(seg[0].y) + ' L ' + toX(seg[1].x) + ' ' + toY(seg[1].y) + ' ';
    });
    lines.push('  <g id="GRABADO_TRAMA_BARRIDO" fill="none" stroke="#008800" stroke-width="' + strokeMm + '" stroke-linecap="round">');
    lines.push('    <path id="trama_grabado" d="' + dHatch.trim() + '" vector-effect="non-scaling-stroke" />');
    lines.push('  </g>');
  } else if (slice.engraveLoops && slice.engraveLoops.length > 0) {
    let dEng = '';
    slice.engraveLoops.forEach((el) => {
      if (!el.points || el.points.length < 3) return;
      dEng += 'M ' + el.points.map((p) => toX(p.x) + ' ' + toY(p.y)).join(' L ') + ' Z ';
    });
    if (dEng.trim().length > 0) {
      const fillAttr = slice.engraveStyle === 'vector_outline'
        ? 'fill="none"'
        : 'fill="#008800" fill-opacity="0.28" fill-rule="evenodd"';
      lines.push('  <g id="GRABADO_VECTORIAL_IMAGEN" ' + fillAttr + ' stroke="#008800" stroke-width="' + strokeMm + '" stroke-linecap="round" stroke-linejoin="round">');
      lines.push('    <path id="grabado_imagen" d="' + dEng.trim() + '" vector-effect="non-scaling-stroke" />');
      lines.push('  </g>');
    }
  }
  if (slice.fineEdgeLoops && slice.fineEdgeLoops.length > 0) {
    let dFine = '';
    slice.fineEdgeLoops.forEach((fl) => {
      if (!fl.points || fl.points.length < 3) return;
      dFine += 'M ' + fl.points.map((p) => toX(p.x) + ' ' + toY(p.y)).join(' L ') + ' Z ';
    });
    if (dFine.trim().length > 0) {
      lines.push('  <g id="GRABADO_DETALLE_FINO" fill="none" stroke="#ff8800" stroke-width="' + strokeMm + '" stroke-linecap="round" stroke-linejoin="round">');
      lines.push('    <path id="grabado_bordes" d="' + dFine.trim() + '" vector-effect="non-scaling-stroke" />');
      lines.push('  </g>');
    }
  }

  if (sliceFrameEngravePath.trim().length > 0) {
    lines.push('  <g id="GRABADO_MARCO_CONFIGURABLE" fill="#008800" fill-opacity="0.22" fill-rule="evenodd" stroke="#008800" stroke-width="' + strokeMm + '" stroke-linecap="round" stroke-linejoin="round">');
    lines.push('    <path id="orla_marco_2d" d="' + sliceFrameEngravePath.trim() + '" vector-effect="non-scaling-stroke" />');
    lines.push('  </g>');
  }

  // Capa SVG opcional 1: Guía de pegado de la lámina INFERIOR (#N-1) en color violeta (#9900ff) y motivo punteado/raya-punto
  if (lowerGuidePath.trim().length > 0 && lowerSlice) {
    const lowerDashAttr = getSvgDashAttr(state.lowerGuideStyle);
    const lowerLayerId = 'GUIA_INFERIOR_LASCA_' + (lowerSlice.index + 1);
    lines.push('  <g id="' + lowerLayerId + '" fill="none" stroke="#9900ff" stroke-width="' + strokeMm + '"' + lowerDashAttr + ' stroke-linecap="round" stroke-linejoin="round">');
    lines.push('    <path id="guia_inf_trazos" d="' + lowerGuidePath.trim() + '" vector-effect="non-scaling-stroke" />');
    lines.push('  </g>');
  }

  // Capa SVG opcional 2: Guía de pegado de la lámina SUPERIOR (#N+1) en color naranja (#ff8800) y motivo de guiones
  if (upperGuidePath.trim().length > 0 && upperSlice) {
    const upperDashAttr = getSvgDashAttr(state.upperGuideStyle);
    const upperLayerId = 'GUIA_SUPERIOR_LASCA_' + (upperSlice.index + 1);
    lines.push('  <g id="' + upperLayerId + '" fill="none" stroke="#ff8800" stroke-width="' + strokeMm + '"' + upperDashAttr + ' stroke-linecap="round" stroke-linejoin="round">');
    lines.push('    <path id="guia_sup_trazos" d="' + upperGuidePath.trim() + '" vector-effect="non-scaling-stroke" />');
    lines.push('  </g>');
  }

  if (state.includeLabels) {
    let guideNotes = '';
    if (slice.puzzleCode && slice.puzzleSlots) {
      guideNotes += ' | Ranuras:' + slice.puzzleSlots.length;
    } else {
      if (upperGuidePath.trim().length > 0 && upperSlice) guideNotes += ' | Sup:#' + (upperSlice.index + 1);
      if (lowerGuidePath.trim().length > 0 && lowerSlice) guideNotes += ' | Inf:#' + (lowerSlice.index + 1);
    }
    const labelText = escapeXmlAttr(displayCode + ' [' + sliceAxis.toUpperCase() + ':' + slice.coord.toFixed(1) + 'mm | Corte:' + cutBounds.width.toFixed(1) + 'x' + cutBounds.height.toFixed(1) + 'mm | Doc:' + svgW.toFixed(1) + 'x' + svgH.toFixed(1) + 'mm' + guideNotes + ']');
    const labelPad = Math.max(2, Math.min(svgW, svgH) * 0.025);
    const lx = labelPad.toFixed(4);
    const ly = (svgH - labelPad * 0.6).toFixed(4);
    lines.push('  <g id="GRABADO_ETIQUETA">');
    lines.push('    <text x="' + lx + '" y="' + ly + '" font-family="monospace, sans-serif" font-size="' + fontSize + '" fill="#008800">' + labelText + '</text>');

    // También grabar en el interior de cada isla el número y tipo de guía con tamaño autoajustado a la isla
    const sliceIslands = extractIslandsFromSlices([slice]);
    sliceIslands.forEach((isl, iIdx) => {
      const tl = isl.textLayout;
      if (!tl || !tl.lines || tl.lines.length === 0 || tl.fontSizeMM <= 0.04) return;
      const islFont = tl.fontSizeMM.toFixed(3);
      const lineGap = tl.fontSizeMM * 1.12;
      const n = tl.lines.length;
      tl.lines.forEach((lineStr, lIdx) => {
        const lineY = tl.y + ((n - 1) * 0.5 - lIdx) * lineGap;
        lines.push('    <text id="isla_lbl_' + (iIdx + 1) + '_' + (lIdx + 1) + '" x="' + toX(tl.x) + '" y="' + toY(lineY) + '" text-anchor="middle" dominant-baseline="central" font-family="monospace, sans-serif" font-weight="bold" font-size="' + islFont + '" fill="#008800">' + escapeXmlAttr(lineStr) + '</text>');
      });
    });
    lines.push('  </g>');
  }

  lines.push('</svg>');
  return lines.join('\n');
}

// Genera el archivo .SVG de un tablero completo con todas sus islas anidadas
function generateBoardSVG(board) {
  const svgW = board.width;
  const svgH = board.height;
  const toX = (x) => Number(x).toFixed(4);
  const toY = (y) => (svgH - Number(y)).toFixed(4);
  const strokeMm = Math.max(0.15, Math.min(svgW, svgH) * 0.0018).toFixed(4);
  const rodRadius = (state.rodDiameter / 2).toFixed(4);

  let compoundPath = '';
  const outerPaths = [];
  const holePaths = [];
  const rodCircles = [];
  let boardEngravePath = '';
  let upperGuidePath = '';
  let lowerGuidePath = '';
  const islandLabels = [];

  board.placements.forEach((pl, pIdx) => {
    const pts = pl.outerPoints;
    if (!pts || pts.length < 3) return;
    let dOutClosed = 'M ' + toX(pts[0].x) + ' ' + toY(pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      dOutClosed += ' L ' + toX(pts[i].x) + ' ' + toY(pts[i].y);
    }
    dOutClosed += ' Z';
    compoundPath += dOutClosed + ' ';

    const dOutCut = buildSvgCutPathD(pts, false, toX, toY, Boolean(pl.isFrame || (pl.island && pl.island.isFrame)));
    if (dOutCut) {
      outerPaths.push({ id: 'isla_' + (pIdx + 1) + '_lasca_' + (pl.island.sliceIndex + 1), d: dOutCut });
    }

    pl.holes.forEach((h) => {
      if (!h.points || h.points.length < 3) return;
      let dHoleClosed = 'M ' + toX(h.points[0].x) + ' ' + toY(h.points[0].y);
      for (let i = 1; i < h.points.length; i++) {
        dHoleClosed += ' L ' + toX(h.points[i].x) + ' ' + toY(h.points[i].y);
      }
      dHoleClosed += ' Z';
      compoundPath += dHoleClosed + ' ';

      const dHoleCut = buildSvgCutPathD(h.points, true, toX, toY, Boolean(h.isFrame));
      if (dHoleCut) holePaths.push(dHoleCut);
    });

    pl.rods.forEach((r) => {
      rodCircles.push({ cx: toX(r.x), cy: toY(r.y) });
    });

    if (pl.engraveLoops && pl.engraveLoops.length > 0) {
      pl.engraveLoops.forEach((el) => {
        if (!el.points || el.points.length < 3) return;
        boardEngravePath += 'M ' + el.points.map((p) => toX(p.x) + ' ' + toY(p.y)).join(' L ') + ' Z ';
      });
    }

    if (state.includeNextSliceGuide && pl.upperPolys.length > 0) {
      pl.upperPolys.forEach((poly) => {
        if (poly.length < 2) return;
        upperGuidePath += 'M ' + toX(poly[0].x) + ' ' + toY(poly[0].y);
        for (let i = 1; i < poly.length; i++) {
          upperGuidePath += ' L ' + toX(poly[i].x) + ' ' + toY(poly[i].y);
        }
        upperGuidePath += ' ';
      });
    }

    if (state.includePrevSliceGuide && pl.lowerPolys.length > 0) {
      pl.lowerPolys.forEach((poly) => {
        if (poly.length < 2) return;
        lowerGuidePath += 'M ' + toX(poly[0].x) + ' ' + toY(poly[0].y);
        for (let i = 1; i < poly.length; i++) {
          lowerGuidePath += ' L ' + toX(poly[i].x) + ' ' + toY(poly[i].y);
        }
        lowerGuidePath += ' ';
      });
    }

    const tl = pl.textLayout;
    if (tl && tl.lines && tl.lines.length > 0 && tl.fontSizeMM > 0.04) {
      const fontSize = tl.fontSizeMM.toFixed(3);
      const lineGap = tl.fontSizeMM * 1.12;
      const n = tl.lines.length;
      tl.lines.forEach((lineStr, lIdx) => {
        const lineY = tl.y + ((n - 1) * 0.5 - lIdx) * lineGap;
        islandLabels.push({
          x: toX(tl.x),
          y: toY(lineY),
          size: fontSize,
          text: lineStr
        });
      });
    }
  });

  // Marco configurable 2D de corte/grabado alrededor del tablero (sin micro-uniones de sujeción por presión)
  if (state.slicerFrameEnabled && typeof get2DBoardFrameGeometry === 'function') {
    const fGeom = get2DBoardFrameGeometry(0, 0, board.width, board.height, board.placements, true);
    if (fGeom) {
      if (fGeom.outerCutPts && fGeom.outerCutPts.length >= 3) {
        const dOutFrame = buildSvgCutPathD(fGeom.outerCutPts, false, toX, toY, true);
        if (dOutFrame) outerPaths.push({ id: 'marco_corte_exterior_tablero', d: dOutFrame });
      }
      if (fGeom.innerCutPts && fGeom.innerCutPts.length >= 3) {
        const dInFrame = buildSvgCutPathD(fGeom.innerCutPts, true, toX, toY, true);
        if (dInFrame) holePaths.push(dInFrame);
      }
      if (fGeom.keyholePts && fGeom.keyholePts.length >= 3) {
        const dKh = buildSvgCutPathD(fGeom.keyholePts, true, toX, toY, true);
        if (dKh) holePaths.push(dKh);
      }
      if (fGeom.engraveLoops && fGeom.engraveLoops.length > 0) {
        fGeom.engraveLoops.forEach((el) => {
          if (!el.points || el.points.length < 3) return;
          boardEngravePath += 'M ' + el.points.map((p) => toX(p.x) + ' ' + toY(p.y)).join(' L ') + ' Z ';
        });
      }
    }
  }

  const xmlHeader = '<' + '?xml version="1.0" encoding="UTF-8" standalone="no"?' + '>';
  const lines = [
    xmlHeader,
    '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="' + svgW.toFixed(3) + 'mm" height="' + svgH.toFixed(3) + 'mm" viewBox="0 0 ' + svgW.toFixed(4) + ' ' + svgH.toFixed(4) + '" style="background:#ffffff;max-width:100vw;max-height:95vh;">',
    '  <title>' + escapeXmlAttr('Tablero #' + (board.boardIndex + 1) + ' - ' + svgW.toFixed(1) + 'x' + svgH.toFixed(1) + 'mm') + '</title>',
    '  <desc>' + escapeXmlAttr('Tablero Anidado #' + (board.boardIndex + 1) + ' | Dimensiones: ' + svgW.toFixed(1) + 'x' + svgH.toFixed(1) + 'mm | Islas: ' + board.placements.length + ' | Aprovechamiento: ' + board.efficiency.toFixed(1) + '%') + '</desc>'
  ];

  if (compoundPath.trim().length > 0) {
    lines.push('  <g id="VISTA_PREVIA_TABLERO">');
    lines.push('    <path d="' + compoundPath.trim() + '" fill="#0ea5e9" fill-opacity="0.14" fill-rule="evenodd" stroke="none" />');
    lines.push('  </g>');
  }

  lines.push('  <g id="CORTE_EXTERIOR" fill="none" stroke="#ff0000" stroke-width="' + strokeMm + '" stroke-linecap="round" stroke-linejoin="round">');
  outerPaths.forEach((item, i) => {
    lines.push('    <path id="' + escapeXmlAttr(item.id || ('isla_ext_' + (i + 1))) + '" d="' + item.d + '" vector-effect="non-scaling-stroke" />');
  });
  lines.push('  </g>');

  if (holePaths.length > 0 || rodCircles.length > 0) {
    lines.push('  <g id="CORTE_INTERIOR_HUECOS" fill="none" stroke="#0055ff" stroke-width="' + strokeMm + '" stroke-linecap="round" stroke-linejoin="round">');
    holePaths.forEach((d, i) => {
      lines.push('    <path id="isla_hueco_' + (i + 1) + '" d="' + d + '" vector-effect="non-scaling-stroke" />');
    });
    rodCircles.forEach((c, i) => {
      lines.push('    <circle id="isla_varilla_' + (i + 1) + '" cx="' + c.cx + '" cy="' + c.cy + '" r="' + rodRadius + '" fill="#ffffff" vector-effect="non-scaling-stroke" />');
    });
    lines.push('  </g>');
  }

  if (boardEngravePath.trim().length > 0) {
    lines.push('  <g id="GRABADO_VECTORIAL_MARCO_TABLERO" fill="#008800" fill-opacity="0.22" fill-rule="evenodd" stroke="#008800" stroke-width="' + strokeMm + '" stroke-linecap="round" stroke-linejoin="round">');
    lines.push('    <path id="grabado_tablero_trazos" d="' + boardEngravePath.trim() + '" vector-effect="non-scaling-stroke" />');
    lines.push('  </g>');
  }

  if (lowerGuidePath.trim().length > 0) {
    const lowerDashAttr = getSvgDashAttr(state.lowerGuideStyle);
    lines.push('  <g id="GUIA_INFERIOR_TABLERO" fill="none" stroke="#9900ff" stroke-width="' + strokeMm + '"' + lowerDashAttr + ' stroke-linecap="round" stroke-linejoin="round">');
    lines.push('    <path id="guia_inf_tablero_trazos" d="' + lowerGuidePath.trim() + '" vector-effect="non-scaling-stroke" />');
    lines.push('  </g>');
  }

  if (upperGuidePath.trim().length > 0) {
    const upperDashAttr = getSvgDashAttr(state.upperGuideStyle);
    lines.push('  <g id="GUIA_SUPERIOR_TABLERO" fill="none" stroke="#ff8800" stroke-width="' + strokeMm + '"' + upperDashAttr + ' stroke-linecap="round" stroke-linejoin="round">');
    lines.push('    <path id="guia_sup_tablero_trazos" d="' + upperGuidePath.trim() + '" vector-effect="non-scaling-stroke" />');
    lines.push('  </g>');
  }

  if (islandLabels.length > 0 || state.includeLabels) {
    lines.push('  <g id="GRABADO_ETIQUETA_ISLAS">');
    islandLabels.forEach((lbl, i) => {
      lines.push('    <text id="grabado_isla_' + (i + 1) + '" x="' + lbl.x + '" y="' + lbl.y + '" text-anchor="middle" dominant-baseline="central" font-family="monospace, sans-serif" font-weight="bold" font-size="' + lbl.size + '" fill="#008800">' + escapeXmlAttr(lbl.text) + '</text>');
    });
    if (state.includeLabels) {
      const headerText = escapeXmlAttr('TABLERO #' + (board.boardIndex + 1) + ' [' + svgW.toFixed(0) + 'x' + svgH.toFixed(0) + 'mm | Islas: ' + board.placements.length + ' | Uso: ' + board.efficiency.toFixed(1) + '%]');
      lines.push('    <text x="' + Math.max(2, board.margin).toFixed(3) + '" y="' + (svgH - Math.max(1.5, board.margin * 0.4)).toFixed(3) + '" font-family="monospace, sans-serif" font-size="3.200" fill="#008800">' + headerText + '</text>');
    }
    lines.push('  </g>');
  }

  lines.push('</svg>');
  return lines.join('\n');
}

// Genera el archivo .DXF de un tablero completo con todas sus islas y textos de grabado
function generateBoardDXF(board) {
  const dxf = ['0', 'SECTION', '2', 'ENTITIES'];

  board.placements.forEach((pl) => {
    pushLoopLinesWithTabsDXF(dxf, pl.outerPoints, false, 'CORTE_EXTERIOR', '1', 0, 0, Boolean(pl.isFrame || (pl.island && pl.island.isFrame)));
    pl.holes.forEach((h) => pushLoopLinesWithTabsDXF(dxf, h.points, true, 'CORTE_INTERIOR', '5', 0, 0, Boolean(h.isFrame)));
    if (pl.engraveLoops && pl.engraveLoops.length > 0) {
      pl.engraveLoops.forEach((el) => {
        if (!el.points || el.points.length < 3) return;
        for (let i = 0, n = el.points.length; i < n; i++) {
          const p1 = el.points[i];
          const p2 = el.points[(i + 1) % n];
          dxf.push(
            '0', 'LINE',
            '8', 'GRABADO_VECTORIAL',
            '62', '3',
            '10', p1.x.toFixed(4),
            '20', p1.y.toFixed(4),
            '30', '0.0',
            '11', p2.x.toFixed(4),
            '21', p2.y.toFixed(4),
            '31', '0.0'
          );
        }
      });
    }

    if (state.includePrevSliceGuide && pl.lowerPolys.length > 0) {
      pl.lowerPolys.forEach((poly) => {
        for (let i = 0; i < poly.length - 1; i++) {
          dxf.push(
            '0', 'LINE',
            '8', 'GUIA_LASCA_INFERIOR',
            '62', '6',
            '10', poly[i].x.toFixed(4),
            '20', poly[i].y.toFixed(4),
            '30', '0.0',
            '11', poly[i + 1].x.toFixed(4),
            '21', poly[i + 1].y.toFixed(4),
            '31', '0.0'
          );
        }
      });
    }

    if (state.includeNextSliceGuide && pl.upperPolys.length > 0) {
      pl.upperPolys.forEach((poly) => {
        for (let i = 0; i < poly.length - 1; i++) {
          dxf.push(
            '0', 'LINE',
            '8', 'GUIA_LASCA_SUPERIOR',
            '62', '30',
            '10', poly[i].x.toFixed(4),
            '20', poly[i].y.toFixed(4),
            '30', '0.0',
            '11', poly[i + 1].x.toFixed(4),
            '21', poly[i + 1].y.toFixed(4),
            '31', '0.0'
          );
        }
      });
    }

    pl.rods.forEach((r) => {
      dxf.push(
        '0', 'CIRCLE',
        '8', 'VARILLAS_GUIA',
        '62', '5',
        '10', r.x.toFixed(4),
        '20', r.y.toFixed(4),
        '30', '0.0',
        '40', (state.rodDiameter / 2).toFixed(4)
      );
    });

    const tl = pl.textLayout;
    if (tl && tl.lines && tl.lines.length > 0 && tl.fontSizeMM > 0.04) {
      const textH = tl.fontSizeMM;
      const lineGap = textH * 1.12;
      const n = tl.lines.length;
      tl.lines.forEach((lineStr, lIdx) => {
        const lineY = tl.y + ((n - 1) * 0.5 - lIdx) * lineGap;
        const halfW = (lineStr.length * textH * 0.6) * 0.5;
        dxf.push(
          '0', 'TEXT',
          '8', 'GRABADO_ETIQUETA',
          '62', '3',
          '10', (tl.x - halfW).toFixed(4),
          '20', (lineY - textH * 0.35).toFixed(4),
          '30', '0.0',
          '40', textH.toFixed(4),
          '1', lineStr
        );
      });
    }
  });

  // Marco configurable 2D de corte/grabado alrededor del tablero en DXF (sin micro-uniones de sujeción por presión)
  if (state.slicerFrameEnabled && typeof get2DBoardFrameGeometry === 'function') {
    const fGeom = get2DBoardFrameGeometry(0, 0, board.width, board.height, board.placements, true);
    if (fGeom) {
      if (fGeom.outerCutPts && fGeom.outerCutPts.length >= 3) {
        pushLoopLinesWithTabsDXF(dxf, fGeom.outerCutPts, false, 'CORTE_EXTERIOR', '1', 0, 0, true);
      }
      if (fGeom.innerCutPts && fGeom.innerCutPts.length >= 3) {
        pushLoopLinesWithTabsDXF(dxf, fGeom.innerCutPts, true, 'CORTE_INTERIOR', '5', 0, 0, true);
      }
      if (fGeom.keyholePts && fGeom.keyholePts.length >= 3) {
        pushLoopLinesWithTabsDXF(dxf, fGeom.keyholePts, true, 'CORTE_INTERIOR', '5', 0, 0, true);
      }
      if (fGeom.engraveLoops && fGeom.engraveLoops.length > 0) {
        fGeom.engraveLoops.forEach((el) => {
          if (!el.points || el.points.length < 3) return;
          for (let i = 0, n = el.points.length; i < n; i++) {
            const p1 = el.points[i];
            const p2 = el.points[(i + 1) % n];
            dxf.push(
              '0', 'LINE',
              '8', 'GRABADO_VECTORIAL',
              '62', '3',
              '10', p1.x.toFixed(4),
              '20', p1.y.toFixed(4),
              '30', '0.0',
              '11', p2.x.toFixed(4),
              '21', p2.y.toFixed(4),
              '31', '0.0'
            );
          }
        });
      }
    }
  }

  dxf.push('0', 'ENDSEC', '0', 'EOF');
  return dxf.join('\n');
}

// Genera el archivo .SVG de un Soporte Mayor (Apartado 6) con todos los tableros anidados en su interior
function generateCarrierSVG(carrier) {
  const svgW = carrier.width;
  const svgH = carrier.height;
  const toX = (x) => Number(x).toFixed(4);
  const toY = (y) => (svgH - Number(y)).toFixed(4);
  const strokeMm = Math.max(0.15, Math.min(svgW, svgH) * 0.0014).toFixed(4);
  const rodRadius = (state.rodDiameter / 2).toFixed(4);

  let compoundPath = '';
  const outerPaths = [];
  const holePaths = [];
  const rodCircles = [];
  let carrierEngravePath = '';
  let upperGuidePath = '';
  let lowerGuidePath = '';
  const islandLabels = [];
  const boardHeaderLabels = [];

  if (state.carrierCutOuterBorder) {
    const outerCarrierRect = [
      { x: 0, y: 0 },
      { x: svgW, y: 0 },
      { x: svgW, y: svgH },
      { x: 0, y: svgH }
    ];
    outerCarrierRect.isFrame = true;
    const dCarrierCut = buildSvgCutPathD(outerCarrierRect, false, toX, toY, true);
    if (dCarrierCut) {
      outerPaths.push({ id: 'borde_exterior_soporte_mayor', d: dCarrierCut });
    }
  }

  carrier.boardPlacements.forEach((bPl) => {
    const bTag = 'tab_' + (bPl.boardIndex + 1);

    // Borde de corte o marco configurable de cada sub-tablero dentro del Soporte Mayor (sin micro-uniones)
    if (state.carrierCutBoardBorders) {
      if (bPl.boardFrameGeom) {
        const fg = bPl.boardFrameGeom;
        if (fg.outerCutPts && fg.outerCutPts.length >= 3) {
          const dOutF = buildSvgCutPathD(fg.outerCutPts, false, toX, toY, true);
          if (dOutF) outerPaths.push({ id: bTag + '_marco_exterior', d: dOutF });
        }
        if (fg.innerCutPts && fg.innerCutPts.length >= 3) {
          const dInF = buildSvgCutPathD(fg.innerCutPts, true, toX, toY, true);
          if (dInF) holePaths.push(dInF);
        }
        if (fg.keyholePts && fg.keyholePts.length >= 3) {
          const dKh = buildSvgCutPathD(fg.keyholePts, true, toX, toY, true);
          if (dKh) holePaths.push(dKh);
        }
        if (fg.engraveLoops && fg.engraveLoops.length > 0) {
          fg.engraveLoops.forEach((el) => {
            if (!el.points || el.points.length < 3) return;
            carrierEngravePath += 'M ' + el.points.map((p) => toX(p.x) + ' ' + toY(p.y)).join(' L ') + ' Z ';
          });
        }
      } else {
        const rectPts = [
          { x: bPl.x, y: bPl.y },
          { x: bPl.x + bPl.w, y: bPl.y },
          { x: bPl.x + bPl.w, y: bPl.y + bPl.h },
          { x: bPl.x, y: bPl.y + bPl.h }
        ];
        rectPts.isFrame = true;
        const dRect = buildSvgCutPathD(rectPts, false, toX, toY, true);
        if (dRect) outerPaths.push({ id: bTag + '_borde_tablero', d: dRect });
      }
    } else if (bPl.boardFrameGeom && bPl.boardFrameGeom.engraveLoops) {
      bPl.boardFrameGeom.engraveLoops.forEach((el) => {
        if (!el.points || el.points.length < 3) return;
        carrierEngravePath += 'M ' + el.points.map((p) => toX(p.x) + ' ' + toY(p.y)).join(' L ') + ' Z ';
      });
    }

    if (state.carrierEngraveBoardLabels) {
      const padLbl = Math.max(2.5, (bPl.board.margin || 4) * 0.55);
      boardHeaderLabels.push({
        x: toX(bPl.x + padLbl),
        y: toY(bPl.y + bPl.h - padLbl),
        text: 'TABLERO #' + (bPl.boardIndex + 1) + ' (' + bPl.w.toFixed(0) + 'x' + bPl.h.toFixed(0) + 'mm)'
      });
    }

    bPl.transformedPlacements.forEach((pl, pIdx) => {
      const pts = pl.outerPoints;
      if (!pts || pts.length < 3) return;
      let dOutClosed = 'M ' + toX(pts[0].x) + ' ' + toY(pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        dOutClosed += ' L ' + toX(pts[i].x) + ' ' + toY(pts[i].y);
      }
      dOutClosed += ' Z';
      compoundPath += dOutClosed + ' ';

      const dOutCut = buildSvgCutPathD(pts, false, toX, toY, Boolean(pl.isFrame || (pl.island && pl.island.isFrame)));
      if (dOutCut) {
        outerPaths.push({ id: bTag + '_isla_' + (pIdx + 1) + '_lasca_' + (pl.island.sliceIndex + 1), d: dOutCut });
      }

      pl.holes.forEach((h) => {
        if (!h.points || h.points.length < 3) return;
        let dHoleClosed = 'M ' + toX(h.points[0].x) + ' ' + toY(h.points[0].y);
        for (let i = 1; i < h.points.length; i++) {
          dHoleClosed += ' L ' + toX(h.points[i].x) + ' ' + toY(h.points[i].y);
        }
        dHoleClosed += ' Z';
        compoundPath += dHoleClosed + ' ';

        const dHoleCut = buildSvgCutPathD(h.points, true, toX, toY, Boolean(h.isFrame));
        if (dHoleCut) holePaths.push(dHoleCut);
      });

      pl.rods.forEach((r) => {
        rodCircles.push({ cx: toX(r.x), cy: toY(r.y) });
      });

      if (pl.engraveLoops && pl.engraveLoops.length > 0) {
        pl.engraveLoops.forEach((el) => {
          if (!el.points || el.points.length < 3) return;
          carrierEngravePath += 'M ' + el.points.map((p) => toX(p.x) + ' ' + toY(p.y)).join(' L ') + ' Z ';
        });
      }

      if (state.includeNextSliceGuide && pl.upperPolys.length > 0) {
        pl.upperPolys.forEach((poly) => {
          if (poly.length < 2) return;
          upperGuidePath += 'M ' + toX(poly[0].x) + ' ' + toY(poly[0].y);
          for (let i = 1; i < poly.length; i++) {
            upperGuidePath += ' L ' + toX(poly[i].x) + ' ' + toY(poly[i].y);
          }
          upperGuidePath += ' ';
        });
      }

      if (state.includePrevSliceGuide && pl.lowerPolys.length > 0) {
        pl.lowerPolys.forEach((poly) => {
          if (poly.length < 2) return;
          lowerGuidePath += 'M ' + toX(poly[0].x) + ' ' + toY(poly[0].y);
          for (let i = 1; i < poly.length; i++) {
            lowerGuidePath += ' L ' + toX(poly[i].x) + ' ' + toY(poly[i].y);
          }
          lowerGuidePath += ' ';
        });
      }

      const tl = pl.textLayout;
      if (tl && tl.lines && tl.lines.length > 0 && tl.fontSizeMM > 0.04) {
        const fontSize = tl.fontSizeMM.toFixed(3);
        const lineGap = tl.fontSizeMM * 1.12;
        const n = tl.lines.length;
        tl.lines.forEach((lineStr, lIdx) => {
          const lineY = tl.y + ((n - 1) * 0.5 - lIdx) * lineGap;
          islandLabels.push({
            x: toX(tl.x),
            y: toY(lineY),
            size: fontSize,
            text: lineStr
          });
        });
      }
    });
  });

  const xmlHeader = '<' + '?xml version="1.0" encoding="UTF-8" standalone="no"?' + '>';
  const lines = [
    xmlHeader,
    '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="' + svgW.toFixed(3) + 'mm" height="' + svgH.toFixed(3) + 'mm" viewBox="0 0 ' + svgW.toFixed(4) + ' ' + svgH.toFixed(4) + '" style="background:#ffffff;max-width:100vw;max-height:95vh;">',
    '  <title>' + escapeXmlAttr('Soporte Mayor #' + (carrier.carrierIndex + 1) + ' - ' + svgW.toFixed(1) + 'x' + svgH.toFixed(1) + 'mm') + '</title>',
    '  <desc>' + escapeXmlAttr('Soporte Mayor #' + (carrier.carrierIndex + 1) + ' | Dimensiones: ' + svgW.toFixed(1) + 'x' + svgH.toFixed(1) + 'mm | Tableros: ' + carrier.boardPlacements.length + ' | Islas: ' + carrier.totalIslands + ' | Aprovechamiento: ' + carrier.efficiency.toFixed(1) + '%') + '</desc>'
  ];

  if (compoundPath.trim().length > 0) {
    lines.push('  <g id="VISTA_PREVIA_SOPORTE_MAYOR">');
    lines.push('    <path d="' + compoundPath.trim() + '" fill="#0ea5e9" fill-opacity="0.14" fill-rule="evenodd" stroke="none" />');
    lines.push('  </g>');
  }

  lines.push('  <g id="CORTE_EXTERIOR" fill="none" stroke="#ff0000" stroke-width="' + strokeMm + '" stroke-linecap="round" stroke-linejoin="round">');
  outerPaths.forEach((item, i) => {
    lines.push('    <path id="' + escapeXmlAttr(item.id || ('soporte_ext_' + (i + 1))) + '" d="' + item.d + '" vector-effect="non-scaling-stroke" />');
  });
  lines.push('  </g>');

  if (holePaths.length > 0 || rodCircles.length > 0) {
    lines.push('  <g id="CORTE_INTERIOR_HUECOS" fill="none" stroke="#0055ff" stroke-width="' + strokeMm + '" stroke-linecap="round" stroke-linejoin="round">');
    holePaths.forEach((d, i) => {
      lines.push('    <path id="soporte_hueco_' + (i + 1) + '" d="' + d + '" vector-effect="non-scaling-stroke" />');
    });
    rodCircles.forEach((c, i) => {
      lines.push('    <circle id="soporte_varilla_' + (i + 1) + '" cx="' + c.cx + '" cy="' + c.cy + '" r="' + rodRadius + '" fill="#ffffff" vector-effect="non-scaling-stroke" />');
    });
    lines.push('  </g>');
  }

  if (carrierEngravePath.trim().length > 0) {
    lines.push('  <g id="GRABADO_VECTORIAL_SOPORTE" fill="#008800" fill-opacity="0.22" fill-rule="evenodd" stroke="#008800" stroke-width="' + strokeMm + '" stroke-linecap="round" stroke-linejoin="round">');
    lines.push('    <path id="grabado_soporte_trazos" d="' + carrierEngravePath.trim() + '" vector-effect="non-scaling-stroke" />');
    lines.push('  </g>');
  }

  if (lowerGuidePath.trim().length > 0) {
    const lowerDashAttr = getSvgDashAttr(state.lowerGuideStyle);
    lines.push('  <g id="GUIA_INFERIOR_SOPORTE" fill="none" stroke="#9900ff" stroke-width="' + strokeMm + '"' + lowerDashAttr + ' stroke-linecap="round" stroke-linejoin="round">');
    lines.push('    <path id="guia_inf_soporte_trazos" d="' + lowerGuidePath.trim() + '" vector-effect="non-scaling-stroke" />');
    lines.push('  </g>');
  }

  if (upperGuidePath.trim().length > 0) {
    const upperDashAttr = getSvgDashAttr(state.upperGuideStyle);
    lines.push('  <g id="GUIA_SUPERIOR_SOPORTE" fill="none" stroke="#ff8800" stroke-width="' + strokeMm + '"' + upperDashAttr + ' stroke-linecap="round" stroke-linejoin="round">');
    lines.push('    <path id="guia_sup_soporte_trazos" d="' + upperGuidePath.trim() + '" vector-effect="non-scaling-stroke" />');
    lines.push('  </g>');
  }

  if (islandLabels.length > 0 || boardHeaderLabels.length > 0 || state.includeLabels) {
    lines.push('  <g id="GRABADO_ETIQUETAS_SOPORTE">');
    boardHeaderLabels.forEach((bl, i) => {
      lines.push('    <text id="grabado_tablero_hdr_' + (i + 1) + '" x="' + bl.x + '" y="' + bl.y + '" font-family="monospace, sans-serif" font-weight="bold" font-size="3.400" fill="#008800">' + escapeXmlAttr(bl.text) + '</text>');
    });
    islandLabels.forEach((lbl, i) => {
      lines.push('    <text id="grabado_isla_soporte_' + (i + 1) + '" x="' + lbl.x + '" y="' + lbl.y + '" text-anchor="middle" dominant-baseline="central" font-family="monospace, sans-serif" font-weight="bold" font-size="' + lbl.size + '" fill="#008800">' + escapeXmlAttr(lbl.text) + '</text>');
    });
    if (state.includeLabels) {
      const headerText = escapeXmlAttr('SOPORTE MAYOR #' + (carrier.carrierIndex + 1) + ' [' + svgW.toFixed(0) + 'x' + svgH.toFixed(0) + 'mm | Tableros: ' + carrier.boardPlacements.length + ' | Islas: ' + carrier.totalIslands + ' | Uso: ' + carrier.efficiency.toFixed(1) + '%]');
      lines.push('    <text x="' + Math.max(2, carrier.margin).toFixed(3) + '" y="' + (svgH - Math.max(1.5, carrier.margin * 0.4)).toFixed(3) + '" font-family="monospace, sans-serif" font-size="3.600" fill="#008800">' + headerText + '</text>');
    }
    lines.push('  </g>');
  }

  lines.push('</svg>');
  return lines.join('\n');
}

// Genera el archivo .DXF de un Soporte Mayor (Apartado 6) con todos los tableros e islas anidadas
function generateCarrierDXF(carrier) {
  const dxf = ['0', 'SECTION', '2', 'ENTITIES'];

  if (state.carrierCutOuterBorder) {
    const outerCarrierRect = [
      { x: 0, y: 0 },
      { x: carrier.width, y: 0 },
      { x: carrier.width, y: carrier.height },
      { x: 0, y: carrier.height }
    ];
    pushLoopLinesWithTabsDXF(dxf, outerCarrierRect, false, 'CORTE_EXTERIOR', '1', 0, 0, true);
  }

  carrier.boardPlacements.forEach((bPl) => {
    if (state.carrierCutBoardBorders) {
      if (bPl.boardFrameGeom) {
        const fg = bPl.boardFrameGeom;
        if (fg.outerCutPts && fg.outerCutPts.length >= 3) {
          pushLoopLinesWithTabsDXF(dxf, fg.outerCutPts, false, 'CORTE_EXTERIOR', '1', 0, 0, true);
        }
        if (fg.innerCutPts && fg.innerCutPts.length >= 3) {
          pushLoopLinesWithTabsDXF(dxf, fg.innerCutPts, true, 'CORTE_INTERIOR', '5', 0, 0, true);
        }
        if (fg.keyholePts && fg.keyholePts.length >= 3) {
          pushLoopLinesWithTabsDXF(dxf, fg.keyholePts, true, 'CORTE_INTERIOR', '5', 0, 0, true);
        }
        if (fg.engraveLoops && fg.engraveLoops.length > 0) {
          fg.engraveLoops.forEach((el) => {
            if (!el.points || el.points.length < 3) return;
            for (let i = 0, n = el.points.length; i < n; i++) {
              const p1 = el.points[i];
              const p2 = el.points[(i + 1) % n];
              dxf.push(
                '0', 'LINE',
                '8', 'GRABADO_VECTORIAL',
                '62', '3',
                '10', p1.x.toFixed(4),
                '20', p1.y.toFixed(4),
                '30', '0.0',
                '11', p2.x.toFixed(4),
                '21', p2.y.toFixed(4),
                '31', '0.0'
              );
            }
          });
        }
      } else {
        const rectPts = [
          { x: bPl.x, y: bPl.y },
          { x: bPl.x + bPl.w, y: bPl.y },
          { x: bPl.x + bPl.w, y: bPl.y + bPl.h },
          { x: bPl.x, y: bPl.y + bPl.h }
        ];
        pushLoopLinesWithTabsDXF(dxf, rectPts, false, 'CORTE_EXTERIOR', '1', 0, 0, true);
      }
    }

    if (state.carrierEngraveBoardLabels) {
      const padLbl = Math.max(2.5, (bPl.board.margin || 4) * 0.55);
      dxf.push(
        '0', 'TEXT',
        '8', 'GRABADO_ETIQUETA',
        '62', '3',
        '10', (bPl.x + padLbl).toFixed(4),
        '20', (bPl.y + bPl.h - padLbl - 3.2).toFixed(4),
        '30', '0.0',
        '40', '3.2000',
        '1', 'TABLERO #' + (bPl.boardIndex + 1)
      );
    }

    bPl.transformedPlacements.forEach((pl) => {
      pushLoopLinesWithTabsDXF(dxf, pl.outerPoints, false, 'CORTE_EXTERIOR', '1', 0, 0, Boolean(pl.isFrame || (pl.island && pl.island.isFrame)));
      pl.holes.forEach((h) => pushLoopLinesWithTabsDXF(dxf, h.points, true, 'CORTE_INTERIOR', '5', 0, 0, Boolean(h.isFrame)));

      if (pl.engraveLoops && pl.engraveLoops.length > 0) {
        pl.engraveLoops.forEach((el) => {
          if (!el.points || el.points.length < 3) return;
          for (let i = 0, n = el.points.length; i < n; i++) {
            const p1 = el.points[i];
            const p2 = el.points[(i + 1) % n];
            dxf.push(
              '0', 'LINE',
              '8', 'GRABADO_VECTORIAL',
              '62', '3',
              '10', p1.x.toFixed(4),
              '20', p1.y.toFixed(4),
              '30', '0.0',
              '11', p2.x.toFixed(4),
              '21', p2.y.toFixed(4),
              '31', '0.0'
            );
          }
        });
      }

      if (state.includePrevSliceGuide && pl.lowerPolys.length > 0) {
        pl.lowerPolys.forEach((poly) => {
          for (let i = 0; i < poly.length - 1; i++) {
            dxf.push(
              '0', 'LINE',
              '8', 'GUIA_LASCA_INFERIOR',
              '62', '6',
              '10', poly[i].x.toFixed(4),
              '20', poly[i].y.toFixed(4),
              '30', '0.0',
              '11', poly[i + 1].x.toFixed(4),
              '21', poly[i + 1].y.toFixed(4),
              '31', '0.0'
            );
          }
        });
      }

      if (state.includeNextSliceGuide && pl.upperPolys.length > 0) {
        pl.upperPolys.forEach((poly) => {
          for (let i = 0; i < poly.length - 1; i++) {
            dxf.push(
              '0', 'LINE',
              '8', 'GUIA_LASCA_SUPERIOR',
              '62', '30',
              '10', poly[i].x.toFixed(4),
              '20', poly[i].y.toFixed(4),
              '30', '0.0',
              '11', poly[i + 1].x.toFixed(4),
              '21', poly[i + 1].y.toFixed(4),
              '31', '0.0'
            );
          }
        });
      }

      pl.rods.forEach((r) => {
        dxf.push(
          '0', 'CIRCLE',
          '8', 'VARILLAS_GUIA',
          '62', '5',
          '10', r.x.toFixed(4),
          '20', r.y.toFixed(4),
          '30', '0.0',
          '40', (state.rodDiameter / 2).toFixed(4)
        );
      });

      const tl = pl.textLayout;
      if (tl && tl.lines && tl.lines.length > 0 && tl.fontSizeMM > 0.04) {
        const textH = tl.fontSizeMM;
        const lineGap = textH * 1.12;
        const n = tl.lines.length;
        tl.lines.forEach((lineStr, lIdx) => {
          const lineY = tl.y + ((n - 1) * 0.5 - lIdx) * lineGap;
          const halfW = (lineStr.length * textH * 0.6) * 0.5;
          dxf.push(
            '0', 'TEXT',
            '8', 'GRABADO_ETIQUETA',
            '62', '3',
            '10', (tl.x - halfW).toFixed(4),
            '20', (lineY - textH * 0.35).toFixed(4),
            '30', '0.0',
            '40', textH.toFixed(4),
            '1', lineStr
          );
        });
      }
    });
  });

  dxf.push('0', 'ENDSEC', '0', 'EOF');
  return dxf.join('\n');
}

function generateSliceDXF(slice, idx) {
  const upperSlice = typeof idx === 'number' ? getAdjacentSlice(idx, 'next') : null;
  const lowerSlice = typeof idx === 'number' ? getAdjacentSlice(idx, 'prev') : null;
  // Origen global basado en el tamaño total de la pieza para mantener la misma referencia en todos los DXF
  const b = getModelBounds2D(slice.sliceAxis || state.axis);
  const ox = b.minX;
  const oy = b.minY;
  const dxf = ['0', 'SECTION', '2', 'ENTITIES'];

  (slice.loops || []).forEach((loop) => {
    if (!loop.points || loop.points.length < 3) return;
    const layer = loop.isHole ? 'CORTE_INTERIOR' : 'CORTE_EXTERIOR';
    const color = loop.isHole ? '5' : '1';
    pushLoopLinesWithTabsDXF(dxf, loop.points, loop.isHole, layer, color, ox, oy, Boolean(loop.isFrame));
  });

  if (state.slicerFrameEnabled && typeof get2DBoardFrameGeometry === 'function') {
    const fGeom = get2DBoardFrameGeometry(b.minX, b.minY, b.maxX, b.maxY, slice.loops, false);
    if (fGeom) {
      if (fGeom.outerCutPts && fGeom.outerCutPts.length >= 3) {
        pushLoopLinesWithTabsDXF(dxf, fGeom.outerCutPts, false, 'CORTE_EXTERIOR', '1', ox, oy, true);
      }
      if (fGeom.innerCutPts && fGeom.innerCutPts.length >= 3) {
        pushLoopLinesWithTabsDXF(dxf, fGeom.innerCutPts, true, 'CORTE_INTERIOR', '5', ox, oy, true);
      }
      if (fGeom.keyholePts && fGeom.keyholePts.length >= 3) {
        pushLoopLinesWithTabsDXF(dxf, fGeom.keyholePts, true, 'CORTE_INTERIOR', '5', ox, oy, true);
      }
      if (fGeom.engraveLoops && fGeom.engraveLoops.length > 0) {
        fGeom.engraveLoops.forEach((el) => {
          if (!el.points || el.points.length < 3) return;
          for (let i = 0, n = el.points.length; i < n; i++) {
            const p1 = el.points[i];
            const p2 = el.points[(i + 1) % n];
            dxf.push(
              '0', 'LINE',
              '8', 'GRABADO_VECTORIAL',
              '62', '3',
              '10', (p1.x - ox).toFixed(4),
              '20', (p1.y - oy).toFixed(4),
              '30', '0.0',
              '11', (p2.x - ox).toFixed(4),
              '21', (p2.y - oy).toFixed(4),
              '31', '0.0'
            );
          }
        });
      }
    }
  }

  if (slice.engraveLoops && slice.engraveLoops.length > 0) {
    slice.engraveLoops.forEach((el) => {
      if (!el.points || el.points.length < 3) return;
      for (let i = 0, n = el.points.length; i < n; i++) {
        const p1 = el.points[i];
        const p2 = el.points[(i + 1) % n];
        dxf.push(
          '0', 'LINE',
          '8', 'GRABADO_VECTORIAL',
          '62', '3',
          '10', (p1.x - ox).toFixed(4),
          '20', (p1.y - oy).toFixed(4),
          '30', '0.0',
          '11', (p2.x - ox).toFixed(4),
          '21', (p2.y - oy).toFixed(4),
          '31', '0.0'
        );
      }
    });
  }

  // Incluir guía de la lámina INFERIOR (#N-1) en capa independiente DXF si está activada
  if (lowerSlice && lowerSlice.loops) {
    const lowerPolys = getGuidePolylinesForSlice(slice, lowerSlice);
    lowerPolys.forEach((poly) => {
      for (let i = 0; i < poly.length - 1; i++) {
        const p1 = poly[i];
        const p2 = poly[i + 1];
        dxf.push(
          '0', 'LINE',
          '8', 'GUIA_LASCA_INFERIOR',
          '62', '6', // Color magenta/violeta en AutoCAD/DXF
          '10', (p1.x - ox).toFixed(4),
          '20', (p1.y - oy).toFixed(4),
          '30', '0.0',
          '11', (p2.x - ox).toFixed(4),
          '21', (p2.y - oy).toFixed(4),
          '31', '0.0'
        );
      }
    });
  }

  // Incluir guía de la lámina SUPERIOR (#N+1) en capa independiente DXF si está activada
  if (upperSlice && upperSlice.loops) {
    const upperPolys = getGuidePolylinesForSlice(slice, upperSlice);
    upperPolys.forEach((poly) => {
      for (let i = 0; i < poly.length - 1; i++) {
        const p1 = poly[i];
        const p2 = poly[i + 1];
        dxf.push(
          '0', 'LINE',
          '8', 'GUIA_LASCA_SUPERIOR',
          '62', '30', // Color naranja en AutoCAD/DXF
          '10', (p1.x - ox).toFixed(4),
          '20', (p1.y - oy).toFixed(4),
          '30', '0.0',
          '11', (p2.x - ox).toFixed(4),
          '21', (p2.y - oy).toFixed(4),
          '31', '0.0'
        );
      }
    });
  }

  const rods = getAlignmentHoles2D(slice);
  rods.forEach((h) => {
    dxf.push(
      '0', 'CIRCLE',
      '8', 'VARILLAS_GUIA',
      '62', '5',
      '10', (h.x - ox).toFixed(4),
      '20', (h.y - oy).toFixed(4),
      '30', '0.0',
      '40', (state.rodDiameter / 2).toFixed(4)
    );
  });

  dxf.push('0', 'ENDSEC', '0', 'EOF');
  return dxf.join('\n');
}

function generateSliceSTL(slice, idx) {
  const mesh = sliceGroup3D.children.find((m) => m.userData.sliceIndex === idx);
  if (!mesh || !mesh.geometry) return 'solid empty\nendsolid empty';

  const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const pos = g.attributes.position.array;
  const out = ['solid lasca_' + (idx + 1)];

  for (let i = 0; i < pos.length; i += 9) {
    out.push('  facet normal 0 0 1');
    out.push('    outer loop');
    out.push('      vertex ' + pos[i].toFixed(4) + ' ' + pos[i + 1].toFixed(4) + ' ' + pos[i + 2].toFixed(4));
    out.push('      vertex ' + pos[i + 3].toFixed(4) + ' ' + pos[i + 4].toFixed(4) + ' ' + pos[i + 5].toFixed(4));
    out.push('      vertex ' + pos[i + 6].toFixed(4) + ' ' + pos[i + 7].toFixed(4) + ' ' + pos[i + 8].toFixed(4));
    out.push('    endloop');
    out.push('  endfacet');
  }
  out.push('endsolid lasca_' + (idx + 1));
  return out.join('\n');
}

// Descarga de archivos en el navegador mediante Blob URL
function triggerBrowserDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  if (document.body) document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (document.body && a.parentNode === document.body) document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 4000);
}
const triggerDownload = triggerBrowserDownload;
if (typeof window !== 'undefined') {
  window.triggerBrowserDownload = triggerBrowserDownload;
  window.triggerDownload = triggerBrowserDownload;
}

function downloadCurrentSlice(format) {
  if (state.carrierEnabled && (format === 'svg' || format === 'dxf')) {
    const carrier = state.nestedCarriers[state.activeCarrierIndex];
    if (!carrier) return;
    const cNum = String(carrier.carrierIndex + 1).padStart(3, '0');
    const baseCarrierName = state.modelName + '_soporte_mayor_' + cNum + '_' + carrier.width.toFixed(0) + 'x' + carrier.height.toFixed(0) + 'mm';
    if (format === 'svg') {
      const svgContent = generateCarrierSVG(carrier);
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      triggerBrowserDownload(blob, baseCarrierName + '.svg');
    } else {
      const dxfContent = generateCarrierDXF(carrier);
      const blob = new Blob([dxfContent], { type: 'application/dxf;charset=utf-8' });
      triggerBrowserDownload(blob, baseCarrierName + '.dxf');
    }
    return;
  }

  if (state.nestingEnabled && (format === 'svg' || format === 'dxf')) {
    const board = state.nestedBoards[state.activeBoardIndex];
    if (!board) return;
    const bNum = String(board.boardIndex + 1).padStart(3, '0');
    const baseBoardName = state.modelName + '_tablero_' + bNum + '_' + board.width.toFixed(0) + 'x' + board.height.toFixed(0) + 'mm';
    if (format === 'svg') {
      const svgContent = generateBoardSVG(board);
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      triggerBrowserDownload(blob, baseBoardName + '.svg');
    } else {
      const dxfContent = generateBoardDXF(board);
      const blob = new Blob([dxfContent], { type: 'application/dxf;charset=utf-8' });
      triggerBrowserDownload(blob, baseBoardName + '.dxf');
    }
    return;
  }

  const idx = state.activeSliceIndex;
  const slice = state.slices[idx];
  if (!slice) return;
  const numStr = String(idx + 1).padStart(3, '0');
  const sliceCodeStr = slice.puzzleCode ? ('costilla_' + slice.puzzleCode) : ('eje' + state.axis.toUpperCase() + '_lasca_' + numStr);
  const baseName = state.modelName + '_' + sliceCodeStr;

  if (format === 'svg') {
    const svgContent = generateSliceSVG(slice, idx);
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    triggerBrowserDownload(blob, baseName + '.svg');
  } else if (format === 'dxf') {
    const dxfContent = generateSliceDXF(slice, idx);
    const blob = new Blob([dxfContent], { type: 'application/dxf;charset=utf-8' });
    triggerBrowserDownload(blob, baseName + '.dxf');
  } else if (format === 'stl') {
    const stlContent = generateSliceSTL(slice, idx);
    const blob = new Blob([stlContent], { type: 'application/sla;charset=utf-8' });
    triggerBrowserDownload(blob, baseName + '.stl');
  }
}

// =========================================================================
// EXPORTACIÓN POR LOTES EN .ZIP
// =========================================================================
function openExportModal() {
  if (state.isolateCurrent) {
    const radios = document.getElementsByName('exportScope');
    radios.forEach((r) => { r.checked = (r.value === 'current'); });
  }
  const nextChk = document.getElementById('modalNextGuideCheck');
  if (nextChk) nextChk.checked = state.includeNextSliceGuide;
  const prevChk = document.getElementById('modalPrevGuideCheck');
  if (prevChk) prevChk.checked = state.includePrevSliceGuide;
  const lblChk = document.getElementById('modalIncludeLabelsCheck');
  if (lblChk) lblChk.checked = state.includeLabels;
  const nestChk = document.getElementById('modalNestingEnabledCheck');
  if (nestChk) nestChk.checked = state.nestingEnabled;
  const carrierChk = document.getElementById('modalCarrierEnabledCheck');
  if (carrierChk) carrierChk.checked = state.carrierEnabled;
  const numChk = document.getElementById('modalNestEngraveNumCheck');
  if (numChk) numChk.checked = state.nestEngraveSliceNum;
  const guideChk = document.getElementById('modalNestEngraveGuideCheck');
  if (guideChk) guideChk.checked = state.nestEngraveGuideType;
  const modalClipChk = document.getElementById('modalNestClipOversizedCheck');
  if (modalClipChk) modalClipChk.checked = state.nestClipOversized;
  const stackedGuidesBox = document.getElementById('modalStackedGuidesBox');
  if (stackedGuidesBox) stackedGuidesBox.classList.toggle('hidden', state.constructionMode === 'puzzle3d');

  updateFilteredIslandsUI();
  syncHoldingTabsUI();
  if (typeof syncSlicerFrameUI === 'function') syncSlicerFrameUI();
  const subOpts = document.getElementById('modalNestingSubOptions');
  if (subOpts) subOpts.classList.toggle('hidden', !state.nestingEnabled);
  syncBoardInputsUI();
  if (typeof syncCarrierInputsUI === 'function') syncCarrierInputsUI();
  if (typeof syncCarrierUIState === 'function') syncCarrierUIState();
  const modal = document.getElementById('exportModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeExportModal() {
  const modal = document.getElementById('exportModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

// Genera un archivo SVG individual acotado exactamente al bloque de un Conjunto Modular (ej. Conjunto A1 de 300×300 mm)
function generateSectorSliceSVG(slice, idx, sectorCode, sectorCol, sectorRow) {
  if (typeof idx === 'string') {
    sectorCode = idx;
    idx = slice && typeof slice.index === 'number' ? slice.index : 0;
  }
  const g = slice.splitGrid || getSliceSplitGrid(slice.sliceAxis || state.axis, idx);
  if (typeof sectorCol !== 'number' || typeof sectorRow !== 'number') {
    const matchLoop = (slice.loops || []).find((l) => l.sectorCode === sectorCode);
    sectorCol = matchLoop && typeof matchLoop.sectorCol === 'number' ? matchLoop.sectorCol : 0;
    sectorRow = matchLoop && typeof matchLoop.sectorRow === 'number' ? matchLoop.sectorRow : 0;
  }
  const yCellIdx = (g.rows - 1) - sectorRow;
  const cellMinX = sectorCol === 0 ? g.minX : g.xCuts[sectorCol - 1];
  const cellMaxX = sectorCol === g.cols - 1 ? g.maxX : g.xCuts[sectorCol];
  const cellMinY = yCellIdx === 0 ? g.minY : g.yCuts[yCellIdx - 1];
  const cellMaxY = yCellIdx === g.rows - 1 ? g.maxY : g.yCuts[yCellIdx];

  // Expandir ligeramente el lienzo si algún diente cola de milano sobresale hacia el bloque vecino
  const pad = state.splitJointType !== 'straight' ? Math.max(2, Number(state.splitJointDepthMM) || 6) + 2 : 0;
  const minX = cellMinX - pad;
  const minY = cellMinY - pad;
  const svgW = Math.max(10, (cellMaxX - cellMinX) + pad * 2);
  const svgH = Math.max(10, (cellMaxY - cellMinY) + pad * 2);

  const toX = (x) => (Number(x) - minX).toFixed(4);
  const toY = (y) => (svgH - (Number(y) - minY)).toFixed(4);
  const strokeMm = Math.max(0.15, Math.min(svgW, svgH) * 0.0025).toFixed(4);

  const sectorLoops = (slice.loops || []).filter((l) => l.sectorCode === sectorCode);
  let compoundPath = '';
  const outerPaths = [];
  const holePaths = [];

  sectorLoops.forEach((loop) => {
    if (!loop.points || loop.points.length < 3) return;
    const pts = loop.points;
    let dClosed = 'M ' + toX(pts[0].x) + ' ' + toY(pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      dClosed += ' L ' + toX(pts[i].x) + ' ' + toY(pts[i].y);
    }
    dClosed += ' Z';
    compoundPath += dClosed + ' ';

    const cutD = buildSvgCutPathD(pts, loop.isHole, toX, toY);
    if (!cutD) return;
    if (loop.isHole) holePaths.push(cutD);
    else outerPaths.push(cutD);
  });

  const displayBase = slice.puzzleCode ? slice.puzzleCode : ('#' + (idx + 1));
  const fullCode = displayBase + '-' + sectorCode;
  const xmlHeader = '<' + '?xml version="1.0" encoding="UTF-8" standalone="no"?' + '>';

  const lines = [
    xmlHeader,
    '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="' + svgW.toFixed(3) + 'mm" height="' + svgH.toFixed(3) + 'mm" viewBox="0 0 ' + svgW.toFixed(4) + ' ' + svgH.toFixed(4) + '" style="background:#ffffff;max-width:100vw;max-height:95vh;">',
    '  <title>' + escapeXmlAttr('Conjunto ' + sectorCode + ' - Pieza ' + fullCode) + '</title>',
    '  <desc>' + escapeXmlAttr('Conjunto Modular ' + sectorCode + ' (' + g.partW.toFixed(1) + 'x' + g.partH.toFixed(1) + 'mm) | Pieza ' + fullCode) + '</desc>'
  ];

  if (compoundPath.trim().length > 0) {
    lines.push('  <g id="VISTA_PREVIA_PIEZA">');
    lines.push('    <path d="' + compoundPath.trim() + '" fill="#0ea5e9" fill-opacity="0.14" fill-rule="evenodd" stroke="none" />');
    lines.push('  </g>');
  }

  lines.push('  <g id="CORTE_EXTERIOR" fill="none" stroke="#ff0000" stroke-width="' + strokeMm + '" stroke-linecap="round" stroke-linejoin="round">');
  outerPaths.forEach((d, pIdx) => {
    lines.push('    <path id="ext_' + (pIdx + 1) + '" d="' + d + '" vector-effect="non-scaling-stroke" />');
  });
  lines.push('  </g>');

  if (holePaths.length > 0) {
    lines.push('  <g id="CORTE_INTERIOR_HUECOS" fill="none" stroke="#0055ff" stroke-width="' + strokeMm + '" stroke-linecap="round" stroke-linejoin="round">');
    holePaths.forEach((d, hIdx) => {
      lines.push('    <path id="hueco_' + (hIdx + 1) + '" d="' + d + '" vector-effect="non-scaling-stroke" />');
    });
    lines.push('  </g>');
  }

  if (state.includeLabels) {
    const tempSlice = Object.assign({}, slice, { loops: sectorLoops });
    const sectorIslands = extractIslandsFromSlices([tempSlice]);
    if (sectorIslands.length > 0) {
      lines.push('  <g id="GRABADO_TEXTO" fill="#008800" stroke="none" font-family="monospace, sans-serif" font-weight="bold" text-anchor="middle" dominant-baseline="central">');
      sectorIslands.forEach((isl, iIdx) => {
        const tl = isl.textLayout;
        if (!tl || !tl.lines || tl.lines.length === 0 || tl.fontSizeMM <= 0.04) return;
        const fs = tl.fontSizeMM.toFixed(3);
        const lineStep = tl.fontSizeMM * 1.12;
        const n = tl.lines.length;
        for (let k = 0; k < n; k++) {
          const yVal = tl.y - (k - (n - 1) * 0.5) * lineStep;
          lines.push(
            '    <text id="etiqueta_sec_' + (iIdx + 1) + '_' + (k + 1) + '" x="' + toX(tl.x) + '" y="' + toY(yVal) + '" font-size="' + fs + '">' +
            escapeXmlAttr(tl.lines[k]) + '</text>'
          );
        }
      });
      lines.push('  </g>');
    }
  }

  lines.push('</svg>');
  return lines.join('\n');
}

async function executeZipExport() {
  const scopeEl = document.querySelector('input[name="exportScope"]:checked');
  const scope = scopeEl ? scopeEl.value : 'selected';
  const wantSVG = document.getElementById('expFormatSVG').checked;
  const wantDXF = document.getElementById('expFormatDXF').checked;
  const wantSTL = document.getElementById('expFormatSTL').checked;

  if (!wantSVG && !wantDXF && !wantSTL) return;

  let targetSlices = [];
  if (scope === 'all') {
    targetSlices = state.slices.slice();
  } else if (scope === 'current') {
    if (state.slices[state.activeSliceIndex]) targetSlices = [state.slices[state.activeSliceIndex]];
  } else {
    targetSlices = state.slices.filter((s) => s.selected);
  }

  if (targetSlices.length === 0) return;

  const prog = document.getElementById('exportProgressBox');
  prog.classList.remove('hidden');

  const zip = new JSZip();
  const folderSVG = wantSVG ? zip.folder('SVG_Corte_Laser') : null;
  const folderDXF = wantDXF ? zip.folder('DXF_CNC_CAD') : null;
  const folderSTL = wantSTL ? zip.folder('STL_Impresion_3D') : null;

  // Si la distribución en tablero está activa, generamos los tableros anidados para las lascas objetivo
  if (state.nestingEnabled && (wantSVG || wantDXF)) {
    const islands = extractIslandsFromSlices(targetSlices);
    const effectiveMargin = typeof getEffectiveBoardNestMargin === 'function'
      ? getEffectiveBoardNestMargin()
      : state.nestMarginMM;
    const packRes = packIslandsIntoBoards(
      islands,
      state.boardWidthMM,
      state.boardHeightMM,
      effectiveMargin,
      state.nestSpacingMM,
      state.nestAllowRotate,
      state.nestUseInnerHoles
    );
    const boardsForExport = packRes.boards;

    const folderBoardsSVG = wantSVG ? zip.folder('SVG_Tableros_Anidados') : null;
    const folderBoardsDXF = wantDXF ? zip.folder('DXF_Tableros_Anidados') : null;

    boardsForExport.forEach((board) => {
      const bNum = String(board.boardIndex + 1).padStart(3, '0');
      const bName = 'tablero_' + bNum + '_' + board.width.toFixed(0) + 'x' + board.height.toFixed(0) + 'mm';
      if (folderBoardsSVG) folderBoardsSVG.file(bName + '.svg', generateBoardSVG(board));
      if (folderBoardsDXF) folderBoardsDXF.file(bName + '.dxf', generateBoardDXF(board));
    });

    // Si la distribución en Soporte Mayor (Apartado 6) está activa, empaquetamos también los tableros en soportes mayores
    if (state.carrierEnabled && typeof packBoardsIntoCarriers === 'function') {
      const carrierRes = packBoardsIntoCarriers(
        boardsForExport,
        state.carrierWidthMM,
        state.carrierHeightMM,
        state.carrierMarginMM,
        state.carrierSpacingMM,
        state.carrierAllowRotate
      );
      const carriersForExport = carrierRes.carriers || [];
      if (carriersForExport.length > 0) {
        const folderCarriersSVG = wantSVG ? zip.folder('SVG_Soportes_Mayores') : null;
        const folderCarriersDXF = wantDXF ? zip.folder('DXF_Soportes_Mayores') : null;
        carriersForExport.forEach((carrier) => {
          const cNum = String(carrier.carrierIndex + 1).padStart(3, '0');
          const cName = 'soporte_mayor_' + cNum + '_' + carrier.width.toFixed(0) + 'x' + carrier.height.toFixed(0) + 'mm';
          if (folderCarriersSVG) folderCarriersSVG.file(cName + '.svg', generateCarrierSVG(carrier));
          if (folderCarriersDXF) folderCarriersDXF.file(cName + '.dxf', generateCarrierDXF(carrier));
        });
      }
    }
  }

  // Si la Subdivisión Modular 3D está activa, generamos también una carpeta organizada por Conjunto (Conjunto_A1, Conjunto_A2, etc.)
  const folderModularSVG = (wantSVG && state.splitModelEnabled) ? zip.folder('SVG_Conjuntos_Modulares') : null;

  targetSlices.forEach((slice) => {
    const idx = slice.index;
    const numStr = String(idx + 1).padStart(3, '0');
    const sAxis = (slice.sliceAxis || state.axis).toUpperCase();
    const fname = slice.puzzleCode
      ? ('costilla_' + slice.puzzleCode + '_eje' + sAxis + '_' + slice.coord.toFixed(1) + 'mm')
      : ('lasca_' + numStr + '_' + sAxis + '_' + slice.coord.toFixed(1) + 'mm');

    if (folderSVG) folderSVG.file(fname + '.svg', generateSliceSVG(slice, idx));
    if (folderDXF) folderDXF.file(fname + '.dxf', generateSliceDXF(slice, idx));
    if (folderSTL) folderSTL.file(fname + '.stl', generateSliceSTL(slice, idx));

    if (folderModularSVG && slice.splitGrid && slice.splitGrid.totalParts > 1) {
      const seenSectors = new Map();
      (slice.loops || []).forEach((l) => {
        if (!l.isHole && l.sectorCode && !seenSectors.has(l.sectorCode)) {
          seenSectors.set(l.sectorCode, { code: l.sectorCode, col: l.sectorCol || 0, row: l.sectorRow || 0 });
        }
      });
      seenSectors.forEach((sec) => {
        const secFolder = folderModularSVG.folder('Conjunto_' + sec.code);
        const secFname = slice.puzzleCode
          ? ('costilla_' + slice.puzzleCode + '_' + sec.code + '.svg')
          : ('lasca_' + numStr + '_' + sec.code + '.svg');
        secFolder.file(secFname, generateSectorSliceSVG(slice, idx, sec.code, sec.col, sec.row));
      });
    }
  });

  const resumen = generateFullAssemblyGuideText();
  zip.file('LEEME_GUIA_MONTAJE.txt', resumen);
  if (typeof generateIllustratedAssemblyGuideHTML === 'function') {
    const guiaIlustradaHtml = generateIllustratedAssemblyGuideHTML();
    zip.file('GUIA_ILUSTRADA_MONTAJE.html', guiaIlustradaHtml);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const zipSuffix = state.constructionMode === 'puzzle3d'
    ? ('_puzzle3D_' + state.puzzleAxes.toUpperCase())
    : ('_lascas_' + state.axis.toUpperCase());
  triggerBrowserDownload(content, state.modelName + zipSuffix + '.zip');

  prog.classList.add('hidden');
  closeExportModal();
}

// =========================================================================
// IMPORTAR / EXPORTAR PROYECTO (.LASCA / .JSON)
// =========================================================================
function exportProjectFile() {
  const payload = {
    version: '2.7',
    modelName: state.modelName,
    unit: state.unit,
    constructionMode: state.constructionMode,
    puzzleAxes: state.puzzleAxes,
    puzzleCountA: state.puzzleCountA,
    puzzleCountB: state.puzzleCountB,
    puzzleMaterialThicknessMM: state.puzzleMaterialThicknessMM,
    puzzleSlotClearanceMM: state.puzzleSlotClearanceMM,
    splitModelEnabled: state.splitModelEnabled,
    splitMode: state.splitMode,
    splitMaxPartWidthMM: state.splitMaxPartWidthMM,
    splitMaxPartHeightMM: state.splitMaxPartHeightMM,
    splitCols: state.splitCols,
    splitRows: state.splitRows,
    splitJointType: state.splitJointType,
    splitJointDepthMM: state.splitJointDepthMM,
    splitStaggerLayers: state.splitStaggerLayers,
    axis: state.axis,
    mode: state.mode,
    sliceCount: state.sliceCount,
    thickness: state.thickness,
    includeLabels: state.includeLabels,
    includeNextSliceGuide: state.includeNextSliceGuide,
    includePrevSliceGuide: state.includePrevSliceGuide,
    upperGuideStyle: state.upperGuideStyle,
    lowerGuideStyle: state.lowerGuideStyle,
    guideOnlyOuter: state.guideOnlyOuter,
    guideClipToSlice: state.guideClipToSlice,
    filterSmallIslands: state.filterSmallIslands,
    minIslandSizeMM: state.minIslandSizeMM,
    minIslandCriteria: state.minIslandCriteria,
    fillInternalHoles: state.fillInternalHoles,
    fillHolesMode: state.fillHolesMode,
    fillHolesMaxSizeMM: state.fillHolesMaxSizeMM,
    nestingEnabled: state.nestingEnabled,
    boardWidthMM: state.boardWidthMM,
    boardHeightMM: state.boardHeightMM,
    nestSpacingMM: state.nestSpacingMM,
    nestMarginMM: state.nestMarginMM,
    nestAllowRotate: state.nestAllowRotate,
    nestUseInnerHoles: state.nestUseInnerHoles,
    nestClipOversized: state.nestClipOversized,
    nestEngraveSliceNum: state.nestEngraveSliceNum,
    nestEngraveGuideType: state.nestEngraveGuideType,
    carrierEnabled: state.carrierEnabled,
    carrierWidthMM: state.carrierWidthMM,
    carrierHeightMM: state.carrierHeightMM,
    carrierSpacingMM: state.carrierSpacingMM,
    carrierMarginMM: state.carrierMarginMM,
    carrierAllowRotate: state.carrierAllowRotate,
    carrierCutBoardBorders: state.carrierCutBoardBorders,
    carrierCutOuterBorder: state.carrierCutOuterBorder,
    carrierEngraveBoardLabels: state.carrierEngraveBoardLabels,
    rodCount: state.rodCount,
    rodDiameter: state.rodDiameter,
    slicerFrameEnabled: state.slicerFrameEnabled,
    slicerFrameFit: state.slicerFrameFit,
    slicerFrameShape: state.slicerFrameShape,
    slicerFrameLaserMode: state.slicerFrameLaserMode,
    slicerFrameStyle: state.slicerFrameStyle,
    slicerFrameThicknessMM: state.slicerFrameThicknessMM,
    slicerFrameMarginMM: state.slicerFrameMarginMM,
    slicerFrameRadiusMM: state.slicerFrameRadiusMM,
    slicerFrameKeyhole: state.slicerFrameKeyhole,
    slicerFrameKeyholeDiamMM: state.slicerFrameKeyholeDiamMM,
    tabsEnabled: state.tabsEnabled,
    tabMode: state.tabMode,
    tabCount: state.tabCount,
    tabSpacingMM: state.tabSpacingMM,
    tabWidthMM: state.tabWidthMM,
    tabApplyToHoles: state.tabApplyToHoles,
    tabShowMarkers: state.tabShowMarkers,
    dimsMM: state.dimsMM,
    selectedIndices: state.slices.filter((s) => s.selected).map((s) => s.index),
    baseVertices: Array.from(state.baseVertices || [])
  };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json;charset=utf-8' });
  triggerBrowserDownload(blob, state.modelName + '.lasca');
}

function importProjectFile(file) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.baseVertices || !data.dimsMM) return;
      state.modelName = data.modelName || 'proyecto_importado';
      state.baseVertices = new Float32Array(data.baseVertices);
      state.dimsMM = data.dimsMM;
      state.constructionMode = data.constructionMode === 'puzzle3d' ? 'puzzle3d' : 'stacked';
      if (data.puzzleAxes === 'xy' || data.puzzleAxes === 'xz' || data.puzzleAxes === 'yz') {
        state.puzzleAxes = data.puzzleAxes;
      }
      if (typeof data.puzzleCountA === 'number') state.puzzleCountA = data.puzzleCountA;
      if (typeof data.puzzleCountB === 'number') state.puzzleCountB = data.puzzleCountB;
      if (typeof data.puzzleMaterialThicknessMM === 'number') state.puzzleMaterialThicknessMM = data.puzzleMaterialThicknessMM;
      if (typeof data.puzzleSlotClearanceMM === 'number') state.puzzleSlotClearanceMM = data.puzzleSlotClearanceMM;
      if (typeof syncConstructionModeUI === 'function') syncConstructionModeUI();

      if (typeof data.splitModelEnabled === 'boolean') state.splitModelEnabled = data.splitModelEnabled;
      if (data.splitMode === 'max_size' || data.splitMode === 'grid') state.splitMode = data.splitMode;
      if (typeof data.splitMaxPartWidthMM === 'number') state.splitMaxPartWidthMM = data.splitMaxPartWidthMM;
      if (typeof data.splitMaxPartHeightMM === 'number') state.splitMaxPartHeightMM = data.splitMaxPartHeightMM;
      if (typeof data.splitCols === 'number') state.splitCols = data.splitCols;
      if (typeof data.splitRows === 'number') state.splitRows = data.splitRows;
      if (data.splitJointType) state.splitJointType = data.splitJointType;
      if (typeof data.splitJointDepthMM === 'number') state.splitJointDepthMM = data.splitJointDepthMM;
      if (typeof data.splitStaggerLayers === 'boolean') state.splitStaggerLayers = data.splitStaggerLayers;
      if (typeof syncSplitModelUI === 'function') syncSplitModelUI();

      state.axis = data.axis || 'z';
      state.mode = data.mode || 'count';
      state.sliceCount = data.sliceCount || 24;
      state.thickness = data.thickness || 5;
      state.rodCount = data.rodCount || 0;
      state.rodDiameter = data.rodDiameter || 4;
      if (typeof data.slicerFrameEnabled === 'boolean') state.slicerFrameEnabled = data.slicerFrameEnabled;
      if (data.slicerFrameFit) state.slicerFrameFit = data.slicerFrameFit;
      if (data.slicerFrameShape) state.slicerFrameShape = data.slicerFrameShape;
      if (data.slicerFrameLaserMode) state.slicerFrameLaserMode = data.slicerFrameLaserMode;
      if (data.slicerFrameStyle) state.slicerFrameStyle = data.slicerFrameStyle;
      if (typeof data.slicerFrameThicknessMM === 'number') state.slicerFrameThicknessMM = data.slicerFrameThicknessMM;
      if (typeof data.slicerFrameMarginMM === 'number') state.slicerFrameMarginMM = data.slicerFrameMarginMM;
      if (typeof data.slicerFrameRadiusMM === 'number') state.slicerFrameRadiusMM = data.slicerFrameRadiusMM;
      if (typeof data.slicerFrameKeyhole === 'boolean') state.slicerFrameKeyhole = data.slicerFrameKeyhole;
      if (typeof data.slicerFrameKeyholeDiamMM === 'number') state.slicerFrameKeyholeDiamMM = data.slicerFrameKeyholeDiamMM;
      if (typeof syncSlicerFrameUI === 'function') syncSlicerFrameUI();
      if (typeof data.tabsEnabled === 'boolean') state.tabsEnabled = data.tabsEnabled;
      if (data.tabMode === 'count' || data.tabMode === 'spacing') state.tabMode = data.tabMode;
      if (typeof data.tabCount === 'number') state.tabCount = data.tabCount;
      if (typeof data.tabSpacingMM === 'number') state.tabSpacingMM = data.tabSpacingMM;
      if (typeof data.tabWidthMM === 'number') state.tabWidthMM = data.tabWidthMM;
      if (typeof data.tabApplyToHoles === 'boolean') state.tabApplyToHoles = data.tabApplyToHoles;
      if (typeof data.tabShowMarkers === 'boolean') state.tabShowMarkers = data.tabShowMarkers;
      syncHoldingTabsUI();

      if (typeof data.filterSmallIslands === 'boolean') state.filterSmallIslands = data.filterSmallIslands;
      if (typeof data.minIslandSizeMM === 'number') state.minIslandSizeMM = data.minIslandSizeMM;
      if (data.minIslandCriteria) state.minIslandCriteria = data.minIslandCriteria;
      if (typeof data.fillInternalHoles === 'boolean') state.fillInternalHoles = data.fillInternalHoles;
      if (data.fillHolesMode) state.fillHolesMode = data.fillHolesMode;
      if (typeof data.fillHolesMaxSizeMM === 'number') state.fillHolesMaxSizeMM = data.fillHolesMaxSizeMM;

      if (typeof data.includeLabels === 'boolean') setIncludeLabels(data.includeLabels);
      if (typeof data.includeNextSliceGuide === 'boolean') setIncludeNextGuide(data.includeNextSliceGuide);
      if (typeof data.includePrevSliceGuide === 'boolean') setIncludePrevGuide(data.includePrevSliceGuide);
      if (data.upperGuideStyle) {
        state.upperGuideStyle = data.upperGuideStyle;
        const upStyleEl = document.getElementById('guideUpperStyleSelect');
        if (upStyleEl) upStyleEl.value = data.upperGuideStyle;
      }
      if (data.lowerGuideStyle) {
        state.lowerGuideStyle = data.lowerGuideStyle;
        const lowStyleEl = document.getElementById('guideLowerStyleSelect');
        if (lowStyleEl) lowStyleEl.value = data.lowerGuideStyle;
      }
      if (typeof data.guideOnlyOuter === 'boolean') {
        state.guideOnlyOuter = data.guideOnlyOuter;
        const onlyOuterEl = document.getElementById('guideOnlyOuterCheck');
        if (onlyOuterEl) onlyOuterEl.checked = data.guideOnlyOuter;
      }
      if (typeof data.guideClipToSlice === 'boolean') {
        state.guideClipToSlice = data.guideClipToSlice;
        const clipCheckEl = document.getElementById('guideClipCheck');
        if (clipCheckEl) clipCheckEl.checked = data.guideClipToSlice;
      }
      if (typeof data.boardWidthMM === 'number') state.boardWidthMM = data.boardWidthMM;
      if (typeof data.boardHeightMM === 'number') state.boardHeightMM = data.boardHeightMM;
      if (typeof data.nestSpacingMM === 'number') {
        state.nestSpacingMM = data.nestSpacingMM;
        const spEl = document.getElementById('nestSpacingInput');
        if (spEl) spEl.value = data.nestSpacingMM;
      }
      if (typeof data.nestMarginMM === 'number') {
        state.nestMarginMM = data.nestMarginMM;
        const mgEl = document.getElementById('nestMarginInput');
        if (mgEl) mgEl.value = data.nestMarginMM;
      }
      if (typeof data.nestAllowRotate === 'boolean') {
        state.nestAllowRotate = data.nestAllowRotate;
        const rotEl = document.getElementById('nestRotateCheck');
        if (rotEl) rotEl.checked = data.nestAllowRotate;
      }
      if (typeof data.nestUseInnerHoles === 'boolean') {
        state.nestUseInnerHoles = data.nestUseInnerHoles;
        const holesEl = document.getElementById('nestUseHolesCheck');
        if (holesEl) holesEl.checked = data.nestUseInnerHoles;
      }
      if (typeof data.nestClipOversized === 'boolean') {
        setNestClipOversized(data.nestClipOversized);
      }
      if (typeof data.nestEngraveSliceNum === 'boolean') setNestEngraveNum(data.nestEngraveSliceNum);
      if (typeof data.nestEngraveGuideType === 'boolean') setNestEngraveGuideType(data.nestEngraveGuideType);
      if (typeof data.carrierWidthMM === 'number') state.carrierWidthMM = data.carrierWidthMM;
      if (typeof data.carrierHeightMM === 'number') state.carrierHeightMM = data.carrierHeightMM;
      if (typeof data.carrierSpacingMM === 'number') state.carrierSpacingMM = data.carrierSpacingMM;
      if (typeof data.carrierMarginMM === 'number') state.carrierMarginMM = data.carrierMarginMM;
      if (typeof data.carrierAllowRotate === 'boolean') state.carrierAllowRotate = data.carrierAllowRotate;
      if (typeof data.carrierCutBoardBorders === 'boolean') state.carrierCutBoardBorders = data.carrierCutBoardBorders;
      if (typeof data.carrierCutOuterBorder === 'boolean') state.carrierCutOuterBorder = data.carrierCutOuterBorder;
      if (typeof data.carrierEngraveBoardLabels === 'boolean') state.carrierEngraveBoardLabels = data.carrierEngraveBoardLabels;
      if (typeof data.nestingEnabled === 'boolean') setNestingEnabled(data.nestingEnabled);
      if (typeof data.carrierEnabled === 'boolean' && typeof setCarrierEnabled === 'function') {
        setCarrierEnabled(data.carrierEnabled);
      }
      if (typeof syncCarrierInputsUI === 'function') syncCarrierInputsUI();
      if (typeof syncCarrierUIState === 'function') syncCarrierUIState();

      const rodCountEl = document.getElementById('rodCountSelect');
      if (rodCountEl) rodCountEl.value = String(state.rodCount);
      const rodDiamEl = document.getElementById('rodDiameterInput');
      if (rodDiamEl) rodDiamEl.value = state.rodDiameter;
      setDisplayUnit(data.unit || 'mm');
      setSliceAxis(state.axis);
      setSliceMode(state.mode);

      if (Array.isArray(data.selectedIndices)) {
        const setSel = new Set(data.selectedIndices);
        state.slices.forEach((s) => { s.selected = setSel.has(s.index); });
        renderSliceStripUI();
        update3DSlicesTransforms();
      }
      resetCamera3D();
    } catch (err) {
      console.error('Error al importar proyecto:', err);
    }
  };
  reader.readAsText(file);
}
