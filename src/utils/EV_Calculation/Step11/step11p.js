/**
 * Step 11p: Generate Response Frequency Summary
 * Creates a comprehensive summary of all response frequency calculations with confidence levels,
 * recommendations, and EV implications for use in the broader EV calculation pipeline.
 * 
 * @param {Object} validatedFrequencies - The validated response frequencies from step 11o
 * @param {Object} playerAction - The player's action analysis from step 11a
 * @param {Object} potOdds - The pot odds analysis from step 11b
 * @param {Object} opponentRange - The opponent's range analysis from step 11c
 * @param {Object} streetPatterns - The street-specific patterns from step 11d
 * @param {Object} baseFoldFrequency - The base fold frequency from step 11e
 * @param {Object} rangeStrengthAdjustment - The range strength adjustment from step 11f
 * @param {Object} positionAdjustment - The position adjustment from step 11g
 * @param {Object} stackDepthAdjustment - The stack depth adjustment from step 11h
 * @param {Object} multiwayAdjustment - The multiway adjustment from step 11i
 * @returns {Object} Comprehensive response frequency summary
 */
function generateResponseFrequencySummary(
    validatedFrequencies,
    playerAction,
    potOdds,
    opponentRange,
    streetPatterns,
    baseFoldFrequency,
    rangeStrengthAdjustment,
    positionAdjustment,
    stackDepthAdjustment,
    multiwayAdjustment
) {
    if (!validatedFrequencies || !validatedFrequencies.isValid) {
        return {
            success: false,
            error: 'Invalid response frequencies provided',
            summary: null
        };
    }

    const { adjustedFrequencies } = validatedFrequencies;
    
    // Calculate confidence level based on data quality
    let confidenceLevel = 'medium';
    let confidenceFactors = [];
    
    if (opponentRange && opponentRange.rangeSize > 50) {
        confidenceLevel = 'high';
        confidenceFactors.push('Large opponent range sample');
    } else if (opponentRange && opponentRange.rangeSize < 10) {
        confidenceLevel = 'low';
        confidenceFactors.push('Small opponent range sample');
    }
    
    if (potOdds && potOdds.potOddsRatio > 0.3) {
        confidenceFactors.push('High pot odds may skew responses');
    }
    
    if (playerAction && playerAction.betSizing === 'all-in') {
        confidenceFactors.push('All-in situation simplifies responses');
        confidenceLevel = 'high';
    }

    // Generate action recommendations based on frequencies
    const recommendations = [];
    
    if (adjustedFrequencies.foldFrequency > 0.7) {
        recommendations.push('High fold frequency suggests bluffing opportunities');
    }
    
    if (adjustedFrequencies.callFrequency > 0.6) {
        recommendations.push('High call frequency suggests value betting with strong hands');
    }
    
    if (adjustedFrequencies.raiseFrequency > 0.3) {
        recommendations.push('Significant raise frequency - be prepared for aggression');
    }

    // Calculate expected value implications
    const evImplications = {
        foldEV: adjustedFrequencies.foldFrequency * (potOdds?.potSizeBeforeAction || 0),
        callEV: adjustedFrequencies.callFrequency * (potOdds?.potSizeBeforeAction || 0),
        raiseEV: adjustedFrequencies.raiseFrequency * (potOdds?.potSizeBeforeAction || 0)
    };

    return {
        success: true,
        summary: {
            // Core frequencies
            responseFrequencies: adjustedFrequencies,
            
            // Context information
            playerAction: {
                type: playerAction?.actionType,
                sizing: playerAction?.betSizing,
                amount: playerAction?.actionAmount,
                context: playerAction?.actionContext
            },
            
            // Pot and odds information
            potAnalysis: {
                potSize: potOdds?.potSizeBeforeAction,
                potOddsRatio: potOdds?.potOddsRatio,
                callAmount: potOdds?.callAmount,
                effectiveStack: potOdds?.effectiveStack
            },
            
            // Opponent analysis
            opponentAnalysis: {
                rangeSize: opponentRange?.rangeSize,
                averageStrength: opponentRange?.averageStrength,
                position: positionAdjustment?.opponentPosition,
                stackDepth: stackDepthAdjustment?.stackDepthRatio
            },
            
            // Street-specific patterns
            streetPatterns: {
                street: streetPatterns?.street,
                typicalFoldRate: streetPatterns?.typicalFoldRate,
                typicalCallRate: streetPatterns?.typicalCallRate,
                typicalRaiseRate: streetPatterns?.typicalRaiseRate
            },
            
            // Adjustments applied
            adjustments: {
                baseFoldFrequency: baseFoldFrequency?.baseFoldFrequency,
                rangeStrengthAdjustment: rangeStrengthAdjustment?.adjustmentFactor,
                positionAdjustment: positionAdjustment?.positionAdjustment,
                stackDepthAdjustment: stackDepthAdjustment?.stackDepthAdjustment,
                multiwayAdjustment: multiwayAdjustment?.multiwayAdjustment
            },
            
            // Analysis quality
            confidence: {
                level: confidenceLevel,
                factors: confidenceFactors
            },
            
            // Recommendations
            recommendations,
            
            // EV implications
            evImplications,
            
            // Validation info
            validation: {
                wasAdjusted: validatedFrequencies.wasAdjusted,
                adjustmentReason: validatedFrequencies.adjustmentReason
            }
        }
    };
}

