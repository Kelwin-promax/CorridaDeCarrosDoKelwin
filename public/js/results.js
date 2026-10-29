// Pódio com os 3 melhores (o resultado vem do servidor)
import { $, esc, fmt } from './util.js';
import { carName } from './data.js';
import { state, net, show, goto, onNet } from './state.js';
import { TRACK_OBJS } from './tracks.js';
import { race, clearRace } from './race.js';
import { renderLobby, leaveRoom } from './lobby.js';

function showResults(ranking) {
  const pos = ranking.findIndex(p => p.id === net.id) + 1;
  if (!pos) return;
  if (race) race.over = true;
  $('#labels').style.display = 'none';
  $('#finishMsg').style.display = 'none';
  $('#rearTag').style.display = 'none';
  const t = TRACK_OBJS.get(state.track);
  const top = ranking.slice(0, 3);
  $('#podium').innerHTML = [1, 0, 2].filter(i => top[i]).map(i => {
    const p = top[i];
    return `<div class="step s${i + 1}${p.id === net.id ? ' me' : ''}">
      <div class="who">
        ${i === 0 ? '<div class="crown">🏆</div>' : ''}
        <div class="pname">${esc(p.name)}</div>
        <div class="pcar">${esc(carName(p.carId))}</div>
        <div class="ptime">${p.time != null ? fmt(p.time) : 'não terminou'}</div>
      </div>
      <div class="block"><span>${i + 1}</span></div>
    </div>`;
  }).join('');
  $('#resTrack').textContent = `${t.nome} · ${t.pais}`;
  $('#resTitle').textContent = pos === 1 ? 'Vitória!' : pos <= 3 ? 'Você está no pódio!' : 'Fim da corrida';
  $('#resSub').textContent = pos <= 3 ? `Você terminou em ${pos}º lugar.` : `Você terminou em ${pos}º lugar. Tente de novo!`;
  show('results');
}

onNet('results', m => showResults(m.ranking));

export function initResults() {
  $('#btnBackLobby').addEventListener('click', () => { clearRace(); goto('lobby'); renderLobby(); });
  $('#btnMenu').addEventListener('click', () => { clearRace(); leaveRoom('home'); });
}
