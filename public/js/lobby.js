// Salas: criar, entrar e a sala de espera antes da largada
import { $, esc, pad2, showMsg } from './util.js';
import { carName, thumbOf } from './data.js';
import { state, net, goto, nav, sendNet, onNet } from './state.js';
import { TRACK_OBJS, drawPreview } from './tracks.js';
import { race, dropMissing } from './race.js';

const MAX_PLAYERS = 8;
let joining = false;   // esperando o servidor confirmar a entrada (o código da sala nova vem do servidor)

function canPlay() {
  if (net.ok) return true;
  showMsg('Sem conexão com o servidor. Inicie o jogo com "npm start".');
  return false;
}

export function createRoom(track) {
  if (!canPlay()) return;
  joining = 'create';
  state.room = null;
  state.track = track.id;
  net.lobby = null;
  sendNet({ type: 'create', track: track.id, name: state.name, carId: state.carId });
  goto('lobby');
  renderLobby();
}

export function joinRoom(code) {
  code = String(code).trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) { showMsg('O código da sala tem 4 letras.'); return; }
  if (!canPlay()) return;
  joining = 'join';
  state.room = code;
  state.track = net.rooms.find(r => r.code === code)?.track ?? null;
  net.lobby = null;
  sendNet({ type: 'join', room: code, name: state.name, carId: state.carId });
  goto('lobby');
  renderLobby();
}

export function leaveRoom(to = 'mode') {
  sendNet({ type: 'leave' });
  state.room = null;
  net.lobby = null;
  goto(to);
}

onNet('lobby', m => {
  if (joining && (joining === 'create' || m.room === state.room)) joining = false;
  else if (m.room !== state.room) return;
  state.room = m.room;
  state.track = m.track;
  net.lobby = m;
  if (race) dropMissing(m.players);
  if (nav.current === 'lobby') renderLobby();
});
onNet('error', m => {
  showMsg(m.text);
  if (nav.current === 'lobby') { goto(joining === 'join' ? 'join' : 'mode'); state.room = null; }
  joining = false;
});

let mapFor = null;
export function renderLobby() {
  const L = net.lobby;
  const t = TRACK_OBJS.get(state.track);
  $('#lbKicker').textContent = state.room ? `Sala ${state.room}${t ? ' · ' + t.pais : ''}` : 'Criando sala...';
  $('#lbTitle').textContent = t ? t.nome : 'Carregando...';
  $('#lbCode').textContent = state.room ?? '----';
  if (t && mapFor !== t.id) { drawPreview($('#lbMap'), t); mapFor = t.id; }
  $('#lbFacts').innerHTML = t ? `
    <div><b>${(t.length / 1000).toFixed(2)}</b><small>km</small></div>
    <div><b>${t.curves}</b><small>curvas</small></div>
    <div><b>${L?.laps ?? t.laps}</b><small>voltas</small></div>` : '';
  if (!L) {
    $('#lbSub').innerHTML = '<span class="dots">Entrando na sala</span>';
    $('#lbPlayers').innerHTML = '';
    $('#lbCount').textContent = '';
    $('#btnStart').style.display = 'none';
    return;
  }
  const host = L.hostId === net.id;
  $('#lbCount').textContent = `${L.players.length} / ${MAX_PLAYERS}`;
  const meRacing = L.players.some(p => p.id === net.id && p.racing);
  $('#lbSub').innerHTML = L.phase !== 'waiting'
    ? `<span class="dots">${meRacing ? 'Preparando a largada' : 'Corrida em andamento. Você entra na próxima largada'}</span>`
    : host ? 'Você é o anfitrião. Inicie quando todos estiverem na sala.'
      : '<span class="dots">Aguardando o anfitrião iniciar a corrida</span>';
  const slots = [];
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const p = L.players[i];
    slots.push(p ? `
      <div class="slot${p.id === net.id ? ' me' : ''}">
        <b class="num">${pad2(i + 1)}</b>
        <img src="${thumbOf(p.carId)}" alt="" onerror="this.style.visibility='hidden'">
        <div class="who"><span class="pn">${esc(p.name)}</span><span class="pc">${esc(carName(p.carId))}</span></div>
        <div class="badges">
          ${p.id === L.hostId ? '<span class="badge">Anfitrião</span>' : ''}
          ${p.id === net.id ? '<span class="badge you">Você</span>' : ''}
        </div>
      </div>` : `<div class="slot empty"><b class="num">${pad2(i + 1)}</b><span>Vaga livre</span></div>`);
  }
  $('#lbPlayers').innerHTML = slots.join('');
  $('#btnStart').style.display = host && L.phase === 'waiting' ? '' : 'none';
}

export function initLobby() {
  $('#btnStart').addEventListener('click', () => sendNet({ type: 'start' }));
  $('#btnLeave').addEventListener('click', () => leaveRoom());
  $('#btnCopy').addEventListener('click', async () => {
    if (!state.room) return;
    try { await navigator.clipboard.writeText(state.room); $('#btnCopy').textContent = 'Copiado!'; }
    catch { $('#btnCopy').textContent = state.room; }
    setTimeout(() => { $('#btnCopy').textContent = 'Copiar'; }, 1500);
  });
}
