/**
 * Step 11i: Adjust for Multiway vs Heads-up
 * Adjusts fold frequency based on whether the hand is multiway or heads-up.
 * 
 * @param {Object} hand - The hand object from the database
 * @param {Array} actions - Array of all postflop actions
 * @param {number} actionIndex - Index of the current action
 * @param {Object} playerAction - The player's action analysis from step 11a
 * @param {Object} stackDepthAdjustment - The stack depth adjustment from step 11h
 * @returns {Object} Multiway adjustment analysis
 */
function adjustForMultiwayVsHeadsUp(hand, actions, actionIndex, playerAction, stackDepthAdjustment) {
    if (!hand || !actions || !playerAction) {
        return {
            multiwayAdjustment: 0,
            headsUpAdjustment: 0,
            threeWayAdjustment: 0,
            fourPlusWayAdjustment: 0,
            overallMultiwayAdjustment: 0,
            adjustedFoldFrequency: 0.5,
            explanation: 'Missing input data'
        };
    }

    // Get multiway information
    const multiwayInfo = getMultiwayInformation(hand, actions, actionIndex, playerAction);
    
    // Calculate multiway-based adjustments
    const headsUpAdjustment = calculateHeadsUpAdjustment(multiwayInfo, playerAction);
    const threeWayAdjustment = calculateThreeWayAdjustment(multiwayInfo, playerAction);
    const fourPlusWayAdjustment = calculateFourPlusWayAdjustment(multiwayInfo, playerAction);
    
    // Calculate overall multiway adjustment
    const overallMultiwayAdjustment = calculateOverallMultiwayAdjustment({
        headsUp: headsUpAdjustment,
        threeWay: threeWayAdjustment,
        fourPlusWay: fourPlusWayAdjustment,
        multiwayInfo
    });

    // Apply adjustment to the fold frequency from previous steps
    const baseFoldFrequency = safeNum(0.5 + (stackDepthAdjustment?.overallStackAdjustment || 0), 0.5);
    const adjustedFoldFrequency = Math.min(0.95, Math.max(0.05, baseFoldFrequency + safeNum(overallMultiwayAdjustment)));

    return {
        multiwayAdjustment: overallMultiwayAdjustment,
        headsUpAdjustment,
        threeWayAdjustment,
        fourPlusWayAdjustment,
        overallMultiwayAdjustment,
        adjustedFoldFrequency,
        multiwayInfo,
        explanation: generateMultiwayExplanation({
            multiwayInfo,
            adjustments: {
                headsUp: headsUpAdjustment,
                threeWay: threeWayAdjustment,
                fourPlusWay: fourPlusWayAdjustment,
                overall: overallMultiwayAdjustment
            }
        })
    };
}

/**
 * Get comprehensive multiway information.
 * @param {Object} hand - The hand object from the database
 * @param {Array} actions - Array of all postflop actions
 * @param {number} actionIndex - Index of the current action
 * @param {Object} playerAction - Player's action analysis
 * @returns {Object} Multiway information
 */
function getMultiwayInformation(hand, actions, actionIndex, playerAction) {
    // Count active players at this point in the hand
    const activePlayers = countActivePlayers(hand, actions, actionIndex);
    
    // Determine multiway category
    let multiwayCategory;
    if (activePlayers === 2) {
        multiwayCategory = 'heads_up';
    } else if (activePlayers === 3) {
        multiwayCategory = 'three_way';
    } else {
        multiwayCategory = 'four_plus_way';
    }

    // Count players left to act
    const playersLeftToAct = countPlayersLeftToAct(hand, actions, actionIndex, playerAction.playerId);
    
    // Check if this is a multiway pot
    const isMultiwayPot = activePlayers > 2;
    
    // Calculate pot odds adjustments for multiway
    const multiwayPotOddsAdjustment = calculateMultiwayPotOddsAdjustment(activePlayers);
    
    // Check for multiway dynamics
    const multiwayDynamics = analyzeMultiwayDynamics(hand, actions, actionIndex, activePlayers);

    return {
        activePlayers,
        multiwayCategory,
        playersLeftToAct,
        isMultiwayPot,
        multiwayPotOddsAdjustment,
        multiwayDynamics,
        isHeadsUp: activePlayers === 2,
        isThreeWay: activePlayers === 3,
        isFourPlusWay: activePlayers >= 4
    };
}

