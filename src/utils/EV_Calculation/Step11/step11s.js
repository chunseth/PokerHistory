/**
 * Step 11s: Estimate Raise Sizing
 * -------------------------------------------------------------
 * Generates recommended raise‐size options for the current decision node
 * using simple heuristics tied to bet size, pot size, effective stacks,
 * and game phase.  Intended for downstream EV calculation (Step 12).
 *
 * Categories (per Step11.txt):
 *   • small       → 2.5-3 × current bet
 *   • medium      → 3-4 × current bet
 *   • large       → 4 × current bet or pot-sized raise
 *   • all_in      → remaining effective stack
 *
 * The function returns both absolute chip amounts and the bet-to-pot ratio
 * each sizing represents, along with helpful metadata.
 *
 * @param {Object} context  – Information about the betting situation
 *   @property {Number} currentBet      – Amount the villain has bet we are facing
 *   @property {Number} potSize         – Pot size BEFORE we raise/call
 *   @property {Number} effectiveStack  – Remaining chips after calling
 *   @property {String} street          – 'preflop'|'flop'|'turn'|'river'
 *   @property {Boolean} isAllIn        – True if villain is already all-in
 *   @property {Number} stackToPotRatio – Stack-to-pot ratio (SPR)
 *
 * @returns {Object} sizes
 *   {
 *     small:  { amount, potRatio },
 *     medium: { amount, potRatio },
 *     large:  { amount, potRatio },
 *     all_in: { amount, potRatio }
 *   }
 */
function estimateRaiseSizing(context = {}) {
    const {
        currentBet = 0,
        potSize = 0,
        effectiveStack = 100,
        street = 'flop',
        isAllIn = false,
        stackToPotRatio
    } = context;

    // Calculate SPR if not provided directly
    const spr = stackToPotRatio !== undefined ? stackToPotRatio : (potSize ? (effectiveStack / potSize) : Infinity);

    // Edge cases: no raise possible
    if (isAllIn || currentBet === 0) {
        return {
            small:  { amount: 0, potRatio: 0 },
            medium: { amount: 0, potRatio: 0 },
            large:  { amount: 0, potRatio: 0 },
            all_in: { amount: effectiveStack, potRatio: effectiveStack / (potSize || 1) }
        };
    }

    // Helper to clamp to effective stack and round to 0.01 precision
    const clip = x => Math.min(Math.max(0, x), effectiveStack);
    const round = x => Math.round(x * 100) / 100;

    let smallMult  = 2.75;
    let mediumMult = 3.5;
    let largeAmt;

    // GTO-inspired tweaks using SPR
    if (spr <= 1.5) {
        // Very low SPR: leverage all-in pressure, shrink raise sizes
        smallMult = 1.5;   // min-raise-ish
        mediumMult = 2.0;
    } else if (spr <= 3) {
        // Low SPR: prefer smaller raises
        smallMult = 2.0;
        mediumMult = 2.75;
    } else if (spr >= 8) {
        // Very deep SPR: incentivise bigger raises preflop/early streets
        smallMult = 3.0;
        mediumMult = 4.0;
    }

    const smallAmt  = clip(round(currentBet * smallMult));
    const mediumAmt = clip(round(currentBet * mediumMult));

    // Large sizing logic varies with SPR and street
    if (spr <= 2) {
        // Short: large sizing is simply jam (all in)
        largeAmt = effectiveStack;
    } else {
        // Deep: choose between 4x bet or pot-size raise
        const potRaiseAmt = clip(round(potSize + currentBet * 2));
        largeAmt = clip(Math.max(round(currentBet * 4), potRaiseAmt));
    }

    const allInAmt = clip(effectiveStack);

    const denom = potSize || 1;
    return {
        small:  { amount: smallAmt,  potRatio: round(smallAmt  / denom) },
        medium: { amount: mediumAmt, potRatio: round(mediumAmt / denom) },
        large:  { amount: largeAmt,  potRatio: round(largeAmt  / denom) },
        all_in: { amount: allInAmt,  potRatio: round(allInAmt / denom) },
        metadata: {
            currentBet,
            potSize,
            effectiveStack,
            street,
            spr,
            categoryMultipliers: { smallMult, mediumMult }
        }
    };
}

/**
 * Step 11s: Build Raise-Sizing Catalogue
 * --------------------------------------------------
 * For a given hero betting action we need a catalogue of reasonable raise (or
 * re-raise) sizes that the opponent might choose if they respond with a raise.
 * Later steps (11t) will assign weights to these sizes; Mid-EV steps (14+)
 * will calculate EV for each.  For now we derive a handful of canonical
 * fractions of the pot plus the opponent's all-in sizing.
 *
 * NOTE: This is an initial heuristic implementation – it does not account for
 * stack depth constraints beyond a simple min(stack, size) clamp.
 *
 * @param {Object} params
 * @param {Object} params.hand          – Full hand object (Mongoose plain obj)
 * @param {number} params.actionIndex   – Index of hero action within bettingActions
 * @param {Object} params.playerAction  – Analysis object from Step 11a
 * @param {number} params.potBefore     – Pot size before the hero action
 * @param {number} params.betSize       – Hero's bet/raise size
 * @param {number} params.opponentStack – Villain's remaining stack before acting
 * @returns {Object} catalogue – { minRaise, halfPot, pot, twoPot, allIn }
 */
function buildRaiseSizingCatalogue({
  hand,
  actionIndex,
  playerAction = {},
  potBefore = 0,
  betSize = 0,
  opponentStack = Infinity
}) {
  // Minimum legal raise in no-limit: previous bet + (bet – last raise size).
  // For simplicity assume twice the hero bet.
  const minRaise = clamp(betSize * 2, 0, opponentStack);

  const halfPot = clamp(potBefore * 0.5 + betSize * 2, 0, opponentStack); // raise to half-pot total
  const pot = clamp(potBefore + betSize * 2, 0, opponentStack);            // raise to pot
  const twoPot = clamp((potBefore + betSize) * 2, 0, opponentStack);       // approx 2× pot (overbet)
  const allIn = opponentStack;                                             // shove

  // Map to size buckets expected by 11t so that amounts aren't 0
  const sizeBuckets = {
    // For most spots villain's "small" raise is the minimum legal raise
    small: minRaise,
    // "medium" ≈ raise-to-pot (or half-pot if that exceeds stack)
    medium: pot,
    // "large" ≈ over-bet / two-pot (capped at stack)
    large: twoPot,
    // All-in bucket
    all_in: allIn
  };

  return {
    minRaise,
    halfPot,
    pot,
    twoPot,
    allIn,
    ...sizeBuckets
  };
}

function clamp(x, low, high) {
  return Math.max(low, Math.min(high, x));
}

module.exports = {
    estimateRaiseSizing,
    buildRaiseSizingCatalogue
}; 