'use strict';
// Servidor do jogo: entrega os arquivos de public/ e sincroniza os pilotos via WebSocket.
// Os jogadores criam salas (escolhendo a pista) ou entram numa sala existente pelo código.
// Fluxo de uma corrida:
//   waiting -> (anfitrião clica Iniciar) preparing -> (todos carregaram) countdown -> racing -> results -> waiting
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const TRACKS = { spa: { laps: 2 }, motegi: { laps: 2 }, hg: { laps: 4 } };   // mesmas voltas de public/js/data.js
// Carros válidos: todos os .glb de public/ e de public/NewCars
const CARS = new Set([
  ...fs.readdirSync(PUBLIC).filter(f => f.endsWith('.glb')),
  ...fs.readdirSync(path.join(PUBLIC, 'NewCars')).filter(f => f.endsWith('.glb')).map(f => 'NewCars/' + f),
]);
const MAX_PLAYERS = 8;
const MAX_ROOMS = 60;
const SAMPLES = 1500;                 // mesmo valor do cliente (usado só para ordenar quem não terminou)
const PREPARE_TIMEOUT_MS = 90000;     // tempo máximo esperando todos carregarem pista e carros
const COUNTDOWN_MS = 4600;            // duração do semáforo até o verde
const FINISH_GRACE_MS = 45000;        // depois do 1º chegar, os outros têm esse tempo para terminar
const MAX_RACE_MS = 15 * 60 * 1000;
const TICK_MS = 50;                   // envio das posições (20 vezes por segundo)

const app = express();
app.get('/healthz', (req, res) => res.send('ok'));
app.use(express.static(PUBLIC, {
  maxAge: '7d',
  setHeaders(res, file) { if (/\.(html|js|css|json)$/.test(file)) res.setHeader('Cache-Control', 'no-cache'); },
}));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, maxPayload: 2048 });

const rooms = new Map();   // código -> sala
let nextId = 1;

const cleanName = s => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Piloto';
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do code = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join(''); while (rooms.has(code));
  return code;
}

function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function broadcast(room, msg) {
  const s = JSON.stringify(msg);
  for (const p of room.players.values()) if (p.ws.readyState === 1) p.ws.send(s);
}
const roomList = () => [...rooms.values()].map(r => ({
  code: r.code, track: r.track, count: r.players.size, phase: r.phase, host: r.players.get(r.hostId)?.name ?? '',
}));
function broadcastRooms() {
  const s = JSON.stringify({ type: 'rooms', rooms: roomList() });
  for (const c of wss.clients) if (c.readyState === 1) c.send(s);
}
function lobby(room) {
  return {
    type: 'lobby', room: room.code, track: room.track, laps: room.laps, phase: room.phase, hostId: room.hostId,
    players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, carId: p.carId, racing: p.racing })),
  };
}
const racers = room => [...room.players.values()].filter(p => p.racing);
function clearTimers(room) { room.timers.forEach(clearTimeout); room.timers = []; }
function later(room, ms, fn) { room.timers.push(setTimeout(fn, ms)); }

function resetRoom(room) {
  clearTimers(room);
  room.phase = 'waiting';
  for (const p of room.players.values()) Object.assign(p, { racing: false, ready: false, finished: false });
}

function prepareRace(room) {
  clearTimers(room);
  room.phase = 'preparing';
  const grid = [...room.players.values()].map((p, slot) => {
    Object.assign(p, { racing: true, ready: false, finished: false, finishT: null, lap: -1, idx: 0, x: null, slot });
    return { id: p.id, name: p.name, carId: p.carId, slot };
  });
  broadcast(room, { type: 'prepare', laps: room.laps, grid });
  broadcast(room, lobby(room));
  broadcastRooms();
  later(room, PREPARE_TIMEOUT_MS, () => beginCountdown(room));
}

function beginCountdown(room) {
  if (room.phase !== 'preparing') return;
  clearTimers(room);
  room.phase = 'countdown';
  broadcast(room, { type: 'countdown' });
  later(room, COUNTDOWN_MS, () => {
    room.phase = 'racing';
    room.startAt = Date.now();
    broadcast(room, { type: 'go' });
    later(room, MAX_RACE_MS, () => endRace(room));
  });
}

function endRace(room) {
  if (room.phase === 'waiting') return;
  const list = racers(room).sort((a, b) => {
    if (a.finished && b.finished) return a.finishT - b.finishT;
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    return (b.lap * SAMPLES + b.idx) - (a.lap * SAMPLES + a.idx);
  });
  broadcast(room, {
    type: 'results',
    ranking: list.map(p => ({ id: p.id, name: p.name, carId: p.carId, time: p.finished ? p.finishT : null })),
  });
  resetRoom(room);
  broadcast(room, lobby(room));
  broadcastRooms();
}

