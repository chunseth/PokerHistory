/**
 * Step 15a: Calculate EV if Opponent Calls
 * ---------------------------------------
 * Computes the expected value of the hero's bet/raise in the branch where the
 * villain calls.  Uses:
 *   • hero's equity versus the villain's calling range (Step 12)
 *   • pot size before the bet
 *   • bet size (chips the hero puts in right now)
 *   • optional rake information
 *
 * Simplified formula (villain covers the bet):
 *   potAfter   = potBefore + 2 × betSize
 *   grossWin   = equity × potAfter          (amount hero scoops when he wins)
 *   EV_call    = grossWin − betSize         (hero risked betSize now)
 *   rake       = equity × rakeOnPot(potAfter)  (rake is only paid when hero wins)
 *   finalEV    = EV_call − rake
 *
 * Assumptions:
 *   • No additional betting on later streets (handled elsewhere).
 *   • Villain's stack covers the call.  Short-stack edge cases can extend this.
 */

function _computeRake(pot, rakePercent, rakeCap) {
  if (rakePercent <= 0) return 0;
  const raw = pot * rakePercent;
  return rakeCap != null ? Math.min(raw, rakeCap) : raw;
}

function calculateEVIfOpponentCalls({
  potBeforeAction = 0,
  betSize = 0,
  equity = 0.5,
  rakePercent = 0,
  rakeCap = null
} = {}) {
  if (betSize <= 0) {
    // No extra chips invested ⇒ EV is simply equity × potBefore
    const rake = equity * _computeRake(potBeforeAction, rakePercent, rakeCap);
    return {
      ev: Number((equity * potBeforeAction - rake).toFixed(2)),
      details: {
        potBeforeAction,
        betSize,
        potAfter: potBeforeAction,
        equity,
        rakeCharged: Number(rake.toFixed(2))
      }
    };
  }

  const potAfter = potBeforeAction + 2 * betSize;
  const grossWin = equity * potAfter;
  const rakeOnPot = _computeRake(potAfter, rakePercent, rakeCap);
  const rakePaidIfWin = equity * rakeOnPot;
  const ev = grossWin - betSize - rakePaidIfWin;

  return {
    ev: Number(ev.toFixed(2)),
    details: {
      potBeforeAction,
      betSize,
      potAfter,
      equity,
      grossWin: Number(grossWin.toFixed(2)),
      rakePercent,
      rakeCap,
      rakeCharged: Number(rakePaidIfWin.toFixed(2))
    }
  };
}

module.exports = {
  calculateEVIfOpponentCalls
}; 