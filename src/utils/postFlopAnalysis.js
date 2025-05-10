// Board texture categories
const BOARD_TEXTURES = {
    DRY: {
        description: 'Low connectivity, few draws',
        characteristics: ['Low card density', 'No flush draws', 'No straight draws'],
        betSizing: {
            cbet: 0.33, // 33% pot
            turn: 0.5,  // 50% pot
            river: 0.75 // 75% pot
        }
    },
    WET: {
        description: 'High connectivity, many draws',
        characteristics: ['High card density', 'Flush draws', 'Straight draws'],
        betSizing: {
            cbet: 0.75, // 75% pot
            turn: 0.75, // 75% pot
            river: 1.0  // 100% pot
        }
    },
    MONOTONE: {
        description: 'Three cards of same suit',
        characteristics: ['Flush draw', 'Potential flush'],
        betSizing: {
            cbet: 0.5,  // 50% pot
            turn: 0.75, // 75% pot
            river: 1.0  // 100% pot
        }
    },
    PAIRED: {
        description: 'Two or more cards of same rank',
        characteristics: ['Set potential', 'Full house potential'],
        betSizing: {
            cbet: 0.5,  // 50% pot
            turn: 0.75, // 75% pot
            river: 1.0  // 100% pot
        }
    }
};

// Position-based strategies
const POSITION_STRATEGIES = {
    IP: { // In Position
        cbetFrequency: 0.7,
        checkRaiseFrequency: 0.1,
        turnBetFrequency: 0.6,
        riverBetFrequency: 0.5,
        valueBetRatio: 0.7, // 70% value bets, 30% bluffs
        sizingMultiplier: 1.0
    },
    OOP: { // Out of Position
        cbetFrequency: 0.5,
        checkRaiseFrequency: 0.2,
        turnBetFrequency: 0.4,
        riverBetFrequency: 0.3,
        valueBetRatio: 0.8, // 80% value bets, 20% bluffs
        sizingMultiplier: 1.2
    }
};

// Stack depth adjustments
const STACK_DEPTH_ADJUSTMENTS = {
    DEEP: { // 100+ BB
        sizingMultiplier: 1.2,
        bluffFrequency: 0.8,
        valueBetRatio: 0.6
    },
    MEDIUM: { // 50-100 BB
        sizingMultiplier: 1.0,
        bluffFrequency: 1.0,
        valueBetRatio: 0.7
    },
    SHORT: { // 20-50 BB
        sizingMultiplier: 0.8,
        bluffFrequency: 1.2,
        valueBetRatio: 0.8
    }
};

class PostFlopAnalyzer {
    constructor(position, stackDepth) {
        this.position = position;
        this.stackDepth = this.getStackDepthCategory(stackDepth);
        this.positionStrategy = POSITION_STRATEGIES[position];
        this.stackAdjustments = STACK_DEPTH_ADJUSTMENTS[this.stackDepth];
    }

    getStackDepthCategory(stackSize) {
        if (stackSize >= 100) return 'DEEP';
        if (stackSize >= 50) return 'MEDIUM';
        return 'SHORT';
    }

    analyzeBoardTexture(board) {
        const suits = board.map(card => card[1]);
        const ranks = board.map(card => card[0]);
        
        // Check for monotone
        if (new Set(suits).size === 1) {
            return BOARD_TEXTURES.MONOTONE;
        }
        
        // Check for paired board
        if (new Set(ranks).size < board.length) {
            return BOARD_TEXTURES.PAIRED;
        }
        
        // Check for wet board
        const connectedness = this.calculateConnectedness(ranks);
        const flushDraws = this.countFlushDraws(suits);
        
        if (connectedness > 0.6 || flushDraws > 0) {
            return BOARD_TEXTURES.WET;
        }
        
        return BOARD_TEXTURES.DRY;
    }

    calculateConnectedness(ranks) {
        const rankValues = ranks.map(rank => {
            const value = parseInt(rank);
            return isNaN(value) ? 
                (rank === 'A' ? 14 : rank === 'K' ? 13 : rank === 'Q' ? 12 : rank === 'J' ? 11 : 10) 
                : value;
        });
        
        let connectedness = 0;
        for (let i = 0; i < rankValues.length - 1; i++) {
            for (let j = i + 1; j < rankValues.length; j++) {
                const diff = Math.abs(rankValues[i] - rankValues[j]);
                if (diff <= 2) connectedness += 1;
            }
        }
        
        return connectedness / (rankValues.length * (rankValues.length - 1) / 2);
    }

