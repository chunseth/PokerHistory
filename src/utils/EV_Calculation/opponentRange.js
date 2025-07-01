// Poker hand evaluation for board-aware weighting
// Requires: npm install pokersolver
const { Hand } = require('pokersolver');
const { extractPostflopActions, getBoardCardsAtAction } = require('./extractPostflopActions');

/**
 * Gathers all dead cards (hero's hole cards + all community cards revealed so far).
 * @param {Object} hand - The hand object from the database.
 * @param {Object} action - The action object (should have a 'street' property).
 * @returns {Array} Array of dead cards as strings (e.g., ['As', 'Kd', '2h', ...]).
 */
function getDeadCards(hand, action) {
    if (!hand || !action || !action.street) return [];

    // Hero's hole cards
    const heroCards = Array.isArray(hand.heroHoleCards) ? hand.heroHoleCards : [];

    // Community cards up to the current street
    const flop = hand.communityCards?.flop || [];
    const turn = hand.communityCards?.turn ? [hand.communityCards.turn] : [];
    const river = hand.communityCards?.river ? [hand.communityCards.river] : [];

    let board = [];
    if (action.street === 'flop') {
        board = flop;
    } else if (action.street === 'turn') {
        board = [...flop, ...turn];
    } else if (action.street === 'river') {
        board = [...flop, ...turn, ...river];
    }

    // Create a Set of all dead cards for efficient lookup and deduplication
    const deadSet = new Set([...heroCards, ...board]);

    // Add any known villain cards from previous actions
    if (hand.players) {
        hand.players.forEach(player => {
            if (player.holeCards && Array.isArray(player.holeCards)) {
                player.holeCards.forEach(card => deadSet.add(card));
            }
        });
    }

    // Convert back to array and validate each card
    const allDead = Array.from(deadSet).filter(card => {
        // Validate card format
        if (!/^[2-9TJQKA][cdhs]$/.test(card)) {
            console.warn(`Invalid card format found: ${card}`);
            return false;
        }
        return true;
    });

    return allDead;
}

/**
 * Generates all possible two-card starting hand combos, excluding any that contain dead cards.
 * @param {Array} deadCards - Array of cards to exclude (e.g., ['As', 'Kd', '2h']).
 * @returns {Array} Array of combos, each as [card1, card2].
 */
function generateAllCombos(deadCards = []) {
    const ranks = '23456789TJQKA'.split('');
    const suits = 'cdhs'.split('');
    const combos = [];

    // Generate all unique two-card combos
    for (let i = 0; i < ranks.length; i++) {
        for (let j = 0; j < suits.length; j++) {
            const card1 = ranks[i] + suits[j];
            if (deadCards.includes(card1)) continue;
            for (let k = 0; k < ranks.length; k++) {
                for (let l = 0; l < suits.length; l++) {
                    const card2 = ranks[k] + suits[l];
                    if (card1 === card2) continue;
                    if (deadCards.includes(card2)) continue;
                    // Avoid duplicate combos (e.g., [As, Kd] and [Kd, As])
                    if (card1 < card2) {
                        combos.push([card1, card2]);
                    }
                }
            }
        }
    }
    return combos;
}

/**
 * Returns a unique GTO-inspired weight for combos where the highest card is Ace or King.
 * @param {[string, string]} combo - Array of two card strings, e.g., ['As', 'Kd']
 * @returns {number|null} Weight between 0.2 and 1, or null if not an A or K high combo
 */
