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

// Fuente vectorial Hershey de trazo único (dominio público) para grabado láser directo en DXF R12 (POLYLINE)
const HERSHEY_GLYPHS_DXF = {
  '0': [[[0.15,0],[0.85,0],[1,0.2],[1,0.8],[0.85,1],[0.15,1],[0,0.8],[0,0.2],[0.15,0]], [[0.15,0.8],[0.85,0.2]]],
  '1': [[[0.2,0.25],[0.5,0],[0.5,1]], [[0.15,1],[0.85,1]]],
  '2': [[[0,0.2],[0.2,0],[0.8,0],[1,0.2],[1,0.4],[0,1],[1,1]]],
  '3': [[[0,0.15],[0.2,0],[0.8,0],[1,0.2],[0.8,0.5],[0.4,0.5]], [[0.8,0.5],[1,0.75],[0.8,1],[0.2,1],[0,0.85]]],
  '4': [[[0.75,1],[0.75,0],[0,0.65],[1,0.65]]],
  '5': [[[1,0],[0.1,0],[0,0.45],[0.8,0.45],[1,0.65],[1,0.85],[0.8,1],[0.15,1],[0,0.85]]],
  '6': [[[0.85,0],[0.2,0],[0,0.25],[0,0.85],[0.2,1],[0.8,1],[1,0.8],[1,0.6],[0.8,0.45],[0,0.45]]],
  '7': [[[0,0],[1,0],[0.35,1]]],
  '8': [[[0.2,0.5],[0,0.3],[0,0.15],[0.2,0],[0.8,0],[1,0.15],[1,0.3],[0.8,0.5],[0.2,0.5],[0,0.7],[0,0.85],[0.2,1],[0.8,1],[1,0.85],[1,0.7],[0.8,0.5]]],
  '9': [[[1,0.5],[0.2,0.5],[0,0.35],[0,0.15],[0.2,0],[0.8,0],[1,0.15],[1,0.8],[0.75,1],[0.15,1]]],
  '#': [[[0.3,0],[0.2,1]], [[0.8,0],[0.7,1]], [[0,0.35],[1,0.35]], [[0,0.68],[1,0.68]]],
  '[': [[[0.75,0],[0.25,0],[0.25,1],[0.75,1]]],
  ']': [[[0.25,0],[0.75,0],[0.75,1],[0.25,1]]],
  '(': [[[0.7,0],[0.3,0.3],[0.3,0.7],[0.7,1]]],
  ')': [[[0.3,0],[0.7,0.3],[0.7,0.7],[0.3,1]]],
  '.': [[[0.4,0.88],[0.6,0.88],[0.6,1],[0.4,1],[0.4,0.88]]],
  ',': [[[0.55,0.85],[0.4,1.1]]],
  ':': [[[0.45,0.25],[0.55,0.25]], [[0.45,0.8],[0.55,0.8]]],
  '-': [[[0.15,0.5],[0.85,0.5]]],
  '+': [[[0.5,0.15],[0.5,0.85]], [[0.15,0.5],[0.85,0.5]]],
  '=': [[[0.15,0.35],[0.85,0.35]], [[0.15,0.65],[0.85,0.65]]],
  '_': [[[0,1],[1,1]]],
  '/': [[[0.15,1],[0.85,0]]],
  '|': [[[0.5,0],[0.5,1]]],
  '%': [[[0.1,1],[0.9,0]], [[0.1,0.1],[0.3,0.1],[0.3,0.3],[0.1,0.3],[0.1,0.1]], [[0.7,0.7],[0.9,0.7],[0.9,0.9],[0.7,0.9],[0.7,0.7]]],
  'A': [[[0,1],[0.5,0],[1,1]], [[0.2,0.65],[0.8,0.65]]],
  'B': [[[0,1],[0,0],[0.75,0],[1,0.15],[1,0.35],[0.75,0.5],[0,0.5]], [[0.75,0.5],[1,0.65],[1,0.85],[0.75,1],[0,1]]],
  'C': [[[1,0.2],[0.8,0],[0.2,0],[0,0.2],[0,0.8],[0.2,1],[0.8,1],[1,0.8]]],
  'D': [[[0,1],[0,0],[0.7,0],[1,0.25],[1,0.75],[0.7,1],[0,1]]],
  'E': [[[1,0],[0,0],[0,1],[1,1]], [[0,0.5],[0.75,0.5]]],
  'F': [[[1,0],[0,0],[0,1]], [[0,0.5],[0.75,0.5]]],
  'G': [[[1,0.2],[0.8,0],[0.2,0],[0,0.2],[0,0.8],[0.2,1],[0.8,1],[1,0.8],[1,0.55],[0.55,0.55]]],
  'H': [[[0,0],[0,1]], [[1,0],[1,1]], [[0,0.5],[1,0.5]]],
  'I': [[[0.2,0],[0.8,0]], [[0.5,0],[0.5,1]], [[0.2,1],[0.8,1]]],
  'J': [[[0.2,0],[0.9,0]], [[0.65,0],[0.65,0.8],[0.4,1],[0.15,1],[0,0.8]]],
  'K': [[[0,0],[0,1]], [[1,0],[0,0.55],[1,1]]],
  'L': [[[0,0],[0,1],[1,1]]],
  'M': [[[0,1],[0,0],[0.5,0.55],[1,0],[1,1]]],
  'N': [[[0,1],[0,0],[1,1],[1,0]]],
  'O': [[[0.2,0],[0.8,0],[1,0.2],[1,0.8],[0.8,1],[0.2,1],[0,0.8],[0,0.2],[0.2,0]]],
  'P': [[[0,1],[0,0],[0.8,0],[1,0.15],[1,0.38],[0.8,0.52],[0,0.52]]],
  'Q': [[[0.2,0],[0.8,0],[1,0.2],[1,0.8],[0.8,1],[0.2,1],[0,0.8],[0,0.2],[0.2,0]], [[0.55,0.65],[1,1]]],
  'R': [[[0,1],[0,0],[0.8,0],[1,0.15],[1,0.38],[0.8,0.52],[0,0.52]], [[0.55,0.52],[1,1]]],
  'S': [[[1,0.18],[0.8,0],[0.2,0],[0,0.18],[0,0.35],[0.2,0.5],[0.8,0.5],[1,0.65],[1,0.85],[0.8,1],[0.2,1],[0,0.82]]],
  'T': [[[0,0],[1,0]], [[0.5,0],[0.5,1]]],
  'U': [[[0,0],[0,0.8],[0.2,1],[0.8,1],[1,0.8],[1,0]]],
  'V': [[[0,0],[0.5,1],[1,0]]],
  'W': [[[0,0],[0.25,1],[0.5,0.45],[0.75,1],[1,0]]],
  'X': [[[0,0],[1,1]], [[1,0],[0,1]]],
  'Y': [[[0,0],[0.5,0.5],[1,0]], [[0.5,0.5],[0.5,1]]],
  'Z': [[[0,0],[1,0],[0,1],[1,1]]]
};

// Convierte una cadena de texto en polilíneas abiertas de trazo único en coordenadas cartesianas DXF (Y hacia arriba)
function hersheyTextToPolylinesDXF(text, tx, ty, fontSize, anchor = 'start', baseline = 'alphabetic') {
  const paths = [];
  const fontH = Math.max(0.8, Number(fontSize) * 0.72);
  const charW = fontH * 0.62;
  const gapW = fontH * 0.18;
  const stepX = charW + gapW;
  const str = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (!str.length) return paths;
  const totalW = str.length * stepX - gapW;
  const startX = anchor === 'middle' ? (tx - totalW * 0.5) : (anchor === 'end' ? (tx - totalW) : tx);
  const topY = baseline === 'central' ? (ty + fontH * 0.5) : (ty + fontH * 0.85);
  for (let ci = 0; ci < str.length; ci++) {
    const ch = str[ci];
    if (ch === ' ') continue;
    const cx0 = startX + ci * stepX;
    const strokes = HERSHEY_GLYPHS_DXF[ch] || [[[0.1, 0.8], [0.9, 0.8]]];
    for (let si = 0; si < strokes.length; si++) {
      const st = strokes[si];
      paths.push({
        closed: false,
        points: st.map(([gx, gy]) => ({
          x: cx0 + gx * charW,
          y: topY - gy * fontH
        }))
      });
    }
  }
  return paths;
}

// Convierte un contorno (aplicando micro-uniones si están activas) en polilíneas para DXF R12
function collectLoopPolylinesWithTabsDXF(targetList, pts, isHole, ox = 0, oy = 0, skipTabs = false) {
  if (!pts || pts.length < 3) return;
  const tabRes = computeLoopWithHoldingTabs(pts, isHole, Boolean(skipTabs || pts.isFrame));
  if (tabRes.isClosed) {
    targetList.push({
      closed: true,
      points: pts.map((p) => ({ x: p.x - ox, y: p.y - oy }))
    });
    return;
  }
  tabRes.subpaths.forEach((poly) => {
    if (!poly || poly.length < 2) return;
    targetList.push({
      closed: false,
      points: poly.map((p) => ({ x: p.x - ox, y: p.y - oy }))
    });
  });
}

