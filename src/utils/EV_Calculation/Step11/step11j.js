/**
 * Step 11j: Calculate Call Frequency
 * Calculates the probability that the opponent will call the player's action.
 * This step integrates the results from steps g (position), h (stack depth), and i (multiway).
 * 
 * @param {Object} potOdds - The pot odds analysis from step 11b
 * @param {Object} stackDepthInfo - The stack depth info from step 11h
 * @param {Object} multiwayAdjustment - The multiway adjustment from step 11i
 * @param {Object} positionAdjustment - The position adjustment from step 11g
 * @param {Object} playerAction - The player's action analysis from step 11a
 * @param {Object} hand - The hand object from the database
 * @param {Array} actions - Array of all postflop actions
 * @param {number} actionIndex - Index of the current action
 * @param {string} opponentId - The opponent's player ID
 * @returns {Object} Call frequency analysis
 */
function calculateCallFrequency(potOdds, stackDepthInfo, multiwayAdjustment, positionAdjustment, playerAction, hand, actions, actionIndex, opponentId) {
    if (!potOdds || !stackDepthInfo || !multiwayAdjustment || !positionAdjustment || !playerAction || !hand) {
        return {
            baseCallFrequency: 0,
            potOddsAdjustment: 0,
            stackDepthAdjustment: 0,
            multiwayAdjustment: 0,
            positionAdjustment: 0,
            overallCallFrequency: 0,
            explanation: 'Missing input data'
        };
    }

    // Calculate base call frequency from pot odds
    const baseCallFrequency = calculateBaseCallFrequency(potOdds, playerAction);

    // Get stack depth adjustment (from step 11h)
    // Invert the stack depth adjustment since it was calculated for folds
    const stackDepthAdjustment = -stackDepthInfo.overallStackAdjustment;

    // Get multiway adjustment (from step 11i)
    const multiwayInfo = multiwayAdjustment.multiwayInfo;
    // Invert the multiway adjustment since step11i calculated fold adjustments
    const multiwayCallAdjustment = -multiwayAdjustment.overallMultiwayAdjustment;

    // Get position adjustment (from step 11g)
    // Invert the position adjustment since it was calculated for folds
    const positionCallAdjustment = -positionAdjustment.overallPositionAdjustment;

    // Calculate overall call frequency
    const overallCallFrequency = calculateOverallCallFrequency({
        base: baseCallFrequency,
        stackDepth: stackDepthAdjustment,
        multiway: multiwayCallAdjustment,
        position: positionCallAdjustment,
        potOdds: potOdds,
        playerAction: playerAction,
        multiwayInfo: multiwayInfo,
        stackDepthInfo: stackDepthInfo,
        positionInfo: positionAdjustment.positionInfo
    });

    return {
        baseCallFrequency,
        potOddsAdjustment: 0, // Now handled in base calculation
        stackDepthAdjustment,
        multiwayAdjustment: multiwayCallAdjustment,
        positionAdjustment: positionCallAdjustment,
        overallCallFrequency,
        explanation: generateCallFrequencyExplanation({
            base: baseCallFrequency,
            adjustments: {
                stackDepth: stackDepthAdjustment,
                multiway: multiwayCallAdjustment,
                position: positionCallAdjustment
            },
            overall: overallCallFrequency,
            potOdds: potOdds,
            playerAction: playerAction,
            multiwayInfo: multiwayInfo,
            stackDepthInfo: stackDepthInfo,
            positionInfo: positionAdjustment.positionInfo
        })
    };
}

/**
 * Calculate base call frequency using pot odds.
 * @param {Object} potOdds - Pot odds analysis
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Base call frequency (0-1)
 */
function calculateBaseCallFrequency(potOdds, playerAction) {
    if (playerAction.actionType === 'check') return 0;
    if (potOdds.callAmount === 0) return 0;

    // Use pot odds to determine base call frequency
    const potOddsRatio = potOdds.potOdds;
    const impliedOdds = potOdds.impliedOdds;

    // Start with pot odds-based frequency
    let baseFrequency = 1 - potOddsRatio;

    // Adjust for implied odds
    if (impliedOdds > 1.5) {
        baseFrequency *= 1.2; // Better implied odds increase calling
    } else if (impliedOdds < 1.0) {
        baseFrequency *= 0.8; // Worse implied odds decrease calling
    }

    // Adjust for action type
    if (playerAction.actionType === 'raise') {
        baseFrequency *= 0.9; // Less likely to call raises
    }

    return Math.min(0.95, Math.max(0.05, baseFrequency));
}