function aceKingComboWeight(combo) {
    const [c1, c2] = combo;
    const ranks = '23456789TJQKA';
    const r1 = c1[0], r2 = c2[0];
    const s1 = c1[1], s2 = c2[1];
    const suited = s1 === s2;

    // Only process if one of the cards is A or K
    if (r1 !== 'A' && r2 !== 'A' && r1 !== 'K' && r2 !== 'K') return null;

    // AA
    if (r1 === 'A' && r2 === 'A') return 1.0;

    // AK
    if ((r1 === 'A' && r2 === 'K') || (r1 === 'K' && r2 === 'A')) return suited ? 0.98 : 0.95;

    // AQ
    if ((r1 === 'A' && r2 === 'Q') || (r1 === 'Q' && r2 === 'A')) return suited ? 0.96 : 0.92;

    // AJ
    if ((r1 === 'A' && r2 === 'J') || (r1 === 'J' && r2 === 'A')) return suited ? 0.94 : 0.89;

    // AT
    if ((r1 === 'A' && r2 === 'T') || (r1 === 'T' && r2 === 'A')) return suited ? 0.92 : 0.86;

    // A9 - A2
    for (let i = 8; i >= 0; i--) {
        const lowRank = ranks[i];
        if ((r1 === 'A' && r2 === lowRank) || (r2 === 'A' && r1 === lowRank)) {
            // Suited Ax: decreasing from 0.90 (A9s) to 0.70 (A2s)
            // Offsuit Ax: decreasing from 0.80 (A9o) to 0.60 (A2o)
            const suitedBase = 0.90, suitedStep = 0.025;
            const offsuitBase = 0.80, offsuitStep = 0.025;
            return suited
                ? suitedBase - (8 - i) * suitedStep
                : offsuitBase - (8 - i) * offsuitStep;
        }
    }

    // KK
    if (r1 === 'K' && r2 === 'K') return 0.98;

    // KQ
    if ((r1 === 'K' && r2 === 'Q') || (r1 === 'Q' && r2 === 'K')) return suited ? 0.93 : 0.88;

    // KJ
    if ((r1 === 'K' && r2 === 'J') || (r1 === 'J' && r2 === 'K')) return suited ? 0.91 : 0.85;

    // KT
    if ((r1 === 'K' && r2 === 'T') || (r1 === 'T' && r2 === 'K')) return suited ? 0.89 : 0.82;

    // K9 - K2
    for (let i = 8; i >= 0; i--) {
        const lowRank = ranks[i];
        if ((r1 === 'K' && r2 === lowRank) || (r2 === 'K' && r1 === lowRank)) {
            // Suited Kx: decreasing from 0.85 (K9s) to 0.65 (K2s)
            // Offsuit Kx: decreasing from 0.75 (K9o) to 0.55 (K2o)
            const suitedBase = 0.85, suitedStep = 0.025;
            const offsuitBase = 0.75, offsuitStep = 0.025;
            return suited
                ? suitedBase - (8 - i) * suitedStep
                : offsuitBase - (8 - i) * offsuitStep;
        }
    }

    return null; // Not an A or K high combo
}

/**
 * Returns a unique GTO-inspired weight for combos where the highest card is Queen or Jack.
 * @param {[string, string]} combo - Array of two card strings, e.g., ['Qs', '9d']
 * @returns {number|null} Weight between 0.2 and 1, or null if not a Q or J high combo
 */
function queenJackComboWeight(combo) {
    const [c1, c2] = combo;
    const ranks = '23456789TJQKA';
    const r1 = c1[0], r2 = c2[0];
    const s1 = c1[1], s2 = c2[1];
    const suited = s1 === s2;

    // Only process if one of the cards is Q or J
    if (r1 !== 'Q' && r2 !== 'Q' && r1 !== 'J' && r2 !== 'J') return null;

    // QQ
    if (r1 === 'Q' && r2 === 'Q') return 0.96;

    // QJ
    if ((r1 === 'Q' && r2 === 'J') || (r1 === 'J' && r2 === 'Q')) return suited ? 0.91 : 0.85;

    // QT
    if ((r1 === 'Q' && r2 === 'T') || (r1 === 'T' && r2 === 'Q')) return suited ? 0.88 : 0.8;

    // Q9 - Q2
    for (let i = 7; i >= 0; i--) {
        const lowRank = ranks[i];
        if ((r1 === 'Q' && r2 === lowRank) || (r2 === 'Q' && r1 === lowRank)) {
            // Suited Qx: 0.82 (Q9s) to 0.62 (Q2s)
            // Offsuit Qx: 0.72 (Q9o) to 0.52 (Q2o)
            const suitedBase = 0.82, suitedStep = 0.025;
            const offsuitBase = 0.72, offsuitStep = 0.025;
            return suited
                ? suitedBase - (7 - i) * suitedStep
                : offsuitBase - (7 - i) * offsuitStep;
        }
    }

    // JJ
    if (r1 === 'J' && r2 === 'J') return 0.94;

    // JT
    if ((r1 === 'J' && r2 === 'T') || (r1 === 'T' && r2 === 'J')) return suited ? 0.86 : 0.78;

    // J9 - J2
    for (let i = 7; i >= 0; i--) {
        const lowRank = ranks[i];
        if ((r1 === 'J' && r2 === lowRank) || (r2 === 'J' && r1 === lowRank)) {
            // Suited Jx: 0.78 (J9s) to 0.58 (J2s)
            // Offsuit Jx: 0.68 (J9o) to 0.48 (J2o)
            const suitedBase = 0.78, suitedStep = 0.025;
            const offsuitBase = 0.68, offsuitStep = 0.025;
            return suited
                ? suitedBase - (7 - i) * suitedStep
                : offsuitBase - (7 - i) * offsuitStep;
        }
    }

    return null; // Not a Q or J high combo
}

