/**
 * Step 16a: Calculate EV if Opponent Raises
 * ----------------------------------------
 * In this branch the villain responds to the hero's initial bet/raise by
 * re-raising.  The hero now has two realistic choices:
 *   1. Fold – surrendering the chips already invested in the pot.
 *   2. Call – continuing to the next street (or the river) and realising
 *      equity against the villain's *raising* range (Step 13).
 *
 * This helper calculates the EV for each option and returns the maximum of
 * the two, assuming the hero will choose the higher-EV response.
 *
 * Formulae
 *   EV_fold  = −heroBetSize
 *
 *   For a CALL:
 *     callCost      = villainRaiseSize          // additional chips to match
 *     potAfterCall  = potBeforeAction + heroBetSize + villainRaiseSize + callCost
 *     grossWin      = heroEquity × potAfterCall
 *     rake          = heroEquity × rakeFn(potAfterCall)
 *     EV_call       = grossWin − callCost − rake
 */

const { calculateEVIfOpponentCalls } = require('../Step15/step15a');

function _computeRake(pot, rakePercent, rakeCap) {
  if (rakePercent <= 0) return 0;
  const raw = pot * rakePercent;
  return rakeCap != null ? Math.min(raw, rakeCap) : raw;
}

function calculateEVIfOpponentRaises({
  potBeforeAction = 0,
  heroBetSize = 0,
  villainRaiseSize = 0,
  heroEquity = 0.5, // equity vs raising range (Step 13)
  rakePercent = 0,
  rakeCap = null
} = {}) {
  // EDGE: if villainRaiseSize <= 0 treat as no raise (shouldn't happen)
  if (villainRaiseSize <= 0) {
    // Fallback to opponent calls semantics (Step 15)
    return calculateEVIfOpponentCalls({
      potBeforeAction,
      betSize: heroBetSize,
      equity: heroEquity,
      rakePercent,
      rakeCap
    });
  }

  // Option 1 – Hero folds ---------------------------------------------------
  const evFold = -heroBetSize;

  // Option 2 – Hero calls ---------------------------------------------------
  const callCost = villainRaiseSize;
  const potAfterCall = potBeforeAction + heroBetSize + villainRaiseSize + callCost;
  const grossWin = heroEquity * potAfterCall;
  const rake = heroEquity * _computeRake(potAfterCall, rakePercent, rakeCap);
  const evCall = grossWin - callCost - rake;

  const bestEV = Math.max(evFold, evCall);
  const heroChoice = bestEV === evFold ? 'fold' : 'call';

  return {
    ev: Number(bestEV.toFixed(2)),
    details: {
      potBeforeAction,
      heroBetSize,
      villainRaiseSize,
      heroEquity,
      callCost,
      potAfterCall: Number(potAfterCall.toFixed(2)),
      evFold: Number(evFold.toFixed(2)),
      evCall: Number(evCall.toFixed(2)),
      heroChoice,
      rakePercent,
      rakeCap,
      rakeCharged: Number(rake.toFixed(2))
    }
  };
}

module.exports = {
  calculateEVIfOpponentRaises
}; 