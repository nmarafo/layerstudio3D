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
  sliceAxis: typeof state !== 'undefined' && state.axis ? state.axis : 'z', // 'z' | 'y' | 'x' (sincronizado con 2. Sistema Constructivo)
  layersCount: typeof state !== 'undefined' && state.sliceCount ? state.sliceCount : 24, // Nº de capas estipulado en 2. Sistema Constructivo (2..300)
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
  // Textos editables del recortable (título, autoría, curso/centro, fecha, subtítulo/nota, prefijo de piezas y pestañas)
  customTitle: '',
  customAuthor: '',
  customCourseCenter: '',
  customDate: '',
  customSubtitleNote: '',
  customPiecePrefix: '',
  customGlueWord: 'PEGAR',
  customPieceTitles: {},            // { [shortCode]: 'Título personalizado de la pieza' }
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
    panX: 0,
    panY: 0,
    isDragging: false,
    dragButton: 0,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startYaw: -0.62,
    startPitch: 0.52,
    startPanX: 0,
    startPanY: 0
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
// ============================================================================
// SINCRONIZACIÓN BIDIRECCIONAL CON 2. SISTEMA CONSTRUCTIVO
// ============================================================================
function getConstructiveSystemAxis() {
  if (typeof state === 'undefined') return 'z';
  if (state.constructionMode === 'puzzle3d' && typeof getPuzzleAxesConfig === 'function') {
    const cfg = getPuzzleAxesConfig();
    if (papercraftState && ['x', 'y', 'z'].includes(papercraftState.sliceAxis)) {
      if (
        papercraftState.sliceAxis === cfg.axisA ||
        papercraftState.sliceAxis === cfg.axisB ||
        (cfg.is3Axes && papercraftState.sliceAxis === cfg.axisC)
      ) {
        return papercraftState.sliceAxis;
      }
    }
    return cfg.axisA || 'x';
  }
  return state.axis || 'z';
}

function getConstructiveSystemLayerCount(axisOverride) {
  if (typeof state === 'undefined') return 24;
  if (state.constructionMode === 'puzzle3d' && typeof getPuzzleAxesConfig === 'function') {
    const cfg = getPuzzleAxesConfig();
    const ax = axisOverride || (papercraftState && papercraftState.sliceAxis) || cfg.axisA;
    if (ax === cfg.axisA) return Math.max(2, Math.min(300, parseInt(state.puzzleCountA, 10) || 7));
    if (ax === cfg.axisB) return Math.max(2, Math.min(300, parseInt(state.puzzleCountB, 10) || 7));
    if (cfg.is3Axes && ax === cfg.axisC) return Math.max(2, Math.min(300, parseInt(state.puzzleCountC, 10) || 4));
    return Math.max(2, Math.min(300, parseInt(state.puzzleCountA, 10) || 7));
  }
  return Math.max(2, Math.min(300, parseInt(state.sliceCount, 10) || (state.slices && state.slices.length) || 24));
}

function syncPapercraftWithConstructiveSystem(rerenderIfOpen = true) {
  const sysAxis = getConstructiveSystemAxis();
  const sysCount = getConstructiveSystemLayerCount(sysAxis);
  papercraftState.sliceAxis = sysAxis;
  papercraftState.layersCount = sysCount;

  const sliderEl = document.getElementById('pcLayersCountInput');
  const numEl = document.getElementById('pcLayersCountNumberInput');
  const lblEl = document.getElementById('pcLayersCountLabel');
  const axSel = document.getElementById('pcSliceAxisSelect');
  const syncBadge = document.getElementById('pcSystemSyncBadge');

  if (sliderEl) sliderEl.value = String(sysCount);
  if (numEl) numEl.value = String(sysCount);
  if (lblEl) lblEl.textContent = String(sysCount);
  if (axSel) axSel.value = sysAxis;
  if (syncBadge) {
    const modeName = typeof state !== 'undefined' && state.constructionMode === 'puzzle3d'
      ? ('Puzzle 3D · Eje ' + sysAxis.toUpperCase())
      : ('Apilado · Eje ' + sysAxis.toUpperCase());
    syncBadge.textContent = '🔗 = 2. Sistema Constructivo (' + modeName + ': ' + sysCount + ' capas)';
  }

  if (rerenderIfOpen && papercraftState.isOpen) {
    runPapercraftGeneration();
  }
}

function syncConstructiveSystemFromPapercraft(newCount, newAxis) {
  const cleanAxis = (newAxis && ['x', 'y', 'z'].includes(newAxis))
    ? newAxis
    : (papercraftState.sliceAxis || 'z');
  papercraftState.sliceAxis = cleanAxis;

  if (typeof state === 'undefined') {
    papercraftState.layersCount = Math.max(2, Math.min(300, Math.round(Number(newCount) || 24)));
    return;
  }

  if (state.constructionMode === 'puzzle3d' && typeof getPuzzleAxesConfig === 'function') {
    const cfg = getPuzzleAxesConfig();
    const clampedPuzzle = Math.max(2, Math.min(60, Math.round(Number(newCount) || 7)));
    papercraftState.layersCount = clampedPuzzle;
    if (cleanAxis === cfg.axisA) {
      state.puzzleCountA = clampedPuzzle;
    } else if (cleanAxis === cfg.axisB) {
      state.puzzleCountB = clampedPuzzle;
    } else if (cfg.is3Axes && cleanAxis === cfg.axisC) {
      state.puzzleCountC = clampedPuzzle;
    } else {
      state.puzzleCountA = clampedPuzzle;
    }
    state.sliceCount = clampedPuzzle;
    if (typeof syncConstructionModeUI === 'function') syncConstructionModeUI();
    if (typeof rebuildGhostAndSlices === 'function' && typeof THREE !== 'undefined') rebuildGhostAndSlices();
  } else {
    const clampedStacked = Math.max(2, Math.min(300, Math.round(Number(newCount) || state.sliceCount || 24)));
    papercraftState.layersCount = clampedStacked;
    state.axis = cleanAxis;
    state.mode = 'count';
    state.sliceCount = clampedStacked;

    const sSlider = document.getElementById('sliceCountSlider');
    const sLabel = document.getElementById('sliceCountLabel');
    if (sSlider) sSlider.value = String(clampedStacked);
    if (sLabel) sLabel.textContent = String(clampedStacked);

    const countBox = document.getElementById('countControlBox');
    const thickBox = document.getElementById('thicknessControlBox');
    const mCountBtn = document.getElementById('modeBtn_count');
    const mThickBtn = document.getElementById('modeBtn_thickness');
    if (countBox) countBox.classList.remove('hidden');
    if (thickBox) thickBox.classList.add('hidden');
    if (mCountBtn) mCountBtn.className = 'py-1 rounded-md border border-sky-500 bg-sky-500/20 text-[11px] font-semibold text-sky-300';
    if (mThickBtn) mThickBtn.className = 'py-1 rounded-md border border-slate-700 bg-slate-900 text-[11px] font-semibold text-slate-400';

    ['x', 'y', 'z'].forEach((k) => {
      const btn = document.getElementById('axisBtn_' + k);
      if (!btn) return;
      if (k === cleanAxis) {
        btn.className = 'py-1.5 rounded-lg border border-sky-500 bg-sky-500/20 text-xs font-bold text-sky-300 transition';
      } else {
        const col = k === 'x' ? 'text-rose-400' : (k === 'y' ? 'text-emerald-400' : 'text-sky-400');
        btn.className = 'py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs font-bold ' + col + ' hover:bg-slate-800 transition';
      }
    });

    if (typeof rebuildGhostAndSlices === 'function' && typeof THREE !== 'undefined') rebuildGhostAndSlices();
  }
}