/**
 * Count active players at a given action index.
 * @param {Object} hand - The hand object
 * @param {Array} actions - Array of all actions
 * @param {number} actionIndex - Index of the current action
 * @returns {number} Number of active players
 */
function countActivePlayers(hand, actions, actionIndex) {
    if (!hand.players) return 2; // Default to heads-up if no player data

    // Start with all players
    let activePlayers = hand.players.length;
    
    // Subtract players who have folded
    for (let i = 0; i <= actionIndex; i++) {
        const action = actions[i];
        if (action && action.action === 'fold') {
            // Check if this player is still active
            const playerStillActive = hand.players.some(p => p.id === action.playerId && !p.folded);
            if (playerStillActive) {
                activePlayers--;
            }
        }
    }
    
    return Math.max(2, activePlayers); // Minimum of 2 players
}

/**
 * Count players left to act after the current action.
 * @param {Object} hand - The hand object
 * @param {Array} actions - Array of all actions
 * @param {number} actionIndex - Index of the current action
 * @param {string} currentPlayerId - ID of the current player
 * @returns {number} Number of players left to act
 */
function countPlayersLeftToAct(hand, actions, actionIndex, currentPlayerId) {
    if (!hand.players) return 1; // Default to 1 if no player data

    // Find the current player's position
    const currentPlayer = hand.players.find(p => p.id === currentPlayerId);
    if (!currentPlayer) return 1;

    // Count players who haven't acted yet in this street
    const currentStreet = actions[actionIndex]?.street;
    const playersActedThisStreet = new Set();
    
    for (let i = 0; i <= actionIndex; i++) {
        const action = actions[i];
        if (action && action.street === currentStreet) {
            playersActedThisStreet.add(action.playerId);
        }
    }

    // Count players who haven't acted yet
    const activePlayers = hand.players.filter(p => !p.folded);
    const playersLeftToAct = activePlayers.filter(p => !playersActedThisStreet.has(p.id)).length;
    
    return Math.max(0, playersLeftToAct);
}

/**
 * Calculate pot odds adjustment for multiway situations.
 * @param {number} activePlayers - Number of active players
 * @returns {number} Pot odds adjustment factor
 */
function calculateMultiwayPotOddsAdjustment(activePlayers) {
    // Multiway pots require better pot odds due to more opponents
    if (activePlayers === 2) return 1.0; // No adjustment for heads-up
    if (activePlayers === 3) return 1.2; // 20% worse pot odds needed
    if (activePlayers === 4) return 1.4; // 40% worse pot odds needed
    return 1.6; // 60% worse pot odds needed for 5+ players
}

/**
 * Analyze multiway dynamics and tendencies.
 * @param {Object} hand - The hand object
 * @param {Array} actions - Array of all actions
 * @param {number} actionIndex - Index of the current action
 * @param {number} activePlayers - Number of active players
 * @returns {Object} Multiway dynamics
 */
function analyzeMultiwayDynamics(hand, actions, actionIndex, activePlayers) {
    const dynamics = {
        hasAggressivePlayer: false,
        hasPassivePlayer: false,
        averageBetSize: 0,
        continuationBetFrequency: 0,
        checkRaiseFrequency: 0
    };

    // Analyze betting patterns in this hand
    let totalBets = 0;
    let betCount = 0;
    let cbetCount = 0;
    let checkRaiseCount = 0;

    for (let i = 0; i <= actionIndex; i++) {
        const action = actions[i];
        if (action) {
            if (action.action === 'bet' || action.action === 'raise') {
                totalBets += action.amount || 0;
                betCount++;
            }
            
            // Count continuation bets
            if (action.action === 'bet' && action.street === 'flop' && i > 0) {
                const prevAction = actions[i - 1];
                if (prevAction && prevAction.street === 'preflop' && 
                    (prevAction.action === 'bet' || prevAction.action === 'raise')) {
                    cbetCount++;
                }
            }
            
            // Count check-raises
            if (action.action === 'raise' && i > 0) {
                const prevAction = actions[i - 1];
                if (prevAction && prevAction.action === 'check') {
                    checkRaiseCount++;
                }
            }
        }
    }

    dynamics.averageBetSize = betCount > 0 ? totalBets / betCount : 0;
    dynamics.continuationBetFrequency = cbetCount / Math.max(1, activePlayers);
    dynamics.checkRaiseFrequency = checkRaiseCount / Math.max(1, activePlayers);

    return dynamics;
}

