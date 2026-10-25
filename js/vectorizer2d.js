/**
 * LayerStudio 3D — Vectorizador Automático 2D (PNG / BMP / JPG / WEBP -> SVG / DXF de Corte y Grabado Láser + Relieve 3D)
 * Copyright (C) 2026 Norberto Martín Afonso <normaafo@gmail.com>
 * Licencia: GNU Affero General Public License v3.0 (AGPL-3.0-or-later) - Sección 7(b)
 */

const vec2dState = {
  imageName: 'Ilustracion_Laser_Demo',
  sourceCanvas: null,
  sourceWidth: 0,
  sourceHeight: 0,
  aspectRatio: 1.0,

  // Dimensiones físicas de salida (mm)
  widthMM: 100.0,
  heightMM: 100.0,
  lockAspect: true,
  traceResolution: 420,         // Resolución de malla sub-píxel (280 | 420 | 580)

  // Configuración de Silueta de CORTE (#ff0000 Exterior / #0055ff Huecos)
  cutMode: 'silhouette',        // 'silhouette' | 'rounded_rect' | 'circle' | 'none'
  bgDetectMode: 'auto',         // 'auto' (alfa o esquinas) | 'alpha' | 'luma_light' | 'luma_dark'
  bgTolerance: 38,              // Tolerancia 0..120 para separar fondo
  cutOffsetMM: 1.8,             // Margen de silueta exterior en mm (ej. +1.8 mm borde sticker)
  cutInternalHoles: true,       // Cortar huecos pasantes interiores (#0055ff)
  cornerRadiusMM: 6.0,          // Radio para modo placa rectangular

  // Perforación opcional para llavero / colgante
  keyholeEnabled: false,
  keyholeDiameterMM: 4.5,
  keyholePos: 'top_center',     // 'top_center' | 'top_left' | 'left_center'

  // Configuración de MARCO CONFIGURABLE (Orla Grabada y/o Borde de Corte)
  frameEnabled: false,                // Activar marco alrededor del diseño
  frameShape: 'rounded_rect',         // 'rounded_rect' | 'circle' | 'octagon' | 'arch' | 'hexagon' | 'silhouette'
  frameLaserMode: 'cut_and_engrave',  // 'cut_and_engrave' | 'engrave_only' | 'cut_window' | 'cut_outer'
  frameStyle: 'solid_band',           // 'solid_band' | 'double_line' | 'ornate_corners'
  frameThicknessMM: 3.5,              // Grosor de la banda del marco en mm (0.5..40)
  frameMarginMM: 2.5,                 // Margen interior entre la imagen y el marco en mm (-20..50)
  frameCornerRadiusMM: 8.0,           // Radio de esquina o chaflán en mm (0..80)

  // Configuración avanzada de DETECCIÓN DE DIBUJO Y GRABADO LÁSER (#008800 / #ff8800)
  engraveDetectMode: 'smart_drawing', // 'smart_drawing' | 'line_art' | 'shaded_art' | 'global_threshold'
  engraveStyle: 'vector_fill',        // 'vector_fill' | 'vector_outline' | 'vector_hatch' | 'hybrid_raster'
  engraveThreshold: 148,              // Umbral base 0..255 de luminancia
  localContrastSens: 68,              // Sensibilidad adaptativa local a trazos y líneas de dibujo (0..100)
  strokeBoostPx: 0.35,                // Refuerzo sub-píxel de grosor de línea (-1.0 a +2.0 px)
  invertEngrave: false,               // Invertir claro/oscuro en el grabado
  detectFineEdges: true,              // Extraer líneas secundarias / bordes cromáticos (#ff8800)
  edgeSensitivity: 58,                // Sensibilidad Sobel / color 10..100
  hatchSpacingMM: 0.8,                // Paso de trama vectorial en mm (para modo vector_hatch)
  hatchCross: false,                  // Trama cruzada 45° / -45°

  // Suavizado y limpieza geométrica
  minSpeckleMM2: 0.12,          // Descartar motas menores a X mm² (bajo por defecto para preservar detalles de dibujo)
  simplifyTolMM: 0.07,          // Tolerancia Ramer-Douglas-Peucker en mm (alta fidelidad en curvas y trazos)
  smoothIterations: 2,          // Iteraciones de suavizado Chaikin (0..4)

  // Vista previa en el modal
  previewMode: 'combined',      // 'combined' | 'cut_only' | 'engrave_only' | 'original'
  reliefLayersCount: 4,         // Capas para envío como Relieve 3D Multicapa

  // Resultados calculados listos para exportar
  result: {
    outerCutLoops: [],          // [{ points: [{x,y}], areaMM2 }] en coordenadas centradas (-W/2..W/2, -H/2..H/2)
    holeCutLoops: [],           // [{ points: [{x,y}], areaMM2 }]
    engraveLoops: [],           // [{ points: [{x,y}], isHole, areaMM2 }]
    frameEngraveLoops: [],      // [{ points: [{x,y}], isHole, areaMM2, isFrame: true }]
    fineEdgeLoops: [],          // [{ points: [{x,y}], isHole, areaMM2 }]
    hatchPolylines: [],         // [[{x,y}, {x,y}]]
    processedDataUrl: '',       // PNG de alto contraste para modo hybrid_raster
    totalWidthMM: 100.0,
    totalHeightMM: 100.0,
    stats: {
      cutOuterCount: 0,
      cutHoleCount: 0,
      engraveIslandCount: 0,
      fineEdgeCount: 0,
      hatchLinesCount: 0,
      totalNodes: 0
    }
  }
};

