// A small, complete QR code (Model 2) encoder, decoder and image scanner. No libraries.
// Written for QRCodeClear so that every demo in the box runs the real algorithm:
//   encode()       text -> bits -> codewords -> Reed-Solomon -> matrix with function patterns -> best mask
//   decodeMatrix() matrix -> format info -> unmask -> codewords -> Reed-Solomon repair -> text
//   scanImage()    grayscale photo -> binarise -> find finder squares -> perspective -> sample grid -> decode
// Follows ISO/IEC 18004 (tables below are the standard ones). Modes: numeric, alphanumeric, byte (UTF-8).

export const LEVELS = ['L', 'M', 'Q', 'H'];
const LV = { L: 0, M: 1, Q: 2, H: 3 };
const FMT_BITS = { L: 1, M: 0, Q: 3, H: 2 };
export const KIND = { DATA: 0, FINDER: 1, SEP: 2, TIMING: 3, ALIGN: 4, FORMAT: 5, VERSION: 6, DARK: 7 };

const ECC_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const NUM_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];
const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

// ---------------------------------------------------------------- Reed-Solomon over GF(256), polynomial 0x11D
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
{ let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
const div = (a, b) => (a ? EXP[LOG[a] + 255 - LOG[b]] : 0);
const genCache = {};
function rsGen(n) {
  if (genCache[n]) return genCache[n];
  let g = [1];
  for (let i = 0; i < n; i++) { const ng = new Array(g.length + 1).fill(0); for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[i]); } g = ng; }
  return (genCache[n] = g);
}
export function rsEncode(data, n) {
  const g = rsGen(n), res = new Array(n).fill(0);
  for (const b of data) { const f = b ^ res.shift(); res.push(0); for (let i = 0; i < n; i++) res[i] ^= mul(g[i + 1], f); }
  return res;
}
// Repairs up to n/2 wrong bytes in msg (data followed by n check bytes). Returns { ok, count, data }.
export function rsDecode(msg, n) {
  const len = msg.length, r = msg.slice(), S = [];
  let any = false;
  for (let j = 0; j < n; j++) { let v = 0; for (let i = 0; i < len; i++) v = mul(v, EXP[j]) ^ r[i]; S.push(v); if (v) any = true; }
  if (!any) return { ok: true, count: 0, data: r };
  let C = [1], B = [1], L = 0, m = 1, b = 1;
  for (let k = 0; k < n; k++) {
    let d = S[k];
    for (let i = 1; i <= L; i++) d ^= mul(C[i] || 0, S[k - i]);
    if (d === 0) { m++; continue; }
    const T = C.slice(), coef = div(d, b);
    while (C.length < B.length + m) C.push(0);
    for (let i = 0; i < B.length; i++) C[i + m] ^= mul(coef, B[i]);
    if (2 * L <= k) { L = k + 1 - L; B = T; b = d; m = 1; } else m++;
  }
  if (L > n / 2) return { ok: false, count: L, data: r };
  const pos = [];
  for (let p = 0; p < len; p++) {
    const xi = EXP[(255 - (p % 255)) % 255]; let v = 0, xp = 1;
    for (let i = 0; i < C.length; i++) { v ^= mul(C[i], xp); xp = mul(xp, xi); }
    if (v === 0) pos.push(p);
  }
  if (pos.length !== L) return { ok: false, count: L, data: r };
  const omega = [];
  for (let k = 0; k < L; k++) { let v = 0; for (let i = 0; i <= k; i++) v ^= mul(C[i] || 0, S[k - i]); omega.push(v); }
  for (const p of pos) {
    const xi = EXP[(255 - (p % 255)) % 255], X = EXP[p % 255];
    let num = 0, xp = 1; for (let i = 0; i < omega.length; i++) { num ^= mul(omega[i], xp); xp = mul(xp, xi); }
    let den = 0; xp = 1; for (let i = 1; i < C.length; i += 2) { den ^= mul(C[i], xp); xp = mul(xp, mul(xi, xi)); }
    if (!den) return { ok: false, count: L, data: r };
    r[len - 1 - p] ^= mul(X, div(num, den));
  }
  for (let j = 0; j < n; j++) { let v = 0; for (let i = 0; i < len; i++) v = mul(v, EXP[j]) ^ r[i]; if (v) return { ok: false, count: L, data: r }; }
  return { ok: true, count: L, data: r };
}

