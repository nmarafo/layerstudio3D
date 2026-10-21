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
    fineEdgeLoops: [],          // [{ points: [{x,y}], isHole, areaMM2 }]
    hatchPolylines: [],         // [[{x,y}, {x,y}]]
    processedDataUrl: '',       // PNG de alto contraste para modo hybrid_raster
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

  if (vec2dState.cutMode === 'silhouette') {
    const sdfOuter = computeSignedDistanceField2D(filledOuterMask, gridW, gridH);
    const offsetPx = (Number(vec2dState.cutOffsetMM) || 0) / mmPerPx;
    const rawOuterPx = traceIsoContoursMarchingSquares(sdfOuter, gridW, gridH, -offsetPx, true);
    const convOuter = convertPixelLoopsToMM(
      rawOuterPx,
      gridW,
      gridH,
      widthMM,
      heightMM,
      Math.max(0.8, vec2dState.minSpeckleMM2 * 3),
      vec2dState.simplifyTolMM * 1.2,
      vec2dState.smoothIterations
    );
    outerCutLoops = convOuter.filter((l) => !l.isHole);

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

  // Añadir perforación circular para llavero / colgante si está activa
  if (vec2dState.keyholeEnabled && vec2dState.cutMode !== 'none') {
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
    if (!solidMask[i] || sdfSolid[i] < minInteriorDist) {
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
        if (!solidMask[idx] || sdfSolid[idx] < 1.2) continue;
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

  // Trama de barrido (Hatching vectorial) si se eligió 'vector_hatch'
  let hatchPolylines = [];
  if (vec2dState.engraveStyle === 'vector_hatch' && engraveLoops.length > 0) {
    hatchPolylines = generateHatchPolylinesForLoops(
      engraveLoops,
      widthMM,
      heightMM,
      vec2dState.hatchSpacingMM,
      vec2dState.hatchCross
    );
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
  fineEdgeLoops.forEach((l) => { totalNodes += l.points.length; });

  vec2dState.result = {
    outerCutLoops,
    holeCutLoops,
    engraveLoops,
    fineEdgeLoops,
    hatchPolylines,
    processedDataUrl,
    stats: {
      cutOuterCount: outerCutLoops.length,
      cutHoleCount: holeCutLoops.length,
      engraveIslandCount: engraveLoops.length,
      fineEdgeCount: fineEdgeLoops.length,
      hatchLinesCount: hatchPolylines.length,
      totalNodes
    }
  };

  renderImageVectorizerPreview();
  updateVectorizerStatsUI();
}

// ============================================================================
// RENDERIZADO DEL LIENZO DE PREVISUALIZACIÓN EN TIEMPO REAL
// ============================================================================
function renderImageVectorizerPreview() {
  const canvas = document.getElementById('vectorizerPreviewCanvas');
  if (!canvas) return;
  const rect = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : { width: 520, height: 420 };
  canvas.width = Math.max(320, rect.width || 520);
  canvas.height = Math.max(280, rect.height || 420);

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const wMM = Math.max(5, vec2dState.widthMM);
  const hMM = Math.max(5, vec2dState.heightMM);
  const pad = 34;
  const scale = Math.min((canvas.width - pad * 2) / wMM, (canvas.height - pad * 2) / hMM);
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.5;
  const toX = (x) => cx + x * scale;
  const toY = (y) => cy - y * scale;

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
    ctx.drawImage(vec2dState.sourceCanvas, docLeft, docTop, docW, docH);
    return;
  }

  const res = vec2dState.result;
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
    } else if (res.engraveLoops.length > 0) {
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

  // Cotas físicas en pantalla
  ctx.save();
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(wMM.toFixed(1) + ' × ' + hMM.toFixed(1) + ' mm (' + vec2dState.imageName + ')', cx, docTop - 10);
  ctx.restore();
}

function updateVectorizerStatsUI() {
  const badge = document.getElementById('vecStatsSummaryBadge');
  if (!badge) return;
  const st = vec2dState.result.stats;
  badge.innerHTML =
    '✂️ <strong>Corte Ext.:</strong> ' + st.cutOuterCount +
    ' · 🔵 <strong>Huecos:</strong> ' + st.cutHoleCount +
    ' · ⚡ <strong>Grabado:</strong> ' + st.engraveIslandCount + ' vectores' +
    (vec2dState.detectFineEdges ? (' + ' + st.fineEdgeCount + ' detalles') : '') +
    (vec2dState.engraveStyle === 'vector_hatch' ? (' (' + st.hatchLinesCount + ' líneas trama)') : '') +
    ' · 📐 ' + vec2dState.widthMM.toFixed(1) + '×' + vec2dState.heightMM.toFixed(1) + ' mm';
}

// ============================================================================
// GENERACIÓN DIRECTA DE ARCHIVO .SVG Y .DXF DE CORTE Y GRABADO (ESCALA 1:1 MM)
// ============================================================================
function generateVectorizedImageSVG() {
  const res = vec2dState.result;
  const padMM = Math.max(2, Number(vec2dState.cutOffsetMM) + 2);
  const svgW = Math.max(10, vec2dState.widthMM + padMM * 2);
  const svgH = Math.max(10, vec2dState.heightMM + padMM * 2);
  const toX = (x) => (x + svgW * 0.5).toFixed(4);
  const toY = (y) => (svgH * 0.5 - y).toFixed(4);
  const strokeMm = Math.max(0.12, Math.min(svgW, svgH) * 0.002).toFixed(4);

  const xmlHeader = '<' + '?xml version="1.0" encoding="UTF-8" standalone="no"?' + '>';
  const lines = [
    xmlHeader,
    '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="' + svgW.toFixed(3) + 'mm" height="' + svgH.toFixed(3) + 'mm" viewBox="0 0 ' + svgW.toFixed(4) + ' ' + svgH.toFixed(4) + '" style="background:#ffffff;">',
    '  <title>' + escapeXmlAttr(vec2dState.imageName + ' - Corte y Grabado Laser (LayerStudio 3D)') + '</title>',
    '  <desc>' + escapeXmlAttr('Vectorizado automatico PNG/BMP a SVG 1:1 en mm | Pieza: ' + vec2dState.widthMM.toFixed(1) + 'x' + vec2dState.heightMM.toFixed(1) + 'mm | Rojo #ff0000: Corte Exterior | Azul #0055ff: Corte Huecos | Verde #008800: Grabado Vectorial | Naranja #ff8800: Grabado Detalle Fino') + '</desc>'
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
  } else if (res.engraveLoops.length > 0) {
    let compoundEngrave = '';
    res.engraveLoops.forEach((l) => {
      if (!l.points || l.points.length < 3) return;
      let d = 'M ' + toX(l.points[0].x) + ' ' + toY(l.points[0].y);
      for (let i = 1; i < l.points.length; i++) {
        d += ' L ' + toX(l.points[i].x) + ' ' + toY(l.points[i].y);
      }
      d += ' Z ';
      compoundEngrave += d;
    });
    if (compoundEngrave.trim().length > 0) {
      const fillAttr = vec2dState.engraveStyle === 'vector_outline'
        ? 'fill="none"'
        : 'fill="#008800" fill-opacity="0.28" fill-rule="evenodd"';
      lines.push('  <g id="GRABADO_VECTORIAL" ' + fillAttr + ' stroke="#008800" stroke-width="' + strokeMm + '" stroke-linecap="round" stroke-linejoin="round">');
      lines.push('    <path id="regiones_grabado" d="' + compoundEngrave.trim() + '" vector-effect="non-scaling-stroke" />');
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
  let dxf = '0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';

  const appendClosedPoly = (pts, layer, colorCode) => {
    if (!pts || pts.length < 3) return;
    dxf += '0\nLWPOLYLINE\n8\n' + layer + '\n62\n' + colorCode + '\n90\n' + pts.length + '\n70\n1\n';
    pts.forEach((p) => {
      dxf += '10\n' + p.x.toFixed(4) + '\n20\n' + p.y.toFixed(4) + '\n';
    });
  };

  res.outerCutLoops.forEach((l) => appendClosedPoly(l.points, 'CORTE_EXTERIOR', 1));
  res.holeCutLoops.forEach((l) => appendClosedPoly(l.points, 'CORTE_INTERIOR', 5));
  res.engraveLoops.forEach((l) => appendClosedPoly(l.points, 'GRABADO_VECTORIAL', 3));
  if (vec2dState.detectFineEdges) {
    res.fineEdgeLoops.forEach((l) => appendClosedPoly(l.points, 'GRABADO_DETALLE', 30));
  }
  if (vec2dState.engraveStyle === 'vector_hatch') {
    res.hatchPolylines.forEach((seg) => {
      dxf += '0\nLINE\n8\nGRABADO_TRAMA\n62\n3\n10\n' + seg[0].x.toFixed(4) + '\n20\n' + seg[0].y.toFixed(4) + '\n11\n' + seg[1].x.toFixed(4) + '\n21\n' + seg[1].y.toFixed(4) + '\n';
    });
  }

  dxf += '0\nENDSEC\n0\nEOF\n';
  return dxf;
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
  if (!res || (res.outerCutLoops.length === 0 && res.engraveLoops.length === 0)) return;

  const wMM = Math.max(10, vec2dState.widthMM);
  const hMM = Math.max(10, vec2dState.heightMM);
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
    baseCutLoops.push({
      points: l.points.map((p) => ({ x: p.x, y: p.y })),
      absArea: l.areaMM2,
      signedArea: l.areaMM2,
      isHole: false
    });
  });
  res.holeCutLoops.forEach((l) => {
    baseCutLoops.push({
      points: l.points.map((p) => ({ x: p.x, y: p.y })),
      absArea: l.areaMM2,
      signedArea: -l.areaMM2,
      isHole: true
    });
  });

  if (!asReliefMultilayer) {
    state.dimsMM = { x: wMM, y: hMM, z: thickMM };
    state.sliceCount = 1;

    const engraveLoopsCopy = res.engraveLoops.map((l) => ({
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
      unsplitLoops: baseCutLoops,
      loops: baseCutLoops.slice(),
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
      unsplitLoops: baseCutLoops,
      loops: baseCutLoops.slice(),
      engraveLoops: res.engraveLoops.slice(),
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
      const loopsK = convertPixelLoopsToMM(rawPxK, gW, gH, wMM, hMM, Math.max(0.8, vec2dState.minSpeckleMM2 * 2), vec2dState.simplifyTolMM, vec2dState.smoothIterations)
        .map((l) => ({
          points: l.points,
          absArea: l.areaMM2,
          signedArea: l.isHole ? -l.areaMM2 : l.areaMM2,
          isHole: l.isHole
        }));

      const zCoord = -totalZ * 0.5 + (k + 0.5) * thickMM;
      state.slices.push({
        index: k,
        coord: zCoord,
        sliceAxis: 'z',
        selected: true,
        rawLoops: loopsK.length > 0 ? loopsK : baseCutLoops,
        unsplitLoops: loopsK.length > 0 ? loopsK : baseCutLoops,
        loops: loopsK.length > 0 ? loopsK.slice() : baseCutLoops.slice(),
        engraveLoops: [],
        fineEdgeLoops: [],
        hatchPolylines: [],
        filteredCount: 0
      });
    }
  }

  state.activeSliceIndex = 0;
  if (typeof syncDimensionInputsUI === 'function') syncDimensionInputsUI();
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

  window.addEventListener('DOMContentLoaded', () => {
    const fileInputImg = document.getElementById('fileInputImage2D');
    if (fileInputImg) {
      fileInputImg.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (f) handleImageVectorizerFile(f);
        e.target.value = '';
      });
    }
  });
}
