/**
 * Step 11d: Determine Street-Specific Response Patterns
 * Analyzes how response patterns differ by street (flop, turn, river).
 * 
 * @param {Object} playerAction - The action analysis from step 11a
 * @param {Object} potOdds - The pot odds analysis from step 11b
 * @param {Object} opponentRange - The opponent's range analysis from step 11c
 * @returns {Object} Street-specific response pattern analysis
 */
function determineStreetSpecificResponsePatterns(playerAction, potOdds, opponentRange) {
    if (!playerAction || !potOdds || !opponentRange) {
        return {
            street: 'unknown',
            baseFoldFrequency: 0.5,
            baseCallFrequency: 0.3,
            baseRaiseFrequency: 0.2,
            foldFrequencyAdjustment: 0,
            callFrequencyAdjustment: 0,
            raiseFrequencyAdjustment: 0,
            streetFactors: {},
            explanation: 'Missing input data'
        };
    }

    const street = playerAction.street;
    const betSizing = playerAction.betSizing;
    const actionType = playerAction.actionType;
    const rangeStrength = opponentRange.averageStrength;

    // Get base frequencies for this street
    const baseFrequencies = getBaseFrequenciesByStreet(street, betSizing, actionType);
    
    // Calculate street-specific adjustments
    const streetAdjustments = calculateStreetAdjustments(street, playerAction, potOdds, opponentRange);
    
    // Apply adjustments to base frequencies
    const adjustedFrequencies = applyStreetAdjustments(baseFrequencies, streetAdjustments);
    
    // Get street-specific factors
    const streetFactors = getStreetSpecificFactors(street, playerAction, opponentRange);

    return {
        street,
        baseFoldFrequency: baseFrequencies.fold,
        baseCallFrequency: baseFrequencies.call,
        baseRaiseFrequency: baseFrequencies.raise,
        foldFrequencyAdjustment: streetAdjustments.fold,
        callFrequencyAdjustment: streetAdjustments.call,
        raiseFrequencyAdjustment: streetAdjustments.raise,
        adjustedFoldFrequency: adjustedFrequencies.fold,
        adjustedCallFrequency: adjustedFrequencies.call,
        adjustedRaiseFrequency: adjustedFrequencies.raise,
        streetFactors,
        explanation: generateStreetExplanation(street, streetAdjustments, streetFactors)
    };
}

/**
 * Get base response frequencies by street.
 * @param {string} street - Current street
 * @param {string} betSizing - Bet sizing category
 * @param {string} actionType - Type of action
 * @returns {Object} Base frequencies for fold, call, raise
 */
function getBaseFrequenciesByStreet(street, betSizing, actionType) {
    const baseFrequencies = {
        flop: {
            small: { fold: 0.4, call: 0.5, raise: 0.1 },
            medium: { fold: 0.6, call: 0.3, raise: 0.1 },
            large: { fold: 0.8, call: 0.15, raise: 0.05 },
            very_large: { fold: 0.9, call: 0.08, raise: 0.02 },
            all_in: { fold: 0.7, call: 0.3, raise: 0.0 }
        },
        turn: {
            small: { fold: 0.3, call: 0.6, raise: 0.1 },
            medium: { fold: 0.5, call: 0.4, raise: 0.1 },
            large: { fold: 0.7, call: 0.25, raise: 0.05 },
            very_large: { fold: 0.85, call: 0.12, raise: 0.03 },
            all_in: { fold: 0.6, call: 0.4, raise: 0.0 }
        },
        river: {
            small: { fold: 0.25, call: 0.65, raise: 0.1 },
            medium: { fold: 0.4, call: 0.5, raise: 0.1 },
            large: { fold: 0.6, call: 0.3, raise: 0.1 },
            very_large: { fold: 0.8, call: 0.15, raise: 0.05 },
            all_in: { fold: 0.5, call: 0.5, raise: 0.0 }
        }
    };

    return baseFrequencies[street]?.[betSizing] || { fold: 0.5, call: 0.3, raise: 0.2 };
}

