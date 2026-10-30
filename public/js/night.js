// Corrida noturna: céu, postes ao longo da pista e luzes dos carros.
// Os postes distantes são só desenho (brilho e mancha de luz no chão); poucas luzes reais acompanham o jogador,
// porque cada luz real pesa no desenho da pista inteira.
import * as THREE from 'three';
import { scene, camera, sun, hemi, skyBg, envMap, nightEnv, nightBg, canvasTex } from './engine.js';
import { SAMPLES } from './data.js';
import { surfaceAt, roofAt, buildRoofs } from './surface.js';
import { RUNOFF } from './tracks.js';

const DAY_FOG = new THREE.Fog(0xcfe0f0, 500, 2600);
const NIGHT_FOG = new THREE.Fog(0x05070f, 90, 1100);

const LAMP_GAP = 40;        // metros entre um poste e o próximo (lados alternados)
const POLE_OUT = 1.0;       // além do muro invisível, para o carro nunca alcançar o poste
const LAMP_HEIGHT = 8.5;    // altura da lâmpada sobre a pista
const ARM = 3.5;            // braço do poste, por cima da área de escape
const REAL_LAMPS = 6;       // luzes de poste reais em volta do jogador
const REAL_HEADLIGHTS = 2;  // faróis reais: o seu e o do carro mais próximo
const LAMP_COLOR = 0xffd6a0;

const glowTex = canvasTex(64, 64, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
});
const beamTex = canvasTex(64, 128, (g, w, h) => {
  // canvas de cima para baixo: o topo fica longe do carro
  for (let y = 0; y < h; y++) {
    const near = y / h, half = (w / 2) * (0.22 + 0.78 * (1 - near));
    const gr = g.createLinearGradient(w / 2 - half, 0, w / 2 + half, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${near * near})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, y, w, 1);
  }
});

// Céu, neblina e luz geral da corrida, de dia ou de noite
export function setRaceLook(night) {
  scene.background = night ? nightBg : skyBg;
  scene.environment = night ? nightEnv : envMap;
  scene.fog = night ? NIGHT_FOG : DAY_FOG;
  sun.intensity = night ? 0.35 : 2.2;
  sun.color.set(night ? 0x9db4e8 : 0xfff4e0);
  hemi.intensity = night ? 0.28 : 0.8;
}

// O cenário do modelo fica guardado entre corridas: escurece o que brilha sozinho e sabe voltar ao dia
export function setSceneryNight(root, night) {
  root.traverse(o => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m.isMeshBasicMaterial) {
        m.userData.dayColor ??= m.color.clone();
        m.color.copy(m.userData.dayColor).multiplyScalar(night ? 0.07 : 1);
      } else if (m.emissive) {
        m.userData.dayEmissive ??= m.emissiveIntensity;
        m.emissiveIntensity = night ? m.userData.dayEmissive * 0.25 : m.userData.dayEmissive;
      }
    }
  });
}

// Onde vão os postes: fora do alcance dos carros e longe de qualquer outro trecho da pista.
// Em túnel, a luz vai no teto.
function findLamps(track) {
  const S = track.samples, step = track.length / SAMPLES;
  const lamps = [];
  const clearOfTrack = (x, z, y) => {
    for (let i = 0; i < SAMPLES; i += 2) {
      const s = S[i];
      if (Math.abs(s.p.y - y) < 6 && Math.hypot(s.p.x - x, s.p.z - z) < s.w + RUNOFF + 0.5) return false;
    }
    return true;
  };
  const every = Math.round(LAMP_GAP / step);
  for (let i = 0, side = 1; i < SAMPLES; i += every, side = -side) {
    const s = S[i];
    const roof = roofAt(track.surface, s.p.x, s.p.z, s.p.y);
    if (roof != null) {
      lamps.push({ i, x: s.p.x, y: roof - 0.2, z: s.p.z, ground: s.p.y, ceiling: true });
      continue;
    }
    for (const sd of [side, -side]) {
      const out = s.w + RUNOFF + POLE_OUT;
      const x = s.p.x + s.n.x * sd * out, z = s.p.z + s.n.z * sd * out;
      if (!clearOfTrack(x, z, s.p.y) || roofAt(track.surface, x, z, s.p.y) != null) continue;
      const base = surfaceAt(track.surface, x, z, s.p.y)?.y ?? s.p.y - 1;
      lamps.push({ i, x: s.p.x + s.n.x * sd * (out - ARM), y: s.p.y + LAMP_HEIGHT, z: s.p.z + s.n.z * sd * (out - ARM), ground: s.p.y, px: x, pz: z, base, top: s.p.y + LAMP_HEIGHT });
      break;
    }
  }
  return lamps;
}