/**
 * Returns a unique GTO-inspired weight for combos where the highest card is Ten or Nine.
 * @param {[string, string]} combo - Array of two card strings, e.g., ['Ts', '8d']
 * @returns {number|null} Weight between 0.2 and 1, or null if not a T or 9 high combo
 */
function tenNineComboWeight(combo) {
    const [c1, c2] = combo;
    const ranks = '23456789TJQKA';
    const r1 = c1[0], r2 = c2[0];
    const s1 = c1[1], s2 = c2[1];
    const suited = s1 === s2;

    // Only process if one of the cards is T or 9
    if (r1 !== 'T' && r2 !== 'T' && r1 !== '9' && r2 !== '9') return null;

    // TT
    if (r1 === 'T' && r2 === 'T') return 0.92;

    // T9
    if ((r1 === 'T' && r2 === '9') || (r1 === '9' && r2 === 'T')) return suited ? 0.84 : 0.76;

    // T8 - T2
    for (let i = 7; i >= 0; i--) {
        const lowRank = ranks[i];
        if ((r1 === 'T' && r2 === lowRank) || (r2 === 'T' && r1 === lowRank)) {
            // Suited Tx: 0.76 (T8s) to 0.56 (T2s)
            // Offsuit Tx: 0.66 (T8o) to 0.46 (T2o)
            const suitedBase = 0.76, suitedStep = 0.0286; // (0.76-0.56)/7
            const offsuitBase = 0.66, offsuitStep = 0.0286;
            return suited
                ? suitedBase - (7 - i) * suitedStep
                : offsuitBase - (7 - i) * offsuitStep;
        }
    }

    // 99
    if (r1 === '9' && r2 === '9') return 0.9;

    // 98
    if ((r1 === '9' && r2 === '8') || (r1 === '8' && r2 === '9')) return suited ? 0.74 : 0.66;

    // 97 - 92
    for (let i = 6; i >= 0; i--) {
        const lowRank = ranks[i];
        if ((r1 === '9' && r2 === lowRank) || (r2 === '9' && r1 === lowRank)) {
            // Suited 9x: 0.66 (97s) to 0.46 (92s)
            // Offsuit 9x: 0.56 (97o) to 0.36 (92o)
            const suitedBase = 0.66, suitedStep = 0.0333; // (0.66-0.46)/6
            const offsuitBase = 0.56, offsuitStep = 0.0333;
            return suited
                ? suitedBase - (6 - i) * suitedStep
                : offsuitBase - (6 - i) * offsuitStep;
        }
    }

    return null; // Not a T or 9 high combo
}

/**
 * Returns a unique GTO-inspired weight for combos where the highest card is Eight or Seven.
 * @param {[string, string]} combo - Array of two card strings, e.g., ['8s', '6d']
 * @returns {number|null} Weight between 0.2 and 1, or null if not an 8 or 7 high combo
 */
