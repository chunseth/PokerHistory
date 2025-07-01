const { getPositionInformation } = require('./step11g');
const { calculatePotSizeBeforeAction } = require('./step11a');

/**
 * Calculate remaining streets based on current street.
 * @param {string} currentStreet - The current street ('preflop', 'flop', 'turn', 'river')
 * @returns {number} Number of remaining streets
 */
function calculateRemainingStreets(currentStreet) {
    switch (currentStreet) {
        case 'preflop':
            return 3;
        case 'flop':
            return 2;
        case 'turn':
            return 1;
        case 'river':
            return 0;
        default:
            return 0;
    }
}

/**
 * Step 11k: Calculate Raise Frequency
 * Calculates the probability that the opponent will raise the player's action.
 * 
 * @param {Object} potOdds - The pot odds analysis from step 11b
 * @param {Object} callFrequency - The call frequency analysis from step 11j
 * @param {Object} playerAction - The player's action analysis from step 11a
 * @param {Object} hand - The hand object from the database
 * @param {Array} actions - Array of all postflop actions
 * @param {number} actionIndex - Index of the current action
 * @param {string} opponentId - The opponent's player ID
 * @returns {Object} Raise frequency analysis
 */
function calculateRaiseFrequency(potOdds, callFrequency, playerAction, hand, actions, actionIndex, opponentId) {
    if (!potOdds || !callFrequency || !playerAction || !hand) {
        return {
            baseRaiseFrequency: 0,
            potOddsRaiseAdjustment: 0,
            impliedOddsRaiseAdjustment: 0,
            positionRaiseAdjustment: 0,
            stackDepthRaiseAdjustment: 0,
            actionTypeRaiseAdjustment: 0,
            streetRaiseAdjustment: 0,
            overallRaiseFrequency: 0,
            explanation: 'Missing input data'
        };
    }

    // Calculate base raise frequency
    const baseRaiseFrequency = calculateBaseRaiseFrequency(potOdds, playerAction);
    
    // Calculate various adjustments
    const potOddsRaiseAdjustment = calculatePotOddsRaiseAdjustment(potOdds, playerAction);
    const impliedOddsRaiseAdjustment = calculateImpliedOddsRaiseAdjustment(potOdds, playerAction);
    const positionRaiseAdjustment = calculatePositionRaiseAdjustment(playerAction, hand, opponentId);
    const stackDepthRaiseAdjustment = calculateStackDepthRaiseAdjustment(potOdds, playerAction);
    const actionTypeRaiseAdjustment = calculateActionTypeRaiseAdjustment(playerAction);
    const streetRaiseAdjustment = calculateStreetRaiseAdjustment(playerAction);
    
    // Calculate overall raise frequency
    const overallRaiseFrequency = calculateOverallRaiseFrequency({
        base: baseRaiseFrequency,
        potOdds: potOddsRaiseAdjustment,
        impliedOdds: impliedOddsRaiseAdjustment,
        position: positionRaiseAdjustment,
        stackDepth: stackDepthRaiseAdjustment,
        actionType: actionTypeRaiseAdjustment,
        street: streetRaiseAdjustment,
        callFrequency: callFrequency.overallCallFrequency,
        potOddsData: potOdds,
        playerAction: playerAction
    });

    return {
        baseRaiseFrequency,
        potOddsRaiseAdjustment,
        impliedOddsRaiseAdjustment,
        positionRaiseAdjustment,
        stackDepthRaiseAdjustment,
        actionTypeRaiseAdjustment,
        streetRaiseAdjustment,
        overallRaiseFrequency,
        explanation: generateRaiseFrequencyExplanation({
            base: baseRaiseFrequency,
            adjustments: {
                potOdds: potOddsRaiseAdjustment,
                impliedOdds: impliedOddsRaiseAdjustment,
                position: positionRaiseAdjustment,
                stackDepth: stackDepthRaiseAdjustment,
                actionType: actionTypeRaiseAdjustment,
                street: streetRaiseAdjustment
            },
            overall: overallRaiseFrequency,
            callFrequency: callFrequency.overallCallFrequency,
            potOdds: potOdds,
            playerAction: playerAction
        })
    };
}

/**
 * Calculate base raise frequency based on pot odds and action type.
 * @param {Object} potOdds - Pot odds analysis
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Base raise frequency (0-1)
 */
