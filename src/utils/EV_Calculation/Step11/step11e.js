/**
 * Step 11e: Calculate Base Fold Frequency
 * Determines the base fold frequency based on GTO-inspired principles and bet sizing.
 * 
 * @param {Object} playerAction - The action analysis from step 11a
 * @param {Object} potOdds - The pot odds analysis from step 11b
 * @param {Object} opponentRange - The opponent's range analysis from step 11c
 * @param {Object} streetPatterns - The street-specific patterns from step 11d
 * @returns {Object} Base fold frequency analysis
 */
function calculateBaseFoldFrequency(playerAction, potOdds, opponentRange, streetPatterns) {
    if (!playerAction || !potOdds || !opponentRange || !streetPatterns) {
        return {
            baseFoldFrequency: 0.5,
            gtoFoldFrequency: 0.5,
            betSizingFoldFrequency: 0.5,
            potOddsFoldFrequency: 0.5,
            rangeStrengthFoldFrequency: 0.5,
            finalFoldFrequency: 0.5,
            foldFrequencyFactors: {},
            explanation: 'Missing input data'
        };
    }

    // Calculate GTO-inspired base fold frequency
    const gtoFoldFrequency = calculateGTOFoldFrequency(playerAction, potOdds);
    
    // Calculate bet sizing specific fold frequency
    const betSizingFoldFrequency = calculateBetSizingFoldFrequency(playerAction, potOdds);
    
    // Calculate pot odds based fold frequency
    const potOddsFoldFrequency = calculatePotOddsFoldFrequency(potOdds, opponentRange);
    
    // Calculate range strength based fold frequency
    const rangeStrengthFoldFrequency = calculateRangeStrengthFoldFrequency(opponentRange, playerAction);
    
    // Helper to guarantee numeric value
    const safe = (v, d = 0.5) => (Number.isFinite(v) ? v : d);

    // Sanitize inputs before combination
    const gtoSafe = safe(gtoFoldFrequency);
    const betSafe = safe(betSizingFoldFrequency);
    const potSafe = safe(potOddsFoldFrequency);
    const rangeSafe = safe(rangeStrengthFoldFrequency);

    // Combine all factors to get final fold frequency
    const finalFoldFrequency = combineFoldFrequencyFactors({
        gto: gtoSafe,
        betSizing: betSafe,
        potOdds: potSafe,
        rangeStrength: rangeSafe,
        streetPatterns: streetPatterns.adjustedFoldFrequency
    });

    // Get fold frequency factors for analysis
    const foldFrequencyFactors = getFoldFrequencyFactors(playerAction, potOdds, opponentRange, streetPatterns);

    return {
        baseFoldFrequency: finalFoldFrequency,
        gtoFoldFrequency: gtoSafe,
        betSizingFoldFrequency: betSafe,
        potOddsFoldFrequency: potSafe,
        rangeStrengthFoldFrequency: rangeSafe,
        finalFoldFrequency: safe(finalFoldFrequency),
        foldFrequencyFactors,
        explanation: generateFoldFrequencyExplanation({
            gto: gtoSafe,
            betSizing: betSafe,
            potOdds: potSafe,
            rangeStrength: rangeSafe,
            final: safe(finalFoldFrequency)
        })
    };
}

/**
 * Calculate GTO-inspired base fold frequency.
 * @param {Object} playerAction - Player's action analysis
 * @param {Object} potOdds - Pot odds analysis
 * @returns {number} GTO fold frequency
 */
function calculateGTOFoldFrequency(playerAction, potOdds) {
    const betSizing = playerAction.betSizing;
    const potOddsValue = potOdds.potOdds;
    
    // GTO-inspired fold frequencies by bet sizing
    const gtoFrequencies = {
        small: 0.4,      // 33% pot - 40% fold
        medium: 0.6,     // 66% pot - 60% fold
        large: 0.8,      // 100% pot - 80% fold
        very_large: 0.9, // 200%+ pot - 90% fold
        all_in: 0.7      // All-in - 70% fold (depends on pot odds)
    };

    let gtoFrequency = gtoFrequencies[betSizing] || 0.5;

    // Adjust for pot odds
    if (betSizing === 'all_in') {
        // All-in fold frequency heavily depends on pot odds
        if (potOddsValue < 0.2) gtoFrequency = 0.3;      // Good pot odds
        else if (potOddsValue < 0.3) gtoFrequency = 0.5;  // Decent pot odds
        else if (potOddsValue < 0.4) gtoFrequency = 0.7;  // Poor pot odds
        else gtoFrequency = 0.9;                          // Very poor pot odds
    }

    return gtoFrequency;
}

/**
 * Calculate bet sizing specific fold frequency.
 * @param {Object} playerAction - Player's action analysis
 * @param {Object} potOdds - Pot odds analysis
 * @returns {number} Bet sizing fold frequency
 */
