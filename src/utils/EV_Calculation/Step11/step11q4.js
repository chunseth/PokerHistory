/**
 * Step 11q4: Calculate Raise Frequency Based on Context
 * Calculates raise frequency based on opponent's range strength, position, stack depth, and street patterns.
 * 
 * @param {Object} callFrequencyResult - The call frequency result from step 11q3
 * @param {Object} opponentRange - The opponent's range analysis from step 11c
 * @param {Object} potOdds - The pot odds analysis from step 11b
 * @param {Object} playerAction - The player's action analysis from step 11a
 * @param {Object} streetPatterns - The street-specific patterns from step 11d
 * @param {Object} positionAdjustment - The position adjustment from step 11g
 * @param {Object} stackDepthAdjustment - The stack depth adjustment from step 11h
 * @returns {Object} Raise frequency calculation analysis
 */
function calculateRaiseFrequencyBasedOnContext(
    callFrequencyResult,
    opponentRange,
    potOdds,
    playerAction,
    streetPatterns,
    positionAdjustment,
    stackDepthAdjustment
) {
    if (!callFrequencyResult || !callFrequencyResult.success) {
        return {
            success: false,
            error: 'Missing call frequency result from previous step',
            raiseFrequency: null
        };
    }

    let raiseFrequency = 0.0; // Start with baseline

    // 1. Base raise frequency from opponent range strength
    if (opponentRange && opponentRange.averageStrength) {
        const rangeStrength = opponentRange.averageStrength;
        
        switch (rangeStrength) {
            case 'very_strong':
                raiseFrequency = 0.35; // Very strong ranges raise frequently
                break;
            case 'strong':
                raiseFrequency = 0.25; // Strong ranges raise often
                break;
            case 'medium':
                raiseFrequency = 0.15; // Medium ranges raise occasionally
                break;
            case 'weak':
                raiseFrequency = 0.08; // Weak ranges rarely raise
                break;
            case 'very_weak':
                raiseFrequency = 0.03; // Very weak ranges almost never raise
                break;
            default:
                raiseFrequency = 0.12; // Default for unknown strength
        }
    }

    // 2. Pot odds adjustment
    if (potOdds && potOdds.potOddsRatio) {
        const potOddsRatio = potOdds.potOddsRatio;
        
        // Better pot odds make raising more attractive
        if (potOddsRatio < 0.15) {
            raiseFrequency *= 1.8; // Very good odds - raise much more
        } else if (potOddsRatio < 0.25) {
            raiseFrequency *= 1.4; // Good odds - raise more
        } else if (potOddsRatio < 0.35) {
            raiseFrequency *= 1.1; // Neutral odds - slight increase
        } else if (potOddsRatio < 0.45) {
            raiseFrequency *= 0.8; // Poor odds - raise less
        } else {
            raiseFrequency *= 0.5; // Very poor odds - rarely raise
        }
    }

    // 3. Street-specific adjustments
    if (streetPatterns && streetPatterns.street) {
        const street = streetPatterns.street;
        
        switch (street) {
            case 'flop':
                raiseFrequency *= 0.8; // Less raising on flop (more calling)
                break;
            case 'turn':
                raiseFrequency *= 1.1; // More raising on turn
                break;
            case 'river':
                raiseFrequency *= 1.3; // Most raising on river (polarized)
                break;
        }
    }

    // 4. Position adjustments
    if (positionAdjustment && positionAdjustment.opponentPosition) {
        const position = positionAdjustment.opponentPosition;
        
        switch (position) {
            case 'button':
                raiseFrequency *= 1.4; // Button raises more
                break;
            case 'cutoff':
                raiseFrequency *= 1.2; // Cutoff raises more
                break;
            case 'middle':
                raiseFrequency *= 1.0; // Middle position neutral
                break;
            case 'early':
                raiseFrequency *= 0.7; // Early position raises less
                break;
            case 'blinds':
                raiseFrequency *= 0.9; // Blinds raise slightly less
                break;
        }
    }

    // 5. Stack depth adjustments
    if (stackDepthAdjustment && stackDepthAdjustment.stackDepthRatio) {
        const stackDepth = stackDepthAdjustment.stackDepthRatio;
        
        if (stackDepth < 0.5) {
            raiseFrequency *= 0.6; // Shallow stacks raise less
        } else if (stackDepth < 1.0) {
            raiseFrequency *= 0.8; // Medium stacks raise less
        } else if (stackDepth > 2.0) {
            raiseFrequency *= 1.3; // Deep stacks raise more
        } else if (stackDepth > 3.0) {
            raiseFrequency *= 1.5; // Very deep stacks raise much more
        }
    }

    // 6. Bet sizing adjustments
    if (playerAction && playerAction.betSizing) {
        switch (playerAction.betSizing) {
            case 'small':
                raiseFrequency *= 1.6; // Small bets get raised more
                break;
            case 'medium':
                raiseFrequency *= 1.0; // No adjustment
                break;
            case 'large':
                raiseFrequency *= 0.5; // Large bets get raised less
                break;
            case 'all-in':
                raiseFrequency *= 0.1; // All-ins almost never get raised
                break;
        }
    }

    // 7. Multiway vs heads-up adjustments
    if (playerAction && playerAction.isMultiway) {
        if (playerAction.isMultiway) {
            raiseFrequency *= 0.7; // Multiway pots have less raising
        } else {
            raiseFrequency *= 1.2; // Heads-up pots have more raising
        }
    }

    // 8. Action type adjustments
    if (playerAction && playerAction.actionType) {
        switch (playerAction.actionType) {
            case 'bet':
                raiseFrequency *= 1.0; // Standard for bets
                break;
            case 'raise':
                raiseFrequency *= 0.8; // Less raising to raises (3-betting)
                break;
            case 'check':
                raiseFrequency *= 1.5; // More raising to checks (check-raising)
                break;
        }
    }

    // Constrain raise frequency to reasonable bounds
    const originalRaiseFreq = raiseFrequency;
    raiseFrequency = Math.max(0, Math.min(0.6, raiseFrequency)); // Cap at 60%

    // Calculate confidence in raise frequency
    let confidenceLevel = 'medium';
    let confidenceFactors = [];

    if (opponentRange && opponentRange.averageStrength && 
        (opponentRange.averageStrength === 'very_strong' || opponentRange.averageStrength === 'very_weak')) {
        confidenceLevel = 'high';
        confidenceFactors.push('Clear opponent range strength');
    }

    if (potOdds && potOdds.potOddsRatio && (potOdds.potOddsRatio < 0.2 || potOdds.potOddsRatio > 0.4)) {
        confidenceFactors.push('Clear pot odds situation');
    }

    if (playerAction && playerAction.betSizing === 'all-in') {
        confidenceLevel = 'high';
        confidenceFactors.push('All-in situation simplifies raise frequency');
    }

    if (originalRaiseFreq !== raiseFrequency) {
        confidenceFactors.push('Raise frequency was constrained to reasonable bounds');
    }

    // Validate against call frequency
    const callFreq = callFrequencyResult.callFrequency.callFrequency;
    const foldFreq = callFrequencyResult.callFrequency.foldFrequency;
    const totalFreq = foldFreq + callFreq + raiseFrequency;

    let validationResult = {
        isValid: true,
        reason: 'Frequencies sum to approximately 1.0'
    };

    if (Math.abs(totalFreq - 1.0) > 0.05) {
        validationResult = {
            isValid: false,
            reason: `Frequencies sum to ${totalFreq.toFixed(3)}, not 1.0`
        };
        confidenceLevel = 'low';
        confidenceFactors.push('Frequency sum validation failed');
    }

    return {
        success: true,
        raiseFrequency: {
            foldFrequency: foldFreq,
            callFrequency: callFreq,
            raiseFrequency,
            totalFrequency: totalFreq,
            originalRaiseFrequency: originalRaiseFreq,
            wasConstrained: originalRaiseFreq !== raiseFrequency
        },
        calculations: {
            baseRaiseFrequency: opponentRange?.averageStrength ? 'calculated' : 'estimated',
            adjustments: {
                potOdds: potOdds?.potOddsRatio ? 'applied' : 'none',
                street: streetPatterns?.street ? 'applied' : 'none',
                position: positionAdjustment?.opponentPosition ? 'applied' : 'none',
                stackDepth: stackDepthAdjustment?.stackDepthRatio ? 'applied' : 'none',
                betSizing: playerAction?.betSizing ? 'applied' : 'none',
                multiway: playerAction?.isMultiway !== undefined ? 'applied' : 'none',
                actionType: playerAction?.actionType ? 'applied' : 'none'
            }
        },
        validation: validationResult,
        confidence: {
            level: confidenceLevel,
            factors: confidenceFactors
        }
    };
}

module.exports = {
    calculateRaiseFrequencyBasedOnContext
}; 