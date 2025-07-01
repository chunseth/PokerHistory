/**
 * Step 22a: Store the EV Calculation Results
 * ------------------------------------------
 * Persists EV analysis back into the hand document in MongoDB.
 * This helper is meant to be run on the server side where Mongoose models
 * are available (server/models/Hand.js).
 *
 * It adds an `evAnalysis` sub-document to the specified betting action:
 *   hand.bettingActions[actionIndex].evAnalysis = { ...analysis }
 *
 * @param {Object}   HandModel     – Mongoose model (imported by caller)
 * @param {String}   handId        – _id of the hand document
 * @param {Number}   actionIndex   – index into bettingActions array
 * @param {Object}   analysis      – { totalEV, branchEVs:{...}, bestAlt:{...}, classification:'+EV', ... }
 * @returns {Promise<Object>}      – the updated hand document
 */

async function storeEVResult(HandModel, handId, actionIndex, analysis = {}) {
  if (!HandModel || !handId || actionIndex === undefined) {
    throw new Error('HandModel, handId and actionIndex are required');
  }

  // Build the update path dynamically
  const path = `bettingActions.${actionIndex}.evAnalysis`;

  await HandModel.updateOne({ _id: handId }, { $set: { [path]: analysis } }).exec();
  return HandModel.findById(handId).exec();
}

module.exports = { storeEVResult }; 