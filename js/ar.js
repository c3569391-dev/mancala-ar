/*
 * ar.js — Wires MindAR image tracking to the two-layer UX.
 *
 * MindAR already toggles the #target subtree's visibility on found/lost, so
 * Layer A (the holographic board) appears/disappears with the marker for free.
 * Here we just manage the Layer B "point your camera" hint and surface camera
 * errors. Layer B (screen-fixed UI) stays fully usable the whole time — the
 * learner is never blocked when the target is briefly lost.
 */
/*
 * Prefer the REAR camera (to point at the physical board on a phone) but fall
 * back to the front camera automatically when no rear camera exists (e.g. a
 * laptop). Using `{ ideal: 'environment' }` is a soft preference, not a hard
 * requirement, so getUserMedia picks the front camera if that's all there is.
 * This wraps getUserMedia before MindAR calls it on scene start.
 */
(function preferRearCamera() {
  'use strict';
  var md = navigator.mediaDevices;
  if (!md || !md.getUserMedia) return;
  var original = md.getUserMedia.bind(md);
  md.getUserMedia = function (constraints) {
    constraints = constraints || {};
    if (constraints.video) {
      if (constraints.video === true) constraints.video = {};
      constraints.video.facingMode = { ideal: 'environment' };
    }
    return original(constraints);
  };
})();

window.AR = (function () {
  'use strict';

  var HINT_SCAN = 'Point your camera at the Mancala board';
  var HINT_ERR = 'Camera unavailable — allow camera access and reload';

  function init() {
    var scene = document.querySelector('a-scene');
    var target = document.getElementById('target');
    var hint = document.getElementById('camera-hint');
    if (!scene || !target || !hint) return;

    function showHint(text) { hint.textContent = text; hint.hidden = false; }

    // Scanning state until the marker is first found.
    showHint(HINT_SCAN);

    target.addEventListener('targetFound', function () { hint.hidden = true; });
    target.addEventListener('targetLost', function () { showHint(HINT_SCAN); });

    // MindAR fires arError if the camera can't start (denied/blocked/no device).
    scene.addEventListener('arError', function () { showHint(HINT_ERR); });
  }

  return { init: init };
})();
