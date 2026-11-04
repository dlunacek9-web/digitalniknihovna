/**
 * Lukutupa — 3D chata s knihovnou (Three.js).
 *
 * Imperativní scéna, kterou React komponenta jen „krmí“ knihami:
 *   const scene = createCabinScene({ canvas, labelsEl, onShelfClick });
 *   scene.setBooks(books);        // diff: nové knihy spadnou, prázdné poličky zmizí
 *   scene.focusShelf('Sci-fi');   // kamera přiletí k poličce
 *   scene.focusPoster(el);        // kamera přiletí k plakátu s profilem; el se přilepí na jeho plochu
 *   scene.resetView();
 *   scene.dispose();
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import purrUrl from '../assets/purr.mp3';
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

// Otevřená pravá strana chaty, mezi zadní řadou a poličkami u okraje.
const CITY_ANCHOR = new THREE.Vector3(6.4, 2.3, -2.4);

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

export function createCabinScene({ canvas, labelsEl, cityEl, onShelfClick, onPosterClick, onCatPet, variant = 'cabin' }) {
  // 'library' = veřejná knihovna: stejná mechanika, ostrov i poličky, jiné prostředí a vybavení.
  const LIB = variant === 'library';
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

  scene.add(LIB ? new THREE.HemisphereLight(0xffe9c4, 0x6a5a3c, 1.15) : new THREE.HemisphereLight(0xc7d9ee, 0x4a3628, 0.9));
  const moon = new THREE.DirectionalLight(LIB ? 0xffd9a0 : 0xd6e4ff, LIB ? 2.1 : 1.6);
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
    oakFrame: mat(0x7c5636),
    cat: mat(0x3a3532),
    grass: mat(0x8fa65a, { roughness: 1 }),
    leafA: mat(0xd9792b, { flatShading: true }),
    leafB: mat(0xe3a73a, { flatShading: true }),
    leafC: mat(0xb5532e, { flatShading: true }),
    plaster: mat(0xf1e6cf),
    wainscot: mat(0x4d6b57),
    brick: mat(0xb86a4b, { flatShading: true }),
    counter: mat(0x8a5a38),
    counterTop: mat(0xd9c3a0),
    skin: mat(0xf0c9a6),
    hair: mat(0x6b4a3a),
    cardigan: mat(0x3f6b73),
    brass: mat(0xc9a15a, { metalness: 0.6, roughness: 0.35 }),
    lampGreen: mat(0x2f6b4f, { emissive: 0x1a3d2c, emissiveIntensity: 0.5 }),
    tile1: mat(0xe6d7b8),
    tile2: mat(0xb48a5e)
  };
  if (LIB) {
    M.floor = M.tile1;
    M.wall = M.plaster;
    M.snow = M.grass; // trávník místo sněhu
  }
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
  const at = (mesh, x, y, z) => (mesh.position.set(x, y, z), mesh);
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

  // podzimní strom: kulatá koruna z několika koulí
  function maple(h) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.1 * h, 6), M.trunk);
    trunk.position.y = 0.55 * h;
    g.add(trunk);
    const mats = [M.leafA, M.leafB, M.leafC];
    [[0, 1.7, 0, 0.95], [0.5, 1.4, 0.2, 0.65], [-0.45, 1.5, -0.15, 0.7], [0.1, 2.2, 0.1, 0.6]].forEach(([x, y, z, r], i) => {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(r * h, 1), mats[(i + Math.floor(h * 10)) % 3]);
      crown.position.set(x * h, y * h, z * h);
      g.add(crown);
    });
    return shadowy(g);
  }

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
    const tree = (LIB ? maple : pine)(LIB ? 0.6 + rand() * 0.35 : 0.8 + rand() * 0.6);
    tree.position.set(x, 0, z);
    tree.rotation.y = rand() * 6;
    world.add(tree);
  }

  // ---------- chata (řez jako domeček pro panenky) ----------
  const cabin = new THREE.Group();
  // Chatové vybavení (krb, křeslo, kočka…) se v knihovně nepřidává do scény.
  const homey = LIB ? new THREE.Group() : cabin;
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
  homey.add(fireplace);
  const fireLight = new THREE.PointLight(0xff8a3d, 6, 9, 1.6);
  fireLight.position.set(-4.6, 1.0, 2.2);
  homey.add(fireLight);

  const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.04, 48), M.rug);
  rug.scale.z = 0.7;
  rug.position.set(-2.2, 0.32, 2.6);
  const rugRing = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.04, 6, 48), M.rugRing);
  rugRing.rotation.x = Math.PI / 2;
  rugRing.scale.y = 0.7;
  rugRing.position.set(-2.2, 0.35, 2.6);
  homey.add(rug, rugRing);

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
  for (const [lx, lz] of [[-0.48, 0.4], [0.48, 0.4], [-0.48, -0.4], [0.48, -0.4]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.4, 10), M.oakFrame);
    leg.position.set(lx, 0.2, lz);
    chair.add(leg);
  }
  chair.position.set(-3.3, 0.3, 1.6);
  chair.rotation.y = 0.7;
  homey.add(chair);

  const lamp = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.0, 8), M.black);
  pole.position.y = 1.0;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.06, 20), M.black);
  base.position.y = 0.03;
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 0.45, 24, 1, true), M.shade);
  shade.position.y = 2.05;
  lamp.add(pole, base, shade);
  lamp.position.set(-4.5, 0.3, 0.6);
  homey.add(lamp);
  const lampLight = new THREE.PointLight(0xffc98a, 7, 8, 1.4);
  lampLight.position.set(-4.5, 2.0, 0.6);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(512, 512);
  homey.add(lampLight);

  // stolek vedle křesla s hromádkou tří knih
  const table = new THREE.Group();
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.06, 32), M.oakFrame);
  tableTop.position.y = 0.78;
  table.add(tableTop);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.78, 8), M.oakFrame);
    leg.position.set(Math.cos(a) * 0.32, 0.39, Math.sin(a) * 0.32);
    table.add(leg);
  }
  [[0xa8443a, 0.52, 0.14, 0.38, 0.1], [0x3d5c4c, 0.46, 0.12, 0.34, -0.18], [0xc08a3e, 0.4, 0.1, 0.3, 0.25]].reduce((y, [color, w, h, d, rot]) => {
    const book = box(w, h, d, bookMat(color), 0.015);
    book.position.y = y + h / 2;
    book.rotation.y = rot;
    table.add(book);
    return y + h;
  }, 0.81);
  table.position.set(-2.1, 0.3, 0.5);
  homey.add(shadowy(table));

  // kočka: torso (tělo, hlava, ocas) + čtyři nohy; pose se plynule míchá mezi „leží“ a „stojí“
  const cat = new THREE.Group();
  const torso = new THREE.Group();
  const catBody = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), M.cat);
  catBody.scale.set(1.3, 0.65, 0.9);
  const catHead = new THREE.Group();
  catHead.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), M.cat));
  for (const z of [-0.08, 0.1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), M.cat);
    ear.position.set(0.02, 0.17, z);
    catHead.add(ear);
  }
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 6, 16, Math.PI), M.cat);
  tail.rotation.x = Math.PI / 2;
  tail.position.set(-0.1, -0.1, 0);
  torso.add(catBody, catHead, tail);
  const CAT_LEG = 0.3;
  const catLegs = [[0.22, 0.12], [0.22, -0.12], [-0.2, 0.12], [-0.2, -0.12]].map(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, CAT_LEG, 8).translate(0, -CAT_LEG / 2, 0), M.cat);
    leg.position.x = lx;
    leg.position.z = lz;
    cat.add(leg);
    return leg;
  });
  const catHit = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), M.cat);
  catHit.position.y = 0.25;
  catHit.visible = false;
  catHit.userData.cat = true;
  cat.add(torso, catHit);
  cat.position.set(-1.7, 0.34, 2.8);
  cat.rotation.y = -0.4;
  homey.add(cat);

  // kočičí příběh po kliknutí: zvednout se, protáhnout, vrnět, znovu si lehnout
  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  let catAnim = null; // { start, purr }
  const purrSound = new Audio(purrUrl);
  purrSound.volume = 0.8;
  function purr() {
    purrSound.currentTime = 0;
    purrSound.play().catch(() => {});
  }
  function petCat(now) {
    if (catAnim) return;
    catAnim = { start: now, purred: false };
    onCatPet?.();
  }
  // časová osa (s): 0–0.9 vstává, 0.9–2.4 protažení, 2.4–6.4 vrní, 6.4–7.6 líhá
  function updateCat(now) {
    let stand = 0;
    let bow = 0;
    let purring = 0;
    if (catAnim) {
      const t = (now - catAnim.start) / 1000;
      stand = t < 6.4 ? smooth(clamp01(t / 0.9)) : 1 - smooth(clamp01((t - 6.4) / 1.2));
      bow = Math.sin(clamp01((t - 0.9) / 1.5) * Math.PI);
      purring = t > 2.4 && t < 6.4 ? 1 : 0;
      if (!catAnim.purred && t > 0.9) {
        catAnim.purred = true;
        purr();
      }
      if (t > 7.6) catAnim = null;
    }
    const bodyY = 0.14 + 0.22 * stand;
    const breathe = Math.sin(now * 0.002) * 0.025 * (1 - stand * 0.5);
    torso.position.y = bodyY;
    torso.rotation.z = -0.42 * bow;
    catBody.scale.y = 0.65 + breathe;
    catHead.position.set(0.38 + 0.04 * stand, 0.05 + 0.2 * stand - 0.1 * bow, 0.05 - 0.05 * (1 - stand));
    catHead.rotation.z = 0.25 * bow - 0.15 * (1 - stand);
    tail.rotation.y = purring * Math.sin(now * 0.008) * 0.5;
    tail.position.y = -0.1 + 0.25 * stand;
    for (const [i, leg] of catLegs.entries()) {
      leg.position.y = bodyY - 0.05;
      // při protažení jdou přední tlapky dolů a zadek nahoru
      leg.scale.y = Math.max(0.05, (bodyY - 0.05) / CAT_LEG * (i < 2 ? 1 - 0.25 * bow : 1));
    }
    if (purring) catBody.position.y = Math.sin(now * 0.15) * 0.004;
    else catBody.position.y = 0;
  }

  // ---------- nástěnka s profilem (na stěně vedle krbu) ----------
  // POSTER = korková plocha; HTML panel se přilepí přesně na ni.
  const POSTER = { w: 1.8, h: 2.3 };
  const FRAME = 0.1;
  const posterTex = (() => {
    const W = 360;
    const H = 460;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#b98a5a';
    g.fillRect(0, 0, W, H);
    let sd = 11;
    const r = () => ((sd = (sd * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(90,55,25,0.22)' : 'rgba(240,205,150,0.25)';
      g.beginPath();
      g.arc(r() * W, r() * H, 0.8 + r() * 2.2, 0, 7);
      g.fill();
    }
    const note = (x, y, w, h, rot, lines, title) => {
      g.save();
      g.translate(x + w / 2, y + h / 2);
      g.rotate(rot);
      g.shadowColor = 'rgba(40,20,5,0.4)';
      g.shadowBlur = 8;
      g.shadowOffsetY = 3;
      g.fillStyle = '#fffbee';
      g.fillRect(-w / 2, -h / 2, w, h);
      g.shadowColor = 'transparent';
      g.fillStyle = '#4a4640';
      g.font = '700 30px Caveat, cursive';
      g.textAlign = 'left';
      if (title) g.fillText(title, -w / 2 + 12, -h / 2 + 34);
      g.fillStyle = 'rgba(74,70,64,0.55)';
      for (let i = 0; i < lines; i++) g.fillRect(-w / 2 + 12, -h / 2 + (title ? 54 : 22) + i * 20, w - 24 - (i % 2) * 40, 3);
      g.fillStyle = '#d4503a';
      g.beginPath();
      g.arc(0, -h / 2 + 8, 7, 0, 7);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath();
      g.arc(-2, -h / 2 + 6, 2.2, 0, 7);
      g.fill();
      g.restore();
    };
    note(34, 34, 292, 100, -0.03, 2, 'Profil');
    note(30, 170, 140, 110, 0.04, 3, '');
    note(190, 160, 140, 130, -0.05, 4, '');
    note(40, 320, 280, 100, 0.02, 3, '');
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  })();
  const poster = new THREE.Group();
  const posterBoard = box(POSTER.w + FRAME * 2, POSTER.h + FRAME * 2, 0.08, M.oakFrame, 0.03);
  const posterPaper = new THREE.Mesh(
    new THREE.PlaneGeometry(POSTER.w, POSTER.h),
    new THREE.MeshStandardMaterial({ map: posterTex, roughness: 1, emissive: 0x3a2a18, emissiveMap: posterTex, emissiveIntensity: 0.45 })
  );
  posterPaper.position.z = 0.042;
  posterPaper.userData.poster = true;
  posterBoard.userData.poster = true;
  poster.add(posterBoard, posterPaper);
  poster.position.set(-5.84, 1.6, 4.15);
  poster.rotation.y = Math.PI / 2;
  homey.add(poster);

  // ---------- vybavení veřejné knihovny ----------
  // Výdejní pult s knihovnicí u levé stěny, čtecí kout, vozík s vrácenými knihami.
  let librarian = null;
  const ARM_REST = 0.85;
  const libraryAnim = { wave: 0, arm: null, head: null, stamp: null };
  if (LIB) {
    // šachovnicová dlažba
    const tiles = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d');
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        g.fillStyle = (x + y) % 2 ? '#e6d7b8' : '#c9ab7e';
        g.fillRect(x * 32, y * 32, 32, 32);
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(6, 5);
      return t;
    })();
    floor.material = new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.7 });

    // zelený lambris na stěnách
    const wainBack = box(12.4, 0.9, 0.34, M.wainscot, 0.04);
    wainBack.position.set(0, 0.75, -5.05);
    const wainLeft = box(0.34, 0.9, 10.4, M.wainscot, 0.04);
    wainLeft.position.set(-6.05, 0.75, 0);
    cabin.add(wainBack, wainLeft);

    // velké kulaté hodiny nad pultem (číselník míří do místnosti, k +x)
    const clock = new THREE.Group();
    const clockRim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 32), M.brass);
    const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.1, 32), M.blanket);
    clockRim.rotation.z = clockFace.rotation.z = Math.PI / 2;
    clockFace.position.x = 0.01;
    const hands = new THREE.Group();
    hands.position.x = 0.07;
    const hourHand = box(0.02, 0.2, 0.03, M.black, 0.005);
    hourHand.position.y = 0.1;
    const minHand = box(0.02, 0.3, 0.025, M.black, 0.005);
    minHand.position.set(0.012, 0.15, 0);
    hands.add(hourHand, minHand);
    clock.add(clockRim, clockFace, hands);
    clock.position.set(-5.84, 2.15, 1.2);
    cabin.add(shadowy(clock));
    libraryAnim.hands = hands;

    // nástěnka s pravidly (místo korkového profilu)
    const board = box(0.08, 1.2, 1.5, M.oakFrame, 0.03);
    board.position.set(-5.88, 1.7, 4.0);
    const noteTex = (() => {
      const c = document.createElement('canvas');
      c.width = 300;
      c.height = 240;
      const g = c.getContext('2d');
      g.fillStyle = '#d9b98a';
      g.fillRect(0, 0, 300, 240);
      [[20, 20, '#fffbee', -0.04], [160, 30, '#cfe6d2', 0.05], [30, 130, '#fbe3b4', 0.03], [165, 125, '#fffbee', -0.03]].forEach(([x, y, col, r]) => {
        g.save();
        g.translate(x + 55, y + 45);
        g.rotate(r);
        g.fillStyle = col;
        g.fillRect(-55, -45, 110, 90);
        g.fillStyle = 'rgba(60,50,40,0.5)';
        for (let i = 0; i < 4; i++) g.fillRect(-45, -28 + i * 16, 90 - (i % 2) * 24, 3);
        g.fillStyle = '#c0392b';
        g.beginPath();
        g.arc(0, -42, 6, 0, 7);
        g.fill();
        g.restore();
      });
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const notes = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 1.06), new THREE.MeshStandardMaterial({ map: noteTex, roughness: 1 }));
    notes.position.set(-5.83, 1.7, 4.0);
    notes.rotation.y = Math.PI / 2;
    cabin.add(shadowy(board), notes);

    // ---- výpůjční pult (podélně se stěnou, čtenář stojí z pravé strany) ----
    const counter = new THREE.Group();
    const cBody = box(0.9, 1.05, 3.4, M.counter, 0.05);
    cBody.position.y = 0.52;
    const cTop = box(1.15, 0.1, 3.65, M.counterTop, 0.04);
    cTop.position.y = 1.08;
    counter.add(cBody, cTop);
    for (let i = 0; i < 4; i++) {
      const panel = box(0.04, 0.7, 0.62, M.oakFrame, 0.015);
      panel.position.set(0.47, 0.5, -1.3 + i * 0.87);
      counter.add(panel);
    }
    // lampa, razítko, zvonek, kartotéka, monitor
    const dlamp = new THREE.Group();
    dlamp.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.04, 16), M.brass), 0, 0.02, 0));
    dlamp.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), M.brass), 0, 0.27, 0));
    const dshade = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.lampGreen);
    dshade.position.y = 0.55;
    dlamp.add(dshade);
    dlamp.position.set(0.05, 1.13, 1.2);
    counter.add(dlamp);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.brass);
    bell.position.set(0.25, 1.13, 0.2);
    counter.add(bell);
    const stamp = new THREE.Group();
    const stampBase = box(0.14, 0.05, 0.22, M.black, 0.01);
    const stampKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 8), M.oakFrame);
    stampKnob.position.y = 0.08;
    stamp.add(stampBase, stampKnob);
    stamp.position.set(0.1, 1.16, -0.5);
    counter.add(stamp);
    libraryAnim.stamp = stamp;
    const monitor = box(0.06, 0.4, 0.55, M.black, 0.02);
    monitor.position.set(-0.3, 1.5, -1.0);
    monitor.rotation.y = 0.25;
    const screenGlow = box(0.02, 0.34, 0.48, mat(0x9fd8c2, { emissive: 0x4fa68a, emissiveIntensity: 1 }), 0.01);
    screenGlow.position.set(-0.26, 1.5, -1.0);
    screenGlow.rotation.y = 0.25;
    counter.add(monitor, screenGlow);
    const cardBox = box(0.4, 0.35, 0.5, M.oakFrame, 0.03);
    cardBox.position.set(0.05, 1.3, -1.45);
    counter.add(cardBox);
    // stoh vrácených knih na pultu
    [[0x3e5c76, 0.4, 0.09], [0xa8443a, 0.36, 0.07], [0xc9973f, 0.38, 0.08], [0x5e6b4a, 0.34, 0.07]].reduce((y, [color, w, h], i) => {
      const bk = box(w, h, 0.28, bookMat(color), 0.012);
      bk.position.set(0.3, y + h / 2, 1.0);
      bk.rotation.y = (i % 2 ? 1 : -1) * 0.18;
      counter.add(bk);
      return y + h;
    }, 1.13);
    // cedulka „Výpůjčka“
    const signTex = (() => {
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 100;
      const g = c.getContext('2d');
      g.fillStyle = '#fffbee';
      g.fillRect(0, 0, 320, 100);
      g.strokeStyle = '#2f6b4f';
      g.lineWidth = 6;
      g.strokeRect(5, 5, 310, 90);
      g.fillStyle = '#2f6b4f';
      g.font = '700 46px Fraunces, Georgia, serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('Výpůjčka', 160, 52);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.28), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.9 }));
    sign.position.set(0.1, 1.55, 0.5);
    sign.rotation.set(0, Math.PI / 2, 0);
    const signStand = box(0.04, 0.3, 0.04, M.brass, 0.01);
    signStand.position.set(0.1, 1.38, 0.5);
    counter.add(sign, signStand);
    counter.position.set(-4.0, 0.3, 2.0);
    cabin.add(shadowy(counter));

    const deskLight = new THREE.PointLight(0xffd79a, 5, 7, 1.5);
    deskLight.position.set(-3.8, 2.0, 3.2);
    cabin.add(deskLight);

    // ---- knihovnice za pultem, otočená do místnosti ----
    librarian = new THREE.Group();
    const torsoL = box(0.5, 0.95, 0.7, M.cardigan, 0.18);
    torsoL.position.y = 1.25;
    const collar = box(0.38, 0.12, 0.5, M.blanket, 0.05);
    collar.position.y = 1.68;
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.8, 16), M.oakFrame);
    skirt.position.y = 0.4;
    const headL = new THREE.Group();
    headL.position.y = 2.0;
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 16), M.skin);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.29, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), M.hair);
    hair.position.set(-0.03, 0.03, 0);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), M.hair);
    bun.position.set(-0.18, 0.3, 0);
    headL.add(face, hair, bun);
    for (const z of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), M.black);
      eye.position.set(0.25, 0.04, z);
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.01, 6, 16), M.brass);
      lens.position.set(0.26, 0.04, z);
      lens.rotation.y = Math.PI / 2;
      headL.add(eye, lens);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 4, 12, Math.PI), mat(0xb5524a));
    mouth.position.set(0.26, -0.1, 0);
    mouth.rotation.set(0, Math.PI / 2, Math.PI);
    headL.add(mouth);
    // paže: ramena u těla, ruce opřené o pult; pravá (u razítka) se zvedá
    const mkArm = (z) => {
      const arm = new THREE.Group();
      arm.position.set(0.05, 1.6, z);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.55, 8).translate(0, -0.27, 0), M.cardigan);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), M.skin);
      hand.position.y = -0.58;
      arm.add(upper, hand);
      arm.rotation.z = ARM_REST; // dopředu k pultu
      return arm;
    };
    const armL = mkArm(-0.38);
    const armR = mkArm(0.38);
    libraryAnim.arm = armR;
    libraryAnim.head = headL;
    // cedulka se jménem
    const tag = box(0.02, 0.1, 0.2, M.blanket, 0.005);
    tag.position.set(0.26, 1.5, -0.18);
    librarian.add(torsoL, collar, skirt, headL, armL, armR, tag);
    librarian.position.set(-4.95, 0.3, 2.0);
    librarian.rotation.y = 0; // obličej k +x, směrem do místnosti
    const hitL = new THREE.Mesh(new THREE.BoxGeometry(1, 2.4, 1), M.cat);
    hitL.position.y = 1.2;
    hitL.visible = false;
    hitL.userData.librarian = true;
    librarian.add(hitL);
    cabin.add(shadowy(librarian));
    libraryAnim.hit = hitL;

    // ---- čtecí kout ----
    const rtable = new THREE.Group();
    const rtop = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.08, 36), M.counterTop);
    rtop.position.y = 0.82;
    const rleg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.8, 10), M.oakFrame);
    rleg.position.y = 0.4;
    const rfoot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.06, 20), M.oakFrame);
    rfoot.position.y = 0.03;
    rtable.add(rtop, rleg, rfoot);
    const rlamp = at(new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.lampGreen), 0, 1.2, 0);
    const rlampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.34, 6), M.brass);
    rlampPole.position.y = 1.02;
    rtable.add(rlamp, rlampPole);
    [[0xa8443a, 0.5, 0.12, 0.36, 0.3], [0x3e5c76, 0.44, 0.1, 0.32, -0.2]].reduce((y, [color, w, h, d, rot]) => {
      const bk = box(w, h, d, bookMat(color), 0.012);
      bk.position.set(0.35, y + h / 2, 0.25);
      bk.rotation.y = rot;
      rtable.add(bk);
      return y + h;
    }, 0.86);
    rtable.position.set(-1.6, 0.3, 3.4);
    cabin.add(shadowy(rtable));
    for (const [cx, cz, ry] of [[-2.7, 3.5, Math.PI / 2 - 0.2], [-0.5, 3.3, -Math.PI / 2 + 0.3]]) {
      const stool = new THREE.Group();
      const seatS = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 20), M.chair);
      seatS.position.y = 0.55;
      stool.add(seatS);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.55, 6), M.oakFrame);
        leg.position.set(Math.cos(a) * 0.18, 0.27, Math.sin(a) * 0.18);
        stool.add(leg);
      }
      stool.position.set(cx, 0.3, cz);
      stool.rotation.y = ry;
      cabin.add(shadowy(stool));
    }
    // zelený kulatý koberec pod stolem
    const lrug = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.04, 40), M.wainscot);
    lrug.scale.z = 0.8;
    lrug.position.set(-1.6, 0.32, 3.4);
    cabin.add(lrug);

    // vozík s vrácenými knihami
    const cart = new THREE.Group();
    const cartBase = box(1.0, 0.06, 0.55, M.oakFrame, 0.02);
    cartBase.position.y = 0.3;
    const cartTop = box(1.0, 0.06, 0.55, M.oakFrame, 0.02);
    cartTop.position.y = 0.85;
    cart.add(cartBase, cartTop);
    for (const [wx, wz] of [[-0.45, -0.22], [0.45, -0.22], [-0.45, 0.22], [0.45, 0.22]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6), M.brass);
      post.position.set(wx, 0.6, wz);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12), M.black);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.1, wz);
      cart.add(post, wheel);
    }
    [[0x5e6b4a, 0.0], [0xc9973f, 0.34], [0x3e5c76, 0.68]].forEach(([color, ox], i) => {
      const bk = box(0.26, 0.4, 0.34, bookMat(color), 0.012);
      bk.position.set(-0.36 + ox, 1.08, 0);
      bk.rotation.z = i === 2 ? 0.15 : 0;
      cart.add(bk);
    });
    [[0xa8443a, -0.3], [0x6b4d5e, -0.02], [0xe9dcc3, 0.26]].forEach(([color, ox]) => {
      const bk = box(0.22, 0.32, 0.3, bookMat(color), 0.012);
      bk.position.set(ox, 0.51, 0);
      cart.add(bk);
    });
    cart.position.set(-2.0, 0.3, 0.6);
    cart.rotation.y = 0.35;
    cabin.add(shadowy(cart));

    // globus ve výklenku u vstupu
    const globe = new THREE.Group();
    const gStand = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.9, 12), M.oakFrame);
    gStand.position.y = 0.45;
    const gBall = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), mat(0x6fa3c7, { emissive: 0x1d3a52, emissiveIntensity: 0.5 }));
    gBall.position.y = 1.35;
    const gLand = new THREE.Mesh(new THREE.IcosahedronGeometry(0.43, 1), mat(0xb5a05a, { flatShading: true }));
    gLand.position.y = 1.35;
    gLand.scale.set(1, 0.72, 1);
    globe.add(gStand, gBall, gLand);
    globe.position.set(-5.2, 0.3, -3.6);
    cabin.add(shadowy(globe));

    // rostlina v květináči
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.4, 12), M.brick);
    pot.position.set(-5.5, 0.5, 0.0);
    const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), M.pine2);
    plant.position.set(-5.5, 1.05, 0.0);
    plant.scale.set(1, 1.25, 1);
    cabin.add(shadowy(pot), shadowy(plant));

    // závěsná cedule s nápisem nad vchodem (před ostrovem)
    const bigSignTex = (() => {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#2f6b4f';
      g.fillRect(0, 0, 512, 128);
      g.strokeStyle = '#e9dcc3';
      g.lineWidth = 6;
      g.strokeRect(8, 8, 496, 112);
      g.fillStyle = '#f6efe4';
      g.font = '600 68px Fraunces, Georgia, serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('KNIHOVNA', 256, 68);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const bigSign = new THREE.Group();
    const bsPanel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.8, 0.12), new THREE.MeshStandardMaterial({ map: bigSignTex, roughness: 0.8 }));
    bsPanel.position.y = 2.7;
    for (const sx of [-1.45, 1.45]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.7, 8), M.oakFrame);
      post.position.set(sx, 1.35, 0);
      bigSign.add(post);
    }
    bigSign.add(bsPanel);
    bigSign.position.set(-3.6, 0.3, 5.5);
    cabin.add(shadowy(bigSign));

    // lucerny na ostrově
    for (const [lx, lz] of [[-6.8, 5.6], [6.6, 5.4]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.0, 8), M.black);
      post.position.set(lx, 1.0, lz);
      const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.34), M.shade);
      lantern.position.set(lx, 2.2, lz);
      world.add(post, lantern);
    }
  }

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
  if (LIB) {
    snow.material.color.set(0xe0902f);
    snow.material.size = 0.3;
    for (let i = 0; i < SNOW; i++) snowVel[i] *= 0.6;
  }
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


  // knihovnice: občas orazítkuje, pootočí hlavu, po kliknutí kývne a mávne
  function updateLibrarian(now) {
    const { arm, head, stamp } = libraryAnim;
    const cycle = (now % 9000) / 9000;
    const stampPhase = cycle > 0.55 && cycle < 0.7 ? Math.sin(((cycle - 0.55) / 0.15) * Math.PI) : 0;
    const w = libraryAnim.wave ? (now - libraryAnim.wave) / 1600 : 2;
    const waving = w >= 0 && w < 1 ? Math.sin(w * Math.PI) : 0;
    arm.rotation.z = ARM_REST + stampPhase * 0.2 + waving * 1.9;
    arm.rotation.x = waving * Math.sin(now * 0.02) * 0.35;
    stamp.position.y = 1.16 - stampPhase * 0.02;
    head.rotation.y = Math.sin(now * 0.0006) * 0.35 + waving * 0.15;
    head.rotation.z = Math.sin(now * 0.0011) * 0.04 - waving * 0.1;
    libraryAnim.hands.rotation.x = -(now / 60000) * Math.PI * 2;
  }

  // ---------- kamera ----------
  let camAnim = null;
  let posterEl = null;
  const restoreControls = () => {
    controls.enabled = true;
    controls.minDistance = LIMITS.minDistance;
    controls.minPolarAngle = LIMITS.minPolar;
    controls.maxPolarAngle = LIMITS.maxPolar;
  };
  function flyTo(pos, target, dur = 1100) {
    camAnim = { fromP: camera.position.clone(), fromT: controls.target.clone(), pos, target, start: performance.now(), dur };
  }
  let resumeTimer = null;
  function focusShelf(genre) {
    const shelf = shelves.get(genre);
    if (!shelf) return;
    clearTimeout(resumeTimer);
    purrSound.pause();
    const wp = new THREE.Vector3();
    shelf.group.getWorldPosition(wp);
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(up, shelf.slot.ry);
    // Kamera míří pod poličku, aby zůstala nahoře nad vysunutou 2D poličkou.
    const target = wp.clone().add(new THREE.Vector3(0, -1.6, 0));
    const offset = dir.multiplyScalar(12).add(new THREE.Vector3(0, 7, 0));
    if (posterEl) {
      posterEl.classList.remove('is-ready');
      posterEl = null;
    }
    restoreControls();
    controls.autoRotate = false;
    flyTo(target.clone().add(offset), target);
  }
  // Kamera přiletí těsně před plakát; HTML panel `el` se pak v každém snímku
  // přilepí na jeho promítnutou plochu.
  const LIMITS = { minDistance: controls.minDistance, maxPolar: controls.maxPolarAngle, minPolar: controls.minPolarAngle };
  function focusPoster(el) {
    clearTimeout(resumeTimer);
    posterEl = el;
    posterEl?.classList.remove('is-ready');
    scene.updateMatrixWorld(true);
    const center = new THREE.Vector3();
    const q = new THREE.Quaternion();
    posterPaper.getWorldPosition(center);
    posterPaper.getWorldQuaternion(q);
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    // Kolmo na plochu, aby se HTML panel přesně kryl s korkem.
    const dir = n.normalize();
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const sc = world.scale.x;
    const dist = Math.max(((POSTER.h + 0.3) * sc) / (0.9 * 2 * tan), ((POSTER.w + 0.3) * sc) / (0.94 * camera.aspect * 2 * tan));
    controls.autoRotate = false;
    controls.enabled = false;
    controls.minDistance = 1;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    flyTo(center.clone().addScaledVector(dir, dist), center, 1300);
    camAnim.onDone = () => posterEl?.classList.add('is-ready');
  }
  // Kamera vlétne do bubliny; kotva bubliny skončí uprostřed obrazovky.
  function flyToCity() {
    clearTimeout(resumeTimer);
    scene.updateMatrixWorld(true);
    const target = CITY_ANCHOR.clone().applyMatrix4(world.matrixWorld);
    const dir = camera.position.clone().sub(target).normalize();
    controls.autoRotate = false;
    controls.enabled = false;
    controls.minDistance = 0.5;
    flyTo(target.clone().addScaledVector(dir, 2.2), target, 1100);
  }
  function resetView() {
    if (posterEl) {
      posterEl.classList.remove('is-ready');
      posterEl = null;
    }
    flyTo(HOME.pos.clone(), HOME.target.clone());
    camAnim.onDone = restoreControls;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => (controls.autoRotate = true), 1200);
  }

  const corner = new THREE.Vector3();
  function placePoster() {
    if (!posterEl || !width) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      corner.set((sx * POSTER.w) / 2, (sy * POSTER.h) / 2, 0);
      posterPaper.localToWorld(corner).project(camera);
      const px = (corner.x * 0.5 + 0.5) * width;
      const py = (-corner.y * 0.5 + 0.5) * height;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px);
      y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    posterEl.style.transform = `translate(${x0}px, ${y0}px)`;
    posterEl.style.width = `${x1 - x0}px`;
    posterEl.style.height = `${y1 - y0}px`;
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
    if (LIB) pickables.push(libraryAnim.hit);
    else pickables.push(posterBoard, posterPaper, catHit);
    const hit = ray.intersectObjects(pickables, false)[0];
    if (hit?.object.userData.librarian) libraryAnim.wave = performance.now();
    else if (hit?.object.userData.cat) petCat(performance.now());
    else if (hit?.object.userData.poster) onPosterClick?.();
    else if (hit?.object.userData.genre) onShelfClick?.(hit.object.userData.genre);
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
      if (t >= 1) {
        const done = camAnim.onDone;
        camAnim = null;
        done?.();
      }
    }
    controls.update();
    placePoster();

    // plápolající oheň a dýchající kočka
    const f = 0.85 + Math.sin(now * 0.011) * 0.08 + Math.sin(now * 0.037) * 0.06 + Math.random() * 0.05;
    fireLight.intensity = 6 * f;
    fire.scale.set(0.8 * f, 1.2 * (2 - f), 1.1);
    updateCat(now);
    if (LIB) updateLibrarian(now);

    const p = snowGeo.attributes.position.array;
    for (let i = 0; i < SNOW; i++) {
      p[i * 3 + 1] -= snowVel[i] * dt;
      p[i * 3] += Math.sin(now * 0.0005 + i) * dt * 0.15;
      if (p[i * 3 + 1] < -1) p[i * 3 + 1] = 18;
    }
    snowGeo.attributes.position.needsUpdate = true;

    // bublina do městské knihovny, vznášející se na otevřené straně chaty
    if (cityEl) {
      v.copy(CITY_ANCHOR);
      v.y += Math.sin(now * 0.0015) * 0.12;
      v.applyMatrix4(world.matrixWorld).project(camera);
      cityEl.style.transform = `translate(${(v.x * 0.5 + 0.5) * width}px, ${(-v.y * 0.5 + 0.5) * height}px) translate(-50%, -50%)`;
      cityEl.classList.toggle('is-visible', v.z < 1 && world.scale.x > 0.95);
    }

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
    posterTex.dispose();
    renderer.dispose();
    labelsEl.innerHTML = '';
  }

  // Poloha kočky / nástěnky na obrazovce (px) pro bublinky tutoriálu.
  const anchorPoint = new THREE.Vector3();
  function screenAnchor(name) {
    const target = name === 'cat' ? cat : poster;
    target.getWorldPosition(anchorPoint);
    if (name === 'cat') anchorPoint.y += 0.3;
    anchorPoint.project(camera);
    if (anchorPoint.z > 1) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + ((anchorPoint.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - anchorPoint.y) / 2) * rect.height
    };
  }

  return { screenAnchor, setBooks, focusShelf, focusPoster, flyToCity, resetView, dispose };
}

