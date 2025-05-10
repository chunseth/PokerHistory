// Card ranks and their values
const RANKS = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

// Hand rankings
const HAND_RANKINGS = {
    HIGH_CARD: 0,
    PAIR: 1,
    TWO_PAIR: 2,
    THREE_OF_A_KIND: 3,
    STRAIGHT: 4,
    FLUSH: 5,
    FULL_HOUSE: 6,
    FOUR_OF_A_KIND: 7,
    STRAIGHT_FLUSH: 8,
    ROYAL_FLUSH: 9
};

// Convert card string to rank and suit
const parseCard = (card) => {
    if (!card) return null;
    const rank = card[0].toUpperCase();
    const suit = card[1].toLowerCase();
    return { rank: RANKS[rank], suit };
};

// Check if cards form a straight
const isStraight = (ranks) => {
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => a - b);
    
    // Check for Ace-low straight (A-5)
    if (uniqueRanks.includes(14)) { // Ace
        const aceLowRanks = [...uniqueRanks.filter(r => r !== 14), 1];
        if (isConsecutive(aceLowRanks)) return true;
    }
    
    return isConsecutive(uniqueRanks);
};

// Check if numbers are consecutive
const isConsecutive = (numbers) => {
    for (let i = 1; i < numbers.length; i++) {
        if (numbers[i] !== numbers[i - 1] + 1) return false;
    }
    return numbers.length >= 5;
};

// Count occurrences of each rank
const countRanks = (ranks) => {
    const counts = {};
    ranks.forEach(rank => {
        counts[rank] = (counts[rank] || 0) + 1;
    });
    return counts;
};

// Evaluate a poker hand
export const evaluateHand = (holeCards, communityCards) => {
    const allCards = [...holeCards, ...communityCards].map(parseCard).filter(Boolean);
    if (allCards.length < 5) return { rank: HAND_RANKINGS.HIGH_CARD, value: 0 };

    const ranks = allCards.map(card => card.rank);
    const suits = allCards.map(card => card.suit);
    const rankCounts = countRanks(ranks);

    // Check for flush
    const isFlush = Object.values(countRanks(suits)).some(count => count >= 5);
    
    // Check for straight
    const isStraightHand = isStraight(ranks);

    // Royal Flush
    if (isFlush && isStraightHand && Math.max(...ranks) === 14 && Math.min(...ranks) === 10) {
        return { rank: HAND_RANKINGS.ROYAL_FLUSH, value: 9000 };
    }

    // Straight Flush
    if (isFlush && isStraightHand) {
        return { rank: HAND_RANKINGS.STRAIGHT_FLUSH, value: 8000 + Math.max(...ranks) };
    }

    // Four of a Kind
    const fourOfAKind = Object.entries(rankCounts).find(([_, count]) => count === 4);
    if (fourOfAKind) {
        const kicker = Math.max(...ranks.filter(r => r !== parseInt(fourOfAKind[0])));
        return { rank: HAND_RANKINGS.FOUR_OF_A_KIND, value: 7000 + parseInt(fourOfAKind[0]) * 13 + kicker };
    }

    // Full House
    const threeOfAKind = Object.entries(rankCounts).find(([_, count]) => count === 3);
    const pair = Object.entries(rankCounts).find(([_, count]) => count === 2);
    if (threeOfAKind && pair) {
        return { 
            rank: HAND_RANKINGS.FULL_HOUSE, 
            value: 6000 + parseInt(threeOfAKind[0]) * 13 + parseInt(pair[0]) 
        };
    }

    // Flush
    if (isFlush) {
        const flushRanks = ranks.filter((_, i) => 
            suits[i] === suits.find(s => countRanks(suits)[s] >= 5)
        ).sort((a, b) => b - a);
        return { 
            rank: HAND_RANKINGS.FLUSH, 
            value: 5000 + flushRanks.slice(0, 5).reduce((acc, rank, i) => acc + rank * Math.pow(13, 4 - i), 0) 
        };
    }

    // Straight
    if (isStraightHand) {
        return { rank: HAND_RANKINGS.STRAIGHT, value: 4000 + Math.max(...ranks) };
    }

    // Three of a Kind
    if (threeOfAKind) {
        const kickers = ranks.filter(r => r !== parseInt(threeOfAKind[0]))
            .sort((a, b) => b - a)
            .slice(0, 2);
        return { 
            rank: HAND_RANKINGS.THREE_OF_A_KIND, 
            value: 3000 + parseInt(threeOfAKind[0]) * 169 + kickers[0] * 13 + kickers[1] 
        };
    }

    // Two Pair
    const pairs = Object.entries(rankCounts)
        .filter(([_, count]) => count === 2)
        .map(([rank]) => parseInt(rank))
        .sort((a, b) => b - a);
    if (pairs.length >= 2) {
        const kicker = Math.max(...ranks.filter(r => !pairs.includes(r)));
        return { 
            rank: HAND_RANKINGS.TWO_PAIR, 
            value: 2000 + pairs[0] * 169 + pairs[1] * 13 + kicker 
        };
    }

    // One Pair
    if (pair) {
        const kickers = ranks.filter(r => r !== parseInt(pair[0]))
            .sort((a, b) => b - a)
            .slice(0, 3);
        return { 
            rank: HAND_RANKINGS.PAIR, 
            value: 1000 + parseInt(pair[0]) * 2197 + kickers[0] * 169 + kickers[1] * 13 + kickers[2] 
        };
    }

    // High Card
    const highCards = [...ranks].sort((a, b) => b - a).slice(0, 5);
    return { 
        rank: HAND_RANKINGS.HIGH_CARD, 
        value: highCards.reduce((acc, rank, i) => acc + rank * Math.pow(13, 4 - i), 0) 
    };
};

// Calculate hand strength (0 to 1)
export const calculateHandStrength = (holeCards, communityCards) => {
    const hand = evaluateHand(holeCards, communityCards);
    const maxValue = 9000; // Royal Flush
    return hand.value / maxValue;
};

// Get hand description
export const getHandDescription = (holeCards, communityCards) => {
    const hand = evaluateHand(holeCards, communityCards);
    const rankNames = {
        [HAND_RANKINGS.HIGH_CARD]: 'High Card',
        [HAND_RANKINGS.PAIR]: 'Pair',
        [HAND_RANKINGS.TWO_PAIR]: 'Two Pair',
        [HAND_RANKINGS.THREE_OF_A_KIND]: 'Three of a Kind',
        [HAND_RANKINGS.STRAIGHT]: 'Straight',
        [HAND_RANKINGS.FLUSH]: 'Flush',
        [HAND_RANKINGS.FULL_HOUSE]: 'Full House',
        [HAND_RANKINGS.FOUR_OF_A_KIND]: 'Four of a Kind',
        [HAND_RANKINGS.STRAIGHT_FLUSH]: 'Straight Flush',
        [HAND_RANKINGS.ROYAL_FLUSH]: 'Royal Flush'
    };
    return rankNames[hand.rank];
}; 