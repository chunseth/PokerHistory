/**
 * Step 11n: Calculate Overall Response Frequencies
 * Combines all individual frequency calculations (fold, call, raise) into a comprehensive
 * overall response frequency analysis with normalization, profiling, and confidence assessment.
 * 
 * @param {Object} foldFrequency - The fold frequency analysis from step 11k
 * @param {Object} callFrequency - The call frequency analysis from step 11j
 * @param {Object} raiseFrequency - The raise frequency analysis from step 11l
 * @param {Object} playerAction - The player's action analysis from step 11a
 * @param {Object} hand - The full hand object
 * @param {Array} actions - Array of all postflop actions
 * @param {number} actionIndex - Index of the current action
 * @param {string} opponentId - The opponent's player ID
 * @returns {Object} Overall response frequencies analysis
 */
function calculateOverallResponseFrequencies(foldFrequency, callFrequency, raiseFrequency, playerAction, hand, actions, actionIndex, opponentId) {
    if (!foldFrequency || !callFrequency || !raiseFrequency || !playerAction || !hand) {
        return {
            foldFrequency: 0,
            callFrequency: 0,
            raiseFrequency: 0,
            totalFrequency: 0,
            isNormalized: false,
            responseProfile: 'unknown',
            confidenceLevel: 'low',
            explanation: 'Missing input data'
        };
    }

    // Extract individual frequencies
    const foldFreq = foldFrequency.overallFoldFrequency;
    const callFreq = callFrequency.overallCallFrequency;
    const raiseFreq = raiseFrequency.overallRaiseFrequency;
    
    // Calculate total frequency
    const totalFrequency = foldFreq + callFreq + raiseFreq;
    
    // Normalize frequencies if needed
    const normalizedFrequencies = normalizeResponseFrequencies(foldFreq, callFreq, raiseFreq, totalFrequency);
    
    // Determine response profile
    const responseProfile = determineResponseProfile(normalizedFrequencies);
    
    // Calculate confidence level
    const confidenceLevel = calculateConfidenceLevel(foldFrequency, callFrequency, raiseFrequency, playerAction);
    
    // Generate comprehensive explanation
    const explanation = generateOverallResponseExplanation({
        foldFrequency: foldFrequency,
        callFrequency: callFrequency,
        raiseFrequency: raiseFrequency,
        normalized: normalizedFrequencies,
        profile: responseProfile,
        confidence: confidenceLevel,
        playerAction: playerAction
    });

    return {
        foldFrequency: normalizedFrequencies.fold,
        callFrequency: normalizedFrequencies.call,
        raiseFrequency: normalizedFrequencies.raise,
        totalFrequency: totalFrequency,
        isNormalized: totalFrequency !== 1.0,
        responseProfile,
        confidenceLevel,
        explanation,
        // Additional analysis
        foldDominance: calculateFoldDominance(normalizedFrequencies.fold),
        callDominance: calculateCallDominance(normalizedFrequencies.call),
        raiseDominance: calculateRaiseDominance(normalizedFrequencies.raise),
        actionRecommendation: generateActionRecommendation(normalizedFrequencies, responseProfile, playerAction),
        expectedValue: calculateExpectedValue(normalizedFrequencies, playerAction)
    };
}

/**
 * Normalize response frequencies to ensure they sum to 1.0.
 * @param {number} foldFreq - Fold frequency
 * @param {number} callFreq - Call frequency
 * @param {number} raiseFreq - Raise frequency
 * @param {number} totalFreq - Total frequency
 * @returns {Object} Normalized frequencies
 */
function normalizeResponseFrequencies(foldFreq, callFreq, raiseFreq, totalFreq) {
    if (Math.abs(totalFreq - 1.0) < 0.01) {
        // Already normalized
        return {
            fold: foldFreq,
            call: callFreq,
            raise: raiseFreq
        };
    }
    
    if (totalFreq === 0) {
        // No valid frequencies, use default
        return {
            fold: 0.5,
            call: 0.3,
            raise: 0.2
        };
    }
    
    // Normalize by dividing by total
    return {
        fold: foldFreq / totalFreq,
        call: callFreq / totalFreq,
        raise: raiseFreq / totalFreq
    };
}

