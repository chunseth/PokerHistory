/**
 * Step 11l: Adjust Raise Frequencies for Bet Sizing
 * Adjusts the raise frequency based on the size of the bet faced using GTO principles:
 * - Minimum Defense Frequency (MDF) calculations
 * - Range strength from step 11c
 * - Polarization adjustments based on bet sizing
 * 
 * @param {Object} betInfo - Information about the bet
 * @param {number} betInfo.betSize - The size of the bet in big blinds
 * @param {number} betInfo.potSize - The size of the pot before the bet
 * @param {boolean} betInfo.isAllIn - Whether the bet is all-in
 * @param {string} betInfo.betSizing - Classification of bet size ('small', 'medium', 'large', 'very_large', 'all_in')
 * @param {number} currentRaiseFreq - Current raise frequency (0-1)
 * @param {Object} rangeStrength - Range strength analysis from step 11c
 * @returns {Object} Adjusted raise frequency and explanation
 */
function adjustRaiseFrequencyForBetSizing(betInfo, currentRaiseFreq, rangeStrength) {
    if (!betInfo || typeof currentRaiseFreq !== 'number' || !rangeStrength) {
        return {
            raiseFreq: 0,
            mdf: 0,
            explanation: 'Missing input data (betInfo, currentRaiseFreq, or rangeStrength)'
        };
    }

    const { betSize, potSize, isAllIn, betSizing } = betInfo;

    // Calculate Minimum Defense Frequency (MDF)
    const mdf = calculateMDF(betSize, potSize);
    
    // Handle all-in bets - no raise frequency possible
    if (isAllIn) {
        return {
            raiseFreq: 0,
            mdf: mdf,
            explanation: `All-in bet: No raise frequency possible. MDF: ${(mdf * 100).toFixed(1)}%`
        };
    }

    // Calculate range-based adjustments
    const rangeAdjustments = calculateRangeBasedAdjustments(rangeStrength, betSizing, mdf);
    
    // Apply bet sizing adjustments to raise frequency
    const betSizingAdjustments = calculateBetSizingAdjustments(betSizing, betSize, potSize, rangeStrength);
    
    // Calculate adjusted raise frequency
    const adjustedRaiseFreq = calculateAdjustedRaiseFrequency(
        currentRaiseFreq, 
        rangeAdjustments, 
        betSizingAdjustments, 
        rangeStrength
    );

    // Generate explanation
    const explanation = generateRaiseFrequencyExplanation({
        mdf,
        betSizing,
        betSize,
        potSize,
        rangeStrength,
        rangeAdjustments,
        betSizingAdjustments,
        originalRaiseFreq: currentRaiseFreq,
        adjustedRaiseFreq
    });

    return {
        raiseFreq: adjustedRaiseFreq,
        mdf,
        rangeAdjustments,
        betSizingAdjustments,
        explanation
    };
}

/**
 * Calculate Minimum Defense Frequency based on bet sizing
 * MDF = bet_size / (pot_size + bet_size)
 */
function calculateMDF(betSize, potSize) {
    if (betSize <= 0 || potSize <= 0) return 0;
    return betSize / (potSize + betSize);
}

/**
 * Calculate range-based adjustments using opponent's range strength
 */
function calculateRangeBasedAdjustments(rangeStrength, betSizing, mdf) {
    const { 
        strongHandsPercentage, 
        weakHandsPercentage, 
        averageStrength,
        strengthCategory,
        drawingHandsPercentage 
    } = rangeStrength;

    let rangeMultiplier = 1.0;
    let explanation = [];

    // Adjust based on overall range strength
    if (strengthCategory === 'strong') {
        rangeMultiplier *= 1.3; // Strong ranges raise more
        explanation.push('Strong range: +30% raise frequency');
    } else if (strengthCategory === 'weak') {
        rangeMultiplier *= 0.7; // Weak ranges raise less
        explanation.push('Weak range: -30% raise frequency');
    } else {
        explanation.push('Medium range: baseline raise frequency');
    }

    // Adjust based on range polarization
    const polarization = strongHandsPercentage + weakHandsPercentage;
    if (polarization > 0.7) {
        rangeMultiplier *= 1.1; // Polarized ranges raise more
        explanation.push('Polarized range: +10% raise frequency');
    }

    // Adjust based on drawing hands
    if (drawingHandsPercentage > 0.2) {
        rangeMultiplier *= 1.05; // More draws = more semi-bluff raises
        explanation.push('High draw density: +5% raise frequency');
    }

    return {
        multiplier: Math.max(0.3, Math.min(2.0, rangeMultiplier)),
        explanation: explanation.join(', ')
    };
}

