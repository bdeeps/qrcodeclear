// Shared 3D drawing of a QR matrix: a paper plate with one small block per module.
// Used by the anatomy, encode, errors and trust chapters. Also colours and message helpers.
import { THREE, M, canvasTexture } from './kit.js';
import { KIND, encode } from './qr.js';

export const WIDTH = 6.6; // world width of plate incl. quiet zone
export const COL = {
  paper: 0xf2efe6, ink: 0x14161d, finder: 0xff7a59, sep: 0xffd3c7, timing: 0xffb547, align: 0xc49bff, format: 0x5ce1a9, version: 0xff6bd5, dark: 0xffffff,
  data: 0x8ef0ff, ecc: 0x7dffb0, mode: 0xffb547, count: 0xff7a59, pad: 0x8a93a8, dim: 0x3a4152, bad: 0xff6b6b,
};
export const KIND_COL = { [KIND.FINDER]: COL.finder, [KIND.SEP]: COL.sep, [KIND.TIMING]: COL.timing, [KIND.ALIGN]: COL.align, [KIND.FORMAT]: COL.format, [KIND.VERSION]: COL.version, [KIND.DARK]: COL.ink };

export class Board {
  constructor(parent, max = 177 * 177) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.matte(0xffffff, { roughness: 0.6 }), max);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.plate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), M.matte(COL.paper, { emissive: 0x6b665a }));
    this.plate.receiveShadow = true; this.plate.castShadow = true;
    this.quiet = new THREE.Group();
    const qm = M.ghost(0x8ef0ff, 0.45);
    for (let i = 0; i < 4; i++) this.quiet.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), qm));
    this.group.add(this.plate, this.mesh, this.quiet);
    this.size = 0; this.unit = 0;
    this._o = new THREE.Object3D(); this._c = new THREE.Color();
  }
  // fn(i, x, y) -> null (leave paper) or [height 0..1 (1 = a full block), hex colour, lift (optional, in blocks)]
  draw(size, fn, { showQuiet = false } = {}) {
    const u = (this.unit = WIDTH / (size + 8));
    this.size = size;
    const o = this._o, c = this._c, m = this.mesh;
    let n = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const r = fn(y * size + x, x, y);
      if (!r) continue;
      const hgt = Math.max(0.05, r[0]) * u * 0.9, lift = (r[2] || 0) * u;
      o.position.set((x - size / 2 + 0.5) * u, 0.06 + lift + hgt / 2, (y - size / 2 + 0.5) * u);
      o.scale.set(u * 0.98, hgt, u * 0.98); o.rotation.set(0, 0, 0); o.updateMatrix();
      m.setMatrixAt(n, o.matrix); m.setColorAt(n, c.setHex(r[1])); n++;
    }
    m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    const W = (size + 8) * u;
    this.plate.scale.set(W, 0.12, W); this.plate.position.y = 0;
    const q = this.quiet.children, t = 4 * u, qs = size * u;
    const place = (k, w, d, x, z) => { q[k].scale.set(w, 0.02, d); q[k].position.set(x, 0.07, z); };
    place(0, W, t, 0, -(qs + t) / 2); place(1, W, t, 0, (qs + t) / 2); place(2, t, qs, -(qs + t) / 2, 0); place(3, t, qs, (qs + t) / 2, 0);
    this.quiet.visible = showQuiet;
  }
  // module (x, y) under a world-space ray hit, or null
  cellAt(worldPoint) {
    const p = this.group.worldToLocal(worldPoint.clone()), u = this.unit, s = this.size;
    const x = Math.floor(p.x / u + s / 2), y = Math.floor(p.z / u + s / 2);
    return x < 0 || y < 0 || x >= s || y >= s ? null : [x, y];
  }
}

// a message that fits a version (the shortest ones for version 1)
export const msgFor = (ver) => (ver === 1 ? 'glassbox.how' : 'https://glassbox.how');
export const encodeAt = (ver, ecc = 'M', mask = -1, text) => encode(text || msgFor(ver), { ecc, minVersion: ver, maxVersion: ver, mask });

// Draw a matrix (1 = dark) to a canvas with a 4-module quiet zone; returns the canvas.
export function matrixCanvas(mod, size, px = 8, quiet = 4) {
  const n = size + quiet * 2, c = document.createElement('canvas'); c.width = c.height = n * px;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#111';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (mod[y * size + x]) g.fillRect((x + quiet) * px, (y + quiet) * px, px, px);
  return c;
}
export { canvasTexture };
