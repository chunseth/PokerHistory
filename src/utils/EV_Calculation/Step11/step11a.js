// Step 11a: Determine the Player's Action Type
// This module provides functions to analyze the player's action and extract relevant information.

/**
 * Step 11a: Determine the Player's Action Type
 * Identifies the type of action the player is making and extracts relevant information.
 * 
 * @param {Object} action - The action object from the hand history
 * @param {Object} hand - The full hand object
 * @param {Array} actions - Array of all postflop actions
 * @param {number} actionIndex - Index of the current action
 * @returns {Object} Action analysis object with type, sizing, and context
 */
function determinePlayerActionType(action, hand, actions, actionIndex) {
    if (!action || !hand) {
        return {
            actionType: null,
            betSize: 0,
            betSizing: 'none',
            relativeSizing: 'none',
            isContinuationBet: false,
            isCheckRaise: false,
            isDonkBet: false,
            isThreeBet: false,
            isValueBet: false,
            isBluff: false,
            isAllIn: false,
            potSize: 0,
            street: null,
            position: null,
            playerId: null
        };
    }

    // Calculate pot size before this action
    const potSize = calculatePotSizeBeforeAction(hand, actions, actionIndex);
    
    // Check if this is an all-in first
    const isAllIn = checkIfAllIn(action);
    
    // Get the bet size in BB
    const betSize = action.amount || 0;
    
    // Determine bet sizing relative to pot
    let betSizing = determineBetSizing(betSize, potSize, isAllIn);
    
    // For all-in bets, we want to know their relative size too
    let relativeSizing = determineBetSizing(betSize, potSize, false);
    
    // Check for various action patterns
    const isContinuationBet = checkIfContinuationBet(action, hand, actions, actionIndex);
    const isCheckRaise = checkIfCheckRaise(action, hand, actions, actionIndex);
    const isDonkBet = checkIfDonkBet(action, hand, actions, actionIndex);
    const isThreeBet = checkIfThreeBet(action, hand, actions, actionIndex);
    const isValueBet = checkIfValueBet(action, hand, actions, actionIndex);

    return {
        actionType: action.action,
        betSize,
        betSizing,
        relativeSizing,
        isContinuationBet,
        isCheckRaise,
        isDonkBet,
        isThreeBet,
        isValueBet,
        isAllIn,
        potSize,
        street: action.street,
        position: action.position,
        playerId: action.playerId,
        // Additional context for response frequency estimation
        previousAction: actionIndex > 0 ? actions[actionIndex - 1] : null,
        isFirstAction: actionIndex === 0,
        isLastAction: actionIndex === actions.length - 1,
        actionIndex
    };
}

/**
 * Calculate the pot size before a specific action.
 * @param {Object} hand - The hand object
 * @param {Array} actions - Array of all actions
 * @param {number} actionIndex - Index of the action to analyze
 * @returns {number} Pot size in BB
 */
function calculatePotSizeBeforeAction(hand, actions, actionIndex) {
    // Start with blinds
    let potSize = 0;
    
    // Add all bets up to this action
    for (let i = 0; i < actionIndex; i++) {
        const action = actions[i];
        if (action && ['bet', 'call', 'raise', 'post'].includes(action.action)) {
            potSize += action.amount || 0;
        }
    }

    // Add blinds if this is preflop
    if (actions[actionIndex]?.street === 'preflop') {
        // Add small blind and big blind
        potSize += 1.5; // SB (0.5) + BB (1)
    }
    
    return Math.max(1.5, potSize); // Minimum pot size is 1.5 BB (SB + BB)
}

/**
 * Determine the bet sizing category based on bet size relative to pot.
 * @param {number} betSize - The bet amount in BB
 * @param {number} potSize - The pot size in BB
 * @param {boolean} isAllIn - Whether this is an all-in bet
 * @returns {string} Bet sizing category
 */
function determineBetSizing(betSize, potSize, isAllIn) {
    if (betSize === 0) return 'none';
    if (isAllIn) return 'all_in';  // All-ins are their own category
    
    const betToPotRatio = betSize / potSize;
    
    if (betToPotRatio <= 0.33) return 'small';      // 33% pot or less
    if (betToPotRatio <= 1.0) return 'medium';     // 33-100% pot
    if (betToPotRatio <= 2.0) return 'large';      // 100-200% pot
    return 'very_large';                           // 200%+ pot
}

