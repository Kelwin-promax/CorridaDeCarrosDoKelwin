// Física contra a malha real da pista: altura do chão (com pontes e túneis) e muros
import * as THREE from 'three';

const CELL = 20;        // tamanho da célula da grade espacial, em metros
const STEP_UP = 1.5;    // o carro sobe até essa altura de uma vez; acima disso é outro nível (ponte, teto)
const SEARCH = 3;       // sem chão abaixo, aceita um nível até essa distância
const CAR_R = 1.15;     // raio do carro contra os muros
const WALL_LOW = 0.25, WALL_HIGH = 1.4;   // faixa de altura do carro que encosta nos muros
const LINE_CLEAR = 2.5; // muros a menos disso do traçado são enfeites do modelo, não barreiras

const key = (x, z) => Math.floor(x / CELL) * 100000 + Math.floor(z / CELL);

function addToGrid(grid, item, xa, xb, za, zb) {
  for (let x = Math.floor(xa / CELL); x <= Math.floor(xb / CELL); x++) {
    for (let z = Math.floor(za / CELL); z <= Math.floor(zb / CELL); z++) {
      const k = x * 100000 + z;
      let list = grid.get(k);
      if (!list) grid.set(k, list = []);
      list.push(item);
    }
  }
}

export function buildSurface(track, scene) {
  const ground = new Map(), walls = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    if (!o.isMesh) return;
    const name = (Array.isArray(o.material) ? o.material[0] : o.material).name;
    const road = track.road.test(name), solid = road || track.ground.test(name), wall = track.walls.test(name);
    if (!solid && !wall) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index;
    const count = idx ? idx.count : pos.count;
    for (let t = 0; t < count; t += 3) {
      a.fromBufferAttribute(pos, idx ? idx.getX(t) : t).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(pos, idx ? idx.getX(t + 1) : t + 1).applyMatrix4(o.matrixWorld);
      c.fromBufferAttribute(pos, idx ? idx.getX(t + 2) : t + 2).applyMatrix4(o.matrixWorld);
      const nx = (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y);
      const ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
      const nz = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const flat = Math.abs(ny) / (Math.hypot(nx, ny, nz) || 1);
      if (solid && flat > 0.5) {
        addToGrid(ground, { ax: a.x, ay: a.y, az: a.z, bx: b.x, by: b.y, bz: b.z, cx: c.x, cy: c.y, cz: c.z, road },
          Math.min(a.x, b.x, c.x), Math.max(a.x, b.x, c.x), Math.min(a.z, b.z, c.z), Math.max(a.z, b.z, c.z));
      }
      if (wall && flat < 0.5) {
        // um muro visto de cima é uma linha: fica com a aresta mais comprida no plano
        const edges = [[a, b], [b, c], [c, a]];
        const len = ([p, q]) => Math.hypot(p.x - q.x, p.z - q.z);
        const [p, q] = edges.reduce((m, e) => len(e) > len(m) ? e : m);
        if (len([p, q]) < 0.05) continue;
        addWall(walls, p.x, p.z, q.x, q.z, Math.min(a.y, b.y, c.y), Math.max(a.y, b.y, c.y));
      }
    }
  });

  const surface = { ground, walls };
  clearLine(surface, track);
  surface.start = startEdges(surface, track);
  addGantryPosts(surface, track);
  return surface;
}

function addWall(walls, ax, az, bx, bz, y0, y1) {
  const seg = { ax, az, bx, bz, y0, y1, off: false };
  const m = CAR_R + 0.5;
  addToGrid(walls, seg, Math.min(ax, bx) - m, Math.max(ax, bx) + m, Math.min(az, bz) - m, Math.max(az, bz) + m);
}

function closest(seg, x, z) {
  const dx = seg.bx - seg.ax, dz = seg.bz - seg.az;
  const u = Math.max(0, Math.min(1, ((x - seg.ax) * dx + (z - seg.az) * dz) / (dx * dx + dz * dz)));
  return [seg.ax + dx * u, seg.az + dz * u];
}

