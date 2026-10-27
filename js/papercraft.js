/**
 * LayerStudio 3D - School Papercraft & Layered Cutouts Generator (Scissors + Glue Tabs)
 * Generador de recortables escolares a partir del modelo 3D o de una o varias imágenes
 * para recortar con tijeras (✂️) y pegar con pegamento escolar (🧴):
 *   1. Plataformas 3D apilables con faldón plegable o banda dentada y pestañas de pegado.
 *   2. Recortables en capas superpuestas (uno sobre otro) con pestañas en escalón 3D o planas.
 *   3. Capas superpuestas con separadores / muelles plegables en Z (Pop-Up 3D).
 *   4. Figuras troqueladas verticales con peana escénica 3D y pestañas a 90° (simple o doble cara).
 *   5. Redes poliédricas desplegables (bloques / prismas cerrados en cruz de 1 sola pieza).
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

const papercraftState = {
  isOpen: false,
  sourceMode: 'model3d',            // 'model3d' | 'single_image' | 'multi_images'
  cutoutType: 'stacked_platforms',  // 'stacked_platforms' | 'layered_tabs' | 'accordion_spacers' | 'standee_peana' | 'prism_net'
  platformUnfoldMode: 'attached_flaps', // 'attached_flaps' (Faldones directos en lados) | 'collar_strip' (Tapa + tira lateral dentada)
  standeeFoldMode: 'double_fold',   // 'double_fold' (Doble cara plegable en T invertida) | 'single_tab' (1 cara con pestaña a 90°)
  sliceAxis: 'z',                   // 'z' | 'y' | 'x' (cuando sourceMode === 'model3d')
  layersCount: 5,                   // Número de capas / plataformas (2..12)
  widthMM: 130,                     // Ancho base del recortable en mm
  heightMM: 130,                    // Alto / Fondo base del recortable en mm
  wallHeightMM: 14,                 // Altura de cada plataforma / escalón 3D / separador en mm (0..40)
  tabDepthMM: 10,                   // Anchura / profundidad de las pestañas de pegamento escolar en mm (5..25)
  tabBevelDeg: 42,                  // Ángulo de bisel de las pestañas trapezoidales (25..65)
  tabsPerLayer: 4,                  // Número de pestañas en modo capas superpuestas (2..8)
  scissorsSimplifyMM: 3.5,          // Simplificación del contorno para corte fácil con tijeras escolares (0.5..12)
  cutMarginMM: 2.5,                 // Margen alrededor de las imágenes en mm (0..10)
  showGlueLabels: true,             // Mostrar 'PEGAR' y códigos de emparejamiento (P1, P2...) en pestañas y zonas guía
  showScissorsIcons: true,          // Mostrar símbolos de tijeras ✂ en el contorno exterior
  showFoldArrows: true,             // Mostrar líneas de pliegue montaña (---) y valle (-·-)
  printStyle: 'color',              // 'color' (A todo color) | 'coloring' (Blanco y negro para colorear) | 'blueprint' (Técnico limpio)
  sheetFormat: 'A4_portrait',       // 'A4_portrait' (210x297) | 'A4_landscape' (297x210) | 'A3_landscape' (420x297)
  includeSchoolHeader: true,        // Incluir cajetín escolar superior con Nombre, Curso y Leyenda de Tijeras/Pegamento
  previewMode: 'sheets2d',          // 'sheets2d' (Hojas DIN A4 imprimibles) | 'assembled3d' (Vista 3D montada interactiva)
  activeSheetIndex: 0,
  foldProgressPct: 85,              // 0% (plano) .. 100% (doblado a 90° en vista 3D)
  explodeLayersPct: 25,             // 0% (unido) .. 100% (capas separadas en vista 3D)
  // Imagen única cargada o preset escolar
  singleImagePreset: 'owl',         // 'owl' | 'volcano' | 'castle' | 'rocket' | 'butterfly' | 'crest'
  singleImageName: 'Buho_Escolar',
  singleImageCanvas: null,
  // Lista de varias imágenes (modo multi_images): [{ id, name, canvas, dataUrl }]
  multiImagesPack: 'volcano_pack',  // 'volcano_pack' | 'space_pack' | 'forest_pack' | 'custom'
  multiImagesList: [],
  // Resultado geométrico generado: piezas individuales y hojas DIN A4 maquetadas
  generatedPieces: [],
  packedSheets: [],
  // Viewport interactivo 2D y 3D del modal
  view2D: {
    zoom: 1,
    panX: 0,
    panY: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0
  },
  view3D: {
    yaw: -0.62,
    pitch: 0.52,
    zoom: 1.0,
    isDragging: false,
    startX: 0,
    startY: 0,
    startYaw: -0.62,
    startPitch: 0.52
  }
};

// Paleta de colores pedagógica para diferenciar capas/plataformas del recortable
const PAPERCRAFT_LAYER_COLORS = [
  { fill: '#38bdf8', light: '#e0f2fe', stroke: '#0284c7', name: 'Azul Cielo' },
  { fill: '#34d399', light: '#d1fae5', stroke: '#059669', name: 'Verde Esmeralda' },
  { fill: '#fbbf24', light: '#fef3c7', stroke: '#d97706', name: 'Ámbar Solar' },
  { fill: '#fb7185', light: '#ffe4e6', stroke: '#e11d48', name: 'Coral Rosado' },
  { fill: '#a78bfa', light: '#ede9fe', stroke: '#7c3aed', name: 'Violeta Suave' },
  { fill: '#f97316', light: '#ffedd5', stroke: '#ea580c', name: 'Naranja Cálido' },
  { fill: '#2dd4bf', light: '#ccfbf1', stroke: '#0d9488', name: 'Turquesa' },
  { fill: '#e879f9', light: '#fae8ff', stroke: '#c026d3', name: 'Magenta' }
];

// ============================================================================
// GENERADORES PROCEDURALES DE ILUSTRACIONES ESCOLARES (1 IMAGEN Y MULTI-IMAGEN)
// ============================================================================
function createProceduralPapercraftCanvas(presetId, layerFilterIdx = -1, totalLayers = 4) {
  const w = 360;
  const h = 360;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const cx = w * 0.5;
  const cy = h * 0.5;

  if (presetId === 'volcano' || presetId === 'volcano_pack') {
    // Capas: 0 = Mar y Base Insular, 1 = Costa y Valle Verde, 2 = Cono Volcánico, 3 = Cráter y Colada de Lava
    const drawLayer0 = layerFilterIdx === -1 || layerFilterIdx === 0;
    const drawLayer1 = layerFilterIdx === -1 || layerFilterIdx === 1;
    const drawLayer2 = layerFilterIdx === -1 || layerFilterIdx === 2;
    const drawLayer3 = layerFilterIdx === -1 || layerFilterIdx === 3;

    if (drawLayer0) {
      ctx.fillStyle = '#0ea5e9';
      ctx.strokeStyle = '#0369a1';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 15, 152, 130, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Olas decorativas
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 3;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(cx + i * 42, cy + 95, 16, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
    }
    if (drawLayer1) {
      ctx.fillStyle = '#22c55e';
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - 128, cy + 55);
      ctx.bezierCurveTo(cx - 135, cy - 45, cx - 65, cy - 95, cx, cy - 90);
      ctx.bezierCurveTo(cx + 75, cy - 95, cx + 135, cy - 35, cx + 125, cy + 55);
      ctx.bezierCurveTo(cx + 80, cy + 115, cx - 80, cy + 115, cx - 128, cy + 55);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    if (drawLayer2) {
      ctx.fillStyle = '#b45309';
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - 95, cy + 45);
      ctx.lineTo(cx - 42, cy - 75);
      ctx.lineTo(cx + 42, cy - 75);
      ctx.lineTo(cx + 95, cy + 45);
      ctx.quadraticCurveTo(cx, cy + 82, cx - 95, cy + 45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    if (drawLayer3) {
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 72, 40, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Lenguas de lava y penacho
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(cx - 22, cy - 62);
      ctx.quadraticCurveTo(cx - 30, cy - 5, cx - 12, cy + 25);
      ctx.quadraticCurveTo(cx, cy + 32, cx + 14, cy + 18);
      ctx.quadraticCurveTo(cx + 28, cy - 15, cx + 20, cy - 62);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx, cy - 72, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    return c;
  }

  if (presetId === 'castle') {
    const draw0 = layerFilterIdx === -1 || layerFilterIdx === 0;
    const draw1 = layerFilterIdx === -1 || layerFilterIdx === 1;
    const draw2 = layerFilterIdx === -1 || layerFilterIdx === 2;
    const draw3 = layerFilterIdx === -1 || layerFilterIdx === 3;

    if (draw0) {
      // Colina base y foso
      ctx.fillStyle = '#4ade80';
      ctx.strokeStyle = '#166534';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(36, 44, 288, 276, 42) : ctx.rect(36, 44, 288, 276);
      ctx.fill();
      ctx.stroke();
    }
    if (draw1) {
      // Muralla exterior con almenas
      ctx.fillStyle = '#94a3b8';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.rect(64, 110, 232, 185);
      ctx.fill();
      ctx.stroke();
      // Torres laterales
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(54, 78, 52, 217);
      ctx.strokeRect(54, 78, 52, 217);
      ctx.fillRect(254, 78, 52, 217);
      ctx.strokeRect(254, 78, 52, 217);
    }
    if (draw2) {
      // Torre del homenaje central y tejados cónicos
      ctx.fillStyle = '#e2e8f0';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 5;
      ctx.fillRect(122, 68, 116, 215);
      ctx.strokeRect(122, 68, 116, 215);
      ctx.fillStyle = '#e11d48';
      ctx.beginPath();
      ctx.moveTo(114, 68);
      ctx.lineTo(180, 22);
      ctx.lineTo(246, 68);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    if (draw3) {
      // Gran portón arqueado, escudo y banderolas
      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(180, 230, 38, Math.PI, 0, false);
      ctx.lineTo(218, 285);
      ctx.lineTo(142, 285);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(180, 132, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    return c;
  }

  if (presetId === 'rocket' || presetId === 'space_pack') {
    const draw0 = layerFilterIdx === -1 || layerFilterIdx === 0;
    const draw1 = layerFilterIdx === -1 || layerFilterIdx === 1;
    const draw2 = layerFilterIdx === -1 || layerFilterIdx === 2;
    const draw3 = layerFilterIdx === -1 || layerFilterIdx === 3;

    if (draw0) {
      // Fondo cosmos / nube estelar
      ctx.fillStyle = '#1e1b4b';
      ctx.strokeStyle = '#4338ca';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, 150, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      [[-85, -75], [92, -65], [-98, 55], [88, 72], [0, -118]].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dy, 8, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    if (draw1) {
      // Planeta anillado y luna
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#0369a1';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx - 55, cy - 35, 48, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.ellipse(cx - 55, cy - 35, 76, 20, -0.35, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (draw2) {
      // Cuerpo del cohete y aletas rojas
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - 72, cy + 108);
      ctx.lineTo(cx, cy + 15);
      ctx.lineTo(cx + 72, cy + 108);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 122);
      ctx.quadraticCurveTo(cx + 58, cy - 35, cx + 44, cy + 88);
      ctx.lineTo(cx - 44, cy + 88);
      ctx.quadraticCurveTo(cx - 58, cy - 35, cx, cy - 122);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    if (draw3) {
      // Escotilla azul y llama propulsora
      ctx.fillStyle = '#0ea5e9';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy - 18, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f97316';
      ctx.strokeStyle = '#c2410c';
      ctx.beginPath();
      ctx.moveTo(cx - 28, cy + 88);
      ctx.quadraticCurveTo(cx, cy + 155, cx, cy + 148);
      ctx.quadraticCurveTo(cx, cy + 155, cx + 28, cy + 88);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    return c;
  }

  if (presetId === 'forest_pack') {
    const draw0 = layerFilterIdx === -1 || layerFilterIdx === 0;
    const draw1 = layerFilterIdx === -1 || layerFilterIdx === 1;
    const draw2 = layerFilterIdx === -1 || layerFilterIdx === 2;
    const draw3 = layerFilterIdx === -1 || layerFilterIdx === 3;

    if (draw0) {
      // Cielo soleado y montañas lejanas
      ctx.fillStyle = '#bae6fd';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, 152, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(cx + 62, cy - 68, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    if (draw1) {
      // Cordillera montañosa
      ctx.fillStyle = '#64748b';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - 135, cy + 85);
      ctx.lineTo(cx - 55, cy - 65);
      ctx.lineTo(cx + 15, cy + 15);
      ctx.lineTo(cx + 72, cy - 48);
      ctx.lineTo(cx + 135, cy + 85);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    if (draw2) {
      // Pinos y bosque intermedio
      ctx.fillStyle = '#16a34a';
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 5;
      [-75, 0, 75].forEach((ox) => {
        ctx.beginPath();
        ctx.moveTo(cx + ox, cy - 35);
        ctx.lineTo(cx + ox - 45, cy + 95);
        ctx.lineTo(cx + ox + 45, cy + 95);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
    }
    if (draw3) {
      // Prado frontal y fauna/flores
      ctx.fillStyle = '#4ade80';
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 92, 128, 42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f43f5e';
      [-55, 0, 55].forEach((ox) => {
        ctx.beginPath();
        ctx.arc(cx + ox, cy + 88, 12, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    return c;
  }

  if (presetId === 'butterfly') {
    // Mariposa simétrica escolar
    ctx.save();
    ctx.translate(cx, cy);
    // Alas superiores
    ctx.fillStyle = '#f43f5e';
    ctx.strokeStyle = '#881337';
    ctx.lineWidth = 6;
    [-1, 1].forEach((dir) => {
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.bezierCurveTo(dir * 95, -135, dir * 165, -45, dir * 115, 25);
      ctx.bezierCurveTo(dir * 145, 85, dir * 75, 138, 0, 55);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(dir * 75, -35, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(dir * 62, 55, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f43f5e';
    });
    // Cuerpo central
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(0, 12, 14, 78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return c;
  }

  if (presetId === 'crest') {
    ctx.fillStyle = '#2563eb';
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx - 115, 48);
    ctx.lineTo(cx + 115, 48);
    ctx.lineTo(cx + 115, 175);
    ctx.quadraticCurveTo(cx + 115, 275, cx, 322);
    ctx.quadraticCurveTo(cx - 115, 275, cx - 115, 175);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(cx, 82);
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 68 : 30;
      ctx.lineTo(cx + Math.cos(ang) * r, 175 + Math.sin(ang) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return c;
  }

  // Por defecto: 'owl' (Búho Sabio Multicapa Escolar)
  // Cuerpo redondeado con orejas
  ctx.fillStyle = '#d97706';
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx - 88, cy - 115);
  ctx.lineTo(cx - 42, cy - 88);
  ctx.quadraticCurveTo(cx, cy - 98, cx + 42, cy - 88);
  ctx.lineTo(cx + 88, cy - 115);
  ctx.quadraticCurveTo(cx + 128, cy - 20, cx + 108, cy + 95);
  ctx.quadraticCurveTo(cx, cy + 145, cx - 108, cy + 95);
  ctx.quadraticCurveTo(cx - 128, cy - 20, cx - 88, cy - 115);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Alas laterales
  ctx.fillStyle = '#b45309';
  [-1, 1].forEach((dir) => {
    ctx.beginPath();
    ctx.ellipse(cx + dir * 92, cy + 18, 28, 66, dir * -0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Pecho claro con plumas
  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 38, 64, 68, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Ojos grandes expresivos
  [-42, 42].forEach((ox) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx + ox, cy - 34, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(cx + ox, cy - 34, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx + ox - 5, cy - 39, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Pico triangular naranja
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy - 20);
  ctx.lineTo(cx + 16, cy - 20);
  ctx.lineTo(cx, cy + 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  return c;
}

// Convierte un canvas a modo "Para Colorear" (Blanco y Negro con líneas de contorno limpias)
function buildColoringBookCanvas(srcCanvas) {
  if (!srcCanvas) return null;
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  const sCtx = srcCanvas.getContext('2d');
  const imgData = sCtx.getImageData(0, 0, w, h);
  const src = imgData.data;
  const dstData = ctx.createImageData(w, h);
  const dst = dstData.data;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const a = src[idx + 3];
      if (a < 40) {
        dst[idx + 3] = 0;
        continue;
      }
      const lumaC = 0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2];
      const idxR = (y * w + (x + 1)) * 4;
      const idxD = ((y + 1) * w + x) * 4;
      const lumaR = src[idxR + 3] < 40 ? 255 : (0.299 * src[idxR] + 0.587 * src[idxR + 1] + 0.114 * src[idxR + 2]);
      const lumaD = src[idxD + 3] < 40 ? 255 : (0.299 * src[idxD] + 0.587 * src[idxD + 1] + 0.114 * src[idxD + 2]);
      const grad = Math.hypot(lumaC - lumaR, lumaC - lumaD);
      const isEdge = grad > 26 || lumaC < 55;
      const val = isEdge ? 20 : 255;
      dst[idx] = val;
      dst[idx + 1] = val;
      dst[idx + 2] = val;
      dst[idx + 3] = 255;
    }
  }
  ctx.putImageData(dstData, 0, 0);
  return out;
}

// ============================================================================
// UTILIDADES GEOMÉTRICAS 2D: SIMPLIFICACIÓN PARA TIJERAS, ORIENTACIÓN Y PESTAÑAS
// ============================================================================
function computeSignedPolygonArea(pts) {
  if (!pts || pts.length < 3) return 0;
  let area = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    area += p1.x * p2.y - p2.x * p1.y;
  }
  return area * 0.5;
}

function computePolygonBounds2D(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  (pts || []).forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });
  if (!Number.isFinite(minX)) return { minX: -40, minY: -40, maxX: 40, maxY: 40, width: 80, height: 80, cx: 0, cy: 0 };
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    cx: (minX + maxX) * 0.5,
    cy: (minY + maxY) * 0.5
  };
}

function ensureCounterClockwiseLoop(pts) {
  if (!pts || pts.length < 3) return (pts || []).slice();
  const copy = pts.map((p) => ({ x: Number(p.x), y: Number(p.y) }));
  if (computeSignedPolygonArea(copy) < 0) copy.reverse();
  return copy;
}

// Algoritmo Ramer-Douglas-Peucker para contorno cerrado apto para tijeras escolares
function simplifyClosedLoopForScissors(pts, toleranceMM = 3.0, minVertices = 5, maxVertices = 28) {
  if (!pts || pts.length <= minVertices) return ensureCounterClockwiseLoop(pts || []);
  const clean = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const prev = clean[clean.length - 1];
    if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 0.6) {
      clean.push({ x: Number(p.x), y: Number(p.y) });
    }
  }
  if (clean.length <= minVertices) return ensureCounterClockwiseLoop(clean);

  // Encontrar dos puntos opuestos extremos para dividir el bucle cerrado
  let idxA = 0;
  let idxB = Math.floor(clean.length / 2);
  let maxDist = -1;
  for (let i = 0; i < clean.length; i++) {
    for (let j = i + 1; j < clean.length; j++) {
      const d = Math.hypot(clean[i].x - clean[j].x, clean[i].y - clean[j].y);
      if (d > maxDist) {
        maxDist = d;
        idxA = i;
        idxB = j;
      }
    }
  }

  const rdpOpen = (arr, eps) => {
    if (arr.length <= 2) return arr;
    let dmax = 0;
    let index = 0;
    const start = arr[0];
    const end = arr[arr.length - 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy);
    for (let i = 1; i < arr.length - 1; i++) {
      const p = arr[i];
      const dist = len < 1e-6
        ? Math.hypot(p.x - start.x, p.y - start.y)
        : Math.abs(dy * p.x - dx * p.y + end.x * start.y - end.y * start.x) / len;
      if (dist > dmax) {
        index = i;
        dmax = dist;
      }
    }
    if (dmax > eps) {
      const rec1 = rdpOpen(arr.slice(0, index + 1), eps);
      const rec2 = rdpOpen(arr.slice(index), eps);
      return rec1.slice(0, rec1.length - 1).concat(rec2);
    }
    return [start, end];
  };

  const chain1 = clean.slice(idxA, idxB + 1);
  const chain2 = clean.slice(idxB).concat(clean.slice(0, idxA + 1));

  let simplified = rdpOpen(chain1, toleranceMM).slice(0, -1).concat(rdpOpen(chain2, toleranceMM).slice(0, -1));
  if (simplified.length > maxVertices) {
    const step = simplified.length / maxVertices;
    const decimated = [];
    for (let k = 0; k < maxVertices; k++) {
      decimated.push(simplified[Math.floor(k * step)]);
    }
    simplified = decimated;
  }
  if (simplified.length < minVertices && clean.length >= minVertices) {
    const step = clean.length / minVertices;
    simplified = [];
    for (let k = 0; k < minVertices; k++) {
      simplified.push(clean[Math.floor(k * step)]);
    }
  }
  return ensureCounterClockwiseLoop(simplified);
}

// Envolvente convexa (Monotone Chain) para plataformas con faldones rectos sin auto-intersección
function computeConvexHullLoop(pts) {
  if (!pts || pts.length < 3) return ensureCounterClockwiseLoop(pts || []);
  const sorted = pts.map((p) => ({ x: Number(p.x), y: Number(p.y) }))
    .sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (let i = 0; i < sorted.length; i++) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], sorted[i]) <= 0) {
      lower.pop();
    }
    lower.push(sorted[i]);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) {
      upper.pop();
    }
    upper.push(sorted[i]);
  }
  upper.pop();
  lower.pop();
  return ensureCounterClockwiseLoop(lower.concat(upper));
}

// Construye un trapecio biselado de pegamento escolar sobre el segmento orientado (p1 -> p2)
// Asume contorno principal CCW, por lo que la normal exterior unitaria es (dy/L, -dx/L)
function createGlueTabGeometryOnSegment(p1, p2, tabDepthMM, bevelDeg = 42, label = 'PEGAR', customOutNormal = null) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 3.5 || tabDepthMM <= 0.5) return null;

  const tx = dx / len;
  const ty = dy / len;
  const nx = customOutNormal ? customOutNormal.x : (dy / len);
  const ny = customOutNormal ? customOutNormal.y : (-dx / len);

  const effDepth = Math.min(tabDepthMM, len * 0.48);
  const rad = Math.max(20, Math.min(75, bevelDeg)) * (Math.PI / 180);
  const inset = Math.min(len * 0.34, effDepth / Math.tan(rad));

  const b1 = {
    x: p1.x + tx * inset + nx * effDepth,
    y: p1.y + ty * inset + ny * effDepth
  };
  const b2 = {
    x: p2.x - tx * inset + nx * effDepth,
    y: p2.y - ty * inset + ny * effDepth
  };

  const center = {
    x: (p1.x + p2.x) * 0.5 + nx * (effDepth * 0.52),
    y: (p1.y + p2.y) * 0.5 + ny * (effDepth * 0.52)
  };

  return {
    baseP1: { x: p1.x, y: p1.y },
    baseP2: { x: p2.x, y: p2.y },
    tipP1: b1,
    tipP2: b2,
    polygon: [{ x: p1.x, y: p1.y }, b1, b2, { x: p2.x, y: p2.y }],
    foldLine: [{ x: p1.x, y: p1.y }, { x: p2.x, y: p2.y }],
    center,
    angleRad: Math.atan2(dy, dx),
    normal: { x: nx, y: ny },
    depthMM: effDepth,
    lengthMM: len,
    label
  };
}

// Inserta N pestañas de pegamento (con o sin escalón 3D de altura stepHeightMM) en los tramos más largos de un contorno CCW
function attachGlueTabsToPolygonContour(ccwPoints, numTabs, tabDepthMM, stepHeightMM, bevelDeg, layerCodePrefix) {
  const pts = ensureCounterClockwiseLoop(ccwPoints);
  const n = pts.length;
  if (n < 3) {
    return {
      outerCutPoints: pts,
      foldLines: [],
      glueTabs: [],
      stepPanels: [],
      landingFootprints: []
    };
  }

  // Evaluar todas las aristas y seleccionar las mejores distribuidas alrededor del perímetro
  const edges = [];
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const midAngle = Math.atan2((p1.y + p2.y) * 0.5, (p1.x + p2.x) * 0.5);
    edges.push({ idx: i, p1, p2, len, midAngle });
  }

  const targetCount = Math.max(1, Math.min(numTabs || 4, n));
  const selectedEdgeIndices = new Set();

  // Dividir el círculo angular en sectores para repartir las pestañas equilibradamente
  for (let s = 0; s < targetCount; s++) {
    const sectorCenter = -Math.PI + ((s + 0.5) * 2 * Math.PI) / targetCount;
    let bestEdge = null;
    let bestScore = -Infinity;
    edges.forEach((e) => {
      if (selectedEdgeIndices.has(e.idx) || e.len < 6) return;
      let dAng = Math.abs(e.midAngle - sectorCenter);
      if (dAng > Math.PI) dAng = 2 * Math.PI - dAng;
      const score = e.len - dAng * 12;
      if (score > bestScore) {
        bestScore = score;
        bestEdge = e;
      }
    });
    if (bestEdge) selectedEdgeIndices.add(bestEdge.idx);
  }

  // Si aún faltan pestañas, elegir por longitud
  if (selectedEdgeIndices.size === 0) {
    const byLen = edges.slice().sort((a, b) => b.len - a.len);
    for (let k = 0; k < Math.min(targetCount, byLen.length); k++) {
      selectedEdgeIndices.add(byLen[k].idx);
    }
  }

  const outerCutPoints = [];
  const foldLines = [];
  const glueTabs = [];
  const stepPanels = [];
  const landingFootprints = [];
  let tabCounter = 1;

  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    outerCutPoints.push({ x: p1.x, y: p1.y });

    if (!selectedEdgeIndices.has(i)) continue;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen < 6) continue;

    const tx = dx / segLen;
    const ty = dy / segLen;
    const nx = dy / segLen;
    const ny = -dx / segLen;

    // Acotar el ancho máximo de la pestaña para que quede centrada en la arista
    const maxTabSpan = Math.min(segLen * 0.78, Math.max(14, tabDepthMM * 2.8));
    const marginSpan = (segLen - maxTabSpan) * 0.5;
    const a1 = { x: p1.x + tx * marginSpan, y: p1.y + ty * marginSpan };
    const a2 = { x: p2.x - tx * marginSpan, y: p2.y - ty * marginSpan };

    if (marginSpan > 0.5) {
      outerCutPoints.push({ x: a1.x, y: a1.y });
    }

    const tabIdCode = (layerCodePrefix || 'P') + '.' + tabCounter++;

    if (stepHeightMM > 0.5) {
      // Pestaña con escalón 3D: Cuello rectangular de altura stepHeightMM + Solapa trapezoidal
      const w1 = { x: a1.x + nx * stepHeightMM, y: a1.y + ny * stepHeightMM };
      const w2 = { x: a2.x + nx * stepHeightMM, y: a2.y + ny * stepHeightMM };
      const tabGeom = createGlueTabGeometryOnSegment(w1, w2, tabDepthMM, bevelDeg, 'PEGAR ' + tabIdCode, { x: nx, y: ny });

      foldLines.push({ points: [a1, a2], type: 'mountain', label: 'Doblar 90°' });
      foldLines.push({ points: [w1, w2], type: 'valley', label: 'Doblar solapa' });
      stepPanels.push({ polygon: [a1, w1, w2, a2], heightMM: stepHeightMM });

      if (tabGeom) {
        outerCutPoints.push(w1, tabGeom.tipP1, tabGeom.tipP2, w2);
        glueTabs.push(tabGeom);
        // La huella donde aterriza esta pestaña en la capa inferior (cuando baja verticalmente en Z)
        const footGeom = createGlueTabGeometryOnSegment(a1, a2, tabDepthMM, bevelDeg, 'PEGAR ' + tabIdCode, { x: nx, y: ny });
        if (footGeom) {
          landingFootprints.push({
            polygon: footGeom.polygon,
            center: footGeom.center,
            angleRad: footGeom.angleRad,
            label: 'PEGAR ' + tabIdCode
          });
        }
      } else {
        outerCutPoints.push(w1, w2);
      }
    } else {
      // Pestaña trapezoidal directa en el borde
      const tabGeom = createGlueTabGeometryOnSegment(a1, a2, tabDepthMM, bevelDeg, 'PEGAR ' + tabIdCode, { x: nx, y: ny });
      if (tabGeom) {
        foldLines.push({ points: [a1, a2], type: 'mountain', label: 'Doblar' });
        outerCutPoints.push(tabGeom.tipP1, tabGeom.tipP2);
        glueTabs.push(tabGeom);
        landingFootprints.push({
          polygon: tabGeom.polygon,
          center: tabGeom.center,
          angleRad: tabGeom.angleRad,
          label: 'PEGAR ' + tabIdCode
        });
      }
    }

    if (marginSpan > 0.5) {
      outerCutPoints.push({ x: a2.x, y: a2.y });
    }
  }

  return {
    outerCutPoints,
    foldLines,
    glueTabs,
    stepPanels,
    landingFootprints
  };
}

// ============================================================================
// EXTRACCIÓN DE CONTORNOS DESDE IMAGEN (SILUETA Y CAPAS POR UMBRAL / CANAL ALFA)
// ============================================================================
function extractSilhouetteLoopFromCanvas(srcCanvas, targetWMM, targetHMM, thresholdMode = 'silhouette', layerFrac = 0, marginMM = 2.0, simplifyMM = 3.0) {
  if (!srcCanvas) {
    const hw = targetWMM * 0.45;
    const hh = targetHMM * 0.45;
    return [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh }
    ];
  }

  const gridN = 96;
  const tmp = document.createElement('canvas');
  tmp.width = gridN;
  tmp.height = gridN;
  const ctx = tmp.getContext('2d');
  ctx.drawImage(srcCanvas, 0, 0, gridN, gridN);
  const data = ctx.getImageData(0, 0, gridN, gridN).data;

  // Detectar si tiene transparencia real en las esquinas
  const cornerAlphas = [
    data[3],
    data[(gridN - 1) * 4 + 3],
    data[(gridN * (gridN - 1)) * 4 + 3],
    data[(gridN * gridN - 1) * 4 + 3]
  ];
  const hasTransparency = cornerAlphas.some((a) => a < 180);
  const bgR = data[0], bgG = data[1], bgB = data[2];

  // Construir máscara binaria
  const mask = new Uint8Array(gridN * gridN);
  for (let y = 0; y < gridN; y++) {
    for (let x = 0; x < gridN; x++) {
      const i = (y * gridN + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      let inside = false;
      if (hasTransparency) {
        inside = a > 60;
      } else {
        const distBg = Math.hypot(r - bgR, g - bgG, b - bgB);
        inside = distBg > 32 && a > 60;
      }

      if (inside && thresholdMode === 'multilayer' && layerFrac > 0.05) {
        // Para descomposición de 1 imagen en N capas: combinar distancia al borde y contraste/color
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        const sat = Math.max(r, g, b) - Math.min(r, g, b);
        const normX = (x - gridN * 0.5) / (gridN * 0.5);
        const normY = (y - gridN * 0.5) / (gridN * 0.5);
        const radial = Math.hypot(normX, normY);
        const score = (1.0 - radial * 0.55) + (sat / 255) * 0.35 + ((255 - luma) / 255) * 0.25;
        if (score < layerFrac * 0.95) {
          inside = false;
        }
      }
      mask[y * gridN + x] = inside ? 1 : 0;
    }
  }

  // Extraer contorno exterior mediante barrido radial angular (72 rayos) para garantizar una silueta cerrada limpia y apta para tijeras
  const cx = gridN * 0.5;
  const cy = gridN * 0.5;
  const numRays = 72;
  const maxR = gridN * 0.68;
  const rawPts = [];
  const marginRatioX = marginMM / Math.max(10, targetWMM);
  const marginRatioY = marginMM / Math.max(10, targetHMM);

  for (let k = 0; k < numRays; k++) {
    const ang = (k / numRays) * Math.PI * 2;
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);
    let bestR = 0;
    for (let r = maxR; r >= 2; r -= 0.8) {
      const gx = Math.round(cx + cosA * r);
      const gy = Math.round(cy - sinA * r);
      if (gx >= 0 && gx < gridN && gy >= 0 && gy < gridN) {
        if (mask[gy * gridN + gx] === 1) {
          bestR = r;
          break;
        }
      }
    }
    if (bestR > 2) {
      const nx = (bestR * cosA) / gridN + cosA * marginRatioX;
      const ny = (bestR * sinA) / gridN + sinA * marginRatioY;
      rawPts.push({
        x: Math.max(-targetWMM * 0.49, Math.min(targetWMM * 0.49, nx * targetWMM)),
        y: Math.max(-targetHMM * 0.49, Math.min(targetHMM * 0.49, ny * targetHMM))
      });
    }
  }

  // Suavizar el perfil radial y simplificar para tijeras escolares
  if (rawPts.length < 6) {
    const scale = Math.max(0.28, 1 - layerFrac * 0.62);
    const hw = targetWMM * 0.44 * scale;
    const hh = targetHMM * 0.44 * scale;
    return [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh }
    ];
  }

  const smoothed = [];
  for (let i = 0; i < rawPts.length; i++) {
    const pPrev = rawPts[(i - 1 + rawPts.length) % rawPts.length];
    const pCurr = rawPts[i];
    const pNext = rawPts[(i + 1) % rawPts.length];
    smoothed.push({
      x: pPrev.x * 0.22 + pCurr.x * 0.56 + pNext.x * 0.22,
      y: pPrev.y * 0.22 + pCurr.y * 0.56 + pNext.y * 0.22
    });
  }

  return simplifyClosedLoopForScissors(smoothed, simplifyMM, 6, 22);
}

// Crea una ilustración recortada para una capa específica
function createLayerArtworkCanvas(srcCanvas, loopPoints, wMM, hMM, layerColorObj, printStyle) {
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 320;
  const ctx = c.getContext('2d');

  if (srcCanvas) {
    if (printStyle === 'coloring') {
      const colCanvas = buildColoringBookCanvas(srcCanvas);
      if (colCanvas) ctx.drawImage(colCanvas, 0, 0, c.width, c.height);
    } else if (printStyle === 'color') {
      ctx.drawImage(srcCanvas, 0, 0, c.width, c.height);
    }
  } else if (printStyle === 'color' && layerColorObj) {
    // Sombreado decorativo escolar para capas procedentes del modelo 3D
    const grad = ctx.createLinearGradient(0, 0, c.width, c.height);
    grad.addColorStop(0, layerColorObj.light);
    grad.addColorStop(1, layerColorObj.fill);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  return c;
}

// ============================================================================
// EXTRACCIÓN DE LAS CAPAS BASE SEGÚN LA FUENTE ELEGIDA (3D, 1 IMAGEN O VARIAS)
// ============================================================================
function extractPapercraftSourceLayers() {
  const srcMode = papercraftState.sourceMode;
  const wMM = Math.max(30, Number(papercraftState.widthMM) || 130);
  const hMM = Math.max(30, Number(papercraftState.heightMM) || 130);
  const simplifyMM = Math.max(0.8, Number(papercraftState.scissorsSimplifyMM) || 3.5);
  const marginMM = Math.max(0, Number(papercraftState.cutMarginMM) || 2.5);
  const layers = [];

  if (srcMode === 'model3d') {
    const nLayers = Math.max(2, Math.min(12, parseInt(papercraftState.layersCount, 10) || 5));
    const axis = papercraftState.sliceAxis || 'z';
    const tris = typeof getScaledTriangles === 'function' ? getScaledTriangles() : null;
    const modelSpan = state.dimsMM ? (state.dimsMM[axis] || 120) : 120;
    const otherAxes = axis === 'x' ? ['y', 'z'] : (axis === 'y' ? ['x', 'z'] : ['x', 'y']);
    const spanU = Math.max(1, state.dimsMM ? state.dimsMM[otherAxes[0]] : 120);
    const spanV = Math.max(1, state.dimsMM ? state.dimsMM[otherAxes[1]] : 120);
    const scaleU = (wMM * 0.86) / spanU;
    const scaleV = (hMM * 0.86) / spanV;
    const scale2D = Math.min(scaleU, scaleV);

    for (let k = 0; k < nLayers; k++) {
      const frac = nLayers === 1 ? 0.5 : (k + 0.5) / nLayers;
      const coord = -modelSpan * 0.5 + frac * modelSpan;
      let rawLoops = [];
      if (tris && tris.length > 0 && typeof sliceMeshAtCoord === 'function') {
        rawLoops = sliceMeshAtCoord(tris, axis, coord) || [];
      } else if (state.slices && state.slices.length > 0) {
        const sIdx = Math.min(state.slices.length - 1, Math.floor(frac * state.slices.length));
        rawLoops = (state.slices[sIdx] && state.slices[sIdx].loops) ? state.slices[sIdx].loops : [];
      }

      // Escoger el contorno exterior mayor (o envolvente de las islas exteriores)
      const outerLoops = rawLoops.filter((l) => !l.isHole && l.points && l.points.length >= 3);
      let chosenPts = [];
      if (outerLoops.length === 1) {
        chosenPts = outerLoops[0].points.map((p) => ({ x: p.x * scale2D, y: p.y * scale2D }));
      } else if (outerLoops.length > 1) {
        // Si hay varias islas en la cota, combinar en envolvente convexa suave o tomar la mayor
        const allPts = [];
        outerLoops.forEach((l) => {
          l.points.forEach((p) => allPts.push({ x: p.x * scale2D, y: p.y * scale2D }));
        });
        chosenPts = computeConvexHullLoop(allPts);
      } else {
        // Fallback geométrico si la cota extrema no corta triángulos
        const r = Math.max(16, (wMM * 0.42) * (1 - k * 0.12));
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          chosenPts.push({ x: Math.cos(ang) * r, y: Math.sin(ang) * r });
        }
      }

      const maxVerts = papercraftState.cutoutType === 'stacked_platforms' && papercraftState.platformUnfoldMode === 'attached_flaps'
        ? 10
        : 22;
      let cleanLoop = simplifyClosedLoopForScissors(chosenPts, simplifyMM, 4, maxVerts);
      if (papercraftState.cutoutType === 'stacked_platforms' && papercraftState.platformUnfoldMode === 'attached_flaps') {
        cleanLoop = simplifyClosedLoopForScissors(computeConvexHullLoop(cleanLoop), Math.max(simplifyMM, 4.0), 4, 8);
      }

      const colObj = PAPERCRAFT_LAYER_COLORS[k % PAPERCRAFT_LAYER_COLORS.length];
      layers.push({
        layerIndex: k,
        title: 'Capa #' + (k + 1) + ' (' + axis.toUpperCase() + '=' + coord.toFixed(0) + 'mm)',
        shortCode: 'C' + (k + 1),
        contourPoints: cleanLoop,
        bounds: computePolygonBounds2D(cleanLoop),
        colorObj: colObj,
        artworkCanvas: createLayerArtworkCanvas(null, cleanLoop, wMM, hMM, colObj, papercraftState.printStyle),
        sourceCanvas: null
      });
    }
    return layers;
  }

  if (srcMode === 'single_image') {
    if (!papercraftState.singleImageCanvas) {
      papercraftState.singleImageCanvas = createProceduralPapercraftCanvas(papercraftState.singleImagePreset || 'owl', -1);
    }
    const nLayers = Math.max(1, Math.min(10, parseInt(papercraftState.layersCount, 10) || 4));
    const isPresetMultiCapable = ['volcano', 'castle', 'rocket'].includes(papercraftState.singleImagePreset) && !papercraftState._isCustomSingleImage;

    for (let k = 0; k < nLayers; k++) {
      const frac = nLayers === 1 ? 0 : (k / Math.max(1, nLayers));
      const layerCanvas = isPresetMultiCapable
        ? createProceduralPapercraftCanvas(papercraftState.singleImagePreset, Math.min(3, k), nLayers)
        : papercraftState.singleImageCanvas;

      let loopPts = extractSilhouetteLoopFromCanvas(
        layerCanvas,
        wMM,
        hMM,
        isPresetMultiCapable ? 'silhouette' : 'multilayer',
        frac,
        marginMM,
        simplifyMM
      );

      if (papercraftState.cutoutType === 'stacked_platforms' && papercraftState.platformUnfoldMode === 'attached_flaps') {
        loopPts = simplifyClosedLoopForScissors(computeConvexHullLoop(loopPts), Math.max(simplifyMM, 4.0), 4, 8);
      }

      const colObj = PAPERCRAFT_LAYER_COLORS[k % PAPERCRAFT_LAYER_COLORS.length];
      layers.push({
        layerIndex: k,
        title: 'Capa #' + (k + 1) + ' — ' + (papercraftState.singleImageName || 'Imagen'),
        shortCode: 'C' + (k + 1),
        contourPoints: loopPts,
        bounds: computePolygonBounds2D(loopPts),
        colorObj: colObj,
        artworkCanvas: createLayerArtworkCanvas(layerCanvas, loopPts, wMM, hMM, colObj, papercraftState.printStyle),
        sourceCanvas: layerCanvas
      });
    }
    return layers;
  }

  // Modo 'multi_images' (Una o varias imágenes donde cada imagen es una capa/pieza del recortable)
  if (!papercraftState.multiImagesList || papercraftState.multiImagesList.length === 0) {
    loadPapercraftMultiImagePack(papercraftState.multiImagesPack || 'volcano_pack', false);
  }

  papercraftState.multiImagesList.forEach((item, k) => {
    let loopPts = extractSilhouetteLoopFromCanvas(
      item.canvas,
      wMM,
      hMM,
      'silhouette',
      0,
      marginMM,
      simplifyMM
    );
    if (papercraftState.cutoutType === 'stacked_platforms' && papercraftState.platformUnfoldMode === 'attached_flaps') {
      loopPts = simplifyClosedLoopForScissors(computeConvexHullLoop(loopPts), Math.max(simplifyMM, 4.0), 4, 8);
    }
    const colObj = PAPERCRAFT_LAYER_COLORS[k % PAPERCRAFT_LAYER_COLORS.length];
    layers.push({
      layerIndex: k,
      title: 'Capa #' + (k + 1) + ' — ' + (item.name || ('Imagen ' + (k + 1))),
      shortCode: 'C' + (k + 1),
      contourPoints: loopPts,
      bounds: computePolygonBounds2D(loopPts),
      colorObj: colObj,
      artworkCanvas: createLayerArtworkCanvas(item.canvas, loopPts, wMM, hMM, colObj, papercraftState.printStyle),
      sourceCanvas: item.canvas
    });
  });

  return layers;
}

// ============================================================================
// GENERADORES DE LOS 5 TIPOS DE RECORTABLES CON PESTAÑAS DE PEGAMENTO ESCOLAR
// ============================================================================
function buildPapercraftPieces() {
  const baseLayers = extractPapercraftSourceLayers();
  const type = papercraftState.cutoutType;
  const tabDepth = Math.max(4, Number(papercraftState.tabDepthMM) || 10);
  const wallH = Math.max(0, Number(papercraftState.wallHeightMM) || 14);
  const bevelDeg = Math.max(25, Math.min(65, Number(papercraftState.tabBevelDeg) || 42));
  const pieces = [];

  // --------------------------------------------------------------------------
  // TIPO 1: PLATAFORMAS 3D PARA APILAR (CON FALDÓN PLEGABLE O BANDA DENTADA)
  // --------------------------------------------------------------------------
  if (type === 'stacked_platforms') {
    const effWallH = Math.max(6, wallH);
    const unfoldMode = papercraftState.platformUnfoldMode || 'attached_flaps';

    baseLayers.forEach((layer, idx) => {
      const nextLayer = idx + 1 < baseLayers.length ? baseLayers[idx + 1] : null;
      const pts = ensureCounterClockwiseLoop(layer.contourPoints);
      const n = pts.length;

      // Zona guía superior donde se pega la plataforma siguiente (#k+1)
      const glueTargetZones = [];
      if (nextLayer && nextLayer.contourPoints && nextLayer.contourPoints.length >= 3) {
        glueTargetZones.push({
          polygon: nextLayer.contourPoints.map((p) => ({ x: p.x, y: p.y })),
          label: 'PEGAR AQUÍ PLATAFORMA #' + (idx + 2)
        });
      }

      if (unfoldMode === 'attached_flaps') {
        // Despliegue integrado: cada lado recto del polígono despliega su pared lateral H + pestaña inferior + pestaña lateral
        const outerCutPoints = [];
        const foldLines = [];
        const glueTabs = [];
        const wallPanels = [];

        for (let i = 0; i < n; i++) {
          const p1 = pts[i];
          const p2 = pts[(i + 1) % n];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy);
          if (len < 4) {
            outerCutPoints.push({ x: p1.x, y: p1.y });
            continue;
          }
          const nx = dy / len;
          const ny = -dx / len;

          // Esquinas exteriores de la pared lateral desplegada (a distancia effWallH)
          const w1 = { x: p1.x + nx * effWallH, y: p1.y + ny * effWallH };
          const w2 = { x: p2.x + nx * effWallH, y: p2.y + ny * effWallH };

          // Línea de pliegue montaña entre la tapa y la pared lateral
          foldLines.push({ points: [p1, p2], type: 'mountain', label: 'Doblar pared 90°' });
          wallPanels.push({ polygon: [p1, w1, w2, p2], edgeIndex: i });

          // Pestaña trapezoidal inferior en la base de la pared (para pegar sobre la plataforma inferior)
          const baseTab = createGlueTabGeometryOnSegment(
            w1,
            w2,
            tabDepth,
            bevelDeg,
            idx === 0 ? ('BASE P' + (idx + 1) + '.' + (i + 1)) : ('PEGAR EN C' + idx + ' (P' + (i + 1) + ')'),
            { x: nx, y: ny }
          );

          // Pestaña trapezoidal lateral en la arista derecha de la pared (w2 -> p2) para cerrar esquina a 90°
          const sideNormal = { x: dx / len, y: dy / len };
          const sideTab = createGlueTabGeometryOnSegment(
            w2,
            p2,
            Math.min(tabDepth * 0.85, effWallH * 0.45),
            bevelDeg,
            'L' + (i + 1),
            sideNormal
          );

          outerCutPoints.push({ x: p1.x, y: p1.y });
          outerCutPoints.push(w1);

          if (baseTab) {
            foldLines.push({ points: [w1, w2], type: 'valley', label: 'Solapa base' });
            outerCutPoints.push(baseTab.tipP1, baseTab.tipP2);
            glueTabs.push(baseTab);
          }

          outerCutPoints.push(w2);

          if (sideTab) {
            foldLines.push({ points: [w2, p2], type: 'mountain', label: 'Cerrar esquina' });
            outerCutPoints.push(sideTab.tipP1, sideTab.tipP2);
            glueTabs.push(sideTab);
          }

          outerCutPoints.push({ x: p2.x, y: p2.y });
        }

        pieces.push({
          pieceId: 'plat_' + (idx + 1),
          layerIndex: idx,
          title: 'Plataforma Apilable #' + (idx + 1) + (idx === 0 ? ' (Base Inferior)' : (' (Pegar sobre #' + idx + ')')),
          subtitle: 'Doblar paredes ' + effWallH + ' mm a 90° y pegar pestañas con pegamento escolar',
          shortCode: 'P' + (idx + 1),
          bodyPolygon: pts,
          outerCutPoints,
          foldLines,
          glueTabs,
          wallPanels,
          glueTargetZones,
          colorObj: layer.colorObj,
          artworkCanvas: layer.artworkCanvas,
          artworkBounds: layer.bounds,
          bounds: computePolygonBounds2D(outerCutPoints),
          height3DMM: effWallH
        });
      } else {
        // Sub-modo 'collar_strip': Pieza A = Tapa Superior Curva/Orgánica + Pieza B = Tira Perimetral Dentada con pestañas
        let perimeterMM = 0;
        for (let i = 0; i < n; i++) {
          const p1 = pts[i];
          const p2 = pts[(i + 1) % n];
          perimeterMM += Math.hypot(p2.x - p1.x, p2.y - p1.y);
        }

        // 1. Pieza de Tapa Superior
        pieces.push({
          pieceId: 'plat_cap_' + (idx + 1),
          layerIndex: idx,
          title: 'Plataforma #' + (idx + 1) + ' (A) — Tapa Superior',
          subtitle: 'Recortar silueta y pegar debajo los dientes superiores de la Banda Lateral #' + (idx + 1),
          shortCode: 'P' + (idx + 1) + '-TAPA',
          bodyPolygon: pts,
          outerCutPoints: pts.slice(),
          foldLines: [],
          glueTabs: [],
          wallPanels: [],
          glueTargetZones,
          colorObj: layer.colorObj,
          artworkCanvas: layer.artworkCanvas,
          artworkBounds: layer.bounds,
          bounds: computePolygonBounds2D(pts),
          height3DMM: effWallH
        });

        // 2. Pieza de Tira / Banda Perimetral Dentada (dividida en tramos de máx. 170 mm si supera el ancho de un A4)
        const maxStripLen = 175;
        const numSegments = Math.max(1, Math.ceil(perimeterMM / maxStripLen));
        const segLen = perimeterMM / numSegments;

        for (let s = 0; s < numSegments; s++) {
          const halfL = segLen * 0.5;
          const halfH = effWallH * 0.5;
          const bodyRect = [
            { x: -halfL, y: -halfH },
            { x: halfL, y: -halfH },
            { x: halfL, y: halfH },
            { x: -halfL, y: halfH }
          ];
          const stripCut = [];
          const stripFolds = [
            { points: [{ x: -halfL, y: halfH }, { x: halfL, y: halfH }], type: 'mountain', label: 'Doblar dientes sup.' },
            { points: [{ x: -halfL, y: -halfH }, { x: halfL, y: -halfH }], type: 'valley', label: 'Doblar dientes inf.' },
            { points: [{ x: halfL, y: -halfH }, { x: halfL, y: halfH }], type: 'mountain', label: 'Cerrar tira' }
          ];
          const stripTabs = [];
          const toothW = Math.max(10, Math.min(18, tabDepth * 1.4));
          const numTeeth = Math.max(3, Math.round(segLen / toothW));
          const stepW = segLen / numTeeth;

          // Borde inferior (de izquierda a derecha) con dientes trapezoidales hacia abajo (-Y)
          stripCut.push({ x: -halfL, y: -halfH });
          for (let t = 0; t < numTeeth; t++) {
            const xA = -halfL + t * stepW;
            const xB = xA + stepW;
            const tabBot = createGlueTabGeometryOnSegment(
              { x: xA, y: -halfH },
              { x: xB, y: -halfH },
              tabDepth * 0.85,
              52,
              t % 2 === 0 ? 'PEGAR BASE' : '',
              { x: 0, y: -1 }
            );
            if (tabBot) {
              stripCut.push(tabBot.tipP1, tabBot.tipP2, { x: xB, y: -halfH });
              stripTabs.push(tabBot);
            } else {
              stripCut.push({ x: xB, y: -halfH });
            }
          }

          // Pestaña de cierre en el extremo derecho (+X)
          const endTab = createGlueTabGeometryOnSegment(
            { x: halfL, y: -halfH },
            { x: halfL, y: halfH },
            tabDepth,
            bevelDeg,
            'UNIR BANDA',
            { x: 1, y: 0 }
          );
          if (endTab) {
            stripCut.push(endTab.tipP1, endTab.tipP2, { x: halfL, y: halfH });
            stripTabs.push(endTab);
          } else {
            stripCut.push({ x: halfL, y: halfH });
          }

          // Borde superior (de derecha a izquierda) con dientes trapezoidales hacia arriba (+Y) para pegar bajo la tapa
          for (let t = numTeeth - 1; t >= 0; t--) {
            const xB = -halfL + (t + 1) * stepW;
            const xA = -halfL + t * stepW;
            const tabTop = createGlueTabGeometryOnSegment(
              { x: xB, y: halfH },
              { x: xA, y: halfH },
              tabDepth * 0.85,
              52,
              t % 2 === 0 ? ('TAPA P' + (idx + 1)) : '',
              { x: 0, y: 1 }
            );
            if (tabTop) {
              stripCut.push(tabTop.tipP1, tabTop.tipP2, { x: xA, y: halfH });
              stripTabs.push(tabTop);
            } else {
              stripCut.push({ x: xA, y: halfH });
            }
          }

          pieces.push({
            pieceId: 'plat_strip_' + (idx + 1) + '_' + (s + 1),
            layerIndex: idx,
            isCollarStrip: true,
            title: 'Banda Lateral Dentada #' + (idx + 1) + (numSegments > 1 ? (' (Tramo ' + (s + 1) + '/' + numSegments + ')') : ''),
            subtitle: 'Largo: ' + segLen.toFixed(0) + ' mm × Alto: ' + effWallH + ' mm · Dientes plegables para curvar alrededor de Tapa #' + (idx + 1),
            shortCode: 'BANDA-P' + (idx + 1) + (numSegments > 1 ? ('-' + (s + 1)) : ''),
            bodyPolygon: bodyRect,
            outerCutPoints: stripCut,
            foldLines: stripFolds,
            glueTabs: stripTabs,
            wallPanels: [],
            glueTargetZones: [],
            colorObj: layer.colorObj,
            artworkCanvas: null,
            artworkBounds: computePolygonBounds2D(bodyRect),
            bounds: computePolygonBounds2D(stripCut),
            height3DMM: effWallH
          });
        }
      }
    });

    return pieces;
  }

  // --------------------------------------------------------------------------
  // TIPO 2: RECORTABLES EN CAPAS SUPERPUESTAS (UNO SOBRE OTRO CON PESTAÑAS)
  // --------------------------------------------------------------------------
  if (type === 'layered_tabs') {
    const numTabs = Math.max(2, Math.min(8, parseInt(papercraftState.tabsPerLayer, 10) || 4));
    const stepH = Math.max(0, wallH);

    // Primero generamos las pestañas de las capas 1..N-1 para conocer dónde aterrizan en la capa inferior
    const layerTabResults = baseLayers.map((layer, idx) => {
      if (idx === 0) {
        return {
          outerCutPoints: layer.contourPoints.slice(),
          foldLines: [],
          glueTabs: [],
          stepPanels: [],
          landingFootprints: []
        };
      }
      return attachGlueTabsToPolygonContour(
        layer.contourPoints,
        numTabs,
        tabDepth,
        stepH,
        bevelDeg,
        'C' + (idx + 1)
      );
    });

    baseLayers.forEach((layer, idx) => {
      const tabRes = layerTabResults[idx];
      const nextLayer = idx + 1 < baseLayers.length ? baseLayers[idx + 1] : null;
      const nextTabRes = idx + 1 < layerTabResults.length ? layerTabResults[idx + 1] : null;

      const glueTargetZones = [];
      if (nextLayer) {
        glueTargetZones.push({
          polygon: nextLayer.contourPoints.map((p) => ({ x: p.x, y: p.y })),
          label: 'SILUETA CAPA #' + (idx + 2) + ' (ENCIMA)'
        });
      }
      if (nextTabRes && nextTabRes.landingFootprints) {
        nextTabRes.landingFootprints.forEach((fp) => {
          glueTargetZones.push({
            polygon: fp.polygon,
            label: fp.label,
            isTabLanding: true
          });
        });
      }

      pieces.push({
        pieceId: 'layer_tab_' + (idx + 1),
        layerIndex: idx,
        title: layer.title + (idx === 0 ? ' [Base Fondo]' : (' [Superponer sobre Capa #' + idx + ']')),
        subtitle: idx === 0
          ? 'Capa base inferior: recorta por la línea exterior y pega encima las pestañas de la Capa #2'
          : ('Recorta con las ' + tabRes.glueTabs.length + ' pestañas' + (stepH > 0 ? (' (escalón ' + stepH + ' mm)') : '') + ' y pégalas en la Capa #' + idx),
        shortCode: 'CAPA-' + (idx + 1),
        bodyPolygon: layer.contourPoints,
        outerCutPoints: tabRes.outerCutPoints,
        foldLines: tabRes.foldLines,
        glueTabs: tabRes.glueTabs,
        wallPanels: tabRes.stepPanels,
        glueTargetZones,
        colorObj: layer.colorObj,
        artworkCanvas: layer.artworkCanvas,
        artworkBounds: layer.bounds,
        bounds: computePolygonBounds2D(tabRes.outerCutPoints),
        height3DMM: stepH
      });
    });

    return pieces;
  }

  // --------------------------------------------------------------------------
  // TIPO 3: CAPAS SUPERPUESTAS CON SEPARADORES / MUELLES PLEGABLES EN Z
  // --------------------------------------------------------------------------
  if (type === 'accordion_spacers') {
    const spacerH = Math.max(6, wallH);
    const spacerW = Math.max(12, tabDepth * 1.4);

    baseLayers.forEach((layer, idx) => {
      const nextLayer = idx + 1 < baseLayers.length ? baseLayers[idx + 1] : null;
      const b = layer.bounds;
      const glueTargetZones = [];

      // Dos casillas de pegado de separador en cada capa (izquierda y derecha del centroide)
      const offX = Math.min(b.width * 0.22, 24);
      [-offX, offX].forEach((dx, sIdx) => {
        const sx = b.cx + dx;
        const sy = b.cy;
        const hw = spacerW * 0.5;
        const hh = tabDepth * 0.5;
        const boxPoly = [
          { x: sx - hw, y: sy - hh },
          { x: sx + hw, y: sy - hh },
          { x: sx + hw, y: sy + hh },
          { x: sx - hw, y: sy + hh }
        ];
        if (nextLayer) {
          glueTargetZones.push({
            polygon: boxPoly,
            label: 'PEGAR SEP. S' + (idx + 1) + '.' + (sIdx + 1),
            isTabLanding: true
          });
        }
      });

      if (nextLayer) {
        glueTargetZones.push({
          polygon: nextLayer.contourPoints.map((p) => ({ x: p.x, y: p.y })),
          label: 'GUÍA CAPA #' + (idx + 2)
        });
      }

      pieces.push({
        pieceId: 'acc_layer_' + (idx + 1),
        layerIndex: idx,
        title: layer.title + ' (Recortable en Capas con Separador Z)',
        subtitle: nextLayer
          ? ('Recortar silueta y pegar los 2 separadores S' + (idx + 1) + '.1 y S' + (idx + 1) + '.2 en las casillas marcadas')
          : 'Capa frontal superior: pegar sobre los separadores de la capa anterior',
        shortCode: 'CAPA-' + (idx + 1),
        bodyPolygon: layer.contourPoints,
        outerCutPoints: layer.contourPoints.slice(),
        foldLines: [],
        glueTabs: [],
        wallPanels: [],
        glueTargetZones,
        colorObj: layer.colorObj,
        artworkCanvas: layer.artworkCanvas,
        artworkBounds: layer.bounds,
        bounds: layer.bounds,
        height3DMM: spacerH
      });
    });

    // Generar la pieza agrupada con todos los Separadores Plegables en Z / Acordeón Escolar
    for (let idx = 0; idx < Math.max(1, baseLayers.length - 1); idx++) {
      for (let sIdx = 1; sIdx <= 2; sIdx++) {
        const code = 'S' + (idx + 1) + '.' + sIdx;
        const halfW = spacerW * 0.5;
        const halfH = spacerH * 0.5;
        const bodyPoly = [
          { x: -halfW, y: -halfH },
          { x: halfW, y: -halfH },
          { x: halfW, y: halfH },
          { x: -halfW, y: halfH }
        ];
        const topTab = createGlueTabGeometryOnSegment(
          { x: halfW, y: halfH },
          { x: -halfW, y: halfH },
          tabDepth,
          bevelDeg,
          'PEGAR EN C' + (idx + 2) + ' (' + code + ')',
          { x: 0, y: 1 }
        );
        const botTab = createGlueTabGeometryOnSegment(
          { x: -halfW, y: -halfH },
          { x: halfW, y: -halfH },
          tabDepth,
          bevelDeg,
          'PEGAR EN C' + (idx + 1) + ' (' + code + ')',
          { x: 0, y: -1 }
        );

        const outerCut = [
          { x: -halfW, y: -halfH },
          botTab.tipP1,
          botTab.tipP2,
          { x: halfW, y: -halfH },
          { x: halfW, y: halfH },
          topTab.tipP1,
          topTab.tipP2,
          { x: -halfW, y: halfH }
        ];
        const foldLines = [
          { points: [{ x: -halfW, y: halfH }, { x: halfW, y: halfH }], type: 'mountain', label: 'Pliegue Z Sup.' },
          { points: [{ x: -halfW, y: 0 }, { x: halfW, y: 0 }], type: 'valley', label: 'Muelle central' },
          { points: [{ x: -halfW, y: -halfH }, { x: halfW, y: -halfH }], type: 'valley', label: 'Pliegue Z Inf.' }
        ];

        pieces.push({
          pieceId: 'spacer_' + code,
          layerIndex: idx,
          isSpacerPiece: true,
          title: 'Separador Plegable en Z (' + code + ') — Entre Capa #' + (idx + 1) + ' y #' + (idx + 2),
          subtitle: 'Doblar en acordeón (Z) y pegar pestañas en las casillas ' + code,
          shortCode: 'SEP-' + code,
          bodyPolygon: bodyPoly,
          outerCutPoints: outerCut,
          foldLines,
          glueTabs: [topTab, botTab],
          wallPanels: [],
          glueTargetZones: [],
          colorObj: baseLayers[idx].colorObj,
          artworkCanvas: null,
          artworkBounds: computePolygonBounds2D(bodyPoly),
          bounds: computePolygonBounds2D(outerCut),
          height3DMM: spacerH
        });
      }
    }

    return pieces;
  }

  // --------------------------------------------------------------------------
  // TIPO 4: FIGURAS TROQUELADAS CON PEANA ESCÉNICA Y PESTAÑAS A 90°
  // --------------------------------------------------------------------------
  if (type === 'standee_peana') {
    const isDoubleFold = papercraftState.standeeFoldMode !== 'single_tab';
    const peanaW = Math.max(95, Number(papercraftState.widthMM) || 130);
    const peanaD = Math.max(65, Math.min(130, baseLayers.length * (tabDepth + 16) + 24));
    const peanaSkirtH = Math.max(8, Math.min(18, wallH));

    // 1. Generar la Peana Escénica Recortable (con faldones laterales y zonas marcadas para pegar cada figura)
    const hw = peanaW * 0.5;
    const hd = peanaD * 0.5;
    const peanaBody = [
      { x: -hw, y: -hd },
      { x: hw, y: -hd },
      { x: hw, y: hd },
      { x: -hw, y: hd }
    ];
    const peanaZones = [];
    baseLayers.forEach((layer, idx) => {
      // Ordenar de atrás (Capa #1 en +Y) hacia delante (Capa #N en -Y)
      const frac = baseLayers.length === 1 ? 0.5 : idx / (baseLayers.length - 1);
      const ySlot = hd * 0.65 - frac * (peanaD * 0.65);
      const slotW = Math.min(peanaW * 0.72, Math.max(36, layer.bounds.width * 0.68));
      const slotH = Math.max(8, tabDepth * 0.95);
      peanaZones.push({
        polygon: [
          { x: -slotW * 0.5, y: ySlot - slotH * 0.5 },
          { x: slotW * 0.5, y: ySlot - slotH * 0.5 },
          { x: slotW * 0.5, y: ySlot + slotH * 0.5 },
          { x: -slotW * 0.5, y: ySlot + slotH * 0.5 }
        ],
        label: 'PEGAR PESTAÑA FIGURA #' + (idx + 1) + ' (' + layer.shortCode + ')',
        isTabLanding: true
      });
    });

    // Faldones de la peana y 4 pestañas de esquina
    const pCut = [];
    const pFolds = [];
    const pTabs = [];
    for (let i = 0; i < 4; i++) {
      const p1 = peanaBody[i];
      const p2 = peanaBody[(i + 1) % 4];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      const nx = dy / len;
      const ny = -dx / len;
      const w1 = { x: p1.x + nx * peanaSkirtH, y: p1.y + ny * peanaSkirtH };
      const w2 = { x: p2.x + nx * peanaSkirtH, y: p2.y + ny * peanaSkirtH };
      pFolds.push({ points: [p1, p2], type: 'mountain', label: 'Faldón peana 90°' });
      const cornerTab = createGlueTabGeometryOnSegment(w2, p2, Math.min(tabDepth, peanaSkirtH * 0.8), bevelDeg, 'ESQ.' + (i + 1), { x: dx / len, y: dy / len });
      pCut.push(p1, w1, w2);
      if (cornerTab) {
        pFolds.push({ points: [w2, p2], type: 'mountain', label: 'Doblar esquina' });
        pCut.push(cornerTab.tipP1, cornerTab.tipP2);
        pTabs.push(cornerTab);
      }
      pCut.push(p2);
    }

    pieces.push({
      pieceId: 'standee_base_peana',
      layerIndex: 0,
      isPeanaBase: true,
      title: 'Peana / Escenario Base 3D (Para Pegar las Figuras)',
      subtitle: 'Recortar, doblar los 4 faldones laterales hacia abajo y pegar en las franjas superiores cada figura a 90°',
      shortCode: 'PEANA-BASE',
      bodyPolygon: peanaBody,
      outerCutPoints: pCut,
      foldLines: pFolds,
      glueTabs: pTabs,
      wallPanels: [],
      glueTargetZones: peanaZones,
      colorObj: PAPERCRAFT_LAYER_COLORS[0],
      artworkCanvas: null,
      artworkBounds: computePolygonBounds2D(peanaBody),
      bounds: computePolygonBounds2D(pCut),
      height3DMM: peanaSkirtH
    });

    // 2. Generar cada Figura Vertical Troquelada con su Pestaña de Base a 90°
    baseLayers.forEach((layer, idx) => {
      const b = layer.bounds;
      const footW = Math.max(28, b.width * 0.68);
      const footY = b.minY;
      const halfFoot = footW * 0.5;

      // Construir silueta de la figura que apoje limpiamente sobre el segmento base [-halfFoot, footY] -> [halfFoot, footY]
      const upperArch = layer.contourPoints.filter((p) => p.y > footY + b.height * 0.12);
      const standeeBody = [
        { x: -halfFoot, y: footY },
        { x: halfFoot, y: footY }
      ].concat(upperArch.length >= 3 ? upperArch : [
        { x: b.maxX, y: b.cy },
        { x: 0, y: b.maxY },
        { x: b.minX, y: b.cy }
      ]);
      const ccwStandee = simplifyClosedLoopForScissors(computeConvexHullLoop(standeeBody), 2.5, 5, 16);

      // Encontrar la arista más baja (base inferior) para adosar la pestaña de peana a 90°
      let bottomEdgeIdx = 0;
      let lowestMidY = Infinity;
      for (let i = 0; i < ccwStandee.length; i++) {
        const p1 = ccwStandee[i];
        const p2 = ccwStandee[(i + 1) % ccwStandee.length];
        const my = (p1.y + p2.y) * 0.5;
        if (my < lowestMidY && Math.hypot(p2.x - p1.x, p2.y - p1.y) > 10) {
          lowestMidY = my;
          bottomEdgeIdx = i;
        }
      }

      const outCut = [];
      const folds = [];
      const tabs = [];

      for (let i = 0; i < ccwStandee.length; i++) {
        const p1 = ccwStandee[i];
        const p2 = ccwStandee[(i + 1) % ccwStandee.length];
        outCut.push({ x: p1.x, y: p1.y });
        if (i === bottomEdgeIdx) {
          const baseTab = createGlueTabGeometryOnSegment(
            p1,
            p2,
            Math.max(12, tabDepth * 1.35),
            bevelDeg,
            'DOBLAR 90° Y PEGAR EN PEANA (FIG. #' + (idx + 1) + ')'
          );
          if (baseTab) {
            folds.push({ points: [p1, p2], type: 'valley', label: 'Doblar 90° (Peana)' });
            outCut.push(baseTab.tipP1, baseTab.tipP2);
            tabs.push(baseTab);
          }
        }
      }

      // Si está en modo Doble Cara Plegable, añadir una pestaña superior de unión dorso-con-dorso
      if (isDoubleFold) {
        let topEdgeIdx = 0;
        let highestMidY = -Infinity;
        for (let i = 0; i < ccwStandee.length; i++) {
          if (i === bottomEdgeIdx) continue;
          const p1 = ccwStandee[i];
          const p2 = ccwStandee[(i + 1) % ccwStandee.length];
          const my = (p1.y + p2.y) * 0.5;
          if (my > highestMidY) {
            highestMidY = my;
            topEdgeIdx = i;
          }
        }
        const tp1 = ccwStandee[topEdgeIdx];
        const tp2 = ccwStandee[(topEdgeIdx + 1) % ccwStandee.length];
        const topTab = createGlueTabGeometryOnSegment(tp1, tp2, tabDepth * 0.85, bevelDeg, 'SOLAPA REFUERZO');
        if (topTab) {
          folds.push({ points: [tp1, tp2], type: 'mountain', label: 'Doblar refuerzo' });
          tabs.push(topTab);
        }
      }

      pieces.push({
        pieceId: 'standee_fig_' + (idx + 1),
        layerIndex: idx,
        isStandeeFigure: true,
        title: 'Figura Recortable #' + (idx + 1) + ' — ' + layer.title,
        subtitle: 'Recortar silueta exterior, doblar la pestaña inferior a 90° y pegar con pegamento escolar en la Peana',
        shortCode: 'FIG-' + (idx + 1),
        bodyPolygon: ccwStandee,
        outerCutPoints: outCut,
        foldLines: folds,
        glueTabs: tabs,
        wallPanels: [],
        glueTargetZones: [],
        colorObj: layer.colorObj,
        artworkCanvas: layer.artworkCanvas,
        artworkBounds: computePolygonBounds2D(ccwStandee),
        bounds: computePolygonBounds2D(outCut),
        height3DMM: b.height
      });
    });

    return pieces;
  }

  // --------------------------------------------------------------------------
  // TIPO 5: RED POLIÉDRICA 3D DESPLEGABLE (BLOQUES / PRISMAS DE 1 PIEZA)
  // --------------------------------------------------------------------------
  const prismH = Math.max(10, wallH);
  baseLayers.forEach((layer, idx) => {
    const nextLayer = idx + 1 < baseLayers.length ? baseLayers[idx + 1] : null;
    // Ajustar las dimensiones de la cruz desplegada para que quepa holgadamente en una hoja A4
    const rawW = Math.max(26, Math.min(76, layer.bounds.width * 0.58));
    const rawD = Math.max(26, Math.min(64, layer.bounds.height * 0.52));
    const hw = rawW * 0.5;
    const hd = rawD * 0.5;
    const h = Math.min(28, prismH);
    const td = Math.min(tabDepth, h * 0.45, rawW * 0.28);

    // Cara central = Tapa Superior [-hw..hw, -hd..hd]
    const topFace = [
      { x: -hw, y: -hd },
      { x: hw, y: -hd },
      { x: hw, y: hd },
      { x: -hw, y: hd }
    ];

    const folds = [
      // 4 aristas de la tapa central
      { points: [{ x: -hw, y: hd }, { x: hw, y: hd }], type: 'mountain', label: 'Doblar 90°' },
      { points: [{ x: -hw, y: -hd }, { x: hw, y: -hd }], type: 'mountain', label: 'Doblar 90°' },
      { points: [{ x: -hw, y: -hd }, { x: -hw, y: hd }], type: 'mountain', label: 'Doblar 90°' },
      { points: [{ x: hw, y: -hd }, { x: hw, y: hd }], type: 'mountain', label: 'Doblar 90°' },
      // Unión entre pared Sur y Base Inferior
      { points: [{ x: -hw, y: -hd - h }, { x: hw, y: -hd - h }], type: 'mountain', label: 'Doblar Base 90°' }
    ];

    const tabs = [];
    const addNetTab = (p1, p2, nx, ny, lbl) => {
      const gt = createGlueTabGeometryOnSegment(p1, p2, td, bevelDeg, lbl, { x: nx, y: ny });
      if (gt) {
        folds.push({ points: [p1, p2], type: 'mountain', label: 'Solapa' });
        tabs.push(gt);
      }
      return gt;
    };

    // 7 Pestañas trapezoidales clásicas del desarrollo en cruz de un prisma / cubo:
    const tNorth = addNetTab({ x: hw, y: hd + h }, { x: -hw, y: hd + h }, 0, 1, 'PEGAR BASE (1)');
    const tWestTop = addNetTab({ x: -hw, y: hd }, { x: -hw - h, y: hd }, 0, 1, 'P2');
    const tWestMid = addNetTab({ x: -hw - h, y: hd }, { x: -hw - h, y: -hd }, -1, 0, 'PEGAR BASE (3)');
    const tWestBot = addNetTab({ x: -hw - h, y: -hd }, { x: -hw, y: -hd }, 0, -1, 'P4');
    const tEastTop = addNetTab({ x: hw + h, y: hd }, { x: hw, y: hd }, 0, 1, 'P5');
    const tEastMid = addNetTab({ x: hw + h, y: -hd }, { x: hw + h, y: hd }, 1, 0, 'PEGAR BASE (6)');
    const tEastBot = addNetTab({ x: hw, y: -hd }, { x: hw + h, y: -hd }, 0, -1, 'P7');

    // Recorrido continuo CCW del contorno de corte exterior de la cruz + sus 7 pestañas
    const netCut = [];
    const pushTabOrEdge = (pA, pB, tabObj) => {
      netCut.push(pA);
      if (tabObj) {
        netCut.push(tabObj.tipP1, tabObj.tipP2);
      }
      netCut.push(pB);
    };

    // Empezamos en esquina inferior izquierda de la Base Inferior (-hw, -hd - h - rawD)
    const yBaseBot = -hd - h - rawD;
    netCut.push({ x: -hw, y: yBaseBot }, { x: hw, y: yBaseBot }, { x: hw, y: -hd - h }, { x: hw, y: -hd });
    // Brazo Este (derecho)
    pushTabOrEdge({ x: hw, y: -hd }, { x: hw + h, y: -hd }, tEastBot);
    pushTabOrEdge({ x: hw + h, y: -hd }, { x: hw + h, y: hd }, tEastMid);
    pushTabOrEdge({ x: hw + h, y: hd }, { x: hw, y: hd }, tEastTop);
    // Brazo Norte (superior)
    netCut.push({ x: hw, y: hd + h });
    pushTabOrEdge({ x: hw, y: hd + h }, { x: -hw, y: hd + h }, tNorth);
    netCut.push({ x: -hw, y: hd });
    // Brazo Oeste (izquierdo)
    pushTabOrEdge({ x: -hw, y: hd }, { x: -hw - h, y: hd }, tWestTop);
    pushTabOrEdge({ x: -hw - h, y: hd }, { x: -hw - h, y: -hd }, tWestMid);
    pushTabOrEdge({ x: -hw - h, y: -hd }, { x: -hw, y: -hd }, tWestBot);
    // Regreso por el lateral izquierdo de la pared Sur y la Base Inferior
    netCut.push({ x: -hw, y: -hd - h }, { x: -hw, y: yBaseBot });

    const glueTargetZones = [];
    if (nextLayer) {
      const nw = Math.max(16, Math.min(rawW * 0.85, nextLayer.bounds.width * 0.52));
      const nd = Math.max(16, Math.min(rawD * 0.85, nextLayer.bounds.height * 0.48));
      glueTargetZones.push({
        polygon: [
          { x: -nw * 0.5, y: -nd * 0.5 },
          { x: nw * 0.5, y: -nd * 0.5 },
          { x: nw * 0.5, y: nd * 0.5 },
          { x: -nw * 0.5, y: nd * 0.5 }
        ],
        label: 'PEGAR BLOQUE #' + (idx + 2)
      });
    }

    pieces.push({
      pieceId: 'prism_net_' + (idx + 1),
      layerIndex: idx,
      isPrismNet: true,
      title: 'Red Desplegable 3D — Bloque #' + (idx + 1) + ' (' + rawW.toFixed(0) + '×' + rawD.toFixed(0) + '×' + h.toFixed(0) + ' mm)',
      subtitle: 'Recortar la cruz por la línea continua exterior, doblar las aristas a 90° y cerrar las 7 pestañas con pegamento escolar',
      shortCode: 'RED-B' + (idx + 1),
      bodyPolygon: topFace,
      outerCutPoints: netCut,
      foldLines: folds,
      glueTabs: tabs,
      wallPanels: [],
      glueTargetZones,
      colorObj: layer.colorObj,
      artworkCanvas: layer.artworkCanvas,
      artworkBounds: computePolygonBounds2D(topFace),
      bounds: computePolygonBounds2D(netCut),
      height3DMM: h
    });
  });

  return pieces;
}

// ============================================================================
// MAQUETADOR AUTOMÁTICO EN HOJAS DIN A4 / DIN A3 PARA IMPRIMIR Y RECORTAR
// ============================================================================
function getPapercraftSheetDimensionsMM() {
  const fmt = papercraftState.sheetFormat || 'A4_portrait';
  if (fmt === 'A4_landscape') return { widthMM: 297, heightMM: 210, label: 'DIN A4 Horizontal (297 × 210 mm)' };
  if (fmt === 'A3_landscape') return { widthMM: 420, heightMM: 297, label: 'DIN A3 Horizontal (420 × 297 mm)' };
  return { widthMM: 210, heightMM: 297, label: 'DIN A4 Vertical (210 × 297 mm)' };
}

function packPapercraftPiecesIntoSheets(pieces) {
  const sheetSpec = getPapercraftSheetDimensionsMM();
  const sheetW = sheetSpec.widthMM;
  const sheetH = sheetSpec.heightMM;
  const margin = 10;
  const headerH = papercraftState.includeSchoolHeader ? 24 : 10;
  const usableW = sheetW - margin * 2;
  const usableH = sheetH - margin * 2 - headerH;
  const gapMM = 7;

  const sheets = [];
  let currentSheet = {
    sheetIndex: 0,
    widthMM: sheetW,
    heightMM: sheetH,
    formatLabel: sheetSpec.label,
    marginMM: margin,
    headerHMM: headerH,
    placements: []
  };
  sheets.push(currentSheet);

  let cursorX = margin;
  let cursorY = margin + headerH;
  let rowMaxH = 0;

  pieces.forEach((piece) => {
    const b = piece.bounds;
    let pw = b.width;
    let ph = b.height;
    let scaleFit = 1.0;

    // Si una pieza desplegada con sus faldones supera el área útil de la hoja A4, auto-escalar con aviso limpio
    if (pw > usableW - 4 || ph > usableH - 10) {
      scaleFit = Math.min((usableW - 6) / Math.max(1, pw), (usableH - 12) / Math.max(1, ph));
      pw *= scaleFit;
      ph *= scaleFit;
    }

    const slotW = pw + gapMM;
    const slotH = ph + 9; // +9 mm para el título de la pieza encima

    if (cursorX + pw > sheetW - margin && currentSheet.placements.length > 0) {
      // Saltar a la siguiente fila dentro de la misma hoja
      cursorX = margin;
      cursorY += rowMaxH + gapMM;
      rowMaxH = 0;
    }

    if (cursorY + slotH > sheetH - margin && currentSheet.placements.length > 0) {
      // Crear nueva hoja DIN A4
      currentSheet = {
        sheetIndex: sheets.length,
        widthMM: sheetW,
        heightMM: sheetH,
        formatLabel: sheetSpec.label,
        marginMM: margin,
        headerHMM: headerH,
        placements: []
      };
      sheets.push(currentSheet);
      cursorX = margin;
      cursorY = margin + headerH;
      rowMaxH = 0;
    }

    const centerSheetX = cursorX + pw * 0.5;
    const centerSheetY = cursorY + 7 + ph * 0.5;

    currentSheet.placements.push({
      piece,
      scaleFit,
      boxX: cursorX,
      boxY: cursorY,
      boxW: pw,
      boxH: ph,
      // Transforma una coordenada local (x, y con Y hacia arriba) a coordenada de hoja A4 (x hacia la derecha, y hacia abajo desde el borde superior)
      toSheetX: (lx) => centerSheetX + (lx - b.cx) * scaleFit,
      toSheetY: (ly) => centerSheetY - (ly - b.cy) * scaleFit
    });

    cursorX += slotW;
    if (slotH > rowMaxH) rowMaxH = slotH;
  });

  return sheets;
}

// ============================================================================
// RENDERIZADO 2D DE LA HOJA IMPRIMIBLE DIN A4 CON TIJERAS Y PESTAÑAS
// ============================================================================
function drawPapercraftSheetToContext(ctx, sheet, pxPerMM, offsetX = 0, offsetY = 0) {
  const sw = sheet.widthMM * pxPerMM;
  const sh = sheet.heightMM * pxPerMM;
  const m = sheet.marginMM * pxPerMM;

  ctx.save();
  ctx.translate(offsetX, offsetY);

  // Hoja blanca de papel / cartulina escolar con sombra suave
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sw, sh);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = Math.max(1, 0.35 * pxPerMM);
  ctx.strokeRect(0, 0, sw, sh);

  // Margen seguro de impresión punteado muy tenue
  ctx.save();
  ctx.strokeStyle = '#cbd5e1';
  ctx.setLineDash([3 * pxPerMM * 0.3, 3 * pxPerMM * 0.3]);
  ctx.lineWidth = Math.max(0.8, 0.2 * pxPerMM);
  ctx.strokeRect(m, m, sw - m * 2, sh - m * 2);
  ctx.restore();

  // Cajetín escolar superior
  if (papercraftState.includeSchoolHeader) {
    const hBoxH = (sheet.headerHMM - 3) * pxPerMM;
    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(1, 0.35 * pxPerMM);
    ctx.fillRect(m, m, sw - m * 2, hBoxH);
    ctx.strokeRect(m, m, sw - m * 2, hBoxH);

    const titleFont = Math.max(9, 3.6 * pxPerMM);
    const subFont = Math.max(7.5, 2.55 * pxPerMM);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold ' + titleFont.toFixed(1) + 'px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const typeNames = {
      stacked_platforms: 'Plataformas 3D para Apilar',
      layered_tabs: 'Recortable en Capas Superpuestas',
      accordion_spacers: 'Recortable en Capas con Separadores Z',
      standee_peana: 'Figuras Troqueladas con Peana 3D',
      prism_net: 'Red Poliédrica 3D Desplegable'
    };
    const typeLabel = typeNames[papercraftState.cutoutType] || 'Recortable Escolar';
    ctx.fillText(
      '✂️ RECORTABLE ESCOLAR: ' + typeLabel.toUpperCase() + '  (Hoja ' + (sheet.sheetIndex + 1) + ' de ' + Math.max(1, papercraftState.packedSheets.length) + ')',
      m + 3 * pxPerMM,
      m + 2.2 * pxPerMM
    );

    ctx.fillStyle = '#334155';
    ctx.font = subFont.toFixed(1) + 'px sans-serif';
    ctx.fillText(
      'Alumno/a: ____________________________________   Curso/Grupo: __________   Fecha: ___________',
      m + 3 * pxPerMM,
      m + 8.0 * pxPerMM
    );

    // Leyenda visual de símbolos de recortable
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold ' + subFont.toFixed(1) + 'px sans-serif';
    ctx.fillText(
      'LEYENDA:   ━━✂━━ Cortar con tijeras     — — — Doblar hacia abajo (Montaña)     — · — Doblar solapa (Valle)     🧴 Aplicar pegamento escolar',
      m + 3 * pxPerMM,
      m + 14.2 * pxPerMM
    );
    ctx.restore();
  }

  // Dibujar cada pieza empaquetada en la hoja
  sheet.placements.forEach((pl) => {
    const piece = pl.piece;
    const toX = (lx) => pl.toSheetX(lx) * pxPerMM;
    const toY = (ly) => pl.toSheetY(ly) * pxPerMM;

    // 0. Título identificativo encima de la pieza
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold ' + Math.max(8, 2.8 * pxPerMM).toFixed(1) + 'px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(
      '[' + piece.shortCode + '] ' + piece.title,
      pl.boxX * pxPerMM,
      pl.boxY * pxPerMM
    );
    ctx.restore();

    // 1. Sombreado y tramado de las Pestañas de Pegamento Escolar (glueTabs)
    (piece.glueTabs || []).forEach((gt) => {
      if (!gt.polygon || gt.polygon.length < 3) return;
      ctx.save();
      ctx.beginPath();
      gt.polygon.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(toX(pt.x), toY(pt.y));
        else ctx.lineTo(toX(pt.x), toY(pt.y));
      });
      ctx.closePath();
      ctx.fillStyle = '#f1f5f9';
      ctx.fill();

      // Rayado diagonal clásico de pestaña de pegamento escolar
      ctx.clip();
      const gb = computePolygonBounds2D(gt.polygon);
      const x0 = toX(gb.minX) - 20;
      const x1 = toX(gb.maxX) + 20;
      const y0 = toY(gb.maxY) - 20;
      const y1 = toY(gb.minY) + 20;
      const stepHatch = Math.max(3.5, 2.2 * pxPerMM);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(0.7, 0.2 * pxPerMM);
      ctx.beginPath();
      for (let hx = x0 - (y1 - y0); hx <= x1 + (y1 - y0); hx += stepHatch) {
        ctx.moveTo(hx, y0);
        ctx.lineTo(hx + (y1 - y0), y1);
      }
      ctx.stroke();

      // Texto '🧴 PEGAR' orientado a lo largo de la pestaña
      if (papercraftState.showGlueLabels && gt.label) {
        const cx = toX(gt.center.x);
        const cy = toY(gt.center.y);
        let ang = -gt.angleRad;
        if (ang > Math.PI * 0.5) ang -= Math.PI;
        if (ang < -Math.PI * 0.5) ang += Math.PI;
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.fillStyle = '#334155';
        const fSz = Math.max(6.5, Math.min(2.3 * pxPerMM, gt.depthMM * pl.scaleFit * pxPerMM * 0.42));
        ctx.font = 'bold ' + fSz.toFixed(1) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🧴 ' + gt.label, 0, 0);
      }
      ctx.restore();
    });

    // 2. Sombreado suave de paneles laterales / faldones (wallPanels)
    (piece.wallPanels || []).forEach((wp) => {
      if (!wp.polygon || wp.polygon.length < 3) return;
      ctx.save();
      ctx.beginPath();
      wp.polygon.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(toX(pt.x), toY(pt.y));
        else ctx.lineTo(toX(pt.x), toY(pt.y));
      });
      ctx.closePath();
      ctx.fillStyle = papercraftState.printStyle === 'color' && piece.colorObj
        ? piece.colorObj.light
        : '#f8fafc';
      ctx.fill();
      ctx.restore();
    });

    // 3. Cuerpo principal de la pieza + Ilustración recortada en su interior
    if (piece.bodyPolygon && piece.bodyPolygon.length >= 3) {
      ctx.save();
      ctx.beginPath();
      piece.bodyPolygon.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(toX(pt.x), toY(pt.y));
        else ctx.lineTo(toX(pt.x), toY(pt.y));
      });
      ctx.closePath();

      if (papercraftState.printStyle === 'color') {
        ctx.fillStyle = piece.colorObj ? piece.colorObj.light : '#e0f2fe';
        ctx.fill();
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      if (piece.artworkCanvas && papercraftState.printStyle !== 'blueprint') {
        ctx.clip();
        const ab = piece.artworkBounds || computePolygonBounds2D(piece.bodyPolygon);
        const ax = toX(ab.minX);
        const ay = toY(ab.maxY);
        const aw = ab.width * pl.scaleFit * pxPerMM;
        const ah = ab.height * pl.scaleFit * pxPerMM;
        ctx.globalAlpha = papercraftState.printStyle === 'coloring' ? 0.92 : 0.88;
        ctx.drawImage(piece.artworkCanvas, ax, ay, aw, ah);
        ctx.globalAlpha = 1.0;
      }
      ctx.restore();
    }

    // 4. Zonas Guía de Pegado donde va pegada la siguiente capa o pestaña (glueTargetZones)
    (piece.glueTargetZones || []).forEach((gz) => {
      if (!gz.polygon || gz.polygon.length < 3) return;
      ctx.save();
      ctx.beginPath();
      gz.polygon.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(toX(pt.x), toY(pt.y));
        else ctx.lineTo(toX(pt.x), toY(pt.y));
      });
      ctx.closePath();
      ctx.fillStyle = gz.isTabLanding ? 'rgba(251, 191, 36, 0.25)' : 'rgba(16, 185, 129, 0.12)';
      ctx.fill();
      ctx.strokeStyle = gz.isTabLanding ? '#d97706' : '#059669';
      ctx.lineWidth = Math.max(1.0, 0.32 * pxPerMM);
      ctx.setLineDash([2.2 * pxPerMM * 0.4, 1.8 * pxPerMM * 0.4]);
      ctx.stroke();

      if (papercraftState.showGlueLabels && gz.label) {
        const zb = computePolygonBounds2D(gz.polygon);
        ctx.setLineDash([]);
        ctx.fillStyle = gz.isTabLanding ? '#92400e' : '#065f46';
        const fSz = Math.max(6.5, Math.min(2.4 * pxPerMM, zb.width * pl.scaleFit * pxPerMM * 0.11));
        ctx.font = 'bold ' + fSz.toFixed(1) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🧴 ' + gz.label, toX(zb.cx), toY(zb.cy));
      }
      ctx.restore();
    });

    // 5. Líneas de Pliegue / Doblez (Montaña = guiones azules, Valle = raya-punto violeta)
    if (papercraftState.showFoldArrows && piece.foldLines && piece.foldLines.length > 0) {
      piece.foldLines.forEach((fl) => {
        if (!fl.points || fl.points.length < 2) return;
        ctx.save();
        const isValley = fl.type === 'valley';
        ctx.strokeStyle = isValley ? '#7c3aed' : '#0284c7';
        ctx.lineWidth = Math.max(1.1, 0.36 * pxPerMM);
        ctx.setLineDash(
          isValley
            ? [3.2 * pxPerMM * 0.4, 1.4 * pxPerMM * 0.4, 0.9 * pxPerMM * 0.4, 1.4 * pxPerMM * 0.4]
            : [3.2 * pxPerMM * 0.4, 2.0 * pxPerMM * 0.4]
        );
        ctx.beginPath();
        fl.points.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(toX(pt.x), toY(pt.y));
          else ctx.lineTo(toX(pt.x), toY(pt.y));
        });
        ctx.stroke();
        ctx.restore();
      });
    }

    // 6. Contorno Exterior de Corte con Tijeras (Línea continua gruesa + Iconos ✂)
    if (piece.outerCutPoints && piece.outerCutPoints.length >= 3) {
      ctx.save();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(1.6, 0.52 * pxPerMM);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      piece.outerCutPoints.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(toX(pt.x), toY(pt.y));
        else ctx.lineTo(toX(pt.x), toY(pt.y));
      });
      ctx.closePath();
      ctx.stroke();

      // Iconos de tijeras ✂ a lo largo del contorno exterior
      if (papercraftState.showScissorsIcons) {
        const pts = piece.outerCutPoints;
        const stepIdx = Math.max(1, Math.floor(pts.length / 3));
        ctx.fillStyle = '#e11d48';
        ctx.font = 'bold ' + Math.max(9, 3.3 * pxPerMM).toFixed(1) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let k = 0; k < pts.length; k += stepIdx) {
          const pA = pts[k];
          const pB = pts[(k + 1) % pts.length];
          if (Math.hypot(pB.x - pA.x, pB.y - pA.y) < 8) continue;
          const mx = toX((pA.x + pB.x) * 0.5);
          const my = toY((pA.y + pB.y) * 0.5);
          ctx.fillText('✂', mx, my);
        }
      }
      ctx.restore();
    }
  });

  ctx.restore();
}

// ============================================================================
// PREVISUALIZACIÓN 3D INTERACTIVA DEL RECORTABLE MONTADO Y PLEGADO EN VIVO
// ============================================================================
function renderPapercraft3DPreviewOnCanvas(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Fondo degradado oscuro del estudio 3D
  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bgGrad.addColorStop(0, '#090d16');
  bgGrad.addColorStop(1, '#111827');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const baseLayers = extractPapercraftSourceLayers();
  if (!baseLayers || baseLayers.length === 0) return;

  const yaw = papercraftState.view3D.yaw;
  const pitch = papercraftState.view3D.pitch;
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch), sinP = Math.sin(pitch);

  const wMM = Math.max(40, Number(papercraftState.widthMM) || 130);
  const hMM = Math.max(40, Number(papercraftState.heightMM) || 130);
  const wallH = Math.max(6, Number(papercraftState.wallHeightMM) || 14);
  const tabDepth = Math.max(5, Number(papercraftState.tabDepthMM) || 10);
  const foldFrac = Math.max(0, Math.min(1, (Number(papercraftState.foldProgressPct) || 85) / 100));
  const explodeFrac = Math.max(0, Math.min(1, (Number(papercraftState.explodeLayersPct) || 25) / 100));

  const maxSpan = Math.max(wMM, hMM, baseLayers.length * wallH * 1.6) * 1.45;
  const baseScale = (Math.min(canvas.width, canvas.height) / maxSpan) * papercraftState.view3D.zoom;
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.56;

  const project3D = (x, y, z) => {
    const rx = x * cosY - y * sinY;
    const ry = x * sinY + y * cosY;
    const sy = ry * cosP - z * sinP;
    const sz = ry * sinP + z * cosP;
    return {
      x: cx + rx * baseScale,
      y: cy - sz * baseScale,
      depth: sy
    };
  };

  // Rejilla de apoyo escolar en Z = 0
  ctx.save();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
  ctx.lineWidth = 1;
  const gridHalf = Math.round(Math.max(wMM, hMM) * 0.75);
  const gridStep = 20;
  for (let g = -gridHalf; g <= gridHalf; g += gridStep) {
    const p1 = project3D(g, -gridHalf, 0);
    const p2 = project3D(g, gridHalf, 0);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    const q1 = project3D(-gridHalf, g, 0);
    const q2 = project3D(gridHalf, g, 0);
    ctx.beginPath();
    ctx.moveTo(q1.x, q1.y);
    ctx.lineTo(q2.x, q2.y);
    ctx.stroke();
  }
  ctx.restore();

  const type = papercraftState.cutoutType;
  const foldAngle = foldFrac * (Math.PI * 0.5); // 0 rad (plano) -> 90° (vertical)

  if (type === 'standee_peana') {
    // Dibujar Peana Base en Z = 0..peanaH y las Figuras levantándose hasta 90° según foldFrac
    const peanaW = wMM;
    const peanaD = Math.max(70, baseLayers.length * 22 + 24);
    const hw = peanaW * 0.5;
    const hd = peanaD * 0.5;
    const peanaZ = 10 * Math.sin(foldAngle);

    const pCorners = [
      project3D(-hw, -hd, peanaZ),
      project3D(hw, -hd, peanaZ),
      project3D(hw, hd, peanaZ),
      project3D(-hw, hd, peanaZ)
    ];
    ctx.save();
    ctx.beginPath();
    pCorners.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
    ctx.closePath();
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Dibujar cada figura desde atrás hacia delante
    for (let idx = 0; idx < baseLayers.length; idx++) {
      const layer = baseLayers[idx];
      const frac = baseLayers.length === 1 ? 0.5 : idx / (baseLayers.length - 1);
      const yPos = hd * 0.65 - frac * (peanaD * 0.65) - (idx - baseLayers.length * 0.5) * explodeFrac * 18;
      const b = layer.bounds;

      // Pestaña de pegado horizontal sobre la peana
      const footHalfW = Math.max(18, b.width * 0.34);
      const tabPts3D = [
        project3D(-footHalfW, yPos, peanaZ + 0.5),
        project3D(footHalfW, yPos, peanaZ + 0.5),
        project3D(footHalfW * 0.82, yPos - tabDepth, peanaZ + 0.5),
        project3D(-footHalfW * 0.82, yPos - tabDepth, peanaZ + 0.5)
      ];
      ctx.save();
      ctx.beginPath();
      tabPts3D.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.closePath();
      ctx.fillStyle = 'rgba(251, 191, 36, 0.65)';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.4;
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Silueta de la figura abatiéndose desde el plano horizontal hasta 90° vertical
      const figProj = layer.contourPoints.map((pt) => {
        const localH = Math.max(0, pt.y - b.minY);
        const y3d = yPos + localH * Math.cos(foldAngle);
        const z3d = peanaZ + localH * Math.sin(foldAngle);
        return project3D(pt.x, y3d, z3d);
      });

      ctx.save();
      ctx.beginPath();
      figProj.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.closePath();
      ctx.fillStyle = layer.colorObj ? layer.colorObj.fill + 'cc' : 'rgba(56, 189, 248, 0.8)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  } else {
    // Plataformas Apilables / Capas Superpuestas / Separadores Z / Redes 3D
    const gapExplode = explodeFrac * 26;
    const effLayerH = wallH * Math.sin(foldAngle);

    baseLayers.forEach((layer, idx) => {
      const zTop = (idx + 1) * effLayerH + idx * gapExplode;
      const zBot = idx * effLayerH + idx * gapExplode;
      const pts = ensureCounterClockwiseLoop(layer.contourPoints);
      const n = pts.length;

      // 1. Paredes laterales y pestañas de pegamento doblándose según foldAngle
      const wallFaces = [];
      for (let i = 0; i < n; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len < 3) continue;
        const nx = dy / len;
        const ny = -dx / len;

        // Cuando foldAngle = 0 (plano), la pared se extiende horizontalmente hacia afuera (+nx*wallH).
        // Cuando foldAngle = 90°, la pared baja verticalmente hasta zBot.
        const outDist = wallH * Math.cos(foldAngle);
        const w1 = { x: p1.x + nx * outDist, y: p1.y + ny * outDist, z: zBot };
        const w2 = { x: p2.x + nx * outDist, y: p2.y + ny * outDist, z: zBot };

        // Pestaña de pegamento en el extremo inferior de la pared
        const tabOut = tabDepth * 0.85;
        const t1 = { x: w1.x + nx * tabOut, y: w1.y + ny * tabOut, z: zBot };
        const t2 = { x: w2.x + nx * tabOut, y: w2.y + ny * tabOut, z: zBot };

        const midDepth = project3D((p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5, (zTop + zBot) * 0.5).depth;
        wallFaces.push({
          p1, p2, w1, w2, t1, t2, midDepth
        });
      }

      // Ordenar paredes de atrás hacia delante (algoritmo del pintor)
      wallFaces.sort((a, b) => b.midDepth - a.midDepth);

      wallFaces.forEach((wf) => {
        // Dibujar pestaña de pegamento inferior en ámbar
        const tabProj = [
          project3D(wf.w1.x, wf.w1.y, wf.w1.z),
          project3D(wf.t1.x, wf.t1.y, wf.t1.z),
          project3D(wf.t2.x, wf.t2.y, wf.t2.z),
          project3D(wf.w2.x, wf.w2.y, wf.w2.z)
        ];
        ctx.save();
        ctx.beginPath();
        tabProj.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        ctx.closePath();
        ctx.fillStyle = 'rgba(251, 191, 36, 0.55)';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Dibujar pared / faldón lateral
        const wallProj = [
          project3D(wf.p1.x, wf.p1.y, zTop),
          project3D(wf.w1.x, wf.w1.y, wf.w1.z),
          project3D(wf.w2.x, wf.w2.y, wf.w2.z),
          project3D(wf.p2.x, wf.p2.y, zTop)
        ];
        ctx.save();
        ctx.beginPath();
        wallProj.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        ctx.closePath();
        ctx.fillStyle = layer.colorObj ? layer.colorObj.stroke + 'b8' : 'rgba(2, 132, 199, 0.72)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 1.2;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });

      // 2. Cara superior de la plataforma / capa en zTop
      const topProj = pts.map((pt) => project3D(pt.x, pt.y, zTop));
      ctx.save();
      ctx.beginPath();
      topProj.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.closePath();
      ctx.fillStyle = layer.colorObj ? layer.colorObj.fill + 'd8' : 'rgba(56, 189, 248, 0.85)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.0;
      ctx.fill();
      ctx.stroke();

      // Etiqueta de la capa en el centro
      const cProj = project3D(layer.bounds.cx, layer.bounds.cy, zTop);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('#' + (idx + 1) + ' (' + layer.shortCode + ')', cProj.x, cProj.y);
      ctx.restore();
    });
  }

  // Leyenda sobreimpresa en el visor 3D del recortable
  ctx.save();
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(
    '🧊 Simulación 3D del Recortable Montado · Plegado: ' + Math.round(foldFrac * 100) + '% · Separación capas: ' + Math.round(explodeFrac * 100) + '% (Arrastra con el ratón para rotar)',
    14,
    22
  );
  ctx.restore();
}

// Renderizador principal del lienzo del modal de Recortables
function renderPapercraftPreviewCanvas() {
  const canvas = document.getElementById('papercraftPreviewCanvas');
  if (!canvas) return;
  const rect = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : { width: 640, height: 500 };
  canvas.width = Math.max(320, rect.width || 640);
  canvas.height = Math.max(280, rect.height || 500);

  if (papercraftState.previewMode === 'assembled3d') {
    renderPapercraft3DPreviewOnCanvas(canvas);
    return;
  }

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Fondo mesa de trabajo escolar
  ctx.fillStyle = '#0b1120';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sheets = papercraftState.packedSheets || [];
  if (sheets.length === 0) return;

  const sIdx = Math.max(0, Math.min(sheets.length - 1, papercraftState.activeSheetIndex || 0));
  const sheet = sheets[sIdx];

  const pad = 24;
  const basePxPerMM = Math.min(
    (canvas.width - pad * 2) / sheet.widthMM,
    (canvas.height - pad * 2) / sheet.heightMM
  );
  const pxPerMM = basePxPerMM * papercraftState.view2D.zoom;
  const drawW = sheet.widthMM * pxPerMM;
  const drawH = sheet.heightMM * pxPerMM;
  const offX = (canvas.width - drawW) * 0.5 + papercraftState.view2D.panX;
  const offY = (canvas.height - drawH) * 0.5 + papercraftState.view2D.panY;

  drawPapercraftSheetToContext(ctx, sheet, pxPerMM, offX, offY);
}

// ============================================================================
// GENERACIÓN DE SVG ESCALA 1:1 EN MILÍMETROS E IMPRESIÓN / PDF DIN A4
// ============================================================================
function generatePapercraftSheetSVG(sheet) {
  const sw = sheet.widthMM;
  const sh = sheet.heightMM;
  const m = sheet.marginMM;
  const escapeXml = typeof escapeXmlAttr === 'function'
    ? escapeXmlAttr
    : (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const xmlHeader = '<' + '?xml version="1.0" encoding="UTF-8" standalone="no"?' + '>';
  const lines = [
    xmlHeader,
    '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="' + sw.toFixed(2) + 'mm" height="' + sh.toFixed(2) + 'mm" viewBox="0 0 ' + sw.toFixed(3) + ' ' + sh.toFixed(3) + '" style="background:#ffffff;">',
    '  <title>' + escapeXml('Recortable Escolar Hoja ' + (sheet.sheetIndex + 1) + ' - LayerStudio 3D') + '</title>',
    '  <defs>',
    '    <pattern id="glueHatchPattern" width="3" height="3" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">',
    '      <rect width="3" height="3" fill="#f1f5f9" />',
    '      <line x1="0" y1="0" x2="0" y2="3" stroke="#cbd5e1" stroke-width="0.8" />',
    '    </pattern>',
    '  </defs>',
    '  <rect x="0" y="0" width="' + sw.toFixed(3) + '" height="' + sh.toFixed(3) + '" fill="#ffffff" />'
  ];

  if (papercraftState.includeSchoolHeader) {
    const hBoxH = sheet.headerHMM - 3;
    lines.push('  <g id="CAJETIN_ESCOLAR">');
    lines.push('    <rect x="' + m + '" y="' + m + '" width="' + (sw - m * 2).toFixed(2) + '" height="' + hBoxH.toFixed(2) + '" fill="#f8fafc" stroke="#334155" stroke-width="0.35" />');
    lines.push('    <text x="' + (m + 3) + '" y="' + (m + 5.2) + '" font-family="sans-serif" font-size="3.6" font-weight="bold" fill="#0f172a">✂️ RECORTABLE ESCOLAR — HOJA ' + (sheet.sheetIndex + 1) + ' DE ' + Math.max(1, papercraftState.packedSheets.length) + '</text>');
    lines.push('    <text x="' + (m + 3) + '" y="' + (m + 10.5) + '" font-family="sans-serif" font-size="2.6" fill="#334155">Alumno/a: _____________________________________   Curso/Grupo: ___________   Fecha: ___________</text>');
    lines.push('    <text x="' + (m + 3) + '" y="' + (m + 16.2) + '" font-family="sans-serif" font-size="2.5" font-weight="bold" fill="#0f172a">LEYENDA:  ━━✂━━ Cortar con tijeras    — — — Doblar hacia abajo (Montaña)    — · — Doblar solapa (Valle)    🧴 Aplicar pegamento escolar</text>');
    lines.push('  </g>');
  }

  sheet.placements.forEach((pl, pIdx) => {
    const piece = pl.piece;
    const toX = (lx) => pl.toSheetX(lx).toFixed(3);
    const toY = (ly) => pl.toSheetY(ly).toFixed(3);
    const clipId = 'clip_piece_' + (sheet.sheetIndex + 1) + '_' + (pIdx + 1);

    lines.push('  <g id="PIEZA_' + escapeXml(piece.shortCode) + '">');
    lines.push('    <text x="' + pl.boxX.toFixed(2) + '" y="' + (pl.boxY + 4.2).toFixed(2) + '" font-family="sans-serif" font-size="2.9" font-weight="bold" fill="#0f172a">[' + escapeXml(piece.shortCode) + '] ' + escapeXml(piece.title) + '</text>');

    // 1. Pestañas de pegamento escolar
    if (piece.glueTabs && piece.glueTabs.length > 0) {
      lines.push('    <g id="PESTANAS_PEGAMENTO_' + (pIdx + 1) + '">');
      piece.glueTabs.forEach((gt) => {
        if (!gt.polygon || gt.polygon.length < 3) return;
        const dTab = 'M ' + gt.polygon.map((p) => toX(p.x) + ' ' + toY(p.y)).join(' L ') + ' Z';
        lines.push('      <path d="' + dTab + '" fill="url(#glueHatchPattern)" stroke="#94a3b8" stroke-width="0.2" />');
        if (papercraftState.showGlueLabels && gt.label) {
          const cx = pl.toSheetX(gt.center.x).toFixed(3);
          const cy = pl.toSheetY(gt.center.y).toFixed(3);
          let deg = (-gt.angleRad * 180) / Math.PI;
          if (deg > 90) deg -= 180;
          if (deg < -90) deg += 180;
          lines.push('      <text x="' + cx + '" y="' + cy + '" transform="rotate(' + deg.toFixed(1) + ' ' + cx + ' ' + cy + ')" font-family="sans-serif" font-size="2.1" font-weight="bold" fill="#334155" text-anchor="middle" dominant-baseline="central">🧴 ' + escapeXml(gt.label) + '</text>');
        }
      });
      lines.push('    </g>');
    }

    // 2. Cuerpo e ilustración recortada
    if (piece.bodyPolygon && piece.bodyPolygon.length >= 3) {
      const dBody = 'M ' + piece.bodyPolygon.map((p) => toX(p.x) + ' ' + toY(p.y)).join(' L ') + ' Z';
      const fillBody = papercraftState.printStyle === 'color' && piece.colorObj ? piece.colorObj.light : '#ffffff';
      lines.push('    <path d="' + dBody + '" fill="' + fillBody + '" stroke="none" />');

      if (piece.artworkCanvas && papercraftState.printStyle !== 'blueprint') {
        const ab = piece.artworkBounds || computePolygonBounds2D(piece.bodyPolygon);
        const ax = pl.toSheetX(ab.minX).toFixed(3);
        const ay = pl.toSheetY(ab.maxY).toFixed(3);
        const aw = (ab.width * pl.scaleFit).toFixed(3);
        const ah = (ab.height * pl.scaleFit).toFixed(3);
        const dataUrl = piece.artworkCanvas.toDataURL('image/png');
        lines.push('    <clipPath id="' + clipId + '"><path d="' + dBody + '" /></clipPath>');
        lines.push('    <image x="' + ax + '" y="' + ay + '" width="' + aw + '" height="' + ah + '" href="' + dataUrl + '" clip-path="url(#' + clipId + ')" opacity="0.9" />');
      }
    }

    // 3. Zonas guía de recepción de pegamento
    if (piece.glueTargetZones && piece.glueTargetZones.length > 0) {
      lines.push('    <g id="ZONAS_PEGADO_' + (pIdx + 1) + '">');
      piece.glueTargetZones.forEach((gz) => {
        if (!gz.polygon || gz.polygon.length < 3) return;
        const dZone = 'M ' + gz.polygon.map((p) => toX(p.x) + ' ' + toY(p.y)).join(' L ') + ' Z';
        const strokeCol = gz.isTabLanding ? '#d97706' : '#059669';
        const fillCol = gz.isTabLanding ? '#fef3c7' : '#d1fae5';
        lines.push('      <path d="' + dZone + '" fill="' + fillCol + '" fill-opacity="0.45" stroke="' + strokeCol + '" stroke-width="0.32" stroke-dasharray="1.8,1.4" />');
        if (papercraftState.showGlueLabels && gz.label) {
          const zb = computePolygonBounds2D(gz.polygon);
          lines.push('      <text x="' + toX(zb.cx) + '" y="' + toY(zb.cy) + '" font-family="sans-serif" font-size="2.2" font-weight="bold" fill="' + strokeCol + '" text-anchor="middle" dominant-baseline="central">🧴 ' + escapeXml(gz.label) + '</text>');
        }
      });
      lines.push('    </g>');
    }

    // 4. Líneas de pliegue / doblez
    if (papercraftState.showFoldArrows && piece.foldLines && piece.foldLines.length > 0) {
      lines.push('    <g id="LINEAS_DOBLEZ_' + (pIdx + 1) + '" fill="none">');
      piece.foldLines.forEach((fl) => {
        if (!fl.points || fl.points.length < 2) return;
        const isValley = fl.type === 'valley';
        const dFold = 'M ' + fl.points.map((p) => toX(p.x) + ' ' + toY(p.y)).join(' L ');
        lines.push('      <path d="' + dFold + '" stroke="' + (isValley ? '#7c3aed' : '#0284c7') + '" stroke-width="0.35" stroke-dasharray="' + (isValley ? '2.4,1.1,0.7,1.1' : '2.4,1.6') + '" />');
      });
      lines.push('    </g>');
    }

    // 5. Línea exterior de corte con tijeras (#0f172a) + símbolos ✂
    if (piece.outerCutPoints && piece.outerCutPoints.length >= 3) {
      const dCut = 'M ' + piece.outerCutPoints.map((p) => toX(p.x) + ' ' + toY(p.y)).join(' L ') + ' Z';
      lines.push('    <path id="CORTE_TIJERAS_' + (pIdx + 1) + '" d="' + dCut + '" fill="none" stroke="#0f172a" stroke-width="0.52" stroke-linejoin="round" stroke-linecap="round" />');
      if (papercraftState.showScissorsIcons) {
        const pts = piece.outerCutPoints;
        const stepIdx = Math.max(1, Math.floor(pts.length / 3));
        for (let k = 0; k < pts.length; k += stepIdx) {
          const pA = pts[k];
          const pB = pts[(k + 1) % pts.length];
          if (Math.hypot(pB.x - pA.x, pB.y - pA.y) < 8) continue;
          const mx = toX((pA.x + pB.x) * 0.5);
          const my = toY((pA.y + pB.y) * 0.5);
          lines.push('    <text x="' + mx + '" y="' + my + '" font-family="sans-serif" font-size="3.4" font-weight="bold" fill="#e11d48" text-anchor="middle" dominant-baseline="central">✂</text>');
        }
      }
    }

    lines.push('  </g>');
  });

  lines.push('</svg>');
  return lines.join('\n');
}

function buildPapercraftPrintableHTMLDocument() {
  const sheets = papercraftState.packedSheets || [];
  if (sheets.length === 0) runPapercraftGeneration();
  const isLandscape = papercraftState.sheetFormat !== 'A4_portrait';
  const pageSizeCss = papercraftState.sheetFormat === 'A3_landscape'
    ? 'A3 landscape'
    : (isLandscape ? 'A4 landscape' : 'A4 portrait');

  const svgsHtml = papercraftState.packedSheets.map((sh) => {
    const svgRaw = generatePapercraftSheetSVG(sh).replace(/<\?xml[^>]*\?>\s*/i, '');
    return '<div class="sheet-page">' + svgRaw + '</div>';
  }).join('\n');

  return [
    '<!DOCTYPE html>',
    '<html lang="es">',
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <title>Cuaderno de Recortables Escolares (Tijeras y Pegamento) — LayerStudio 3D</title>',
    '  <style>',
    '    @page { size: ' + pageSizeCss + '; margin: 0mm; }',
    '    * { box-sizing: border-box; margin: 0; padding: 0; }',
    '    body { background: #1e293b; font-family: system-ui, sans-serif; color: #0f172a; }',
    '    .toolbar { background: #0f172a; color: #f8fafc; padding: 10px 18px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 20; border-bottom: 1px solid #334155; }',
    '    .toolbar button { background: #0284c7; color: #fff; border: none; border-radius: 8px; padding: 8px 16px; font-weight: 700; cursor: pointer; font-size: 13px; }',
    '    .sheet-page { margin: 16px auto; background: #ffffff; box-shadow: 0 10px 30px rgba(0,0,0,0.45); page-break-after: always; break-after: page; display: flex; justify-content: center; width: fit-content; }',
    '    .sheet-page:last-child { page-break-after: auto; break-after: auto; }',
    '    @media print {',
    '      body { background: #ffffff; }',
    '      .toolbar { display: none !important; }',
    '      .sheet-page { margin: 0; box-shadow: none; }',
    '    }',
    '  </style>',
    '</head>',
    '<body>',
    '  <div class="toolbar">',
    '    <div><strong>✂️ Cuaderno de Recortables Escolares — LayerStudio 3D</strong> · Imprime a escala 100% (Tamaño real) y recorta por las líneas con tijeras</div>',
    '    <button onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>',
    '  </div>',
    svgsHtml,
    '</body>',
    '</html>'
  ].join('\n');
}

