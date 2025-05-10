// Card utilities
const RANKS = '23456789TJQKA';
const SUITS = ['c', 'd', 'h', 's'];

// Stack depth categories
export const STACK_DEPTHS = {
    DEEP: 50,    // 50+ BB
    MID: 20,     // 20-50 BB
    SHORT: 10,   // 10-20 BB
    VERY_SHORT: 5 // <10 BB
};

// Position-specific opening ranges based on stack depth
const POSITION_RANGES = {
    UTG: {
        [STACK_DEPTHS.DEEP]: {
            open: {
                'AA,KK,QQ,JJ,TT,99,88,77,66,55,44,33,22': 1.0,
                'AKs,AQs,AJs,ATs,A9s,A8s,A7s,A6s,A5s,A4s,A3s,A2s': 0.9,
                'AKo,AQo,AJo,ATo,A9o,A8o,A7o,A6o,A5o,A4o,A3o,A2o': 0.8,
                'KQs,KJs,KTs,K9s,K8s,K7s,K6s,K5s,K4s,K3s,K2s': 0.7,
                'KQo,KJo,KTo,K9o,K8o,K7o,K6o,K5o,K4o,K3o,K2o': 0.6,
                'QJs,QTs,Q9s,Q8s,Q7s,Q6s,Q5s,Q4s,Q3s,Q2s': 0.5,
                'QJo,QTo,Q9o,Q8o,Q7o,Q6o,Q5o,Q4o,Q3o,Q2o': 0.4,
                'JTs,J9s,J8s,J7s,J6s,J5s,J4s,J3s,J2s': 0.3,
                'JTo,J9o,J8o,J7o,J6o,J5o,J4o,J3o,J2o': 0.2,
                'T9s,T8s,T7s,T6s,T5s,T4s,T3s,T2s': 0.2,
                'T9o,T8o,T7o,T6o,T5o,T4o,T3o,T2o': 0.1,
                '98s,97s,96s,95s,94s,93s,92s': 0.1,
                '98o,97o,96o,95o,94o,93o,92o': 0.05,
            }
        },
        [STACK_DEPTHS.MID]: {
            open: {
                'AA,KK,QQ,JJ,TT,99,88,77,66,55': 1.0,
                'AKs,AQs,AJs,ATs,A9s,A8s,A7s,A6s,A5s': 0.9,
                'AKo,AQo,AJo,ATo,A9o,A8o,A7o': 0.8,
                'KQs,KJs,KTs,K9s,K8s,K7s': 0.7,
                'KQo,KJo,KTo,K9o': 0.6,
                'QJs,QTs,Q9s,Q8s': 0.5,
                'QJo,QTo,Q9o': 0.4,
                'JTs,J9s,J8s,J7s': 0.3,
                'JTo,J9o,J8o': 0.2,
                'T9s,T8s,T7s,T6s': 0.2,
                'T9o,T8o,T7o': 0.1,
                '98s,97s,96s,95s': 0.1,
                '98o,97o,96o': 0.05,
            }
        },
        [STACK_DEPTHS.SHORT]: {
            open: {
                'AA,KK,QQ,JJ,TT,99,88,77,66,55': 1.0,
                'AKs,AQs,AJs,ATs,A9s,A8s,A7s': 0.9,
                'AKo,AQo,AJo,ATo,A9o': 0.8,
                'KQs,KJs,KTs,K9s,K8s': 0.7,
                'KQo,KJo,KTo': 0.6,
                'QJs,QTs,Q9s': 0.5,
                'QJo,QTo': 0.4,
                'JTs,J9s,J8s': 0.3,
                'JTo,J9o': 0.2,
                'T9s,T8s,T7s': 0.2,
                'T9o,T8o': 0.1,
                '98s,97s,96s': 0.1,
                '98o,97o': 0.05,
            }
        },
        [STACK_DEPTHS.VERY_SHORT]: {
            open: {
                'AA,KK,QQ,JJ,TT,99,88,77,66,55': 1.0,
                'AKs,AQs,AJs,ATs,A9s': 0.9,
                'AKo,AQo,AJo,ATo': 0.8,
                'KQs,KJs,KTs,K9s': 0.7,
                'KQo,KJo,KTo': 0.6,
                'QJs,QTs,Q9s': 0.5,
                'QJo,QTo': 0.4,
                'JTs,J9s,J8s': 0.3,
                'JTo,J9o': 0.2,
                'T9s,T8s,T7s': 0.2,
                'T9o,T8o': 0.1,
                '98s,97s,96s': 0.1,
                '98o,97o': 0.05,
            }
        }
    },
    // Add more positions as needed
};

