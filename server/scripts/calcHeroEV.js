#!/usr/bin/env node

/**
 * Calculate EV for every street action the hero takes across all imported
 * hands for a given username.
 *
 * Usage:
 *   node server/scripts/calcHeroEV.js <username>
 *
 * NOTE: This script assumes the hand histories have already been parsed and
 *       inserted into MongoDB (via ImportHandsPage upload). It will iterate
 *       through every betting action taken by <username>, use the MidEV
 *       pipeline (Steps 14-21) to compute per-branch EVs, weight them by the
 *       stored response frequencies on the action (fallback defaults), and
 *       write the result back into hand.bettingActions[actionIndex].evAnalysis.
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Hand from '../models/Hand.js';

// MidEV helpers
import { calculateEVIfOpponentFolds } from '../../src/utils/EV_Calculation/MidEV/Step14/step14a.js';
import { calculateEVIfOpponentCalls } from '../../src/utils/EV_Calculation/MidEV/Step15/step15a.js';
import { calculateEVIfOpponentRaises } from '../../src/utils/EV_Calculation/MidEV/Step16/step16a.js';
import { weightOutcomeEVs } from '../../src/utils/EV_Calculation/MidEV/Step17/step17a.js';
import { compareActions } from '../../src/utils/EV_Calculation/MidEV/Step19/step19a.js';
import { determineHighestEVAction } from '../../src/utils/EV_Calculation/MidEV/Step20/step20a.js';
import { classifyAction } from '../../src/utils/EV_Calculation/MidEV/Step21/step21a.js';
import { storeEVResult } from '../../src/utils/EV_Calculation/MidEV/Step22/step22a.js';

// Basic helper – naive pot size before action by summing previous amounts
function getPotSizeBeforeAction(hand, actionIndex) {
  let pot = 0;
  for (let i = 0; i < actionIndex; i++) {
    const a = hand.bettingActions[i];
    if (['bet', 'raise', 'call', 'post'].includes(a.action)) {
      pot += a.amount || 0;
    }
  }
  return pot;
}

dotenv.config();

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error('Usage: node server/scripts/calcHeroEV.js <username>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/poker-history');

  const hands = await Hand.find({ username }).exec();
  console.log(`Processing ${hands.length} hands for ${username}...`);

  for (const hand of hands) {
    for (let i = 0; i < hand.bettingActions.length; i++) {
      const action = hand.bettingActions[i];
      if (action.playerId !== username) continue; // hero only

      const potBefore = getPotSizeBeforeAction(hand, i);
      const betSize = action.amount || 0;

      // Default response frequencies if none stored
      const probs = action.responseFrequencies?.fold !== undefined ? {
        fold: action.responseFrequencies.fold ?? 0.6,
        call: action.responseFrequencies.call ?? 0.3,
        raise: action.responseFrequencies.raise ?? 0.1
      } : { fold: 0.6, call: 0.3, raise: 0.1 };

      // --- Branch EVs ------------------------------------------------------
      const evFoldObj = calculateEVIfOpponentFolds({ potBeforeAction: potBefore });
      const evCallObj = calculateEVIfOpponentCalls({ potBeforeAction: potBefore, betSize, equity: 0.5 }); // placeholder equity
      const evRaiseObj = calculateEVIfOpponentRaises({ potBeforeAction: potBefore, heroBetSize: betSize, villainRaiseSize: betSize * 2, heroEquity: 0.45 });

      const weighted = weightOutcomeEVs({
        evFold: evFoldObj.ev,
        evCall: evCallObj.ev,
        evRaise: evRaiseObj.ev,
        probabilities: probs
      });

      // For alternative actions we'd need more sizes; for now compare hero only
      const comparison = compareActions({ actualIndex: 0, candidates: [ { label: 'actual', ev: weighted.totalEV } ] });
      const highest = determineHighestEVAction(comparison.sorted);
      const classification = classifyAction({ heroEV: weighted.totalEV, bestEV: highest.best.ev, threshold: 0.05 });

      const analysis = {
        branchEVs: { fold: evFoldObj.ev, call: evCallObj.ev, raise: evRaiseObj.ev },
        probabilities: probs,
        totalEV: weighted.totalEV,
        classification: classification.classification,
        delta: classification.delta
      };

      await storeEVResult(Hand, hand._id, i, analysis);
    }
  }

  console.log('EV calculation complete.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  mongoose.disconnect();
}); 