// ---------------------------------------------------------------- geometry of a version
export const sizeOf = (ver) => ver * 4 + 17;
export function alignPositions(ver) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2, size = sizeOf(ver);
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const res = [6];
  for (let p = size - 7; res.length < n; p -= step) res.splice(1, 0, p);
  return res;
}
export function rawModules(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) { const n = Math.floor(ver / 7) + 2; r -= (25 * n - 10) * n - 55; if (ver >= 7) r -= 36; }
  return r;
}
export const eccPerBlock = (ver, ecc) => ECC_PER_BLOCK[LV[ecc]][ver];
export const numBlocks = (ver, ecc) => NUM_BLOCKS[LV[ecc]][ver];
export const totalCodewords = (ver) => Math.floor(rawModules(ver) / 8);
export const dataCodewords = (ver, ecc) => totalCodewords(ver) - eccPerBlock(ver, ecc) * numBlocks(ver, ecc);

const FUNC_CACHE = new Map();
// The map of which modules are function patterns, for one version (cached). kind: KIND.*, base: 1 = dark.
export function functionMap(ver) {
  if (FUNC_CACHE.has(ver)) return FUNC_CACHE.get(ver);
  const size = sizeOf(ver), kind = new Uint8Array(size * size), base = new Uint8Array(size * size), set = (x, y, k, d = 0) => { kind[y * size + x] = k; base[y * size + x] = d; };
  const isFn = new Uint8Array(size * size);
  const mark = (x, y, k, d) => { isFn[y * size + x] = 1; set(x, y, k, d); };
  for (let i = 0; i < size; i++) { mark(6, i, KIND.TIMING, i % 2 === 0 ? 1 : 0); mark(i, 6, KIND.TIMING, i % 2 === 0 ? 1 : 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      mark(x, y, d === 4 ? KIND.SEP : KIND.FINDER, d !== 2 && d !== 4 ? 1 : 0);
    }
  }
  const ap = alignPositions(ver);
  for (let i = 0; i < ap.length; i++) for (let j = 0; j < ap.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mark(ap[i] + dx, ap[j] + dy, KIND.ALIGN, Math.max(Math.abs(dx), Math.abs(dy)) !== 1 ? 1 : 0);
  }
  for (let i = 0; i < 9; i++) { mark(8, i, KIND.FORMAT, 0); mark(i, 8, KIND.FORMAT, 0); }
  for (let i = 0; i < 8; i++) { mark(size - 1 - i, 8, KIND.FORMAT, 0); mark(8, size - 1 - i, KIND.FORMAT, 0); }
  mark(8, size - 8, KIND.DARK, 1);
  if (ver >= 7) for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3), b = Math.floor(i / 3); mark(a, b, KIND.VERSION, 0); mark(b, a, KIND.VERSION, 0); }
  const out = { size, kind, base, isFn };
  FUNC_CACHE.set(ver, out);
  return out;
}

function formatBits(ecc, mask) {
  const data = (FMT_BITS[ecc] << 3) | mask; let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}
function versionBits(ver) { let rem = ver; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25); return (ver << 12) | rem; }
const bit = (x, i) => (x >>> i) & 1;
function formatCells(size) {
  const a = [], b = [];
  for (let i = 0; i <= 5; i++) a.push([8, i]);
  a.push([8, 7], [8, 8], [7, 8]);
  for (let i = 9; i < 15; i++) a.push([14 - i, 8]);
  for (let i = 0; i < 8; i++) b.push([size - 1 - i, 8]);
  for (let i = 8; i < 15; i++) b.push([8, size - 15 + i]);
  return [a, b];
}

export const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => ((((x * y) % 2) + ((x * y) % 3)) % 2) === 0,
  (x, y) => ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0,
];

// Walks the zig-zag path, calling fn(x, y, i) for every non-function module in reading order.
function walk(size, isFn, fn) {
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
      if (!isFn[y * size + x]) fn(x, y, i++);
    }
  }
  return i;
}

