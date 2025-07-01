// Step 11b: Calculate Pot Odds for Opponent
// This module provides functions to calculate pot odds and related metrics for the opponent.

/**
 * Step 11b: Calculate Pot Odds for Opponent
 * Calculates the pot odds the opponent faces when deciding whether to call.
 * 
 * @param {Object} playerAction - The action analysis from step 11a
 * @param {Object} hand - The full hand object
 * @param {Array} actions - Array of all postflop actions
 * @param {number} actionIndex - Index of the current action
 * @param {string} opponentId - The opponent's player ID
 * @returns {Object} Pot odds analysis object
 */
function calculatePotOddsForOpponent(playerAction, hand, actions, actionIndex, opponentId) {
    if (!playerAction || !hand || !opponentId) {
        return {
            callAmount: 0,
            potOdds: 0,
            potOddsPercentage: 0,
            betSizing: 'none',
            effectiveStack: 0,
            stackToPotRatio: 0,
            impliedOdds: 0,
            reverseImpliedOdds: 0
        };
    }

    // Calculate the amount the opponent needs to call
    const callAmount = calculateCallAmount(playerAction, hand, actions, actionIndex, opponentId);
    
    // Get current pot size
    const potSize = playerAction.potSize;
    
    // Calculate basic pot odds
    const potOdds = calculateBasicPotOdds(callAmount, potSize);
    const potOddsPercentage = potOdds * 100;
    
    // Determine bet sizing category
    const betSizing = playerAction.betSizing;
    
    // Calculate effective stack and stack-to-pot ratio
    const effectiveStack = calculateEffectiveStack(hand, actions, actionIndex, opponentId);
    const stackToPotRatio = effectiveStack / potSize;
    
    // Calculate implied odds (for drawing hands)
    const impliedOdds = calculateImpliedOdds(playerAction, effectiveStack, potSize, callAmount);
    
    // Calculate reverse implied odds (risk of losing more money)
    const reverseImpliedOdds = calculateReverseImpliedOdds(playerAction, effectiveStack, potSize, callAmount);
    
    return {
        callAmount,
        potOdds,
        potOddsPercentage,
        betSizing,
        effectiveStack,
        stackToPotRatio,
        impliedOdds,
        reverseImpliedOdds,
        // Additional context for decision making
        isAllIn: playerAction.isAllIn,
        remainingStreets: calculateRemainingStreets(playerAction.street),
        position: getOpponentPosition(hand, opponentId, playerAction.position),
        street: playerAction.street
    };
}

/**
 * Calculate the amount the opponent needs to call.
 * @param {Object} playerAction - The player's action analysis
 * @param {Object} hand - The hand object
 * @param {Array} actions - Array of all actions
 * @param {number} actionIndex - Index of the current action
 * @param {string} opponentId - The opponent's player ID
 * @returns {number} Amount to call in BB
 */
function calculateCallAmount(playerAction, hand, actions, actionIndex, opponentId) {
    if (playerAction.actionType === 'check') return 0;
    
    // Find the opponent's current bet in this street
    let opponentBet = 0;
    for (let i = 0; i < actionIndex; i++) {
        const action = actions[i];
        if (action.playerId === opponentId && 
            action.street === playerAction.street &&
            ['bet', 'call', 'raise', 'post'].includes(action.action)) {
            opponentBet = action.amount || 0;
        }
    }
    
    // Calculate the difference between current bet and opponent's bet
    const currentBet = playerAction.betSize;
    const callAmount = Math.max(0, currentBet - opponentBet);
    
    return callAmount;
}

/**
 * Calculate basic pot odds (call amount / (pot + call amount)).
 * @param {number} callAmount - Amount to call
 * @param {number} potSize - Current pot size
 * @returns {number} Pot odds as a decimal
 */
function calculateBasicPotOdds(callAmount, potSize) {
    if (callAmount === 0) return 0;
    if (potSize === 0) return 0;
    
    return callAmount / (potSize + callAmount);
}

/**
 * Calculate the opponent's effective stack (remaining chips they can bet).
 * @param {Object} hand - The hand object
 * @param {Array} actions - Array of all actions
 * @param {number} actionIndex - Index of the current action
 * @param {string} opponentId - The opponent's player ID
 * @returns {number} Effective stack in BB
 */
function calculateEffectiveStack(hand, actions, actionIndex, opponentId) {
    // Get the opponent's stack from playerStacks object
    const opponentStack = hand.playerStacks?.[opponentId] || 0;
    
    // Calculate how much they've already committed
    let committed = 0;
    for (let i = 0; i < actionIndex; i++) {
        const action = actions[i];
        if (action.playerId === opponentId && 
            ['bet', 'call', 'raise', 'post'].includes(action.action)) {
            committed += action.amount || 0;
        }
    }
    
    return Math.max(0, opponentStack - committed);
}

/**
 * Calculate implied odds for drawing hands.
 * @param {Object} playerAction - The player's action analysis
 * @param {number} effectiveStack - Opponent's effective stack
 * @param {number} potSize - Current pot size
 * @param {number} callAmount - Amount to call
 * @returns {number} Implied odds multiplier
 */
