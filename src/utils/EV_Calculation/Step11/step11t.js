/**
 * Step 11t: Calculate Weighted Average Raise Size
 * -------------------------------------------------------------
 * Consumes the raise sizing catalogue produced in Step 11s together with a
 * probability distribution for each sizing tier (small / medium / large /
 * all-in). It returns a single weighted average size plus helpful breakdowns.
 *
 * The caller can supply custom probabilities. If the provided distribution is
 * incomplete or does not sum to 1.0, the function normalises it.  Default
 * baseline (if nothing is supplied) is skewed toward small/medium raises:
 *        { small: 0.4, medium: 0.35, large: 0.2, all_in: 0.05 }
 *
 * Pot-odds & implied-odds hooks: optional callbacks allow a parent module to
 * adjust probabilities before weighting.  For now we simply expose the spots
 * where such adjustments can be plugged in.
 *
 * @param {Object} sizingObj – output of estimateRaiseSizing(), keys `small|medium|large|all_in`.
 * @param {Object} sizeProbs – { small, medium, large, all_in } (optional).
 * @param {Function} [adjustFn] – optional callback (potOdds, impliedOdds) => newProbs
 * @returns {Object} {
 *    weightedSize,               // absolute chip amount
 *    weightedPotRatio,           // size / pot
 *    distribution,               // final prob distribution used
 *    breakdown,                  // per tier { amount, prob, contribution }
 *    metadata }
 */
function calculateWeightedAverageRaiseSize(sizingObj = {}, sizeProbs = {}, adjustFn) {
    // Fallback distribution
    const defaultProbs = { small: 0.4, medium: 0.35, large: 0.2, all_in: 0.05 };
    const probs = { ...defaultProbs, ...sizeProbs };

    // Allow external adjustment (e.g., pot-odds / implied-odds)
    const finalProbs = typeof adjustFn === 'function' ? adjustFn(probs) || probs : probs;

    // Normalise to 1
    const totalP = Object.values(finalProbs).reduce((s, p) => s + (p || 0), 0) || 1;
    Object.keys(finalProbs).forEach(k => { finalProbs[k] = (finalProbs[k] || 0) / totalP; });

    // Helper
    const amt = key => (sizingObj[key] ? sizingObj[key].amount : 0);

    const contributions = {
        small:  amt('small')  * finalProbs.small,
        medium: amt('medium') * finalProbs.medium,
        large:  amt('large')  * finalProbs.large,
        all_in: amt('all_in') * finalProbs.all_in
    };

    const weightedSize = Object.values(contributions).reduce((s, v) => s + v, 0);
    const potSize = sizingObj.metadata?.potSize || 1;

    return {
        weightedSize,
        weightedPotRatio: weightedSize / potSize,
        distribution: finalProbs,
        breakdown: {
            small:  { amount: amt('small'),  prob: finalProbs.small,  contribution: contributions.small },
            medium: { amount: amt('medium'), prob: finalProbs.medium, contribution: contributions.medium },
            large:  { amount: amt('large'),  prob: finalProbs.large,  contribution: contributions.large },
            all_in: { amount: amt('all_in'), prob: finalProbs.all_in, contribution: contributions.all_in }
        },
        metadata: {
            spr: sizingObj.metadata?.spr,
            potSize,
            effectiveStack: sizingObj.metadata?.effectiveStack,
            currentBet: sizingObj.metadata?.currentBet
        }
    };
}

module.exports = {
    calculateWeightedAverageRaiseSize
}; 