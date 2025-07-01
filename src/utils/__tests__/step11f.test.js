const mongoose = require('mongoose');
const { Hand } = require('../../models/models');
const {
    adjustForOpponentRangeStrength,
    calculateStrongHandsAdjustment,
    calculateWeakHandsAdjustment,
    calculateDrawingHandsAdjustment,
    calculateOverallRangeAdjustment
} = require('../EV_Calculation/Step11/step11f');

describe('Step 11f: Range Strength Adjustments - Real Hand Validation', () => {
    let realHands = [];
    let adjustmentResults = [];

    beforeAll(async () => {
        try {
            await mongoose.connect('mongodb://localhost:27017/pokerHistory', {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('✅ Connected to poker history database');
            
            const hands = await Hand.find({}).limit(100);
            realHands = hands.map(hand => hand.toObject());
            console.log(`📊 Loaded ${realHands.length} real hands from database`);
        } catch (error) {
            console.error('Failed to connect to database:', error);
        }
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    test('should calculate range strength adjustments for real hands', () => {
        realHands.forEach(hand => {
            // Process each betting action in the hand
            hand.bettingActions.forEach((action, actionIndex) => {
                // Process all betting actions
                {
                    // Mock range strength analysis (similar to step11c output)
                    const mockRangeStrength = {
                        averageStrength: 0.4 + Math.random() * 0.3, // 0.4 to 0.7
                        strongHandsPercentage: 20 + Math.random() * 30, // 20% to 50%
                        weakHandsPercentage: 20 + Math.random() * 30, // 20% to 50%
                        drawingHandsPercentage: 10 + Math.random() * 20, // 10% to 30%
                        topHands: [{ weight: 0.1 + Math.random() * 0.2 }], // 10% to 30%
                        bottomHands: [{ weight: 0.1 + Math.random() * 0.2 }] // 10% to 30%
                    };

                    // Mock player action
                    const playerAction = {
                        street: action.street,
                        betSizing: action.betSizing || 'medium',
                        isContinuationBet: action.isContinuationBet || false,
                        isValueBet: action.isValueBet || false,
                        isBluff: action.isBluff || false
                    };

                    // Mock pot odds
                    const potOdds = {
                        directOdds: action.potOdds || 0.3,
                        impliedOdds: action.impliedOdds || 1.5
                    };

                    const baseFoldFrequency = 0.5;

                    const result = adjustForOpponentRangeStrength(
                        mockRangeStrength,
                        playerAction,
                        potOdds,
                        baseFoldFrequency
                    );

                    // Log detailed results for analysis
                    console.log(`\nHand ${hand.handId}, Action ${actionIndex}, ${action.street}:`);
                    console.log(`Action Type: ${action.type}, Amount: ${action.amount}, Facing: ${action.facingBet || 'none'}`);
                    console.log(`Range Strength: ${mockRangeStrength.averageStrength.toFixed(3)}`);
                    console.log(`Strong %: ${mockRangeStrength.strongHandsPercentage.toFixed(1)}%`);
                    console.log(`Weak %: ${mockRangeStrength.weakHandsPercentage.toFixed(1)}%`);
                    console.log(`Drawing %: ${mockRangeStrength.drawingHandsPercentage.toFixed(1)}%`);
                    console.log(`Strong Hands Adj: ${result.strongHandsAdjustment?.toFixed(3) || 'N/A'}`);
                    console.log(`Weak Hands Adj: ${result.weakHandsAdjustment?.toFixed(3) || 'N/A'}`);
                    console.log(`Drawing Hands Adj: ${result.drawingHandsAdjustment?.toFixed(3) || 'N/A'}`);
                    console.log(`Overall Adj: ${result.overallAdjustment?.toFixed(3) || 'N/A'}`);
                    console.log(`Final Fold Freq: ${result.adjustedFoldFrequency?.toFixed(3) || 'N/A'}`);
                    console.log(`Explanation: ${result.explanation}`);

                    if (result && typeof result === 'object' && result.adjustedFoldFrequency !== undefined) {
                        adjustmentResults.push(result);
                    }

                    // Validate adjustment bounds
                    expect(result.adjustedFoldFrequency).toBeGreaterThanOrEqual(0.05);
                    expect(result.adjustedFoldFrequency).toBeLessThanOrEqual(0.95);
                    expect(result.overallAdjustment).toBeGreaterThanOrEqual(-0.4);
                    expect(result.overallAdjustment).toBeLessThanOrEqual(0.4);
                }
            });
        });

        // Log adjustment ranges
        console.log('\n📊 Adjustment Ranges:');
        const ranges = {
            strongHands: getAdjustmentRange(adjustmentResults, 'strongHandsAdjustment'),
            weakHands: getAdjustmentRange(adjustmentResults, 'weakHandsAdjustment'),
            drawingHands: getAdjustmentRange(adjustmentResults, 'drawingHandsAdjustment'),
            overall: getAdjustmentRange(adjustmentResults, 'overallAdjustment'),
            foldFreq: getAdjustmentRange(adjustmentResults, 'adjustedFoldFrequency')
        };

        Object.entries(ranges).forEach(([key, range]) => {
            console.log(`${key}: ${(range.min * 100).toFixed(1)}% to ${(range.max * 100).toFixed(1)}%`);
        });
    });

    test('should handle strong hands correctly', () => {
        const strongRange = {
            averageStrength: 0.8,
            strongHandsPercentage: 45,
            weakHandsPercentage: 20,
            drawingHandsPercentage: 15,
            topHands: [{ weight: 0.25 }]
        };

        const playerAction = {
            street: 'flop',
            betSizing: 'medium',
            isContinuationBet: true
        };

        const adjustment = calculateStrongHandsAdjustment(strongRange, playerAction);
        expect(adjustment).toBeLessThan(0); // Strong hands should reduce fold frequency
        console.log(`\n💪 Strong Hands Test Adjustment: ${(adjustment * 100).toFixed(1)}%`);
    });

    test('should handle weak hands correctly', () => {
        const weakRange = {
            averageStrength: 0.3,
            strongHandsPercentage: 15,
            weakHandsPercentage: 55,
            drawingHandsPercentage: 20,
            bottomHands: [{ weight: 0.35 }]
        };

        const playerAction = {
            street: 'flop',
            betSizing: 'small',
            isBluff: true
        };

        const adjustment = calculateWeakHandsAdjustment(weakRange, playerAction);
        expect(adjustment).toBeGreaterThan(0); // Weak hands should increase fold frequency
        console.log(`\n🔽 Weak Hands Test Adjustment: ${(adjustment * 100).toFixed(1)}%`);
    });

    test('should handle drawing hands correctly', () => {
        const drawingRange = {
            averageStrength: 0.5,
            strongHandsPercentage: 20,
            weakHandsPercentage: 30,
            drawingHandsPercentage: 35
        };

        const scenarios = [
            { street: 'flop', betSizing: 'small', impliedOdds: 2.0 },
            { street: 'turn', betSizing: 'medium', impliedOdds: 1.5 },
            { street: 'river', betSizing: 'large', impliedOdds: 1.0 }
        ];

        scenarios.forEach(scenario => {
            const playerAction = {
                street: scenario.street,
                betSizing: scenario.betSizing
            };

            const potOdds = {
                directOdds: 0.3,
                impliedOdds: scenario.impliedOdds
            };

            const adjustment = calculateDrawingHandsAdjustment(drawingRange, playerAction, potOdds);
            console.log(`\n🎯 Drawing Hands ${scenario.street} Adjustment: ${(adjustment * 100).toFixed(1)}%`);
            
            if (scenario.street === 'river') {
                expect(adjustment).toBeGreaterThan(0); // Should fold more on river
            }
            if (scenario.betSizing === 'small' && scenario.street === 'flop') {
                expect(adjustment).toBeLessThan(0); // Should call more with small bets on flop
            }
        });
    });

    test('should handle missing input data gracefully', () => {
        const result = adjustForOpponentRangeStrength(null, null, null);
        expect(result).toBeDefined();
        expect(result.adjustedFoldFrequency).toBe(0.5);
        expect(result.explanation).toBe('Missing input data');
    });
});

function getAdjustmentRange(results, field) {
    const values = results
        .filter(r => r && typeof r[field] === 'number' && !isNaN(r[field]))
        .map(r => r[field]);
    
    if (values.length === 0) {
        return { min: 0, max: 0 };
    }
    
    return {
        min: Math.min(...values),
        max: Math.max(...values)
    };
} 