// Telas de menu: intro, início, garagem, nome do piloto e escolha da sala
import { $, $$, esc, showMsg, LOAD_ERROR } from './util.js';
import { CARS, TRACKS, carOf, thumbOf, ratingOf, tierOf } from './data.js';
import { state, net, nav, goto, onNet } from './state.js';
import { setMenuCar, setView } from './showroom.js';
import { spawnCar } from './cars.js';
import { TRACK_OBJS, tracksReady, drawPreview } from './tracks.js';
import { createRoom, joinRoom } from './lobby.js';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
};
const stars = n => '★'.repeat(n) + '<i>' + '★'.repeat(5 - n) + '</i>';

// ---------- Carro no showroom ----------
let menuToken = 0;
async function previewCar(id) {
  const token = ++menuToken;
  let car;
  try { car = await spawnCar(id); }
  catch (e) { showMsg(LOAD_ERROR); return; }
  if (token === menuToken) setMenuCar(car);
}

function fillStats(prefix, c) {
  $(`#${prefix}Spd`).style.width = (c.spd * 100) + '%';
  $(`#${prefix}Acc`).style.width = (c.acc * 100) + '%';
  $(`#${prefix}Ctl`).style.width = (c.ctl * 100) + '%';
}

function setCar(id) {
  state.carId = id;
  store.set('or.car', id);
  const c = carOf(id), t = tierOf(c);
  $('#hcTier').textContent = 'Classe ' + t.cls;
  $('#hcTier').className = 'hc-tier t' + t.cls;
  $('#hcBrand').textContent = c.brand;
  $('#hcModel').textContent = c.name;
  $('#hcPr').textContent = ratingOf(c).toLocaleString('pt-BR');
  $('#hcStars').innerHTML = stars(t.stars);
  fillStats('hc', c);
}

// ---------- Intro ----------
function startIntro() {
  const v = $('#introVideo'), intro = $('#intro');
  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    v.pause();
    intro.classList.add('out');
    setTimeout(() => { intro.classList.remove('out'); goto('home'); }, 700);
  };
  v.addEventListener('ended', end);
  v.addEventListener('error', end);
  v.addEventListener('timeupdate', () => { if (v.duration && v.currentTime > v.duration - 3.4) intro.classList.add('logo-in'); });
  $('#introSkip').addEventListener('click', end);
  $('#introSound').addEventListener('click', () => {
    v.muted = !v.muted;
    $('#introSound').textContent = v.muted ? '🔇 Ativar som' : '🔊 Som ligado';
  });
  $('#introStart').addEventListener('click', () => { $('#introStart').hidden = true; v.play().catch(end); });
  addEventListener('keydown', e => { if (nav.current === 'intro' && ['Escape', 'Enter', ' '].includes(e.key)) end(); });
  goto('intro');
  v.play().catch(() => { $('#introStart').hidden = false; });
}

// ---------- Início ----------
function initHome() {
  $('#carCount').textContent = CARS.length;
  $('#btnPlay').addEventListener('click', () => { state.garageNext = 'name'; openGarage(); });
  $('#btnGarage').addEventListener('click', () => { state.garageNext = 'home'; openGarage(); });
  $('#btnChange').addEventListener('click', () => { state.garageNext = 'home'; openGarage(); });
  $('#btnHow').addEventListener('click', () => { $('#howto').hidden = false; });
  $('#howClose').addEventListener('click', () => { $('#howto').hidden = true; });
  startSparks();
}

// Faíscas subindo no fundo da tela inicial
function startSparks() {
  const cv = $('#sparks'), g = cv.getContext('2d');
  const sparks = [];
  let last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (nav.current !== 'home') return;
    if (cv.width !== innerWidth || cv.height !== innerHeight) { cv.width = innerWidth; cv.height = innerHeight; }
    if (sparks.length < 90 && Math.random() < 0.6) {
      sparks.push({ x: innerWidth * (0.35 + Math.random() * 0.65), y: innerHeight + 10, vx: -20 - Math.random() * 60, vy: -60 - Math.random() * 140, life: 2 + Math.random() * 3, t: 0, s: 1 + Math.random() * 2 });
    }
    g.clearRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx += Math.sin(p.t * 3 + i) * 8 * dt;
      if (p.t > p.life) { sparks.splice(i, 1); continue; }
      const a = 1 - p.t / p.life;
      g.fillStyle = `rgba(255,${120 + Math.floor(a * 90)},40,${a})`;
      g.fillRect(p.x, p.y, p.s, p.s * 2.5);
    }
    g.globalCompositeOperation = 'source-over';
  }
  requestAnimationFrame(tick);
}

