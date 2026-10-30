'use strict';
// Extrai a linha central (traçado) de cada pista .glb de public/RaceTracks.
// Desenha o asfalto visto de cima numa grade, mede a distância até a borda e liga os pontos de
// passagem (em ordem, no sentido da corrida) pelo caminho mais central do asfalto.
// Saída: public/tracks/<id>.json com pontos [x, y, z, meiaLargura] nas coordenadas do modelo.
//
// Uso:  node tools/track-centerline.js [id] [--debug]   (--debug grava uma imagem de conferência em tools/out)
const fs = require('fs');
const path = require('path');
const { load, png } = require('./glb');

// road: malhas do asfalto (regex sobre "material malha"); way: pontos de passagem [x, z] no sentido da corrida.
// start: posição [x, z] da linha de largada.
const TRACKS = {
  motegi: {
    file: 'mobility_resort_motegi_twin_ring.glb',
    road: /^(ROAD|RMBL|ROADGRID|SFLINE)\.002 /i,
    start: [-737586, 197241],   // faixa de largada do modelo (SFLINE)
    way: [[-741640, 188893], [-884993, 195264], [-969942, 176150], [-975251, 112438], [-853137, 85892], [-693856, 61469], [-534576, 40231], [-439008, 27489], [-385915, 6252], [-391224, -46842], [-417771, -99935], [-534576, -78698], [-746950, -30914], [-906230, 11561], [-991179, -4367], [-980561, -99935], [-916849, -216740], [-800043, -275143], [-662000, -282576], [-577051, -296380], [-529267, -376020], [-492102, -434423], [-439008, -434423], [-354059, -386639], [-253182, -333546], [-216016, -354783], [-231944, -460970], [-269110, -758293], [-242563, -747674], [-205398, -620250], [-141686, -354783], [-77973, -142410], [-46117, 6252], [-88592, 25365], [-237254, 29613], [-290347, 69964], [-322203, 123057], [-343440, 181460], [-534576, 188893]],
  },
  hg: {
    file: 'penny_racers_ps2_-_hg_circuit_long.glb',
    road: /^(road_m|rd_01_m|rd_02_m|rd_03_m|rd_sb1_m|rd_sb2_m|road_023) /i,
    start: [-136, -274],        // sob o pórtico do modelo
    way: [[-136, -274], [-21, -274], [61, -274], [94, -241], [143, -167], [176, -118], [167, -69], [126, -54], [114, -36], [130, -3], [143, 59], [139, 120], [114, 182], [77, 227], [73, 284], [44, 309], [-21, 315], [-91, 292], [-116, 223], [-99, 161], [-62, 120], [-58, 71], [-95, 22], [-112, -7], [-95, -60], [-87, -101], [-54, -126], [-13, -142], [20, -159], [28, -188], [-5, -196], [-46, -185], [-71, -175], [-124, -179], [-202, -179], [-251, -200], [-255, -241], [-226, -274]],
  },
};
const RES = 3000;      // células no maior lado da grade
const POINTS = 600;    // pontos na linha central final

function raster(meshes, re) {
  const sel = meshes.filter(m => re.test(m.mat + ' ' + m.mesh));
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const m of sel) for (let k = 0; k < m.pos.length; k += 3) {
    x0 = Math.min(x0, m.pos[k]); x1 = Math.max(x1, m.pos[k]);
    z0 = Math.min(z0, m.pos[k + 2]); z1 = Math.max(z1, m.pos[k + 2]);
  }
  const cell = Math.max(x1 - x0, z1 - z0) / (RES - 20);
  x0 -= cell * 10; z0 -= cell * 10;
  const W = Math.ceil((x1 - x0) / cell) + 10, H = Math.ceil((z1 - z0) / cell) + 10;
  const road = new Uint8Array(W * H), hgt = new Float32Array(W * H).fill(-Infinity);
  for (const m of sel) for (let t = 0; t < m.idx.length; t += 3) {
    const P = [0, 1, 2].map(q => { const v = m.idx[t + q] * 3; return [(m.pos[v] - x0) / cell, (m.pos[v + 2] - z0) / cell, m.pos[v + 1]]; });
    const area = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]);
    if (Math.abs(area) < 1e-9) continue;
    const xa = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0]))), xb = Math.min(W - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])));
    const ya = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1]))), yb = Math.min(H - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])));
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((P[1][0] - px) * (P[2][1] - py) - (P[2][0] - px) * (P[1][1] - py)) / area;
      const w1 = ((P[2][0] - px) * (P[0][1] - py) - (P[0][0] - px) * (P[2][1] - py)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      const i = y * W + x;
      road[i] = 1;
      hgt[i] = Math.max(hgt[i], w0 * P[0][2] + w1 * P[1][2] + w2 * P[2][2]);
    }
  }
  // fecha furinhos de 1 célula entre malhas
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (!road[i] && road[i - 1] + road[i + 1] + road[i - W] + road[i + W] >= 3) road[i] = 2;
  }
  return { W, H, x0, z0, cell, road, hgt };
}

