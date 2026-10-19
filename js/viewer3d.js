/**
 * LayerStudio 3D (LascaStudio 3D) - 3D Viewport, Loaders & Dynamic Sizing
 * Motor 3D Three.js, importación STL/GLB/GLTF, modelos paramétricos y dimensionamiento mm/cm/m.
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
// INICIALIZACIÓN
// =========================================================================
window.addEventListener('DOMContentLoaded', () => {
  initThreeJS();
  setupFileInputs();
  setupCanvas2DInteraction();
  loadPresetModel('torus');
  window.addEventListener('resize', onWindowResize);
});

function initThreeJS() {
  const container = document.getElementById('viewer3D');
  const w = container.clientWidth || 600;
  const h = container.clientHeight || 450;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070a12);

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100000);
  camera.position.set(180, -210, 160);
  camera.up.set(0, 0, 1);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  const ambLight = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(ambLight);

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.75);
  dirLight1.position.set(200, -200, 300);
  scene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.35);
  dirLight2.position.set(-200, 200, -150);
  scene.add(dirLight2);

  gridHelper3D = new THREE.GridHelper(300, 20, 0x1e293b, 0x0f172a);
  gridHelper3D.rotation.x = Math.PI / 2;
  scene.add(gridHelper3D);

  sliceGroup3D = new THREE.Group();
  scene.add(sliceGroup3D);

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  renderer.domElement.addEventListener('pointerdown', onViewportClick);

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

function onViewportClick(e) {
  if (!sliceGroup3D || sliceGroup3D.children.length === 0) return;
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(sliceGroup3D.children, false);
  if (intersects.length > 0) {
    const hit = intersects[0].object;
    if (typeof hit.userData.sliceIndex === 'number') {
      selectActiveSlice(hit.userData.sliceIndex);
    }
  }
}

function onWindowResize() {
  const container = document.getElementById('viewer3D');
  if (!container || !renderer) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  render2DSlice();
}

// =========================================================================
// CARGA DE ARCHIVOS .STL, .GLB Y PROYECTOS .LASCA
// =========================================================================
function setupFileInputs() {
  document.getElementById('fileInput3D').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadUser3DFile(file);
    e.target.value = '';
  });

  document.getElementById('fileInputProject').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importProjectFile(file);
    e.target.value = '';
  });
}

function loadUser3DFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  state.modelName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const reader = new FileReader();

  if (ext === 'stl') {
    reader.onload = (ev) => {
      const loader = new THREE.STLLoader();
      const geom = loader.parse(ev.target.result);
      setGeometryAndSlice(geom, true);
    };
    reader.readAsArrayBuffer(file);
  } else if (ext === 'glb' || ext === 'gltf') {
    reader.onload = (ev) => {
      const loader = new THREE.GLTFLoader();
      loader.parse(ev.target.result, '', (gltf) => {
        const positions = [];
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((child) => {
          if (child.isMesh && child.geometry) {
            const g = child.geometry.clone().applyMatrix4(child.matrixWorld);
            const nonIndexed = g.index ? g.toNonIndexed() : g;
            const pos = nonIndexed.attributes.position.array;
            for (let i = 0; i < pos.length; i++) positions.push(pos[i]);
          }
        });
        if (positions.length > 0) {
          const merged = new THREE.BufferGeometry();
          merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
          setGeometryAndSlice(merged, true);
        }
      });
    };
    reader.readAsArrayBuffer(file);
  }
}

function loadPresetModel(type) {
  let geom;
  state.modelName = 'modelo_' + type;

  if (type === 'torus') {
    geom = new THREE.TorusKnotGeometry(38, 12, 96, 20, 2, 3);
  } else if (type === 'vase') {
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const r = 22 + Math.sin(t * Math.PI * 2) * 12 + t * 8;
      pts.push(new THREE.Vector2(r, (t - 0.5) * 110));
    }
    geom = new THREE.LatheGeometry(pts, 40);
    geom.rotateX(Math.PI / 2);
  } else if (type === 'gear') {
    const shape = new THREE.Shape();
    const teeth = 12;
    const rOut = 50, rIn = 38;
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? rOut : rIn;
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, 16, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    geom = new THREE.ExtrudeGeometry(shape, { depth: 36, bevelEnabled: true, bevelThickness: 4, bevelSize: 3, bevelSegments: 2 });
  } else {
    geom = new THREE.OctahedronGeometry(55, 1);
  }

  setGeometryAndSlice(geom, true);
}

function setGeometryAndSlice(bufferGeom, normalizeToDefault) {
  const nonIndexed = bufferGeom.index ? bufferGeom.toNonIndexed() : bufferGeom.clone();
  nonIndexed.computeBoundingBox();
  const box = nonIndexed.boundingBox;
  const cx = (box.min.x + box.max.x) / 2;
  const cy = (box.min.y + box.max.y) / 2;
  const cz = (box.min.z + box.max.z) / 2;

  const sizeX = Math.max(0.001, box.max.x - box.min.x);
  const sizeY = Math.max(0.001, box.max.y - box.min.y);
  const sizeZ = Math.max(0.001, box.max.z - box.min.z);

  const rawPos = nonIndexed.attributes.position.array;
  // Normalizamos vértices base a rango [-0.5, 0.5] en cada eje
  state.baseVertices = new Float32Array(rawPos.length);
  for (let i = 0; i < rawPos.length; i += 3) {
    state.baseVertices[i]     = (rawPos[i] - cx) / sizeX;
    state.baseVertices[i + 1] = (rawPos[i + 1] - cy) / sizeY;
    state.baseVertices[i + 2] = (rawPos[i + 2] - cz) / sizeZ;
  }

  if (normalizeToDefault) {
    const maxOrig = Math.max(sizeX, sizeY, sizeZ);
    const scale = maxOrig < 15 ? 120 / maxOrig : 1;
    state.dimsMM.x = Number((sizeX * scale).toFixed(2));
    state.dimsMM.y = Number((sizeY * scale).toFixed(2));
    state.dimsMM.z = Number((sizeZ * scale).toFixed(2));
  }

  syncDimensionInputsUI();
  rebuildGhostAndSlices();
  resetCamera3D();
}

function getScaledTriangles() {
  const v = state.baseVertices;
  if (!v) return new Float32Array(0);
  const out = new Float32Array(v.length);
  const sx = state.dimsMM.x;
  const sy = state.dimsMM.y;
  const sz = state.dimsMM.z;
  for (let i = 0; i < v.length; i += 3) {
    out[i]     = v[i] * sx;
    out[i + 1] = v[i + 1] * sy;
    out[i + 2] = v[i + 2] * sz;
  }
  return out;
}

// =========================================================================
// DIMENSIONAMIENTO DINÁMICO (mm / cm / m)
// =========================================================================
function getUnitFactor() {
  if (state.unit === 'cm') return 10;
  if (state.unit === 'm') return 1000;
  return 1;
}

function setDisplayUnit(u) {
  state.unit = u;
  ['mm', 'cm', 'm'].forEach((k) => {
    const btn = document.getElementById('unitBtn_' + k);
    if (k === u) {
      btn.className = 'px-2 py-0.5 text-[10px] rounded font-bold bg-sky-600 text-white';
    } else {
      btn.className = 'px-2 py-0.5 text-[10px] rounded font-bold text-slate-400 hover:text-white';
    }
  });
  document.getElementById('unitLabelDims').textContent = u;
  const lblBoard = document.getElementById('unitLabelBoard');
  if (lblBoard) lblBoard.textContent = u;
  syncDimensionInputsUI();
  syncBoardInputsUI();
  render2DSlice();
}

function syncDimensionInputsUI() {
  const f = getUnitFactor();
  const decimals = state.unit === 'm' ? 3 : (state.unit === 'cm' ? 2 : 1);
  document.getElementById('dimInputX').value = (state.dimsMM.x / f).toFixed(decimals);
  document.getElementById('dimInputY').value = (state.dimsMM.y / f).toFixed(decimals);
  document.getElementById('dimInputZ').value = (state.dimsMM.z / f).toFixed(decimals);

  const maxMM = Math.max(state.dimsMM.x, state.dimsMM.y, state.dimsMM.z);
  document.getElementById('quickSizeInput').value = (maxMM / f).toFixed(decimals) + state.unit;
  document.getElementById('modelTotalDimsBadge').textContent =
    'Pieza: ' + state.dimsMM.x.toFixed(1) + ' × ' + state.dimsMM.y.toFixed(1) + ' × ' + state.dimsMM.z.toFixed(1) + ' mm';
}

function applyQuickSizeInput() {
  const raw = document.getElementById('quickSizeInput').value.trim().toLowerCase().replace(',', '.');
  const match = raw.match(/^([0-9.]+)\s*(mm|cm|m)?$/);
  if (!match) return;
  const val = parseFloat(match[1]);
  if (!Number.isFinite(val) || val <= 0) return;
  const unit = match[2] || state.unit;
  const factor = unit === 'm' ? 1000 : (unit === 'cm' ? 10 : 1);
  setMaxDimensionMM(val * factor);
}

function setMaxDimensionMM(targetMaxMM) {
  const curMax = Math.max(state.dimsMM.x, state.dimsMM.y, state.dimsMM.z, 0.001);
  const ratio = targetMaxMM / curMax;
  state.dimsMM.x = Math.max(1, state.dimsMM.x * ratio);
  state.dimsMM.y = Math.max(1, state.dimsMM.y * ratio);
  state.dimsMM.z = Math.max(1, state.dimsMM.z * ratio);
  syncDimensionInputsUI();
  rebuildGhostAndSlices();
  resetCamera3D();
}

function onAxisDimChange(axis, valStr) {
  const val = parseFloat(valStr);
  if (!Number.isFinite(val) || val <= 0) return;
  const newMM = val * getUnitFactor();
  const locked = document.getElementById('lockAspectCheckbox').checked;

  if (locked) {
    const oldMM = state.dimsMM[axis] || 1;
    const ratio = newMM / oldMM;
    state.dimsMM.x = Math.max(0.5, state.dimsMM.x * ratio);
    state.dimsMM.y = Math.max(0.5, state.dimsMM.y * ratio);
    state.dimsMM.z = Math.max(0.5, state.dimsMM.z * ratio);
  } else {
    state.dimsMM[axis] = Math.max(0.5, newMM);
  }
  syncDimensionInputsUI();
  rebuildGhostAndSlices();
  resetCamera3D();
}
