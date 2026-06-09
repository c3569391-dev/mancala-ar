/*
 * app.js — Bootstraps the app:
 * builds the board + wires Layer B controls when the A-Frame scene is ready,
 * and starts the MindAR camera only after the user taps ENTER on the splash.
 */
(function () {
  'use strict';

  // Force the WebGL canvas clear colour to fully transparent so the holographic
  // board overlays the live camera video instead of an opaque black fill.
  function makeCanvasTransparent(scene) {
    if (scene && scene.renderer) scene.renderer.setClearColor(0x000000, 0);
  }

  // Desktop preview: enabled with ?preview (or ?debug) in the URL. Renders the
  // holographic board straight ahead with NO marker and NO camera, so every
  // Layer A visual — player labels, tap hints, demos, seed animation — can be
  // checked on a laptop. The normal AR flow is completely untouched.
  function isPreview() {
    return /(?:[?&#])(?:preview|debug)\b/.test(location.search + location.hash);
  }
  function enterPreview(scene) {
    var anchor = document.getElementById('board-anchor');
    var rig = document.createElement('a-entity');
    rig.setAttribute('position', '0 0.18 -1.9');
    scene.appendChild(rig);
    rig.appendChild(anchor);                 // lift the board out of the image target
    var splash = document.getElementById('splash');
    if (splash) splash.hidden = true;        // skip ENTER / camera permission
    var hint = document.getElementById('camera-hint');
    if (hint) hint.hidden = true;
  }

  // Build the board, wire UI, prepare AR tracking (camera NOT started yet).
  function start() {
    var scene = document.querySelector('a-scene');
    makeCanvasTransparent(scene);
    Board.build(document.getElementById('board-anchor'));
    Board.onPitClick(Modules.onPitClicked);
    AR.init();

    document.querySelectorAll('#mainnav button').forEach(function (b) {
      b.addEventListener('click', function () { Modules.show(b.dataset.module); });
    });
    var home = document.getElementById('home-btn');
    if (home) home.addEventListener('click', function () { Modules.show('main'); });

    Modules.show('main');
    if (isPreview()) enterPreview(scene);
  }

  // Start MindAR's camera + tracking (autoStart is off, so this is the trigger).
  function startAR(scene) {
    var sys = scene.systems && scene.systems['mindar-image-system'];
    if (sys) {
      try { sys.start(); } catch (e) { /* arError surfaces in ar.js */ }
      // Re-assert canvas transparency after the AR renderer spins up.
      makeCanvasTransparent(scene);
      setTimeout(function () { makeCanvasTransparent(scene); }, 800);
    } else {
      scene.addEventListener('loaded', function () { startAR(scene); });
    }
  }

  // Splash → ENTER starts the camera (must be a user gesture for permissions).
  function initSplash(scene) {
    var splash = document.getElementById('splash');
    var btn = document.getElementById('start-btn');
    if (!splash || !btn) return;
    var entered = false;
    btn.addEventListener('click', function () {
      if (entered) return;
      entered = true;
      document.body.classList.add('ar-active'); // body → transparent so camera shows
      startAR(scene);
      splash.classList.add('leaving');
      setTimeout(function () { splash.hidden = true; }, 600);
    });
  }

  window.addEventListener('DOMContentLoaded', function () {
    var scene = document.querySelector('a-scene');
    initSplash(scene);                 // bind ENTER immediately
    if (scene.hasLoaded) start();
    else scene.addEventListener('loaded', start);
  });
})();
