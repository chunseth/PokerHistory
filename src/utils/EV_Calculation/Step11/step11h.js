/**
 * Step 11h: Adjust for Stack Depth
 * Adjusts fold frequency based on the opponent's stack depth relative to the pot.
 * 
 * @param {Object} potOdds - The pot odds analysis from step 11b
 * @param {Object} playerAction - The player's action analysis from step 11a
 * @param {Object} hand - The hand object from the database
 * @param {Array} actions - Array of all postflop actions
 * @param {number} actionIndex - Index of the current action
 * @param {string} opponentId - The opponent's player ID
 * @param {Object} positionAdjustment - The position adjustment from step 11g
 * @returns {Object} Stack depth adjustment analysis
 */
function adjustForStackDepth(potOdds, playerAction, hand, actions, actionIndex, opponentId, positionAdjustment) {
    if (!potOdds || !playerAction || !hand || !actions || !opponentId) {
        return {
            stackDepthAdjustment: 0,
            deepStackAdjustment: 0,
            mediumStackAdjustment: 0,
            shortStackAdjustment: 0,
            allInAdjustment: 0,
            overallStackAdjustment: 0,
            adjustedFoldFrequency: 0.5,
            explanation: 'Missing input data'
        };
    }

    // Get stack depth information
    const stackDepthInfo = getStackDepthInformation(potOdds, playerAction, hand, actions, actionIndex, opponentId);
    
    // Calculate stack depth-based adjustments
    const deepStackAdjustment = calculateDeepStackAdjustment(stackDepthInfo, playerAction);
    const mediumStackAdjustment = calculateMediumStackAdjustment(stackDepthInfo, playerAction);
    const shortStackAdjustment = calculateShortStackAdjustment(stackDepthInfo, playerAction, potOdds);
    const allInAdjustment = calculateAllInAdjustment(stackDepthInfo, playerAction);
    
    // Calculate overall stack depth adjustment
    const overallStackAdjustment = calculateOverallStackAdjustment({
        deepStack: deepStackAdjustment,
        mediumStack: mediumStackAdjustment,
        shortStack: shortStackAdjustment,
        allIn: allInAdjustment,
        stackDepthInfo
    });

    // Apply adjustment to the fold frequency from previous steps
    const baseFoldFrequency = 0.5 + (positionAdjustment?.overallPositionAdjustment || 0);
    const adjustedFoldFrequency = Math.min(0.95, Math.max(0.05, baseFoldFrequency + overallStackAdjustment));

    return {
        stackDepthAdjustment: overallStackAdjustment,
        deepStackAdjustment,
        mediumStackAdjustment,
        shortStackAdjustment,
        allInAdjustment,
        overallStackAdjustment,
        adjustedFoldFrequency,
        stackDepthInfo,
        explanation: generateStackDepthExplanation({
            stackDepthInfo,
            adjustments: {
                deepStack: deepStackAdjustment,
                mediumStack: mediumStackAdjustment,
                shortStack: shortStackAdjustment,
                allIn: allInAdjustment,
                overall: overallStackAdjustment
            }
        })
    };
}

/**
 * Get comprehensive stack depth information.
 * @param {Object} potOdds - Pot odds analysis
 * @param {Object} playerAction - The player's action analysis
 * @param {Object} hand - The hand object from the database
 * @param {Array} actions - Array of all postflop actions
 * @param {number} actionIndex - Index of the current action
 * @param {string} opponentId - The opponent's player ID
 * @returns {Object} Stack depth information
 */
