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
