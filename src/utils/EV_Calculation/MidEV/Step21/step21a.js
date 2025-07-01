/**
 * Step 21a: Classify the Player's Action as +EV or -EV
 * ----------------------------------------------------
 * Uses the `compareActions` output from Step 19 to label the hero's choice
 * relative to the highest-EV alternative.
 *
 * Interface
 *   classifyAction({ heroEV, bestEV, threshold = 0.0 })
 *     – threshold (bb) allows a tolerance before calling an action -EV.
 *       e.g. if threshold = 0.1 and delta = -0.05, treat as neutral / +EV.
 *
 * Output
 *   {
 *     classification: '+EV' | '-EV',
 *     delta: bestEV - heroEV
 *   }
 */

function classifyAction({ heroEV = 0, bestEV = 0, threshold = 0 } = {}) {
  const delta = Number((bestEV - heroEV).toFixed(3));
  const classification = delta > threshold ? '-EV' : '+EV';
  return { classification, delta };
}

module.exports = { classifyAction }; 