/**
 * Step 11q3: Calculate Call Frequency from Fold Frequency
 * Calculates call frequency using the relationship: call = 1 - fold - raise, with adjustments for context.
 * 
 * @param {Object} adjustedFrequencies - The adjusted frequencies from step 11q2
 * @param {Object} potOdds - The pot odds analysis from step 11b
 * @param {Object} opponentRange - The opponent's range analysis from step 11c
 * @param {Object} streetPatterns - The street-specific patterns from step 11d
 * @param {Object} playerAction - The player's action analysis from step 11a
 * @returns {Object} Call frequency calculation analysis
 */
function calculateCallFrequencyFromFoldFrequency(
    adjustedFrequencies,
    potOdds,
    opponentRange,
    streetPatterns,
    playerAction
) {
    if (!adjustedFrequencies || !adjustedFrequencies.success) {
        return {
            success: false,
            error: 'Missing adjusted frequencies from previous step',
            callFrequency: null
        };
    }

    const adjustedFoldFreq = adjustedFrequencies.adjustedFrequencies.adjustedFoldFrequency;

    // Start with the basic relationship: call = 1 - fold - raise
    // We'll estimate raise frequency first, then calculate call
    let estimatedRaiseFrequency = 0.0;

    // Estimate raise frequency based on opponent range strength
    if (opponentRange && opponentRange.averageStrength) {
        const rangeStrength = opponentRange.averageStrength;
        
        // Stronger ranges are more likely to raise
        if (rangeStrength === 'very_strong') {
            estimatedRaiseFrequency = 0.25;
        } else if (rangeStrength === 'strong') {
            estimatedRaiseFrequency = 0.15;
        } else if (rangeStrength === 'medium') {
            estimatedRaiseFrequency = 0.10;
        } else if (rangeStrength === 'weak') {
            estimatedRaiseFrequency = 0.05;
        } else {
            estimatedRaiseFrequency = 0.08; // very_weak or unknown
        }
    }

    // Adjust raise frequency based on pot odds
    if (potOdds && potOdds.potOddsRatio) {
        const potOddsRatio = potOdds.potOddsRatio;
        
        // Better pot odds (lower ratio) make raising more attractive
        if (potOddsRatio < 0.2) {
            estimatedRaiseFrequency *= 1.5; // 50% increase
        } else if (potOddsRatio > 0.4) {
            estimatedRaiseFrequency *= 0.5; // 50% decrease
        }
    }

    // Adjust for street-specific patterns
    if (streetPatterns && streetPatterns.typicalRaiseRate) {
        const streetRaiseRate = streetPatterns.typicalRaiseRate;
        estimatedRaiseFrequency = (estimatedRaiseFrequency + streetRaiseRate) / 2;
    }

    // Adjust for bet sizing
    if (playerAction && playerAction.betSizing) {
        switch (playerAction.betSizing) {
            case 'small':
                estimatedRaiseFrequency *= 1.3; // Small bets invite more raises
                break;
            case 'medium':
                estimatedRaiseFrequency *= 1.0; // No adjustment
                break;
            case 'large':
                estimatedRaiseFrequency *= 0.7; // Large bets discourage raises
                break;
            case 'all-in':
                estimatedRaiseFrequency *= 0.3; // All-ins rarely get raised
                break;
        }
    }

    // Ensure raise frequency is reasonable
    estimatedRaiseFrequency = Math.max(0, Math.min(0.4, estimatedRaiseFrequency));

    // Calculate call frequency: call = 1 - fold - raise
    let callFrequency = 1 - adjustedFoldFreq - estimatedRaiseFrequency;

    // Apply constraints to call frequency
    const originalCallFreq = callFrequency;
    
    if (callFrequency < 0) {
        callFrequency = 0;
    } else if (callFrequency > 1) {
        callFrequency = 1;
    }

    // If call frequency is negative, adjust raise frequency down
    if (originalCallFreq < 0) {
        estimatedRaiseFrequency = Math.max(0, 1 - adjustedFoldFreq);
        callFrequency = 0;
    }

    // Validate call frequency against pot odds
    let potOddsValidation = {
        isValid: true,
        reason: 'Call frequency is reasonable for given pot odds'
    };

    if (potOdds && potOdds.potOddsRatio) {
        const potOddsRatio = potOdds.potOddsRatio;
        
        // If pot odds are very good, call frequency should be higher
        if (potOddsRatio < 0.2 && callFrequency < 0.3) {
            potOddsValidation = {
                isValid: false,
                reason: 'Low call frequency despite very good pot odds'
            };
        }
        
        // If pot odds are very poor, call frequency should be lower
        if (potOddsRatio > 0.4 && callFrequency > 0.7) {
            potOddsValidation = {
                isValid: false,
                reason: 'High call frequency despite very poor pot odds'
            };
        }
    }

    // Calculate confidence in call frequency
    let confidenceLevel = 'medium';
    let confidenceFactors = [];

    if (Math.abs(originalCallFreq - callFrequency) > 0.1) {
        confidenceLevel = 'low';
        confidenceFactors.push('Call frequency was significantly constrained');
    }

    if (!potOddsValidation.isValid) {
        confidenceLevel = 'low';
        confidenceFactors.push(potOddsValidation.reason);
    }

    if (estimatedRaiseFrequency > 0.3) {
        confidenceFactors.push('High estimated raise frequency may affect accuracy');
    }

    return {
        success: true,
        callFrequency: {
            foldFrequency: adjustedFoldFreq,
            callFrequency,
            raiseFrequency: estimatedRaiseFrequency,
            totalFrequency: adjustedFoldFreq + callFrequency + estimatedRaiseFrequency
        },
        calculations: {
            estimatedRaiseFrequency,
            originalCallFrequency: originalCallFreq,
            wasConstrained: originalCallFreq !== callFrequency,
            constraintReason: originalCallFreq < 0 ? 'Call frequency was negative, adjusted raise frequency' : 'No constraints applied'
        },
        validation: {
            potOddsValidation,
            frequencySum: adjustedFoldFreq + callFrequency + estimatedRaiseFrequency,
            isValidSum: Math.abs((adjustedFoldFreq + callFrequency + estimatedRaiseFrequency) - 1.0) < 0.01
        },
        confidence: {
            level: confidenceLevel,
            factors: confidenceFactors
        }
    };
}

