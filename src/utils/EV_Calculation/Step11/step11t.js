/**
 * Step 11t: Weight Raise Sizing Options
 * --------------------------------------------------
 * Given the sizing catalogue produced by 11s, assign probabilities to each
 * sizing bucket (small / medium / large / all_in).  The weights should reflect
 * simple strategic heuristics:
 *   • At low SPR villain prefers small raises (more flatting)
 *   • Deep SPR encourages larger raises
 *   • In tournament situations when short-stacked (< 15bb) all-in weight rises
 *   • Overbet/2×pot is used sparingly (large bucket)
 *
 * For now we approximate with the following logic:
 *   1. Compute SPR (stack-to-pot ratio after hero bet).
 *   2. Map SPR → base weights table.
 *   3. Normalise to ensure weights sum to 1.
 *
 * @param {Object} params
 * @param {Object} params.catalogue     – Output of buildRaiseSizingCatalogue
 * @param {number} params.potSize       – Pot size before villain acts
 * @param {number} params.opponentStack – Villain stack before acting
 * @returns {Object} weighted – { small:{amount, weight}, medium:{...}, large:{...}, all_in:{...} }
 */
function weightRaiseSizing({ catalogue = {}, potSize = 0, opponentStack = Infinity }) {
  const spr = potSize ? opponentStack / potSize : Infinity;

  // Base weights by SPR bucket
  let weights;
  if (spr <= 2) {
    // Short SPR – shove or small
    weights = { small: 0.45, medium: 0.25, large: 0.1, all_in: 0.2 };
  } else if (spr <= 4) {
    weights = { small: 0.4, medium: 0.35, large: 0.2, all_in: 0.05 };
  } else if (spr <= 8) {
    weights = { small: 0.35, medium: 0.4, large: 0.2, all_in: 0.05 };
  } else {
    // Deep
    weights = { small: 0.3, medium: 0.4, large: 0.25, all_in: 0.05 };
  }

  // Attach amounts and normalise
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  const norm = key => ({ amount: catalogue[key] ?? 0, weight: weights[key] / total });

  return {
    small: norm('small'),
    medium: norm('medium'),
    large: norm('large'),
    all_in: norm('all_in')
  };
}

module.exports = {
  weightRaiseSizing
}; 