/**
 * Determine the response profile based on frequency distribution.
 * @param {Object} frequencies - Normalized frequencies
 * @returns {string} Response profile
 */
function determineResponseProfile(frequencies) {
    const { fold, call, raise } = frequencies;
    
    // Find the dominant response
    const maxFreq = Math.max(fold, call, raise);
    
    if (maxFreq === fold) {
        if (fold > 0.7) return 'fold_dominant';
        if (fold > 0.5) return 'fold_heavy';
        return 'fold_favored';
    } else if (maxFreq === call) {
        if (call > 0.6) return 'call_dominant';
        if (call > 0.4) return 'call_heavy';
        return 'call_favored';
    } else {
        if (raise > 0.3) return 'raise_dominant';
        if (raise > 0.2) return 'raise_heavy';
        return 'raise_favored';
    }
}

/**
 * Calculate confidence level in the response frequency estimates.
 * @param {Object} foldFrequency - Fold frequency analysis
 * @param {Object} callFrequency - Call frequency analysis
 * @param {Object} raiseFrequency - Raise frequency analysis
 * @param {Object} playerAction - Player's action analysis
 * @returns {string} Confidence level
 */
function calculateConfidenceLevel(foldFrequency, callFrequency, raiseFrequency, playerAction) {
    let confidenceScore = 0;
    
    // Check if all frequencies are reasonable
    if (foldFrequency.overallFoldFrequency > 0 && foldFrequency.overallFoldFrequency < 1) confidenceScore += 1;
    if (callFrequency.overallCallFrequency > 0 && callFrequency.overallCallFrequency < 1) confidenceScore += 1;
    if (raiseFrequency.overallRaiseFrequency > 0 && raiseFrequency.overallRaiseFrequency < 1) confidenceScore += 1;
    
    // Check if total frequency is close to 1.0
    const totalFreq = foldFrequency.overallFoldFrequency + callFrequency.overallCallFrequency + raiseFrequency.overallRaiseFrequency;
    if (Math.abs(totalFreq - 1.0) < 0.1) confidenceScore += 2;
    else if (Math.abs(totalFreq - 1.0) < 0.2) confidenceScore += 1;
    
    // Check action type clarity
    if (playerAction.actionType === 'bet' || playerAction.actionType === 'raise') confidenceScore += 1;
    if (playerAction.betSizing !== 'none') confidenceScore += 1;
    
    // Determine confidence level
    if (confidenceScore >= 6) return 'high';
    if (confidenceScore >= 4) return 'medium';
    return 'low';
}

/**
 * Calculate fold dominance score.
 * @param {number} foldFreq - Normalized fold frequency
 * @returns {string} Fold dominance description
 */
function calculateFoldDominance(foldFreq) {
    if (foldFreq > 0.8) return 'very_high';
    if (foldFreq > 0.6) return 'high';
    if (foldFreq > 0.4) return 'moderate';
    if (foldFreq > 0.2) return 'low';
    return 'very_low';
}

/**
 * Calculate call dominance score.
 * @param {number} callFreq - Normalized call frequency
 * @returns {string} Call dominance description
 */
function calculateCallDominance(callFreq) {
    if (callFreq > 0.7) return 'very_high';
    if (callFreq > 0.5) return 'high';
    if (callFreq > 0.3) return 'moderate';
    if (callFreq > 0.1) return 'low';
    return 'very_low';
}

/**
 * Calculate raise dominance score.
 * @param {number} raiseFreq - Normalized raise frequency
 * @returns {string} Raise dominance description
 */
function calculateRaiseDominance(raiseFreq) {
    if (raiseFreq > 0.4) return 'very_high';
    if (raiseFreq > 0.25) return 'high';
    if (raiseFreq > 0.15) return 'moderate';
    if (raiseFreq > 0.05) return 'low';
    return 'very_low';
}

