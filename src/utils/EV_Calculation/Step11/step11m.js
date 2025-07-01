const { calculateOpponentRangeStrength } = require('./step11c');

/**
 * Step 11m: Consider Previous Action Patterns
 * Analyzes the opponent's previous actions in the current hand to adjust raise frequencies.
 * As per Step11.txt:
 * - If opponent has been passive: Reduce raise frequency
 * - If opponent has been aggressive: Increase raise frequency  
 * - If opponent has been folding: Increase fold frequency
 * 
 * @param {Object} hand - The hand object with bettingActions
 * @param {number} actionIndex - Index of the current action
 * @param {string} opponentId - The opponent's player ID
 * @param {number} currentRaiseFreq - Current raise frequency before adjustment
 * @param {Object} [playerAction] - (Optional) The player's action analysis from step 11a
 * @param {Object} [potOdds] - (Optional) Pot odds analysis from step 11b
 * @returns {Object} Adjusted raise frequency based on previous action patterns
 */
function adjustRaiseFrequencyForPreviousActions(hand, actionIndex, opponentId, currentRaiseFreq, playerAction = {}, potOdds = {}) {
    if (!hand || !hand.bettingActions || actionIndex < 0 || !opponentId || typeof currentRaiseFreq !== 'number') {
        return {
            raiseFreq: currentRaiseFreq || 0,
            previousActionAnalysis: {},
            explanation: 'Missing input data (hand, actionIndex, opponentId, or currentRaiseFreq)'
        };
    }

    // Get range strength analysis from step 11c
    const rangeStrength = calculateOpponentRangeStrength(hand, hand.bettingActions, opponentId, actionIndex, playerAction, potOdds);

    // Analyze opponent's previous actions in this hand
    const previousActionAnalysis = analyzeOpponentPreviousActions(hand.bettingActions, actionIndex, opponentId);
    
    // Calculate adjustment based on previous action patterns
    const actionPatternAdjustment = calculateActionPatternAdjustment(previousActionAnalysis, rangeStrength);
    
    // Apply adjustment to raise frequency
    const adjustedRaiseFreq = calculateAdjustedRaiseFrequency(currentRaiseFreq, actionPatternAdjustment);
    
    // Generate explanation
    const explanation = generatePreviousActionExplanation({
        previousActionAnalysis,
        actionPatternAdjustment,
        originalRaiseFreq: currentRaiseFreq,
        adjustedRaiseFreq
    });

    return {
        raiseFreq: adjustedRaiseFreq,
        previousActionAnalysis,
        actionPatternAdjustment,
        rangeStrength, // Include the range strength analysis from step 11c
        explanation
    };
}

/**
 * Analyze the opponent's previous actions in the current hand
 */
function analyzeOpponentPreviousActions(bettingActions, actionIndex, opponentId) {
    const opponentActions = [];
    let aggressiveActions = 0;
    let passiveActions = 0;
    let foldActions = 0;
    let totalActions = 0;

    // Collect all opponent actions up to the current action
    for (let i = 0; i < actionIndex; i++) {
        const action = bettingActions[i];
        if (action && action.playerId === opponentId) {
            opponentActions.push(action);
            
            // Categorize actions
            switch (action.action) {
                case 'fold':
                    foldActions++;
                    totalActions++;
                    break;
                case 'call':
                case 'check':
                    passiveActions++;
                    totalActions++;
                    break;
                case 'bet':
                case 'raise':
                    aggressiveActions++;
                    totalActions++;
                    break;
                case 'post': // Posting blinds is a mandatory neutral action - don't count it
                default:
                    break;
            }
        }
    }

    // Calculate action percentages
    const aggressivePercentage = totalActions > 0 ? aggressiveActions / totalActions : 0;
    const passivePercentage = totalActions > 0 ? passiveActions / totalActions : 0;
    const foldPercentage = totalActions > 0 ? foldActions / totalActions : 0;

    // Analyze recent actions (last 2 actions for immediate tendencies)
    const recentActions = opponentActions.slice(-2);
    const recentAggressive = recentActions.filter(a => ['bet', 'raise'].includes(a.action)).length;
    const recentPassive = recentActions.filter(a => ['call', 'check'].includes(a.action)).length;
    const recentFolds = recentActions.filter(a => a.action === 'fold').length;

    return {
        totalActions,
        aggressiveActions,
        passiveActions,
        foldActions,
        aggressivePercentage,
        passivePercentage,
        foldPercentage,
        recentActions: recentActions.length,
        recentAggressive,
        recentPassive,
        recentFolds,
        opponentActions
    };
}

/**
 * Calculate adjustment based on action patterns using GTO principles
 */