// ============================================================================
// GENERADOR DE IMÁGENES DEMO INTEGRADAS (INCLUYE DIBUJO ILUSTRADO DETALLADO)
// ============================================================================
function createDemoBitmapCanvas(presetName = 'drawing') {
  const c = document.createElement('canvas');
  c.width = 480;
  c.height = 480;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 480, 480);

  if (presetName === 'drawing') {
    // Ilustración detallada tipo grabado / dibujo entintado con colores, plumas y líneas finas (Búho Mecánico / Artístico)
    ctx.save();
    // Silueta exterior del dibujo sobre fondo transparente
    ctx.fillStyle = '#fdfbf7';
    ctx.beginPath();
    ctx.ellipse(240, 255, 145, 175, 0, 0, Math.PI * 2);
    ctx.fill();
    // Penachos / orejas superiores
    ctx.beginPath();
    ctx.moveTo(115, 145);
    ctx.quadraticCurveTo(85, 55, 175, 95);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(365, 145);
    ctx.quadraticCurveTo(395, 55, 305, 95);
    ctx.closePath();
    ctx.fill();

    // Zonas coloreadas suaves para demostrar que el detector adaptativo extrae las líneas sin empastar el color
    ctx.fillStyle = '#dbeafe';
    ctx.beginPath();
    ctx.ellipse(240, 285, 105, 120, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.arc(182, 185, 52, 0, Math.PI * 2);
    ctx.arc(298, 185, 52, 0, Math.PI * 2);
    ctx.fill();

    // Contorno principal entintado del dibujo
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.ellipse(240, 255, 138, 168, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Ojos detallados con múltiples anillos finos y pupilas con brillo
    [182, 298].forEach((ox) => {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(ox, 185, 50, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ox, 185, 38, 0, Math.PI * 2);
      ctx.stroke();

      // Rayos finos del iris
      for (let k = 0; k < 16; k++) {
        const a = (k * Math.PI * 2) / 16;
        ctx.beginPath();
        ctx.moveTo(ox + Math.cos(a) * 20, 185 + Math.sin(a) * 20);
        ctx.lineTo(ox + Math.cos(a) * 37, 185 + Math.sin(a) * 37);
        ctx.stroke();
      }

      // Pupila sólida con reserva blanca
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(ox, 185, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ox - 6, 178, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Pico central geométrico
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(240, 198);
    ctx.lineTo(262, 228);
    ctx.lineTo(240, 262);
    ctx.lineTo(218, 228);
    ctx.closePath();
    ctx.fill();

    // Plumas del pecho (arcos escalonados finos de dibujo)
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4.2;
    for (let row = 0; row < 4; row++) {
      const yBase = 285 + row * 28;
      const cols = 4 - (row % 2);
      for (let col = 0; col < cols; col++) {
        const xCenter = 240 + (col - (cols - 1) * 0.5) * 42;
        ctx.beginPath();
        ctx.arc(xCenter, yBase, 18, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
    }

    // Alas laterales con trazos de plumas
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(118, 225);
    ctx.quadraticCurveTo(155, 295, 138, 375);
    ctx.moveTo(362, 225);
    ctx.quadraticCurveTo(325, 295, 342, 375);
    ctx.stroke();

    ctx.restore();
    vec2dState.imageName = 'Ilustracion_Buho_Grabado';
  } else if (presetName === 'crest') {
    // Escudo con hueco interior y grabado técnico
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(240, 38);
    ctx.lineTo(408, 98);
    ctx.lineTo(408, 258);
    ctx.quadraticCurveTo(408, 390, 240, 446);
    ctx.quadraticCurveTo(72, 390, 72, 258);
    ctx.lineTo(72, 98);
    ctx.closePath();
    ctx.fillStyle = '#f8fafc';
    ctx.fill();

    // Dos huecos pasantes superiores (transparentes)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(168, 110, 19, 0, Math.PI * 2);
    ctx.arc(312, 110, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Grabado interior negro (marco interno, rosa de los vientos y texto)
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(240, 67);
    ctx.lineTo(379, 118);
    ctx.lineTo(379, 252);
    ctx.quadraticCurveTo(379, 360, 240, 412);
    ctx.quadraticCurveTo(101, 360, 101, 252);
    ctx.lineTo(101, 118);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.translate(240, 246);
      ctx.rotate((i * Math.PI) / 4);
      ctx.beginPath();
      ctx.moveTo(0, -90);
      ctx.lineTo(16, -26);
      ctx.lineTo(-16, -26);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(240, 246, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(240, 246, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CANARIAS', 240, 170);
    ctx.restore();
    vec2dState.imageName = 'Escudo_Laser_Canarias';
  } else if (presetName === 'medallion') {
    // Medallón geométrico mandala con calados y grabados
    ctx.save();
    ctx.beginPath();
    ctx.arc(240, 240, 198, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 12; i++) {
      const ang = (i * Math.PI * 2) / 12;
      const hx = 240 + Math.cos(ang) * 163;
      const hy = 240 + Math.sin(ang) * 163;
      ctx.beginPath();
      ctx.arc(hx, hy, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(240, 240, 130, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#111827';
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.translate(240, 240);
      ctx.rotate((i * Math.PI) / 4);
      ctx.beginPath();
      ctx.ellipse(0, -72, 19, 43, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(240, 240, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    vec2dState.imageName = 'Mandala_Calado_Laser';
  } else {
    // Emblema / Llavero Maker con montañas, silueta troquelada y texto grabado
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(240, 222, 165, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(90, 306, 300, 88, 28) : ctx.rect(90, 306, 300, 88);
    ctx.fill();

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(240, 216, 136, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(288, 154, 26, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(125, 278);
    ctx.lineTo(202, 156);
    ctx.lineTo(274, 278);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(210, 278);
    ctx.lineTo(286, 182);
    ctx.lineTo(355, 278);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 39px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LAYER 3D', 240, 365);
    ctx.restore();
    vec2dState.imageName = 'Insignia_Layer3D_Demo';
  }

  return c;
}

// ============================================================================
// APERTURA / CIERRE DEL MODAL Y CARGA DE ARCHIVOS PNG / BMP / JPG / WEBP
// ============================================================================
function openImageVectorizerModal(presetIfEmpty) {
  const modal = document.getElementById('imageVectorizerModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  if (typeof bindVectorizerEditorCanvasEvents === 'function') {
    bindVectorizerEditorCanvasEvents();
  }
  if (typeof syncSliceImageEngraveUI === 'function') {
    syncSliceImageEngraveUI();
  }

  if (!vec2dState.sourceCanvas || presetIfEmpty) {
    loadVectorizerDemoPreset(presetIfEmpty || 'drawing');
  } else {
    syncVectorizerModalUI();
    runImageVectorization();
  }
}

function closeImageVectorizerModal() {
  const modal = document.getElementById('imageVectorizerModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function loadVectorizerDemoPreset(presetName) {
  const demoCanvas = createDemoBitmapCanvas(presetName);
  vec2dState.sourceCanvas = demoCanvas;
  vec2dState.sourceWidth = demoCanvas.width;
  vec2dState.sourceHeight = demoCanvas.height;
  vec2dState.aspectRatio = 1.0;
  vec2dState.widthMM = 100;
  vec2dState.heightMM = 100;
  vec2dState.bgDetectMode = 'auto';
  vec2dState.cutMode = 'silhouette';
  vec2dState.cutOffsetMM = presetName === 'badge' ? 2.0 : 1.5;
  vec2dState.keyholeEnabled = presetName === 'badge';
  vec2dState.engraveDetectMode = 'smart_drawing';
  syncVectorizerModalUI();
  runImageVectorization();
}

function handleImageVectorizerFile(file) {
  if (!file) return;
  const cleanName = file.name.replace(/\.(png|bmp|jpg|jpeg|webp|gif)$/i, '') || 'Imagen_Laser';
  vec2dState.imageName = cleanName;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const dataUrl = ev.target.result;
    const img = new Image();
    img.onload = () => {
      const maxSrcDim = 1400;
      let w = img.naturalWidth || img.width || 256;
      let h = img.naturalHeight || img.height || 256;
      if (w > maxSrcDim || h > maxSrcDim) {
        const sc = maxSrcDim / Math.max(w, h);
        w = Math.max(16, Math.round(w * sc));
        h = Math.max(16, Math.round(h * sc));
      }
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      vec2dState.sourceCanvas = c;
      vec2dState.sourceWidth = w;
      vec2dState.sourceHeight = h;
      vec2dState.aspectRatio = w / Math.max(1, h);

      if (vec2dState.lockAspect) {
        if (vec2dState.aspectRatio >= 1) {
          vec2dState.widthMM = 120;
          vec2dState.heightMM = Number((120 / vec2dState.aspectRatio).toFixed(1));
        } else {
          vec2dState.heightMM = 120;
          vec2dState.widthMM = Number((120 * vec2dState.aspectRatio).toFixed(1));
        }
      }

      // Calcular umbral óptimo inicial mediante método de Otsu
      vec2dState.engraveThreshold = computeOtsuThresholdFromCanvas(c);

      openImageVectorizerModal();
      syncVectorizerModalUI();
      runImageVectorization();
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

// ============================================================================
// CÁLCULO DE UMBRAL AUTOMÁTICO DE OTSU Y SEPARACIÓN FONDO / FIGURA
// ============================================================================
function computeOtsuThresholdFromCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const hist = new Int32Array(256);
  let totalValid = 0;

  for (let i = 0; i < imgData.length; i += 4) {
    const a = imgData[i + 3];
    if (a < 40) continue;
    const luma = Math.round(0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2]);
    hist[luma]++;
    totalValid++;
  }
  if (totalValid < 20) return 145;

  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];

  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 145;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = totalValid - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const betweenVar = wB * wF * (mB - mF) * (mB - mF);
    if (betweenVar > maxVar) {
      maxVar = betweenVar;
      threshold = t;
    }
  }
  return Math.max(40, Math.min(225, threshold));
}

function autoAdjustVectorizerThreshold() {
  if (!vec2dState.sourceCanvas) return;
  vec2dState.engraveThreshold = computeOtsuThresholdFromCanvas(vec2dState.sourceCanvas);
  vec2dState.localContrastSens = 68;
  syncVectorizerModalUI();
  runImageVectorization();
}

// ============================================================================
// MOTOR GEOMÉTRICO: INTEGRAL IMAGE (ADAPTIVE THRESHOLD), SDF 2D Y MARCHING SQUARES DIRIGIDO
// ============================================================================

// Calcula Tabla de Área Sumada (Integral Image) sobre un campo escalar W×H para obtener medias y desviaciones locales en O(1)
function computeLocalMeanFieldIntegral(field, w, h, radiusPx) {
  const r = Math.max(2, Math.round(radiusPx));
  const stride = w + 1;
  const integral = new Float64Array((w + 1) * (h + 1));

  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    const srcRow = y * w;
    const dstRow = (y + 1) * stride;
    const prevRow = y * stride;
    for (let x = 0; x < w; x++) {
      rowSum += field[srcRow + x];
      integral[dstRow + x + 1] = integral[prevRow + x + 1] + rowSum;
    }
  }

  const meanField = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h - 1, y + r);
    const r0 = y0 * stride;
    const r1 = (y1 + 1) * stride;
    const spanY = y1 - y0 + 1;
    const outRow = y * w;
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      const count = (x1 - x0 + 1) * spanY;
      const sum = integral[r1 + x1 + 1] - integral[r0 + x1 + 1] - integral[r1 + x0] + integral[r0 + x0];
      meanField[outRow + x] = sum / count;
    }
  }
  return meanField;
}

// Suavizado Gaussiano 3×3 rápido sobre un campo escalar para eliminar dientes de sierra antes de Marching Squares
function smoothScalarField3x3(field, w, h) {
  const out = new Float32Array(w * h);
  out.set(field);
  for (let y = 1; y < h - 1; y++) {
    const r0 = (y - 1) * w;
    const r1 = y * w;
    const r2 = (y + 1) * w;
    for (let x = 1; x < w - 1; x++) {
      out[r1 + x] =
        0.0625 * (field[r0 + x - 1] + field[r0 + x + 1] + field[r2 + x - 1] + field[r2 + x + 1]) +
        0.1250 * (field[r0 + x] + field[r1 + x - 1] + field[r1 + x + 1] + field[r2 + x]) +
        0.2500 * field[r1 + x];
    }
  }
  return out;
}

// Transformada de distancia Chamfer 2D rápida (en píxeles) sobre máscara booleana (1 = dentro, 0 = fuera)
function computeSignedDistanceField2D(mask, w, h) {
  const n = w * h;
  const INF = 1e6;
  const distIn = new Float32Array(n);
  const distOut = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    if (mask[i]) {
      distOut[i] = 0;
      distIn[i] = INF;
    } else {
      distOut[i] = INF;
      distIn[i] = 0;
    }
  }

  const passChamfer = (d) => {
    const dOrtho = 1.0;
    const dDiag = 1.41421356;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const idx = row + x;
        let v = d[idx];
        if (x > 0) v = Math.min(v, d[idx - 1] + dOrtho);
        if (y > 0) {
          v = Math.min(v, d[idx - w] + dOrtho);
          if (x > 0) v = Math.min(v, d[idx - w - 1] + dDiag);
          if (x + 1 < w) v = Math.min(v, d[idx - w + 1] + dDiag);
        }
        d[idx] = v;
      }
    }
    for (let y = h - 1; y >= 0; y--) {
      const row = y * w;
      for (let x = w - 1; x >= 0; x--) {
        const idx = row + x;
        let v = d[idx];
        if (x + 1 < w) v = Math.min(v, d[idx + 1] + dOrtho);
        if (y + 1 < h) {
          v = Math.min(v, d[idx + w] + dOrtho);
          if (x + 1 < w) v = Math.min(v, d[idx + w + 1] + dDiag);
          if (x > 0) v = Math.min(v, d[idx + w - 1] + dDiag);
        }
        d[idx] = v;
      }
    }
  };

  passChamfer(distOut);
  passChamfer(distIn);

  const sdf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    sdf[i] = mask[i] ? (distIn[i] - 0.5) : -(distOut[i] - 0.5);
  }
  return sdf;
}

// Separa mediante Flood-Fill desde el borde exterior qué huecos son fondo exterior vs huecos internos de la pieza
function separateExteriorAndInternalHolesMask(solidMask, w, h) {
  const n = w * h;
  const isExteriorBg = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;

  const pushIfBg = (x, y) => {
    const idx = y * w + x;
    if (!solidMask[idx] && !isExteriorBg[idx]) {
      isExteriorBg[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < w; x++) {
    pushIfBg(x, 0);
    pushIfBg(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    pushIfBg(0, y);
    pushIfBg(w - 1, y);
  }

  while (head < tail) {
    const curr = queue[head++];
    const cx = curr % w;
    const cy = (curr / w) | 0;
    if (cx > 0) pushIfBg(cx - 1, cy);
    if (cx + 1 < w) pushIfBg(cx + 1, cy);
    if (cy > 0) pushIfBg(cx, cy - 1);
    if (cy + 1 < h) pushIfBg(cx, cy + 1);
  }

  const filledOuterMask = new Uint8Array(n);
  const internalHolesMask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!isExteriorBg[i]) {
      filledOuterMask[i] = 1;
      if (!solidMask[i]) {
        internalHolesMask[i] = 1;
      }
    }
  }
  return { filledOuterMask, internalHolesMask };
}

/**
 * Marching Squares DIRIGIDO con interpolación lineal sub-píxel:
 * Todos los segmentos se orientan dejando la región positiva (v > isoValue) a su derecha,
 * lo que garantiza el encadenamiento exacto sin cruces erróneos en puntos de silla y preserva trazos diagonales finos.
 */
function traceIsoContoursMarchingSquares(field, w, h, isoValue = 0.0, connectSaddles = true) {
  const segments = [];
  const interp = (v1, v2) => {
    const dv = v2 - v1;
    if (Math.abs(dv) < 1e-6) return 0.5;
    return Math.max(0.02, Math.min(0.98, (isoValue - v1) / dv));
  };

  for (let y = 0; y < h - 1; y++) {
    const row0 = y * w;
    const row1 = (y + 1) * w;
    for (let x = 0; x < w - 1; x++) {
      const v0 = field[row0 + x];       // top-left
      const v1 = field[row0 + x + 1];   // top-right
      const v2 = field[row1 + x + 1];   // bottom-right
      const v3 = field[row1 + x];       // bottom-left

      let mask = 0;
      if (v0 > isoValue) mask |= 1;
      if (v1 > isoValue) mask |= 2;
      if (v2 > isoValue) mask |= 4;
      if (v3 > isoValue) mask |= 8;
      if (mask === 0 || mask === 15) continue;

      const pTop = { x: x + interp(v0, v1), y: y };
      const pRight = { x: x + 1, y: y + interp(v1, v2) };
      const pBottom = { x: x + interp(v3, v2), y: y + 1 };
      const pLeft = { x: x, y: y + interp(v0, v3) };

      switch (mask) {
        case 1:
          segments.push([pLeft, pTop]);
          break;
        case 2:
          segments.push([pTop, pRight]);
          break;
        case 3:
          segments.push([pLeft, pRight]);
          break;
        case 4:
          segments.push([pRight, pBottom]);
          break;
        case 5: {
          const centerVal = 0.25 * (v0 + v1 + v2 + v3);
          if (connectSaddles || centerVal > isoValue) {
            segments.push([pLeft, pBottom], [pRight, pTop]);
          } else {
            segments.push([pLeft, pTop], [pRight, pBottom]);
          }
          break;
        }
        case 6:
          segments.push([pTop, pBottom]);
          break;
        case 7:
          segments.push([pLeft, pBottom]);
          break;
        case 8:
          segments.push([pBottom, pLeft]);
          break;
        case 9:
          segments.push([pBottom, pTop]);
          break;
        case 10: {
          const centerVal = 0.25 * (v0 + v1 + v2 + v3);
          if (connectSaddles || centerVal > isoValue) {
            segments.push([pTop, pLeft], [pBottom, pRight]);
          } else {
            segments.push([pTop, pRight], [pBottom, pLeft]);
          }
          break;
        }
        case 11:
          segments.push([pBottom, pRight]);
          break;
        case 12:
          segments.push([pRight, pLeft]);
          break;
        case 13:
          segments.push([pRight, pTop]);
          break;
        case 14:
          segments.push([pTop, pLeft]);
          break;
      }
    }
  }

  return chainDirectedSegmentsToLoops(segments);
}

// Encadena segmentos dirigidos (start -> end) en contornos cerrados exactos
function chainDirectedSegmentsToLoops(segments) {
  if (!segments || segments.length === 0) return [];
  const scaleKey = 500;
  const keyOf = (pt) => Math.round(pt.x * scaleKey) + ',' + Math.round(pt.y * scaleKey);

  const used = new Uint8Array(segments.length);
  const startMap = new Map();

  for (let i = 0; i < segments.length; i++) {
    const k = keyOf(segments[i][0]);
    let arr = startMap.get(k);
    if (!arr) {
      arr = [];
      startMap.set(k, arr);
    }
    arr.push(i);
  }

  const loops = [];
  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const pts = [segments[i][0], segments[i][1]];

    let growing = true;
    while (growing) {
      growing = false;
      const tailPt = pts[pts.length - 1];
      const candidates = startMap.get(keyOf(tailPt));
      if (!candidates) break;
      for (let c = 0; c < candidates.length; c++) {
        const segIdx = candidates[c];
        if (used[segIdx]) continue;
        used[segIdx] = 1;
        pts.push(segments[segIdx][1]);
        growing = true;
        break;
      }
    }

    if (pts.length >= 4) {
      const first = pts[0];
      const last = pts[pts.length - 1];
      if (Math.hypot(first.x - last.x, first.y - last.y) < 1.5) {
        pts.pop();
      }
      if (pts.length >= 3) {
        loops.push(pts);
      }
    }
  }
  return loops;
}

// Simplificación Ramer-Douglas-Peucker para un contorno cerrado
function simplifyClosedPolygonRDP(pts, tol) {
  if (!pts || pts.length <= 6 || tol <= 0.001) return pts;

  const sqTol = tol * tol;
  const distToSegmentSq = (p, a, b) => {
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        dx = p.x - b.x;
        dy = p.y - b.y;
        return dx * dx + dy * dy;
      } else if (t > 0) {
        dx = p.x - (a.x + dx * t);
        dy = p.y - (a.y + dy * t);
        return dx * dx + dy * dy;
      }
    }
    dx = p.x - a.x;
    dy = p.y - a.y;
    return dx * dx + dy * dy;
  };

  let maxDistSq = -1;
  let splitIdx = Math.floor(pts.length / 2);
  for (let i = 1; i < pts.length; i++) {
    const dSq = (pts[i].x - pts[0].x) ** 2 + (pts[i].y - pts[0].y) ** 2;
    if (dSq > maxDistSq) {
      maxDistSq = dSq;
      splitIdx = i;
    }
  }

  const rdpOpen = (arr) => {
    if (arr.length <= 2) return arr;
    let maxD = 0;
    let index = 0;
    const first = arr[0];
    const last = arr[arr.length - 1];
    for (let i = 1; i < arr.length - 1; i++) {
      const d = distToSegmentSq(arr[i], first, last);
      if (d > maxD) {
        index = i;
        maxD = d;
      }
    }
    if (maxD > sqTol) {
      const left = rdpOpen(arr.slice(0, index + 1));
      const right = rdpOpen(arr.slice(index));
      return left.slice(0, left.length - 1).concat(right);
    }
    return [first, last];
  };

  const half1 = rdpOpen(pts.slice(0, splitIdx + 1));
  const half2 = rdpOpen(pts.slice(splitIdx).concat([pts[0]]));
  const combined = half1.slice(0, half1.length - 1).concat(half2.slice(0, half2.length - 1));
  return combined.length >= 3 ? combined : pts;
}

// Suavizado de curvas Chaikin preservando esquinas pronunciadas (< 105°)
function smoothClosedPolygonChaikin(pts, iterations) {
  let curr = pts;
  const iters = Math.max(0, Math.min(4, parseInt(iterations, 10) || 0));
  for (let it = 0; it < iters; it++) {
    const n = curr.length;
    if (n < 4 || n > 2400) break;
    const next = [];
    for (let i = 0; i < n; i++) {
      const pPrev = curr[(i - 1 + n) % n];
      const pCurr = curr[i];
      const pNext = curr[(i + 1) % n];

      const v1x = pCurr.x - pPrev.x, v1y = pCurr.y - pPrev.y;
      const v2x = pNext.x - pCurr.x, v2y = pNext.y - pCurr.y;
      const l1 = Math.hypot(v1x, v1y);
      const l2 = Math.hypot(v2x, v2y);
      let isSharpCorner = false;
      if (l1 > 1e-5 && l2 > 1e-5) {
        const cosA = (v1x * v2x + v1y * v2y) / (l1 * l2);
        if (cosA < -0.20) isSharpCorner = true;
      }

      if (isSharpCorner) {
        next.push({ x: pCurr.x, y: pCurr.y });
      } else {
        next.push({
          x: 0.75 * pCurr.x + 0.25 * pNext.x,
          y: 0.75 * pCurr.y + 0.25 * pNext.y
        });
        next.push({
          x: 0.25 * pCurr.x + 0.75 * pNext.x,
          y: 0.25 * pCurr.y + 0.75 * pNext.y
        });
      }
    }
    curr = next;
  }
  return curr;
}

function computePolygonSignedArea2D(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    a += p1.x * p2.y - p2.x * p1.y;
  }
  return a * 0.5;
}

// Convierte polilíneas de espacio píxel (0..W, 0..H) a milímetros centrados (-widthMM/2..+widthMM/2) con eje Y matemático hacia arriba
function convertPixelLoopsToMM(pxLoops, gridW, gridH, widthMM, heightMM, minAreaMM2, simplifyTolMM, smoothIters) {
  const out = [];

  pxLoops.forEach((rawPts) => {
    const mmPts = rawPts.map((p) => ({
      x: ((p.x - 1) / Math.max(1, gridW - 2) - 0.5) * widthMM,
      y: (0.5 - (p.y - 1) / Math.max(1, gridH - 2)) * heightMM
    }));
    const rawArea = Math.abs(computePolygonSignedArea2D(mmPts));
    if (rawArea < minAreaMM2) return;

    let cleanPts = simplifyClosedPolygonRDP(mmPts, simplifyTolMM);
    if (smoothIters > 0) {
      cleanPts = smoothClosedPolygonChaikin(cleanPts, smoothIters);
    }
    const signedA = computePolygonSignedArea2D(cleanPts);
    const finalArea = Math.abs(signedA);
    if (finalArea < minAreaMM2 || cleanPts.length < 3) return;

    out.push({
      points: cleanPts,
      areaMM2: finalArea,
      signedArea: signedA,
      // En Marching Squares dirigido, signedArea > 0 en eje Y-arriba indica contorno exterior y signedArea < 0 indica hueco interior
      isHole: signedA < 0
    });
  });

  // Verificación adicional por contención geométrica para máxima robustez en dibujos complejos anidados
  out.sort((a, b) => b.areaMM2 - a.areaMM2);
  for (let i = 0; i < out.length; i++) {
    let depth = 0;
    const testPt = out[i].points[0];
    for (let j = 0; j < i; j++) {
      if (isPointInPolygon(testPt, out[j].points)) {
        depth++;
      }
    }
    out[i].isHole = (depth % 2) === 1;
  }
  return out;
}

// Genera líneas de barrido vectorial (Hatching) dentro de un conjunto de contornos even-odd
function generateHatchPolylinesForLoops(loops, widthMM, heightMM, spacingMM, crossHatch) {
  if (!loops || loops.length === 0) return [];
  const step = Math.max(0.25, Math.min(10, Number(spacingMM) || 0.8));
  const polylines = [];

  const scanAngle = (angleRad) => {
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const rot = (p) => ({
      u: p.x * cosA + p.y * sinA,
      v: -p.x * sinA + p.y * cosA
    });
    const unrot = (u, v) => ({
      x: u * cosA - v * sinA,
      y: u * sinA + v * cosA
    });

    const rotLoops = loops.map((l) => l.points.map(rot));
    let minV = Infinity, maxV = -Infinity;
    rotLoops.forEach((pts) => {
      pts.forEach((p) => {
        if (p.v < minV) minV = p.v;
        if (p.v > maxV) maxV = p.v;
      });
    });
    if (!Number.isFinite(minV)) return;

    for (let v = minV + step * 0.5; v < maxV; v += step) {
      const uHits = [];
      rotLoops.forEach((pts) => {
        for (let i = 0, n = pts.length; i < n; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % n];
          if ((a.v <= v && b.v > v) || (b.v <= v && a.v > v)) {
            const t = (v - a.v) / (b.v - a.v);
            uHits.push(a.u + t * (b.u - a.u));
          }
        }
      });
      if (uHits.length < 2) continue;
      uHits.sort((a, b) => a - b);
      for (let k = 0; k + 1 < uHits.length; k += 2) {
        const u0 = uHits[k];
        const u1 = uHits[k + 1];
        if (u1 - u0 > step * 0.35) {
          polylines.push([unrot(u0, v), unrot(u1, v)]);
        }
      }
    }
  };

  scanAngle(Math.PI / 4);
  if (crossHatch) {
    scanAngle(-Math.PI / 4);
  }
  return polylines;
}

// ============================================================================
// GENERADOR GEOMÉTRICO DE MARCOS CONFIGURABLES (CORTE Y/O ORLA GRABADA)
// ============================================================================
function generateParametricFramePolygon2D(shape, halfW, halfH, cornerRadiusMM) {
  const hw = Math.max(1.0, Number(halfW) || 10);
  const hh = Math.max(1.0, Number(halfH) || 10);
  const radReq = Math.max(0, Number(cornerRadiusMM) || 0);
  const pts = [];

  if (shape === 'circle') {
    const segs = 72;
    for (let i = 0; i < segs; i++) {
      const ang = (i * Math.PI * 2) / segs;
      pts.push({ x: Math.cos(ang) * hw, y: Math.sin(ang) * hh });
    }
    return pts;
  }

  if (shape === 'octagon') {
    const c = Math.max(1.0, Math.min(hw * 0.72, hh * 0.72, radReq > 0 ? radReq : Math.min(hw, hh) * 0.28));
    return [
      { x: hw, y: hh - c },
      { x: hw - c, y: hh },
      { x: -hw + c, y: hh },
      { x: -hw, y: hh - c },
      { x: -hw, y: -hh + c },
      { x: -hw + c, y: -hh },
      { x: hw - c, y: -hh },
      { x: hw, y: -hh + c }
    ];
  }

  if (shape === 'hexagon') {
    return [
      { x: hw, y: 0 },
      { x: hw * 0.52, y: hh },
      { x: -hw * 0.52, y: hh },
      { x: -hw, y: 0 },
      { x: -hw * 0.52, y: -hh },
      { x: hw * 0.52, y: -hh }
    ];
  }

  if (shape === 'arch') {
    const archBaseY = hh * 0.12;
    const archRiseY = hh - archBaseY;
    const segsArch = 36;
    for (let i = 0; i <= segsArch; i++) {
      const ang = (i * Math.PI) / segsArch;
      pts.push({
        x: Math.cos(ang) * hw,
        y: archBaseY + Math.sin(ang) * archRiseY
      });
    }
    const rBot = Math.min(hw * 0.45, hh * 0.45, radReq);
    if (rBot <= 0.15) {
      pts.push({ x: -hw, y: -hh });
      pts.push({ x: hw, y: -hh });
    } else {
      const segsBot = 8;
      for (let i = 0; i <= segsBot; i++) {
        const ang = Math.PI + (Math.PI * 0.5 * i) / segsBot;
        pts.push({ x: -hw + rBot + Math.cos(ang) * rBot, y: -hh + rBot + Math.sin(ang) * rBot });
      }
      for (let i = 0; i <= segsBot; i++) {
        const ang = Math.PI * 1.5 + (Math.PI * 0.5 * i) / segsBot;
        pts.push({ x: hw - rBot + Math.cos(ang) * rBot, y: -hh + rBot + Math.sin(ang) * rBot });
      }
    }
    return pts;
  }

  // Por defecto: 'rounded_rect'
  const rad = Math.min(hw * 0.92, hh * 0.92, radReq);
  if (rad <= 0.15) {
    return [
      { x: hw, y: hh },
      { x: -hw, y: hh },
      { x: -hw, y: -hh },
      { x: hw, y: -hh }
    ];
  }
  const segsCorner = 10;
  const cornersRR = [
    { cx: hw - rad, cy: hh - rad, a0: 0, a1: Math.PI * 0.5 },
    { cx: -hw + rad, cy: hh - rad, a0: Math.PI * 0.5, a1: Math.PI },
    { cx: -hw + rad, cy: -hh + rad, a0: Math.PI, a1: Math.PI * 1.5 },
    { cx: hw - rad, cy: -hh + rad, a0: Math.PI * 1.5, a1: Math.PI * 2 }
  ];
  cornersRR.forEach((c) => {
    for (let i = 0; i <= segsCorner; i++) {
      const ang = c.a0 + (c.a1 - c.a0) * (i / segsCorner);
      pts.push({ x: c.cx + Math.cos(ang) * rad, y: c.cy + Math.sin(ang) * rad });
    }
  });
  return pts;
}

// Traza un contorno paralelo a la silueta exterior añadiendo el margen de celdas necesario para offsets positivos
function traceOuterSilhouetteAtOffsetMM(filledOuterMask, gridW, gridH, widthMM, heightMM, offsetMM, minAreaMM2, simplifyTolMM, smoothIters) {
  const innerW = Math.max(1, gridW - 2);
  const innerH = Math.max(1, gridH - 2);
  const mmPerPx = Math.max(widthMM / innerW, heightMM / innerH);
  const offsetPx = (Number(offsetMM) || 0) / mmPerPx;
  const pad = Math.max(2, Math.ceil(Math.max(0, offsetPx)) + 4);
  const padW = innerW + pad * 2;
  const padH = innerH + pad * 2;
  const paddedMask = new Uint8Array(padW * padH);

  for (let y = 0; y < innerH; y++) {
    const srcRow = (y + 1) * gridW + 1;
    const dstRow = (y + pad) * padW + pad;
    for (let x = 0; x < innerW; x++) {
      paddedMask[dstRow + x] = filledOuterMask[srcRow + x];
    }
  }

  const sdfPadded = computeSignedDistanceField2D(paddedMask, padW, padH);
  const rawPx = traceIsoContoursMarchingSquares(sdfPadded, padW, padH, -offsetPx, true);
  const out = [];

  rawPx.forEach((rawPts) => {
    const mmPts = rawPts.map((p) => ({
      x: ((p.x - pad) / innerW - 0.5) * widthMM,
      y: (0.5 - (p.y - pad) / innerH) * heightMM
    }));
    const rawArea = Math.abs(computePolygonSignedArea2D(mmPts));
    if (rawArea < minAreaMM2) return;

    let cleanPts = simplifyClosedPolygonRDP(mmPts, simplifyTolMM);
    if (smoothIters > 0) {
      cleanPts = smoothClosedPolygonChaikin(cleanPts, smoothIters);
    }
    const signedA = computePolygonSignedArea2D(cleanPts);
    const finalArea = Math.abs(signedA);
    if (finalArea < minAreaMM2 || cleanPts.length < 3) return;
    if (signedA < 0) cleanPts.reverse();

    out.push({
      points: cleanPts,
      areaMM2: finalArea,
      signedArea: finalArea,
      isHole: false
    });
  });

  return out;
}

function buildConfigurableFrameLoops(widthMM, heightMM, filledOuterMask, sdfOuter, gridW, gridH, mmPerPx) {
  const out = {
    outerCutLoops: [],
    holeCutLoops: [],
    frameEngraveLoops: [],
    innerClipPolygons: [],
    innerSilhouetteOffsetPx: null
  };
  if (!vec2dState.frameEnabled) return out;

  const shape = vec2dState.frameShape || 'rounded_rect';
  const laserMode = vec2dState.frameLaserMode || 'cut_and_engrave';
  const style = vec2dState.frameStyle || 'solid_band';
  const thick = Math.max(0.5, Math.min(45, Number(vec2dState.frameThicknessMM) || 3.5));
  const margin = Math.max(-25, Math.min(60, Number(vec2dState.frameMarginMM) || 2.5));
  const cornerRad = Math.max(0, Math.min(90, Number(vec2dState.frameCornerRadiusMM) || 8.0));
  const cutRim = Math.max(0, Number(vec2dState.cutOffsetMM) || 0);

  if (shape === 'silhouette') {
    const traceOffsetLoops = (offsetMM) => traceOuterSilhouetteAtOffsetMM(
      filledOuterMask,
      gridW,
      gridH,
      widthMM,
      heightMM,
      offsetMM,
      Math.max(0.8, vec2dState.minSpeckleMM2 * 3),
      vec2dState.simplifyTolMM * 1.15,
      vec2dState.smoothIterations
    );

    const innerLoops = traceOffsetLoops(margin);
    const outerLoops = traceOffsetLoops(margin + thick);
    out.innerSilhouetteOffsetPx = (margin - 0.35) / mmPerPx;

    if (laserMode === 'cut_and_engrave') {
      out.outerCutLoops = cutRim > 0.05 ? traceOffsetLoops(margin + thick + cutRim) : outerLoops;
    } else if (laserMode === 'cut_outer' || laserMode === 'cut_window') {
      out.outerCutLoops = outerLoops;
      if (laserMode === 'cut_window') {
        out.holeCutLoops = innerLoops.map((l) => ({
          points: l.points.slice(),
          areaMM2: l.areaMM2,
          isHole: true
        }));
      }
    }

    if (laserMode === 'cut_and_engrave' || laserMode === 'engrave_only') {
      const pushSilRing = (loopsOut, loopsIn) => {
        loopsOut.forEach((l) => {
          out.frameEngraveLoops.push({
            points: l.points.slice(),
            areaMM2: l.areaMM2,
            isHole: false,
            isFrame: true
          });
        });
        loopsIn.forEach((l) => {
          out.frameEngraveLoops.push({
            points: l.points.slice().reverse(),
            areaMM2: l.areaMM2,
            isHole: true,
            isFrame: true
          });
        });
      };

      if (style === 'double_line') {
        const midOut = traceOffsetLoops(margin + thick * 0.56);
        const midIn = traceOffsetLoops(margin + thick * 0.32);
        pushSilRing(outerLoops, midOut);
        pushSilRing(midIn, innerLoops);
      } else {
        pushSilRing(outerLoops, innerLoops);
      }
    }
    return out;
  }

  // Formas geométricas paramétricas ('rounded_rect', 'circle', 'octagon', 'arch', 'hexagon')
  const innerHW = Math.max(3.0, widthMM * 0.5 + margin);
  const innerHH = Math.max(3.0, heightMM * 0.5 + margin);
  const outerHW = innerHW + thick;
  const outerHH = innerHH + thick;
  const innerRad = Math.max(0, cornerRad);
  const outerRad = cornerRad > 0 ? cornerRad + thick : 0;

  const innerWindowPoly = generateParametricFramePolygon2D(shape, innerHW, innerHH, innerRad);
  const outerFramePoly = generateParametricFramePolygon2D(shape, outerHW, outerHH, outerRad);
  const clipPoly = generateParametricFramePolygon2D(
    shape,
    Math.max(2.0, innerHW - 0.35),
    Math.max(2.0, innerHH - 0.35),
    Math.max(0, innerRad - 0.35)
  );
  out.innerClipPolygons = [clipPoly];

  if (laserMode === 'cut_and_engrave') {
    const cutPoly = cutRim > 0.05
      ? generateParametricFramePolygon2D(shape, outerHW + cutRim, outerHH + cutRim, outerRad > 0 ? outerRad + cutRim : 0)
      : outerFramePoly;
    out.outerCutLoops = [{
      points: cutPoly,
      areaMM2: Math.abs(computePolygonSignedArea2D(cutPoly)),
      isHole: false
    }];
  } else if (laserMode === 'cut_outer' || laserMode === 'cut_window') {
    out.outerCutLoops = [{
      points: outerFramePoly,
      areaMM2: Math.abs(computePolygonSignedArea2D(outerFramePoly)),
      isHole: false
    }];
    if (laserMode === 'cut_window') {
      out.holeCutLoops = [{
        points: innerWindowPoly.slice(),
        areaMM2: Math.abs(computePolygonSignedArea2D(innerWindowPoly)),
        isHole: true
      }];
    }
  }

  if (laserMode === 'cut_and_engrave' || laserMode === 'engrave_only') {
    const addParametricRing = (hwO, hhO, rO, hwI, hhI, rI) => {
      const pOut = generateParametricFramePolygon2D(shape, hwO, hhO, rO);
      const pIn = generateParametricFramePolygon2D(shape, hwI, hhI, rI).slice().reverse();
      out.frameEngraveLoops.push({
        points: pOut,
        areaMM2: Math.abs(computePolygonSignedArea2D(pOut)),
        isHole: false,
        isFrame: true
      });
      out.frameEngraveLoops.push({
        points: pIn,
        areaMM2: Math.abs(computePolygonSignedArea2D(pIn)),
        isHole: true,
        isFrame: true
      });
    };

    if (style === 'double_line') {
      addParametricRing(
        outerHW,
        outerHH,
        outerRad,
        innerHW + thick * 0.54,
        innerHH + thick * 0.54,
        innerRad > 0 ? innerRad + thick * 0.54 : 0
      );
      addParametricRing(
        innerHW + thick * 0.30,
        innerHH + thick * 0.30,
        innerRad > 0 ? innerRad + thick * 0.30 : 0,
        innerHW,
        innerHH,
        innerRad
      );
    } else if (style === 'ornate_corners') {
      addParametricRing(
        outerHW,
        outerHH,
        outerRad,
        innerHW + thick * 0.42,
        innerHH + thick * 0.42,
        innerRad > 0 ? innerRad + thick * 0.42 : 0
      );
      addParametricRing(
        innerHW + thick * 0.22,
        innerHH + thick * 0.22,
        innerRad > 0 ? innerRad + thick * 0.22 : 0,
        innerHW,
        innerHH,
        innerRad
      );
      // Rosetones / diamantes decorativos en las 4 esquinas interiores del marco
      const dSize = Math.max(1.2, Math.min(innerHW, innerHH) * 0.085);
      const insetX = Math.max(dSize * 1.4, innerHW - Math.max(dSize * 1.8, innerRad * 0.65));
      const insetY = Math.max(dSize * 1.4, innerHH - Math.max(dSize * 1.8, innerRad * 0.65));
      const ornamentCenters = (shape === 'circle' || shape === 'hexagon')
        ? [
            { cx: 0, cy: innerHH - dSize * 1.35 },
            { cx: 0, cy: -innerHH + dSize * 1.35 },
            { cx: -innerHW + dSize * 1.35, cy: 0 },
            { cx: innerHW - dSize * 1.35, cy: 0 }
          ]
        : [
            { cx: insetX, cy: insetY },
            { cx: -insetX, cy: insetY },
            { cx: -insetX, cy: -insetY },
            { cx: insetX, cy: -insetY }
          ];
      ornamentCenters.forEach((oc) => {
        const dOut = [
          { x: oc.cx + dSize, y: oc.cy },
          { x: oc.cx, y: oc.cy + dSize },
          { x: oc.cx - dSize, y: oc.cy },
          { x: oc.cx, y: oc.cy - dSize }
        ];
        const dIn = [
          { x: oc.cx + dSize * 0.45, y: oc.cy },
          { x: oc.cx, y: oc.cy - dSize * 0.45 },
          { x: oc.cx - dSize * 0.45, y: oc.cy },
          { x: oc.cx, y: oc.cy + dSize * 0.45 }
        ];
        out.frameEngraveLoops.push({
          points: dOut,
          areaMM2: Math.abs(computePolygonSignedArea2D(dOut)),
          isHole: false,
          isFrame: true
        });
        out.frameEngraveLoops.push({
          points: dIn,
          areaMM2: Math.abs(computePolygonSignedArea2D(dIn)),
          isHole: true,
          isFrame: true
        });
      });
    } else {
      addParametricRing(outerHW, outerHH, outerRad, innerHW, innerHH, innerRad);
    }
  }

  return out;
}

// ============================================================================
// EJECUCIÓN PRINCIPAL DEL VECTORIZADOR (CORTE + DETECCIÓN INTELIGENTE DE DIBUJOS)
// ============================================================================
function runImageVectorization() {
  if (!vec2dState.sourceCanvas) return;

  const srcW = vec2dState.sourceCanvas.width;
  const srcH = vec2dState.sourceCanvas.height;
  const maxRes = Math.max(120, Math.min(640, parseInt(vec2dState.traceResolution, 10) || 420));
  const sc = maxRes / Math.max(srcW, srcH);

  // Dejamos un borde de 2 píxeles vacíos alrededor para garantizar cierre limpio de Marching Squares
  const innerW = Math.max(32, Math.round(srcW * sc));
  const innerH = Math.max(32, Math.round(srcH * sc));
  const gridW = innerW + 2;
  const gridH = innerH + 2;

  const workCanvas = document.createElement('canvas');
  workCanvas.width = innerW;
  workCanvas.height = innerH;
  const wCtx = workCanvas.getContext('2d');
  wCtx.clearRect(0, 0, innerW, innerH);
  wCtx.drawImage(vec2dState.sourceCanvas, 0, 0, innerW, innerH);
  const rgba = wCtx.getImageData(0, 0, innerW, innerH).data;
  if (typeof populateProceduralDemoRgbaIfBlank === 'function') {
    populateProceduralDemoRgbaIfBlank(rgba, innerW, innerH, vec2dState.imageName);
  }

  // 1. Detectar si la imagen tiene transparencia real
  let transparentPixels = 0;
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] < 128) transparentPixels++;
  }
  const hasTransparency = transparentPixels > (innerW * innerH * 0.012);

  // Color medio de las 4 esquinas para detección automática de fondo en BMP / PNG opacos
  const sampleCorner = (cx, cy) => {
    const idx = (cy * innerW + cx) * 4;
    return [rgba[idx], rgba[idx + 1], rgba[idx + 2], rgba[idx + 3]];
  };
  const corners = [
    sampleCorner(0, 0),
    sampleCorner(innerW - 1, 0),
    sampleCorner(0, innerH - 1),
    sampleCorner(innerW - 1, innerH - 1)
  ];
  const bgR = (corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) * 0.25;
  const bgG = (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) * 0.25;
  const bgB = (corners[0][2] + corners[1][2] + corners[2][2] + corners[3][2]) * 0.25;

  const nGrid = gridW * gridH;
  const solidMask = new Uint8Array(nGrid);
  const lumaGrid = new Float32Array(nGrid);
  const rGrid = new Float32Array(nGrid);
  const gGrid = new Float32Array(nGrid);
  const bGrid = new Float32Array(nGrid);
  lumaGrid.fill(255);
  rGrid.fill(255);
  gGrid.fill(255);
  bGrid.fill(255);

  const tol = Math.max(4, Number(vec2dState.bgTolerance) || 38);
  const mode = vec2dState.bgDetectMode;

  for (let y = 0; y < innerH; y++) {
    for (let x = 0; x < innerW; x++) {
      const sIdx = (y * innerW + x) * 4;
      const r = rgba[sIdx];
      const g = rgba[sIdx + 1];
      const b = rgba[sIdx + 2];
      const a = rgba[sIdx + 3];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;

      const gIdx = (y + 1) * gridW + (x + 1);
      if (a >= 35) {
        lumaGrid[gIdx] = luma;
        rGrid[gIdx] = r;
        gGrid[gIdx] = g;
        bGrid[gIdx] = b;
      }

      let isFg = false;
      if (mode === 'alpha' || (mode === 'auto' && hasTransparency)) {
        isFg = a >= 85;
      } else if (mode === 'luma_light') {
        isFg = a >= 60 && luma < (252 - tol);
      } else if (mode === 'luma_dark') {
        isFg = a >= 60 && luma > tol;
      } else {
        const distBg = Math.hypot(r - bgR, g - bgG, b - bgB);
        isFg = a >= 60 && distBg > tol * 1.4;
      }
      if (isFg) solidMask[gIdx] = 1;
    }
  }

  let fgCount = 0;
  for (let i = 0; i < nGrid; i++) fgCount += solidMask[i];
  if (fgCount < 16) {
    for (let y = 1; y <= innerH; y++) {
      for (let x = 1; x <= innerW; x++) {
        solidMask[y * gridW + x] = 1;
      }
    }
  }

  const widthMM = Math.max(5, Number(vec2dState.widthMM) || 100);
  const heightMM = Math.max(5, Number(vec2dState.heightMM) || 100);
  const mmPerPx = Math.max(widthMM / innerW, heightMM / innerH);

  // ========================================================================
  // 2. OBTENER CONTORNOS DE CORTE EXTERIOR (#ff0000) E INTERIOR (#0055ff)
  // ========================================================================
  let outerCutLoops = [];
  let holeCutLoops = [];

  const { filledOuterMask, internalHolesMask } = separateExteriorAndInternalHolesMask(solidMask, gridW, gridH);
  const sdfSolid = computeSignedDistanceField2D(solidMask, gridW, gridH);
  const sdfOuter = computeSignedDistanceField2D(filledOuterMask, gridW, gridH);

  if (vec2dState.cutMode === 'silhouette') {
    outerCutLoops = traceOuterSilhouetteAtOffsetMM(
      filledOuterMask,
      gridW,
      gridH,
      widthMM,
      heightMM,
      Number(vec2dState.cutOffsetMM) || 0,
      Math.max(0.8, vec2dState.minSpeckleMM2 * 3),
      vec2dState.simplifyTolMM * 1.2,
      vec2dState.smoothIterations
    );

    if (vec2dState.cutInternalHoles) {
      const sdfHoles = computeSignedDistanceField2D(internalHolesMask, gridW, gridH);
      const rawHolesPx = traceIsoContoursMarchingSquares(sdfHoles, gridW, gridH, 0.0, true);
      const convHoles = convertPixelLoopsToMM(
        rawHolesPx,
        gridW,
        gridH,
        widthMM,
        heightMM,
        Math.max(0.6, vec2dState.minSpeckleMM2 * 2),
        vec2dState.simplifyTolMM * 1.1,
        vec2dState.smoothIterations
      );
      holeCutLoops = convHoles.filter((l) => !l.isHole).map((l) => ({
        points: l.points,
        areaMM2: l.areaMM2,
        isHole: true
      }));
    }
  } else if (vec2dState.cutMode === 'rounded_rect') {
    const rad = Math.max(0, Math.min(widthMM * 0.45, heightMM * 0.45, Number(vec2dState.cornerRadiusMM) || 6));
    const hw = widthMM * 0.48;
    const hh = heightMM * 0.48;
    const pts = [];
    const segsCorner = 8;
    const cornersRR = [
      { cx: hw - rad, cy: hh - rad, a0: 0, a1: Math.PI * 0.5 },
      { cx: -hw + rad, cy: hh - rad, a0: Math.PI * 0.5, a1: Math.PI },
      { cx: -hw + rad, cy: -hh + rad, a0: Math.PI, a1: Math.PI * 1.5 },
      { cx: hw - rad, cy: -hh + rad, a0: Math.PI * 1.5, a1: Math.PI * 2 }
    ];
    cornersRR.forEach((c) => {
      for (let i = 0; i <= segsCorner; i++) {
        const ang = c.a0 + (c.a1 - c.a0) * (i / segsCorner);
        pts.push({ x: c.cx + Math.cos(ang) * rad, y: c.cy + Math.sin(ang) * rad });
      }
    });
    outerCutLoops = [{ points: pts, areaMM2: widthMM * heightMM, isHole: false }];
  } else if (vec2dState.cutMode === 'circle') {
    const rx = widthMM * 0.48;
    const ry = heightMM * 0.48;
    const pts = [];
    for (let i = 0; i < 64; i++) {
      const ang = (i * Math.PI * 2) / 64;
      pts.push({ x: Math.cos(ang) * rx, y: Math.sin(ang) * ry });
    }
    outerCutLoops = [{ points: pts, areaMM2: Math.PI * rx * ry, isHole: false }];
  }

  // Generar MARCO CONFIGURABLE si está activo (puede reemplazar el corte exterior y/o añadir orla grabada #008800)
  const frameData = buildConfigurableFrameLoops(widthMM, heightMM, filledOuterMask, sdfOuter, gridW, gridH, mmPerPx);
  const frameEngraveLoops = frameData.frameEngraveLoops || [];
  if (vec2dState.frameEnabled) {
    if (frameData.outerCutLoops && frameData.outerCutLoops.length > 0 && vec2dState.frameLaserMode !== 'engrave_only') {
      outerCutLoops = frameData.outerCutLoops;
    }
    if (frameData.holeCutLoops && frameData.holeCutLoops.length > 0) {
      holeCutLoops = holeCutLoops.concat(frameData.holeCutLoops);
    }
  }

  // Añadir perforación circular para llavero / colgante si está activa
  if (vec2dState.keyholeEnabled && (vec2dState.cutMode !== 'none' || vec2dState.frameEnabled)) {
    const rHole = Math.max(1.0, (Number(vec2dState.keyholeDiameterMM) || 4.5) * 0.5);
    let kx = 0;
    let ky = heightMM * 0.38;
    if (outerCutLoops.length > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      outerCutLoops.forEach((l) => l.points.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }));
      const marginHole = rHole + Math.max(2.8, widthMM * 0.035);
      if (vec2dState.keyholePos === 'top_left') {
        kx = minX + marginHole * 1.2;
        ky = maxY - marginHole * 1.2;
      } else if (vec2dState.keyholePos === 'left_center') {
        kx = minX + marginHole;
        ky = (minY + maxY) * 0.5;
      } else {
        kx = (minX + maxX) * 0.5;
        ky = maxY - marginHole;
      }
    }
    const kPts = [];
    for (let i = 0; i < 28; i++) {
      const ang = (i * Math.PI * 2) / 28;
      kPts.push({ x: kx + Math.cos(ang) * rHole, y: ky + Math.sin(ang) * rHole });
    }
    holeCutLoops.push({ points: kPts, areaMM2: Math.PI * rHole * rHole, isHole: true, isKeyhole: true });
  }

  // Si el marco recorta o se solapa con el interior del dibujo, creamos una máscara de ventana interior para que el dibujo no invada la banda del marco
  let frameWindowMask = null;
  if (vec2dState.frameEnabled) {
    if (vec2dState.frameShape === 'silhouette' && frameData.innerSilhouetteOffsetPx !== null) {
      frameWindowMask = new Uint8Array(nGrid);
      const minSdf = -frameData.innerSilhouetteOffsetPx;
      for (let i = 0; i < nGrid; i++) {
        if (sdfOuter[i] >= minSdf) frameWindowMask[i] = 1;
      }
    } else if (frameData.innerClipPolygons && frameData.innerClipPolygons.length > 0) {
      frameWindowMask = new Uint8Array(nGrid);
      const clipPoly = frameData.innerClipPolygons[0];
      const invGW = 1 / Math.max(1, gridW - 2);
      const invGH = 1 / Math.max(1, gridH - 2);
      for (let y = 1; y < gridH - 1; y++) {
        const mmY = (0.5 - (y - 1) * invGH) * heightMM;
        const row = y * gridW;
        for (let x = 1; x < gridW - 1; x++) {
          const mmX = ((x - 1) * invGW - 0.5) * widthMM;
          if (isPointInPolygon({ x: mmX, y: mmY }, clipPoly)) {
            frameWindowMask[row + x] = 1;
          }
        }
      }
    }
  }

  // ========================================================================
  // 3. MOTOR AVANZADO DE DETECCIÓN DE DIBUJOS Y TRAZOS DE GRABADO LÁSER
  // ========================================================================
  const thr = Math.max(5, Math.min(250, Number(vec2dState.engraveThreshold) || 148));
  const inv = Boolean(vec2dState.invertEngrave);
  const detectMode = vec2dState.engraveDetectMode || 'smart_drawing';
  const localSens = Math.max(0, Math.min(100, Number(vec2dState.localContrastSens) || 68));
  const strokeBoost = Math.max(-1.2, Math.min(2.5, Number(vec2dState.strokeBoostPx) || 0));

  // Media local por imagen integral en dos escalas (ventana fina para trazos/letras y ventana media para rasgos de dibujo)
  const radFine = Math.max(3, Math.round(Math.min(gridW, gridH) * 0.016));
  const radMed = Math.max(7, Math.round(Math.min(gridW, gridH) * 0.042));
  const localMeanFine = computeLocalMeanFieldIntegral(lumaGrid, gridW, gridH, radFine);
  const localMeanMed = computeLocalMeanFieldIntegral(lumaGrid, gridW, gridH, radMed);

  // Calcular gradiente cromático y de luminancia (para separar colores contiguos y resaltar líneas de dibujo)
  const colorGradGrid = new Float32Array(nGrid);
  for (let y = 1; y < gridH - 1; y++) {
    const row = y * gridW;
    for (let x = 1; x < gridW - 1; x++) {
      const idx = row + x;
      if (!solidMask[idx] || !solidMask[idx - 1] || !solidMask[idx + 1] || !solidMask[idx - gridW] || !solidMask[idx + gridW]) {
        continue;
      }
      const drX = rGrid[idx + 1] - rGrid[idx - 1];
      const dgX = gGrid[idx + 1] - gGrid[idx - 1];
      const dbX = bGrid[idx + 1] - bGrid[idx - 1];
      const drY = rGrid[idx + gridW] - rGrid[idx - gridW];
      const dgY = gGrid[idx + gridW] - gGrid[idx - gridW];
      const dbY = bGrid[idx + gridW] - bGrid[idx - gridW];
      colorGradGrid[idx] = Math.sqrt(drX * drX + dgX * dgX + dbX * dbX + drY * drY + dgY * dgY) * 0.5;
    }
  }

  // Si el corte es silueta sin margen (offset ~ 0), evitamos que el borde exterior se duplique como grabado
  const minInteriorDist = (vec2dState.cutMode === 'silhouette' && Math.abs(vec2dState.cutOffsetMM) < 0.25) ? 0.6 : -0.5;
  const adaptiveBias = Math.max(3.5, (108 - localSens) * 0.34);

  const rawEngraveField = new Float32Array(nGrid);
  rawEngraveField.fill(-80);

  for (let i = 0; i < nGrid; i++) {
    if (!solidMask[i] || sdfSolid[i] < minInteriorDist || (frameWindowMask && !frameWindowMask[i])) {
      rawEngraveField[i] = -60;
      continue;
    }

    const luma = lumaGrid[i];
    const mFine = localMeanFine[i];
    const mMed = localMeanMed[i];
    const cGrad = colorGradGrid[i];

    // Diferencia adaptativa local: positiva cuando el píxel es un trazo más oscuro que su vecindario inmediato
    const localDiffFine = inv ? (luma - mFine) : (mFine - luma);
    const localDiffMed = inv ? (luma - mMed) : (mMed - luma);
    const localStrokeScore = Math.max(localDiffFine * 1.35, localDiffMed) - adaptiveBias;

    // Puntuación global respecto al umbral principal
    const globalScore = inv ? (luma - thr) : (thr - luma);

    if (detectMode === 'line_art') {
      // Modo Solo Líneas / Entintado: extrae trazos locales oscuros y bordes entre colores, ignorando rellenos planos medios
      const veryDarkInk = inv ? (luma - Math.max(210, thr + 45)) : (Math.min(58, thr * 0.42) - luma);
      const colorEdgeScore = (cGrad - Math.max(14, (110 - localSens) * 0.55)) * 0.85;
      rawEngraveField[i] = Math.max(localStrokeScore * 2.1, veryDarkInk, colorEdgeScore);
    } else if (detectMode === 'global_threshold') {
      // Modo Clásico B/N
      rawEngraveField[i] = globalScore;
    } else if (detectMode === 'shaded_art') {
      // Modo Ilustración Sombreada: combina sombras intensas y trazos definidos en la capa principal #008800
      const deepShadowThr = inv ? Math.min(240, thr + 22) : Math.max(20, thr - 22);
      const deepScore = inv ? (luma - deepShadowThr) : (deepShadowThr - luma);
      rawEngraveField[i] = Math.max(deepScore, localStrokeScore * 1.9);
    } else {
      // 'smart_drawing' (Por defecto): Combina rellenos oscuros reales + trazos de dibujo adaptativos + bordes de color
      const solidDarkScore = globalScore;
      const adaptiveStroke = localStrokeScore * 2.2;
      const colorBoundary = (localSens > 30) ? ((cGrad - Math.max(22, (115 - localSens) * 0.7)) * 0.65) : -50;
      rawEngraveField[i] = Math.max(solidDarkScore, adaptiveStroke, colorBoundary);
    }
  }

  // Suavizado 3×3 sub-píxel + refuerzo ajustable de grosor de trazo (strokeBoost)
  const engraveField = smoothScalarField3x3(rawEngraveField, gridW, gridH);
  const isoEngrave = -strokeBoost * 8.5;

  const rawEngravePx = traceIsoContoursMarchingSquares(engraveField, gridW, gridH, isoEngrave, true);
  const engraveLoops = convertPixelLoopsToMM(
    rawEngravePx,
    gridW,
    gridH,
    widthMM,
    heightMM,
    vec2dState.minSpeckleMM2,
    vec2dState.simplifyTolMM,
    Math.max(0, vec2dState.smoothIterations - 1)
  );

  // ========================================================================
  // 4. CAPA COMPLEMENTARIA DE DETALLE FINO / MEDIOS TONOS (#ff8800)
  // ========================================================================
  let fineEdgeLoops = [];
  if (vec2dState.detectFineEdges) {
    const rawEdgeField = new Float32Array(nGrid);
    rawEdgeField.fill(-60);
    const sens = Math.max(10, Math.min(100, Number(vec2dState.edgeSensitivity) || 58));
    const gradCutoff = (112 - sens) * 1.75;

    for (let y = 2; y < gridH - 2; y++) {
      for (let x = 2; x < gridW - 2; x++) {
        const idx = y * gridW + x;
        if (!solidMask[idx] || sdfSolid[idx] < 1.2 || (frameWindowMask && !frameWindowMask[idx])) continue;
        // No duplicar regiones que ya están fuertemente dentro del grabado principal #008800
        if (engraveField[idx] > isoEngrave + 14) continue;

        if (detectMode === 'shaded_art') {
          // En modo Ilustración Sombreada, la capa #ff8800 captura los medios tonos suaves entre thr-22 y thr+28
          const luma = lumaGrid[idx];
          const midLow = Math.max(15, thr - 22);
          const midHigh = Math.min(242, thr + 32);
          const inMidBand = inv
            ? (luma >= 255 - midHigh && luma <= 255 - midLow)
            : (luma >= midLow && luma <= midHigh);
          if (inMidBand) {
            const centerMid = 0.5 * (midLow + midHigh);
            const halfSpan = 0.5 * (midHigh - midLow);
            rawEdgeField[idx] = halfSpan - Math.abs(luma - centerMid);
          }
        } else {
          // Operador Sobel + gradiente cromático para detalles sutiles y transiciones de color no capturadas en #008800
          const gx =
            -lumaGrid[(y - 1) * gridW + (x - 1)] + lumaGrid[(y - 1) * gridW + (x + 1)] +
            -2 * lumaGrid[y * gridW + (x - 1)] + 2 * lumaGrid[y * gridW + (x + 1)] +
            -lumaGrid[(y + 1) * gridW + (x - 1)] + lumaGrid[(y + 1) * gridW + (x + 1)];
          const gy =
            -lumaGrid[(y - 1) * gridW + (x - 1)] - 2 * lumaGrid[(y - 1) * gridW + x] - lumaGrid[(y - 1) * gridW + (x + 1)] +
            lumaGrid[(y + 1) * gridW + (x - 1)] + 2 * lumaGrid[(y + 1) * gridW + x] + lumaGrid[(y + 1) * gridW + (x + 1)];
          const mag = Math.hypot(gx, gy) + colorGradGrid[idx] * 2.2;
          rawEdgeField[idx] = mag - gradCutoff;
        }
      }
    }

    const edgeField = smoothScalarField3x3(rawEdgeField, gridW, gridH);
    const rawEdgesPx = traceIsoContoursMarchingSquares(edgeField, gridW, gridH, 0.0, true);
    fineEdgeLoops = convertPixelLoopsToMM(
      rawEdgesPx,
      gridW,
      gridH,
      widthMM,
      heightMM,
      Math.max(0.10, vec2dState.minSpeckleMM2 * 0.8),
      vec2dState.simplifyTolMM * 0.85,
      1
    ).filter((l) => !l.isHole);
  }

  // Calcular dimensiones físicas totales incluyendo marco y margen de corte exterior
  let maxHalfW = widthMM * 0.5;
  let maxHalfH = heightMM * 0.5;
  const expandBounds = (loopsArr) => {
    loopsArr.forEach((l) => {
      if (!l.points) return;
      l.points.forEach((p) => {
        if (Math.abs(p.x) > maxHalfW) maxHalfW = Math.abs(p.x);
        if (Math.abs(p.y) > maxHalfH) maxHalfH = Math.abs(p.y);
      });
    });
  };
  expandBounds(outerCutLoops);
  expandBounds(frameEngraveLoops);
  const totalWidthMM = maxHalfW * 2;
  const totalHeightMM = maxHalfH * 2;

  // Trama de barrido (Hatching vectorial) si se eligió 'vector_hatch'
  let hatchPolylines = [];
  if (vec2dState.engraveStyle === 'vector_hatch') {
    if (engraveLoops.length > 0) {
      hatchPolylines = generateHatchPolylinesForLoops(
        engraveLoops,
        totalWidthMM,
        totalHeightMM,
        vec2dState.hatchSpacingMM,
        vec2dState.hatchCross
      );
    }
    if (frameEngraveLoops.length > 0) {
      hatchPolylines = hatchPolylines.concat(
        generateHatchPolylinesForLoops(
          frameEngraveLoops,
          totalWidthMM,
          totalHeightMM,
          vec2dState.hatchSpacingMM,
          vec2dState.hatchCross
        )
      );
    }
  }

  // Generar imagen raster procesada en blanco/negro para modo 'hybrid_raster'
  let processedDataUrl = '';
  if (vec2dState.engraveStyle === 'hybrid_raster') {
    const rCanvas = document.createElement('canvas');
    rCanvas.width = innerW;
    rCanvas.height = innerH;
    const rCtx = rCanvas.getContext('2d');
    const rImg = rCtx.createImageData(innerW, innerH);
    for (let y = 0; y < innerH; y++) {
      for (let x = 0; x < innerW; x++) {
        const gIdx = (y + 1) * gridW + (x + 1);
        const pIdx = (y * innerW + x) * 4;
        if (engraveField[gIdx] > isoEngrave) {
          rImg.data[pIdx] = 0;
          rImg.data[pIdx + 1] = 110;
          rImg.data[pIdx + 2] = 0;
          rImg.data[pIdx + 3] = 255;
        } else {
          rImg.data[pIdx] = 255;
          rImg.data[pIdx + 1] = 255;
          rImg.data[pIdx + 2] = 255;
          rImg.data[pIdx + 3] = 0;
        }
      }
    }
    rCtx.putImageData(rImg, 0, 0);
    processedDataUrl = rCanvas.toDataURL('image/png');
  }

  let totalNodes = 0;
  outerCutLoops.forEach((l) => { totalNodes += l.points.length; });
  holeCutLoops.forEach((l) => { totalNodes += l.points.length; });
  engraveLoops.forEach((l) => { totalNodes += l.points.length; });
  frameEngraveLoops.forEach((l) => { totalNodes += l.points.length; });
  fineEdgeLoops.forEach((l) => { totalNodes += l.points.length; });

  vec2dState.result = {
    outerCutLoops,
    holeCutLoops,
    engraveLoops,
    frameEngraveLoops,
    fineEdgeLoops,
    hatchPolylines,
    processedDataUrl,
    totalWidthMM,
    totalHeightMM,
    stats: {
      cutOuterCount: outerCutLoops.length,
      cutHoleCount: holeCutLoops.length,
      engraveIslandCount: engraveLoops.length + frameEngraveLoops.length,
      fineEdgeCount: fineEdgeLoops.length,
      hatchLinesCount: hatchPolylines.length,
      totalNodes
    }
  };

  if (typeof resetVectorizerEditorSelectionOnRetrace === 'function') {
    resetVectorizerEditorSelectionOnRetrace();
  }
  renderImageVectorizerPreview();
  updateVectorizerStatsUI();
  if (typeof syncVectorizerEditorToolbarUI === 'function') {
    syncVectorizerEditorToolbarUI();
  }
}

