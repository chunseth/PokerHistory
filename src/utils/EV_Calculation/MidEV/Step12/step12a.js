/**
 * Step 12a: Estimate hero equity versus the villain's calling range.
 * -----------------------------------------------------------------
 * This helper is consumed later in the EV tree (Steps 15-18).
 *
 * Inputs
 *   - board      : Array<string> – community cards revealed up to the decision
 *   - heroRange  : Array<{ combo:[string,string], weight:number }>
 *   - callRange  : Array<{ combo:[string,string], weight:number }>
 *   - samples    : (optional) number – Monte-Carlo samples when the hand is
 *                  not yet on the river.  Default 1 000.
 *
 * Output
 *   { equity:number, details:Object }
 *
 * The implementation purposefully trades some precision for speed by
 * sampling run-outs on streets earlier than the river.  When we are already
 * on the river, equity is calculated deterministically by directly
 * evaluating both 7-card hands.
 */

// External dependency already declared in package.json
const { Hand } = require('pokersolver');

// ---- Internal helpers ----------------------------------------------------

// Generate a full 52-card deck in "As", "Td" … format.
function generateFullDeck() {
  const ranks = '23456789TJQKA'.split('');
  const suits = 'cdhs'.split('');
  const deck = [];
  ranks.forEach(r => suits.forEach(s => deck.push(r + s)));
  return deck;
}

// Return a new deck array without the specified dead cards.
function generateDeckMinus(deadCards = []) {
  const dead = new Set(deadCards);
  return generateFullDeck().filter(c => !dead.has(c));
}

// Pick `n` unique random cards from `deck`.  (deck is assumed to have
// sufficient elements.)
function getRandomSubset(deck, n) {
  const chosen = [];
  const deckCopy = [...deck];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * deckCopy.length);
    chosen.push(deckCopy[idx]);
    deckCopy.splice(idx, 1);
  }
  return chosen;
}

// Determine the showdown result for hero vs villain.
// Returns 1 for hero win, 0.5 for split, 0 for loss.
function evaluateHeadsUp(heroCards, villainCards, boardCards) {
  const heroHand = Hand.solve([...heroCards, ...boardCards]);
  const villainHand = Hand.solve([...villainCards, ...boardCards]);
  const winners = Hand.winners([heroHand, villainHand]);
  if (winners.length === 2) return 0.5; // chopped pot
  return winners[0] === heroHand ? 1 : 0;
}

// ---- Main export ---------------------------------------------------------

/**
 * Estimate hero's equity versus the villain's *calling* range.
 * @param {Object} params
 * @param {string[]} params.board
 * @param {{ combo:[string,string], weight:number }[]} params.heroRange
 * @param {{ combo:[string,string], weight:number }[]} params.callRange
 * @param {number} [params.samples=1000]
 * @returns {{ equity:number, details:Object }}
 */
function estimateEquityVsCallingRange({ board = [], heroRange = [], callRange = [], samples = 1000 } = {}) {
  // Basic validation -------------------------------------------------------
  if (!Array.isArray(board) || !Array.isArray(heroRange) || !Array.isArray(callRange)) {
    return { equity: 0.5, details: { reason: 'Invalid inputs – returning neutral equity.' } };
  }
  if (!heroRange.length || !callRange.length) {
    return { equity: 0.5, details: { reason: 'Empty ranges – returning neutral equity.' } };
  }

  const remainingCards = 5 - board.length; // how many streets left to run
  const heroWinWeight = { value: 0 };
  let totalWeight = 0;

  // Pre-compute a deck that is only static dead cards (the board).
  const staticDeadDeck = generateDeckMinus(board);

  // Iterate hero × villain combos -----------------------------------------
  for (const h of heroRange) {
    const [h1, h2] = h.combo;
    if (!h1 || !h2) continue;

    for (const v of callRange) {
      const [v1, v2] = v.combo;
      if (!v1 || !v2) continue;

      // Skip if any card overlaps between players or with the board.
      const collision = new Set([h1, h2, v1, v2]);
      if (collision.size < 4) continue; // duplicates mean overlap
      if ([h1, h2, v1, v2].some(c => board.includes(c))) continue;

      const weightProduct = (h.weight ?? 1) * (v.weight ?? 1);
      totalWeight += weightProduct;

      let matchupEquity;

      if (remainingCards === 0) {
        // River – deterministic evaluation
        matchupEquity = evaluateHeadsUp([h1, h2], [v1, v2], board);
      } else {
        // Flop / Turn – Monte-Carlo sampling -------------------------------
        let wins = 0;
        const localDeadSet = new Set([...board, h1, h2, v1, v2]);
        const deckMinusAllSeen = staticDeadDeck.filter(c => !localDeadSet.has(c));

        for (let i = 0; i < samples; i++) {
          const runout = getRandomSubset(deckMinusAllSeen, remainingCards);
          wins += evaluateHeadsUp([h1, h2], [v1, v2], [...board, ...runout]);
        }
        matchupEquity = wins / samples;
      }

      heroWinWeight.value += matchupEquity * weightProduct;
    }
  }

  const equity = totalWeight ? heroWinWeight.value / totalWeight : 0.5;

  return {
    equity: Number(equity.toFixed(4)),
    details: {
      boardLength: board.length,
      remainingCards,
      heroCombos: heroRange.length,
      villainCombos: callRange.length,
      totalWeight: Number(totalWeight.toFixed(2)),
      samplesPerMatchup: remainingCards === 0 ? 0 : samples,
    }
  };
}

module.exports = {
  estimateEquityVsCallingRange,
  // exporting helpers makes unit-testing easier
  _internal: {
    generateFullDeck,
    generateDeckMinus,
    getRandomSubset,
    evaluateHeadsUp
  }
}; 