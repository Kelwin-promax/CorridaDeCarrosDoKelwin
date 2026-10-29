// Carregamento e ajuste dos modelos dos carros
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { CAR_LEN, carOf } from './data.js';
import { wrapAngle } from './util.js';

export const gltfLoader = new GLTFLoader();
const carCache = new Map();

// Ângulo (no plano XZ) do eixo mais comprido do carro, calculado pelos vértices.
// Funciona mesmo quando o modelo vem girado na diagonal.
function longAxisAngle(model) {
  const v = new THREE.Vector3();
  let n = 0, mx = 0, mz = 0, sxx = 0, szz = 0, sxz = 0;
  const pts = [];
  model.traverse(o => {
    if (!o.isMesh || !o.geometry.attributes.position) return;
    const pos = o.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pos.count / 4000));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      pts.push(v.x, v.z);
    }
  });
  for (let i = 0; i < pts.length; i += 2) { mx += pts[i]; mz += pts[i + 1]; n++; }
  if (!n) return Math.PI / 2;
  mx /= n; mz /= n;
  for (let i = 0; i < pts.length; i += 2) {
    const dx = pts[i] - mx, dz = pts[i + 1] - mz;
    sxx += dx * dx; szz += dz * dz; sxz += dx * dz;
  }
  return 0.5 * Math.atan2(2 * sxz, sxx - szz);   // ângulo a partir do eixo X
}

// Alguns modelos trazem malhas de "brilho" dos faróis que se estendem bem além da carroceria
// (aparecem como uma barra escura e deixam o carro pequeno). Remove as que saem da carroceria.
function dropStrayGlows(src) {
  const body = new THREE.Box3(), glows = [];
  src.traverse(o => {
    if (!o.isMesh) return;
    if (/glow|beam|flare/i.test(o.name)) glows.push(o);
    else body.expandByObject(o);
  });
  if (body.isEmpty()) return;
  body.expandByVector(body.getSize(new THREE.Vector3()).multiplyScalar(0.04));
  for (const g of glows) if (!body.containsBox(new THREE.Box3().setFromObject(g))) g.removeFromParent();
}

// Ajusta o modelo: comprimento no eixo Z, tamanho padrão e base no chão (y = 0)
function normalizeCar(gltf, rot = 0, pca = false) {
  const src = gltf.scene;
  src.updateMatrixWorld(true);
  dropStrayGlows(src);
  // Alinha o eixo comprido com Z. Por padrão usa a caixa do modelo; modelos que vêm
  // girados na diagonal (opção "pca") usam o eixo calculado pelos vértices.
  let turn;
  if (pca) {
    turn = wrapAngle(longAxisAngle(src) - Math.PI / 2);
    if (turn > Math.PI / 2) turn -= Math.PI;
    if (turn < -Math.PI / 2) turn += Math.PI;
  } else {
    const size = new THREE.Box3().setFromObject(src).getSize(new THREE.Vector3());
    turn = size.x > size.z ? Math.PI / 2 : 0;
  }
  const model = new THREE.Group();
  model.add(src);
  model.rotation.y = turn + rot;
  model.updateMatrixWorld(true);
  const size2 = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  model.scale.setScalar(CAR_LEN / Math.max(size2.x, size2.z));
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  model.position.set(-c.x, -box.min.y, -c.z);
  model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const root = new THREE.Group();
  root.add(model);
  return root;
}

// Alguns modelos vêm com a porta aberta e trazem uma animação de fechar (ex.: Ferrari 296).
// Aplica o último quadro dessa animação para o carro ficar com a porta fechada.
function closeDoors(gltf) {
  const clip = gltf.animations.find(a => /close/i.test(a.name));
  if (!clip) return;
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  mixer.update(clip.duration);
}

export function loadCar(id) {
  if (!carCache.has(id)) {
    const car = carOf(id);
    carCache.set(id, new Promise((ok, fail) => {
      gltfLoader.load(id, g => { closeDoors(g); ok(normalizeCar(g, car?.rot ?? 0, car?.pca)); }, undefined, () => {
        carCache.delete(id);
        fail(new Error('Falha ao carregar ' + id));
      });
    }));
  }
  return carCache.get(id);
}

export async function spawnCar(id) {
  // SkeletonUtils.clone copia também os ossos: alguns carros (ex.: Ferraris) têm malhas com esqueleto,
  // e com clone() comum eles ficavam desenhados parados num ponto fixo da pista.
  return cloneSkinned(await loadCar(id));
}
