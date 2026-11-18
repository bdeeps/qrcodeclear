// Chapter 3: error correction. Paint damage on a real version-4 code; the real decoder (../qr.js) then tries to
// read the damaged grid, repairing wrong bytes with Reed-Solomon, block by block.
import { THREE, M } from '../kit.js';
import { decodeMatrix, KIND, LEVELS, eccPerBlock, numBlocks, totalCodewords } from '../qr.js';
import { Board, COL, encodeAt } from '../qrview.js';
import { esc } from '../ui.js';

const VER = 4, TEXT = 'https://glassbox.how';
const hash = (i) => { let h = (i * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; return (h ^ (h >>> 13)) >>> 0; };

export default {
  id: 'errors',
  short: 'Damage it',
  title: 'Scratch it, and it still works',
  subtitle: 'Reed-Solomon codes let a code repair itself.',
  view: { pos: [0, 10, 4.2], target: [0, 0, 0.2] },
  learn: `<p>Real codes get dirty, torn and covered by logos. A QR code survives because it carries extra <b>check bytes</b> made with <b>Reed-Solomon</b> error correction, invented in 1960 for sending data over noisy channels. The decoder solves a little algebra puzzle to find which bytes are wrong and what they should be.</p>
    <p>You choose how many check bytes to spend. The four levels are <b>L, M, Q and H</b>. They can repair roughly <b>7%, 15%, 25% and 30%</b> of the code's bytes. The cost is size: a higher level needs a bigger code for the same message.</p>
    <p>Notice that it is bytes that count, not modules. One bad module spoils a whole 8-module byte, but many bad modules inside the same byte only count once. Big codes are split into blocks that are repaired separately, so damage packed into one block is worse than the same damage spread out.</p>
    <p class="tip"><b>Try it:</b> paint over the code, then raise the level. Put the logo in the middle at level L, then at H. The bars show how much of each block's budget you have used.</p>
    <p class="note">This demo reads the grid directly. A camera also has to find the three finder squares first, so damage to them matters more.</p>`,
  terms: [
    { t: 'Reed-Solomon code', d: 'A way to add check bytes so that a receiver can find and fix wrong bytes without asking for a resend.' },
    { t: 'Error correction level', d: 'L, M, Q or H: how many check bytes the code carries, roughly 7, 15, 25 or 30 percent.' },
    { t: 'Block', d: 'Big codes split their bytes into blocks, each with its own check bytes and its own repair budget.' },
  ],
  defaults: { level: 'M', tool: 'ink', brush: 2, paint: true },
  controls: [
    { key: 'level', type: 'seg', label: 'Error correction level', options: LEVELS.map((v) => ({ v, label: v })) },
    { key: 'tool', type: 'seg', label: 'Brush', options: [{ v: 'ink', label: 'Black ink' }, { v: 'white', label: 'White-out' }, { v: 'noise', label: 'Noise' }] },
    { key: 'brush', type: 'range', label: 'Brush size', min: 1, max: 5, step: 0.5, fmt: (v) => v.toFixed(1) + ' modules' },
    { key: 'paint', type: 'toggle', label: 'Paint with the mouse (turns off orbiting)' },
    { key: 'acts', type: 'buttons', label: 'Quick damage', items: [
      { label: 'Clear', act: (s, i) => i.clear() }, { label: 'Logo in the middle', act: (s, i) => i.logo() }, { label: 'Scratch', act: (s, i) => i.scratch() }, { label: 'Spill', act: (s, i) => i.spill() }, { label: 'Random 10%', act: (s, i) => i.random(0.1) },
    ] },
  ],
  quiz: [
    { q: 'What does error correction need in order to repair a code?', options: ['A second copy of the whole code', 'Extra check bytes added when it was made', 'An internet connection', 'A bigger camera'], answer: 1, why: 'Reed-Solomon check bytes are computed from the data and printed in the code itself.' },
    { q: 'Which level survives the most damage?', options: ['L', 'M', 'Q', 'H'], answer: 3, why: 'H spends about 30% of the code on check bytes, at the cost of a bigger code.' },
    { q: 'Why can a small logo sit in the middle of some codes?', options: ['Logos are part of the standard', 'The damaged bytes are within what the check bytes can repair', 'Cameras ignore colour', 'The middle holds no data'], answer: 1, why: 'The logo only works if it covers fewer bytes than the level can repair, which is why those codes use a high level.' },
  ],
  reel: [
    { ms: 5600, caption: 'Scratch a QR code and it can still read. It carries its own repair kit.', set: { level: 'M', tool: 'ink', brush: 2 }, act: (s, i) => { i.clear(); i.scratch(); i.spill(); }, view: { pos: [0, 10, 4.5], target: [0, 0, 0.2] }, spin: 0 },
    { ms: 5600, caption: 'Put a logo on top. Level H can repair about 30%.', set: { level: 'H' }, act: (s, i) => { i.clear(); i.logo(); }, spin: 0 },
  ],
  build({ stage, s }) {
    stage.setShift(stage.host.clientWidth > 900 ? 0.12 : 0, 0);
    const board = new Board(stage.root);
    const base = {}, el = stage.renderer.domElement;
    const get = () => encodeAt(VER, s.level, -1, TEXT);
    let info = get(), size = info.size, dmg = new Int8Array(size * size).fill(-1); // -1 untouched, else forced value
    let key = '', result = null, painting = false, lastCell = null, dirty = true, curLevel = s.level;
    const ray = new THREE.Raycaster(), v2 = new THREE.Vector2();
    const grid = () => { const m = new Uint8Array(info.modules); for (let i = 0; i < m.length; i++) if (dmg[i] >= 0) m[i] = dmg[i]; return m; };
    const stamp = (cx, cy, r, tool) => {
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        if (Math.hypot(x + 0.5 - cx - 0.5, y + 0.5 - cy - 0.5) > r) continue;
        const i = y * size + x;
        dmg[i] = tool === 'ink' ? 1 : tool === 'white' ? 0 : (hash(i * 7 + Math.floor(cx * 3 + cy * 5)) & 1) ^ info.modules[i];
      }
      dirty = true;
    };
    const cell = (e) => {
      const b = el.getBoundingClientRect();
      v2.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
      ray.setFromCamera(v2, stage.camera);
      const h = ray.intersectObject(board.plate)[0];
      return h ? board.cellAt(h.point) : null;
    };
    const paint = (e) => { const c = cell(e); if (!c) return; if (lastCell) { const n = Math.max(1, Math.round(Math.hypot(c[0] - lastCell[0], c[1] - lastCell[1]))); for (let k = 1; k <= n; k++) stamp(lastCell[0] + ((c[0] - lastCell[0]) * k) / n, lastCell[1] + ((c[1] - lastCell[1]) * k) / n, s.brush, s.tool); } else stamp(c[0], c[1], s.brush, s.tool); lastCell = c; };
    const down = (e) => { if (!s.paint) return; painting = true; lastCell = null; paint(e); };
    const move = (e) => { if (painting) paint(e); };
    const up = () => { painting = false; lastCell = null; };
    el.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    el.style.touchAction = 'none';

    const refresh = () => {
      const cur = grid();
      result = decodeMatrix(cur, size);
      board.draw(size, (i) => {
        const dark = cur[i] === 1, changed = cur[i] !== info.modules[i];
        if (changed) return dark ? [1, 0x8a1f35] : [0.2, 0xff9aa6];
        return dark ? [1, 0x14161d] : null;
      });
      result.wrong = [...cur].filter((v, i) => v !== info.modules[i]).length;
      result.wrongWords = new Set([...cur].map((v, i) => (v !== info.modules[i] && info.bitIndex[i] >= 0 ? info.bitIndex[i] >> 3 : -1)).filter((v) => v >= 0)).size;
    };
    const api = {
      clear() { dmg.fill(-1); dirty = true; },
      logo() { const c = Math.floor(size / 2), r = 5; for (let y = c - r; y <= c + r; y++) for (let x = c - r; x <= c + r; x++) dmg[y * size + x] = Math.hypot(x - c, y - c) < 2.2 ? 1 : 0; dirty = true; },
      scratch() { for (let t = 0; t < 1; t += 0.01) stamp(4 + t * (size - 8), 6 + t * (size - 14) + Math.sin(t * 9) * 1.2, 0.8, 'white'); },
      spill() { stamp(size * 0.72, size * 0.3, 3.6, 'ink'); },
      random(p) { for (let i = 0; i < dmg.length; i++) if (info.kind[i] === KIND.DATA && hash(i + 91) / 4294967296 < p) dmg[i] = info.modules[i] ^ 1; dirty = true; },
    };
    return {
      ...api,
      update(dt, st) {
        stage.controls.enabled = !st.paint;
        if (st.level !== curLevel) { curLevel = st.level; info = get(); dirty = true; }
        if (dirty) { dirty = false; refresh(); }
      },
      readout(st) {
        if (!result) return '';
        const eb = eccPerBlock(VER, st.level), nb = numBlocks(VER, st.level), t = Math.floor(eb / 2), total = totalCodewords(VER);
        const budget = t * nb, pct = Math.round((budget / total) * 100);
        const head = result.ok ? `<div class="big ok">Still reads ✓</div><p class="r-say">${esc(result.text)}${result.fixed ? ` · repaired ${result.fixed} byte${result.fixed === 1 ? '' : 's'}` : ' · nothing to repair'}</p>` : `<div class="big no">Can't read ✗</div><p class="r-say">${esc(result.reason)}</p>`;
        const bars = (result.blocks || []).map((b, i) => `<div class="row"><span>Block ${i + 1}</span><b class="${b.ok ? '' : 'no'}">${b.ok ? b.errors : 'over'} of ${b.cap} repairable</b></div><div class="bar ${b.ok ? '' : 'bad'}"><i style="width:${Math.min(100, ((b.ok ? b.errors : b.cap + 1) / Math.max(1, b.cap)) * 100)}%"></i></div>`).join('');
        return `${head}${bars}<div class="row"><span>Damaged modules</span><b>${result.wrong} (${result.wrongWords} bytes)</b></div>
          <div class="row"><span>Level ${st.level} can repair about</span><b>${budget} of ${total} bytes (${pct}%)</b></div>`;
      },
      dispose() { stage.setShift(0, 0); stage.controls.enabled = true; el.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); el.style.touchAction = ''; },
    };
  },
};