// Todas as alturas do asfalto em cada ponto (x, z), para seguir o nível certo onde há pontes e túneis
function heightProbe(meshes, re) {
  const cells = new Map();
  const sel = meshes.filter(m => re.test(m.mat + ' ' + m.mesh));
  let size = 0;
  for (const m of sel) for (let k = 0; k < m.pos.length; k += 3) size = Math.max(size, Math.abs(m.pos[k]), Math.abs(m.pos[k + 2]));
  const c = size / 64;
  for (const m of sel) for (let t = 0; t < m.idx.length; t += 3) {
    const v = [0, 1, 2].map(q => { const i = m.idx[t + q] * 3; return [m.pos[i], m.pos[i + 1], m.pos[i + 2]]; });
    const xa = Math.floor(Math.min(v[0][0], v[1][0], v[2][0]) / c), xb = Math.floor(Math.max(v[0][0], v[1][0], v[2][0]) / c);
    const za = Math.floor(Math.min(v[0][2], v[1][2], v[2][2]) / c), zb = Math.floor(Math.max(v[0][2], v[1][2], v[2][2]) / c);
    for (let x = xa; x <= xb; x++) for (let z = za; z <= zb; z++) {
      const key = x + ',' + z;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(v);
    }
  }
  return (x, z) => {
    const out = [];
    for (const [a, b, d] of cells.get(Math.floor(x / c) + ',' + Math.floor(z / c)) || []) {
      const det = (b[2] - d[2]) * (a[0] - d[0]) + (d[0] - b[0]) * (a[2] - d[2]);
      if (Math.abs(det) < 1e-9) continue;
      const w0 = ((b[2] - d[2]) * (x - d[0]) + (d[0] - b[0]) * (z - d[2])) / det;
      const w1 = ((d[2] - a[2]) * (x - d[0]) + (a[0] - d[0]) * (z - d[2])) / det;
      if (w0 < -1e-4 || w1 < -1e-4 || 1 - w0 - w1 < -1e-4) continue;
      out.push(w0 * a[1] + w1 * b[1] + (1 - w0 - w1) * d[1]);
    }
    return out;
  };
}

// Leva cada ponto para o meio real do asfalto e mede a meia largura até a borda mais próxima
function recenter(g, pts, ref) {
  const n = pts.length;
  const spacing = pts.reduce((sum, p, i) => sum + Math.hypot(p[0] - pts[(i + 1) % n][0], p[2] - pts[(i + 1) % n][2]), 0) / n;
  const cap = ref * g.cell * 2.4;    // junções e boxes não contam como pista
  const onRoad = (x, z) => {
    const cx = Math.floor((x - g.x0) / g.cell), cy = Math.floor((z - g.z0) / g.cell);
    return cx >= 0 && cy >= 0 && cx < g.W && cy < g.H && g.road[cy * g.W + cx];
  };
  const measure = list => list.map((p, i) => {
    const a = list[(i - 2 + n) % n], b = list[(i + 2) % n], len = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
    const nx = (b[2] - a[2]) / len, nz = -(b[0] - a[0]) / len;
    const scan = s => { let t = 0; while (t < cap && onRoad(p[0] + nx * s * t, p[2] + nz * s * t)) t += g.cell / 2; return t; };
    return { nx, nz, l: scan(1), r: scan(-1) };
  });
  const box = (vals, win) => vals.map((_, i) => {
    let s = 0;
    for (let k = -win; k <= win; k++) s += vals[(i + k + n) % n];
    return s / (2 * win + 1);
  });
  const win = Math.max(4, Math.round(ref * g.cell * 6 / spacing));
  const m = measure(pts);
  const off = box(box(m.map(e => (e.l - e.r) / 2), win), win);
  const moved = pts.map((p, i) => [p[0] + m[i].nx * off[i], p[1], p[2] + m[i].nz * off[i], p[3]]);
  const widths = box(measure(moved).map(e => Math.min(e.l, e.r)), 1);
  moved.forEach((p, i) => { p[3] = widths[i]; });
  return moved;
}

