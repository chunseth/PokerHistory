/**
 * Calculates the strength of a poker hand
 */

const RANKS = '23456789TJQKA';
const SUITS = 'cdhs';

/**
 * Convert a card string (e.g., 'Ah') to a numeric value
 * @param {string} card - Card in format 'Rs' where R is rank and s is suit
 * @returns {Object} Card object with numeric rank and suit values
 */
function cardToValue(card) {
    const rank = RANKS.indexOf(card[0]);
    const suit = SUITS.indexOf(card[1]);
    return { rank, suit };
}

/**
 * Determine if the cards make a flush
 * @param {Array} cards - Array of card strings
 * @returns {boolean} True if flush
 */
function isFlush(cards) {
    const suits = cards.map(card => cardToValue(card).suit);
    return suits.every(suit => suit === suits[0]);
}

/**
 * Determine if the cards make a straight
 * @param {Array} cards - Array of card strings
 * @returns {boolean} True if straight
 */
function isStraight(cards) {
    const ranks = cards.map(card => cardToValue(card).rank).sort((a, b) => a - b);
    
    // Check for Ace-low straight
    if (ranks[ranks.length - 1] === 12) { // If we have an Ace
        const aceLowRanks = [...ranks.slice(0, -1), -1];
        if (isConsecutive(aceLowRanks)) return true;
    }
    
    return isConsecutive(ranks);
}

/**
 * Check if array of numbers is consecutive
 * @param {Array} numbers - Array of numbers
 * @returns {boolean} True if consecutive
 */
function isConsecutive(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b);
    return sorted.every((num, i) => i === 0 || num === sorted[i - 1] + 1);
}

/**
 * Get frequency of each rank in the hand
 * @param {Array} cards - Array of card strings
 * @returns {Object} Map of rank frequencies
 */
function getRankFrequencies(cards) {
    const frequencies = {};
    cards.forEach(card => {
        const { rank } = cardToValue(card);
        frequencies[rank] = (frequencies[rank] || 0) + 1;
    });
    return frequencies;
}

/**
 * Calculate hand strength on a scale of 0-1
 * @param {Array} holeCards - Player's hole cards
 * @param {Array} boardCards - Community cards
 * @returns {number} Hand strength from 0 to 1
 */
function calculateHandStrength(holeCards, boardCards) {
    const allCards = [...holeCards, ...boardCards];
    
    // Get rank frequencies
    const frequencies = getRankFrequencies(allCards);
    const freqValues = Object.values(frequencies).sort((a, b) => b - a);
    
    // Check for different hand types
    const hasFlush = isFlush(allCards);
    const hasStraight = isStraight(allCards);
    
    // Calculate base hand strength (0-9 scale, will be normalized)
    let strength = 0;
    
    // Straight flush
    if (hasFlush && hasStraight) {
        strength = 9;
    }
    // Four of a kind
    else if (freqValues[0] === 4) {
        strength = 8;
    }
    // Full house
    else if (freqValues[0] === 3 && freqValues[1] === 2) {
        strength = 7;
    }
    // Flush
    else if (hasFlush) {
        strength = 6;
    }
    // Straight
    else if (hasStraight) {
        strength = 5;
    }
    // Three of a kind
    else if (freqValues[0] === 3) {
        strength = 4;
    }
    // Two pair
    else if (freqValues[0] === 2 && freqValues[1] === 2) {
        strength = 3;
    }
    // One pair
    else if (freqValues[0] === 2) {
        strength = 2;
    }
    // High card
    else {
        strength = 1;
    }
    
    // Add kicker strength (0-1 scale)
    const ranks = allCards.map(card => cardToValue(card).rank);
    const maxRank = Math.max(...ranks);
    const kickerStrength = maxRank / 12;
    
    // Normalize final strength to 0-1 scale
    return (strength + kickerStrength) / 10;
}

module.exports = {
    calculateHandStrength
}; 