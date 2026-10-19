/**
 * LayerStudio 3D - Global State & 3D Scene References
 * Estado reactivo centralizado de la aplicación y referencias de escena Three.js.
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
// ESTADO GLOBAL DE LA APLICACIÓN
// =========================================================================
const state = {
  modelName: 'nudo_toroidal',
  unit: 'mm', // 'mm' | 'cm' | 'm'
  axis: 'z',  // 'x' | 'y' | 'z'
  mode: 'count', // 'count' | 'thickness'
  sliceCount: 24,
  thickness: 5,
  explodeFactor: 0,
  showGhost: true,
  isolateCurrent: false,
  includeLabels: true,
  includeNextSliceGuide: true, // Mostrar/exportar guía de la lámina superior (#N+1)
  includePrevSliceGuide: true, // Mostrar/exportar guía de la lámina inferior (#N-1)
  upperGuideStyle: 'solid',    // 'solid' | 'dashed' (continuo por defecto para velocidad láser)
  lowerGuideStyle: 'solid',    // 'solid' | 'dotted' | 'dashdot' (continuo por defecto para velocidad láser)
  guideOnlyOuter: false,       // true = solo contorno exterior de las lascas adyacentes
  guideClipToSlice: true,      // true = recorta las guías que sobresalgan fuera del contorno de la lasca actual
  rodCount: 0,
  rodDiameter: 4,
  // Sistema de Micro-uniones / Pestañas de sujeción por presión (Holding Tabs / Bridges)
  tabsEnabled: false,          // true = deja puntos sin cortar para desprender la pieza haciendo presión
  tabMode: 'count',            // 'count' (nº fijo de puntos por pieza) | 'spacing' (cada X mm de perímetro)
  tabCount: 4,                 // Nº de puntos sin cortar por pieza (ej. 4 puntos)
  tabSpacingMM: 60,            // Distancia entre puntos en mm cuando tabMode === 'spacing'
  tabWidthMM: 1.0,             // Longitud sin cortar de cada micro-unión en mm (ej. 1.0 mm)
  tabApplyToHoles: false,      // true = aplica también micro-uniones a los huecos interiores
  tabShowMarkers: true,        // true = resalta visualmente los puentes de sujeción en el visor 2D
  // Filtro de eliminación de islas pequeñas
  filterSmallIslands: false,   // true = descarta islas inferiores al umbral indicado
  minIslandSizeMM: 10,         // Valor umbral en mm (o mm² si el criterio es área)
  minIslandCriteria: 'max_dim',// 'max_dim' | 'min_dim' | 'area'
  filteredIslandsCount: 0,     // Total de islas descartadas en el modelo actual
  // Configuración de Distribución en Tablero (Nesting de islas)
  nestingEnabled: false,
  boardWidthMM: 600,
  boardHeightMM: 400,
  nestSpacingMM: 3,
  nestMarginMM: 5,
  nestAllowRotate: true,
  nestUseInnerHoles: true,
  nestClipOversized: false,    // true = incluye piezas mayores que el tablero recortando la parte que no cabe
  nestEngraveSliceNum: true,
  nestEngraveGuideType: true,
  nestedBoards: [],            // [{ boardIndex, width, height, margin, placements: [...], efficiency }]
  unfitIslandsCount: 0,        // Islas cuyas dimensiones superan el tamaño total de un tablero
  clippedIslandsCount: 0,      // Islas que fueron recortadas para caber en el tablero
  activeBoardIndex: 0,
  assemblyGuideTab: 'all',     // 'all' | 'cutting' | 'assembly'
  assembledSlicesDone: {},     // Registro de pasos marcados como montados { [sliceIndex]: boolean }
  view2D: {
    zoom: 1,
    panX: 0,
    panY: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    hasMoved: false
  },
  activeSliceIndex: 0,
  isPlaying: false,
  playTimer: null,
  baseVertices: null, // Float32Array centrado en origen
  dimsMM: { x: 120, y: 120, z: 120 },
  slices: [] // [{ index, coord, selected, loops: [{ points, isHole, area }] }]
};

// Variables Three.js
let scene, camera, renderer, controls, raycaster, mouse;
let sliceGroup3D, ghostMesh3D, gridHelper3D;