function calculateBaseRaiseFrequency(potOdds, playerAction) {
    if (playerAction.actionType === 'check') return 0; // No raise frequency for checks
    
    const callAmount = potOdds.callAmount;
    const potSize = potOdds.potSize;
    
    if (callAmount === 0) return 0; // No call needed, so no raise possible
    
    // Base raise frequency is typically much lower than call frequency
    const potOddsRatio = callAmount / (potSize + callAmount);
    
    // GTO-inspired base raise frequencies (much lower than calls)
    let baseRaiseFrequency = 0;
    
    if (potOddsRatio <= 0.2) {
        // Very good pot odds (call 20% or less of pot)
        baseRaiseFrequency = 0.15; // 15% raise frequency
    } else if (potOddsRatio <= 0.33) {
        // Good pot odds (call 20-33% of pot)
        baseRaiseFrequency = 0.12; // 12% raise frequency
    } else if (potOddsRatio <= 0.5) {
        // Fair pot odds (call 33-50% of pot)
        baseRaiseFrequency = 0.08; // 8% raise frequency
    } else if (potOddsRatio <= 0.75) {
        // Poor pot odds (call 50-75% of pot)
        baseRaiseFrequency = 0.05; // 5% raise frequency
    } else {
        // Very poor pot odds (call 75%+ of pot)
        baseRaiseFrequency = 0.02; // 2% raise frequency
    }
    
    // Adjust for action type
    if (playerAction.actionType === 'bet') {
        // Bets are more likely to be raised than calls
        baseRaiseFrequency *= 1.2;
    } else if (playerAction.actionType === 'raise') {
        // Re-raises are less likely
        baseRaiseFrequency *= 0.7;
    }
    
    return Math.min(0.3, Math.max(0.01, baseRaiseFrequency));
}

/**
 * Calculate raise frequency adjustment based on pot odds.
 * @param {Object} potOdds - Pot odds analysis
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Pot odds raise adjustment
 */
function calculatePotOddsRaiseAdjustment(potOdds, playerAction) {
    const potOddsRatio = potOdds.potOdds;
    const callAmount = potOdds.callAmount;
    
    if (callAmount === 0) return 0;
    
    let adjustment = 0;
    
    // Adjust based on pot odds quality
    if (potOddsRatio <= 0.2) {
        // Excellent pot odds - less likely to raise (just call)
        adjustment -= 0.03; // 3% less likely to raise
    } else if (potOddsRatio <= 0.33) {
        // Good pot odds - moderate raise frequency
        adjustment += 0.01; // 1% more likely to raise
    } else if (potOddsRatio <= 0.5) {
        // Fair pot odds - higher raise frequency (bluff raises)
        adjustment += 0.03; // 3% more likely to raise
    } else if (potOddsRatio <= 0.75) {
        // Poor pot odds - even higher raise frequency (bluff raises)
        adjustment += 0.05; // 5% more likely to raise
    } else {
        // Very poor pot odds - highest raise frequency (bluff raises)
        adjustment += 0.08; // 8% more likely to raise
    }
    
    // Adjust for bet sizing
    if (playerAction.betSizing === 'small') {
        adjustment += 0.04; // Small bets are raised more
    } else if (playerAction.betSizing === 'large') {
        adjustment -= 0.03; // Large bets are raised less
    } else if (playerAction.betSizing === 'very_large') {
        adjustment -= 0.06; // Very large bets are rarely raised
    }
    
    return adjustment;
}

/**
 * Calculate raise frequency adjustment based on implied odds.
 * @param {Object} potOdds - Pot odds analysis
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Implied odds raise adjustment
 */
function calculateImpliedOddsRaiseAdjustment(potOdds, playerAction) {
    const impliedOdds = potOdds.impliedOdds;
    const remainingStreets = calculateRemainingStreets(playerAction.street);
    
    let adjustment = 0;
    
    // Adjust based on implied odds potential
    if (impliedOdds > 2.0) {
        // Excellent implied odds - more likely to raise for value
        adjustment += 0.04; // 4% more likely to raise
    } else if (impliedOdds > 1.5) {
        // Good implied odds - moderate raise frequency
        adjustment += 0.02; // 2% more likely to raise
    } else if (impliedOdds > 1.2) {
        // Fair implied odds - slight increase
        adjustment += 0.01; // 1% more likely to raise
    } else {
        // Poor implied odds - less likely to raise
        adjustment -= 0.02; // 2% less likely to raise
    }
    
    // Adjust based on remaining streets
    if (remainingStreets === 2) {
        // Flop - more implied odds, more raises
        adjustment += 0.02;
    } else if (remainingStreets === 1) {
        // Turn - moderate implied odds
        adjustment += 0.01;
    } else {
        // River - no implied odds, fewer raises
        adjustment -= 0.03;
    }
    
    // Adjust for drawing potential
    if (playerAction.street === 'flop') {
        adjustment += 0.01; // More drawing potential on flop
    }
    
    return adjustment;
}

/**
 * Calculate raise frequency adjustment based on position.
 * @param {Object} playerAction - Player's action analysis
 * @param {Object} hand - The hand object
 * @param {string} opponentId - The opponent's player ID
 * @returns {number} Position raise adjustment
 */
