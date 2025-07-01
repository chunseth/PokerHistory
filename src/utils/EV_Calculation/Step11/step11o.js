/**
 * Step 11o: Nash Equilibrium GTO Response Frequencies
 * Applies game theory optimal frequencies based on pot odds, position, and board texture.
 * Can override weighted probabilities from step 11o1 when GTO principles strongly suggest different frequencies.
 * 
 * @param {Object} hand - The hand object with bettingActions and board
 * @param {Array} actions - Array of all postflop actions
 * @param {number} actionIndex - Index of the current action
 * @param {string} opponentId - The opponent's player ID
 * @param {Object} weightedProbabilities - Weighted probabilities from step 11o1
 * @param {Object} potOdds - Pot odds analysis from step 11b
 * @param {Object} playerAction - The player's action analysis from step 11a
 * @param {Object} boardTexture - Board texture analysis from step 11n
 * @param {Object} position - Position information
 * @param {Object} stackDepth - Stack depth information
 * @returns {Object} GTO response frequencies with Nash equilibrium validation
 */
function calculateNashEquilibriumGTOResponses(
    hand,
    actions,
    actionIndex,
    opponentId,
    weightedProbabilities = {},
    potOdds = {},
    playerAction = {},
    boardTexture = {},
    position = {},
    stackDepth = {}
) {
    // Extract current action context
    const currentAction = actions[actionIndex];
    const street = determineStreet(currentAction, hand);
    const betSize = playerAction.betSize || 0;
    const potSize = potOdds.potSize || 100;
    const betToPotRatio = betSize / potSize;
    
    // Get base GTO frequencies based on bet sizing
    const baseGTOResponses = getBaseGTOResponses(betToPotRatio, street);
    
    // Apply position-based GTO adjustments
    const positionGTOResponses = applyPositionGTOAdjustments(
        baseGTOResponses,
        position,
        street
    );
    
    // Apply board texture GTO adjustments
    const textureGTOResponses = applyBoardTextureGTOAdjustments(
        positionGTOResponses,
        boardTexture,
        street
    );
    
    // Apply stack depth GTO adjustments
    const stackGTOResponses = applyStackDepthGTOAdjustments(
        textureGTOResponses,
        stackDepth,
        betToPotRatio
    );
    
    // Apply pot odds GTO adjustments
    const potOddsGTOResponses = applyPotOddsGTOAdjustments(
        stackGTOResponses,
        potOdds,
        street
    );
    
    // Calculate Nash equilibrium validation
    const nashValidation = validateNashEquilibrium(
        potOddsGTOResponses,
        weightedProbabilities,
        potOdds,
        boardTexture
    );
    
    // Determine final frequencies (GTO vs weighted)
    const finalFrequencies = determineFinalFrequencies(
        potOddsGTOResponses,
        weightedProbabilities,
        nashValidation,
        potOdds,
        boardTexture,
        position,
        stackDepth,
        street
    );
    
    // Calculate GTO confidence and override strength
    const gtoConfidence = calculateGTOConfidence(
        potOdds,
        boardTexture,
        position,
        stackDepth,
        street
    );
    
    return {
        frequencies: finalFrequencies,
        gtoResponses: potOddsGTOResponses,
        weightedResponses: weightedProbabilities.probabilities || {},
        nashValidation: nashValidation,
        gtoConfidence: gtoConfidence,
        overrideStrength: calculateOverrideStrength(gtoConfidence, nashValidation),
        metadata: {
            betToPotRatio: betToPotRatio,
            street: street,
            baseGTOResponses: baseGTOResponses,
            adjustments: {
                position: positionGTOResponses,
                texture: textureGTOResponses,
                stack: stackGTOResponses,
                potOdds: potOddsGTOResponses
            }
        }
    };
}

/**
 * Determine the current street based on action and hand
 */
function determineStreet(action, hand) {
    if (!action || !hand.board) return 'unknown';
    
    const boardLength = hand.board.length;
    if (boardLength === 3) return 'flop';
    if (boardLength === 4) return 'turn';
    if (boardLength === 5) return 'river';
    
    return 'unknown';
}