function getStackDepthInformation(potOdds, playerAction, hand, actions, actionIndex, opponentId) {
    if (!potOdds || !playerAction || !hand) {
        return {
            effectiveStack: 0,
            potSize: 0,
            stackToPotRatio: 0,
            stackDepthCategory: 'unknown',
            remainingStreets: 0,
            impliedOddsPotential: 1,
            isTournament: false,
            icmPressure: 0,
            isAllIn: false,
            isShortStacked: false
        };
    }

    if (!hand.blindLevel?.bigBlind) {
        throw new Error('Missing blind level in hand data');
    }

    const effectiveStack = potOdds.effectiveStack;
    const potSize = hand.potSizes?.[playerAction.street] || hand.potSize || playerAction.potSize || 1.5;
    const stackToPotRatio = potSize > 0 ? effectiveStack / potSize : 0;
    
    // Determine stack depth category
    let stackDepthCategory;
    if (stackToPotRatio >= 10) {
        stackDepthCategory = 'deep';
    } else if (stackToPotRatio >= 3) {
        stackDepthCategory = 'medium';
    } else if (stackToPotRatio >= 1) {
        stackDepthCategory = 'short';
    } else {
        stackDepthCategory = 'all_in';
    }

    // Calculate remaining streets
    const remainingStreets = calculateRemainingStreets(playerAction.street);
    
    // Calculate implied odds potential
    const impliedOddsPotential = calculateImpliedOddsPotential(stackToPotRatio, remainingStreets);
    
    // Check if this is a tournament vs cash game
    const isTournament = checkIfTournament(hand);
    
    // Calculate ICM pressure (for tournaments)
    const icmPressure = isTournament ? calculateICMPressure(hand, opponentId) : 0;

    return {
        effectiveStack,
        potSize,
        stackToPotRatio,
        stackDepthCategory,
        remainingStreets,
        impliedOddsPotential,
        isTournament,
        icmPressure,
        isAllIn: stackDepthCategory === 'all_in',
        isShortStacked: stackDepthCategory === 'short' || stackDepthCategory === 'all_in'
    };
}

/**
 * Calculate adjustment for deep stack situations.
 * @param {Object} stackDepthInfo - Stack depth information
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Adjustment factor
 */
function calculateDeepStackAdjustment(stackDepthInfo, playerAction) {
    if (stackDepthInfo.stackDepthCategory !== 'deep') return 0;

    let adjustment = -10.0; // Base adjustment for deep stack (-10%)

    // Positional adjustments become more important in deep stack play
    if (playerAction.position === 'BTN' || playerAction.position === 'CO') {
        adjustment += 2.0; // Position allows slightly more aggression
    }

    // Street-based adjustments
    if (playerAction.street === 'flop') {
        adjustment -= 3.0; // More folds on flop due to future streets
    } else if (playerAction.street === 'turn') {
        adjustment -= 4.0; // Even more folds on turn
    } else if (playerAction.street === 'river') {
        adjustment -= 5.0; // Most folds on river with deep stacks
    }

    // Action type adjustments
    if (playerAction.actionType === 'bet') {
        if (playerAction.betSizing === 'large') {
            adjustment -= 3.0; // Larger bets demand more respect in deep stacks
        }
    }

    // Implied odds adjustments
    if (stackDepthInfo.impliedOddsPotential > 3) {
        adjustment -= 2.0; // Better implied odds = more calls
    }

    return Math.max(-15.0, Math.min(-5.0, adjustment)); // Clamp between -15% and -5%
}

/**
 * Calculate adjustment for medium stack situations.
 * @param {Object} stackDepthInfo - Stack depth information
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Adjustment factor
 */
function calculateMediumStackAdjustment(stackDepthInfo, playerAction) {
    if (stackDepthInfo.stackDepthCategory !== 'medium') return 0;

    let adjustment = 0.0; // Start neutral for medium stacks

    // Street-based adjustments
    if (playerAction.street === 'flop') {
        adjustment += 1.0;
    } else if (playerAction.street === 'turn') {
        adjustment += 2.0;
    } else if (playerAction.street === 'river') {
        adjustment += 3.0;
    }

    // Action type adjustments
    if (playerAction.actionType === 'bet') {
        if (playerAction.betSizing === 'large') {
            adjustment += 2.0;
        } else {
            adjustment -= 1.0;
        }
    }

    // Position adjustments
    if (playerAction.position === 'BTN' || playerAction.position === 'CO') {
        adjustment -= 1.0;
    }

    return Math.max(-2.0, Math.min(5.0, adjustment)); // Clamp between -2% and +5%
}