function calculateImpliedOdds(playerAction, effectiveStack, potSize, callAmount) {
    // Implied odds are higher when:
    // 1. Opponent has deep stacks
    // 2. There are more streets to come
    // 3. The board is draw-heavy
    
    const remainingStreets = calculateRemainingStreets(playerAction.street);
    const stackToPotRatio = effectiveStack / potSize;
    
    // Base implied odds multiplier
    let impliedOdds = 1.0;
    
    // Adjust for stack depth
    if (stackToPotRatio > 10) impliedOdds *= 1.5;      // Deep stacks
    else if (stackToPotRatio > 5) impliedOdds *= 1.3;  // Medium stacks
    else if (stackToPotRatio > 2) impliedOdds *= 1.1;  // Shallow stacks
    else impliedOdds *= 1.0;                           // Short stacks
    
    // Adjust for remaining streets
    if (remainingStreets === 2) impliedOdds *= 1.4;    // Flop (turn + river)
    else if (remainingStreets === 1) impliedOdds *= 1.2; // Turn (river)
    else impliedOdds *= 1.0;                           // River (no more streets)
    
    // Adjust for board texture (simplified - would need board analysis)
    if (playerAction.street === 'flop') impliedOdds *= 1.1; // More drawing potential on flop
    
    return impliedOdds;
}

/**
 * Calculate reverse implied odds (risk of losing more money).
 * @param {Object} playerAction - The player's action analysis
 * @param {number} effectiveStack - Opponent's effective stack
 * @param {number} potSize - Current pot size
 * @param {number} callAmount - Amount to call
 * @returns {number} Reverse implied odds multiplier
 */
function calculateReverseImpliedOdds(playerAction, effectiveStack, potSize, callAmount) {
    // Reverse implied odds are higher when:
    // 1. Opponent has deep stacks
    // 2. Player is likely to bet again on future streets
    // 3. The board is likely to improve for the player
    
    const stackToPotRatio = effectiveStack / potSize;
    
    // Base reverse implied odds multiplier
    let reverseImpliedOdds = 1.0;
    
    // Adjust for stack depth
    if (stackToPotRatio > 10) reverseImpliedOdds *= 1.4;     // Deep stacks = more risk
    else if (stackToPotRatio > 5) reverseImpliedOdds *= 1.2; // Medium stacks
    else if (stackToPotRatio > 2) reverseImpliedOdds *= 1.1; // Shallow stacks
    else reverseImpliedOdds *= 1.0;                          // Short stacks = less risk
    
    // Adjust for player's betting pattern
    if (playerAction.isValueBet) reverseImpliedOdds *= 1.3;  // Value bets likely to continue
    if (playerAction.isContinuationBet) reverseImpliedOdds *= 1.1; // C-bets might continue
    
    // Adjust for street
    if (playerAction.street === 'flop') reverseImpliedOdds *= 1.2; // More streets to come
    else if (playerAction.street === 'turn') reverseImpliedOdds *= 1.1; // One more street
    
    return reverseImpliedOdds;
}

/**
 * Calculate how many streets remain after the current street.
 * @param {string} street - Current street
 * @returns {number} Number of remaining streets
 */
function calculateRemainingStreets(street) {
    const streetOrder = ['preflop', 'flop', 'turn', 'river'];
    const currentIndex = streetOrder.indexOf(street);
    
    if (currentIndex === -1) return 0;
    
    return Math.max(0, streetOrder.length - currentIndex - 1);
}

/**
 * Get the opponent's position relative to the player.
 * @param {Object} hand - The hand object
 * @param {string} opponentId - The opponent's player ID
 * @param {string} playerPosition - The player's position
 * @returns {string} Opponent's position
 */
function getOpponentPosition(hand, opponentId, playerPosition) {
    // Find the opponent
    const opponent = hand.players?.find(p => p.id === opponentId);
    if (!opponent) return 'unknown';
    
    // Return the opponent's position
    return opponent.position || 'unknown';
}

/**
 * Determine if the pot odds are favorable for calling.
 * @param {number} potOdds - The pot odds as a decimal
 * @param {number} equity - The opponent's equity vs the player's range
 * @returns {boolean} True if pot odds are favorable
 */
function arePotOddsFavorable(potOdds, equity) {
    return equity > potOdds;
}

/**
 * Calculate the minimum equity needed to call profitably.
 * @param {number} potOdds - The pot odds as a decimal
 * @param {number} impliedOdds - The implied odds multiplier
 * @returns {number} Minimum required equity
 */
function calculateMinimumEquity(potOdds, impliedOdds = 1.0) {
    return potOdds / impliedOdds;
}

module.exports = {
    calculatePotOddsForOpponent,
    calculateCallAmount,
    calculateBasicPotOdds,
    calculateEffectiveStack,
    calculateImpliedOdds,
    calculateReverseImpliedOdds,
    calculateRemainingStreets,
    getOpponentPosition,
    arePotOddsFavorable,
    calculateMinimumEquity
}; 