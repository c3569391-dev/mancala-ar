/*
 * engine.test.js — Headless verification of the Kalah rules engine.
 * Run with:  node js/engine.test.js
 *
 * Covers: sowing, store-skipping, extra turn, capture (and its negatives),
 * game-end detection, sweeping, winner/tie, illegal moves, and immutability.
 */
'use strict';

// Load engine.js (browser file) into a minimal shim.
global.window = {};
require('fs').readFileSync; // noop, keep fs reference explicit
var fs = require('fs');
var path = require('path');
eval(fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8'));
var E = global.window.MancalaEngine;

// ---- tiny assertion framework ----------------------------------------
var pass = 0, fail = 0, failures = [];
function eq(actual, expected, msg) {
  var a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { pass++; }
  else { fail++; failures.push(msg + '\n      expected ' + b + '\n      got      ' + a); }
}
function ok(cond, msg) {
  if (cond) { pass++; } else { fail++; failures.push(msg); }
}
function S(board, cur) { return E.stateFromBoard(board, cur); }

// =====================================================================
// 1. Initial state & legal moves
// =====================================================================
(function () {
  var s = E.createInitialState();
  eq(s.board, [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0], '1a initial board');
  eq(s.current, 'A', '1b A starts');
  ok(!s.over, '1c not over');
  eq(E.legalMoves(s), [0, 1, 2, 3, 4, 5], '1d A legal moves');
  eq(E.legalMoves(S([0,0,0,0,0,0,0, 4,4,4,4,4,4,0], 'A')), [], '1e no moves when row empty');
})();

// =====================================================================
// 2. Basic sowing (one seed per pit, counter-clockwise), no special rule
// =====================================================================
(function () {
  // A plays pit 0 (4 seeds) -> 1,2,3,4 ; last in own pit (was 4) -> normal hand-off
  var r = E.applyMove(E.createInitialState(), 0);
  eq(r.events[0], { type: 'sow', from: 0, count: 4, path: [1, 2, 3, 4] }, '2a sow path');
  eq(r.state.board, [0, 5, 5, 5, 5, 4, 0, 4, 4, 4, 4, 4, 4, 0], '2b board after sow');
  eq(r.state.current, 'B', '2c turn switches to B');
  eq(r.events.length, 1, '2d only a sow event');
})();

// =====================================================================
// 3. Store-skipping
// =====================================================================
(function () {
  // Player A must SKIP Player B's store (13).
  // A plays pit 5 with 8 seeds -> 6,7,8,9,10,11,12, then skip 13 -> 0
  var sa = S([4,4,4,4,4,8, 0, 4,4,4,4,4,4, 0], 'A');
  var ra = E.applyMove(sa, 5);
  eq(ra.events[0].path, [6, 7, 8, 9, 10, 11, 12, 0], '3a A skips B store (13)');
  ok(ra.state.board[13] === 0, '3b B store untouched by A');

  // Player B must SKIP Player A's store (6).
  // B plays pit 12 with 8 seeds -> 13,0,1,2,3,4,5, then skip 6 -> 7
  var sb = S([4,4,4,4,4,4, 0, 4,4,4,4,4,8, 0], 'B');
  var rb = E.applyMove(sb, 12);
  eq(rb.events[0].path, [13, 0, 1, 2, 3, 4, 5, 7], '3c B skips A store (6)');
  ok(rb.state.board[6] === 0, '3d A store untouched by B (no seed added, stays 0)');
})();

// =====================================================================
// 4. Extra turn (last seed lands in own store)
// =====================================================================
(function () {
  // A plays pit 2 (4 seeds) -> 3,4,5,6 ; last in A store -> extra turn
  var r = E.applyMove(E.createInitialState(), 2);
  ok(r.events.some(function (e) { return e.type === 'extraTurn' && e.player === 'A'; }), '4a extraTurn event');
  eq(r.state.current, 'A', '4b same player keeps the turn');
  eq(r.state.board[6], 1, '4c seed landed in A store');

  // B earns an extra turn too (pit 9 with 4 seeds -> 10,11,12,13)
  var rb = E.applyMove(S([4,4,4,4,4,4, 0, 4,4,4,4,4,4, 0], 'B'), 9);
  ok(rb.events.some(function (e) { return e.type === 'extraTurn'; }), '4d B extraTurn');
  eq(rb.state.current, 'B', '4e B keeps turn');
})();

// =====================================================================
// 5. Capture (last seed in own empty pit, opposite non-empty)
// =====================================================================
(function () {
  // A plays pit 0 (3) -> 1,2,3 ; pit 3 was empty (own side); opposite 9 has 4
  var s = S([3,0,0,0,4,4, 0, 4,4,4,4,4,4, 0], 'A');
  var r = E.applyMove(s, 0);
  var cap = r.events.find(function (e) { return e.type === 'capture'; });
  eq(cap, { type: 'capture', player: 'A', pit: 3, opposite: 9, gained: 5 }, '5a capture event');
  eq(r.state.board[6], 5, '5b 5 seeds into A store');
  eq(r.state.board[3], 0, '5c landing pit emptied');
  eq(r.state.board[9], 0, '5d opposite pit emptied');
  eq(r.state.current, 'B', '5e turn switches after capture');
})();

// =====================================================================
// 6. Capture negatives
// =====================================================================
(function () {
  // 6a No capture when the opposite pit is empty.
  // A plays pit 0 (1) -> pit 1 (own, empty); opposite 11 is empty -> no capture
  var r1 = E.applyMove(S([1,0,4,4,4,4, 0, 4,4,4,4,0,4, 0], 'A'), 0);
  ok(!r1.events.some(function (e) { return e.type === 'capture'; }), '6a no capture if opposite empty');
  eq(r1.state.board[1], 1, '6a- seed stays in pit 1');

  // 6b No capture when the last seed lands on the OPPONENT's side.
  // A plays pit 5 (2) -> 6(store),7 ; pit 7 empty but it is B's side -> no capture
  var r2 = E.applyMove(S([4,4,4,4,4,2, 0, 0,4,4,4,4,4, 0], 'A'), 5);
  ok(!r2.events.some(function (e) { return e.type === 'capture'; }), '6b no capture on opponent side');
  eq(r2.state.board[7], 1, '6b- seed stays in pit 7');

  // 6c No capture when landing in own NON-empty pit.
  // A plays pit 0 (1) -> pit 1 which already had seeds -> no capture
  var r3 = E.applyMove(S([1,3,4,4,4,4, 0, 4,4,4,4,4,4, 0], 'A'), 0);
  ok(!r3.events.some(function (e) { return e.type === 'capture'; }), '6c no capture into non-empty own pit');
})();

// =====================================================================
// 7. Game end + sweep + winner
// =====================================================================
(function () {
  // 7a A empties its own row; B's remaining seeds are swept into B's store.
  // A plays pit 5 (1) -> store 6 ; A row now all empty -> game over.
  var s = S([0,0,0,0,0,1, 20, 2,0,0,0,0,3, 10], 'A');
  var r = E.applyMove(s, 5);
  var go = r.events.find(function (e) { return e.type === 'gameOver'; });
  ok(!!go, '7a gameOver event fired');
  eq(r.state.board[6], 21, '7b A store = 21 (20 + landed seed)');
  eq(r.state.board[13], 15, '7c B store swept to 15 (10 + 2 + 3)');
  eq(go.swept, { A: 0, B: 5 }, '7d swept counts');
  eq(r.state.winner, 'A', '7e A wins (21 > 15)');
  ok(r.state.over && r.state.current === null, '7f game flagged over');
  // every pit empty after sweep
  ok([0,1,2,3,4,5,7,8,9,10,11,12].every(function (i) { return r.state.board[i] === 0; }), '7g all pits empty');

  // 7h B empties its own row -> A side swept.
  var sb = S([3,0,0,0,0,2, 5, 0,0,0,0,0,1, 9], 'B');
  var rb = E.applyMove(sb, 12); // pit12 (1) -> store13 ; B row empty -> over
  ok(rb.events.some(function (e) { return e.type === 'gameOver'; }), '7h B-side end detected');
  eq(rb.state.board[6], 10, '7i A swept (5 + 3 + 2)');
  eq(rb.state.board[13], 10, '7j B store = 10');
  eq(rb.state.winner, 'tie', '7k tie at 10-10');
})();

// =====================================================================
// 8. Illegal moves leave state untouched
// =====================================================================
(function () {
  var s = E.createInitialState();
  var r1 = E.applyMove(s, 7); // opponent pit
  ok(r1.illegal === true && r1.state === s, '8a cannot play opponent pit');
  var r2 = E.applyMove(S([0,4,4,4,4,4, 0, 4,4,4,4,4,4, 0], 'A'), 0); // empty pit
  ok(r2.illegal === true, '8b cannot play empty pit');
})();

// =====================================================================
// 9. Immutability — applyMove must not mutate the input
// =====================================================================
(function () {
  var s = E.createInitialState();
  var snapshot = s.board.slice();
  E.applyMove(s, 2);
  eq(s.board, snapshot, '9a input board unchanged');
  ok(s.current === 'A', '9b input turn unchanged');
})();

// ---- report ----------------------------------------------------------
console.log('\nEngine verification — ' + pass + ' passed, ' + fail + ' failed.\n');
if (fail) {
  failures.forEach(function (f, i) { console.log('  ✗ ' + f); });
  process.exit(1);
} else {
  console.log('  ✓ All rules verified: sowing, store-skip, extra turn,');
  console.log('    capture (+negatives), game end, sweep, winner/tie,');
  console.log('    illegal moves, immutability.');
}
