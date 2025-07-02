/**
 * Step 11f: Adjust for Opponent's Range Strength
 * Adjusts response frequencies based on the opponent's range strength using the
 * range strength analysis from step11c.js.
 * 
 * @param {Object} rangeStrengthAnalysis - The range strength analysis from step11c.js
 * @param {Object} playerAction - The player's action analysis from step 11a
 * @param {Object} potOdds - The pot odds analysis from step 11b
 * @param {number} baseFoldFrequency - Base fold frequency from step 11e
 * @returns {Object} Range strength adjustment analysis
 */

// Utility to ensure finite numbers
const safeNum = (v, def = 0) => (Number.isFinite(v) ? v : def);

function adjustForOpponentRangeStrength(rangeStrengthAnalysis, playerAction, potOdds, baseFoldFrequency = 0.5) {
    if (!rangeStrengthAnalysis || !playerAction || !potOdds) {
        return {
            rangeStrengthAdjustment: 0,
            strongHandsAdjustment: 0,
            weakHandsAdjustment: 0,
            drawingHandsAdjustment: 0,
            overallAdjustment: 0,
            adjustedFoldFrequency: baseFoldFrequency,
            explanation: 'Missing input data'
        };
    }

    // Calculate adjustments for different hand types using step11c analysis
    const strongHandsAdjustment = safeNum(calculateStrongHandsAdjustment(rangeStrengthAnalysis, playerAction));
    const weakHandsAdjustment = safeNum(calculateWeakHandsAdjustment(rangeStrengthAnalysis, playerAction));
    const drawingHandsAdjustment = safeNum(calculateDrawingHandsAdjustment(rangeStrengthAnalysis, playerAction, potOdds));
    
    // Calculate overall adjustment
    const overallAdjustment = safeNum(calculateOverallRangeAdjustment({
        strongHands: strongHandsAdjustment,
        weakHands: weakHandsAdjustment,
        drawingHands: drawingHandsAdjustment,
        rangeStrength: rangeStrengthAnalysis.averageStrength
    }));

    // Apply adjustment to base fold frequency
    const adjustedFoldFrequency = Math.min(0.95, Math.max(0.05, safeNum(baseFoldFrequency) + overallAdjustment));

    return {
        rangeStrengthAdjustment: overallAdjustment,
        strongHandsAdjustment,
        weakHandsAdjustment,
        drawingHandsAdjustment,
        overallAdjustment,
        adjustedFoldFrequency,
        rangeStrengthAnalysis, // Include the full analysis from step11c
        explanation: generateRangeStrengthExplanation({
            analysis: rangeStrengthAnalysis,
            adjustments: {
                strongHands: strongHandsAdjustment,
                weakHands: weakHandsAdjustment,
                drawingHands: drawingHandsAdjustment,
                overall: overallAdjustment
            }
        })
    };
}

/**
 * Calculate adjustment based on strong hands in the range using step11c analysis.
 * @param {Object} rangeStrengthAnalysis - Range strength analysis from step11c
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Adjustment factor
 */
function calculateStrongHandsAdjustment(rangeStrengthAnalysis, playerAction) {
    const strongHandsPercentage = rangeStrengthAnalysis.strongHandsPercentage / 100; // Convert from percentage
    const topHands = rangeStrengthAnalysis.topHands || [];
    const topHandsPercentage = topHands.reduce((sum, hand) => sum + hand.weight, 0);
    
    let adjustment = 0;

    // Strong ranges fold less
    if (strongHandsPercentage > 0.4) {
        adjustment -= 0.3; // Strong ranges fold 30% less
    } else if (strongHandsPercentage > 0.25) {
        adjustment -= 0.2; // Moderately strong ranges fold 20% less
    } else if (strongHandsPercentage > 0.15) {
        adjustment -= 0.1; // Somewhat strong ranges fold 10% less
    }

    // Very strong ranges (top hands) fold even less
    if (topHandsPercentage > 0.2) {
        adjustment -= 0.15; // Additional reduction for very strong hands
    }

    // Adjust for action context
    if (playerAction.isContinuationBet && strongHandsPercentage > 0.3) {
        adjustment -= 0.1; // Strong ranges fold less to c-bets
    }

    if (playerAction.isValueBet && strongHandsPercentage > 0.4) {
        adjustment += 0.1; // Strong ranges might fold more to value bets (they know they're beat)
    }

    return adjustment;
}

/**
 * Calculate adjustment based on weak hands in the range using step11c analysis.
 * @param {Object} rangeStrengthAnalysis - Range strength analysis from step11c
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Adjustment factor
 */
function calculateWeakHandsAdjustment(rangeStrengthAnalysis, playerAction) {
    const weakHandsPercentage = rangeStrengthAnalysis.weakHandsPercentage / 100; // Convert from percentage
    const bottomHands = rangeStrengthAnalysis.bottomHands || [];
    const bottomHandsPercentage = bottomHands.reduce((sum, hand) => sum + hand.weight, 0);
    
    let adjustment = 0;

    // Weak ranges fold more
    if (weakHandsPercentage > 0.5) {
        adjustment += 0.4; // Weak ranges fold 40% more
    } else if (weakHandsPercentage > 0.35) {
        adjustment += 0.25; // Moderately weak ranges fold 25% more
    } else if (weakHandsPercentage > 0.2) {
        adjustment += 0.15; // Somewhat weak ranges fold 15% more
    }

    // Very weak ranges fold even more
    if (bottomHandsPercentage > 0.3) {
        adjustment += 0.2; // Additional increase for very weak hands
    }

    // Adjust for action context
    if (playerAction.isBluff && weakHandsPercentage > 0.4) {
        adjustment -= 0.1; // Weak ranges might call bluffs more (bluff catching)
    }

    if (playerAction.betSizing === 'small' && weakHandsPercentage > 0.3) {
        adjustment -= 0.05; // Weak ranges call small bets more
    }

    return adjustment;
}