// ---------------------------------------------------------------- penalty (the four rules used to pick a mask)
export function penalty(mod, size) {
  let p = 0;
  const at = (x, y) => mod[y * size + x];
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < size; a++) {
      let run = 1, prev = pass ? at(a, 0) : at(0, a);
      for (let b = 1; b < size; b++) {
        const c = pass ? at(a, b) : at(b, a);
        if (c === prev) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else { run = 1; prev = c; }
      }
      for (let b = 0; b + 11 <= size; b++) {
        let m1 = true, m2 = true;
        const P1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], P2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
        for (let k = 0; k < 11; k++) { const c = pass ? at(a, b + k) : at(b + k, a); if (c !== P1[k]) m1 = false; if (c !== P2[k]) m2 = false; }
        if (m1) p += 40; if (m2) p += 40;
      }
    }
  }
  let dark = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const c = at(x, y); dark += c;
    if (x + 1 < size && y + 1 < size && c === at(x + 1, y) && c === at(x, y + 1) && c === at(x + 1, y + 1)) p += 3;
  }
  const total = size * size;
  p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return p;
}

// ---------------------------------------------------------------- segments
export function pickMode(text) {
  if (/^[0-9]*$/.test(text) && text.length) return 'numeric';
  if (text.length && [...text].every((c) => ALNUM.includes(c))) return 'alphanumeric';
  return 'byte';
}
const MODE_BITS = { numeric: 1, alphanumeric: 2, byte: 4 };
const ccBits = (mode, ver) => ({ numeric: [10, 12, 14], alphanumeric: [9, 11, 13], byte: [8, 16, 16] }[mode][ver < 10 ? 0 : ver < 27 ? 1 : 2]);
function payload(mode, text) {
  if (mode === 'byte') { const bytes = [...new TextEncoder().encode(text)]; return { count: bytes.length, bits: bytes.flatMap((b) => bitsOf(b, 8)) }; }
  const out = [];
  if (mode === 'numeric') {
    for (let i = 0; i < text.length; i += 3) { const g = text.slice(i, i + 3); out.push(...bitsOf(parseInt(g, 10), g.length * 3 + 1)); }
  } else {
    for (let i = 0; i < text.length; i += 2) {
      if (i + 1 < text.length) out.push(...bitsOf(ALNUM.indexOf(text[i]) * 45 + ALNUM.indexOf(text[i + 1]), 11));
      else out.push(...bitsOf(ALNUM.indexOf(text[i]), 6));
    }
  }
  return { count: text.length, bits: out };
}
function bitsOf(v, n) { const a = []; for (let i = n - 1; i >= 0; i--) a.push((v >>> i) & 1); return a; }

