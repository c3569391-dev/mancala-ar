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
  var SOW_HOP = 230;   // ms per seed hop
  var GAP = 70;        // ms pause between hops

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // Ease-in-out position tween with a small parabolic arc (the "hover" feel).
  function tween(el, from, to, dur) {
    return new Promise(function (res) {
      var start = performance.now();
      el.object3D.position.set(from.x, from.y, from.z);
      function step(t) {
        var k = Math.min(1, (t - start) / dur);
        var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        var arc = Math.sin(k * Math.PI) * 0.05;
        el.object3D.position.set(
          from.x + (to.x - from.x) * e,
          from.y + (to.y - from.y) * e + arc,
          from.z + (to.z - from.z) * e + 0.04
        );
        if (k < 1) requestAnimationFrame(step); else res();
      }
      requestAnimationFrame(step);
    });
  }

  function flyingSeed() {
    var s = document.createElement('a-sphere');
    s.setAttribute('radius', 0.016);
    s.setAttribute('material', 'shader: standard; color: ' + Board.GOLD +
      '; emissive: ' + Board.GOLD + '; emissiveIntensity: 1.4; metalness: 0.2; roughness: 0.2');
    Board.anchorEl().appendChild(s);
    return s;
  }

  // Floating notification ("Capture Triggered!", "You Gain an Extra Turn!").
  function notify(text, color) {
    var n = Board.notifEl();
    n.setAttribute('color', color || Board.GOLD);
    n.setAttribute('value', text);
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
    await notify('Capture Triggered!', Board.GOLD);
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
