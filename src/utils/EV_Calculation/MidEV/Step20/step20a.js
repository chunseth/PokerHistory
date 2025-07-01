/**
 * Step 20a: Determine the Highest-EV Action
 * ----------------------------------------
 * Utility wrapper around Step 19's compareActions. It simply returns the
 * best-EV candidate (and any ties) from a list of actions.
 *
 * Input:  [{ label, ev, meta? }, …]
 * Output: {
 *   best:   { label, ev, meta },       // first highest
 *   ties:   [ { label, ev, meta }, …]  // other actions sharing best.ev
 * }
 */

function determineHighestEVAction(candidates = []) {
  if (!Array.isArray(candidates) || candidates.length === 0) return { best: null, ties: [] };

  let best = candidates[0];
  for (const c of candidates) {
    if ((c.ev ?? -Infinity) > (best.ev ?? -Infinity)) best = c;
  }

  const ties = candidates.filter(c => c !== best && c.ev === best.ev);
  return { best, ties };
}

module.exports = { determineHighestEVAction }; 