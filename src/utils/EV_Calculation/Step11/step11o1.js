/**
 * Step 11o1: Calculate Weighted Response Probabilities
 * Combines all adjustments from steps 11a-11n into weighted probabilities.
 * Returns raw (unnormalised) probabilities; Step 11p now handles validation and normalisation.
 * 
 * @param {Object} hand - The hand object with bettingActions and board
 * @param {Array} actions - Array of all postflop actions
 * @param {number} actionIndex - Index of the current action
 * @param {string} opponentId - The opponent's player ID
 * @param {Object} playerAction - The player's action analysis from step 11a
 * @param {Object} potOdds - Pot odds analysis from step 11b
 * @param {Object} rangeStrength - Range strength analysis from step 11c
 * @param {Object} streetPatterns - Street-specific patterns from step 11d
 * @param {Object} baseFrequencies - Base frequencies from step 11e
 * @param {Object} rangeAdjustments - Range adjustments from step 11f
 * @param {Object} positionAdjustments - Position adjustments from step 11g
 * @param {Object} stackAdjustments - Stack depth adjustments from step 11h
 * @param {Object} multiwayAdjustments - Multiway adjustments from step 11i
 * @param {Object} callAnalysis - Call frequency analysis from step 11j
 * @param {Object} raiseAnalysis - Raise frequency analysis from step 11k
 * @param {Object} betSizingAdjustments - Bet sizing adjustments from step 11l
 * @param {Object} actionPatternAdjustments - Action pattern adjustments from step 11m
 * @param {Object} boardTextureAdjustments - Board texture adjustments from step 11n
 * @returns {Object} Weighted response probabilities with confidence levels
 */
function calculateWeightedResponseProbabilities(
    hand,
    actions,
    actionIndex,
    opponentId,
    playerAction = {},
    potOdds = {},
    rangeStrength = {},
    streetPatterns = {},
    baseFrequencies = {},
    rangeAdjustments = {},
    positionAdjustments = {},
    stackAdjustments = {},
    multiwayAdjustments = {},
    callAnalysis = {},
    raiseAnalysis = {},
    betSizingAdjustments = {},
    actionPatternAdjustments = {},
    boardTextureAdjustments = {}
) {
    // Extract base frequencies
    const baseFold = baseFrequencies.fold || 0.6;
    const baseCall = baseFrequencies.call || 0.3;
    const baseRaise = baseFrequencies.raise || 0.1;

    // Collect all adjustments
    const adjustments = {
        fold: 0,
        call: 0,
        raise: 0
    };

    // Add range strength adjustments
    if (rangeAdjustments.rangeStrengthAdjustment) adjustments.fold += rangeAdjustments.rangeStrengthAdjustment;
    if (rangeAdjustments.strongHandsAdjustment) adjustments.call += rangeAdjustments.strongHandsAdjustment;
    if (rangeAdjustments.weakHandsAdjustment) adjustments.fold += rangeAdjustments.weakHandsAdjustment;
    if (rangeAdjustments.drawingHandsAdjustment) adjustments.call += rangeAdjustments.drawingHandsAdjustment;

    // Add position adjustments (if available)
    if (positionAdjustments.fold) adjustments.fold += positionAdjustments.fold;
    if (positionAdjustments.call) adjustments.call += positionAdjustments.call;
    if (positionAdjustments.raise) adjustments.raise += positionAdjustments.raise;

    // Add stack depth adjustments (if available)
    // Step 11h returns overallStackAdjustment as a percentage, so divide by 100
    if (stackAdjustments.overallStackAdjustment) {
        const stackAdjustment = stackAdjustments.overallStackAdjustment / 100;
        adjustments.fold += stackAdjustment;
        // Reduce call and raise proportionally
        adjustments.call -= stackAdjustment * 0.6;
        adjustments.raise -= stackAdjustment * 0.4;
    }

    // Add multiway adjustments
    if (multiwayAdjustments.multiwayAdjustment) adjustments.fold += multiwayAdjustments.multiwayAdjustment;
    if (multiwayAdjustments.headsUpAdjustment) adjustments.fold += multiwayAdjustments.headsUpAdjustment;

    // Add bet sizing adjustments
    if (betSizingAdjustments.raiseFreq) {
        const currentRaiseFreq = 0.1; // Base raise frequency
        const raiseAdjustment = betSizingAdjustments.raiseFreq - currentRaiseFreq;
        adjustments.raise += raiseAdjustment;
        // Reduce fold and call proportionally
        adjustments.fold -= raiseAdjustment * 0.6;
        adjustments.call -= raiseAdjustment * 0.4;
    }

    // Add action pattern adjustments
    if (actionPatternAdjustments.aggressivePercentage) {
        const aggressiveAdj = actionPatternAdjustments.aggressivePercentage / 100;
        adjustments.raise += aggressiveAdj * 0.1;
        adjustments.fold -= aggressiveAdj * 0.05;
        adjustments.call -= aggressiveAdj * 0.05;
    }

    // Add board texture adjustments
    if (boardTextureAdjustments.foldAdjustment) adjustments.fold += boardTextureAdjustments.foldAdjustment;
    if (boardTextureAdjustments.callAdjustment) adjustments.call += boardTextureAdjustments.callAdjustment;
    if (boardTextureAdjustments.raiseAdjustment) adjustments.raise += boardTextureAdjustments.raiseAdjustment;

    // Calculate weighted probabilities
    let foldProb = baseFold + adjustments.fold;
    let callProb = baseCall + adjustments.call;
    let raiseProb = baseRaise + adjustments.raise;

    // Ensure minimum raise probability (should never be zero in poker)
    const minRaiseProb = 0.02; // 2% minimum raise probability
    raiseProb = Math.max(raiseProb, minRaiseProb);

    // Apply confidence weighting based on data quality
    const confidenceFactors = calculateConfidenceFactors(
        rangeStrength,
        potOdds,
        playerAction,
        hand
    );

    // Weight probabilities by confidence
    foldProb *= confidenceFactors.fold;
    callProb *= confidenceFactors.call;
    raiseProb *= confidenceFactors.raise;

    // Note: No normalisation to sum to 1. Step 11p will validate / adjust.

    // Ensure probabilities are within [0,1] bounds (clamping only)
    foldProb = Math.max(0, Math.min(1, foldProb));
    callProb = Math.max(0, Math.min(1, callProb));
    raiseProb = Math.max(0, Math.min(1, raiseProb));

    // If all probabilities collapse to zero (highly unlikely), fall back to base frequencies
    const total = foldProb + callProb + raiseProb;
    if (total === 0) {
        foldProb = baseFold;
        callProb = baseCall;
        raiseProb = baseRaise;
    }

    // Round to reasonable precision
    foldProb = Math.round(foldProb * 1000) / 1000;
    callProb = Math.round(callProb * 1000) / 1000;
    raiseProb = Math.round(raiseProb * 1000) / 1000;

    // Calculate overall confidence
    const overallConfidence = calculateOverallConfidence(confidenceFactors);

    // Generate frequency ranges based on uncertainty
    const ranges = generateFrequencyRanges(foldProb, callProb, raiseProb, overallConfidence);

    return {
        probabilities: {
            fold: foldProb,
            call: callProb,
            raise: raiseProb
        },
        confidence: overallConfidence,
        ranges: ranges,
        adjustments: adjustments,
        confidenceFactors: confidenceFactors,
        metadata: {
            baseFrequencies: { fold: baseFold, call: baseCall, raise: baseRaise },
            totalAdjustments: adjustments,
            normalizationApplied: false,
            boundsChecked: true
        }
    };
}