// ---------- Garagem ----------
let gSel = null, gBrand = 'Todos';
const BRANDS = ['Todos', 'Bugatti', 'Koenigsegg', 'Lamborghini', 'McLaren', 'Ferrari', 'Outros'];
const MAIN = new Set(BRANDS.slice(1, -1));

function buildGarage() {
  $('#brandFilters').innerHTML = BRANDS.map(b => `<button class="chip${b === gBrand ? ' on' : ''}" data-brand="${b}">${b}</button>`).join('');
  $$('#brandFilters .chip').forEach(ch => ch.addEventListener('click', () => {
    gBrand = ch.dataset.brand;
    $$('#brandFilters .chip').forEach(c => c.classList.toggle('on', c === ch));
    $$('#carGrid .gcard').forEach(card => {
      const c = carOf(card.dataset.id);
      card.hidden = !(gBrand === 'Todos' || c.brand === gBrand || (gBrand === 'Outros' && !MAIN.has(c.brand)));
    });
    $('#carGrid').scrollLeft = 0;
  }));
  $('#carGrid').innerHTML = CARS.map(c => {
    const t = tierOf(c);
    return `<button class="gcard t${t.cls}" data-id="${esc(c.id)}">
      <div class="gc-top"><span class="stars">${stars(t.stars)}</span><span class="gc-cls">${t.cls}</span></div>
      <img src="${thumbOf(c.id)}" alt="" loading="lazy" onerror="this.classList.add('missing')">
      <div class="gc-pr"><small>PR</small>${ratingOf(c).toLocaleString('pt-BR')}</div>
      <div class="gc-name"><b>${esc(c.brand)}</b><span>${esc(c.name)}</span></div>
      <span class="gc-use">Em uso</span>
    </button>`;
  }).join('');
  $$('#carGrid .gcard').forEach(card => {
    card.addEventListener('click', () => selectGarage(card.dataset.id));
    card.addEventListener('dblclick', () => pickCar());
  });
  const scroll = d => $('#carGrid').scrollBy({ left: d * $('#carGrid').clientWidth * 0.8, behavior: 'smooth' });
  $('#gLeft').addEventListener('click', () => scroll(-1));
  $('#gRight').addEventListener('click', () => scroll(1));
  $('#carGrid').addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { $('#carGrid').scrollLeft += e.deltaY; e.preventDefault(); }
  }, { passive: false });
  $('#btnPick').addEventListener('click', pickCar);
  $('#btnInspect').addEventListener('click', () => inspect(true));
  $('#btnInspectBack').addEventListener('click', () => inspect(false));
}

function selectGarage(id) {
  gSel = id;
  const c = carOf(id), t = tierOf(c);
  $$('#carGrid .gcard').forEach(card => {
    card.classList.toggle('sel', card.dataset.id === id);
    card.classList.toggle('use', card.dataset.id === state.carId);
  });
  $('#gsBrand').textContent = c.brand;
  $('#gsModel').textContent = c.name;
  $('#gsStars').innerHTML = stars(t.stars);
  $('#gsPr').textContent = ratingOf(c).toLocaleString('pt-BR');
  fillStats('gs', c);
  if (document.body.classList.contains('inspecting')) previewCar(id);
}

