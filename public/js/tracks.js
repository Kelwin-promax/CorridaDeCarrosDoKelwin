// Pistas: traçado (física, voltas, minimapa) e cenário 3D vindo dos modelos .glb
import * as THREE from 'three';
import { TRACKS, SAMPLES } from './data.js';
import { gltfLoader } from './cars.js';
import { canvasTex } from './engine.js';
import { buildSurface } from './surface.js';

export const RUNOFF = 6;   // área de escape além da borda do asfalto até o muro invisível

// Lê o traçado extraído (public/tracks/<id>.json) e reamostra em SAMPLES pontos já em escala
async function makeTrack(def) {
  const json = await (await fetch(def.data)).json();
  const k = def.scale;
  const pts = json.points.map(p => new THREE.Vector3(p[0] * k, p[1] * k, p[2] * k));
  const widths = json.points.map(p => p[3] * k);
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  const samples = [];
  for (let i = 0; i < SAMPLES; i++) {
    const u = i / SAMPLES;
    const t = curve.getTangentAt(u).setY(0).normalize();
    const f = u * widths.length, a = Math.floor(f) % widths.length, b = (a + 1) % widths.length;
    const w = widths[a] + (widths[b] - widths[a]) * (f - Math.floor(f));
    samples.push({ i, p: curve.getPointAt(u), t, n: new THREE.Vector3(t.z, 0, -t.x), h: Math.atan2(t.x, t.z), w });
  }
  let length = 0;
  for (let i = 0; i < SAMPLES; i++) { samples[i].d = length; length += samples[i].p.distanceTo(samples[(i + 1) % SAMPLES].p); }
  // número de curvas fortes (para os cartões das pistas)
  let curves = 0, inCurve = false;
  for (let i = 0; i < SAMPLES; i += 10) {
    const sharp = samples[i].t.dot(samples[(i + 30) % SAMPLES].t) < 0.85;
    if (sharp && !inCurve) curves++;
    inCurve = sharp;
  }
  // direção da reta de largada, medida numa base longa para não pegar ondulações do traçado
  const back = samples[Math.floor((1 - 60 / length) * SAMPLES)].p, line = samples[0].p;
  const fwd = new THREE.Vector2(line.x - back.x, line.z - back.z).normalize();
  const startDir = { x: fwd.x, z: fwd.y, nx: fwd.y, nz: -fwd.x, h: Math.atan2(fwd.x, fwd.y) };
  return { ...def, laps: def.voltas, samples, length, curves, startDir };
}

export const TRACK_OBJS = new Map();
export const tracksReady = Promise.all(TRACKS.map(async def => TRACK_OBJS.set(def.id, await makeTrack(def))));

export function sampleAt(track, d) {
  const L = track.length;
  const u = (((d % L) + L) % L) / L;
  return track.samples[Math.min(SAMPLES - 1, Math.floor(u * SAMPLES))];
}

// Amostra da pista mais próxima de (x, z), procurando perto do índice anterior
export function nearestIdx(track, x, z, prev) {
  let best = prev, bestD = Infinity;
  for (let k = -25; k <= 60; k++) {
    const i = (prev + k + SAMPLES) % SAMPLES;
    const p = track.samples[i].p;
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// Lugar no grid de largada: duas filas desencontradas, todos paralelos à reta antes da linha
const GRID_FIRST = 7, GRID_ROW = 9, GRID_STAGGER = 4.5, GRID_LAT = 3.5;
export function gridSlot(track, slot) {
  const s0 = track.samples[0], dir = track.startDir;
  const col = slot % 2 ? 1 : -1;
  const dist = GRID_FIRST + Math.floor(slot / 2) * GRID_ROW + (slot % 2) * GRID_STAGGER;
  const x = s0.p.x - dir.x * dist + dir.nx * col * GRID_LAT, z = s0.p.z - dir.z * dist + dir.nz * col * GRID_LAT;
  return { x, z, h: dir.h, s: sampleAt(track, -dist) };
}

// ---------- Cenário 3D ----------
const sceneCache = new Map();
export function loadTrackScene(track, onProgress) {
  if (!sceneCache.has(track.id)) {
    sceneCache.set(track.id, new Promise((ok, fail) => {
      gltfLoader.load(track.file, g => {
        const root = new THREE.Group();
        g.scene.scale.setScalar(track.scale);
        g.scene.traverse(o => {
          if (!o.isMesh) return;
          o.receiveShadow = true;
          o.castShadow = false;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          // texturas com transparência (árvores, grades) sem borda preta
          for (const m of mats) if (m.map && m.transparent) { m.alphaTest = 0.4; m.transparent = false; m.depthWrite = true; }
        });
        track.surface = buildSurface(track, g.scene);
        root.add(g.scene);
        ok(root);
      }, e => e.total && onProgress?.(e.loaded / e.total), () => {
        sceneCache.delete(track.id);
        fail(new Error('Falha ao carregar ' + track.file));
      });
    }));
  }
  return sceneCache.get(track.id);
}

const grassTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#3f6e35'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) { g.fillStyle = ['#356d2d', '#4b7c3f', '#2f5f28', '#58894a'][i % 4]; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
}, 600, 600);