function printPapercraftSheetsA4() {
  const htmlDoc = buildPapercraftPrintableHTMLDocument();
  const win = window.open('', '_blank');
  if (!win) {
    downloadPapercraftBookletHTML();
    return;
  }
  win.document.open();
  win.document.write(htmlDoc);
  win.document.close();
  setTimeout(() => {
    try { win.focus(); win.print(); } catch (_) {}
  }, 350);
}

function downloadPapercraftBookletHTML() {
  const htmlDoc = buildPapercraftPrintableHTMLDocument();
  const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
  const filename = (state.modelName || 'Recortable_Escolar') + '_CUADERNO_RECORTABLE_A4.html';
  if (typeof triggerVectorizerFileDownload === 'function') {
    triggerVectorizerFileDownload(blob, filename);
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 3000);
  }
}

function downloadPapercraftSheetsSVG() {
  const sheets = papercraftState.packedSheets || [];
  if (sheets.length === 0) runPapercraftGeneration();
  const activeIdx = Math.max(0, Math.min(papercraftState.packedSheets.length - 1, papercraftState.activeSheetIndex || 0));
  const sheet = papercraftState.packedSheets[activeIdx];
  if (!sheet) return;
  const svg = generatePapercraftSheetSVG(sheet);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const filename = (state.modelName || 'Recortable_Escolar') + '_HOJA_' + (activeIdx + 1) + '_TIJERAS_Y_PESTANAS.svg';
  if (typeof triggerVectorizerFileDownload === 'function') {
    triggerVectorizerFileDownload(blob, filename);
  }
}