/**
 * Calculate overall call frequency by combining all factors.
 * @param {Object} data - All call frequency data and adjustments
 * @returns {number} Overall call frequency (0-1)
 */
function calculateOverallCallFrequency(data) {
    const { base, stackDepth, multiway, position, potOdds, playerAction, multiwayInfo, stackDepthInfo, positionInfo } = data;
    
    // Start with base call frequency
    let overallCallFrequency = base;
    
    // Apply stack depth adjustment
    overallCallFrequency += stackDepth;
    
    // Apply multiway adjustment
    overallCallFrequency += multiway;

    // Apply position adjustment
    overallCallFrequency += position;
    
    // Apply reasonable bounds
    overallCallFrequency = Math.min(0.95, Math.max(0.05, overallCallFrequency));
    
    // Ensure call frequency doesn't exceed 1 - fold frequency
    // Use multiway, stack depth, and position info to estimate fold frequency
    const estimatedFoldFrequency = 0.5 + multiwayInfo.multiwayPotOddsAdjustment - 1;
    const maxCallFrequency = 1 - Math.max(0.05, estimatedFoldFrequency);
    
    overallCallFrequency = Math.min(overallCallFrequency, maxCallFrequency);
    
    return overallCallFrequency;
}

/**
 * Generate explanation for call frequency calculations.
 * @param {Object} data - Call frequency data and adjustments
 * @returns {string} Explanation
 */
function generateCallFrequencyExplanation(data) {
    const { base, adjustments, overall, potOdds, playerAction, multiwayInfo, stackDepthInfo, positionInfo } = data;
    const explanations = [];

    // Base call frequency
    explanations.push(`Base call frequency from pot odds: ${(base * 100).toFixed(1)}%`);

    // Stack depth adjustment
    if (Math.abs(adjustments.stackDepth) > 0.01) {
        const direction = adjustments.stackDepth > 0 ? 'increases' : 'decreases';
        explanations.push(`Stack depth (${stackDepthInfo.stackDepthCategory}) ${direction} call frequency by ${Math.abs(adjustments.stackDepth * 100).toFixed(1)}%`);
    }

    // Multiway adjustment
    if (Math.abs(adjustments.multiway) > 0.01) {
        const direction = adjustments.multiway > 0 ? 'increases' : 'decreases';
        explanations.push(`Multiway dynamics ${direction} call frequency by ${Math.abs(adjustments.multiway * 100).toFixed(1)}%`);
    }

    // Position adjustment
    if (Math.abs(adjustments.position) > 0.01) {
        const direction = adjustments.position > 0 ? 'increases' : 'decreases';
        const positionContext = positionInfo.isOpponentInPosition ? 'in position' : 'out of position';
        explanations.push(`Position (${positionContext}) ${direction} call frequency by ${Math.abs(adjustments.position * 100).toFixed(1)}%`);
    }

    // Pot context
    if (potOdds.callAmount > 0) {
        explanations.push(`Call amount: ${potOdds.callAmount}BB (${(potOdds.potOdds * 100).toFixed(1)}% of pot)`);
    }

    // Stack depth context
    explanations.push(`Stack depth: ${stackDepthInfo.stackToPotRatio.toFixed(1)}x pot` + 
        (stackDepthInfo.isTournament ? ' (tournament)' : ' (cash game)'));

    // Multiway context
    if (multiwayInfo.isHeadsUp) {
        explanations.push('Heads-up situation');
    } else if (multiwayInfo.isThreeWay) {
        explanations.push('Three-way situation');
    } else if (multiwayInfo.isFourPlusWay) {
        explanations.push(`${multiwayInfo.activePlayers}-way situation`);
    }

    // Position context
    if (positionInfo.isOpponentInPosition) {
        explanations.push(`Opponent is in position (${positionInfo.opponentPosition})`);
    } else if (positionInfo.isPlayerInPosition) {
        explanations.push(`Opponent is out of position (${positionInfo.opponentPosition})`);
    }
    if (positionInfo.isBlindVsBlind) {
        explanations.push('Blind vs blind situation');
    }

    // Overall call frequency
    explanations.push(`Overall call frequency: ${(overall * 100).toFixed(1)}%`);

    return explanations.join('. ');
}

module.exports = {
    calculateCallFrequency,
    calculateBaseCallFrequency,
    calculateOverallCallFrequency,
    generateCallFrequencyExplanation
};