// Leitor mínimo de GLB: triângulos em coordenadas do mundo, por malha
const fs = require('fs');
const zlib = require('zlib');
function mul(a, b) { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return o; }
function trs(n) {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
  return [(1 - 2 * (y * y + z * z)) * sx, (2 * (x * y + z * w)) * sx, (2 * (x * z - y * w)) * sx, 0,
    (2 * (x * y - z * w)) * sy, (1 - 2 * (x * x + z * z)) * sy, (2 * (y * z + x * w)) * sy, 0,
    (2 * (x * z + y * w)) * sz, (2 * (y * z - x * w)) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
}
function load(file) {
  const b = fs.readFileSync(file);
  const jl = b.readUInt32LE(12);
  const j = JSON.parse(b.slice(20, 20 + jl).toString());
  const bin = b.slice(20 + jl + 8);
  function acc(i) {
    const a = j.accessors[i], bv = j.bufferViews[a.bufferView];
    const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const T = { 5126: [Float32Array, 4], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5121: [Uint8Array, 1] }[a.componentType];
    const stride = bv.byteStride || comps * T[1];
    const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const out = new Float64Array(a.count * comps);
    const dv = new DataView(bin.buffer, bin.byteOffset);
    for (let k = 0; k < a.count; k++) for (let c = 0; c < comps; c++) {
      const off = base + k * stride + c * T[1];
      out[k * comps + c] = T[1] === 4 ? (a.componentType === 5126 ? dv.getFloat32(off, true) : dv.getUint32(off, true)) : T[1] === 2 ? dv.getUint16(off, true) : dv.getUint8(off);
    }
    return out;
  }
  const meshes = [];
  function walk(ni, parent) {
    const n = j.nodes[ni];
    const m = mul(parent, trs(n));
    if (n.mesh != null) {
      const me = j.meshes[n.mesh];
      for (const p of me.primitives) {
        if ((p.mode ?? 4) !== 4) continue;
        const pos = acc(p.attributes.POSITION);
        const idx = p.indices != null ? acc(p.indices) : Array.from({ length: pos.length / 3 }, (_, i) => i);
        const w = new Float64Array(pos.length);
        for (let k = 0; k < pos.length; k += 3) {
          const x = pos[k], y = pos[k + 1], z = pos[k + 2];
          w[k] = m[0] * x + m[4] * y + m[8] * z + m[12];
          w[k + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
          w[k + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
        }
        meshes.push({ node: n.name, mesh: me.name, mat: j.materials?.[p.material]?.name || '', pos: w, idx });
      }
    }
    (n.children || []).forEach(c => walk(c, m));
  }
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  (j.scenes[j.scene || 0].nodes).forEach(n => walk(n, I));
  return meshes;
}
function png(file, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy ? rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3) : raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1); }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = buf => { let c = 0xffffffff; for (const x of buf) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
module.exports = { load, png };
