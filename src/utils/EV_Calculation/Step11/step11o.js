/**
 * Step 11o: Nash Equilibrium-Based GTO Response Frequencies
 * Calculates opponent response frequencies using Nash equilibrium principles
 * and game theory optimal strategies for NLH poker.
 * 
 * @param {Object} playerAction - The player's action analysis from step 11a
 * @param {Object} potOdds - The pot odds analysis from step 11b
 * @param {Object} opponentRange - The opponent's range analysis from step 11c
 * @param {Object} boardTexture - The board texture analysis from step 11n
 * @returns {Object} Nash equilibrium-based response frequencies
 */
function calculateNashEquilibriumResponseFrequencies(playerAction, potOdds, opponentRange, boardTexture) {
    if (!playerAction || !potOdds || !opponentRange) {
        return {
            nashFoldFrequency: 0.5,
            nashCallFrequency: 0.3,
            nashRaiseFrequency: 0.2,
            equilibriumFound: false,
            deviationFromNash: 0,
            explanation: 'Missing input data'
        };
    }

    // Calculate Nash equilibrium frequencies
    const nashFrequencies = calculateNashFrequencies(playerAction, potOdds, opponentRange, boardTexture);
    
    // Calculate deviation from Nash equilibrium
    const deviation = calculateDeviationFromNash(nashFrequencies, playerAction, opponentRange);
    
    // Apply game theory adjustments
    const adjustedFrequencies = applyGameTheoryAdjustments(nashFrequencies, deviation, playerAction);
    
    // Validate Nash equilibrium properties
    const equilibriumValidation = validateNashEquilibrium(adjustedFrequencies, playerAction, potOdds);

        return {
        nashFoldFrequency: adjustedFrequencies.fold,
        nashCallFrequency: adjustedFrequencies.call,
        nashRaiseFrequency: adjustedFrequencies.raise,
        equilibriumFound: equilibriumValidation.isValid,
        deviationFromNash: deviation.totalDeviation,
        nashProperties: equilibriumValidation.properties,
        explanation: generateNashExplanation(adjustedFrequencies, deviation, equilibriumValidation)
    };
}

/**
 * Calculate Nash equilibrium frequencies using game theory principles
 */
function calculateNashFrequencies(playerAction, potOdds, opponentRange, boardTexture) {
    const betSizing = playerAction.betSizing;
    const potOddsRatio = potOdds.potOdds || 0.5;
    const rangeStrength = opponentRange.averageStrength || 0.5;
    const texture = boardTexture?.boardTexture || 'dry';
    
    // Base Nash frequencies based on bet sizing and pot odds
    let nashFold = 0.5;
    let nashCall = 0.3;
    let nashRaise = 0.2;
    
    // Nash equilibrium for different bet sizes
    switch (betSizing) {
        case 'small':
            // Small bets: Nash equilibrium favors calling
            nashFold = 0.3;
            nashCall = 0.6;
            nashRaise = 0.1;
            break;
        case 'medium':
            // Medium bets: Nash equilibrium is more balanced
            nashFold = 0.5;
            nashCall = 0.4;
            nashRaise = 0.1;
            break;
        case 'large':
            // Large bets: Nash equilibrium favors folding
            nashFold = 0.7;
            nashCall = 0.25;
            nashRaise = 0.05;
            break;
        case 'very_large':
            // Very large bets: Nash equilibrium heavily favors folding
            nashFold = 0.85;
            nashCall = 0.13;
            nashRaise = 0.02;
            break;
        case 'all_in':
            // All-in: Nash equilibrium depends heavily on pot odds
            nashFold = calculateAllInNashFrequency(potOddsRatio);
            nashCall = 1 - nashFold;
            nashRaise = 0;
            break;
    }
    
    // Adjust for pot odds (Nash equilibrium principle)
    nashFold = adjustNashForPotOdds(nashFold, potOddsRatio);
    nashCall = adjustNashForPotOdds(nashCall, potOddsRatio);
    nashRaise = adjustNashForPotOdds(nashRaise, potOddsRatio);
    
    // Adjust for range strength (game theory optimal)
    const rangeAdjustment = calculateRangeStrengthNashAdjustment(rangeStrength, texture);
    nashFold += rangeAdjustment.fold;
    nashCall += rangeAdjustment.call;
    nashRaise += rangeAdjustment.raise;
    
    // Normalize to ensure probabilities sum to 1
    const total = nashFold + nashCall + nashRaise;
    nashFold /= total;
    nashCall /= total;
    nashRaise /= total;
    
    return { fold: nashFold, call: nashCall, raise: nashRaise };
}