function eightSevenComboWeight(combo) {
    const [c1, c2] = combo;
    const ranks = '23456789TJQKA';
    const r1 = c1[0], r2 = c2[0];
    const s1 = c1[1], s2 = c2[1];
    const suited = s1 === s2;

    // Only process if one of the cards is 8 or 7
    if (r1 !== '8' && r2 !== '8' && r1 !== '7' && r2 !== '7') return null;

    // 88
    if (r1 === '8' && r2 === '8') return 0.85;

    // 87
    if ((r1 === '8' && r2 === '7') || (r1 === '7' && r2 === '8')) return suited ? 0.72 : 0.62;

    // 86 - 82
    for (let i = 5; i >= 0; i--) {
        const lowRank = ranks[i];
        if ((r1 === '8' && r2 === lowRank) || (r2 === '8' && r1 === lowRank)) {
            // Suited 8x: 0.62 (86s) to 0.42 (82s)
            // Offsuit 8x: 0.52 (86o) to 0.32 (82o)
            const suitedBase = 0.62, suitedStep = 0.04; // (0.62-0.42)/5
            const offsuitBase = 0.52, offsuitStep = 0.04;
            return suited
                ? suitedBase - (5 - i) * suitedStep
                : offsuitBase - (5 - i) * offsuitStep;
        }
    }

    // 77
    if (r1 === '7' && r2 === '7') return 0.8;

    // 76
    if ((r1 === '7' && r2 === '6') || (r1 === '6' && r2 === '7')) return suited ? 0.6 : 0.5;

    // 75 - 72
    for (let i = 4; i >= 0; i--) {
        const lowRank = ranks[i];
        if ((r1 === '7' && r2 === lowRank) || (r2 === '7' && r1 === lowRank)) {
            // Suited 7x: 0.5 (75s) to 0.3 (72s)
            // Offsuit 7x: 0.4 (75o) to 0.2 (72o)
            const suitedBase = 0.5, suitedStep = 0.05; // (0.5-0.3)/4
            const offsuitBase = 0.4, offsuitStep = 0.05;
            return suited
                ? suitedBase - (4 - i) * suitedStep
                : offsuitBase - (4 - i) * offsuitStep;
        }
    }

    return null; // Not an 8 or 7 high combo
}

/**
 * Returns a unique GTO-inspired weight for combos where the highest card is Six or Five.
 * @param {[string, string]} combo - Array of two card strings, e.g., ['6s', '4d']
 * @returns {number|null} Weight between 0.2 and 1, or null if not a 6 or 5 high combo
 */
function sixFiveComboWeight(combo) {
    const [c1, c2] = combo;
    const ranks = '23456789TJQKA';
    const r1 = c1[0], r2 = c2[0];
    const s1 = c1[1], s2 = c2[1];
    const suited = s1 === s2;

    // Only process if one of the cards is 6 or 5
    if (r1 !== '6' && r2 !== '6' && r1 !== '5' && r2 !== '5') return null;

    // 66
    if (r1 === '6' && r2 === '6') return 0.75;

    // 65
    if ((r1 === '6' && r2 === '5') || (r1 === '5' && r2 === '6')) return suited ? 0.52 : 0.42;

    // 64 - 62
    for (let i = 3; i >= 0; i--) {
        const lowRank = ranks[i];
        if ((r1 === '6' && r2 === lowRank) || (r2 === '6' && r1 === lowRank)) {
            // Suited 6x: 0.42 (64s) to 0.32 (62s)
            // Offsuit 6x: 0.32 (64o) to 0.22 (62o)
            const suitedBase = 0.42, suitedStep = 0.0333; // (0.42-0.32)/3
            const offsuitBase = 0.32, offsuitStep = 0.0333;
            return suited
                ? suitedBase - (3 - i) * suitedStep
                : offsuitBase - (3 - i) * offsuitStep;
        }
    }

    // 55
    if (r1 === '5' && r2 === '5') return 0.7;

    // 54
    if ((r1 === '5' && r2 === '4') || (r1 === '4' && r2 === '5')) return suited ? 0.38 : 0.28;

    // 53 - 52
    for (let i = 1; i >= 0; i--) {
        const lowRank = ranks[i];
        if ((r1 === '5' && r2 === lowRank) || (r2 === '5' && r1 === lowRank)) {
            // Suited 5x: 0.28 (53s) to 0.24 (52s)
            // Offsuit 5x: 0.18 (53o) to 0.14 (52o)
            const suitedBase = 0.28, suitedStep = 0.04; // (0.28-0.24)/1
            const offsuitBase = 0.18, offsuitStep = 0.04;
            return suited
                ? suitedBase - (1 - i) * suitedStep
                : offsuitBase - (1 - i) * offsuitStep;
        }
    }

    return null; // Not a 6 or 5 high combo
}