/**
 * Get base GTO responses based on bet sizing and street
 */
function getBaseGTOResponses(betToPotRatio, street) {
    // GTO-inspired base frequencies
    let baseResponses = {
        fold: 0.5,
        call: 0.4,
        raise: 0.1
    };
    
    // Adjust based on bet sizing
    if (betToPotRatio <= 0.33) {
        // Small bet (33% pot or less)
        baseResponses = { fold: 0.3, call: 0.6, raise: 0.1 };
    } else if (betToPotRatio <= 0.66) {
        // Medium bet (33-66% pot)
        baseResponses = { fold: 0.5, call: 0.4, raise: 0.1 };
    } else if (betToPotRatio <= 1.0) {
        // Large bet (66-100% pot)
        baseResponses = { fold: 0.7, call: 0.25, raise: 0.05 };
    } else {
        // Overbet (100%+ pot)
        baseResponses = { fold: 0.8, call: 0.15, raise: 0.05 };
    }
    
    // Adjust based on street
    if (street === 'flop') {
        // More calling on flop due to draws
        baseResponses.call += 0.1;
        baseResponses.fold -= 0.1;
    } else if (street === 'river') {
        // More polarized on river
        baseResponses.fold += 0.1;
        baseResponses.call -= 0.1;
    }
    
    return baseResponses;
}

/**
 * Apply position-based GTO adjustments
 */
function applyPositionGTOAdjustments(baseResponses, position, street) {
    const adjusted = { ...baseResponses };
    
    if (position.isInPosition) {
        // In position: more calling, less folding
        adjusted.call += 0.1;
        adjusted.fold -= 0.1;
    } else {
        // Out of position: more folding, less calling
        adjusted.fold += 0.1;
        adjusted.call -= 0.1;
    }
    
    // Blind vs blind adjustments
    if (position.isBlindVsBlind) {
        adjusted.raise += 0.05;
        adjusted.call -= 0.05;
    }
    
    return adjusted;
}

/**
 * Apply board texture GTO adjustments
 */
function applyBoardTextureGTOAdjustments(baseResponses, boardTexture, street) {
    const adjusted = { ...baseResponses };
    
    if (boardTexture.isWet) {
        // Wet boards: more calling with draws
        adjusted.call += 0.15;
        adjusted.fold -= 0.15;
    } else if (boardTexture.isDry) {
        // Dry boards: more polarized
        adjusted.fold += 0.1;
        adjusted.raise += 0.05;
        adjusted.call -= 0.15;
    }
    
    if (boardTexture.isPaired) {
        // Paired boards: more cautious
        adjusted.fold += 0.1;
        adjusted.call -= 0.1;
    }
    
    if (boardTexture.isConnected) {
        // Connected boards: more calling
        adjusted.call += 0.1;
        adjusted.fold -= 0.1;
    }
    
    return adjusted;
}

/**
 * Apply stack depth GTO adjustments
 */
function applyStackDepthGTOAdjustments(baseResponses, stackDepth, betToPotRatio) {
    const adjusted = { ...baseResponses };
    
    if (stackDepth.isShort) {
        // Short stack: more all-in or fold
        adjusted.fold += 0.2;
        adjusted.call -= 0.2;
    } else if (stackDepth.isDeep) {
        // Deep stack: more calling with draws
        adjusted.call += 0.1;
        adjusted.fold -= 0.1;
    }
    
    return adjusted;
}

/**
 * Apply pot odds GTO adjustments
 */
function applyPotOddsGTOAdjustments(baseResponses, potOdds, street) {
    const adjusted = { ...baseResponses };
    
    if (potOdds.potOddsRatio) {
        const potOddsRatio = potOdds.potOddsRatio;
        
        // GTO calling frequency should be roughly equal to pot odds
        if (potOddsRatio > 0.4) {
            // Good pot odds: more calling
            adjusted.call += 0.2;
            adjusted.fold -= 0.2;
        } else if (potOddsRatio < 0.2) {
            // Poor pot odds: more folding
            adjusted.fold += 0.2;
            adjusted.call -= 0.2;
        }
    }
    
    return adjusted;
}

