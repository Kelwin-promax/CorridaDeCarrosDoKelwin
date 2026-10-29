// Showroom 3D dos menus: o carro escolhido num palco com luzes, e a câmera de cada tela
import * as THREE from 'three';
import { scene, camera, sun, hemi, studioBg, canvasTex, setShadowArea } from './engine.js';

export const menuRoot = new THREE.Group();
const floorTex = canvasTex(1024, 1024, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, '#1d1d24'); gr.addColorStop(0.7, '#0d0d12'); gr.addColorStop(1, '#050507');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 2;
  for (let i = 0; i <= w; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
});
const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 96), new THREE.MeshStandardMaterial({ map: floorTex, metalness: 0.7, roughness: 0.28 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
const turntable = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.7, 0.12, 96), new THREE.MeshStandardMaterial({ color: 0x15151b, metalness: 0.85, roughness: 0.25 }));
turntable.position.y = 0.06;
turntable.receiveShadow = true;
const neon = new THREE.Mesh(new THREE.TorusGeometry(3.68, 0.035, 8, 160), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
neon.rotation.x = -Math.PI / 2;
neon.position.y = 0.1;
const ring2 = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.02, 8, 160), new THREE.MeshBasicMaterial({ color: 0x5a2a2a }));
ring2.rotation.x = -Math.PI / 2;
ring2.position.y = 0.01;

// Arco de barras de luz atrás do carro
const bars = new THREE.Group();
const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const redMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
for (let i = 0; i < 13; i++) {
  const a = Math.PI * (0.15 + 0.7 * i / 12);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.4 + (i % 2) * 0.8, 0.08), i % 3 === 1 ? redMat : barMat);
  bar.position.set(Math.cos(a) * 9.5, 2.2, -Math.sin(a) * 9.5);
  bars.add(bar);
}
const spot = new THREE.SpotLight(0xffffff, 160, 30, 0.55, 0.6);
spot.position.set(0, 11, 3);
spot.castShadow = true;
spot.shadow.mapSize.set(1024, 1024);
const rimRed = new THREE.PointLight(0xff3b30, 40, 22);
rimRed.position.set(-6, 2.2, -3);
const rimBlue = new THREE.PointLight(0x3b7bff, 26, 22);
rimBlue.position.set(6, 2.5, -2);
export const carHolder = new THREE.Group();   // só o carro gira
const stage = new THREE.Group();
stage.add(turntable, neon, carHolder);
menuRoot.add(floor, ring2, bars, spot, spot.target, rimRed, rimBlue, stage);
scene.add(menuRoot);

// Câmera de cada tela: pos/look em relação ao palco; x desloca o palco na tela larga
const VIEWS = {
  intro:  { pos: [0, 1.6, 9], look: [0, 0.8, 0], x: 0, fov: 40, spin: 0.25 },
  home:   { pos: [-2.6, 1.15, 5.4], look: [0.4, 0.55, 0], x: 2.3, fov: 38, spin: 0.22 },
  garage: { pos: [0, 2.8, 11], look: [0, 0.9, 0], x: 0, fov: 42, spin: 0.3 },
  inspect:{ pos: [0, 1.5, 7.2], look: [0, 0.65, 0], x: -1.2, fov: 40, spin: 0.35 },
  name:   { pos: [-1.5, 1.4, 6.8], look: [0.4, 0.6, 0], x: 2.6, fov: 40, spin: 0.25 },
  lobby:  { pos: [0, 2.2, 9.5], look: [0, 0.8, 0], x: 0, fov: 42, spin: 0.25 },
};
const camPos = new THREE.Vector3(0, 2, 10), camLook = new THREE.Vector3(0, 0.8, 0);
let view = VIEWS.intro, rootX = 0, snap = true;

export function setView(name) { view = VIEWS[name] ?? VIEWS.lobby; }

export function enterMenuLook() {
  menuRoot.visible = true;
  scene.background = studioBg;
  scene.fog = null;
  sun.intensity = 0.6;
  hemi.intensity = 0.35;
  sun.position.set(6, 14, 8);
  sun.target.position.set(0, 0, 0);
  setShadowArea(8);
  snap = true;
}

export function setMenuCar(obj) {
  carHolder.clear();
  carHolder.add(obj);
}

export function updateShowroom(dt) {
  if (!menuRoot.visible) return;
  carHolder.rotation.y += dt * view.spin;
  const wide = innerWidth > 820;
  const wantX = wide ? view.x : 0;
  const k = snap ? 1 : 1 - Math.pow(0.02, dt);
  rootX += (wantX - rootX) * k;
  stage.position.x = rootX;
  camPos.lerp(new THREE.Vector3(...view.pos), k);
  camLook.lerp(new THREE.Vector3(...view.look), k);
  snap = false;
  camera.position.copy(camPos);
  camera.fov += (view.fov * (wide ? 1 : 1.25) - camera.fov) * k;
  camera.updateProjectionMatrix();
  camera.lookAt(camLook.x + (wide ? 0 : 0), camLook.y, camLook.z);
  neon.material.color.setHSL(0.005, 1, 0.5 + 0.08 * Math.sin(performance.now() / 400));
}