// ============================================================================
// INTEGRACIÓN CON EL VISOR 3D Y 2D PRINCIPAL DE LAYERSTUDIO 3D
// ============================================================================
function applyPapercraftToMainStudio() {
  if (!papercraftState.generatedPieces || papercraftState.generatedPieces.length === 0) {
    runPapercraftGeneration();
  }
  const pieces = papercraftState.generatedPieces;
  if (!pieces || pieces.length === 0) return;

  const wallH = Math.max(4, Number(papercraftState.wallHeightMM) || 14);
  const totalZ = pieces.length * wallH;

  let maxSpanX = 120;
  let maxSpanY = 120;
  pieces.forEach((p) => {
    if (p.bounds.width > maxSpanX) maxSpanX = p.bounds.width;
    if (p.bounds.height > maxSpanY) maxSpanY = p.bounds.height;
  });

  state.constructionMode = 'stacked';
  state.axis = 'z';
  state.papercraftActiveInStudio = true;
  state.papercraftCutoutType = papercraftState.cutoutType;
  state.papercraftTabDepthMM = papercraftState.tabDepthMM;
  state.papercraftWallHeightMM = wallH;
  state.thickness = wallH;
  state.sliceCount = pieces.length;
  state.dimsMM = {
    x: Number((maxSpanX + 12).toFixed(1)),
    y: Number((maxSpanY + 12).toFixed(1)),
    z: Number(totalZ.toFixed(1))
  };

  state.slices = pieces.map((piece, idx) => {
    const zCoord = -totalZ * 0.5 + (idx + 0.5) * wallH;
    const areaVal = Math.abs(computeSignedPolygonArea(piece.outerCutPoints));
    const cutLoop = {
      points: piece.outerCutPoints.map((pt) => ({ x: pt.x, y: pt.y })),
      absArea: areaVal,
      signedArea: areaVal,
      isHole: false
    };

    // Incluir también las líneas de pliegue y zonas de pegamento como vectores grabados para compatibilidad total con Nesting y DXF
    const engraveLoops = [];
    (piece.glueTabs || []).forEach((gt) => {
      if (gt.polygon && gt.polygon.length >= 3) {
        engraveLoops.push({
          points: gt.polygon.map((pt) => ({ x: pt.x, y: pt.y })),
          isHole: false,
          areaMM2: Math.abs(computeSignedPolygonArea(gt.polygon))
        });
      }
    });

    return {
      index: idx,
      coord: zCoord,
      sliceAxis: 'z',
      puzzleCode: piece.shortCode,
      selected: true,
      rawLoops: [cutLoop],
      modelLoops: [cutLoop],
      unsplitLoops: [cutLoop],
      loops: [cutLoop],
      baseEngraveLoops: engraveLoops,
      engraveLoops,
      fineEdgeLoops: [],
      hatchPolylines: [],
      engraveStyle: 'vector_outline',
      filteredCount: 0,
      papercraftMeta: {
        title: piece.title,
        subtitle: piece.subtitle,
        shortCode: piece.shortCode,
        bodyPolygon: piece.bodyPolygon,
        foldLines: piece.foldLines || [],
        glueTabs: piece.glueTabs || [],
        wallPanels: piece.wallPanels || [],
        glueTargetZones: piece.glueTargetZones || [],
        colorObj: piece.colorObj,
        artworkDataUrl: piece.artworkCanvas ? piece.artworkCanvas.toDataURL('image/png') : null,
        artworkCanvas: piece.artworkCanvas,
        artworkBounds: piece.artworkBounds
      }
    };
  });

  state.activeSliceIndex = 0;
  if (typeof syncDimensionInputsUI === 'function') syncDimensionInputsUI();
  if (typeof updateConstructionModeUI === 'function') updateConstructionModeUI();
  if (typeof rebuild3DSlicesMeshes === 'function') rebuild3DSlicesMeshes();
  if (typeof buildBottomStrip === 'function') buildBottomStrip();
  if (typeof update2DInspectorHeader === 'function') update2DInspectorHeader();
  if (typeof reset2DView === 'function') reset2DView(true);
  if (typeof render2DSlice === 'function') render2DSlice();

  const badge = document.getElementById('constructionModeBadge');
  if (badge) {
    badge.textContent = '✂️ Recortable (' + pieces.length + ' pzs)';
  }

  closePapercraftModal();
}