// Mancha de luz que acompanha o relevo, uma para cada poste, tudo numa malha só
function lightPools(track, lamps) {
  const RINGS = [[0, 1], [5, 0.62], [10, 0.22], [15, 0]], SEG = 14;
  const pos = [], col = [], idx = [];
  const tint = new THREE.Color(LAMP_COLOR);
  for (const l of lamps) {
    const first = pos.length / 3;
    for (let r = 0; r < RINGS.length; r++) {
      const [rad, power] = RINGS[r];
      const n = r ? SEG : 1;
      for (let k = 0; k < n; k++) {
        const a = (k / SEG) * Math.PI * 2, x = l.x + Math.cos(a) * rad, z = l.z + Math.sin(a) * rad;
        const h = surfaceAt(track.surface, x, z, l.ground)?.y;
        pos.push(x, (h ?? l.ground) + 0.07, z);
        const b = h == null ? 0 : power * 0.3;
        col.push(tint.r * b, tint.g * b, tint.b * b);
      }
    }
    for (let k = 0; k < SEG; k++) {
      idx.push(first, first + 1 + k, first + 1 + (k + 1) % SEG);
      for (let r = 1; r < RINGS.length - 1; r++) {
        const a = first + 1 + (r - 1) * SEG + k, b = first + 1 + (r - 1) * SEG + (k + 1) % SEG;
        idx.push(a, a + SEG, b, b, a + SEG, b + SEG);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  mesh.frustumCulled = false;
  return mesh;
}

function polesMesh(lamps) {
  const standing = lamps.filter(l => !l.ceiling);
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a3e46, metalness: 0.5, roughness: 0.6 });
  const post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.17, 1, 8), metal, standing.length);
  const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 1), metal, standing.length);
  const m = new THREE.Object3D();
  standing.forEach((l, i) => {
    m.position.set(l.px, (l.base + l.top) / 2, l.pz); m.rotation.set(0, 0, 0); m.scale.set(1, l.top - l.base, 1);
    m.updateMatrix(); post.setMatrixAt(i, m.matrix);
    m.position.set((l.px + l.x) / 2, l.top, (l.pz + l.z) / 2); m.rotation.set(0, Math.atan2(l.x - l.px, l.z - l.pz), 0); m.scale.set(1, 1, ARM);
    m.updateMatrix(); arm.setMatrixAt(i, m.matrix);
  });
  // as lâmpadas ficam ligadas a qualquer distância
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.16, 0.5), new THREE.MeshBasicMaterial({ color: 0xfff1d6, fog: false }), lamps.length);
  lamps.forEach((l, i) => {
    m.position.set(l.x, l.y, l.z); m.scale.set(1, 1, 1);
    m.rotation.set(0, l.ceiling ? 0 : Math.atan2(l.x - (l.px ?? l.x), l.z - (l.pz ?? l.z)) + Math.PI / 2, 0);
    m.updateMatrix(); heads.setMatrixAt(i, m.matrix);
  });
  const group = new THREE.Group();
  for (const part of [post, arm, heads]) { part.frustumCulled = false; group.add(part); }
  return group;
}

function glowPoints(lamps) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(lamps.flatMap(l => [l.x, l.y - 0.1, l.z]), 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({
    map: glowTex, color: LAMP_COLOR, size: 7, sizeAttenuation: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false,
  }));
  p.frustumCulled = false;
  return p;
}

function starField() {
  const pos = [];
  for (let i = 0; i < 1400; i++) {
    const a = Math.random() * Math.PI * 2, up = 0.04 + Math.random() * 0.96;
    const flat = Math.sqrt(1 - up * up);
    pos.push(Math.cos(a) * flat * 3000, up * 3000, Math.sin(a) * flat * 3000);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfd9ff, size: 1.6, sizeAttenuation: false, fog: false, depthWrite: false, transparent: true, opacity: 0.85 }));
  stars.frustumCulled = false;
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xe8efff, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  moon.position.set(1500, 1500, 1200);
  moon.scale.setScalar(320);
  stars.add(moon);
  return stars;
}