function calculateActionPatternAdjustment(previousActionAnalysis, rangeStrength) {
    const { aggressivePercentage, passivePercentage, foldPercentage, recentActions, recentAggressive, recentPassive, recentFolds } = previousActionAnalysis;
    
    let adjustmentMultiplier = 1.0;
    let explanation = [];
    
    // Hard override: If we have a weak range, always reduce raise frequency regardless of other factors (GTO principle)
    if (rangeStrength.strengthCategory === 'weak') {
        adjustmentMultiplier = 0.9;
        explanation.push('Weak range: hard override, reduce raise frequency (GTO principle)');
        return {
            multiplier: adjustmentMultiplier,
            explanation: explanation.join(', ')
        };
    }
    
    // GTO-based adjustments based on action frequencies
    // If opponent has been mostly aggressive (>50% aggressive actions)
    if (aggressivePercentage > 0.5) {
        adjustmentMultiplier *= 0.8; // Reduce our raise frequency by 20%
        explanation.push('Opponent mostly aggressive: reduce raise frequency (they likely have strong hands)');
    }
    // If opponent has been mostly passive (>50% passive actions)
    else if (passivePercentage > 0.5) {
        adjustmentMultiplier *= 1.2; // Increase our raise frequency by 20%
        explanation.push('Opponent mostly passive: increase raise frequency (exploit their calling tendency)');
    }
    // If opponent has been folding a lot (>40% folds)
    if (foldPercentage > 0.4) {
        adjustmentMultiplier *= 1.15; // Increase raise frequency by 15%
        explanation.push('High fold percentage: increase raise frequency (exploit weakness)');
    }
    // Recent action adjustments (more weight on recent behavior)
    if (recentActions > 0) {
        if (recentAggressive > recentPassive && recentAggressive > recentFolds) {
            adjustmentMultiplier *= 0.9; // Slight reduction
            explanation.push('Recent aggression: slight reduction in raise frequency');
        } else if (recentPassive > recentAggressive && recentPassive > recentFolds) {
            adjustmentMultiplier *= 1.1; // Slight increase
            explanation.push('Recent passivity: slight increase in raise frequency');
        } else if (recentFolds > recentAggressive && recentFolds > recentPassive) {
            adjustmentMultiplier *= 1.2; // Increase raise frequency
            explanation.push('Recent folding: increase raise frequency (exploit weakness)');
        }
    }
    // Range strength context adjustments (strong only, not override)
    if (rangeStrength.strengthCategory === 'strong') {
        adjustmentMultiplier *= 1.1;
        explanation.push('Strong range: increase raise frequency');
    }
    return {
        multiplier: Math.max(0.5, Math.min(1.5, adjustmentMultiplier)),
        explanation: explanation.join(', ')
    };
}

/**
 * Calculate the final adjusted raise frequency
 */
function calculateAdjustedRaiseFrequency(baseRaiseFreq, actionPatternAdjustment) {
    let adjustedRaiseFreq = baseRaiseFreq * actionPatternAdjustment.multiplier;
    
    // Ensure reasonable bounds
    adjustedRaiseFreq = Math.max(0, Math.min(0.8, adjustedRaiseFreq));
    
    return adjustedRaiseFreq;
}

/**
 * Generate explanation for previous action adjustments
 */
function generatePreviousActionExplanation(data) {
    const { previousActionAnalysis, actionPatternAdjustment, originalRaiseFreq, adjustedRaiseFreq } = data;
    const { totalActions, aggressivePercentage, passivePercentage, foldPercentage, recentActions } = previousActionAnalysis;
    
    const explanations = [];
    
    // Action summary
    if (totalActions > 0) {
        explanations.push(`Opponent actions: ${totalActions} total (${(aggressivePercentage * 100).toFixed(1)}% aggressive, ${(passivePercentage * 100).toFixed(1)}% passive, ${(foldPercentage * 100).toFixed(1)}% folds)`);
    } else {
        explanations.push('No previous opponent actions in this hand');
    }
    
    // Recent actions
    if (recentActions > 0) {
        explanations.push(`Recent actions: last ${recentActions} actions considered`);
    }
    
    // Adjustment applied
    if (actionPatternAdjustment.explanation) {
        explanations.push(`Pattern adj: ${actionPatternAdjustment.explanation}`);
    }
    
    // Raise frequency change
    explanations.push(`Raise frequency: ${(originalRaiseFreq * 100).toFixed(1)}% → ${(adjustedRaiseFreq * 100).toFixed(1)}%`);
    
    return explanations.join('. ');
}

module.exports = {
    adjustRaiseFrequencyForPreviousActions,
    analyzeOpponentPreviousActions,
    calculateActionPatternAdjustment,
    calculateAdjustedRaiseFrequency,
    generatePreviousActionExplanation
}; 