    countFlushDraws(suits) {
        const suitCounts = {};
        suits.forEach(suit => {
            suitCounts[suit] = (suitCounts[suit] || 0) + 1;
        });
        return Object.values(suitCounts).filter(count => count >= 2).length;
    }

    getBetSizing(street, boardTexture, potSize) {
        const baseSizing = boardTexture.betSizing[street];
        const positionMultiplier = this.positionStrategy.sizingMultiplier;
        const stackMultiplier = this.stackAdjustments.sizingMultiplier;
        
        return potSize * baseSizing * positionMultiplier * stackMultiplier;
    }

    getActionFrequency(street, boardTexture) {
        const baseFrequency = this.positionStrategy[`${street}BetFrequency`];
        const stackAdjustment = this.stackAdjustments.bluffFrequency;
        
        return baseFrequency * stackAdjustment;
    }

    analyzeHand(hand, board, potSize, street) {
        const boardTexture = this.analyzeBoardTexture(board);
        const betSize = this.getBetSizing(street, boardTexture, potSize);
        
        // Define GTO frequencies based on position and board texture
        const gtoFrequencies = {
            IP: {
                DRY: {
                    bet: { freq: 0.65, size: 0.5 },
                    check: { freq: 0.35 }
                },
                WET: {
                    bet: { freq: 0.55, size: 0.6 },
                    check: { freq: 0.45 }
                },
                MONOTONE: {
                    bet: { freq: 0.45, size: 0.7 },
                    check: { freq: 0.55 }
                },
                PAIRED: {
                    bet: { freq: 0.5, size: 0.65 },
                    check: { freq: 0.5 }
                }
            },
            OOP: {
                DRY: {
                    bet: { freq: 0.55, size: 0.45 },
                    check: { freq: 0.45 }
                },
                WET: {
                    bet: { freq: 0.45, size: 0.55 },
                    check: { freq: 0.55 }
                },
                MONOTONE: {
                    bet: { freq: 0.35, size: 0.65 },
                    check: { freq: 0.65 }
                },
                PAIRED: {
                    bet: { freq: 0.4, size: 0.6 },
                    check: { freq: 0.6 }
                }
            }
        };

        // Get the appropriate frequencies based on position and board texture
        const position = this.position;
        const boardType = Object.keys(BOARD_TEXTURES).find(key => BOARD_TEXTURES[key] === boardTexture);
        const baseFrequencies = gtoFrequencies[position][boardType];

        // Adjust frequencies based on stack depth
        const stackMultiplier = this.stackAdjustments.sizingMultiplier;
        const adjustedFrequencies = {
            bet: {
                // Cap the bet size at 0.75 even after stack depth adjustment
                size: Math.min(baseFrequencies.bet.size * stackMultiplier, 0.75),
                freq: baseFrequencies.bet.freq * (this.stackDepth === 'DEEP' ? 1.2 : this.stackDepth === 'SHORT' ? 0.8 : 1.0)
            },
            check: {
                size: 0,
                freq: baseFrequencies.check.freq * (this.stackDepth === 'DEEP' ? 0.8 : this.stackDepth === 'SHORT' ? 1.2 : 1.0)
            }
        };

        // Normalize frequencies to ensure they sum to 1
        const totalFreq = adjustedFrequencies.bet.freq + adjustedFrequencies.check.freq;
        adjustedFrequencies.bet.freq /= totalFreq;
        adjustedFrequencies.check.freq /= totalFreq;
        
        return {
            boardTexture: boardTexture.description,
            frequencies: adjustedFrequencies,
            adjustments: {
                position: this.positionStrategy,
                stackDepth: this.stackAdjustments
            }
        };
    }

    determineAction(street, hand, board) {
        // This would be expanded with actual hand strength evaluation
        // For now, return a simplified recommendation
        const handStrength = this.evaluateHandStrength(hand, board);
        
        if (handStrength > 0.7) return 'bet';
        if (handStrength > 0.4) return 'check-call';
        return 'check-fold';
    }

    evaluateHandStrength(hand, board) {
        // This would be expanded with actual hand strength evaluation
        // For now, return a simplified strength
        return 0.5; // Placeholder
    }
}

export default PostFlopAnalyzer; 