/**
 * Independent Call Frequency Calculation
 * Calculates call frequency directly based on pot odds, opponent range, and context
 * to verify the derived calculation from fold and raise frequencies.
 * 
 * @param {Object} potOdds - The pot odds analysis from step 11b
 * @param {Object} opponentRange - The opponent's range analysis from step 11c
 * @param {Object} playerAction - The player's action analysis from step 11a
 * @param {Object} streetPatterns - The street-specific patterns from step 11d
 * @returns {Object} Independent call frequency calculation
 */
function calculateIndependentCallFrequency(potOdds, opponentRange, playerAction, streetPatterns) {
    if (!potOdds || !opponentRange) {
        return {
            success: false,
            error: 'Missing required pot odds or opponent range data',
            independentCallFrequency: null
        };
    }

    let callFrequency = 0.5; // Start with neutral 50% baseline

    // 1. Pot Odds Based Calculation
    if (potOdds.potOddsRatio) {
        const potOddsRatio = potOdds.potOddsRatio;
        
        // GTO-inspired pot odds adjustments
        if (potOddsRatio < 0.15) {
            callFrequency = 0.85; // Very good odds - call most of the time
        } else if (potOddsRatio < 0.25) {
            callFrequency = 0.70; // Good odds - call frequently
        } else if (potOddsRatio < 0.35) {
            callFrequency = 0.50; // Neutral odds
        } else if (potOddsRatio < 0.45) {
            callFrequency = 0.30; // Poor odds - call less frequently
        } else {
            callFrequency = 0.15; // Very poor odds - rarely call
        }
    }

    // 2. Opponent Range Strength Adjustment
    if (opponentRange.averageStrength) {
        const rangeStrength = opponentRange.averageStrength;
        let rangeAdjustment = 0;
        
        switch (rangeStrength) {
            case 'very_strong':
                rangeAdjustment = -0.20; // Strong ranges call less (they raise more)
                break;
            case 'strong':
                rangeAdjustment = -0.10;
                break;
            case 'medium':
                rangeAdjustment = 0.0;
                break;
            case 'weak':
                rangeAdjustment = 0.10;
                break;
            case 'very_weak':
                rangeAdjustment = 0.20; // Weak ranges call more (they fold less)
                break;
        }
        
        callFrequency += rangeAdjustment;
    }

    // 3. Street-Specific Adjustments
    if (streetPatterns && streetPatterns.street) {
        const street = streetPatterns.street;
        
        switch (street) {
            case 'flop':
                callFrequency *= 1.1; // Slightly higher call frequency on flop
                break;
            case 'turn':
                callFrequency *= 1.0; // Neutral on turn
                break;
            case 'river':
                callFrequency *= 0.9; // Lower call frequency on river (more polarized)
                break;
        }
    }

    // 4. Bet Sizing Adjustments
    if (playerAction && playerAction.betSizing) {
        switch (playerAction.betSizing) {
            case 'small':
                callFrequency *= 1.3; // Small bets get called more
                break;
            case 'medium':
                callFrequency *= 1.0; // No adjustment
                break;
            case 'large':
                callFrequency *= 0.7; // Large bets get called less
                break;
            case 'all-in':
                callFrequency *= 0.4; // All-ins get called much less
                break;
        }
    }

    // 5. Position Adjustments
    if (playerAction && playerAction.position) {
        const position = playerAction.position;
        
        if (position === 'out_of_position') {
            callFrequency *= 0.9; // OOP players call less
        } else if (position === 'in_position') {
            callFrequency *= 1.1; // IP players call more
        }
    }

    // 6. Stack Depth Adjustments
    if (potOdds.stackDepthRatio) {
        const stackDepth = potOdds.stackDepthRatio;
        
        if (stackDepth < 0.5) {
            callFrequency *= 0.8; // Shallow stacks call less
        } else if (stackDepth > 2.0) {
            callFrequency *= 1.2; // Deep stacks call more
        }
    }

    // Constrain to valid range
    callFrequency = Math.max(0, Math.min(1, callFrequency));

    // Calculate confidence in independent calculation
    let confidenceLevel = 'medium';
    let confidenceFactors = [];

    if (potOdds.potOddsRatio && (potOdds.potOddsRatio < 0.2 || potOdds.potOddsRatio > 0.4)) {
        confidenceLevel = 'high';
        confidenceFactors.push('Clear pot odds situation');
    }

    if (opponentRange.averageStrength && (opponentRange.averageStrength === 'very_strong' || opponentRange.averageStrength === 'very_weak')) {
        confidenceFactors.push('Clear opponent range strength');
    }

    if (playerAction.betSizing === 'all-in' || playerAction.betSizing === 'small') {
        confidenceFactors.push('Clear bet sizing implications');
    }

    return {
        success: true,
        independentCallFrequency: {
            callFrequency,
            calculationMethod: 'independent',
            confidence: {
                level: confidenceLevel,
                factors: confidenceFactors
            }
        },
        breakdown: {
            potOddsContribution: potOdds.potOddsRatio ? 'significant' : 'none',
            rangeStrengthContribution: opponentRange.averageStrength ? 'moderate' : 'none',
            streetContribution: streetPatterns?.street ? 'minor' : 'none',
            betSizingContribution: playerAction?.betSizing ? 'moderate' : 'none',
            positionContribution: playerAction?.position ? 'minor' : 'none',
            stackDepthContribution: potOdds.stackDepthRatio ? 'minor' : 'none'
        }
    };
}