/**
 * Returns a unique GTO-inspired weight for combos where the highest card is Four, Three, or Two.
 * @param {[string, string]} combo - Array of two card strings, e.g., ['4s', '2d']
 * @returns {number|null} Weight between 0.2 and 1, or null if not a 4, 3, or 2 high combo
 */
function fourThreeTwoComboWeight(combo) {
    const [c1, c2] = combo;
    const ranks = '23456789TJQKA';
    const r1 = c1[0], r2 = c2[0];
    const s1 = c1[1], s2 = c2[1];
    const suited = s1 === s2;

    // Only process if one of the cards is 4, 3, or 2
    if (r1 !== '4' && r2 !== '4' && r1 !== '3' && r2 !== '3' && r1 !== '2' && r2 !== '2') return null;

    // 44
    if (r1 === '4' && r2 === '4') return 0.65;

    // 43, 42
    if ((r1 === '4' && r2 === '3') || (r1 === '3' && r2 === '4')) return suited ? 0.22 : 0.16;
    if ((r1 === '4' && r2 === '2') || (r1 === '2' && r2 === '4')) return suited ? 0.20 : 0.14;

    // 33
    if (r1 === '3' && r2 === '3') return 0.6;

    // 32
    if ((r1 === '3' && r2 === '2') || (r1 === '2' && r2 === '3')) return suited ? 0.18 : 0.12;

    // 22
    if (r1 === '2' && r2 === '2') return 0.55;

    return null; // Not a 4, 3, or 2 high combo
}

// Dispatcher for all combo weight functions
function getComboWeight(combo) {
    // Try each weighting function in order of highest to lowest rank
    return (
        aceKingComboWeight(combo) ??
        queenJackComboWeight(combo) ??
        tenNineComboWeight(combo) ??
        eightSevenComboWeight(combo) ??
        sixFiveComboWeight(combo) ??
        fourThreeTwoComboWeight(combo) ??
        0.2 // fallback minimum for any unhandled combo (shouldn't be needed)
    );
}

/**
 * Initializes the opponent's preflop range with unique, GTO-inspired weights for every combo.
 * @param {Array} combos - Array of combos, each as [card1, card2].
 * @returns {Array} Array of objects: { hand: [card1, card2], weight: number }
 */
function initializePreflopRange(combos) {
    return combos.map(combo => ({
        hand: combo,
        weight: getComboWeight(combo)
    }));
}

/**
 * Filters out impossible combos from the opponent's range.
 * Removes any combo containing a dead card (hero's cards or any board card).
 * @param {Array} range - Array of objects: { hand: [card1, card2], weight: number }
 * @param {Array} deadCards - Array of card strings to exclude (e.g., ['As', 'Kd', '2h', ...])
 * @returns {Array} Filtered range array
 */
function filterImpossibleCombos(range, deadCards) {
    const deadSet = new Set(deadCards);
    return range.filter(({ hand }) => (
        !deadSet.has(hand[0]) &&
        !deadSet.has(hand[1]) &&
        hand[0] !== hand[1]
    ));
}

/**
 * Updates the weights of each combo in the range based on the opponent's action and board context.
 * Uses hand strength categories for board-aware weighting.
 * @param {Array} range - Array of objects: { hand: [card1, card2], weight: number }
 * @param {string} actionType - The opponent's action ('bet', 'raise', 'call', 'check', 'fold')
 * @param {Array} board - Array of current board cards (e.g., ['2h', '7d', 'Jc'])
 * @returns {Array} Updated range array with new weights
 */