// ============================================================================
// ESTADO Y MOTOR DEL EDITOR VECTORIAL INTERACTIVO (SELECCIÓN, NODOS, BORRADOR, DIBUJO Y TEXTO)
// ============================================================================
const vecEditorState = {
  tool: 'select',              // 'select' | 'nodes' | 'eraser' | 'draw_freehand' | 'draw_rect' | 'draw_circle' | 'add_text' | 'pan'
  zoom: 1.0,
  panX: 0.0,
  panY: 0.0,
  selectedLayer: null,         // 'outerCutLoops' | 'holeCutLoops' | 'engraveLoops' | 'frameEngraveLoops' | 'fineEdgeLoops'
  selectedIndex: -1,
  selectedNodeIndex: -1,
  hoveredNodeIndex: -1,
  drawTargetLayer: 'engraveLoops',
  eraserRadiusMM: 3.5,
  eraserFilter: 'all',         // 'all' | 'engrave_only' | 'cut_only'
  textValue: 'TEXTO LÁSER',
  textHeightMM: 10.0,
  textLayer: 'engraveLoops',
  isDragging: false,
  dragMode: null,              // 'move_loop' | 'move_node' | 'pan' | 'erase' | 'draw_shape'
  dragUndoPushed: false,
  dragStartScreen: { x: 0, y: 0 },
  dragStartMM: { x: 0, y: 0 },
  dragCurrMM: { x: 0, y: 0 },
  freehandPtsMM: [],
  cursorMM: null,
  undoStack: [],
  redoStack: [],
  eventsBound: false
};

function resetVectorizerEditorSelectionOnRetrace() {
  vecEditorState.selectedLayer = null;
  vecEditorState.selectedIndex = -1;
  vecEditorState.selectedNodeIndex = -1;
  vecEditorState.hoveredNodeIndex = -1;
  vecEditorState.undoStack = [];
  vecEditorState.redoStack = [];
}

function getVectorizerCanvasTransform(canvas) {
  const res = vec2dState.result;
  const imgWMM = Math.max(5, vec2dState.widthMM);
  const imgHMM = Math.max(5, vec2dState.heightMM);
  const wMM = Math.max(imgWMM, res.totalWidthMM || imgWMM);
  const hMM = Math.max(imgHMM, res.totalHeightMM || imgHMM);
  const pad = 34;
  const baseScale = Math.min((canvas.width - pad * 2) / wMM, (canvas.height - pad * 2) / hMM);
  const zoom = Math.max(0.35, Math.min(14.0, Number(vecEditorState.zoom) || 1.0));
  const scale = baseScale * zoom;
  const cx = canvas.width * 0.5 + (Number(vecEditorState.panX) || 0);
  const cy = canvas.height * 0.5 + (Number(vecEditorState.panY) || 0);
  return {
    wMM,
    hMM,
    imgWMM,
    imgHMM,
    baseScale,
    zoom,
    scale,
    cx,
    cy,
    toX: (x) => cx + x * scale,
    toY: (y) => cy - y * scale,
    toMMX: (sx) => (sx - cx) / scale,
    toMMY: (sy) => (cy - sy) / scale
  };
}

