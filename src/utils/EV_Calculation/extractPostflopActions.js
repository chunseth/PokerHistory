// Utility to extract and structure all postflop actions from a hand object

/**
 * Extracts all postflop actions from a hand, with relevant context for EV analysis.
 * @param {Object} hand - The hand object from the database.
 * @returns {Array} Array of structured action objects.
 */
function extractPostflopActions(hand) {
    if (!hand || !Array.isArray(hand.bettingActions)) return [];

    // Only consider postflop streets
    const postflopStreets = ['flop', 'turn', 'river'];

    return hand.bettingActions
        .filter(action => postflopStreets.includes(action.street))
        .map(action => ({
            playerId: action.playerId,
            action: action.action,
            amount: action.amount,
            street: action.street,
            timestamp: action.timestamp,
        }));
}

/**
 * Filters extracted actions to only those on a specific street.
 * @param {Array} actions - Array of action objects (from extractPostflopActions).
 * @param {string} street - The street to filter by ('flop', 'turn', or 'river').
 * @returns {Array} Array of actions on the specified street.
 */
function getActionsByStreet(actions, street) {
    return actions.filter(action => action.street === street);
}

/**
 * Calculates the pot size immediately before a given action index.
 * @param {Array} actions - Array of action objects (from extractPostflopActions), ordered chronologically.
 * @param {number} actionIndex - Index of the action to analyze.
 * @returns {number} Pot size before the specified action.
 */
function getPotSizeBeforeAction(actions, actionIndex) {
    let pot = 0;
    for (let i = 0; i < actionIndex; i++) {
        const action = actions[i];
        if (['bet', 'call', 'raise', 'post'].includes(action.action)) {
            pot += action.amount || 0;
        }
    }
    return pot;
}

/**
 * Calculates the player's stack size before a given action.
 * @param {Object} hand - The full hand object (should include players array).
 * @param {Array} actions - Array of action objects (from extractPostflopActions), ordered chronologically.
 * @param {number} actionIndex - Index of the action to analyze.
 * @returns {number|null} Stack size before the action, or null if player not found.
 */
function getPlayerStackBeforeAction(hand, actions, actionIndex) {
    const action = actions[actionIndex];
    if (!action) return null;

    // Find the player's starting stack (from hand.players)
    const player = (hand.players || []).find(
        p => p.id === action.playerId
    );
    if (!player) return null;

    let committed = 0;
    for (let i = 0; i < actionIndex; i++) {
        const a = actions[i];
        if (
            a.playerId === action.playerId &&
            ['bet', 'call', 'raise', 'post'].includes(a.action)
        ) {
            committed += a.amount || 0;
        }
    }
    return player.stackSize - committed;
}

/**
 * Returns the bet size for a given action if applicable.
 * @param {Object} action - The action object.
 * @returns {number} The bet/raise/call amount, or 0 if not applicable.
 */
function getBetSize(action) {
    if (!action) return 0;
    if (['bet', 'raise', 'call', 'post'].includes(action.action)) {
        return action.amount || 0;
    }
    return 0;
}

/**
 * Calculates the opponent's stack size before a given action.
 * @param {Object} hand - The full hand object (should include players array).
 * @param {Array} actions - Array of action objects (from extractPostflopActions), ordered chronologically.
 * @param {number} actionIndex - Index of the action to analyze.
 * @param {string} opponentId - The playerId of the opponent.
 * @returns {number|null} Stack size before the action, or null if opponent not found.
 */
function getOpponentStackBeforeAction(hand, actions, actionIndex, opponentId) {
    const opponent = (hand.players || []).find(
        p => p.id === opponentId
    );
    if (!opponent) return null;

    let committed = 0;
    for (let i = 0; i < actionIndex; i++) {
        const a = actions[i];
        if (
            a.playerId === opponentId &&
            ['bet', 'call', 'raise', 'post'].includes(a.action)
        ) {
            committed += a.amount || 0;
        }
    }
    return opponent.stackSize - committed;
}

/**
 * Returns the community cards visible at the time of a given action.
 * @param {Object} hand - The full hand object (should include communityCards object).
 * @param {Object} action - The action object (should have a 'street' property).
 * @returns {Array} Array of community cards visible at the time of the action.
 */
function getBoardCardsAtAction(hand, action) {
    if (!hand || !hand.communityCards || !action || !action.street) return [];

    const flop = Array.isArray(hand.communityCards.flop) ? hand.communityCards.flop : [];
    const turn = hand.communityCards.turn ? [hand.communityCards.turn] : [];
    const river = hand.communityCards.river ? [hand.communityCards.river] : [];

    if (action.street === 'flop') {
        return flop;
    } else if (action.street === 'turn') {
        return [...flop, ...turn];
    } else if (action.street === 'river') {
        return [...flop, ...turn, ...river];
    }
    return [];
}

/**
 * Returns the hero's hole cards for the hand.
 * @param {Object} hand - The full hand object (should include heroHoleCards array).
 * @returns {Array} Array of hero's hole cards (e.g., ['As', 'Kd']).
 */
function getHeroHoleCards(hand) {
    if (!hand || !Array.isArray(hand.heroHoleCards)) return [];
    return hand.heroHoleCards;
}

// Example usage:
// const { extractPostflopActions, getActionsByStreet, getPotSizeBeforeAction, getPlayerStackBeforeAction } = require('./extractPostflopActions');
// const postflopActions = extractPostflopActions(hand);
// const flopActions = getActionsByStreet(postflopActions, 'flop');
// const potBeforeThirdAction = getPotSizeBeforeAction(postflopActions, 2);
// const stackBeforeAction = getPlayerStackBeforeAction(hand, postflopActions, 2);

module.exports = {
    extractPostflopActions,
    getActionsByStreet,
    getPotSizeBeforeAction,
    getPlayerStackBeforeAction,
    getBetSize,
    getOpponentStackBeforeAction,
    getBoardCardsAtAction,
    getHeroHoleCards
}; 