/**
 * Calculate street-specific adjustments to base frequencies.
 * @param {string} street - Current street
 * @param {Object} playerAction - Player's action analysis
 * @param {Object} potOdds - Pot odds analysis
 * @param {Object} opponentRange - Opponent's range analysis
 * @returns {Object} Adjustments for fold, call, raise frequencies
 */
function calculateStreetAdjustments(street, playerAction, potOdds, opponentRange) {
    const adjustments = { fold: 0, call: 0, raise: 0 };

    // Flop-specific adjustments
    if (street === 'flop') {
        adjustments.fold += calculateFlopFoldAdjustment(playerAction, opponentRange);
        adjustments.call += calculateFlopCallAdjustment(playerAction, potOdds, opponentRange);
        adjustments.raise += calculateFlopRaiseAdjustment(playerAction, opponentRange);
    }
    
    // Turn-specific adjustments
    else if (street === 'turn') {
        adjustments.fold += calculateTurnFoldAdjustment(playerAction, opponentRange);
        adjustments.call += calculateTurnCallAdjustment(playerAction, potOdds, opponentRange);
        adjustments.raise += calculateTurnRaiseAdjustment(playerAction, opponentRange);
    }
    
    // River-specific adjustments
    else if (street === 'river') {
        adjustments.fold += calculateRiverFoldAdjustment(playerAction, opponentRange);
        adjustments.call += calculateRiverCallAdjustment(playerAction, potOdds, opponentRange);
        adjustments.raise += calculateRiverRaiseAdjustment(playerAction, opponentRange);
    }

    return adjustments;
}

/**
 * Calculate flop-specific fold frequency adjustments.
 * @param {Object} playerAction - Player's action analysis
 * @param {Object} opponentRange - Opponent's range analysis
 * @returns {number} Fold frequency adjustment
 */
function calculateFlopFoldAdjustment(playerAction, opponentRange) {
    let adjustment = 0;

    // Continuation bets get more folds
    if (playerAction.isContinuationBet) {
        adjustment += 0.1; // +10% fold frequency
    }

    // Strong ranges fold less to c-bets
    if (opponentRange.averageStrength > 0.7) {
        adjustment -= 0.15; // -15% fold frequency
    } else if (opponentRange.averageStrength < 0.4) {
        adjustment += 0.15; // +15% fold frequency
    }

    // Large bets get more folds
    if (playerAction.betSizing === 'large' || playerAction.betSizing === 'very_large') {
        adjustment += 0.1; // +10% fold frequency
    }

    return adjustment;
}

/**
 * Calculate flop-specific call frequency adjustments.
 * @param {Object} playerAction - Player's action analysis
 * @param {Object} potOdds - Pot odds analysis
 * @param {Object} opponentRange - Opponent's range analysis
 * @returns {number} Call frequency adjustment
 */
function calculateFlopCallAdjustment(playerAction, potOdds, opponentRange) {
    let adjustment = 0;

    // Good pot odds increase calling
    if (potOdds.potOdds < 0.3) {
        adjustment += 0.1; // +10% call frequency
    }

    // Drawing hands call more
    const drawingHandsPercentage = opponentRange.drawingHandsPercentage || 0;
    if (drawingHandsPercentage > 0.3) {
        adjustment += 0.15; // +15% call frequency
    }

    // Medium strength hands call more on flop
    if (opponentRange.averageStrength >= 0.4 && opponentRange.averageStrength <= 0.7) {
        adjustment += 0.1; // +10% call frequency
    }

    return adjustment;
}

/**
 * Calculate flop-specific raise frequency adjustments.
 * @param {Object} playerAction - Player's action analysis
 * @param {Object} opponentRange - Opponent's range analysis
 * @returns {number} Raise frequency adjustment
 */
