// Corrida: física do seu carro, carros dos outros jogadores, câmera e HUD
import * as THREE from 'three';
import { $, $$, clamp, wrapAngle, fmt, esc, showMsg, showLoading, LOAD_ERROR } from './util.js';
import { CARS, SAMPLES, CAR_RADIUS, CAR_FORWARD_OFFSET, carOf } from './data.js';
import { scene, camera, sun, hemi, skyBg, setShadowArea } from './engine.js';
import { menuRoot } from './showroom.js';
import { spawnCar } from './cars.js';
import { TRACK_OBJS, sampleAt, nearestIdx, groundAt, buildTrackGroup, trackPath, strokeTrack, RUNOFF } from './tracks.js';
import { state, net, nav, show, goto, sendNet, onNet } from './state.js';

const keys = { up: false, down: false, left: false, right: false };
const KEYMAP = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (KEYMAP[k]) { keys[KEYMAP[k]] = true; e.preventDefault(); }
  if (nav.current !== 'race' || !race) return;
  if (e.key === 'Escape') leaveRace();
  if (k === 'v' && !e.repeat) toggleRear();
});
addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (KEYMAP[k]) keys[KEYMAP[k]] = false;
});
addEventListener('blur', () => Object.keys(keys).forEach(k => keys[k] = false));

export const trackRoot = new THREE.Group();
scene.add(trackRoot);
const skyFog = new THREE.Fog(0xcfe0f0, 500, 2600);

export let race = null;
let raceToken = 0;

// Atributos do carro na física
const statsOf = id => carOf(id) ?? CARS[0];

function newRacer(g, obj, slot, track) {
  const s = sampleAt(track, -8 - slot * 10);      // grid de largada atrás da linha
  const lat = slot % 2 ? 3.2 : -3.2;
  const st = statsOf(g.carId);
  return {
    id: g.id, name: g.name, me: g.id === net.id, carId: g.carId, obj,
    x: s.p.x + s.n.x * lat, z: s.p.z + s.n.z * lat, y: s.p.y, h: s.h, v: 0,
    idx: s.i, lap: -1, lat, s,
    maxV: 80 + st.spd * 14,
    accel: 30 + st.acc * 22,
    steerRate: 1.5 + st.ctl * 0.8,
    finished: false, finishT: null, lapStart: 0, best: null, target: null,
    tagH: new THREE.Box3().setFromObject(obj).max.y + 0.35,     // nome logo acima do teto do carro
    tag: makeTag(g.name, g.id === net.id),
  };
}
const progress = (r, L) => r.lap * L + r.idx * (L / SAMPLES);

function makeTag(name, me) {
  const el = document.createElement('div');
  el.className = 'tag' + (me ? ' me' : '');
  el.textContent = name;
  $('#labels').appendChild(el);
  return el;
}

export function clearRace() {
  race = null;
  raceToken++;
  trackRoot.clear();
  $('#labels').innerHTML = '';
  $('#finishMsg').style.display = 'none';
  $('#rearTag').style.display = 'none';
}

function setLights(n, green) {
  $$('#sema .col').forEach((col, i) => {
    col.querySelectorAll('.light').forEach(el => el.className = 'light' + (i < n ? (green ? ' green' : ' red') : ''));
  });
  race?.lamps.forEach((l, i) => {
    const on = i < n;
    l.material.emissive.set(on ? (green ? 0x20ff40 : 0xff2020) : 0x000000);
    l.material.emissiveIntensity = on ? 3 : 0;
  });
}

