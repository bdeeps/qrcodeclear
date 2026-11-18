// Chapter 5: trust and cousins. A QR code only carries text. What matters is where that text sends you.
// The checker below is a few plain rules, not a security product. The "other codes" are labelled schematic drawings.
import { THREE, M, canvasTexture } from '../kit.js';
import { encode, scanImage } from '../qr.js';
import { Board, COL, matrixCanvas } from '../qrview.js';
import { esc } from '../ui.js';

const SCEN = {
  menu: { n: 'Cafe menu', text: 'https://glassbox.how/menu', sticker: false, say: 'A code printed on the table card by the cafe.' },
  meter: { n: 'Parking meter', text: 'http://pay-parkng-city.example.com/p/8842', sticker: true, say: 'A sticker has been pasted over the real code on the meter.' },
  parcel: { n: 'Parcel notice', text: 'https://track-parcel.example.net.secure-login.example.org/fee', sticker: false, say: 'A card through the door asks you to scan to pay a "delivery fee".' },
  short: { n: 'Short link', text: 'https://s.example/a8Kd3', sticker: false, say: 'A flyer with a link shortener.' },
  wifi: { n: 'Wi-Fi card', text: 'WIFI:T:WPA;S:CafeGuest;P:coffee123;;', sticker: false, say: 'Not a link at all: a code can hold any text.' },
};
const KINDS = {
  qr: { n: 'QR code', say: 'Square modules, three finder squares. Up to about 7,000 digits, a few thousand characters of text.' },
  micro: { n: 'Micro QR', say: 'A QR for tiny spaces: one finder square instead of three, and much less room.' },
  dm: { n: 'Data Matrix', say: 'An L-shaped solid edge, with alternating dots on the other two. Used on small parts, circuit boards and medicines.' },
  aztec: { n: 'Aztec code', say: 'A bullseye in the middle, with no quiet zone needed. Used on train and airline tickets.' },
  pdf: { n: 'PDF417', say: 'Stacked rows of bars. Found on driving licences and boarding passes.' },
  ean: { n: 'Barcode (EAN-13)', say: 'One dimension: 12 digits plus a check digit. It holds only a number, a key to a database.' },
};

