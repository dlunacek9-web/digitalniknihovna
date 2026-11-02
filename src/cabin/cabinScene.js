/**
 * Lukutupa — 3D chata s knihovnou (Three.js).
 *
 * Imperativní scéna, kterou React komponenta jen „krmí“ knihami:
 *   const scene = createCabinScene({ canvas, labelsEl, onShelfClick });
 *   scene.setBooks(books);        // diff: nové knihy spadnou, prázdné poličky zmizí
 *   scene.focusShelf('Sci-fi');   // kamera přiletí k poličce
 *   scene.resetView();
 *   scene.dispose();
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { bookColor, groupIntoShelves, plural } from '../services/genres';

const PER_LEVEL = 3;
const LEVEL_H = 0.85;
const SHELF_W = 1.6;
const SHELF_D = 0.6;

// Místa pro poličky: zadní stěna, střední řada, pravý okraj, popředí.
// Nový žánr dostane první volné místo; po smazání poslední knihy se místo uvolní.
const SLOTS = [
  ...[-4.6, -2.8, -1.0, 0.8, 2.6, 4.4].map((x) => ({ x, z: -4.55, ry: 0 })),
  ...[-0.4, 1.4, 3.2].map((x) => ({ x, z: -1.5, ry: 0 })),
  { x: 5.4, z: 0.6, ry: -Math.PI / 2 },
  { x: 5.4, z: 2.4, ry: -Math.PI / 2 },
  { x: 1.6, z: 1.6, ry: 0 },
  { x: 3.4, z: 1.6, ry: 0 },
  { x: 0.8, z: 3.8, ry: 0 },
  { x: 2.6, z: 3.8, ry: 0 },
  { x: 5.4, z: 4.2, ry: -Math.PI / 2 }
];

const HOME = { pos: new THREE.Vector3(17, 16, 20), target: new THREE.Vector3(0, 0.6, 0) };

// ---------- easing ----------
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => {
  const c = 1.6;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
const easeOutBounce = (t) => {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};

export function createCabinScene({ canvas, labelsEl, onShelfClick }) {
  // ---------- renderer & scéna ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
  camera.position.copy(HOME.pos);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(HOME.target);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.2;
  controls.minDistance = 10;
  controls.maxDistance = 48;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.25;

  scene.add(new THREE.HemisphereLight(0xc7d9ee, 0x4a3628, 0.9));
  const moon = new THREE.DirectionalLight(0xd6e4ff, 1.6);
  moon.position.set(-10, 18, 8);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = moon.shadow.camera.bottom = -15;
  moon.shadow.camera.right = moon.shadow.camera.top = 15;
  moon.shadow.radius = 6;
  moon.shadow.bias = -0.0005;
  scene.add(moon);

  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });
  const M = {
    snow: mat(0xf3f6fa, { roughness: 1 }),
    rock: mat(0x6b6f78, { flatShading: true }),
    floor: mat(0xc9a27a),
    wall: mat(0xede3d3),
    birch: mat(0xddbe93),
    shelfBack: mat(0xcdae84),
    pine: mat(0x2f4a3f, { flatShading: true }),
    pine2: mat(0x3d5c4c, { flatShading: true }),
    trunk: mat(0x5a4032),
    stone: mat(0x8c8a86, { flatShading: true }),
    soot: mat(0x1e1a18),
    fire: mat(0xff8a3d, { emissive: 0xff6a1f, emissiveIntensity: 2.2 }),
    glass: mat(0x9cb6d3, { emissive: 0x24344a, emissiveIntensity: 0.6, roughness: 0.2 }),
    rug: mat(0xa8443a),
    rugRing: mat(0xe9dcc3),
    chair: mat(0xc9973f),
    blanket: mat(0xe9dcc3),
    shade: mat(0xffe8c7, { emissive: 0xffc98a, emissiveIntensity: 1.4 }),
    black: mat(0x2a2420),
    cat: mat(0x3a3532)
  };
  const bookMaterials = new Map();
  const bookMat = (color) => {
    if (!bookMaterials.has(color)) bookMaterials.set(color, mat(color, { roughness: 0.7 }));
    return bookMaterials.get(color);
  };

  const shadowy = (o) => {
    o.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return o;
  };
  const box = (w, h, d, material, r = 0.04) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), material);

  const world = new THREE.Group();
  scene.add(world);

  // ---------- ostrov se smrky ----------
  const island = new THREE.Group();
  const snowTop = new THREE.Mesh(new THREE.CylinderGeometry(11, 10.6, 0.7, 64), M.snow);
  snowTop.position.y = -0.35;
  const earth = new THREE.Mesh(new THREE.CylinderGeometry(10.6, 7.5, 2.4, 14, 1), M.rock);
  earth.position.y = -1.9;
  island.add(snowTop, earth);
  // Pevné „náhodné“ hodnoty, ať chata vypadá při každém otevření stejně.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2;
    const r = 8 + rand() * 2.6;
    const drift = new THREE.Mesh(new THREE.SphereGeometry(0.6 + rand() * 0.8, 16, 12), M.snow);
    drift.scale.y = 0.35;
    drift.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    island.add(drift);
  }
  world.add(shadowy(island));

  function pine(h) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.6, 6), M.trunk);
    trunk.position.y = 0.3;
    g.add(trunk);
    for (let i = 0; i < 3; i++) {
      const r = (1 - i * 0.26) * 0.9 * h;
      const ch = 1.1 * h;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, ch, 7), i % 2 ? M.pine2 : M.pine);
      cone.position.y = 0.6 + i * 0.6 * h + ch / 2;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, ch * 0.42, 7), M.snow);
      cap.position.y = cone.position.y + ch * 0.3;
      g.add(cone, cap);
    }
    return shadowy(g);
  }
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + rand() * 0.2;
    const r = 8.4 + rand() * 1.8;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.abs(x) < 7 && Math.abs(z) < 6.2) continue;
    const tree = pine(0.8 + rand() * 0.6);
    tree.position.set(x, 0, z);
    tree.rotation.y = rand() * 6;
    world.add(tree);
  }

  // ---------- chata (řez jako domeček pro panenky) ----------
  const cabin = new THREE.Group();
  const floor = box(12.4, 0.3, 10.4, M.floor, 0.08);
  floor.position.y = 0.15;
  const backWall = box(12.4, 2.6, 0.3, M.wall, 0.06);
  backWall.position.set(0, 1.6, -5.05);
  const leftWall = box(0.3, 2.6, 10.4, M.wall, 0.06);
  leftWall.position.set(-6.05, 1.6, 0);
  cabin.add(floor, backWall, leftWall);

  const win = new THREE.Group();
  win.add(box(0.08, 1.3, 1.8, M.glass, 0.02), box(0.12, 1.42, 0.08, M.birch, 0.02), box(0.12, 0.08, 1.92, M.birch, 0.02));
  for (const s of [-1, 1]) {
    const v = box(0.12, 1.42, 0.08, M.birch, 0.02);
    v.position.z = s * 0.92;
    const h = box(0.12, 0.08, 1.92, M.birch, 0.02);
    h.position.y = s * 0.67;
    win.add(v, h);
  }
  win.position.set(-5.86, 1.7, -2.4);
  cabin.add(win);

  const fireplace = new THREE.Group();
  const fpBody = box(0.9, 1.6, 1.8, M.stone, 0.1);
  fpBody.position.y = 0.8;
  const fpHole = box(0.3, 0.8, 1.0, M.soot, 0.05);
  fpHole.position.set(0.35, 0.6, 0);
  const fire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), M.fire);
  fire.position.set(0.42, 0.45, 0);
  const chimney = box(0.6, 1.4, 1.0, M.stone, 0.08);
  chimney.position.y = 2.2;
  fireplace.add(fpBody, fpHole, fire, chimney);
  fireplace.position.set(-5.5, 0.3, 2.2);
  cabin.add(fireplace);
  const fireLight = new THREE.PointLight(0xff8a3d, 6, 9, 1.6);
  fireLight.position.set(-4.6, 1.0, 2.2);
  cabin.add(fireLight);

  const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.04, 48), M.rug);
  rug.scale.z = 0.7;
  rug.position.set(-2.2, 0.32, 2.6);
  const rugRing = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.04, 6, 48), M.rugRing);
  rugRing.rotation.x = Math.PI / 2;
  rugRing.scale.y = 0.7;
  rugRing.position.set(-2.2, 0.35, 2.6);
  cabin.add(rug, rugRing);

  const chair = new THREE.Group();
  const seat = box(1.2, 0.45, 1.1, M.chair, 0.18);
  seat.position.y = 0.55;
  const back = box(1.2, 1.1, 0.32, M.chair, 0.15);
  back.position.set(0, 1.0, -0.45);
  const armL = box(0.26, 0.7, 1.1, M.chair, 0.12);
  armL.position.set(-0.6, 0.7, 0);
  const armR = armL.clone();
  armR.position.x = 0.6;
  const blanket = box(0.5, 0.06, 1.0, M.blanket, 0.03);
  blanket.position.set(0.25, 0.8, 0.05);
  blanket.rotation.z = 0.15;
  chair.add(seat, back, armL, armR, blanket);
  chair.position.set(-3.3, 0.3, 1.6);
  chair.rotation.y = 0.7;
  cabin.add(chair);

  const lamp = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.0, 8), M.black);
  pole.position.y = 1.0;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.06, 20), M.black);
  base.position.y = 0.03;
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 0.45, 24, 1, true), M.shade);
  shade.position.y = 2.05;
  lamp.add(pole, base, shade);
  lamp.position.set(-4.5, 0.3, 0.6);
  cabin.add(lamp);
  const lampLight = new THREE.PointLight(0xffc98a, 7, 8, 1.4);
  lampLight.position.set(-4.5, 2.0, 0.6);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(512, 512);
  cabin.add(lampLight);

  const cat = new THREE.Group();
  const catBody = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), M.cat);
  catBody.scale.set(1.3, 0.65, 0.9);
  catBody.position.y = 0.2;
  const catHead = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), M.cat);
  catHead.position.set(0.38, 0.25, 0.05);
  for (const z of [-0.08, 0.1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), M.cat);
    ear.position.set(0.4, 0.42, z);
    cat.add(ear);
  }
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 6, 16, Math.PI), M.cat);
  tail.rotation.x = Math.PI / 2;
  tail.position.set(-0.1, 0.1, 0);
  cat.add(catBody, catHead, tail);
  cat.position.set(-1.7, 0.34, 2.8);
  cat.rotation.y = -0.4;
  cabin.add(cat);

  world.add(shadowy(cabin));
  fire.castShadow = false;

  // ---------- sníh ----------
  const SNOW = 1600;
  const snowGeo = new THREE.BufferGeometry();
  const snowPos = new Float32Array(SNOW * 3);
  const snowVel = new Float32Array(SNOW);
  for (let i = 0; i < SNOW; i++) {
    snowPos[i * 3] = (Math.random() - 0.5) * 34;
    snowPos[i * 3 + 1] = Math.random() * 18;
    snowPos[i * 3 + 2] = (Math.random() - 0.5) * 34;
    snowVel[i] = 0.5 + Math.random() * 0.8;
  }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const dot = document.createElement('canvas');
  dot.width = dot.height = 32;
  const dctx = dot.getContext('2d');
  const grad = dctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  dctx.fillStyle = grad;
  dctx.fillRect(0, 0, 32, 32);
  const snowTexture = new THREE.CanvasTexture(dot);
  const snow = new THREE.Points(
    snowGeo,
    new THREE.PointsMaterial({ size: 0.16, map: snowTexture, transparent: true, depthWrite: false, opacity: 0.9 })
  );
  scene.add(snow);

  // ---------- tweens ----------
  const tweens = [];
  function tween(obj, props, dur, ease = easeOutCubic, delay = 0, onDone) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      if (tweens[i].obj === obj && Object.keys(props).some((k) => k in tweens[i].props)) tweens.splice(i, 1);
    }
    tweens.push({ obj, props, dur, ease, start: performance.now() + delay, onDone });
    for (const k in props) obj[k] = props[k][0];
  }
  function runTweens(now) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      if (now < tw.start) continue;
      const t = Math.min(1, (now - tw.start) / tw.dur);
      const e = tw.ease(t);
      for (const k in tw.props) {
        const [a, b] = tw.props[k];
        tw.obj[k] = a + (b - a) * e;
      }
      if (t >= 1) {
        tweens.splice(i, 1);
        tw.onDone?.();
      }
    }
  }

  // ---------- poličky ----------
  const shelves = new Map(); // genre -> { genre, group, slotIndex, frame, levels, meshes, label }
  const bookMeshes = new Map(); // book.id -> mesh

  function frameFor(levels, genre) {
    const g = new THREE.Group();
    const h = levels * LEVEL_H + 0.12;
    for (const s of [-1, 1]) {
      const side = box(0.09, h, SHELF_D, M.birch, 0.03);
      side.position.set(s * (SHELF_W / 2), h / 2, 0);
      g.add(side);
    }
    for (let i = 0; i <= levels; i++) {
      const board = box(SHELF_W, 0.07, SHELF_D, M.birch, 0.02);
      board.position.y = i * LEVEL_H + 0.035;
      g.add(board);
    }
    const backPanel = box(SHELF_W, h, 0.04, M.shelfBack, 0.01);
    backPanel.position.set(0, h / 2, -SHELF_D / 2 + 0.02);
    g.add(backPanel);
    g.traverse((o) => {
      if (o.isMesh) o.userData.genre = genre;
    });
    return shadowy(g);
  }

  function disposeTree(obj) {
    obj.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
    });
  }

  function rebuildFrame(shelf, animate) {
    const levels = Math.max(1, Math.ceil(shelf.meshes.length / PER_LEVEL));
    if (shelf.levels === levels) return;
    if (shelf.frame) {
      shelf.group.remove(shelf.frame);
      disposeTree(shelf.frame);
    }
    shelf.frame = frameFor(levels, shelf.genre);
    shelf.group.add(shelf.frame);
    if (animate && shelf.levels) tween(shelf.frame.scale, { y: [0.82, 1] }, 700, easeOutBack);
    shelf.levels = levels;
  }

  function layoutBooks(shelf) {
    let x = -SHELF_W / 2 + 0.14;
    shelf.meshes.forEach((m, i) => {
      if (i % PER_LEVEL === 0) x = -SHELF_W / 2 + 0.14;
      const level = Math.floor(i / PER_LEVEL);
      m.userData.home = new THREE.Vector3(x + m.userData.w / 2, level * LEVEL_H + 0.07 + m.userData.h / 2, 0.02);
      x += m.userData.w + 0.02;
    });
  }

  function createShelf(genre, animate, delay) {
    const used = new Set([...shelves.values()].map((s) => s.slotIndex));
    let slotIndex = 0;
    while (used.has(slotIndex)) slotIndex++;
    const slot = SLOTS[slotIndex % SLOTS.length];
    // Víc žánrů než míst: další poličky se postaví na ty stávající.
    const stack = Math.floor(slotIndex / SLOTS.length);

    const group = new THREE.Group();
    group.position.set(slot.x, 0.3 + stack * 2.4, slot.z);
    group.rotation.y = slot.ry;
    cabin.add(group);

    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'cabin-label';
    label.addEventListener('click', () => onShelfClick?.(genre));
    labelsEl.appendChild(label);

    const shelf = { genre, group, slot, slotIndex, frame: null, levels: 0, meshes: [], label };
    shelves.set(genre, shelf);
    rebuildFrame(shelf, false);
    if (animate) tween(group.scale, { y: [0.001, 1] }, 900, easeOutBack, delay);
    return shelf;
  }

  function removeShelf(shelf) {
    cabin.remove(shelf.group);
    disposeTree(shelf.group);
    shelf.label.remove();
    shelves.delete(shelf.genre);
  }

  function makeBookMesh(book, i) {
    const pages = book.page_count || 300;
    const w = 0.2 + (Math.min(pages, 800) / 800) * 0.16;
    const h = 0.58 + ((i * 37 + (book.title || '').length) % 11) / 80;
    const m = box(w, h, 0.46, bookMat(bookColor(book)), 0.015);
    m.userData = { w, h, genre: null, bookId: book.id };
    return shadowy(m);
  }

  function updateLabel(shelf) {
    shelf.label.innerHTML = '';
    shelf.label.append(shelf.genre);
    const count = document.createElement('span');
    count.textContent = shelf.meshes.length;
    shelf.label.append(count);
    const n = shelf.meshes.length;
    shelf.label.setAttribute('aria-label', `Polička ${shelf.genre}, ${n} ${plural(n, 'kniha', 'knihy', 'knih')}`);
  }

  let initialized = false;

  function setBooks(books) {
    const intro = !initialized;
    initialized = true;
    const groups = groupIntoShelves(books);
    const ids = new Set(books.map((b) => b.id));

    // 1) smazané knihy
    for (const [id, mesh] of bookMeshes) {
      if (ids.has(id)) continue;
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
      bookMeshes.delete(id);
    }
    // 2) prázdné poličky zmizí z mapy
    const genres = new Set(groups.map((g) => g.genre));
    for (const shelf of [...shelves.values()]) {
      if (!genres.has(shelf.genre)) removeShelf(shelf);
    }

    // 3) nové poličky a knihy
    let order = 0;
    groups.forEach(({ genre, books: shelfBooks }, gi) => {
      const shelfDelay = intro ? 400 + gi * 260 : 0;
      let shelf = shelves.get(genre);
      const isNewShelf = !shelf;
      if (isNewShelf) shelf = createShelf(genre, true, shelfDelay);

      const added = [];
      shelf.meshes = shelfBooks.map((book, bi) => {
        let mesh = bookMeshes.get(book.id);
        // kniha mohla změnit žánr — přestěhuje se
        if (mesh && mesh.parent !== shelf.group) {
          mesh.parent?.remove(mesh);
          shelf.group.add(mesh);
        }
        if (!mesh) {
          mesh = makeBookMesh(book, order + bi);
          bookMeshes.set(book.id, mesh);
          shelf.group.add(mesh);
          added.push(mesh);
        }
        mesh.userData.genre = genre;
        return mesh;
      });
      order += shelfBooks.length;

      rebuildFrame(shelf, !intro && !isNewShelf);
      layoutBooks(shelf);

      for (const mesh of shelf.meshes) {
        const home = mesh.userData.home;
        const i = added.indexOf(mesh);
        if (i === -1) {
          // Knihu, která právě padá, nepřerušujeme.
          if (!tweens.some((tw) => tw.obj === mesh.position)) mesh.position.copy(home);
          continue;
        }
        // Kniha spadne shora a poskočí na místo.
        const delay = shelfDelay + (isNewShelf ? 500 : 0) + (intro ? i * 90 : i * 120);
        mesh.position.set(home.x, home.y + 4, home.z);
        tween(mesh.position, { y: [home.y + 4, home.y] }, 900, easeOutBounce, delay);
        tween(mesh.rotation, { z: [(i % 2 ? 1 : -1) * 0.5, 0] }, 700, easeOutCubic, delay);
      }
      updateLabel(shelf);
    });

    if (intro) {
      world.scale.setScalar(0.85);
      tween(world.scale, { x: [0.85, 1], y: [0.85, 1], z: [0.85, 1] }, 1600, easeOutCubic);
    }
  }

  // ---------- kamera ----------
  let camAnim = null;
  function flyTo(pos, target, dur = 1100) {
    camAnim = { fromP: camera.position.clone(), fromT: controls.target.clone(), pos, target, start: performance.now(), dur };
  }
  let resumeTimer = null;
  function focusShelf(genre) {
    const shelf = shelves.get(genre);
    if (!shelf) return;
    clearTimeout(resumeTimer);
    const wp = new THREE.Vector3();
    shelf.group.getWorldPosition(wp);
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(up, shelf.slot.ry);
    // Kamera míří pod poličku, aby zůstala nahoře nad vysunutou 2D poličkou.
    const target = wp.clone().add(new THREE.Vector3(0, -1.6, 0));
    const offset = dir.multiplyScalar(12).add(new THREE.Vector3(0, 7, 0));
    controls.autoRotate = false;
    flyTo(target.clone().add(offset), target);
  }
  function resetView() {
    flyTo(HOME.pos.clone(), HOME.target.clone());
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => (controls.autoRotate = true), 1200);
  }

  // ---------- klik na poličku ----------
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
    const pickables = [];
    for (const s of shelves.values()) s.group.traverse((o) => o.isMesh && pickables.push(o));
    const hit = ray.intersectObjects(pickables, false)[0];
    if (hit?.object.userData.genre) onShelfClick?.(hit.object.userData.genre);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);

  // ---------- velikost ----------
  let width = 0;
  let height = 0;
  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = camera.aspect < 0.8 ? 46 : 28;
    camera.updateProjectionMatrix();
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
    runTweens(now);

    if (camAnim) {
      const t = Math.min(1, (now - camAnim.start) / camAnim.dur);
      const e = 1 - Math.pow(1 - t, 4);
      camera.position.lerpVectors(camAnim.fromP, camAnim.pos, e);
      controls.target.lerpVectors(camAnim.fromT, camAnim.target, e);
      if (t >= 1) camAnim = null;
    }
    controls.update();

    // plápolající oheň a dýchající kočka
    const f = 0.85 + Math.sin(now * 0.011) * 0.08 + Math.sin(now * 0.037) * 0.06 + Math.random() * 0.05;
    fireLight.intensity = 6 * f;
    fire.scale.set(0.8 * f, 1.2 * (2 - f), 1.1);
    catBody.scale.y = 0.65 + Math.sin(now * 0.002) * 0.025;

    const p = snowGeo.attributes.position.array;
    for (let i = 0; i < SNOW; i++) {
      p[i * 3 + 1] -= snowVel[i] * dt;
      p[i * 3] += Math.sin(now * 0.0005 + i) * dt * 0.15;
      if (p[i * 3 + 1] < -1) p[i * 3 + 1] = 18;
    }
    snowGeo.attributes.position.needsUpdate = true;

    // štítky poliček
    for (const s of shelves.values()) {
      s.group.getWorldPosition(v);
      v.y += s.levels * LEVEL_H * s.group.scale.y + 0.75;
      v.project(camera);
      const visible = v.z < 1 && s.group.scale.y > 0.6;
      s.label.style.transform = `translate(${(v.x * 0.5 + 0.5) * width}px, ${(-v.y * 0.5 + 0.5) * height}px) translate(-50%, -100%)`;
      s.label.classList.toggle('is-visible', visible);
    }

    renderer.render(scene, camera);
  });

  function dispose() {
    renderer.setAnimationLoop(null);
    clearTimeout(resumeTimer);
    resizeObserver.disconnect();
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointerup', onUp);
    controls.dispose();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    Object.values(M).forEach((m) => m.dispose());
    bookMaterials.forEach((m) => m.dispose());
    snow.material.dispose();
    snowTexture.dispose();
    renderer.dispose();
    labelsEl.innerHTML = '';
  }

  return { setBooks, focusShelf, resetView, dispose };
}

