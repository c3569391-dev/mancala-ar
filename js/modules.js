/*
 * modules.js — Layer B logic + screen content for the four learning modules:
 * Main / Rules / Demo / Quiz / Free Play. Routes taps to the engine + board,
 * and owns all the English user-facing text.
 */
window.Modules = (function () {
  'use strict';

  var Engine = window.MancalaEngine;
  var Presets = window.MancalaPresets;

  // current interaction mode + transient state
  var mode = 'main';          // main | rules | demo | demoCapture | demoExtra | demoExtraManual | quiz | freeplay
  var demoState = null;       // preset-derived state for a running demo
  var demoHighlight = -1;     // the single pit to tap (guided demo steps)
  var demoMoves = [];         // every tappable pit (free choice, e.g. extra-turn step)
  var game = null;            // live Free Play state
  var busy = false;           // lock taps while an animation plays

  // ---- DOM helpers ------------------------------------------------------
  function $(id) { return document.getElementById(id); }
  function setPanel(html) {
    var p = $('panel');
    p.innerHTML = html;
    p.classList.toggle('hidden', !html);
  }
  function setOptions(list) {
    var o = $('options');
    o.innerHTML = '';
    (list || []).forEach(function (it) {
      var b = document.createElement('button');
      b.className = 'opt ' + (it.variant || '');
      b.textContent = it.label;
      b.addEventListener('click', function () { it.onClick(b); });
      o.appendChild(b);
    });
    o.classList.toggle('hidden', !list || !list.length);
  }
  function setActiveNav(name) {
    document.querySelectorAll('#mainnav button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.module === name);
    });
  }

  // ---- router -----------------------------------------------------------
  function show(name) {
    if (busy) return;
    Board.reset();
    setActiveNav(name);
    if (name === 'main') return showMain();
    if (name === 'rules') return showRules();
    if (name === 'demo') return showDemo();
    if (name === 'quiz') return showQuiz();
    if (name === 'freeplay') return showFreePlay();
  }

  // ---- Main / Onboarding ------------------------------------------------
  function showMain() {
    mode = 'main';
    Board.renderState(Engine.createInitialState().board);
    setPanel(
      '<h2>Welcome to AR Mancala</h2>' +
      '<p>Learn the rules of Mancala with a holographic board.</p>' +
      '<ul>' +
      '<li><span class="cblue">Blue</span> is Player A (top side); <span class="cred">Red</span> is Player B (bottom side).</li>' +
      '<li>Every pit starts with <b>4 seeds</b>.</li>' +
      '<li>Seeds are sown one per pit, moving <b>counter-clockwise</b>.</li>' +
      '<li>Players take turns. Pick a module below to begin.</li>' +
      '</ul>'
    );
    setOptions([]);
  }

  // ---- Rules ------------------------------------------------------------
  function showRules() {
    mode = 'rules';
    Board.renderState(Engine.createInitialState().board);
    setPanel(
      '<h2>How to Play</h2>' +
      '<ul>' +
      '<li><b>Board:</b> two rows of 6 pits, plus 2 stores (one per player).</li>' +
      '<li><b>Setup:</b> each pit starts with 4 seeds.</li>' +
      '<li><b>Sides:</b> Player A owns the blue top row and its store; Player B owns the red bottom row and its store.</li>' +
      '<li><b>Sowing:</b> on your turn, take all seeds from one of your own pits and drop one into each following pit, counter-clockwise.</li>' +
      '<li><b>Stores:</b> drop a seed into your own store as you pass it, but always skip your opponent\'s store.</li>' +
      '<li><b>Extra Turn:</b> if your last seed lands in your own store, you move again.</li>' +
      '<li><b>Capture:</b> if your last seed lands in an empty pit on your own side, you capture it and all seeds in the opposite pit into your store.</li>' +
      '<li><b>Game End:</b> when one player\'s whole row is empty, the other player sweeps the rest into their store. Most seeds wins.</li>' +
      '</ul>'
    );
    setOptions([]);
  }

  // ---- Demo -------------------------------------------------------------
  function showDemo() {
    mode = 'demo';
    Board.renderState(Engine.createInitialState().board);
    setPanel(
      '<h2>Interactive Demos</h2>' +
      '<p>Pick a demo below, then tap the highlighted pit to watch the rule play out, seed by seed.</p>'
    );
    setOptions([
      { label: 'Capture Demo', onClick: runCaptureDemo },
      { label: 'Extra Turn Demo', onClick: runExtraTurnDemo }
    ]);
  }

  function startDemo(preset, newMode, intro) {
    var p = preset();
    demoState = Engine.stateFromBoard(p.board, p.current);
    demoHighlight = p.highlight[0];
    mode = newMode;
    Board.reset();
    Board.renderState(demoState.board);
    Board.showArrows(true);
    Board.setHighlights(p.highlight, p.current);
    Board.showTapHint(demoHighlight);
    setPanel(intro);
    setOptions([{ label: 'Back to Demos', onClick: showDemo }]);
  }

  function runCaptureDemo() {
    startDemo(Presets.captureDemo, 'demoCapture',
      '<h2>Capture Demo</h2>' +
      '<p>Player A to move. Tap the highlighted pit. The last seed lands in an empty pit on Player A\'s own side, capturing the seeds directly across from it.</p>');
  }
  function runExtraTurnDemo() {
    startDemo(Presets.extraTurnDemo, 'demoExtra',
      '<h2>Extra Turn Demo</h2>' +
      '<p>Player A to move. Tap the highlighted pit. The last seed lands in Player A\'s own store, earning another turn.</p>');
  }

  async function playDemo(pit) {
    busy = true;
    Board.clearHighlights();
    Board.hideTapHint();
    var pre = demoState.board.slice();
    var res = Engine.applyMove(demoState, pit);
    await Animate.playEvents(res.events, pre, res.state.board);
    demoState = res.state;
    busy = false;

    if (mode === 'demoCapture') {
      setPanel(
        '<h2 class="cgold">Capture Triggered!</h2>' +
        '<p>The last seed landed in an empty pit on Player A\'s own side. Player A takes that seed plus every seed in the opposite pit and moves them into the blue store.</p>');
      setOptions([
        { label: 'Replay', onClick: runCaptureDemo },
        { label: 'Back to Demos', onClick: showDemo }
      ]);
      return;
    }

    // Extra Turn demo: the learner just SAW the extra turn being earned. Now hand
    // control back so they take that extra turn themselves — actually tapping a
    // second move drives home that the same player goes again.
    beginExtraTurnManual();
  }

  // Stage 2 of the Extra Turn demo: Player A still has the move (the engine left
  // current = 'A'). Under the extra-turn rule the player may sow from ANY of their
  // own non-empty pits, so light up every legal pit and let the learner choose.
  function beginExtraTurnManual() {
    mode = 'demoExtraManual';
    demoMoves = Engine.legalMoves(demoState);   // all of Player A's non-empty pits
    setPanel(
      '<h2 class="ccyan">Extra Turn earned!</h2>' +
      '<p>Your last seed landed in Player A\'s own store, so Player A moves <b>again</b>. ' +
      'Now <b>you</b> take the extra turn — tap <b>any</b> glowing pit on the blue side to sow once more.</p>');
    if (demoMoves.length) {
      Board.setHighlights(demoMoves, 'A');
      Board.showTapHints(demoMoves);
    }
    setOptions([{ label: 'Back to Demos', onClick: showDemo }]);
  }

  async function playExtraTurnManual(pit) {
    busy = true;
    Board.clearHighlights();
    Board.hideTapHint();
    var pre = demoState.board.slice();
    var res = Engine.applyMove(demoState, pit);
    await Animate.playEvents(res.events, pre, res.state.board);
    demoState = res.state;
    busy = false;

    setPanel(
      '<h2 class="cgold">Nice — that was your extra turn!</h2>' +
      '<p>You just sowed a second time in the same turn. Whenever your last seed ' +
      'lands in your own store, you keep going — that\'s the extra-turn rule.</p>');
    setOptions([
      { label: 'Replay', onClick: runExtraTurnDemo },
      { label: 'Back to Demos', onClick: showDemo }
    ]);
  }

  // ---- Quiz -------------------------------------------------------------
  function showQuiz() {
    mode = 'quiz';
    Board.renderState(Engine.createInitialState().board);
    setPanel('<h2>Test Your Knowledge</h2><p>Choose a quiz below.</p>');
    setOptions([
      { label: 'Quiz 1', onClick: runQuiz1 },
      { label: 'Quiz 2', onClick: runQuiz2 }
    ]);
  }

  function runQuiz1() {
    mode = 'quiz';
    var p = Presets.quiz1();
    Board.reset();
    Board.renderState(p.board);
    setPanel(
      '<h2>Quiz 1</h2>' +
      '<p>Look at the two stores. <b>Which player wins the game?</b></p>' +
      '<p class="hint"><span class="cblue">Blue</span> = Player A &middot; <span class="cred">Red</span> = Player B</p>');
    setOptions([
      { label: 'Player A', variant: 'blue', onClick: function (b) { answerQuiz1('A', p, b); } },
      { label: 'Player B', variant: 'red', onClick: function (b) { answerQuiz1('B', p, b); } },
      { label: 'Tie', onClick: function (b) { answerQuiz1('tie', p, b); } }
    ]);
  }
  function answerQuiz1(choice, p, btn) {
    disableOptions();
    var ok = choice === p.answer;
    btn.classList.add(ok ? 'correct' : 'wrong');
    setPanel(
      '<h2 class="' + (ok ? 'cgold' : 'cred') + '">' + (ok ? 'Correct!' : 'Incorrect') + '</h2>' +
      '<p>Player A\'s store holds <b>' + p.board[6] + '</b> seeds; Player B\'s store holds <b>' + p.board[13] + '</b>. ' +
      'The player with the most seeds in their store wins, so <b>Player A wins</b>.</p>');
    appendBack(runQuiz1);
  }

  function runQuiz2() {
    mode = 'quiz';
    var p = Presets.quiz2();
    Board.reset();
    Board.renderState(p.board);
    setPanel('<h2>Quiz 2</h2><p><b>What condition triggers game over?</b></p>');
    var opts = [
      "One side's pits are all empty",
      'Gaining an extra turn',
      'Capturing seeds'
    ];
    setOptions(opts.map(function (label, idx) {
      return { label: label, onClick: function (b) { answerQuiz2(idx, p, b); } };
    }));
  }
  function answerQuiz2(idx, p, btn) {
    disableOptions();
    var ok = idx === p.answer;
    btn.classList.add(ok ? 'correct' : 'wrong');
    setPanel(
      '<h2 class="' + (ok ? 'cgold' : 'cred') + '">' + (ok ? 'Correct!' : 'Incorrect') + '</h2>' +
      '<p>The game ends when <b>one player\'s whole row of pits is empty</b>. The other player then sweeps all remaining seeds into their store, and whoever has the most seeds wins. Captures and extra turns happen during play but never end the game.</p>');
    appendBack(runQuiz2);
  }

  function disableOptions() {
    document.querySelectorAll('#options .opt').forEach(function (x) { x.disabled = true; });
  }
  function appendBack(retry) {
    var o = $('options');
    var wrap = document.createElement('div');
    wrap.className = 'retry-row';
    [['Try Again', retry], ['More Quizzes', showQuiz]].forEach(function (pair) {
      var b = document.createElement('button');
      b.className = 'opt small';
      b.textContent = pair[0];
      b.addEventListener('click', function () { pair[1](); });
      wrap.appendChild(b);
    });
    o.appendChild(wrap);
  }

  // ---- Free Play --------------------------------------------------------
  function showFreePlay() {
    mode = 'freeplay';
    game = Engine.createInitialState();
    Board.reset();
    Board.renderState(game.board);
    updateFreePlayStatus();
    Board.setHighlights(Engine.legalMoves(game), game.current);
    setOptions([{ label: 'Reset Game', onClick: showFreePlay }]);
  }
  function updateFreePlayStatus() {
    var side = game.current === 'A' ? '<span class="cblue">Player A</span>' : '<span class="cred">Player B</span>';
    setPanel(
      '<h2>Free Play</h2>' +
      '<p>Current turn: <b>' + side + '</b>. Tap one of your glowing pits to sow.</p>' +
      '<p class="hint">Store A: <b class="cblue">' + game.board[6] + '</b> &middot; Store B: <b class="cred">' + game.board[13] + '</b></p>');
  }
  async function playFreeMove(pit) {
    if (!Engine.legalMoves(game).includes(pit)) return;
    busy = true;
    Board.clearHighlights();
    var pre = game.board.slice();
    var res = Engine.applyMove(game, pit);
    await Animate.playEvents(res.events, pre, res.state.board);
    game = res.state;
    busy = false;

    if (game.over) {
      var msg = game.winner === 'tie'
        ? 'It\'s a tie!'
        : 'Player ' + game.winner + ' wins!';
      setPanel(
        '<h2 class="cgold">Game Over</h2>' +
        '<p>' + msg + '</p>' +
        '<p class="hint">Store A: <b class="cblue">' + game.board[6] + '</b> &middot; Store B: <b class="cred">' + game.board[13] + '</b></p>');
      setOptions([{ label: 'Play Again', onClick: showFreePlay }]);
    } else {
      updateFreePlayStatus();
      Board.setHighlights(Engine.legalMoves(game), game.current);
    }
  }

  // ---- pit tap dispatch (wired to Board.onPitClick) ---------------------
  function onPitClicked(i) {
    if (busy) return;
    if (mode === 'demoCapture' || mode === 'demoExtra') {
      if (i === demoHighlight) playDemo(i);
    } else if (mode === 'demoExtraManual') {
      if (demoMoves.indexOf(i) >= 0) playExtraTurnManual(i);
    } else if (mode === 'freeplay') {
      playFreeMove(i);
    }
  }

  return { show: show, onPitClicked: onPitClicked };
})();