/**
 * Calculate Nash equilibrium frequency for all-in situations
 */
function calculateAllInNashFrequency(potOddsRatio) {
    // Nash equilibrium for all-in depends on pot odds
    // The opponent should call when they have the right pot odds
    if (potOddsRatio < 0.2) {
        return 0.1; // Very good pot odds - rarely fold
    } else if (potOddsRatio < 0.3) {
        return 0.25; // Good pot odds - some folding
    } else if (potOddsRatio < 0.4) {
        return 0.5; // Fair pot odds - balanced
    } else if (potOddsRatio < 0.5) {
        return 0.75; // Poor pot odds - mostly fold
    } else {
        return 0.9; // Very poor pot odds - almost always fold
    }
}

/**
 * Adjust Nash frequencies based on pot odds
 */
function adjustNashForPotOdds(frequency, potOddsRatio) {
    // Nash equilibrium principle: better pot odds reduce fold frequency
    if (potOddsRatio < 0.25) {
        // Good pot odds - reduce fold frequency
        return frequency * 0.8;
    } else if (potOddsRatio > 0.5) {
        // Poor pot odds - increase fold frequency
        return frequency * 1.3;
    }
    return frequency;
}

/**
 * Calculate range strength adjustments for Nash equilibrium
 */
function calculateRangeStrengthNashAdjustment(rangeStrength, texture) {
    const adjustment = { fold: 0, call: 0, raise: 0 };
    
    // Strong ranges in Nash equilibrium
    if (rangeStrength > 0.7) {
        adjustment.fold -= 0.15; // Strong ranges fold less
        adjustment.call += 0.1;  // Strong ranges call more
        adjustment.raise += 0.05; // Strong ranges raise more
    }
    // Weak ranges in Nash equilibrium
    else if (rangeStrength < 0.3) {
        adjustment.fold += 0.15; // Weak ranges fold more
        adjustment.call -= 0.1;  // Weak ranges call less
        adjustment.raise -= 0.05; // Weak ranges raise less
    }
    
    // Texture-specific Nash adjustments
    if (texture === 'suited' && rangeStrength > 0.5) {
        // Strong ranges on suited boards call more in Nash equilibrium
        adjustment.call += 0.05;
        adjustment.fold -= 0.05;
    } else if (texture === 'dry' && rangeStrength < 0.4) {
        // Weak ranges on dry boards fold more in Nash equilibrium
        adjustment.fold += 0.1;
        adjustment.call -= 0.1;
    }
    
    return adjustment;
}

/**
 * Calculate deviation from Nash equilibrium
 */
function calculateDeviationFromNash(nashFrequencies, playerAction, opponentRange) {
    // Calculate how much the current situation deviates from Nash equilibrium
    const deviation = {
        fold: 0,
        call: 0,
        raise: 0,
        totalDeviation: 0
    };
    
    // Base deviation based on action type
    if (playerAction.actionType === 'bet') {
        // Bets are generally closer to Nash equilibrium
        deviation.totalDeviation = 0.1;
    } else if (playerAction.actionType === 'raise') {
        // Raises may deviate more from Nash
        deviation.totalDeviation = 0.2;
    } else {
        deviation.totalDeviation = 0.15;
    }
    
    // Adjust deviation based on range strength
    const rangeStrength = opponentRange.averageStrength || 0.5;
    if (rangeStrength > 0.7 || rangeStrength < 0.3) {
        // Extreme ranges may deviate more from Nash
        deviation.totalDeviation += 0.1;
    }
    
    // Adjust deviation based on bet sizing
    if (playerAction.betSizing === 'very_large') {
        deviation.totalDeviation += 0.1; // Very large bets may deviate from Nash
    }
    
    return deviation;
}