function calculateFlopRaiseAdjustment(playerAction, opponentRange) {
    let adjustment = 0;

    // Strong ranges raise more
    if (opponentRange.averageStrength > 0.8) {
        adjustment += 0.1; // +10% raise frequency
    }

    // Check-raises are more common on flop
    if (playerAction.isCheckRaise) {
        adjustment += 0.05; // +5% raise frequency
    }

    // Small bets get raised more
    if (playerAction.betSizing === 'small') {
        adjustment += 0.05; // +5% raise frequency
    }

    return adjustment;
}

/**
 * Calculate turn-specific fold frequency adjustments.
 * @param {Object} playerAction - Player's action analysis
 * @param {Object} opponentRange - Opponent's range analysis
 * @returns {number} Fold frequency adjustment
 */
function calculateTurnFoldAdjustment(playerAction, opponentRange) {
    let adjustment = 0;

    // Turn bets get fewer folds than flop (more committed)
    adjustment -= 0.1; // -10% fold frequency

    // Weak ranges fold more on turn
    if (opponentRange.averageStrength < 0.3) {
        adjustment += 0.2; // +20% fold frequency
    }

    // Large turn bets get more folds
    if (playerAction.betSizing === 'large' || playerAction.betSizing === 'very_large') {
        adjustment += 0.15; // +15% fold frequency
    }

    return adjustment;
}

/**
 * Calculate turn-specific call frequency adjustments.
 * @param {Object} playerAction - Player's action analysis
 * @param {Object} potOdds - Pot odds analysis
 * @param {Object} opponentRange - Opponent's range analysis
 * @returns {number} Call frequency adjustment
 */
function calculateTurnCallAdjustment(playerAction, potOdds, opponentRange) {
    let adjustment = 0;

    // Turn calls are more common (players are more committed)
    adjustment += 0.15; // +15% call frequency

    // Good pot odds increase calling
    if (potOdds.potOdds < 0.25) {
        adjustment += 0.1; // +10% call frequency
    }

    // Drawing hands call more on turn
    const drawingHandsPercentage = opponentRange.drawingHandsPercentage || 0;
    if (drawingHandsPercentage > 0.2) {
        adjustment += 0.2; // +20% call frequency
    }

    return adjustment;
}

/**
 * Calculate turn-specific raise frequency adjustments.
 * @param {Object} playerAction - Player's action analysis
 * @param {Object} opponentRange - Opponent's range analysis
 * @returns {number} Raise frequency adjustment
 */
function calculateTurnRaiseAdjustment(playerAction, opponentRange) {
    let adjustment = 0;

    // Turn raises are less common (more polarized)
    adjustment -= 0.05; // -5% raise frequency

    // Very strong ranges raise more on turn
    if (opponentRange.averageStrength > 0.9) {
        adjustment += 0.15; // +15% raise frequency
    }

    // Value bets get raised less
    if (playerAction.isValueBet) {
        adjustment -= 0.1; // -10% raise frequency
    }

    return adjustment;
}

/**
 * Calculate river-specific fold frequency adjustments.
 * @param {Object} playerAction - Player's action analysis
 * @param {Object} opponentRange - Opponent's range analysis
 * @returns {number} Fold frequency adjustment
 */
function calculateRiverFoldAdjustment(playerAction, opponentRange) {
    let adjustment = 0;

    // River folds are less common (final decision)
    adjustment -= 0.15; // -15% fold frequency

    // Weak ranges fold more on river
    if (opponentRange.averageStrength < 0.4) {
        adjustment += 0.25; // +25% fold frequency
    }

    // Large river bets get more folds
    if (playerAction.betSizing === 'large' || playerAction.betSizing === 'very_large') {
        adjustment += 0.2; // +20% fold frequency
    }

    return adjustment;
}

/**
 * Calculate river-specific call frequency adjustments.
 * @param {Object} playerAction - Player's action analysis
 * @param {Object} potOdds - Pot odds analysis
 * @param {Object} opponentRange - Opponent's range analysis
 * @returns {number} Call frequency adjustment
 */
