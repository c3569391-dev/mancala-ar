/*
 * animate.js — Replays the engine's event log as holographic motion:
 * seed-by-seed counter-clockwise sowing with glowing trails, capture bursts,
 * extra-turn pulses, and floating rule notifications.
 *
 * Animation is purely cosmetic. The caller passes the board snapshot BEFORE
 * the move; we mutate a display copy as we animate, then the caller snaps to
 * the authoritative post-move board to avoid any drift.
 */
window.Animate = (function () {
  'use strict';

  var POS = Board.POS;
  var SOW_HOP = 520;   // ms per seed hop (slowed so each seed is easy to follow)
  var GAP = 210;       // ms pause between hops (clear beat between seeds)

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // A short-lived glowing dot dropped along the seed's flight path; it fades and
  // shrinks, so a sequence of them reads as a luminous comet trail that clearly
  // marks the route from one pit to the next.
  function trailDot(x, y, z) {
    var d = document.createElement('a-sphere');
    d.setAttribute('radius', 0.017);
    d.setAttribute('position', x + ' ' + y + ' ' + (z - 0.006));
    d.setAttribute('material', 'shader: flat; color: ' + Board.GOLD +
      '; transparent: true; opacity: 0.75; side: double');
    // linger ~ a full hop so the whole arc is briefly visible as a glowing streak
    d.setAttribute('animation__fade', 'property: material.opacity; from: 0.75; to: 0; dur: 520; easing: easeOutQuad');
    d.setAttribute('animation__shrink', 'property: scale; from: 1 1 1; to: 0.15 0.15 0.15; dur: 520; easing: easeOutQuad');
    Board.anchorEl().appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 560);
  }

  // Ease-in-out position tween with a small parabolic arc (the "hover" feel).
  // Drops trail dots as it goes so the moving seed leaves a glowing light trace.
  function tween(el, from, to, dur) {
    return new Promise(function (res) {
      var start = performance.now();
      var lastTrail = 0;
      el.object3D.position.set(from.x, from.y, from.z);
      function step(t) {
        var k = Math.min(1, (t - start) / dur);
        var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        var arc = Math.sin(k * Math.PI) * 0.05;
        var x = from.x + (to.x - from.x) * e;
        var y = from.y + (to.y - from.y) * e + arc;
        var z = from.z + (to.z - from.z) * e + 0.04;
        el.object3D.position.set(x, y, z);
        // spawn trail dots at a steady cadence (skip the very end so it tucks
        // neatly into the destination pit)
        if (t - lastTrail > 26 && k > 0.04 && k < 0.94) { lastTrail = t; trailDot(x, y, z); }
        if (k < 1) requestAnimationFrame(step); else res();
      }
      requestAnimationFrame(step);
    });
  }

  // The in-flight seed: a bright pulsing core wrapped in a soft glow halo, so the
  // moving seed is unmistakably more vivid than the static seeds resting in pits.
  function flyingSeed() {
    var wrap = document.createElement('a-entity');
    // soft outer bloom
    var halo = document.createElement('a-sphere');
    halo.setAttribute('radius', 0.05);
    halo.setAttribute('material', 'shader: flat; color: ' + Board.GOLD +
      '; transparent: true; opacity: 0.3; side: double');
    wrap.appendChild(halo);
    // bright, slightly larger core (vs static seeds at radius 0.013)
    var core = document.createElement('a-sphere');
    core.setAttribute('radius', 0.024);
    core.setAttribute('material', 'shader: standard; color: #fff7df; emissive: ' +
      Board.GOLD + '; emissiveIntensity: 2.6; metalness: 0.2; roughness: 0.12');
    // gentle "breathing" pulse so the flying seed visibly stands out in motion
    core.setAttribute('animation__pulse',
      'property: scale; dir: alternate; loop: true; dur: 240; to: 1.3 1.3 1.3');
    wrap.appendChild(core);
    Board.anchorEl().appendChild(wrap);
    return wrap;
  }

  // Floating notification chip ("Capture Triggered!", "You Gain an Extra Turn!").
  // Rendered as a rounded chip (Board.setNotif) so it matches the bottom UI; the
  // rule feedbacks use one shared accent colour (cyan) to stay consistent.
  function notify(text, color) {
    var n = Board.setNotif(text, color || Board.CYAN);
    n.setAttribute('visible', true);
    n.setAttribute('scale', '0.4 0.4 0.4');
    n.setAttribute('animation__in', 'property: scale; to: 1 1 1; dur: 300; easing: easeOutBack');
    return sleep(1500).then(function () {
      n.removeAttribute('animation__in');
      n.setAttribute('visible', false);
    });
  }

  // ---- per-event animations --------------------------------------------
  async function animateSow(ev, disp) {
    Board.showArrows(true);
    disp[ev.from] = 0;
    Board.renderState(disp);

    var prev = POS[ev.from];
    for (var p = 0; p < ev.path.length; p++) {
      var idx = ev.path[p];
      var seed = flyingSeed();
      await tween(seed, prev, POS[idx], SOW_HOP);
      seed.parentNode.removeChild(seed);
      disp[idx] += 1;
      Board.renderState(disp);
      Board.pulse(idx);
      prev = POS[idx];
      await sleep(GAP);
    }
  }

  async function animateCapture(ev, disp) {
    Board.pulse(ev.pit, Board.GOLD);
    Board.pulse(ev.opposite, Board.GOLD);
    await notify('Capture Triggered!', Board.CYAN);
    var store = ev.player === 'A' ? 6 : 13;
    disp[store] += disp[ev.pit] + disp[ev.opposite];
    disp[ev.pit] = 0;
    disp[ev.opposite] = 0;
    Board.renderState(disp);
    Board.pulse(store, ev.player === 'A' ? Board.BLUE : Board.RED);
    await sleep(300);
  }

  async function animateExtraTurn(ev) {
    var store = ev.player === 'A' ? 6 : 13;
    Board.pulse(store, ev.player === 'A' ? Board.BLUE : Board.RED);
    await notify('You Gain an Extra Turn!', Board.CYAN);
  }

  async function animateGameOver(ev) {
    await notify('Game Over', Board.GOLD);
  }

  /**
   * Play a full event log. `preBoard` = board state before the move.
   * `finalBoard` = authoritative board after the move (snapped to at the end).
   */
  async function playEvents(events, preBoard, finalBoard) {
    var disp = preBoard.slice();
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (ev.type === 'sow') await animateSow(ev, disp);
      else if (ev.type === 'capture') await animateCapture(ev, disp);
      else if (ev.type === 'extraTurn') await animateExtraTurn(ev);
      else if (ev.type === 'gameOver') await animateGameOver(ev);
    }
    Board.showArrows(false);
    if (finalBoard) Board.renderState(finalBoard);
  }

  return { playEvents: playEvents, notify: notify, sleep: sleep };
})();
