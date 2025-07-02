/*
 * Step-11 Orchestrator (rev-2) – now includes Street-Specific Response Patterns (11d)
 * -----------------------------------------------------------------------------
 * Generates the opponent response model for a single hero action by sequentially
 * invoking the relevant sub-steps.
 */

const { determinePlayerActionType } = require('./step11a');
const { calculatePotOddsForOpponent } = require('./step11b');
const { calculateOpponentRangeStrength } = require('./step11c');
const { determineStreetSpecificResponsePatterns } = require('./Step11d');
const { calculateWeightedResponseProbabilities } = require('./step11o1');
const { validateResponseFrequencies } = require('./step11p');
const { finalizeResponseModel } = require('./step11u');
const { calculateBaseFoldFrequency } = require('./step11e');
const { adjustForOpponentRangeStrength } = require('./step11f');
const { adjustForPosition } = require('./step11g');
const { adjustForStackDepth } = require('./step11h');
const { adjustForMultiwayVsHeadsUp } = require('./step11i');
const { calculateCallFrequency } = require('./step11j');
const { calculateRaiseFrequency } = require('./step11k');
const { adjustRaiseFrequencyForBetSizing } = require('./step11l');
const { adjustRaiseFrequencyForPreviousActions } = require('./step11m');
const { adjustForBoardTexture } = require('./step11n');
const { storeResponseFrequenciesToHeroActions } = require('./step11q');
const { calculateNashEquilibriumGTOResponses } = require('./step11o');
const { storeGTOFrequenciesToHeroActions } = require('./step11q');
const { calculateResponseRanges, storeResponseRangesToHeroActions } = require('./step11r');
const { buildRaiseSizingCatalogue } = require('./step11s');
const { weightRaiseSizing } = require('./step11t');

/**
 * Run the full Step-11 pipeline for a single hero betting action.
 *
 * @param {Object}   hand        – Plain JS object (Mongoose document.toObject())
 * @param {number}   actionIndex – Index of the hero action inside hand.bettingActions
 * @param {string}   opponentId  – Villain playerId (default: first non-hero in hand)
 * @returns {Object} responseModel suitable for storage in heroActions[index].responseFrequencies
 */