/**
 * Apply game theory adjustments to Nash frequencies
 */
function applyGameTheoryAdjustments(nashFrequencies, deviation, playerAction) {
    const adjusted = { ...nashFrequencies };
    
    // Apply deviation adjustments
    const deviationFactor = 1 + deviation.totalDeviation;
    
    // Adjust based on game theory principles
    if (playerAction.betSizing === 'small') {
        // Small bets: Game theory suggests more calling
        adjusted.call *= 1.1;
        adjusted.fold *= 0.9;
    } else if (playerAction.betSizing === 'large') {
        // Large bets: Game theory suggests more folding
        adjusted.fold *= 1.1;
        adjusted.call *= 0.9;
    }
    
    // Normalize again
    const total = adjusted.fold + adjusted.call + adjusted.raise;
    adjusted.fold /= total;
    adjusted.call /= total;
    adjusted.raise /= total;
    
    return adjusted;
}

/**
 * Validate Nash equilibrium properties
 */
function validateNashEquilibrium(frequencies, playerAction, potOdds) {
    const validation = {
        isValid: true,
        properties: {},
        violations: []
    };
    
    // Check that probabilities sum to 1
    const total = frequencies.fold + frequencies.call + frequencies.raise;
    if (Math.abs(total - 1.0) > 0.01) {
        validation.isValid = false;
        validation.violations.push('Probabilities do not sum to 1');
    }
    
    // Check that all probabilities are non-negative
    if (frequencies.fold < 0 || frequencies.call < 0 || frequencies.raise < 0) {
        validation.isValid = false;
        validation.violations.push('Negative probabilities found');
    }
    
    // Check Nash equilibrium properties
    validation.properties = {
        totalProbability: total,
        foldRange: frequencies.fold >= 0 && frequencies.fold <= 1,
        callRange: frequencies.call >= 0 && frequencies.call <= 1,
        raiseRange: frequencies.raise >= 0 && frequencies.raise <= 1,
        potOddsConsistency: checkPotOddsConsistency(frequencies, potOdds)
    };
    
    return validation;
}

/**
 * Check consistency with pot odds
 */
function checkPotOddsConsistency(frequencies, potOdds) {
    const potOddsRatio = potOdds.potOdds || 0.5;
    
    // In Nash equilibrium, fold frequency should increase with pot odds
    if (potOddsRatio > 0.5 && frequencies.fold < 0.6) {
        return false; // Should fold more with poor pot odds
    }
    if (potOddsRatio < 0.25 && frequencies.fold > 0.4) {
        return false; // Should fold less with good pot odds
    }
    
    return true;
}

/**
 * Generate explanation for Nash equilibrium calculations
 */
function generateNashExplanation(frequencies, deviation, validation) {
    const explanations = [];
    
    explanations.push(`Nash equilibrium frequencies: ${(frequencies.fold * 100).toFixed(1)}% fold, ${(frequencies.call * 100).toFixed(1)}% call, ${(frequencies.raise * 100).toFixed(1)}% raise`);
    
    if (validation.isValid) {
        explanations.push('Nash equilibrium properties validated');
    } else {
        explanations.push(`Nash equilibrium violations: ${validation.violations.join(', ')}`);
    }
    
    if (deviation.totalDeviation > 0.2) {
        explanations.push(`High deviation from Nash equilibrium (${(deviation.totalDeviation * 100).toFixed(1)}%)`);
    } else if (deviation.totalDeviation < 0.1) {
        explanations.push('Close to Nash equilibrium');
    } else {
        explanations.push(`Moderate deviation from Nash equilibrium (${(deviation.totalDeviation * 100).toFixed(1)}%)`);
    }
    
    return explanations.join('. ');
}

module.exports = {
    calculateNashEquilibriumResponseFrequencies,
    calculateNashFrequencies,
    calculateAllInNashFrequency,
    adjustNashForPotOdds,
    calculateRangeStrengthNashAdjustment,
    calculateDeviationFromNash,
    applyGameTheoryAdjustments,
    validateNashEquilibrium,
    checkPotOddsConsistency,
    generateNashExplanation
}; 