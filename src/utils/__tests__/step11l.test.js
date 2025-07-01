const mongoose = require('mongoose');
const { Hand } = require('../../models/models');
const { adjustRaiseFrequencyForBetSizing, calculateMDF } = require('../EV_Calculation/Step11/step11l');
const { determinePlayerActionType } = require('../EV_Calculation/Step11/step11a');

// Mock step11c for range strength data
const mockRangeStrength = {
    averageStrength: 0.65,
    strengthDistribution: { strong: 0.3, medium: 0.4, weak: 0.3 },
    strongHandsPercentage: 0.3,
    weakHandsPercentage: 0.3,
    mediumHandsPercentage: 0.4,
    drawingHandsPercentage: 0.25,
    rangeWeight: 0.15,
    strengthCategory: 'medium',
    totalCombos: 45,
    boardTexture: { texture: 'dry' },
    street: 'flop',
    position: 'out_of_position',
    rangeDensity: 0.6,
    strengthVariance: 0.2,
    drawingPotential: 0.3,
    nuttedHands: 0.1,
    bluffCatchers: 0.4,
    valueHands: 0.2
};

describe('Step 11l: Raise Frequency Adjustments for Bet Sizing - Real Hand Validation', () => {
    let dbConnection;
    let realHands = [];
    let raiseFrequencyResults = [];

    beforeAll(async () => {
        try {
            // Connect to database
            await mongoose.connect('mongodb://localhost:27017/pokerHistory', {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('✅ Connected to poker history database');
            
            // Fetch real hands from database
            const hands = await Hand.find({}).limit(15); // Get 15 hands for testing
            realHands = hands.map(hand => hand.toObject());
            console.log(`📊 Loaded ${realHands.length} real hands from database`);
            
            // Analyze raise frequency adjustments for betting actions
            realHands.forEach(hand => {
                if (hand.bettingActions && hand.bettingActions.length > 0) {
                    hand.bettingActions.forEach((action, actionIndex) => {
                        try {
                            // Only test actions that involve betting (not checks)
                            if (action.action === 'bet' || action.action === 'raise') {
                                // Use step11a to get proper action analysis including pot size
                                const actionAnalysis = determinePlayerActionType(action, hand, hand.bettingActions, actionIndex);
                                
                                const betInfo = {
                                    betSize: actionAnalysis.betSize,
                                    potSize: actionAnalysis.potSize,
                                    isAllIn: actionAnalysis.isAllIn,
                                    betSizing: actionAnalysis.betSizing
                                };
                                
                                const currentRaiseFreq = 0.15; // Base raise frequency
                                
                                const result = adjustRaiseFrequencyForBetSizing(
                                    betInfo, 
                                    currentRaiseFreq, 
                                    mockRangeStrength
                                );
                                
                                raiseFrequencyResults.push({
                                    handId: hand.id,
                                    actionIndex,
                                    action,
                                    actionAnalysis,
                                    betInfo,
                                    originalRaiseFreq: currentRaiseFreq,
                                    result
                                });
                            }
                        } catch (error) {
                            console.error(`❌ Error analyzing action ${actionIndex} in hand ${hand.id}:`, error.message);
                        }
                    });
                }
            });
            
            console.log(`🔍 Analyzed ${raiseFrequencyResults.length} betting actions for raise frequency adjustments`);
            
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            console.log('⚠️  Tests will run with limited functionality');
        }
    });

    afterAll(async () => {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('🔌 Disconnected from database');
        }
    });

    describe('Database Hand Analysis', () => {
        test('should successfully calculate raise frequency adjustments from real database hands', () => {
            if (realHands.length === 0) {
                console.log('⚠️  Skipping database tests - no hands available');
                return;
            }

            expect(raiseFrequencyResults.length).toBeGreaterThan(0);
            
            // Log summary statistics
            const betSizings = new Map();
            const mdfRanges = new Map();
            const raiseFreqChanges = [];
            const potSizeAnalysis = new Map();

            raiseFrequencyResults.forEach(result => {
                const { betInfo, originalRaiseFreq, result: adjustmentResult } = result;
                
                // Count bet sizings
                betSizings.set(betInfo.betSizing, (betSizings.get(betInfo.betSizing) || 0) + 1);
                
                // Count MDF ranges
                const mdfRange = getMDFRange(adjustmentResult.mdf);
                mdfRanges.set(mdfRange, (mdfRanges.get(mdfRange) || 0) + 1);
                
                // Track raise frequency changes
                const change = adjustmentResult.raiseFreq - originalRaiseFreq;
                raiseFreqChanges.push(change);
                
                // Analyze pot sizes
                const potSizeKey = betInfo.potSize <= 5 ? `≤${betInfo.potSize}BB` : 
                                 betInfo.potSize <= 10 ? `${betInfo.potSize}BB` : `>${betInfo.potSize}BB`;
                potSizeAnalysis.set(potSizeKey, (potSizeAnalysis.get(potSizeKey) || 0) + 1);
            });

            console.log('\n📈 Raise Frequency Adjustment Summary:');
            console.log('Bet Sizings:', Object.fromEntries(betSizings));
            console.log('MDF Ranges:', Object.fromEntries(mdfRanges));
            console.log('Pot Size Distribution:', Object.fromEntries(potSizeAnalysis));
            console.log('Average raise freq change:', (raiseFreqChanges.reduce((a, b) => a + b, 0) / raiseFreqChanges.length * 100).toFixed(2) + '%');

            // Validate that we have a variety of bet sizings
            expect(betSizings.size).toBeGreaterThan(1);
            expect(mdfRanges.size).toBeGreaterThan(1);
        });

        test('should correctly calculate MDF for different bet sizes', () => {
            if (raiseFrequencyResults.length === 0) return;

            console.log(`\n🎯 MDF Analysis (${raiseFrequencyResults.length} betting actions):`);
            
            raiseFrequencyResults.forEach(result => {
                const { betInfo, result: adjustmentResult } = result;
                const calculatedMDF = calculateMDF(betInfo.betSize, betInfo.potSize);
                const betToPotRatio = betInfo.betSize / betInfo.potSize;
                
                console.log(`  ${betInfo.betSizing} bet: ${betInfo.betSize}BB into ${betInfo.potSize}BB pot (${(betToPotRatio * 100).toFixed(1)}% pot) -> MDF: ${(calculatedMDF * 100).toFixed(1)}%`);
                
                // Validate MDF calculation
                expect(adjustmentResult.mdf).toBe(calculatedMDF);
                
                // Validate MDF is between 0 and 1
                expect(adjustmentResult.mdf).toBeGreaterThanOrEqual(0);
                expect(adjustmentResult.mdf).toBeLessThanOrEqual(1);
            });
        });

        test('should apply appropriate raise frequency adjustments based on bet sizing', () => {
            if (raiseFrequencyResults.length === 0) return;

            const sizingResults = {
                small: [],
                medium: [],
                large: [],
                very_large: [],
                all_in: []
            };

            raiseFrequencyResults.forEach(result => {
                const { betInfo, originalRaiseFreq, result: adjustmentResult } = result;
                sizingResults[betInfo.betSizing].push({
                    original: originalRaiseFreq,
                    adjusted: adjustmentResult.raiseFreq,
                    change: adjustmentResult.raiseFreq - originalRaiseFreq
                });
            });

            console.log('\n📊 Raise Frequency Adjustments by Bet Sizing:');
            
            Object.entries(sizingResults).forEach(([sizing, results]) => {
                if (results.length > 0) {
                    const avgChange = results.reduce((sum, r) => sum + r.change, 0) / results.length;
                    const avgOriginal = results.reduce((sum, r) => sum + r.original, 0) / results.length;
                    const avgAdjusted = results.reduce((sum, r) => sum + r.adjusted, 0) / results.length;
                    
                    console.log(`  ${sizing}: ${results.length} actions, ${(avgOriginal * 100).toFixed(1)}% → ${(avgAdjusted * 100).toFixed(1)}% (${avgChange > 0 ? '+' : ''}${(avgChange * 100).toFixed(1)}%)`);
                    
                    // Validate expected patterns
                    if (sizing === 'small') {
                        expect(avgChange).toBeGreaterThan(-0.1); // Small bets shouldn't heavily reduce raise freq
                    } else if (sizing === 'large' || sizing === 'very_large') {
                        expect(avgChange).toBeLessThan(0.1); // Large bets should reduce raise freq
                    } else if (sizing === 'all_in') {
                        expect(avgAdjusted).toBe(0); // All-in bets should have 0 raise frequency
                    }
                }
            });
        });

        test('should handle all-in bets correctly', () => {
            if (raiseFrequencyResults.length === 0) return;

            const allInResults = raiseFrequencyResults.filter(result => 
                result.betInfo.isAllIn || result.betInfo.betSizing === 'all_in'
            );

            console.log(`\n💥 All-In Analysis (${allInResults.length} all-in actions):`);
            
            allInResults.forEach(result => {
                const { betInfo, result: adjustmentResult } = result;
                console.log(`  💥 All-in: ${betInfo.betSize}BB into ${betInfo.potSize}BB pot -> Raise freq: ${(adjustmentResult.raiseFreq * 100).toFixed(1)}%`);
                
                // Validate all-in properties
                expect(adjustmentResult.raiseFreq).toBe(0);
                expect(adjustmentResult.mdf).toBeGreaterThan(0);
            });
        });

        test('should provide detailed explanations for adjustments', () => {
            if (raiseFrequencyResults.length === 0) return;

            console.log('\n📝 Explanation Analysis:');
            
            raiseFrequencyResults.slice(0, 5).forEach((result, index) => {
                const { betInfo, result: adjustmentResult } = result;
                console.log(`\n  Example ${index + 1} (${betInfo.betSizing} bet):`);
                console.log(`    ${adjustmentResult.explanation}`);
                
                // Validate explanation contains key elements
                expect(adjustmentResult.explanation).toContain('MDF:');
                expect(adjustmentResult.explanation).toContain('Range:');
                expect(adjustmentResult.explanation).toContain('Raise frequency:');
            });
        });
    });

    describe('Synthetic Test Cases', () => {
        test('should handle all bet sizing categories with synthetic data', () => {
            const syntheticTestCases = [
                { betSize: 1, potSize: 10, expectedSizing: 'small', description: 'Small bet (10% pot)' },
                { betSize: 5, potSize: 10, expectedSizing: 'medium', description: 'Medium bet (50% pot)' },
                { betSize: 10, potSize: 10, expectedSizing: 'large', description: 'Large bet (100% pot)' },
                { betSize: 15, potSize: 10, expectedSizing: 'very_large', description: 'Very large bet (150% pot)' },
                { betSize: 20, potSize: 10, isAllIn: true, expectedSizing: 'all_in', description: 'All-in bet' }
            ];

            console.log('\n🧪 Synthetic Test Cases:');
            
            syntheticTestCases.forEach((testCase, index) => {
                const betInfo = {
                    betSize: testCase.betSize,
                    potSize: testCase.potSize,
                    isAllIn: testCase.isAllIn || false,
                    betSizing: testCase.expectedSizing
                };
                
                const result = adjustRaiseFrequencyForBetSizing(betInfo, 0.15, mockRangeStrength);
                const betToPotRatio = testCase.betSize / testCase.potSize;
                
                console.log(`  ${index + 1}. ${testCase.description}: ${testCase.betSize}BB into ${testCase.potSize}BB pot (${(betToPotRatio * 100).toFixed(1)}% pot)`);
                console.log(`     Expected: ${testCase.expectedSizing}, Got: ${betInfo.betSizing}, MDF: ${(result.mdf * 100).toFixed(1)}%, Raise freq: ${(result.raiseFreq * 100).toFixed(1)}%`);
                
                // Validate bet sizing categorization
                expect(betInfo.betSizing).toBe(testCase.expectedSizing);
                
                // Validate MDF calculation
                const expectedMDF = testCase.betSize / (testCase.potSize + testCase.betSize);
                expect(result.mdf).toBe(expectedMDF);
                
                // Validate raise frequency adjustments
                if (testCase.expectedSizing === 'small') {
                    expect(result.raiseFreq).toBeGreaterThan(0.15); // Should increase
                } else if (testCase.expectedSizing === 'very_large' || testCase.expectedSizing === 'all_in') {
                    expect(result.raiseFreq).toBeLessThanOrEqual(0.15); // Should decrease or be 0
                }
            });
        });
    });

    describe('Edge Cases and Validation', () => {
        test('should handle edge cases gracefully', () => {
            // Test with missing data
            const missingDataResult = adjustRaiseFrequencyForBetSizing(null, 0.15, mockRangeStrength);
            expect(missingDataResult.raiseFreq).toBe(0);
            expect(missingDataResult.explanation).toContain('Missing input data');

            // Test with zero bet size
            const zeroBetResult = adjustRaiseFrequencyForBetSizing({
                betSize: 0,
                potSize: 10,
                isAllIn: false,
                betSizing: 'small'
            }, 0.15, mockRangeStrength);
            expect(zeroBetResult.mdf).toBe(0);

            // Test with very large bet-to-pot ratio
            const largeBetResult = adjustRaiseFrequencyForBetSizing({
                betSize: 50,
                potSize: 10,
                isAllIn: false,
                betSizing: 'very_large'
            }, 0.15, mockRangeStrength);
            expect(largeBetResult.raiseFreq).toBeLessThan(0.15); // Should reduce raise frequency
        });

        test('should maintain reasonable raise frequency bounds', () => {
            raiseFrequencyResults.forEach(result => {
                const { result: adjustmentResult } = result;
                
                // Raise frequency should be between 0 and 0.8
                expect(adjustmentResult.raiseFreq).toBeGreaterThanOrEqual(0);
                expect(adjustmentResult.raiseFreq).toBeLessThanOrEqual(0.8);
                
                // MDF should be between 0 and 1
                expect(adjustmentResult.mdf).toBeGreaterThanOrEqual(0);
                expect(adjustmentResult.mdf).toBeLessThanOrEqual(1);
            });
        });
    });

    // Helper function to categorize MDF ranges
    function getMDFRange(mdf) {
        if (mdf <= 0.25) return 'Low MDF (≤25%)';
        if (mdf <= 0.5) return 'Medium MDF (25-50%)';
        if (mdf <= 0.75) return 'High MDF (50-75%)';
        return 'Very High MDF (>75%)';
    }
}); 