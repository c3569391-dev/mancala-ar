/*
 * app.js — Bootstraps the app:
 * builds the board + wires Layer B controls when the A-Frame scene is ready,
 * and starts the MindAR camera only after the user taps ENTER on the splash.
 */
(function () {
  'use strict';

  // Build the board, wire UI, prepare AR tracking (camera NOT started yet).
  function start() {
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
    if (sys) { try { sys.start(); } catch (e) { /* arError surfaces in ar.js */ } }
    else { scene.addEventListener('loaded', function () { startAR(scene); }); }
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
