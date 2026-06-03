/*
 * presets.js — Hand-crafted board states for the Demo and Quiz modules.
 * Each returns { board:int[14], current:'A'|'B', highlight:[pitIndex...] }.
 * highlight = the pit the learner should tap (Demo) or simply emphasis (Quiz).
 */
(function () {
  'use strict';

  window.MancalaPresets = {
    /*
     * Capture Demo — Player A to move, tap pit 0 (3 seeds).
     * Sows into 1,2,3. The last seed lands in pit 3 (empty, own side);
     * the opposite pit 9 holds 4 seeds → capture of 5 into Player A's store.
     */
    captureDemo: function () {
      return {
        //     0  1  2  3  4  5   6(A)  7  8  9 10 11 12  13(B)
        board: [3, 0, 0, 0, 4, 4,  0,   4, 4, 4, 4, 4, 4,  0],
        current: 'A',
        highlight: [0]
      };
    },

    /*
     * Extra Turn Demo — Player A to move, tap pit 3 (3 seeds).
     * Sows into 4,5,6. The last seed lands in Player A's own store (6)
     * → extra turn.
     */
    extraTurnDemo: function () {
      return {
        //     0  1  2  3  4  5   6(A)  7  8  9 10 11 12  13(B)
        board: [4, 4, 4, 3, 4, 4,  0,   4, 4, 4, 4, 4, 4,  0],
        current: 'A',
        highlight: [3]
      };
    },

    /*
     * Quiz 1 — a mid/late-game board with uneven seeds and visible scores.
     * Player A store = 24, Player B store = 20 → Player A wins.
     */
    quiz1: function () {
      return {
        //     0  1  2  3  4  5   6(A)  7  8  9 10 11 12  13(B)
        board: [2, 0, 1, 3, 0, 2, 24,   1, 2, 0, 1, 2, 1, 20],
        current: 'A',
        highlight: [],
        answer: 'A'
      };
    },

    /*
     * Quiz 2 — any legal-looking board; question is conceptual
     * ("what condition triggers game over?").
     */
    quiz2: function () {
      return {
        //     0  1  2  3  4  5   6(A)  7  8  9 10 11 12  13(B)
        board: [0, 1, 0, 2, 0, 1, 16,   3, 0, 2, 1, 0, 4, 12],
        current: 'B',
        highlight: [],
        answer: 0 // index of correct option ("one side's pits are all empty")
      };
    }
  };
})();
