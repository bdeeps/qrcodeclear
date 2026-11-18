// Chapter 1: the anatomy of a QR code. A real code is built by the encoder in ../qr.js at the chosen version.
// Every module is classed by the job it does: finder, separator, timing, alignment, format, version, data.
import { THREE } from '../kit.js';
import { KIND, sizeOf, dataCodewords, totalCodewords, alignPositions } from '../qr.js';
import { Board, KIND_COL, COL, encodeAt } from '../qrview.js';

const VIEWS = { all: null, finder: [KIND.FINDER, KIND.SEP], timing: [KIND.TIMING], align: [KIND.ALIGN], format: [KIND.FORMAT, KIND.VERSION, KIND.DARK], data: [KIND.DATA] };

export default {
  id: 'anatomy',
  short: 'Anatomy',
  title: 'What is all that pattern?',
  subtitle: 'Every square has a job. A few are for the camera, the rest are for the message.',
  view: { pos: [0, 9.5, 6.5], target: [0, 0, 0.3] },
  learn: `<p>A QR code is a grid of dark and light squares called <b>modules</b>. The smallest, <b>version 1</b>, is 21 × 21. Each version adds 4 modules to each side, up to <b>version 40</b> at 177 × 177. A bigger version holds more.</p>
    <p>Not every module carries your message. The big squares in three corners are <b>finder patterns</b>. Their ratio of dark to light, 1 : 1 : 3 : 1 : 1, looks the same along any line through the middle, so a camera can spot one from any angle. Two stripes of alternating modules, the <b>timing patterns</b>, let the reader count squares. From version 2, small <b>alignment patterns</b> help correct for a bent or tilted surface. Strips beside the finders hold <b>format information</b>: the error-correction level and the mask, written twice. Versions 7 and up also store the version number.</p>
    <p>The empty border, the <b>quiet zone</b>, should be 4 modules wide. Without it the reader can't tell where the code stops.</p>
    <p class="tip"><b>Try it:</b> slide the version, then use <b>Show</b> to light up one kind of module. Lift the function patterns to see how few modules are left for data at version 1.</p>`,
  terms: [
    { t: 'Module', d: 'One square of a QR code, dark or light. It is one bit.' },
    { t: 'Finder pattern', d: 'The 7 × 7 nested square in three corners. It tells the camera where the code is and which way up it is.' },
    { t: 'Timing pattern', d: 'A row and a column of alternating modules between the finders, used to count the grid.' },
    { t: 'Alignment pattern', d: 'A small 5 × 5 target in bigger codes that helps fix perspective and bending.' },
    { t: 'Quiet zone', d: 'The blank border around the code, at least 4 modules wide.' },
  ],
  defaults: { version: 3, view: 'all', lift: 0, quiet: false },
  controls: [
    { key: 'version', type: 'range', label: 'Version', min: 1, max: 40, step: 1, fmt: (v) => `${Math.round(v)} · ${sizeOf(Math.round(v))} × ${sizeOf(Math.round(v))}` },
    { key: 'view', type: 'seg', label: 'Show', options: [{ v: 'all', label: 'All' }, { v: 'finder', label: 'Finders' }, { v: 'timing', label: 'Timing' }, { v: 'align', label: 'Alignment' }, { v: 'format', label: 'Format & version' }, { v: 'data', label: 'Data' }] },
    { key: 'lift', type: 'range', label: 'Lift the function patterns', min: 0, max: 1, step: 0.01, fmt: (v) => (v < 0.05 ? 'Flat' : 'Lifted') },
    { key: 'quiet', type: 'toggle', label: 'Show the quiet zone' },
  ],
  quiz: [
    { q: 'Why do the three big finder squares use a 1 : 1 : 3 : 1 : 1 pattern?', options: ['It looks nice', 'It reads the same along any line through the middle, so it can be found at any angle', 'It stores the version', 'It is the error correction'], answer: 1, why: 'Any scan line through the centre crosses dark, light, dark, light, dark in that ratio, whichever way the code is turned.' },
    { q: 'How big is a version 40 code?', options: ['21 × 21', '57 × 57', '177 × 177', '1000 × 1000'], answer: 2, why: 'Size = 17 + 4 × version, so version 40 is 177 × 177.' },
    { q: 'What is the quiet zone for?', options: ['Decoration', 'Extra data', 'Showing the reader where the code ends', 'Error correction'], answer: 2, why: 'Blank space of at least 4 modules separates the code from whatever is printed next to it.' },
  ],
  reel: [
    { ms: 5000, caption: 'A QR code is a grid. Version 1 is 21 squares across.', set: { version: 1, view: 'all', lift: 0 }, anim: { version: [1, 1] }, view: { pos: [0, 8.5, 6], target: [0, 0, 0.3] }, spin: 0.4 },
    { ms: 5600, caption: 'Three big squares say: here is the code, and this is the way up.', set: { version: 3, view: 'finder', lift: 0 }, anim: { lift: [0, 0.9] }, spin: 0.3 },
    { ms: 5600, caption: 'Each version adds 4 squares a side, up to 177 × 177.', set: { view: 'all', lift: 0 }, anim: { version: [1, 40] }, view: { pos: [0, 10, 7], target: [0, 0, 0.3] }, spin: 0.3 },
  ],
  build({ stage, s }) {
    stage.setShift(stage.host.clientWidth > 900 ? 0.12 : 0, 0);
    const board = new Board(stage.root);
    const labels = ['Finder', 'Finder', 'Finder', 'Timing', 'Alignment'].map((t, i) => stage.label(t, [0, 0.5, 0], stage.root, i < 3 ? 'hot' : ''));
    let key = '', info = null;
    const refresh = () => {
      const ver = Math.round(s.version), sel = VIEWS[s.view], lift = s.lift;
      info = encodeAt(ver, 'M');
      const { size, kind, modules } = info;
      board.draw(size, (i) => {
        const k = kind[i], dark = modules[i] === 1, inSel = !sel || sel.includes(k);
        const fn = k !== KIND.DATA;
        if (!inSel) return dark ? [0.22, COL.dim] : null;
        if (!fn) return dark ? [1, sel ? COL.data : 0x1b1e28] : (sel ? [0.12, 0xdfe5f2] : null);
        const c = KIND_COL[k];
        if (k === KIND.SEP) return [0.12, c, lift * 3];
        return [dark ? 1 : 0.14, dark || k === KIND.FORMAT || k === KIND.VERSION ? c : 0xe9e2d4, lift * 3];
      }, { showQuiet: s.quiet });
      const u = board.unit, half = (size / 2) * u;
      const at = (cx, cy) => [(cx - size / 2 + 0.5) * u, 0.9 + lift * 3 * u, (cy - size / 2 + 0.5) * u];
      const ap = alignPositions(ver);
      const pts = [at(3, 3), at(size - 4, 3), at(3, size - 4), at(size / 2, 6), ap.length ? at(ap[ap.length - 1], ap[ap.length - 1]) : null];
      labels.forEach((l, i) => { l.visible = !!pts[i] && (s.view === 'all' || (i < 3 && s.view === 'finder') || (i === 3 && s.view === 'timing') || (i === 4 && s.view === 'align')); if (pts[i]) l.position.set(...pts[i]); });
      void half;
    };
    return {
      update() {
        const k = `${Math.round(s.version)}|${s.view}|${s.lift.toFixed(2)}|${s.quiet}`;
        if (k !== key) { key = k; refresh(); }
      },
      readout(st) {
        const ver = Math.round(st.version), size = sizeOf(ver), total = size * size;
        const fnCount = total - (info ? [...info.kind].filter((k) => k === KIND.DATA).length : 0);
        const dcw = dataCodewords(ver, 'M'), cc = ver < 10 ? 8 : 16;
        const bytes = Math.floor((dcw * 8 - 4 - cc) / 8);
        return `<div class="big">Version ${ver}</div>
          <div class="row"><span>Grid</span><b>${size} × ${size} = ${total.toLocaleString()} modules</b></div>
          <div class="row"><span>Function patterns</span><b>${fnCount.toLocaleString()} (${Math.round((fnCount / total) * 100)}%)</b></div>
          <div class="row"><span>Codewords (bytes)</span><b>${totalCodewords(ver).toLocaleString()}</b></div>
          <div class="row"><span>Text it can hold, level M</span><b>${bytes.toLocaleString()} bytes</b></div>`;
      },
      dispose() { stage.setShift(0, 0);},
    };
  },
};