// ---- the rule-based link checker ----
export function analyse(text) {
  const out = { host: '', flags: [], kind: 'text' };
  const m = /^(https?):\/\/([^/?#]*)([^]*)$/i.exec(text);
  if (!m) { const p = /^(WIFI|tel|sms|smsto|mailto|geo|BEGIN:VCARD|MECARD)/i.exec(text); out.kind = p ? p[1].toUpperCase() : 'text'; out.flags.push(p ? `Not a web link: it is a ${out.kind} instruction your phone may act on.` : 'Plain text.'); return out; }
  out.kind = 'link';
  let auth = m[2], host = auth.replace(/^.*@/, '').replace(/:\d+$/, '').toLowerCase();
  if (auth.includes('@')) out.flags.push('Has an @ sign: everything before it is not the real site.');
  out.host = host;
  const labels = host.split('.');
  out.reg = labels.slice(-2).join('.');
  out.prefix = labels.slice(0, -2).join('.');
  if (m[1].toLowerCase() === 'http') out.flags.push('Plain http: nothing is encrypted.');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) out.flags.push('A raw number instead of a name.');
  if (host.includes('xn--')) out.flags.push('Contains punycode (xn--): letters from another alphabet can look like Latin ones.');
  if (labels.length >= 4) out.flags.push('Many sub-parts. The real site is only the last two: ' + out.reg + '.');
  if (host.length <= 10 && /^\/[A-Za-z0-9]{4,10}$/.test(m[3])) out.flags.push('Short link: you cannot see where it goes until you open it.');
  if (/(login|secure|verify|account|pay|fee|bank)/.test(host + m[3]) && out.flags.length) out.flags.push('Asks you to log in or pay.');
  return out;
}

function drawKind(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#f2efe6'; g.fillRect(0, 0, 512, 512); g.fillStyle = '#111';
  let a = 12345; const r = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
  const grid = (n, px, ox, oy, fn) => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (fn(x, y)) g.fillRect(ox + x * px, oy + y * px, px + 0.5, px + 0.5); };
  if (kind === 'qr') { const e = encode('glassbox.how', { ecc: 'M' }); g.drawImage(matrixCanvas(e.modules, e.size, 16, 4), 0, 0, 512, 512); return c; }
  if (kind === 'micro') { const n = 15, px = 24, o = (512 - n * px) / 2; grid(n, px, o, o, (x, y) => { if (x < 8 && y < 8) { if (x === 7 || y === 7) return false; const d = Math.max(Math.abs(x - 3), Math.abs(y - 3)); return d !== 2; } if (y === 0 && x >= 8) return x % 2 === 0; if (x === 0 && y >= 8) return y % 2 === 0; return r() > 0.5; }); return c; }
  if (kind === 'dm') { const n = 16, px = 26, o = (512 - n * px) / 2; grid(n, px, o, o, (x, y) => { if (x === 0 || y === n - 1) return true; if (y === 0) return x % 2 === 1; if (x === n - 1) return y % 2 === 0; return r() > 0.5; }); return c; }
  if (kind === 'aztec') { const n = 23, px = 20, o = (512 - n * px) / 2, m = 11; grid(n, px, o, o, (x, y) => { const d = Math.max(Math.abs(x - m), Math.abs(y - m)); if (d <= 4) return d % 2 === 0; if (d === 5) { const cx = Math.abs(x - m) === 5, cy = Math.abs(y - m) === 5; if (cx && cy) return !(x < m && y > m); return r() > 0.5; } return r() > 0.5; }); return c; }
  if (kind === 'pdf') {
    const rows = 14, h = 28, pw = 5; let y0 = (512 - rows * h) / 2;
    const bars = (pat, x0, y) => { let x = x0, dark = true; for (const w of pat) { if (dark) g.fillRect(x * pw, y, w * pw, h); x += w; dark = !dark; } return x; };
    for (let rI = 0; rI < rows; rI++) { let x = 2; x = bars([8, 1, 1, 1, 1, 1, 1, 3], x, y0 + rI * h); for (let k = 0; k < 5; k++) { let left = 17; const pat = []; for (let j = 0; j < 8; j++) { const w = j === 7 ? left : 1 + Math.floor(r() * Math.min(5, left - (7 - j))); pat.push(Math.max(1, Math.min(w, left - (7 - j)))); left -= pat[j]; } if (left > 0) pat[7] += left; x = bars(pat, x, y0 + rI * h); } bars([7, 1, 1, 3, 1, 1, 1, 2, 1], x, y0 + rI * h); }
    return c;
  }
  if (kind === 'ean') { const u = 4.2, x0 = (512 - 95 * u) / 2; let x = x0; const bar = (w, tall) => { g.fillRect(x, 150, w * u, tall ? 230 : 210); x += w * u; };
    const mod = (bits) => { for (const b of bits) { if (b) g.fillRect(x, 150, u + 0.5, 210); x += u; } };
    mod([1, 0, 1]); for (let i = 0; i < 6; i++) { const b = []; for (let j = 0; j < 7; j++) b.push(r() > 0.5 ? 1 : 0); b[0] = 0; b[6] = 1; mod(b); } mod([0, 1, 0, 1, 0]); for (let i = 0; i < 6; i++) { const b = []; for (let j = 0; j < 7; j++) b.push(r() > 0.5 ? 1 : 0); b[0] = 1; b[6] = 0; mod(b); } mod([1, 0, 1]); void bar;
    g.font = '28px ui-monospace, monospace'; g.fillText('5 012345 678900', x0 + 20, 420); return c; }
  return c;
}

