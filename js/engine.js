/*
 * engine.js — Pure Kalah Mancala rules engine.
 * No DOM, no AR. Everything else (rendering, animation, modules) is driven by
 * the immutable state + event log returned from applyMove().
 *
 * Board indexing (see SPEC §6):
 *   Pits 0–6   = Player A's pits      Pit 7  = Player A's store
 *   Pits 8–14  = Player B's pits      Pit 15 = Player B's store
 *   Sowing order: 0→1→…→14→15→0 (counter-clockwise)
 *   Player A skips 15; Player B skips 7.
 *   Opposite pit of i (for capture) = 14 - i
 */
(function () {
  'use strict';

  var A_PITS = [0, 1, 2, 3, 4, 5, 6];
  var B_PITS = [8, 9, 10, 11, 12, 13, 14];
  var A_STORE = 7;
  var B_STORE = 15;

  function isStore(i) { return i === A_STORE || i === B_STORE; }
  function storeOf(player) { return player === 'A' ? A_STORE : B_STORE; }
  function pitsOf(player) { return player === 'A' ? A_PITS : B_PITS; }
  function owns(player, i) { return player === 'A' ? (i >= 0 && i <= 6) : (i >= 8 && i <= 14); }
  function opposite(i) { return 14 - i; }
  function other(player) { return player === 'A' ? 'B' : 'A'; }

  /** Fresh game: every pit holds 4 seeds, stores empty, Player A to move. */
  function createInitialState() {
    var board = [4, 4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 4, 0];
    return { board: board, current: 'A', over: false, winner: null };
  }

  /** Build a state from a raw board array (used by presets). */
  function stateFromBoard(board, current) {
    return { board: board.slice(), current: current || 'A', over: false, winner: null };
  }

  /** Indices of the current player's pits that contain seeds. */
  function legalMoves(state) {
    if (state.over) return [];
    return pitsOf(state.current).filter(function (i) { return state.board[i] > 0; });
  }

  /** Next pit in sowing order, skipping the opponent's store. */
  function nextIndex(i, player) {
    var n = (i + 1) % 16;
    if (player === 'A' && n === B_STORE) n = (n + 1) % 16;
    if (player === 'B' && n === A_STORE) n = (n + 1) % 16;
    return n;
  }

  function sideEmpty(board, player) {
    return pitsOf(player).every(function (i) { return board[i] === 0; });
  }

  /** End condition: one player's whole row of pits is empty. */
  function isGameOver(board) {
    return sideEmpty(board, 'A') || sideEmpty(board, 'B');
  }

  /** Each player rakes their own remaining pit seeds into their own store. */
  function sweep(board) {
    var swept = { A: 0, B: 0 };
    A_PITS.forEach(function (i) { swept.A += board[i]; board[A_STORE] += board[i]; board[i] = 0; });
    B_PITS.forEach(function (i) { swept.B += board[i]; board[B_STORE] += board[i]; board[i] = 0; });
    return swept;
  }

  function winnerOf(board) {
    if (board[A_STORE] > board[B_STORE]) return 'A';
    if (board[B_STORE] > board[A_STORE]) return 'B';
    return 'tie';
  }

  /**
   * Apply a move (sow the chosen pit) and return a NEW state plus an ordered
   * event log describing what happened, for the animation layer to replay.
   *
   * Events:
   *   { type:'sow',       from, count, path:[idx...] }
   *   { type:'capture',   player, pit, opposite, gained }
   *   { type:'extraTurn', player }
   *   { type:'gameOver',  winner, stores:{A,B}, swept:{A,B} }
   */
  function applyMove(state, pit) {
    if (state.over || !owns(state.current, pit) || state.board[pit] === 0) {
      return { state: state, events: [], illegal: true };
    }

    var player = state.current;
    var board = state.board.slice();
    var events = [];

    // 1. Sow seeds one per pit, counter-clockwise.
    var seeds = board[pit];
    board[pit] = 0;
    var path = [];
    var idx = pit;
    for (var s = 0; s < seeds; s++) {
      idx = nextIndex(idx, player);
      board[idx] += 1;
      path.push(idx);
    }
    events.push({ type: 'sow', from: pit, count: seeds, path: path });
    var last = idx;

    // 2. Resolve landing: extra turn, capture, or normal hand-off.
    var extraTurn = false;
    if (last === storeOf(player)) {
      extraTurn = true;
      events.push({ type: 'extraTurn', player: player });
    } else if (owns(player, last) && board[last] === 1) {
      // Last seed landed in a pit that was empty on the player's own side.
      var opp = opposite(last);
      if (board[opp] > 0) {
        var gained = board[opp] + board[last];
        board[storeOf(player)] += gained;
        board[opp] = 0;
        board[last] = 0;
        events.push({ type: 'capture', player: player, pit: last, opposite: opp, gained: gained });
      }
    }

    var nextPlayer = extraTurn ? player : other(player);
    var newState = { board: board, current: nextPlayer, over: false, winner: null };

    // 3. End-of-game check + sweep.
    if (isGameOver(board)) {
      var swept = sweep(board);
      newState.over = true;
      newState.winner = winnerOf(board);
      newState.current = null;
      events.push({
        type: 'gameOver',
        winner: newState.winner,
        stores: { A: board[A_STORE], B: board[B_STORE] },
        swept: swept
      });
    }

    return { state: newState, events: events };
  }

  // Public API
  window.MancalaEngine = {
    A_PITS: A_PITS, B_PITS: B_PITS, A_STORE: A_STORE, B_STORE: B_STORE,
    createInitialState: createInitialState,
    stateFromBoard: stateFromBoard,
    legalMoves: legalMoves,
    applyMove: applyMove,
    isStore: isStore,
    owns: owns,
    opposite: opposite,
    storeOf: storeOf,
    pitsOf: pitsOf,
    other: other,
    isGameOver: isGameOver,
    winnerOf: winnerOf
  };
})();
