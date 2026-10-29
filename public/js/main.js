// Overdrive Rivals: ponto de entrada. Monta as telas, conecta ao servidor e roda o loop de desenho.
import { mountUI } from './ui.js';
mountUI();   // antes dos outros módulos usarem os elementos da página

const { renderer, scene, camera } = await import('./engine.js');
const { updateShowroom } = await import('./showroom.js');
const { connect } = await import('./state.js');
const { updateRace, updateTags, initRace } = await import('./race.js');
const { initLobby } = await import('./lobby.js');
const { initResults } = await import('./results.js');
const { initMenus } = await import('./menus.js');

initRace();
initLobby();
initResults();
initMenus();
connect();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  updateShowroom(dt);
  updateRace(dt);
  updateTags();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
