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

module.exports = {
    estimateRaiseSizing
}; 