/**
 * Calculate adjustment for short stack situations.
 * @param {Object} stackDepthInfo - Stack depth information
 * @param {Object} playerAction - Player's action analysis
 * @param {Object} potOdds - Pot odds information
 * @returns {number} Adjustment factor
 */
function calculateShortStackAdjustment(stackDepthInfo, playerAction, potOdds) {
    if (stackDepthInfo.stackDepthCategory !== 'short') return 0;

    let adjustment = 15.0; // Base adjustment for short stack (+15%)

    // Street-based adjustments
    if (playerAction.street === 'flop') {
        adjustment += 3.0; // Less folding on flop
    } else if (playerAction.street === 'turn') {
        adjustment += 4.0; // Even less folding on turn
    } else if (playerAction.street === 'river') {
        adjustment += 5.0; // Least folding on river due to pot commitment
    }

    // Pot odds adjustments
    if (potOdds && potOdds.potOdds > 0.3) {
        adjustment += 2.0; // Good pot odds reduce folds
    }

    // Stack-to-pot ratio adjustments
    if (stackDepthInfo.stackToPotRatio < 5) {
        adjustment += 3.0; // Very committed to pot
    }

    return Math.max(10.0, Math.min(20.0, adjustment)); // Clamp between +10% and +20%
}

/**
 * Calculate adjustment for all-in situations.
 * @param {Object} stackDepthInfo - Stack depth information
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Adjustment factor
 */
function calculateAllInAdjustment(stackDepthInfo, playerAction) {
    if (stackDepthInfo.stackDepthCategory !== 'all_in') return 0;

    let adjustment = 25.0; // Base adjustment for all-in (+25%)

    // Action type adjustments
    if (playerAction.actionType === 'bet' || playerAction.actionType === 'raise') {
        adjustment += 2.0; // Slightly more fold equity when betting/raising
    }

    // Street-based adjustments
    if (playerAction.street === 'flop') {
        adjustment += 2.0;
    } else if (playerAction.street === 'turn') {
        adjustment += 3.0;
    } else if (playerAction.street === 'river') {
        adjustment += 4.0;
    }

    // Tournament considerations
    if (stackDepthInfo.isTournament) {
        adjustment += stackDepthInfo.icmPressure * 10.0; // ICM pressure increases folds
    }

    return Math.max(20.0, Math.min(30.0, adjustment)); // Clamp between +20% and +30%
}

/**
 * Calculate the number of remaining streets based on the current street.
 * @param {string} currentStreet - The current street ('preflop', 'flop', 'turn', 'river')
 * @returns {number} Number of remaining streets
 */
function calculateRemainingStreets(currentStreet) {
    const streetOrder = ['preflop', 'flop', 'turn', 'river'];
    const currentIndex = streetOrder.indexOf(currentStreet);
    if (currentIndex === -1) return 0;
    return streetOrder.length - currentIndex - 1;
}

/**
 * Calculate implied odds potential based on stack-to-pot ratio and remaining streets.
 * @param {number} stackToPotRatio - Stack-to-pot ratio
 * @param {number} remainingStreets - Number of remaining streets
 * @returns {number} Implied odds potential (multiplier)
 */
function calculateImpliedOddsPotential(stackToPotRatio, remainingStreets) {
    if (remainingStreets === 0) return 1.0;
    
    // Base multiplier depends on remaining stack depth
    let baseMultiplier = Math.min(3.0, stackToPotRatio / 2);
    
    // Adjust for remaining streets (more streets = more potential)
    let streetMultiplier = 1 + (remainingStreets * 0.5);
    
    return Math.min(5.0, baseMultiplier * streetMultiplier);
}