/**
 * Step 11p: Range vs Range GTO Analysis
 * Advanced analysis that considers how the opponent's range interacts with the player's
 * perceived range to calculate more accurate response frequencies.
 * 
 * @param {Object} playerAction - The player's action analysis from step 11a
 * @param {Object} opponentRange - The opponent's range analysis from step 11c
 * @param {Object} playerRange - The player's perceived range
 * @param {Object} boardTexture - The board texture analysis from step 11n
 * @returns {Object} Range vs range GTO analysis
 */
function calculateRangeVsRangeGTOAnalysis(playerAction, opponentRange, playerRange, boardTexture) {
    if (!playerAction || !opponentRange || !playerRange) {
        return {
            rangeVsRangeFoldFrequency: 0.5,
            rangeVsRangeCallFrequency: 0.3,
            rangeVsRangeRaiseFrequency: 0.2,
            rangeAdvantage: 'neutral',
            rangeInteraction: {},
            explanation: 'Missing input data'
        };
    }

    // Calculate range advantage
    const rangeAdvantage = calculateRangeAdvantage(opponentRange, playerRange, boardTexture);
    
    // Calculate range interaction factors
    const rangeInteraction = calculateRangeInteraction(opponentRange, playerRange, playerAction, boardTexture);
    
    // Calculate GTO response frequencies based on range vs range
    const gtoFrequencies = calculateRangeVsRangeGTOFrequencies(
        rangeAdvantage, 
        rangeInteraction, 
        playerAction, 
        boardTexture
    );
    
    // Apply range-specific adjustments
    const adjustedFrequencies = applyRangeVsRangeAdjustments(gtoFrequencies, rangeInteraction, playerAction);

    return {
        rangeVsRangeFoldFrequency: adjustedFrequencies.fold,
        rangeVsRangeCallFrequency: adjustedFrequencies.call,
        rangeVsRangeRaiseFrequency: adjustedFrequencies.raise,
        rangeAdvantage: rangeAdvantage.advantage,
        rangeInteraction,
        explanation: generateRangeVsRangeExplanation(rangeAdvantage, rangeInteraction, adjustedFrequencies)
    };
}

/**
 * Calculate which range has the advantage
 */