// ============================================================================
// RENDERIZADO DEL LIENZO DE PREVISUALIZACIÓN Y OVERLAY DEL EDITOR EN TIEMPO REAL
// ============================================================================
function renderImageVectorizerPreview() {
  const canvas = document.getElementById('vectorizerPreviewCanvas');
  if (!canvas) return;
  const rect = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : { width: 520, height: 420 };
  canvas.width = Math.max(320, rect.width || 520);
  canvas.height = Math.max(280, rect.height || 420);

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const res = vec2dState.result;
  const tf = getVectorizerCanvasTransform(canvas);
  const { wMM, hMM, imgWMM, imgHMM, scale, cx, toX, toY } = tf;

  // Fondo cuadriculado técnico
  ctx.save();
  const docLeft = toX(-wMM * 0.5);
  const docTop = toY(hMM * 0.5);
  const docW = wMM * scale;
  const docH = hMM * scale;
  ctx.fillStyle = '#090d16';
  ctx.fillRect(docLeft, docTop, docW, docH);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(docLeft, docTop, docW, docH);
  ctx.restore();

  if (vec2dState.previewMode === 'original' && vec2dState.sourceCanvas) {
    ctx.drawImage(
      vec2dState.sourceCanvas,
      toX(-imgWMM * 0.5),
      toY(imgHMM * 0.5),
      imgWMM * scale,
      imgHMM * scale
    );
    return;
  }

  const showCut = vec2dState.previewMode === 'combined' || vec2dState.previewMode === 'cut_only';
  const showEngrave = vec2dState.previewMode === 'combined' || vec2dState.previewMode === 'engrave_only';

  // 1. Sombreado del material de la pieza cortada
  if (showCut && res.outerCutLoops.length > 0) {
    ctx.save();
    ctx.beginPath();
    res.outerCutLoops.forEach((l) => {
      l.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(toX(p.x), toY(p.y));
        else ctx.lineTo(toX(p.x), toY(p.y));
      });
      ctx.closePath();
    });
    res.holeCutLoops.forEach((l) => {
      l.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(toX(p.x), toY(p.y));
        else ctx.lineTo(toX(p.x), toY(p.y));
      });
      ctx.closePath();
    });
    ctx.fillStyle = 'rgba(14, 165, 233, 0.12)';
    ctx.fill('evenodd');
    ctx.restore();
  }

  // 2. Capa de GRABADO LÁSER (#10b981 verde esmeralda y #f59e0b bordes finos)
  if (showEngrave) {
    if (vec2dState.engraveStyle === 'vector_hatch' && res.hatchPolylines.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      res.hatchPolylines.forEach((seg) => {
        ctx.moveTo(toX(seg[0].x), toY(seg[0].y));
        ctx.lineTo(toX(seg[1].x), toY(seg[1].y));
      });
      ctx.stroke();
      ctx.restore();
    } else {
      if (res.engraveLoops.length > 0) {
        ctx.save();
        ctx.beginPath();
        res.engraveLoops.forEach((l) => {
          l.points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(toX(p.x), toY(p.y));
            else ctx.lineTo(toX(p.x), toY(p.y));
          });
          ctx.closePath();
        });
        if (vec2dState.engraveStyle !== 'vector_outline') {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.48)';
          ctx.fill('evenodd');
        }
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.25;
        ctx.stroke();
        ctx.restore();
      }

      if (res.frameEngraveLoops && res.frameEngraveLoops.length > 0) {
        ctx.save();
        ctx.beginPath();
        res.frameEngraveLoops.forEach((l) => {
          l.points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(toX(p.x), toY(p.y));
            else ctx.lineTo(toX(p.x), toY(p.y));
          });
          ctx.closePath();
        });
        if (vec2dState.engraveStyle !== 'vector_outline') {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.52)';
          ctx.fill('evenodd');
        }
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.35;
        ctx.stroke();
        ctx.restore();
      }
    }

    if (vec2dState.detectFineEdges && res.fineEdgeLoops.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.05;
      ctx.beginPath();
      res.fineEdgeLoops.forEach((l) => {
        l.points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(toX(p.x), toY(p.y));
          else ctx.lineTo(toX(p.x), toY(p.y));
        });
        ctx.closePath();
      });
      if (vec2dState.engraveDetectMode === 'shaded_art') {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.28)';
        ctx.fill('evenodd');
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // 3. Capa de CORTE EXTERIOR (#f43f5e rojo) y HUECOS INTERNOS (#38bdf8 azul)
  if (showCut) {
    res.outerCutLoops.forEach((l) => {
      if (typeof drawContourWithTabsOnCanvas === 'function') {
        drawContourWithTabsOnCanvas(ctx, l.points, false, '#f43f5e', 2.2, toX, toY);
      } else {
        ctx.save();
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        l.points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(toX(p.x), toY(p.y));
          else ctx.lineTo(toX(p.x), toY(p.y));
        });
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    });

    res.holeCutLoops.forEach((l) => {
      if (typeof drawContourWithTabsOnCanvas === 'function') {
        drawContourWithTabsOnCanvas(ctx, l.points, true, '#38bdf8', 1.7, toX, toY);
      } else {
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        l.points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(toX(p.x), toY(p.y));
          else ctx.lineTo(toX(p.x), toY(p.y));
        });
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    });
  }

  // 4. OVERLAY DEL EDITOR VECTORIAL INTERACTIVO (Contorno seleccionado, Nodos, Goma de borrar, Dibujo en curso)
  renderVectorizerEditorOverlay(ctx, tf);

  // Cotas físicas en pantalla
  ctx.save();
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  const dimText = vec2dState.frameEnabled
    ? (wMM.toFixed(1) + ' × ' + hMM.toFixed(1) + ' mm con marco (Imagen: ' + imgWMM.toFixed(1) + '×' + imgHMM.toFixed(1) + ' mm)')
    : (wMM.toFixed(1) + ' × ' + hMM.toFixed(1) + ' mm (' + vec2dState.imageName + ')');
  ctx.fillText(dimText, cx, Math.max(14, docTop - 8));
  ctx.restore();
}

function updateVectorizerStatsUI() {
  const badge = document.getElementById('vecStatsSummaryBadge');
  if (!badge) return;
  const res = vec2dState.result;
  const st = res.stats;
  const totW = (res.totalWidthMM || vec2dState.widthMM).toFixed(1);
  const totH = (res.totalHeightMM || vec2dState.heightMM).toFixed(1);
  badge.innerHTML =
    '✂️ <strong>Corte Ext.:</strong> ' + st.cutOuterCount +
    ' · 🔵 <strong>Huecos:</strong> ' + st.cutHoleCount +
    ' · ⚡ <strong>Grabado:</strong> ' + st.engraveIslandCount + ' vectores' +
    (vec2dState.frameEnabled ? ' <span class="text-fuchsia-300">(🖼️ Marco activo)</span>' : '') +
    (vec2dState.detectFineEdges ? (' + ' + st.fineEdgeCount + ' detalles') : '') +
    (vec2dState.engraveStyle === 'vector_hatch' ? (' (' + st.hatchLinesCount + ' líneas trama)') : '') +
    ' · 📐 ' + totW + '×' + totH + ' mm';
}

// ============================================================================
// GENERACIÓN DIRECTA DE ARCHIVO .SVG Y .DXF DE CORTE Y GRABADO (ESCALA 1:1 MM)
// ============================================================================
function generateVectorizedImageSVG() {
  const res = vec2dState.result;
  const totW = Math.max(vec2dState.widthMM, res.totalWidthMM || vec2dState.widthMM);
  const totH = Math.max(vec2dState.heightMM, res.totalHeightMM || vec2dState.heightMM);
  const padMM = Math.max(2, Number(vec2dState.cutOffsetMM) + 2);
  const svgW = Math.max(10, totW + padMM * 2);
  const svgH = Math.max(10, totH + padMM * 2);
  const toX = (x) => (x + svgW * 0.5).toFixed(4);
  const toY = (y) => (svgH * 0.5 - y).toFixed(4);
  const strokeMm = Math.max(0.12, Math.min(svgW, svgH) * 0.002).toFixed(4);

  const xmlHeader = '<' + '?xml version="1.0" encoding="UTF-8" standalone="no"?' + '>';
  const lines = [
    xmlHeader,
    '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="' + svgW.toFixed(3) + 'mm" height="' + svgH.toFixed(3) + 'mm" viewBox="0 0 ' + svgW.toFixed(4) + ' ' + svgH.toFixed(4) + '" style="background:#ffffff;">',
    '  <title>' + escapeXmlAttr(vec2dState.imageName + ' - Corte y Grabado Laser (LayerStudio 3D)') + '</title>',
    '  <desc>' + escapeXmlAttr('Vectorizado automatico PNG/BMP a SVG 1:1 en mm | Pieza: ' + totW.toFixed(1) + 'x' + totH.toFixed(1) + 'mm | Rojo #ff0000: Corte Exterior | Azul #0055ff: Corte Huecos | Verde #008800: Grabado Vectorial | Naranja #ff8800: Grabado Detalle Fino') + '</desc>'
  ];

  // 1. Si es modo híbrido raster, embeber imagen PNG alto contraste en capa GRABADO_RASTER
  if (vec2dState.engraveStyle === 'hybrid_raster' && res.processedDataUrl) {
    const imgX = (svgW - vec2dState.widthMM) * 0.5;
    const imgY = (svgH - vec2dState.heightMM) * 0.5;
    lines.push('  <g id="GRABADO_RASTER_IMAGEN">');
    lines.push('    <image x="' + imgX.toFixed(4) + '" y="' + imgY.toFixed(4) + '" width="' + vec2dState.widthMM.toFixed(4) + '" height="' + vec2dState.heightMM.toFixed(4) + '" href="' + res.processedDataUrl + '" />');
    lines.push('  </g>');
  }

  // 2. Capa GRABADO_VECTORIAL (#008800)
  if (vec2dState.engraveStyle === 'vector_hatch' && res.hatchPolylines.length > 0) {
    let dHatch = '';
    res.hatchPolylines.forEach((seg) => {
      dHatch += 'M ' + toX(seg[0].x) + ' ' + toY(seg[0].y) + ' L ' + toX(seg[1].x) + ' ' + toY(seg[1].y) + ' ';
    });
    lines.push('  <g id="GRABADO_TRAMA_BARRIDO" fill="none" stroke="#008800" stroke-width="' + strokeMm + '" stroke-linecap="round">');
    lines.push('    <path id="trama_grabado" d="' + dHatch.trim() + '" vector-effect="non-scaling-stroke" />');
    lines.push('  </g>');
  } else if (res.engraveLoops.length > 0 || (res.frameEngraveLoops && res.frameEngraveLoops.length > 0)) {
    const buildCompoundD = (loopsList) => {
      let comp = '';
      (loopsList || []).forEach((l) => {
        if (!l.points || l.points.length < 3) return;
        let d = 'M ' + toX(l.points[0].x) + ' ' + toY(l.points[0].y);
        for (let i = 1; i < l.points.length; i++) {
          d += ' L ' + toX(l.points[i].x) + ' ' + toY(l.points[i].y);
        }
        d += ' Z ';
        comp += d;
      });
      return comp.trim();
    };

    const compoundEngrave = vec2dState.engraveStyle === 'hybrid_raster' ? '' : buildCompoundD(res.engraveLoops);
    const compoundFrame = buildCompoundD(res.frameEngraveLoops);

    if (compoundEngrave.length > 0 || compoundFrame.length > 0) {
      const fillAttr = vec2dState.engraveStyle === 'vector_outline'
        ? 'fill="none"'
        : 'fill="#008800" fill-opacity="0.28" fill-rule="evenodd"';
      lines.push('  <g id="GRABADO_VECTORIAL" ' + fillAttr + ' stroke="#008800" stroke-width="' + strokeMm + '" stroke-linecap="round" stroke-linejoin="round">');
      if (compoundEngrave.length > 0) {
        lines.push('    <path id="regiones_grabado" d="' + compoundEngrave + '" vector-effect="non-scaling-stroke" />');
      }
      if (compoundFrame.length > 0) {
        lines.push('    <path id="marco_grabado" d="' + compoundFrame + '" vector-effect="non-scaling-stroke" />');
      }
      lines.push('  </g>');
    }
  }

  // 3. Capa GRABADO_DETALLE_FINO (#ff8800)
  if (vec2dState.detectFineEdges && res.fineEdgeLoops.length > 0) {
    let dEdges = '';
    res.fineEdgeLoops.forEach((l) => {
      if (!l.points || l.points.length < 3) return;
      let d = 'M ' + toX(l.points[0].x) + ' ' + toY(l.points[0].y);
      for (let i = 1; i < l.points.length; i++) {
        d += ' L ' + toX(l.points[i].x) + ' ' + toY(l.points[i].y);
      }
      d += ' Z ';
      dEdges += d;
    });
    if (dEdges.trim().length > 0) {
      const edgeFill = vec2dState.engraveDetectMode === 'shaded_art'
        ? 'fill="#ff8800" fill-opacity="0.22" fill-rule="evenodd"'
        : 'fill="none"';
      lines.push('  <g id="GRABADO_DETALLE_FINO" ' + edgeFill + ' stroke="#ff8800" stroke-width="' + strokeMm + '" stroke-linecap="round" stroke-linejoin="round">');
      lines.push('    <path id="bordes_finos" d="' + dEdges.trim() + '" vector-effect="non-scaling-stroke" />');
      lines.push('  </g>');
    }
  }

  // 4. Capa CORTE_INTERIOR_HUECOS (#0055ff)
  if (res.holeCutLoops.length > 0) {
    lines.push('  <g id="CORTE_INTERIOR_HUECOS" fill="none" stroke="#0055ff" stroke-width="' + strokeMm + '" stroke-linecap="round" stroke-linejoin="round">');
    res.holeCutLoops.forEach((l, idx) => {
      const dHole = typeof buildSvgCutPathD === 'function'
        ? buildSvgCutPathD(l.points, true, toX, toY)
        : ('M ' + l.points.map((p) => toX(p.x) + ' ' + toY(p.y)).join(' L ') + ' Z');
      if (dHole) {
        lines.push('    <path id="hueco_corte_' + (idx + 1) + '" d="' + dHole + '" vector-effect="non-scaling-stroke" />');
      }
    });
    lines.push('  </g>');
  }

  // 5. Capa CORTE_EXTERIOR (#ff0000)
  if (res.outerCutLoops.length > 0) {
    lines.push('  <g id="CORTE_EXTERIOR" fill="none" stroke="#ff0000" stroke-width="' + strokeMm + '" stroke-linecap="round" stroke-linejoin="round">');
    res.outerCutLoops.forEach((l, idx) => {
      const dOut = typeof buildSvgCutPathD === 'function'
        ? buildSvgCutPathD(l.points, false, toX, toY)
        : ('M ' + l.points.map((p) => toX(p.x) + ' ' + toY(p.y)).join(' L ') + ' Z');
      if (dOut) {
        lines.push('    <path id="corte_exterior_' + (idx + 1) + '" d="' + dOut + '" vector-effect="non-scaling-stroke" />');
      }
    });
    lines.push('  </g>');
  }

  lines.push('</svg>');
  return lines.join('\n');
}

function generateVectorizedImageDXF() {
  const res = vec2dState.result;
  const totW = Math.max(vec2dState.widthMM, res.totalWidthMM || vec2dState.widthMM);
  const totH = Math.max(vec2dState.heightMM, res.totalHeightMM || vec2dState.heightMM);
  const padMM = Math.max(2, Number(vec2dState.cutOffsetMM) + 2);
  const docW = Math.max(10, totW + padMM * 2);
  const docH = Math.max(10, totH + padMM * 2);
  const cx = docW * 0.5;
  const cy = docH * 0.5;

  const byLayer = { C00: [], C01: [], C02: [], C03: [], C04: [] };

  const pushLoopToLayer = (pts, layerKey) => {
    if (!pts || pts.length < 3) return;
    byLayer[layerKey].push({
      closed: true,
      points: pts.map((p) => ({ x: p.x + cx, y: p.y + cy }))
    });
  };

  if (vec2dState.engraveStyle === 'vector_hatch') {
    (res.hatchPolylines || []).forEach((seg) => {
      if (!seg || seg.length < 2) return;
      byLayer.C00.push({
        closed: false,
        points: seg.map((p) => ({ x: p.x + cx, y: p.y + cy }))
      });
    });
  } else {
    (res.engraveLoops || []).forEach((l) => pushLoopToLayer(l.points, 'C00'));
  }

  if (res.frameEngraveLoops) {
    res.frameEngraveLoops.forEach((l) => pushLoopToLayer(l.points, 'C00'));
  }
  if (vec2dState.detectFineEdges) {
    (res.fineEdgeLoops || []).forEach((l) => pushLoopToLayer(l.points, 'C01'));
  }
  (res.holeCutLoops || []).forEach((l) => pushLoopToLayer(l.points, 'C03'));
  (res.outerCutLoops || []).forEach((l) => pushLoopToLayer(l.points, 'C04'));

  if (typeof buildStandardLaserDXF === 'function') {
    return buildStandardLaserDXF(docW, docH, byLayer);
  }

  const layerNames = ['C00', 'C01', 'C02', 'C03', 'C04'];
  const aciMap = { C00: '5', C01: '5', C02: '5', C03: '1', C04: '1' };
  const out = [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$ACADVER', '1', 'AC1009',
    '9', '$INSUNITS', '70', '4',
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES'
  ];
  layerNames.forEach((lid) => {
    const aci = aciMap[lid];
    byLayer[lid].forEach((sp) => {
      if (!sp.points || sp.points.length < 2) return;
      out.push('0', 'POLYLINE', '8', lid, '62', aci, '66', '1', '70', sp.closed ? '1' : '0');
      sp.points.forEach((pt) => {
        out.push('0', 'VERTEX', '8', lid, '62', aci, '10', pt.x.toFixed(3), '20', pt.y.toFixed(3), '30', '0.0');
      });
      out.push('0', 'SEQEND', '8', lid);
    });
  });
  out.push('0', 'ENDSEC', '0', 'EOF');
  return out.join('\n');
}

function triggerVectorizerFileDownload(blob, filename) {
  if (typeof triggerBrowserDownload === 'function') {
    triggerBrowserDownload(blob, filename);
    return;
  }
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

function downloadVectorizedSVG() {
  const svg = generateVectorizedImageSVG();
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  triggerVectorizerFileDownload(blob, (vec2dState.imageName || 'Imagen_Laser') + '_CORTE_Y_GRABADO.svg');
}

function downloadVectorizedDXF() {
  const dxf = generateVectorizedImageDXF();
  const blob = new Blob([dxf], { type: 'application/dxf;charset=utf-8' });
  triggerVectorizerFileDownload(blob, (vec2dState.imageName || 'Imagen_Laser') + '_CORTE_Y_GRABADO.dxf');
}

// ============================================================================
// INTEGRACIÓN CON LAYERSTUDIO 3D: ENVIAR COMO PIEZA 1 CAPA O RELIEVE 3D MULTICAPA
// ============================================================================
function applyVectorizedImageToLayerStudio(asReliefMultilayer = false) {
  const res = vec2dState.result;
  if (!res || (res.outerCutLoops.length === 0 && res.engraveLoops.length === 0 && (!res.frameEngraveLoops || res.frameEngraveLoops.length === 0))) return;

  const imgWMM = Math.max(10, vec2dState.widthMM);
  const imgHMM = Math.max(10, vec2dState.heightMM);
  const wMM = Math.max(imgWMM, res.totalWidthMM || imgWMM);
  const hMM = Math.max(imgHMM, res.totalHeightMM || imgHMM);
  const thickMM = Math.max(1, state.thickness || 4);

  state.modelName = vec2dState.imageName || 'Placa_Laser_2D';
  state.constructionMode = 'stacked';
  state.axis = 'z';

  const baseOuterLoops = res.outerCutLoops.length > 0
    ? res.outerCutLoops
    : [{
        points: [
          { x: -wMM * 0.5, y: -hMM * 0.5 },
          { x: wMM * 0.5, y: -hMM * 0.5 },
          { x: wMM * 0.5, y: hMM * 0.5 },
          { x: -wMM * 0.5, y: hMM * 0.5 }
        ],
        areaMM2: wMM * hMM,
        isHole: false
      }];

  const baseCutLoops = [];
  baseOuterLoops.forEach((l) => {
    const pts = l.points.map((p) => ({ x: p.x, y: p.y }));
    if (l.isFrame) pts.isFrame = true;
    baseCutLoops.push({
      points: pts,
      absArea: l.areaMM2,
      signedArea: l.areaMM2,
      isHole: false,
      isFrame: Boolean(l.isFrame)
    });
  });
  res.holeCutLoops.forEach((l) => {
    const pts = l.points.map((p) => ({ x: p.x, y: p.y }));
    if (l.isFrame) pts.isFrame = true;
    baseCutLoops.push({
      points: pts,
      absArea: l.areaMM2,
      signedArea: -l.areaMM2,
      isHole: true,
      isFrame: Boolean(l.isFrame)
    });
  });

  const combinedEngrave = res.engraveLoops.concat(res.frameEngraveLoops || []);

  if (!asReliefMultilayer) {
    state.dimsMM = { x: wMM, y: hMM, z: thickMM };
    state.sliceCount = 1;

    const engraveLoopsCopy = combinedEngrave.map((l) => ({
      points: l.points.map((p) => ({ x: p.x, y: p.y })),
      isHole: Boolean(l.isHole),
      areaMM2: l.areaMM2
    }));
    const fineEdgeLoopsCopy = vec2dState.detectFineEdges
      ? res.fineEdgeLoops.map((l) => ({
          points: l.points.map((p) => ({ x: p.x, y: p.y })),
          isHole: false,
          areaMM2: l.areaMM2
        }))
      : [];

    state.slices = [{
      index: 0,
      coord: 0,
      sliceAxis: 'z',
      selected: true,
      rawLoops: baseCutLoops,
      modelLoops: baseCutLoops.slice(),
      unsplitLoops: baseCutLoops,
      loops: baseCutLoops.slice(),
      baseEngraveLoops: engraveLoopsCopy.slice(),
      engraveLoops: engraveLoopsCopy,
      fineEdgeLoops: fineEdgeLoopsCopy,
      hatchPolylines: res.hatchPolylines ? res.hatchPolylines.slice() : [],
      engraveStyle: vec2dState.engraveStyle,
      filteredCount: 0
    }];
  } else {
    const numLayers = Math.max(2, Math.min(10, parseInt(vec2dState.reliefLayersCount, 10) || 4));
    const totalZ = numLayers * thickMM;
    state.dimsMM = { x: wMM, y: hMM, z: totalZ };
    state.sliceCount = numLayers;
    state.slices = [];

    state.slices.push({
      index: 0,
      coord: -totalZ * 0.5 + thickMM * 0.5,
      sliceAxis: 'z',
      selected: true,
      rawLoops: baseCutLoops,
      modelLoops: baseCutLoops.slice(),
      unsplitLoops: baseCutLoops,
      loops: baseCutLoops.slice(),
      baseEngraveLoops: combinedEngrave.slice(),
      engraveLoops: combinedEngrave.slice(),
      fineEdgeLoops: [],
      hatchPolylines: [],
      engraveStyle: 'vector_outline',
      filteredCount: 0
    });

    const srcW = vec2dState.sourceCanvas.width;
    const srcH = vec2dState.sourceCanvas.height;
    const sc = 240 / Math.max(srcW, srcH);
    const iW = Math.max(24, Math.round(srcW * sc));
    const iH = Math.max(24, Math.round(srcH * sc));
    const gW = iW + 2;
    const gH = iH + 2;
    const cTmp = document.createElement('canvas');
    cTmp.width = iW;
    cTmp.height = iH;
    const ctxTmp = cTmp.getContext('2d');
    ctxTmp.drawImage(vec2dState.sourceCanvas, 0, 0, iW, iH);
    const dataTmp = ctxTmp.getImageData(0, 0, iW, iH).data;

    const frameReliefLoops = (res.frameEngraveLoops || []).map((l) => ({
      points: l.points.map((p) => ({ x: p.x, y: p.y })),
      absArea: l.areaMM2,
      signedArea: l.isHole ? -l.areaMM2 : l.areaMM2,
      isHole: Boolean(l.isHole)
    }));

    for (let k = 1; k < numLayers; k++) {
      const frac = k / numLayers;
      const layerThr = vec2dState.invertEngrave
        ? (60 + frac * 165)
        : (215 - frac * 155);
      const fieldK = new Float32Array(gW * gH);
      fieldK.fill(-50);
      for (let y = 0; y < iH; y++) {
        for (let x = 0; x < iW; x++) {
          const sIdx = (y * iW + x) * 4;
          const a = dataTmp[sIdx + 3];
          if (a < 60) continue;
          const luma = 0.299 * dataTmp[sIdx] + 0.587 * dataTmp[sIdx + 1] + 0.114 * dataTmp[sIdx + 2];
          fieldK[(y + 1) * gW + (x + 1)] = vec2dState.invertEngrave ? (luma - layerThr) : (layerThr - luma);
        }
      }
      const rawPxK = traceIsoContoursMarchingSquares(smoothScalarField3x3(fieldK, gW, gH), gW, gH, 0.0, true);
      const loopsK = convertPixelLoopsToMM(rawPxK, gW, gH, imgWMM, imgHMM, Math.max(0.8, vec2dState.minSpeckleMM2 * 2), vec2dState.simplifyTolMM, vec2dState.smoothIterations)
        .map((l) => ({
          points: l.points,
          absArea: l.areaMM2,
          signedArea: l.isHole ? -l.areaMM2 : l.areaMM2,
          isHole: l.isHole
        }))
        .concat(frameReliefLoops);

      const zCoord = -totalZ * 0.5 + (k + 0.5) * thickMM;
      const effLoopsK = loopsK.length > 0 ? loopsK : baseCutLoops;
      state.slices.push({
        index: k,
        coord: zCoord,
        sliceAxis: 'z',
        selected: true,
        rawLoops: effLoopsK,
        modelLoops: effLoopsK.slice(),
        unsplitLoops: effLoopsK,
        loops: effLoopsK.slice(),
        baseEngraveLoops: [],
        engraveLoops: [],
        fineEdgeLoops: [],
        hatchPolylines: [],
        filteredCount: 0
      });
    }
  }

  state.activeSliceIndex = 0;
  if (typeof syncDimensionInputsUI === 'function') syncDimensionInputsUI();
  if (typeof applySlicerFrameToExistingSlices === 'function') {
    applySlicerFrameToExistingSlices(false);
  }
  if (typeof applyModelSplitToExistingSlices === 'function') {
    applyModelSplitToExistingSlices(false);
  }
  if (typeof build3DSlicesMesh === 'function') build3DSlicesMesh();
  if (state.nestingEnabled && typeof recomputeBoardNesting === 'function') {
    recomputeBoardNesting();
  }
  if (typeof renderSliceStripUI === 'function') renderSliceStripUI();
  if (typeof update2DInspectorHeader === 'function') update2DInspectorHeader();
  if (typeof render2DSlice === 'function') render2DSlice();
  if (typeof resetCamera3D === 'function') resetCamera3D();

  closeImageVectorizerModal();
}

// ============================================================================
// SINCRONIZACIÓN Y EVENTOS DE CONTROLES DEL MODAL VECTORIZADOR
// ============================================================================
function syncVectorizerModalUI() {
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v;
  };
  const setChk = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.checked = Boolean(v);
  };
  const setTxt = (id, t) => {
    const el = document.getElementById(id);
    if (el) el.textContent = t;
  };

  setVal('vecWidthMMInput', vec2dState.widthMM);
  setVal('vecHeightMMInput', vec2dState.heightMM);
  setChk('vecLockAspectCheck', vec2dState.lockAspect);
  setVal('vecTraceResSelect', vec2dState.traceResolution);
  setVal('vecCutModeSelect', vec2dState.cutMode);
  setVal('vecBgDetectSelect', vec2dState.bgDetectMode);
  setVal('vecBgToleranceSlider', vec2dState.bgTolerance);
  setTxt('vecBgToleranceLabel', vec2dState.bgTolerance);
  setVal('vecCutOffsetInput', vec2dState.cutOffsetMM);
  setChk('vecCutHolesCheck', vec2dState.cutInternalHoles);
  setChk('vecKeyholeCheck', vec2dState.keyholeEnabled);
  setVal('vecKeyholeDiamInput', vec2dState.keyholeDiameterMM);
  setVal('vecKeyholePosSelect', vec2dState.keyholePos);

  setChk('vecFrameEnabledCheck', vec2dState.frameEnabled);
  setVal('vecFrameShapeSelect', vec2dState.frameShape);
  setVal('vecFrameLaserModeSelect', vec2dState.frameLaserMode);
  setVal('vecFrameStyleSelect', vec2dState.frameStyle);
  setVal('vecFrameThicknessInput', vec2dState.frameThicknessMM);
  setVal('vecFrameMarginInput', vec2dState.frameMarginMM);
  setVal('vecFrameRadiusInput', vec2dState.frameCornerRadiusMM);

  setVal('vecEngraveDetectModeSelect', vec2dState.engraveDetectMode);
  setVal('vecEngraveStyleSelect', vec2dState.engraveStyle);
  setVal('vecEngraveThresholdSlider', vec2dState.engraveThreshold);
  setTxt('vecEngraveThresholdLabel', vec2dState.engraveThreshold);
  setVal('vecLocalContrastSlider', vec2dState.localContrastSens);
  setTxt('vecLocalContrastLabel', vec2dState.localContrastSens + '%');
  setVal('vecStrokeBoostSlider', vec2dState.strokeBoostPx);
  setTxt('vecStrokeBoostLabel', (vec2dState.strokeBoostPx >= 0 ? '+' : '') + Number(vec2dState.strokeBoostPx).toFixed(2) + ' px');
  setChk('vecInvertEngraveCheck', vec2dState.invertEngrave);
  setChk('vecDetectEdgesCheck', vec2dState.detectFineEdges);
  setVal('vecEdgeSensSlider', vec2dState.edgeSensitivity);
  setTxt('vecEdgeSensLabel', vec2dState.edgeSensitivity + '%');
  setVal('vecHatchSpacingInput', vec2dState.hatchSpacingMM);
  setChk('vecHatchCrossCheck', vec2dState.hatchCross);

  setVal('vecSmoothSlider', vec2dState.smoothIterations);
  setTxt('vecSmoothLabel', vec2dState.smoothIterations);
  setVal('vecMinSpeckleInput', vec2dState.minSpeckleMM2);
  setVal('vecReliefLayersInput', vec2dState.reliefLayersCount);

  const hatchBox = document.getElementById('vecHatchOptionsBox');
  if (hatchBox) hatchBox.classList.toggle('hidden', vec2dState.engraveStyle !== 'vector_hatch');

  const keyholeBox = document.getElementById('vecKeyholeOptionsBox');
  if (keyholeBox) keyholeBox.classList.toggle('hidden', !vec2dState.keyholeEnabled);

  const frameBox = document.getElementById('vecFrameOptionsBox');
  if (frameBox) frameBox.classList.toggle('hidden', !vec2dState.frameEnabled);

  const localContrastRow = document.getElementById('vecLocalContrastRow');
  if (localContrastRow) {
    localContrastRow.classList.toggle('opacity-40', vec2dState.engraveDetectMode === 'global_threshold');
  }

  ['combined', 'cut_only', 'engrave_only', 'original'].forEach((m) => {
    const btn = document.getElementById('vecPreviewBtn_' + m);
    if (!btn) return;
    if (vec2dState.previewMode === m) {
      btn.className = 'px-2.5 py-1 rounded-lg bg-sky-500/25 border border-sky-500 text-sky-300 text-[11px] font-bold transition';
    } else {
      btn.className = 'px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] font-medium transition';
    }
  });
}