/**
 * Generate action recommendation based on response frequencies.
 * @param {Object} frequencies - Normalized frequencies
 * @param {string} responseProfile - Response profile
 * @param {Object} playerAction - Player's action analysis
 * @returns {string} Action recommendation
 */
function generateActionRecommendation(frequencies, responseProfile, playerAction) {
    const { fold, call, raise } = frequencies;
    
    // If opponent folds a lot, betting is profitable
    if (fold > 0.6) {
        return 'bet_for_value_or_bluff';
    }
    
    // If opponent calls a lot, value betting is profitable
    if (call > 0.5) {
        return 'value_bet_thin';
    }
    
    // If opponent raises a lot, be cautious
    if (raise > 0.25) {
        return 'check_or_small_bet';
    }
    
    // Balanced opponent
    if (fold > 0.4 && call > 0.3) {
        return 'balanced_betting';
    }
    
    // Default recommendation
    return 'standard_betting';
}

/**
 * Calculate expected value based on response frequencies.
 * @param {Object} frequencies - Normalized frequencies
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Expected value in BB
 */
function calculateExpectedValue(frequencies, playerAction) {
    const { fold, call, raise } = frequencies;
    const betSize = playerAction.betSize;
    const potSize = playerAction.potSize;
    
    // Simplified EV calculation
    // EV = (fold_freq * pot_size) + (call_freq * (pot_size * equity - bet_size)) + (raise_freq * (pot_size * equity - bet_size - raise_size))
    
    // Assume 50% equity for simplicity (this would be refined in actual implementation)
    const assumedEquity = 0.5;
    const assumedRaiseSize = betSize * 2; // Assume 2x raise
    
    const foldEV = fold * potSize;
    const callEV = call * (potSize * assumedEquity - betSize);
    const raiseEV = raise * (potSize * assumedEquity - betSize - assumedRaiseSize);
    
    return foldEV + callEV + raiseEV;
}

/**
 * Generate comprehensive explanation for overall response frequencies.
 * @param {Object} data - All response frequency data
 * @returns {string} Comprehensive explanation
 */
function generateOverallResponseExplanation(data) {
    const { foldFrequency, callFrequency, raiseFrequency, normalized, profile, confidence, playerAction } = data;
    const explanations = [];

    // Overall response distribution
    explanations.push(`Response distribution: ${(normalized.fold * 100).toFixed(1)}% fold, ${(normalized.call * 100).toFixed(1)}% call, ${(normalized.raise * 100).toFixed(1)}% raise`);

    // Response profile
    explanations.push(`Response profile: ${profile.replace('_', ' ')}`);

    // Confidence level
    explanations.push(`Confidence level: ${confidence}`);

    // Dominant response analysis
    if (normalized.fold > 0.5) {
        explanations.push(`Opponent is likely to fold (${(normalized.fold * 100).toFixed(1)}% probability)`);
    } else if (normalized.call > 0.4) {
        explanations.push(`Opponent is likely to call (${(normalized.call * 100).toFixed(1)}% probability)`);
    } else if (normalized.raise > 0.2) {
        explanations.push(`Opponent is likely to raise (${(normalized.raise * 100).toFixed(1)}% probability)`);
    }

    // Action context
    if (playerAction.actionType === 'bet') {
        explanations.push(`Analyzing response to ${playerAction.betSizing} bet (${playerAction.betSize}BB)`);
    } else if (playerAction.actionType === 'raise') {
        explanations.push(`Analyzing response to raise (${playerAction.betSize}BB)`);
    }

    // Street context
    explanations.push(`Street: ${playerAction.street}`);

    // Pot odds context
    if (foldFrequency.potOddsFoldAdjustment !== 0) {
        const direction = foldFrequency.potOddsFoldAdjustment > 0 ? 'increases' : 'decreases';
        explanations.push(`Pot odds ${direction} fold frequency by ${Math.abs(foldFrequency.potOddsFoldAdjustment * 100).toFixed(1)}%`);
    }

    // Position context
    if (callFrequency.positionCallAdjustment !== 0) {
        const direction = callFrequency.positionCallAdjustment > 0 ? 'increases' : 'decreases';
        explanations.push(`Position ${direction} call frequency by ${Math.abs(callFrequency.positionCallAdjustment * 100).toFixed(1)}%`);
    }

    // Stack depth context
    if (raiseFrequency.stackDepthRaiseAdjustment !== 0) {
        const direction = raiseFrequency.stackDepthRaiseAdjustment > 0 ? 'increases' : 'decreases';
        explanations.push(`Stack depth ${direction} raise frequency by ${Math.abs(raiseFrequency.stackDepthRaiseAdjustment * 100).toFixed(1)}%`);
    }

    return explanations.join('. ');
}