function calculatePositionRaiseAdjustment(playerAction, hand, opponentId) {
    const positionInfo = getPositionInformation(hand, playerAction.playerId, opponentId);
    
    let adjustment = 0;
    
    // In-position players raise more
    if (positionInfo.isOpponentInPosition) {
        adjustment += 0.06; // 6% more likely to raise when in position
    } else if (positionInfo.isPlayerInPosition) {
        adjustment -= 0.03; // 3% less likely to raise when out of position
    }
    
    // Blind vs blind adjustments
    if (positionInfo.isBlindVsBlind) {
        adjustment += 0.04; // 4% more likely to raise in blind vs blind
    }
    
    // Adjust for action context
    if (playerAction.isContinuationBet && positionInfo.isOpponentInPosition) {
        adjustment += 0.03; // In-position players raise c-bets more
    }
    
    if (playerAction.isBluff && positionInfo.isOpponentInPosition) {
        adjustment += 0.02; // In-position players raise bluffs more
    }
    
    return adjustment;
}

/**
 * Calculate raise frequency adjustment based on stack depth.
 * @param {Object} potOdds - Pot odds analysis
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Stack depth raise adjustment
 */
function calculateStackDepthRaiseAdjustment(potOdds, playerAction) {
    if (!potOdds.stackSize || !playerAction.potSize) {
        return 0; // Return 0 adjustment if we don't have accurate stack information
    }
    
    const stackToPotRatio = potOdds.stackSize / playerAction.potSize;
    
    let adjustment = 0;
    
    // Deep stacks raise more due to implied odds
    if (stackToPotRatio > 10) {
        adjustment += 0.05; // 5% more likely to raise with deep stacks
    } else if (stackToPotRatio > 5) {
        adjustment += 0.03; // 3% more likely to raise with medium-deep stacks
    } else if (stackToPotRatio > 2) {
        adjustment += 0.01; // 1% more likely to raise with medium stacks
    } else if (stackToPotRatio < 1) {
        // All-in situations
        adjustment -= 0.05; // 5% less likely to raise (binary decision)
    }
    
    // Adjust for action type
    if (playerAction.actionType === 'bet') {
        if (playerAction.betSizing === 'small' && stackToPotRatio > 5) {
            adjustment += 0.02; // Deep stacks raise small bets more
        } else if (playerAction.betSizing === 'large' && stackToPotRatio < 3) {
            adjustment -= 0.03; // Short stacks rarely raise large bets
        }
    }
    
    return adjustment;
}

/**
 * Calculate raise frequency adjustment based on action type.
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Action type raise adjustment
 */
function calculateActionTypeRaiseAdjustment(playerAction) {
    let adjustment = 0;
    
    // Different action types have different raise frequencies
    switch (playerAction.actionType) {
        case 'bet':
            // Bets are raised more than calls
            adjustment += 0.03;
            break;
        case 'call':
            // Calls are rarely raised
            adjustment -= 0.02;
            break;
        case 'raise':
            // Re-raises are less common
            adjustment -= 0.04;
            break;
        case 'check':
            // Checks can't be raised
            adjustment = 0;
            break;
        default:
            adjustment = 0;
    }
    
    // Adjust for bet sizing
    if (playerAction.betSizing === 'small') {
        adjustment += 0.04; // Small bets are raised more
    } else if (playerAction.betSizing === 'large') {
        adjustment -= 0.03; // Large bets are raised less
    }
    
    // Adjust for action context
    if (playerAction.isContinuationBet) {
        adjustment += 0.02; // C-bets are raised more
    }
    
    if (playerAction.isBluff) {
        adjustment += 0.03; // Bluffs are raised more
    }
    
    if (playerAction.isValueBet) {
        adjustment -= 0.02; // Value bets are raised less
    }
    
    return adjustment;
}

/**
 * Calculate raise frequency adjustment based on street.
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Street raise adjustment
 */
function calculateStreetRaiseAdjustment(playerAction) {
    let adjustment = 0;
    
    // Different streets have different raise frequencies
    switch (playerAction.street) {
        case 'flop':
            // Flop has highest raise frequency (more draws, more action)
            adjustment += 0.04;
            break;
        case 'turn':
            // Turn has moderate raise frequency
            adjustment += 0.02;
            break;
        case 'river':
            // River has lowest raise frequency (no draws, pure value)
            adjustment -= 0.03;
            break;
        default:
            adjustment = 0;
    }
    
    // Adjust for remaining streets
    const remainingStreets = calculateRemainingStreets(playerAction.street);
    if (remainingStreets === 2) {
        // Flop - more action
        adjustment += 0.01;
    } else if (remainingStreets === 0) {
        // River - less action
        adjustment -= 0.02;
    }
    
    return adjustment;
}

/**
 * Calculate overall raise frequency by combining all factors.
 * @param {Object} data - All raise frequency data and adjustments
 * @returns {number} Overall raise frequency (0-1)
 */
