// Step 11r: Calculate Response Ranges
// This module calculates the specific hands that would fold, call, or raise to a given action.

const { 
    getOpponentRangeAtActionIndex, 
    getHandStrengthCategory, 
    getDrawTypes 
} = require('../opponentRange.js');
const mongoose = require('mongoose');
const Hand = mongoose.models.Hand || mongoose.model('Hand');

// --- Utility: map a 2-card combo to canonical key (AA, AKs, AKo, etc.) ---
const RANK_ORDER = 'AKQJT98765432';
function canonicalKey(cards) {
  if (!Array.isArray(cards) || cards.length !== 2) return '';
  const [c1, c2] = cards;
  const r1 = c1[0], r2 = c2[0];
  // Pocket pair
  if (r1 === r2) return r1 + r2;
  // Sort ranks high→low for deterministic order
  const first = RANK_ORDER.indexOf(r1) <= RANK_ORDER.indexOf(r2) ? r1 : r2;
  const second = first === r1 ? r2 : r1;
  const suited = c1[1] === c2[1] ? 's' : 'o';
  return first + second + suited;
}

/**
 * Step 11r: Calculate Villain Response Ranges
 * --------------------------------------------------
 *   Given the weighted response probabilities (11o1) and any available range
 *   information from previous sub-steps, split the villain's overall range
 *   into the combos they will fold, call, and raise with.
 *
 *   This is a placeholder implementation – once detailed range-evaluation
 *   logic is available we can replace the naive splits below.
 *
 * @param {Object}   params
 * @param {Object}   params.hand           – Full hand object (plain JS)
 * @param {Array}    params.actions        – hand.bettingActions array
 * @param {number}   params.actionIndex    – Index of current hero action
 * @param {string}   params.opponentId     – PlayerId of the villain
 * @param {Object}   params.weighted       – Output of 11o1 (probabilities & ranges)
 * @returns {Object} { foldRange, callRange, raiseRange }
 */
function calculateResponseRanges({ hand, actions, actionIndex, opponentId, weighted }) {
  if (!hand || !actions || actionIndex === undefined) {
    return { foldRange: [], callRange: [], raiseRange: [] };
  }

  try {
    // 1. Reconstruct villain range up to this point
    const opponentRange = getOpponentRangeAtActionIndex(
      hand,
      actions,
      opponentId,
      actionIndex
    );

    // 2. Determine response frequencies to hit
    const frequencies = weighted?.probabilities || weighted?.adjustedFrequencies || {
      fold: 0.6,
      call: 0.3,
      raise: 0.1
    };

    // 3. Evaluate ranges by strength categories
    const board = hand.board || [];
    const actionAnalysis = {};
    const rangesByStrength = calculateRangesByStrength(
      opponentRange,
      board,
      frequencies,
      actionAnalysis
    );

    // 4. Validate and normalize to ensure frequencies match targets
    const validated = validateAndNormalizeRanges(rangesByStrength, frequencies);

    // 5. Convert to simple string arrays for storage (e.g., 'AhKd')
    const toStringArray = arr => arr.map(c => canonicalKey(c.hand));

    return {
      foldRange: toStringArray(validated.foldingRange || []),
      callRange: toStringArray(validated.callingRange || []),
      raiseRange: toStringArray(validated.raisingRange || [])
    };
  } catch (err) {
    console.error('Step11r calculateResponseRanges error:', err.message);
    return { foldRange: [], callRange: [], raiseRange: [] };
  }
}

/**
 * Persist Step-11r ranges into heroActions array.
 *
 * @param {String|ObjectId} handId – Mongo _id of the Hand.
 * @param {Number} actionIndex     – Index inside heroActions array.
 * @param {Object} ranges         – { foldRange, callRange, raiseRange }
 * @returns {Promise<Object>} Mongo update result.
 */
async function storeResponseRangesToHeroActions(handId, actionIndex, ranges) {
  if (!handId || actionIndex === undefined || !ranges) {
    throw new Error('Invalid params for storeResponseRangesToHeroActions');
  }
  const basePath = `heroActions.${actionIndex}`;
  const update = {
    [`${basePath}.foldRange`]: ranges.foldRange ?? [],
    [`${basePath}.callRange`]: ranges.callRange ?? [],
    [`${basePath}.raiseRange`]: ranges.raiseRange ?? []
  };
  return Hand.updateOne({ _id: handId }, { $set: update });
}