function calculateRiverCallAdjustment(playerAction, potOdds, opponentRange) {
    let adjustment = 0;

    // River calls are very common (final decision)
    adjustment += 0.2; // +20% call frequency

    // Good pot odds increase calling significantly
    if (potOdds.potOdds < 0.2) {
        adjustment += 0.15; // +15% call frequency
    }

    // Medium+ strength hands call more on river
    if (opponentRange.averageStrength >= 0.5) {
        adjustment += 0.1; // +10% call frequency
    }

    return adjustment;
}

/**
 * Calculate river-specific raise frequency adjustments.
 * @param {Object} playerAction - Player's action analysis
 * @param {Object} opponentRange - Opponent's range analysis
 * @returns {number} Raise frequency adjustment
 */
function calculateRiverRaiseAdjustment(playerAction, opponentRange) {
    let adjustment = 0;

    // River raises are more polarized
    adjustment += 0.05; // +5% raise frequency

    // Very strong ranges raise more on river
    if (opponentRange.averageStrength > 0.95) {
        adjustment += 0.2; // +20% raise frequency
    }

    // Bluffs get raised more on river
    if (playerAction.isBluff) {
        adjustment += 0.1; // +10% raise frequency
    }

    return adjustment;
}

/**
 * Apply street adjustments to base frequencies.
 * @param {Object} baseFrequencies - Base frequencies
 * @param {Object} adjustments - Frequency adjustments
 * @returns {Object} Adjusted frequencies
 */
function applyStreetAdjustments(baseFrequencies, adjustments) {
    const adjusted = {
        fold: Math.max(0, Math.min(1, baseFrequencies.fold + adjustments.fold)),
        call: Math.max(0, Math.min(1, baseFrequencies.call + adjustments.call)),
        raise: Math.max(0, Math.min(1, baseFrequencies.raise + adjustments.raise))
    };

    // Normalize to ensure sum equals 1
    const total = adjusted.fold + adjusted.call + adjusted.raise;
    if (total > 0) {
        adjusted.fold /= total;
        adjusted.call /= total;
        adjusted.raise /= total;
    }

    return adjusted;
}

/**
 * Calculate how many streets remain after the current street.
 * @param {string} street - Current street
 * @returns {number} Number of remaining streets
 */
function calculateRemainingStreets(street) {
    const streetOrder = ['preflop', 'flop', 'turn', 'river'];
    const currentIndex = streetOrder.indexOf(street);
    
    if (currentIndex === -1) return 0;
    
    return Math.max(0, streetOrder.length - currentIndex - 1);
}

/**
 * Get street-specific factors that influence response patterns.
 * @param {string} street - Current street
 * @param {Object} playerAction - Player's action analysis
 * @param {Object} opponentRange - Opponent's range analysis
 * @returns {Object} Street-specific factors
 */
function getStreetSpecificFactors(street, playerAction, opponentRange) {
    const factors = {
        remainingStreets: calculateRemainingStreets(street),
        isFinalDecision: street === 'river',
        commitmentLevel: calculateCommitmentLevel(street, opponentRange),
        bluffCatchingFrequency: calculateBluffCatchingFrequency(street, playerAction),
        valueBettingFrequency: calculateValueBettingFrequency(street, playerAction),
        drawingPotential: calculateDrawingPotential(street, opponentRange)
    };

    return factors;
}

/**
 * Calculate commitment level (how invested players are).
 * @param {string} street - Current street
 * @param {Object} opponentRange - Opponent's range analysis
 * @returns {number} Commitment level (0-1)
 */
function calculateCommitmentLevel(street, opponentRange) {
    let baseCommitment = 0;
    
    if (street === 'flop') baseCommitment = 0.3;
    else if (street === 'turn') baseCommitment = 0.6;
    else if (street === 'river') baseCommitment = 0.9;

    // Stronger ranges are more committed
    const strengthAdjustment = opponentRange.averageStrength * 0.2;
    
    return Math.min(1, baseCommitment + strengthAdjustment);
}

