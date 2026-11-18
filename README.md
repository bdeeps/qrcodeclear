<!-- glassbox:start -->
<!-- Generated from glassbox.json by the Glassbox hub (npm run readme -- qrcodeclear). Edit glassbox.json, not this block. -->

<h1 align="center">QRCodeClear</h1>

<p align="center"><b>How does a QR code work?</b><br>A QR code is a tiny page of text, a repair kit and three squares that say where to look. Build one, scratch it and watch a real scanner read it.</p>

<p align="center"><a href="https://glassbox.how/qrcodeclear/"><b>▶ Play with it</b></a> &nbsp;·&nbsp; <a href="https://glassbox.how/e/qrcodeclear/">Read the 60-second explainer</a></p>

<p align="center">
  <a href="https://glassbox.how/e/qrcodeclear/"><img alt="Glassbox No. 224" src="https://img.shields.io/badge/Glassbox-No.%20224-8ef0ff"></a>
  <a href="https://glassbox.how/e/qrcodeclear/"><img alt="Computing" src="https://img.shields.io/badge/field-Computing-8ef0ff"></a>
  <a href="LICENSE"><img alt="Code: MIT" src="https://img.shields.io/badge/code-MIT-3fb950"></a>
  <a href="LICENSE-CONTENT.md"><img alt="Content: CC BY 4.0" src="https://img.shields.io/badge/content-CC%20BY%204.0-ef9421"></a>
  <a href="#privacy"><img alt="Privacy: explained" src="https://img.shields.io/badge/privacy-explained-555"></a>
</p>

## In 60 seconds

1. **Squares are bits.** A QR code is a grid of dark and light squares called modules. Each one is a single bit. Version 1 is 21 by 21, and each version adds 4 squares a side, up to 177 by 177 at version 40.
2. **Three squares say where to look.** The big squares in three corners show a dark, light, dark, light, dark pattern in the ratio 1 : 1 : 3 : 1 : 1. It looks the same along any line through the middle, so a camera can spot it at any angle. Timing stripes and alignment targets help it count and straighten the grid.
3. **Text becomes bytes, then a zig-zag.** The encoder packs your text as digits, capital letters or bytes, pads it, adds check bytes, and lays the bits into the grid two columns at a time. A fixed mask then flips some squares so there are no big blank patches or false finder patterns.
4. **It repairs itself.** Reed-Solomon check bytes let a reader find and fix wrong bytes. The four levels, L, M, Q and H, can repair roughly 7, 15, 25 and 30 percent of the code. That is why a scratch, or a small logo in the middle, does not stop it reading.
5. **A phone reads it in four steps.** It turns the picture black and white, hunts for the three finder squares, straightens the tilt with a perspective transform, and samples the middle of every module once. Then the decoder fixes any wrong bytes and reads the text.
6. **It only holds text.** A code can't run anything by itself. It holds a web address, a Wi-Fi password or a phone number. Fake stickers pasted over real codes, called quishing, work by sending you to the wrong address, so read the address before you tap.

## Words worth knowing

| Term | Meaning |
|---|---|
| **Module** | One square of a QR code, dark or light. It is one bit. |
| **Version** | The size of the code, from 1 (21 × 21) to 40 (177 × 177). Size is 17 + 4 × version. |
| **Finder pattern** | The 7 × 7 nested square in three corners. Its 1 : 1 : 3 : 1 : 1 ratio lets a camera find the code at any angle. |
| **Timing pattern** | A row and a column of alternating modules between the finders, used to count the grid. |
| **Alignment pattern** | A small 5 × 5 target in codes from version 2 up that helps fix perspective and bending. |
| **Quiet zone** | The blank border around the code, at least 4 modules wide, so the reader can tell where it ends. |
| **Mode** | How characters are packed into bits: numeric, alphanumeric or byte. |
| **Mask** | One of 8 fixed patterns of flipped modules that breaks up blank patches and look-alike finders. The best of 8 is chosen. |
| **Reed-Solomon code** | A way to add check bytes so a receiver can find and fix wrong bytes without a resend. |
| **Error correction level** | L, M, Q or H: how many check bytes the code carries, roughly 7, 15, 25 or 30 percent of its bytes. |
| **Quishing** | Phishing through a QR code: a fake code sends you to a page that steals logins or card numbers. |