function onVectorizerDimChange(axis, val) {
  const num = Math.max(5, Math.min(3000, parseFloat(val) || 100));
  const lockEl = document.getElementById('vecLockAspectCheck');
  vec2dState.lockAspect = lockEl ? lockEl.checked : true;

  if (axis === 'w') {
    vec2dState.widthMM = num;
    if (vec2dState.lockAspect) {
      vec2dState.heightMM = Number((num / Math.max(0.05, vec2dState.aspectRatio)).toFixed(1));
    }
  } else {
    vec2dState.heightMM = num;
    if (vec2dState.lockAspect) {
      vec2dState.widthMM = Number((num * Math.max(0.05, vec2dState.aspectRatio)).toFixed(1));
    }
  }
  syncVectorizerModalUI();
  runImageVectorization();
}

function onVectorizerParamsChange() {
  const getVal = (id, def) => {
    const el = document.getElementById(id);
    return el ? el.value : def;
  };
  const getChk = (id, def) => {
    const el = document.getElementById(id);
    return el ? el.checked : def;
  };

  vec2dState.traceResolution = parseInt(getVal('vecTraceResSelect', vec2dState.traceResolution), 10) || 420;
  vec2dState.cutMode = getVal('vecCutModeSelect', vec2dState.cutMode);
  vec2dState.bgDetectMode = getVal('vecBgDetectSelect', vec2dState.bgDetectMode);
  vec2dState.bgTolerance = parseInt(getVal('vecBgToleranceSlider', vec2dState.bgTolerance), 10) || 38;
  vec2dState.cutOffsetMM = parseFloat(getVal('vecCutOffsetInput', vec2dState.cutOffsetMM)) || 0;
  vec2dState.cutInternalHoles = getChk('vecCutHolesCheck', vec2dState.cutInternalHoles);
  vec2dState.keyholeEnabled = getChk('vecKeyholeCheck', vec2dState.keyholeEnabled);
  vec2dState.keyholeDiameterMM = Math.max(1.5, parseFloat(getVal('vecKeyholeDiamInput', vec2dState.keyholeDiameterMM)) || 4.5);
  vec2dState.keyholePos = getVal('vecKeyholePosSelect', vec2dState.keyholePos);

  vec2dState.frameEnabled = getChk('vecFrameEnabledCheck', vec2dState.frameEnabled);
  vec2dState.frameShape = getVal('vecFrameShapeSelect', vec2dState.frameShape);
  vec2dState.frameLaserMode = getVal('vecFrameLaserModeSelect', vec2dState.frameLaserMode);
  vec2dState.frameStyle = getVal('vecFrameStyleSelect', vec2dState.frameStyle);
  vec2dState.frameThicknessMM = Math.max(0.5, Math.min(45, parseFloat(getVal('vecFrameThicknessInput', vec2dState.frameThicknessMM)) || 3.5));
  const rawMargin = parseFloat(getVal('vecFrameMarginInput', vec2dState.frameMarginMM));
  vec2dState.frameMarginMM = Number.isFinite(rawMargin) ? Math.max(-25, Math.min(60, rawMargin)) : 2.5;
  const rawRad = parseFloat(getVal('vecFrameRadiusInput', vec2dState.frameCornerRadiusMM));
  vec2dState.frameCornerRadiusMM = Number.isFinite(rawRad) ? Math.max(0, Math.min(90, rawRad)) : 8.0;

  vec2dState.engraveDetectMode = getVal('vecEngraveDetectModeSelect', vec2dState.engraveDetectMode);
  vec2dState.engraveStyle = getVal('vecEngraveStyleSelect', vec2dState.engraveStyle);
  vec2dState.engraveThreshold = parseInt(getVal('vecEngraveThresholdSlider', vec2dState.engraveThreshold), 10) || 148;
  vec2dState.localContrastSens = parseInt(getVal('vecLocalContrastSlider', vec2dState.localContrastSens), 10) || 68;
  vec2dState.strokeBoostPx = parseFloat(getVal('vecStrokeBoostSlider', vec2dState.strokeBoostPx)) || 0;
  vec2dState.invertEngrave = getChk('vecInvertEngraveCheck', vec2dState.invertEngrave);
  vec2dState.detectFineEdges = getChk('vecDetectEdgesCheck', vec2dState.detectFineEdges);
  vec2dState.edgeSensitivity = parseInt(getVal('vecEdgeSensSlider', vec2dState.edgeSensitivity), 10) || 58;
  vec2dState.hatchSpacingMM = Math.max(0.25, parseFloat(getVal('vecHatchSpacingInput', vec2dState.hatchSpacingMM)) || 0.8);
  vec2dState.hatchCross = getChk('vecHatchCrossCheck', vec2dState.hatchCross);

  vec2dState.smoothIterations = parseInt(getVal('vecSmoothSlider', vec2dState.smoothIterations), 10) || 0;
  vec2dState.minSpeckleMM2 = Math.max(0.02, parseFloat(getVal('vecMinSpeckleInput', vec2dState.minSpeckleMM2)) || 0.12);
  vec2dState.reliefLayersCount = Math.max(2, Math.min(10, parseInt(getVal('vecReliefLayersInput', vec2dState.reliefLayersCount), 10) || 4));

  syncVectorizerModalUI();
  runImageVectorization();
}

function setVectorizerPreviewMode(mode) {
  vec2dState.previewMode = mode;
  syncVectorizerModalUI();
  renderImageVectorizerPreview();
}

// ============================================================================
// FUNCIONES INTERACTIVAS DEL EDITOR DE VECTORIZADOS (SELECCIÓN, NODOS, BORRADOR, DIBUJO Y TEXTO)
// ============================================================================
function cloneLoopsArrayDeep(arr) {
  if (!arr) return [];
  return arr.map((l) => ({
    points: (l.points || []).map((p) => ({ x: Number(p.x), y: Number(p.y) })),
    areaMM2: l.areaMM2,
    signedArea: l.signedArea,
    isHole: Boolean(l.isHole),
    isFrame: Boolean(l.isFrame),
    isKeyhole: Boolean(l.isKeyhole)
  }));
}

function captureVectorizerResultSnapshot() {
  const res = vec2dState.result;
  return {
    outerCutLoops: cloneLoopsArrayDeep(res.outerCutLoops),
    holeCutLoops: cloneLoopsArrayDeep(res.holeCutLoops),
    engraveLoops: cloneLoopsArrayDeep(res.engraveLoops),
    frameEngraveLoops: cloneLoopsArrayDeep(res.frameEngraveLoops),
    fineEdgeLoops: cloneLoopsArrayDeep(res.fineEdgeLoops)
  };
}

function restoreVectorizerResultSnapshot(snap) {
  if (!snap) return;
  const res = vec2dState.result;
  res.outerCutLoops = cloneLoopsArrayDeep(snap.outerCutLoops);
  res.holeCutLoops = cloneLoopsArrayDeep(snap.holeCutLoops);
  res.engraveLoops = cloneLoopsArrayDeep(snap.engraveLoops);
  res.frameEngraveLoops = cloneLoopsArrayDeep(snap.frameEngraveLoops);
  res.fineEdgeLoops = cloneLoopsArrayDeep(snap.fineEdgeLoops);
  vecEditorState.selectedLayer = null;
  vecEditorState.selectedIndex = -1;
  vecEditorState.selectedNodeIndex = -1;
  recomputeVectorizerEditorDerivedStats();
}

function pushVectorizerEditorUndoSnapshot() {
  vecEditorState.undoStack.push(captureVectorizerResultSnapshot());
  if (vecEditorState.undoStack.length > 35) {
    vecEditorState.undoStack.shift();
  }
  vecEditorState.redoStack = [];
  syncVectorizerEditorToolbarUI();
}

function vectorizerEditorUndo() {
  if (vecEditorState.undoStack.length === 0) return;
  vecEditorState.redoStack.push(captureVectorizerResultSnapshot());
  const prev = vecEditorState.undoStack.pop();
  restoreVectorizerResultSnapshot(prev);
  syncVectorizerEditorToolbarUI();
}

function vectorizerEditorRedo() {
  if (vecEditorState.redoStack.length === 0) return;
  vecEditorState.undoStack.push(captureVectorizerResultSnapshot());
  const next = vecEditorState.redoStack.pop();
  restoreVectorizerResultSnapshot(next);
  syncVectorizerEditorToolbarUI();
}

function recomputeVectorizerEditorDerivedStats() {
  const res = vec2dState.result;
  const updateLoopArea = (l, forceHoleState) => {
    if (!l || !l.points || l.points.length < 3) return;
    const sa = computePolygonSignedArea2D(l.points);
    l.signedArea = sa;
    l.areaMM2 = Math.abs(sa);
    if (typeof forceHoleState === 'boolean') {
      l.isHole = forceHoleState;
    }
  };

  (res.outerCutLoops || []).forEach((l) => updateLoopArea(l, false));
  (res.holeCutLoops || []).forEach((l) => updateLoopArea(l, true));
  (res.engraveLoops || []).forEach((l) => updateLoopArea(l));
  (res.frameEngraveLoops || []).forEach((l) => updateLoopArea(l));
  (res.fineEdgeLoops || []).forEach((l) => updateLoopArea(l, false));

  let maxHalfW = Math.max(5, vec2dState.widthMM) * 0.5;
  let maxHalfH = Math.max(5, vec2dState.heightMM) * 0.5;
  const expandFrom = (arr) => {
    (arr || []).forEach((l) => {
      (l.points || []).forEach((p) => {
        if (Math.abs(p.x) > maxHalfW) maxHalfW = Math.abs(p.x);
        if (Math.abs(p.y) > maxHalfH) maxHalfH = Math.abs(p.y);
      });
    });
  };
  expandFrom(res.outerCutLoops);
  expandFrom(res.frameEngraveLoops);
  expandFrom(res.engraveLoops);
  res.totalWidthMM = maxHalfW * 2;
  res.totalHeightMM = maxHalfH * 2;

  if (vec2dState.engraveStyle === 'vector_hatch') {
    let hatch = [];
    if (res.engraveLoops.length > 0) {
      hatch = generateHatchPolylinesForLoops(res.engraveLoops, res.totalWidthMM, res.totalHeightMM, vec2dState.hatchSpacingMM, vec2dState.hatchCross);
    }
    if (res.frameEngraveLoops && res.frameEngraveLoops.length > 0) {
      hatch = hatch.concat(generateHatchPolylinesForLoops(res.frameEngraveLoops, res.totalWidthMM, res.totalHeightMM, vec2dState.hatchSpacingMM, vec2dState.hatchCross));
    }
    res.hatchPolylines = hatch;
  }

  let totalNodes = 0;
  (res.outerCutLoops || []).forEach((l) => { totalNodes += l.points.length; });
  (res.holeCutLoops || []).forEach((l) => { totalNodes += l.points.length; });
  (res.engraveLoops || []).forEach((l) => { totalNodes += l.points.length; });
  (res.frameEngraveLoops || []).forEach((l) => { totalNodes += l.points.length; });
  (res.fineEdgeLoops || []).forEach((l) => { totalNodes += l.points.length; });

  res.stats = {
    cutOuterCount: (res.outerCutLoops || []).length,
    cutHoleCount: (res.holeCutLoops || []).length,
    engraveIslandCount: (res.engraveLoops || []).length + (res.frameEngraveLoops || []).length,
    fineEdgeCount: (res.fineEdgeLoops || []).length,
    hatchLinesCount: (res.hatchPolylines || []).length,
    totalNodes
  };

  renderImageVectorizerPreview();
  updateVectorizerStatsUI();
}

function getSelectedVectorizerContourObj() {
  const layer = vecEditorState.selectedLayer;
  const idx = vecEditorState.selectedIndex;
  if (!layer || idx < 0) return null;
  const arr = vec2dState.result[layer];
  if (!arr || idx >= arr.length) return null;
  return arr[idx];
}

function pointToSegmentDistMM(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 1e-8) {
    t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  }
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return {
    dist: Math.hypot(px - projX, py - projY),
    projX,
    projY,
    t
  };
}

function getEditableLayerKeysForCurrentView() {
  const showCut = vec2dState.previewMode === 'combined' || vec2dState.previewMode === 'cut_only';
  const showEngrave = vec2dState.previewMode === 'combined' || vec2dState.previewMode === 'engrave_only';
  const keys = [];
  if (showEngrave) {
    if (vec2dState.detectFineEdges) keys.push('fineEdgeLoops');
    keys.push('engraveLoops');
    keys.push('frameEngraveLoops');
  }
  if (showCut) {
    keys.push('holeCutLoops');
    keys.push('outerCutLoops');
  }
  return keys;
}

function findVectorizerContourAtMM(mmX, mmY, tolMM) {
  const res = vec2dState.result;
  const keys = getEditableLayerKeysForCurrentView();

  // 1. Priorizar impacto cercano a cualquier borde/segmento
  let bestHit = null;
  let bestEdgeDist = tolMM;

  keys.forEach((layerKey) => {
    const arr = res[layerKey] || [];
    for (let i = 0; i < arr.length; i++) {
      const pts = arr[i].points;
      if (!pts || pts.length < 2) continue;
      for (let j = 0, n = pts.length; j < n; j++) {
        const a = pts[j];
        const b = pts[(j + 1) % n];
        const dObj = pointToSegmentDistMM(mmX, mmY, a.x, a.y, b.x, b.y);
        if (dObj.dist < bestEdgeDist) {
          bestEdgeDist = dObj.dist;
          bestHit = { layer: layerKey, index: i, edgeIndex: j, projX: dObj.projX, projY: dObj.projY };
        }
      }
    }
  });
  if (bestHit) return bestHit;

  // 2. Si no tocó directamente un segmento, elegir el contorno de menor área que contenga el punto
  let smallestArea = Infinity;
  let insideHit = null;
  keys.forEach((layerKey) => {
    const arr = res[layerKey] || [];
    for (let i = 0; i < arr.length; i++) {
      const l = arr[i];
      if (!l.points || l.points.length < 3) continue;
      if (isPointInPolygon({ x: mmX, y: mmY }, l.points)) {
        const area = l.areaMM2 || Math.abs(computePolygonSignedArea2D(l.points));
        if (area < smallestArea) {
          smallestArea = area;
          insideHit = { layer: layerKey, index: i, edgeIndex: -1 };
        }
      }
    }
  });
  return insideHit;
}

function eraseVectorizerContoursAtMM(mmX, mmY, radiusMM) {
  const res = vec2dState.result;
  const r = Math.max(0.2, Number(radiusMM) || 3.5);
  const filter = vecEditorState.eraserFilter || 'all';
  let keys = [];
  if (filter === 'engrave_only') {
    keys = ['engraveLoops', 'fineEdgeLoops', 'frameEngraveLoops'];
  } else if (filter === 'cut_only') {
    keys = ['holeCutLoops', 'outerCutLoops'];
  } else {
    keys = ['engraveLoops', 'fineEdgeLoops', 'frameEngraveLoops', 'holeCutLoops', 'outerCutLoops'];
  }

  let removedCount = 0;
  keys.forEach((layerKey) => {
    const arr = res[layerKey];
    if (!arr || arr.length === 0) return;
    res[layerKey] = arr.filter((l) => {
      const pts = l.points;
      if (!pts || pts.length === 0) return false;
      for (let j = 0, n = pts.length; j < n; j++) {
        const a = pts[j];
        const b = pts[(j + 1) % n];
        if (pointToSegmentDistMM(mmX, mmY, a.x, a.y, b.x, b.y).dist <= r) {
          removedCount++;
          return false;
        }
      }
      return true;
    });
  });

  if (removedCount > 0) {
    vecEditorState.selectedLayer = null;
    vecEditorState.selectedIndex = -1;
    recomputeVectorizerEditorDerivedStats();
  }
  return removedCount;
}

