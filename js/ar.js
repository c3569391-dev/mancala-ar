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
  var VIEWPORT_SETTLE_MS = 500;
  var resizeTimer = null;
  var resizeListenersBound = false;
  var targetIsFound = false;

  function formatNumber(value) {
    return typeof value === 'number' && isFinite(value) ? value.toFixed(3) : '?';
  }

  function finiteVector(vector) {
    return vector && isFinite(vector.x) && isFinite(vector.y) && isFinite(vector.z);
  }

  function formatVector(vector) {
    return finiteVector(vector)
      ? formatNumber(vector.x) + ', ' + formatNumber(vector.y) + ', ' + formatNumber(vector.z)
      : '?';
  }

  function yesNo(value) { return value ? 'YES' : 'NO'; }

  function matrixIsFinite(object3D) {
    var elements = object3D && object3D.matrixWorld && object3D.matrixWorld.elements;
    if (!elements || elements.length !== 16) return false;
    for (var i = 0; i < elements.length; i++) {
      if (!isFinite(elements[i])) return false;
    }
    return true;
  }

  function createDiagnosticOverlay() {
    var overlay = document.createElement('pre');
    overlay.id = 'ar-diagnostics';
    overlay.setAttribute('aria-live', 'polite');
    overlay.style.cssText = [
      'position:fixed',
      'top:max(6px, env(safe-area-inset-top))',
      'left:max(6px, env(safe-area-inset-left))',
      'z-index:2147483647',
      'box-sizing:border-box',
      'max-width:calc(100vw - 12px)',
      'max-height:calc(100vh - 12px)',
      'overflow:auto',
      'margin:0',
      'padding:7px 9px',
      'pointer-events:auto',
      '-webkit-overflow-scrolling:touch',
      'white-space:pre-wrap',
      'background:rgba(0,0,0,.82)',
      'border:1px solid #00e5ff',
      'border-radius:5px',
      'color:#e8feff',
      'font:10px/1.25 monospace',
      'text-align:left'
    ].join(';');
    document.body.appendChild(overlay);
    return overlay;
  }

  function classifyBoardPosition(ndc, cameraPosition) {
    if (!finiteVector(ndc) || !finiteVector(cameraPosition)) return 'INVALID';
    if (cameraPosition.z >= 0) return 'BEHIND CAMERA';
    if (ndc.z < -1 || ndc.z > 1) return 'OUTSIDE DEPTH RANGE';
    if (ndc.x < -1) return 'OUTSIDE LEFT';
    if (ndc.x > 1) return 'OUTSIDE RIGHT';
    if (ndc.y < -1) return 'OUTSIDE BOTTOM';
    if (ndc.y > 1) return 'OUTSIDE TOP';
    return 'INSIDE VIEW';
  }

  function visibleBoardBounds(THREE, boardObject) {
    var bounds = new THREE.Box3();
    var geometryCount = 0;
    if (!boardObject) return { bounds: bounds, geometryCount: geometryCount };

    boardObject.traverseVisible(function (object) {
      var geometry = object.geometry;
      if (!geometry) return;
      if (!geometry.boundingBox && typeof geometry.computeBoundingBox === 'function') {
        geometry.computeBoundingBox();
      }
      if (!geometry.boundingBox) return;
      bounds.union(geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
      geometryCount++;
    });
    return { bounds: bounds, geometryCount: geometryCount };
  }

  function projectBoardBounds(THREE, bounds, camera) {
    var result = {
      cornerCount: 0,
      cornersInside: 0,
      allCornersInside: false,
      intersects: false,
      minNdc: null,
      maxNdc: null
    };
    if (!bounds || bounds.isEmpty() || !camera) return result;

    var min = bounds.min;
    var max = bounds.max;
    var ndcMin = new THREE.Vector3(Infinity, Infinity, Infinity);
    var ndcMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    var xs = [min.x, max.x];
    var ys = [min.y, max.y];
    var zs = [min.z, max.z];

    for (var xi = 0; xi < 2; xi++) {
      for (var yi = 0; yi < 2; yi++) {
        for (var zi = 0; zi < 2; zi++) {
          var worldCorner = new THREE.Vector3(xs[xi], ys[yi], zs[zi]);
          var cameraCorner = worldCorner.clone().applyMatrix4(camera.matrixWorldInverse);
          var ndcCorner = worldCorner.clone().project(camera);
          result.cornerCount++;
          if (finiteVector(ndcCorner)) {
            ndcMin.min(ndcCorner);
            ndcMax.max(ndcCorner);
            if (classifyBoardPosition(ndcCorner, cameraCorner) === 'INSIDE VIEW') {
              result.cornersInside++;
            }
          }
        }
      }
    }

    var projectionView = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    var frustum = new THREE.Frustum().setFromProjectionMatrix(projectionView);
    result.intersects = frustum.intersectsBox(bounds);
    result.allCornersInside = result.cornersInside === result.cornerCount;
    result.minNdc = ndcMin;
    result.maxNdc = ndcMax;
    return result;
  }

  function updateDiagnosticOverlay(scene, target, boardAnchor, overlay, reason, beforeResize) {
    var THREE = window.THREE || (window.AFRAME && window.AFRAME.THREE);
    var camera = scene.camera;
    var renderer = scene.renderer;
    var canvas = scene.canvas || (renderer && renderer.domElement);
    var system = scene.systems && scene.systems['mindar-image-system'];
    var video = system && system.video;
    var viewport = window.visualViewport;
    var targetWorldPosition = null;
    var worldPosition = null;
    var worldScale = null;
    var cameraWorldPosition = null;
    var cameraWorldDirection = null;
    var cameraPosition = null;
    var ndc = null;
    var drawingBuffer = null;
    var boundsResult = null;
    var projectedBounds = null;
    var objectChildCount = boardAnchor && boardAnchor.object3D
      ? boardAnchor.object3D.children.length
      : 0;
    var domChildCount = boardAnchor ? boardAnchor.children.length : 0;

    if (THREE && boardAnchor && boardAnchor.object3D && camera) {
      scene.object3D.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      targetWorldPosition = new THREE.Vector3();
      target.object3D.getWorldPosition(targetWorldPosition);
      worldPosition = new THREE.Vector3();
      boardAnchor.object3D.getWorldPosition(worldPosition);
      worldScale = new THREE.Vector3();
      boardAnchor.object3D.getWorldScale(worldScale);
      cameraWorldPosition = new THREE.Vector3();
      camera.getWorldPosition(cameraWorldPosition);
      cameraWorldDirection = new THREE.Vector3();
      camera.getWorldDirection(cameraWorldDirection);
      cameraPosition = worldPosition.clone().applyMatrix4(camera.matrixWorldInverse);
      ndc = worldPosition.clone().project(camera);
      boundsResult = visibleBoardBounds(THREE, boardAnchor.object3D);
      projectedBounds = projectBoardBounds(THREE, boundsResult.bounds, camera);
    }

    if (THREE && renderer && typeof renderer.getDrawingBufferSize === 'function') {
      drawingBuffer = renderer.getDrawingBufferSize(new THREE.Vector2());
    }

    var snapshot = {
      aspect: camera && camera.aspect,
      ndc: ndc && ndc.clone(),
      canvasClient: canvas ? canvas.clientWidth + ' x ' + canvas.clientHeight : 'unavailable',
      drawingBuffer: drawingBuffer
        ? Math.round(drawingBuffer.x) + ' x ' + Math.round(drawingBuffer.y)
        : 'unavailable',
      video: video ? video.videoWidth + ' x ' + video.videoHeight : 'unavailable'
    };
    var lines = [
      'AR DIAGNOSTICS',
      'LAST EVENT: ' + reason,
      'TARGET: ' + (targetIsFound ? 'FOUND' : 'LOST'),
      'TARGET VISIBLE: ' + yesNo(target && target.object3D && target.object3D.visible),
      'BOARD VISIBLE: ' + yesNo(boardAnchor && boardAnchor.object3D && boardAnchor.object3D.visible),
      'BOARD CHILDREN: DOM ' + domChildCount + ' / 3D ' + objectChildCount +
        ' / visible geometry ' + (boundsResult ? boundsResult.geometryCount : 0),
      'BOARD LOCAL position: ' + formatVector(boardAnchor && boardAnchor.object3D && boardAnchor.object3D.position),
      'BOARD LOCAL rotation(rad): ' + formatVector(boardAnchor && boardAnchor.object3D && boardAnchor.object3D.rotation),
      'BOARD LOCAL scale: ' + formatVector(boardAnchor && boardAnchor.object3D && boardAnchor.object3D.scale),
      'BOARD WORLD position: ' + formatVector(worldPosition),
      'BOARD WORLD scale: ' + formatVector(worldScale),
      'TARGET WORLD position: ' + formatVector(targetWorldPosition),
      'TARGET MATRIX FINITE: ' + yesNo(target && matrixIsFinite(target.object3D)),
      'BOARD MATRIX FINITE: ' + yesNo(boardAnchor && matrixIsFinite(boardAnchor.object3D)),
      'BOARD CENTER NDC: x=' + (ndc ? formatNumber(ndc.x) : '?') +
        ', y=' + (ndc ? formatNumber(ndc.y) : '?') +
        ', z=' + (ndc ? formatNumber(ndc.z) : '?'),
      'FRUSTUM: ' + classifyBoardPosition(ndc, cameraPosition),
      'BOARD BOUNDS WORLD min: ' + formatVector(boundsResult && !boundsResult.bounds.isEmpty() ? boundsResult.bounds.min : null),
      'BOARD BOUNDS WORLD max: ' + formatVector(boundsResult && !boundsResult.bounds.isEmpty() ? boundsResult.bounds.max : null),
      'BBOX NDC min: ' + formatVector(projectedBounds && projectedBounds.minNdc),
      'BBOX NDC max: ' + formatVector(projectedBounds && projectedBounds.maxNdc),
      'BBOX CORNERS INSIDE: ' + (projectedBounds
        ? projectedBounds.cornersInside + ' / ' + projectedBounds.cornerCount
        : 'unavailable'),
      'ANY BOARD INTERSECTS FRUSTUM: ' + yesNo(projectedBounds && projectedBounds.intersects),
      'ENTIRE BOARD INSIDE FRUSTUM: ' + yesNo(projectedBounds && projectedBounds.allCornersInside),
      'ENTIRE BOARD OUTSIDE FRUSTUM: ' + yesNo(projectedBounds && !projectedBounds.intersects),
      'CAMERA WORLD position: ' + formatVector(cameraWorldPosition),
      'CAMERA WORLD direction: ' + formatVector(cameraWorldDirection),
      'CAMERA aspect/near/far: ' + (camera
        ? formatNumber(camera.aspect) + ' / ' + formatNumber(camera.near) + ' / ' + formatNumber(camera.far)
        : '?'),
      'VIEWPORT: ' + window.innerWidth + ' x ' + window.innerHeight,
      'VISUAL VIEWPORT: ' + (viewport ? formatNumber(viewport.width) + ' x ' + formatNumber(viewport.height) : 'unavailable'),
      'CANVAS CLIENT: ' + snapshot.canvasClient,
      'CANVAS BUFFER: ' + (canvas ? canvas.width + ' x ' + canvas.height : 'unavailable'),
      'RENDERER DRAWING BUFFER: ' + snapshot.drawingBuffer,
      'VIDEO: ' + snapshot.video,
      'MINDAR SYSTEM / _resize: ' + yesNo(system) + ' / ' + yesNo(system && typeof system._resize === 'function')
    ];

    if (beforeResize) {
      lines.push(
        'DELAYED _resize CHANGE:',
        '  camera aspect: ' + formatNumber(beforeResize.aspect) + ' -> ' + formatNumber(snapshot.aspect),
        '  board NDC: ' + formatVector(beforeResize.ndc) + ' -> ' + formatVector(snapshot.ndc),
        '  canvas client: ' + beforeResize.canvasClient + ' -> ' + snapshot.canvasClient,
        '  drawing buffer: ' + beforeResize.drawingBuffer + ' -> ' + snapshot.drawingBuffer,
        '  video: ' + beforeResize.video + ' -> ' + snapshot.video
      );
    }

    overlay.textContent = lines.join('\n');
    return snapshot;
  }

  function settledViewportSize() {
    var viewport = window.visualViewport;
    return {
      width: viewport && viewport.width ? viewport.width : window.innerWidth,
      height: viewport && viewport.height ? viewport.height : window.innerHeight
    };
  }

  function syncArDimensions(scene) {
    var size = settledViewportSize();
    if (!size.width || !size.height) return;

    var system = scene.systems && scene.systems['mindar-image-system'];
    if (system && system.video && system.controller && typeof system._resize === 'function') {
      system._resize();
    }
  }

  function scheduleDimensionSync(scene, updateDiagnostics, reason) {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeTimer = null;
      var beforeResize = updateDiagnostics(reason + ' — BEFORE DELAYED _resize');
      syncArDimensions(scene);
      window.requestAnimationFrame(function () {
        updateDiagnostics(reason + ' — AFTER DELAYED _resize', beforeResize);
      });
    }, VIEWPORT_SETTLE_MS);
  }

  function bindResizeListeners(scene, updateDiagnostics) {
    if (resizeListenersBound) return;
    resizeListenersBound = true;
    scene.addEventListener('arReady', function () {
      updateDiagnostics('arReady');
      scheduleDimensionSync(scene, updateDiagnostics, 'arReady');
    });
    window.addEventListener('resize', function () {
      updateDiagnostics('resize');
      scheduleDimensionSync(scene, updateDiagnostics, 'resize');
    });
    window.addEventListener('orientationchange', function () {
      updateDiagnostics('orientationchange');
      scheduleDimensionSync(scene, updateDiagnostics, 'orientationchange');
    });
  }

  function init() {
    var scene = document.querySelector('a-scene');
    var target = document.getElementById('target');
    var boardAnchor = document.getElementById('board-anchor');
    var hint = document.getElementById('camera-hint');
    if (!scene || !target || !boardAnchor || !hint) return;
    var diagnosticOverlay = createDiagnosticOverlay();

    function showHint(text) { hint.textContent = text; hint.hidden = false; }
    function updateDiagnostics(reason, beforeResize) {
      return updateDiagnosticOverlay(
        scene, target, boardAnchor, diagnosticOverlay, reason, beforeResize
      );
    }

    // Scanning state until the marker is first found.
    showHint(HINT_SCAN);

    target.addEventListener('targetFound', function () {
      targetIsFound = true;
      hint.hidden = true;
      updateDiagnostics('targetFound — EVENT');
      // MindAR emits targetFound just before applying visibility and its world
      // matrix. Read the resulting transform on the following animation frame.
      window.requestAnimationFrame(function () { updateDiagnostics('targetFound — NEXT FRAME'); });
    });
    target.addEventListener('targetLost', function () {
      targetIsFound = false;
      showHint(HINT_SCAN);
      window.requestAnimationFrame(function () { updateDiagnostics('targetLost'); });
    });

    // MindAR fires arError if the camera can't start (denied/blocked/no device).
    scene.addEventListener('arError', function () { showHint(HINT_ERR); });
    bindResizeListeners(scene, updateDiagnostics);
    updateDiagnostics('init');
  }

  return { init: init };
})();