// Monta a parte noturna da pista; o que for criado aqui some junto com a corrida
export function buildNight(track, parent, sceneRoot) {
  const surface = track.surface;
  if (!surface.roofs) buildRoofs(surface, sceneRoot);
  track.lamps ??= findLamps(track);
  const lamps = track.lamps;

  const stars = starField();
  parent.add(lightPools(track, lamps), polesMesh(lamps), glowPoints(lamps), stars);

  const real = Array.from({ length: REAL_LAMPS }, () => {
    const l = new THREE.PointLight(LAMP_COLOR, 420, 46, 1.7);
    parent.add(l);
    return l;
  });
  const heads = Array.from({ length: REAL_HEADLIGHTS }, () => {
    const l = new THREE.SpotLight(0xf2f5ff, 1400, 110, 0.42, 0.65, 1.6);
    parent.add(l, l.target);
    return l;
  });
  return { lamps, real, heads, stars };
}

// Faróis e lanternas desenhados em cada carro
export function addCarLights(r) {
  const box = new THREE.Box3().setFromObject(r.obj);   // o carro ainda está na origem, sem girar
  const size = box.getSize(new THREE.Vector3());
  const front = box.max.z, rear = box.min.z, x = size.x * 0.33;
  const glow = (color, px, py, pz, scale) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.position.set(px, py, pz);
    s.scale.setScalar(scale);
    r.obj.add(s);
    return s;
  };
  const fronts = [-1, 1].map(sx => glow(0xf4f7ff, sx * x, size.y * 0.42, front + 0.05, 1.5));
  const tails = [-1, 1].map(sx => glow(0xff1a10, sx * x, size.y * 0.58, rear - 0.05, 0.7));

  const beam = new THREE.Mesh(new THREE.PlaneGeometry(13, 30), new THREE.MeshBasicMaterial({
    map: beamTex, color: 0xdfe6ff, opacity: 0.16, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  }));
  beam.rotation.x = -Math.PI / 2;
  beam.position.set(0, 0.09, front + 15);
  r.obj.add(beam);

  r.lights = { fronts, tails, lastV: 0, brake: 0 };
}

const lampDist = (l, x, z) => (l.x - x) ** 2 + (l.z - z) ** 2;

// Leva as poucas luzes reais para perto do jogador e acende as lanternas de quem freia
export function updateNight(N, R, dt) {
  const me = R.me;
  N.stars.position.copy(camera.position);

  const near = [...N.lamps].sort((a, b) => lampDist(a, me.x, me.z) - lampDist(b, me.x, me.z));
  N.real.forEach((l, k) => {
    const p = near[k];
    if (!p) return;
    // no túnel a luz fica mais baixa e mais fraca, senão estoura no teto logo acima
    l.position.set(p.x, p.y - (p.ceiling ? 2 : 0.3), p.z);
    l.intensity = p.ceiling ? 70 : 420;
  });

  const byDist = [...R.racers].sort((a, b) => (a.me ? -1 : b.me ? 1 : lampDist(a, me.x, me.z) - lampDist(b, me.x, me.z)));
  N.heads.forEach((l, k) => {
    const r = byDist[k];
    l.visible = !!r;
    if (!r) return;
    const fx = Math.sin(r.h), fz = Math.cos(r.h);
    l.position.set(r.x + fx * 1.8, r.y + 0.9, r.z + fz * 1.8);
    l.target.position.set(r.x + fx * 32, r.y + Math.tan(r.pitch) * 32 - 0.6, r.z + fz * 32);
    l.target.updateMatrixWorld();
  });

  for (const r of R.racers) {
    if (!r.lights) continue;
    const braking = r.me ? R.braking : r.lights.lastV - r.v > 12 * dt;
    r.lights.lastV = r.v;
    r.lights.brake += ((braking ? 1 : 0) - r.lights.brake) * Math.min(1, dt * 16);
    // cada lâmpada só brilha para quem está do lado dela
    const cx = camera.position.x - r.x, cz = camera.position.z - r.z;
    const facing = (Math.sin(r.h) * cx + Math.cos(r.h) * cz) / (Math.hypot(cx, cz) || 1);
    for (const f of r.lights.fronts) f.material.opacity = Math.max(0, Math.min(1, facing * 2));
    for (const t of r.lights.tails) {
      t.scale.setScalar(0.7 + r.lights.brake * 1.1);
      t.material.opacity = Math.max(0, Math.min(1, -facing * 2));
    }
  }
}
