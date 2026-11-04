/**
 * Zasněžená ulice s veřejnými knihovnami (Three.js). Každá knihovna je budova.
 *
 *   const street = createLibraryStreetScene({ canvas, labelsEl, onLibraryClick });
 *   street.setLibraries(libraries);
 *   await street.enterLibrary(id);   // kamera doletí ke dveřím
 *   street.dispose();
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const SPACING = 11;
const WARM = 0xffc98a;

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });

export function createLibraryStreetScene({ canvas, labelsEl, onLibraryClick }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 300);
  const target = new THREE.Vector3(0, 2.4, 0);

  scene.add(new THREE.HemisphereLight(0xc7d9ee, 0x4a3628, 1.15));
  const moon = new THREE.DirectionalLight(0xd6e4ff, 1.5);
  moon.position.set(-14, 22, 18);
  scene.add(moon);

  const M = {
    snow: mat(0xf3f6fa, { roughness: 1 }),
    road: mat(0x4a4e58, { roughness: 1 }),
    stone: mat(0xd8cbb4),
    plinth: mat(0x8c8a86),
    roof: mat(0x6e3b30),
    door: mat(0x5a3a24),
    window: mat(0xffe1b0, { emissive: WARM, emissiveIntensity: 1.5 }),
    house: mat(0x46566f),
    houseRoof: mat(0x2f3a4c),
    houseWindow: mat(0xffd9a0, { emissive: WARM, emissiveIntensity: 0.7 }),
    pine: mat(0x2f4a3f, { flatShading: true }),
    trunk: mat(0x5a4032)
  };

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 160), M.snow);
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -20;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(300, 6), M.road);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, 7.5);
  scene.add(ground, road);

  const box = (w, h, d, material) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.04), material);

  function makeRoof(w, h, d, material) {
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.71, 1, 4), material);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(w, h, d);
    return roof;
  }

  // Pevné „náhodné“ hodnoty, ať ulice vypadá pokaždé stejně.
  let seed = 23;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  for (let i = 0; i < 16; i++) {
    const x = -48 + i * 6.5 + rand() * 2;
    const h = 2.4 + rand() * 2;
    const house = new THREE.Group();
    const body = box(4.4, h, 4, M.house);
    body.position.y = h / 2;
    const roof = makeRoof(5.4, 1.8, 5, M.houseRoof);
    roof.position.y = h + 0.9;
    const pane = box(0.7, 0.8, 0.1, M.houseWindow);
    pane.position.set(0, h * 0.6, 2.02);
    house.add(body, roof, pane);
    house.position.set(x, 0, -11 - rand() * 4);
    scene.add(house);
  }

  for (let i = 0; i < 18; i++) {
    const pine = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.7, 6), M.trunk);
    trunk.position.y = 0.35;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.9 + rand() * 0.4, 2.6 + rand(), 7), M.pine);
    crown.position.y = 2;
    pine.add(trunk, crown);
    pine.position.set(-52 + i * 6 + rand() * 3, 0, -6.5 - rand() * 2);
    scene.add(pine);
  }

  // ---------- budovy knihoven ----------
  const lights = [];
  const buildings = new Map(); // id -> { group, label, door }

  function makeBuilding(library) {
    const group = new THREE.Group();
    const add = (mesh, x, y, z) => {
      mesh.position.set(x, y, z);
      mesh.userData.libraryId = library.id;
      group.add(mesh);
      return mesh;
    };
    add(box(8.6, 0.5, 6.4, M.plinth), 0, 0.25, 0);
    add(box(8, 4.4, 5.8, M.stone), 0, 2.7, 0);
    add(makeRoof(9.8, 2.4, 7.4, M.roof), 0, 6.1, 0);
    add(box(1.5, 2.5, 0.2, M.door), 0, 1.75, 2.95);
    for (const x of [-2.8, 2.8]) {
      add(box(1.3, 1.7, 0.15, M.window), x, 2.9, 2.95);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 3.9, 12), M.plinth), x * 0.5, 2.45, 3.3);
    }
    add(box(4.6, 0.5, 0.15, M.window), 0, 4.45, 2.95);
    const light = new THREE.PointLight(WARM, 16, 11, 1.6);
    light.position.set(0, 3, 4.6);
    group.add(light);
    lights.push(light);

    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'cabin-label is-visible';
    label.textContent = library.name;
    label.setAttribute('aria-label', `Vstoupit do knihovny ${library.name}`);
    label.addEventListener('click', () => onLibraryClick?.(library.id));
    labelsEl.appendChild(label);

    return { group, label };
  }

  function disposeGroup(group) {
    group.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
      if (o.isLight) lights.splice(lights.indexOf(o), 1);
    });
  }

  const cameraHome = new THREE.Vector3();
  let camAnim = null;

  function placeCamera(count) {
    const width = Math.max(1, count) * SPACING;
    const aspect = camera.aspect || 1.5;
    const distance = Math.max(30, width / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect) + 16);
    cameraHome.set(0, distance * 0.3, distance);
    if (!camAnim) {
      camera.position.copy(cameraHome);
      camera.lookAt(target);
    }
  }

  let lastCount = 0;
  function setLibraries(libraries) {
    for (const [id, building] of buildings) {
      scene.remove(building.group);
      disposeGroup(building.group);
      building.label.remove();
      buildings.delete(id);
    }
    libraries.forEach((library, i) => {
      const building = makeBuilding(library);
      building.group.position.x = (i - (libraries.length - 1) / 2) * SPACING;
      scene.add(building.group);
      buildings.set(library.id, building);
    });
    lastCount = libraries.length;
    placeCamera(lastCount);
  }

  function enterLibrary(id) {
    const building = buildings.get(id);
    if (!building) return Promise.resolve();
    const door = new THREE.Vector3(building.group.position.x, 1.8, 3);
    return new Promise((resolve) => {
      camAnim = {
        from: camera.position.clone(),
        fromTarget: target.clone(),
        to: door.clone().add(new THREE.Vector3(0, 0.3, 3.5)),
        toTarget: door,
        start: performance.now(),
        dur: 1100,
        resolve
      };
    });
  }

  // ---------- klik na budovu ----------
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let downAt = null;
  const onDown = (e) => {
    downAt = [e.clientX, e.clientY];
  };
  const onUp = (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const rect = canvas.getBoundingClientRect();
    ptr.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects([...buildings.values()].map((b) => b.group), true)[0];
    if (hit?.object.userData.libraryId) onLibraryClick?.(hit.object.userData.libraryId);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);

  // ---------- sníh ----------
  const SNOW = 900;
  const snowGeo = new THREE.BufferGeometry();
  const snowPos = new Float32Array(SNOW * 3);
  for (let i = 0; i < SNOW; i++) {
    snowPos[i * 3] = (rand() - 0.5) * 80;
    snowPos[i * 3 + 1] = rand() * 26;
    snowPos[i * 3 + 2] = -14 + rand() * 50;
  }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ size: 0.12, color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
  scene.add(snow);

  // ---------- velikost ----------
  let width = 0;
  let height = 0;
  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = camera.aspect < 0.8 ? 46 : 32;
    camera.updateProjectionMatrix();
    placeCamera(lastCount);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  // ---------- smyčka ----------
  const v = new THREE.Vector3();
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (camAnim) {
      const t = Math.min(1, (now - camAnim.start) / camAnim.dur);
      const e = t * t * (3 - 2 * t);
      camera.position.lerpVectors(camAnim.from, camAnim.to, e);
      target.lerpVectors(camAnim.fromTarget, camAnim.toTarget, e);
      camera.lookAt(target);
      if (t >= 1) {
        const { resolve } = camAnim;
        camAnim = null;
        resolve();
      }
    }

    const p = snowGeo.attributes.position.array;
    for (let i = 0; i < SNOW; i++) {
      p[i * 3 + 1] -= (0.5 + (i % 5) * 0.15) * dt;
      if (p[i * 3 + 1] < 0) p[i * 3 + 1] = 26;
    }
    snowGeo.attributes.position.needsUpdate = true;

    for (const { group, label } of buildings.values()) {
      v.set(group.position.x, 8, 0).project(camera);
      label.style.transform = `translate(${(v.x * 0.5 + 0.5) * width}px, ${(-v.y * 0.5 + 0.5) * height}px) translate(-50%, -100%)`;
    }

    renderer.render(scene, camera);
  });

  function dispose() {
    renderer.setAnimationLoop(null);
    resizeObserver.disconnect();
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointerup', onUp);
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    Object.values(M).forEach((m) => m.dispose());
    snow.material.dispose();
    renderer.dispose();
    labelsEl.innerHTML = '';
  }

  return { setLibraries, enterLibrary, dispose };
}