// Genera una polilínea circular cerrada para perforaciones de varillas guía en DXF R12
function createCirclePolylineDXF(cx, cy, radius, segments = 24) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const ang = (i / segments) * Math.PI * 2;
    pts.push({
      x: cx + Math.cos(ang) * radius,
      y: cy + Math.sin(ang) * radius
    });
  }
  return { closed: true, points: pts };
}

/**
 * Construye un documento AutoCAD DXF R12 (AC1009) estándar con entidades POLYLINE continuas.
 * Capas y colores ACI compatibles con CAD/CAM universal y ordenación por prioridad láser:
 * - C00, C01, C02 -> ACI 5 (Azul): Grabado de etiquetas, textos vectorizados y líneas guía (Se ejecuta 1.º).
 * - C03           -> ACI 1 (Rojo): Corte de huecos interiores y perforaciones guía (Se ejecuta 2.º, antes del exterior).
 * - C04           -> ACI 1 (Rojo): Corte de contornos exteriores y bordes de tablero (Se ejecuta al final).
 */
function buildStandardLaserDXF(docW, docH, byLayer) {
  const layerNames = ['C00', 'C01', 'C02', 'C03', 'C04'];
  const aciMap = { C00: '5', C01: '5', C02: '5', C03: '1', C04: '1' };
  const safeW = Math.max(1, Number(docW) || 100);
  const safeH = Math.max(1, Number(docH) || 100);

  const out = [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$ACADVER', '1', 'AC1009',
    '9', '$INSUNITS', '70', '4',
    '9', '$EXTMIN', '10', '0.0', '20', '0.0',
    '9', '$EXTMAX', '10', safeW.toFixed(3), '20', safeH.toFixed(3),
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'TABLES',
    '0', 'TABLE', '2', 'LAYER', '70', String(layerNames.length)
  ];

  for (let i = 0; i < layerNames.length; i++) {
    const lid = layerNames[i];
    out.push('0', 'LAYER', '2', lid, '70', '0', '62', aciMap[lid], '6', 'CONTINUOUS');
  }
  out.push('0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES');

  for (let i = 0; i < layerNames.length; i++) {
    const lid = layerNames[i];
    const aci = aciMap[lid];
    const list = (byLayer && byLayer[lid]) ? byLayer[lid] : [];
    for (let j = 0; j < list.length; j++) {
      const sp = list[j];
      if (!sp || !sp.points || sp.points.length < 2) continue;
      out.push('0', 'POLYLINE', '8', lid, '62', aci, '66', '1', '70', sp.closed ? '1' : '0');
      for (let k = 0; k < sp.points.length; k++) {
        const pt = sp.points[k];
        out.push('0', 'VERTEX', '8', lid, '62', aci, '10', Number(pt.x).toFixed(3), '20', Number(pt.y).toFixed(3), '30', '0.0');
      }
      out.push('0', 'SEQEND', '8', lid);
    }
  }

  out.push('0', 'ENDSEC', '0', 'EOF');
  return out.join('\n');
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

// Genera el archivo .DXF R12 (AC1009) de un tablero completo con polilíneas continuas y textos vectorizados Hershey
function generateBoardDXF(board) {
  const byLayer = { C00: [], C01: [], C02: [], C03: [], C04: [] };
  const rodRadius = state.rodDiameter / 2;

  board.placements.forEach((pl) => {
    collectLoopPolylinesWithTabsDXF(
      byLayer.C04,
      pl.outerPoints,
      false,
      0,
      0,
      Boolean(pl.isFrame || (pl.island && pl.island.isFrame))
    );
    pl.holes.forEach((h) => {
      collectLoopPolylinesWithTabsDXF(byLayer.C03, h.points, true, 0, 0, Boolean(h.isFrame));
    });
    if (pl.engraveLoops && pl.engraveLoops.length > 0) {
      pl.engraveLoops.forEach((el) => {
        if (!el.points || el.points.length < 3) return;
        byLayer.C00.push({
          closed: true,
          points: el.points.map((p) => ({ x: p.x, y: p.y }))
        });
      });
    }

    if (state.includeNextSliceGuide && pl.upperPolys.length > 0) {
      pl.upperPolys.forEach((poly) => {
        if (!poly || poly.length < 2) return;
        byLayer.C01.push({
          closed: false,
          points: poly.map((p) => ({ x: p.x, y: p.y }))
        });
      });
    }

    if (state.includePrevSliceGuide && pl.lowerPolys.length > 0) {
      pl.lowerPolys.forEach((poly) => {
        if (!poly || poly.length < 2) return;
        byLayer.C02.push({
          closed: false,
          points: poly.map((p) => ({ x: p.x, y: p.y }))
        });
      });
    }

    pl.rods.forEach((r) => {
      byLayer.C03.push(createCirclePolylineDXF(r.x, r.y, rodRadius));
    });

    const tl = pl.textLayout;
    if (tl && tl.lines && tl.lines.length > 0 && tl.fontSizeMM > 0.04) {
      const textH = tl.fontSizeMM;
      const lineGap = textH * 1.12;
      const n = tl.lines.length;
      tl.lines.forEach((lineStr, lIdx) => {
        const lineY = tl.y + ((n - 1) * 0.5 - lIdx) * lineGap;
        byLayer.C00.push(...hersheyTextToPolylinesDXF(lineStr, tl.x, lineY, textH, 'middle', 'central'));
      });
    }
  });

  if (state.includeLabels) {
    const headerText = 'TABLERO #' + (board.boardIndex + 1) + ' [' + board.width.toFixed(0) + 'x' + board.height.toFixed(0) + 'mm | Islas: ' + board.placements.length + ' | Uso: ' + board.efficiency.toFixed(1) + '%]';
    const hx = Math.max(2, board.margin);
    const hy = Math.max(1.5, board.margin * 0.4);
    byLayer.C00.push(...hersheyTextToPolylinesDXF(headerText, hx, hy, 3.2, 'start', 'alphabetic'));
  }

  // Marco configurable 2D de corte/grabado alrededor del tablero en DXF (sin micro-uniones de sujeción por presión)
  if (state.slicerFrameEnabled && typeof get2DBoardFrameGeometry === 'function') {
    const fGeom = get2DBoardFrameGeometry(0, 0, board.width, board.height, board.placements, true);
    if (fGeom) {
      if (fGeom.outerCutPts && fGeom.outerCutPts.length >= 3) {
        collectLoopPolylinesWithTabsDXF(byLayer.C04, fGeom.outerCutPts, false, 0, 0, true);
      }
      if (fGeom.innerCutPts && fGeom.innerCutPts.length >= 3) {
        collectLoopPolylinesWithTabsDXF(byLayer.C03, fGeom.innerCutPts, true, 0, 0, true);
      }
      if (fGeom.keyholePts && fGeom.keyholePts.length >= 3) {
        collectLoopPolylinesWithTabsDXF(byLayer.C03, fGeom.keyholePts, true, 0, 0, true);
      }
      if (fGeom.engraveLoops && fGeom.engraveLoops.length > 0) {
        fGeom.engraveLoops.forEach((el) => {
          if (!el.points || el.points.length < 3) return;
          byLayer.C00.push({
            closed: true,
            points: el.points.map((p) => ({ x: p.x, y: p.y }))
          });
        });
      }
    }
  }

  return buildStandardLaserDXF(board.width, board.height, byLayer);
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

// Genera el archivo .DXF R12 (AC1009) de un Soporte Mayor (Apartado 6) con polilíneas continuas y textos vectorizados Hershey
function generateCarrierDXF(carrier) {
  const byLayer = { C00: [], C01: [], C02: [], C03: [], C04: [] };
  const rodRadius = state.rodDiameter / 2;

  if (state.carrierCutOuterBorder) {
    const outerCarrierRect = [
      { x: 0, y: 0 },
      { x: carrier.width, y: 0 },
      { x: carrier.width, y: carrier.height },
      { x: 0, y: carrier.height }
    ];
    collectLoopPolylinesWithTabsDXF(byLayer.C04, outerCarrierRect, false, 0, 0, true);
  }

  carrier.boardPlacements.forEach((bPl) => {
    if (state.carrierCutBoardBorders) {
      if (bPl.boardFrameGeom) {
        const fg = bPl.boardFrameGeom;
        if (fg.outerCutPts && fg.outerCutPts.length >= 3) {
          collectLoopPolylinesWithTabsDXF(byLayer.C04, fg.outerCutPts, false, 0, 0, true);
        }
        if (fg.innerCutPts && fg.innerCutPts.length >= 3) {
          collectLoopPolylinesWithTabsDXF(byLayer.C03, fg.innerCutPts, true, 0, 0, true);
        }
        if (fg.keyholePts && fg.keyholePts.length >= 3) {
          collectLoopPolylinesWithTabsDXF(byLayer.C03, fg.keyholePts, true, 0, 0, true);
        }
        if (fg.engraveLoops && fg.engraveLoops.length > 0) {
          fg.engraveLoops.forEach((el) => {
            if (!el.points || el.points.length < 3) return;
            byLayer.C00.push({
              closed: true,
              points: el.points.map((p) => ({ x: p.x, y: p.y }))
            });
          });
        }
      } else {
        const rectPts = [
          { x: bPl.x, y: bPl.y },
          { x: bPl.x + bPl.w, y: bPl.y },
          { x: bPl.x + bPl.w, y: bPl.y + bPl.h },
          { x: bPl.x, y: bPl.y + bPl.h }
        ];
        collectLoopPolylinesWithTabsDXF(byLayer.C04, rectPts, false, 0, 0, true);
      }
    } else if (bPl.boardFrameGeom && bPl.boardFrameGeom.engraveLoops) {
      bPl.boardFrameGeom.engraveLoops.forEach((el) => {
        if (!el.points || el.points.length < 3) return;
        byLayer.C00.push({
          closed: true,
          points: el.points.map((p) => ({ x: p.x, y: p.y }))
        });
      });
    }

    if (state.carrierEngraveBoardLabels) {
      const padLbl = Math.max(2.5, (bPl.board.margin || 4) * 0.55);
      const bLblText = 'TABLERO #' + (bPl.boardIndex + 1) + ' (' + bPl.w.toFixed(0) + 'x' + bPl.h.toFixed(0) + 'mm)';
      byLayer.C00.push(...hersheyTextToPolylinesDXF(bLblText, bPl.x + padLbl, bPl.y + bPl.h - padLbl, 3.4, 'start', 'alphabetic'));
    }

    bPl.transformedPlacements.forEach((pl) => {
      collectLoopPolylinesWithTabsDXF(
        byLayer.C04,
        pl.outerPoints,
        false,
        0,
        0,
        Boolean(pl.isFrame || (pl.island && pl.island.isFrame))
      );
      pl.holes.forEach((h) => {
        collectLoopPolylinesWithTabsDXF(byLayer.C03, h.points, true, 0, 0, Boolean(h.isFrame));
      });

      if (pl.engraveLoops && pl.engraveLoops.length > 0) {
        pl.engraveLoops.forEach((el) => {
          if (!el.points || el.points.length < 3) return;
          byLayer.C00.push({
            closed: true,
            points: el.points.map((p) => ({ x: p.x, y: p.y }))
          });
        });
      }

      if (state.includeNextSliceGuide && pl.upperPolys.length > 0) {
        pl.upperPolys.forEach((poly) => {
          if (!poly || poly.length < 2) return;
          byLayer.C01.push({
            closed: false,
            points: poly.map((p) => ({ x: p.x, y: p.y }))
          });
        });
      }

      if (state.includePrevSliceGuide && pl.lowerPolys.length > 0) {
        pl.lowerPolys.forEach((poly) => {
          if (!poly || poly.length < 2) return;
          byLayer.C02.push({
            closed: false,
            points: poly.map((p) => ({ x: p.x, y: p.y }))
          });
        });
      }

      pl.rods.forEach((r) => {
        byLayer.C03.push(createCirclePolylineDXF(r.x, r.y, rodRadius));
      });

      const tl = pl.textLayout;
      if (tl && tl.lines && tl.lines.length > 0 && tl.fontSizeMM > 0.04) {
        const textH = tl.fontSizeMM;
        const lineGap = textH * 1.12;
        const n = tl.lines.length;
        tl.lines.forEach((lineStr, lIdx) => {
          const lineY = tl.y + ((n - 1) * 0.5 - lIdx) * lineGap;
          byLayer.C00.push(...hersheyTextToPolylinesDXF(lineStr, tl.x, lineY, textH, 'middle', 'central'));
        });
      }
    });
  });

  if (state.includeLabels) {
    const headerText = 'SOPORTE MAYOR #' + (carrier.carrierIndex + 1) + ' [' + carrier.width.toFixed(0) + 'x' + carrier.height.toFixed(0) + 'mm | Tableros: ' + carrier.boardPlacements.length + ' | Islas: ' + carrier.totalIslands + ' | Uso: ' + carrier.efficiency.toFixed(1) + '%]';
    const hx = Math.max(2, carrier.margin);
    const hy = Math.max(1.5, carrier.margin * 0.4);
    byLayer.C00.push(...hersheyTextToPolylinesDXF(headerText, hx, hy, 3.6, 'start', 'alphabetic'));
  }

  return buildStandardLaserDXF(carrier.width, carrier.height, byLayer);
}

// Genera el archivo .DXF R12 (AC1009) de una lámina/costilla individual con polilíneas continuas y textos Hershey
function generateSliceDXF(slice, idx) {
  const sliceAxis = slice.sliceAxis || state.axis;
  const upperSlice = typeof idx === 'number' ? getAdjacentSlice(idx, 'next') : null;
  const lowerSlice = typeof idx === 'number' ? getAdjacentSlice(idx, 'prev') : null;
  // Origen global basado en el tamaño total de la pieza para mantener la misma referencia en todos los DXF
  const b = getModelBounds2D(sliceAxis);
  const cutBounds = getSliceBounds2D(slice);
  const ox = b.minX;
  const oy = b.minY;
  const docW = b.width;
  const docH = b.height;
  const byLayer = { C00: [], C01: [], C02: [], C03: [], C04: [] };

  (slice.loops || []).forEach((loop) => {
    if (!loop.points || loop.points.length < 3) return;
    const target = loop.isHole ? byLayer.C03 : byLayer.C04;
    collectLoopPolylinesWithTabsDXF(target, loop.points, loop.isHole, ox, oy, Boolean(loop.isFrame));
  });

  if (state.slicerFrameEnabled && typeof get2DBoardFrameGeometry === 'function') {
    const fGeom = get2DBoardFrameGeometry(b.minX, b.minY, b.maxX, b.maxY, slice.loops, false);
    if (fGeom) {
      if (fGeom.outerCutPts && fGeom.outerCutPts.length >= 3) {
        collectLoopPolylinesWithTabsDXF(byLayer.C04, fGeom.outerCutPts, false, ox, oy, true);
      }
      if (fGeom.innerCutPts && fGeom.innerCutPts.length >= 3) {
        collectLoopPolylinesWithTabsDXF(byLayer.C03, fGeom.innerCutPts, true, ox, oy, true);
      }
      if (fGeom.keyholePts && fGeom.keyholePts.length >= 3) {
        collectLoopPolylinesWithTabsDXF(byLayer.C03, fGeom.keyholePts, true, ox, oy, true);
      }
      if (fGeom.engraveLoops && fGeom.engraveLoops.length > 0) {
        fGeom.engraveLoops.forEach((el) => {
          if (!el.points || el.points.length < 3) return;
          byLayer.C00.push({
            closed: true,
            points: el.points.map((p) => ({ x: p.x - ox, y: p.y - oy }))
          });
        });
      }
    }
  }

  if (slice.hatchPolylines && slice.hatchPolylines.length > 0 && slice.engraveStyle === 'vector_hatch') {
    slice.hatchPolylines.forEach((seg) => {
      if (!seg || seg.length < 2) return;
      byLayer.C00.push({
        closed: false,
        points: seg.map((p) => ({ x: p.x - ox, y: p.y - oy }))
      });
    });
  } else if (slice.engraveLoops && slice.engraveLoops.length > 0) {
    slice.engraveLoops.forEach((el) => {
      if (!el.points || el.points.length < 3) return;
      byLayer.C00.push({
        closed: true,
        points: el.points.map((p) => ({ x: p.x - ox, y: p.y - oy }))
      });
    });
  }

  if (slice.fineEdgeLoops && slice.fineEdgeLoops.length > 0) {
    slice.fineEdgeLoops.forEach((fl) => {
      if (!fl.points || fl.points.length < 3) return;
      byLayer.C00.push({
        closed: true,
        points: fl.points.map((p) => ({ x: p.x - ox, y: p.y - oy }))
      });
    });
  }

  let hasUpperGuide = false;
  if (upperSlice && upperSlice.loops) {
    const upperPolys = getGuidePolylinesForSlice(slice, upperSlice);
    upperPolys.forEach((poly) => {
      if (!poly || poly.length < 2) return;
      hasUpperGuide = true;
      byLayer.C01.push({
        closed: false,
        points: poly.map((p) => ({ x: p.x - ox, y: p.y - oy }))
      });
    });
  }

  let hasLowerGuide = false;
  if (lowerSlice && lowerSlice.loops) {
    const lowerPolys = getGuidePolylinesForSlice(slice, lowerSlice);
    lowerPolys.forEach((poly) => {
      if (!poly || poly.length < 2) return;
      hasLowerGuide = true;
      byLayer.C02.push({
        closed: false,
        points: poly.map((p) => ({ x: p.x - ox, y: p.y - oy }))
      });
    });
  }

  const rods = getAlignmentHoles2D(slice);
  const rodRadius = state.rodDiameter / 2;
  rods.forEach((h) => {
    byLayer.C03.push(createCirclePolylineDXF(h.x - ox, h.y - oy, rodRadius));
  });

  if (state.includeLabels) {
    const displayCode = slice.puzzleCode ? slice.puzzleCode : ('#' + (idx + 1));
    const fontSize = Math.max(2.5, Math.min(docW, docH) * 0.028);
    let guideNotes = '';
    if (slice.puzzleCode && slice.puzzleSlots) {
      guideNotes += ' | Ranuras:' + slice.puzzleSlots.length;
    } else {
      if (hasUpperGuide && upperSlice) guideNotes += ' | Sup:#' + (upperSlice.index + 1);
      if (hasLowerGuide && lowerSlice) guideNotes += ' | Inf:#' + (lowerSlice.index + 1);
    }
    const labelText = displayCode + ' [' + sliceAxis.toUpperCase() + ':' + slice.coord.toFixed(1) + 'mm | Corte:' + cutBounds.width.toFixed(1) + 'x' + cutBounds.height.toFixed(1) + 'mm | Doc:' + docW.toFixed(1) + 'x' + docH.toFixed(1) + 'mm' + guideNotes + ']';
    const labelPad = Math.max(2, Math.min(docW, docH) * 0.025);
    byLayer.C00.push(...hersheyTextToPolylinesDXF(labelText, labelPad, labelPad * 0.6, fontSize, 'start', 'alphabetic'));

    const sliceIslands = extractIslandsFromSlices([slice]);
    sliceIslands.forEach((isl) => {
      const tl = isl.textLayout;
      if (!tl || !tl.lines || tl.lines.length === 0 || tl.fontSizeMM <= 0.04) return;
      const textH = tl.fontSizeMM;
      const lineGap = textH * 1.12;
      const n = tl.lines.length;
      tl.lines.forEach((lineStr, lIdx) => {
        const lineY = tl.y + ((n - 1) * 0.5 - lIdx) * lineGap;
        byLayer.C00.push(...hersheyTextToPolylinesDXF(lineStr, tl.x - ox, lineY - oy, textH, 'middle', 'central'));
      });
    });
  }

  return buildStandardLaserDXF(docW, docH, byLayer);
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

// Genera un archivo DXF R12 (AC1009) individual acotado al bloque de un Conjunto Modular (con textos Hershey)
function generateSectorSliceDXF(slice, idx, sectorCode, sectorCol, sectorRow) {
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

  const pad = state.splitJointType !== 'straight' ? Math.max(2, Number(state.splitJointDepthMM) || 6) + 2 : 0;
  const minX = cellMinX - pad;
  const minY = cellMinY - pad;
  const docW = Math.max(10, (cellMaxX - cellMinX) + pad * 2);
  const docH = Math.max(10, (cellMaxY - cellMinY) + pad * 2);

  const sectorLoops = (slice.loops || []).filter((l) => l.sectorCode === sectorCode);
  const byLayer = { C00: [], C01: [], C02: [], C03: [], C04: [] };

  sectorLoops.forEach((loop) => {
    if (!loop.points || loop.points.length < 3) return;
    const target = loop.isHole ? byLayer.C03 : byLayer.C04;
    collectLoopPolylinesWithTabsDXF(target, loop.points, loop.isHole, minX, minY);
  });

  if (state.includeLabels) {
    const tempSlice = Object.assign({}, slice, { loops: sectorLoops });
    const sectorIslands = extractIslandsFromSlices([tempSlice]);
    sectorIslands.forEach((isl) => {
      const tl = isl.textLayout;
      if (!tl || !tl.lines || tl.lines.length === 0 || tl.fontSizeMM <= 0.04) return;
      const fs = tl.fontSizeMM;
      const lineStep = fs * 1.12;
      const n = tl.lines.length;
      for (let k = 0; k < n; k++) {
        const yVal = tl.y - (k - (n - 1) * 0.5) * lineStep;
        byLayer.C00.push(...hersheyTextToPolylinesDXF(tl.lines[k], tl.x - minX, yVal - minY, fs, 'middle', 'central'));
      }
    });
  }

  return buildStandardLaserDXF(docW, docH, byLayer);
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
  const folderModularDXF = (wantDXF && state.splitModelEnabled) ? zip.folder('DXF_Conjuntos_Modulares') : null;

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

    if ((folderModularSVG || folderModularDXF) && slice.splitGrid && slice.splitGrid.totalParts > 1) {
      const seenSectors = new Map();
      (slice.loops || []).forEach((l) => {
        if (!l.isHole && l.sectorCode && !seenSectors.has(l.sectorCode)) {
          seenSectors.set(l.sectorCode, { code: l.sectorCode, col: l.sectorCol || 0, row: l.sectorRow || 0 });
        }
      });
      seenSectors.forEach((sec) => {
        const secBase = slice.puzzleCode
          ? ('costilla_' + slice.puzzleCode + '_' + sec.code)
          : ('lasca_' + numStr + '_' + sec.code);
        if (folderModularSVG) {
          const secFolderSvg = folderModularSVG.folder('Conjunto_' + sec.code);
          secFolderSvg.file(secBase + '.svg', generateSectorSliceSVG(slice, idx, sec.code, sec.col, sec.row));
        }
        if (folderModularDXF) {
          const secFolderDxf = folderModularDXF.folder('Conjunto_' + sec.code);
          secFolderDxf.file(secBase + '.dxf', generateSectorSliceDXF(slice, idx, sec.code, sec.col, sec.row));
        }
      });
    }
  });

  const resumen = generateFullAssemblyGuideText();
  zip.file('LEEME_GUIA_MONTAJE.txt', resumen);
  if (typeof generateIllustratedAssemblyGuideHTML === 'function') {
    const guiaIlustradaHtml = generateIllustratedAssemblyGuideHTML();
    zip.file('GUIA_ILUSTRADA_MONTAJE.html', guiaIlustradaHtml);
  }
  if (typeof getOkfRecipePayload === 'function') {
    zip.file('PROYECTO_OKF.lasca', JSON.stringify(getOkfRecipePayload(false), null, 2));
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
// IMPORTAR / EXPORTAR PROYECTO (.LASCA / .JSON) E INTEGRACIÓN OKF
// =========================================================================
// Compacta baseVertices para archivos .lasca cuando la malla original supera maxTriangles (ej. STLs de >1M triángulos)
function compactBaseVerticesForLasca(baseVertices, maxTriangles = 36000) {
  if (!baseVertices || !baseVertices.length) return [];
  const totalTris = Math.floor(baseVertices.length / 9);
  if (totalTris <= maxTriangles) {
    const out = new Array(baseVertices.length);
    for (let i = 0; i < baseVertices.length; i++) {
      out[i] = Math.round(baseVertices[i] * 10000) / 10000;
    }
    return out;
  }

  // Reconstrucción 2.5D sólida estanca en rejilla 96 x 128 desde la envolvente superior z_max(x, y) hasta z_min (-0.5)
  const nx = 96;
  const ny = 128;
  const zGrid = new Float32Array(nx * ny).fill(-0.5);
  const dx = 1.0 / (nx - 1);
  const dy = 1.0 / (ny - 1);

  for (let i = 0; i < baseVertices.length; i += 3) {
    const x = baseVertices[i];
    const y = baseVertices[i + 1];
    const z = baseVertices[i + 2];
    const ix = Math.max(0, Math.min(nx - 1, Math.round((x + 0.5) / dx)));
    const iy = Math.max(0, Math.min(ny - 1, Math.round((y + 0.5) / dy)));
    const idx = iy * nx + ix;
    if (z > zGrid[idx]) zGrid[idx] = z;
  }

  const padW = nx + 2;
  const padH = ny + 2;
  const zPad = new Float32Array(padW * padH).fill(-0.5);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      zPad[(j + 1) * padW + (i + 1)] = zGrid[j * nx + i];
    }
  }

  const out = [];
  const r4 = (v) => Math.round(v * 10000) / 10000;
  const baseZ = -0.5;

  for (let j = 0; j < padH - 1; j++) {
    const y0 = r4(-0.5 + (j - 1) * dy);
    const y1 = r4(-0.5 + j * dy);
    for (let i = 0; i < padW - 1; i++) {
      const z00 = r4(zPad[j * padW + i]);
      const z10 = r4(zPad[j * padW + (i + 1)]);
      const z01 = r4(zPad[(j + 1) * padW + i]);
      const z11 = r4(zPad[(j + 1) * padW + (i + 1)]);
      if (Math.max(z00, z10, z01, z11) <= baseZ + 0.005) continue;
      const x0 = r4(-0.5 + (i - 1) * dx);
      const x1 = r4(-0.5 + i * dx);
      out.push(
        x0, y0, z00, x1, y0, z10, x1, y1, z11,
        x0, y0, z00, x1, y1, z11, x0, y1, z01,
        x0, y0, baseZ, x1, y1, baseZ, x1, y0, baseZ,
        x0, y0, baseZ, x0, y1, baseZ, x1, y1, baseZ
      );
    }
  }
  return out;
}

function exportProjectFile() {
  const payload = {
    okfVersion: '1.3.0',
    version: '3.0.7',
    modelName: state.modelName,
    unit: state.unit,
    constructionMode: state.constructionMode,
    puzzleAxes: state.puzzleAxes,
    puzzleCountA: state.puzzleCountA,
    puzzleCountB: state.puzzleCountB,
    puzzleStartOffsetAMM: state.puzzleStartOffsetAMM,
    puzzleStartOffsetBMM: state.puzzleStartOffsetBMM,
    puzzleStartMode: state.puzzleStartMode,
    puzzleRibOffsetsAMM: state.puzzleRibOffsetsAMM,
    puzzleRibOffsetsBMM: state.puzzleRibOffsetsBMM,
    puzzleMaterialThicknessMM: state.puzzleMaterialThicknessMM,
    puzzleSlotClearanceMM: state.puzzleSlotClearanceMM,
    puzzleSimplifyCutLine: state.puzzleSimplifyCutLine,
    puzzleSimplifyMode: state.puzzleSimplifyMode,
    puzzleSimplifyToleranceMM: state.puzzleSimplifyToleranceMM,
    puzzleSimplifySmoothPasses: state.puzzleSimplifySmoothPasses,
    puzzleSelfSupporting: state.puzzleSelfSupporting,
    puzzleSelfSupportTarget: state.puzzleSelfSupportTarget,
    puzzleSelfSupportStyle: state.puzzleSelfSupportStyle,
    puzzleSelfSupportClearanceMM: state.puzzleSelfSupportClearanceMM,
    puzzleDropUnconnectedIslands: state.puzzleDropUnconnectedIslands,
    puzzleSelfSupportRibs: state.puzzleSelfSupportRibs,
    puzzleHideSeriesA: state.puzzleHideSeriesA,
    puzzleHideSeriesB: state.puzzleHideSeriesB,
    puzzleHiddenRibs: state.puzzleHiddenRibs,
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
    baseVertices: compactBaseVerticesForLasca(state.baseVertices)
  };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json;charset=utf-8' });
  triggerBrowserDownload(blob, state.modelName + '.lasca');
}

function applyOkfProjectConfig(data) {
  if (!data || typeof data !== 'object') return false;

  // Permitir recetas OKF ligeras basadas en presetModel ('torus' | 'vase' | 'gear' | 'crystal')
  // o recetas que incluyen la malla completa en baseVertices
  if (Array.isArray(data.baseVertices) && data.baseVertices.length >= 9 && data.dimsMM) {
    state.baseVertices = new Float32Array(data.baseVertices);
    state.dimsMM = {
      x: Number(data.dimsMM.x) || 100,
      y: Number(data.dimsMM.y) || 100,
      z: Number(data.dimsMM.z) || 100
    };
  } else if (typeof data.presetModel === 'string' && typeof loadPresetModel === 'function' && typeof THREE !== 'undefined') {
    loadPresetModel(data.presetModel);
    if (data.dimsMM && typeof data.dimsMM === 'object') {
      state.dimsMM = {
        x: Number(data.dimsMM.x) || state.dimsMM.x,
        y: Number(data.dimsMM.y) || state.dimsMM.y,
        z: Number(data.dimsMM.z) || state.dimsMM.z
      };
    }
  } else if (data.dimsMM && typeof data.dimsMM === 'object') {
    state.dimsMM = {
      x: Number(data.dimsMM.x) || (state.dimsMM && state.dimsMM.x) || 100,
      y: Number(data.dimsMM.y) || (state.dimsMM && state.dimsMM.y) || 100,
      z: Number(data.dimsMM.z) || (state.dimsMM && state.dimsMM.z) || 100
    };
  }

  if (typeof data.modelName === 'string' && data.modelName.trim()) {
    state.modelName = data.modelName.trim();
  }
  if (typeof data.maxDimensionMM === 'number' && data.maxDimensionMM > 0 && state.dimsMM) {
    const curMax = Math.max(state.dimsMM.x || 1, state.dimsMM.y || 1, state.dimsMM.z || 1);
    if (curMax > 0) {
      const factor = data.maxDimensionMM / curMax;
      state.dimsMM = {
        x: Math.round(state.dimsMM.x * factor * 100) / 100,
        y: Math.round(state.dimsMM.y * factor * 100) / 100,
        z: Math.round(state.dimsMM.z * factor * 100) / 100
      };
    }
  }

  if (data.constructionMode === 'puzzle3d' || data.constructionMode === 'stacked') {
    state.constructionMode = data.constructionMode;
  }
  if (data.puzzleAxes === 'xy' || data.puzzleAxes === 'xz' || data.puzzleAxes === 'yz') {
    state.puzzleAxes = data.puzzleAxes;
  }
  if (typeof data.puzzleCountA === 'number') state.puzzleCountA = data.puzzleCountA;
  if (typeof data.puzzleCountB === 'number') state.puzzleCountB = data.puzzleCountB;
  if (typeof data.puzzleStartOffsetAMM === 'number') state.puzzleStartOffsetAMM = data.puzzleStartOffsetAMM;
  if (typeof data.puzzleStartOffsetBMM === 'number') state.puzzleStartOffsetBMM = data.puzzleStartOffsetBMM;
  if (data.puzzleStartMode === 'start' || data.puzzleStartMode === 'symmetric' || data.puzzleStartMode === 'shift') {
    state.puzzleStartMode = data.puzzleStartMode;
  }
  if (data.puzzleRibOffsetsAMM && typeof data.puzzleRibOffsetsAMM === 'object') {
    state.puzzleRibOffsetsAMM = data.puzzleRibOffsetsAMM;
  }
  if (data.puzzleRibOffsetsBMM && typeof data.puzzleRibOffsetsBMM === 'object') {
    state.puzzleRibOffsetsBMM = data.puzzleRibOffsetsBMM;
  }
  if (typeof data.puzzleMaterialThicknessMM === 'number') state.puzzleMaterialThicknessMM = data.puzzleMaterialThicknessMM;
  if (typeof data.puzzleSlotClearanceMM === 'number') state.puzzleSlotClearanceMM = data.puzzleSlotClearanceMM;
  if (typeof data.puzzleSimplifyCutLine === 'boolean') state.puzzleSimplifyCutLine = data.puzzleSimplifyCutLine;
  if (data.puzzleSimplifyMode === 'rdp' || data.puzzleSimplifyMode === 'smooth' || data.puzzleSimplifyMode === 'bridge' || data.puzzleSimplifyMode === 'convex') {
    state.puzzleSimplifyMode = data.puzzleSimplifyMode;
  }
  if (typeof data.puzzleSimplifyToleranceMM === 'number') state.puzzleSimplifyToleranceMM = data.puzzleSimplifyToleranceMM;
  if (typeof data.puzzleSimplifySmoothPasses === 'number') state.puzzleSimplifySmoothPasses = data.puzzleSimplifySmoothPasses;
  if (typeof data.puzzleSelfSupporting === 'boolean') state.puzzleSelfSupporting = data.puzzleSelfSupporting;
  if (data.puzzleSelfSupportTarget === 'outer' || data.puzzleSelfSupportTarget === 'series_b' || data.puzzleSelfSupportTarget === 'series_a' || data.puzzleSelfSupportTarget === 'all' || data.puzzleSelfSupportTarget === 'custom') {
    state.puzzleSelfSupportTarget = data.puzzleSelfSupportTarget;
  }
  if (data.puzzleSelfSupportStyle === 'trim_union' || data.puzzleSelfSupportStyle === 'arch' || data.puzzleSelfSupportStyle === 'natural') {
    state.puzzleSelfSupportStyle = data.puzzleSelfSupportStyle;
  }
  if (typeof data.puzzleSelfSupportClearanceMM === 'number' && data.puzzleSelfSupportClearanceMM >= 0) {
    state.puzzleSelfSupportClearanceMM = data.puzzleSelfSupportClearanceMM;
  }
  if (typeof data.puzzleDropUnconnectedIslands === 'boolean') {
    state.puzzleDropUnconnectedIslands = data.puzzleDropUnconnectedIslands;
  }
  if (data.puzzleSelfSupportRibs && typeof data.puzzleSelfSupportRibs === 'object') {
    state.puzzleSelfSupportRibs = {
      A: Object.assign({}, data.puzzleSelfSupportRibs.A || {}),
      B: Object.assign({}, data.puzzleSelfSupportRibs.B || {}),
      C: Object.assign({}, data.puzzleSelfSupportRibs.C || {})
    };
  }
  if (typeof data.puzzleHideSeriesA === 'boolean') state.puzzleHideSeriesA = data.puzzleHideSeriesA;
  if (typeof data.puzzleHideSeriesB === 'boolean') state.puzzleHideSeriesB = data.puzzleHideSeriesB;
  if (data.puzzleHiddenRibs && typeof data.puzzleHiddenRibs === 'object') {
    state.puzzleHiddenRibs = data.puzzleHiddenRibs;
  }
  if (typeof data.puzzleEngraveEndRibs === 'boolean') {
    state.puzzleEngraveEndRibs = data.puzzleEngraveEndRibs;
    if (!data.puzzleEngraveEndRibs && typeof clearPuzzleEndRibsEngraving === 'function') {
      clearPuzzleEndRibsEngraving('both');
    }
  }
  if (data.puzzleEngraveEndRibsAxes === 'both' || data.puzzleEngraveEndRibsAxes === 'A' || data.puzzleEngraveEndRibsAxes === 'B') {
    state.puzzleEngraveEndRibsAxes = data.puzzleEngraveEndRibsAxes;
  }
  if (data.puzzleEngraveEndRibsPreset === 'drawing' || data.puzzleEngraveEndRibsPreset === 'crest' || data.puzzleEngraveEndRibsPreset === 'medallion' || data.puzzleEngraveEndRibsPreset === 'badge') {
    state.puzzleEngraveEndRibsPreset = data.puzzleEngraveEndRibsPreset;
  }
  if (typeof data.puzzleEngraveEndRibsScalePct === 'number') {
    state.puzzleEngraveEndRibsScalePct = Math.max(10, Math.min(250, data.puzzleEngraveEndRibsScalePct));
  }
  if (typeof data.puzzleEngraveEndRibsMirrorLast === 'boolean') {
    state.puzzleEngraveEndRibsMirrorLast = data.puzzleEngraveEndRibsMirrorLast;
  }
  if (data.sliceImageEngravings && typeof data.sliceImageEngravings === 'object') {
    if (!state.sliceImageEngravings) state.sliceImageEngravings = {};
    Object.keys(data.sliceImageEngravings).forEach((k) => {
      const entry = data.sliceImageEngravings[k];
      if (entry && typeof entry === 'object') {
        state.sliceImageEngravings[k] = Object.assign({
          enabled: true,
          imageName: entry.imageName || 'Ilustracion_Lasca',
          presetName: entry.presetName || 'drawing',
          sourceCanvas: null,
          aspectRatio: 1.0,
          scalePct: 75,
          offsetXMM: 0,
          offsetYMM: 0,
          rotationDeg: 0,
          flipX: false,
          flipY: false,
          detectMode: 'smart_drawing',
          engraveStyle: 'vector_fill',
          threshold: 145,
          invert: false,
          clipToSlice: true,
          marginMM: 0.5,
          customNormalizedLoops: null
        }, entry);
      }
    });
  }
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

  if (data.axis === 'x' || data.axis === 'y' || data.axis === 'z') state.axis = data.axis;
  if (data.mode === 'count' || data.mode === 'thickness') state.mode = data.mode;
  if (typeof data.sliceCount === 'number') state.sliceCount = data.sliceCount;
  if (typeof data.thickness === 'number') state.thickness = data.thickness;
  if (typeof data.rodCount === 'number') state.rodCount = data.rodCount;
  if (typeof data.rodDiameter === 'number') state.rodDiameter = data.rodDiameter;

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
  if (typeof syncHoldingTabsUI === 'function') syncHoldingTabsUI();

  if (typeof data.filterSmallIslands === 'boolean') state.filterSmallIslands = data.filterSmallIslands;
  if (typeof data.minIslandSizeMM === 'number') state.minIslandSizeMM = data.minIslandSizeMM;
  if (data.minIslandCriteria) state.minIslandCriteria = data.minIslandCriteria;
  if (typeof data.fillInternalHoles === 'boolean') state.fillInternalHoles = data.fillInternalHoles;
  if (data.fillHolesMode) state.fillHolesMode = data.fillHolesMode;
  if (typeof data.fillHolesMaxSizeMM === 'number') state.fillHolesMaxSizeMM = data.fillHolesMaxSizeMM;

  if (typeof data.includeLabels === 'boolean' && typeof setIncludeLabels === 'function') setIncludeLabels(data.includeLabels);
  if (typeof data.includeNextSliceGuide === 'boolean' && typeof setIncludeNextGuide === 'function') setIncludeNextGuide(data.includeNextSliceGuide);
  if (typeof data.includePrevSliceGuide === 'boolean' && typeof setIncludePrevGuide === 'function') setIncludePrevGuide(data.includePrevSliceGuide);
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
  if (typeof data.nestClipOversized === 'boolean' && typeof setNestClipOversized === 'function') {
    setNestClipOversized(data.nestClipOversized);
  }
  if (typeof data.nestEngraveSliceNum === 'boolean' && typeof setNestEngraveNum === 'function') setNestEngraveNum(data.nestEngraveSliceNum);
  if (typeof data.nestEngraveGuideType === 'boolean' && typeof setNestEngraveGuideType === 'function') setNestEngraveGuideType(data.nestEngraveGuideType);
  if (typeof data.carrierWidthMM === 'number') state.carrierWidthMM = data.carrierWidthMM;
  if (typeof data.carrierHeightMM === 'number') state.carrierHeightMM = data.carrierHeightMM;
  if (typeof data.carrierSpacingMM === 'number') state.carrierSpacingMM = data.carrierSpacingMM;
  if (typeof data.carrierMarginMM === 'number') state.carrierMarginMM = data.carrierMarginMM;
  if (typeof data.carrierAllowRotate === 'boolean') state.carrierAllowRotate = data.carrierAllowRotate;
  if (typeof data.carrierCutBoardBorders === 'boolean') state.carrierCutBoardBorders = data.carrierCutBoardBorders;
  if (typeof data.carrierCutOuterBorder === 'boolean') state.carrierCutOuterBorder = data.carrierCutOuterBorder;
  if (typeof data.carrierEngraveBoardLabels === 'boolean') state.carrierEngraveBoardLabels = data.carrierEngraveBoardLabels;
  if (typeof data.nestingEnabled === 'boolean' && typeof setNestingEnabled === 'function') setNestingEnabled(data.nestingEnabled);
  if (typeof data.carrierEnabled === 'boolean' && typeof setCarrierEnabled === 'function') {
    setCarrierEnabled(data.carrierEnabled);
  }
  if (typeof syncCarrierInputsUI === 'function') syncCarrierInputsUI();
  if (typeof syncCarrierUIState === 'function') syncCarrierUIState();

  const rodCountEl = document.getElementById('rodCountSelect');
  if (rodCountEl) rodCountEl.value = String(state.rodCount);
  const rodDiamEl = document.getElementById('rodDiameterInput');
  if (rodDiamEl) rodDiamEl.value = state.rodDiameter;
  if (typeof setDisplayUnit === 'function') setDisplayUnit(data.unit || state.unit || 'mm');
  if (typeof syncDimensionInputsUI === 'function' && state.dimsMM) syncDimensionInputsUI();
  if (state.baseVertices && state.baseVertices.length >= 9) {
    if (typeof setSliceAxis === 'function') setSliceAxis(state.axis);
    if (typeof setSliceMode === 'function') setSliceMode(state.mode);
    if (typeof rebuildGhostAndSlices === 'function') rebuildGhostAndSlices();
  } else if (state.slices && state.slices.length > 0 && typeof applyIslandFilterToExistingSlices === 'function') {
    applyIslandFilterToExistingSlices();
  }

  if (state.constructionMode === 'puzzle3d' && state.puzzleEngraveEndRibs && typeof applyEngravingToPuzzleEndRibs === 'function') {
    applyEngravingToPuzzleEndRibs({
      targetAxes: state.puzzleEngraveEndRibsAxes || 'both',
      presetName: state.puzzleEngraveEndRibsPreset || 'drawing',
      scalePct: state.puzzleEngraveEndRibsScalePct || 75,
      mirrorLastRib: state.puzzleEngraveEndRibsMirrorLast !== false
    });
  } else if (data.sliceImageEngravings && typeof reapplyAllSliceImageEngravings === 'function') {
    reapplyAllSliceImageEngravings();
  }

  if (Array.isArray(data.selectedIndices)) {
    const setSel = new Set(data.selectedIndices);
    state.slices.forEach((s) => { s.selected = setSel.has(s.index); });
    if (typeof renderSliceStripUI === 'function') renderSliceStripUI();
    if (typeof update3DSlicesTransforms === 'function' && state.baseVertices) update3DSlicesTransforms();
  }
  if (typeof resetCamera3D === 'function' && state.baseVertices) resetCamera3D();
  return true;
}

// Genera el objeto ligero de receta OKF (sin el voluminoso array baseVertices por defecto)
function getOkfRecipePayload(includeVertices = false) {
  const presetEl = typeof document !== 'undefined' ? document.getElementById('presetSelect') : null;
  const payload = {
    okfVersion: '1.3.0',
    version: '3.0.7',
    modelName: state.modelName,
    presetModel: presetEl && presetEl.value ? presetEl.value : 'torus',
    unit: state.unit,
    dimsMM: state.dimsMM ? { x: state.dimsMM.x, y: state.dimsMM.y, z: state.dimsMM.z } : { x: 120, y: 120, z: 120 },
    constructionMode: state.constructionMode,
    axis: state.axis,
    mode: state.mode,
    sliceCount: state.sliceCount,
    thickness: state.thickness,
    puzzleAxes: state.puzzleAxes,
    puzzleCountA: state.puzzleCountA,
    puzzleCountB: state.puzzleCountB,
    puzzleStartOffsetAMM: state.puzzleStartOffsetAMM,
    puzzleStartOffsetBMM: state.puzzleStartOffsetBMM,
    puzzleStartMode: state.puzzleStartMode,
    puzzleRibOffsetsAMM: state.puzzleRibOffsetsAMM,
    puzzleRibOffsetsBMM: state.puzzleRibOffsetsBMM,
    puzzleMaterialThicknessMM: state.puzzleMaterialThicknessMM,
    puzzleSlotClearanceMM: state.puzzleSlotClearanceMM,
    puzzleSimplifyCutLine: state.puzzleSimplifyCutLine,
    puzzleSimplifyMode: state.puzzleSimplifyMode,
    puzzleSimplifyToleranceMM: state.puzzleSimplifyToleranceMM,
    puzzleSimplifySmoothPasses: state.puzzleSimplifySmoothPasses,
    puzzleSelfSupporting: state.puzzleSelfSupporting,
    puzzleSelfSupportTarget: state.puzzleSelfSupportTarget,
    puzzleSelfSupportStyle: state.puzzleSelfSupportStyle,
    puzzleSelfSupportClearanceMM: state.puzzleSelfSupportClearanceMM,
    puzzleDropUnconnectedIslands: state.puzzleDropUnconnectedIslands,
    puzzleSelfSupportRibs: state.puzzleSelfSupportRibs,
    puzzleEngraveEndRibs: Boolean(state.puzzleEngraveEndRibs),
    puzzleEngraveEndRibsAxes: state.puzzleEngraveEndRibsAxes || 'both',
    puzzleEngraveEndRibsPreset: state.puzzleEngraveEndRibsPreset || 'drawing',
    puzzleEngraveEndRibsScalePct: state.puzzleEngraveEndRibsScalePct || 75,
    puzzleEngraveEndRibsMirrorLast: state.puzzleEngraveEndRibsMirrorLast !== false,
    filterSmallIslands: state.filterSmallIslands,
    minIslandSizeMM: state.minIslandSizeMM,
    minIslandCriteria: state.minIslandCriteria,
    fillInternalHoles: state.fillInternalHoles,
    fillHolesMode: state.fillHolesMode,
    fillHolesMaxSizeMM: state.fillHolesMaxSizeMM,
    splitModelEnabled: state.splitModelEnabled,
    splitMode: state.splitMode,
    splitMaxPartWidthMM: state.splitMaxPartWidthMM,
    splitMaxPartHeightMM: state.splitMaxPartHeightMM,
    splitJointType: state.splitJointType,
    splitJointDepthMM: state.splitJointDepthMM,
    includeLabels: state.includeLabels,
    includeNextSliceGuide: state.includeNextSliceGuide,
    includePrevSliceGuide: state.includePrevSliceGuide,
    rodCount: state.rodCount,
    rodDiameter: state.rodDiameter,
    slicerFrameEnabled: state.slicerFrameEnabled,
    tabsEnabled: state.tabsEnabled,
    nestingEnabled: state.nestingEnabled,
    boardWidthMM: state.boardWidthMM,
    boardHeightMM: state.boardHeightMM,
    nestSpacingMM: state.nestSpacingMM,
    nestMarginMM: state.nestMarginMM,
    nestAllowRotate: state.nestAllowRotate,
    nestUseInnerHoles: state.nestUseInnerHoles,
    carrierEnabled: state.carrierEnabled,
    carrierWidthMM: state.carrierWidthMM,
    carrierHeightMM: state.carrierHeightMM
  };
  if (includeVertices && state.baseVertices) {
    payload.baseVertices = Array.from(state.baseVertices);
  }
  return payload;
}

// Parsea parámetros OKF desde la URL de GitHub Pages (?okf=... o query params individuales)
function parseOkfUrlQuery(searchStr) {
  const raw = typeof searchStr === 'string'
    ? searchStr
    : (typeof window !== 'undefined' && window.location ? window.location.search : '');
  if (!raw || raw.length < 2) return null;

  const q = raw.startsWith('?') ? raw.slice(1) : raw;
  const pairs = q.split('&');
  const params = {};
  for (let i = 0; i < pairs.length; i++) {
    const eqIdx = pairs[i].indexOf('=');
    if (eqIdx <= 0) continue;
    const k = decodeURIComponent(pairs[i].slice(0, eqIdx).trim());
    const v = decodeURIComponent(pairs[i].slice(eqIdx + 1).replace(/\+/g, ' ').trim());
    params[k] = v;
  }

  let result = {};
  if (params.okf) {
    try {
      result = JSON.parse(params.okf);
    } catch (e1) {
      try {
        if (typeof atob === 'function') {
          result = JSON.parse(atob(params.okf));
        }
      } catch (e2) {
        // Ignorar si no es JSON válido
      }
    }
  }

  const boolKeys = [
    'puzzleSimplifyCutLine', 'puzzleHideSeriesA', 'puzzleHideSeriesB',
    'puzzleEngraveEndRibs', 'puzzleEngraveEndRibsMirrorLast',
    'filterSmallIslands', 'fillInternalHoles', 'splitModelEnabled', 'splitStaggerLayers',
    'includeLabels', 'includeNextSliceGuide', 'includePrevSliceGuide',
    'slicerFrameEnabled', 'tabsEnabled', 'nestingEnabled', 'nestAllowRotate',
    'nestUseInnerHoles', 'nestClipOversized', 'carrierEnabled'
  ];
  const numKeys = [
    'maxDimensionMM', 'sliceCount', 'thickness', 'puzzleCountA', 'puzzleCountB',
    'puzzleStartOffsetAMM', 'puzzleStartOffsetBMM', 'puzzleMaterialThicknessMM',
    'puzzleSlotClearanceMM', 'puzzleSimplifyToleranceMM', 'puzzleSimplifySmoothPasses',
    'puzzleEngraveEndRibsScalePct',
    'minIslandSizeMM', 'fillHolesMaxSizeMM', 'splitMaxPartWidthMM', 'splitMaxPartHeightMM',
    'splitCols', 'splitRows', 'splitJointDepthMM', 'rodCount', 'rodDiameter',
    'boardWidthMM', 'boardHeightMM', 'nestSpacingMM', 'nestMarginMM',
    'carrierWidthMM', 'carrierHeightMM'
  ];
  const strKeys = [
    'presetModel', 'modelName', 'unit', 'constructionMode', 'axis', 'mode',
    'puzzleAxes', 'puzzleStartMode', 'puzzleSimplifyMode',
    'puzzleEngraveEndRibsAxes', 'puzzleEngraveEndRibsPreset',
    'minIslandCriteria', 'fillHolesMode', 'splitMode', 'splitJointType'
  ];

  boolKeys.forEach((k) => {
    if (params[k] !== undefined) {
      const low = String(params[k]).toLowerCase();
      result[k] = (low === 'true' || low === '1' || low === 'yes' || low === 'si');
    }
  });
  numKeys.forEach((k) => {
    if (params[k] !== undefined) {
      const n = Number(params[k]);
      if (Number.isFinite(n)) result[k] = n;
    }
  });
  strKeys.forEach((k) => {
    if (params[k] !== undefined && params[k] !== '') {
      result[k] = params[k];
    }
  });

  return Object.keys(result).length > 0 ? result : null;
}

function parseAndApplyOkfFromUrl(searchStr) {
  const cfg = parseOkfUrlQuery(searchStr);
  if (!cfg) return false;
  return applyOkfProjectConfig(cfg);
}

// Construye un enlace directo de GitHub Pages con la receta OKF actual en los parámetros de la URL
function buildOkfShareUrl(baseUrl) {
  const base = baseUrl || (typeof window !== 'undefined' && window.location && window.location.origin !== 'null'
    ? (window.location.origin + window.location.pathname)
    : 'https://nmarafo.github.io/layerstudio3D/');
  const presetEl = typeof document !== 'undefined' ? document.getElementById('presetSelect') : null;
  const preset = presetEl && presetEl.value ? presetEl.value : 'torus';
  const maxDim = state.dimsMM ? Math.round(Math.max(state.dimsMM.x, state.dimsMM.y, state.dimsMM.z) * 10) / 10 : 120;

  const q = [
    'presetModel=' + encodeURIComponent(preset),
    'modelName=' + encodeURIComponent(state.modelName || 'pieza_3d'),
    'maxDimensionMM=' + encodeURIComponent(maxDim),
    'constructionMode=' + encodeURIComponent(state.constructionMode)
  ];

  if (state.constructionMode === 'puzzle3d') {
    q.push('puzzleAxes=' + encodeURIComponent(state.puzzleAxes));
    q.push('puzzleCountA=' + encodeURIComponent(state.puzzleCountA));
    q.push('puzzleCountB=' + encodeURIComponent(state.puzzleCountB));
    q.push('puzzleMaterialThicknessMM=' + encodeURIComponent(state.puzzleMaterialThicknessMM));
    q.push('puzzleSlotClearanceMM=' + encodeURIComponent(state.puzzleSlotClearanceMM));
    if (state.puzzleSimplifyCutLine) {
      q.push('puzzleSimplifyCutLine=true');
      q.push('puzzleSimplifyMode=' + encodeURIComponent(state.puzzleSimplifyMode));
      q.push('puzzleSimplifyToleranceMM=' + encodeURIComponent(state.puzzleSimplifyToleranceMM));
      q.push('puzzleSimplifySmoothPasses=' + encodeURIComponent(state.puzzleSimplifySmoothPasses));
    }
    if (state.puzzleEngraveEndRibs) {
      q.push('puzzleEngraveEndRibs=true');
      q.push('puzzleEngraveEndRibsAxes=' + encodeURIComponent(state.puzzleEngraveEndRibsAxes || 'both'));
      q.push('puzzleEngraveEndRibsPreset=' + encodeURIComponent(state.puzzleEngraveEndRibsPreset || 'drawing'));
      q.push('puzzleEngraveEndRibsScalePct=' + encodeURIComponent(state.puzzleEngraveEndRibsScalePct || 75));
    }
  } else {
    q.push('axis=' + encodeURIComponent(state.axis));
    q.push('mode=' + encodeURIComponent(state.mode));
    q.push('sliceCount=' + encodeURIComponent(state.sliceCount));
    q.push('thickness=' + encodeURIComponent(state.thickness));
    if (state.rodCount > 0) {
      q.push('rodCount=' + encodeURIComponent(state.rodCount));
      q.push('rodDiameter=' + encodeURIComponent(state.rodDiameter));
    }
  }

  if (state.nestingEnabled) {
    q.push('nestingEnabled=true');
    q.push('boardWidthMM=' + encodeURIComponent(state.boardWidthMM));
    q.push('boardHeightMM=' + encodeURIComponent(state.boardHeightMM));
  }
  return base + '?' + q.join('&');
}

// =========================================================================
// MODAL INTERACTIVO IA / OKF PARA GITHUB PAGES (#okfAgentModal)
// =========================================================================
function setOkfStatusFeedback(msg, isError = false) {
  const el = typeof document !== 'undefined' ? document.getElementById('okfModalStatusBanner') : null;
  if (!el) return;
  el.textContent = msg;
  el.className = isError
    ? 'text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300'
    : 'text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300';
}

function loadCurrentConfigIntoOkfTextarea() {
  const ta = typeof document !== 'undefined' ? document.getElementById('okfRecipeTextarea') : null;
  const urlInput = typeof document !== 'undefined' ? document.getElementById('okfShareUrlInput') : null;
  if (ta) {
    ta.value = JSON.stringify(getOkfRecipePayload(false), null, 2);
  }
  if (urlInput) {
    urlInput.value = buildOkfShareUrl();
  }
  setOkfStatusFeedback('Configuración actual de LayerStudio 3D cargada en el editor JSON y enlace mágico generado.');
}

function openOkfAgentModal() {
  loadCurrentConfigIntoOkfTextarea();
  const modal = typeof document !== 'undefined' ? document.getElementById('okfAgentModal') : null;
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeOkfAgentModal() {
  const modal = typeof document !== 'undefined' ? document.getElementById('okfAgentModal') : null;
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function applyOkfRecipeFromTextarea() {
  const ta = typeof document !== 'undefined' ? document.getElementById('okfRecipeTextarea') : null;
  if (!ta || !ta.value.trim()) {
    setOkfStatusFeedback('Peguen primero un bloque JSON de receta OKF en el cuadro de texto.', true);
    return false;
  }
  let raw = ta.value.trim();
  // Extraer bloque JSON si viene dentro de bloques markdown ```json ... ```
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    raw = fenceMatch[1].trim();
  }
  try {
    const parsed = JSON.parse(raw);
    const ok = applyOkfProjectConfig(parsed);
    if (ok) {
      const urlInput = document.getElementById('okfShareUrlInput');
      if (urlInput) urlInput.value = buildOkfShareUrl();
      setOkfStatusFeedback('✅ Receta OKF aplicada correctamente al modelo y láminas recalculadas.');
      return true;
    }
    setOkfStatusFeedback('No se pudo aplicar la receta OKF.', true);
    return false;
  } catch (err) {
    setOkfStatusFeedback('Error de formato JSON: ' + err.message, true);
    return false;
  }
}

function applyQuickOkfSampleRecipe(sampleId) {
  let sample = null;
  if (sampleId === 'vase_puzzle_smooth') {
    sample = {
      presetModel: 'vase',
      modelName: 'jarron_puzzle_suavizado',
      maxDimensionMM: 220,
      constructionMode: 'puzzle3d',
      puzzleAxes: 'xz',
      puzzleCountA: 8,
      puzzleCountB: 8,
      puzzleMaterialThicknessMM: 4.0,
      puzzleSlotClearanceMM: 0.15,
      puzzleSimplifyCutLine: true,
      puzzleSimplifyMode: 'smooth',
      puzzleSimplifyToleranceMM: 1.5,
      puzzleSimplifySmoothPasses: 2,
      puzzleEngraveEndRibs: true,
      puzzleEngraveEndRibsAxes: 'both',
      puzzleEngraveEndRibsPreset: 'drawing',
      puzzleEngraveEndRibsScalePct: 75,
      puzzleEngraveEndRibsMirrorLast: true,
      filterSmallIslands: true,
      fillInternalHoles: true,
      nestingEnabled: true,
      boardWidthMM: 600,
      boardHeightMM: 400
    };
  } else if (sampleId === 'torus_stacked_rods') {
    sample = {
      presetModel: 'torus',
      modelName: 'nudo_toroidal_apilado',
      maxDimensionMM: 180,
      constructionMode: 'stacked',
      axis: 'z',
      mode: 'count',
      sliceCount: 22,
      thickness: 4.0,
      rodCount: 2,
      rodDiameter: 4.0,
      includeLabels: true,
      includeNextSliceGuide: true,
      nestingEnabled: true,
      boardWidthMM: 600,
      boardHeightMM: 400
    };
  } else if (sampleId === 'gear_industrial_frame') {
    sample = {
      presetModel: 'gear',
      modelName: 'engranaje_con_marco_2d',
      maxDimensionMM: 160,
      constructionMode: 'stacked',
      axis: 'z',
      mode: 'count',
      sliceCount: 8,
      thickness: 5.0,
      slicerFrameEnabled: true,
      slicerFrameShape: 'rounded_rect',
      slicerFrameLaserMode: 'cut_and_engrave',
      nestingEnabled: false
    };
  }
  if (!sample) return false;
  applyOkfProjectConfig(sample);
  loadCurrentConfigIntoOkfTextarea();
  setOkfStatusFeedback('✅ Receta de ejemplo "' + sample.modelName + '" aplicada.');
  return true;
}

function copyOkfMasterPromptToClipboard() {
  const promptText = [
    'Actúas como el Agente Operador Oficial de LayerStudio 3D (https://nmarafo.github.io/layerstudio3D/) bajo el estándar OKF v1.3.0.',
    'Especificación completa: https://nmarafo.github.io/layerstudio3D/okf.json y https://nmarafo.github.io/layerstudio3D/okf/arquitectura_okf.md',
    'Regla clave en Puzzle 3D (constructionMode: "puzzle3d"): Lo habitual es grabar las costillas primera y última de los ejes (las fachadas exteriores X1/XN, Y1/YN o Z1/ZN), utilizando la función existente de grabar imagen en lasca (activando puzzleEngraveEndRibs: true con puzzleEngraveEndRibsAxes: "both"|"A"|"B", puzzleEngraveEndRibsPreset: "drawing"|"crest"|"medallion"|"badge", o invocando applyEngravingToPuzzleEndRibs() / applyDemoImageEngravingToSelectedSlice()), la cual recorta automáticamente el grabado al contorno y a las ranuras a 90°.',
    'Cuando te pida configurar un proyecto de corte láser (.SVG/.DXF) o impresión 3D (.STL), entrégame:',
    '1) Un bloque JSON compatible con window.applyOkfProjectConfig(data) (con propiedades como presetModel: "torus"|"vase"|"gear"|"crystal", maxDimensionMM, constructionMode: "stacked"|"puzzle3d", puzzleAxes: "xy"|"xz"|"yz", puzzleCountA, puzzleCountB, puzzleMaterialThicknessMM, puzzleSlotClearanceMM, puzzleSimplifyCutLine, puzzleSimplifyMode: "rdp"|"smooth"|"bridge"|"convex", puzzleSimplifyToleranceMM, puzzleEngraveEndRibs: true, puzzleEngraveEndRibsAxes: "both"|"A"|"B", puzzleEngraveEndRibsPreset: "drawing"|"crest"|"medallion"|"badge", filterSmallIslands, fillInternalHoles, nestingEnabled, boardWidthMM, boardHeightMM).',
    '2) Un enlace directo clicable a https://nmarafo.github.io/layerstudio3D/?... con esos mismos parámetros en la query string para abrirlo configurado automáticamente.'
  ].join('\n');

  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(promptText).then(() => {
      setOkfStatusFeedback('📋 Prompt Maestro OKF copiado al portapapeles. Péguenlo en ChatGPT, Gemini, Claude o NotebookLM.');
    }).catch(() => {
      setOkfStatusFeedback('Prompt generado en el cuadro de texto.', false);
    });
  } else {
    const ta = typeof document !== 'undefined' ? document.getElementById('okfRecipeTextarea') : null;
    if (ta) ta.value = promptText;
    setOkfStatusFeedback('📋 Prompt Maestro OKF mostrado en el cuadro de texto para copiar.');
  }
}

function copyCurrentOkfShareUrl() {
  const url = buildOkfShareUrl();
  const urlInput = typeof document !== 'undefined' ? document.getElementById('okfShareUrlInput') : null;
  if (urlInput) urlInput.value = url;
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      setOkfStatusFeedback('🔗 Enlace mágico de GitHub Pages copiado al portapapeles.');
    }).catch(() => {
      setOkfStatusFeedback('Enlace generado en la caja superior.', false);
    });
  } else {
    setOkfStatusFeedback('🔗 Enlace mágico generado en la caja superior.');
  }
}

if (typeof window !== 'undefined') {
  window.applyOkfProjectConfig = applyOkfProjectConfig;
  window.getOkfRecipePayload = getOkfRecipePayload;
  window.parseOkfUrlQuery = parseOkfUrlQuery;
  window.parseAndApplyOkfFromUrl = parseAndApplyOkfFromUrl;
  window.buildOkfShareUrl = buildOkfShareUrl;
  window.openOkfAgentModal = openOkfAgentModal;
  window.closeOkfAgentModal = closeOkfAgentModal;
  window.loadCurrentConfigIntoOkfTextarea = loadCurrentConfigIntoOkfTextarea;
  window.applyOkfRecipeFromTextarea = applyOkfRecipeFromTextarea;
  window.applyQuickOkfSampleRecipe = applyQuickOkfSampleRecipe;
  window.copyOkfMasterPromptToClipboard = copyOkfMasterPromptToClipboard;
  window.copyCurrentOkfShareUrl = copyCurrentOkfShareUrl;
}

function importProjectFile(file) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      applyOkfProjectConfig(data);
    } catch (err) {
      console.error('Error al importar proyecto:', err);
    }
  };
  reader.readAsText(file);
}