function renderVectorizerEditorOverlay(ctx, tf) {
  const { scale, toX, toY } = tf;
  const selLoop = getSelectedVectorizerContourObj();

  // 1. Resaltar contorno seleccionado y sus nodos/caja delimitadora
  if (selLoop && selLoop.points && selLoop.points.length >= 2) {
    const pts = selLoop.points;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    ctx.save();
    // Caja delimitadora punteada
    const bx = toX(minX);
    const by = toY(maxY);
    const bw = Math.max(2, (maxX - minX) * scale);
    const bh = Math.max(2, (maxY - minY) * scale);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
    ctx.lineWidth = 1.1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(bx - 3, by - 3, bw + 6, bh + 6);
    ctx.setLineDash([]);

    // Contorno resaltado en amarillo/cian brillante
    ctx.beginPath();
    pts.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(toX(p.x), toY(p.y));
      else ctx.lineTo(toX(p.x), toY(p.y));
    });
    ctx.closePath();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Etiqueta de dimensiones del contorno seleccionado
    const dimLabel = (maxX - minX).toFixed(1) + '×' + (maxY - minY).toFixed(1) + ' mm (' + pts.length + ' nodos)';
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#facc15';
    ctx.textAlign = 'left';
    ctx.fillText(dimLabel, bx, Math.max(12, by - 6));

    // Nodos interactivos (grandes en modo 'nodes', sutiles en modo 'select')
    const isNodeMode = vecEditorState.tool === 'nodes';
    const nodeRad = isNodeMode ? 4.3 : 2.3;
    for (let i = 0; i < pts.length; i++) {
      const sx = toX(pts[i].x);
      const sy = toY(pts[i].y);
      ctx.beginPath();
      ctx.arc(sx, sy, nodeRad, 0, Math.PI * 2);
      if (isNodeMode && i === vecEditorState.selectedNodeIndex) {
        ctx.fillStyle = '#f43f5e';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
      } else if (isNodeMode && i === vecEditorState.hoveredNodeIndex) {
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
      } else {
        ctx.fillStyle = isNodeMode ? '#facc15' : 'rgba(250, 204, 21, 0.75)';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.0;
      }
      ctx.fill();
      if (isNodeMode) ctx.stroke();
    }
    ctx.restore();
  }

  // 2. Círculo del borrador interactivo cuando la herramienta 'eraser' está activa
  if (vecEditorState.tool === 'eraser' && vecEditorState.cursorMM) {
    const rPx = Math.max(4, (Number(vecEditorState.eraserRadiusMM) || 3.5) * scale);
    const cx = toX(vecEditorState.cursorMM.x);
    const cy = toY(vecEditorState.cursorMM.y);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.22)';
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 3. Vista previa en vivo al dibujar nuevas formas vectoriales (trazo libre, rectángulo, círculo)
  if (vecEditorState.isDragging && vecEditorState.dragMode === 'draw_shape') {
    ctx.save();
    const colorMap = {
      engraveLoops: '#10b981',
      fineEdgeLoops: '#f59e0b',
      holeCutLoops: '#38bdf8',
      outerCutLoops: '#f43f5e'
    };
    const strokeCol = colorMap[vecEditorState.drawTargetLayer] || '#10b981';
    ctx.strokeStyle = strokeCol;
    ctx.fillStyle = strokeCol + '33';
    ctx.lineWidth = 2.0;
    ctx.setLineDash([4, 3]);

    if (vecEditorState.tool === 'draw_freehand' && vecEditorState.freehandPtsMM.length >= 2) {
      ctx.beginPath();
      vecEditorState.freehandPtsMM.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(toX(p.x), toY(p.y));
        else ctx.lineTo(toX(p.x), toY(p.y));
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (vecEditorState.tool === 'draw_rect') {
      const x0 = toX(vecEditorState.dragStartMM.x);
      const y0 = toY(vecEditorState.dragStartMM.y);
      const x1 = toX(vecEditorState.dragCurrMM.x);
      const y1 = toY(vecEditorState.dragCurrMM.y);
      ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    } else if (vecEditorState.tool === 'draw_circle') {
      const cx = toX((vecEditorState.dragStartMM.x + vecEditorState.dragCurrMM.x) * 0.5);
      const cy = toY((vecEditorState.dragStartMM.y + vecEditorState.dragCurrMM.y) * 0.5);
      const rx = Math.max(2, Math.abs(vecEditorState.dragCurrMM.x - vecEditorState.dragStartMM.x) * 0.5 * scale);
      const ry = Math.max(2, Math.abs(vecEditorState.dragCurrMM.y - vecEditorState.dragStartMM.y) * 0.5 * scale);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // 4. Fantasma de posición cuando está activa la herramienta de estampar Texto Vectorial
  if (vecEditorState.tool === 'add_text' && vecEditorState.cursorMM) {
    const txt = (vecEditorState.textValue || 'TEXTO').trim();
    if (txt.length > 0) {
      const hPx = Math.max(10, (Number(vecEditorState.textHeightMM) || 10) * scale);
      ctx.save();
      ctx.font = '900 ' + hPx.toFixed(1) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(16, 185, 129, 0.38)';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.2;
      const sx = toX(vecEditorState.cursorMM.x);
      const sy = toY(vecEditorState.cursorMM.y);
      ctx.fillText(txt, sx, sy);
      ctx.strokeText(txt, sx, sy);
      ctx.restore();
    }
  }
}

function setVectorizerEditorTool(toolName) {
  vecEditorState.tool = toolName || 'select';
  vecEditorState.selectedNodeIndex = -1;
  vecEditorState.hoveredNodeIndex = -1;
  syncVectorizerEditorToolbarUI();
  renderImageVectorizerPreview();
}

function resetVectorizerEditorViewport() {
  vecEditorState.zoom = 1.0;
  vecEditorState.panX = 0.0;
  vecEditorState.panY = 0.0;
  syncVectorizerEditorToolbarUI();
  renderImageVectorizerPreview();
}

function vectorizerEditorZoomStep(factor) {
  vecEditorState.zoom = Math.max(0.4, Math.min(14.0, (vecEditorState.zoom || 1.0) * (Number(factor) || 1.2)));
  syncVectorizerEditorToolbarUI();
  renderImageVectorizerPreview();
}

function onVectorizerSelectedLayerChange(targetLayerKey) {
  const sel = getSelectedVectorizerContourObj();
  if (!sel || !targetLayerKey || targetLayerKey === vecEditorState.selectedLayer) return;
  const res = vec2dState.result;
  if (!res[targetLayerKey]) return;

  pushVectorizerEditorUndoSnapshot();
  const srcArr = res[vecEditorState.selectedLayer];
  const [moved] = srcArr.splice(vecEditorState.selectedIndex, 1);
  moved.isFrame = false;
  moved.isHole = targetLayerKey === 'holeCutLoops';
  res[targetLayerKey].push(moved);

  vecEditorState.selectedLayer = targetLayerKey;
  vecEditorState.selectedIndex = res[targetLayerKey].length - 1;
  vecEditorState.selectedNodeIndex = -1;
  recomputeVectorizerEditorDerivedStats();
  syncVectorizerEditorToolbarUI();
}

function vectorizerEditorActionOnSelected(action) {
  const sel = getSelectedVectorizerContourObj();
  if (!sel || !sel.points || sel.points.length < 3) return;

  pushVectorizerEditorUndoSnapshot();
  const res = vec2dState.result;
  const arr = res[vecEditorState.selectedLayer];

  if (action === 'delete') {
    if (vecEditorState.tool === 'nodes' && vecEditorState.selectedNodeIndex >= 0 && sel.points.length > 3) {
      sel.points.splice(vecEditorState.selectedNodeIndex, 1);
      vecEditorState.selectedNodeIndex = -1;
    } else {
      arr.splice(vecEditorState.selectedIndex, 1);
      vecEditorState.selectedLayer = null;
      vecEditorState.selectedIndex = -1;
      vecEditorState.selectedNodeIndex = -1;
    }
  } else if (action === 'smooth') {
    sel.points = smoothClosedPolygonChaikin(sel.points, 1);
  } else if (action === 'simplify') {
    sel.points = simplifyClosedPolygonRDP(sel.points, 0.22);
  } else if (action === 'scale_up' || action === 'scale_down') {
    const f = action === 'scale_up' ? 1.08 : 0.92;
    let cx = 0, cy = 0;
    sel.points.forEach((p) => { cx += p.x; cy += p.y; });
    cx /= sel.points.length;
    cy /= sel.points.length;
    sel.points.forEach((p) => {
      p.x = cx + (p.x - cx) * f;
      p.y = cy + (p.y - cy) * f;
    });
  } else if (action === 'duplicate') {
    const copy = {
      points: sel.points.map((p) => ({ x: p.x + 3.0, y: p.y - 3.0 })),
      areaMM2: sel.areaMM2,
      signedArea: sel.signedArea,
      isHole: sel.isHole,
      isFrame: false
    };
    arr.push(copy);
    vecEditorState.selectedIndex = arr.length - 1;
  }

  recomputeVectorizerEditorDerivedStats();
  syncVectorizerEditorToolbarUI();
}

function onVectorizerEditorSettingChange() {
  const getVal = (id, def) => {
    const el = document.getElementById(id);
    return el ? el.value : def;
  };
  vecEditorState.drawTargetLayer = getVal('vecDrawTargetLayerSelect', vecEditorState.drawTargetLayer);
  vecEditorState.eraserRadiusMM = Math.max(0.5, Math.min(30, parseFloat(getVal('vecEraserRadiusInput', vecEditorState.eraserRadiusMM)) || 3.5));
  vecEditorState.eraserFilter = getVal('vecEraserFilterSelect', vecEditorState.eraserFilter);
  vecEditorState.textValue = getVal('vecEditorTextInput', vecEditorState.textValue);
  vecEditorState.textHeightMM = Math.max(2.5, Math.min(120, parseFloat(getVal('vecEditorTextSizeInput', vecEditorState.textHeightMM)) || 10.0));
  vecEditorState.textLayer = getVal('vecEditorTextLayerSelect', vecEditorState.textLayer);
  syncVectorizerEditorToolbarUI();
  renderImageVectorizerPreview();
}

// Convierte un texto en contornos vectoriales cerrados (incluyendo huecos internos de letras como O, A, B, P, R)
function insertVectorizerEditorTextAt(centerXMM = 0, centerYMM = 0) {
  onVectorizerEditorSettingChange();
  const txt = (vecEditorState.textValue || 'TEXTO').trim();
  if (!txt) return;

  const targetH = Math.max(2.5, Math.min(120, Number(vecEditorState.textHeightMM) || 10.0));
  const targetLayer = vecEditorState.textLayer || 'engraveLoops';
  const res = vec2dState.result;
  if (!res[targetLayer]) return;

  const fontPx = 96;
  const padPx = 24;
  const tmpCanvas = document.createElement('canvas');
  const tmpCtx = tmpCanvas.getContext('2d');
  tmpCtx.font = '900 ' + fontPx + 'px sans-serif';
  const estW = Math.max(120, Math.ceil(fontPx * txt.length * 0.78) + padPx * 2);
  const estH = fontPx + padPx * 2;
  tmpCanvas.width = estW + 2;
  tmpCanvas.height = estH + 2;

  const ctx = tmpCanvas.getContext('2d');
  ctx.clearRect(0, 0, tmpCanvas.width, tmpCanvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 ' + fontPx + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(txt, tmpCanvas.width * 0.5, tmpCanvas.height * 0.5);

  const imgData = ctx.getImageData(0, 0, tmpCanvas.width, tmpCanvas.height).data;
  const gW = tmpCanvas.width;
  const gH = tmpCanvas.height;
  const field = new Float32Array(gW * gH);
  field.fill(-50);

  let minPxX = gW, maxPxX = 0, minPxY = gH, maxPxY = 0;
  for (let y = 1; y < gH - 1; y++) {
    for (let x = 1; x < gW - 1; x++) {
      const a = imgData[(y * gW + x) * 4 + 3];
      field[y * gW + x] = a - 120;
      if (a >= 120) {
        if (x < minPxX) minPxX = x;
        if (x > maxPxX) maxPxX = x;
        if (y < minPxY) minPxY = y;
        if (y > maxPxY) maxPxY = y;
      }
    }
  }
  if (maxPxY <= minPxY || maxPxX <= minPxX) return;

  const smoothField = smoothScalarField3x3(field, gW, gH);
  const rawPxLoops = traceIsoContoursMarchingSquares(smoothField, gW, gH, 0.0, true);
  if (rawPxLoops.length === 0) return;

  const pxSpanH = Math.max(8, maxPxY - minPxY);
  const mmPerPx = targetH / pxSpanH;
  const cxPx = 0.5 * (minPxX + maxPxX);
  const cyPx = 0.5 * (minPxY + maxPxY);

  pushVectorizerEditorUndoSnapshot();

  const newLoops = [];
  rawPxLoops.forEach((rawPts) => {
    const mmPts = rawPts.map((p) => ({
      x: centerXMM + (p.x - cxPx) * mmPerPx,
      y: centerYMM + (cyPx - p.y) * mmPerPx
    }));
    const clean = simplifyClosedPolygonRDP(mmPts, 0.05);
    const sa = computePolygonSignedArea2D(clean);
    if (Math.abs(sa) < 0.06 || clean.length < 3) return;
    newLoops.push({
      points: clean,
      areaMM2: Math.abs(sa),
      signedArea: sa,
      isHole: targetLayer === 'holeCutLoops' ? true : (sa < 0),
      isFrame: false
    });
  });

  if (newLoops.length > 0) {
    res[targetLayer].push(...newLoops);
    vecEditorState.selectedLayer = targetLayer;
    vecEditorState.selectedIndex = res[targetLayer].length - 1;
    recomputeVectorizerEditorDerivedStats();
    syncVectorizerEditorToolbarUI();
  }
}

function syncVectorizerEditorToolbarUI() {
  const tools = ['select', 'nodes', 'eraser', 'draw_freehand', 'draw_rect', 'draw_circle', 'add_text', 'pan'];
  tools.forEach((t) => {
    const btn = document.getElementById('vecToolBtn_' + t);
    if (!btn) return;
    if (vecEditorState.tool === t) {
      btn.className = 'px-2 py-1 rounded-lg bg-amber-500/25 border border-amber-400 text-amber-200 text-[11px] font-bold transition';
    } else {
      btn.className = 'px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] font-medium transition';
    }
  });

  const undoBtn = document.getElementById('vecUndoBtn');
  if (undoBtn) undoBtn.disabled = vecEditorState.undoStack.length === 0;
  const redoBtn = document.getElementById('vecRedoBtn');
  if (redoBtn) redoBtn.disabled = vecEditorState.redoStack.length === 0;

  const zoomBtn = document.getElementById('vecZoomResetBtn');
  if (zoomBtn) zoomBtn.textContent = '🔍 ' + Math.round((vecEditorState.zoom || 1) * 100) + '%';

  const selBox = document.getElementById('vecEditorSelectionBox');
  const drawBox = document.getElementById('vecEditorDrawBox');
  const eraserBox = document.getElementById('vecEditorEraserBox');
  const textBox = document.getElementById('vecEditorTextBox');
  const hintBox = document.getElementById('vecEditorHintBox');

  const selObj = getSelectedVectorizerContourObj();
  const isSelectOrNodes = vecEditorState.tool === 'select' || vecEditorState.tool === 'nodes';
  const isDrawShape = vecEditorState.tool === 'draw_freehand' || vecEditorState.tool === 'draw_rect' || vecEditorState.tool === 'draw_circle';
  const isEraser = vecEditorState.tool === 'eraser';
  const isText = vecEditorState.tool === 'add_text';

  if (selBox) selBox.classList.toggle('hidden', !(isSelectOrNodes && selObj));
  if (drawBox) drawBox.classList.toggle('hidden', !isDrawShape);
  if (eraserBox) eraserBox.classList.toggle('hidden', !isEraser);
  if (textBox) textBox.classList.toggle('hidden', !isText);
  if (hintBox) hintBox.classList.toggle('hidden', (isSelectOrNodes && Boolean(selObj)) || isDrawShape || isEraser || isText);

  if (selObj) {
    const selLayerEl = document.getElementById('vecSelectedLayerSelect');
    if (selLayerEl) selLayerEl.value = vecEditorState.selectedLayer;
    const selInfoEl = document.getElementById('vecSelectedInfoBadge');
    if (selInfoEl) {
      selInfoEl.textContent = selObj.points.length + ' nodos · ' + (selObj.areaMM2 || 0).toFixed(1) + ' mm²';
    }
  }
}

function bindVectorizerEditorCanvasEvents() {
  if (vecEditorState.eventsBound) return;
  const canvas = document.getElementById('vectorizerPreviewCanvas');
  if (!canvas || typeof canvas.addEventListener !== 'function') return;
  vecEditorState.eventsBound = true;

  const getEventCoords = (e) => {
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: canvas.width, height: canvas.height };
    const sx = (e.clientX - rect.left) * (canvas.width / Math.max(1, rect.width));
    const sy = (e.clientY - rect.top) * (canvas.height / Math.max(1, rect.height));
    const tf = getVectorizerCanvasTransform(canvas);
    return {
      sx,
      sy,
      mmX: tf.toMMX(sx),
      mmY: tf.toMMY(sy),
      tf
    };
  };

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  canvas.addEventListener('mousedown', (e) => {
    if (vec2dState.previewMode === 'original') return;
    const { sx, sy, mmX, mmY, tf } = getEventCoords(e);
    vecEditorState.cursorMM = { x: mmX, y: mmY };

    // Botón derecho en modo Nodos: eliminar el nodo bajo el cursor
    if (e.button === 2 && vecEditorState.tool === 'nodes') {
      const sel = getSelectedVectorizerContourObj();
      if (sel && sel.points && sel.points.length > 3) {
        const nodeTolMM = 8.0 / Math.max(0.5, tf.scale);
        let bestIdx = -1;
        let bestDist = nodeTolMM;
        sel.points.forEach((p, idx) => {
          const d = Math.hypot(p.x - mmX, p.y - mmY);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = idx;
          }
        });
        if (bestIdx >= 0) {
          pushVectorizerEditorUndoSnapshot();
          sel.points.splice(bestIdx, 1);
          vecEditorState.selectedNodeIndex = -1;
          recomputeVectorizerEditorDerivedStats();
          syncVectorizerEditorToolbarUI();
        }
      }
      return;
    }

    // Paneo con clic central, Alt+Clic o herramienta 'pan'
    if (e.button === 1 || e.altKey || vecEditorState.tool === 'pan') {
      vecEditorState.isDragging = true;
      vecEditorState.dragMode = 'pan';
      vecEditorState.dragStartScreen = { x: sx - (vecEditorState.panX || 0), y: sy - (vecEditorState.panY || 0) };
      return;
    }

    if (e.button !== 0) return;

    if (vecEditorState.tool === 'add_text') {
      insertVectorizerEditorTextAt(mmX, mmY);
      return;
    }

    if (vecEditorState.tool === 'eraser') {
      pushVectorizerEditorUndoSnapshot();
      vecEditorState.isDragging = true;
      vecEditorState.dragMode = 'erase';
      eraseVectorizerContoursAtMM(mmX, mmY, vecEditorState.eraserRadiusMM);
      return;
    }

    if (vecEditorState.tool === 'draw_freehand' || vecEditorState.tool === 'draw_rect' || vecEditorState.tool === 'draw_circle') {
      vecEditorState.isDragging = true;
      vecEditorState.dragMode = 'draw_shape';
      vecEditorState.dragStartMM = { x: mmX, y: mmY };
      vecEditorState.dragCurrMM = { x: mmX, y: mmY };
      vecEditorState.freehandPtsMM = [{ x: mmX, y: mmY }];
      renderImageVectorizerPreview();
      return;
    }

    const tolMM = 7.5 / Math.max(0.5, tf.scale);

    if (vecEditorState.tool === 'nodes') {
      const sel = getSelectedVectorizerContourObj();
      if (sel && sel.points) {
        let bestIdx = -1;
        let bestDist = tolMM * 1.15;
        sel.points.forEach((p, idx) => {
          const d = Math.hypot(p.x - mmX, p.y - mmY);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = idx;
          }
        });
        if (bestIdx >= 0) {
          vecEditorState.selectedNodeIndex = bestIdx;
          vecEditorState.isDragging = true;
          vecEditorState.dragMode = 'move_node';
          vecEditorState.dragUndoPushed = false;
          renderImageVectorizerPreview();
          return;
        }
      }
    }

    const hit = findVectorizerContourAtMM(mmX, mmY, tolMM);
    if (hit) {
      vecEditorState.selectedLayer = hit.layer;
      vecEditorState.selectedIndex = hit.index;
      vecEditorState.selectedNodeIndex = -1;
      if (vecEditorState.tool === 'select') {
        vecEditorState.isDragging = true;
        vecEditorState.dragMode = 'move_loop';
        vecEditorState.dragUndoPushed = false;
        vecEditorState.dragStartMM = { x: mmX, y: mmY };
      }
    } else {
      vecEditorState.selectedLayer = null;
      vecEditorState.selectedIndex = -1;
      vecEditorState.selectedNodeIndex = -1;
    }
    syncVectorizerEditorToolbarUI();
    renderImageVectorizerPreview();
  });

  canvas.addEventListener('mousemove', (e) => {
    if (vec2dState.previewMode === 'original') return;
    const { sx, sy, mmX, mmY, tf } = getEventCoords(e);
    vecEditorState.cursorMM = { x: mmX, y: mmY };

    if (!vecEditorState.isDragging) {
      if (vecEditorState.tool === 'nodes') {
        const sel = getSelectedVectorizerContourObj();
        let hov = -1;
        if (sel && sel.points) {
          const tolMM = 7.5 / Math.max(0.5, tf.scale);
          sel.points.forEach((p, idx) => {
            if (Math.hypot(p.x - mmX, p.y - mmY) < tolMM) hov = idx;
          });
        }
        if (hov !== vecEditorState.hoveredNodeIndex) {
          vecEditorState.hoveredNodeIndex = hov;
          renderImageVectorizerPreview();
        }
      } else if (vecEditorState.tool === 'eraser' || vecEditorState.tool === 'add_text') {
        renderImageVectorizerPreview();
      }
      return;
    }

    if (vecEditorState.dragMode === 'pan') {
      vecEditorState.panX = sx - vecEditorState.dragStartScreen.x;
      vecEditorState.panY = sy - vecEditorState.dragStartScreen.y;
      renderImageVectorizerPreview();
      return;
    }

    if (vecEditorState.dragMode === 'erase') {
      eraseVectorizerContoursAtMM(mmX, mmY, vecEditorState.eraserRadiusMM);
      renderImageVectorizerPreview();
      return;
    }

    if (vecEditorState.dragMode === 'move_node') {
      const sel = getSelectedVectorizerContourObj();
      if (sel && sel.points && vecEditorState.selectedNodeIndex >= 0) {
        if (!vecEditorState.dragUndoPushed) {
          pushVectorizerEditorUndoSnapshot();
          vecEditorState.dragUndoPushed = true;
        }
        sel.points[vecEditorState.selectedNodeIndex] = { x: mmX, y: mmY };
        renderImageVectorizerPreview();
      }
      return;
    }

    if (vecEditorState.dragMode === 'move_loop') {
      const sel = getSelectedVectorizerContourObj();
      const dx = mmX - vecEditorState.dragStartMM.x;
      const dy = mmY - vecEditorState.dragStartMM.y;
      if (sel && sel.points && (Math.abs(dx) > 0.02 || Math.abs(dy) > 0.02)) {
        if (!vecEditorState.dragUndoPushed) {
          pushVectorizerEditorUndoSnapshot();
          vecEditorState.dragUndoPushed = true;
        }
        sel.points.forEach((p) => {
          p.x += dx;
          p.y += dy;
        });
        vecEditorState.dragStartMM = { x: mmX, y: mmY };
        renderImageVectorizerPreview();
      }
      return;
    }

    if (vecEditorState.dragMode === 'draw_shape') {
      vecEditorState.dragCurrMM = { x: mmX, y: mmY };
      if (vecEditorState.tool === 'draw_freehand') {
        const last = vecEditorState.freehandPtsMM[vecEditorState.freehandPtsMM.length - 1];
        if (!last || Math.hypot(mmX - last.x, mmY - last.y) > 0.45) {
          vecEditorState.freehandPtsMM.push({ x: mmX, y: mmY });
        }
      }
      renderImageVectorizerPreview();
    }
  });

  const finishDrag = () => {
    if (!vecEditorState.isDragging) return;
    const mode = vecEditorState.dragMode;
    vecEditorState.isDragging = false;
    vecEditorState.dragMode = null;

    if (mode === 'move_loop' || mode === 'move_node') {
      recomputeVectorizerEditorDerivedStats();
      syncVectorizerEditorToolbarUI();
    } else if (mode === 'draw_shape') {
      const targetLayer = vecEditorState.drawTargetLayer || 'engraveLoops';
      const res = vec2dState.result;
      let newPts = [];

      if (vecEditorState.tool === 'draw_freehand' && vecEditorState.freehandPtsMM.length >= 3) {
        newPts = simplifyClosedPolygonRDP(vecEditorState.freehandPtsMM, 0.08);
      } else if (vecEditorState.tool === 'draw_rect') {
        const x0 = Math.min(vecEditorState.dragStartMM.x, vecEditorState.dragCurrMM.x);
        const x1 = Math.max(vecEditorState.dragStartMM.x, vecEditorState.dragCurrMM.x);
        const y0 = Math.min(vecEditorState.dragStartMM.y, vecEditorState.dragCurrMM.y);
        const y1 = Math.max(vecEditorState.dragStartMM.y, vecEditorState.dragCurrMM.y);
        if (x1 - x0 > 0.6 && y1 - y0 > 0.6) {
          newPts = [
            { x: x1, y: y1 },
            { x: x0, y: y1 },
            { x: x0, y: y0 },
            { x: x1, y: y0 }
          ];
        }
      } else if (vecEditorState.tool === 'draw_circle') {
        const cx = (vecEditorState.dragStartMM.x + vecEditorState.dragCurrMM.x) * 0.5;
        const cy = (vecEditorState.dragStartMM.y + vecEditorState.dragCurrMM.y) * 0.5;
        const rx = Math.abs(vecEditorState.dragCurrMM.x - vecEditorState.dragStartMM.x) * 0.5;
        const ry = Math.abs(vecEditorState.dragCurrMM.y - vecEditorState.dragStartMM.y) * 0.5;
        if (rx > 0.4 && ry > 0.4) {
          for (let i = 0; i < 40; i++) {
            const ang = (i * Math.PI * 2) / 40;
            newPts.push({ x: cx + Math.cos(ang) * rx, y: cy + Math.sin(ang) * ry });
          }
        }
      }

      if (newPts.length >= 3 && res[targetLayer]) {
        const sa = computePolygonSignedArea2D(newPts);
        if (Math.abs(sa) > 0.15) {
          pushVectorizerEditorUndoSnapshot();
          if (sa < 0) newPts.reverse();
          res[targetLayer].push({
            points: newPts,
            areaMM2: Math.abs(sa),
            signedArea: Math.abs(sa),
            isHole: targetLayer === 'holeCutLoops',
            isFrame: false
          });
          vecEditorState.selectedLayer = targetLayer;
          vecEditorState.selectedIndex = res[targetLayer].length - 1;
          recomputeVectorizerEditorDerivedStats();
          syncVectorizerEditorToolbarUI();
        }
      }
      vecEditorState.freehandPtsMM = [];
      renderImageVectorizerPreview();
    }
  };

  canvas.addEventListener('mouseup', finishDrag);
  canvas.addEventListener('mouseleave', () => {
    vecEditorState.cursorMM = null;
    if (vecEditorState.isDragging) finishDrag();
    else renderImageVectorizerPreview();
  });

  // Doble clic sobre una arista del contorno seleccionado para insertar un nuevo nodo en ese punto
  canvas.addEventListener('dblclick', (e) => {
    if (vec2dState.previewMode === 'original') return;
    const { mmX, mmY, tf } = getEventCoords(e);
    const sel = getSelectedVectorizerContourObj();
    if (!sel || !sel.points || sel.points.length < 3) return;

    const tolMM = 8.5 / Math.max(0.5, tf.scale);
    let bestEdge = -1;
    let bestDist = tolMM;
    let insertPt = null;

    for (let i = 0, n = sel.points.length; i < n; i++) {
      const a = sel.points[i];
      const b = sel.points[(i + 1) % n];
      const dObj = pointToSegmentDistMM(mmX, mmY, a.x, a.y, b.x, b.y);
      if (dObj.dist < bestDist) {
        bestDist = dObj.dist;
        bestEdge = i;
        insertPt = { x: dObj.projX, y: dObj.projY };
      }
    }

    if (bestEdge >= 0 && insertPt) {
      pushVectorizerEditorUndoSnapshot();
      sel.points.splice(bestEdge + 1, 0, insertPt);
      vecEditorState.tool = 'nodes';
      vecEditorState.selectedNodeIndex = bestEdge + 1;
      recomputeVectorizerEditorDerivedStats();
      syncVectorizerEditorToolbarUI();
    }
  });

  // Zoom con la rueda del ratón centrado en el cursor
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const { sx, sy } = getEventCoords(e);
    const oldZoom = vecEditorState.zoom || 1.0;
    const factor = e.deltaY < 0 ? 1.16 : 0.86;
    const newZoom = Math.max(0.4, Math.min(14.0, oldZoom * factor));
    const ratio = newZoom / oldZoom;

    const cx = canvas.width * 0.5 + (vecEditorState.panX || 0);
    const cy = canvas.height * 0.5 + (vecEditorState.panY || 0);
    vecEditorState.panX = (vecEditorState.panX || 0) - (sx - cx) * (ratio - 1);
    vecEditorState.panY = (vecEditorState.panY || 0) - (sy - cy) * (ratio - 1);
    vecEditorState.zoom = newZoom;

    syncVectorizerEditorToolbarUI();
    renderImageVectorizerPreview();
  }, { passive: false });

  // Atajos de teclado (Supr/Backspace para eliminar, Ctrl+Z / Ctrl+Y para Deshacer/Rehacer)
  window.addEventListener('keydown', (e) => {
    const modal = document.getElementById('imageVectorizerModal');
    if (!modal || modal.classList.contains('hidden')) return;
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      vectorizerEditorUndo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault();
      vectorizerEditorRedo();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (getSelectedVectorizerContourObj()) {
        e.preventDefault();
        vectorizerEditorActionOnSelected('delete');
      }
    }
  });
}