function calculateRangeAdvantage(opponentRange, playerRange, boardTexture) {
    const opponentStrength = opponentRange.averageStrength || 0.5;
    const playerStrength = playerRange.averageStrength || 0.5;
    const texture = boardTexture?.boardTexture || 'dry';
    
    let advantage = 'neutral';
    let advantageScore = 0;
    
    // Calculate base advantage
    if (opponentStrength > playerStrength + 0.2) {
        advantage = 'opponent_strong';
        advantageScore = opponentStrength - playerStrength;
    } else if (playerStrength > opponentStrength + 0.2) {
        advantage = 'player_strong';
        advantageScore = playerStrength - opponentStrength;
    } else {
        advantage = 'neutral';
        advantageScore = Math.abs(opponentStrength - playerStrength);
    }
    
    // Adjust for board texture
    const textureAdjustment = calculateTextureAdvantageAdjustment(opponentRange, playerRange, texture);
    advantageScore += textureAdjustment;
    
    // Adjust for range width
    const widthAdjustment = calculateRangeWidthAdvantage(opponentRange, playerRange);
    advantageScore += widthAdjustment;
    
    return {
        advantage,
        advantageScore,
        opponentStrength,
        playerStrength,
        textureAdjustment,
        widthAdjustment
    };
}

/**
 * Calculate how board texture affects range advantage
 */
function calculateTextureAdvantageAdjustment(opponentRange, playerRange, texture) {
    const opponentDraws = opponentRange.drawingHandsPercentage || 0;
    const playerDraws = playerRange.drawingHandsPercentage || 0;
    
    let adjustment = 0;
    
    if (texture === 'suited') {
        // Suited boards favor ranges with more flush draws
        if (opponentDraws > playerDraws + 0.1) {
            adjustment += 0.1; // Opponent advantage
        } else if (playerDraws > opponentDraws + 0.1) {
            adjustment -= 0.1; // Player advantage
        }
    } else if (texture === 'connected') {
        // Connected boards favor ranges with more straight draws
        if (opponentDraws > playerDraws + 0.1) {
            adjustment += 0.05; // Opponent advantage
        } else if (playerDraws > opponentDraws + 0.1) {
            adjustment -= 0.05; // Player advantage
        }
    } else if (texture === 'dry') {
        // Dry boards favor ranges with more made hands
        const opponentMade = opponentRange.averageStrength || 0.5;
        const playerMade = playerRange.averageStrength || 0.5;
        
        if (opponentMade > playerMade + 0.1) {
            adjustment += 0.1; // Opponent advantage
        } else if (playerMade > opponentMade + 0.1) {
            adjustment -= 0.1; // Player advantage
        }
    }
    
    return adjustment;
}

/**
 * Calculate advantage based on range width
 */
function calculateRangeWidthAdvantage(opponentRange, playerRange) {
    const opponentWidth = opponentRange.rangeSize || 0;
    const playerWidth = playerRange.rangeSize || 0;
    
    // Wider ranges are generally more flexible but may be weaker
    // Narrower ranges are stronger but less flexible
    
    if (opponentWidth > playerWidth * 1.5) {
        return 0.05; // Opponent has wider range (slight advantage)
    } else if (playerWidth > opponentWidth * 1.5) {
        return -0.05; // Player has wider range (slight advantage)
    }
    
    return 0; // Similar range widths
}

/**
 * Calculate range interaction factors
 */
function calculateRangeInteraction(opponentRange, playerRange, playerAction, boardTexture) {
    const interaction = {
        overlap: 0,
        domination: 0,
        blocking: 0,
        drawingPotential: 0,
        nuttedHands: 0
    };
    
    // Calculate range overlap
    interaction.overlap = calculateRangeOverlap(opponentRange, playerRange);
    
    // Calculate range domination
    interaction.domination = calculateRangeDomination(opponentRange, playerRange);
    
    // Calculate blocking effects
    interaction.blocking = calculateBlockingEffects(opponentRange, playerRange, boardTexture);
    
    // Calculate drawing potential comparison
    interaction.drawingPotential = calculateDrawingPotentialComparison(opponentRange, playerRange, boardTexture);
    
    // Calculate nutted hands comparison
    interaction.nuttedHands = calculateNuttedHandsComparison(opponentRange, playerRange, boardTexture);
    
    return interaction;
}