// ---------------------------------------------------------------- encode
// opts: { ecc: 'L'|'M'|'Q'|'H', mask: -1 (best) | 0..7, minVersion: 1..40, maxVersion }
export function encode(text, opts = {}) {
  const ecc = opts.ecc || 'M', minV = opts.minVersion || 1, maxV = opts.maxVersion || 40;
  const mode = pickMode(text), pl = payload(mode, text);
  let ver = minV, needed = 0;
  for (; ver <= maxV; ver++) {
    needed = 4 + ccBits(mode, ver) + pl.bits.length;
    if (pl.count < (1 << ccBits(mode, ver)) && needed <= dataCodewords(ver, ecc) * 8) break;
  }
  if (ver > maxV) throw new Error('too long for a QR code at this level');
  const cap = dataCodewords(ver, ecc) * 8;
  const bits = [], segs = [];
  const add = (arr, kind) => { segs.push({ kind, from: bits.length, to: bits.length + arr.length }); bits.push(...arr); };
  add(bitsOf(MODE_BITS[mode], 4), 'mode');
  add(bitsOf(pl.count, ccBits(mode, ver)), 'count');
  add(pl.bits, 'data');
  add(new Array(Math.min(4, cap - bits.length)).fill(0), 'term');
  add(new Array((8 - (bits.length % 8)) % 8).fill(0), 'term');
  const padStart = bits.length;
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) bits.push(...bitsOf(pad, 8));
  if (bits.length > padStart) segs.push({ kind: 'pad', from: padStart, to: bits.length });
  const dataBytes = []; for (let i = 0; i < bits.length; i += 8) dataBytes.push(parseInt(bits.slice(i, i + 8).join(''), 2));

  // split into blocks, add Reed-Solomon check bytes, interleave
  const nb = numBlocks(ver, ecc), eb = eccPerBlock(ver, ecc), raw = totalCodewords(ver);
  const nShort = nb - (raw % nb), shortLen = Math.floor(raw / nb);
  const blocks = []; let k = 0;
  for (let i = 0; i < nb; i++) {
    const dl = shortLen - eb + (i < nShort ? 0 : 1), d = dataBytes.slice(k, k + dl); k += dl;
    blocks.push({ data: d, ecc: rsEncode(d, eb) });
  }
  const words = [], owner = [];
  for (let i = 0; i < shortLen - eb + 1; i++) blocks.forEach((b, j) => { if (i < b.data.length) { words.push(b.data[i]); owner.push(j); } });
  for (let i = 0; i < eb; i++) blocks.forEach((b, j) => { words.push(b.ecc[i]); owner.push(j); });
  const allBits = words.flatMap((w) => bitsOf(w, 8));

  const fm = functionMap(ver), size = fm.size;
  const build = (mask) => {
    const mod = new Uint8Array(fm.base);
    const bitIndex = new Int32Array(size * size).fill(-1);
    walk(size, fm.isFn, (x, y, i) => {
      bitIndex[y * size + x] = i;
      let v = i < allBits.length ? allBits[i] : 0;
      if (mask >= 0 && MASKS[mask](x, y)) v ^= 1;
      mod[y * size + x] = v;
    });
    const fb = formatBits(ecc, Math.max(0, mask)), cells = formatCells(size);
    for (const grp of cells) grp.forEach(([x, y], i) => { mod[y * size + x] = bit(fb, i); });
    if (ver >= 7) { const vb = versionBits(ver); for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3), b = Math.floor(i / 3); mod[b * size + a] = mod[a * size + b] = bit(vb, i); } }
    return { mod, bitIndex };
  };
  const scores = [];
  let mask = opts.mask ?? -1, best = null;
  if (mask < 0) {
    let bs = Infinity;
    for (let m = 0; m < 8; m++) { const b = build(m), sc = penalty(b.mod, size); scores.push(sc); if (sc < bs) { bs = sc; mask = m; best = b; } }
  } else best = build(mask);
  const raw0 = build(-1);
  return {
    text, mode, version: ver, size, ecc, mask, modules: best.mod, unmasked: raw0.mod, kind: fm.kind, bitIndex: best.bitIndex,
    segs, dataBits: pl.bits.length, dataWords: dataBytes.length, eccWords: nb * eb, totalWords: raw, words, owner, blocks: blocks.map((b) => ({ data: b.data.length, ecc: b.ecc.length })),
    scores, penaltyOf: (m) => (scores[m] ?? penalty(build(m).mod, size)), withMask: (m) => build(m).mod, dataBytes,
  };
}