/**
 * Check if the action is an all-in.
 * @param {Object} action - The action object
 * @returns {boolean} True if all-in
 */
function checkIfAllIn(action) {
    return action?.isAllIn || false;
}

/**
 * Determine the context of the action (continuation bet, value bet, bluff, etc.).
 * @param {Object} action - The current action
 * @param {Array} actions - Array of all actions
 * @param {number} actionIndex - Index of the current action
 * @param {string} street - Current street
 * @returns {Object} Action context object
 */
function determineActionContext(action, actions, actionIndex, street) {
    const isContinuationBet = checkIfContinuationBet(action, actions, actionIndex, street);
    const isValueBet = checkIfValueBet(action, actions, actionIndex, street);
    const isBluff = checkIfBluff(action, actions, actionIndex, street);
    
    return {
        isContinuationBet,
        isValueBet,
        isBluff,
        isCheckRaise: checkIfCheckRaise(action, actions, actionIndex, street),
        isDonkBet: checkIfDonkBet(action, actions, actionIndex, street),
        isThreeBet: checkIfThreeBet(action, actions, actionIndex, street)
    };
}

/**
 * Check if this is a continuation bet (first bet on flop after preflop aggression).
 * @param {Object} action - The current action
 * @param {Array} actions - Array of all actions
 * @param {number} actionIndex - Index of the current action
 * @param {string} street - Current street
 * @returns {boolean} True if continuation bet
 */
function checkIfContinuationBet(action, actions, actionIndex, street) {
    if (street !== 'flop' || action.action !== 'bet') return false;
    
    // Check if this is the first action on the flop
    let firstFlopActionIndex = -1;
    for (let i = 0; i < actions.length; i++) {
        if (actions[i].street === 'flop') {
            firstFlopActionIndex = i;
            break;
        }
    }
    
    if (actionIndex !== firstFlopActionIndex) return false;
    
    // Check if the same player was aggressive preflop
    const preflopActions = actions.filter(a => a.street === 'preflop');
    const lastPreflopAction = preflopActions[preflopActions.length - 1];
    
    return lastPreflopAction && 
           lastPreflopAction.playerId === action.playerId &&
           ['bet', 'raise'].includes(lastPreflopAction.action);
}

/**
 * Check if this is likely a value bet (betting for value with strong hands).
 * @param {Object} action - The current action
 * @param {Array} actions - Array of all actions
 * @param {number} actionIndex - Index of the current action
 * @param {string} street - Current street
 * @returns {boolean} True if likely value bet
 */
function checkIfValueBet(action, actions, actionIndex, street) {
    if (!['bet', 'raise'].includes(action.action)) return false;
    
    // Large bet sizing often indicates value betting
    const betSize = action.amount || 0;
    const potSize = calculatePotSizeBeforeAction({}, actions, actionIndex);
    const betToPotRatio = betSize / potSize;
    
    // Large bets on later streets are often value bets
    if (street === 'river' && betToPotRatio > 0.75) return true;
    if (street === 'turn' && betToPotRatio > 1.0) return true;
    
    // Large raises are often value bets
    if (action.action === 'raise' && betToPotRatio > 1.5) return true;
    
    return false;
}

/**
 * Check if this is likely a bluff (betting with weak hands).
 * @param {Object} action - The current action
 * @param {Array} actions - Array of all actions
 * @param {number} actionIndex - Index of the current action
 * @param {string} street - Current street
 * @returns {boolean} True if likely bluff
 */
function checkIfBluff(action, actions, actionIndex, street) {
    // Removing this function as bluff detection requires range analysis
    // and belongs in step11c
    return false;
}

/**
 * Check if this is a check-raise.
 * @param {Object} action - The current action
 * @param {Object} hand - The hand object
 * @param {Array} actions - Array of all actions
 * @param {number} actionIndex - Index of the current action
 * @returns {boolean} True if check-raise
 */