/**
 * Step 11n: Adjust for Board Texture
 * Advanced GTO-based board texture analysis that considers how different board types
 * affect opponent response frequencies.
 * 
 * @param {Object} playerAction - The player's action analysis from step 11a
 * @param {Object} opponentRange - The opponent's range analysis from step 11c
 * @param {Array} board - Current board cards
 * @returns {Object} Board texture adjustment analysis
 */
function adjustForBoardTexture(playerAction, opponentRange, board) {
    if (!playerAction || !opponentRange || !board) {
        return {
            boardTexture: 'unknown',
            foldAdjustment: 0,
            callAdjustment: 0,
            raiseAdjustment: 0,
            textureFactors: {},
            explanation: 'Missing input data'
        };
    }

    // Advanced board texture analysis
    const textureAnalysis = analyzeAdvancedBoardTexture(board, opponentRange);
    
    // Calculate GTO-based adjustments for each texture type
    const adjustments = calculateGTOBoardAdjustments(textureAnalysis, playerAction, opponentRange);
    
    // Apply street-specific texture considerations
    const streetAdjustments = applyStreetSpecificTextureAdjustments(
        textureAnalysis, 
        playerAction.street, 
        playerAction
    );

    return {
        boardTexture: textureAnalysis.texture,
        foldAdjustment: adjustments.fold + streetAdjustments.fold,
        callAdjustment: adjustments.call + streetAdjustments.call,
        raiseAdjustment: adjustments.raise + streetAdjustments.raise,
        textureFactors: textureAnalysis.factors,
        explanation: generateBoardTextureExplanation(textureAnalysis, adjustments, playerAction)
    };
}

/**
 * Advanced board texture analysis with GTO considerations
 */
function analyzeAdvancedBoardTexture(board, opponentRange) {
    if (!board || board.length === 0) {
        return { texture: 'unknown', factors: {} };
    }

    const ranks = board.map(card => card[0]);
    const suits = board.map(card => card[1]);
    
    // Count ranks and suits
    const rankCounts = {};
    const suitCounts = {};
    
    ranks.forEach(rank => {
        rankCounts[rank] = (rankCounts[rank] || 0) + 1;
    });
    
    suits.forEach(suit => {
        suitCounts[suit] = (suitCounts[suit] || 0) + 1;
    });
    
    const maxRankCount = Math.max(...Object.values(rankCounts));
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    
    // GTO-based texture classification
    let texture = 'dry';
    let factors = {};
    
    // Paired boards
    if (maxRankCount >= 3) {
        texture = 'trips';
        factors = {
            paired: true,
            trips: maxRankCount >= 3,
            quads: maxRankCount >= 4,
            rankCounts,
            gtoImplications: 'High card removal makes draws less likely, polarized responses'
        };
    } else if (maxRankCount === 2) {
        texture = 'paired';
        factors = {
            paired: true,
            rankCounts,
            gtoImplications: 'Reduced flush potential, more value betting'
        };
    }
    // Suited boards
    else if (maxSuitCount >= 3) {
        texture = 'suited';
        factors = {
            suited: true,
            flushDraw: maxSuitCount === 3,
            flush: maxSuitCount >= 4,
            suitCounts,
            gtoImplications: 'High flush potential, more calling with draws'
        };
    }
    // Connected boards
    else {
        const sortedRanks = [...new Set(ranks)].sort((a, b) => 
            '23456789TJQKA'.indexOf(a) - '23456789TJQKA'.indexOf(b)
        );
        
        let connected = 0;
        let gaps = [];
        for (let i = 0; i < sortedRanks.length - 1; i++) {
            const rank1 = '23456789TJQKA'.indexOf(sortedRanks[i]);
            const rank2 = '23456789TJQKA'.indexOf(sortedRanks[i + 1]);
            const gap = rank2 - rank1;
            gaps.push(gap);
            if (gap <= 2) connected++;
        }
        
        if (connected >= 2) {
            texture = 'connected';
            factors = {
                connected: true,
                connectedCount: connected,
                gaps,
                gtoImplications: 'High straight potential, more semi-bluffing'
            };
        } else if (gaps.some(gap => gap <= 1)) {
            texture = 'semi_connected';
            factors = {
                semiConnected: true,
                gaps,
                gtoImplications: 'Moderate straight potential, balanced responses'
            };
        } else {
            texture = 'dry';
            factors = {
                dry: true,
                gaps,
                gtoImplications: 'Low draw potential, polarized responses'
            };
        }
    }
    
    // Add range-specific texture factors
    factors.rangeInteraction = analyzeRangeTextureInteraction(opponentRange, texture, factors);
    
    return { texture, factors };
}

