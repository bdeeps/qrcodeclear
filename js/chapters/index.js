// The box and its chapters, in reading order.
import anatomy from './anatomy.js';
import encode from './encode.js';
import errors from './errors.js';
import scan from './scan.js';
import trust from './trust.js';

export const BOX = { slug: 'qrcodeclear', title: "QRCodeClear" };
export const CHAPTERS = [anatomy, encode, errors, scan, trust];