function checkIfCheckRaise(action, hand, actions, actionIndex) {
    if (!action || action.action !== 'raise') return false;
    
    const currentStreet = action.street;
    if (!currentStreet || currentStreet === 'preflop') return false;

    // Look for a check from the same player earlier in the same street
    let foundCheck = false;
    let foundBet = false;
    let checkIndex = -1;

    // First, find the player's check
    for (let i = actionIndex - 1; i >= 0; i--) {
        const prevAction = actions[i];
        if (!prevAction || prevAction.street !== currentStreet) break;
        
        if (prevAction.playerId === action.playerId) {
            if (prevAction.action === 'check') {
                foundCheck = true;
                checkIndex = i;
                break;
            } else {
                // If we find any other action by the player first, it's not a check-raise
                return false;
            }
        }
    }

    // If we found a check, look for an opponent's bet between the check and the raise
    if (foundCheck && checkIndex >= 0) {
        for (let i = checkIndex + 1; i < actionIndex; i++) {
            const betAction = actions[i];
            if (!betAction || betAction.street !== currentStreet) break;
            
            if (betAction.playerId !== action.playerId && 
                ['bet', 'raise'].includes(betAction.action)) {
                foundBet = true;
                break;
            }
        }
    }

    return foundCheck && foundBet;
}

/**
 * Check if this is a donk bet (betting out of position when not the aggressor).
 * @param {Object} action - The current action
 * @param {Object} hand - The hand object
 * @param {Array} actions - Array of all actions
 * @param {number} actionIndex - Index of the current action
 * @returns {boolean} True if donk bet
 */
function checkIfDonkBet(action, hand, actions, actionIndex) {
    if (!action || action.action !== 'bet') return false;
    
    const currentStreet = action.street;
    if (!currentStreet || currentStreet === 'preflop') return false;

    // Must be first action of the street
    let isFirstActionOfStreet = true;
    for (let i = actionIndex - 1; i >= 0; i--) {
        if (actions[i].street === currentStreet) {
            isFirstActionOfStreet = false;
            break;
        }
    }
    if (!isFirstActionOfStreet) return false;

    // Find the last aggressor from the previous street
    let previousStreet;
    switch (currentStreet) {
        case 'flop': previousStreet = 'preflop'; break;
        case 'turn': previousStreet = 'flop'; break;
        case 'river': previousStreet = 'turn'; break;
        default: return false;
    }

    let lastAggressor = null;
    let lastAggressorPosition = null;

    // Find the last betting action from the previous street
    for (let i = actionIndex - 1; i >= 0; i--) {
        const prevAction = actions[i];
        if (!prevAction || prevAction.street !== previousStreet) continue;
        
        if (['bet', 'raise'].includes(prevAction.action)) {
            lastAggressor = prevAction.playerId;
            lastAggressorPosition = prevAction.position;
            break;
        }
    }

    if (!lastAggressor || !lastAggressorPosition) return false;

    // Must be a different player than the last aggressor
    if (action.playerId === lastAggressor) return false;

    // Must be out of position relative to the last aggressor
    const positions = ['SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN'];
    const currentPos = positions.indexOf(action.position);
    const lastAggressorPos = positions.indexOf(lastAggressorPosition);

    if (currentPos === -1 || lastAggressorPos === -1) return false;

    // Out of position means either:
    // 1. Current position is earlier in the array than last aggressor
    // 2. Special case: BTN vs blinds
    const isOutOfPosition = currentPos < lastAggressorPos || 
                          (currentPos === positions.length - 1 && lastAggressorPos <= 1);

    return isOutOfPosition;
}

/**
 * Check if this is a three-bet (second raise in a street).
 * @param {Object} action - The current action
 * @param {Array} actions - Array of all actions
 * @param {number} actionIndex - Index of the current action
 * @param {string} street - Current street
 * @returns {boolean} True if three-bet
 */
function checkIfThreeBet(action, actions, actionIndex, street) {
    if (action.action !== 'raise') return false;
    
    // Count raises in this street before this action
    let raiseCount = 0;
    for (let i = 0; i < actionIndex; i++) {
        const prevAction = actions[i];
        if (prevAction.street === street && prevAction.action === 'raise') {
            raiseCount++;
        }
    }
    
    return raiseCount >= 1; // Second or subsequent raise
}

module.exports = {
    determinePlayerActionType,
    calculatePotSizeBeforeAction,
    determineBetSizing,
    checkIfAllIn,
    determineActionContext,
    checkIfContinuationBet,
    checkIfValueBet,
    checkIfCheckRaise,
    checkIfDonkBet,
    checkIfThreeBet
}; 