/**
 * Calculate ICM pressure for tournament situations.
 * @param {Object} hand - The hand object
 * @param {string} opponentId - The opponent's player ID
 * @returns {number} ICM pressure factor (0-1)
 */
function calculateICMPressure(hand, opponentId) {
    // Simplified ICM pressure calculation
    // In a real implementation, this would consider:
    // - Tournament structure (bubble, final table, etc.)
    // - Prize pool distribution
    // - Stack sizes relative to other players
    // - Position in tournament
    
    // For now, return a basic pressure factor
    return 0.3; // Moderate ICM pressure
}

/**
 * Check if this is a tournament hand.
 * @param {Object} hand - The hand object
 * @returns {boolean} True if tournament
 */
function checkIfTournament(hand) {
    // Check for tournament indicators in hand data
    // This would depend on your hand data structure
    return hand.gameType === 'tournament' || hand.tournamentId || false;
}

/**
 * Calculate overall stack depth adjustment by combining all factors.
 * @param {Object} adjustments - All stack depth adjustment factors
 * @returns {number} Overall stack depth adjustment
 */
function calculateOverallStackAdjustment(adjustments) {
    const { deepStack, mediumStack, shortStack, allIn, stackDepthInfo } = adjustments;
    
    // Weight the adjustments based on stack depth category
    let overallAdjustment = 0;

    switch (stackDepthInfo.stackDepthCategory) {
        case 'deep':
            overallAdjustment = deepStack;
            break;
        case 'medium':
            overallAdjustment = mediumStack;
            break;
        case 'short':
            overallAdjustment = shortStack;
            break;
        case 'all_in':
            overallAdjustment = allIn;
            break;
        default:
            overallAdjustment = 0;
    }

    // Apply reasonable bounds
    return Math.min(40.0, Math.max(-30.0, overallAdjustment)); // Keep as percentage
}

/**
 * Generate explanation for stack depth adjustments.
 * @param {Object} data - Stack depth data and adjustments
 * @returns {string} Explanation
 */
function generateStackDepthExplanation(data) {
    const { stackDepthInfo, adjustments } = data;
    const explanations = [];

    // Stack depth category
    const categoryNames = {
        'deep': 'Deep stack',
        'medium': 'Medium stack', 
        'short': 'Short stack',
        'all_in': 'All-in situation'
    };
    
    explanations.push(`${categoryNames[stackDepthInfo.stackDepthCategory]} (${stackDepthInfo.stackToPotRatio.toFixed(1)}:1 SPR)`);

    // Stack depth adjustment
    if (Math.abs(adjustments.overall) > 0.01) {
        const direction = adjustments.overall > 0 ? 'increases' : 'decreases';
        explanations.push(`Stack depth ${direction} fold frequency by ${Math.abs(adjustments.overall * 100).toFixed(1)}%`);
    }

    // Implied odds
    if (stackDepthInfo.impliedOddsPotential > 1.5) {
        explanations.push(`Good implied odds potential (${stackDepthInfo.impliedOddsPotential.toFixed(1)}x)`);
    }

    // Tournament considerations
    if (stackDepthInfo.isTournament) {
        explanations.push('Tournament ICM pressure affects decisions');
    }

    // All-in considerations
    if (stackDepthInfo.isAllIn) {
        explanations.push('All-in situation - binary equity decision');
    }

    return explanations.join('. ');
}

module.exports = {
    adjustForStackDepth,
    getStackDepthInformation,
    calculateDeepStackAdjustment,
    calculateMediumStackAdjustment,
    calculateShortStackAdjustment,
    calculateAllInAdjustment,
    calculateRemainingStreets,
    calculateImpliedOddsPotential,
    calculateICMPressure,
    checkIfTournament,
    calculateOverallStackAdjustment,
    generateStackDepthExplanation
}