// ============================================================================
// MOTOR DE GRABADO DE IMAGEN EN LA LÁMINA / COSTILLA SELECCIONADA
// ============================================================================

// Rellena un búfer RGBA con un patrón sintético si el contexto 2D es un mock sin rasterizador (p. ej. en pruebas headless)
function populateProceduralDemoRgbaIfBlank(rgba, w, h, hintName) {
  if (!rgba || rgba.length < w * h * 4) return;
  let hasAlpha = false;
  for (let i = 3; i < rgba.length; i += 16) {
    if (rgba[i] > 10) {
      hasAlpha = true;
      break;
    }
  }
  if (hasAlpha) return;

  const isCrest = String(hintName || '').toLowerCase().includes('escudo') || String(hintName || '').toLowerCase().includes('crest');
  const isMandala = String(hintName || '').toLowerCase().includes('mandala') || String(hintName || '').toLowerCase().includes('medallion');

  for (let y = 0; y < h; y++) {
    const ny = (y / Math.max(1, h - 1)) * 2 - 1;
    for (let x = 0; x < w; x++) {
      const nx = (x / Math.max(1, w - 1)) * 2 - 1;
      const r = Math.hypot(nx, ny);
      const idx = (y * w + x) * 4;
      if (r > 0.82) {
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 0;
        continue;
      }
      let isDark = false;
      if (isMandala) {
        const ang = Math.atan2(ny, nx);
        const petals = Math.cos(ang * 6) * 0.18 + 0.45;
        isDark = (Math.abs(r - 0.68) < 0.06) || (Math.abs(r - petals) < 0.07) || (r < 0.16 && r > 0.06);
      } else if (isCrest) {
        isDark = (Math.abs(Math.abs(nx) - 0.55) < 0.06 && Math.abs(ny) < 0.55) ||
          (Math.abs(Math.abs(ny) - 0.55) < 0.06 && Math.abs(nx) < 0.55) ||
          (Math.hypot(nx, ny) < 0.26 && Math.hypot(nx, ny) > 0.10);
      } else {
        // Búho / Dibujo: anillo exterior + dos ojos + pico central
        const dEyeL = Math.hypot(nx + 0.26, ny + 0.18);
        const dEyeR = Math.hypot(nx - 0.26, ny + 0.18);
        const inRing = Math.abs(r - 0.70) < 0.055;
        const inEyes = (dEyeL < 0.20 && dEyeL > 0.11) || dEyeL < 0.06 || (dEyeR < 0.20 && dEyeR > 0.11) || dEyeR < 0.06;
        const inBeak = Math.abs(nx) < 0.09 && ny > -0.05 && ny < 0.22 && (Math.abs(nx) + (ny - 0.08) * 0.5 < 0.14);
        const inFeathers = ny > 0.26 && ny < 0.56 && Math.abs(nx) < 0.42 && Math.sin(nx * 18) > 0.35 && Math.sin(ny * 18) > 0.2;
        isDark = inRing || inEyes || inBeak || inFeathers;
      }
      const val = isDark ? 18 : 248;
      rgba[idx] = val;
      rgba[idx + 1] = val;
      rgba[idx + 2] = val;
      rgba[idx + 3] = 255;
    }
  }
}

function getSliceEngravingKey(slice) {
  if (!slice) return null;
  if (state.constructionMode === 'puzzle3d' && slice.puzzleCode) {
    return 'puzzle_' + slice.puzzleCode;
  }
  return 'stacked_' + (typeof slice.index === 'number' ? slice.index : 0);
}

function getSliceImageEngravingConfig(slice) {
  const key = getSliceEngravingKey(slice);
  if (!key || !state.sliceImageEngravings) return null;
  return state.sliceImageEngravings[key] || null;
}

function ensureSliceImageEngravingConfig(slice) {
  const key = getSliceEngravingKey(slice);
  if (!key) return null;
  if (!state.sliceImageEngravings) state.sliceImageEngravings = {};
  if (!state.sliceImageEngravings[key]) {
    state.sliceImageEngravings[key] = {
      enabled: false,
      imageName: 'Ilustracion_Buho',
      presetName: 'drawing',
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
    };
  }
  return state.sliceImageEngravings[key];
}

// Comprueba si un punto 2D está dentro del material sólido de una lámina (regla par-impar sobre slice.loops)
function isPointInsideSliceSolid2D(pt, sliceLoops) {
  if (!sliceLoops || sliceLoops.length === 0) return false;
  let insideCount = 0;
  for (let i = 0; i < sliceLoops.length; i++) {
    const poly = sliceLoops[i].points;
    if (poly && poly.length >= 3 && isPointInPolygon(pt, poly)) {
      insideCount++;
    }
  }
  return (insideCount % 2) === 1;
}

// Calcula y aplica los vectores de grabado de imagen (slice.engraveLoops) sobre una lámina concreta
function recomputeSliceImageEngraving(slice) {
  if (!slice) return;
  const cfg = getSliceImageEngravingConfig(slice);
  if (!cfg || !cfg.enabled) {
    if (slice.hasCustomImageEngraving) {
      slice.engraveLoops = (slice.baseEngraveLoops || []).slice();
      slice.fineEdgeLoops = [];
      slice.hatchPolylines = [];
      slice.hasCustomImageEngraving = false;
    }
    return;
  }

  const sliceLoops = slice.loops || [];
  if (sliceLoops.length === 0) {
    slice.engraveLoops = [];
    slice.fineEdgeLoops = [];
    slice.hatchPolylines = [];
    slice.hasCustomImageEngraving = false;
    return;
  }

  const cutBounds = typeof getSliceBounds2D === 'function'
    ? getSliceBounds2D(slice)
    : { minX: -40, maxX: 40, minY: -40, maxY: 40, width: 80, height: 80, cx: 0, cy: 0 };

  const targetCX = cutBounds.cx + (Number(cfg.offsetXMM) || 0);
  const targetCY = cutBounds.cy + (Number(cfg.offsetYMM) || 0);
  const aspect = Math.max(0.1, Number(cfg.aspectRatio) || 1.0);
  const fitW = Math.min(cutBounds.width, cutBounds.height * aspect);
  const fitH = fitW / aspect;
  const scaleFactor = Math.max(0.05, Math.min(3.0, (Number(cfg.scalePct) || 75) / 100));
  const targetW = Math.max(2.0, fitW * scaleFactor);
  const targetH = Math.max(2.0, fitH * scaleFactor);

  const rotRad = ((Number(cfg.rotationDeg) || 0) * Math.PI) / 180;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);
  const flipSignX = cfg.flipX ? -1 : 1;
  const flipSignY = cfg.flipY ? -1 : 1;

  const normToSliceMM = (nx, ny) => {
    const lx = nx * targetW * flipSignX;
    const ly = ny * targetH * flipSignY;
    return {
      x: targetCX + (lx * cosR - ly * sinR),
      y: targetCY + (lx * sinR + ly * cosR)
    };
  };

  const sliceMMToNorm = (mmX, mmY) => {
    const dx = mmX - targetCX;
    const dy = mmY - targetCY;
    const lx = dx * cosR + dy * sinR;
    const ly = -dx * sinR + dy * cosR;
    return {
      nx: (lx * flipSignX) / targetW,
      ny: (ly * flipSignY) / targetH
    };
  };

  // Caso 1: Lazos vectoriales personalizados enviados desde el Editor Vectorial completo (#imageVectorizerModal)
  if (Array.isArray(cfg.customNormalizedLoops) && cfg.customNormalizedLoops.length > 0) {
    const outLoops = [];
    cfg.customNormalizedLoops.forEach((nl) => {
      if (!nl.points || nl.points.length < 3) return;
      const mappedPts = nl.points.map((p) => normToSliceMM(p.nx, p.ny));
      if (cfg.clipToSlice) {
        const insidePts = mappedPts.filter((pt) => isPointInsideSliceSolid2D(pt, sliceLoops));
        if (insidePts.length < 3) return;
        const usePts = insidePts.length === mappedPts.length ? mappedPts : insidePts;
        const sa = computePolygonSignedArea2D(usePts);
        if (Math.abs(sa) < 0.04) return;
        outLoops.push({
          points: usePts,
          areaMM2: Math.abs(sa),
          signedArea: sa,
          isHole: Boolean(nl.isHole)
        });
      } else {
        const sa = computePolygonSignedArea2D(mappedPts);
        if (Math.abs(sa) < 0.04) return;
        outLoops.push({
          points: mappedPts,
          areaMM2: Math.abs(sa),
          signedArea: sa,
          isHole: Boolean(nl.isHole)
        });
      }
    });

    slice.engraveLoops = outLoops;
    slice.engraveStyle = cfg.engraveStyle || 'vector_fill';
    slice.fineEdgeLoops = [];
    slice.hatchPolylines = slice.engraveStyle === 'vector_hatch'
      ? generateHatchPolylinesForLoops(outLoops, cutBounds.width, cutBounds.height, 0.8, false)
      : [];
    slice.hasCustomImageEngraving = true;
    return;
  }

  // Caso 2: Trazado vectorial directo sobre la imagen (sourceCanvas o preset integrado) con recorte exacto al interior de la lámina
  if (!cfg.sourceCanvas) {
    cfg.sourceCanvas = createDemoBitmapCanvas(cfg.presetName || 'drawing');
  }
  const srcW = cfg.sourceCanvas.width || 240;
  const srcH = cfg.sourceCanvas.height || 240;
  const maxRes = 240;
  const sc = maxRes / Math.max(srcW, srcH);
  const innerW = Math.max(32, Math.round(srcW * sc));
  const innerH = Math.max(32, Math.round(srcH * sc));
  const gridW = innerW + 2;
  const gridH = innerH + 2;
  const nGrid = gridW * gridH;

  const workCanvas = document.createElement('canvas');
  workCanvas.width = innerW;
  workCanvas.height = innerH;
  const wCtx = workCanvas.getContext('2d');
  wCtx.clearRect(0, 0, innerW, innerH);
  wCtx.drawImage(cfg.sourceCanvas, 0, 0, innerW, innerH);
  const rgba = wCtx.getImageData(0, 0, innerW, innerH).data;
  populateProceduralDemoRgbaIfBlank(rgba, innerW, innerH, cfg.presetName || cfg.imageName);

  // Construir máscara del interior sólido de la lámina (slice.loops) en el espacio de celdas (gridW x gridH)
  let sliceMask = null;
  let sdfSlice = null;
  const mmPerPx = Math.max(targetW / innerW, targetH / innerH);
  const minSliceSdfPx = cfg.clipToSlice
    ? (Math.max(0, Number(cfg.marginMM) ?? 0.5) / Math.max(0.01, mmPerPx))
    : -999;

  if (cfg.clipToSlice) {
    sliceMask = new Uint8Array(nGrid);
    const gridLoops = sliceLoops.map((l) =>
      (l.points || []).map((pt) => {
        const { nx, ny } = sliceMMToNorm(pt.x, pt.y);
        return {
          gx: 1 + (nx + 0.5) * Math.max(1, innerW - 1),
          gy: 1 + (0.5 - ny) * Math.max(1, innerH - 1)
        };
      })
    );

    for (let gy = 1; gy <= innerH; gy++) {
      const yScan = gy + 0.00013;
      const crossings = [];
      for (let li = 0; li < gridLoops.length; li++) {
        const pts = gridLoops[li];
        const m = pts.length;
        if (m < 3) continue;
        for (let i = 0; i < m; i++) {
          const p1 = pts[i];
          const p2 = pts[(i + 1) % m];
          if ((p1.gy <= yScan && p2.gy > yScan) || (p2.gy <= yScan && p1.gy > yScan)) {
            const t = (yScan - p1.gy) / (p2.gy - p1.gy);
            crossings.push(p1.gx + t * (p2.gx - p1.gx));
          }
        }
      }
      if (crossings.length < 2) continue;
      crossings.sort((a, b) => a - b);
      const rowOffset = gy * gridW;
      for (let k = 0; k + 1 < crossings.length; k += 2) {
        const x0 = Math.max(1, Math.ceil(crossings[k]));
        const x1 = Math.min(innerW, Math.floor(crossings[k + 1]));
        for (let gx = x0; gx <= x1; gx++) {
          sliceMask[rowOffset + gx] = 1;
        }
      }
    }
    sdfSlice = computeSignedDistanceField2D(sliceMask, gridW, gridH);
  }

  let transparentPixels = 0;
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] < 128) transparentPixels++;
  }
  const hasTransparency = transparentPixels > (innerW * innerH * 0.012);

  const sampleCorner = (cx, cy) => {
    const idx = (cy * innerW + cx) * 4;
    return [rgba[idx], rgba[idx + 1], rgba[idx + 2], rgba[idx + 3]];
  };
  const c0 = sampleCorner(0, 0);
  const c1 = sampleCorner(innerW - 1, 0);
  const c2 = sampleCorner(0, innerH - 1);
  const c3 = sampleCorner(innerW - 1, innerH - 1);
  const bgR = (c0[0] + c1[0] + c2[0] + c3[0]) * 0.25;
  const bgG = (c0[1] + c1[1] + c2[1] + c3[1]) * 0.25;
  const bgB = (c0[2] + c1[2] + c2[2] + c3[2]) * 0.25;

  const solidMask = new Uint8Array(nGrid);
  const lumaGrid = new Float32Array(nGrid);
  lumaGrid.fill(255);

  for (let y = 0; y < innerH; y++) {
    for (let x = 0; x < innerW; x++) {
      const sIdx = (y * innerW + x) * 4;
      const r = rgba[sIdx];
      const g = rgba[sIdx + 1];
      const b = rgba[sIdx + 2];
      const a = rgba[sIdx + 3];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const gIdx = (y + 1) * gridW + (x + 1);
      if (a >= 35) {
        lumaGrid[gIdx] = luma;
      }
      let isFg = false;
      if (hasTransparency) {
        isFg = a >= 85;
      } else {
        const distBg = Math.hypot(r - bgR, g - bgG, b - bgB);
        isFg = a >= 60 && (distBg > 42 || luma < 220);
      }
      if (isFg) solidMask[gIdx] = 1;
    }
  }

  let fgCount = 0;
  for (let i = 0; i < nGrid; i++) fgCount += solidMask[i];
  if (fgCount < 16) {
    for (let y = 1; y <= innerH; y++) {
      for (let x = 1; x <= innerW; x++) {
        solidMask[y * gridW + x] = 1;
      }
    }
  }

  const sdfImgSolid = computeSignedDistanceField2D(solidMask, gridW, gridH);
  const thr = Math.max(10, Math.min(245, Number(cfg.threshold) || 145));
  const inv = Boolean(cfg.invert);
  const detectMode = cfg.detectMode || 'smart_drawing';

  const radFine = Math.max(3, Math.round(Math.min(gridW, gridH) * 0.018));
  const radMed = Math.max(6, Math.round(Math.min(gridW, gridH) * 0.045));
  const localMeanFine = computeLocalMeanFieldIntegral(lumaGrid, gridW, gridH, radFine);
  const localMeanMed = computeLocalMeanFieldIntegral(lumaGrid, gridW, gridH, radMed);

  const rawEngraveField = new Float32Array(nGrid);
  rawEngraveField.fill(-80);

  for (let i = 0; i < nGrid; i++) {
    if (!solidMask[i] || sdfImgSolid[i] < 0.4) {
      rawEngraveField[i] = -60;
      continue;
    }
    if (cfg.clipToSlice && (!sliceMask[i] || sdfSlice[i] < minSliceSdfPx)) {
      rawEngraveField[i] = -60;
      continue;
    }

    const luma = lumaGrid[i];
    const mFine = localMeanFine[i];
    const mMed = localMeanMed[i];
    const localDiffFine = inv ? (luma - mFine) : (mFine - luma);
    const localDiffMed = inv ? (luma - mMed) : (mMed - luma);
    const localStrokeScore = Math.max(localDiffFine * 1.35, localDiffMed) - 12.5;
    const globalScore = inv ? (luma - thr) : (thr - luma);

    if (detectMode === 'line_art') {
      const veryDarkInk = inv ? (luma - Math.max(210, thr + 45)) : (Math.min(58, thr * 0.42) - luma);
      rawEngraveField[i] = Math.max(localStrokeScore * 2.1, veryDarkInk);
    } else if (detectMode === 'global_threshold') {
      rawEngraveField[i] = globalScore;
    } else {
      rawEngraveField[i] = Math.max(globalScore, localStrokeScore * 2.1);
    }
  }

  const engraveField = smoothScalarField3x3(rawEngraveField, gridW, gridH);
  const rawPxLoops = traceIsoContoursMarchingSquares(engraveField, gridW, gridH, -2.0, true);

  const invInnerW = 1 / Math.max(1, innerW - 1);
  const invInnerH = 1 / Math.max(1, innerH - 1);
  const minAreaMM2 = Math.max(0.05, (targetW * targetH) * 0.00004);
  const tolMM = Math.max(0.04, Math.min(targetW, targetH) * 0.0012);

  const finalLoops = [];
  rawPxLoops.forEach((rawPts) => {
    const mmPts = rawPts.map((p) => {
      const nx = (p.x - 1) * invInnerW - 0.5;
      const ny = 0.5 - (p.y - 1) * invInnerH;
      return normToSliceMM(nx, ny);
    });
    const rawArea = Math.abs(computePolygonSignedArea2D(mmPts));
    if (rawArea < minAreaMM2) return;

    let cleanPts = simplifyClosedPolygonRDP(mmPts, tolMM);
    cleanPts = smoothClosedPolygonChaikin(cleanPts, 1);
    if (cfg.clipToSlice) {
      cleanPts = cleanPts.filter((pt) => isPointInsideSliceSolid2D(pt, sliceLoops));
    }
    if (cleanPts.length < 3) return;
    const signedA = computePolygonSignedArea2D(cleanPts);
    const finalArea = Math.abs(signedA);
    if (finalArea < minAreaMM2) return;

    finalLoops.push({
      points: cleanPts,
      areaMM2: finalArea,
      signedArea: signedA,
      isHole: signedA < 0
    });
  });

  finalLoops.sort((a, b) => b.areaMM2 - a.areaMM2);
  for (let i = 0; i < finalLoops.length; i++) {
    let depth = 0;
    const testPt = finalLoops[i].points[0];
    for (let j = 0; j < i; j++) {
      if (isPointInPolygon(testPt, finalLoops[j].points)) {
        depth++;
      }
    }
    finalLoops[i].isHole = (depth % 2) === 1;
  }

  slice.engraveLoops = finalLoops;
  slice.engraveStyle = cfg.engraveStyle || 'vector_fill';
  slice.fineEdgeLoops = [];
  slice.hatchPolylines = slice.engraveStyle === 'vector_hatch'
    ? generateHatchPolylinesForLoops(finalLoops, cutBounds.width, cutBounds.height, 0.8, false)
    : [];
  slice.hasCustomImageEngraving = true;
}

function reapplyAllSliceImageEngravings() {
  if (!state.slices || state.slices.length === 0) return;
  if (state.constructionMode === 'puzzle3d' && state.puzzleEngraveEndRibs) {
    applyEngravingToPuzzleEndRibs({
      targetAxes: state.puzzleEngraveEndRibsAxes || 'both',
      presetName: state.puzzleEngraveEndRibsPreset || 'drawing',
      scalePct: state.puzzleEngraveEndRibsScalePct || 75,
      mirrorLastRib: state.puzzleEngraveEndRibsMirrorLast !== false,
      triggerRender: false
    });
  }
  state.slices.forEach((slice) => {
    const cfg = getSliceImageEngravingConfig(slice);
    if ((cfg && cfg.enabled) || slice.hasCustomImageEngraving) {
      recomputeSliceImageEngraving(slice);
    }
  });
}

function refreshActiveSliceEngravingAndRender() {
  const slice = state.slices && state.slices[state.activeSliceIndex];
  if (slice) {
    recomputeSliceImageEngraving(slice);
  }
  if (typeof build3DSlicesMesh === 'function') build3DSlicesMesh();
  if (state.nestingEnabled && typeof recomputeBoardNesting === 'function') {
    recomputeBoardNesting();
  }
  if (typeof renderSliceStripUI === 'function') renderSliceStripUI();
  if (typeof update2DInspectorHeader === 'function') update2DInspectorHeader();
  if (typeof render2DSlice === 'function') render2DSlice();
  syncSliceImageEngraveUI();
}

function syncSliceImageEngraveUI() {
  const slice = state.slices && state.slices[state.activeSliceIndex];
  const codeLabel = slice
    ? (slice.puzzleCode ? ('Costilla ' + slice.puzzleCode) : ('Lasca #' + (slice.index + 1)))
    : 'Lámina #1';
  const shortCode = slice
    ? (slice.puzzleCode ? slice.puzzleCode : ('#' + (slice.index + 1)))
    : '#1';

  const vecBadge = document.getElementById('vecTargetSliceCodeBadge');
  if (vecBadge) vecBadge.textContent = shortCode;

  const targetBadge = document.getElementById('sliceEngraveTargetBadge');
  if (targetBadge) targetBadge.textContent = codeLabel;

  const sidebarTargetBadge = document.getElementById('sidebarSliceEngraveTargetBadge');
  if (sidebarTargetBadge) sidebarTargetBadge.textContent = shortCode;

  const cfg = slice ? getSliceImageEngravingConfig(slice) : null;
  const hasEngrave = Boolean(cfg && cfg.enabled && slice && slice.engraveLoops && slice.engraveLoops.length > 0);

  const panel = document.getElementById('sliceImageEngravePanel');
  if (panel) {
    panel.classList.toggle('hidden', !state.sliceEngravePanelOpen);
  }

  const inspBtn = document.getElementById('btnInspectorEngraveSliceImg');
  if (inspBtn) {
    if (hasEngrave) {
      inspBtn.textContent = '🖼️ Imagen Grabada (' + shortCode + ')';
      inspBtn.className = 'text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/50 font-bold transition';
    } else if (state.sliceEngravePanelOpen) {
      inspBtn.textContent = '🖼️ Grabar Imagen: ON';
      inspBtn.className = 'text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold transition';
    } else {
      inspBtn.textContent = '🖼️ Grabar Imagen';
      inspBtn.className = 'text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/35 font-semibold transition';
    }
  }

  const statusBadge = document.getElementById('sliceEngraveStatusBadge');
  if (statusBadge) {
    if (hasEngrave) {
      statusBadge.textContent = (cfg.imageName || 'Imagen') + ' · ' + slice.engraveLoops.length + ' trazos (#008800)';
      statusBadge.className = 'text-[10px] font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded';
    } else {
      statusBadge.textContent = 'Sin imagen grabada en esta lámina';
      statusBadge.className = 'text-[10px] font-mono text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded';
    }
  }

  const clearBtn = document.getElementById('btnClearSliceEngrave');
  if (clearBtn) {
    clearBtn.classList.toggle('hidden', !(cfg && cfg.enabled));
  }

  const controlsRow = document.getElementById('sliceEngraveControlsRow');
  if (controlsRow) {
    controlsRow.classList.toggle('opacity-45', !(cfg && cfg.enabled));
  }

  const effCfg = cfg || {
    scalePct: 75,
    offsetXMM: 0,
    offsetYMM: 0,
    rotationDeg: 0,
    flipX: false,
    detectMode: 'smart_drawing',
    threshold: 145,
    invert: false,
    clipToSlice: true
  };

  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v;
  };
  const setChk = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.checked = Boolean(v);
  };

  setVal('sliceEngraveScaleInput', Math.round(Number(effCfg.scalePct) || 75));
  setVal('sliceEngraveOffsetXInput', Number(effCfg.offsetXMM || 0).toFixed(1));
  setVal('sliceEngraveOffsetYInput', Number(effCfg.offsetYMM || 0).toFixed(1));
  setVal('sliceEngraveModeSelect', effCfg.detectMode || 'smart_drawing');
  setVal('sliceEngraveThresholdSlider', Math.round(Number(effCfg.threshold) || 145));
  setChk('sliceEngraveInvertCheck', effCfg.invert);
  setChk('sliceEngraveClipCheck', effCfg.clipToSlice !== false);

  const flipBtn = document.getElementById('btnSliceEngraveFlipX');
  if (flipBtn) {
    flipBtn.className = effCfg.flipX
      ? 'px-1.5 py-0.5 rounded bg-emerald-500/25 border border-emerald-500/50 text-[10px] text-emerald-300 font-bold transition'
      : 'px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-slate-300 transition';
  }
}

