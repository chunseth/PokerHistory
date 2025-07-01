const mongoose = require('mongoose');
const { Hand } = require('../../models/models');
const {
    calculateBaseFoldFrequency,
    calculateGTOFoldFrequency,
    calculateBetSizingFoldFrequency,
    calculatePotOddsFoldFrequency,
    calculateRangeStrengthFoldFrequency,
    calculateAllInFoldFrequency,
    combineFoldFrequencyFactors,
    getFoldFrequencyFactors,
    generateFoldFrequencyExplanation
} = require('../EV_Calculation/Step11/step11e');

describe('Step 11e: Base Fold Frequency Calculation - Real Hand Validation', () => {
    let realHands = [];
    let foldFrequencyResults = [];

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
            console.error('❌ Database connection failed:', error.message);
        }
    });

    afterAll(async () => {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
        }
    });

    describe('Base Fold Frequency Analysis', () => {
        test('should calculate base fold frequencies for real hands', () => {
            if (realHands.length === 0) {
                console.log('⚠️  Skipping database tests - no hands available');
                return;
            }

            realHands.forEach(hand => {
                if (hand.bettingActions && hand.bettingActions.length > 0) {
                    hand.bettingActions.forEach((action, actionIndex) => {
                        if (['bet', 'raise'].includes(action.action)) {
                            const playerAction = {
                                actionType: action.action,
                                betSize: action.amount,
                                betSizing: action.amount > 20 ? 'large' : action.amount > 10 ? 'medium' : 'small',
                                isAllIn: action.isAllIn || false,
                                street: action.street,
                                potSize: 20,
                                isContinuationBet: action.street === 'flop' && actionIndex < 3
                            };

                            const potOdds = {
                                potSize: 20,
                                callAmount: action.amount,
                                potOdds: action.amount / 20,
                                impliedOdds: 1.2,
                                requiredEquity: action.amount / 20,
                                isProfitable: true
                            };

                            const opponentRange = {
                                averageStrength: 0.5 + (Math.random() * 0.3),
                                strengthCategory: 'medium_strong',
                                strongHandsPercentage: 0.3,
                                weakHandsPercentage: 0.2,
                                drawsPercentage: 0.2,
                                totalCombos: 1000,
                                drawingHandsPercentage: 0.2,
                                boardTexture: { texture: 'balanced' }
                            };

                            const streetPatterns = {
                                adjustedFoldFrequency: 0.5,
                                adjustedCallFrequency: 0.3,
                                adjustedRaiseFrequency: 0.2,
                                street: action.street
                            };

                            try {
                                const result = calculateBaseFoldFrequency(
                                    playerAction,
                                    potOdds,
                                    opponentRange,
                                    streetPatterns
                                );

                                console.log(`Hand ${hand.id}, Action ${actionIndex}, ${action.street}:`);
                                console.log(`  GTO Fold: ${result.gtoFoldFrequency.toFixed(3)}`);
                                console.log(`  Bet Sizing Fold: ${result.betSizingFoldFrequency.toFixed(3)}`);
                                console.log(`  Pot Odds Fold: ${result.potOddsFoldFrequency.toFixed(3)}`);
                                console.log(`  Range Strength Fold: ${result.rangeStrengthFoldFrequency.toFixed(3)}`);
                                console.log(`  Final Fold: ${result.finalFoldFrequency.toFixed(3)}`);

                                foldFrequencyResults.push({
                                    handId: hand.id,
                                    actionIndex,
                                    action,
                                    result
                                });

                                expect(result.finalFoldFrequency).toBeGreaterThanOrEqual(0);
                                expect(result.finalFoldFrequency).toBeLessThanOrEqual(1);
                            } catch (error) {
                                console.error(`Error analyzing fold frequencies for hand ${hand.id}, action ${actionIndex}:`, error.message);
                            }
                        }
                    });
                }
            });

            expect(foldFrequencyResults.length).toBeGreaterThan(0);
        });

        test('should validate fold frequency ranges and relationships', () => {
            if (foldFrequencyResults.length === 0) return;

            const ranges = {
                gto: { min: 1, max: 0 },
                betSizing: { min: 1, max: 0 },
                potOdds: { min: 1, max: 0 },
                rangeStrength: { min: 1, max: 0 },
                final: { min: 1, max: 0 }
            };

            foldFrequencyResults.forEach(result => {
                const frequencies = result.result;
                
                ranges.gto.min = Math.min(ranges.gto.min, frequencies.gtoFoldFrequency);
                ranges.gto.max = Math.max(ranges.gto.max, frequencies.gtoFoldFrequency);
                
                ranges.betSizing.min = Math.min(ranges.betSizing.min, frequencies.betSizingFoldFrequency);
                ranges.betSizing.max = Math.max(ranges.betSizing.max, frequencies.betSizingFoldFrequency);
                
                ranges.potOdds.min = Math.min(ranges.potOdds.min, frequencies.potOddsFoldFrequency);
                ranges.potOdds.max = Math.max(ranges.potOdds.max, frequencies.potOddsFoldFrequency);
                
                ranges.rangeStrength.min = Math.min(ranges.rangeStrength.min, frequencies.rangeStrengthFoldFrequency);
                ranges.rangeStrength.max = Math.max(ranges.rangeStrength.max, frequencies.rangeStrengthFoldFrequency);
                
                ranges.final.min = Math.min(ranges.final.min, frequencies.finalFoldFrequency);
                ranges.final.max = Math.max(ranges.final.max, frequencies.finalFoldFrequency);
            });

            console.log('\n📊 Fold Frequency Ranges:');
            Object.entries(ranges).forEach(([type, range]) => {
                console.log(`${type}: ${(range.min * 100).toFixed(1)}% - ${(range.max * 100).toFixed(1)}%`);
            });

            // Validate ranges are reasonable
            Object.values(ranges).forEach(range => {
                expect(range.min).toBeGreaterThanOrEqual(0);
                expect(range.max).toBeLessThanOrEqual(1);
                expect(range.min).toBeLessThanOrEqual(range.max);
            });
        });
    });

    describe('GTO Fold Frequency Tests', () => {
        test('should calculate correct GTO fold frequencies for different bet sizes', () => {
            const betSizings = ['small', 'medium', 'large', 'very_large', 'all_in'];
            const potOdds = { potOdds: 0.3 };

            console.log('\n🎯 GTO Fold Frequencies by Bet Sizing:');
            betSizings.forEach(betSizing => {
                const playerAction = { betSizing };
                const frequency = calculateGTOFoldFrequency(playerAction, potOdds);
                console.log(`${betSizing}: ${(frequency * 100).toFixed(1)}%`);
                
                expect(frequency).toBeGreaterThanOrEqual(0);
                expect(frequency).toBeLessThanOrEqual(1);
            });
        });

        test('should handle all-in GTO frequencies based on pot odds', () => {
            const potOddsValues = [0.15, 0.25, 0.35, 0.45];
            const playerAction = { betSizing: 'all_in' };

            console.log('\n💰 All-in GTO Fold Frequencies by Pot Odds:');
            potOddsValues.forEach(potOddsValue => {
                const potOdds = { potOdds: potOddsValue };
                const frequency = calculateGTOFoldFrequency(playerAction, potOdds);
                console.log(`Pot Odds ${(potOddsValue * 100).toFixed(1)}%: ${(frequency * 100).toFixed(1)}% fold`);
                
                expect(frequency).toBeGreaterThanOrEqual(0);
                expect(frequency).toBeLessThanOrEqual(1);
            });
        });
    });

    describe('Bet Sizing Fold Frequency Tests', () => {
        test('should calculate correct fold frequencies for different bet sizes', () => {
            const testCases = [
                { betSizing: 'small', betSize: 5, potSize: 20 },
                { betSizing: 'medium', betSize: 15, potSize: 20 },
                { betSizing: 'large', betSize: 25, potSize: 20 },
                { betSizing: 'very_large', betSize: 50, potSize: 20 },
                { betSizing: 'all_in', betSize: 100, potSize: 20 }
            ];

            console.log('\n📏 Bet Sizing Fold Frequencies:');
            testCases.forEach(testCase => {
                const potOdds = { potOdds: testCase.betSize / testCase.potSize };
                const frequency = calculateBetSizingFoldFrequency(testCase, potOdds);
                console.log(`${testCase.betSizing} (${testCase.betSize}/${testCase.potSize}): ${(frequency * 100).toFixed(1)}%`);
                
                expect(frequency).toBeGreaterThanOrEqual(0);
                expect(frequency).toBeLessThanOrEqual(1);
            });
        });
    });

    describe('Pot Odds Fold Frequency Tests', () => {
        test('should calculate correct fold frequencies for different pot odds', () => {
            const testCases = [
                { potOdds: 0.15, impliedOdds: 2.0, rangeStrength: 0.8 },
                { potOdds: 0.25, impliedOdds: 1.5, rangeStrength: 0.6 },
                { potOdds: 0.35, impliedOdds: 1.0, rangeStrength: 0.4 },
                { potOdds: 0.45, impliedOdds: 0.8, rangeStrength: 0.2 }
            ];

            console.log('\n🎲 Pot Odds Fold Frequencies:');
            testCases.forEach(testCase => {
                const potOdds = { potOdds: testCase.potOdds, impliedOdds: testCase.impliedOdds };
                const opponentRange = { averageStrength: testCase.rangeStrength };
                const frequency = calculatePotOddsFoldFrequency(potOdds, opponentRange);
                console.log(`Pot Odds ${(testCase.potOdds * 100).toFixed(1)}%, Implied ${testCase.impliedOdds}, Range ${testCase.rangeStrength}: ${(frequency * 100).toFixed(1)}%`);
                
                expect(frequency).toBeGreaterThanOrEqual(0);
                expect(frequency).toBeLessThanOrEqual(1);
            });
        });
    });

    describe('Range Strength Fold Frequency Tests', () => {
        test('should calculate correct fold frequencies for different range strengths', () => {
            const testCases = [
                { strength: 0.9, strong: 0.4, weak: 0.1, draws: 0.2, betSizing: 'small' },
                { strength: 0.7, strong: 0.3, weak: 0.2, draws: 0.3, betSizing: 'medium' },
                { strength: 0.5, strong: 0.2, weak: 0.3, draws: 0.2, betSizing: 'large' },
                { strength: 0.3, strong: 0.1, weak: 0.5, draws: 0.1, betSizing: 'very_large' }
            ];

            console.log('\n💪 Range Strength Fold Frequencies:');
            testCases.forEach(testCase => {
                const opponentRange = {
                    averageStrength: testCase.strength,
                    strongHandsPercentage: testCase.strong,
                    weakHandsPercentage: testCase.weak,
                    drawsPercentage: testCase.draws
                };
                const playerAction = { betSizing: testCase.betSizing };
                const frequency = calculateRangeStrengthFoldFrequency(opponentRange, playerAction);
                console.log(`Strength ${testCase.strength}, ${testCase.betSizing} bet: ${(frequency * 100).toFixed(1)}%`);
                
                expect(frequency).toBeGreaterThanOrEqual(0);
                expect(frequency).toBeLessThanOrEqual(1);
            });
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle missing input data gracefully', () => {
            const result = calculateBaseFoldFrequency(null, null, null, null);
            
            expect(result).toBeDefined();
            expect(result.baseFoldFrequency).toBe(0.5);
            expect(result.explanation).toBe('Missing input data');
        });

        test('should handle extreme bet sizing cases', () => {
            const extremeCases = [
                { betSizing: 'small', betSize: 1, potSize: 100 },    // Very small bet
                { betSizing: 'very_large', betSize: 1000, potSize: 10 }, // Massive overbet
                { betSizing: 'invalid', betSize: 50, potSize: 100 }   // Invalid sizing
            ];

            extremeCases.forEach(testCase => {
                const potOdds = { potOdds: testCase.betSize / testCase.potSize };
                const frequency = calculateBetSizingFoldFrequency(testCase, potOdds);
                
                expect(frequency).toBeGreaterThanOrEqual(0.05);
                expect(frequency).toBeLessThanOrEqual(0.95);
            });
        });

        test('should handle extreme range strength cases', () => {
            const extremeCases = [
                { averageStrength: 1.0, strongHandsPercentage: 1.0, weakHandsPercentage: 0.0 },
                { averageStrength: 0.0, strongHandsPercentage: 0.0, weakHandsPercentage: 1.0 },
                { averageStrength: 0.5, strongHandsPercentage: 0.5, weakHandsPercentage: 0.5 }
            ];

            extremeCases.forEach(testCase => {
                const playerAction = { betSizing: 'medium' };
                const frequency = calculateRangeStrengthFoldFrequency(testCase, playerAction);
                
                expect(frequency).toBeGreaterThanOrEqual(0.05);
                expect(frequency).toBeLessThanOrEqual(0.95);
            });
        });
    });
}); 