// ---------------------------------------------------------------- decode a matrix (1 = dark)
function nearestFormat(bits15) {
  let best = -1, bd = 99;
  for (let d = 0; d < 32; d++) {
    let rem = d; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const cw = ((d << 10) | rem) ^ 0x5412;
    let x = cw ^ bits15, c = 0; while (x) { c += x & 1; x >>>= 1; }
    if (c < bd) { bd = c; best = d; }
  }
  return { data: best, dist: bd };
}
export function decodeMatrix(mod, size) {
  const fail = (reason, extra = {}) => ({ ok: false, reason, ...extra });
  const ver = (size - 17) / 4;
  if (!Number.isInteger(ver) || ver < 1 || ver > 40) return fail('This is not a QR code size.');
  const at = (x, y) => mod[y * size + x];
  const read = (cells) => { let v = 0; cells.forEach(([x, y], i) => { v |= at(x, y) << i; }); return v; };
  const [c1, c2] = formatCells(size), f1 = nearestFormat(read(c1)), f2 = nearestFormat(read(c2));
  const f = f1.dist <= f2.dist ? f1 : f2;
  if (f.dist > 3) return fail('The format information is too damaged to read.', { format: f });
  const ecc = ['M', 'L', 'H', 'Q'][f.data >> 3], mask = f.data & 7;
  const fm = functionMap(ver), nbits = totalCodewords(ver) * 8, bits = new Uint8Array(nbits);
  walk(size, fm.isFn, (x, y, i) => { if (i < nbits) bits[i] = at(x, y) ^ (MASKS[mask](x, y) ? 1 : 0); });
  const words = []; for (let i = 0; i < nbits; i += 8) { let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]; words.push(v); }
  const nb = numBlocks(ver, ecc), eb = eccPerBlock(ver, ecc), raw = words.length, nShort = nb - (raw % nb), shortLen = Math.floor(raw / nb);
  const dat = Array.from({ length: nb }, () => []), ecs = Array.from({ length: nb }, () => []);
  let k = 0;
  for (let i = 0; i < shortLen - eb + 1; i++) for (let j = 0; j < nb; j++) if (i < shortLen - eb || j >= nShort) dat[j].push(words[k++]);
  for (let i = 0; i < eb; i++) for (let j = 0; j < nb; j++) ecs[j].push(words[k++]);
  const blocks = [], out = []; let fixed = 0, allOk = true;
  for (let j = 0; j < nb; j++) {
    const r = rsDecode([...dat[j], ...ecs[j]], eb);
    blocks.push({ errors: r.count, ok: r.ok, cap: Math.floor(eb / 2) });
    if (r.ok) { fixed += r.count; out.push(...r.data.slice(0, dat[j].length)); } else allOk = false;
  }
  const info = { version: ver, ecc, mask, blocks, fixed, formatDist: f.dist };
  if (!allOk) return fail('Too many damaged bytes for the error correction to repair.', info);
  // parse segments
  const bs = out.flatMap((w) => bitsOf(w, 8)); let p = 0;
  const take = (n) => { if (p + n > bs.length) return -1; let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | bs[p++]; return v; };
  let text = '', bytes = [];
  while (p + 4 <= bs.length) {
    const m = take(4);
    if (m === 0) break;
    if (m === 7) { take(8); continue; }
    const mode = m === 1 ? 'numeric' : m === 2 ? 'alphanumeric' : m === 4 ? 'byte' : null;
    if (!mode) return fail('This code uses a mode this demo does not read (for example Kanji).', info);
    const n = take(ccBits(mode, ver));
    if (n < 0) break;
    if (mode === 'numeric') { for (let i = 0; i < n; i += 3) { const g = Math.min(3, n - i), v = take(g * 3 + 1); text += String(v).padStart(g, '0'); } } else if (mode === 'alphanumeric') {
      for (let i = 0; i < n; i += 2) { if (n - i >= 2) { const v = take(11); text += ALNUM[Math.floor(v / 45)] + ALNUM[v % 45]; } else text += ALNUM[take(6)]; }
    } else { const seg = []; for (let i = 0; i < n; i++) seg.push(take(8)); bytes.push(...seg); text += new TextDecoder().decode(new Uint8Array(seg)); }
  }
  return { ok: true, text, ...info };
}

// ---------------------------------------------------------------- image scanner
// gray: Uint8Array/Uint8ClampedArray of w*h luminance. Returns { ok, text, stages... } for the demos to draw.
export function binarize(gray, w, h, win = Math.max(15, Math.round(Math.min(w, h) / 8)), k = 0.9) {
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += gray[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; } }
  const bin = new Uint8Array(w * h), r = win >> 1;
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const s = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
      bin[y * w + x] = gray[y * w + x] < (s / ((x1 - x0) * (y1 - y0))) * k ? 1 : 0;
    }
  }
  return bin;
}

