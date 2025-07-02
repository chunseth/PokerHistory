/**
 * Step 11g: Adjust for Position
 * Adjusts fold frequency based on the opponent's position relative to the player.
 * 
 * @param {Object} playerAction - The player's action analysis from step 11a
 * @param {Object} hand - The hand object from the database
 * @param {string} opponentId - The opponent's player ID
 * @param {Object} rangeStrengthAdjustment - The range strength adjustment from step 11f
 * @returns {Object} Position adjustment analysis
 */
function adjustForPosition(playerAction, hand, opponentId, rangeStrengthAdjustment) {
    if (!playerAction || !hand || !opponentId) {
        return {
            positionAdjustment: 0,
            inPositionAdjustment: 0,
            outOfPositionAdjustment: 0,
            blindAdjustment: 0,
            overallPositionAdjustment: 0,
            adjustedFoldFrequency: 0.5,
            explanation: 'Missing input data'
        };
    }

    // Get position information
    const positionInfo = getPositionInformation(hand, playerAction.playerId, opponentId);
    
    // Calculate position-based adjustments
    const inPositionAdjustment = calculateInPositionAdjustment(positionInfo, playerAction);
    const outOfPositionAdjustment = calculateOutOfPositionAdjustment(positionInfo, playerAction);
    const blindAdjustment = calculateBlindAdjustment(positionInfo, playerAction);
    
    // Calculate overall position adjustment
    const overallPositionAdjustment = calculateOverallPositionAdjustment({
        inPosition: inPositionAdjustment,
        outOfPosition: outOfPositionAdjustment,
        blind: blindAdjustment,
        positionInfo
    });

    // Apply adjustment to the fold frequency from previous steps
    const baseFoldFrequency = safeNum(0.5 + (rangeStrengthAdjustment?.overallAdjustment || 0), 0.5);
    const adjustedFoldFrequency = Math.min(0.95, Math.max(0.05, baseFoldFrequency + safeNum(overallPositionAdjustment)));

    return {
        positionAdjustment: overallPositionAdjustment,
        inPositionAdjustment,
        outOfPositionAdjustment,
        blindAdjustment,
        overallPositionAdjustment,
        adjustedFoldFrequency,
        positionInfo,
        explanation: generatePositionExplanation({
            positionInfo,
            adjustments: {
                inPosition: inPositionAdjustment,
                outOfPosition: outOfPositionAdjustment,
                blind: blindAdjustment,
                overall: overallPositionAdjustment
            }
        })
    };
}

/**
 * Get position information for both players.
 * @param {Object} hand - The hand object from the database
 * @param {string} playerId - The player's ID
 * @param {string} opponentId - The opponent's ID
 * @returns {Object} Position information
 */
function getPositionInformation(hand, playerId, opponentId) {
    if (!hand.players) {
        return {
            playerPosition: 'unknown',
            opponentPosition: 'unknown',
            isPlayerInPosition: false,
            isOpponentInPosition: false,
            isBlindVsBlind: false,
            isPlayerBlind: false,
            isOpponentBlind: false
        };
    }

    const player = hand.players.find(p => p.id === playerId);
    const opponent = hand.players.find(p => p.id === opponentId);
    
    if (!player || !opponent) {
        return {
            playerPosition: 'unknown',
            opponentPosition: 'unknown',
            isPlayerInPosition: false,
            isOpponentInPosition: false,
            isBlindVsBlind: false,
            isPlayerBlind: false,
            isOpponentBlind: false
        };
    }

    const playerPosition = player.position;
    const opponentPosition = opponent.position;
    
    // Determine who is in position (acts last)
    const positionOrder = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
    const playerIndex = positionOrder.indexOf(playerPosition);
    const opponentIndex = positionOrder.indexOf(opponentPosition);
    
    const isPlayerInPosition = playerIndex > opponentIndex;
    const isOpponentInPosition = opponentIndex > playerIndex;
    
    // Check if this is blind vs blind
    const isBlindVsBlind = (playerPosition === 'SB' && opponentPosition === 'BB') ||
                           (playerPosition === 'BB' && opponentPosition === 'SB');
    
    // Check if either player is in the blinds
    const isPlayerBlind = playerPosition === 'SB' || playerPosition === 'BB';
    const isOpponentBlind = opponentPosition === 'SB' || opponentPosition === 'BB';

    return {
        playerPosition,
        opponentPosition,
        isPlayerInPosition,
        isOpponentInPosition,
        isBlindVsBlind,
        isPlayerBlind,
        isOpponentBlind,
        playerIndex,
        opponentIndex
    };
}