function calculateOverallRaiseFrequency(data) {
    const { 
        base, 
        potOdds: potOddsAdjustment, 
        impliedOdds, 
        position, 
        stackDepth, 
        actionType, 
        street, 
        callFrequency, 
        potOddsData, 
        playerAction 
    } = data;
    
    // Start with base raise frequency
    let overallRaiseFrequency = base;
    
    // Apply adjustments
    overallRaiseFrequency += potOddsAdjustment;
    overallRaiseFrequency += impliedOdds;
    overallRaiseFrequency += position;
    overallRaiseFrequency += stackDepth;
    overallRaiseFrequency += actionType;
    overallRaiseFrequency += street;
    
    // Apply reasonable bounds for raw raise frequency
    // These bounds are based on GTO analysis of common spots
    if (playerAction.actionType === 'bet') {
        // Bets can be raised more frequently
        overallRaiseFrequency = Math.min(0.35, Math.max(0.02, overallRaiseFrequency));
    } else if (playerAction.actionType === 'raise') {
        // Re-raises are less common
        overallRaiseFrequency = Math.min(0.25, Math.max(0.01, overallRaiseFrequency));
    } else {
        // Other actions (calls, checks)
        overallRaiseFrequency = Math.min(0.30, Math.max(0.01, overallRaiseFrequency));
    }
    
    return overallRaiseFrequency;
}

/**
 * Generate explanation for raise frequency calculations.
 * @param {Object} data - Raise frequency data and adjustments
 * @returns {string} Explanation
 */
function generateRaiseFrequencyExplanation(data) {
    const { base, adjustments, overall, callFrequency, potOdds, playerAction } = data;
    const explanations = [];

    // Base raise frequency
    explanations.push(`Base raise frequency: ${(base * 100).toFixed(1)}%`);

    // Pot odds
    if (Math.abs(adjustments.potOdds) > 0.01) {
        const direction = adjustments.potOdds > 0 ? 'increases' : 'decreases';
        explanations.push(`Pot odds ${direction} raise frequency by ${Math.abs(adjustments.potOdds * 100).toFixed(1)}%`);
    }

    // Implied odds
    if (Math.abs(adjustments.impliedOdds) > 0.01) {
        const direction = adjustments.impliedOdds > 0 ? 'increases' : 'decreases';
        explanations.push(`Implied odds ${direction} raise frequency by ${Math.abs(adjustments.impliedOdds * 100).toFixed(1)}%`);
    }

    // Position
    if (Math.abs(adjustments.position) > 0.01) {
        const direction = adjustments.position > 0 ? 'increases' : 'decreases';
        explanations.push(`Position ${direction} raise frequency by ${Math.abs(adjustments.position * 100).toFixed(1)}%`);
    }

    // Stack depth
    if (Math.abs(adjustments.stackDepth) > 0.01) {
        const direction = adjustments.stackDepth > 0 ? 'increases' : 'decreases';
        explanations.push(`Stack depth ${direction} raise frequency by ${Math.abs(adjustments.stackDepth * 100).toFixed(1)}%`);
    }

    // Action type
    if (Math.abs(adjustments.actionType) > 0.01) {
        const direction = adjustments.actionType > 0 ? 'increases' : 'decreases';
        explanations.push(`Action type ${direction} raise frequency by ${Math.abs(adjustments.actionType * 100).toFixed(1)}%`);
    }

    // Street
    if (Math.abs(adjustments.street) > 0.01) {
        const direction = adjustments.street > 0 ? 'increases' : 'decreases';
        explanations.push(`Street ${direction} raise frequency by ${Math.abs(adjustments.street * 100).toFixed(1)}%`);
    }

    // Overall raise frequency
    explanations.push(`Overall raise frequency: ${(overall * 100).toFixed(1)}%`);

    // Call frequency context
    explanations.push(`Call frequency: ${(callFrequency * 100).toFixed(1)}%`);

    // Pot odds context
    if (potOdds.callAmount > 0) {
        const potOddsRatio = (potOdds.callAmount / (potOdds.potSize + potOdds.callAmount) * 100).toFixed(1);
        explanations.push(`Call amount: ${potOdds.callAmount}BB (${potOddsRatio}% of pot)`);
    }

    return explanations.join('. ');
}

module.exports = {
    calculateRaiseFrequency,
    calculateBaseRaiseFrequency,
    calculatePotOddsRaiseAdjustment,
    calculateImpliedOddsRaiseAdjustment,
    calculatePositionRaiseAdjustment,
    calculateStackDepthRaiseAdjustment,
    calculateActionTypeRaiseAdjustment,
    calculateStreetRaiseAdjustment,
    calculateOverallRaiseFrequency,
    generateRaiseFrequencyExplanation
}