// Distância (em células) até a borda do asfalto, chanfro 3-4
function distance({ W, H, road }) {
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = road[i] ? 1e9 : 0;
  const C = [[-1, 0, 3], [-1, -1, 4], [0, -1, 3], [1, -1, 4]];
  const pass = (y, x, s) => {
    const i = y * W + x;
    if (!d[i]) return;
    for (const [ox, oy, w] of C) {
      const nx = x + ox * s, ny = y + oy * s;
      d[i] = Math.min(d[i], nx < 0 || ny < 0 || nx >= W || ny >= H ? w : d[ny * W + nx] + w);
    }
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) pass(y, x, 1);
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) pass(y, x, -1);
  for (let i = 0; i < W * H; i++) d[i] /= 3;
  return d;
}

function snap(g, d, wx, wz) {
  const cx = Math.round((wx - g.x0) / g.cell), cy = Math.round((wz - g.z0) / g.cell);
  let best = -1, bd = 0;
  for (let r = 4; r <= 120 && best < 0; r += 8)
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= g.W || y >= g.H) continue;
      const i = y * g.W + x;
      if (d[i] > bd) { bd = d[i]; best = i; }
    }
  if (best < 0) throw new Error(`ponto ${wx},${wz} fora do asfalto`);
  return best;
}

// Caminho mais barato no asfalto, preferindo o meio da pista
function route(g, d, from, to, ref) {
  const { W } = g;
  const dist = new Map([[from, 0]]), prev = new Map();
  const heap = [[0, from]];
  const push = e => {
    heap.push(e);
    for (let i = heap.length - 1; i;) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  const N = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (heap.length) {
    const [c, i] = pop();
    if (i === to) break;
    if (c > dist.get(i)) continue;
    const x = i % W, y = (i - x) / W;
    for (const [ox, oy, l] of N) {
      const j = (y + oy) * W + x + ox;
      if (!d[j]) continue;
      const k = Math.min(1, d[j] / ref);
      const nc = c + l * (1 + 8 * (1 - k) * (1 - k));
      if (nc < (dist.get(j) ?? Infinity)) { dist.set(j, nc); prev.set(j, i); push([nc, j]); }
    }
  }
  if (!prev.has(to)) throw new Error('sem caminho entre pontos de passagem');
  const out = [];
  for (let i = to; i !== from; i = prev.get(i)) out.push(i);
  return out.reverse();
}

function build(id, debug) {
  const def = TRACKS[id];
  const meshes = load(path.join(__dirname, '..', 'public', 'RaceTracks', def.file));
  const g = raster(meshes, def.road);
  const d = distance(g);
  console.log(id, `grade ${g.W}x${g.H}, célula ${g.cell.toFixed(4)}`);

  if (!def.way.length) { debugImage(id, g, d, []); return; }
  const way = def.way.map(([x, z]) => snap(g, d, x, z));
  // referência de "meio da pista": meia largura típica nos pontos de passagem
  const ref = way.map(i => d[i]).sort((a, b) => a - b)[way.length >> 1];
  let cells = [];
  for (let k = 0; k < way.length; k++) cells = cells.concat(route(g, d, way[k], way[(k + 1) % way.length], ref));

  // polilinha em coordenadas do mundo, suavizada
  const pts = cells.map(i => { const x = i % g.W, y = (i - x) / g.W; return [g.x0 + (x + 0.5) * g.cell, g.hgt[i], g.z0 + (y + 0.5) * g.cell, d[i] * g.cell]; });
  const n = pts.length, win = Math.max(2, Math.round(ref * 1.5));
  // altura: onde uma pista passa por cima da outra a grade guarda a de cima; usa a mediana local
  const ys = pts.map((_, i) => {
    const a = [];
    for (let k = -win * 3; k <= win * 3; k++) { const y = pts[(i + k + n) % n][1]; if (Number.isFinite(y)) a.push(y); }
    return a.sort((p, q) => p - q)[a.length >> 1];
  });
  const sm = pts.map((_, i) => {
    const s = [0, 0, 0, 0];
    for (let k = -win; k <= win; k++) { const j = (i + k + n) % n, p = pts[j]; s[0] += p[0]; s[1] += ys[j]; s[2] += p[2]; s[3] += p[3]; }
    return s.map(v => v / (2 * win + 1));
  });
  // reamostra com espaçamento constante
  const cum = [0];
  for (let i = 1; i <= n; i++) { const a = sm[i - 1], b = sm[i % n]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[2] - a[2])); }
  const L = cum[n];
  let out = [];
  for (let k = 0, j = 0; k < POINTS; k++) {
    const t = (k / POINTS) * L;
    while (cum[j + 1] < t) j++;
    const a = sm[j], b = sm[(j + 1) % n], u = (t - cum[j]) / (cum[j + 1] - cum[j] || 1);
    out.push(a.map((v, c) => v + (b[c] - v) * u));
  }
  out = recenter(g, out, ref);
  // começa exatamente na linha de largada
  let first = 0, bestD = Infinity;
  out.forEach((p, i) => { const q = Math.hypot(p[0] - def.start[0], p[2] - def.start[1]); if (q < bestD) { bestD = q; first = i; } });
  out = out.slice(first).concat(out.slice(0, first));
  // altura real do asfalto, seguindo sempre o nível em que o carro já está
  const probe = heightProbe(meshes, def.road);
  let level = out[0][1];
  const levels = out.map(p => {
    const hs = probe(p[0], p[2]);
    if (hs.length) level = hs.reduce((a, h) => Math.abs(h - level) < Math.abs(a - level) ? h : a);
    return level;
  });
  out = out.map((p, i) => [p[0], (levels[(i - 1 + POINTS) % POINTS] + levels[i] * 2 + levels[(i + 1) % POINTS]) / 4, p[2], p[3]].map(v => +v.toFixed(3)));
  const file = path.join(__dirname, '..', 'public', 'tracks', id + '.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ length: +L.toFixed(2), halfWidth: +(ref * g.cell).toFixed(3), points: out }));
  console.log(id, `comprimento ${L.toFixed(1)}, meia largura típica ${(ref * g.cell).toFixed(2)} -> ${path.relative(process.cwd(), file)}`);
  if (debug) debugImage(id, g, d, out);
}

