// Renderizador, cena, câmera e luzes compartilhados por menus e corrida
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const canvas = document.createElement('canvas');
canvas.id = 'scene';
document.body.prepend(canvas);

export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

export const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
export const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envMap;

export function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export const studioBg = canvasTex(512, 512, (g, w, h) => {
  const gr = g.createRadialGradient(w * 0.55, h * 0.5, 10, w / 2, h / 2, w * 0.8);
  gr.addColorStop(0, '#2b2030'); gr.addColorStop(0.45, '#12111a'); gr.addColorStop(1, '#040407');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
export const skyBg = canvasTex(16, 512, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#2f6fc9'); gr.addColorStop(0.45, '#7fb0e6'); gr.addColorStop(0.5, '#d9e8f5'); gr.addColorStop(1, '#d9e8f5');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

export const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.3, 6000);
export const hemi = new THREE.HemisphereLight(0xdfefff, 0x3d5a2a, 0.7);
export const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
scene.add(hemi, sun, sun.target);

export function setShadowArea(size) {
  const c = sun.shadow.camera;
  c.left = c.bottom = -size; c.right = c.top = size; c.near = 1; c.far = 400;
  c.updateProjectionMatrix();
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