function toggleSliceImageEngravePanel(forceState) {
  if (typeof forceState === 'boolean') {
    state.sliceEngravePanelOpen = forceState;
  } else {
    state.sliceEngravePanelOpen = !state.sliceEngravePanelOpen;
  }
  syncSliceImageEngraveUI();
}

function applyDemoImageEngravingToSelectedSlice(presetName = 'drawing') {
  const slice = state.slices && state.slices[state.activeSliceIndex];
  if (!slice) return;
  const cfg = ensureSliceImageEngravingConfig(slice);
  if (!cfg) return;

  const demoCanvas = createDemoBitmapCanvas(presetName);
  const namesMap = {
    drawing: 'Ilustracion_Buho',
    crest: 'Escudo_Canarias',
    medallion: 'Mandala_Solar',
    badge: 'Insignia_Layer3D'
  };
  cfg.enabled = true;
  cfg.presetName = presetName;
  cfg.imageName = namesMap[presetName] || 'Ilustracion_Demo';
  cfg.sourceCanvas = demoCanvas;
  cfg.aspectRatio = (demoCanvas.width || 480) / Math.max(1, demoCanvas.height || 480);
  if (cfg.sourceCanvas) cfg.customNormalizedLoops = null;
  state.sliceEngravePanelOpen = true;

  refreshActiveSliceEngravingAndRender();
}

function handleSliceImageEngraveFile(file) {
  if (!file) return;
  const slice = state.slices && state.slices[state.activeSliceIndex];
  if (!slice) return;
  const cfg = ensureSliceImageEngravingConfig(slice);
  if (!cfg) return;

  const cleanName = (file.name || 'Imagen_Grabado').replace(/\.(png|bmp|jpg|jpeg|webp|gif)$/i, '') || 'Imagen_Grabado';
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1000;
      let w = img.naturalWidth || img.width || 256;
      let h = img.naturalHeight || img.height || 256;
      if (w > maxDim || h > maxDim) {
        const sc = maxDim / Math.max(w, h);
        w = Math.max(16, Math.round(w * sc));
        h = Math.max(16, Math.round(h * sc));
      }
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      cfg.enabled = true;
      cfg.imageName = cleanName;
      cfg.presetName = null;
      cfg.sourceCanvas = c;
      cfg.aspectRatio = w / Math.max(1, h);
      cfg.threshold = computeOtsuThresholdFromCanvas(c);
      if (cfg.sourceCanvas) cfg.customNormalizedLoops = null;
      state.sliceEngravePanelOpen = true;

      refreshActiveSliceEngravingAndRender();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function onSelectedSliceEngraveParamsChange() {
  const slice = state.slices && state.slices[state.activeSliceIndex];
  if (!slice) return;
  const cfg = ensureSliceImageEngravingConfig(slice);
  if (!cfg) return;
  if (!cfg.enabled) {
    // Si el usuario mueve un control sin haber cargado imagen aún, cargamos la ilustración por defecto
    applyDemoImageEngravingToSelectedSlice(cfg.presetName || 'drawing');
    return;
  }

  const scaleEl = document.getElementById('sliceEngraveScaleInput');
  const offXEl = document.getElementById('sliceEngraveOffsetXInput');
  const offYEl = document.getElementById('sliceEngraveOffsetYInput');
  const modeEl = document.getElementById('sliceEngraveModeSelect');
  const thrEl = document.getElementById('sliceEngraveThresholdSlider');
  const invEl = document.getElementById('sliceEngraveInvertCheck');
  const clipEl = document.getElementById('sliceEngraveClipCheck');

  if (scaleEl) cfg.scalePct = Math.max(10, Math.min(250, parseFloat(scaleEl.value) || 75));
  if (offXEl) cfg.offsetXMM = parseFloat(offXEl.value) || 0;
  if (offYEl) cfg.offsetYMM = parseFloat(offYEl.value) || 0;

  if (modeEl && modeEl.value !== cfg.detectMode) {
    cfg.detectMode = modeEl.value;
    if (cfg.sourceCanvas) cfg.customNormalizedLoops = null;
  }
  if (thrEl) {
    const newThr = Math.max(15, Math.min(245, parseInt(thrEl.value, 10) || 145));
    if (newThr !== cfg.threshold) {
      cfg.threshold = newThr;
      if (cfg.sourceCanvas) cfg.customNormalizedLoops = null;
    }
  }
  if (invEl && Boolean(invEl.checked) !== cfg.invert) {
    cfg.invert = Boolean(invEl.checked);
    if (cfg.sourceCanvas) cfg.customNormalizedLoops = null;
  }
  if (clipEl) cfg.clipToSlice = Boolean(clipEl.checked);

  refreshActiveSliceEngravingAndRender();
}

function stepSelectedSliceEngraveScale(deltaPct) {
  const slice = state.slices && state.slices[state.activeSliceIndex];
  if (!slice) return;
  const cfg = ensureSliceImageEngravingConfig(slice);
  if (!cfg) return;
  if (!cfg.enabled) {
    applyDemoImageEngravingToSelectedSlice('drawing');
  }
  cfg.scalePct = Math.max(10, Math.min(250, Math.round((Number(cfg.scalePct) || 75) + (Number(deltaPct) || 0))));
  refreshActiveSliceEngravingAndRender();
}

function rotateSelectedSliceEngraving(deltaDeg = 90) {
  const slice = state.slices && state.slices[state.activeSliceIndex];
  if (!slice) return;
  const cfg = ensureSliceImageEngravingConfig(slice);
  if (!cfg) return;
  if (!cfg.enabled) {
    applyDemoImageEngravingToSelectedSlice('drawing');
  }
  cfg.rotationDeg = ((Number(cfg.rotationDeg) || 0) + (Number(deltaDeg) || 90)) % 360;
  refreshActiveSliceEngravingAndRender();
}

function toggleSelectedSliceEngravingFlipX() {
  const slice = state.slices && state.slices[state.activeSliceIndex];
  if (!slice) return;
  const cfg = ensureSliceImageEngravingConfig(slice);
  if (!cfg) return;
  if (!cfg.enabled) {
    applyDemoImageEngravingToSelectedSlice('drawing');
  }
  cfg.flipX = !cfg.flipX;
  refreshActiveSliceEngravingAndRender();
}

function resetSelectedSliceEngraveTransform() {
  const slice = state.slices && state.slices[state.activeSliceIndex];
  if (!slice) return;
  const cfg = getSliceImageEngravingConfig(slice);
  if (!cfg) return;
  cfg.scalePct = 75;
  cfg.offsetXMM = 0;
  cfg.offsetYMM = 0;
  cfg.rotationDeg = 0;
  cfg.flipX = false;
  cfg.flipY = false;
  refreshActiveSliceEngravingAndRender();
}

function clearSelectedSliceImageEngraving() {
  const slice = state.slices && state.slices[state.activeSliceIndex];
  if (!slice) return;
  state.puzzleEngraveEndRibs = false;
  const key = getSliceEngravingKey(slice);
  if (key && state.sliceImageEngravings) {
    delete state.sliceImageEngravings[key];
  }
  slice.engraveLoops = (slice.baseEngraveLoops || []).slice();
  slice.fineEdgeLoops = [];
  slice.hatchPolylines = [];
  slice.hasCustomImageEngraving = false;

  if (typeof build3DSlicesMesh === 'function') build3DSlicesMesh();
  if (state.nestingEnabled && typeof recomputeBoardNesting === 'function') {
    recomputeBoardNesting();
  }
  if (typeof renderSliceStripUI === 'function') renderSliceStripUI();
  if (typeof update2DInspectorHeader === 'function') update2DInspectorHeader();
  if (typeof render2DSlice === 'function') render2DSlice();
  syncSliceImageEngraveUI();
}

function openVectorizerForSelectedSlice() {
  const slice = state.slices && state.slices[state.activeSliceIndex];
  const cfg = slice ? getSliceImageEngravingConfig(slice) : null;
  if (cfg && cfg.sourceCanvas) {
    vec2dState.sourceCanvas = cfg.sourceCanvas;
    vec2dState.sourceWidth = cfg.sourceCanvas.width;
    vec2dState.sourceHeight = cfg.sourceCanvas.height;
    vec2dState.aspectRatio = cfg.aspectRatio || 1.0;
    vec2dState.imageName = cfg.imageName || 'Imagen_Lamina';
    openImageVectorizerModal();
  } else {
    openImageVectorizerModal('drawing');
  }
}

// Aplica los vectores de grabado actuales del modal #imageVectorizerModal (incluyendo textos y ediciones manuales) a la lámina seleccionada
function applyVectorizedImageToSelectedSlice() {
  const slice = state.slices && state.slices[state.activeSliceIndex];
  if (!slice) return;
  if (!vec2dState.sourceCanvas) {
    loadVectorizerDemoPreset('drawing');
  }
  const res = vec2dState.result;
  const cfg = ensureSliceImageEngravingConfig(slice);
  if (!cfg) return;

  const spanW = Math.max(5, Number(res.totalWidthMM || vec2dState.widthMM) || 100);
  const spanH = Math.max(5, Number(res.totalHeightMM || vec2dState.heightMM) || 100);

  const combinedLoops = (res.engraveLoops || [])
    .concat(res.frameEngraveLoops || [])
    .concat(vec2dState.detectFineEdges ? (res.fineEdgeLoops || []) : []);

  cfg.enabled = true;
  cfg.imageName = vec2dState.imageName || 'Grabado_Vectorial';
  cfg.sourceCanvas = vec2dState.sourceCanvas;
  cfg.aspectRatio = spanW / Math.max(1, spanH);
  cfg.detectMode = vec2dState.engraveDetectMode || 'smart_drawing';
  cfg.engraveStyle = vec2dState.engraveStyle === 'hybrid_raster' ? 'vector_fill' : (vec2dState.engraveStyle || 'vector_fill');
  cfg.threshold = vec2dState.engraveThreshold || 145;
  cfg.invert = Boolean(vec2dState.invertEngrave);

  if (combinedLoops.length > 0) {
    cfg.customNormalizedLoops = combinedLoops.map((l) => ({
      points: (l.points || []).map((p) => ({
        nx: p.x / spanW,
        ny: p.y / spanH
      })),
      isHole: Boolean(l.isHole)
    }));
  } else {
    if (cfg.sourceCanvas) cfg.customNormalizedLoops = null;
  }

  state.sliceEngravePanelOpen = true;
  refreshActiveSliceEngravingAndRender();
  closeImageVectorizerModal();
}

// =========================================================================
// GRABADO AUTOMÁTICO DE LA PRIMERA Y ÚLTIMA COSTILLA DE LOS EJES EN PUZZLE 3D
// =========================================================================

// Devuelve las costillas extremas (primera y última costilla de cada eje: Serie A, Serie B y/o Serie C) en modo Puzzle 3D
function getPuzzleEndCapSlices(targetAxes = 'all') {
  if (!state.slices || state.slices.length === 0) return [];
  const normTarget = String(targetAxes || 'all').toUpperCase();
  const includeA = normTarget === 'BOTH' || normTarget === 'ALL' || normTarget === 'ABC' || normTarget === 'A';
  const includeB = normTarget === 'BOTH' || normTarget === 'ALL' || normTarget === 'ABC' || normTarget === 'B';
  const includeC = normTarget === 'ALL' || normTarget === 'ABC' || normTarget === 'C' || (normTarget === 'BOTH' && state.puzzleAxes === 'xyz');

  const slicesA = state.slices.filter((s) => s && s.puzzleSeries === 'A');
  const slicesB = state.slices.filter((s) => s && s.puzzleSeries === 'B');
  const slicesC = state.slices.filter((s) => s && s.puzzleSeries === 'C');

  const result = [];
  const pushFirstAndLast = (seriesArr) => {
    if (!seriesArr || seriesArr.length === 0) return;
    const sorted = seriesArr.slice().sort((a, b) => (a.seriesIndex ?? a.index ?? 0) - (b.seriesIndex ?? b.index ?? 0));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (first) result.push({ slice: first, isLastInSeries: false });
    if (last && last !== first) result.push({ slice: last, isLastInSeries: true });
  };

  if (slicesA.length > 0 || slicesB.length > 0 || slicesC.length > 0) {
    if (includeA) pushFirstAndLast(slicesA);
    if (includeB) pushFirstAndLast(slicesB);
    if (includeC) pushFirstAndLast(slicesC);
  } else {
    pushFirstAndLast(state.slices);
  }
  return result;
}

// Aplica la función de grabado de imagen en lasca a las costillas primera y última de los ejes del Puzzle 3D
function applyEngravingToPuzzleEndRibs(options = {}) {
  if (!state.slices || state.slices.length === 0) return [];
  const targetAxes = options.targetAxes || state.puzzleEngraveEndRibsAxes || 'both';
  const endCaps = getPuzzleEndCapSlices(targetAxes);
  if (endCaps.length === 0) return [];

  const activeSlice = state.slices[state.activeSliceIndex];
  const activeCfg = activeSlice ? getSliceImageEngravingConfig(activeSlice) : null;
  const hasActiveImg = Boolean(
    activeCfg &&
    activeCfg.enabled &&
    (activeCfg.sourceCanvas || (Array.isArray(activeCfg.customNormalizedLoops) && activeCfg.customNormalizedLoops.length > 0))
  );

  const presetName = options.presetName || (hasActiveImg ? activeCfg.presetName : (state.puzzleEngraveEndRibsPreset || 'drawing')) || 'drawing';
  const namesMap = {
    drawing: 'Ilustracion_Buho',
    crest: 'Escudo_Canarias',
    medallion: 'Mandala_Solar',
    badge: 'Insignia_Layer3D'
  };

  const baseSourceCanvas = (!options.presetName && hasActiveImg && activeCfg.sourceCanvas)
    ? activeCfg.sourceCanvas
    : createDemoBitmapCanvas(presetName);

  const baseCustomLoops = (!options.presetName && hasActiveImg && Array.isArray(activeCfg.customNormalizedLoops))
    ? activeCfg.customNormalizedLoops
    : null;

  const scalePct = typeof options.scalePct === 'number'
    ? Math.max(10, Math.min(250, options.scalePct))
    : (hasActiveImg ? (Number(activeCfg.scalePct) || 75) : (Number(state.puzzleEngraveEndRibsScalePct) || 75));
  const offsetXMM = typeof options.offsetXMM === 'number'
    ? options.offsetXMM
    : (hasActiveImg ? (Number(activeCfg.offsetXMM) || 0) : 0);
  const offsetYMM = typeof options.offsetYMM === 'number'
    ? options.offsetYMM
    : (hasActiveImg ? (Number(activeCfg.offsetYMM) || 0) : 0);
  const rotationDeg = typeof options.rotationDeg === 'number'
    ? options.rotationDeg
    : (hasActiveImg ? (Number(activeCfg.rotationDeg) || 0) : 0);
  const detectMode = options.detectMode || (hasActiveImg ? activeCfg.detectMode : 'smart_drawing') || 'smart_drawing';
  const engraveStyle = options.engraveStyle || (hasActiveImg ? activeCfg.engraveStyle : 'vector_fill') || 'vector_fill';
  const threshold = typeof options.threshold === 'number'
    ? options.threshold
    : (hasActiveImg ? (Number(activeCfg.threshold) || 145) : 145);
  const invert = typeof options.invert === 'boolean'
    ? options.invert
    : (hasActiveImg ? Boolean(activeCfg.invert) : false);
  const clipToSlice = options.clipToSlice !== undefined
    ? Boolean(options.clipToSlice)
    : true;
  const baseFlipX = typeof options.flipX === 'boolean'
    ? options.flipX
    : (hasActiveImg ? Boolean(activeCfg.flipX) : false);
  const mirrorLastRib = options.mirrorLastRib !== undefined
    ? Boolean(options.mirrorLastRib)
    : (state.puzzleEngraveEndRibsMirrorLast !== false);

  state.puzzleEngraveEndRibs = true;
  state.puzzleEngraveEndRibsAxes = targetAxes;
  state.puzzleEngraveEndRibsPreset = presetName;
  state.puzzleEngraveEndRibsScalePct = scalePct;
  state.puzzleEngraveEndRibsMirrorLast = mirrorLastRib;

  const engravedCodes = [];
  endCaps.forEach(({ slice, isLastInSeries }) => {
    const cfg = ensureSliceImageEngravingConfig(slice);
    if (!cfg) return;
    cfg.enabled = true;
    cfg.presetName = presetName;
    cfg.imageName = (!options.presetName && hasActiveImg && activeCfg.imageName)
      ? activeCfg.imageName
      : (namesMap[presetName] || 'Ilustracion_Fachada');
    cfg.sourceCanvas = baseSourceCanvas;
    cfg.aspectRatio = (baseSourceCanvas.width || 480) / Math.max(1, baseSourceCanvas.height || 480);
    cfg.customNormalizedLoops = baseCustomLoops ? JSON.parse(JSON.stringify(baseCustomLoops)) : null;
    cfg.scalePct = scalePct;
    cfg.offsetXMM = offsetXMM;
    cfg.offsetYMM = offsetYMM;
    cfg.rotationDeg = rotationDeg;
    cfg.flipX = (isLastInSeries && mirrorLastRib) ? !baseFlipX : baseFlipX;
    cfg.flipY = hasActiveImg ? Boolean(activeCfg.flipY) : false;
    cfg.detectMode = detectMode;
    cfg.engraveStyle = engraveStyle;
    cfg.threshold = threshold;
    cfg.invert = invert;
    cfg.clipToSlice = clipToSlice;

    recomputeSliceImageEngraving(slice);
    engravedCodes.push(slice.puzzleCode || ('#' + (slice.index + 1)));
  });

  state.sliceEngravePanelOpen = true;
  if (options.triggerRender !== false) {
    if (typeof build3DSlicesMesh === 'function') build3DSlicesMesh();
    if (state.nestingEnabled && typeof recomputeBoardNesting === 'function') {
      recomputeBoardNesting();
    }
    if (typeof renderSliceStripUI === 'function') renderSliceStripUI();
    if (typeof update2DInspectorHeader === 'function') update2DInspectorHeader();
    if (typeof render2DSlice === 'function') render2DSlice();
    syncSliceImageEngraveUI();
  }
  return engravedCodes;
}

function clearPuzzleEndRibsEngraving(targetAxes = 'both') {
  state.puzzleEngraveEndRibs = false;
  const endCaps = getPuzzleEndCapSlices(targetAxes);
  endCaps.forEach(({ slice }) => {
    const key = getSliceEngravingKey(slice);
    if (key && state.sliceImageEngravings) {
      delete state.sliceImageEngravings[key];
    }
    slice.engraveLoops = (slice.baseEngraveLoops || []).slice();
    slice.fineEdgeLoops = [];
    slice.hatchPolylines = [];
    slice.hasCustomImageEngraving = false;
  });
  if (typeof build3DSlicesMesh === 'function') build3DSlicesMesh();
  if (state.nestingEnabled && typeof recomputeBoardNesting === 'function') {
    recomputeBoardNesting();
  }
  if (typeof renderSliceStripUI === 'function') renderSliceStripUI();
  if (typeof update2DInspectorHeader === 'function') update2DInspectorHeader();
  if (typeof render2DSlice === 'function') render2DSlice();
  syncSliceImageEngraveUI();
}

// Alias programáticos compatibles con OKF para modificar parámetros de grabado de la lámina activa
function setSliceImageEngravingParams(key, val) {
  const slice = state.slices && state.slices[state.activeSliceIndex];
  if (!slice) return;
  const cfg = ensureSliceImageEngravingConfig(slice);
  if (!cfg) return;
  if (!cfg.enabled) {
    applyDemoImageEngravingToSelectedSlice(cfg.presetName || 'drawing');
  }
  if (key === 'scalePct') cfg.scalePct = Math.max(10, Math.min(250, Number(val) || 75));
  else if (key === 'offsetXMM') cfg.offsetXMM = Number(val) || 0;
  else if (key === 'offsetYMM') cfg.offsetYMM = Number(val) || 0;
  else if (key === 'rotationDeg') cfg.rotationDeg = Number(val) || 0;
  else if (key === 'threshold') { cfg.threshold = Math.max(15, Math.min(245, Number(val) || 145)); if (cfg.sourceCanvas) cfg.customNormalizedLoops = null; }
  else if (key === 'detectMode' || key === 'mode') { cfg.detectMode = String(val || 'smart_drawing'); if (cfg.sourceCanvas) cfg.customNormalizedLoops = null; }
  else if (key === 'engraveStyle') cfg.engraveStyle = String(val || 'vector_fill');
  else if (key === 'invert') { cfg.invert = Boolean(val); if (cfg.sourceCanvas) cfg.customNormalizedLoops = null; }
  else if (key === 'flipX') cfg.flipX = Boolean(val);
  else if (key === 'clipToSlice') cfg.clipToSlice = Boolean(val);
  refreshActiveSliceEngravingAndRender();
}

function clearSliceImageEngraving(sliceIndex) {
  if (typeof sliceIndex === 'number' && state.slices && state.slices[sliceIndex]) {
    state.activeSliceIndex = sliceIndex;
  }
  clearSelectedSliceImageEngraving();
}

if (typeof window !== 'undefined') {
  window.openImageVectorizerModal = openImageVectorizerModal;
  window.closeImageVectorizerModal = closeImageVectorizerModal;
  window.loadVectorizerDemoPreset = loadVectorizerDemoPreset;
  window.handleImageVectorizerFile = handleImageVectorizerFile;
  window.autoAdjustVectorizerThreshold = autoAdjustVectorizerThreshold;
  window.onVectorizerDimChange = onVectorizerDimChange;
  window.onVectorizerParamsChange = onVectorizerParamsChange;
  window.setVectorizerPreviewMode = setVectorizerPreviewMode;
  window.downloadVectorizedSVG = downloadVectorizedSVG;
  window.downloadVectorizedDXF = downloadVectorizedDXF;
  window.applyVectorizedImageToLayerStudio = applyVectorizedImageToLayerStudio;
  window.generateVectorizedImageSVG = generateVectorizedImageSVG;
  window.generateVectorizedImageDXF = generateVectorizedImageDXF;
  window.setVectorizerEditorTool = setVectorizerEditorTool;
  window.vectorizerEditorUndo = vectorizerEditorUndo;
  window.vectorizerEditorRedo = vectorizerEditorRedo;
  window.resetVectorizerEditorViewport = resetVectorizerEditorViewport;
  window.vectorizerEditorZoomStep = vectorizerEditorZoomStep;
  window.onVectorizerSelectedLayerChange = onVectorizerSelectedLayerChange;
  window.vectorizerEditorActionOnSelected = vectorizerEditorActionOnSelected;
  window.onVectorizerEditorSettingChange = onVectorizerEditorSettingChange;
  window.insertVectorizerEditorTextAt = insertVectorizerEditorTextAt;
  window.populateProceduralDemoRgbaIfBlank = populateProceduralDemoRgbaIfBlank;
  window.getSliceEngravingKey = getSliceEngravingKey;
  window.getSliceImageEngravingConfig = getSliceImageEngravingConfig;
  window.recomputeSliceImageEngraving = recomputeSliceImageEngraving;
  window.reapplyAllSliceImageEngravings = reapplyAllSliceImageEngravings;
  window.syncSliceImageEngraveUI = syncSliceImageEngraveUI;
  window.toggleSliceImageEngravePanel = toggleSliceImageEngravePanel;
  window.applyDemoImageEngravingToSelectedSlice = applyDemoImageEngravingToSelectedSlice;
  window.handleSliceImageEngraveFile = handleSliceImageEngraveFile;
  window.onSelectedSliceEngraveParamsChange = onSelectedSliceEngraveParamsChange;
  window.stepSelectedSliceEngraveScale = stepSelectedSliceEngraveScale;
  window.rotateSelectedSliceEngraving = rotateSelectedSliceEngraving;
  window.toggleSelectedSliceEngravingFlipX = toggleSelectedSliceEngravingFlipX;
  window.resetSelectedSliceEngraveTransform = resetSelectedSliceEngraveTransform;
  window.clearSelectedSliceImageEngraving = clearSelectedSliceImageEngraving;
  window.openVectorizerForSelectedSlice = openVectorizerForSelectedSlice;
  window.applyVectorizedImageToSelectedSlice = applyVectorizedImageToSelectedSlice;
  window.getPuzzleEndCapSlices = getPuzzleEndCapSlices;
  window.applyEngravingToPuzzleEndRibs = applyEngravingToPuzzleEndRibs;
  window.clearPuzzleEndRibsEngraving = clearPuzzleEndRibsEngraving;
  window.setSliceImageEngravingParams = setSliceImageEngravingParams;
  window.clearSliceImageEngraving = clearSliceImageEngraving;

  window.addEventListener('DOMContentLoaded', () => {
    const fileInputImg = document.getElementById('fileInputImage2D');
    if (fileInputImg) {
      fileInputImg.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (f) handleImageVectorizerFile(f);
        e.target.value = '';
      });
    }
    const fileInputSliceImg = document.getElementById('fileInputSliceEngraveImg');
    if (fileInputSliceImg) {
      fileInputSliceImg.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (f) handleSliceImageEngraveFile(f);
        e.target.value = '';
      });
    }
    bindVectorizerEditorCanvasEvents();
  });
}