/**
 * Calculate how much ranges overlap
 */
function calculateRangeOverlap(opponentRange, playerRange) {
    // Simplified overlap calculation
    // In a real implementation, this would compare actual hand combinations
    const opponentStrength = opponentRange.averageStrength || 0.5;
    const playerStrength = playerRange.averageStrength || 0.5;
    
    // Ranges with similar strength likely have more overlap
    return 1 - Math.abs(opponentStrength - playerStrength);
}

/**
 * Calculate range domination
 */
function calculateRangeDomination(opponentRange, playerRange) {
    const opponentStrength = opponentRange.averageStrength || 0.5;
    const playerStrength = playerRange.averageStrength || 0.5;
    
    if (opponentStrength > playerStrength + 0.3) {
        return 0.8; // High domination
    } else if (opponentStrength > playerStrength + 0.1) {
        return 0.5; // Moderate domination
    } else if (playerStrength > opponentStrength + 0.3) {
        return -0.8; // Player dominates
    } else if (playerStrength > opponentStrength + 0.1) {
        return -0.5; // Player moderately dominates
    }
    
    return 0; // No domination
}

/**
 * Calculate blocking effects
 */
function calculateBlockingEffects(opponentRange, playerRange, boardTexture) {
    // Simplified blocking calculation
    // In reality, this would analyze specific card removal effects
    
    const texture = boardTexture?.boardTexture || 'dry';
    let blocking = 0;
    
    if (texture === 'suited') {
        // Suited boards: blocking flush draws is important
        blocking = 0.3;
    } else if (texture === 'connected') {
        // Connected boards: blocking straight draws is important
        blocking = 0.2;
    } else {
        // Dry boards: blocking is less important
        blocking = 0.1;
    }
    
    return blocking;
}

/**
 * Calculate drawing potential comparison
 */
function calculateDrawingPotentialComparison(opponentRange, playerRange, boardTexture) {
    const opponentDraws = opponentRange.drawingHandsPercentage || 0;
    const playerDraws = playerRange.drawingHandsPercentage || 0;
    const texture = boardTexture?.boardTexture || 'dry';
    
    let comparison = opponentDraws - playerDraws;
    
    // Weight by texture importance
    if (texture === 'suited') {
        comparison *= 1.5; // Flush draws more important on suited boards
    } else if (texture === 'connected') {
        comparison *= 1.2; // Straight draws more important on connected boards
    } else {
        comparison *= 0.5; // Draws less important on dry boards
    }
    
    return comparison;
}

/**
 * Calculate nutted hands comparison
 */
function calculateNuttedHandsComparison(opponentRange, playerRange, boardTexture) {
    const opponentNutted = opponentRange.nuttedHandsPercentage || 0;
    const playerNutted = playerRange.nuttedHandsPercentage || 0;
    
    return opponentNutted - playerNutted;
}

/**
 * Calculate GTO response frequencies based on range vs range analysis
 */
