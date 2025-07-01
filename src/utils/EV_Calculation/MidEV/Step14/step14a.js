/**
 * Step 14a: Calculate EV if Opponent Folds
 * ----------------------------------------
 * The net profit when the villain folds immediately after our action is
 * simply the pot size that existed before we put any *additional* chips
 * into the middle.  That value (`potBeforeAction`) represents chips we
 * did **not** have at risk prior to making the bet/raise, and it is the
 * amount we win uncontested.
 *
 * Formula (ignoring rake):
 *   EV_fold = potBeforeAction
 *
 * Inputs
 *   - potBeforeAction : number – the pot size **before** the hero's
 *                       aggressive action (bet or raise).  Must be ≥ 0.
 *   - rakePercent     : optional decimal, e.g. 0.05 for 5% rake (default 0).
 *   - rakeCap         : optional hard cap on the rake charged.
 *
 * Output
 *   { ev: number, details: { potBeforeAction, rakeCharged } }
 */

function calculateEVIfOpponentFolds({ potBeforeAction = 0, rakePercent = 0, rakeCap = null } = {}) {
  if (potBeforeAction <= 0) {
    return { ev: 0, details: { reason: 'No pot or invalid input' } };
  }

  // Compute rake if any.
  let rakeCharged = 0;
  if (rakePercent > 0) {
    rakeCharged = potBeforeAction * rakePercent;
    if (rakeCap !== null) rakeCharged = Math.min(rakeCharged, rakeCap);
  }

  const ev = potBeforeAction - rakeCharged;
  return {
    ev: Number(ev.toFixed(2)),
    details: {
      potBeforeAction,
      rakePercent,
      rakeCap,
      rakeCharged: Number(rakeCharged.toFixed(2))
    }
  };
}

module.exports = {
  calculateEVIfOpponentFolds
}; 