/**
 * Calculate response ranges based on hand strength categories.
 * @param {Array} range - Current opponent range
 * @param {Array} board - Current board cards
 * @param {Object} responseFrequencies - Fold, call, raise probabilities
 * @param {Object} actionAnalysis - Action analysis from step 11a
 * @returns {Object} Ranges for each response type
 */
function calculateRangesByStrength(range, board, responseFrequencies, actionAnalysis) {
    const foldingRange = [];
    const callingRange = [];
    const raisingRange = [];

    // Remove any combos that duplicate cards on the board or duplicate internally
    const isValidCombo = (comboArr, boardArr) => {
        if (!Array.isArray(comboArr) || comboArr.length !== 2) return false;
        const [c1, c2] = comboArr;
        if (c1 === c2) return false; // duplicate hole card
        // Check overlap with board
        if (boardArr && boardArr.some(b => b === c1 || b === c2)) return false;
        return true;
    };

    const filteredRange = range.filter(c => isValidCombo(c.hand, board));

    // Sort range by weight (highest first) for better distribution
    const sortedRange = [...filteredRange].sort((a, b) => b.weight - a.weight);

    // Calculate target counts based on frequencies
    const totalWeight = sortedRange.reduce((sum, combo) => sum + combo.weight, 0);
    const targetFoldWeight = totalWeight * responseFrequencies.fold;
    const targetCallWeight = totalWeight * responseFrequencies.call;
    const targetRaiseWeight = totalWeight * responseFrequencies.raise;

    let currentFoldWeight = 0;
    let currentCallWeight = 0;
    let currentRaiseWeight = 0;

    // Map canonicalKey → { range: 'fold'|'call'|'raise', comboRef }
    const usedKeys = new Map();

    for (const combo of sortedRange) {
        const strength = getHandStrengthCategory(combo.hand, board);
        const draws = getDrawTypes(combo.hand, board);
        const responseType = determineResponseType(
            combo, 
            strength, 
            draws, 
            actionAnalysis, 
            currentFoldWeight, 
            currentCallWeight, 
            currentRaiseWeight,
            targetFoldWeight,
            targetCallWeight,
            targetRaiseWeight
        );

        const comboWithStrength = {
            ...combo,
            strength,
            draws,
            responseType
        };

        const key = canonicalKey(combo.hand);

        if (usedKeys.has(key)) {
            // Already assigned – aggregate weight into the existing combo
            const existing = usedKeys.get(key);
            existing.comboRef.weight += combo.weight;
            if (existing.range === 'fold') currentFoldWeight += combo.weight;
            else if (existing.range === 'call') currentCallWeight += combo.weight;
            else if (existing.range === 'raise') currentRaiseWeight += combo.weight;
            continue;
        }

        // First time this key appears – store normally
        switch (responseType) {
            case 'fold':
                foldingRange.push(comboWithStrength);
                currentFoldWeight += combo.weight;
                usedKeys.set(key, { range: 'fold', comboRef: comboWithStrength });
                break;
            case 'call':
                callingRange.push(comboWithStrength);
                currentCallWeight += combo.weight;
                usedKeys.set(key, { range: 'call', comboRef: comboWithStrength });
                break;
            case 'raise':
                raisingRange.push(comboWithStrength);
                currentRaiseWeight += combo.weight;
                usedKeys.set(key, { range: 'raise', comboRef: comboWithStrength });
                break;
        }
    }

    return {
        foldingRange,
        callingRange,
        raisingRange,
        weightDistribution: {
            fold: currentFoldWeight,
            call: currentCallWeight,
            raise: currentRaiseWeight,
            total: totalWeight
        }
    };
}

/**
 * Determine the response type for a specific combo based on strength and context.
 * @param {Object} combo - Combo object with hand and weight
 * @param {string} strength - Hand strength category
 * @param {Array} draws - Array of draw types
 * @param {Object} actionAnalysis - Action analysis
 * @param {number} currentFoldWeight - Current accumulated fold weight
 * @param {number} currentCallWeight - Current accumulated call weight
 * @param {number} currentRaiseWeight - Current accumulated raise weight
 * @param {number} targetFoldWeight - Target fold weight
 * @param {number} targetCallWeight - Target call weight
 * @param {number} targetRaiseWeight - Target raise weight
 * @returns {string} Response type: 'fold', 'call', or 'raise'
 */
