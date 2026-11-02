/**
 * Městská knihovna — tajemná nekonečná hala (Three.js).
 *
 * Návštěvník stojí uprostřed chodby ve výšce očí a nemůže se otáčet; kamera jen
 * lehce sleduje myš. Před ním stojí pultík (lectern), na který přiletí vybraná kniha.
 *
 *   const city = createCityScene({ canvas, onLook });
 *   await city.summonBook(book);          // kniha přiletí z regálů na pultík
 *   await city.dismissBook('library');    // odletí zpět do regálů
 *   await city.dismissBook('home');       // odletí dolů, ke mně domů
 *   city.dispose();
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { bookColor } from '../services/genres';

const HALL_HALF_W = 6;
const HALL_LEN = 80;
const BAY = 1.5;
const LEVELS = 7;
const LEVEL_H = 0.95;
const BASE_PITCH = -0.16;
const MAX_YAW = 0.11;
const MAX_PITCH = 0.07;

const BOOK_SIZE = { w: 0.52, h: 0.74, d: 0.085 };
const LECTERN = { x: 0, z: -1.6, topY: 1.12, tilt: 0.7 };

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeInCubic = (t) => t * t * t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));

const SPINES = [0x5a1a1f, 0x3c2a1a, 0x1f3b34, 0x2a2748, 0x6b4a22, 0x4a1d2e, 0x2b3a28, 0x5b3a29, 0x23324a, 0x6a5a34, 0x3a1f14, 0x44412f];

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,214,150,1)');
  grad.addColorStop(0.25, 'rgba(255,170,80,0.55)');
  grad.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function wrapText(g, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Obálka vykreslená do plátna — použije se, dokud (nebo pokud) se nenačte skutečná. */
