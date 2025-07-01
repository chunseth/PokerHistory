import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Hand from '../models/Hand.js';

// Import hero & opponent range utilities (CommonJS modules)
import heroRangeModule from '../../src/utils/EV_Calculation/heroRange.js';
import opponentRangeModule from '../../src/utils/EV_Calculation/opponentRange.js';
import finalizeModule from '../../src/utils/EV_Calculation/Step11/step11u.js';
const { finalizeResponseModel } = finalizeModule;

const { getHeroRangeAtActionIndex } = heroRangeModule;
const { getOpponentRangeAtActionIndex, getDeadCards } = opponentRangeModule;

dotenv.config();

async function runStep11(username) {
  if (!username) throw new Error('Username is required');

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/poker-history');

  const hands = await Hand.find({ username }).exec();
  console.log(`Step-11 pipeline: processing ${hands.length} hands for ${username}`);

  let totalHeroActions = 0;

  for (const hand of hands) {
    const actions = hand.bettingActions;

    for (let idx = 0; idx < hand.heroActions.length; idx++) {
      const heroAction = hand.heroActions[idx];

      // Skip if Step-11 already populated
      if (heroAction.responseModel) continue;

      // 1) Hero range at this action
      const heroRange = getHeroRangeAtActionIndex(
        hand,
        actions,
        username,
        actions.findIndex(a => a.timestamp === heroAction.timestamp && a.playerId === username)
      );

      // 2) Identify primary opponent at this action (simple heuristic: last action before hero or first caller)
      const previousActions = actions.slice(0, actions.findIndex(a => a.timestamp === heroAction.timestamp && a.playerId === username));
      const lastVillainAction = [...previousActions].reverse().find(a => a.playerId !== username);
      const villainId = lastVillainAction ? lastVillainAction.playerId : actions.find(a => a.playerId !== username)?.playerId;

      let villainRange = [];
      if (villainId) {
        const actionIndex = actions.indexOf(lastVillainAction);
        const knownCards = getDeadCards(hand, heroAction);
        villainRange = getOpponentRangeAtActionIndex(hand, actions, villainId, actionIndex, knownCards);
      }

      // 3) Placeholder frequencies (to be refined by full Step-11 sub-steps)
      const baseFreq = { fold: 0.6, call: 0.3, raise: 0.1 };
      const responseModel = finalizeResponseModel({ validatedFreq: { adjustedFrequencies: baseFreq }, ranges: { foldRange: [], callRange: villainRange, raiseRange: villainRange } });

      // 4) Persist to heroActions subdocument (use $set with positional filter)
      await Hand.updateOne(
        { _id: hand._id, 'heroActions.actionId': heroAction.actionId },
        {
          $set: {
            'heroActions.$.heroRange': heroRange,
            'heroActions.$.villainRange': villainRange,
            'heroActions.$.responseFrequencies': responseModel.frequencies,
            'heroActions.$.totalEV': null, // to be filled later
            'heroActions.$.EVClassification': null
          }
        },
        { runValidators: false }
      );

      totalHeroActions++;
    }
  }

  console.log(`Step-11 pipeline complete. Processed ${totalHeroActions} hero actions.`);
  await mongoose.disconnect();
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const user = process.argv[2];
  runStep11(user).catch(err => {
    console.error(err);
    mongoose.disconnect();
  });
} 