function openGarage() {
  goto('garage');
  inspect(false);
  selectGarage(state.carId);
  $('#btnPick').textContent = state.garageNext === 'name' ? 'Escolher e continuar' : 'Escolher';
  $(`#carGrid .gcard[data-id="${CSS.escape(state.carId)}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

function inspect(on) {
  document.body.classList.toggle('inspecting', on);
  setView(on ? 'inspect' : 'garage');
  if (on) previewCar(gSel);
}

function pickCar() {
  setCar(gSel);
  previewCar(gSel);
  document.body.classList.remove('inspecting');
  if (state.garageNext === 'name') { goto('name'); $('#playerName').focus(); }
  else goto('home');
}

function leaveGarage() {
  if (document.body.classList.contains('inspecting')) { inspect(false); return; }
  previewCar(state.carId);
  goto('home');
}

// ---------- Nome, modo e salas ----------
function confirmName() {
  state.name = $('#playerName').value.trim().slice(0, 16) || 'Piloto';
  store.set('or.name', state.name);
  $('#homePilot').textContent = state.name;
  $('#modeName').textContent = state.name;
  goto('mode');
}

async function buildTrackCards() {
  await tracksReady;
  const grid = $('#trackGrid');
  TRACKS.forEach((def, i) => {
    const t = TRACK_OBJS.get(def.id);
    const card = document.createElement('button');
    card.className = 'tcard';
    card.innerHTML = `<canvas width="480" height="300"></canvas>
      <div class="tc-body">
        <div class="kicker">Pista ${i + 1} · ${esc(t.pais)}</div>
        <div class="tname">${esc(t.nome)}</div>
        <div class="tc-sub">${esc(t.ano)}</div>
        <div class="facts">
          <div><b>${(t.length / 1000).toFixed(2)}</b><small>km</small></div>
          <div><b>${t.curves}</b><small>curvas</small></div>
          <div><b>${t.laps}</b><small>voltas</small></div>
        </div>
        <span class="tc-go">Criar sala nesta pista ›</span>
      </div>`;
    drawPreview(card.querySelector('canvas'), t);
    card.addEventListener('click', () => createRoom(t));
    grid.appendChild(card);
  });
}

function renderRoomList() {
  const list = $('#roomList');
  const open = net.rooms;
  if (!open.length) {
    list.innerHTML = `<div class="rempty"><b>Nenhuma sala aberta agora.</b><span>Crie uma e chame os amigos!</span>
      <button class="btn small" id="emptyCreate">Criar sala</button></div>`;
    $('#emptyCreate').addEventListener('click', () => goto('create'));
    return;
  }
  list.innerHTML = open.map(r => {
    const t = TRACK_OBJS.get(r.track);
    const full = r.count >= 8;
    return `<button class="ritem" data-code="${esc(r.code)}" ${full ? 'disabled' : ''}>
      <canvas width="160" height="100" data-track="${esc(r.track)}"></canvas>
      <div class="ri-main"><b>${esc(t?.nome ?? r.track)}</b><small>${r.night ? 'Noturna · ' : ''}Anfitrião: ${esc(r.host)}</small></div>
      <div class="ri-code">${esc(r.code)}</div>
      <div class="ri-count">${r.count}<small>/8</small></div>
      <div class="ri-state ${r.phase === 'waiting' ? 'ok' : ''}">${full ? 'Cheia' : r.phase === 'waiting' ? 'Aguardando' : 'Correndo'}</div>
    </button>`;
  }).join('');
  $$('#roomList canvas').forEach(cv => { const t = TRACK_OBJS.get(cv.dataset.track); if (t) drawPreview(cv, t, { glow: false }); });
  $$('#roomList .ritem').forEach(b => b.addEventListener('click', () => joinRoom(b.dataset.code)));
}
onNet('rooms', () => { if (nav.current === 'join') renderRoomList(); });
onNet('welcome', () => { if (nav.current === 'join') renderRoomList(); });

const BACK = { name: () => goto('garage'), mode: () => goto('name'), create: () => goto('mode'), join: () => goto('mode'), garage: leaveGarage };

export function initMenus() {
  const savedCar = store.get('or.car');
  setCar(carOf(savedCar) ? savedCar : CARS[Math.floor(Math.random() * CARS.length)].id);
  previewCar(state.carId);
  state.name = store.get('or.name') ?? '';
  $('#playerName').value = state.name;
  $('#homePilot').textContent = state.name || 'Visitante';

  initHome();
  buildGarage();
  buildTrackCards();
  $$('[data-back]').forEach(b => b.addEventListener('click', () => BACK[nav.current]?.()));
  $('#nameOk').addEventListener('click', confirmName);
  $('#playerName').addEventListener('keydown', e => { if (e.key === 'Enter') confirmName(); });
  $('#btnCreate').addEventListener('click', () => goto('create'));
  $('#btnJoin').addEventListener('click', () => { goto('join'); renderRoomList(); $('#joinCode').focus(); });
  $('#joinCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });
  $('#joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(e.target.value); });
  $('#joinGo').addEventListener('click', () => joinRoom($('#joinCode').value));
  addEventListener('keydown', e => { if (e.key === 'Escape' && nav.current in BACK && e.target.tagName !== 'INPUT') BACK[nav.current](); });

  startIntro();
}