// Convert card string to rank and suit
const parseCard = (card) => {
    if (!card || card.length !== 2) return null;
    const rank = card[0].toUpperCase();
    const suit = card[1].toLowerCase();
    return { rank, suit };
};

// Calculate hand strength (simplified version)
const calculateHandStrength = (holeCards, communityCards) => {
    if (!holeCards || holeCards.length !== 2) return 0;
    
    // For preflop, calculate based on hand ranking
    if (!communityCards || communityCards.length === 0) {
        const card1 = holeCards[0];
        const card2 = holeCards[1];
        
        // Get ranks and suits
        const rank1 = card1[0].toUpperCase();
        const rank2 = card2[0].toUpperCase();
        const suit1 = card1[1].toLowerCase();
        const suit2 = card2[1].toLowerCase();
        
        // Calculate base strength
        let strength = 0;
        
        // Pocket pairs
        if (rank1 === rank2) {
            strength = 0.8 + (RANKS.indexOf(rank1) / RANKS.length) * 0.2;
        }
        // Suited hands
        else if (suit1 === suit2) {
            const highRank = Math.max(RANKS.indexOf(rank1), RANKS.indexOf(rank2));
            const lowRank = Math.min(RANKS.indexOf(rank1), RANKS.indexOf(rank2));
            strength = 0.5 + (highRank / RANKS.length) * 0.2 + (lowRank / RANKS.length) * 0.1;
        }
        // Offsuit hands
        else {
            const highRank = Math.max(RANKS.indexOf(rank1), RANKS.indexOf(rank2));
            const lowRank = Math.min(RANKS.indexOf(rank1), RANKS.indexOf(rank2));
            strength = 0.3 + (highRank / RANKS.length) * 0.2 + (lowRank / RANKS.length) * 0.1;
        }
        
        return strength;
    }
    
    // For postflop, use the full hand evaluator
    const allCards = [...holeCards, ...communityCards];
    const handRank = evaluateHand(allCards);
    
    // Normalize hand rank to 0-1 scale
    return handRank / 8000; // 8000 is the maximum hand rank (straight flush)
};

// Evaluate hand rank (simplified version)
const evaluateHand = (cards) => {
    if (!cards || cards.length < 5) return 0;
    
    // This is a simplified version - in reality, you'd want to use a proper hand evaluator
    // that considers all possible 5-card combinations from the 7 cards
    const ranks = cards.map(card => RANKS.indexOf(card[0].toUpperCase()));
    const suits = cards.map(card => card[1].toLowerCase());
    
    // Check for flush
    const flush = SUITS.some(suit => suits.filter(s => s === suit).length >= 5);
    
    // Check for straight
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => a - b);
    let straight = false;
    for (let i = 0; i <= uniqueRanks.length - 5; i++) {
        if (uniqueRanks[i + 4] - uniqueRanks[i] === 4) {
            straight = true;
            break;
        }
    }
    
    // Count rank frequencies
    const rankCounts = {};
    ranks.forEach(rank => {
        rankCounts[rank] = (rankCounts[rank] || 0) + 1;
    });
    
    // Determine hand type
    if (flush && straight) return 8000; // Straight flush
    if (Object.values(rankCounts).includes(4)) return 7000; // Four of a kind
    if (Object.values(rankCounts).includes(3) && Object.values(rankCounts).includes(2)) return 6000; // Full house
    if (flush) return 5000; // Flush
    if (straight) return 4000; // Straight
    if (Object.values(rankCounts).includes(3)) return 3000; // Three of a kind
    if (Object.values(rankCounts).filter(count => count === 2).length === 2) return 2000; // Two pair
    if (Object.values(rankCounts).includes(2)) return 1000; // One pair
    
    return Math.max(...ranks); // High card
};