// O servidor mandou montar o grid: carrega pista e carros e avisa que está pronto
async function prepareRace(m) {
  if (!m.grid.some(g => g.id === net.id)) return;
  if (nav.current === 'results') { clearRace(); goto('lobby'); }
  const track = TRACK_OBJS.get(state.track);
  net.pending = { countdown: false, go: false };
  const token = ++raceToken;

  showLoading(true, `Carregando ${track.nome}...`, 0);
  let objs, built;
  try {
    built = await buildTrackGroup(track, p => showLoading(true, `Carregando ${track.nome}...`, p * 0.85));
    showLoading(true, 'Carregando carros...', 0.9);
    objs = await Promise.all(m.grid.map(g => spawnCar(g.carId)));
  } catch (e) {
    showLoading(false);
    showMsg(LOAD_ERROR);
    sendNet({ type: 'leave' });
    goto('mode');
    return;
  }
  showLoading(false);
  if (token !== raceToken || nav.current !== 'lobby') return;   // saiu da sala enquanto carregava

  clearRace();
  menuRoot.visible = false;
  scene.background = skyBg;
  scene.fog = skyFog;
  sun.intensity = 2.2;
  hemi.intensity = 0.8;
  setShadowArea(60);

  trackRoot.add(built.group);
  const R = {
    track, laps: m.laps, lamps: built.lamps, racers: [], byId: new Map(),
    phase: net.pending.countdown ? 'countdown' : 'waiting', go: net.pending.go,
    cd: 0, raceT: 0, semaT: null, over: false, snap: true, rear: false, camH: 0, boardT: 0, sendT: 0,
  };
  m.grid.forEach((g, i) => {
    trackRoot.add(objs[i]);
    const r = newRacer(g, objs[i], g.slot, track);
    R.racers.push(r);
    R.byId.set(r.id, r);
  });
  R.me = R.racers.find(r => r.me);
  R.camH = R.me.h;
  race = R;

  // Minimapa: traçado pré-desenhado
  const cv = $('#miniCv');
  R.miniMap = trackPath(track.samples, cv.width, cv.height, 18);
  R.miniBg = document.createElement('canvas');
  R.miniBg.width = cv.width; R.miniBg.height = cv.height;
  const mg = R.miniBg.getContext('2d');
  strokeTrack(mg, track.samples, R.miniMap, 14, 'rgba(255,255,255,.12)');
  strokeTrack(mg, track.samples, R.miniMap, 6, '#cfd4de');

  $('#labels').style.display = 'block';
  $('#hudBest').textContent = '--';
  $('#semaText').textContent = 'AGUARDANDO PILOTOS';
  $('#semaText').className = '';
  setLights(0, false);
  $('#sema').style.display = 'flex';
  show('race');
  sendNet({ type: 'ready' });
}

// Remove da corrida quem saiu da sala
export function dropMissing(players) {
  const racing = new Set(players.filter(p => p.racing).map(p => p.id));
  for (const r of [...race.racers]) {
    if (r.me || racing.has(r.id)) continue;
    trackRoot.remove(r.obj);
    r.tag.remove();
    race.racers.splice(race.racers.indexOf(r), 1);
    race.byId.delete(r.id);
  }
}

function leaveRace() {
  sendNet({ type: 'leave' });
  state.room = null;
  endRace('mode');
}

export function endRace(to) {
  clearRace();
  goto(to);
}

function toggleRear() {
  race.rear = !race.rear;
  race.snap = true;
  $('#rearTag').style.display = race.rear ? 'block' : 'none';
}

const order = R => {
  const L = R.track.length;
  const key = r => r.finished ? 1e7 - (r.finishT ?? 0) : progress(r, L);
  return [...R.racers].sort((a, b) => key(b) - key(a));
};

// Física comum: aplica a direção (heading) e a velocidade, e acompanha a pista
function move(r, dt, R) {
  const fx = Math.sin(r.h), fz = Math.cos(r.h);
  r.x += fx * r.v * dt;
  r.z += fz * r.v * dt;

  const prev = r.idx;
  r.idx = nearestIdx(R.track, r.x, r.z, prev);
  if (prev - r.idx > SAMPLES / 2) r.lap++;          // cruzou a linha para frente
  else if (r.idx - prev > SAMPLES / 2) r.lap--;     // cruzou de ré
  const s = R.track.samples[r.idx];
  r.lat = (r.x - s.p.x) * s.n.x + (r.z - s.p.z) * s.n.z;

  // Muro invisível depois da área de escape: segura o carro e tira velocidade
  const wall = s.w + RUNOFF - 1.2;
  if (Math.abs(r.lat) > wall) {
    const lim = Math.sign(r.lat) * wall;
    r.x += s.n.x * (lim - r.lat);
    r.z += s.n.z * (lim - r.lat);
    r.lat = lim;
    r.v *= 0.97;
    const along = wrapAngle(s.h - r.h);
    const towards = Math.abs(along) < Math.PI / 2 ? s.h : s.h + Math.PI;
    r.h += wrapAngle(towards - r.h) * Math.min(1, 6 * dt);
  }
  r.s = s;
}

// Altura e inclinação do carro conforme o relevo da pista
function placeOnGround(r, R) {
  r.y = groundAt(R.track, r.x, r.z, r.idx);
  const s = R.track.samples[r.idx];
  r.obj.position.set(r.x, r.y, r.z);
  r.obj.rotation.set(-Math.atan(s.slope * Math.cos(r.h - s.h)), r.h + CAR_FORWARD_OFFSET, 0, 'YXZ');
}