function runsCheck(r) { // r: five run lengths d l d l d -> module size or 0
  const t = r[0] + r[1] + r[2] + r[3] + r[4]; if (t < 7) return 0;
  const m = t / 7, tol = m * 0.6;
  return Math.abs(r[0] - m) < tol && Math.abs(r[1] - m) < tol && Math.abs(r[2] - 3 * m) < 3 * tol && Math.abs(r[3] - m) < tol && Math.abs(r[4] - m) < tol ? m : 0;
}
// Looks along a line through (cx,cy) in direction (dx,dy) for the 1:1:3:1:1 pattern centred there.
function crossCheck(bin, w, h, cx, cy, dx, dy, maxLen) {
  const get = (t) => { const x = Math.round(cx + dx * t), y = Math.round(cy + dy * t); return x < 0 || y < 0 || x >= w || y >= h ? -1 : bin[y * w + x]; };
  if (get(0) !== 1) return null;
  const run = (sgn, want) => { let t = 0; while (t < maxLen && get(sgn * (t + 1)) === want) t++; return t; };
  const c1 = run(1, 1), c2 = run(-1, 1);
  let t = c1 + 1; let l1 = 0; while (t < maxLen * 2 && get(t) === 0) { l1++; t++; } t = c1 + l1 + 1; let d1 = 0; while (t < maxLen * 3 && get(t) === 1) { d1++; t++; } // far dark ring
  t = -(c2 + 1); let l2 = 0; while (t > -maxLen * 2 && get(t) === 0) { l2++; t--; } t = -(c2 + l2 + 1); let d2 = 0; while (t > -maxLen * 3 && get(t) === 1) { d2++; t--; }
  const runs = [d2, l2, c1 + c2 + 1, l1, d1], m = runsCheck(runs);
  if (!m) return null;
  return { m, off: (c1 - c2) / 2, len: runs[0] + runs[1] + runs[2] + runs[3] + runs[4] };
}
export function findFinders(bin, w, h) {
  const cands = [];
  for (let y = 0; y < h; y++) {
    const runs = []; let x = 0;
    while (x < w) { const v = bin[y * w + x]; let n = 0; while (x < w && bin[y * w + x] === v) { x++; n++; } runs.push({ v, n, end: x }); }
    for (let i = 0; i + 4 < runs.length; i++) {
      if (runs[i].v !== 1) continue;
      const r = runs.slice(i, i + 5).map((q) => q.n), m = runsCheck(r);
      if (!m) continue;
      const cx = runs[i + 2].end - runs[i + 2].n / 2;
      const v = crossCheck(bin, w, h, cx, y, 0, 1, r[2] * 2);
      if (!v) continue;
      const cy = y + v.off, hh = crossCheck(bin, w, h, cx, cy, 1, 0, r[2] * 2);
      if (!hh) continue;
      const size = (m + v.m + hh.m) / 3, nx = cx + hh.off;
      const hit = cands.find((c) => Math.hypot(c.x - nx, c.y - cy) < Math.max(3, c.m * 2) && Math.abs(c.m - size) < c.m * 0.5);
      if (hit) { hit.x = (hit.x * hit.n + nx) / (hit.n + 1); hit.y = (hit.y * hit.n + cy) / (hit.n + 1); hit.m = (hit.m * hit.n + size) / (hit.n + 1); hit.n++; } else cands.push({ x: nx, y: cy, m: size, n: 1 });
    }
  }
  return cands.filter((c) => c.n >= 2).sort((a, b) => b.n - a.n).slice(0, 12);
}
function pickThree(c) {
  let best = null;
  for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) for (let k = j + 1; k < c.length; k++) {
    const t = [c[i], c[j], c[k]];
    for (let v = 0; v < 3; v++) {
      const A = t[v], B = t[(v + 1) % 3], C = t[(v + 2) % 3];
      const ab = Math.hypot(B.x - A.x, B.y - A.y), ac = Math.hypot(C.x - A.x, C.y - A.y);
      if (ab < 1 || ac < 1) continue;
      const ratio = Math.max(ab, ac) / Math.min(ab, ac), cos = Math.abs(((B.x - A.x) * (C.x - A.x) + (B.y - A.y) * (C.y - A.y)) / (ab * ac));
      const msz = Math.max(A.m, B.m, C.m) / Math.min(A.m, B.m, C.m);
      if (ratio > 1.6 || msz > 1.8 || cos > 0.5) continue;
      const score = cos + (ratio - 1) * 0.5 + (msz - 1) * 0.3 - (A.n + B.n + C.n) * 0.001;
      if (!best || score < best.score) best = { score, A, B, C };
    }
  }
  if (!best) return null;
  let { A, B, C } = best;
  if ((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x) < 0) [B, C] = [C, B];
  return { tl: A, tr: B, bl: C };
}
// Solves the 3x3 perspective transform taking four points s[i] to four points d[i].
export function homography(s, d) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = s[i], [u, v] = d[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  for (let c = 0; c < 8; c++) {
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    if (Math.abs(A[c][c]) < 1e-12) return null;
    for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
  }
  const h = b.map((v, i) => v / A[i][i]);
  return [...h, 1];
}
export const applyH = (H, x, y) => { const z = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / z, (H[3] * x + H[4] * y + H[5]) / z]; };