/**
 * Calculate adjustment when opponent is in position.
 * @param {Object} positionInfo - Position information
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Adjustment factor
 */
function calculateInPositionAdjustment(positionInfo, playerAction) {
    if (!positionInfo.isOpponentInPosition) return 0;

    let adjustment = 0;

    // In-position players are more likely to call and less likely to fold
    adjustment -= 0.15; // 15% fewer folds when in position

    // Adjust based on action type
    if (playerAction.actionType === 'bet') {
        if (playerAction.betSizing === 'small') {
            adjustment -= 0.05; // Even fewer folds to small bets in position
        } else if (playerAction.betSizing === 'large') {
            adjustment += 0.05; // More folds to large bets (but still less than OOP)
        }
    } else if (playerAction.actionType === 'raise') {
        adjustment -= 0.10; // Fewer folds to raises when in position
    }

    // Adjust based on street
    if (playerAction.street === 'flop') {
        adjustment -= 0.05; // More calling on flop when in position
    } else if (playerAction.street === 'turn') {
        adjustment -= 0.03; // Slightly more calling on turn
    } else if (playerAction.street === 'river') {
        adjustment += 0.02; // Slightly more folding on river (less implied odds)
    }

    // Adjust for action context
    if (playerAction.isContinuationBet && positionInfo.isOpponentInPosition) {
        adjustment -= 0.08; // In-position players call c-bets more
    }

    if (playerAction.isValueBet && positionInfo.isOpponentInPosition) {
        adjustment += 0.05; // In-position players fold more to value bets
    }

    return adjustment;
}

/**
 * Calculate adjustment when opponent is out of position.
 * @param {Object} positionInfo - Position information
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Adjustment factor
 */
function calculateOutOfPositionAdjustment(positionInfo, playerAction) {
    if (!positionInfo.isPlayerInPosition) return 0;

    let adjustment = 0;

    // Out-of-position players are more likely to fold
    adjustment += 0.20; // 20% more folds when out of position

    // Adjust based on action type
    if (playerAction.actionType === 'bet') {
        if (playerAction.betSizing === 'small') {
            adjustment += 0.05; // More folds to small bets OOP
        } else if (playerAction.betSizing === 'large') {
            adjustment += 0.10; // Many more folds to large bets OOP
        }
    } else if (playerAction.actionType === 'raise') {
        adjustment += 0.15; // More folds to raises when OOP
    }

    // Adjust based on street
    if (playerAction.street === 'flop') {
        adjustment += 0.03; // More folds on flop when OOP
    } else if (playerAction.street === 'turn') {
        adjustment += 0.05; // Even more folds on turn when OOP
    } else if (playerAction.street === 'river') {
        adjustment += 0.08; // Most folds on river when OOP
    }

    // Adjust for action context
    if (playerAction.isContinuationBet && positionInfo.isPlayerInPosition) {
        adjustment += 0.10; // OOP players fold to c-bets more
    }

    if (playerAction.isBluff && positionInfo.isPlayerInPosition) {
        adjustment -= 0.05; // OOP players might call bluffs more (bluff catching)
    }

    return adjustment;
}

/**
 * Calculate adjustment for blind vs blind situations.
 * @param {Object} positionInfo - Position information
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Adjustment factor
 */
function calculateBlindAdjustment(positionInfo, playerAction) {
    if (!positionInfo.isBlindVsBlind) return 0;

    let adjustment = 0;

    // Blind vs blind is more aggressive and less likely to fold
    adjustment -= 0.10; // 10% fewer folds in blind vs blind

    // Adjust based on which blind is acting
    if (positionInfo.opponentPosition === 'BB') {
        // BB is in position and more likely to call
        adjustment -= 0.05; // Additional reduction for BB
    } else if (positionInfo.opponentPosition === 'SB') {
        // SB is out of position but still more aggressive
        adjustment -= 0.03; // Small reduction for SB
    }

    // Adjust based on action type
    if (playerAction.actionType === 'bet') {
        if (playerAction.betSizing === 'small') {
            adjustment -= 0.08; // Fewer folds to small bets in BvB
        } else if (playerAction.betSizing === 'large') {
            adjustment += 0.05; // More folds to large bets (but still less than normal)
        }
    } else if (playerAction.actionType === 'raise') {
        adjustment -= 0.05; // Fewer folds to raises in BvB
    }

    // Adjust based on street
    if (playerAction.street === 'flop') {
        adjustment -= 0.05; // More calling on flop in BvB
    } else if (playerAction.street === 'turn') {
        adjustment -= 0.03; // Slightly more calling on turn
    } else if (playerAction.street === 'river') {
        adjustment += 0.02; // Slightly more folding on river
    }

    return adjustment;
}