function physPlayer(r, dt) {
  const off = Math.abs(r.lat) > r.s.w + 0.5;
  const top = off ? r.maxV * 0.5 : r.maxV;
  let a = 0;
  if (!r.finished && keys.up) a += r.accel * (1 - Math.max(0, r.v) / top);
  if (!r.finished && keys.down) a -= r.v > 0.5 ? 55 : 14;          // freia, depois dá ré
  a -= Math.sign(r.v) * (1.5 + Math.abs(r.v) * 0.012);             // atrito
  a -= 9.8 * r.s.slope * Math.cos(r.h - r.s.h) * 0.6;               // subida tira velocidade, descida dá
  if (r.finished) a -= Math.sign(r.v) * 12;                         // depois da chegada, para devagar
  if (off && r.v > top) a -= 30;
  r.v = clamp(r.v + a * dt, -12, r.maxV);
  if (Math.abs(r.v) < 0.3 && (r.finished || (!keys.up && !keys.down))) r.v = 0;

  // Direção: o carro gira; quanto mais rápido, menos ângulo de esterço
  const steer = r.finished ? 0 : (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
  const grip = clamp(Math.abs(r.v) / 10, 0, 1) * (1 - 0.5 * Math.abs(r.v) / r.maxV);
  r.h += steer * r.steerRate * grip * Math.sign(r.v || 1) * dt;
}

// Carro de outro jogador: segue a última posição recebida, prevendo o movimento entre os pacotes
function updateRemote(r, dt) {
  const t = r.target;
  if (!t) return;
  t.x += Math.sin(t.h) * t.v * dt;
  t.z += Math.cos(t.h) * t.v * dt;
  const k = Math.min(1, dt * 12);
  r.x += (t.x - r.x) * k;
  r.z += (t.z - r.z) * k;
  r.h += wrapAngle(t.h - r.h) * k;
  r.v = t.v;
  r.lap = t.lap;
  r.idx = nearestIdx(race.track, r.x, r.z, t.idx);
  if (t.fin) r.finished = true;
}

// Seu carro não atravessa os outros (só o seu é empurrado; cada jogador cuida do próprio)
function collide(R) {
  const me = R.me;
  for (const o of R.racers) {
    if (o === me) continue;
    const dx = me.x - o.x, dz = me.z - o.z;
    const d = Math.hypot(dx, dz), min = CAR_RADIUS * 2;
    if (d > 0.001 && d < min) {
      me.x += dx / d * (min - d);
      me.z += dz / d * (min - d);
      me.v *= 0.99;
    }
  }
}

function startGreen(R) {
  R.phase = 'running';
  R.semaT = 0;
  setLights(5, true);
  $('#semaText').textContent = 'VAI!';
  $('#semaText').className = 'go';
}

export function updateRace(dt) {
  const R = race;
  if (!R || R.over) return;
  const me = R.me;

  // Semáforo: luzes vermelhas acendem uma a uma; o verde vem do servidor, igual para todos
  if (R.phase === 'countdown') {
    R.cd += dt;
    const n = Math.min(5, Math.floor(R.cd / 0.8));
    setLights(n, false);
    if (n > 0) $('#semaText').textContent = n;
    if (R.go) startGreen(R);
  } else if (R.phase === 'waiting') {
    if (R.go) startGreen(R);
  } else {
    R.raceT += dt;
  }
  if (R.semaT != null) {
    R.semaT += dt;
    if (R.semaT > 1.5) { $('#sema').style.display = 'none'; R.semaT = null; }
  }

  // Seu carro
  if (R.phase === 'running') physPlayer(me, dt);
  const lapBefore = me.lap;
  move(me, dt, R);
  if (me.lap > lapBefore) {
    if (me.lap >= 1) {
      const lt = R.raceT - me.lapStart;
      me.best = me.best == null ? lt : Math.min(me.best, lt);
    }
    me.lapStart = R.raceT;
  }
  if (!me.finished && me.lap >= R.laps) {
    me.finished = true;
    me.finishT = R.raceT;
    sendNet({ type: 'state', x: me.x, z: me.z, h: me.h, v: me.v, lap: me.lap, idx: me.idx });
    sendNet({ type: 'finish', lap: me.lap });
    $('#finishMsg').style.display = 'block';
  }

  // Outros jogadores
  for (const r of R.racers) if (!r.me) updateRemote(r, dt);
  collide(R);
  for (const r of R.racers) placeOnGround(r, R);

  // Envia sua posição 20 vezes por segundo
  R.sendT -= dt;
  if (R.sendT <= 0) {
    R.sendT = 0.05;
    sendNet({ type: 'state', x: me.x, z: me.z, h: me.h, v: me.v, lap: me.lap, idx: me.idx });
  }

  // Câmera atrás do jogador seguindo a direção do carro; com V ela fica na frente olhando para trás
  R.camH += wrapAngle(me.h - R.camH) * (R.snap ? 1 : 1 - Math.pow(0.004, dt));
  const dir = R.rear ? -1 : 1;
  const fx = Math.sin(R.camH) * dir, fz = Math.cos(R.camH) * dir;
  const speedK = Math.abs(me.v) / me.maxV;
  const back = R.rear ? 9 : 10 + speedK * 2;
  const desired = new THREE.Vector3(me.x - fx * back, me.y + 3.6 + speedK * 0.6, me.z - fz * back);
  // olhando para trás o carro vem na direção da câmera: sem atraso, senão ele "encosta" na tela
  if (R.snap || R.rear) { camera.position.copy(desired); R.snap = false; }
  else camera.position.lerp(desired, 1 - Math.pow(0.0005, dt));
  const ahead = sampleAt(R.track, R.track.samples[me.idx].d + 6 * dir);
  camera.lookAt(me.x + fx * 6, Math.max(me.y, ahead.p.y) + 1.1, me.z + fz * 6);
  camera.fov = 50 + speedK * 12;
  camera.updateProjectionMatrix();

  // Sombra acompanha o jogador
  sun.position.set(me.x + 60, me.y + 110, me.z + 40);
  sun.target.position.set(me.x, me.y, me.z);

  // HUD
  const ord = order(R);
  const pos = ord.indexOf(me) + 1;
  $('#hudP').innerHTML = `P${pos}<small>/${R.racers.length}</small>`;
  $('#hudLap').textContent = `${clamp(me.lap + 1, 1, R.laps)} / ${R.laps}`;
  $('#hudSpeed').textContent = Math.round(Math.abs(me.v) * 3.6);
  $('#rev i').style.width = (clamp(Math.abs(me.v) / me.maxV, 0, 1) * 100) + '%';
  $('#hudTime').textContent = fmt(R.raceT);
  if (me.best != null) $('#hudBest').textContent = fmt(me.best);
  const wrong = R.phase === 'running' && me.v > 5 && Math.cos(me.h - me.s.h) < -0.3;
  $('#warn').style.display = wrong ? 'block' : 'none';

  R.boardT -= dt;
  if (R.boardT <= 0) {
    R.boardT = 0.25;
    $('#board').innerHTML = ord.map((r, i) => `<div class="${r.me ? 'me' : ''}"><b>${i + 1}</b>${esc(r.name)}</div>`).join('');
  }
  drawMini(R);
}

function drawMini(R) {
  const cv = $('#miniCv'), g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  g.drawImage(R.miniBg, 0, 0);
  for (const r of R.racers) {
    if (r.me) continue;
    const [x, y] = R.miniMap(r.x, r.z);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
  }
  const [x, y] = R.miniMap(R.me.x, R.me.z);
  g.fillStyle = '#e10600'; g.strokeStyle = '#fff'; g.lineWidth = 3;
  g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill(); g.stroke();
}

const tagV = new THREE.Vector3();
export function updateTags() {
  const R = race;
  if (!R || R.over) return;
  for (const r of R.racers) {
    tagV.set(r.x, r.y + r.tagH, r.z).project(camera);
    const dist = camera.position.distanceTo(r.obj.position);
    if (tagV.z > 1 || dist > 220) { r.tag.style.display = 'none'; continue; }
    r.tag.style.display = 'block';
    r.tag.style.left = ((tagV.x + 1) / 2 * innerWidth) + 'px';
    r.tag.style.top = ((1 - tagV.y) / 2 * innerHeight) + 'px';
    r.tag.style.opacity = clamp(1.4 - dist / 160, 0.35, 1);
  }
}

// ---------- Mensagens do servidor ----------
onNet('prepare', prepareRace);
onNet('countdown', () => {
  if (race && race.phase === 'waiting') { race.phase = 'countdown'; race.cd = 0; }
  else net.pending.countdown = true;
});
onNet('go', () => { if (race) race.go = true; else net.pending.go = true; });
onNet('states', m => {
  if (!race) return;
  for (const p of m.players) {
    const r = race.byId.get(p.id);
    if (r && !r.me) r.target = p;
  }
});
onNet('finished', m => {
  if (race) { const r = race.byId.get(m.id); if (r) { r.finished = true; r.finishT = m.time; } }
});
onNet('disconnect', () => {
  if (race) { state.room = null; endRace('mode'); showMsg('Conexão com o servidor perdida.'); }
  else if (['lobby', 'results'].includes(nav.current)) { state.room = null; goto('mode'); }
});

export function initRace() {
  $('#btnSair').addEventListener('click', leaveRace);
}
