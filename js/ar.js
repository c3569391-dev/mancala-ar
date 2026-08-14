/*
 * ar.js — Thin wrapper around AR.js NFT image-target events.
 * Keeps AR tracking concerns separate from game/module logic.
 */
window.AR = (function () {
  'use strict';

  var HINT_SCAN = 'Point your camera at the Congkak marker';
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

    showHint(HINT_SCAN);
    target.addEventListener('markerFound', hideHint);
    target.addEventListener('markerLost', function () { showHint(HINT_SCAN); });

    // AR.js dispatches camera failures on window. Its webcam source already
    // requests facingMode: environment, so no application override is needed.
    window.addEventListener('camera-error', function () { showHint(HINT_ERR); });
  }

  return { init: init };
})();