// O traçado nunca fica bloqueado: desliga o que o modelo tiver posto em cima dele
function clearLine(surface, track) {
  for (const s of track.samples) {
    for (const seg of surface.walls.get(key(s.p.x, s.p.z)) ?? []) {
      if (seg.off || seg.y1 < s.p.y + WALL_LOW || seg.y0 > s.p.y + WALL_HIGH) continue;
      const [px, pz] = closest(seg, s.p.x, s.p.z);
      if (Math.hypot(px - s.p.x, pz - s.p.z) < LINE_CLEAR) seg.off = true;
    }
  }
}

// Altura da superfície em (x, z) no nível de quem está na altura y.
// Pega o chão mais alto que dá para alcançar, então a ponte acima de um túnel não conta.
export function surfaceAt(surface, x, z, y) {
  let best = null, bestAbove = null, road = false;
  for (const t of surface.ground.get(key(x, z)) ?? []) {
    const det = (t.bz - t.cz) * (t.ax - t.cx) + (t.cx - t.bx) * (t.az - t.cz);
    if (Math.abs(det) < 1e-9) continue;
    const w0 = ((t.bz - t.cz) * (x - t.cx) + (t.cx - t.bx) * (z - t.cz)) / det;
    const w1 = ((t.cz - t.az) * (x - t.cx) + (t.ax - t.cx) * (z - t.cz)) / det;
    const w2 = 1 - w0 - w1;
    if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
    const h = w0 * t.ay + w1 * t.by + w2 * t.cy;
    if (h <= y + STEP_UP) {
      if (best == null || h > best + 0.05) { best = h; road = t.road; }
      else if (t.road && h > best - 0.05) road = true;
    } else if (bestAbove == null || h < bestAbove) { bestAbove = h; }
  }
  if (best != null && y - best <= SEARCH) return { y: best, road };
  if (bestAbove != null && bestAbove - y <= SEARCH) return { y: bestAbove, road: false };
  return best != null ? { y: best, road } : null;
}

// Empurra o carro para fora dos muros; devolve a normal da batida, se houve
export function hitWalls(surface, r) {
  let hit = null;
  for (const seg of surface.walls.get(key(r.x, r.z)) ?? []) {
    if (seg.off || seg.y1 < r.y + WALL_LOW || seg.y0 > r.y + WALL_HIGH) continue;
    const [px, pz] = closest(seg, r.x, r.z);
    const dx = r.x - px, dz = r.z - pz, d = Math.hypot(dx, dz);
    if (d >= CAR_R || d < 1e-5) continue;
    const nx = dx / d, nz = dz / d;
    r.x += nx * (CAR_R - d);
    r.z += nz * (CAR_R - d);
    hit = { nx, nz };
  }
  return hit;
}

// Bordas do asfalto na linha de largada, medidas na malha: base do pórtico e do grid
function startEdges(surface, track) {
  const s0 = track.samples[0], { nx, nz } = track.startDir;
  const scan = sign => {
    let t = 0;
    while (t < 40 && surfaceAt(surface, s0.p.x + nx * sign * (t + 0.5), s0.p.z + nz * sign * (t + 0.5), s0.p.y)?.road) t += 0.5;
    return t;
  };
  return { plus: scan(1), minus: scan(-1) };
}

// As hastes do pórtico do jogo também são sólidas
function addGantryPosts(surface, track) {
  const s0 = track.samples[0], dir = track.startDir, { plus, minus } = surface.start;
  for (const lat of [plus + 1.5, -(minus + 1.5)]) {
    const x = s0.p.x + dir.nx * lat, z = s0.p.z + dir.nz * lat;
    addWall(surface.walls, x - dir.x * 0.4, z - dir.z * 0.4, x + dir.x * 0.4, z + dir.z * 0.4, s0.p.y, s0.p.y + 9);
  }
}
