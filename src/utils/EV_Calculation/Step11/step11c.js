// Step 11c: Assess Opponent's Current Range Strength
// This module provides functions to calculate the opponent's range strength at a given action index.

const { 
    getOpponentRangeAtActionIndex,
    getHandStrengthCategory,
    getDrawTypes,
    getComboWeight
} = require('../opponentRange');

/**
 * Calculates the opponent's current range and its strength analysis at a given action index.
 * @param {Object} hand - The hand object (with heroHoleCards, communityCards, players, etc.)
 * @param {Array} actions - Array of all postflop actions
 * @param {string} opponentId - The opponent's player ID
 * @param {number} actionIndex - The index in the actions array up to which to process
 * @param {Object} [playerAction] - (Optional) The player's action analysis from step 11a
 * @param {Object} [potOdds] - (Optional) Pot odds analysis from step 11b
 * @returns {Object} Range strength analysis object
 */
function calculateOpponentRangeStrength(hand, actions, opponentId, actionIndex, playerAction = {}, potOdds = {}) {
    // Handle null/undefined inputs gracefully
    if (!hand || !actions || !Array.isArray(actions) || actionIndex < 0 || actionIndex >= actions.length) {
        return {
            averageStrength: 0,
            strengthDistribution: {},
            strongHandsPercentage: 0,
            weakHandsPercentage: 0,
            mediumHandsPercentage: 0,
            drawingHandsPercentage: 0,
            rangeWeight: 0,
            topHands: [],
            bottomHands: [],
            strengthCategory: 'unknown',
            totalCombos: 0,
            boardTexture: { texture: 'unknown' },
            street: playerAction?.street || 'unknown',
            position: playerAction?.position || 'unknown',
            rangeDensity: 0,
            strengthVariance: 0,
            drawingPotential: 0,
            nuttedHands: 0,
            bluffCatchers: 0,
            valueHands: 0
        };
    }

    // Get the board at this action index
    let board = [];
    if (hand && hand.communityCards) {
        const flop = hand.communityCards.flop || [];
        const turn = hand.communityCards.turn ? [hand.communityCards.turn] : [];
        const river = hand.communityCards.river ? [hand.communityCards.river] : [];
        
        // Only include cards that would be visible at this action's street
        const currentStreet = actions[actionIndex]?.street;
        if (currentStreet === 'flop') {
            board = flop;
        } else if (currentStreet === 'turn') {
            board = [...flop, ...turn];
        } else if (currentStreet === 'river') {
            board = [...flop, ...turn, ...river];
        } else {
            board = flop;
        }
    }

    // Create a Set to track all known cards at this point in the hand
    const knownCards = new Set();
    
    // Add hero's hole cards
    if (Array.isArray(hand.heroHoleCards)) {
        hand.heroHoleCards.forEach(card => knownCards.add(card));
    }
    
    // Add board cards
    board.forEach(card => knownCards.add(card));
    
    // Add any exposed villain cards from previous actions
    if (hand.players) {
        hand.players.forEach(player => {
            if (player.holeCards && Array.isArray(player.holeCards)) {
                player.holeCards.forEach(card => knownCards.add(card));
            }
        });
    }

    // Get the opponent's range at this action index, passing the known cards
    const opponentRange = getOpponentRangeAtActionIndex(
        hand, 
        actions.slice(0, actionIndex + 1), 
        opponentId, 
        actionIndex,
        Array.from(knownCards)
    );
    
    // Analyze the range strength
    return assessOpponentRangeStrength(opponentRange, board, playerAction, potOdds);
}

/**
 * Step 11c: Assess Opponent's Current Range Strength
 * Analyzes the strength of the opponent's current range to understand their likely responses.
 * 
 * @param {Array} opponentRange - The opponent's current range from step 10
 * @param {Array} board - Current board cards
 * @param {Object} playerAction - The player's action analysis from step 11a
 * @param {Object} potOdds - Pot odds analysis from step 11b
 * @returns {Object} Range strength analysis object
 */
