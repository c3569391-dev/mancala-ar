/*
 * Temporary phone-visible diagnostics for marker tracking and the gameplay
 * pipeline. Remove this block after the device evidence has been collected.
 */
window.ARDebug = (function () {
  'use strict';

  var started = performance.now();
  var state = {
    marker: 'WAITING', foundCount: 0, lostCount: 0,
    lastFound: null, lastLost: null,
    module: 'MAIN', pit: 'LISTENER WAITING', demoClick: 'NO',
    animate: 'NOT CALLED', freeMove: 'NOT RECEIVED'
  };
  var overlay = null;
  var target = null;
  var boardAnchor = null;
  var renderTimer = null;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('pre');
    overlay.id = 'ar-runtime-debug';
    overlay.setAttribute('aria-live', 'polite');
    overlay.style.cssText =
      'position:fixed;top:6px;left:50%;transform:translateX(-50%);' +
      'z-index:9999;width:min(430px,62vw);margin:0;padding:5px 8px;' +
      'pointer-events:none;white-space:pre-wrap;text-align:left;' +
      'font:600 9px/1.25 monospace;color:#dffcff;background:rgba(2,8,16,.82);' +
      'border:1px solid rgba(61,240,255,.7);border-radius:6px;' +
      'box-shadow:0 0 8px rgba(61,240,255,.35)';
    document.body.appendChild(overlay);
    return overlay;
  }

  function effectiveVisible(el) {
    var object = el && el.object3D;
    if (!object) return false;
    while (object) {
      if (!object.visible) return false;
      object = object.parent;
    }
    return true;
  }

  function yes(value) { return value ? 'YES' : 'NO'; }
  function eventTime(value) {
    if (value === null) return 'NEVER';
    return '+' + ((value - started) / 1000).toFixed(1) + 's (' +
      ((performance.now() - value) / 1000).toFixed(1) + 's ago)';
  }

  function render() {
    ensureOverlay();
    if (!target) target = document.getElementById('target');
    if (!boardAnchor) boardAnchor = document.getElementById('board-anchor');
    var ownVisible = !!(boardAnchor && boardAnchor.object3D && boardAnchor.object3D.visible);
    var targetVisible = !!(target && target.object3D && target.object3D.visible);
    overlay.textContent =
      'MARKER: ' + state.marker + ' | TARGET VISIBLE: ' + yes(targetVisible) + '\n' +
      'FOUND: ' + state.foundCount + ' @ ' + eventTime(state.lastFound) + '\n' +
      'LOST: ' + state.lostCount + ' @ ' + eventTime(state.lastLost) + '\n' +
      'BOARD: OWN ' + yes(ownVisible) + ' / EFFECTIVE ' + yes(effectiveVisible(boardAnchor)) + '\n' +
      'MODULE: ' + state.module + ' | PIT: ' + state.pit + '\n' +
      'DEMO CLICK: ' + state.demoClick + '\n' +
      'ANIMATE: ' + state.animate + ' | FREE MOVE: ' + state.freeMove;
  }

  function setValue(key, value) { state[key] = String(value); render(); }
  function bind(scene, targetEl) {
    target = targetEl || (scene && scene.querySelector('#target'));
    boardAnchor = scene && scene.querySelector('#board-anchor');
    render();
    if (!renderTimer) renderTimer = setInterval(render, 250);
  }

  return {
    bind: bind,
    markerFound: function () {
      state.marker = 'FOUND'; state.foundCount += 1; state.lastFound = performance.now(); render();
    },
    markerLost: function () {
      state.marker = 'LOST'; state.lostCount += 1; state.lastLost = performance.now(); render();
    },
    setModule: function (value) { setValue('module', value); },
    setPit: function (value) { setValue('pit', value); },
    setDemoClick: function (value) { setValue('demoClick', value); },
    setAnimate: function (value) { setValue('animate', value); },
    setFreeMove: function (value) { setValue('freeMove', value); }
  };
})();

/*
 * ar.js — Thin wrapper around AR.js marker events.
 * Keeps AR tracking concerns separate from game/module logic.
 */
window.AR = (function () {
  'use strict';

  var HINT_SCAN = 'Point your camera at the Hiro marker';
  var HINT_ERR = 'Camera unavailable — check permissions and reload';

  function init(scene) {
    var target = scene && scene.querySelector('#target');
    var hint = document.getElementById('camera-hint');
    if (!scene || !target || !hint) return;

    function showHint(message) {
      hint.textContent = message || HINT_SCAN;
      hint.hidden = false;
    }
    function hideHint() {
      hint.hidden = true;
    }

    window.ARDebug.bind(scene, target);
    showHint(HINT_SCAN);
    target.addEventListener('markerFound', function () {
      window.ARDebug.markerFound();
      hideHint();
    });
    target.addEventListener('markerLost', function () {
      window.ARDebug.markerLost();
      showHint(HINT_SCAN);
    });

    // AR.js dispatches camera failures on window. Its webcam source already
    // requests facingMode: environment, so no application override is needed.
    window.addEventListener('camera-error', function () { showHint(HINT_ERR); });
  }

  return { init: init };
})();