function leave(client) {
  const room = client.room && rooms.get(client.room);
  if (!room) return;
  room.players.delete(client.id);
  client.room = null;
  client.racing = false;
  if (!room.players.size) {
    clearTimers(room);
    rooms.delete(room.code);
    broadcastRooms();
    return;
  }
  if (room.hostId === client.id) room.hostId = room.players.keys().next().value;
  if (room.phase !== 'waiting') {
    const rs = racers(room);
    if (!rs.length) resetRoom(room);
    else if (room.phase === 'preparing' && rs.every(p => p.ready)) beginCountdown(room);
    else if (room.phase === 'racing' && rs.every(p => p.finished)) endRace(room);
  }
  broadcast(room, lobby(room));
  broadcastRooms();
}

function enter(client, room, m) {
  Object.assign(client, { name: cleanName(m.name), carId: m.carId, racing: false, ready: false, finished: false, room: room.code });
  room.players.set(client.id, client);
  if (!room.hostId) room.hostId = client.id;
  broadcast(room, lobby(room));
  broadcastRooms();
}

function handle(client, m) {
  const room = client.room && rooms.get(client.room);
  switch (m?.type) {
    case 'create': {
      if (!TRACKS[m.track]) return;
      if (!CARS.has(m.carId)) return send(client.ws, { type: 'error', text: 'Carro inválido.' });
      leave(client);
      if (rooms.size >= MAX_ROOMS) return send(client.ws, { type: 'error', text: 'Muitas salas abertas. Entre numa sala existente.' });
      const r = { code: newCode(), track: m.track, laps: TRACKS[m.track].laps, phase: 'waiting', players: new Map(), hostId: null, startAt: 0, timers: [] };
      rooms.set(r.code, r);
      enter(client, r, m);
      break;
    }
    case 'join': {
      if (!CARS.has(m.carId)) return send(client.ws, { type: 'error', text: 'Carro inválido.' });
      const target = rooms.get(String(m.room ?? '').toUpperCase());
      if (!target) return send(client.ws, { type: 'error', text: 'Sala não encontrada. Confira o código.' });
      if (client.room !== target.code) {
        leave(client);
        if (target.players.size >= MAX_PLAYERS) return send(client.ws, { type: 'error', text: 'Sala cheia. Escolha outra.' });
      }
      enter(client, target, m);
      break;
    }
    case 'leave':
      leave(client);
      break;
    case 'start':
      if (room && room.hostId === client.id && room.phase === 'waiting') prepareRace(room);
      break;
    case 'ready':
      if (room && room.phase === 'preparing' && client.racing) {
        client.ready = true;
        if (racers(room).every(p => p.ready)) beginCountdown(room);
      }
      break;
    case 'state':
      if (room && client.racing && (room.phase === 'countdown' || room.phase === 'racing')) {
        client.x = num(m.x); client.z = num(m.z); client.h = num(m.h); client.v = num(m.v);
        client.lap = Math.trunc(num(m.lap)); client.idx = Math.trunc(num(m.idx)) % SAMPLES;
      }
      break;
    case 'finish':
      if (room && room.phase === 'racing' && client.racing && !client.finished && Math.trunc(num(m.lap)) >= room.laps) {
        client.lap = room.laps;
        client.finished = true;
        client.finishT = (Date.now() - room.startAt) / 1000;
        broadcast(room, { type: 'finished', id: client.id, time: client.finishT });
        const rs = racers(room);
        if (rs.every(p => p.finished)) endRace(room);
        else if (rs.filter(p => p.finished).length === 1) later(room, FINISH_GRACE_MS, () => endRace(room));
      }
      break;
  }
}

wss.on('connection', ws => {
  const client = { id: nextId++, ws, room: null, racing: false };
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', data => {
    let m;
    try { m = JSON.parse(data); } catch { return; }
    handle(client, m);
  });
  ws.on('close', () => leave(client));
  send(ws, { type: 'welcome', id: client.id, rooms: roomList() });
});

// Posições de todos os pilotos de cada sala em corrida
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.phase !== 'countdown' && room.phase !== 'racing') continue;
    const players = racers(room).filter(p => p.x != null)
      .map(p => ({ id: p.id, x: p.x, z: p.z, h: p.h, v: p.v, lap: p.lap, idx: p.idx, fin: p.finished }));
    if (players.length) broadcast(room, { type: 'states', players });
  }
}, TICK_MS);

// Derruba conexões mortas (o Render fecha conexões ociosas)
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

server.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
