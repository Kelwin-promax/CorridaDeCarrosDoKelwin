// Estado compartilhado entre as telas, navegação e conexão com o servidor
import { $$ } from './util.js';
import { menuRoot, enterMenuLook, setView } from './showroom.js';

export const state = {
  name: '',
  carId: null,
  room: null,        // código da sala atual
  track: null,       // id da pista da sala atual
  garageNext: 'home' // para onde a garagem vai depois de escolher o carro
};

// ---------- Navegação ----------
export const nav = { current: 'intro' };
// câmera do showroom em cada tela (telas sem entrada mostram o showroom com a câmera "lobby")
const CAMERA = { intro: 'intro', home: 'home', garage: 'garage', name: 'name', mode: 'name', create: 'lobby', join: 'lobby', lobby: 'lobby' };

export function show(id) {
  nav.current = id;
  $$('.screen, .hud').forEach(s => s.classList.toggle('active', s.id === id));
  document.body.dataset.screen = id;
  document.body.classList.toggle('racing', id === 'race');
}
export function goto(id) {
  show(id);
  if (id in CAMERA) {
    if (!menuRoot.visible) enterMenuLook();
    setView(CAMERA[id]);
  }
}

// ---------- Rede (multiplayer) ----------
// O servidor (server.js) controla as salas, o início da corrida e o resultado.
// Cada cliente simula o próprio carro e envia a posição; os outros carros vêm do servidor.
export const net = { ws: null, id: null, ok: false, lobby: null, rooms: [], pending: { countdown: false, go: false } };
const handlers = {};
export const onNet = (type, fn) => (handlers[type] ??= []).push(fn);

export function connect() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
  net.ws = ws;
  ws.onopen = () => setNet(true);
  ws.onclose = () => {
    setNet(false);
    net.lobby = null;
    handlers.disconnect?.forEach(fn => fn());
    setTimeout(connect, 2000);
  };
  ws.onmessage = e => {
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    handlers[m.type]?.forEach(fn => fn(m));
  };
}
export function sendNet(m) { if (net.ws?.readyState === 1) net.ws.send(JSON.stringify(m)); }
function setNet(ok) {
  net.ok = ok;
  $$('.netStatus').forEach(el => {
    el.textContent = ok ? '● Online' : '○ Conectando...';
    el.classList.toggle('off', !ok);
  });
}
onNet('welcome', m => { net.id = m.id; net.rooms = m.rooms; });
onNet('rooms', m => { net.rooms = m.rooms; });
