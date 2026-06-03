# AR Mancala — Learning Assistant

An AR-based learning tool that teaches the rules of Mancala (Kalah). Mobile web,
opened via QR code, no install. Built with plain HTML/CSS/JS + A-Frame + MindAR
image tracking (all via CDN — no build step).

## Architecture (two layers)

- **Layer A — AR overlay** (`js/board3d.js`, `js/animate.js`): the holographic
  board, seeds, stores, avatars, arrows and rule notifications. Anchored to the
  image target, so it moves with the physical board.
- **Layer B — screen-fixed UI** (`index.html`, `css/`, `js/modules.js`): module
  buttons (Rules / Demo / Quiz / Free Play), feedback text, quiz options and the
  "point your camera" hint. Always tappable, even when the target is lost.

The Kalah rules engine (`js/engine.js`) is pure logic with no DOM/AR, driving
everything through `applyMove() -> { state, events }`.

## Run locally (desktop webcam test)

`getUserMedia` works on `http://localhost` (a secure context), so plain HTTP is
enough for testing on your own computer — no HTTPS needed.

```bash
cd mancala-ar
python3 -m http.server 8000
```

Open **http://localhost:8000** in Chrome/Edge/Firefox and allow camera access.

To trigger the AR overlay, point the camera at the image you compiled into
`assets/targets.mind` (your Congkak card). Show it on your phone screen or print
it, then hold it up to the camera. When recognised, the holographic board appears
anchored on top of it. Move it away and the overlay hides while Layer B stays
usable.

The camera prefers the rear lens (to aim at the physical board on a phone) and
falls back to the front lens automatically on devices without one (e.g. a laptop).

> Testing from a phone over your LAN (not localhost) **does** require HTTPS.
> Use a tunnel (e.g. `npx localtunnel --port 8000`) or host on GitHub Pages /
> Netlify, which serve HTTPS automatically.

## Verify the engine

```bash
node js/engine.test.js
```

Headless suite covering sowing, store-skipping, extra turn, capture (and its
negatives), game end, sweep, winner/tie, illegal moves, and immutability.

## Swap in your own board target (later)

1. Photograph your physical Mancala board (good lighting, flat, detailed).
2. Compile it to a `.mind` file at
   https://hiukim.github.io/mind-ar-js-doc/tools/compile/
3. Replace `assets/targets.mind` with your file (keep the same name).
4. If your board is larger/smaller in view, tweak the `#board-anchor` `scale`
   in `index.html` so the virtual board overlays the real one.

## Deploy

Static hosting works as-is. Push to GitHub Pages or drag the folder onto Netlify;
both provide HTTPS so phones can open it via QR code.