export default {
  id: 'trust',
  short: 'Trust it?',
  title: 'Should you trust a code?',
  subtitle: 'It is only text. The danger is where the text sends you.',
  view: { pos: [0, 8, 6.2], target: [0, 0, 0.3] },
  learn: `<p>You can't read a QR code with your eyes, so a bad one looks exactly like a good one. <b>Quishing</b> (QR phishing) uses that: a fake sticker pasted over a real code on a parking meter, a card through the door about a "delivery fee", a code in an email. The code simply holds a web address. If your phone opens it and you type a card number or password into a copy of a real site, the damage is done.</p>
    <p>The habit that helps: <b>read the address before you tap.</b> Your camera shows it. The real site is the last two parts of the name before the first single slash, so <b>example.org</b> in <i>track-parcel.example.net.secure-login.example.org</i>. Be wary of plain http, of short links that hide the destination, and of any code that asks for a payment or a login. Check whether a sticker sits on top of a printed code.</p>
    <p>A QR code can also hold a Wi-Fi password, a phone number or a contact card. Other 2D codes work the same way in spirit: <b>Data Matrix, Aztec, PDF417</b> and the one-line barcode, each tuned to a job.</p>
    <p class="tip"><b>Try it:</b> go through the five scenes. Each code is encoded and then decoded by the real reader, then checked by a few plain rules. Then switch to <b>Other codes</b>.</p>
    <p class="note">The checker is a handful of simple rules, not a security product. Absence of warnings is not proof a link is safe.</p>`,
  terms: [
    { t: 'Quishing', d: 'Phishing through a QR code: the code sends you to a fake page that steals logins or card numbers.' },
    { t: 'Registrable domain', d: 'The part of an address you can actually buy: usually the last two parts, like example.org. What comes before it can be anything.' },
    { t: 'Link shortener', d: 'A service that turns a long address into a short one, which hides the real destination.' },
  ],
  defaults: { view: 'link', scene: 'menu', kind: 'qr' },
  controls: [
    { key: 'view', type: 'seg', label: 'Look at', options: [{ v: 'link', label: 'Scan a code' }, { v: 'cousins', label: 'Other codes' }] },
    { key: 'scene', type: 'seg', label: 'Where you found it', options: Object.entries(SCEN).map(([v, o]) => ({ v, label: o.n })) },
    { key: 'kind', type: 'seg', label: 'Kind of code', options: Object.entries(KINDS).map(([v, o]) => ({ v, label: o.n })) },
  ],
  quiz: [
    { q: 'What does a QR code actually contain?', options: ['A program that runs on your phone', 'Just data, usually text like a web address', 'A virus', 'Your location'], answer: 1, why: 'It is only data. What matters is what your phone does with it, and where the link leads.' },
    { q: 'In track-parcel.example.net.secure-login.example.org, which part is the real site?', options: ['track-parcel', 'example.net', 'secure-login', 'example.org'], answer: 3, why: 'Read from the right: the last two parts before the first single slash are the real domain.' },
    { q: 'Which is a warning sign on a parking meter?', options: ['A printed code', 'A sticker over the printed code', 'A https link', 'A QR code'], answer: 1, why: 'Fake stickers over genuine codes are a common trick. Check the surface, and read the address.' },
  ],
  reel: [
    { ms: 5600, caption: 'A fake sticker on a parking meter looks just like the real code.', set: { view: 'link', scene: 'meter' }, view: { pos: [0, 7, 5.5], target: [0, 0, 0.3] }, spin: 0.3 },
    { ms: 5600, caption: 'Read the address before you tap. The real site is the last two parts.', set: { view: 'link', scene: 'parcel' }, spin: 0.3 },
    { ms: 5000, caption: 'Data Matrix, Aztec, PDF417: other codes, other jobs.', set: { view: 'cousins', kind: 'dm' }, spin: 0.4 },
  ],
  build({ stage, s }) {
    stage.setShift(stage.host.clientWidth > 900 ? 0.12 : 0, 0);
    const board = new Board(stage.root);
    const sticker = new THREE.Group(); stage.root.add(sticker);
    const stBoard = new Board(sticker); stBoard.group.scale.setScalar(0.42);
    const tag = stage.label('Sticker pasted on top', [0, 0.5, 0], sticker, 'hot');
    const art = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ toneMapped: false })); art.rotation.x = -Math.PI / 2; stage.root.add(art);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.12, 6.6), M.matte(0xf2efe6)); slab.receiveShadow = true; slab.castShadow = true; stage.root.add(slab);
    let key = '', res = null, ana = null;
    const texCache = {};
    const refresh = () => {
      const link = s.view === 'link';
      board.group.visible = link && true; slab.visible = !link; art.visible = !link; sticker.visible = link && SCEN[s.scene].sticker;
      if (link) {
        const sc = SCEN[s.scene], real = sc.sticker ? 'https://city-parking.example/pay' : sc.text;
        const showText = sc.sticker ? real : sc.text;
        const e = encode(showText, { ecc: 'M' });
        board.draw(e.size, (i) => (e.modules[i] ? [1, 0x14161d] : null));
        if (sc.sticker) {
          const f = encode(sc.text, { ecc: 'M' });
          stBoard.draw(f.size, (i) => (f.modules[i] ? [1, 0x14161d] : null));
          sticker.position.set(0.9, 0.5, 0.5); sticker.rotation.y = -0.12; sticker.scale.setScalar(1);
          stBoard.group.scale.setScalar(1.55 * (e.size + 8) / (f.size + 8) / 1);
          tag.position.set(0, 1.3, 0);
        }
        // the phone reads whichever code the camera is aimed at: the one on top
        const img = matrixCanvas((sc.sticker ? encode(sc.text, { ecc: 'M' }) : e).modules, (sc.sticker ? encode(sc.text, { ecc: 'M' }) : e).size, 10, 4);
        const g2 = img.getContext('2d').getImageData(0, 0, img.width, img.height), gray = new Uint8Array(img.width * img.height);
        for (let i = 0; i < gray.length; i++) gray[i] = g2.data[i * 4];
        res = scanImage(gray, img.width, img.height); ana = analyse(res.ok ? res.text : sc.text);
      } else {
        texCache[s.kind] ||= (() => { const t = new THREE.CanvasTexture(drawKind(s.kind)); t.colorSpace = THREE.SRGBColorSpace; return t; })();
        art.material.map = texCache[s.kind]; art.material.needsUpdate = true; art.scale.set(6.4, 6.4, 1); art.position.y = 0.065; res = null; ana = null;
      }
    };
    return {
      update() { const k = s.view + '|' + s.scene + '|' + s.kind; if (k !== key) { key = k; refresh(); } },
      readout(st) {
        if (st.view === 'cousins') { const k = KINDS[st.kind]; return `<div class="big">${k.n}</div><p class="r-say">${k.say}</p><p class="r-say" style="color:var(--dim)">A schematic drawing: the pattern parts are right, the data is random.</p>`; }
        if (!res) return '';
        const sc = SCEN[st.scene], a = ana, txt = res.ok ? res.text : sc.text;
        let url;
        if (a.kind === 'link') url = `<div class="url">${a.prefix ? `<u>${esc(a.prefix)}.</u>` : ''}<b>${esc(a.reg)}</b>${esc(txt.slice(txt.indexOf(a.host) + a.host.length))}</div>`;
        else url = `<div class="url">${esc(txt)}</div>`;
        return `<div class="big">${esc(sc.n)}</div><p class="r-say">${esc(sc.say)}</p>
          <div class="row"><span>The phone decoded</span><b>${res.ok ? 'a ' + a.kind.toLowerCase() : 'nothing'}</b></div>${url}
          ${a.flags.length ? a.flags.map((f) => `<p class="r-say"><b class="no">!</b> ${esc(f)}</p>`).join('') : '<p class="r-say"><b class="ok">✓</b> No warning signs in the address itself. Still check the surface it is printed on.</p>'}
          ${sc.sticker ? '<p class="r-say"><b class="no">!</b> The code you scan is the sticker on top, not the one printed underneath.</p>' : ''}`;
      },
      dispose() { stage.setShift(0, 0); Object.values(texCache).forEach((t) => t.dispose()); },
    };
  },
};
