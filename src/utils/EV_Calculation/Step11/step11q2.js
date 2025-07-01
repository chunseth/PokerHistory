

/**
 * Step 11q2: Apply Adjustments to Base Frequencies
 * Applies the aggregated adjustment factors to base frequencies while ensuring valid ranges.
 * 
 * @param {Object} aggregatedFactors - The aggregated adjustment factors from step 11q1
 * @param {Object} baseFoldFrequency - The base fold frequency from step 11e
 * @param {Object} potOdds - The pot odds analysis from step 11b
 * @param {Object} playerAction - The player's action analysis from step 11a
 * @returns {Object} Adjusted base frequencies analysis
 */
function applyAdjustmentsToBaseFrequencies(aggregatedFactors, baseFoldFrequency, potOdds, playerAction) {
    if (!aggregatedFactors || !aggregatedFactors.success || !baseFoldFrequency) {
        return {
            success: false,
            error: 'Missing required aggregated factors or base fold frequency',
            adjustedFrequencies: null
        };
    }

    const { combinedAdjustmentFactor } = aggregatedFactors.aggregatedFactors;
    const baseFoldFreq = baseFoldFrequency.baseFoldFrequency;

    // Apply the combined adjustment factor to base fold frequency
    let adjustedFoldFrequency = baseFoldFreq * combinedAdjustmentFactor;

    // Apply constraints to keep frequency within valid range (0 to 1)
    const originalAdjustedFold = adjustedFoldFrequency;
    
    if (adjustedFoldFrequency < 0) {
        adjustedFoldFrequency = 0;
    } else if (adjustedFoldFrequency > 1) {
        adjustedFoldFrequency = 1;
    }

    // Calculate how much the adjustment was constrained
    const wasConstrained = adjustedFoldFrequency !== originalAdjustedFold;
    const constraintReason = wasConstrained 
        ? (originalAdjustedFold < 0 ? 'Adjusted below 0, set to 0' : 'Adjusted above 1, set to 1')
        : 'No constraints applied';

    // Calculate the effective adjustment factor (what was actually applied)
    const effectiveAdjustmentFactor = baseFoldFreq > 0 ? adjustedFoldFrequency / baseFoldFreq : 1.0;

    // Determine if this is a reasonable fold frequency based on pot odds
    let potOddsValidation = {
        isValid: true,
        reason: 'Fold frequency is reasonable for given pot odds'
    };

    if (potOdds && potOdds.potOddsRatio) {
        const potOddsRatio = potOdds.potOddsRatio;
        
        // If pot odds are very good (low ratio), fold frequency should be low
        if (potOddsRatio < 0.2 && adjustedFoldFrequency > 0.8) {
            potOddsValidation = {
                isValid: false,
                reason: 'High fold frequency despite very good pot odds'
            };
        }
        
        // If pot odds are very poor (high ratio), fold frequency should be high
        if (potOddsRatio > 0.4 && adjustedFoldFrequency < 0.3) {
            potOddsValidation = {
                isValid: false,
                reason: 'Low fold frequency despite very poor pot odds'
            };
        }
    }

    // Check for action-specific constraints
    let actionConstraints = {
        applied: false,
        reason: 'No action-specific constraints'
    };

    if (playerAction) {
        // All-in situations typically have higher fold frequencies
        if (playerAction.betSizing === 'all-in' && adjustedFoldFrequency < 0.4) {
            actionConstraints = {
                applied: true,
                reason: 'All-in action typically results in higher fold frequency',
                suggestedMinimum: 0.4
            };
        }
        
        // Small bets typically have lower fold frequencies
        if (playerAction.betSizing === 'small' && adjustedFoldFrequency > 0.7) {
            actionConstraints = {
                applied: true,
                reason: 'Small bet sizing typically results in lower fold frequency',
                suggestedMaximum: 0.7
            };
        }
    }

    // Calculate confidence in the adjusted frequency
    let confidenceLevel = aggregatedFactors.aggregatedFactors.confidence.level;
    let confidenceFactors = [...aggregatedFactors.aggregatedFactors.confidence.factors];

    if (wasConstrained) {
        confidenceLevel = 'medium';
        confidenceFactors.push('Frequency was constrained to valid range');
    }

    if (!potOddsValidation.isValid) {
        confidenceLevel = 'low';
        confidenceFactors.push(potOddsValidation.reason);
    }

    if (actionConstraints.applied) {
        confidenceFactors.push(actionConstraints.reason);
    }

    return {
        success: true,
        adjustedFrequencies: {
            baseFoldFrequency: baseFoldFreq,
            adjustedFoldFrequency,
            combinedAdjustmentFactor,
            effectiveAdjustmentFactor,
            adjustmentMagnitude: Math.abs(adjustedFoldFrequency - baseFoldFreq),
            adjustmentDirection: adjustedFoldFrequency > baseFoldFreq ? 'increase' : 'decrease'
        },
        constraints: {
            wasConstrained,
            constraintReason,
            potOddsValidation,
            actionConstraints
        },
        confidence: {
            level: confidenceLevel,
            factors: confidenceFactors
        },
        metadata: {
            originalAdjustment: originalAdjustedFold,
            finalAdjustment: adjustedFoldFrequency,
            adjustmentDelta: adjustedFoldFrequency - originalAdjustedFold
        }
    };
}

module.exports = {
    applyAdjustmentsToBaseFrequencies
}; 