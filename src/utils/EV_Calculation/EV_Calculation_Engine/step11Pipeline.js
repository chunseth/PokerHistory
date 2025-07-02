/*
 * Step 11 Pipeline – Orchestrator
 * -------------------------------------------------------------
 * Bundles together the core sub-steps needed to derive opponent response
 * probabilities and ranges for a single hero betting action.  The pipeline is
 * intentionally lightweight to get usable data into the database quickly – we
 * can always enrich it by wiring up more sub-steps later.
 *
 * Execution flow:
 *   1. calculateWeightedResponseProbabilities  (Step 11o1)
 *   2. validateResponseFrequencies             (Step 11p)
 *   3. finalizeResponseModel                   (Step 11u)
 *
 * For now we feed mostly default / placeholder objects into 11o1.  As we
 * implement earlier sub-steps (11a-11n) we can pass their outputs through the
 * `context` parameter.
 */

const { calculateWeightedResponseProbabilities } = require('../Step11/step11o1');
const { validateResponseFrequencies } = require('../Step11/step11p');
const { finalizeResponseModel } = require('../Step11/step11u');

/**
 * Runs Step-11 for one hero action and returns a ready-to-store response model.
 *
 * @param {Object}   params
 * @param {Object}   params.hand        – Full hand document (Mongoose plain obj)
 * @param {number}   params.actionIndex – Index of the hero action in bettingActions
 * @param {string}   params.opponentId  – (Optional) Villain playerId to model. If
 *                                        omitted, we model an "average" single
 *                                        opponent.
 * @param {Object}   params.context     – (Optional) Pre-computed outputs from
 *                                        earlier Step-11 sub-steps so callers
 *                                        can skip re-computation.
 * @returns {Object} Response model as produced by Step 11u
 */
function runStep11Pipeline({ hand, actionIndex, opponentId = null, context = {} }) {
  if (!hand || !Array.isArray(hand.bettingActions) || actionIndex < 0 || actionIndex >= hand.bettingActions.length) {
    throw new Error('Invalid hand or actionIndex supplied to runStep11Pipeline');
  }

  const actions = hand.bettingActions;

  // Pull pieces from context if provided – otherwise fall back to empty objs.
  const playerAction       = context.playerAction       || {};
  const potOdds            = context.potOdds            || {};
  const rangeStrength      = context.rangeStrength      || {};
  const streetPatterns     = context.streetPatterns     || {};
  const baseFrequencies    = context.baseFrequencies    || {};
  const rangeAdjustments   = context.rangeAdjustments   || {};
  const positionAdjustments = context.positionAdjustments || {};
  const stackAdjustments   = context.stackAdjustments   || {};
  const multiwayAdjustments = context.multiwayAdjustments || {};
  const callAnalysis       = context.callAnalysis       || {};
  const raiseAnalysis      = context.raiseAnalysis      || {};
  const betSizingAdjustments = context.betSizingAdjustments || {};
  const actionPatternAdjustments = context.actionPatternAdjustments || {};
  const boardTextureAdjustments  = context.boardTextureAdjustments  || {};

  // --- Step 11o1 -----------------------------------------------------------
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

  // --- Step 11p ------------------------------------------------------------
  const validated = validateResponseFrequencies(weighted);

  // --- Step 11r (optional range calc) --------------------------------------
  // Not wired yet – placeholder so structure matches expected final model
  const ranges = validated.ranges || { foldRange: [], callRange: [], raiseRange: [] };

  // --- Step 11u ------------------------------------------------------------
  const responseModel = finalizeResponseModel({
    validatedFreq: validated,
    ranges,
    assumptions: ['Minimal pipeline – some sub-steps not yet implemented']
  });

  return responseModel;
}

module.exports = {
  runStep11Pipeline
}; 