function makeCoverTexture(book) {
  const W = 512;
  const H = 740;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const color = bookColor(book);
  g.fillStyle = color;
  g.fillRect(0, 0, W, H);
  const shade = g.createLinearGradient(0, 0, W, 0);
  shade.addColorStop(0, 'rgba(0,0,0,0.38)');
  shade.addColorStop(0.08, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = shade;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(232,200,130,0.8)';
  g.lineWidth = 4;
  g.strokeRect(34, 34, W - 68, H - 68);
  g.lineWidth = 1.5;
  g.strokeRect(46, 46, W - 92, H - 92);

  g.textAlign = 'center';
  g.fillStyle = '#f3e3bd';
  g.font = '600 26px Manrope, sans-serif';
  const author = String(book.authors || '').toUpperCase();
  wrapText(g, author, W - 150).slice(0, 2).forEach((l, i) => g.fillText(l, W / 2, 110 + i * 34));

  g.beginPath();
  g.arc(W / 2, H / 2 + 10, 62, 0, Math.PI * 2);
  g.globalAlpha = 0.55;
  g.strokeStyle = '#e8c882';
  g.lineWidth = 3;
  g.stroke();
  g.globalAlpha = 1;

  g.font = '600 44px Fraunces, Georgia, serif';
  const lines = wrapText(g, book.title || '', W - 130).slice(0, 5);
  const start = H - 210 - (lines.length - 1) * 26;
  lines.forEach((l, i) => g.fillText(l, W / 2, start + i * 52));

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function createCityScene({ canvas, onLook, onIntroDone }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const FOG = 0x07060b;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.FogExp2(FOG, 0.028);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 160);
  camera.rotation.order = 'YXZ';
  camera.position.set(0, 1.65, 0);

  scene.add(new THREE.HemisphereLight(0x8a88c8, 0x3a2418, 1.5));

  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...extra });
  const wood = mat(0x2c1b11, { roughness: 0.65 });
  const woodLight = mat(0x4a2f1c, { roughness: 0.6 });
  const stone = mat(0x1d1a22, { roughness: 0.9 });

  let seed = 13;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  // ---------- podlaha a koberec ----------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL_HALF_W * 2, HALL_LEN + 20), mat(0x24160e, { roughness: 0.42, metalness: 0.15 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -HALL_LEN / 2 + 8;
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(3.4, HALL_LEN + 20), mat(0x4a121a, { roughness: 0.95 }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, 0.012, -HALL_LEN / 2 + 8);
  scene.add(floor, carpet);
  for (const s of [-1, 1]) {
    const trim = new THREE.Mesh(new THREE.PlaneGeometry(0.1, HALL_LEN + 20), mat(0xb08a42, { roughness: 0.5, metalness: 0.4 }));
    trim.rotation.x = -Math.PI / 2;
    trim.position.set(s * 1.55, 0.014, -HALL_LEN / 2 + 8);
    scene.add(trim);
  }

  // ---------- regály s knihami (instancované) ----------
  const zStart = 4;
  const bays = Math.ceil((HALL_LEN + zStart) / BAY);
  const shelfH = LEVELS * LEVEL_H;
  const wallX = HALL_HALF_W - 0.1;

  for (const s of [-1, 1]) {
    const back = new THREE.Mesh(new THREE.PlaneGeometry(HALL_LEN + 20, shelfH + 0.4), mat(0x150d08, { roughness: 1 }));
    back.rotation.y = -s * Math.PI / 2;
    back.position.set(s * wallX, shelfH / 2, -HALL_LEN / 2 + 8);
    scene.add(back);

    for (let l = 0; l <= LEVELS; l++) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.07, HALL_LEN + 20), woodLight);
      board.position.set(s * (wallX - 0.28), l * LEVEL_H, -HALL_LEN / 2 + 8);
      scene.add(board);
    }
  }

  const dividerGeo = new THREE.BoxGeometry(0.58, shelfH + 0.07, 0.07);
  const dividers = new THREE.InstancedMesh(dividerGeo, wood, bays * 2);
  const bookGeo = new THREE.BoxGeometry(1, 1, 1);
  const maxBooks = bays * LEVELS * 2 * 20;
  const books = new THREE.InstancedMesh(bookGeo, mat(0xffffff, { roughness: 0.75 }), maxBooks);
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  let bookCount = 0;
  let divCount = 0;
  for (const s of [-1, 1]) {
    for (let b = 0; b < bays; b++) {
      const z0 = zStart - b * BAY;
      m4.makeTranslation(s * (wallX - 0.28), shelfH / 2, z0);
      dividers.setMatrixAt(divCount++, m4);
      for (let l = 0; l < LEVELS; l++) {
        let z = z0 - 0.06;
        const end = z0 - BAY + 0.06;
        const y0 = l * LEVEL_H + 0.035;
        // občas prázdné místo na polici
        const gap = rand() < 0.08 ? 0.3 + rand() * 0.5 : 0;
        z -= gap * 0.5;
        while (z > end - 0.04 && bookCount < maxBooks) {
          const w = 0.05 + rand() * 0.09;
          if (z - w < end) break;
          const h = 0.52 + rand() * 0.34;
          const d = 0.3 + rand() * 0.12;
          const lean = rand() < 0.05 ? (rand() - 0.5) * 0.35 : 0;
          const pos = new THREE.Vector3(s * (wallX - 0.12 - d / 2 + 0.02), y0 + h / 2, z - w / 2);
          const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, 0, 0));
          m4.compose(pos, q, new THREE.Vector3(d, h, w));
          books.setMatrixAt(bookCount, m4);
          col.setHex(pick(SPINES)).offsetHSL((rand() - 0.5) * 0.04, (rand() - 0.5) * 0.15, (rand() - 0.5) * 0.06);
          books.setColorAt(bookCount, col);
          bookCount++;
          z -= w + 0.004;
        }
      }
    }
  }
  books.count = bookCount;
  dividers.count = divCount;
  books.instanceMatrix.needsUpdate = true;
  if (books.instanceColor) books.instanceColor.needsUpdate = true;
  dividers.instanceMatrix.needsUpdate = true;
  scene.add(books, dividers);

  // ---------- klenba: žebra ----------
  const ribMat = mat(0x1a1410, { roughness: 0.8 });
  const ribGeo = new THREE.TorusGeometry(HALL_HALF_W - 0.05, 0.16, 6, 32, Math.PI);
  const colGeo = new THREE.BoxGeometry(0.34, shelfH + 0.4, 0.34);
  const ribZ = [];
  for (let z = 3; z > -HALL_LEN; z -= 5) ribZ.push(z);
  const ribs = new THREE.InstancedMesh(ribGeo, ribMat, ribZ.length);
  const cols = new THREE.InstancedMesh(colGeo, stone, ribZ.length * 2);
  ribZ.forEach((z, i) => {
    m4.makeTranslation(0, shelfH - 0.4, z);
    ribs.setMatrixAt(i, m4);
    [-1, 1].forEach((s, k) => {
      m4.makeTranslation(s * (HALL_HALF_W - 0.35), shelfH / 2 - 0.2, z);
      cols.setMatrixAt(i * 2 + k, m4);
    });
  });
  scene.add(ribs, cols);

  // ---------- levitující svíčky ----------
  const glowTex = glowTexture();
  const waxMat = mat(0xe8dcc0, { roughness: 0.6, emissive: 0x3a2a14, emissiveIntensity: 0.4 });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false });
  const candleGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.34, 10);
  const flameGeo = new THREE.SphereGeometry(0.04, 8, 8).scale(1, 1.8, 1);
  const candles = [];
  const candleLights = [];
  const candleCount = 78;
  for (let i = 0; i < candleCount; i++) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(candleGeo, waxMat));
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.y = 0.23;
    g.add(flame);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.85 }));
    glow.scale.setScalar(0.95);
    glow.position.y = 0.25;
    g.add(glow);
    // první svíčky blízko kamery jsou nahoře, ať nezakrývají výhled
    const z = i < 7 ? -3 - i * 4.2 : -2 - rand() * (HALL_LEN - 6);
    const base = new THREE.Vector3((rand() - 0.5) * 9, (i < 7 ? 4.6 : 3.4) + rand() * 3.8, z);
    g.position.copy(base);
    scene.add(g);
    const item = { g, glow, flame, base, phase: rand() * 6.28, speed: 0.5 + rand() * 0.6, flicker: rand() * 100 };
    candles.push(item);
    if (i < 7) {
      const light = new THREE.PointLight(0xffb05a, 5, 18, 1.4);
      g.add(light);
      light.position.y = 0.3;
      candleLights.push(light);
      item.light = light;
    }
  }

  // ---------- zaprášený vzduch ----------
  const DUST = 420;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (rand() - 0.5) * 11;
    dustPos[i * 3 + 1] = rand() * 8;
    dustPos[i * 3 + 2] = 3 - rand() * 36;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ size: 0.035, color: 0xffe2b0, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  scene.add(dust);

  // ---------- pomalu se vznášející knihy ----------
  const driftGeo = new RoundedBoxGeometry(0.34, 0.46, 0.07, 2, 0.012);
  const drifters = Array.from({ length: 9 }, (_, i) => {
    const m = new THREE.Mesh(driftGeo, mat(pick(SPINES), { roughness: 0.7 }));
    const side = i % 2 ? 1 : -1;
    const base = new THREE.Vector3(side * (1.5 + rand() * 3.2), 3 + rand() * 4, -6 - rand() * 36);
    m.position.copy(base);
    scene.add(m);
    return { m, base, phase: rand() * 6.28, spin: (rand() - 0.5) * 0.3 };
  });

  // ---------- pultík ----------
  const lectern = new THREE.Group();
  const stem = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.92, 0.46, 3, 0.03), wood);
  stem.position.y = 0.46;
  const foot = new THREE.Mesh(new RoundedBoxGeometry(0.95, 0.12, 0.72, 3, 0.03), woodLight);
  foot.position.y = 0.06;
  const collar = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.08, 0.56, 3, 0.02), woodLight);
  collar.position.y = 0.94;
  const topSlab = new THREE.Group();
  const slab = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.07, 0.9, 3, 0.02), woodLight);
  const lip = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.05, 0.05, 2, 0.015), wood);
  lip.position.set(0, 0.04, 0.44);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), mat(0x3a0e16, { roughness: 1 }));
  cloth.rotation.x = -Math.PI / 2;
  cloth.position.y = 0.037;
  topSlab.add(slab, lip, cloth);
  // střed desky je 1.0 nad základnou pultíku, tedy přesně ve výšce LECTERN.topY
  topSlab.position.y = 1.0;
  topSlab.rotation.x = LECTERN.tilt;
  lectern.add(stem, foot, collar, topSlab);
  lectern.position.set(LECTERN.x, LECTERN.topY - 1.0, LECTERN.z);
  scene.add(lectern);

  const readLight = new THREE.PointLight(0xffd29a, 2.6, 5.5, 1.6);
  readLight.position.set(0.1, LECTERN.topY + 1.15, LECTERN.z + 0.55);
  scene.add(readLight);
  const lecternGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.25, fog: false }));
  lecternGlow.scale.setScalar(2.2);
  lecternGlow.position.set(0, LECTERN.topY + 0.1, LECTERN.z + 0.2);
  scene.add(lecternGlow);

  // pozice knihy ležící na desce
  const slabNormal = new THREE.Vector3(0, Math.cos(LECTERN.tilt), Math.sin(LECTERN.tilt));
  // Kniha leží obálkou nahoru: její +z (obálka) musí mířit po normále desky,
  // proto se otáčí o tilt − 90° (deska sama se otáčí o +tilt).
  const slabQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(LECTERN.tilt - Math.PI / 2, 0, 0));
  // půl tloušťky desky + půl tloušťky knihy + drobná mezera, ať skrz desku neprosvítá
  const restPos = new THREE.Vector3(LECTERN.x, LECTERN.topY, LECTERN.z).addScaledVector(slabNormal, 0.035 + BOOK_SIZE.d / 2 + 0.03);

  // ---------- kniha ----------
  const pageMat = mat(0xe9ddbf, { roughness: 0.9 });
  let current = null; // { group, coverMat, tex, light, glow, landed }
  const anims = [];
  const textureLoader = new THREE.TextureLoader();
  textureLoader.setCrossOrigin('anonymous');

  function makeBook(book) {
    const tex = makeCoverTexture(book);
    const color = bookColor(book);
    const coverMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.28 });
    const spine = mat(color, { roughness: 0.6 });
    const materials = [pageMat, spine, pageMat, pageMat, coverMat, spine.clone()];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(BOOK_SIZE.w, BOOK_SIZE.h, BOOK_SIZE.d), materials);
    const group = new THREE.Group();
    group.add(mesh);
    const light = new THREE.PointLight(0xffc880, 0, 4, 1.8);
    light.position.z = 0.4;
    group.add(light);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false }));
    glow.scale.setScalar(1.8);
    glow.position.z = -0.05;
    group.add(glow);
    const state = { group, mesh, coverMat, tex, light, glow, landed: false, materials, disposed: false };

    // skutečná obálka, pokud se podaří načíst
    if (book.cover_url) {
      textureLoader.load(
        book.cover_url,
        (real) => {
          if (state.disposed) {
            real.dispose();
            return;
          }
          real.colorSpace = THREE.SRGBColorSpace;
          real.anisotropy = 4;
          coverMat.map = real;
          coverMat.emissiveMap = real;
          coverMat.needsUpdate = true;
          state.realTex = real;
        },
        undefined,
        () => {}
      );
    }
    return state;
  }

  function disposeBook(state) {
    state.disposed = true;
    scene.remove(state.group);
    state.mesh.geometry.dispose();
    state.tex.dispose();
    state.realTex?.dispose();
    state.coverMat.dispose();
    state.glow.material.dispose();
  }

  const randomShelfPoint = () => {
    const s = rand() < 0.5 ? -1 : 1;
    return new THREE.Vector3(s * (wallX - 0.5), 1.4 + rand() * 4.6, -6 - rand() * 24);
  };

  /** Let po Bézierově křivce s přetáčením; vrací Promise. */
  function fly(state, { from, to, fromQuat, toQuat, fromScale, toScale, duration, lift, ease = easeInOut, glowTo = 0.7 }) {
    return new Promise((resolve) => {
      const control = from.clone().lerp(to, 0.5).add(lift);
      const start = performance.now();
      const p = new THREE.Vector3();
      const spinAxis = new THREE.Vector3(rand() - 0.5, 1, rand() - 0.5).normalize();
      const spin = new THREE.Quaternion();
      anims.push((now) => {
        const t = clamp01((now - start) / duration);
        const e = ease(t);
        const a = from.clone().lerp(control, e);
        const b = control.clone().lerp(to, e);
        p.copy(a).lerp(b, e);
        state.group.position.copy(p);
        // přetáčení během letu, na konci přesně do cílové pózy
        state.group.quaternion.slerpQuaternions(fromQuat, toQuat, e);
        spin.setFromAxisAngle(spinAxis, Math.sin(e * Math.PI) * 2.2);
        state.group.quaternion.premultiply(spin);
        const sc = fromScale + (toScale - fromScale) * e;
        state.group.scale.setScalar(sc);
        const mid = Math.sin(e * Math.PI);
        state.light.intensity = mid * 3.5;
        state.glow.material.opacity = mid * glowTo;
        if (t >= 1) {
          resolve();
          return true;
        }
        return false;
      });
    });
  }

  async function summonBook(book) {
    if (current) {
      disposeBook(current);
      current = null;
    }
    const state = makeBook(book);
    current = state;
    const from = randomShelfPoint();
    state.group.position.copy(from);
    state.group.scale.setScalar(0.5);
    scene.add(state.group);
    const randQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 3, rand() * 3, rand() * 3));
    await fly(state, {
      from,
      to: restPos.clone(),
      fromQuat: randQuat,
      toQuat: slabQuat,
      fromScale: 0.5,
      toScale: 1,
      duration: 2100,
      lift: new THREE.Vector3(0, 1.8, 3.5)
    });
    if (state === current) state.landed = true;
  }

  /** 'library' = zpět do regálů, 'home' = dolů a ke mně domů. */
  async function dismissBook(where) {
    const state = current;
    if (!state) return;
    state.landed = false;
    const from = state.group.position.clone();
    const fromQuat = state.group.quaternion.clone();
    if (where === 'home') {
      await fly(state, {
        from,
        to: new THREE.Vector3(0.1, 0.1, 0.35),
        fromQuat,
        toQuat: fromQuat.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.2, 0.6, 0.4))),
        fromScale: 1,
        toScale: 0.35,
        duration: 950,
        lift: new THREE.Vector3(0, 0.5, 1.2),
        ease: easeInCubic,
        glowTo: 0.5
      });
    } else {
      await fly(state, {
        from,
        to: randomShelfPoint(),
        fromQuat,
        toQuat: new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 2, rand() * 2, rand() * 2)),
        fromScale: 1,
        toScale: 0.5,
        duration: 1700,
        lift: new THREE.Vector3(0, 2.4, 2.8)
      });
    }
    if (state === current) {
      disposeBook(state);
      current = null;
    }
  }

  // ---------- pohled za myší ----------
  const look = { x: 0, y: 0 };
  const smooth = { yaw: 0, pitch: 0 };
  const onMove = (e) => {
    look.x = (e.clientX / window.innerWidth) * 2 - 1;
    look.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onMove);

  // ---------- velikost ----------
  let width = 0;
  let height = 0;
  let fPx = 1;
  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = camera.aspect < 0.8 ? 74 : 55;
    camera.updateProjectionMatrix();
    fPx = height / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  // ---------- smyčka ----------
  let last = performance.now();
  const introStart = last;
  const INTRO_MS = 3600;
  let introDone = false;
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;

    // vstup: kamera se pomalu snáší chodbou z výšky k očím, svíčky se rozsvěcují
    const intro = clamp01((now - introStart) / INTRO_MS);
    const ie = 1 - Math.pow(1 - intro, 3);
    renderer.toneMappingExposure = 0.45 + 0.8 * ie;
    scene.fog.density = 0.055 - 0.027 * ie;
    camera.position.set(Math.sin(intro * Math.PI) * 0.25, 1.65 + (1 - ie) * 1.9, (1 - ie) * 15);
    if (!introDone && intro >= 1) {
      introDone = true;
      onIntroDone?.();
    }

    // kamera: vlevo nahoře → pohled lehce vlevo nahoru
    const ease = 1 - Math.pow(0.001, dt);
    smooth.yaw += (-look.x * MAX_YAW - smooth.yaw) * ease;
    smooth.pitch += (-look.y * MAX_PITCH - smooth.pitch) * ease;
    camera.rotation.set(BASE_PITCH * ie - 0.04 * (1 - ie) + smooth.pitch, smooth.yaw, 0);
    // pultík je ve světě: HTML nad ním se posouvá stejně jako jeho obraz
    onLook?.(smooth.yaw * fPx, smooth.pitch * fPx);

    for (let i = anims.length - 1; i >= 0; i--) {
      if (anims[i](now)) anims.splice(i, 1);
    }
    if (current?.landed) {
      const g = current.group;
      const bob = 0.012 + Math.sin(t * 1.3) * 0.01;
      g.position.copy(restPos).addScaledVector(slabNormal, bob);
      g.quaternion.copy(slabQuat).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(t * 0.9) * 0.025, Math.sin(t * 0.7) * 0.04, 0)));
      current.light.intensity = 1.3;
      current.glow.material.opacity = 0.22;
    }

    for (const c of candles) {
      const f = 0.82 + Math.sin(t * 9 + c.flicker) * 0.09 + Math.sin(t * 23 + c.flicker * 2) * 0.06;
      c.g.position.set(c.base.x + Math.sin(t * 0.3 + c.phase) * 0.12, c.base.y + Math.sin(t * c.speed + c.phase) * 0.16, c.base.z);
      c.flame.scale.set(f, 0.8 + f * 0.4, f);
      c.glow.material.opacity = (0.6 + f * 0.3) * (0.25 + 0.75 * ie);
      if (c.light) c.light.intensity = 5 * f;
    }
    for (const d of drifters) {
      d.m.position.y = d.base.y + Math.sin(t * 0.5 + d.phase) * 0.3;
      d.m.rotation.y += d.spin * dt;
      d.m.rotation.x = Math.sin(t * 0.4 + d.phase) * 0.3;
    }
    const p = dustGeo.attributes.position.array;
    for (let i = 0; i < DUST; i++) {
      p[i * 3 + 1] += (0.03 + (i % 5) * 0.008) * dt;
      p[i * 3] += Math.sin(t * 0.2 + i) * dt * 0.02;
      if (p[i * 3 + 1] > 8) p[i * 3 + 1] = 0;
    }
    dustGeo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  });

  function dispose() {
    renderer.setAnimationLoop(null);
    resizeObserver.disconnect();
    window.removeEventListener('pointermove', onMove);
    if (current) disposeBook(current);
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      if (m) (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
    });
    glowTex.dispose();
    renderer.dispose();
  }

  return { summonBook, dismissBook, dispose };
}