function assessOpponentRangeStrength(opponentRange, board, playerAction, potOdds) {
    if (!opponentRange || !Array.isArray(opponentRange) || opponentRange.length === 0) {
        return {
            averageStrength: 0,
            strengthDistribution: {},
            strongHandsPercentage: 0,
            weakHandsPercentage: 0,
            mediumHandsPercentage: 0,
            drawingHandsPercentage: 0,
            rangeWeight: 0,
            topHands: [],
            bottomHands: [],
            strengthCategory: 'unknown',
            totalCombos: 0,
            boardTexture: { texture: 'unknown' },
            street: playerAction?.street || 'unknown',
            position: playerAction?.position || 'unknown',
            rangeDensity: 0,
            strengthVariance: 0,
            drawingPotential: 0,
            nuttedHands: 0,
            bluffCatchers: 0,
            valueHands: 0
        };
    }

    // Calculate hand strength for each combo in the range
    const rangeWithStrength = calculateRangeHandStrengths(opponentRange, board);
    
    // Calculate average range strength
    const averageStrength = calculateAverageRangeStrength(rangeWithStrength);
    
    // Analyze strength distribution
    const strengthDistribution = analyzeStrengthDistribution(rangeWithStrength);
    
    // Calculate percentage breakdowns
    const percentages = calculateStrengthPercentages(rangeWithStrength);
    
    // Get top and bottom hands
    const topHands = getTopHands(rangeWithStrength, 10);
    const bottomHands = getBottomHands(rangeWithStrength, 10);
    
    // Determine overall range strength category
    const strengthCategory = determineRangeStrengthCategory(averageStrength, percentages);
    
    // Calculate range weight (how much of the total possible range this represents)
    const rangeWeight = calculateRangeWeight(opponentRange);
    
    // Analyze board texture for context
    const boardTexture = analyzeBoardTexture(board);
    
    return {
        averageStrength,
        strengthDistribution,
        strongHandsPercentage: percentages.strong,
        weakHandsPercentage: percentages.weak,
        mediumHandsPercentage: percentages.medium,
        drawingHandsPercentage: percentages.drawing,
        rangeWeight,
        topHands,
        bottomHands,
        strengthCategory,
        // Additional context
        totalCombos: opponentRange.length,
        boardTexture,
        street: playerAction?.street || 'unknown',
        position: playerAction?.position || 'unknown',
        // Enhanced analysis for response frequency estimation
        rangeDensity: calculateRangeDensity(opponentRange),
        strengthVariance: calculateStrengthVariance(rangeWithStrength, averageStrength),
        drawingPotential: calculateDrawingPotential(rangeWithStrength),
        nuttedHands: countNuttedHands(rangeWithStrength),
        bluffCatchers: countBluffCatchers(rangeWithStrength),
        valueHands: countValueHands(rangeWithStrength)
    };
}

function calculateRangeHandStrengths(opponentRange, board) {
    return opponentRange.map(({ hand, weight }) => {
        const category = getHandStrengthCategory(hand, board);
        const draws = getDrawTypes(hand, board);
        const strength = convertCategoryToStrength(category, draws);
        const equity = calculateSimplifiedEquity(hand, board, category, draws);
        const drawCompletionProb = calculateDrawCompletionProbability(draws, board, hand);
        return {
            hand,
            weight,
            category,
            draws,
            strength,
            equity,
            drawCompletionProb,
            isStrong: strength >= 0.7,
            isMedium: strength >= 0.4 && strength < 0.7,
            isWeak: strength < 0.4,
            isDrawing: draws.length > 0,
            isNutted: isNuttedHand(category, draws),
            isBluffCatcher: isBluffCatcher(category, strength),
            isValueHand: isValueHand(category, strength)
        };
    });
}

function convertCategoryToStrength(category, draws) {
    const categoryStrengths = {
        'straight_flush': 1.0,
        'quads': 0.98,
        'full_house': 0.95,
        'flush': 0.90,
        'straight': 0.85,
        'set': 0.80,
        'two_pair': 0.75,
        'overpair': 0.70,
        'top_pair': 0.65,
        'second_pair': 0.55,
        'pair': 0.45,
        'pair_board': 0.35,
        'air': 0.20
    };
    let baseStrength = categoryStrengths[category] || 0.3;
    if (draws.includes('combo_draw')) baseStrength += 0.15;
    else if (draws.includes('flush_draw')) baseStrength += 0.10;
    else if (draws.includes('oesd')) baseStrength += 0.08;
    else if (draws.includes('gutshot')) baseStrength += 0.05;
    return Math.min(1.0, baseStrength);
}

function calculateSimplifiedEquity(hand, board, category, draws) {
    let equity = convertCategoryToStrength(category, draws);
    if (board.length === 3) {
        equity *= 0.9;
    } else if (board.length === 4) {
        equity *= 0.95;
    } else if (board.length === 5) {
        equity *= 1.0;
    }
    return Math.min(1.0, Math.max(0.0, equity));
}

function calculateRangeDensity(opponentRange) {
    const totalPossibleCombos = 1326;
    return opponentRange.length / totalPossibleCombos;
}

function calculateStrengthVariance(rangeWithStrength, averageStrength) {
    if (rangeWithStrength.length === 0) return 0;
    const totalWeight = rangeWithStrength.reduce((sum, { weight }) => sum + weight, 0);
    if (totalWeight === 0) return 0;
    const weightedVariance = rangeWithStrength.reduce((sum, { weight, strength }) => {
        return sum + (weight * Math.pow(strength - averageStrength, 2));
    }, 0);
    return weightedVariance / totalWeight;
}

