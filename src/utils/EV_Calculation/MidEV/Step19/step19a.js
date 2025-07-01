/**
 * Step 19a: Compare to Alternative Actions
 * ----------------------------------------
 * Accepts a list of candidate lines (the hero's actual action plus any
 * alternatives) each with a pre-computed total EV (from Step 17 / 18).
 * Returns them sorted by EV, together with the best action and the EV gap
 * between the player's actual choice and that optimum.
 *
 * Interface
 *   compareActions({
 *     actualIndex: <number>,            // index of hero's chosen action in `candidates`
 *     candidates: [
 *       { label:'bet 2/3 pot', ev:1.25, meta:{...} },
 *       { label:'check',       ev:1.40, meta:{...} },
 *       { label:'all-in',      ev:0.95, meta:{...} }
 *     ]
 *   })
 *
 * Output
 *   {
 *     sorted: [ ...candidates sorted desc by ev ],
 *     best: { label, ev, meta },
 *     hero: { label, ev, meta },
 *     delta: best.ev − hero.ev   // positive if hero missed EV
 *   }
 */

function compareActions({ actualIndex = 0, candidates = [] } = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { sorted: [], best: null, hero: null, delta: 0 };
  }

  // Defensive copy & sorting by EV descending
  const sorted = [...candidates].sort((a, b) => (b.ev ?? 0) - (a.ev ?? 0));

  const best = sorted[0];
  const hero = candidates[actualIndex] ?? null;
  const delta = hero && best ? Number((best.ev - hero.ev).toFixed(3)) : 0;

  return { sorted, best, hero, delta };
}

module.exports = {
  compareActions
}; 