/**
 * Calculate GTO-based adjustments for different board textures
 */
function calculateGTOBoardAdjustments(textureAnalysis, playerAction, opponentRange) {
    const { texture, factors } = textureAnalysis;
    const adjustments = { fold: 0, call: 0, raise: 0 };
    
    switch (texture) {
        case 'dry':
            // Dry boards: More polarized responses, less calling
            adjustments.fold += 0.1;  // +10% fold frequency
            adjustments.call -= 0.15; // -15% call frequency
            adjustments.raise += 0.05; // +5% raise frequency
            break;
            
        case 'suited':
            // Suited boards: More calling with draws, less folding
            adjustments.fold -= 0.15; // -15% fold frequency
            adjustments.call += 0.2;  // +20% call frequency
            adjustments.raise -= 0.05; // -5% raise frequency
            break;
            
        case 'connected':
            // Connected boards: More semi-bluffing, balanced responses
            adjustments.fold -= 0.1;  // -10% fold frequency
            adjustments.call += 0.05; // +5% call frequency
            adjustments.raise += 0.05; // +5% raise frequency
            break;
            
        case 'paired':
            // Paired boards: More cautious, less bluffing
            adjustments.fold += 0.05; // +5% fold frequency
            adjustments.call += 0.05; // +5% call frequency
            adjustments.raise -= 0.1;  // -10% raise frequency
            break;
            
        case 'trips':
            // Trips boards: Very polarized, lots of folding
            adjustments.fold += 0.2;  // +20% fold frequency
            adjustments.call -= 0.1;  // -10% call frequency
            adjustments.raise -= 0.1;  // -10% raise frequency
            break;
    }
    
    // Adjust based on opponent range strength vs board texture
    const rangeStrength = opponentRange.averageStrength || 0.5;
    if (rangeStrength > 0.7 && texture === 'dry') {
        // Strong range on dry board: less folding
        adjustments.fold -= 0.1;
        adjustments.call += 0.1;
    } else if (rangeStrength < 0.3 && texture === 'suited') {
        // Weak range on suited board: more folding
        adjustments.fold += 0.1;
        adjustments.call -= 0.1;
    }
    
    return adjustments;
}

/**
 * Apply street-specific texture adjustments
 */