/**
 * Calculate bet sizing specific adjustments based on GTO principles
 */
function calculateBetSizingAdjustments(betSizing, betSize, potSize, rangeStrength) {
    const betToPotRatio = betSize / potSize;
    let sizingMultiplier = 1.0;
    let explanation = [];

    // GTO-based bet sizing adjustments (matching step11a categories)
    switch (betSizing) {
        case 'small': // ≤ 33% pot
            // Small bets allow more frequent raises with wider range
            sizingMultiplier = 1.4;
            explanation.push('Small bet: easier to raise with wider range');
            break;

        case 'medium': // 33-100% pot  
            // Medium bets have moderate raise frequency
            sizingMultiplier = 1.0;
            explanation.push('Medium bet: standard raise frequency');
            break;

        case 'large': // 100-200% pot
            // Large bets polarize responses - raise with strong hands only
            sizingMultiplier = 0.6;
            explanation.push('Large bet: polarized response, fewer raises');
            break;

        case 'very_large': // > 200% pot
            // Very large bets heavily polarize - mostly fold or strong raises
            sizingMultiplier = 0.4;
            explanation.push('Very large bet: heavily polarized, very few raises');
            break;

        case 'all_in':
            // All-in bets should have 0 raise frequency
            sizingMultiplier = 0;
            explanation.push('All-in bet: no raise frequency possible');
            break;

        default:
            explanation.push('Unknown bet sizing');
    }

    // Additional fine-tuning based on exact ratio
    if (betToPotRatio > 3.0) {
        sizingMultiplier *= 0.7; // Extremely large bets reduce raises further
        explanation.push('Extremely large bet-to-pot ratio');
    } else if (betToPotRatio < 0.2) {
        sizingMultiplier *= 1.2; // Very small bets increase raises
        explanation.push('Very small bet-to-pot ratio');
    }

    return {
        multiplier: Math.max(0, Math.min(3.0, sizingMultiplier)),
        explanation: explanation.join(', ')
    };
}

/**
 * Calculate the final adjusted raise frequency
 */
function calculateAdjustedRaiseFrequency(baseRaiseFreq, rangeAdjustments, betSizingAdjustments, rangeStrength) {
    // Apply both range and sizing adjustments
    let adjustedRaiseFreq = baseRaiseFreq * rangeAdjustments.multiplier * betSizingAdjustments.multiplier;
    
    // Cap raise frequency based on strong hands percentage
    const maxRaiseFreq = Math.min(0.8, rangeStrength.strongHandsPercentage + 0.1);
    adjustedRaiseFreq = Math.min(adjustedRaiseFreq, maxRaiseFreq);
    
    // Ensure minimum raise frequency with very strong ranges
    if (rangeStrength.strongHandsPercentage > 0.4) {
        adjustedRaiseFreq = Math.max(adjustedRaiseFreq, 0.05);
    }
    
    return Math.max(0, Math.min(0.8, adjustedRaiseFreq));
}

/**
 * Generate explanation for raise frequency adjustments
 */
function generateRaiseFrequencyExplanation(data) {
    const { mdf, betSizing, betSize, potSize, rangeStrength, rangeAdjustments, betSizingAdjustments, originalRaiseFreq, adjustedRaiseFreq } = data;
    
    const explanations = [];
    
    // MDF explanation
    const betToPotRatio = ((betSize / potSize) * 100).toFixed(1);
    explanations.push(`MDF: ${(mdf * 100).toFixed(1)}% (${betToPotRatio}% pot bet)`);
    
    // Range strength context
    explanations.push(`Range: ${rangeStrength.strengthCategory} (${(rangeStrength.averageStrength * 100).toFixed(1)}% avg strength)`);
    explanations.push(`Strong hands: ${(rangeStrength.strongHandsPercentage * 100).toFixed(1)}%`);
    
    // Adjustments applied
    if (rangeAdjustments.explanation) {
        explanations.push(`Range adj: ${rangeAdjustments.explanation}`);
    }
    if (betSizingAdjustments.explanation) {
        explanations.push(`Sizing adj: ${betSizingAdjustments.explanation}`);
    }
    
    // Raise frequency change
    explanations.push(`Raise frequency: ${(originalRaiseFreq * 100).toFixed(1)}% → ${(adjustedRaiseFreq * 100).toFixed(1)}%`);
    
    return explanations.join('. ');
}

module.exports = {
    adjustRaiseFrequencyForBetSizing,
    calculateMDF,
    calculateRangeBasedAdjustments,
    calculateBetSizingAdjustments,
    calculateAdjustedRaiseFrequency,
    generateRaiseFrequencyExplanation
}; 