/**
 * Calculate adjustment based on drawing hands in the range using step11c analysis.
 * @param {Object} rangeStrengthAnalysis - Range strength analysis from step11c
 * @param {Object} playerAction - Player's action analysis
 * @param {Object} potOdds - Pot odds analysis
 * @returns {number} Adjustment factor
 */
function calculateDrawingHandsAdjustment(rangeStrengthAnalysis, playerAction, potOdds) {
    const drawingHandsPercentage = rangeStrengthAnalysis.drawingHandsPercentage / 100; // Convert from percentage
    const impliedOdds = potOdds.impliedOdds;
    
    let adjustment = 0;

    // Drawing hands behavior depends on bet sizing and implied odds
    if (drawingHandsPercentage > 0.3) {
        if (playerAction.betSizing === 'small') {
            // Drawing hands call small bets for implied odds
            adjustment -= 0.2; // 20% fewer folds
        } else if (playerAction.betSizing === 'medium') {
            // Drawing hands are more selective with medium bets
            if (impliedOdds > 1.5) {
                adjustment -= 0.1; // Good implied odds - fewer folds
            } else {
                adjustment += 0.1; // Poor implied odds - more folds
            }
        } else if (playerAction.betSizing === 'large' || playerAction.betSizing === 'very_large') {
            // Drawing hands fold to large bets unless very good implied odds
            if (impliedOdds > 2.0) {
                adjustment -= 0.05; // Excellent implied odds - some calls
            } else {
                adjustment += 0.3; // Poor implied odds - many folds
            }
        }
    }

    // Adjust for street context
    if (playerAction.street === 'flop' && drawingHandsPercentage > 0.25) {
        adjustment -= 0.05; // More drawing potential on flop
    } else if (playerAction.street === 'turn' && drawingHandsPercentage > 0.2) {
        adjustment += 0.1; // Less drawing potential on turn
    } else if (playerAction.street === 'river' && drawingHandsPercentage > 0.15) {
        adjustment += 0.2; // No drawing potential on river
    }

    return adjustment;
}

/**
 * Calculate overall range adjustment by combining all factors.
 * @param {Object} adjustments - All adjustment factors
 * @returns {number} Overall adjustment
 */
function calculateOverallRangeAdjustment(adjustments) {
    const { strongHands, weakHands, drawingHands, rangeStrength } = adjustments;
    
    // Weight the adjustments based on their importance
    const weights = {
        strongHands: 0.3,
        weakHands: 0.3,
        drawingHands: 0.2,
        rangeStrength: 0.2
    };

    // Calculate weighted adjustment
    let weightedAdjustment = 
        strongHands * weights.strongHands +
        weakHands * weights.weakHands +
        drawingHands * weights.drawingHands;

    // Add range strength adjustment
    if (rangeStrength > 0.7) {
        weightedAdjustment -= 0.15; // Strong overall range
    } else if (rangeStrength < 0.3) {
        weightedAdjustment += 0.15; // Weak overall range
    }

    // Apply reasonable bounds
    return Math.min(0.4, Math.max(-0.4, weightedAdjustment));
}

/**
 * Generate explanation for range strength adjustments using step11c analysis.
 * @param {Object} data - Range strength data and adjustments
 * @returns {string} Explanation
 */
function generateRangeStrengthExplanation(data) {
    const { analysis, adjustments } = data;
    const explanations = [];

    // Overall range strength
    const avg = safeNum(analysis.averageStrength);
    if (avg > 0.7) {
        explanations.push(`Strong range (${(avg * 100).toFixed(1)}% average strength)`);
    } else if (avg < 0.3) {
        explanations.push(`Weak range (${(avg * 100).toFixed(1)}% average strength)`);
    } else {
        explanations.push(`Medium range (${(avg * 100).toFixed(1)}% average strength)`);
    }

    // Strong hands
    const strongPct = safeNum(analysis.strongHandsPercentage);
    if (strongPct > 30) {
        explanations.push(`${strongPct.toFixed(1)}% strong hands reduce folds`);
    }

    // Weak hands
    const weakPct = safeNum(analysis.weakHandsPercentage);
    if (weakPct > 40) {
        explanations.push(`${weakPct.toFixed(1)}% weak hands increase folds`);
    }

    // Drawing hands
    const drawPct = safeNum(analysis.drawingHandsPercentage);
    if (drawPct > 25) {
        explanations.push(`${drawPct.toFixed(1)}% drawing hands affect call frequency`);
    }

    // Range strength category
    if (analysis.strengthCategory) {
        explanations.push(`Range categorized as ${analysis.strengthCategory.replace('_', ' ')}`);
    }

    // Overall adjustment
    const overallAdj = safeNum(adjustments.overall);
    if (Math.abs(overallAdj) > 0.1) {
        const direction = overallAdj > 0 ? 'increases' : 'decreases';
        explanations.push(`Overall adjustment ${direction} fold frequency by ${(Math.abs(overallAdj) * 100).toFixed(1)}%`);
    }

    return explanations.join('. ');
}

module.exports = {
    adjustForOpponentRangeStrength,
    calculateStrongHandsAdjustment,
    calculateWeakHandsAdjustment,
    calculateDrawingHandsAdjustment,
    calculateOverallRangeAdjustment,
    generateRangeStrengthExplanation
};