function calculateRangeVsRangeGTOFrequencies(rangeAdvantage, rangeInteraction, playerAction, boardTexture) {
    const { advantage, advantageScore } = rangeAdvantage;
    const { domination, overlap, blocking } = rangeInteraction;
    const betSizing = playerAction.betSizing;
    
    let foldFreq = 0.5;
    let callFreq = 0.3;
    let raiseFreq = 0.2;
    
    // Base frequencies by advantage
    if (advantage === 'opponent_strong') {
        // Opponent has range advantage - more likely to call/raise
        foldFreq = 0.3;
        callFreq = 0.5;
        raiseFreq = 0.2;
    } else if (advantage === 'player_strong') {
        // Player has range advantage - more likely to fold
        foldFreq = 0.7;
        callFreq = 0.2;
        raiseFreq = 0.1;
    }
    
    // Adjust for domination
    if (domination > 0.5) {
        // Opponent dominates - more calling/raising
        foldFreq -= 0.1;
        callFreq += 0.1;
    } else if (domination < -0.5) {
        // Player dominates - more folding
        foldFreq += 0.1;
        callFreq -= 0.1;
    }
    
    // Adjust for overlap
    if (overlap > 0.7) {
        // High overlap - more balanced responses
        foldFreq = 0.4;
        callFreq = 0.4;
        raiseFreq = 0.2;
    }
    
    // Adjust for bet sizing
    if (betSizing === 'small') {
        // Small bets: ranges matter less
        foldFreq *= 0.8;
        callFreq *= 1.2;
    } else if (betSizing === 'large') {
        // Large bets: ranges matter more
        foldFreq *= 1.2;
        callFreq *= 0.8;
    }
    
    // Normalize
    const total = foldFreq + callFreq + raiseFreq;
    foldFreq /= total;
    callFreq /= total;
    raiseFreq /= total;
    
    return { fold: foldFreq, call: callFreq, raise: raiseFreq };
}

/**
 * Apply range vs range specific adjustments
 */
function applyRangeVsRangeAdjustments(frequencies, rangeInteraction, playerAction) {
    const adjusted = { ...frequencies };
    
    // Adjust for blocking effects
    if (rangeInteraction.blocking > 0.2) {
        // High blocking - opponent may fold more
        adjusted.fold += 0.05;
        adjusted.call -= 0.05;
    }
    
    // Adjust for drawing potential
    if (rangeInteraction.drawingPotential > 0.1) {
        // Opponent has better draws - more calling
        adjusted.fold -= 0.05;
        adjusted.call += 0.05;
    } else if (rangeInteraction.drawingPotential < -0.1) {
        // Player has better draws - more folding
        adjusted.fold += 0.05;
        adjusted.call -= 0.05;
    }
    
    // Adjust for nutted hands
    if (rangeInteraction.nuttedHands > 0.1) {
        // Opponent has more nutted hands - more raising
        adjusted.raise += 0.05;
        adjusted.call -= 0.05;
    } else if (rangeInteraction.nuttedHands < -0.1) {
        // Player has more nutted hands - more folding
        adjusted.fold += 0.05;
        adjusted.raise -= 0.05;
    }
    
    // Normalize again
    const total = adjusted.fold + adjusted.call + adjusted.raise;
    adjusted.fold /= total;
    adjusted.call /= total;
    adjusted.raise /= total;
    
    return adjusted;
}

/**
 * Generate explanation for range vs range analysis
 */
function generateRangeVsRangeExplanation(rangeAdvantage, rangeInteraction, frequencies) {
    const explanations = [];
    
    explanations.push(`Range advantage: ${rangeAdvantage.advantage.replace('_', ' ')}`);
    
    if (rangeAdvantage.advantageScore > 0.1) {
        explanations.push(`Opponent has significant range advantage (${(rangeAdvantage.advantageScore * 100).toFixed(1)}%)`);
    } else if (rangeAdvantage.advantageScore < -0.1) {
        explanations.push(`Player has significant range advantage (${(Math.abs(rangeAdvantage.advantageScore) * 100).toFixed(1)}%)`);
    } else {
        explanations.push('Ranges are relatively balanced');
    }
    
    if (rangeInteraction.domination > 0.5) {
        explanations.push('Opponent range dominates player range');
    } else if (rangeInteraction.domination < -0.5) {
        explanations.push('Player range dominates opponent range');
    }
    
    if (rangeInteraction.overlap > 0.7) {
        explanations.push('High range overlap suggests balanced responses');
    }
    
    explanations.push(`Range vs range frequencies: ${(frequencies.fold * 100).toFixed(1)}% fold, ${(frequencies.call * 100).toFixed(1)}% call, ${(frequencies.raise * 100).toFixed(1)}% raise`);
    
    return explanations.join('. ');
}

module.exports = {
    generateResponseFrequencySummary,
    calculateRangeVsRangeGTOAnalysis
}; 