function calculateDrawingPotential(rangeWithStrength) {
    if (rangeWithStrength.length === 0) return 0;
    const totalWeight = rangeWithStrength.reduce((sum, { weight }) => sum + weight, 0);
    if (totalWeight === 0) return 0;
    const drawingWeight = rangeWithStrength.reduce((sum, { weight, isDrawing }) => {
        return sum + (isDrawing ? weight : 0);
    }, 0);
    return drawingWeight / totalWeight;
}

function countNuttedHands(rangeWithStrength) {
    return rangeWithStrength.filter(({ isNutted }) => isNutted).length;
}

function countBluffCatchers(rangeWithStrength) {
    return rangeWithStrength.filter(({ isBluffCatcher }) => isBluffCatcher).length;
}

function countValueHands(rangeWithStrength) {
    return rangeWithStrength.filter(({ isValueHand }) => isValueHand).length;
}

function isNuttedHand(category, draws) {
    return ['straight_flush', 'quads', 'full_house', 'flush', 'straight'].includes(category) ||
           (category === 'set' && draws.includes('combo_draw'));
}

function isBluffCatcher(category, strength) {
    return (strength >= 0.4 && strength < 0.7) && 
           ['top_pair', 'second_pair', 'pair'].includes(category);
}

function isValueHand(category, strength) {
    return strength >= 0.7 && 
           ['straight_flush', 'quads', 'full_house', 'flush', 'straight', 'set', 'two_pair', 'overpair'].includes(category);
}

function calculateAverageRangeStrength(rangeWithStrength) {
    if (rangeWithStrength.length === 0) return 0;
    const totalWeight = rangeWithStrength.reduce((sum, { weight }) => sum + weight, 0);
    if (totalWeight === 0) return 0;
    const weightedSum = rangeWithStrength.reduce((sum, { weight, strength }) => {
        return sum + (weight * strength);
    }, 0);
    return weightedSum / totalWeight;
}

function analyzeStrengthDistribution(rangeWithStrength) {
    const distribution = {
        veryStrong: { count: 0, weight: 0, percentage: 0 },
        strong: { count: 0, weight: 0, percentage: 0 },
        medium: { count: 0, weight: 0, percentage: 0 },
        weak: { count: 0, weight: 0, percentage: 0 },
        veryWeak: { count: 0, weight: 0, percentage: 0 }
    };
    let totalWeight = 0;
    rangeWithStrength.forEach(({ weight, strength }) => {
        totalWeight += weight;
        if (strength >= 0.8) {
            distribution.veryStrong.count++;
            distribution.veryStrong.weight += weight;
        } else if (strength >= 0.6) {
            distribution.strong.count++;
            distribution.strong.weight += weight;
        } else if (strength >= 0.4) {
            distribution.medium.count++;
            distribution.medium.weight += weight;
        } else if (strength >= 0.2) {
            distribution.weak.count++;
            distribution.weak.weight += weight;
        } else {
            distribution.veryWeak.count++;
            distribution.veryWeak.weight += weight;
        }
    });
    Object.keys(distribution).forEach(key => {
        distribution[key].percentage = totalWeight > 0 ? 
            (distribution[key].weight / totalWeight) * 100 : 0;
    });
    return distribution;
}

function calculateStrengthPercentages(rangeWithStrength) {
    let strong = 0, medium = 0, weak = 0, drawing = 0;
    let totalWeight = 0;
    rangeWithStrength.forEach(({ weight, isStrong, isMedium, isWeak, isDrawing }) => {
        totalWeight += weight;
        if (isStrong) strong += weight;
        if (isMedium) medium += weight;
        if (isWeak) weak += weight;
        if (isDrawing) drawing += weight;
    });
    return {
        strong: totalWeight > 0 ? (strong / totalWeight) * 100 : 0,
        medium: totalWeight > 0 ? (medium / totalWeight) * 100 : 0,
        weak: totalWeight > 0 ? (weak / totalWeight) * 100 : 0,
        drawing: totalWeight > 0 ? (drawing / totalWeight) * 100 : 0
    };
}

function getTopHands(rangeWithStrength, count) {
    return rangeWithStrength
        .sort((a, b) => b.strength - a.strength)
        .slice(0, count)
        .map(({ hand, strength, category, weight }) => ({
            hand,
            strength,
            category,
            weight
        }));
}

function getBottomHands(rangeWithStrength, count) {
    return rangeWithStrength
        .sort((a, b) => a.strength - b.strength)
        .slice(0, count)
        .map(({ hand, strength, category, weight }) => ({
            hand,
            strength,
            category,
            weight
        }));
}

