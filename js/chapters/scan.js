// Chapter 4: how a camera reads a code. A photo is generated from a real code with the pose, blur, noise and
// shading you choose, then the real scanner (../qr.js) works from the pixels alone: threshold, find three finder
// squares, work out the grid, straighten with a perspective transform, sample every module, decode.
import { THREE, M, box, canvasTexture, clamp } from '../kit.js';
import { scanImage, homography, applyH, encode } from '../qr.js';
import { matrixCanvas } from '../qrview.js';
import { esc } from '../ui.js';

const N = 300, MSGS = { s: ['HELLO WORLD', 1], m: ['https://glassbox.how', 3], l: ['https://glassbox.how/how-does-a-qr-code-work', 7] };
const rad = (d) => (d * Math.PI) / 180;
const STAGES = ['photo', 'bw', 'finders', 'grid', 'read'];
const NOTES = { photo: 'What the camera sees.', bw: 'Each pixel is compared with the average around it: dark or light.', finders: 'Scan lines hunt for dark-light-dark-light-dark in the ratio 1 : 1 : 3 : 1 : 1.', grid: 'Three corners fix the code; a fourth point, the alignment pattern, fixes perspective.', read: 'Every module is sampled once, straightened, and decoded.' };

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// The photo: map each output pixel back to the flat code through a perspective transform.
function makePhoto(src, size, st) {
  const sc = src.getContext('2d').getImageData(0, 0, src.width, src.height).data, sw = src.width, W = size + 8;
  const ppm = (0.66 * N) / W, D = W * 2.4, f = ppm * D, cx = N / 2, cy = N / 2, r = rad(st.roll), t = rad(st.tilt);
  const proj = (u, v) => {
    const x1 = u * Math.cos(r) - v * Math.sin(r), z1 = u * Math.sin(r) + v * Math.cos(r);
    const y2 = -z1 * Math.sin(t), z2 = z1 * Math.cos(t), d = D - y2;
    return [cx + (f * x1) / d, cy + (f * z2) / d];
  };
  const h = W / 2, corners = [[-h, -h], [h, -h], [h, h], [-h, h]];
  const H = homography(corners.map(([a, b]) => proj(a, b)), corners); // image -> plane
  const g = new Float32Array(N * N), rnd = rng(7);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const [u, v] = applyH(H, x + 0.5, y + 0.5), px = (u + h) * (sw / W), py = (v + h) * (sw / W);
    let val;
    if (u < -h || v < -h || u >= h || v >= h) val = 118 + 10 * Math.sin(x * 0.07 + y * 0.03) + 6 * Math.sin(y * 0.21); // table
    else { const xi = clamp(Math.floor(px), 0, sw - 2), yi = clamp(Math.floor(py), 0, sw - 2), fx = px - xi, fy = py - yi; const q = (a, b) => sc[((yi + b) * sw + xi + a) * 4]; val = (q(0, 0) * (1 - fx) + q(1, 0) * fx) * (1 - fy) + (q(0, 1) * (1 - fx) + q(1, 1) * fx) * fy; val = 35 + val * 0.78; }
    val *= 1 - st.shade * (0.15 + 0.75 * (x / N)) * (0.6 + 0.4 * (y / N));
    g[y * N + x] = val;
  }
  let a = g;
  const rr = Math.round(st.blur);
  if (rr > 0) for (let pass = 0; pass < 2; pass++) { // two box blurs ~ a soft focus
    const o = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let sum = 0, n = 0; for (let k = -rr; k <= rr; k++) { const xx = x + k; if (xx >= 0 && xx < N) { sum += a[y * N + xx]; n++; } } o[y * N + x] = sum / n; }
    const o2 = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let sum = 0, n = 0; for (let k = -rr; k <= rr; k++) { const yy = y + k; if (yy >= 0 && yy < N) { sum += o[yy * N + x]; n++; } } o2[y * N + x] = sum / n; }
    a = o2;
  }
  const out = new Uint8ClampedArray(N * N);
  for (let i = 0; i < out.length; i++) out[i] = a[i] + (rnd() - 0.5) * st.noise;
  return out;
}