function determineResponseType(
    combo, 
    strength, 
    draws, 
    actionAnalysis, 
    currentFoldWeight, 
    currentCallWeight, 
    currentRaiseWeight,
    targetFoldWeight,
    targetCallWeight,
    targetRaiseWeight
) {
    const { actionType, betSizing, street, isContinuationBet } = actionAnalysis;
    
    // Strong hands are more likely to raise or call
    const strongHands = ['straight_flush', 'quads', 'full_house', 'flush', 'straight', 'set'];
    const mediumHands = ['two_pair', 'overpair', 'top_pair'];
    const weakHands = ['second_pair', 'pair', 'air'];
    
    // Priority system: raise > call > fold
    // Check if we should raise
    if (currentRaiseWeight < targetRaiseWeight) {
        // Strong hands raise more often
        if (strongHands.includes(strength)) {
            if (Math.random() < 0.8) return 'raise'; // 80% of strong hands raise
        }
        // Medium hands with draws can semi-bluff raise
        if (mediumHands.includes(strength) && draws.length > 0) {
            if (Math.random() < 0.4) return 'raise'; // 40% of medium hands with draws raise
        }
        // Some weak hands bluff raise
        if (weakHands.includes(strength) && Math.random() < 0.1) {
            return 'raise'; // 10% of weak hands bluff raise
        }
    }
    
    // Check if we should call
    if (currentCallWeight < targetCallWeight) {
        // Strong hands call if they don't raise
        if (strongHands.includes(strength)) {
            return 'call';
        }
        // Medium hands call more often
        if (mediumHands.includes(strength)) {
            if (Math.random() < 0.7) return 'call'; // 70% of medium hands call
        }
        // Weak hands with draws call for implied odds
        if (weakHands.includes(strength) && draws.length > 0) {
            if (Math.random() < 0.5) return 'call'; // 50% of weak hands with draws call
        }
        // Some weak hands call with good pot odds
        if (weakHands.includes(strength) && Math.random() < 0.2) {
            return 'call'; // 20% of weak hands call
        }
    }
    
    // Default to fold
    return 'fold';
}

/**
 * Validate and normalize the response ranges to match target frequencies.
 * @param {Object} responseRanges - Calculated response ranges
 * @param {Object} responseFrequencies - Target frequencies
 * @returns {Object} Validated and normalized ranges
 */
function validateAndNormalizeRanges(responseRanges, responseFrequencies) {
    const { foldingRange, callingRange, raisingRange, weightDistribution } = responseRanges;
    const { fold, call, raise } = responseFrequencies;
    
    // Calculate actual frequencies
    const totalWeight = weightDistribution.total;
    const actualFoldFreq = weightDistribution.fold / totalWeight;
    const actualCallFreq = weightDistribution.call / totalWeight;
    const actualRaiseFreq = weightDistribution.raise / totalWeight;
    
    // Check if frequencies are close to targets (within 5%)
    const tolerance = 0.05;
    const foldDiff = Math.abs(actualFoldFreq - fold);
    const callDiff = Math.abs(actualCallFreq - call);
    const raiseDiff = Math.abs(actualRaiseFreq - raise);
    
    if (foldDiff <= tolerance && callDiff <= tolerance && raiseDiff <= tolerance) {
        return { foldingRange, callingRange, raisingRange };
    }
    
    // Adjust ranges to better match target frequencies
    return adjustRangesToTargets(responseRanges, responseFrequencies);
}

/**
 * Adjust ranges to better match target frequencies.
 * @param {Object} responseRanges - Current response ranges
 * @param {Object} responseFrequencies - Target frequencies
 * @returns {Object} Adjusted ranges
 */
function adjustRangesToTargets(responseRanges, responseFrequencies) {
    const { foldingRange, callingRange, raisingRange, weightDistribution } = responseRanges;
    const { fold, call, raise } = responseFrequencies;
    
    // Create combined array of all combos
    const allCombos = [
        ...foldingRange.map(c => ({ ...c, currentResponse: 'fold' })),
        ...callingRange.map(c => ({ ...c, currentResponse: 'call' })),
        ...raisingRange.map(c => ({ ...c, currentResponse: 'raise' }))
    ];
    
    // Sort by weight for better distribution
    allCombos.sort((a, b) => b.weight - a.weight);
    
    const totalWeight = allCombos.reduce((sum, combo) => sum + combo.weight, 0);
    const targetFoldWeight = totalWeight * fold;
    const targetCallWeight = totalWeight * call;
    const targetRaiseWeight = totalWeight * raise;
    
    let currentFoldWeight = 0;
    let currentCallWeight = 0;
    let currentRaiseWeight = 0;
    
    const newFoldingRange = [];
    const newCallingRange = [];
    const newRaisingRange = [];
    
    for (const combo of allCombos) {
        let assigned = false;
        
        // Try to assign to raise first (highest priority)
        if (currentRaiseWeight < targetRaiseWeight && !assigned) {
            newRaisingRange.push(combo);
            currentRaiseWeight += combo.weight;
            assigned = true;
        }
        
        // Try to assign to call second
        if (currentCallWeight < targetCallWeight && !assigned) {
            newCallingRange.push(combo);
            currentCallWeight += combo.weight;
            assigned = true;
        }
        
        // Default to fold
        if (!assigned) {
            newFoldingRange.push(combo);
            currentFoldWeight += combo.weight;
        }
    }
    
    return {
        foldingRange: newFoldingRange,
        callingRange: newCallingRange,
        raisingRange: newRaisingRange
    };
}