/**
 * Validate Nash equilibrium principles
 */
function validateNashEquilibrium(gtoResponses, weightedProbabilities, potOdds, boardTexture) {
    const validation = {
        isValid: true,
        issues: [],
        recommendations: []
    };
    
    // Check if frequencies sum to 1.0
    const total = gtoResponses.fold + gtoResponses.call + gtoResponses.raise;
    if (Math.abs(total - 1.0) > 0.01) {
        validation.isValid = false;
        validation.issues.push('Frequencies do not sum to 1.0');
    }
    
    // Check for negative frequencies
    if (gtoResponses.fold < 0 || gtoResponses.call < 0 || gtoResponses.raise < 0) {
        validation.isValid = false;
        validation.issues.push('Negative frequencies detected');
    }
    
    // Check pot odds vs calling frequency
    if (potOdds.potOddsRatio && gtoResponses.call < potOdds.potOddsRatio * 0.5) {
        validation.recommendations.push('Consider increasing call frequency for better pot odds');
    }
    
    // Check board texture vs frequency distribution
    if (boardTexture.isWet && gtoResponses.call < 0.4) {
        validation.recommendations.push('Consider higher call frequency on wet boards');
    }
    
    return validation;
}

/**
 * Determine final frequencies (GTO vs weighted)
 */
function determineFinalFrequencies(gtoResponses, weightedProbabilities, nashValidation, potOdds, boardTexture, position, stackDepth, street) {
    const weighted = weightedProbabilities.probabilities || {};
    
    // If GTO validation fails, use weighted probabilities
    if (!nashValidation.isValid) {
        return weighted;
    }
    
    // Calculate GTO confidence with proper parameters
    const gtoConfidence = calculateGTOConfidence(potOdds, boardTexture, position, stackDepth, street);
    
    // If GTO confidence is high, use GTO responses
    if (gtoConfidence > 0.8) {
        return gtoResponses;
    }
    
    // Otherwise, blend GTO and weighted responses
    const blendFactor = gtoConfidence;
    return {
        fold: gtoResponses.fold * blendFactor + (weighted.fold || 0.5) * (1 - blendFactor),
        call: gtoResponses.call * blendFactor + (weighted.call || 0.3) * (1 - blendFactor),
        raise: gtoResponses.raise * blendFactor + (weighted.raise || 0.2) * (1 - blendFactor)
    };
}

/**
 * Calculate GTO confidence level
 */
function calculateGTOConfidence(potOdds, boardTexture, position, stackDepth, street) {
    let confidence = 0.5; // Base confidence
    
    // Pot odds confidence
    if (potOdds && potOdds.potOddsRatio) {
        confidence += 0.2;
    }
    
    // Board texture confidence
    if (boardTexture && (boardTexture.isWet || boardTexture.isDry)) {
        confidence += 0.15;
    }
    
    // Position confidence
    if (position && (position.isInPosition !== undefined || position.isBlindVsBlind)) {
        confidence += 0.1;
    }
    
    // Stack depth confidence
    if (stackDepth && (stackDepth.isShort || stackDepth.isDeep)) {
        confidence += 0.1;
    }
    
    // Street confidence
    if (street && street !== 'unknown') {
        confidence += 0.05;
    }
    
    return Math.min(1.0, confidence);
}

/**
 * Calculate override strength for GTO vs weighted
 */
function calculateOverrideStrength(gtoConfidence, nashValidation) {
    let strength = gtoConfidence;
    
    // Reduce strength if Nash validation has issues
    if (!nashValidation.isValid) {
        strength *= 0.5;
    }
    
    // Increase strength if GTO recommendations align with validation
    if (nashValidation.recommendations.length > 0) {
        strength += 0.1;
    }
    
    return Math.min(1.0, strength);
}

module.exports = {
    calculateNashEquilibriumGTOResponses
}; 