export default {
  id: 'scan',
  short: 'How a camera reads it',
  title: 'How a camera finds and reads a code',
  subtitle: 'Three squares, a straightening, and a grid sampled once.',
  view: { pos: [0, 9, 6.5], target: [0, 1.3, -1.2] },
  learn: `<p>A phone does not "look" at a QR code. It runs a small pipeline on a grid of pixels. First it turns the picture into <b>black and white</b>, comparing each pixel with the average around it so that shade across the page doesn't matter. Then it scans rows for <b>dark, light, dark, light, dark in the ratio 1 : 1 : 3 : 1 : 1</b>. That is the finder pattern. A match in a row is checked going up and down too.</p>
    <p>Three finder squares make a corner, and they tell the camera which way is up and how big a module is. The distance between them gives the version. The camera then solves for the <b>perspective</b> that turns the tilted photo back into a flat grid, using the alignment pattern as a fourth anchor. It samples the middle of each module once, hands the bits to the decoder, and, if bytes are wrong, error correction repairs them.</p>
    <p class="tip"><b>Try it:</b> tilt and turn the card, then add blur or noise until reading fails. Step through the five stages on the phone.</p>
    <p class="note">This scanner is a small, honest version of the real thing. Production readers also try other thresholds, handle several alignment patterns on large codes and tolerate more distortion.</p>`,
  terms: [
    { t: 'Binarising', d: 'Turning a grey picture into black and white by comparing each pixel with its neighbours.' },
    { t: 'Perspective transform', d: 'The maths that maps a tilted picture of a square back onto a flat square.' },
    { t: 'Sampling', d: 'Checking the middle of each module once, to decide whether it is a 0 or a 1.' },
  ],
  defaults: { code: 'm', tilt: 28, roll: 18, blur: 0, noise: 20, shade: 0.25, stage: 'read' },
  controls: [
    { key: 'stage', type: 'seg', label: 'Pipeline stage', options: [{ v: 'photo', label: '1 Photo' }, { v: 'bw', label: '2 Black & white' }, { v: 'finders', label: '3 Finders' }, { v: 'grid', label: '4 Grid' }, { v: 'read', label: '5 Read' }] },
    { key: 'code', type: 'seg', label: 'Code', options: [{ v: 's', label: 'Small (v1)' }, { v: 'm', label: 'URL (v3)' }, { v: 'l', label: 'Long (v7)' }] },
    { key: 'tilt', type: 'range', label: 'Tilt away', min: 0, max: 70, step: 1, fmt: (v) => Math.round(v) + '°' },
    { key: 'roll', type: 'range', label: 'Turn', min: -180, max: 180, step: 1, fmt: (v) => Math.round(v) + '°' },
    { key: 'blur', type: 'range', label: 'Out of focus', min: 0, max: 6, step: 1, fmt: (v) => (v < 1 ? 'Sharp' : Math.round(v) + ' px') },
    { key: 'noise', type: 'range', label: 'Sensor noise', min: 0, max: 120, step: 1, fmt: (v) => Math.round(v) },
    { key: 'shade', type: 'range', label: 'Uneven light', min: 0, max: 1, step: 0.01, fmt: (v) => (v < 0.1 ? 'Even' : Math.round(v * 100) + '%') },
  ],
  quiz: [
    { q: 'How does a camera spot a QR code in a busy photo?', options: ['It reads the text on it', 'It looks for dark-light-dark-light-dark in a 1:1:3:1:1 ratio', 'It looks for the colour black', 'It asks the user to centre it'], answer: 1, why: 'That ratio is the finder pattern, and it survives rotation and tilt.' },
    { q: 'Why does the reader need a perspective transform?', options: ['To make the picture brighter', 'To turn a tilted photo back into a flat square grid', 'To compress the image', 'To read colour'], answer: 1, why: 'A tilted code is a trapezoid. The transform maps it back to a square so each module can be sampled.' },
    { q: 'What does the reader sample for each module?', options: ['Every pixel it covers', 'Roughly one point in its middle', 'Its colour name', 'The border'], answer: 1, why: 'Once the grid is straight, the middle of each module says dark or light.' },
  ],
  reel: [
    { ms: 5400, caption: 'A phone hunts for one pattern: dark, light, dark, light, dark, in the ratio 1 : 1 : 3 : 1 : 1.', set: { stage: 'finders', code: 'm', tilt: 20, roll: -30, blur: 0, noise: 20, shade: 0.2 }, anim: { roll: [-40, 20] }, view: { pos: [4.5, 6, 6.5], target: [0, 1.2, 0.3] }, spin: 0 },
    { ms: 5400, caption: 'Three squares fix the corner. A fourth point straightens the tilt.', set: { stage: 'grid', tilt: 20 }, anim: { tilt: [10, 55] }, spin: 0 },
    { ms: 5400, caption: 'Then it reads each square once and decodes the text.', set: { stage: 'read', tilt: 30, roll: 25 }, anim: { roll: [10, 35] }, spin: 0.2 },
  ],
  build({ stage, s }) {
    stage.setShift(stage.host.clientWidth > 900 ? 0.12 : 0, 0);
    const root = stage.root;
    // table
    const table = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.1, 64), M.matte(0x7a6a56)); table.position.y = -0.12; table.receiveShadow = true; root.add(table);
    // card: its own group so we can tilt and turn it
    const tiltG = new THREE.Group(), rollG = new THREE.Group(); tiltG.position.y = 0.05; tiltG.add(rollG); root.add(tiltG);
    const cardMat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
    const card = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.06, 3.3), [M.matte(0xe9e4d8), M.matte(0xe9e4d8), cardMat, M.matte(0xe9e4d8), M.matte(0xe9e4d8), M.matte(0xe9e4d8)]);
    card.castShadow = card.receiveShadow = true; rollG.add(card);
    // phone lying above, screen up
    const phone = new THREE.Group(); phone.position.set(0, 2.2, -2.6); phone.scale.setScalar(0.78); phone.rotation.x = 1.05; root.add(phone);
    const body = box(2.5, 0.12, 4.7, M.plastic(0x15171d)); phone.add(body);
    const scr = canvasTexture(300, 560, () => {});
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3 * (560 / 300)), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false }));
    screen.rotation.x = -Math.PI / 2; screen.position.y = 0.07; phone.add(screen);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 20), M.glow(0x222a3a)); lens.position.set(0, -0.08, 0); phone.add(lens);
    const lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x8ef0ff, transparent: true, opacity: 0.35 }));
    root.add(lines);
    const lbl = stage.label('', [0, 0, 0], phone, 'hot');

    let key = '', res = null, src = null, srcKey = '', info = null, gray = null;
    const g = scr.canvas.getContext('2d'), cam = document.createElement('canvas'); cam.width = cam.height = N; const cg = cam.getContext('2d');
    const drawGray = (arr) => { const im = cg.createImageData(N, N); for (let i = 0; i < N * N; i++) { const v = arr[i]; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; } cg.putImageData(im, 0, 0); };
    const dot = (x, y, r, col) => { cg.beginPath(); cg.arc(x, y, r, 0, 7); cg.fillStyle = col; cg.fill(); };
    const compose = () => {
      const stg = s.stage;
      if (stg === 'bw') { const im = cg.createImageData(N, N); for (let i = 0; i < N * N; i++) { const v = res.bin[i] ? 20 : 240; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; } cg.putImageData(im, 0, 0); } else if (stg === 'read' && res.matrix) {
        cg.fillStyle = '#fff'; cg.fillRect(0, 0, N, N); const n = res.size, px = N / (n + 2); cg.fillStyle = '#111';
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (res.matrix[y * n + x]) cg.fillRect((x + 1) * px, (y + 1) * px, Math.ceil(px), Math.ceil(px));
      } else drawGray(gray);
      cg.lineWidth = 2;
      if (stg === 'finders' || stg === 'grid') for (const f of res.finders || []) { const chosen = res.tri && [res.tri.tl, res.tri.tr, res.tri.bl].includes(f); cg.strokeStyle = chosen ? '#ffb547' : '#ff6b6b'; const r = f.m * 3.5; cg.strokeRect(f.x - r, f.y - r, r * 2, r * 2); if (chosen) { cg.fillStyle = '#ffb547'; cg.font = '600 13px sans-serif'; cg.fillText(f === res.tri.tl ? 'corner' : f === res.tri.tr ? 'right' : 'bottom', f.x - 16, f.y + 4); } }
      if (stg === 'grid' && res.corners) {
        cg.strokeStyle = '#8ef0ff'; cg.beginPath(); res.corners.forEach(([x, y], i) => (i ? cg.lineTo(x, y) : cg.moveTo(x, y))); cg.closePath(); cg.stroke();
        cg.strokeStyle = 'rgba(142,240,255,.35)'; cg.lineWidth = 1;
        for (let k = 1; k < res.size; k++) { let a = applyH(res.H, k, 0), b = applyH(res.H, k, res.size); cg.beginPath(); cg.moveTo(...a); cg.lineTo(...b); cg.stroke(); a = applyH(res.H, 0, k); b = applyH(res.H, res.size, k); cg.beginPath(); cg.moveTo(...a); cg.lineTo(...b); cg.stroke(); }
        if (res.alignment) { dot(res.alignment.x, res.alignment.y, 5, '#c49bff'); }
      }
    };
    const paintScreen = () => {
      g.fillStyle = '#0b0d13'; g.fillRect(0, 0, 300, 560); g.drawImage(cam, 0, 0);
      g.fillStyle = '#0b0d13'; g.fillRect(0, N, 300, 260);
      g.textBaseline = 'top'; g.fillStyle = '#8ef0ff'; g.font = '600 13px Geist, sans-serif';
      g.fillText(`${STAGES.indexOf(s.stage) + 1} of 5 · ${({ photo: 'Photo', bw: 'Black & white', finders: 'Finders', grid: 'Grid', read: 'Read' })[s.stage]}`, 14, N + 12);
      g.fillStyle = '#a8aebf'; g.font = '400 12.5px Geist, sans-serif';
      const wrap = (t, x, y, w, lh) => { let line = ''; for (const wd of t.split(' ')) { if (g.measureText(line + wd).width > w) { g.fillText(line, x, y); y += lh; line = ''; } line += wd + ' '; } g.fillText(line, x, y); return y + lh; };
      let y = wrap(NOTES[s.stage], 14, N + 34, 272, 17) + 8;
      g.font = '600 15px Geist, sans-serif'; g.fillStyle = res.ok ? '#5ce1a9' : '#ff6b6b';
      g.fillText(res.ok ? '✓ Read' : '✗ Not read yet', 14, y); y += 24;
      g.font = '500 12.5px ui-monospace, Menlo, monospace'; g.fillStyle = res.ok ? '#eef0f6' : '#ffb3b3';
      wrap(res.ok ? res.text : res.reason, 14, y, 272, 17);
      scr.tex.needsUpdate = true;
    };
    const frustum = () => {
      const half = 1.65, pts = [], c = [[-half, -half], [half, -half], [half, half], [-half, half]];
      const rz = rad(s.roll), tx = rad(s.tilt);
      for (const [a, b] of c) {
        const x = a * Math.cos(rz) - b * Math.sin(rz), z = a * Math.sin(rz) + b * Math.cos(rz), y = -z * Math.sin(tx), zz = z * Math.cos(tx);
        pts.push(0, 2.0, -2.6, x, 0.05 + y, zz);
      }
      lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    };
    const refresh = () => {
      const [text, ver] = MSGS[s.code];
      if (srcKey !== s.code) { srcKey = s.code; info = encode(text, { ecc: 'M', minVersion: ver, maxVersion: ver }); src = matrixCanvas(info.modules, info.size, Math.ceil(520 / (info.size + 8))); cardMat.map = new THREE.CanvasTexture(src); cardMat.map.colorSpace = THREE.SRGBColorSpace; cardMat.needsUpdate = true; }
      gray = makePhoto(src, info.size, s);
      res = scanImage(gray, N, N);
      compose(); paintScreen();
      tiltG.rotation.x = rad(s.tilt); rollG.rotation.y = -rad(s.roll);
      frustum();
    };
    return {
      update() {
        const k = `${s.code}|${Math.round(s.tilt)}|${Math.round(s.roll)}|${Math.round(s.blur)}|${Math.round(s.noise)}|${s.shade.toFixed(2)}|${s.stage}`;
        if (k !== key) { key = k; refresh(); }
      },
      readout() {
        if (!res) return '';
        const rows = [`<div class="row"><span>Finder candidates</span><b>${res.finders.length}</b></div>`];
        if (res.tri) rows.push(`<div class="row"><span>Module size in the photo</span><b>${res.moduleSize.toFixed(1)} px</b></div>`, `<div class="row"><span>Size worked out</span><b>version ${res.version} (${res.size} × ${res.size})</b></div>`, `<div class="row"><span>Fourth anchor</span><b>${res.alignment ? 'alignment pattern found' : res.version > 1 ? 'not found, guessed' : 'none needed'}</b></div>`);
        if (res.ok) rows.push(`<div class="row"><span>Bytes repaired</span><b>${res.fixed}</b></div>`);
        return `<div class="big ${res.ok ? 'ok' : 'no'}">${res.ok ? 'Read ✓' : 'Not read ✗'}</div><p class="r-say">${res.ok ? esc(res.text) : esc(res.reason)}</p>${rows.join('')}`;
      },
      dispose() { stage.setShift(0, 0);},
    };
  },
};