function debugImage(id, g, d, line) {
  let k = Math.max(1, Math.ceil(Math.max(g.W, g.H) / 1500));
  // CROP=x0,y0,x1,y1 (pixels da imagem inteira) mostra só esse trecho, em resolução cheia
  const crop = process.env.CROP?.split(',').map(Number);
  const ox = crop ? crop[0] * k : 0, oy = crop ? crop[1] * k : 0;
  let w = Math.floor(g.W / k), h = Math.floor(g.H / k);
  if (crop) { w = (crop[2] - crop[0]) * k; h = (crop[3] - crop[1]) * k; k = 1; }
  const img = Buffer.alloc(w * h * 3, 16);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (oy + y * k) * g.W + ox + x * k, o = (y * w + x) * 3;
    if (g.road[i]) { const v = Math.min(255, 70 + d[i] * 8); img[o] = v; img[o + 1] = v; img[o + 2] = v; }
    if ((ox + x * k) % 200 === 0 || (oy + y * k) % 200 === 0) { img[o] = 0; img[o + 1] = 90; img[o + 2] = 170; }
  }
  line.forEach(([px, , pz], n) => {
    const x = Math.floor(((px - g.x0) / g.cell - ox) / k), y = Math.floor(((pz - g.z0) / g.cell - oy) / k);
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      if (x + b < 0 || x + b >= w || y + a < 0 || y + a >= h) continue;
      const o = ((y + a) * w + x + b) * 3;
      img[o] = 255; img[o + 1] = n < 25 ? 230 : 40; img[o + 2] = n < 25 ? 0 : 40;
    }
  });
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  png(path.join(__dirname, 'out', id + '.png'), w, h, img);
  console.log(`  imagem tools/out/${id}.png (${w}x${h}): pixel (px, py) -> x = ${g.x0.toFixed(3)} + px*${(g.cell * k).toFixed(5)}, z = ${g.z0.toFixed(3)} + py*${(g.cell * k).toFixed(5)}`);
}

const args = process.argv.slice(2);
const only = args.find(a => !a.startsWith('--'));
for (const id of only ? [only] : Object.keys(TRACKS)) build(id, args.includes('--debug'));