async function runStep11Pipeline(hand, actionIndex, opponentId = null) {
  if (!hand || !Array.isArray(hand.bettingActions)) {
    throw new Error('Hand with bettingActions array required');
  }
  const action = hand.bettingActions[actionIndex];
  if (!action) throw new Error('Invalid actionIndex');

  const actions = hand.bettingActions;
  const heroId = action.playerId;

  // Fallback villain: pick first opponent still active on this street
  if (!opponentId) {
    const opp = actions.find(a => a.playerId !== heroId && a.street === action.street);
    opponentId = opp ? opp.playerId : 'villain';
  }

  // --- 11a ---------------------------------------------------------------
  const playerAction = determinePlayerActionType(action, hand, actions, actionIndex);

  // --- 11b ---------------------------------------------------------------
  const potOdds = calculatePotOddsForOpponent(playerAction, hand, actions, actionIndex, opponentId);

  // --- 11c ---------------------------------------------------------------
  const rangeStrength = calculateOpponentRangeStrength(hand, actions, opponentId, actionIndex, playerAction, potOdds);

  // --- 11d ---------------------------------------------------------------
  const streetPatterns = determineStreetSpecificResponsePatterns(playerAction, potOdds, rangeStrength);

  // --- 11e ---------------------------------------------------------------
  const baseFold = calculateBaseFoldFrequency(playerAction, potOdds, rangeStrength, streetPatterns);
  const baseFrequencies = {
    fold: baseFold.finalFoldFrequency || baseFold.baseFoldFrequency || 0.6,
    raise: 0.1,
    call: 0.3
  };

  // --- 11f ---------------------------------------------------------------
  const rangeAdjustments = adjustForOpponentRangeStrength(rangeStrength, playerAction, potOdds, baseFrequencies.fold);

  // --- 11g ---------------------------------------------------------------
  const positionAdjustments = adjustForPosition(playerAction, hand, opponentId, rangeAdjustments);

  // --- 11h ---------------------------------------------------------------
  const stackAdjustments = adjustForStackDepth(potOdds, playerAction, hand, actions, actionIndex, opponentId, positionAdjustments);

  // --- 11i ---------------------------------------------------------------
  const multiwayAdjustments = adjustForMultiwayVsHeadsUp(hand, actions, actionIndex, playerAction, stackAdjustments);

  // --- 11j ---------------------------------------------------------------
  const callAnalysis = calculateCallFrequency(
    potOdds,
    stackAdjustments,
    multiwayAdjustments,
    positionAdjustments,
    playerAction,
    hand,
    actions,
    actionIndex,
    opponentId
  );

  // --- 11k ---------------------------------------------------------------
  const raiseAnalysis = calculateRaiseFrequency(
    potOdds,
    callAnalysis,
    playerAction,
    hand,
    actions,
    actionIndex,
    opponentId
  );

  // --- 11l ---------------------------------------------------------------
  const betInfo = {
    betSize: playerAction.betSize,
    potSize: playerAction.potSize,
    isAllIn: playerAction.isAllIn,
    betSizing: playerAction.betSizing
  };
  const betSizingAdjustments = adjustRaiseFrequencyForBetSizing(betInfo, raiseAnalysis.overallRaiseFrequency, rangeStrength);

  // --- 11m ---------------------------------------------------------------
  const actionPatternAdjustments = adjustRaiseFrequencyForPreviousActions(
    hand,
    actionIndex,
    opponentId,
    raiseAnalysis.overallRaiseFrequency,
    playerAction,
    potOdds
  );

  // --- 11n ---------------------------------------------------------------
  const boardTextureAdjustments = adjustForBoardTexture(hand, actions, actionIndex, opponentId, playerAction, potOdds);

  // --- 11o1 – weighted probabilities ------------------------------------
  const weighted = calculateWeightedResponseProbabilities(
    hand,
    actions,
    actionIndex,
    opponentId,
    playerAction,
    potOdds,
    rangeStrength,
    streetPatterns,
    baseFrequencies,
    rangeAdjustments,
    positionAdjustments,
    stackAdjustments,
    multiwayAdjustments,
    callAnalysis,
    raiseAnalysis,
    betSizingAdjustments,
    actionPatternAdjustments,
    boardTextureAdjustments
  );

  // --- 11p – validation --------------------------------------------------
  const validated = validateResponseFrequencies(weighted);

  // --- 11o – GTO equilibrium comparison ---------------------------------
  const gtoResult = calculateNashEquilibriumGTOResponses(
    hand,
    actions,
    actionIndex,
    opponentId,
    weighted,
    potOdds,
    playerAction,
    boardTextureAdjustments,
    positionAdjustments,
    stackAdjustments
  );

  // --- 11r – villain response ranges ------------------------------------
  const responseRanges = calculateResponseRanges({
    hand,
    actions,
    actionIndex,
    opponentId,
    weighted
  });

  // --- 11s – raise sizing catalogue ------------------------------------
  const potBefore = hand.getPotSizeBeforeActionIndex ? hand.getPotSizeBeforeActionIndex(actionIndex) : 0;
  const stacksBefore = hand.getPlayerStacksBeforeActionIndex ? hand.getPlayerStacksBeforeActionIndex(actionIndex) : {};
  let opponentStack = stacksBefore[opponentId] ?? Infinity;
  // Convert to big blinds if stack is stored in chips
  const bigBlind = hand.blindLevel?.bigBlind || 1;
  if (bigBlind && opponentStack > 1000) {
    opponentStack = opponentStack / bigBlind;
  }

  const raiseSizingCatalogue = buildRaiseSizingCatalogue({
    hand,
    actionIndex,
    playerAction,
    potBefore,
    betSize: playerAction.betSize || action.amount || 0,
    opponentStack
  });

  const weightedRaiseSizing = weightRaiseSizing({
    catalogue: raiseSizingCatalogue,
    potSize: potBefore + (playerAction.betSize || 0),
    opponentStack
  });

  // --- 11u – final model -------------------------------------------------
  const responseModel = finalizeResponseModel({
    validatedFreq: validated,
    ranges: responseRanges,
    raiseSizingInfo: { catalogue: raiseSizingCatalogue, weighted: weightedRaiseSizing },
    gtoComparison: gtoResult,
    assumptions: streetPatterns.explanation ? [streetPatterns.explanation] : []
  });

  // --- 11q – persistence into heroActions -------------------------------
  try {
    if (hand && hand._id && Array.isArray(hand.heroActions)) {
      // Map bettingAction index to heroActions index via shared actionId
      const actionId = action.actionId || `${hand.id}-${actionIndex}`;
      const heroActionIndex = hand.heroActions.findIndex(h => h.actionId === actionId);
      if (heroActionIndex !== -1) {
        await storeResponseFrequenciesToHeroActions(hand._id, heroActionIndex, validated);
        await storeGTOFrequenciesToHeroActions(hand._id, heroActionIndex, gtoResult);
        await storeResponseRangesToHeroActions(hand._id, heroActionIndex, responseRanges);
      }
    }
  } catch (err) {
    // Non-fatal – log and continue
    console.error('Step11Pipeline persistence error:', err.message);
  }

  return responseModel;
}

module.exports = {
  runStep11Pipeline
}; 