function calculateBetSizingFoldFrequency(playerAction, potOdds) {
    const betSizing = playerAction.betSizing;
    const betToPotRatio = playerAction.betSize / playerAction.potSize;
    const potOddsValue = potOdds.potOdds;

    // Base fold frequencies by bet sizing
    let foldFrequency = 0.5;

    switch (betSizing) {
        case 'small':
            // Small bets (≤33% pot)
            foldFrequency = 0.35 + (betToPotRatio * 0.5); // 35-50%
            break;
        case 'medium':
            // Medium bets (33-100% pot)
            foldFrequency = 0.5 + (betToPotRatio * 0.3); // 50-80%
            break;
        case 'large':
            // Large bets (100-200% pot)
            foldFrequency = 0.75 + (betToPotRatio * 0.15); // 75-90%
            break;
        case 'very_large':
            // Very large bets (200%+ pot)
            foldFrequency = 0.85 + (betToPotRatio * 0.1); // 85-95%
            break;
        case 'all_in':
            // All-in bets
            foldFrequency = calculateAllInFoldFrequency(potOddsValue);
            break;
    }

    return Math.min(0.95, Math.max(0.05, foldFrequency));
}

/**
 * Calculate all-in fold frequency based on pot odds.
 * @param {number} potOdds - Pot odds as decimal
 * @returns {number} All-in fold frequency
 */
function calculateAllInFoldFrequency(potOdds) {
    // All-in fold frequency is heavily influenced by pot odds
    if (potOdds < 0.15) return 0.2;      // Excellent pot odds - few folds
    if (potOdds < 0.25) return 0.4;      // Good pot odds - some folds
    if (potOdds < 0.35) return 0.6;      // Decent pot odds - moderate folds
    if (potOdds < 0.45) return 0.8;      // Poor pot odds - many folds
    return 0.9;                          // Very poor pot odds - most fold
}

/**
 * Calculate pot odds based fold frequency.
 * @param {Object} potOdds - Pot odds analysis
 * @param {Object} opponentRange - Opponent's range analysis
 * @returns {number} Pot odds fold frequency
 */
function calculatePotOddsFoldFrequency(potOdds, opponentRange) {
    const potOddsValue = potOdds.potOdds;
    const impliedOdds = potOdds.impliedOdds;
    const rangeStrength = opponentRange.averageStrength;

    // Base fold frequency based on pot odds
    let foldFrequency = 0.5;

    // Adjust for pot odds
    if (potOddsValue < 0.2) {
        foldFrequency = 0.2; // Excellent pot odds - few folds
    } else if (potOddsValue < 0.3) {
        foldFrequency = 0.35; // Good pot odds - some folds
    } else if (potOddsValue < 0.4) {
        foldFrequency = 0.5; // Decent pot odds - moderate folds
    } else if (potOddsValue < 0.5) {
        foldFrequency = 0.7; // Poor pot odds - many folds
    } else {
        foldFrequency = 0.85; // Very poor pot odds - most fold
    }

    // Adjust for implied odds
    if (impliedOdds > 1.5) {
        foldFrequency *= 0.8; // High implied odds reduce folds
    } else if (impliedOdds < 1.0) {
        foldFrequency *= 1.2; // Low implied odds increase folds
    }

    // Adjust for range strength
    if (rangeStrength > 0.7) {
        foldFrequency *= 0.7; // Strong ranges fold less
    } else if (rangeStrength < 0.3) {
        foldFrequency *= 1.3; // Weak ranges fold more
    }

    return Math.min(0.95, Math.max(0.05, foldFrequency));
}

/**
 * Calculate range strength based fold frequency.
 * @param {Object} opponentRange - Opponent's range analysis
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Range strength fold frequency
 */
function calculateRangeStrengthFoldFrequency(opponentRange, playerAction) {
    const rangeStrength = opponentRange.averageStrength;
    const strongHandsPercentage = opponentRange.strongHandsPercentage || 0;
    const weakHandsPercentage = opponentRange.weakHandsPercentage || 0;
    const drawingHandsPercentage = opponentRange.drawsPercentage || 0;

    // Base fold frequency based on range strength
    let foldFrequency = 0.5;

    // Adjust for overall range strength
    if (rangeStrength > 0.8) {
        foldFrequency = 0.2; // Very strong range - few folds
    } else if (rangeStrength > 0.6) {
        foldFrequency = 0.35; // Strong range - some folds
    } else if (rangeStrength > 0.4) {
        foldFrequency = 0.5; // Medium range - moderate folds
    } else if (rangeStrength > 0.2) {
        foldFrequency = 0.7; // Weak range - many folds
    } else {
        foldFrequency = 0.85; // Very weak range - most fold
    }

    // Adjust for strong hands percentage
    if (strongHandsPercentage > 0.3) {
        foldFrequency *= 0.6; // Many strong hands - fewer folds
    }

    // Adjust for weak hands percentage
    if (weakHandsPercentage > 0.5) {
        foldFrequency *= 1.4; // Many weak hands - more folds
    }

    // Adjust for drawing hands
    if (drawingHandsPercentage > 0.3) {
        // Drawing hands fold less to small bets, more to large bets
        if (playerAction.betSizing === 'small') {
            foldFrequency *= 0.7; // Draws call small bets
        } else if (playerAction.betSizing === 'large' || playerAction.betSizing === 'very_large') {
            foldFrequency *= 1.2; // Draws fold to large bets
        }
    }

    // Adjust for action context
    if (playerAction.isContinuationBet) {
        // Strong ranges fold less to c-bets
        if (rangeStrength > 0.6) {
            foldFrequency *= 0.8;
        }
    }

    if (playerAction.isValueBet) {
        // Value bets get more folds from weak ranges
        if (rangeStrength < 0.5) {
            foldFrequency *= 1.3;
        }
    }

    return Math.min(0.95, Math.max(0.05, foldFrequency));
}