function updateRangeForAction(range, actionType, board) {
    return range.map(({ hand, weight }) => {
        const category = getHandStrengthCategory(hand, board);
        const draws = getDrawTypes(hand, board);
        let newWeight = weight;

        // Board-aware weighting logic
        if (actionType === 'bet' || actionType === 'raise') {
            if (['straight_flush', 'quads', 'full_house'].includes(category)) newWeight *= 2.0;
            else if (['flush', 'straight', 'set', 'two_pair'].includes(category)) newWeight *= 1.5;
            else if (['overpair', 'top_pair'].includes(category)) newWeight *= 1.2;
            else if (draws.includes('combo_draw')) newWeight *= 1.2;
            else if (draws.includes('flush_draw') || draws.includes('oesd')) newWeight *= 1.1;
            else if (draws.includes('gutshot')) newWeight *= 0.9;
            else if (['second_pair', 'pair'].includes(category)) newWeight *= 0.7;
            else if (category === 'air') newWeight *= 0.05; // More aggressive penalty for air
            else newWeight *= 0.5;
        } else if (actionType === 'call' || actionType === 'check') {
            if (['straight_flush', 'quads', 'full_house', 'flush', 'straight', 'set', 'two_pair'].includes(category)) newWeight *= 1.5;
            else if (['overpair', 'top_pair'].includes(category)) newWeight *= 1.2;
            else if (draws.includes('combo_draw')) newWeight *= 1.1;
            else if (draws.includes('flush_draw') || draws.includes('oesd')) newWeight *= 0.8;
            else if (draws.includes('gutshot')) newWeight *= 0.6;
            else if (['second_pair', 'pair'].includes(category)) newWeight *= 0.5;
            else if (category === 'air') newWeight *= 0.01; // Much more aggressive penalty for calling with air
            else newWeight *= 0.3;
        } else if (actionType === 'fold') {
            // When folding, INCREASE probability of weak hands (they're more likely to fold)
            if (['straight_flush', 'quads', 'full_house'].includes(category)) newWeight *= 0.001; // Very unlikely to fold nuts
            else if (['flush', 'straight', 'set'].includes(category)) newWeight *= 0.01; // Unlikely to fold strong hands
            else if (['overpair', 'top_pair'].includes(category)) newWeight *= 0.05; // Unlikely to fold strong hands
            else if (['two_pair'].includes(category)) newWeight *= 0.1; // Some two pairs might fold
            else if (draws.includes('combo_draw')) newWeight *= 1.5; // Missed combo draws likely to fold
            else if (draws.includes('flush_draw') || draws.includes('oesd')) newWeight *= 1.8; // Missed draws very likely to fold
            else if (draws.includes('gutshot')) newWeight *= 2.0; // Missed gutshots very likely to fold
            else if (['second_pair', 'pair'].includes(category)) newWeight *= 1.2; // Weak pairs likely to fold
            else if (category === 'air') newWeight *= 2.5; // Air hands very likely to fold - highest boost
            else newWeight *= 1.0; // Default for other categories
        }

        // Only apply minimum threshold before normalization if weight isn't already zero
        if (newWeight > 0) {
            newWeight = Math.max(newWeight, 0.0001); // Much lower minimum threshold
        }

        return { hand, weight: newWeight };
    });
}

/**
 * Normalizes the weights of all combos in the range so their sum is 1.
 * Prunes combos with negligible weight (default threshold: 0.001 for more lenient pruning).
 * @param {Array} range - Array of objects: { hand: [card1, card2], weight: number }
 * @param {number} [pruneThreshold=0.001] - Minimum weight to keep a combo (set to 0 to keep all)
 * @param {string} [lastActionType] - The last action type to adjust pruning threshold
 * @returns {Array} Normalized (and pruned) range array
 */
function normalizeAndPruneRange(range, pruneThreshold = 0.001, lastActionType = null) {
    // If range is getting too small, use a lower threshold
    let dynamicThreshold = pruneThreshold;
    
    // For fold actions, use much lower threshold since weak hands get boosted
    if (lastActionType === 'fold') {
        dynamicThreshold = 0.00001; // Much more lenient for folds
    } else if (range.length < 50) {
        dynamicThreshold = 0.0001; // Much more lenient
    }
    
    // Prune combos with weight below the threshold
    let filtered = range.filter(({ weight }) => weight >= dynamicThreshold);

    // Calculate total weight
    const totalWeight = filtered.reduce((sum, { weight }) => sum + weight, 0);

    // Avoid division by zero
    if (totalWeight === 0) return [];

    // Normalize weights
    filtered = filtered.map(({ hand, weight }) => ({
        hand,
        weight: weight / totalWeight
    }));

    return filtered;
}

