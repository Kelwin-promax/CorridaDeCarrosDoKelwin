// Utilidades gerais
export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
export const fmt = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pad2 = n => String(n).padStart(2, '0');

// Cria elementos a partir de um trecho de HTML
export function html(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.childElementCount === 1 ? t.content.firstElementChild : t.content;
}

export function showMsg(text) {
  const m = $('#msg');
  m.textContent = text;
  m.classList.add('show');
  clearTimeout(showMsg.t);
  showMsg.t = setTimeout(() => m.classList.remove('show'), 6000);
}

export function showLoading(on, text = 'Carregando...', progress = null) {
  $('#loadingText').textContent = text;
  $('#loading').classList.toggle('show', on);
  const bar = $('#loadingBar');
  bar.style.display = progress == null ? 'none' : 'block';
  if (progress != null) bar.firstElementChild.style.width = Math.round(progress * 100) + '%';
}

export const LOAD_ERROR = 'Não foi possível carregar os modelos. Inicie o jogo pelo servidor (npm start).';
