/*
 * board3d.js — Layer A visuals (the holographic Mancala board) built with
 * A-Frame entities under a single anchor. In Stage 2 the anchor is fixed at
 * the scene origin; in Stage 4 the same anchor becomes a MindAR image target,
 * so NONE of this rendering code needs to change for AR.
 *
 * Colour coding (SPEC §4): Player A = BLUE (top), Player B = RED (bottom).
 * The colour lives on the board regions / pits / stores, never on the seeds.
 * Seeds are neutral glowing gold.
 */
window.Board = (function () {
  'use strict';

  // ---- palette ----------------------------------------------------------
  var BLUE = '#27B6FF';   // Player A
  var RED = '#FF3B5C';    // Player B
  var GOLD = '#FFD46B';   // neutral seeds
  var CYAN = '#3DF0FF';   // accents / arrows

  // ---- geometry ---------------------------------------------------------
  var ROWY = 0.20;        // top/bottom row height
  var STOREX = 0.82;      // store distance from centre
  var PITR = 0.062;       // pit ring radius
  var Z = 0.02;           // float seeds just above the board plane
  // x positions for the 6 columns (pit 0 sits on the right; CCW top row goes R→L)
  var COLX = [0.55, 0.33, 0.11, -0.11, -0.33, -0.55];

  var POS = [];           // POS[i] = {x,y,z} world-local centre of pit i
  (function buildPositions() {
    for (var i = 0; i <= 5; i++) POS[i] = { x: COLX[i], y: ROWY, z: Z };          // A pits
    POS[6] = { x: -STOREX, y: 0, z: Z };                                          // A store
    for (var j = 0; j <= 5; j++) POS[7 + j] = { x: -COLX[j], y: -ROWY, z: Z };    // B pits
    POS[13] = { x: STOREX, y: 0, z: Z };                                          // B store
  })();

  function sideColor(i) {
    if (i >= 0 && i <= 6) return BLUE;   // Player A territory (pits 0-5 + store 6)
    return RED;                          // Player B territory (pits 7-12 + store 13)
  }

  // ---- small entity helper ---------------------------------------------
  function E(tag, attrs, parent) {
    var e = document.createElement(tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function holo(color, opacity, intensity) {
    return 'shader: standard; color: ' + color + '; emissive: ' + color +
      '; emissiveIntensity: ' + (intensity || 0.7) + '; metalness: 0.1; roughness: 0.5;' +
      ' transparent: true; opacity: ' + (opacity == null ? 0.85 : opacity) + '; side: double';
  }

  // A glowing neon rectangle frame: four emissive bars + a soft outer halo.
  function buildFrame(w, h, color) {
    var t = 0.012;                       // bar thickness
    var bar = function (x, y, bw, bh) {
      E('a-plane', { position: x + ' ' + y + ' -0.004', width: bw, height: bh,
        material: holo(color, 0.95, 1.8) }, anchor);
      // halo copy behind for bloom
      E('a-plane', { position: x + ' ' + y + ' -0.008', width: bw + 0.03, height: bh + 0.03,
        material: 'shader: flat; color: ' + color + '; transparent: true; opacity: 0.18; side: double' }, anchor);
    };
    bar(0, h / 2, w, t);                  // top
    bar(0, -h / 2, w, t);                 // bottom
    bar(-w / 2, 0, t, h);                 // left
    bar(w / 2, 0, t, h);                  // right
  }

  // Clean neon label: ONE crisp coloured text, nothing else — no backing block,
  // no border, no duplicated copies (so no ghosting).
  function glowText(parent, value, color, pos, width) {
    var g = E('a-entity', { position: pos }, parent);
    E('a-text', { value: value, align: 'center', baseline: 'center', color: color,
      width: width, position: '0 0 0' }, g);
    return g;
  }

  // ---- state ------------------------------------------------------------
  var anchor = null;
  var groups = [];        // groups[i] holds the seeds + count label for pit i
  var labels = [];        // labels[i] count text entity
  var rings = [];         // rings[i] pit/store outline (for highlighting)
  var arrows = null;      // CCW direction chevrons container
  var notif = null;       // floating notification text
  var pitClickCb = null;
  var clickables = [];    // pit hit-areas, raycast manually for taps

  // ---- seed layout ------------------------------------------------------
  function seedOffsets(n, spread) {
    var o = [], cols = Math.max(1, Math.ceil(Math.sqrt(n))), rows = Math.ceil(n / cols);
    var sp = spread || 0.024;
    for (var k = 0; k < n; k++) {
      var r = Math.floor(k / cols), c = k % cols;
      o.push({ x: (c - (cols - 1) / 2) * sp, y: (r - (rows - 1) / 2) * sp });
    }
    return o;
  }

  // ---- build the whole board -------------------------------------------
  function build(parentEl) {
    anchor = parentEl;

    // Board base plane (translucent dark glass).
    E('a-plane', {
      position: '0 0 0', width: 1.92, height: 0.74,
      material: 'shader: flat; color: #0a1730; transparent: true; opacity: 0.28; side: double'
    }, anchor);
    // Glowing neon frame (four emissive bars + a soft halo behind).
    buildFrame(1.98, 0.80, CYAN);

    // Territory tints (top = blue / bottom = red), pits area only.
    E('a-plane', { position: '0 ' + ROWY + ' 0.001', width: 1.4, height: 0.30,
      material: 'shader: flat; color: ' + BLUE + '; transparent: true; opacity: 0.10' }, anchor);
    E('a-plane', { position: '0 ' + (-ROWY) + ' 0.001', width: 1.4, height: 0.30,
      material: 'shader: flat; color: ' + RED + '; transparent: true; opacity: 0.10' }, anchor);

    // Pits + stores.
    for (var i = 0; i <= 13; i++) {
      if (i === 6 || i === 13) buildStore(i);
      else buildPit(i);
    }

    buildArrows();
    buildAvatars();

    // Reusable floating notification (hidden by default).
    notif = E('a-text', {
      value: '', align: 'center', color: GOLD, width: 2.6,
      position: '0 0.50 0.08', visible: 'false',
      'font-size': '4'
    }, anchor);

    setupClicking();
  }

  // Manual raycasting for pit taps. More reliable inside a MindAR scene than the
  // A-Frame cursor, and it correctly ignores taps that the Layer B UI consumes
  // (those never reach the canvas).
  function setupClicking() {
    var sceneEl = anchor.sceneEl;
    var THREE = window.AFRAME.THREE;
    var raycaster = new THREE.Raycaster();
    var ndc = new THREE.Vector2();

    function pick(clientX, clientY) {
      var canvas = sceneEl.canvas, cam = sceneEl.camera;
      if (!pitClickCb || !canvas || !cam) return;
      var rect = canvas.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, cam);

      var objs = clickables.map(function (e) { return e.object3D; });
      var hits = raycaster.intersectObjects(objs, true);
      if (!hits.length) return;

      var hitObj = hits[0].object, idx = -1;
      for (var c = 0; c < clickables.length && idx < 0; c++) {
        var root = clickables[c].object3D, n = hitObj;
        while (n) { if (n === root) { idx = clickables[c].__pitIndex; break; } n = n.parent; }
      }
      if (idx >= 0) pitClickCb(idx);
    }

    function attach() {
      var canvas = sceneEl.canvas;
      if (!canvas) { setTimeout(attach, 100); return; }
      canvas.addEventListener('click', function (e) { pick(e.clientX, e.clientY); });
    }
    if (sceneEl.hasLoaded) attach(); else sceneEl.addEventListener('loaded', attach);
  }

  function buildPit(i) {
    var c = sideColor(i), p = POS[i];
    var g = E('a-entity', { position: p.x + ' ' + p.y + ' ' + p.z }, anchor);
    // glowing ring (recessed pit feel: ring + faint inner disc)
    var ring = E('a-torus', {
      radius: PITR, 'radius-tubular': 0.007, position: '0 0 0',
      material: holo(c, 0.9, 0.6)
    }, g);
    E('a-circle', { radius: PITR - 0.008, position: '0 0 -0.01',
      material: 'shader: flat; color: ' + c + '; transparent: true; opacity: 0.12' }, g);
    rings[i] = ring;

    // invisible larger hit-area for tapping (raycast manually in setupClicking)
    var hit = E('a-circle', {
      radius: PITR + 0.025, position: '0 0 0.03', class: 'clickable',
      material: 'shader: flat; transparent: true; opacity: 0; side: double'
    }, g);
    hit.__pitIndex = i;
    clickables.push(hit);

    // count label above the pit
    labels[i] = E('a-text', {
      value: '4', align: 'center', color: '#Eaffff', width: 1.4,
      position: '0 ' + (PITR + 0.03) + ' 0.02'
    }, g);

    groups[i] = E('a-entity', { position: '0 0 0' }, g); // seeds container
  }

  function buildStore(i) {
    var c = sideColor(i), p = POS[i];
    var g = E('a-entity', { position: p.x + ' ' + p.y + ' ' + p.z }, anchor);
    // tall glowing capsule outline (torus stretched vertically)
    var ring = E('a-torus', {
      radius: 0.10, 'radius-tubular': 0.008, scale: '1 2.4 1', position: '0 0 0',
      material: holo(c, 0.9, 0.6)
    }, g);
    E('a-plane', { width: 0.16, height: 0.46, position: '0 0 -0.01',
      material: 'shader: flat; color: ' + c + '; transparent: true; opacity: 0.14' }, g);
    rings[i] = ring;

    labels[i] = E('a-text', {
      value: '0', align: 'center', color: '#ffffff', width: 2.2, 'font-size': '6',
      position: '0 0.30 0.02'
    }, g);

    groups[i] = E('a-entity', { position: '0 0 0' }, g);
  }

  // Static CCW direction chevrons around the loop (brightened during demos).
  function buildArrows() {
    arrows = E('a-entity', { visible: 'false' }, anchor);
    var order = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    for (var k = 0; k < order.length; k++) {
      var a = POS[order[k]], b = POS[order[(k + 1) % order.length]];
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      E('a-triangle', {
        position: mx + ' ' + my + ' 0.015',
        rotation: '0 0 ' + (ang - 90),
        scale: '0.03 0.03 0.03',
        material: 'shader: flat; color: ' + CYAN + '; transparent: true; opacity: 0.8; side: double'
      }, arrows);
    }
  }

  // Geometric avatars — distinguishable masculine (A) / feminine (B) silhouettes.
  // Lifted well above the board/stores so nothing overlaps; the name labels are
  // glowing neon text matching each avatar's colour.
  function buildAvatars() {
    var AVY = 0.66;   // height — kept below the viewport top so nothing clips
    var AVX = 0.70;   // pulled inward from the board edge, leaving side margin
    var AVS = '0.85 0.85 0.85'; // slightly smaller so both fit fully on screen

    // Player A — blue, masculine: round head, short flat hair, broad-shoulder body.
    var a = E('a-entity', { position: (-AVX) + ' ' + AVY + ' 0.02', scale: AVS }, anchor);
    E('a-sphere', { radius: 0.05, position: '0 0 0', material: holo(BLUE, 0.85, 0.8) }, a);
    E('a-box', { depth: 0.06, height: 0.035, width: 0.12, position: '0 0.045 0', material: holo(BLUE, 0.85, 0.8) }, a);
    E('a-box', { depth: 0.05, height: 0.11, width: 0.16, position: '0 -0.115 0', material: holo(BLUE, 0.8, 0.7) }, a);
    glowText(a, 'PLAYER A', BLUE, '0 -0.23 0', 1.6);

    // Player B — red, feminine: round head, long hair, triangular dress body.
    var b = E('a-entity', { position: AVX + ' ' + AVY + ' 0.02', scale: AVS }, anchor);
    E('a-sphere', { radius: 0.05, position: '0 0 0', material: holo(RED, 0.85, 0.8) }, b);
    E('a-box', { depth: 0.05, height: 0.12, width: 0.13, position: '0 -0.01 -0.01', material: holo(RED, 0.7, 0.6) }, b); // long hair behind
    E('a-cone', { 'radius-bottom': 0.09, 'radius-top': 0.015, height: 0.14, position: '0 -0.12 0', material: holo(RED, 0.8, 0.7) }, b);
    glowText(b, 'PLAYER B', RED, '0 -0.23 0', 1.6);
  }

  // ---- rendering --------------------------------------------------------
  function renderState(board) {
    for (var i = 0; i <= 13; i++) {
      var g = groups[i];
      // remove old seeds
      var olds = g.querySelectorAll('.seed');
      for (var s = 0; s < olds.length; s++) g.removeChild(olds[s]);

      var n = board[i];
      labels[i].setAttribute('value', String(n));

      var store = (i === 6 || i === 13);
      var cap = store ? 24 : 14;
      var vis = Math.min(n, cap);
      var offs = seedOffsets(vis, store ? 0.030 : 0.024);
      for (var k = 0; k < vis; k++) {
        addSeed(g, offs[k].x, offs[k].y);
      }
    }
  }

  function addSeed(parent, dx, dy) {
    var seed = E('a-sphere', {
      radius: 0.013, class: 'seed', position: dx + ' ' + dy + ' 0.015',
      material: 'shader: standard; color: ' + GOLD + '; emissive: ' + GOLD +
        '; emissiveIntensity: 0.9; metalness: 0.2; roughness: 0.3'
    }, parent);
    return seed;
  }

  // ---- highlighting -----------------------------------------------------
  function setHighlights(indices, player) {
    clearHighlights();
    indices.forEach(function (i) {
      var ring = rings[i];
      if (!ring) return;
      ring.setAttribute('material', holo(sideColor(i), 1.0, 1.6));
      ring.setAttribute('animation__pulse',
        'property: scale; dir: alternate; loop: true; dur: 700; to: 1.18 1.18 1.18');
    });
  }
  function clearHighlights() {
    for (var i = 0; i <= 13; i++) {
      var ring = rings[i];
      if (!ring) continue;
      ring.removeAttribute('animation__pulse');
      var store = (i === 6 || i === 13);
      ring.setAttribute('scale', store ? '1 2.4 1' : '1 1 1');
      ring.setAttribute('material', holo(sideColor(i), 0.9, 0.6));
    }
  }

  // brief glow pulse on a pit/store (used by the animation layer)
  function pulse(i, color) {
    var ring = rings[i];
    if (!ring) return;
    var c = color || sideColor(i);
    ring.setAttribute('material', holo(c, 1.0, 2.2));
    ring.setAttribute('animation__hit',
      'property: components.material.material.emissiveIntensity; from: 2.2; to: 0.6; dur: 600');
    setTimeout(function () {
      ring.removeAttribute('animation__hit');
      ring.setAttribute('material', holo(sideColor(i), 0.9, 0.6));
    }, 650);
  }

  function showArrows(on) { if (arrows) arrows.setAttribute('visible', !!on); }

  // ---- reset between modules -------------------------------------------
  function reset() {
    clearHighlights();
    showArrows(false);
    if (notif) notif.setAttribute('visible', false);
  }

  function onPitClick(cb) { pitClickCb = cb; }

  return {
    POS: POS, BLUE: BLUE, RED: RED, GOLD: GOLD, CYAN: CYAN,
    build: build, renderState: renderState,
    setHighlights: setHighlights, clearHighlights: clearHighlights,
    pulse: pulse, showArrows: showArrows, reset: reset,
    onPitClick: onPitClick,
    anchorEl: function () { return anchor; },
    notifEl: function () { return notif; }
  };
})();
