// Constants for position names and table configurations
const POSITION_CONFIGS = {
    9: ['UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
    8: ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
    7: ['UTG', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
    6: ['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
    5: ['EP', 'HJ', 'CO', 'BTN', 'BB'],
    4: ['EP', 'CO', 'BTN', 'BB'],
    3: ['BTN/SB', 'BB', 'EP'],
    2: ['BTN/SB', 'BB']
};

// Player tendencies and their impact on strategy
const PLAYER_TYPES = {
    'loose-passive': {
        description: 'Enters many pots but rarely bets/raises',
        adjustments: {
            bluffFrequency: 1.3, // Increase bluffing
            valueSize: 1.2,     // Larger value bets
            callThreshold: 0.9   // Tighter calling range
        }
    },
    'tight-aggressive': {
        description: 'Plays few hands but aggressive when in hand',
        adjustments: {
            bluffFrequency: 0.7, // Decrease bluffing
            valueSize: 1.0,     // Standard value bets
            callThreshold: 1.2   // Wider calling range vs. aggression
        }
    },
    'loose-aggressive': {
        description: 'Plays many hands aggressively',
        adjustments: {
            bluffFrequency: 0.5, // Decrease bluffing
            valueSize: 0.9,     // Smaller value bets
            callThreshold: 1.3   // Call down lighter
        }
    },
    'tight-passive': {
        description: 'Plays few hands passively',
        adjustments: {
            bluffFrequency: 1.5, // Increase bluffing significantly
            valueSize: 0.8,     // Smaller value bets
            callThreshold: 0.7   // Tighter calling range
        }
    }
};

// Rake structure configuration
class RakeConfig {
    constructor(percentage, cap, noFlopNoDrop = true) {
        this.percentage = percentage;
        this.cap = cap;
        this.noFlopNoDrop = noFlopNoDrop;
    }

    calculateRake(potSize, hasFlop) {
        if (this.noFlopNoDrop && !hasFlop) return 0;
        const rawRake = potSize * (this.percentage / 100);
        return Math.min(rawRake, this.cap);
    }
}

// Deep stack adjustments based on effective stack size
const getDeepStackAdjustments = (effectiveStackBB) => {
    const isDeep = effectiveStackBB > 100;
    const veryDeep = effectiveStackBB > 200;
    
    return {
        // Preflop adjustments
        preflop: {
            openRaiseSize: isDeep ? 3.5 : 3.0,
            threeBetSize: isDeep ? 4.0 : 3.0,
            fourBetSize: isDeep ? 2.5 : 2.25, // Multiplier of 3bet size
            rangeAdjustment: {
                speculativeHands: isDeep ? 1.2 : 1.0,  // Increase small pairs and suited connectors
                mediumStrength: veryDeep ? 0.8 : 1.0   // Decrease medium strength hands when very deep
            }
        },
        // Postflop adjustments
        postflop: {
            cbetFrequency: isDeep ? 0.8 : 1.0,        // Reduce cbet frequency when deep
            potControlFactor: isDeep ? 1.2 : 1.0,      // Increase pot control importance
            drawValue: isDeep ? 1.3 : 1.0,            // Increase value of draws
            nutAdvantage: isDeep ? 1.4 : 1.0          // Increase value of nut hands
        }
    };
};

class CashGameAnalyzer {
    constructor(playerCount, rakeConfig) {
        this.positions = POSITION_CONFIGS[playerCount];
        this.rakeConfig = rakeConfig;
        this.handHistory = [];
    }

    // Get position name based on seat number and player count
    getPosition(seatNumber) {
        return this.positions[seatNumber % this.positions.length];
    }

    // Analyze a specific street
    analyzeStreet(streetState) {
        const {
            street,
            heroPosition,
            heroHoldings,
            effectiveStack,
            potSize,
            lastAction,
            board,
            opponentType,
            hasFlop
        } = streetState;

        // Calculate rake
        const currentRake = this.rakeConfig.calculateRake(potSize, hasFlop);
        const potAfterRake = potSize - currentRake;

        // Get deep stack adjustments
        const deepAdjustments = getDeepStackAdjustments(effectiveStack);

        // Get opponent-specific adjustments
        const opponentAdjustments = PLAYER_TYPES[opponentType]?.adjustments || {
            bluffFrequency: 1.0,
            valueSize: 1.0,
            callThreshold: 1.0
        };

        // Combine all factors for final recommendation
        const recommendation = this.generateRecommendation(
            street,
            heroPosition,
            heroHoldings,
            board,
            potAfterRake,
            effectiveStack,
            lastAction,
            deepAdjustments,
            opponentAdjustments
        );

        // Log the decision point
        this.logDecision(streetState, recommendation, currentRake);

        return {
            recommendation,
            potDetails: {
                rawPot: potSize,
                rake: currentRake,
                netPot: potAfterRake
            },
            adjustments: {
                deep: deepAdjustments,
                opponent: opponentAdjustments
            }
        };
    }

    // Generate specific action recommendation
    generateRecommendation(street, position, holdings, board, potAfterRake, effectiveStack, lastAction, deepAdj, oppAdj) {
        // This would contain the core GTO logic combined with adjustments
        // For now, returning a simplified recommendation
        return {
            action: this.determineAction(street, position, holdings, board, lastAction),
            sizing: this.determineBetSize(potAfterRake, effectiveStack, deepAdj),
            frequency: this.determineFrequency(oppAdj),
            explanation: this.generateExplanation(street, position, holdings, board, lastAction)
        };
    }

    // Helper methods for recommendation generation
    determineAction(street, position, holdings, board, lastAction) {
        // Simplified action determination
        // In reality, this would use a more sophisticated GTO engine
        return "check"; // Placeholder
    }

    determineBetSize(pot, effectiveStack, deepAdj) {
        // Simplified bet sizing
        return pot * 0.67; // Standard 2/3 pot bet
    }

    determineFrequency(oppAdj) {
        // Simplified frequency calculation
        return 1.0;
    }

    generateExplanation(street, position, holdings, board, lastAction) {
        // Generate human-readable explanation
        return "Default action based on position and street";
    }

    // Logging for hand history and analysis
    logDecision(state, recommendation, rake) {
        this.handHistory.push({
            street: state.street,
            action: recommendation.action,
            explanation: recommendation.explanation,
            rake: rake,
            timestamp: new Date()
        });
    }

    // Get complete hand history
    getHandHistory() {
        return this.handHistory;
    }
}

// Export the analyzer and supporting classes/constants
export {
    CashGameAnalyzer,
    RakeConfig,
    POSITION_CONFIGS,
    PLAYER_TYPES
}; 