// Monta o cenário da corrida: modelo da pista, chão de fundo e pórtico com o semáforo
export async function buildTrackGroup(track, onProgress) {
  const S = track.samples;
  const g = new THREE.Group();
  const scenery = await loadTrackScene(track, onProgress);
  g.add(scenery);

  let minY = Infinity;
  for (const s of S) minY = Math.min(minY, s.p.y);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(S[0].p.x, minY - 3, S[0].p.z);
  ground.receiveShadow = true;
  g.add(ground);

  // Pórtico de largada com as luzes do semáforo, com as hastes fora do asfalto
  const s0 = S[0];
  const { plus, minus } = track.surface.start;
  const gantry = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x22252c, metalness: 0.7, roughness: 0.4 });
  const span = (plus + minus) / 2 + 1.5;
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 9, 0.6), metal);
    post.position.set(sx * span, 4.5, 0);
    post.castShadow = true;
    gantry.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2 * span + 0.6, 1.4, 0.8), metal);
  beam.position.y = 8.6;
  beam.castShadow = true;
  gantry.add(beam);
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(2 * span, 1.2), new THREE.MeshBasicMaterial({ map: canvasTex(1024, 64, (c, w, h) => {
    c.fillStyle = '#e10600'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.font = 'italic 900 44px "Titillium Web", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('OVERDRIVE RIVALS', w / 2, h / 2 + 2);
  }) }));
  banner.position.set(0, 10, 0.05);
  gantry.add(banner);
  const lamps = [];
  for (let k = 0; k < 5; k++) {
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), new THREE.MeshStandardMaterial({ color: 0x220808, emissive: 0x000000 }));
    lamp.position.set((k - 2) * 1.5, 8.6, -0.42);
    lamp.rotation.y = Math.PI;
    gantry.add(lamp);
    lamps.push(lamp);
  }
  const { nx, nz, h } = track.startDir;
  gantry.position.set(s0.p.x + nx * (plus - minus) / 2, s0.p.y, s0.p.z + nz * (plus - minus) / 2);
  gantry.rotation.y = h;
  g.add(gantry);

  return { group: g, lamps, scenery };
}

// ---------- Desenho 2D do traçado (cartões e minimapa) ----------
export function trackPath(samples, W, H, pad) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const s of samples) {
    minX = Math.min(minX, s.p.x); maxX = Math.max(maxX, s.p.x);
    minZ = Math.min(minZ, s.p.z); maxZ = Math.max(maxZ, s.p.z);
  }
  const k = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxZ - minZ));
  const ox = (W - (maxX - minX) * k) / 2, oz = (H - (maxZ - minZ) * k) / 2;
  return (x, z) => [ox + (x - minX) * k, oz + (z - minZ) * k];
}
export function strokeTrack(g, samples, map, width, color) {
  g.beginPath();
  samples.forEach((s, i) => { const [x, y] = map(s.p.x, s.p.z); i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.closePath();
  g.lineJoin = 'round';
  g.lineWidth = width;
  g.strokeStyle = color;
  g.stroke();
}
export function drawPreview(cv, track, { glow = true } = {}) {
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  const S = track.samples;
  const pad = Math.max(14, cv.width * 0.06);
  const map = trackPath(S, cv.width, cv.height, pad);
  const lw = Math.max(3, cv.width / 70);
  strokeTrack(g, S, map, lw * 3, 'rgba(255,255,255,.07)');
  if (glow) { g.shadowColor = 'rgba(255,40,20,.8)'; g.shadowBlur = lw * 3; }
  strokeTrack(g, S, map, lw, '#ff2a1a');
  g.shadowBlur = 0;
  // linha de largada e sentido
  const [sx, sy] = map(S[0].p.x, S[0].p.z);
  const [nx, ny] = map(S[20].p.x, S[20].p.z);
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(sx, sy, lw * 1.4, 0, Math.PI * 2); g.fill();
  const a = Math.atan2(ny - sy, nx - sx);
  g.save(); g.translate(nx, ny); g.rotate(a);
  g.beginPath(); g.moveTo(lw * 2, 0); g.lineTo(-lw, lw * 1.4); g.lineTo(-lw, -lw * 1.4); g.closePath(); g.fill();
  g.restore();
}