function stepPapercraftLayersCount(delta) {
  const cur = parseInt(papercraftState.layersCount, 10) || getConstructiveSystemLayerCount();
  const next = Math.max(2, Math.min(300, cur + (parseInt(delta, 10) || 0)));
  const sEl = document.getElementById('pcLayersCountInput');
  const nEl = document.getElementById('pcLayersCountNumberInput');
  if (sEl) sEl.value = String(next);
  if (nEl) nEl.value = String(next);
  syncConstructiveSystemFromPapercraft(next, papercraftState.sliceAxis);
  syncPapercraftControlsUI();
  runPapercraftGeneration();
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
  let data = srcCanvas._cachedPapercraftGrid96;
  if (!data) {
    const tmp = document.createElement('canvas');
    tmp.width = gridN;
    tmp.height = gridN;
    const ctx = tmp.getContext('2d');
    ctx.drawImage(srcCanvas, 0, 0, gridN, gridN);
    data = ctx.getImageData(0, 0, gridN, gridN).data;
    srcCanvas._cachedPapercraftGrid96 = data;
  }

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

// Comprueba si un punto 2D (x, y) está dentro de un polígono cerrado (ray-casting)
function isPointInPolygon2D(pt, poly) {
  if (!pt || !poly || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
      (pt.x < ((xj - xi) * (pt.y - yi)) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Detecta huecos interiores cerrados (transparentes o del color de fondo) dentro de una imagen 2D
function extractInternalHolesFromCanvas(srcCanvas, targetWMM, targetHMM, thresholdMode, layerFrac, simplifyMM) {
  if (!srcCanvas) return [];
  const gridN = 96;
  let imgData = srcCanvas._cachedPapercraftGrid96;
  if (!imgData) {
    const off = document.createElement('canvas');
    off.width = gridN;
    off.height = gridN;
    const ctx = off.getContext('2d');
    ctx.drawImage(srcCanvas, 0, 0, gridN, gridN);
    imgData = ctx.getImageData(0, 0, gridN, gridN).data;
    srcCanvas._cachedPapercraftGrid96 = imgData;
  }

  const corners = [0, (gridN - 1) * 4, (gridN * (gridN - 1)) * 4, (gridN * gridN - 1) * 4];
  let bgR = 0, bgG = 0, bgB = 0, transparentCorners = 0;
  corners.forEach((idx) => {
    bgR += imgData[idx];
    bgG += imgData[idx + 1];
    bgB += imgData[idx + 2];
    if (imgData[idx + 3] < 45) transparentCorners++;
  });
  bgR /= 4; bgG /= 4; bgB /= 4;
  const hasTransparency = transparentCorners >= 2;

  const mask = new Uint8Array(gridN * gridN);
  for (let y = 0; y < gridN; y++) {
    for (let x = 0; x < gridN; x++) {
      const idx = (y * gridN + x) * 4;
      const r = imgData[idx], g = imgData[idx + 1], b = imgData[idx + 2], a = imgData[idx + 3];
      let inside = hasTransparency ? (a > 60) : (Math.hypot(r - bgR, g - bgG, b - bgB) > 32 && a > 60);
      if (inside && thresholdMode === 'multilayer' && layerFrac > 0.05) {
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        const sat = Math.max(r, g, b) - Math.min(r, g, b);
        const normX = (x - gridN * 0.5) / (gridN * 0.5);
        const normY = (y - gridN * 0.5) / (gridN * 0.5);
        const radial = Math.hypot(normX, normY);
        const score = (1.0 - radial * 0.55) + (sat / 255) * 0.35 + ((255 - luma) / 255) * 0.25;
        if (score < layerFrac * 0.95) inside = false;
      }
      mask[y * gridN + x] = inside ? 1 : 0;
    }
  }

  const visited = new Uint8Array(gridN * gridN);
  const queue = new Int32Array(gridN * gridN);
  let qHead = 0, qTail = 0;
  const enqueueIfBg = (gx, gy) => {
    const pos = gy * gridN + gx;
    if (mask[pos] === 0 && visited[pos] === 0) {
      visited[pos] = 1;
      queue[qTail++] = pos;
    }
  };
  for (let i = 0; i < gridN; i++) {
    enqueueIfBg(i, 0);
    enqueueIfBg(i, gridN - 1);
    enqueueIfBg(0, i);
    enqueueIfBg(gridN - 1, i);
  }
  while (qHead < qTail) {
    const cur = queue[qHead++];
    const cx = cur % gridN;
    const cy = (cur / gridN) | 0;
    if (cx > 0) enqueueIfBg(cx - 1, cy);
    if (cx + 1 < gridN) enqueueIfBg(cx + 1, cy);
    if (cy > 0) enqueueIfBg(cx, cy - 1);
    if (cy + 1 < gridN) enqueueIfBg(cx, cy + 1);
  }

  const holePolys = [];
  for (let y = 1; y < gridN - 1; y++) {
    for (let x = 1; x < gridN - 1; x++) {
      const startPos = y * gridN + x;
      if (mask[startPos] !== 0 || visited[startPos] !== 0) continue;

      const comp = [];
      let cHead = 0;
      visited[startPos] = 2;
      comp.push(startPos);
      while (cHead < comp.length) {
        const p = comp[cHead++];
        const px = p % gridN;
        const py = (p / gridN) | 0;
        const neighbors = [
          px > 0 ? p - 1 : -1,
          px + 1 < gridN ? p + 1 : -1,
          py > 0 ? p - gridN : -1,
          py + 1 < gridN ? p + gridN : -1
        ];
        for (let ni = 0; ni < 4; ni++) {
          const np = neighbors[ni];
          if (np >= 0 && mask[np] === 0 && visited[np] === 0) {
            visited[np] = 2;
            comp.push(np);
          }
        }
      }

      if (comp.length < 10) continue;

      let sumX = 0, sumY = 0;
      const compSet = new Set(comp);
      comp.forEach((p) => {
        sumX += p % gridN;
        sumY += (p / gridN) | 0;
      });
      const hCx = sumX / comp.length;
      const hCy = sumY / comp.length;

      const numRays = 36;
      const maxR = gridN * 0.5;
      const rawHolePts = [];
      for (let k = 0; k < numRays; k++) {
        const ang = (k / numRays) * Math.PI * 2;
        const cosA = Math.cos(ang);
        const sinA = Math.sin(ang);
        let bestR = 0;
        for (let r = maxR; r >= 0.8; r -= 0.6) {
          const gx = Math.round(hCx + cosA * r);
          const gy = Math.round(hCy - sinA * r);
          if (gx >= 0 && gx < gridN && gy >= 0 && gy < gridN && compSet.has(gy * gridN + gx)) {
            bestR = r;
            break;
          }
        }
        if (bestR > 0.8) {
          const gx = hCx + cosA * bestR;
          const gy = hCy - sinA * bestR;
          const nx = (gx - gridN * 0.5) / gridN;
          const ny = (gridN * 0.5 - gy) / gridN;
          rawHolePts.push({
            x: nx * targetWMM,
            y: ny * targetHMM
          });
        }
      }

      if (rawHolePts.length >= 4) {
        const cleanHole = simplifyClosedLoopForScissors(rawHolePts, Math.max(0.8, simplifyMM * 0.65), 4, 20);
        const hb = computePolygonBounds2D(cleanHole);
        if (hb.width >= 3.0 && hb.height >= 3.0) {
          holePolys.push(cleanHole);
        }
      }
    }
  }

  return holePolys;
}

// Busca 2 posiciones sólidas dentro de la capa (fuera de cualquier hueco interior) para pegar los separadores Z
function findSafeSpacerPositionsOnLayer(layer, spacerW, tabDepth) {
  const b = layer.bounds || computePolygonBounds2D(layer.contourPoints);
  const holes = layer.holePolygons || [];
  const isSafePoint = (px, py) => {
    if (!isPointInPolygon2D({ x: px, y: py }, layer.contourPoints)) return false;
    for (let i = 0; i < holes.length; i++) {
      if (isPointInPolygon2D({ x: px, y: py }, holes[i])) return false;
    }
    return true;
  };

  const defaultOffX = Math.min(b.width * 0.22, 24);
  const candidates = [
    [-defaultOffX, 0],
    [-b.width * 0.34, 0],
    [-b.width * 0.14, b.height * 0.26],
    [-b.width * 0.28, -b.height * 0.24],
    [0, b.height * 0.32]
  ];

  let leftPos = { x: b.cx - defaultOffX, y: b.cy };
  let rightPos = { x: b.cx + defaultOffX, y: b.cy };

  for (let i = 0; i < candidates.length; i++) {
    const lx = b.cx + candidates[i][0];
    const ly = b.cy + candidates[i][1];
    if (isSafePoint(lx, ly)) {
      leftPos = { x: lx, y: ly };
      break;
    }
  }
  for (let i = 0; i < candidates.length; i++) {
    const rx = b.cx - candidates[i][0];
    const ry = b.cy - candidates[i][1];
    if (isSafePoint(rx, ry)) {
      rightPos = { x: rx, y: ry };
      break;
    }
  }

  return [leftPos, rightPos];
}

// Crea o reutiliza en caché la ilustración recortada para una capa con imagen
function createLayerArtworkCanvas(srcCanvas, loopPoints, wMM, hMM, layerColorObj, printStyle) {
  if (!srcCanvas || printStyle === 'blueprint') return null;
  const cacheKey = '_cachedPapercraftArt_' + (printStyle || 'color');
  if (srcCanvas[cacheKey]) return srcCanvas[cacheKey];

  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 320;
  const ctx = c.getContext('2d');

  if (printStyle === 'coloring') {
    const colCanvas = buildColoringBookCanvas(srcCanvas);
    if (colCanvas) ctx.drawImage(colCanvas, 0, 0, c.width, c.height);
  } else {
    ctx.drawImage(srcCanvas, 0, 0, c.width, c.height);
  }
  srcCanvas[cacheKey] = c;
  return c;
}

// ============================================================================
// EXTRACCIÓN DE LAS CAPAS BASE SEGÚN LA FUENTE ELEGIDA (3D, 1 IMAGEN O VARIAS)
// El número de capas coincide siempre con el estipulado en 2. Sistema Constructivo
// y preserva todos los huecos interiores (holePolygons) de cada capa 3D o imagen
// ============================================================================
function extractPapercraftSourceLayers() {
  const srcMode = papercraftState.sourceMode;
  const wMM = Math.max(30, Number(papercraftState.widthMM) || 130);
  const hMM = Math.max(30, Number(papercraftState.heightMM) || 130);
  const simplifyMM = Math.max(0.8, Number(papercraftState.scissorsSimplifyMM) || 3.5);
  const marginMM = Math.max(0, Number(papercraftState.cutMarginMM) || 2.5);
  const nLayers = Math.max(2, Math.min(300, parseInt(papercraftState.layersCount, 10) || getConstructiveSystemLayerCount()));
  papercraftState.layersCount = nLayers;
  const layers = [];

  if (srcMode === 'model3d') {
    const axis = papercraftState.sliceAxis || getConstructiveSystemAxis();
    const tris = typeof getScaledTriangles === 'function' ? getScaledTriangles() : null;
    const modelSpan = (typeof state !== 'undefined' && state.dimsMM) ? (state.dimsMM[axis] || 120) : 120;
    const otherAxes = axis === 'x' ? ['y', 'z'] : (axis === 'y' ? ['x', 'z'] : ['x', 'y']);
    const spanU = Math.max(1, (typeof state !== 'undefined' && state.dimsMM) ? state.dimsMM[otherAxes[0]] : 120);
    const spanV = Math.max(1, (typeof state !== 'undefined' && state.dimsMM) ? state.dimsMM[otherAxes[1]] : 120);
    const scaleU = (wMM * 0.86) / spanU;
    const scaleV = (hMM * 0.86) / spanV;
    const scale2D = Math.min(scaleU, scaleV);

    const canReuseStackedSlices = Boolean(
      typeof state !== 'undefined' &&
      state.constructionMode === 'stacked' &&
      !state.papercraftActiveInStudio &&
      state.axis === axis &&
      Array.isArray(state.slices) &&
      state.slices.length === nLayers
    );

    for (let k = 0; k < nLayers; k++) {
      const frac = nLayers === 1 ? 0.5 : (k + 0.5) / nLayers;
      const coord = -modelSpan * 0.5 + frac * modelSpan;
      let rawLoops = [];

      if (canReuseStackedSlices && state.slices[k] && state.slices[k].loops) {
        rawLoops = state.slices[k].loops;
      } else if (tris && tris.length > 0 && typeof sliceTrianglesAtPlane === 'function') {
        const sliced = sliceTrianglesAtPlane(tris, axis, coord, modelSpan) || [];
        rawLoops = typeof filterLoopsByMinIslandSize === 'function'
          ? (filterLoopsByMinIslandSize(sliced).loops || sliced)
          : sliced;
      } else if (typeof state !== 'undefined' && state.slices && state.slices.length > 0) {
        const sIdx = Math.min(state.slices.length - 1, Math.floor(frac * state.slices.length));
        rawLoops = (state.slices[sIdx] && state.slices[sIdx].loops) ? state.slices[sIdx].loops : [];
      }

      // 1. Contorno exterior principal de la capa 3D
      const outerLoops = rawLoops
        .filter((l) => !l.isHole && l.points && l.points.length >= 3)
        .slice()
        .sort((a, b) => Math.abs(computeSignedPolygonArea(b.points)) - Math.abs(computeSignedPolygonArea(a.points)));

      let chosenPts = [];
      if (outerLoops.length === 1) {
        chosenPts = outerLoops[0].points.map((p) => ({ x: p.x * scale2D, y: p.y * scale2D }));
      } else if (outerLoops.length > 1) {
        const area0 = Math.abs(computeSignedPolygonArea(outerLoops[0].points));
        const totalOuterArea = outerLoops.reduce((acc, l) => acc + Math.abs(computeSignedPolygonArea(l.points)), 0);
        if (area0 >= totalOuterArea * 0.65) {
          chosenPts = outerLoops[0].points.map((p) => ({ x: p.x * scale2D, y: p.y * scale2D }));
        } else {
          const allPts = [];
          outerLoops.forEach((l) => {
            l.points.forEach((p) => allPts.push({ x: p.x * scale2D, y: p.y * scale2D }));
          });
          chosenPts = computeConvexHullLoop(allPts);
        }
      } else {
        const r = Math.max(14, (wMM * 0.42) * (1 - (k / Math.max(1, nLayers)) * 0.55));
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          chosenPts.push({ x: Math.cos(ang) * r, y: Math.sin(ang) * r });
        }
      }

      const maxVerts = papercraftState.cutoutType === 'stacked_platforms' && papercraftState.platformUnfoldMode === 'attached_flaps'
        ? 12
        : 28;
      const cleanLoop = simplifyClosedLoopForScissors(chosenPts, simplifyMM, 4, maxVerts);

      // 2. Huecos interiores (isHole === true) presentes en esta capa 3D
      const rawHoleLoops = rawLoops.filter((l) => l.isHole && l.points && l.points.length >= 3);
      const holePolygons = [];
      rawHoleLoops.forEach((hl) => {
        if (typeof state !== 'undefined' && state.fillInternalHoles && typeof shouldFillInternalHole === 'function' && shouldFillInternalHole(hl)) {
          return;
        }
        const scaledHole = hl.points.map((p) => ({ x: p.x * scale2D, y: p.y * scale2D }));
        const cleanHole = simplifyClosedLoopForScissors(scaledHole, Math.max(0.7, simplifyMM * 0.65), 4, 24);
        const hb = computePolygonBounds2D(cleanHole);
        if (cleanHole.length >= 3 && hb.width >= 2.2 && hb.height >= 2.2) {
          holePolygons.push(cleanHole);
        }
      });

      const colObj = PAPERCRAFT_LAYER_COLORS[k % PAPERCRAFT_LAYER_COLORS.length];
      layers.push({
        layerIndex: k,
        title: 'Capa #' + (k + 1) + ' (' + axis.toUpperCase() + '=' + coord.toFixed(0) + 'mm)' + (holePolygons.length > 0 ? (' · ' + holePolygons.length + ' hueco(s)') : ''),
        shortCode: 'C' + (k + 1),
        contourPoints: cleanLoop,
        holePolygons,
        bounds: computePolygonBounds2D(cleanLoop),
        colorObj: colObj,
        artworkCanvas: null,
        sourceCanvas: null
      });
    }
    return layers;
  }

  if (srcMode === 'single_image') {
    if (!papercraftState.singleImageCanvas) {
      papercraftState.singleImageCanvas = createProceduralPapercraftCanvas(papercraftState.singleImagePreset || 'owl', -1);
    }
    const isPresetMultiCapable = ['volcano', 'castle', 'rocket'].includes(papercraftState.singleImagePreset) && !papercraftState._isCustomSingleImage;
    const presetTierCanvases = isPresetMultiCapable
      ? [0, 1, 2, 3].map((tierIdx) => createProceduralPapercraftCanvas(papercraftState.singleImagePreset, tierIdx, 4))
      : null;

    for (let k = 0; k < nLayers; k++) {
      const frac = nLayers === 1 ? 0 : (k / Math.max(1, nLayers));
      const tierIdx = isPresetMultiCapable ? Math.min(3, Math.floor((k / nLayers) * 4)) : 0;
      const layerCanvas = isPresetMultiCapable
        ? presetTierCanvases[tierIdx]
        : papercraftState.singleImageCanvas;

      const threshMode = isPresetMultiCapable ? 'silhouette' : 'multilayer';
      let loopPts = extractSilhouetteLoopFromCanvas(
        layerCanvas,
        wMM,
        hMM,
        threshMode,
        frac,
        marginMM,
        simplifyMM
      );
      let holePolygons = extractInternalHolesFromCanvas(
        layerCanvas,
        wMM,
        hMM,
        threshMode,
        frac,
        simplifyMM
      );

      if (isPresetMultiCapable && nLayers > 4) {
        const subScale = Math.max(0.55, 1.0 - (frac * 0.22));
        loopPts = loopPts.map((p) => ({ x: p.x * subScale, y: p.y * subScale }));
        holePolygons = holePolygons.map((hp) => hp.map((p) => ({ x: p.x * subScale, y: p.y * subScale })));
      }

      const colObj = PAPERCRAFT_LAYER_COLORS[k % PAPERCRAFT_LAYER_COLORS.length];
      layers.push({
        layerIndex: k,
        title: 'Capa #' + (k + 1) + ' — ' + (papercraftState.singleImageName || 'Imagen') + (holePolygons.length > 0 ? (' · ' + holePolygons.length + ' hueco(s)') : ''),
        shortCode: 'C' + (k + 1),
        contourPoints: loopPts,
        holePolygons,
        bounds: computePolygonBounds2D(loopPts),
        colorObj: colObj,
        artworkCanvas: createLayerArtworkCanvas(layerCanvas, loopPts, wMM, hMM, colObj, papercraftState.printStyle),
        sourceCanvas: layerCanvas
      });
    }
    return layers;
  }

  // Modo 'multi_images': Genera exactamente nLayers capas (coincidiendo con 2. Sistema Constructivo)
  if (!papercraftState.multiImagesList || papercraftState.multiImagesList.length === 0) {
    loadPapercraftMultiImagePack(papercraftState.multiImagesPack || 'volcano_pack', false);
  }
  const imgList = papercraftState.multiImagesList;

  for (let k = 0; k < nLayers; k++) {
    const imgIdx = Math.min(imgList.length - 1, Math.floor((k / nLayers) * imgList.length));
    const item = imgList[imgIdx];
    const frac = nLayers === imgList.length ? 0 : ((k % Math.max(1, Math.ceil(nLayers / imgList.length))) * 0.12);

    let loopPts = extractSilhouetteLoopFromCanvas(
      item.canvas,
      wMM,
      hMM,
      'silhouette',
      frac,
      marginMM,
      simplifyMM
    );
    let holePolygons = extractInternalHolesFromCanvas(
      item.canvas,
      wMM,
      hMM,
      'silhouette',
      frac,
      simplifyMM
    );
    if (nLayers > imgList.length && frac > 0) {
      const subScale = Math.max(0.65, 1.0 - frac * 0.45);
      loopPts = loopPts.map((p) => ({ x: p.x * subScale, y: p.y * subScale }));
      holePolygons = holePolygons.map((hp) => hp.map((p) => ({ x: p.x * subScale, y: p.y * subScale })));
    }
    const colObj = PAPERCRAFT_LAYER_COLORS[k % PAPERCRAFT_LAYER_COLORS.length];
    layers.push({
      layerIndex: k,
      title: 'Capa #' + (k + 1) + ' — ' + (item.name || ('Imagen ' + (imgIdx + 1))) + (holePolygons.length > 0 ? (' · ' + holePolygons.length + ' hueco(s)') : ''),
      shortCode: 'C' + (k + 1),
      contourPoints: loopPts,
      holePolygons,
      bounds: computePolygonBounds2D(loopPts),
      colorObj: colObj,
      artworkCanvas: createLayerArtworkCanvas(item.canvas, loopPts, wMM, hMM, colObj, papercraftState.printStyle),
      sourceCanvas: item.canvas
    });
  }

  return layers;
}

// ============================================================================
// GENERADORES DE LOS 5 TIPOS DE RECORTABLES CON PESTAÑAS DE PEGAMENTO ESCOLAR
// ============================================================================
function buildPapercraftPieces() {
  const baseLayers = extractPapercraftSourceLayers();
  papercraftState.baseLayers = baseLayers;
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
      const layerHoles = (layer.holePolygons || []).map((hp) => hp.map((p) => ({ x: p.x, y: p.y })));
      const n = pts.length;

      // Zona guía superior donde se pega la plataforma siguiente (#k+1), respetando sus huecos interiores
      const glueTargetZones = [];
      if (nextLayer && nextLayer.contourPoints && nextLayer.contourPoints.length >= 3) {
        glueTargetZones.push({
          polygon: nextLayer.contourPoints.map((p) => ({ x: p.x, y: p.y })),
          holePolygons: (nextLayer.holePolygons || []).map((hp) => hp.map((p) => ({ x: p.x, y: p.y }))),
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
          title: 'Plataforma Apilable #' + (idx + 1) + (idx === 0 ? ' (Base Inferior)' : (' (Pegar sobre #' + idx + ')')) + (layerHoles.length > 0 ? (' [' + layerHoles.length + ' hueco(s)]') : ''),
          subtitle: 'Doblar paredes ' + effWallH + ' mm a 90°' + (layerHoles.length > 0 ? ', vaciar hueco(s) interior(es) ✂' : '') + ' y pegar pestañas con pegamento escolar',
          shortCode: 'P' + (idx + 1),
          bodyPolygon: pts,
          holePolygons: layerHoles,
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
          title: 'Plataforma #' + (idx + 1) + ' (A) — Tapa Superior' + (layerHoles.length > 0 ? (' [' + layerHoles.length + ' hueco(s)]') : ''),
          subtitle: 'Recortar silueta' + (layerHoles.length > 0 ? ' y hueco(s) interior(es) ✂' : '') + ' y pegar debajo los dientes superiores de la Banda Lateral #' + (idx + 1),
          shortCode: 'P' + (idx + 1) + '-TAPA',
          bodyPolygon: pts,
          holePolygons: layerHoles,
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
            holePolygons: [],
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
      const layerHoles = (layer.holePolygons || []).map((hp) => hp.map((p) => ({ x: p.x, y: p.y })));

      const glueTargetZones = [];
      if (nextLayer) {
        glueTargetZones.push({
          polygon: nextLayer.contourPoints.map((p) => ({ x: p.x, y: p.y })),
          holePolygons: (nextLayer.holePolygons || []).map((hp) => hp.map((p) => ({ x: p.x, y: p.y }))),
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
          ? 'Capa base inferior: recorta por la línea exterior' + (layerHoles.length > 0 ? ', vacía sus huecos interiores ✂' : '') + ' y pega encima las pestañas de la Capa #2'
          : ('Recorta con las ' + tabRes.glueTabs.length + ' pestañas' + (layerHoles.length > 0 ? ' y huecos interiores ✂' : '') + (stepH > 0 ? (' (escalón ' + stepH + ' mm)') : '') + ' y pégalas en la Capa #' + idx),
        shortCode: 'CAPA-' + (idx + 1),
        bodyPolygon: layer.contourPoints,
        holePolygons: layerHoles,
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
      const layerHoles = (layer.holePolygons || []).map((hp) => hp.map((p) => ({ x: p.x, y: p.y })));
      const glueTargetZones = [];

      // Dos casillas de pegado de separador en cada capa, evitando cualquier hueco interior
      const safePositions = findSafeSpacerPositionsOnLayer(layer, spacerW, tabDepth);
      safePositions.forEach((pos, sIdx) => {
        const hw = spacerW * 0.5;
        const hh = tabDepth * 0.5;
        const boxPoly = [
          { x: pos.x - hw, y: pos.y - hh },
          { x: pos.x + hw, y: pos.y - hh },
          { x: pos.x + hw, y: pos.y + hh },
          { x: pos.x - hw, y: pos.y + hh }
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
          holePolygons: (nextLayer.holePolygons || []).map((hp) => hp.map((p) => ({ x: p.x, y: p.y }))),
          label: 'GUÍA CAPA #' + (idx + 2)
        });
      }

      pieces.push({
        pieceId: 'acc_layer_' + (idx + 1),
        layerIndex: idx,
        title: layer.title + ' (Recortable en Capas con Separador Z)',
        subtitle: nextLayer
          ? ('Recortar silueta' + (layerHoles.length > 0 ? ' y hueco(s) interior(es) ✂' : '') + ' y pegar los 2 separadores S' + (idx + 1) + '.1 y S' + (idx + 1) + '.2 en las casillas marcadas')
          : 'Capa frontal superior: pegar sobre los separadores de la capa anterior',
        shortCode: 'CAPA-' + (idx + 1),
        bodyPolygon: layer.contourPoints,
        holePolygons: layerHoles,
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
          holePolygons: [],
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
      holePolygons: [],
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
      const layerHoles = (layer.holePolygons || []).map((hp) => hp.map((p) => ({ x: p.x, y: p.y })));

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
        subtitle: 'Recortar silueta exterior' + (layerHoles.length > 0 ? ' y huecos interiores ✂' : '') + ', doblar la pestaña inferior a 90° y pegar en la Peana',
        shortCode: 'FIG-' + (idx + 1),
        bodyPolygon: ccwStandee,
        holePolygons: layerHoles,
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

    // Mapear proporcionalmente los huecos interiores de la capa a la cara superior [-hw..hw, -hd..hd]
    const sxHole = rawW / Math.max(10, layer.bounds.width);
    const syHole = rawD / Math.max(10, layer.bounds.height);
    const prismHoles = (layer.holePolygons || []).map((hp) =>
      hp.map((p) => ({
        x: (p.x - layer.bounds.cx) * sxHole,
        y: (p.y - layer.bounds.cy) * syHole
      }))
    );

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
      subtitle: 'Recortar la cruz por la línea continua exterior' + (prismHoles.length > 0 ? ', vaciar huecos ✂' : '') + ', doblar las aristas a 90° y cerrar las 7 pestañas',
      shortCode: 'RED-B' + (idx + 1),
      bodyPolygon: topFace,
      holePolygons: prismHoles,
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
// APLICACIÓN DE TEXTOS PERSONALIZABLES (TÍTULO, AUTORÍA, CENTRO Y PIEZAS)
// ============================================================================
function applyCustomTextsToPapercraftPieces(pieces) {
  if (!Array.isArray(pieces)) return pieces;
  const customPrefix = (papercraftState.customPiecePrefix || '').trim();
  const customGlue = (papercraftState.customGlueWord || '').trim() || 'PEGAR';
  const pieceTitlesMap = papercraftState.customPieceTitles || {};

  pieces.forEach((p) => {
    if (!p) return;
    if (typeof p.defaultTitle !== 'string') p.defaultTitle = p.title || '';
    if (typeof p.defaultSubtitle !== 'string') p.defaultSubtitle = p.subtitle || '';

    const customIndividual = (pieceTitlesMap[p.shortCode] || '').trim();
    if (customIndividual) {
      p.title = customIndividual;
    } else if (customPrefix && !p.isSpacerPiece && !p.isPeanaBase && !p.isCollarStrip) {
      p.title = p.defaultTitle.replace(
        /^(Plataforma Apilable|Plataforma|Capa Superpuesta|Capa|Figura Recortable|Red Desplegable 3D\s*—\s*Bloque)/i,
        customPrefix
      );
    } else {
      p.title = p.defaultTitle;
    }

    (p.glueTabs || []).forEach((gt) => {
      if (!gt) return;
      if (typeof gt.defaultLabel !== 'string') gt.defaultLabel = gt.label || '';
      if (!gt.defaultLabel) {
        gt.label = '';
      } else if (customGlue.toUpperCase() !== 'PEGAR') {
        gt.label = gt.defaultLabel.replace(/PEGAR/gi, customGlue);
      } else {
        gt.label = gt.defaultLabel;
      }
    });

    (p.glueTargetZones || []).forEach((gz) => {
      if (!gz) return;
      if (typeof gz.defaultLabel !== 'string') gz.defaultLabel = gz.label || '';
      if (!gz.defaultLabel) {
        gz.label = '';
      } else if (customGlue.toUpperCase() !== 'PEGAR') {
        gz.label = gz.defaultLabel.replace(/PEGAR/gi, customGlue);
      } else {
        gz.label = gz.defaultLabel;
      }
    });
  });

  return pieces;
}

function getPapercraftHeaderTextConfig(sheet, prog) {
  const typeNames = {
    stacked_platforms: 'Plataformas 3D para Apilar',
    layered_tabs: 'Recortable en Capas Superpuestas',
    accordion_spacers: 'Recortable en Capas con Separadores Z',
    standee_peana: 'Figuras Troqueladas con Peana 3D',
    prism_net: 'Red Poliédrica 3D Desplegable'
  };
  const typeLabel = typeNames[papercraftState.cutoutType] || 'Recortable Escolar';
  const totalSheets = Math.max(1, (papercraftState.packedSheets && papercraftState.packedSheets.length) || 1);
  const sheetIdx = sheet ? (sheet.sheetIndex + 1) : 1;

  const customTitle = (papercraftState.customTitle || '').trim();
  const customAuthor = (papercraftState.customAuthor || '').trim();
  const customCourse = (papercraftState.customCourseCenter || '').trim();
  const customDate = (papercraftState.customDate || '').trim();
  const customNote = (papercraftState.customSubtitleNote || '').trim();
  const customGlue = (papercraftState.customGlueWord || '').trim() || 'PEGAR';

  const headerTitleText = customTitle ? customTitle : typeLabel.toUpperCase();
  const mainHeaderLine = '✂️ HOJA ' + sheetIdx + '/' + totalSheets + ' — ' + headerTitleText;

  const baseProgress = prog
    ? ('Progreso: Capas ' + prog.rangeLabel + ' de ' + prog.totalLayers + ' (' + prog.progressPct + '% · Eje ' + prog.axisLabel + ')')
    : 'Recortable Escolar 3D';
  const subProgressLine = customNote
    ? (baseProgress + ' · ' + customNote)
    : baseProgress;

  const authorSeg = customAuthor ? ('Autoría: ' + customAuthor) : 'Alumno/a: ______________________';
  const courseSeg = customCourse ? ('Curso/Centro: ' + customCourse) : 'Curso: ________';
  const dateSeg = customDate ? ('Fecha: ' + customDate) : 'Fecha: ________';
  const schoolMetaLine = authorSeg + '   ' + courseSeg + '   ' + dateSeg;

  const legendLine = '━━✂━━ Cortar tijeras   — — — Doblar (Montaña)   — · — Doblar (Valle)   🧴 ' + customGlue;

  const bookletTitle = customTitle
    ? (customTitle + ' — Cuaderno de Recortables (LayerStudio 3D)')
    : 'Cuaderno de Recortables Escolares (Tijeras y Pegamento) — LayerStudio 3D';

  const metaParts = [];
  if (customAuthor) metaParts.push('Autoría: ' + customAuthor);
  if (customCourse) metaParts.push(customCourse);
  if (customDate) metaParts.push('Fecha: ' + customDate);
  if (customNote) metaParts.push(customNote);
  const bookletMetaSummary = metaParts.length > 0
    ? metaParts.join(' · ')
    : 'Imprime a escala 100% (Tamaño real) y recorta por las líneas con tijeras';

  const rawSlugSource = customTitle || (typeof state !== 'undefined' && state.modelName) || 'Recortable_Escolar';
  const safeFileSlug = String(rawSlugSource).trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Recortable_Escolar';

  return {
    typeLabel,
    totalSheets,
    headerTitleText,
    mainHeaderLine,
    subProgressLine,
    schoolMetaLine,
    legendLine,
    bookletTitle,
    bookletMetaSummary,
    safeFileSlug
  };
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
  // Reservamos 38 mm superiores en cada A4 para el cajetín escolar + el dibujo del modelo con el progreso (estilo Guía Ilustrada)
  const headerH = 38;
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
// CÁLCULO GEOMÉTRICO DEL DIAGRAMA DEL MODELO CON EL PROGRESO EN CADA HOJA A4
// (Estilo Guía Ilustrada: Alzado Apilado + Vista 3D del Modelo con Progreso)
// ============================================================================
function computeSheetModelProgressLayout(sheet) {
  const baseLayers = (papercraftState.baseLayers && papercraftState.baseLayers.length > 0)
    ? papercraftState.baseLayers
    : extractPapercraftSourceLayers();
  const totalLayers = Math.max(1, baseLayers.length);

  const activeSet = new Set();
  const pieceCodes = [];
  (sheet.placements || []).forEach((pl) => {
    if (!pl || !pl.piece) return;
    if (pl.piece.shortCode) pieceCodes.push(pl.piece.shortCode);
    const lIdx = typeof pl.piece.layerIndex === 'number' ? pl.piece.layerIndex : -1;
    if (lIdx >= 0 && lIdx < totalLayers) {
      activeSet.add(lIdx);
    }
  });
  if (activeSet.size === 0) {
    activeSet.add(0);
  }

  const activeIndices = Array.from(activeSet).sort((a, b) => a - b);
  const minActive = activeIndices[0];
  const maxActive = activeIndices[activeIndices.length - 1];
  const rangeLabel = minActive === maxActive
    ? ('#' + (minActive + 1))
    : ('#' + (minActive + 1) + '..#' + (maxActive + 1));
  const progressPct = Math.round(((maxActive + 1) / totalLayers) * 100);
  const layerT = Math.max(2, Number(papercraftState.wallHeightMM) || 14);
  const accumHeightMM = ((maxActive + 1) * layerT).toFixed(0);
  const axisLabel = (papercraftState.sliceAxis || 'z').toUpperCase();

  const sw = sheet.widthMM;
  const m = sheet.marginMM;
  const innerW = sw - m * 2;
  const hBoxH = (sheet.headerHMM || 38) - 3; // 35 mm de alto

  // Dividir la banda superior en: Columna Izquierda (Datos y Leyenda) + Columna Derecha (2 Diagramas de Progreso del Modelo)
  const diagTotalW = Math.min(118, Math.max(88, innerW * 0.465));
  const infoW = innerW - diagTotalW - 2.2;
  const diagX = m + innerW - diagTotalW;
  const diagY = m + 1.2;
  const diagH = hBoxH - 2.4;
  const subGap = 1.6;
  const subW = (diagTotalW - subGap) * 0.5;

  const elevBox = { x: diagX, y: diagY, w: subW, h: diagH };
  const isoBox = { x: diagX + subW + subGap, y: diagY, w: subW, h: diagH };

  // Global bounds de todas las capas del modelo
  let gMinX = Infinity, gMaxX = -Infinity, gMinY = Infinity, gMaxY = -Infinity;
  baseLayers.forEach((l) => {
    const b = l.bounds || computePolygonBounds2D(l.contourPoints);
    if (b.minX < gMinX) gMinX = b.minX;
    if (b.maxX > gMaxX) gMaxX = b.maxX;
    if (b.minY < gMinY) gMinY = b.minY;
    if (b.maxY > gMaxY) gMaxY = b.maxY;
  });
  if (!Number.isFinite(gMinX)) {
    gMinX = -50; gMaxX = 50; gMinY = -50; gMaxY = 50;
  }
  const spanX = Math.max(10, gMaxX - gMinX);
  const spanY = Math.max(10, gMaxY - gMinY);
  const centerX = (gMinX + gMaxX) * 0.5;
  const centerY = (gMinY + gMaxY) * 0.5;

  // 1. Geometría de ALZADO APILADO CON PROGRESO (idéntico a Guía Ilustrada generateStepStackElevationSVG)
  const elevPlotX = elevBox.x + 2.4;
  const elevPlotW = Math.max(12, elevBox.w - 13.8);
  const elevPlotY = elevBox.y + 4.6;
  const elevPlotH = Math.max(10, elevBox.h - 8.4);
  const baseLineY = elevPlotY + elevPlotH;
  const barH = elevPlotH / totalLayers;

  const elevBars = baseLayers.map((l, k) => {
    const b = l.bounds || computePolygonBounds2D(l.contourPoints);
    const rx = elevPlotX + ((b.minX - gMinX) / spanX) * elevPlotW;
    const rw = Math.max(1.4, (b.width / spanX) * elevPlotW);
    const ry = baseLineY - (k + 1) * barH;
    const rh = Math.max(0.35, barH);
    const status = activeSet.has(k) ? 'current' : (k < minActive ? 'done' : 'pending');
    const holeSpans = (l.holePolygons || []).map((hp) => {
      const hb = computePolygonBounds2D(hp);
      return {
        hx: elevPlotX + ((hb.minX - gMinX) / spanX) * elevPlotW,
        hw: Math.max(0.7, (hb.width / spanX) * elevPlotW)
      };
    });
    return { k, rx, ry, rw, rh, status, holeSpans };
  });

  const midActiveK = (minActive + maxActive + 1) * 0.5;
  const markerY = baseLineY - midActiveK * barH;

  // 2. Geometría de MODELO 3D ISOMÉTRICO CON PROGRESO (Siluetas 3D + Huecos de todas las capas del modelo)
  const yaw = -0.62;
  const pitch = 0.58;
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
  const visualStackH = Math.max(spanX, spanY) * 0.62;
  const dz = visualStackH / totalLayers;

  const rawProj = (x, y, z) => {
    const dx = x - centerX;
    const dy = y - centerY;
    const rx = dx * cosY - dy * sinY;
    const ry = dx * sinY + dy * cosY;
    return {
      ux: rx,
      uy: -(ry * sinP + z * cosP)
    };
  };

  let uMinX = Infinity, uMaxX = -Infinity, uMinY = Infinity, uMaxY = -Infinity;
  baseLayers.forEach((l, k) => {
    const zTop = (k + 1) * dz;
    const zBot = k * dz;
    (l.contourPoints || []).forEach((pt) => {
      const pT = rawProj(pt.x, pt.y, zTop);
      const pB = rawProj(pt.x, pt.y, zBot);
      if (pT.ux < uMinX) uMinX = pT.ux;
      if (pT.ux > uMaxX) uMaxX = pT.ux;
      if (pT.uy < uMinY) uMinY = pT.uy;
      if (pT.uy > uMaxY) uMaxY = pT.uy;
      if (pB.uy > uMaxY) uMaxY = pB.uy;
    });
  });
  if (!Number.isFinite(uMinX)) {
    uMinX = -50; uMaxX = 50; uMinY = -50; uMaxY = 50;
  }

  const isoPlotX = isoBox.x + 2.0;
  const isoPlotY = isoBox.y + 4.6;
  const isoPlotW = Math.max(12, isoBox.w - 4.0);
  const isoPlotH = Math.max(10, isoBox.h - 8.4);
  const uSpanX = Math.max(1, uMaxX - uMinX);
  const uSpanY = Math.max(1, uMaxY - uMinY);
  const isoScale = Math.min(isoPlotW / uSpanX, isoPlotH / uSpanY);
  const uMidX = (uMinX + uMaxX) * 0.5;
  const uMidY = (uMinY + uMaxY) * 0.5;
  const isoCx = isoPlotX + isoPlotW * 0.5;
  const isoCy = isoPlotY + isoPlotH * 0.5;

  const toIsoSheet = (x, y, z) => {
    const p = rawProj(x, y, z);
    return {
      x: isoCx + (p.ux - uMidX) * isoScale,
      y: isoCy + (p.uy - uMidY) * isoScale
    };
  };

  // Placa base de referencia en Z = 0
  const hw = spanX * 0.52;
  const hh = spanY * 0.52;
  const isoBaseQuad = [
    toIsoSheet(centerX - hw, centerY - hh, 0),
    toIsoSheet(centerX + hw, centerY - hh, 0),
    toIsoSheet(centerX + hw, centerY + hh, 0),
    toIsoSheet(centerX - hw, centerY + hh, 0)
  ];

  // Si hay muchísimas capas (> 36), muestreamos las no activas para mantener el SVG ligero pero incluimos siempre todas las capas activas de esta hoja
  const maxInactiveSample = 32;
  const stride = totalLayers > maxInactiveSample ? Math.ceil(totalLayers / maxInactiveSample) : 1;
  const isoLayers = [];
  for (let k = 0; k < totalLayers; k++) {
    const isCurr = activeSet.has(k);
    if (!isCurr && k !== 0 && k !== totalLayers - 1 && (k % stride !== 0)) continue;
    const l = baseLayers[k];
    const pts = l.contourPoints || [];
    if (pts.length < 3) continue;
    const zTop = (k + 1) * dz;
    const zBot = k * dz;
    const topPoly = pts.map((pt) => toIsoSheet(pt.x, pt.y, zTop));
    const botPoly = isCurr ? pts.map((pt) => toIsoSheet(pt.x, pt.y, zBot)) : null;
    const holeTopPolys = (l.holePolygons || [])
      .filter((hp) => hp && hp.length >= 3)
      .map((hp) => hp.map((pt) => toIsoSheet(pt.x, pt.y, zTop)));
    const status = isCurr ? 'current' : (k < minActive ? 'done' : 'pending');
    isoLayers.push({
      k,
      status,
      topPoly,
      botPoly,
      holeTopPolys,
      centerPt: toIsoSheet((l.bounds && l.bounds.cx) || centerX, (l.bounds && l.bounds.cy) || centerY, zTop)
    });
  }

  return {
    totalLayers,
    minActive,
    maxActive,
    rangeLabel,
    progressPct,
    accumHeightMM,
    axisLabel,
    pieceCodes,
    hBoxH,
    infoW,
    elevBox,
    elevPlotX,
    elevPlotW,
    baseLineY,
    markerY,
    elevBars,
    isoBox,
    isoBaseQuad,
    isoLayers
  };
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

  // Cabecera escolar + Dibujo del modelo con el progreso (estilo Guía Ilustrada) en cada A4
  const prog = computeSheetModelProgressLayout(sheet);
  const txtCfg = getPapercraftHeaderTextConfig(sheet, prog);
  {
    const hBoxH = prog.hBoxH * pxPerMM;
    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(1, 0.35 * pxPerMM);
    ctx.fillRect(m, m, sw - m * 2, hBoxH);
    ctx.strokeRect(m, m, sw - m * 2, hBoxH);

    const titleFont = Math.max(8.5, 3.1 * pxPerMM);
    const subFont = Math.max(6.8, 2.25 * pxPerMM);
    const tinyFont = Math.max(6.0, 2.0 * pxPerMM);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold ' + titleFont.toFixed(1) + 'px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(
      txtCfg.mainHeaderLine,
      m + 2.5 * pxPerMM,
      m + 2.0 * pxPerMM
    );

    ctx.fillStyle = '#0369a1';
    ctx.font = 'bold ' + subFont.toFixed(1) + 'px sans-serif';
    ctx.fillText(
      txtCfg.subProgressLine,
      m + 2.5 * pxPerMM,
      m + 7.2 * pxPerMM
    );

    if (papercraftState.includeSchoolHeader) {
      ctx.fillStyle = '#334155';
      ctx.font = subFont.toFixed(1) + 'px sans-serif';
      ctx.fillText(
        txtCfg.schoolMetaLine,
        m + 2.5 * pxPerMM,
        m + 12.6 * pxPerMM
      );
    }

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold ' + tinyFont.toFixed(1) + 'px sans-serif';
    ctx.fillText(
      txtCfg.legendLine,
      m + 2.5 * pxPerMM,
      m + 18.2 * pxPerMM
    );

    // Barra visual de progreso + Leyenda de colores de la Guía Ilustrada
    const barX = m + 2.5 * pxPerMM;
    const barY = m + 23.6 * pxPerMM;
    const barW = Math.max(30 * pxPerMM, (prog.infoW - 5) * pxPerMM);
    const barH = 2.8 * pxPerMM;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(barX, barY, barW, barH);
    const doneFrac = prog.minActive / prog.totalLayers;
    const currFrac = (prog.maxActive - prog.minActive + 1) / prog.totalLayers;
    if (doneFrac > 0) {
      ctx.fillStyle = '#10b981';
      ctx.fillRect(barX, barY, barW * doneFrac, barH);
    }
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(barX + barW * doneFrac, barY, Math.max(3, barW * currFrac), barH);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = Math.max(0.6, 0.2 * pxPerMM);
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.fillStyle = '#334155';
    ctx.font = 'bold ' + tinyFont.toFixed(1) + 'px sans-serif';
    ctx.fillText(
      '🟢 Montadas (#' + (prog.minActive > 0 ? ('1..#' + prog.minActive) : '—') + ')   🟠 En esta hoja (' + prog.rangeLabel + ')   ⚪ Pendientes (' + (prog.maxActive + 1 < prog.totalLayers ? ('#' + (prog.maxActive + 2) + '..#' + prog.totalLayers) : 'Fin') + ')',
      m + 2.5 * pxPerMM,
      m + 28.0 * pxPerMM
    );

    // ------------------------------------------------------------------------
    // PANEL DERECHO 1: ALZADO APILADO CON PROGRESO (Idéntico a Guía Ilustrada)
    // ------------------------------------------------------------------------
    const eb = prog.elevBox;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = Math.max(0.8, 0.28 * pxPerMM);
    ctx.fillRect(eb.x * pxPerMM, eb.y * pxPerMM, eb.w * pxPerMM, eb.h * pxPerMM);
    ctx.strokeRect(eb.x * pxPerMM, eb.y * pxPerMM, eb.w * pxPerMM, eb.h * pxPerMM);

    const hdrFont = Math.max(5.5, 1.75 * pxPerMM);
    ctx.fillStyle = '#334155';
    ctx.font = 'bold ' + hdrFont.toFixed(1) + 'px monospace, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      'ALZADO: ' + prog.rangeLabel + '/' + prog.totalLayers + ' (EJE ' + prog.axisLabel + ')',
      (eb.x + eb.w * 0.5) * pxPerMM,
      (eb.y + 2.2) * pxPerMM
    );

    // Línea de mesa / base inferior
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = Math.max(1.0, 0.35 * pxPerMM);
    ctx.beginPath();
    ctx.moveTo((prog.elevPlotX - 1.0) * pxPerMM, prog.baseLineY * pxPerMM);
    ctx.lineTo((prog.elevPlotX + prog.elevPlotW + 1.0) * pxPerMM, prog.baseLineY * pxPerMM);
    ctx.stroke();

    // Capas apiladas de abajo hacia arriba (mostrando también vanos / huecos interiores)
    prog.elevBars.forEach((bar) => {
      ctx.save();
      if (bar.status === 'done') {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.58)';
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = Math.max(0.6, 0.2 * pxPerMM);
        ctx.fillRect(bar.rx * pxPerMM, bar.ry * pxPerMM, bar.rw * pxPerMM, bar.rh * pxPerMM);
        ctx.strokeRect(bar.rx * pxPerMM, bar.ry * pxPerMM, bar.rw * pxPerMM, bar.rh * pxPerMM);
      } else if (bar.status === 'current') {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.94)';
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = Math.max(1.0, 0.32 * pxPerMM);
        ctx.fillRect(bar.rx * pxPerMM, bar.ry * pxPerMM, bar.rw * pxPerMM, bar.rh * pxPerMM);
        ctx.strokeRect(bar.rx * pxPerMM, bar.ry * pxPerMM, bar.rw * pxPerMM, bar.rh * pxPerMM);
      } else {
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = Math.max(0.5, 0.18 * pxPerMM);
        ctx.setLineDash([1.2 * pxPerMM * 0.35, 1.0 * pxPerMM * 0.35]);
        ctx.strokeRect(bar.rx * pxPerMM, bar.ry * pxPerMM, bar.rw * pxPerMM, bar.rh * pxPerMM);
      }
      if (bar.holeSpans && bar.holeSpans.length > 0 && bar.status !== 'pending') {
        ctx.fillStyle = '#ffffff';
        bar.holeSpans.forEach((hs) => {
          ctx.fillRect(hs.hx * pxPerMM, (bar.ry + 0.12) * pxPerMM, hs.hw * pxPerMM, Math.max(0.2, bar.rh - 0.24) * pxPerMM);
        });
      }
      ctx.restore();
    });

    // Línea indicadora de nivel activo + etiqueta ◀ #A..#B
    ctx.save();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = Math.max(0.8, 0.25 * pxPerMM);
    ctx.setLineDash([1.6 * pxPerMM * 0.35, 1.0 * pxPerMM * 0.35]);
    ctx.beginPath();
    ctx.moveTo(prog.elevPlotX * pxPerMM, prog.markerY * pxPerMM);
    ctx.lineTo((eb.x + eb.w - 1.2) * pxPerMM, prog.markerY * pxPerMM);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b45309';
    ctx.font = 'bold ' + hdrFont.toFixed(1) + 'px monospace, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('◀' + prog.rangeLabel, (eb.x + eb.w - 0.8) * pxPerMM, prog.markerY * pxPerMM);
    ctx.restore();

    ctx.fillStyle = '#475569';
    ctx.font = hdrFont.toFixed(1) + 'px monospace, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▲ BASE #1 (' + prog.accumHeightMM + ' mm)', (eb.x + eb.w * 0.5) * pxPerMM, (eb.y + eb.h - 1.7) * pxPerMM);
    ctx.restore();

    // ------------------------------------------------------------------------
    // PANEL DERECHO 2: DIBUJO 3D DEL MODELO CON EL PROGRESO (Y HUECOS)
    // ------------------------------------------------------------------------
    const ib = prog.isoBox;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = Math.max(0.8, 0.28 * pxPerMM);
    ctx.fillRect(ib.x * pxPerMM, ib.y * pxPerMM, ib.w * pxPerMM, ib.h * pxPerMM);
    ctx.strokeRect(ib.x * pxPerMM, ib.y * pxPerMM, ib.w * pxPerMM, ib.h * pxPerMM);

    ctx.fillStyle = '#334155';
    ctx.font = 'bold ' + hdrFont.toFixed(1) + 'px monospace, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      'MODELO 3D (' + prog.progressPct + '%)',
      (ib.x + ib.w * 0.5) * pxPerMM,
      (ib.y + 2.2) * pxPerMM
    );

    // Base isométrica Z=0
    if (prog.isoBaseQuad && prog.isoBaseQuad.length === 4) {
      ctx.save();
      ctx.beginPath();
      prog.isoBaseQuad.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x * pxPerMM, pt.y * pxPerMM);
        else ctx.lineTo(pt.x * pxPerMM, pt.y * pxPerMM);
      });
      ctx.closePath();
      ctx.fillStyle = '#f1f5f9';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(0.5, 0.18 * pxPerMM);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Dibujar capas del modelo 3D de abajo hacia arriba (con huecos perforados mediante evenodd)
    prog.isoLayers.forEach((il) => {
      ctx.save();
      if (il.status === 'current' && il.botPoly && il.botPoly.length === il.topPoly.length) {
        // Paredes laterales 3D de las capas activas en esta hoja
        ctx.fillStyle = 'rgba(217, 119, 6, 0.55)';
        ctx.strokeStyle = 'rgba(180, 83, 9, 0.65)';
        ctx.lineWidth = Math.max(0.4, 0.15 * pxPerMM);
        for (let i = 0; i < il.topPoly.length; i++) {
          const j = (i + 1) % il.topPoly.length;
          ctx.beginPath();
          ctx.moveTo(il.topPoly[i].x * pxPerMM, il.topPoly[i].y * pxPerMM);
          ctx.lineTo(il.topPoly[j].x * pxPerMM, il.topPoly[j].y * pxPerMM);
          ctx.lineTo(il.botPoly[j].x * pxPerMM, il.botPoly[j].y * pxPerMM);
          ctx.lineTo(il.botPoly[i].x * pxPerMM, il.botPoly[i].y * pxPerMM);
          ctx.closePath();
          ctx.fill();
        }
      }

      ctx.beginPath();
      il.topPoly.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x * pxPerMM, pt.y * pxPerMM);
        else ctx.lineTo(pt.x * pxPerMM, pt.y * pxPerMM);
      });
      ctx.closePath();
      (il.holeTopPolys || []).forEach((hp) => {
        if (!hp || hp.length < 3) return;
        hp.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x * pxPerMM, pt.y * pxPerMM);
          else ctx.lineTo(pt.x * pxPerMM, pt.y * pxPerMM);
        });
        ctx.closePath();
      });

      if (il.status === 'done') {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.45)';
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = Math.max(0.6, 0.22 * pxPerMM);
        ctx.fill('evenodd');
        ctx.stroke();
      } else if (il.status === 'current') {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.88)';
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = Math.max(1.0, 0.35 * pxPerMM);
        ctx.fill('evenodd');
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = Math.max(0.5, 0.18 * pxPerMM);
        ctx.setLineDash([1.2 * pxPerMM * 0.35, 1.0 * pxPerMM * 0.35]);
        ctx.stroke();
      }
      ctx.restore();
    });

    ctx.fillStyle = '#b45309';
    ctx.font = 'bold ' + hdrFont.toFixed(1) + 'px monospace, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Hoja ' + (sheet.sheetIndex + 1) + ': Capas ' + prog.rangeLabel, (ib.x + ib.w * 0.5) * pxPerMM, (ib.y + ib.h - 1.7) * pxPerMM);
    ctx.restore();

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

    // 3. Cuerpo principal de la pieza + Huecos interiores perforados ('evenodd') + Ilustración recortada
    if (piece.bodyPolygon && piece.bodyPolygon.length >= 3) {
      ctx.save();
      ctx.beginPath();
      piece.bodyPolygon.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(toX(pt.x), toY(pt.y));
        else ctx.lineTo(toX(pt.x), toY(pt.y));
      });
      ctx.closePath();
      (piece.holePolygons || []).forEach((hp) => {
        if (!hp || hp.length < 3) return;
        hp.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(toX(pt.x), toY(pt.y));
          else ctx.lineTo(toX(pt.x), toY(pt.y));
        });
        ctx.closePath();
      });

      if (papercraftState.printStyle === 'color') {
        ctx.fillStyle = piece.colorObj ? piece.colorObj.light : '#e0f2fe';
        ctx.fill('evenodd');
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fill('evenodd');
      }

      if (piece.artworkCanvas && papercraftState.printStyle !== 'blueprint') {
        ctx.clip('evenodd');
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

    // 4. Zonas Guía de Pegado donde va pegada la siguiente capa o pestaña (respetando huecos interiores)
    (piece.glueTargetZones || []).forEach((gz) => {
      if (!gz.polygon || gz.polygon.length < 3) return;
      ctx.save();
      ctx.beginPath();
      gz.polygon.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(toX(pt.x), toY(pt.y));
        else ctx.lineTo(toX(pt.x), toY(pt.y));
      });
      ctx.closePath();
      (gz.holePolygons || []).forEach((hp) => {
        if (!hp || hp.length < 3) return;
        hp.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(toX(pt.x), toY(pt.y));
          else ctx.lineTo(toX(pt.x), toY(pt.y));
        });
        ctx.closePath();
      });
      ctx.fillStyle = gz.isTabLanding ? 'rgba(251, 191, 36, 0.25)' : 'rgba(16, 185, 129, 0.12)';
      ctx.fill('evenodd');
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

    // 6. Contornos Interiores de Huecos para Vaciar con Tijeras (holePolygons)
    if (piece.holePolygons && piece.holePolygons.length > 0) {
      piece.holePolygons.forEach((hp) => {
        if (!hp || hp.length < 3) return;
        ctx.save();
        // Sombreado sutil de vaciado interior
        ctx.beginPath();
        hp.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(toX(pt.x), toY(pt.y));
          else ctx.lineTo(toX(pt.x), toY(pt.y));
        });
        ctx.closePath();
        ctx.fillStyle = 'rgba(241, 245, 249, 0.72)';
        ctx.fill();

        // Línea de corte interior continua en carmesí (#dc2626) para distinguir el vaciado
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = Math.max(1.4, 0.46 * pxPerMM);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        // Marca escolar de pellizco central (┄✂┄) + etiqueta '✂ HUECO' si el hueco tiene tamaño suficiente
        const hb = computePolygonBounds2D(hp);
        const hwMM = hb.width * pl.scaleFit;
        const hhMM = hb.height * pl.scaleFit;
        if (hwMM >= 8 && hhMM >= 6) {
          const snipHalf = Math.min(hwMM * 0.25, 4.5) * pxPerMM;
          const hcx = toX(hb.cx);
          const hcy = toY(hb.cy);
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = Math.max(0.8, 0.25 * pxPerMM);
          ctx.setLineDash([1.5 * pxPerMM * 0.35, 1.0 * pxPerMM * 0.35]);
          ctx.beginPath();
          ctx.moveTo(hcx - snipHalf, hcy);
          ctx.lineTo(hcx + snipHalf, hcy);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#b91c1c';
          const fSz = Math.max(6.0, Math.min(2.1 * pxPerMM, hwMM * pxPerMM * 0.16));
          ctx.font = 'bold ' + fSz.toFixed(1) + 'px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✂ HUECO', hcx, hcy);
        }
        ctx.restore();
      });
    }

    // 7. Contorno Exterior de Corte con Tijeras (Línea continua gruesa + Iconos ✂)
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
  const cx = canvas.width * 0.5 + (papercraftState.view3D.panX || 0);
  const cy = canvas.height * 0.56 + (papercraftState.view3D.panY || 0);

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

      // Silueta de la figura abatiéndose desde el plano horizontal hasta 90° vertical (con huecos perforados)
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
      (layer.holePolygons || []).forEach((hp) => {
        if (!hp || hp.length < 3) return;
        hp.forEach((pt, i) => {
          const localH = Math.max(0, pt.y - b.minY);
          const y3d = yPos + localH * Math.cos(foldAngle);
          const z3d = peanaZ + localH * Math.sin(foldAngle);
          const p3 = project3D(pt.x, y3d, z3d);
          if (i === 0) ctx.moveTo(p3.x, p3.y);
          else ctx.lineTo(p3.x, p3.y);
        });
        ctx.closePath();
      });
      ctx.fillStyle = layer.colorObj ? layer.colorObj.fill + 'cc' : 'rgba(56, 189, 248, 0.8)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.fill('evenodd');
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

      // 1b. Paredes interiores de los huecos (holePolygons) en zTop..zBot
      (layer.holePolygons || []).forEach((hp) => {
        if (!hp || hp.length < 3) return;
        for (let i = 0; i < hp.length; i++) {
          const hp1 = hp[i];
          const hp2 = hp[(i + 1) % hp.length];
          const hwProj = [
            project3D(hp1.x, hp1.y, zTop),
            project3D(hp1.x, hp1.y, zBot),
            project3D(hp2.x, hp2.y, zBot),
            project3D(hp2.x, hp2.y, zTop)
          ];
          ctx.save();
          ctx.beginPath();
          hwProj.forEach((pt, idx2) => (idx2 === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
          ctx.closePath();
          ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
          ctx.strokeStyle = 'rgba(248, 113, 113, 0.65)';
          ctx.lineWidth = 1.0;
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      });

      // 2. Cara superior de la plataforma / capa en zTop (con huecos perforados mediante 'evenodd')
      const topProj = pts.map((pt) => project3D(pt.x, pt.y, zTop));
      ctx.save();
      ctx.beginPath();
      topProj.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.closePath();
      (layer.holePolygons || []).forEach((hp) => {
        if (!hp || hp.length < 3) return;
        hp.forEach((pt, i) => {
          const p3 = project3D(pt.x, pt.y, zTop);
          if (i === 0) ctx.moveTo(p3.x, p3.y);
          else ctx.lineTo(p3.x, p3.y);
        });
        ctx.closePath();
      });
      ctx.fillStyle = layer.colorObj ? layer.colorObj.fill + 'd8' : 'rgba(56, 189, 248, 0.85)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.0;
      ctx.fill('evenodd');
      ctx.stroke();

      // Etiqueta de la capa en un punto sólido (o en el borde si el centro cae dentro de un hueco)
      const labelPt2D = (layer.holePolygons && layer.holePolygons.some((hp) => isPointInPolygon2D({ x: layer.bounds.cx, y: layer.bounds.cy }, hp)))
        ? pts[0]
        : { x: layer.bounds.cx, y: layer.bounds.cy };
      const cProj = project3D(labelPt2D.x, labelPt2D.y, zTop);
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
    '🧊 Simulación 3D del Recortable Montado · Plegado: ' + Math.round(foldFrac * 100) + '% · Separación capas: ' + Math.round(explodeFrac * 100) + '% (Arrastrar: rotar · Shift + Arrastrar: desplazar)',
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

  // Cabecera escolar + Dibujo del modelo con el progreso (estilo Guía Ilustrada) en cada A4
  const prog = computeSheetModelProgressLayout(sheet);
  const txtCfg = getPapercraftHeaderTextConfig(sheet, prog);
  {
    const hBoxH = prog.hBoxH;

    lines.push('  <g id="CAJETIN_Y_PROGRESO_MODELO">');
    lines.push('    <rect x="' + m.toFixed(2) + '" y="' + m.toFixed(2) + '" width="' + (sw - m * 2).toFixed(2) + '" height="' + hBoxH.toFixed(2) + '" fill="#f8fafc" stroke="#334155" stroke-width="0.35" />');
    lines.push('    <text x="' + (m + 2.5).toFixed(2) + '" y="' + (m + 4.8).toFixed(2) + '" font-family="sans-serif" font-size="3.1" font-weight="bold" fill="#0f172a">' + escapeXml(txtCfg.mainHeaderLine) + '</text>');
    lines.push('    <text x="' + (m + 2.5).toFixed(2) + '" y="' + (m + 9.6).toFixed(2) + '" font-family="sans-serif" font-size="2.3" font-weight="bold" fill="#0369a1">' + escapeXml(txtCfg.subProgressLine) + '</text>');
    if (papercraftState.includeSchoolHeader) {
      lines.push('    <text x="' + (m + 2.5).toFixed(2) + '" y="' + (m + 14.8).toFixed(2) + '" font-family="sans-serif" font-size="2.2" fill="#334155">' + escapeXml(txtCfg.schoolMetaLine) + '</text>');
    }
    lines.push('    <text x="' + (m + 2.5).toFixed(2) + '" y="' + (m + 20.2).toFixed(2) + '" font-family="sans-serif" font-size="2.0" font-weight="bold" fill="#0f172a">' + escapeXml(txtCfg.legendLine) + '</text>');

    // Barra visual de progreso
    const barX = m + 2.5;
    const barY = m + 23.6;
    const barW = Math.max(30, prog.infoW - 5);
    const barH = 2.8;
    const doneFrac = prog.minActive / prog.totalLayers;
    const currFrac = (prog.maxActive - prog.minActive + 1) / prog.totalLayers;
    lines.push('    <rect x="' + barX.toFixed(2) + '" y="' + barY.toFixed(2) + '" width="' + barW.toFixed(2) + '" height="' + barH.toFixed(2) + '" fill="#e2e8f0" stroke="none" />');
    if (doneFrac > 0) {
      lines.push('    <rect x="' + barX.toFixed(2) + '" y="' + barY.toFixed(2) + '" width="' + (barW * doneFrac).toFixed(2) + '" height="' + barH.toFixed(2) + '" fill="#10b981" stroke="none" />');
    }
    lines.push('    <rect x="' + (barX + barW * doneFrac).toFixed(2) + '" y="' + barY.toFixed(2) + '" width="' + Math.max(1.2, barW * currFrac).toFixed(2) + '" height="' + barH.toFixed(2) + '" fill="#f59e0b" stroke="none" />');
    lines.push('    <rect x="' + barX.toFixed(2) + '" y="' + barY.toFixed(2) + '" width="' + barW.toFixed(2) + '" height="' + barH.toFixed(2) + '" fill="none" stroke="#64748b" stroke-width="0.22" />');

    const pendLabel = prog.maxActive + 1 < prog.totalLayers ? ('#' + (prog.maxActive + 2) + '..#' + prog.totalLayers) : 'Fin';
    const doneLabel = prog.minActive > 0 ? ('#1..#' + prog.minActive) : '—';
    lines.push('    <text x="' + (m + 2.5).toFixed(2) + '" y="' + (m + 30.2).toFixed(2) + '" font-family="sans-serif" font-size="2.0" font-weight="bold" fill="#334155">' + escapeXml('🟢 Montadas (' + doneLabel + ')   🟠 En esta hoja (' + prog.rangeLabel + ')   ⚪ Pendientes (' + pendLabel + ')') + '</text>');

    // ------------------------------------------------------------------------
    // PANEL DERECHO 1 (SVG): ALZADO APILADO CON PROGRESO (Estilo Guía Ilustrada)
    // ------------------------------------------------------------------------
    const eb = prog.elevBox;
    lines.push('    <g id="DIAGRAMA_ALZADO_PROGRESO">');
    lines.push('      <rect x="' + eb.x.toFixed(2) + '" y="' + eb.y.toFixed(2) + '" width="' + eb.w.toFixed(2) + '" height="' + eb.h.toFixed(2) + '" fill="#ffffff" stroke="#94a3b8" stroke-width="0.28" rx="0.8" />');
    lines.push('      <text x="' + (eb.x + eb.w * 0.5).toFixed(2) + '" y="' + (eb.y + 2.4).toFixed(2) + '" font-family="monospace, sans-serif" font-size="1.75" font-weight="bold" fill="#334155" text-anchor="middle" dominant-baseline="central">' + escapeXml('ALZADO: ' + prog.rangeLabel + '/' + prog.totalLayers + ' (EJE ' + prog.axisLabel + ')') + '</text>');
    lines.push('      <line x1="' + (prog.elevPlotX - 1.0).toFixed(2) + '" y1="' + prog.baseLineY.toFixed(2) + '" x2="' + (prog.elevPlotX + prog.elevPlotW + 1.0).toFixed(2) + '" y2="' + prog.baseLineY.toFixed(2) + '" stroke="#475569" stroke-width="0.35" />');

    prog.elevBars.forEach((bar) => {
      if (bar.status === 'done') {
        lines.push('      <rect x="' + bar.rx.toFixed(2) + '" y="' + bar.ry.toFixed(2) + '" width="' + bar.rw.toFixed(2) + '" height="' + bar.rh.toFixed(2) + '" fill="#10b981" fill-opacity="0.58" stroke="#059669" stroke-width="0.2" />');
      } else if (bar.status === 'current') {
        lines.push('      <rect x="' + bar.rx.toFixed(2) + '" y="' + bar.ry.toFixed(2) + '" width="' + bar.rw.toFixed(2) + '" height="' + bar.rh.toFixed(2) + '" fill="#f59e0b" fill-opacity="0.94" stroke="#b45309" stroke-width="0.32" />');
      } else {
        lines.push('      <rect x="' + bar.rx.toFixed(2) + '" y="' + bar.ry.toFixed(2) + '" width="' + bar.rw.toFixed(2) + '" height="' + bar.rh.toFixed(2) + '" fill="none" stroke="#94a3b8" stroke-width="0.18" stroke-dasharray="0.9,0.7" />');
      }
      if (bar.holeSpans && bar.holeSpans.length > 0 && bar.status !== 'pending') {
        bar.holeSpans.forEach((hs) => {
          lines.push('      <rect x="' + hs.hx.toFixed(2) + '" y="' + (bar.ry + 0.12).toFixed(2) + '" width="' + hs.hw.toFixed(2) + '" height="' + Math.max(0.2, bar.rh - 0.24).toFixed(2) + '" fill="#ffffff" stroke="none" />');
        });
      }
    });

    lines.push('      <line x1="' + prog.elevPlotX.toFixed(2) + '" y1="' + prog.markerY.toFixed(2) + '" x2="' + (eb.x + eb.w - 1.2).toFixed(2) + '" y2="' + prog.markerY.toFixed(2) + '" stroke="#d97706" stroke-width="0.25" stroke-dasharray="1.1,0.7" />');
    lines.push('      <text x="' + (eb.x + eb.w - 0.8).toFixed(2) + '" y="' + prog.markerY.toFixed(2) + '" font-family="monospace, sans-serif" font-size="1.75" font-weight="bold" fill="#b45309" text-anchor="end" dominant-baseline="central">' + escapeXml('◀' + prog.rangeLabel) + '</text>');
    lines.push('      <text x="' + (eb.x + eb.w * 0.5).toFixed(2) + '" y="' + (eb.y + eb.h - 1.6).toFixed(2) + '" font-family="monospace, sans-serif" font-size="1.7" fill="#475569" text-anchor="middle" dominant-baseline="central">' + escapeXml('▲ BASE #1 (' + prog.accumHeightMM + ' mm)') + '</text>');
    lines.push('    </g>');

    // ------------------------------------------------------------------------
    // PANEL DERECHO 2 (SVG): DIBUJO 3D DEL MODELO CON EL PROGRESO (Y HUECOS)
    // ------------------------------------------------------------------------
    const ib = prog.isoBox;
    lines.push('    <g id="DIAGRAMA_MODELO_3D_PROGRESO">');
    lines.push('      <rect x="' + ib.x.toFixed(2) + '" y="' + ib.y.toFixed(2) + '" width="' + ib.w.toFixed(2) + '" height="' + ib.h.toFixed(2) + '" fill="#ffffff" stroke="#94a3b8" stroke-width="0.28" rx="0.8" />');
    lines.push('      <text x="' + (ib.x + ib.w * 0.5).toFixed(2) + '" y="' + (ib.y + 2.4).toFixed(2) + '" font-family="monospace, sans-serif" font-size="1.75" font-weight="bold" fill="#334155" text-anchor="middle" dominant-baseline="central">' + escapeXml('MODELO 3D (' + prog.progressPct + '%)') + '</text>');

    if (prog.isoBaseQuad && prog.isoBaseQuad.length === 4) {
      const dBase = 'M ' + prog.isoBaseQuad.map((p) => p.x.toFixed(2) + ' ' + p.y.toFixed(2)).join(' L ') + ' Z';
      lines.push('      <path d="' + dBase + '" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.18" />');
    }

    prog.isoLayers.forEach((il) => {
      if (il.status === 'current' && il.botPoly && il.botPoly.length === il.topPoly.length) {
        for (let i = 0; i < il.topPoly.length; i++) {
          const j = (i + 1) % il.topPoly.length;
          const dWall = 'M ' + il.topPoly[i].x.toFixed(2) + ' ' + il.topPoly[i].y.toFixed(2) +
            ' L ' + il.topPoly[j].x.toFixed(2) + ' ' + il.topPoly[j].y.toFixed(2) +
            ' L ' + il.botPoly[j].x.toFixed(2) + ' ' + il.botPoly[j].y.toFixed(2) +
            ' L ' + il.botPoly[i].x.toFixed(2) + ' ' + il.botPoly[i].y.toFixed(2) + ' Z';
          lines.push('      <path d="' + dWall + '" fill="#d97706" fill-opacity="0.55" stroke="none" />');
        }
      }
      let dTop = 'M ' + il.topPoly.map((p) => p.x.toFixed(2) + ' ' + p.y.toFixed(2)).join(' L ') + ' Z';
      (il.holeTopPolys || []).forEach((hp) => {
        if (!hp || hp.length < 3) return;
        dTop += ' M ' + hp.map((p) => p.x.toFixed(2) + ' ' + p.y.toFixed(2)).join(' L ') + ' Z';
      });
      if (il.status === 'done') {
        lines.push('      <path d="' + dTop + '" fill-rule="evenodd" fill="#10b981" fill-opacity="0.45" stroke="#059669" stroke-width="0.22" />');
      } else if (il.status === 'current') {
        lines.push('      <path d="' + dTop + '" fill-rule="evenodd" fill="#f59e0b" fill-opacity="0.88" stroke="#b45309" stroke-width="0.35" />');
      } else {
        lines.push('      <path d="' + dTop + '" fill="none" stroke="#94a3b8" stroke-width="0.18" stroke-dasharray="0.9,0.7" />');
      }
    });

    lines.push('      <text x="' + (ib.x + ib.w * 0.5).toFixed(2) + '" y="' + (ib.y + ib.h - 1.6).toFixed(2) + '" font-family="monospace, sans-serif" font-size="1.7" font-weight="bold" fill="#b45309" text-anchor="middle" dominant-baseline="central">' + escapeXml('Hoja ' + (sheet.sheetIndex + 1) + ': Capas ' + prog.rangeLabel) + '</text>');
    lines.push('    </g>');
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

    // 2. Cuerpo e ilustración recortada (con huecos interiores perforados mediante fill-rule/clip-rule="evenodd")
    if (piece.bodyPolygon && piece.bodyPolygon.length >= 3) {
      let dBody = 'M ' + piece.bodyPolygon.map((p) => toX(p.x) + ' ' + toY(p.y)).join(' L ') + ' Z';
      (piece.holePolygons || []).forEach((hp) => {
        if (!hp || hp.length < 3) return;
        dBody += ' M ' + hp.map((p) => toX(p.x) + ' ' + toY(p.y)).join(' L ') + ' Z';
      });
      const fillBody = papercraftState.printStyle === 'color' && piece.colorObj ? piece.colorObj.light : '#ffffff';
      lines.push('    <path d="' + dBody + '" fill-rule="evenodd" fill="' + fillBody + '" stroke="none" />');

      if (piece.artworkCanvas && papercraftState.printStyle !== 'blueprint') {
        const ab = piece.artworkBounds || computePolygonBounds2D(piece.bodyPolygon);
        const ax = pl.toSheetX(ab.minX).toFixed(3);
        const ay = pl.toSheetY(ab.maxY).toFixed(3);
        const aw = (ab.width * pl.scaleFit).toFixed(3);
        const ah = (ab.height * pl.scaleFit).toFixed(3);
        const dataUrl = piece.artworkCanvas.toDataURL('image/png');
        lines.push('    <clipPath id="' + clipId + '"><path d="' + dBody + '" clip-rule="evenodd" /></clipPath>');
        lines.push('    <image x="' + ax + '" y="' + ay + '" width="' + aw + '" height="' + ah + '" href="' + dataUrl + '" clip-path="url(#' + clipId + ')" opacity="0.9" />');
      }
    }

    // 3. Zonas guía de recepción de pegamento (respetando huecos interiores)
    if (piece.glueTargetZones && piece.glueTargetZones.length > 0) {
      lines.push('    <g id="ZONAS_PEGADO_' + (pIdx + 1) + '">');
      piece.glueTargetZones.forEach((gz) => {
        if (!gz.polygon || gz.polygon.length < 3) return;
        let dZone = 'M ' + gz.polygon.map((p) => toX(p.x) + ' ' + toY(p.y)).join(' L ') + ' Z';
        (gz.holePolygons || []).forEach((hp) => {
          if (!hp || hp.length < 3) return;
          dZone += ' M ' + hp.map((p) => toX(p.x) + ' ' + toY(p.y)).join(' L ') + ' Z';
        });
        const strokeCol = gz.isTabLanding ? '#d97706' : '#059669';
        const fillCol = gz.isTabLanding ? '#fef3c7' : '#d1fae5';
        lines.push('      <path d="' + dZone + '" fill-rule="evenodd" fill="' + fillCol + '" fill-opacity="0.45" stroke="' + strokeCol + '" stroke-width="0.32" stroke-dasharray="1.8,1.4" />');
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

    // 5. Contornos interiores de huecos para vaciar con tijeras (#dc2626) + guía de pellizco central
    if (piece.holePolygons && piece.holePolygons.length > 0) {
      lines.push('    <g id="CORTE_HUECOS_INTERIORES_' + (pIdx + 1) + '">');
      piece.holePolygons.forEach((hp) => {
        if (!hp || hp.length < 3) return;
        const dHole = 'M ' + hp.map((p) => toX(p.x) + ' ' + toY(p.y)).join(' L ') + ' Z';
        lines.push('      <path d="' + dHole + '" fill="#f1f5f9" fill-opacity="0.72" stroke="#dc2626" stroke-width="0.46" stroke-linejoin="round" stroke-linecap="round" />');
        const hb = computePolygonBounds2D(hp);
        const hwMM = hb.width * pl.scaleFit;
        const hhMM = hb.height * pl.scaleFit;
        if (hwMM >= 8 && hhMM >= 6) {
          const snipHalf = Math.min(hwMM * 0.25, 4.5);
          const hcx = pl.toSheetX(hb.cx);
          const hcy = pl.toSheetY(hb.cy);
          lines.push('      <line x1="' + (hcx - snipHalf).toFixed(3) + '" y1="' + hcy.toFixed(3) + '" x2="' + (hcx + snipHalf).toFixed(3) + '" y2="' + hcy.toFixed(3) + '" stroke="#dc2626" stroke-width="0.25" stroke-dasharray="1.0,0.7" />');
          lines.push('      <text x="' + hcx.toFixed(3) + '" y="' + hcy.toFixed(3) + '" font-family="sans-serif" font-size="2.0" font-weight="bold" fill="#b91c1c" text-anchor="middle" dominant-baseline="central">✂ HUECO</text>');
        }
      });
      lines.push('    </g>');
    }

    // 6. Línea exterior de corte con tijeras (#0f172a) + símbolos ✂
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

  const escapeHtml = typeof escapeXmlAttr === 'function'
    ? escapeXmlAttr
    : (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const txtCfg = getPapercraftHeaderTextConfig(papercraftState.packedSheets[0], null);

  const svgsHtml = papercraftState.packedSheets.map((sh) => {
    const svgRaw = generatePapercraftSheetSVG(sh).replace(/<\?xml[^>]*\?>\s*/i, '');
    return '<div class="sheet-page">' + svgRaw + '</div>';
  }).join('\n');

  return [
    '<!DOCTYPE html>',
    '<html lang="es">',
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <title>' + escapeHtml(txtCfg.bookletTitle) + '</title>',
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
    '    <div><strong>✂️ ' + escapeHtml(txtCfg.bookletTitle) + '</strong> · ' + escapeHtml(txtCfg.bookletMetaSummary) + '</div>',
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
  const txtCfg = getPapercraftHeaderTextConfig(null, null);
  const filename = txtCfg.safeFileSlug + '_CUADERNO_RECORTABLE_A4.html';
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
  const txtCfg = getPapercraftHeaderTextConfig(sheet, null);
  const filename = txtCfg.safeFileSlug + '_HOJA_' + (activeIdx + 1) + '_TIJERAS_Y_PESTANAS.svg';
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

  // Filtrar las piezas principales de capa (1 por nivel) para que state.sliceCount y state.slices.length coincidan exactamente con 2. Sistema Constructivo
  const mainLayerPieces = pieces.filter((p) => !p.isSpacerPiece && !p.isPeanaBase && !p.isCollarStrip);
  const studioPieces = mainLayerPieces.length > 0 ? mainLayerPieces : pieces;

  const wallH = Math.max(4, Number(papercraftState.wallHeightMM) || 14);
  const totalZ = studioPieces.length * wallH;

  let maxSpanX = 120;
  let maxSpanY = 120;
  studioPieces.forEach((p) => {
    if (p.bounds.width > maxSpanX) maxSpanX = p.bounds.width;
    if (p.bounds.height > maxSpanY) maxSpanY = p.bounds.height;
  });

  const targetAxis = papercraftState.sliceAxis || state.axis || 'z';
  state.constructionMode = 'stacked';
  state.axis = targetAxis;
  state.mode = 'count';
  state.papercraftActiveInStudio = true;
  state.papercraftCutoutType = papercraftState.cutoutType;
  state.papercraftTabDepthMM = papercraftState.tabDepthMM;
  state.papercraftWallHeightMM = wallH;
  state.thickness = wallH;
  state.sliceCount = studioPieces.length;
  papercraftState.layersCount = studioPieces.length;

  const sSlider = document.getElementById('sliceCountSlider');
  const sLabel = document.getElementById('sliceCountLabel');
  if (sSlider) sSlider.value = String(studioPieces.length);
  if (sLabel) sLabel.textContent = String(studioPieces.length);

  state.dimsMM = {
    x: Number((maxSpanX + 12).toFixed(1)),
    y: Number((maxSpanY + 12).toFixed(1)),
    z: Number(totalZ.toFixed(1))
  };

  state.slices = studioPieces.map((piece, idx) => {
    const zCoord = -totalZ * 0.5 + (idx + 0.5) * wallH;
    const areaVal = Math.abs(computeSignedPolygonArea(piece.outerCutPoints));
    const cutLoop = {
      points: piece.outerCutPoints.map((pt) => ({ x: pt.x, y: pt.y })),
      absArea: areaVal,
      signedArea: areaVal,
      isHole: false
    };

    // Incluir los huecos interiores de cada capa 3D / imagen como lazos con isHole: true para extrusión 3D y corte en el estudio principal
    const holeLoops = (piece.holePolygons || [])
      .filter((hp) => hp && hp.length >= 3)
      .map((hp) => {
        const hArea = Math.abs(computeSignedPolygonArea(hp));
        return {
          points: hp.map((pt) => ({ x: pt.x, y: pt.y })),
          absArea: hArea,
          signedArea: -hArea,
          isHole: true
        };
      });
    const allCutLoops = [cutLoop, ...holeLoops];

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
      sliceAxis: targetAxis,
      puzzleCode: piece.shortCode,
      selected: true,
      rawLoops: allCutLoops,
      modelLoops: allCutLoops,
      unsplitLoops: allCutLoops,
      loops: allCutLoops,
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
        holePolygons: piece.holePolygons || [],
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
  if (typeof syncConstructionModeUI === 'function') syncConstructionModeUI();
  if (typeof updateConstructionModeUI === 'function') updateConstructionModeUI();
  if (typeof build3DSlicesMesh === 'function') build3DSlicesMesh();
  if (typeof rebuild3DSlicesMeshes === 'function') rebuild3DSlicesMeshes();
  if (typeof renderSliceStripUI === 'function') renderSliceStripUI();
  if (typeof buildBottomStrip === 'function') buildBottomStrip();
  if (typeof update2DInspectorHeader === 'function') update2DInspectorHeader();
  if (typeof reset2DView === 'function') reset2DView(true);
  if (typeof render2DSlice === 'function') render2DSlice();

  const badge = document.getElementById('constructionModeBadge');
  if (badge) {
    badge.textContent = '✂️ Recortable (' + studioPieces.length + ' capas)';
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
  const rawPieces = buildPapercraftPieces();
  papercraftState.generatedPieces = applyCustomTextsToPapercraftPieces(rawPieces);
  papercraftState.packedSheets = packPapercraftPiecesIntoSheets(papercraftState.generatedPieces);
  if (papercraftState.activeSheetIndex >= papercraftState.packedSheets.length) {
    papercraftState.activeSheetIndex = 0;
  }
  renderPapercraftPieceTitlesEditorUI();
  updatePapercraftStatsAndSheetNavUI();
  renderPapercraftPreviewCanvas();
}

function renderPapercraftPieceTitlesEditorUI() {
  const container = document.getElementById('pcPieceTitlesListContainer');
  if (!container) return;
  const pieces = papercraftState.generatedPieces || [];
  if (pieces.length === 0) {
    container.innerHTML = '<div class="text-[10px] text-slate-400 py-1">No hay piezas generadas todavía.</div>';
    return;
  }
  const escapeAttr = typeof escapeXmlAttr === 'function'
    ? escapeXmlAttr
    : (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  container.innerHTML = pieces.map((p) => {
    const code = p.shortCode || 'P';
    const currVal = (papercraftState.customPieceTitles && papercraftState.customPieceTitles[code]) || '';
    const placeholderText = p.defaultTitle || p.title || '';
    return (
      '<div class="flex items-center gap-1.5 bg-slate-950/90 border border-slate-800 rounded px-1.5 py-1">' +
        '<span class="font-mono font-bold text-[10px] text-amber-300 shrink-0 min-w-[44px]">[' + escapeAttr(code) + ']</span>' +
        '<input type="text" data-piece-code="' + escapeAttr(code) + '" value="' + escapeAttr(currVal) + '" placeholder="' + escapeAttr(placeholderText) + '" oninput="onPapercraftIndividualPieceTitleInput(this.dataset.pieceCode, this.value)" class="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 rounded px-1.5 py-0.5 text-[10px] text-slate-100 outline-none" />' +
      '</div>'
    );
  }).join('');
}

function onPapercraftIndividualPieceTitleInput(shortCode, value) {
  if (!shortCode) return;
  if (!papercraftState.customPieceTitles) {
    papercraftState.customPieceTitles = {};
  }
  const trimmed = String(value == null ? '' : value);
  if (trimmed.trim()) {
    papercraftState.customPieceTitles[shortCode] = trimmed;
  } else {
    delete papercraftState.customPieceTitles[shortCode];
  }
  applyCustomTextsToPapercraftPieces(papercraftState.generatedPieces);
  renderPapercraftPreviewCanvas();
}

function onPapercraftTextChange() {
  const getVal = (id, fallback) => {
    const el = document.getElementById(id);
    return el ? el.value : fallback;
  };
  papercraftState.customTitle = getVal('pcCustomTitleInput', papercraftState.customTitle || '');
  papercraftState.customAuthor = getVal('pcCustomAuthorInput', papercraftState.customAuthor || '');
  papercraftState.customCourseCenter = getVal('pcCustomCourseInput', papercraftState.customCourseCenter || '');
  papercraftState.customDate = getVal('pcCustomDateInput', papercraftState.customDate || '');
  papercraftState.customSubtitleNote = getVal('pcCustomNoteInput', papercraftState.customSubtitleNote || '');
  papercraftState.customPiecePrefix = getVal('pcCustomPiecePrefixInput', papercraftState.customPiecePrefix || '');
  papercraftState.customGlueWord = getVal('pcCustomGlueWordInput', papercraftState.customGlueWord || 'PEGAR') || 'PEGAR';

  applyCustomTextsToPapercraftPieces(papercraftState.generatedPieces);
  renderPapercraftPieceTitlesEditorUI();
  renderPapercraftPreviewCanvas();
}

function resetPapercraftCustomTexts() {
  papercraftState.customTitle = '';
  papercraftState.customAuthor = '';
  papercraftState.customCourseCenter = '';
  papercraftState.customDate = '';
  papercraftState.customSubtitleNote = '';
  papercraftState.customPiecePrefix = '';
  papercraftState.customGlueWord = 'PEGAR';
  papercraftState.customPieceTitles = {};

  syncPapercraftControlsUI();
  applyCustomTextsToPapercraftPieces(papercraftState.generatedPieces);
  renderPapercraftPieceTitlesEditorUI();
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

function onPapercraftParamsChange(sourceControlId) {
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

  let requestedLayers = papercraftState.layersCount;
  if (sourceControlId === 'pcLayersCountNumberInput') {
    requestedLayers = Math.max(2, Math.min(300, Math.round(getNum('pcLayersCountNumberInput', papercraftState.layersCount))));
  } else if (sourceControlId === 'pcLayersCountInput') {
    requestedLayers = Math.max(2, Math.min(300, Math.round(getNum('pcLayersCountInput', papercraftState.layersCount))));
  } else {
    const sliderEl = document.getElementById('pcLayersCountInput');
    if (sliderEl) {
      requestedLayers = Math.max(2, Math.min(300, Math.round(getNum('pcLayersCountInput', papercraftState.layersCount))));
    }
  }
  const requestedAxis = getVal('pcSliceAxisSelect', papercraftState.sliceAxis);

  if (requestedLayers !== papercraftState.layersCount || requestedAxis !== papercraftState.sliceAxis) {
    syncConstructiveSystemFromPapercraft(requestedLayers, requestedAxis);
  }

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

  const sLayers = document.getElementById('pcLayersCountInput');
  if (sLayers) sLayers.value = String(papercraftState.layersCount);

  const nLayers = document.getElementById('pcLayersCountNumberInput');
  if (nLayers) nLayers.value = String(papercraftState.layersCount);

  const lblLayers = document.getElementById('pcLayersCountLabel');
  if (lblLayers) lblLayers.textContent = String(papercraftState.layersCount);

  const axSel = document.getElementById('pcSliceAxisSelect');
  if (axSel) axSel.value = papercraftState.sliceAxis || 'z';

  const syncBadge = document.getElementById('pcSystemSyncBadge');
  if (syncBadge) {
    const axUp = (papercraftState.sliceAxis || 'z').toUpperCase();
    const modeName = typeof state !== 'undefined' && state.constructionMode === 'puzzle3d'
      ? ('Puzzle 3D · Eje ' + axUp)
      : ('Apilado · Eje ' + axUp);
    syncBadge.textContent = '🔗 = 2. Sistema Constructivo (' + modeName + ': ' + papercraftState.layersCount + ' capas)';
  }

  const lblFold = document.getElementById('pcFoldValLabel');
  if (lblFold) lblFold.textContent = Math.round(papercraftState.foldProgressPct) + '%';

  const lblExplode = document.getElementById('pcExplodeValLabel');
  if (lblExplode) lblExplode.textContent = Math.round(papercraftState.explodeLayersPct) + '%';

  const setInputValIfDiff = (id, val) => {
    const el = document.getElementById(id);
    if (el && el.value !== String(val == null ? '' : val)) {
      el.value = String(val == null ? '' : val);
    }
  };
  setInputValIfDiff('pcCustomTitleInput', papercraftState.customTitle || '');
  setInputValIfDiff('pcCustomAuthorInput', papercraftState.customAuthor || '');
  setInputValIfDiff('pcCustomCourseInput', papercraftState.customCourseCenter || '');
  setInputValIfDiff('pcCustomDateInput', papercraftState.customDate || '');
  setInputValIfDiff('pcCustomNoteInput', papercraftState.customSubtitleNote || '');
  setInputValIfDiff('pcCustomPiecePrefixInput', papercraftState.customPiecePrefix || '');
  setInputValIfDiff('pcCustomGlueWordInput', papercraftState.customGlueWord || 'PEGAR');
}

function openPapercraftModal(initialSourceMode) {
  const modal = document.getElementById('papercraftModal');
  if (!modal) return;
  if (initialSourceMode && ['model3d', 'single_image', 'multi_images'].includes(initialSourceMode)) {
    papercraftState.sourceMode = initialSourceMode;
  }
  // Sincronizar siempre el número de capas y el eje con 2. Sistema Constructivo al abrir
  syncPapercraftWithConstructiveSystem(false);

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
  papercraftState.view3D.panX = 0;
  papercraftState.view3D.panY = 0;
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

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.14 : 0.88;
    zoomPapercraftViewport(factor);
  }, { passive: false });

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    if (papercraftState.previewMode === 'assembled3d') {
      papercraftState.view3D.isDragging = true;
      papercraftState.view3D.dragButton = e.button;
      papercraftState.view3D.startX = e.clientX;
      papercraftState.view3D.startY = e.clientY;
      papercraftState.view3D.lastX = e.clientX;
      papercraftState.view3D.lastY = e.clientY;
      papercraftState.view3D.startYaw = papercraftState.view3D.yaw;
      papercraftState.view3D.startPitch = papercraftState.view3D.pitch;
      papercraftState.view3D.startPanX = papercraftState.view3D.panX || 0;
      papercraftState.view3D.startPanY = papercraftState.view3D.panY || 0;
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
      const stepDx = e.clientX - papercraftState.view3D.lastX;
      const stepDy = e.clientY - papercraftState.view3D.lastY;
      papercraftState.view3D.lastX = e.clientX;
      papercraftState.view3D.lastY = e.clientY;

      const isPanGesture = e.shiftKey || e.ctrlKey || e.metaKey || papercraftState.view3D.dragButton === 1 || papercraftState.view3D.dragButton === 2;
      if (isPanGesture) {
        papercraftState.view3D.panX = (papercraftState.view3D.panX || 0) + stepDx;
        papercraftState.view3D.panY = (papercraftState.view3D.panY || 0) + stepDy;
      } else {
        papercraftState.view3D.yaw += stepDx * 0.01;
        papercraftState.view3D.pitch = Math.max(0.08, Math.min(1.45, papercraftState.view3D.pitch + stepDy * 0.01));
      }
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
  window.getConstructiveSystemAxis = getConstructiveSystemAxis;
  window.getConstructiveSystemLayerCount = getConstructiveSystemLayerCount;
  window.syncPapercraftWithConstructiveSystem = syncPapercraftWithConstructiveSystem;
  window.syncConstructiveSystemFromPapercraft = syncConstructiveSystemFromPapercraft;
  window.stepPapercraftLayersCount = stepPapercraftLayersCount;
  window.openPapercraftModal = openPapercraftModal;
  window.closePapercraftModal = closePapercraftModal;
  window.openPapercraftFromVectorizer = openPapercraftFromVectorizer;
  window.setPapercraftSourceMode = setPapercraftSourceMode;
  window.setPapercraftCutoutType = setPapercraftCutoutType;
  window.setPapercraftPreviewMode = setPapercraftPreviewMode;
  window.onPapercraftParamsChange = onPapercraftParamsChange;
  window.onPapercraftTextChange = onPapercraftTextChange;
  window.onPapercraftIndividualPieceTitleInput = onPapercraftIndividualPieceTitleInput;
  window.resetPapercraftCustomTexts = resetPapercraftCustomTexts;
  window.renderPapercraftPieceTitlesEditorUI = renderPapercraftPieceTitlesEditorUI;
  window.applyCustomTextsToPapercraftPieces = applyCustomTextsToPapercraftPieces;
  window.getPapercraftHeaderTextConfig = getPapercraftHeaderTextConfig;
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
  window.computeSheetModelProgressLayout = computeSheetModelProgressLayout;
  window.buildPapercraftPrintableHTMLDocument = buildPapercraftPrintableHTMLDocument;
  window.applyPapercraftToMainStudio = applyPapercraftToMainStudio;

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('DOMContentLoaded', () => {
      syncPapercraftWithConstructiveSystem(false);
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