/**
 * Calculate adjustment for heads-up situations.
 * @param {Object} multiwayInfo - Multiway information
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Adjustment factor
 */
function calculateHeadsUpAdjustment(multiwayInfo, playerAction) {
    if (!multiwayInfo.isHeadsUp) return 0;

    let adjustment = 0;

    // Heads-up is more aggressive and less likely to fold
    adjustment -= 0.10; // 10% fewer folds in heads-up

    // Adjust based on action type
    if (playerAction.actionType === 'bet') {
        if (playerAction.betSizing === 'small') {
            adjustment -= 0.05; // Fewer folds to small bets in heads-up
        } else if (playerAction.betSizing === 'large') {
            adjustment += 0.03; // Slightly more folds to large bets
        }
    } else if (playerAction.actionType === 'raise') {
        adjustment -= 0.08; // Fewer folds to raises in heads-up
    }

    // Adjust based on street
    if (playerAction.street === 'flop') {
        adjustment -= 0.05; // More calling on flop in heads-up
    } else if (playerAction.street === 'turn') {
        adjustment -= 0.03; // More calling on turn
    } else if (playerAction.street === 'river') {
        adjustment += 0.02; // Slightly more folding on river
    }

    // Adjust for action context
    if (playerAction.isContinuationBet) {
        adjustment -= 0.05; // Heads-up players call c-bets more
    }

    if (playerAction.isBluff) {
        adjustment += 0.03; // Heads-up players might fold more to bluffs
    }

    return adjustment;
}

/**
 * Calculate adjustment for three-way situations.
 * @param {Object} multiwayInfo - Multiway information
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Adjustment factor
 */
function calculateThreeWayAdjustment(multiwayInfo, playerAction) {
    if (!multiwayInfo.isThreeWay) return 0;

    let adjustment = 0;

    // Three-way is more cautious than heads-up
    adjustment += 0.05; // 5% more folds in three-way

    // Adjust based on action type
    if (playerAction.actionType === 'bet') {
        if (playerAction.betSizing === 'small') {
            adjustment += 0.03; // More folds to small bets in three-way
        } else if (playerAction.betSizing === 'large') {
            adjustment += 0.08; // More folds to large bets
        }
    } else if (playerAction.actionType === 'raise') {
        adjustment += 0.05; // More folds to raises in three-way
    }

    // Adjust based on street
    if (playerAction.street === 'flop') {
        adjustment += 0.02; // More folds on flop in three-way
    } else if (playerAction.street === 'turn') {
        adjustment += 0.05; // More folds on turn
    } else if (playerAction.street === 'river') {
        adjustment += 0.08; // More folds on river
    }

    // Adjust for action context
    if (playerAction.isContinuationBet) {
        adjustment += 0.03; // Three-way players fold to c-bets more
    }

    if (playerAction.isCheckRaise) {
        adjustment += 0.05; // Three-way players fold to check-raises more
    }

    // Adjust for players left to act
    if (multiwayInfo.playersLeftToAct > 0) {
        adjustment += 0.02; // More players to act increases folds
    }

    return adjustment;
}

/**
 * Calculate adjustment for four-plus-way situations.
 * @param {Object} multiwayInfo - Multiway information
 * @param {Object} playerAction - Player's action analysis
 * @returns {number} Adjustment factor
 */
