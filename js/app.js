/*
 * app.js — Bootstraps the app:
 * creates the A-Frame scene only after a landscape ENTER press, then builds the
 * board and wires Layer B controls when that scene is ready.
 */
(function () {
  'use strict';

  var arjsLoadPromise = null;

  // Force the WebGL canvas clear colour to fully transparent so AR.js can place
  // the live webcam video behind the holographic A-Frame canvas.
  function makeCanvasTransparent(scene) {
    if (scene && scene.renderer) scene.renderer.setClearColor(0x000000, 0);
  }

  // Desktop preview: enabled with ?preview (or ?debug) in the URL. It creates
  // the A-Frame scene without loading AR.js, so no camera starts on a laptop.
  function isPreview() {
    return /(?:[?&#])(?:preview|debug)\b/.test(location.search + location.hash);
  }
  function enterPreview(scene) {
    var anchor = document.getElementById('board-anchor');
    var rig = document.createElement('a-entity');
    rig.setAttribute('position', '0 0.18 -1.9');
    scene.appendChild(rig);
    anchor.setAttribute('visible', 'true');
    rig.appendChild(anchor);
    var splash = document.getElementById('splash');
    if (splash) splash.hidden = true;
    var hint = document.getElementById('camera-hint');
    if (hint) hint.hidden = true;
  }

  // Build the hidden Stage 1 board and wire the existing screen UI. Keeping the
  // board built preserves module behavior without attaching it to the marker.
  function start(scene) {
    makeCanvasTransparent(scene);
    Board.build(document.getElementById('board-anchor'));
    Board.onPitClick(Modules.onPitClicked);

    document.querySelectorAll('#mainnav button').forEach(function (button) {
      button.addEventListener('click', function () { Modules.show(button.dataset.module); });
    });
    var home = document.getElementById('home-btn');
    if (home) home.addEventListener('click', function () { Modules.show('main'); });

    Modules.show('main');
    if (isPreview()) enterPreview(scene);
  }

  function viewportIsLandscape() {
    var viewport = window.visualViewport;
    var width = viewport ? viewport.width : window.innerWidth;
    var height = viewport ? viewport.height : window.innerHeight;
    return width > height;
  }

  function sceneTemplate() {
    return document.getElementById('ar-scene-template');
  }

  // AR.js starts its webcam session when an A-Frame scene renders. Load the
  // pinned library first, then create exactly one scene after ENTER.
  function loadARjs() {
    if (arjsLoadPromise) return arjsLoadPromise;
    arjsLoadPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = sceneTemplate().dataset.arjsSrc;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return arjsLoadPromise;
  }

  function createScene(enableAR) {
    var template = sceneTemplate();
    var scene = template.content.querySelector('a-scene').cloneNode(true);
    if (!enableAR) scene.removeAttribute('arjs');
    document.getElementById('ar-scene-host').appendChild(scene);
    return scene;
  }

  function startWhenLoaded(scene) {
    if (scene.hasLoaded) start(scene);
    else scene.addEventListener('loaded', function () { start(scene); }, { once: true });
  }

  function revealApp(splash) {
    document.body.classList.add('ar-active');
    splash.classList.add('leaving');
    setTimeout(function () { splash.hidden = true; }, 600);
  }

  // Splash → ENTER creates the AR.js scene only when the viewport is landscape.
  function initSplash() {
    var splash = document.getElementById('splash');
    var button = document.getElementById('start-btn');
    var note = splash && splash.querySelector('.splash-note');
    if (!splash || !button) return;
    var entered = false;

    button.addEventListener('click', function () {
      if (entered) return;
      if (!viewportIsLandscape()) {
        if (note) note.textContent = 'Rotate your phone to landscape';
        return;
      }

      entered = true;
      if (note) note.textContent = 'Starting camera…';
      loadARjs().then(function () {
        var scene = createScene(true);
        AR.init(scene);
        startWhenLoaded(scene);
        revealApp(splash);
      }).catch(function () {
        entered = false;
        if (note) note.textContent = 'Camera unavailable — check your connection and reload';
      });
    });
  }

  window.addEventListener('DOMContentLoaded', function () {
    if (isPreview()) {
      var scene = createScene(false);
      startWhenLoaded(scene);
      return;
    }
    initSplash();
  });
})();