function applyStreetSpecificTextureAdjustments(textureAnalysis, street, playerAction) {
    const adjustments = { fold: 0, call: 0, raise: 0 };
    const { texture } = textureAnalysis;
    
    if (street === 'flop') {
        // Flop: Texture has moderate impact
        if (texture === 'suited') {
            adjustments.call += 0.05; // More calling with flush draws
        }
    } else if (street === 'turn') {
        // Turn: Texture has stronger impact
        if (texture === 'suited') {
            adjustments.call += 0.1; // Much more calling with flush draws
        } else if (texture === 'dry') {
            adjustments.fold += 0.05; // More folding on dry turn
        }
    } else if (street === 'river') {
        // River: Texture has strongest impact
        if (texture === 'suited') {
            adjustments.call += 0.15; // Very high calling with flush draws
        } else if (texture === 'dry') {
            adjustments.fold += 0.1; // Much more folding on dry river
        }
    }
    
    return adjustments;
}

/**
 * Analyze how opponent range interacts with board texture
 */
function analyzeRangeTextureInteraction(opponentRange, texture, factors) {
    const rangeStrength = opponentRange.averageStrength || 0.5;
    const drawingHands = opponentRange.drawingHandsPercentage || 0;
    
    let interaction = {
        strengthVsTexture: 'neutral',
        drawingPotential: 'low',
        bluffCatchingPotential: 'medium'
    };
    
    // Analyze strength vs texture
    if (texture === 'dry' && rangeStrength > 0.6) {
        interaction.strengthVsTexture = 'strong_vs_dry';
    } else if (texture === 'suited' && drawingHands > 0.3) {
        interaction.strengthVsTexture = 'drawing_vs_suited';
    } else if (texture === 'connected' && rangeStrength < 0.4) {
        interaction.strengthVsTexture = 'weak_vs_connected';
    }
    
    // Analyze drawing potential
    if (drawingHands > 0.4) {
        interaction.drawingPotential = 'high';
    } else if (drawingHands > 0.2) {
        interaction.drawingPotential = 'medium';
    }
    
    // Analyze bluff catching potential
    if (rangeStrength > 0.5 && rangeStrength < 0.8) {
        interaction.bluffCatchingPotential = 'high';
    } else if (rangeStrength < 0.3) {
        interaction.bluffCatchingPotential = 'low';
    }
    
    return interaction;
}

/**
 * Generate explanation for board texture adjustments
 */
function generateBoardTextureExplanation(textureAnalysis, adjustments, playerAction) {
    const { texture, factors } = textureAnalysis;
    const explanations = [];
    
    explanations.push(`Board texture: ${texture}`);
    
    if (factors.gtoImplications) {
        explanations.push(`GTO implications: ${factors.gtoImplications}`);
    }
    
    if (adjustments.fold > 0.05) {
        explanations.push(`Board texture increases fold frequency by ${(adjustments.fold * 100).toFixed(1)}%`);
    } else if (adjustments.fold < -0.05) {
        explanations.push(`Board texture decreases fold frequency by ${(Math.abs(adjustments.fold) * 100).toFixed(1)}%`);
    }
    
    if (adjustments.call > 0.05) {
        explanations.push(`Board texture increases call frequency by ${(adjustments.call * 100).toFixed(1)}%`);
    } else if (adjustments.call < -0.05) {
        explanations.push(`Board texture decreases call frequency by ${(Math.abs(adjustments.call) * 100).toFixed(1)}%`);
    }
    
    if (adjustments.raise > 0.05) {
        explanations.push(`Board texture increases raise frequency by ${(adjustments.raise * 100).toFixed(1)}%`);
    } else if (adjustments.raise < -0.05) {
        explanations.push(`Board texture decreases raise frequency by ${(Math.abs(adjustments.raise) * 100).toFixed(1)}%`);
    }
    
    return explanations.join('. ');
}

module.exports = {
    calculateOverallResponseFrequencies,
    normalizeResponseFrequencies,
    determineResponseProfile,
    calculateConfidenceLevel,
    calculateFoldDominance,
    calculateCallDominance,
    calculateRaiseDominance,
    generateActionRecommendation,
    calculateExpectedValue,
    generateOverallResponseExplanation,
    adjustForBoardTexture,
    analyzeAdvancedBoardTexture,
    calculateGTOBoardAdjustments,
    applyStreetSpecificTextureAdjustments,
    analyzeRangeTextureInteraction,
    generateBoardTextureExplanation
}; 