export function scanImage(gray, w, h, opts = {}) {
  const res = { ok: false, w, h, finders: [], reason: '' };
  res.bin = binarize(gray, w, h);
  res.finders = findFinders(res.bin, w, h);
  if (res.finders.length < 3) { res.reason = res.finders.length ? 'Only ' + res.finders.length + ' finder square' + (res.finders.length === 1 ? '' : 's') + ' found. A code needs three.' : 'No finder squares found.'; return res; }
  const t = pickThree(res.finders);
  if (!t) { res.reason = 'The finder squares do not make a corner.'; return res; }
  res.tri = t;
  const m = (t.tl.m + t.tr.m + t.bl.m) / 3, dTR = Math.hypot(t.tr.x - t.tl.x, t.tr.y - t.tl.y), dBL = Math.hypot(t.bl.x - t.tl.x, t.bl.y - t.tl.y);
  const dim = (dTR + dBL) / 2 / m + 7;
  const ver = Math.min(40, Math.max(1, Math.round((dim - 17) / 4))), size = sizeOf(ver);
  res.version = ver; res.size = size; res.moduleSize = m;
  const span = size - 7, ux = (t.tr.x - t.tl.x) / span, uy = (t.tr.y - t.tl.y) / span, vx = (t.bl.x - t.tl.x) / span, vy = (t.bl.y - t.tl.y) / span;
  const aff = (c, r) => [t.tl.x + (c - 3.5) * ux + (r - 3.5) * vx, t.tl.y + (c - 3.5) * uy + (r - 3.5) * vy];
  const fourth = [size - 3.5, size - 3.5];
  let p4 = aff(fourth[0], fourth[1]);
  if (ver >= 2) {
    const ap = alignPositions(ver), ac = ap[ap.length - 1] + 0.5, tpl = (dx, dy) => (Math.max(Math.abs(dx), Math.abs(dy)) === 1 ? 0 : 1);
    let bestS = -1, bc = ac, br = ac; const all = [];
    for (let dr = -3; dr <= 3; dr += 0.25) for (let dc = -3; dc <= 3; dc += 0.25) {
      let sc = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const [px, py] = aff(ac + dc + dx, ac + dr + dy), xi = Math.floor(px), yi = Math.floor(py);
        if (xi >= 0 && yi >= 0 && xi < w && yi < h && res.bin[yi * w + xi] === tpl(dx, dy)) sc++;
      }
      all.push([sc, dc, dr]); if (sc > bestS) bestS = sc;
    }
    // many offsets tie when the pattern is sharp: take the centre of the best ones
    const top = all.filter((q) => q[0] >= bestS), mc = top.reduce((u, q) => u + q[1], 0) / top.length, mr = top.reduce((u, q) => u + q[2], 0) / top.length;
    bc = ac + mc; br = ac + mr;
    if (bestS >= 21) { const q = aff(bc, br); res.alignment = { x: q[0], y: q[1] }; p4 = q; fourth[0] = ac; fourth[1] = ac; }
  }
  const H = homography([[3.5, 3.5], [size - 3.5, 3.5], [3.5, size - 3.5], fourth], [[t.tl.x, t.tl.y], [t.tr.x, t.tr.y], [t.bl.x, t.bl.y], p4]);
  if (!H) { res.reason = 'Could not straighten the picture.'; return res; }
  res.H = H;
  res.corners = [[0, 0], [size, 0], [size, size], [0, size]].map(([c, r]) => applyH(H, c, r));
  const mod = new Uint8Array(size * size), pts = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    let dark = 0;
    for (const [oc, or] of [[0, 0], [-0.25, 0], [0.25, 0], [0, -0.25], [0, 0.25]]) {
      const [px, py] = applyH(H, c + 0.5 + oc, r + 0.5 + or), xi = Math.round(px), yi = Math.round(py);
      if (xi >= 0 && yi >= 0 && xi < w && yi < h) dark += res.bin[yi * w + xi];
    }
    mod[r * size + c] = dark >= 3 ? 1 : 0;
    const [cx, cy] = applyH(H, c + 0.5, r + 0.5); pts.push(cx, cy);
  }
  res.matrix = mod; res.samples = pts;
  const dec = decodeMatrix(mod, size);
  Object.assign(res, dec);
  res.ok = !!dec.ok;
  if (!res.ok) res.reason = dec.reason;
  return res;
}