/**
 * Calculate bluff catching frequency.
 * @param {string} street - Current street
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Bluff catching frequency (0-1)
 */
function calculateBluffCatchingFrequency(street, playerAction) {
    let baseFrequency = 0.3;
    
    if (street === 'flop') baseFrequency = 0.2;
    else if (street === 'turn') baseFrequency = 0.3;
    else if (street === 'river') baseFrequency = 0.4;

    // Large bets are more likely to be bluffs
    if (playerAction.betSizing === 'large' || playerAction.betSizing === 'very_large') {
        baseFrequency += 0.1;
    }

    return Math.min(1, baseFrequency);
}

/**
 * Calculate value betting frequency.
 * @param {string} street - Current street
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Value betting frequency (0-1)
 */
function calculateValueBettingFrequency(street, playerAction) {
    let baseFrequency = 0.4;
    
    if (street === 'flop') baseFrequency = 0.3;
    else if (street === 'turn') baseFrequency = 0.4;
    else if (street === 'river') baseFrequency = 0.5;

    // Small bets are more likely to be value bets
    if (playerAction.betSizing === 'small' || playerAction.betSizing === 'medium') {
        baseFrequency += 0.1;
    }

    return Math.min(1, baseFrequency);
}

/**
 * Calculate drawing potential.
 * @param {string} street - Current street
 * @param {Object} opponentRange - Opponent's range analysis
 * @returns {number} Drawing potential (0-1)
 */
function calculateDrawingPotential(street, opponentRange) {
    let basePotential = 0.2;
    
    if (street === 'flop') basePotential = 0.4;
    else if (street === 'turn') basePotential = 0.2;
    else if (street === 'river') basePotential = 0.0;

    // Add range-specific drawing potential
    const drawingAdjustment = (opponentRange.drawingHandsPercentage || 0) * 0.3;
    
    return Math.min(1, basePotential + drawingAdjustment);
}

/**
 * Generate explanation for street-specific adjustments.
 * @param {string} street - Current street
 * @param {Object} adjustments - Frequency adjustments
 * @param {Object} factors - Street-specific factors
 * @returns {string} Explanation of adjustments
 */
function generateStreetExplanation(street, adjustments, factors) {
    const explanations = [];
    
    if (adjustments.fold > 0.05) {
        explanations.push(`Higher fold frequency (+${(adjustments.fold * 100).toFixed(1)}%) due to ${street} dynamics`);
    } else if (adjustments.fold < -0.05) {
        explanations.push(`Lower fold frequency (${(adjustments.fold * 100).toFixed(1)}%) due to ${street} commitment`);
    }
    
    if (adjustments.call > 0.05) {
        explanations.push(`Higher call frequency (+${(adjustments.call * 100).toFixed(1)}%) due to ${street} pot odds`);
    }
    
    if (adjustments.raise > 0.05) {
        explanations.push(`Higher raise frequency (+${(adjustments.raise * 100).toFixed(1)}%) due to ${street} strength`);
    }
    
    return explanations.join('. ') || `Standard ${street} response patterns applied`;
}

module.exports = {
    determineStreetSpecificResponsePatterns,
    getBaseFrequenciesByStreet,
    calculateStreetAdjustments,
    calculateFlopFoldAdjustment,
    calculateFlopCallAdjustment,
    calculateFlopRaiseAdjustment,
    calculateTurnFoldAdjustment,
    calculateTurnCallAdjustment,
    calculateTurnRaiseAdjustment,
    calculateRiverFoldAdjustment,
    calculateRiverCallAdjustment,
    calculateRiverRaiseAdjustment,
    applyStreetAdjustments,
    getStreetSpecificFactors,
    calculateCommitmentLevel,
    calculateBluffCatchingFrequency,
    calculateValueBettingFrequency,
    calculateDrawingPotential,
    calculateRemainingStreets,
    generateStreetExplanation
}