function calculateFourPlusWayAdjustment(multiwayInfo, playerAction) {
    if (!multiwayInfo.isFourPlusWay) return 0;

    let adjustment = 0;

    // Four-plus-way is very cautious
    adjustment += 0.15; // 15% more folds in four-plus-way

    // Adjust based on action type
    if (playerAction.actionType === 'bet') {
        if (playerAction.betSizing === 'small') {
            adjustment += 0.05; // More folds to small bets
        } else if (playerAction.betSizing === 'large') {
            adjustment += 0.12; // Many more folds to large bets
        }
    } else if (playerAction.actionType === 'raise') {
        adjustment += 0.10; // More folds to raises
    }

    // Adjust based on street
    if (playerAction.street === 'flop') {
        adjustment += 0.05; // More folds on flop
    } else if (playerAction.street === 'turn') {
        adjustment += 0.08; // More folds on turn
    } else if (playerAction.street === 'river') {
        adjustment += 0.12; // Most folds on river
    }

    // Adjust for action context
    if (playerAction.isContinuationBet) {
        adjustment += 0.08; // Four-plus-way players fold to c-bets more
    }

    if (playerAction.isCheckRaise) {
        adjustment += 0.10; // Four-plus-way players fold to check-raises more
    }

    // Adjust for players left to act
    if (multiwayInfo.playersLeftToAct > 1) {
        adjustment += 0.05; // Many players to act increases folds significantly
    }

    // Adjust for multiway dynamics
    if (multiwayInfo.multiwayDynamics.hasAggressivePlayer) {
        adjustment += 0.03; // Aggressive players in multiway increase folds
    }

    return adjustment;
}

/**
 * Calculate overall multiway adjustment by combining all factors.
 * @param {Object} adjustments - All multiway adjustment factors
 * @returns {number} Overall multiway adjustment
 */
function calculateOverallMultiwayAdjustment(adjustments) {
    const { headsUp, threeWay, fourPlusWay, multiwayInfo } = adjustments;
    
    // Weight the adjustments based on multiway category
    let overallAdjustment = 0;

    switch (multiwayInfo.multiwayCategory) {
        case 'heads_up':
            overallAdjustment = headsUp;
            break;
        case 'three_way':
            overallAdjustment = threeWay;
            break;
        case 'four_plus_way':
            overallAdjustment = fourPlusWay;
            break;
        default:
            overallAdjustment = 0;
    }

    // Apply reasonable bounds
    return Math.min(0.25, Math.max(-0.15, overallAdjustment));
}

/**
 * Generate explanation for multiway adjustments.
 * @param {Object} data - Multiway data and adjustments
 * @returns {string} Explanation
 */
function generateMultiwayExplanation(data) {
    const { multiwayInfo, adjustments } = data;
    const explanations = [];
    const fmt = (n) => Number.isFinite(n) ? n.toFixed(1) : '--';

    // Multiway category
    const categoryNames = {
        'heads_up': 'Heads-up',
        'three_way': 'Three-way',
        'four_plus_way': 'Four-plus-way'
    };
    
    explanations.push(`${categoryNames[multiwayInfo.multiwayCategory]} pot (${multiwayInfo.activePlayers} players)`);

    // Players left to act
    if (multiwayInfo.playersLeftToAct > 0) {
        explanations.push(`${multiwayInfo.playersLeftToAct} players left to act`);
    }

    // Multiway adjustment
    const overallAdj = safeNum(adjustments.overall);
    if (Math.abs(overallAdj) > 0.01) {
        const direction = overallAdj > 0 ? 'increases' : 'decreases';
        explanations.push(`Multiway dynamics ${direction} fold frequency by ${(Math.abs(overallAdj) * 100).toFixed(1)}%`);
    }

    // Pot odds adjustment
    const potAdj = safeNum(multiwayInfo.multiwayPotOddsAdjustment, 1);
    if (potAdj > 1.0) {
        explanations.push(`Worse pot odds needed (${fmt(potAdj)}x adjustment)`);
    }

    // Multiway dynamics
    if (multiwayInfo.multiwayDynamics.continuationBetFrequency > 0.5) {
        explanations.push('High continuation bet frequency');
    }

    if (safeNum(multiwayInfo.multiwayDynamics.checkRaiseFrequency) > 0.3) {
        explanations.push('High check-raise frequency');
    }

    return explanations.join('. ');
}

// Numeric guard
const safeNum = (v, def = 0) => (Number.isFinite(v) ? v : def);


module.exports = {
    adjustForMultiwayVsHeadsUp,
    getMultiwayInformation,
    countActivePlayers,
    countPlayersLeftToAct,
    calculateMultiwayPotOddsAdjustment,
    analyzeMultiwayDynamics,
    calculateHeadsUpAdjustment,
    calculateThreeWayAdjustment,
    calculateFourPlusWayAdjustment,
    calculateOverallMultiwayAdjustment,
    generateMultiwayExplanation
}