/**
 * Verify Call Frequency Calculation
 * Compares the derived call frequency with the independent calculation to verify accuracy.
 * 
 * @param {Object} derivedCallFrequency - The call frequency from step 11q3
 * @param {Object} independentCallFrequency - The independent call frequency calculation
 * @returns {Object} Verification analysis
 */
function verifyCallFrequencyCalculation(derivedCallFrequency, independentCallFrequency) {
    if (!derivedCallFrequency || !derivedCallFrequency.success || 
        !independentCallFrequency || !independentCallFrequency.success) {
        return {
            success: false,
            error: 'Missing required call frequency calculations',
            verification: null
        };
    }

    const derivedFreq = derivedCallFrequency.callFrequency.callFrequency;
    const independentFreq = independentCallFrequency.independentCallFrequency.callFrequency;
    
    const difference = Math.abs(derivedFreq - independentFreq);
    const percentageDifference = (difference / independentFreq) * 100;

    // Determine if the calculations are consistent
    let consistencyLevel = 'high';
    let consistencyReason = 'Calculations are very close';

    if (difference > 0.2) {
        consistencyLevel = 'low';
        consistencyReason = 'Large discrepancy between calculations';
    } else if (difference > 0.1) {
        consistencyLevel = 'medium';
        consistencyReason = 'Moderate discrepancy between calculations';
    }

    // Determine which calculation to trust more
    let trustedCalculation = 'derived';
    let trustReason = 'Derived calculation considers all three frequencies';

    const derivedConfidence = derivedCallFrequency.confidence.level;
    const independentConfidence = independentCallFrequency.independentCallFrequency.confidence.level;

    if (independentConfidence === 'high' && derivedConfidence === 'low') {
        trustedCalculation = 'independent';
        trustReason = 'Independent calculation has higher confidence';
    } else if (independentConfidence === 'low' && derivedConfidence === 'high') {
        trustedCalculation = 'derived';
        trustReason = 'Derived calculation has higher confidence';
    }

    return {
        success: true,
        verification: {
            derivedFrequency: derivedFreq,
            independentFrequency: independentFreq,
            difference,
            percentageDifference: percentageDifference.toFixed(2) + '%',
            consistency: {
                level: consistencyLevel,
                reason: consistencyReason
            },
            trustedCalculation,
            trustReason,
            recommendedAction: consistencyLevel === 'low' ? 'review_calculations' : 'proceed_with_trusted'
        },
        analysis: {
            derivedConfidence,
            independentConfidence,
            confidenceComparison: derivedConfidence === independentConfidence ? 'equal' : 
                                (derivedConfidence === 'high' ? 'derived_higher' : 'independent_higher')
        }
    };
}

module.exports = {
    calculateCallFrequencyFromFoldFrequency,
    calculateIndependentCallFrequency,
    verifyCallFrequencyCalculation
}; 