/**
 * Calculate overall position adjustment by combining all factors.
 * @param {Object} adjustments - All position adjustment factors
 * @returns {number} Overall position adjustment
 */
function calculateOverallPositionAdjustment(adjustments) {
    const { inPosition, outOfPosition, blind, positionInfo } = adjustments;
    
    // Weight the adjustments based on their importance
    let overallAdjustment = 0;

    // In-position adjustment (highest weight)
    if (positionInfo.isOpponentInPosition) {
        overallAdjustment += inPosition * 0.4;
    }

    // Out-of-position adjustment (highest weight)
    if (positionInfo.isPlayerInPosition) {
        overallAdjustment += outOfPosition * 0.4;
    }

    // Blind adjustment (moderate weight)
    if (positionInfo.isBlindVsBlind) {
        overallAdjustment += blind * 0.2;
    }

    // Apply reasonable bounds
    return Math.min(0.3, Math.max(-0.3, overallAdjustment));
}

/**
 * Generate explanation for position adjustments.
 * @param {Object} data - Position data and adjustments
 * @returns {string} Explanation
 */
function generatePositionExplanation(data) {
    const { positionInfo, adjustments } = data;
    const explanations = [];

    // Position relationship
    if (positionInfo.isOpponentInPosition) {
        explanations.push(`Opponent is in position (${positionInfo.opponentPosition} vs ${positionInfo.playerPosition})`);
    } else if (positionInfo.isPlayerInPosition) {
        explanations.push(`Opponent is out of position (${positionInfo.opponentPosition} vs ${positionInfo.playerPosition})`);
    } else {
        explanations.push(`Same position (${positionInfo.opponentPosition})`);
    }

    // Blind vs blind
    if (positionInfo.isBlindVsBlind) {
        explanations.push('Blind vs blind situation increases aggression');
    }

    // In-position adjustment
    if (positionInfo.isOpponentInPosition) {
        const adj = safeNum(adjustments.inPosition);
        const direction = adj < 0 ? 'decreases' : 'increases';
        explanations.push(`In-position advantage ${direction} fold frequency by ${(Math.abs(adj) * 100).toFixed(1)}%`);
    }

    // Out-of-position adjustment
    if (positionInfo.isPlayerInPosition) {
        const adj = safeNum(adjustments.outOfPosition);
        const direction = adj > 0 ? 'increases' : 'decreases';
        explanations.push(`Out-of-position disadvantage ${direction} fold frequency by ${(Math.abs(adj) * 100).toFixed(1)}%`);
    }

    // Blind adjustment
    if (positionInfo.isBlindVsBlind) {
        const adj = safeNum(adjustments.blind);
        const direction = adj > 0 ? 'increases' : 'decreases';
        explanations.push(`Blind vs blind dynamics ${direction} fold frequency by ${(Math.abs(adj) * 100).toFixed(1)}%`);
    }

    // Overall adjustment
    const overallAdj = safeNum(adjustments.overall);
    if (Math.abs(overallAdj) > 0.05) {
        const direction = overallAdj > 0 ? 'increases' : 'decreases';
        explanations.push(`Overall position adjustment ${direction} fold frequency by ${(Math.abs(overallAdj) * 100).toFixed(1)}%`);
    }

    return explanations.join('. ');
}

// Utility to ensure finite numeric
const safeNum = (v, def = 0) => (Number.isFinite(v) ? v : def);

module.exports = {
    adjustForPosition,
    getPositionInformation,
    calculateInPositionAdjustment,
    calculateOutOfPositionAdjustment,
    calculateBlindAdjustment,
    calculateOverallPositionAdjustment,
    generatePositionExplanation
}