function determineRangeStrengthCategory(averageStrength, percentages) {
    if (averageStrength >= 0.7 && percentages.strong >= 60) return 'very_strong';
    if (averageStrength >= 0.6 && percentages.strong >= 40) return 'strong';
    if (averageStrength >= 0.5 && percentages.medium >= 40) return 'medium_strong';
    if (averageStrength >= 0.4 && percentages.medium >= 50) return 'medium';
    if (averageStrength >= 0.3 && percentages.weak >= 40) return 'medium_weak';
    if (averageStrength < 0.3 || percentages.weak >= 60) return 'weak';
    return 'balanced';
}

function calculateRangeWeight(opponentRange) {
    if (!opponentRange || !Array.isArray(opponentRange)) return 0;
    const totalPossibleCombos = 1326;
    return opponentRange.length / totalPossibleCombos;
}

function analyzeBoardTexture(board) {
    if (!board || !Array.isArray(board) || board.length === 0) {
        return { texture: 'unknown' };
    }

    const ranks = board.map(card => card[0]);
    const suits = board.map(card => card[1]);
    
    // Count ranks and suits
    const rankCounts = {};
    const suitCounts = {};
    
    ranks.forEach(rank => {
        rankCounts[rank] = (rankCounts[rank] || 0) + 1;
    });
    
    suits.forEach(suit => {
        suitCounts[suit] = (suitCounts[suit] || 0) + 1;
    });
    
    // Analyze texture
    const maxRankCount = Math.max(...Object.values(rankCounts));
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    
    if (maxRankCount >= 3) return { texture: 'paired', rankCounts };
    if (maxSuitCount >= 3) return { texture: 'suited', suitCounts };
    
    // Check for connected cards
    const sortedRanks = [...new Set(ranks)].sort((a, b) => 
        '23456789TJQKA'.indexOf(a) - '23456789TJQKA'.indexOf(b)
    );
    
    let connected = 0;
    for (let i = 0; i < sortedRanks.length - 1; i++) {
        const rank1 = '23456789TJQKA'.indexOf(sortedRanks[i]);
        const rank2 = '23456789TJQKA'.indexOf(sortedRanks[i + 1]);
        if (rank2 - rank1 <= 2) connected++;
    }
    
    if (connected >= 2) return { texture: 'connected', connected };
    
    return { texture: 'dry' };
}

function calculateDrawCompletionProbability(draws, board, hand) {
    if (draws.length === 0) return 0;
    const outs = calculateDrawOuts(draws, board, hand);
    const remainingCards = 52 - board.length - hand.length;
    if (remainingCards === 0) return 0;
    if (board.length === 3) {
        return outs / remainingCards;
    } else if (board.length === 4) {
        return outs / remainingCards;
    }
    return 0;
}

function calculateDrawOuts(draws, board, hand) {
    if (draws.length === 0) return 0;
    let totalOuts = 0;
    const allCards = [...hand, ...board];
    const usedCards = new Set(allCards);
    
    if (draws.includes('flush_draw')) {
        const flushOuts = calculateFlushDrawOuts(allCards);
        totalOuts += flushOuts;
    }
    if (draws.includes('oesd')) {
        totalOuts += 8;
    } else if (draws.includes('gutshot')) {
        totalOuts += 4;
    } else if (draws.includes('double_gutshot')) {
        totalOuts += 2;
    }
    if (draws.includes('wheel_draw')) {
        const wheelOuts = calculateWheelDrawOuts(allCards);
        totalOuts += wheelOuts;
    }
    
    const overlappingOuts = calculateOverlappingOuts(draws, allCards);
    totalOuts -= overlappingOuts;
    return Math.max(0, totalOuts);
}

function calculateFlushDrawOuts(allCards) {
    const suits = allCards.map(card => card[1]);
    const suitCounts = {};
    suits.forEach(suit => {
        suitCounts[suit] = (suitCounts[suit] || 0) + 1;
    });
    
    for (const [suit, count] of Object.entries(suitCounts)) {
        if (count === 4) {
            const usedCardsOfSuit = allCards.filter(card => card[1] === suit).length;
            return 13 - usedCardsOfSuit;
        }
    }
    return 0;
}

function calculateWheelDrawOuts(allCards) {
    const ranks = allCards.map(card => card[0]);
    const wheelRanks = ['A', '2', '3', '4', '5'];
    const missingWheelRanks = wheelRanks.filter(rank => !ranks.includes(rank));
    let outs = 0;
    missingWheelRanks.forEach(rank => {
        const usedCardsOfRank = ranks.filter(r => r === rank).length;
        outs += 4 - usedCardsOfRank;
    });
    return outs;
}

function calculateOverlappingOuts(draws, allCards) {
    let overlapping = 0;
    if (draws.includes('flush_draw') && 
        (draws.includes('oesd') || draws.includes('gutshot'))) {
        overlapping = Math.floor(overlapping * 0.2);
    }
    return overlapping;
}

module.exports = {
    calculateOpponentRangeStrength,
    assessOpponentRangeStrength
}; 