// ============================================================================
// GESTIÓN DE IMÁGENES (1 IMAGEN Y VARIAS IMÁGENES) Y EVENTOS DE INTERFAZ
// ============================================================================
function loadPapercraftSingleDemo(presetId, redraw = true) {
  papercraftState.singleImagePreset = presetId;
  papercraftState._isCustomSingleImage = false;
  const names = {
    owl: 'Buho_Sabio_Escolar',
    volcano: 'Volcan_Isla_Canaria',
    castle: 'Castillo_Medieval_Capas',
    rocket: 'Cohete_Espacial',
    butterfly: 'Mariposa_Simetrica',
    crest: 'Escudo_Emblema'
  };
  papercraftState.singleImageName = names[presetId] || 'Ilustracion_Escolar';
  papercraftState.singleImageCanvas = createProceduralPapercraftCanvas(presetId, -1);
  if (redraw) runPapercraftGeneration();
}

function loadPapercraftMultiImagePack(packId, redraw = true) {
  papercraftState.multiImagesPack = packId;
  const packConfigs = {
    volcano_pack: [
      { name: 'Fondo 1: Océano y Plataforma Insular', preset: 'volcano_pack', layer: 0 },
      { name: 'Plano 2: Valle y Vegetación Costera', preset: 'volcano_pack', layer: 1 },
      { name: 'Plano 3: Cono Volcánico Principal', preset: 'volcano_pack', layer: 2 },
      { name: 'Frente 4: Cráter y Colada de Lava', preset: 'volcano_pack', layer: 3 }
    ],
    space_pack: [
      { name: 'Fondo 1: Nebulosa y Estrellas', preset: 'space_pack', layer: 0 },
      { name: 'Plano 2: Planeta con Anillos', preset: 'space_pack', layer: 1 },
      { name: 'Plano 3: Cohete Espacial', preset: 'space_pack', layer: 2 },
      { name: 'Frente 4: Escotilla y Propulsor', preset: 'space_pack', layer: 3 }
    ],
    forest_pack: [
      { name: 'Fondo 1: Cielo y Sol', preset: 'forest_pack', layer: 0 },
      { name: 'Plano 2: Cumbres Montañosas', preset: 'forest_pack', layer: 1 },
      { name: 'Plano 3: Pinar / Bosque Medio', preset: 'forest_pack', layer: 2 },
      { name: 'Frente 4: Pradera y Flora', preset: 'forest_pack', layer: 3 }
    ]
  };
  const cfg = packConfigs[packId] || packConfigs.volcano_pack;
  papercraftState.multiImagesList = cfg.map((item, idx) => {
    const c = createProceduralPapercraftCanvas(item.preset, item.layer, 4);
    return {
      id: 'pack_img_' + idx + '_' + Date.now(),
      name: item.name,
      canvas: c,
      dataUrl: c.toDataURL('image/png')
    };
  });
  renderPapercraftMultiImagesListUI();
  if (redraw) runPapercraftGeneration();
}

function handlePapercraftSingleImageFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      const maxDim = 480;
      const sc = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
      c.width = Math.max(32, Math.round(img.width * sc));
      c.height = Math.max(32, Math.round(img.height * sc));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);

      papercraftState.sourceMode = 'single_image';
      papercraftState._isCustomSingleImage = true;
      papercraftState.singleImageName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      papercraftState.singleImageCanvas = c;
      syncPapercraftControlsUI();
      runPapercraftGeneration();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function handlePapercraftMultiImageFiles(fileList, replaceExisting = false) {
  if (!fileList || fileList.length === 0) return;
  const files = Array.from(fileList);
  if (replaceExisting) {
    papercraftState.multiImagesList = [];
  }
  papercraftState.sourceMode = 'multi_images';
  papercraftState.multiImagesPack = 'custom';

  let loaded = 0;
  files.forEach((file, fIdx) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        const maxDim = 420;
        const sc = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        c.width = Math.max(32, Math.round(img.width * sc));
        c.height = Math.max(32, Math.round(img.height * sc));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);

        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        papercraftState.multiImagesList.push({
          id: 'user_multi_' + Date.now() + '_' + fIdx,
          name: cleanName,
          canvas: c,
          dataUrl: c.toDataURL('image/png')
        });

        loaded++;
        if (loaded === files.length) {
          syncPapercraftControlsUI();
          renderPapercraftMultiImagesListUI();
          runPapercraftGeneration();
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function movePapercraftMultiImage(idx, delta) {
  const list = papercraftState.multiImagesList;
  const target = idx + delta;
  if (idx < 0 || idx >= list.length || target < 0 || target >= list.length) return;
  const tmp = list[idx];
  list[idx] = list[target];
  list[target] = tmp;
  renderPapercraftMultiImagesListUI();
  runPapercraftGeneration();
}

function removePapercraftMultiImage(idx) {
  if (papercraftState.multiImagesList.length <= 1) return;
  papercraftState.multiImagesList.splice(idx, 1);
  renderPapercraftMultiImagesListUI();
  runPapercraftGeneration();
}

function clearAndUploadPapercraftMultiImages() {
  const inp = document.getElementById('fileInputPapercraftMulti');
  if (inp) {
    inp.dataset.replaceAll = 'true';
    inp.click();
  }
}

function renderPapercraftMultiImagesListUI() {
  const container = document.getElementById('papercraftMultiImagesContainer');
  if (!container) return;
  const list = papercraftState.multiImagesList || [];
  if (list.length === 0) {
    container.innerHTML = '<div class="text-[10px] text-slate-400 text-center py-2">No hay imágenes cargadas. Sube 1 o varias imágenes o elige un Pack Escolar.</div>';
    return;
  }

  container.innerHTML = list.map((item, idx) => {
    const roleTag = idx === 0 ? 'Base / Fondo' : (idx === list.length - 1 ? 'Frente Sup.' : ('Capa #' + (idx + 1)));
    return (
      '<div class="flex items-center justify-between gap-2 bg-slate-950/90 border border-slate-800 rounded-lg px-2 py-1">' +
        '<div class="flex items-center gap-2 min-w-0">' +
          '<img src="' + item.dataUrl + '" alt="" class="w-7 h-7 rounded bg-slate-900 object-contain border border-slate-700 shrink-0" />' +
          '<div class="min-w-0">' +
            '<div class="text-[10px] font-bold text-slate-200 truncate">#' + (idx + 1) + ' · ' + item.name + '</div>' +
            '<div class="text-[9px] text-amber-300/90">' + roleTag + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="flex items-center gap-1 shrink-0">' +
          '<button type="button" onclick="movePapercraftMultiImage(' + idx + ', -1)" class="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300" title="Subir capa">↑</button>' +
          '<button type="button" onclick="movePapercraftMultiImage(' + idx + ', 1)" class="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300" title="Bajar capa">↓</button>' +
          '<button type="button" onclick="removePapercraftMultiImage(' + idx + ')" class="w-5 h-5 rounded bg-rose-500/20 hover:bg-rose-500/35 text-[10px] text-rose-300 font-bold" title="Quitar esta imagen">✕</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

// ============================================================================
// CONTROLADORES DE FLUJO PRINCIPAL DEL ESTUDIO DE RECORTABLES
// ============================================================================
function runPapercraftGeneration() {
  papercraftState.generatedPieces = buildPapercraftPieces();
  papercraftState.packedSheets = packPapercraftPiecesIntoSheets(papercraftState.generatedPieces);
  if (papercraftState.activeSheetIndex >= papercraftState.packedSheets.length) {
    papercraftState.activeSheetIndex = 0;
  }
  updatePapercraftStatsAndSheetNavUI();
  renderPapercraftPreviewCanvas();
}

function updatePapercraftStatsAndSheetNavUI() {
  const pieces = papercraftState.generatedPieces || [];
  const sheets = papercraftState.packedSheets || [];
  const totalTabs = pieces.reduce((acc, p) => acc + ((p.glueTabs && p.glueTabs.length) || 0), 0);
  const totalFolds = pieces.reduce((acc, p) => acc + ((p.foldLines && p.foldLines.length) || 0), 0);

  const badge = document.getElementById('papercraftSummaryBadge');
  if (badge) {
    badge.innerHTML =
      '✂️ <strong>' + pieces.length + ' piezas recortables</strong> · ' +
      '🧴 <strong>' + totalTabs + ' pestañas de pegamento escolar</strong> · ' +
      '📐 <strong>' + totalFolds + ' líneas de pliegue</strong> · ' +
      '📄 <strong>' + sheets.length + ' hoja(s) ' + (papercraftState.sheetFormat.replace('_', ' ')) + '</strong>';
  }

  const sheetIndicator = document.getElementById('papercraftSheetPageLabel');
  if (sheetIndicator) {
    sheetIndicator.textContent = 'Hoja ' + ((papercraftState.activeSheetIndex || 0) + 1) + ' / ' + Math.max(1, sheets.length);
  }
}

function stepPapercraftSheetPage(delta) {
  const sheets = papercraftState.packedSheets || [];
  if (sheets.length <= 1) return;
  papercraftState.activeSheetIndex = (papercraftState.activeSheetIndex + delta + sheets.length) % sheets.length;
  updatePapercraftStatsAndSheetNavUI();
  renderPapercraftPreviewCanvas();
}

function setPapercraftSourceMode(mode) {
  papercraftState.sourceMode = mode;
  if (mode === 'single_image' && !papercraftState.singleImageCanvas) {
    loadPapercraftSingleDemo(papercraftState.singleImagePreset || 'owl', false);
  } else if (mode === 'multi_images' && (!papercraftState.multiImagesList || papercraftState.multiImagesList.length === 0)) {
    loadPapercraftMultiImagePack(papercraftState.multiImagesPack || 'volcano_pack', false);
  }
  syncPapercraftControlsUI();
  runPapercraftGeneration();
}

function setPapercraftCutoutType(type) {
  papercraftState.cutoutType = type;
  syncPapercraftControlsUI();
  runPapercraftGeneration();
}

function setPapercraftPreviewMode(mode) {
  papercraftState.previewMode = mode;
  syncPapercraftControlsUI();
  renderPapercraftPreviewCanvas();
}

function onPapercraftParamsChange() {
  const getNum = (id, fallback) => {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const v = parseFloat(el.value);
    return Number.isFinite(v) ? v : fallback;
  };
  const getCheck = (id, fallback) => {
    const el = document.getElementById(id);
    return el ? Boolean(el.checked) : fallback;
  };
  const getVal = (id, fallback) => {
    const el = document.getElementById(id);
    return el ? el.value : fallback;
  };

  papercraftState.layersCount = Math.max(2, Math.min(12, Math.round(getNum('pcLayersCountInput', papercraftState.layersCount))));
  papercraftState.sliceAxis = getVal('pcSliceAxisSelect', papercraftState.sliceAxis);
  papercraftState.platformUnfoldMode = getVal('pcPlatformUnfoldSelect', papercraftState.platformUnfoldMode);
  papercraftState.standeeFoldMode = getVal('pcStandeeFoldSelect', papercraftState.standeeFoldMode);
  papercraftState.widthMM = Math.max(30, Math.min(400, getNum('pcWidthMMInput', papercraftState.widthMM)));
  papercraftState.heightMM = Math.max(30, Math.min(400, getNum('pcHeightMMInput', papercraftState.heightMM)));
  papercraftState.wallHeightMM = Math.max(0, Math.min(60, getNum('pcWallHeightInput', papercraftState.wallHeightMM)));
  papercraftState.tabDepthMM = Math.max(4, Math.min(30, getNum('pcTabDepthInput', papercraftState.tabDepthMM)));
  papercraftState.tabBevelDeg = Math.max(25, Math.min(65, getNum('pcTabBevelInput', papercraftState.tabBevelDeg)));
  papercraftState.tabsPerLayer = Math.max(2, Math.min(8, Math.round(getNum('pcTabsPerLayerInput', papercraftState.tabsPerLayer))));
  papercraftState.scissorsSimplifyMM = Math.max(0.5, Math.min(15, getNum('pcScissorsSimplifyInput', papercraftState.scissorsSimplifyMM)));
  papercraftState.cutMarginMM = Math.max(0, Math.min(15, getNum('pcCutMarginInput', papercraftState.cutMarginMM)));
  papercraftState.showGlueLabels = getCheck('pcShowGlueLabelsCheck', true);
  papercraftState.showScissorsIcons = getCheck('pcShowScissorsCheck', true);
  papercraftState.showFoldArrows = getCheck('pcShowFoldsCheck', true);
  papercraftState.printStyle = getVal('pcPrintStyleSelect', papercraftState.printStyle);
  papercraftState.sheetFormat = getVal('pcSheetFormatSelect', papercraftState.sheetFormat);
  papercraftState.includeSchoolHeader = getCheck('pcSchoolHeaderCheck', true);
  papercraftState.foldProgressPct = getNum('pcFoldSlider', papercraftState.foldProgressPct);
  papercraftState.explodeLayersPct = getNum('pcExplodeSlider', papercraftState.explodeLayersPct);

  syncPapercraftControlsUI();
  runPapercraftGeneration();
}

function syncPapercraftControlsUI() {
  // Botones de fuente (Modelo 3D / 1 Imagen / Varias Imágenes)
  ['model3d', 'single_image', 'multi_images'].forEach((m) => {
    const btn = document.getElementById('pcSourceBtn_' + m);
    if (btn) {
      btn.className = papercraftState.sourceMode === m
        ? 'py-1.5 px-2 rounded-lg bg-amber-500/25 border border-amber-400 text-amber-200 text-[11px] font-bold transition flex items-center justify-center gap-1 shadow'
        : 'py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-medium transition flex items-center justify-center gap-1';
    }
    const box = document.getElementById('pcSourceBox_' + m);
    if (box) {
      box.classList.toggle('hidden', papercraftState.sourceMode !== m);
    }
  });

  // Botones de tipo de recortable
  ['stacked_platforms', 'layered_tabs', 'accordion_spacers', 'standee_peana', 'prism_net'].forEach((t) => {
    const btn = document.getElementById('pcTypeBtn_' + t);
    if (btn) {
      btn.className = papercraftState.cutoutType === t
        ? 'p-2 rounded-lg bg-sky-500/25 border border-sky-400 text-sky-200 text-left transition shadow'
        : 'p-2 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-300 text-left transition';
    }
  });

  const unfoldRow = document.getElementById('pcPlatformUnfoldRow');
  if (unfoldRow) unfoldRow.classList.toggle('hidden', papercraftState.cutoutType !== 'stacked_platforms');

  const standeeRow = document.getElementById('pcStandeeFoldRow');
  if (standeeRow) standeeRow.classList.toggle('hidden', papercraftState.cutoutType !== 'standee_peana');

  const tabsPerLayerRow = document.getElementById('pcTabsPerLayerRow');
  if (tabsPerLayerRow) tabsPerLayerRow.classList.toggle('hidden', papercraftState.cutoutType !== 'layered_tabs');

  // Pestañas de vista previa (Hojas A4 2D vs Vista 3D Montada)
  ['sheets2d', 'assembled3d'].forEach((pm) => {
    const btn = document.getElementById('pcPrevModeBtn_' + pm);
    if (btn) {
      btn.className = papercraftState.previewMode === pm
        ? 'px-3 py-1 rounded-lg bg-amber-500/25 border border-amber-400 text-amber-200 text-xs font-bold transition'
        : 'px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium transition';
    }
  });

  const controls3DBar = document.getElementById('pc3DControlsBar');
  if (controls3DBar) {
    controls3DBar.classList.toggle('hidden', papercraftState.previewMode !== 'assembled3d');
  }

  const lblLayers = document.getElementById('pcLayersCountLabel');
  if (lblLayers) lblLayers.textContent = String(papercraftState.layersCount);

  const lblFold = document.getElementById('pcFoldValLabel');
  if (lblFold) lblFold.textContent = Math.round(papercraftState.foldProgressPct) + '%';

  const lblExplode = document.getElementById('pcExplodeValLabel');
  if (lblExplode) lblExplode.textContent = Math.round(papercraftState.explodeLayersPct) + '%';
}

function openPapercraftModal(initialSourceMode) {
  const modal = document.getElementById('papercraftModal');
  if (!modal) return;
  if (initialSourceMode && ['model3d', 'single_image', 'multi_images'].includes(initialSourceMode)) {
    papercraftState.sourceMode = initialSourceMode;
  }
  if (!papercraftState.singleImageCanvas) {
    loadPapercraftSingleDemo('owl', false);
  }
  if (!papercraftState.multiImagesList || papercraftState.multiImagesList.length === 0) {
    loadPapercraftMultiImagePack('volcano_pack', false);
  }
  papercraftState.isOpen = true;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  syncPapercraftControlsUI();
  renderPapercraftMultiImagesListUI();
  setTimeout(() => {
    runPapercraftGeneration();
  }, 30);
}

function closePapercraftModal() {
  const modal = document.getElementById('papercraftModal');
  if (!modal) return;
  papercraftState.isOpen = false;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// Permite enviar directamente la imagen actual del Vectorizador 2D al Estudio de Recortables con Pestañas
function openPapercraftFromVectorizer() {
  if (typeof vec2dState !== 'undefined' && vec2dState.sourceCanvas) {
    papercraftState.sourceMode = 'single_image';
    papercraftState._isCustomSingleImage = true;
    papercraftState.singleImageName = vec2dState.imageName || 'Imagen_Vectorizada';
    papercraftState.singleImageCanvas = vec2dState.sourceCanvas;
    papercraftState.widthMM = Math.max(50, Number(vec2dState.widthMM) || 130);
    papercraftState.heightMM = Math.max(50, Number(vec2dState.heightMM) || 130);
  }
  if (typeof closeImageVectorizerModal === 'function') {
    closeImageVectorizerModal();
  }
  openPapercraftModal('single_image');
}

function resetPapercraftViewport() {
  papercraftState.view2D.zoom = 1;
  papercraftState.view2D.panX = 0;
  papercraftState.view2D.panY = 0;
  papercraftState.view3D.yaw = -0.62;
  papercraftState.view3D.pitch = 0.52;
  papercraftState.view3D.zoom = 1.0;
  renderPapercraftPreviewCanvas();
}

function zoomPapercraftViewport(factor) {
  if (papercraftState.previewMode === 'assembled3d') {
    papercraftState.view3D.zoom = Math.max(0.4, Math.min(4.0, papercraftState.view3D.zoom * factor));
  } else {
    papercraftState.view2D.zoom = Math.max(0.4, Math.min(6.0, papercraftState.view2D.zoom * factor));
  }
  renderPapercraftPreviewCanvas();
}

function bindPapercraftCanvasEvents() {
  const canvas = document.getElementById('papercraftPreviewCanvas');
  if (!canvas || canvas.dataset.boundEvents === '1') return;
  canvas.dataset.boundEvents = '1';

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.14 : 0.88;
    zoomPapercraftViewport(factor);
  }, { passive: false });

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (papercraftState.previewMode === 'assembled3d') {
      papercraftState.view3D.isDragging = true;
      papercraftState.view3D.startX = e.clientX;
      papercraftState.view3D.startY = e.clientY;
      papercraftState.view3D.startYaw = papercraftState.view3D.yaw;
      papercraftState.view3D.startPitch = papercraftState.view3D.pitch;
    } else {
      papercraftState.view2D.isDragging = true;
      papercraftState.view2D.startX = e.clientX;
      papercraftState.view2D.startY = e.clientY;
      papercraftState.view2D.startPanX = papercraftState.view2D.panX;
      papercraftState.view2D.startPanY = papercraftState.view2D.panY;
    }
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  });

  canvas.addEventListener('pointermove', (e) => {
    if (papercraftState.previewMode === 'assembled3d' && papercraftState.view3D.isDragging) {
      const dx = e.clientX - papercraftState.view3D.startX;
      const dy = e.clientY - papercraftState.view3D.startY;
      papercraftState.view3D.yaw = papercraftState.view3D.startYaw + dx * 0.01;
      papercraftState.view3D.pitch = Math.max(0.08, Math.min(1.45, papercraftState.view3D.startPitch + dy * 0.01));
      renderPapercraftPreviewCanvas();
    } else if (papercraftState.view2D.isDragging) {
      const dx = e.clientX - papercraftState.view2D.startX;
      const dy = e.clientY - papercraftState.view2D.startY;
      papercraftState.view2D.panX = papercraftState.view2D.startPanX + dx;
      papercraftState.view2D.panY = papercraftState.view2D.startPanY + dy;
      renderPapercraftPreviewCanvas();
    }
  });

  const endDrag = (e) => {
    papercraftState.view2D.isDragging = false;
    papercraftState.view3D.isDragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
}

if (typeof window !== 'undefined') {
  window.papercraftState = papercraftState;
  window.openPapercraftModal = openPapercraftModal;
  window.closePapercraftModal = closePapercraftModal;
  window.openPapercraftFromVectorizer = openPapercraftFromVectorizer;
  window.setPapercraftSourceMode = setPapercraftSourceMode;
  window.setPapercraftCutoutType = setPapercraftCutoutType;
  window.setPapercraftPreviewMode = setPapercraftPreviewMode;
  window.onPapercraftParamsChange = onPapercraftParamsChange;
  window.runPapercraftGeneration = runPapercraftGeneration;
  window.stepPapercraftSheetPage = stepPapercraftSheetPage;
  window.resetPapercraftViewport = resetPapercraftViewport;
  window.zoomPapercraftViewport = zoomPapercraftViewport;
  window.loadPapercraftSingleDemo = loadPapercraftSingleDemo;
  window.loadPapercraftMultiImagePack = loadPapercraftMultiImagePack;
  window.handlePapercraftSingleImageFile = handlePapercraftSingleImageFile;
  window.handlePapercraftMultiImageFiles = handlePapercraftMultiImageFiles;
  window.movePapercraftMultiImage = movePapercraftMultiImage;
  window.removePapercraftMultiImage = removePapercraftMultiImage;
  window.clearAndUploadPapercraftMultiImages = clearAndUploadPapercraftMultiImages;
  window.printPapercraftSheetsA4 = printPapercraftSheetsA4;
  window.downloadPapercraftBookletHTML = downloadPapercraftBookletHTML;
  window.downloadPapercraftSheetsSVG = downloadPapercraftSheetsSVG;
  window.generatePapercraftSheetSVG = generatePapercraftSheetSVG;
  window.buildPapercraftPrintableHTMLDocument = buildPapercraftPrintableHTMLDocument;
  window.applyPapercraftToMainStudio = applyPapercraftToMainStudio;

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('DOMContentLoaded', () => {
      const inpSingle = document.getElementById('fileInputPapercraftSingle');
      if (inpSingle) {
        inpSingle.addEventListener('change', (e) => {
          const f = e.target.files && e.target.files[0];
          if (f) handlePapercraftSingleImageFile(f);
          e.target.value = '';
        });
      }
      const inpMulti = document.getElementById('fileInputPapercraftMulti');
      if (inpMulti) {
        inpMulti.addEventListener('change', (e) => {
          const replaceAll = inpMulti.dataset.replaceAll === 'true';
          inpMulti.dataset.replaceAll = 'false';
          if (e.target.files && e.target.files.length > 0) {
            handlePapercraftMultiImageFiles(e.target.files, replaceAll);
          }
          e.target.value = '';
        });
      }
      bindPapercraftCanvasEvents();
    });
  }
}