/**
 * Sequentially updates the opponent's range for each of their actions postflop.
 * @param {Object} hand - The hand object from the database.
 * @param {Array} actions - Array of all postflop actions (from extractPostflopActions).
 * @param {string} opponentId - The playerId of the opponent.
 * @returns {Array} Final range array after all actions, each as { hand: [card1, card2], weight: number }
 */
function getOpponentRangeAfterActions(hand, actions, opponentId) {
    // Gather dead cards (hero + board)
    let currentRange = initializePreflopRange(
        generateAllCombos(getDeadCards(hand, actions[0]))
    );

    actions.forEach((action, idx) => {
        if (action.playerId === opponentId) {
            // 1. Update dead cards for this action
            const dead = getDeadCards(hand, action);

            // 2. Filter out impossible combos
            currentRange = filterImpossibleCombos(currentRange, dead);

            // 3. Update weights based on action and board
            const board = getBoardCardsAtAction(hand, action);
            currentRange = updateRangeForAction(currentRange, action.action, board);

            // 4. Normalize and prune with action type context
            currentRange = normalizeAndPruneRange(currentRange, 0.001, action.action);
        }
    });

    return currentRange;
}

/**
 * Returns the opponent's range at a specific action index in the hand.
 * @param {Object} hand - The hand object from the database.
 * @param {Array} actions - Array of all postflop actions (from extractPostflopActions).
 * @param {string} opponentId - The playerId of the opponent.
 * @param {number} actionIndex - The index in the actions array up to which to process.
 * @param {Array} knownCards - Array of all known cards at this point in the hand.
 * @returns {Array} Range array at this point: { hand: [card1, card2], weight: number }
 */
function getOpponentRangeAtActionIndex(hand, actions, opponentId, actionIndex, knownCards = []) {
    // Initialize range with all possible combos, excluding known cards
    let currentRange = initializePreflopRange(generateAllCombos(knownCards));

    // Process each action up to the specified index
    for (let idx = 0; idx <= actionIndex; idx++) {
        const action = actions[idx];
        if (action.playerId === opponentId) {
            // Get board cards at this action
            const board = getBoardCardsAtAction(hand, action);
            
            // Update weights based on action and board
            currentRange = updateRangeForAction(currentRange, action.action, board);
            
            // Normalize and prune with action type context
            currentRange = normalizeAndPruneRange(currentRange, 0.001, action.action);
            
            // Filter out any combos that contain known cards
            currentRange = filterImpossibleCombos(currentRange, knownCards);
        }
    }

    return currentRange;
}

/**
 * Evaluates a combo's best hand on the given board and returns a hand strength category.
 * @param {[string, string]} combo - Array of two card strings, e.g., ['Ah', 'Kd']
 * @param {Array} board - Array of board cards, e.g., ['2h', '7d', 'Jc']
 * @returns {string} Hand strength category (e.g., 'straight', 'set', 'two pair', 'top pair', 'overpair', 'second pair', 'pair', 'air')
 */
