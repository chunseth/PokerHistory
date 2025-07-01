// Poker hand evaluation for board-aware weighting
// Requires: npm install pokersolver
const { Hand } = require('pokersolver');
const { getBoardCardsAtAction } = require('./extractPostflopActions');

/**
 * Gathers all dead cards for the hero at a given action.
 * @param {Object} hand - The hand object from the database.
 * @param {Object} action - The action object (should have a 'street' property).
 * @returns {Array} Array of dead cards as strings (e.g., ['2h', '7d', 'Jc', ...]).
 */
function getHeroDeadCards(hand, action) {
    if (!hand || !action || !action.street) return [];

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

    // Known villain cards (if showdown or exposed)
    const villainCards = [];
    if (hand.players) {
        hand.players.forEach(player => {
            if (player.holeCards && Array.isArray(player.holeCards)) {
                villainCards.push(...player.holeCards);
            }
        });
    }

    // Create a Set of all dead cards for efficient lookup and deduplication
    const deadSet = new Set([...board, ...villainCards]);
    
    // Remove hero's own cards if present (shouldn't be in dead cards for hero)
    const heroCards = Array.isArray(hand.heroHoleCards) ? hand.heroHoleCards : [];
    heroCards.forEach(card => deadSet.delete(card));

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
 * Generates all possible two-card hero combos, excluding any that contain dead cards.
 * @param {Array} deadCards - Array of cards to exclude (e.g., ['2h', '7d', 'Jc']).
 * @returns {Array} Array of combos, each as [card1, card2].
 */
function generateHeroCombos(deadCards = []) {
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
 * Assigns a preflop weight to a hero combo where the highest card is A, K, Q, J, or T.
 * @param {[string, string]} combo - Array of two card strings, e.g., ['Ah', 'Kd']
 * @param {Object} context - { position, betSize, potSize, stackDepth, gameType }
 * @returns {number|null} Weight between 0.2 and 1, or null if not an A-T high combo
 */
function heroHighCardComboWeight(combo, context = {}) {
    const [c1, c2] = combo;
    const ranks = '23456789TJQKA';
    const r1 = c1[0], r2 = c2[0];
    const s1 = c1[1], s2 = c2[1];
    const suited = s1 === s2;

    // Only process if one of the cards is A, K, Q, J, or T
    if (![r1, r2].some(r => 'AKQJT'.includes(r))) return null;

    // AA, KK, QQ, JJ, TT
    if (r1 === r2) {
        if (r1 === 'A') return 1.0;
        if (r1 === 'K') return 0.98;
        if (r1 === 'Q') return 0.96;
        if (r1 === 'J') return 0.94;
        if (r1 === 'T') return 0.92;
    }

    // AK, AQ, AJ, AT
    if ((r1 === 'A' && r2 === 'K') || (r1 === 'K' && r2 === 'A')) return suited ? 0.98 : 0.95;
    if ((r1 === 'A' && r2 === 'Q') || (r1 === 'Q' && r2 === 'A')) return suited ? 0.96 : 0.92;
    if ((r1 === 'A' && r2 === 'J') || (r1 === 'J' && r2 === 'A')) return suited ? 0.94 : 0.89;
    if ((r1 === 'A' && r2 === 'T') || (r1 === 'T' && r2 === 'A')) return suited ? 0.92 : 0.86;

    // KQ, KJ, KT
    if ((r1 === 'K' && r2 === 'Q') || (r1 === 'Q' && r2 === 'K')) return suited ? 0.93 : 0.88;
    if ((r1 === 'K' && r2 === 'J') || (r1 === 'J' && r2 === 'K')) return suited ? 0.91 : 0.85;
    if ((r1 === 'K' && r2 === 'T') || (r1 === 'T' && r2 === 'K')) return suited ? 0.89 : 0.82;

    // QJ, QT
    if ((r1 === 'Q' && r2 === 'J') || (r1 === 'J' && r2 === 'Q')) return suited ? 0.91 : 0.85;
    if ((r1 === 'Q' && r2 === 'T') || (r1 === 'T' && r2 === 'Q')) return suited ? 0.88 : 0.8;

    // JT
    if ((r1 === 'J' && r2 === 'T') || (r1 === 'T' && r2 === 'J')) return suited ? 0.86 : 0.78;

    // Suited Ax, Kx, Qx, Jx, Tx (not already handled above)
    if (r1 === 'A' || r2 === 'A') {
        const lowRank = r1 === 'A' ? r2 : r1;
        const idx = ranks.indexOf(lowRank);
        if (suited) return 0.9 - idx * 0.025; // A2s = 0.7, A9s = 0.9
        return 0.8 - idx * 0.025; // A2o = 0.6, A9o = 0.8
    }
    if (r1 === 'K' || r2 === 'K') {
        const lowRank = r1 === 'K' ? r2 : r1;
        const idx = ranks.indexOf(lowRank);
        if (suited) return 0.85 - idx * 0.025; // K2s = 0.65, K9s = 0.85
        return 0.75 - idx * 0.025; // K2o = 0.55, K9o = 0.75
    }
    if (r1 === 'Q' || r2 === 'Q') {
        const lowRank = r1 === 'Q' ? r2 : r1;
        const idx = ranks.indexOf(lowRank);
        if (suited) return 0.82 - idx * 0.025; // Q2s = 0.62, Q9s = 0.82
        return 0.72 - idx * 0.025; // Q2o = 0.52, Q9o = 0.72
    }
    if (r1 === 'J' || r2 === 'J') {
        const lowRank = r1 === 'J' ? r2 : r1;
        const idx = ranks.indexOf(lowRank);
        if (suited) return 0.78 - idx * 0.025; // J2s = 0.58, J9s = 0.78
        return 0.68 - idx * 0.025; // J2o = 0.48, J9o = 0.68
    }
    if (r1 === 'T' || r2 === 'T') {
        const lowRank = r1 === 'T' ? r2 : r1;
        const idx = ranks.indexOf(lowRank);
        if (suited) return 0.76 - idx * 0.0286; // T2s = 0.56, T8s = 0.76
        return 0.66 - idx * 0.0286; // T2o = 0.46, T8o = 0.66
    }

    return null; // Not an A-T high combo
}

/**
 * Assigns a preflop weight to a hero combo where the highest card is 9, 8, 7, 6, or 5.
 * @param {[string, string]} combo - Array of two card strings, e.g., ['9h', '7d']
 * @param {Object} context - { position, betSize, potSize, stackDepth, gameType }
 * @returns {number|null} Weight between 0.1 and 0.9, or null if not a 9-5 high combo
 */
function heroNineToFiveComboWeight(combo, context = {}) {
    const [c1, c2] = combo;
    const ranks = '23456789TJQKA';
    const r1 = c1[0], r2 = c2[0];
    const s1 = c1[1], s2 = c2[1];
    const suited = s1 === s2;

    // Only process if highest card is 9, 8, 7, 6, or 5
    if (![r1, r2].some(r => '98765'.includes(r))) return null;

    // 99, 88, 77, 66, 55
    if (r1 === r2) {
        if (r1 === '9') return 0.9;
        if (r1 === '8') return 0.85;
        if (r1 === '7') return 0.8;
        if (r1 === '6') return 0.75;
        if (r1 === '5') return 0.7;
    }

    // 98, 97, 96, 95
    if ((r1 === '9' && r2 === '8') || (r1 === '8' && r2 === '9')) return suited ? 0.74 : 0.66;
    if ((r1 === '9' && r2 === '7') || (r1 === '7' && r2 === '9')) return suited ? 0.66 : 0.56;
    if ((r1 === '9' && r2 === '6') || (r1 === '6' && r2 === '9')) return suited ? 0.58 : 0.46;
    if ((r1 === '9' && r2 === '5') || (r1 === '5' && r2 === '9')) return suited ? 0.5 : 0.36;

    // 87, 86, 85
    if ((r1 === '8' && r2 === '7') || (r1 === '7' && r2 === '8')) return suited ? 0.72 : 0.62;
    if ((r1 === '8' && r2 === '6') || (r1 === '6' && r2 === '8')) return suited ? 0.64 : 0.52;
    if ((r1 === '8' && r2 === '5') || (r1 === '5' && r2 === '8')) return suited ? 0.56 : 0.42;

    // 76, 75
    if ((r1 === '7' && r2 === '6') || (r1 === '6' && r2 === '7')) return suited ? 0.7 : 0.6;
    if ((r1 === '7' && r2 === '5') || (r1 === '5' && r2 === '7')) return suited ? 0.62 : 0.48;

    // 65
    if ((r1 === '6' && r2 === '5') || (r1 === '5' && r2 === '6')) return suited ? 0.68 : 0.58;

    // Suited 9x, 8x, 7x, 6x, 5x (not already handled above)
    if (r1 === '9' || r2 === '9') {
        const lowRank = r1 === '9' ? r2 : r1;
        const idx = ranks.indexOf(lowRank);
        if (suited) return 0.66 - idx * 0.0333; // 92s = 0.46, 98s = 0.66
        return 0.56 - idx * 0.0333; // 92o = 0.36, 98o = 0.56
    }
    if (r1 === '8' || r2 === '8') {
        const lowRank = r1 === '8' ? r2 : r1;
        const idx = ranks.indexOf(lowRank);
        if (suited) return 0.62 - idx * 0.0333; // 82s = 0.42, 87s = 0.62
        return 0.52 - idx * 0.0333; // 82o = 0.32, 87o = 0.52
    }
    if (r1 === '7' || r2 === '7') {
        const lowRank = r1 === '7' ? r2 : r1;
        const idx = ranks.indexOf(lowRank);
        if (suited) return 0.58 - idx * 0.0333; // 72s = 0.38, 76s = 0.58
        return 0.48 - idx * 0.0333; // 72o = 0.28, 76o = 0.48
    }
    if (r1 === '6' || r2 === '6') {
        const lowRank = r1 === '6' ? r2 : r1;
        const idx = ranks.indexOf(lowRank);
        if (suited) return 0.54 - idx * 0.0333; // 62s = 0.34, 65s = 0.54
        return 0.44 - idx * 0.0333; // 62o = 0.24, 65o = 0.44
    }
    if (r1 === '5' || r2 === '5') {
        const lowRank = r1 === '5' ? r2 : r1;
        const idx = ranks.indexOf(lowRank);
        if (suited) return 0.5 - idx * 0.0333; // 52s = 0.3, 54s = 0.5
        return 0.4 - idx * 0.0333; // 52o = 0.2, 54o = 0.4
    }

    return null; // Not a 9-5 high combo
}

/**
 * Assigns a preflop weight to a hero combo where the highest card is 4, 3, or 2.
 * @param {[string, string]} combo - Array of two card strings, e.g., ['4h', '2d']
 * @param {Object} context - { position, betSize, potSize, stackDepth, gameType }
 * @returns {number|null} Weight between 0.1 and 0.65, or null if not a 4-2 high combo
 */
function heroFourToTwoComboWeight(combo, context = {}) {
    const [c1, c2] = combo;
    const ranks = '23456789TJQKA';
    const r1 = c1[0], r2 = c2[0];
    const s1 = c1[1], s2 = c2[1];
    const suited = s1 === s2;

    // Only process if highest card is 4, 3, or 2
    if (![r1, r2].some(r => '432'.includes(r))) return null;

    // 44, 33, 22
    if (r1 === r2) {
        if (r1 === '4') return 0.65;
        if (r1 === '3') return 0.6;
        if (r1 === '2') return 0.55;
    }

    // 43, 42
    if ((r1 === '4' && r2 === '3') || (r1 === '3' && r2 === '4')) return suited ? 0.22 : 0.16;
    if ((r1 === '4' && r2 === '2') || (r1 === '2' && r2 === '4')) return suited ? 0.2 : 0.14;

    // 32
    if ((r1 === '3' && r2 === '2') || (r1 === '2' && r2 === '3')) return suited ? 0.18 : 0.12;

    // Suited 4x, 3x, 2x (not already handled above)
    if (r1 === '4' || r2 === '4') {
        const lowRank = r1 === '4' ? r2 : r1;
        const idx = ranks.indexOf(lowRank);
        if (suited) return 0.42 - idx * 0.0333; // 42s = 0.22, 43s = 0.42
        return 0.32 - idx * 0.0333; // 42o = 0.12, 43o = 0.32
    }
    if (r1 === '3' || r2 === '3') {
        const lowRank = r1 === '3' ? r2 : r1;
        const idx = ranks.indexOf(lowRank);
        if (suited) return 0.38 - idx * 0.0333; // 32s = 0.18, 34s = 0.38
        return 0.28 - idx * 0.0333; // 32o = 0.08, 34o = 0.28
    }
    if (r1 === '2' || r2 === '2') {
        const lowRank = r1 === '2' ? r2 : r1;
        const idx = ranks.indexOf(lowRank);
        if (suited) return 0.34 - idx * 0.0333; // 23s = 0.14, 24s = 0.34
        return 0.24 - idx * 0.0333; // 23o = 0.04, 24o = 0.24
    }

    return null; // Not a 4-2 high combo
}

/**
 * Dispatcher function that assigns preflop weights to all hero combos.
 * Tries each weighting function in order of highest to lowest rank.
 * @param {[string, string]} combo - Array of two card strings, e.g., ['Ah', 'Kd']
 * @param {Object} context - { position, betSize, potSize, stackDepth, gameType }
 * @returns {number} Weight between 0.1 and 1.0 for any combo
 */
function getHeroPreflopWeight(combo, context = {}) {
    // Try each weighting function in order of highest to lowest rank
    return (
        heroHighCardComboWeight(combo, context) ??
        heroNineToFiveComboWeight(combo, context) ??
        heroFourToTwoComboWeight(combo, context) ??
        0.1 // fallback minimum for any unhandled combo (shouldn't be needed)
    );
}

/**
 * Initializes the hero's preflop range with unique, context-aware weights for every combo.
 * @param {Array} combos - Array of combos, each as [card1, card2].
 * @param {Object} context - { position, betSize, potSize, stackDepth, gameType }
 * @returns {Array} Array of objects: { hand: [card1, card2], weight: number }
 */
function initializeHeroPreflopRange(combos, context = {}) {
    return combos.map(combo => ({
        hand: combo,
        weight: getHeroPreflopWeight(combo, context)
    }));
}

/**
 * Evaluates a hero combo's best hand on the given board and returns a hand strength category.
 * @param {[string, string]} combo - Array of two card strings, e.g., ['Ah', 'Kd']
 * @param {Array} board - Array of board cards, e.g., ['2h', '7d', 'Jc']
 * @returns {string} Hand strength category (e.g., 'straight', 'set', 'two_pair', 'top_pair', 'overpair', 'second_pair', 'pair', 'air')
 */
function getHeroHandStrengthCategory(combo, board) {
    if (!combo || combo.length !== 2 || !Array.isArray(board) || board.length < 3) return 'air';

    const allCards = [...combo, ...board];
    const hand = Hand.solve(allCards);

    // Map pokersolver hand names to categories (same logic as opponentRange.js)
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
 * Detects draw types for a hero combo on a given board.
 * @param {[string, string]} combo - Array of two card strings, e.g., ['Ah', 'Kd']
 * @param {Array} board - Array of board cards, e.g., ['2h', '7d', 'Jc']
 * @returns {Array} Array of draw type strings: 'flush_draw', 'oesd', 'gutshot', 'combo_draw'
 */
function getHeroDrawTypes(combo, board) {
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

/**
 * Updates the weights of each combo in the hero's range based on their action and board context.
 * Uses hand strength categories for board-aware weighting.
 * @param {Array} range - Array of objects: { hand: [card1, card2], weight: number }
 * @param {string} actionType - The hero's action ('bet', 'raise', 'call', 'check', 'fold')
 * @param {Array} board - Array of current board cards (e.g., ['2h', '7d', 'Jc'])
 * @param {Object} context - { betSize, potSize, stackDepth, position, etc. }
 * @returns {Array} Updated range array with new weights
 */
function updateHeroRangeForAction(range, actionType, board, context = {}) {
    return range.map(({ hand, weight }) => {
        const category = getHeroHandStrengthCategory(hand, board);
        const draws = getHeroDrawTypes(hand, board);
        let newWeight = weight;

        // Board-aware weighting logic for hero actions
        if (actionType === 'bet' || actionType === 'raise') {
            if (['straight_flush', 'quads', 'full_house'].includes(category)) newWeight *= 2.0;
            else if (['flush', 'straight', 'set', 'two_pair'].includes(category)) newWeight *= 1.5;
            else if (['overpair', 'top_pair'].includes(category)) newWeight *= 1.2;
            else if (draws.includes('combo_draw')) newWeight *= 1.2;
            else if (draws.includes('flush_draw') || draws.includes('oesd')) newWeight *= 1.1;
            else if (draws.includes('gutshot')) newWeight *= 0.9;
            else if (['second_pair', 'pair'].includes(category)) newWeight *= 0.7;
            else if (category === 'air') newWeight *= 0.05; // Bluffs
            else newWeight *= 0.5;
        } else if (actionType === 'call' || actionType === 'check') {
            if (['straight_flush', 'quads', 'full_house', 'flush', 'straight', 'set', 'two_pair'].includes(category)) newWeight *= 1.5;
            else if (['overpair', 'top_pair'].includes(category)) newWeight *= 1.2;
            else if (draws.includes('combo_draw')) newWeight *= 1.1;
            else if (draws.includes('flush_draw') || draws.includes('oesd')) newWeight *= 0.8;
            else if (draws.includes('gutshot')) newWeight *= 0.6;
            else if (['second_pair', 'pair'].includes(category)) newWeight *= 0.5;
            else if (category === 'air') newWeight *= 0.01;
            else newWeight *= 0.3;
        } else if (actionType === 'fold') {
            // When hero folds, strong hands are unlikely, weak hands are more likely
            if (['straight_flush', 'quads', 'full_house'].includes(category)) newWeight *= 0.001;
            else if (['flush', 'straight', 'set'].includes(category)) newWeight *= 0.01;
            else if (['overpair', 'top_pair'].includes(category)) newWeight *= 0.05;
            else if (['two_pair'].includes(category)) newWeight *= 0.1;
            else if (draws.includes('combo_draw')) newWeight *= 1.5;
            else if (draws.includes('flush_draw') || draws.includes('oesd')) newWeight *= 1.8;
            else if (draws.includes('gutshot')) newWeight *= 2.0;
            else if (['second_pair', 'pair'].includes(category)) newWeight *= 1.2;
            else if (category === 'air') newWeight *= 2.5;
            else newWeight *= 1.0;
        }

        // Only apply minimum threshold before normalization if weight isn't already zero
        if (newWeight > 0) {
            newWeight = Math.max(newWeight, 0.0001);
        }

        return { hand, weight: newWeight };
    });
}

/**
 * Normalizes the weights of all combos in the hero's range so their sum is 1.
 * Prunes combos with negligible weight (default threshold: 0.001 for more lenient pruning).
 * @param {Array} range - Array of objects: { hand: [card1, card2], weight: number }
 * @param {number} [pruneThreshold=0.001] - Minimum weight to keep a combo (set to 0 to keep all)
 * @param {string} [lastActionType] - The last action type to adjust pruning threshold
 * @returns {Array} Normalized (and pruned) range array
 */
function normalizeAndPruneHeroRange(range, pruneThreshold = 0.001, lastActionType = null) {
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
 * Filters out impossible combos from the hero's range.
 * Removes any combo containing a dead card.
 * @param {Array} range - Array of objects: { hand: [card1, card2], weight: number }
 * @param {Array} deadCards - Array of card strings to exclude (e.g., ['As', 'Kd', '2h', ...])
 * @returns {Array} Filtered range array
 */
function filterImpossibleHeroCombos(range, deadCards) {
    const deadSet = new Set(deadCards);
    return range.filter(({ hand }) => (
        !deadSet.has(hand[0]) &&
        !deadSet.has(hand[1]) &&
        hand[0] !== hand[1]
    ));
}

/**
 * Helper: Convert a combo to a hand type string (e.g., "AKs", "QJo", "77")
 * @param {[string, string]} combo - Array of two card strings
 * @returns {string} Hand type string
 */
function comboToHandType([c1, c2]) {
    const rankOrder = '23456789TJQKA';
    const r1 = c1[0], r2 = c2[0];
    const s1 = c1[1], s2 = c2[1];
    let high = r1, low = r2;
    if (rankOrder.indexOf(r2) > rankOrder.indexOf(r1)) {
        high = r2; low = r1;
    }
    if (high === low) return high + high; // Pair
    if (s1 === s2) return high + low + 's'; // Suited
    return high + low + 'o'; // Offsuit
}

/**
 * Formats the hero's range for visualization with probabilities.
 * @param {Array} range - Array of objects: { hand: [card1, card2], weight: number }
 * @returns {Array} Array of objects: { handType: string, probability: number }
 */
function formatHeroRangeWithProbabilities(range) {
    const handTypeWeights = {};
    range.forEach(({ hand, weight }) => {
        const handType = comboToHandType(hand);
        handTypeWeights[handType] = (handTypeWeights[handType] || 0) + weight;
    });
    
    // Convert weights to probabilities (weights already sum to 1, so they are probabilities)
    return Object.entries(handTypeWeights)
        .sort((a, b) => b[1] - a[1])
        .map(([handType, probability]) => ({ 
            handType, 
            probability: +(probability * 100).toFixed(2) // Convert to percentage
        }));
}

/**
 * Returns the hero's range at a specific action index in the hand.
 * @param {Object} hand - The hand object from the database.
 * @param {Array} actions - Array of all postflop actions (from extractPostflopActions).
 * @param {string} heroId - The playerId of the hero.
 * @param {number} actionIndex - The index in the actions array up to which to process.
 * @param {Object} context - { position, betSize, potSize, stackDepth, gameType }
 * @returns {Array} Range array at this point: { hand: [card1, card2], weight: number }
 */
function getHeroRangeAtActionIndex(hand, actions, heroId, actionIndex, context = {}) {
    // Start with preflop range
    const deadCards = getHeroDeadCards(hand, actions[0]);
    const heroCombos = generateHeroCombos(deadCards);
    let currentRange = initializeHeroPreflopRange(heroCombos, context);

    // Process each action up to the specified index
    for (let idx = 0; idx <= actionIndex; idx++) {
        const action = actions[idx];
        if (action.playerId === heroId) {
            // Update dead cards for this action
            const dead = getHeroDeadCards(hand, action);
            
            // Filter out impossible combos
            currentRange = filterImpossibleHeroCombos(currentRange, dead);
            
            // Update weights based on action and board
            const board = getBoardCardsAtAction(hand, action);
            currentRange = updateHeroRangeForAction(currentRange, action.action, board, context);
            
            // Normalize and prune
            currentRange = normalizeAndPruneHeroRange(currentRange, 0.001, action.action);
        }
    }

    return currentRange;
}

/**
 * Sequentially updates the hero's range for each of their actions postflop.
 * @param {Object} hand - The hand object from the database.
 * @param {Array} actions - Array of all postflop actions (from extractPostflopActions).
 * @param {string} heroId - The playerId of the hero.
 * @param {Object} context - { position, betSize, potSize, stackDepth, gameType }
 * @returns {Array} Final range array after all actions, each as { hand: [card1, card2], weight: number }
 */
function getHeroRangeAfterActions(hand, actions, heroId, context = {}) {
    // Start with preflop range
    const deadCards = getHeroDeadCards(hand, actions[0]);
    const heroCombos = generateHeroCombos(deadCards);
    let currentRange = initializeHeroPreflopRange(heroCombos, context);

    // Process each action
    actions.forEach((action, idx) => {
        if (action.playerId === heroId) {
            // Update dead cards for this action
            const dead = getHeroDeadCards(hand, action);
            
            // Filter out impossible combos
            currentRange = filterImpossibleHeroCombos(currentRange, dead);
            
            // Update weights based on action and board
            const board = getBoardCardsAtAction(hand, action);
            currentRange = updateHeroRangeForAction(currentRange, action.action, board, context);
            
            // Normalize and prune with action type context
            currentRange = normalizeAndPruneHeroRange(currentRange, 0.001, action.action);
        }
    });

    return currentRange;
}

module.exports = {
    getHeroDeadCards,
    generateHeroCombos,
    heroHighCardComboWeight,
    heroNineToFiveComboWeight,
    heroFourToTwoComboWeight,
    getHeroPreflopWeight,
    initializeHeroPreflopRange,
    getHeroHandStrengthCategory,
    getHeroDrawTypes,
    updateHeroRangeForAction,
    normalizeAndPruneHeroRange,
    filterImpossibleHeroCombos,
    comboToHandType,
    formatHeroRangeWithProbabilities,
    getHeroRangeAtActionIndex,
    getHeroRangeAfterActions,
}; 