/**
 * Combine all fold frequency factors using weighted average.
 * @param {Object} factors - All fold frequency factors
 * @returns {number} Combined fold frequency
 */
function combineFoldFrequencyFactors(factors) {
    // Weights for different factors
    const weights = {
        gto: 0.25,           // GTO principles
        betSizing: 0.25,     // Bet sizing impact
        potOdds: 0.2,        // Pot odds
        rangeStrength: 0.2,  // Range strength
        streetPatterns: 0.1  // Street-specific patterns
    };

    // Calculate weighted average
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [factor, weight] of Object.entries(weights)) {
        if (factors[factor] !== undefined) {
            weightedSum += factors[factor] * weight;
            totalWeight += weight;
        }
    }

    const combinedFrequency = totalWeight > 0 ? weightedSum / totalWeight : 0.5;

    // Apply reasonable bounds
    return Math.min(0.95, Math.max(0.05, combinedFrequency));
}

/**
 * Get detailed fold frequency factors for analysis.
 * @param {Object} playerAction - Player's action analysis
 * @param {Object} potOdds - Pot odds analysis
 * @param {Object} opponentRange - Opponent's range analysis
 * @param {Object} streetPatterns - Street-specific patterns
 * @returns {Object} Detailed fold frequency factors
 */
function getFoldFrequencyFactors(playerAction, potOdds, opponentRange, streetPatterns) {
    return {
        betSizing: {
            category: playerAction.betSizing,
            betToPotRatio: playerAction.betSize / playerAction.potSize,
            impact: 'High'
        },
        potOdds: {
            value: potOdds.potOdds,
            percentage: potOdds.potOddsPercentage,
            impliedOdds: potOdds.impliedOdds,
            impact: 'High'
        },
        rangeStrength: {
            averageStrength: opponentRange.averageStrength,
            strongHandsPercentage: opponentRange.strongHandsPercentage,
            weakHandsPercentage: opponentRange.weakHandsPercentage,
            drawingHandsPercentage: opponentRange.drawsPercentage,
            impact: 'Medium'
        },
        actionContext: {
            isContinuationBet: playerAction.isContinuationBet,
            isValueBet: playerAction.isValueBet,
            isBluff: playerAction.isBluff,
            isCheckRaise: playerAction.isCheckRaise,
            impact: 'Medium'
        },
        streetFactors: {
            street: streetPatterns.street,
            commitmentLevel: streetPatterns.streetFactors?.commitmentLevel,
            bluffCatchingFrequency: streetPatterns.streetFactors?.bluffCatchingFrequency,
            impact: 'Low'
        }
    };
}

/**
 * Generate explanation for fold frequency calculation.
 * @param {Object} frequencies - All calculated frequencies
 * @returns {string} Explanation of fold frequency
 */
function generateFoldFrequencyExplanation(frequencies) {
    const explanations = [];
    
    // Identify the most influential factor
    const factors = [
        { name: 'GTO', value: frequencies.gto },
        { name: 'Bet Sizing', value: frequencies.betSizing },
        { name: 'Pot Odds', value: frequencies.potOdds },
        { name: 'Range Strength', value: frequencies.rangeStrength }
    ];
    
    factors.sort((a, b) => Math.abs(a.value - 0.5) - Math.abs(b.value - 0.5));
    const mostInfluential = factors[factors.length - 1];
    
    if (mostInfluential.value < 0.3) {
        explanations.push(`Low fold frequency primarily due to ${mostInfluential.name.toLowerCase()}`);
    } else if (mostInfluential.value > 0.7) {
        explanations.push(`High fold frequency primarily due to ${mostInfluential.name.toLowerCase()}`);
    } else {
        explanations.push(`Moderate fold frequency with ${mostInfluential.name.toLowerCase()} as primary factor`);
    }
    
    // Add final frequency
    explanations.push(`Final fold frequency: ${(frequencies.final * 100).toFixed(1)}%`);
    
    return explanations.join('. ');
}

module.exports = {
    calculateBaseFoldFrequency,
    calculateGTOFoldFrequency,
    calculateBetSizingFoldFrequency,
    calculateAllInFoldFrequency,
    calculatePotOddsFoldFrequency,
    calculateRangeStrengthFoldFrequency,
    combineFoldFrequencyFactors,
    getFoldFrequencyFactors,
    generateFoldFrequencyExplanation
}