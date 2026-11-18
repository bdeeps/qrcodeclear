// Chapter 2: from text to squares. Real encoder (../qr.js): pick a mode, make bits, add Reed-Solomon check bytes,
// lay the bits along the zig-zag path, then try the 8 masks and keep the one with the lowest penalty.
import { encode, MASKS, KIND, LEVELS } from '../qr.js';
import { Board, COL } from '../qrview.js';
import { esc } from '../ui.js';

const MODE_NAME = { numeric: 'Numeric (digits only)', alphanumeric: 'Alphanumeric (A–Z, 0–9, space and $%*+-./:)', byte: 'Byte (any text, as UTF-8)' };

export default {
  id: 'encode',
  short: 'Text to squares',
  title: 'How text becomes squares',
  subtitle: 'Bits, check bytes, a zig-zag path and a mask.',
  view: { pos: [0, 9.5, 6.5], target: [0, 0, 0.3] },
  learn: `<p>First the encoder picks a <b>mode</b>. Digits alone pack into 10 bits per three digits. Capital letters and a few symbols pack into 11 bits per two characters. Anything else is stored as bytes. The message starts with a 4-bit mode tag and a length, then the data, then a stop code. It is padded with the alternating bytes <b>236</b> and <b>17</b> until the code is full.</p>
    <p>Next, <b>Reed-Solomon</b> check bytes are worked out from the data and added. The bits are laid into the grid two columns at a time, snaking up and down from the bottom right, skipping the function patterns. That zig-zag is what the slider replays.</p>
    <p>Last comes the <b>mask</b>. Plain data could make big blank patches or even a fake finder pattern, which confuses a camera. So the encoder flips modules by one of 8 fixed patterns, scores each result with four penalty rules, and keeps the best. The decoder reads the mask number from the format strip and flips them back.</p>
    <p class="tip"><b>Try it:</b> type your own text. Watch the mode change when you use digits only. Slide <b>Fill</b> to replay the order, then step through the masks.</p>`,
  terms: [
    { t: 'Mode', d: 'How characters are packed into bits: numeric, alphanumeric or byte.' },
    { t: 'Codeword', d: 'A group of 8 bits. QR codes count their capacity in codewords.' },
    { t: 'Mask', d: 'One of 8 fixed patterns of flipped modules that breaks up blank patches and look-alike finders.' },
    { t: 'Penalty score', d: 'Points the encoder gives a masked code for runs, blocks and look-alike finders. Lowest wins.' },
  ],
  defaults: { text: 'HELLO WORLD', ecc: 'M', mask: -1, show: 'parts', fill: 1 },
  controls: [
    { key: 'text', type: 'text', label: 'Your message', max: 60, hint: 'Try only digits, then capitals, then lower case or emoji.' },
    { key: 'ecc', type: 'seg', label: 'Error correction', options: LEVELS.map((v) => ({ v, label: v })) },
    { key: 'mask', type: 'seg', label: 'Mask', options: [{ v: -1, label: 'Best' }, ...[0, 1, 2, 3, 4, 5, 6, 7].map((v) => ({ v, label: String(v) }))] },
    { key: 'show', type: 'seg', label: 'Show', options: [{ v: 'parts', label: 'Parts' }, { v: 'raw', label: 'Unmasked' }, { v: 'mask', label: 'Mask pattern' }, { v: 'final', label: 'Final code' }] },
    { key: 'fill', type: 'range', label: 'Fill: follow the path', min: 0, max: 1, step: 0.002, fmt: (v) => Math.round(v * 100) + '%' },
  ],
  quiz: [
    { q: 'Which mode packs the text "2024" most tightly?', options: ['Byte', 'Alphanumeric', 'Numeric', 'They are all equal'], answer: 2, why: 'Digits only: three digits fit in 10 bits, about 3.3 bits each. Bytes use 8 bits each.' },
    { q: 'Why is a mask applied?', options: ['To hide the data from spies', 'To avoid big blank patches and false finder patterns', 'To add error correction', 'To make the code smaller'], answer: 1, why: 'Masks are not secret. They just make the pattern easier for a camera to read.' },
    { q: 'How does the reader know which mask was used?', options: ['It tries all 8 slowly', 'It is written in the format information', 'It is always mask 0', 'It is in the quiet zone'], answer: 1, why: 'Three bits of the format strip name the mask, so the reader flips the modules back.' },
  ],
  reel: [
    { ms: 5600, caption: 'Text becomes bits, bits become bytes, and bytes snake into the grid.', set: { text: 'HELLO WORLD', ecc: 'M', mask: -1, show: 'parts', fill: 0 }, anim: { fill: [0, 1] }, spin: 0.3 },
    { ms: 5600, caption: 'Eight masks flip squares to break up patterns. The best one wins.', set: { show: 'final', fill: 1, mask: 0 }, anim: { mask: [0, 7] }, spin: 0.3 },
  ],
  build({ stage, s }) {
    stage.setShift(stage.host.clientWidth > 900 ? 0.12 : 0, 0);
    const board = new Board(stage.root);
    let key = '', info = null, err = '';
    const refresh = () => {
      const text = s.text || ' ';
      try { info = encode(text, { ecc: s.ecc, mask: Math.round(s.mask) }); err = ''; } catch (e) { err = String(e.message || e); return; }
      const { size, kind, bitIndex, segs, dataWords, modules, unmasked, mask } = info;
      const nShow = Math.round(s.fill * (info.totalWords * 8 + 7));
      const segOf = (b) => { if (b >= dataWords * 8) return 'ecc'; const q = segs.find((g) => b >= g.from && b < g.to); return q ? q.kind : 'pad'; };
      const mf = MASKS[mask];
      board.draw(size, (i, x, y) => {
        const k = kind[i], b = bitIndex[i];
        if (k !== KIND.DATA) { const d = modules[i] === 1; return d ? [1, s.show === 'parts' ? 0x4a5168 : 0x14161d] : null; }
        if (b >= nShow) return [0.06, 0xcfd3de];
        if (s.show === 'parts') return b >= info.totalWords * 8 ? null : [unmasked[i] ? 1 : 0.35, COL[segOf(b)] ?? COL.pad];
        if (s.show === 'raw') return unmasked[i] ? [1, 0x14161d] : null;
        if (s.show === 'mask') return mf(x, y) ? [0.9, 0xc49bff] : null;
        return modules[i] ? [1, 0x14161d] : null;
      });
    };
    return {
      update() {
        const k = `${s.text}|${s.ecc}|${Math.round(s.mask)}|${s.show}|${s.fill.toFixed(3)}`;
        if (k !== key) { key = k; refresh(); }
      },
      readout(st) {
        if (!info && !err) return '';
        if (err) return `<div class="big">Too long</div><p class="r-say">${esc(err)}. Try a shorter message or a lower error-correction level.</p>`;
        const cls = (kd) => info.segs.filter((g) => g.kind === kd);
        const bitsOf = (a, b) => { let o = ''; for (let i = a; i < b; i++) o += (info.dataBytes[i >> 3] >> (7 - (i & 7))) & 1; return o; };
        const lim = 72; let left = lim, html = '';
        for (const g of info.segs) {
          if (left <= 0) break;
          const to = Math.min(g.to, g.from + left); left -= to - g.from;
          html += `<i class="k-${g.kind}">${bitsOf(g.from, to).replace(/(.{8})/g, '$1 ').trim()}</i> `;
        }
        const total = info.dataBytes.length * 8;
        const used = info.segs.filter((g) => g.kind !== 'pad').at(-1).to;
        return `<div class="big">${esc(info.mode)} · version ${info.version}</div>
          <p class="r-say">${MODE_NAME[info.mode]}. ${info.dataBits} bits of data after a 4-bit mode and a ${cls('count')[0].to - cls('count')[0].from}-bit length.</p>
          <div class="bits">${html}${total > lim ? '…' : ''}</div>
          <div class="leg"><span style="--k:#ffb547">mode</span><span style="--k:#ff9d85">length</span><span style="--k:#8ef0ff">data</span><span style="--k:#9aa3b5">stop and padding</span><span style="--k:#7dffb0">check bytes</span></div>
          <div class="row"><span>Bytes</span><b>${Math.ceil(used / 8)} used of ${info.dataWords} + ${info.eccWords} check</b></div>
          <div class="row"><span>Mask</span><b>${info.mask}${st.mask < 0 ? ' (lowest penalty)' : ''}</b></div>
          ${info.scores.length ? `<div class="row"><span>Penalties 0–7</span><b style="font-size:12px">${info.scores.map((v, i) => (i === info.mask ? `<u>${v}</u>` : v)).join(' · ')}</b></div>` : ''}`;
      },
      dispose() { stage.setShift(0, 0);},
    };
  },
};