## A short history

**From a grocery bar code patented in 1949 to a Toyota supplier's square that your phone reads in an instant.**

- **1949** · Two students patent the bar code (Norman Joseph Woodland and Bernard Silver, Philadelphia, USA)
- **1960** · Reed and Solomon invent a way to repair data (Irving Reed and Gustave Solomon, Lexington, Massachusetts, USA)
- **1974** · The first product is scanned (Marsh Supermarket staff, Troy, Ohio, USA)
- **1992** · A small team at Denso starts work (Masahiro Hara, Japan)
- **1993** · The 1:1:3:1:1 finder pattern is found (The Denso team, Japan)
- **1994** · Denso Wave announces the QR Code (Denso Wave, Japan)
- **2000** · ISO/IEC 18004 makes it international (ISO and IEC, Geneva, Switzerland)
- **2002** · A phone reads a QR code for the first time (Sharp for J-Phone, Japan)

The full story, with 33 moments, charts, people and 38 sources: [glassbox.how/e/qrcodeclear/history](https://glassbox.how/e/qrcodeclear/history/). The data lives in [`history.json`](history.json).

## Privacy

This box has no accounts and no ads, and it ships its own fonts and libraries. When you run it yourself it sends nothing anywhere. On glassbox.how, the site's `/bar.js` also loads Glassbox's analytics: **Google Analytics** to count visits (it asks first in the EU, UK and Switzerland, and stays off when your browser sends Global Privacy Control or Do Not Track) and **ClickTrust** to detect bots.

It remembers a few things **in your own browser only**, and never sends them anywhere:

| Browser storage key | What it holds |
|---|---|
| `qrcodeclear.v1` | Which chapters you have opened, your best quiz scores, and sound on or off. |

Exactly what each one sees is at [glassbox.how/privacy](https://glassbox.how/privacy/).

## Licences

- **Code:** [MIT](LICENSE). Use it, change it, ship it.
- **Explanations, text, images and videos** (`glassbox.json`, `glassbox/`): [CC BY 4.0](LICENSE-CONTENT.md). Credit “Glassbox, glassbox.how/e/qrcodeclear”.
- **Third-party parts** keep their own licences: [three.js](https://threejs.org) (MIT), [Geist, Instrument Serif](https://openfontlicense.org) (SIL OFL 1.1), [QR Code is a registered trademark of Denso Wave Incorporated. The encoder, decoder and scanner here are original code.](https://www.qrcode.com/en/faq.html) (Trademark notice).
- The Glassbox name and logo aren't covered by either licence. See the [terms](https://glassbox.how/terms/).

Found a mistake? [Open an issue](https://github.com/bdeeps/qrcodeclear/issues). Corrections happen in public.
<!-- glassbox:end -->

## Run it

It's plain HTML, CSS and JavaScript. No build step and no dependencies. Run locally, it contacts no other website.

```bash
python3 -m http.server 8000
```

Three.js and the fonts ship in `vendor/` and `fonts/`, so it also works offline.

Then open http://localhost:8000.

## How it's built

| File | What |
|---|---|
| `index.html`, `css/app.css` | The page and its styles |
| `js/app.js`, `js/stage.js`, `js/ui.js`, `js/kit.js` | The shared Glassbox 3D engine: chapters, 3D stage, controls, quiz, video director |
| `js/chapters/*.js` | One file per chapter: the 3D model, controls, text, key terms, quiz and video scenes |
| `glassbox.json` | Title, question, explainer beats, key terms, browser storage and credits shown on glassbox.how |
| `reel` in each chapter | The storyboard the Glassbox studio records into short videos |
| `glassbox/` | The published video, slides, thumbnail and post copy |
| `fonts/`, `vendor/three/` | Self-hosted Geist and Instrument Serif (SIL OFL 1.1) and three.js (MIT) |
