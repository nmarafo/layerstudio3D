/**
 * LayerStudio 3D (LascaStudio 3D) - 2D Interactive Canvas Inspector & Slice Strip
 * Visor 2D con zoom/pan, selección interactiva de islas, reproductor de capas y galería inferior.
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
// Controles de Zoom y Desplazamiento (Pan) en el visor 2D
function updateZoom2DBadge() {
  const badge = document.getElementById('zoom2DBadgeBtn');
  if (badge) {
    badge.textContent = Math.round(state.view2D.zoom * 100) + '%';
  }
}

function reset2DView(redraw = true) {
  state.view2D.zoom = 1;
  state.view2D.panX = 0;
  state.view2D.panY = 0;
  updateZoom2DBadge();
  if (redraw) render2DSlice();
}

function zoom2DBy(factor, pivotScreenX, pivotScreenY) {
  const canvas = document.getElementById('canvas2D');
  const oldZoom = state.view2D.zoom;
  const newZoom = Math.max(0.4, Math.min(35, oldZoom * factor));
  const ratio = newZoom / oldZoom;

  const px = typeof pivotScreenX === 'number' ? pivotScreenX : (canvas ? canvas.width / 2 : 0);
  const py = typeof pivotScreenY === 'number' ? pivotScreenY : (canvas ? canvas.height / 2 : 0);
  const cx = (canvas ? canvas.width / 2 : 0) + state.view2D.panX;
  const cy = (canvas ? canvas.height / 2 : 0) + state.view2D.panY;

  state.view2D.panX += (px - cx) * (1 - ratio);
  state.view2D.panY += (py - cy) * (1 - ratio);
  state.view2D.zoom = newZoom;

  updateZoom2DBadge();
  render2DSlice();
}

// Permite hacer zoom con la rueda, arrastrar para desplazarse por el tablero y hacer clic en una isla para seleccionarla
function setupCanvas2DInteraction() {
  const canvas = document.getElementById('canvas2D');
  if (!canvas) return;

  // Zoom con la rueda del ratón centrado en la posición del cursor
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    zoom2DBy(factor, px, py);
  }, { passive: false });

  // Doble clic para acercar al punto clicado
  canvas.addEventListener('dblclick', (e) => {
    const rect = canvas.getBoundingClientRect();
    zoom2DBy(1.6, e.clientX - rect.left, e.clientY - rect.top);
  });

  // Inicio de arrastre (Pan) o clic de selección
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    state.view2D.isDragging = true;
    state.view2D.hasMoved = false;
    state.view2D.startX = e.clientX;
    state.view2D.startY = e.clientY;
    state.view2D.startPanX = state.view2D.panX;
    state.view2D.startPanY = state.view2D.panY;
    canvas.setPointerCapture(e.pointerId);
  });

  // Movimiento de arrastre (Pan)
  canvas.addEventListener('pointermove', (e) => {
    if (!state.view2D.isDragging) return;
    const dx = e.clientX - state.view2D.startX;
    const dy = e.clientY - state.view2D.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      state.view2D.hasMoved = true;
    }
    state.view2D.panX = state.view2D.startPanX + dx;
    state.view2D.panY = state.view2D.startPanY + dy;
    render2DSlice();
  });

  // Fin de arrastre; si fue un clic limpio sin arrastrar en modo tablero, selecciona la isla clicada
  const finishPointer = (e) => {
    if (!state.view2D.isDragging) return;
    state.view2D.isDragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}

    if (!state.view2D.hasMoved && state.nestingEnabled && state.nestedBoards.length > 0) {
      const board = state.nestedBoards[state.activeBoardIndex];
      if (!board) return;

      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const pad = 36;
      const baseScale = Math.min((canvas.width - pad * 2) / board.width, (canvas.height - pad * 2) / board.height);
      const scale = baseScale * state.view2D.zoom;
      const centerX = canvas.width / 2 + state.view2D.panX;
      const centerY = canvas.height / 2 + state.view2D.panY;

      const boardX = (px - centerX) / scale + board.width / 2;
      const boardY = (centerY - py) / scale + board.height / 2;

      // Buscar la isla más pequeña que contenga el punto clicado
      let hitSliceIdx = -1;
      let minArea = Infinity;
      board.placements.forEach((pl) => {
        if (isPointInIslandMaterial({ x: boardX, y: boardY }, pl.outerPoints, pl.holes)) {
          if (pl.island.outerArea < minArea) {
            minArea = pl.island.outerArea;
            hitSliceIdx = pl.island.sliceIndex;
          }
        }
      });

      if (hitSliceIdx !== -1) {
        state.activeSliceIndex = hitSliceIdx;
        update3DSlicesTransforms();
        highlightActiveCardInStrip();
        render2DSlice();
      }
    }
  };

  canvas.addEventListener('pointerup', finishPointer);
  canvas.addEventListener('pointercancel', finishPointer);
}

function resetCamera3D() {
  const maxDim = Math.max(state.dimsMM.x, state.dimsMM.y, state.dimsMM.z, 50);
  const dist = maxDim * 1.75;
  camera.near = Math.max(0.1, maxDim * 0.002);
  camera.far = Math.max(10000, maxDim * 30);
  camera.updateProjectionMatrix();
  camera.position.set(dist, -dist * 1.15, dist * 0.85);
  controls.target.set(0, 0, 0);
  controls.update();

  if (gridHelper3D) {
    scene.remove(gridHelper3D);
    gridHelper3D = new THREE.GridHelper(maxDim * 2.5, 20, 0x1e293b, 0x0f172a);
    gridHelper3D.rotation.x = Math.PI / 2;
    gridHelper3D.position.z = -state.dimsMM.z / 2;
    scene.add(gridHelper3D);
  }
}

// =========================================================================
// INSPECTOR 2D Y GALERÍA DE LASCAS
// =========================================================================
// Devuelve los límites 2D totales de la pieza completa según el eje de corte activo
function getModelBounds2D() {
  let w = state.dimsMM.x;
  let h = state.dimsMM.y;
  if (state.axis === 'x') {
    w = state.dimsMM.y;
    h = state.dimsMM.z;
  } else if (state.axis === 'y') {
    w = state.dimsMM.x;
    h = state.dimsMM.z;
  }
  w = Math.max(1, Number(w) || 100);
  h = Math.max(1, Number(h) || 100);
  return {
    minX: -w / 2,
    minY: -h / 2,
    maxX: w / 2,
    maxY: h / 2,
    width: w,
    height: h,
    cx: 0,
    cy: 0
  };
}

function getSliceBounds2D(slice) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const expandWithLoops = (loops) => {
    (loops || []).forEach((l) => {
      (l.points || []).forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
    });
  };

  if (slice) expandWithLoops(slice.loops);

  if (!Number.isFinite(minX)) {
    return { minX: -25, minY: -25, maxX: 25, maxY: 25, width: 50, height: 50, cx: 0, cy: 0 };
  }
  return {
    minX, minY, maxX, maxY,
    width: Math.max(0.5, maxX - minX),
    height: Math.max(0.5, maxY - minY),
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2
  };
}

function getAlignmentHoles2D(slice) {
  if (!state.rodCount || state.rodCount <= 0 || !slice.loops || slice.loops.length === 0) return [];
  const b = getModelBounds2D();
  if (state.rodCount === 1) {
    return [{ x: b.cx, y: b.cy }];
  }
  const offset = b.width * 0.22;
  return [
    { x: b.cx - offset, y: b.cy },
    { x: b.cx + offset, y: b.cy }
  ];
}

function selectActiveSlice(idx) {
  if (state.slices.length === 0) return;
  state.activeSliceIndex = Math.max(0, Math.min(state.slices.length - 1, idx));
  if (!state.nestingEnabled) {
    document.getElementById('currentSliceSlider').value = state.activeSliceIndex;
  } else {
    // Si estamos en vista de tablero, saltar al tablero donde se encuentra esta lasca
    const foundBoardIdx = state.nestedBoards.findIndex((b) =>
      b.placements.some((pl) => pl.island.sliceIndex === state.activeSliceIndex)
    );
    if (foundBoardIdx !== -1) {
      state.activeBoardIndex = foundBoardIdx;
      document.getElementById('currentSliceSlider').value = state.activeBoardIndex;
    }
  }

  update2DInspectorHeader();
  update3DSlicesTransforms();
  render2DSlice();
  highlightActiveCardInStrip();
}

// Dibuja el texto de una isla en el Canvas 2D ajustando exactamente el tamaño para no exceder nunca la caja interior
function drawAdaptiveIslandTextOnCanvas(ctx, tLayout, toScreenX, toScreenY, scale) {
  if (!tLayout || !tLayout.lines || tLayout.lines.length === 0 || tLayout.fontSizeMM <= 0.04) return;

  let fontPx = tLayout.fontSizeMM * scale;
  ctx.save();
  ctx.font = 'bold ' + fontPx.toFixed(2) + 'px monospace';

  // Verificar con la métrica real de la fuente del navegador que ninguna línea supere el ancho seguro
  let maxMeasuredW = 0;
  for (let i = 0; i < tLayout.lines.length; i++) {
    const w = ctx.measureText(tLayout.lines[i]).width;
    if (w > maxMeasuredW) maxMeasuredW = w;
  }
  const allowedPxW = tLayout.maxBoxW * scale * 0.88;
  const allowedPxH = (tLayout.maxBoxH * scale * 0.88) / tLayout.lines.length;

  if (maxMeasuredW > allowedPxW && maxMeasuredW > 0) {
    fontPx *= (allowedPxW / maxMeasuredW);
  }
  if (fontPx > allowedPxH) {
    fontPx = allowedPxH;
  }

  if (fontPx < 1.2) {
    ctx.restore();
    return;
  }

  ctx.font = 'bold ' + fontPx.toFixed(2) + 'px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#34d399';

  const sx = toScreenX(tLayout.x);
  const sy = toScreenY(tLayout.y);
  const lineStepPx = fontPx * 1.12;
  const n = tLayout.lines.length;

  for (let i = 0; i < n; i++) {
    const offsetY = (i - (n - 1) * 0.5) * lineStepPx;
    ctx.fillText(tLayout.lines[i], sx, sy + offsetY);
  }
  ctx.restore();
}

// Dibuja un contorno 2D en el Canvas respetando las micro-uniones (holding tabs) si están activas
function drawContourWithTabsOnCanvas(ctx, pts, isHole, strokeColor, lineWidth, toScreenX, toScreenY) {
  if (!pts || pts.length < 3) return;
  const tabRes = computeLoopWithHoldingTabs(pts, isHole);

  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;

  if (tabRes.isClosed) {
    ctx.beginPath();
    pts.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(toScreenX(pt.x), toScreenY(pt.y));
      else ctx.lineTo(toScreenX(pt.x), toScreenY(pt.y));
    });
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.lineCap = 'butt';
    ctx.beginPath();
    tabRes.subpaths.forEach((poly) => {
      if (!poly || poly.length < 2) return;
      poly.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(toScreenX(pt.x), toScreenY(pt.y));
        else ctx.lineTo(toScreenX(pt.x), toScreenY(pt.y));
      });
    });
    ctx.stroke();

    // Resaltar visualmente los puentes de sujeción sin cortar si el indicador está activo
    if (state.tabShowMarkers && tabRes.tabBridges.length > 0) {
      tabRes.tabBridges.forEach((br) => {
        const sx = toScreenX(br.x);
        const sy = toScreenY(br.y);
        ctx.beginPath();
        ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
        ctx.fill();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });
    }
  }
  ctx.restore();
}

function render2DBoard(ctx, canvas) {
  const board = state.nestedBoards[state.activeBoardIndex];
  if (!board || board.placements.length === 0) {
    ctx.fillStyle = '#f87171';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    const msg = state.unfitIslandsCount > 0
      ? 'Las piezas (' + state.unfitIslandsCount + ') superan las dimensiones del tablero actual. Aumenta el tamaño del tablero.'
      : 'No hay islas seleccionadas para distribuir en el tablero';
    ctx.fillText(msg, canvas.width / 2, canvas.height / 2);
    return;
  }

  const pad = 36;
  const baseScale = Math.min((canvas.width - pad * 2) / board.width, (canvas.height - pad * 2) / board.height);
  const scale = baseScale * state.view2D.zoom;
  const centerX = canvas.width / 2 + state.view2D.panX;
  const centerY = canvas.height / 2 + state.view2D.panY;
  const toScreenX = (x) => centerX + (x - board.width / 2) * scale;
  const toScreenY = (y) => centerY - (y - board.height / 2) * scale;

  const bx = toScreenX(0);
  const by = toScreenY(board.height);
  const bw = board.width * scale;
  const bh = board.height * scale;

  // Fondo y borde del tablero físico
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 1.8;
  ctx.strokeRect(bx, by, bw, bh);

  // Margen útil interior
  if (board.margin > 0) {
    const mx = toScreenX(board.margin);
    const my = toScreenY(board.height - board.margin);
    const mw = (board.width - board.margin * 2) * scale;
    const mh = (board.height - board.margin * 2) * scale;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, mw, mh);
  }
  ctx.restore();

  // Dibujar cada isla anidada en el tablero
  board.placements.forEach((pl) => {
    const isCurrentSlice = pl.island.sliceIndex === state.activeSliceIndex;

    // Relleno sombreado con regla evenodd
    ctx.save();
    ctx.beginPath();
    pl.outerPoints.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(toScreenX(pt.x), toScreenY(pt.y));
      else ctx.lineTo(toScreenX(pt.x), toScreenY(pt.y));
    });
    ctx.closePath();
    pl.holes.forEach((h) => {
      h.points.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(toScreenX(pt.x), toScreenY(pt.y));
        else ctx.lineTo(toScreenX(pt.x), toScreenY(pt.y));
      });
      ctx.closePath();
    });
    ctx.fillStyle = isCurrentSlice ? 'rgba(244, 63, 94, 0.26)' : 'rgba(14, 165, 233, 0.16)';
    ctx.fill('evenodd');
    ctx.restore();

    // Contorno exterior (rojo) con soporte de micro-uniones
    drawContourWithTabsOnCanvas(
      ctx,
      pl.outerPoints,
      false,
      isCurrentSlice ? '#fb7185' : '#f43f5e',
      isCurrentSlice ? 2.4 : 1.7,
      toScreenX,
      toScreenY
    );

    // Contornos de huecos interiores (azul) con soporte opcional de micro-uniones
    pl.holes.forEach((h) => {
      drawContourWithTabsOnCanvas(ctx, h.points, true, '#38bdf8', 1.4, toScreenX, toScreenY);
    });

    // Guía inferior (#N-1) si está activa
    if (state.includePrevSliceGuide && pl.lowerPolys.length > 0) {
      ctx.save();
      ctx.setLineDash(getCanvasDashPattern(state.lowerGuideStyle));
      ctx.beginPath();
      pl.lowerPolys.forEach((poly) => {
        poly.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(toScreenX(pt.x), toScreenY(pt.y));
          else ctx.lineTo(toScreenX(pt.x), toScreenY(pt.y));
        });
      });
      ctx.strokeStyle = '#d946ef';
      ctx.lineWidth = 1.35;
      ctx.stroke();
      ctx.restore();
    }

    // Guía superior (#N+1) si está activa
    if (state.includeNextSliceGuide && pl.upperPolys.length > 0) {
      ctx.save();
      ctx.setLineDash(getCanvasDashPattern(state.upperGuideStyle));
      ctx.beginPath();
      pl.upperPolys.forEach((poly) => {
        poly.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(toScreenX(pt.x), toScreenY(pt.y));
          else ctx.lineTo(toScreenX(pt.x), toScreenY(pt.y));
        });
      });
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.35;
      ctx.stroke();
      ctx.restore();
    }

    // Perforaciones de varillas guía
    pl.rods.forEach((r) => {
      ctx.beginPath();
      ctx.arc(toScreenX(r.x), toScreenY(r.y), (state.rodDiameter / 2) * scale, 0, Math.PI * 2);
      ctx.fillStyle = '#090d16';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    });

    // Grabado en cada isla autoajustado en tamaño y líneas para caber 100% en su interior
    drawAdaptiveIslandTextOnCanvas(ctx, pl.textLayout, toScreenX, toScreenY, scale);
  });
}

function render2DSlice() {
  const canvas = document.getElementById('canvas2D');
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width || 500;
  canvas.height = rect.height || 380;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (state.nestingEnabled) {
    render2DBoard(ctx, canvas);
    return;
  }

  const idx = state.activeSliceIndex;
  const slice = state.slices[idx];
  if (!slice || slice.loops.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Lasca sin intersección geométrica en esta cota', canvas.width / 2, canvas.height / 2);
    return;
  }

  const upperSlice = getAdjacentSlice(idx, 'next');
  const lowerSlice = getAdjacentSlice(idx, 'prev');
  // Escala y encuadre fijos basados en el tamaño total de la pieza (igual que el documento SVG) con soporte de Zoom y Pan
  const docB = getModelBounds2D();
  const pad = 42;
  const baseScale = Math.min((canvas.width - pad * 2) / docB.width, (canvas.height - pad * 2) / docB.height);
  const scale = baseScale * state.view2D.zoom;
  const centerX = canvas.width / 2 + state.view2D.panX;
  const centerY = canvas.height / 2 + state.view2D.panY;
  const toScreenX = (x) => centerX + (x - docB.cx) * scale;
  const toScreenY = (y) => centerY - (y - docB.cy) * scale;

  // Marco de referencia que representa los bordes del documento SVG (tamaño de la pieza)
  ctx.save();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  const docX = toScreenX(docB.minX);
  const docY = toScreenY(docB.maxY);
  ctx.strokeRect(docX, docY, docB.width * scale, docB.height * scale);
  ctx.restore();

  // Relleno sombreado con regla evenodd
  ctx.save();
  ctx.beginPath();
  slice.loops.forEach((loop) => {
    loop.points.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(toScreenX(pt.x), toScreenY(pt.y));
      else ctx.lineTo(toScreenX(pt.x), toScreenY(pt.y));
    });
    ctx.closePath();
  });
  ctx.fillStyle = 'rgba(14, 165, 233, 0.16)';
  ctx.fill('evenodd');
  ctx.restore();

  // Contornos exteriores (rojo) e interiores (azul) de la lasca actual con soporte de micro-uniones
  slice.loops.forEach((loop) => {
    drawContourWithTabsOnCanvas(
      ctx,
      loop.points,
      loop.isHole,
      loop.isHole ? '#38bdf8' : '#f43f5e',
      loop.isHole ? 1.6 : 2.2,
      toScreenX,
      toScreenY
    );
  });

  // 1. GUÍA DE LA LÁMINA INFERIOR (#N-1) - Violeta/Magenta en trazo continuo
  if (lowerSlice && lowerSlice.loops.length > 0) {
    const lowerPolys = getGuidePolylinesForSlice(slice, lowerSlice);
    if (lowerPolys.length > 0) {
      ctx.save();
      ctx.setLineDash(getCanvasDashPattern(state.lowerGuideStyle));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      lowerPolys.forEach((poly) => {
        poly.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(toScreenX(pt.x), toScreenY(pt.y));
          else ctx.lineTo(toScreenX(pt.x), toScreenY(pt.y));
        });
      });
      ctx.strokeStyle = '#d946ef'; // Fucsia/Violeta para diferenciar la lámina inferior
      ctx.lineWidth = 1.65;
      ctx.stroke();
      ctx.restore();
    }
  }

  // 2. GUÍA DE LA LÁMINA SUPERIOR (#N+1) - Ámbar/Naranja en trazo continuo
  if (upperSlice && upperSlice.loops.length > 0) {
    const upperPolys = getGuidePolylinesForSlice(slice, upperSlice);
    if (upperPolys.length > 0) {
      ctx.save();
      ctx.setLineDash(getCanvasDashPattern(state.upperGuideStyle));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      upperPolys.forEach((poly) => {
        poly.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(toScreenX(pt.x), toScreenY(pt.y));
          else ctx.lineTo(toScreenX(pt.x), toScreenY(pt.y));
        });
      });
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.65;
      ctx.stroke();
      ctx.restore();
    }
  }

  // Perforaciones de varillas
  const rods = getAlignmentHoles2D(slice);
  rods.forEach((r) => {
    ctx.beginPath();
    ctx.arc(toScreenX(r.x), toScreenY(r.y), (state.rodDiameter / 2) * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#090d16';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // Mostrar también en la vista individual la etiqueta por isla autoajustada al interior de cada isla
  if (state.includeLabels) {
    const sliceIslands = extractIslandsFromSlices([slice]);
    sliceIslands.forEach((isl) => {
      drawAdaptiveIslandTextOnCanvas(ctx, isl.textLayout, toScreenX, toScreenY, scale);
    });
  }
}

function stepSlice(delta) {
  if (state.nestingEnabled) {
    if (state.nestedBoards.length === 0) return;
    selectActiveBoard(state.activeBoardIndex + delta);
  } else {
    selectActiveSlice(state.activeSliceIndex + delta);
  }
}

function togglePlaySlices() {
  state.isPlaying = !state.isPlaying;
  const btn = document.getElementById('playSlicesBtn');
  if (state.isPlaying) {
    btn.textContent = '⏸ Pausa';
    state.playTimer = setInterval(() => {
      if (state.nestingEnabled && state.nestedBoards.length > 0) {
        selectActiveBoard((state.activeBoardIndex + 1) % state.nestedBoards.length);
      } else {
        const next = (state.activeSliceIndex + 1) % state.slices.length;
        selectActiveSlice(next);
      }
    }, 260);
  } else {
    btn.textContent = '▶ Play';
    clearInterval(state.playTimer);
  }
}

function renderSliceStripUI() {
  const container = document.getElementById('sliceStripContainer');
  const titleEl = document.getElementById('bottomStripTitle');
  container.innerHTML = '';

  if (state.nestingEnabled) {
    if (titleEl) {
      titleEl.textContent = 'Tableros Generados (' + state.nestedBoards.length + ') — Cada tablero contiene solo las piezas que caben en sus dimensiones (clic para inspeccionar)';
    }
    state.nestedBoards.forEach((board, bIdx) => {
      const card = document.createElement('div');
      card.id = 'boardCard_' + bIdx;
      card.className = 'slice-card shrink-0 w-36 h-16 rounded-lg border border-slate-700 bg-slate-800/70 p-1.5 flex flex-col justify-between cursor-pointer transition';
      card.onclick = () => selectActiveBoard(bIdx);

      const uniqueSlicesCount = new Set(board.placements.map((p) => p.island.sliceIndex)).size;

      const topRow = document.createElement('div');
      topRow.className = 'flex items-center justify-between text-[10px]';
      topRow.innerHTML =
        '<span class="font-bold text-emerald-300">Tablero #' + (bIdx + 1) + '</span>' +
        '<button onclick="event.stopPropagation(); openBoardInfoModal(' + bIdx + ')" class="px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 border border-sky-500/30 text-[9px] font-bold" title="Ver detalle de láminas de este tablero">ℹ️ Info</button>';

      const bottomRow = document.createElement('div');
      bottomRow.className = 'flex items-center justify-between text-[9px] text-slate-400 font-mono';
      bottomRow.innerHTML =
        '<span>' + uniqueSlicesCount + ' lám / ' + board.placements.length + ' isl</span>' +
        '<span class="text-sky-300">' + board.efficiency.toFixed(0) + '%</span>';

      card.appendChild(topRow);
      card.appendChild(bottomRow);
      container.appendChild(card);
    });
    updateSelectedCountBadge();
    highlightActiveCardInStrip();
    return;
  }

  if (titleEl) {
    titleEl.textContent = 'Secuencia de Lascas (clic para inspeccionar, casilla para incluir/excluir de exportación)';
  }

  state.slices.forEach((slice, idx) => {
    const card = document.createElement('div');
    card.id = 'sliceCard_' + idx;
    card.className = 'slice-card shrink-0 w-20 h-16 rounded-lg border border-slate-700 bg-slate-800/70 p-1.5 flex flex-col justify-between cursor-pointer transition';
    card.onclick = (e) => {
      if (e.target.tagName.toLowerCase() !== 'input') selectActiveSlice(idx);
    };

    const topRow = document.createElement('div');
    topRow.className = 'flex items-center justify-between text-[10px]';
    topRow.innerHTML = '<span class="font-bold text-slate-200">#' + (idx + 1) + '</span>';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = slice.selected;
    chk.className = 'accent-emerald-500 cursor-pointer';
    chk.onchange = (e) => {
      slice.selected = e.target.checked;
      if (idx === state.activeSliceIndex) {
        document.getElementById('currentSliceSelectedCheck').checked = slice.selected;
      }
      updateSelectedCountBadge();
      update3DSlicesTransforms();
      if (state.nestingEnabled) {
        recomputeBoardNesting();
        update2DInspectorHeader();
        render2DSlice();
      }
    };
    topRow.appendChild(chk);

    const bottomRow = document.createElement('div');
    bottomRow.className = 'text-[9px] text-slate-400 truncate font-mono';
    bottomRow.textContent = slice.coord.toFixed(1) + 'mm';

    card.appendChild(topRow);
    card.appendChild(bottomRow);
    container.appendChild(card);
  });

  updateSelectedCountBadge();
  highlightActiveCardInStrip();
}

function highlightActiveCardInStrip() {
  if (state.nestingEnabled) {
    state.nestedBoards.forEach((_, bIdx) => {
      const c = document.getElementById('boardCard_' + bIdx);
      if (c) c.classList.toggle('active', bIdx === state.activeBoardIndex);
    });
    return;
  }
  state.slices.forEach((_, idx) => {
    const c = document.getElementById('sliceCard_' + idx);
    if (c) c.classList.toggle('active', idx === state.activeSliceIndex);
  });
}

function toggleCurrentSliceSelection(checked) {
  const s = state.slices[state.activeSliceIndex];
  if (!s) return;
  s.selected = checked;
  if (state.nestingEnabled) recomputeBoardNesting();
  renderSliceStripUI();
  update3DSlicesTransforms();
  render2DSlice();
}

function selectSlicesByFilter(mode) {
  state.slices.forEach((s, i) => {
    if (mode === 'all') s.selected = true;
    else if (mode === 'none') s.selected = false;
    else if (mode === 'odd') s.selected = ((i + 1) % 2 === 1);
    else if (mode === 'even') s.selected = ((i + 1) % 2 === 0);
  });
  if (state.slices[state.activeSliceIndex]) {
    document.getElementById('currentSliceSelectedCheck').checked = state.slices[state.activeSliceIndex].selected;
  }
  if (state.nestingEnabled) recomputeBoardNesting();
  renderSliceStripUI();
  update3DSlicesTransforms();
  update2DInspectorHeader();
  render2DSlice();
}

function updateSelectedCountBadge() {
  const sel = state.slices.filter((s) => s.selected).length;
  document.getElementById('selectedCountBadge').textContent = sel + ' / ' + state.slices.length;
}
