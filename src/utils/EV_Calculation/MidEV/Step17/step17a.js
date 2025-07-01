/**
 * Step 17a: Weight Each Outcome by Probability
 * --------------------------------------------
 * Consumes the per-branch EVs (Steps 14–16) and the opponent-response
 * probabilities generated in Step 11u (or any other source).  Returns the
 * weighted contribution of each branch plus a total.
 *
 * Interface
 *   inputs = {
 *     evFold:  <number>,   // EV from villain folding (Step 14)
 *     evCall:  <number>,   // EV from villain calling  (Step 15)
 *     evRaise: <number>,   // EV from villain raising  (Step 16)
 *     probabilities: {
 *       fold: <number>,    // 0-1, should sum to 1 with call+raise
 *       call: <number>,
 *       raise:<number>
 *     }
 *   }
 *
 * Output
 *   {
 *     weighted: { fold:number, call:number, raise:number },
 *     totalEV: number,
 *     sanity: { probSum:number, evInputs:{...} }
 *   }
 */

function weightOutcomeEVs({
  evFold = 0,
  evCall = 0,
  evRaise = 0,
  probabilities = { fold: 0.6, call: 0.3, raise: 0.1 }
} = {}) {
  const { fold = 0, call = 0, raise = 0 } = probabilities;

  // Normalise probabilities if they don't sum to 1
  const probSum = fold + call + raise;
  let f = fold, c = call, r = raise;
  if (probSum > 0 && probSum !== 1) {
    f = fold / probSum;
    c = call / probSum;
    r = raise / probSum;
  }

  const weighted = {
    fold: Number((evFold * f).toFixed(3)),
    call: Number((evCall * c).toFixed(3)),
    raise: Number((evRaise * r).toFixed(3))
  };

  const totalEV = Number((weighted.fold + weighted.call + weighted.raise).toFixed(3));

  return {
    weighted,
    totalEV,
    sanity: {
      probSum: Number((f + c + r).toFixed(3)),
      evInputs: { evFold, evCall, evRaise },
      probabilities: { fold: f, call: c, raise: r }
    }
  };
}

module.exports = {
  weightOutcomeEVs
}; 