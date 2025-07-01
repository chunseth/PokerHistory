/**
 * Step 13a: Estimate hero equity versus the villain's *raising* range.
 * ------------------------------------------------------------------
 * This is a thin wrapper around the generic equity-vs-range estimator
 * implemented in Step 12.  It keeps the folder structure aligned with
 * the 25-step outline so other modules can `require()` explicit steps.
 */

const path = require('path');
const { estimateEquityVsCallingRange } = require(path.join('..', 'Step12', 'step12a'));

/**
 * Estimate equity versus the villain's raising range.
 *
 * @param {Object} params
 * @param {string[]} params.board – community cards revealed so far
 * @param {{ combo:[string,string], weight:number }[]} params.heroRange
 * @param {{ combo:[string,string], weight:number }[]} params.raiseRange
 * @param {number} [params.samples=1000]
 * @returns {{ equity:number, details:Object }}
 */
function estimateEquityVsRaisingRange({ board = [], heroRange = [], raiseRange = [], samples = 1000 } = {}) {
  // Simply delegate to the Step 12 helper, passing raiseRange in place of callRange.
  return estimateEquityVsCallingRange({ board, heroRange, callRange: raiseRange, samples });
}

module.exports = {
  estimateEquityVsRaisingRange
}; 