/**
 * Calculate confidence factors for each probability type
 */
function calculateConfidenceFactors(rangeStrength, potOdds, playerAction, hand) {
    let foldConfidence = 1.0;
    let callConfidence = 1.0;
    let raiseConfidence = 1.0;

    // Range strength confidence
    if (rangeStrength.confidence) {
        const rangeConf = rangeStrength.confidence;
        foldConfidence *= rangeConf;
        callConfidence *= rangeConf;
        raiseConfidence *= rangeConf;
    }

    // Pot odds confidence
    if (potOdds.confidence) {
        const potConf = potOdds.confidence;
        callConfidence *= potConf; // Pot odds most affect calling
        foldConfidence *= Math.sqrt(potConf);
        raiseConfidence *= Math.sqrt(potConf);
    }

    // Action clarity confidence
    if (playerAction.clarity) {
        const actionConf = playerAction.clarity;
        foldConfidence *= actionConf;
        callConfidence *= actionConf;
        raiseConfidence *= actionConf;
    }

    // Board texture confidence
    if (hand.board && hand.board.length >= 3) {
        const boardConf = 0.8; // Moderate confidence for board texture
        foldConfidence *= boardConf;
        callConfidence *= boardConf;
        raiseConfidence *= boardConf;
    }

    return {
        fold: Math.max(0.1, Math.min(1.0, foldConfidence)),
        call: Math.max(0.1, Math.min(1.0, callConfidence)),
        raise: Math.max(0.1, Math.min(1.0, raiseConfidence))
    };
}

/**
 * Calculate overall confidence level
 */
function calculateOverallConfidence(confidenceFactors) {
    const avgConfidence = (
        confidenceFactors.fold + 
        confidenceFactors.call + 
        confidenceFactors.raise
    ) / 3;
    
    return Math.round(avgConfidence * 100) / 100;
}

/**
 * Generate frequency ranges based on confidence
 */
function generateFrequencyRanges(foldProb, callProb, raiseProb, confidence) {
    const uncertainty = 1 - confidence;
    const range = uncertainty * 0.2; // 20% range for full uncertainty

    return {
        fold: {
            min: Math.max(0, foldProb - range),
            max: Math.min(1, foldProb + range)
        },
        call: {
            min: Math.max(0, callProb - range),
            max: Math.min(1, callProb + range)
        },
        raise: {
            min: Math.max(0, raiseProb - range),
            max: Math.min(1, raiseProb + range)
        }
    };
}

module.exports = {
    calculateWeightedResponseProbabilities
}; 