// Calculate equity against a range
const calculateEquity = (holeCards, communityCards, opponentRange) => {
    if (!holeCards || holeCards.length !== 2) return 0;
    
    // This is a simplified version - in reality, you'd want to use a proper equity calculator
    // that considers all possible combinations of opponent hands in their range
    const handStrength = calculateHandStrength(holeCards, communityCards);
    
    // Assume opponent's range strength is normally distributed around 0.5
    // with standard deviation of 0.2
    const opponentStrength = 0.5 + (Math.random() - 0.5) * 0.4;
    
    return handStrength > opponentStrength ? 0.6 : 0.4;
};

// Calculate pot odds
const calculatePotOdds = (betSize, potSize) => {
    return betSize / (potSize + betSize);
};

// Get GTO action recommendation
const getRecommendedAction = (street, position, action, potSize, betSize, handStrength, equity, potOdds) => {
    // This is where you'd implement the actual GTO logic
    // For now, return a simplified recommendation based on basic principles
    
    let recommendedAction = {
        action: 'check',
        sizing: 0,
        frequency: 1.0,
        reasoning: ''
    };
    
    // Preflop logic
    if (street === 'preflop') {
        if (handStrength > 0.8) {
            recommendedAction = {
                action: 'raise',
                sizing: 2.5,
                frequency: 1.0,
                reasoning: 'Strong hand, standard open raise'
            };
        } else if (handStrength > 0.6) {
            recommendedAction = {
                action: 'raise',
                sizing: 2.5,
                frequency: 0.7,
                reasoning: 'Good hand, mix of raise and call'
            };
        } else if (handStrength > 0.4) {
            recommendedAction = {
                action: 'call',
                sizing: betSize,
                frequency: 0.5,
                reasoning: 'Medium strength hand, mix of call and fold'
            };
        } else {
            recommendedAction = {
                action: 'fold',
                sizing: 0,
                frequency: 1.0,
                reasoning: 'Weak hand, fold'
            };
        }
    }
    
    // Postflop logic
    else {
        if (equity > 0.7) {
            recommendedAction = {
                action: 'bet',
                sizing: potSize * 0.75,
                frequency: 0.8,
                reasoning: 'Strong equity, value bet'
            };
        } else if (equity > 0.5) {
            recommendedAction = {
                action: 'bet',
                sizing: potSize * 0.5,
                frequency: 0.6,
                reasoning: 'Good equity, mix of bet and check'
            };
        } else if (equity > 0.3) {
            recommendedAction = {
                action: 'check',
                sizing: 0,
                frequency: 0.7,
                reasoning: 'Medium equity, check-call'
            };
        } else {
            recommendedAction = {
                action: 'check',
                sizing: 0,
                frequency: 1.0,
                reasoning: 'Low equity, check-fold'
            };
        }
    }
    
    return recommendedAction;
};

// Helper function to get stack depth category
const getStackDepthCategory = (stackSize) => {
    if (stackSize >= STACK_DEPTHS.DEEP) return STACK_DEPTHS.DEEP;
    if (stackSize >= STACK_DEPTHS.MID) return STACK_DEPTHS.MID;
    if (stackSize >= STACK_DEPTHS.SHORT) return STACK_DEPTHS.SHORT;
    return STACK_DEPTHS.VERY_SHORT;
};

// Helper function to get position-specific range
const getPositionRange = (position, stackSize, action = 'open') => {
    const stackDepth = getStackDepthCategory(stackSize);
    return POSITION_RANGES[position]?.[stackDepth]?.[action] || {};
};

// Export all functions
export {
    calculateHandStrength,
    calculateEquity,
    calculatePotOdds,
    getRecommendedAction,
    parseCard,
    evaluateHand,
    getStackDepthCategory,
    getPositionRange
}; 