function getHandStrengthCategory(combo, board) {
    if (!combo || combo.length !== 2 || !Array.isArray(board) || board.length < 3) return 'air';

    const allCards = [...combo, ...board];
    const hand = Hand.solve(allCards);

    // Map pokersolver hand names to categories
    if (hand.name === 'Straight Flush' || hand.name === 'Royal Flush') return 'straight_flush';
    if (hand.name === 'Four of a Kind') return 'quads';
    if (hand.name === 'Full House') return 'full_house';
    if (hand.name === 'Flush') return 'flush';
    if (hand.name === 'Straight') return 'straight';
    if (hand.name === 'Three of a Kind') {
        // Check if set (using both hole cards)
        const comboRanks = combo.map(c => c[0]);
        const tripsRank = hand.cards[0].value;
        if (comboRanks.includes(tripsRank)) return 'set';
        return 'trips';
    }
    if (hand.name === 'Two Pair') {
        // Check if both pairs use a hole card (for top two, etc.)
        const boardRanks = board.map(c => c[0]);
        const comboRanks = combo.map(c => c[0]);
        const pairRanks = hand.cards.filter((c, i, arr) =>
            arr.filter(x => x.value === c.value).length === 2
        ).map(c => c.value);
        if (pairRanks.some(r => comboRanks.includes(r))) return 'two_pair';
        return 'two_pair_board';
    }
    if (hand.name === 'Pair') {
        // Overpair, top pair, second pair, underpair, or just pair
        const boardRanks = board.map(c => c[0]);
        const comboRanks = combo.map(c => c[0]);
        const pairRank = hand.cards[0].value;
        const boardMax = Math.max(...boardRanks.map(r => '23456789TJQKA'.indexOf(r)));
        if (comboRanks.includes(pairRank)) {
            // Overpair: pair is higher than any board card
            if ('23456789TJQKA'.indexOf(pairRank) > boardMax) return 'overpair';
            // Top pair: pair matches highest board card
            if ('23456789TJQKA'.indexOf(pairRank) === boardMax) return 'top_pair';
            // Second pair: pair matches second highest board card
            const sortedBoard = [...boardRanks].sort((a, b) => '23456789TJQKA'.indexOf(b) - '23456789TJQKA'.indexOf(a));
            if ('23456789TJQKA'.indexOf(pairRank) === '23456789TJQKA'.indexOf(sortedBoard[1])) return 'second_pair';
            return 'pair';
        }
        return 'pair_board';
    }
    // High card/air
    return 'air';
}

/**
 * Detects draw types for a combo on a given board.
 * @param {[string, string]} combo - Array of two card strings, e.g., ['Ah', 'Kd']
 * @param {Array} board - Array of board cards, e.g., ['2h', '7d', 'Jc']
 * @returns {Array} Array of draw type strings: 'flush_draw', 'oesd', 'gutshot', 'combo_draw'
 */
function getDrawTypes(combo, board) {
    const allCards = [...combo, ...board];
    const suits = allCards.map(c => c[1]);
    const ranks = allCards.map(c => '23456789TJQKA'.indexOf(c[0]));
    const uniqueSuits = [...new Set(suits)];

    // Flush draw: 4 cards of the same suit (but not 5, which would be a flush)
    let flushDraw = false;
    for (const suit of uniqueSuits) {
        if (suits.filter(s => s === suit).length === 4) flushDraw = true;
    }

    // Straight draw logic
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => a - b);
    let oesd = false, gutshot = false;
    for (let i = 0; i <= uniqueRanks.length - 4; i++) {
        // OESD: 4 consecutive ranks
        if (
            uniqueRanks[i + 3] - uniqueRanks[i] === 3 &&
            uniqueRanks.slice(i, i + 4).length === 4
        ) oesd = true;
        // Gutshot: 4 cards with a single gap
        if (
            uniqueRanks[i + 3] - uniqueRanks[i] === 4 &&
            uniqueRanks.slice(i, i + 4).length === 4
        ) gutshot = true;
    }
    // Wheel draw (A-2-3-4-5)
    if (uniqueRanks.includes(12) && uniqueRanks.includes(0) && uniqueRanks.includes(1) && uniqueRanks.includes(2)) {
        if (uniqueRanks.includes(3)) oesd = true;
        else gutshot = true;
    }

    // Combo draw: both flush and straight draw
    const comboDraw = flushDraw && (oesd || gutshot);

    const draws = [];
    if (comboDraw) draws.push('combo_draw');
    else {
        if (flushDraw) draws.push('flush_draw');
        if (oesd) draws.push('oesd');
        if (gutshot) draws.push('gutshot');
    }
    return draws;
}

module.exports = {
    getDeadCards,
    generateAllCombos,
    initializePreflopRange,
    aceKingComboWeight,
    queenJackComboWeight,
    tenNineComboWeight,
    eightSevenComboWeight,
    sixFiveComboWeight,
    fourThreeTwoComboWeight,
    getComboWeight,
    filterImpossibleCombos,
    updateRangeForAction,
    normalizeAndPruneRange,
    getOpponentRangeAfterActions,
    getOpponentRangeAtActionIndex,
    getHandStrengthCategory,
    getDrawTypes
}; 