/**
 * Calculate confidence level in the range calculations.
 * @param {Object} validatedRanges - Validated response ranges
 * @param {Object} responseFrequencies - Target frequencies
 * @returns {number} Confidence level between 0 and 1
 */
function calculateRangeConfidence(validatedRanges, responseFrequencies) {
    const { foldingRange, callingRange, raisingRange } = validatedRanges;
    
    // Calculate actual frequencies
    const totalCombos = foldingRange.length + callingRange.length + raisingRange.length;
    if (totalCombos === 0) return 0;
    
    const actualFoldFreq = foldingRange.length / totalCombos;
    const actualCallFreq = callingRange.length / totalCombos;
    const actualRaiseFreq = raisingRange.length / totalCombos;
    
    // Calculate how close we are to target frequencies
    const foldAccuracy = 1 - Math.abs(actualFoldFreq - responseFrequencies.fold);
    const callAccuracy = 1 - Math.abs(actualCallFreq - responseFrequencies.call);
    const raiseAccuracy = 1 - Math.abs(actualRaiseFreq - responseFrequencies.raise);
    
    // Average accuracy
    const averageAccuracy = (foldAccuracy + callAccuracy + raiseAccuracy) / 3;
    
    // Additional confidence factors
    const rangeSizeConfidence = Math.min(totalCombos / 100, 1); // More combos = higher confidence
    const distributionConfidence = Math.min(
        Math.min(foldingRange.length, callingRange.length, raisingRange.length) / 10, 
        1
    ); // Balanced distribution = higher confidence
    
    return (averageAccuracy * 0.6 + rangeSizeConfidence * 0.2 + distributionConfidence * 0.2);
}

/**
 * Get board cards at a specific action.
 * @param {Object} hand - The hand object
 * @param {Object} action - The action object
 * @returns {Array} Array of board cards
 */
function getBoardCardsAtAction(hand, action) {
    if (!hand || !action || !action.street) return [];
    
    const flop = hand.communityCards?.flop || [];
    const turn = hand.communityCards?.turn ? [hand.communityCards.turn] : [];
    const river = hand.communityCards?.river ? [hand.communityCards.river] : [];
    
    if (action.street === 'flop') {
        return flop;
    } else if (action.street === 'turn') {
        return [...flop, ...turn];
    } else if (action.street === 'river') {
        return [...flop, ...turn, ...river];
    }
    
    return [];
}

/**
 * Get summary statistics for a response range.
 * @param {Array} range - Array of combos with strength information
 * @returns {Object} Summary statistics
 */
function getRangeSummary(range) {
    if (!range || range.length === 0) {
        return {
            totalCombos: 0,
            strengthBreakdown: {},
            drawBreakdown: {},
            averageWeight: 0
        };
    }
    
    const strengthBreakdown = {};
    const drawBreakdown = {};
    let totalWeight = 0;
    
    for (const combo of range) {
        // Count strength categories
        const strength = combo.strength || 'unknown';
        strengthBreakdown[strength] = (strengthBreakdown[strength] || 0) + 1;
        
        // Count draw types
        const draws = combo.draws || [];
        for (const draw of draws) {
            drawBreakdown[draw] = (drawBreakdown[draw] || 0) + 1;
        }
        
        totalWeight += combo.weight || 0;
    }
    
    return {
        totalCombos: range.length,
        strengthBreakdown,
        drawBreakdown,
        averageWeight: totalWeight / range.length
    };
}

module.exports = {
    calculateResponseRanges,
    calculateRangesByStrength,
    determineResponseType,
    validateAndNormalizeRanges,
    adjustRangesToTargets,
    calculateRangeConfidence,
    getRangeSummary,
    storeResponseRangesToHeroActions
}; 