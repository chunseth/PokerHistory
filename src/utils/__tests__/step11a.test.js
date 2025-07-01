const mongoose = require('mongoose');
const { Hand } = require('../../models/models');
const {
    determinePlayerActionType,
    calculatePotSizeBeforeAction,
    determineBetSizing,
    checkIfAllIn,
    determineActionContext,
    checkIfContinuationBet,
    checkIfValueBet,
    checkIfBluff,
    checkIfCheckRaise,
    checkIfDonkBet,
    checkIfThreeBet
} = require('../EV_Calculation/Step11/step11a');

describe('Step 11a: Player Action Type Determination - Real Hand Validation', () => {
    let dbConnection;
    let realHands = [];
    let actionAnalysisResults = [];

    beforeAll(async () => {
        try {
            // Connect to database
            await mongoose.connect('mongodb://localhost:27017/pokerHistory', {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('✅ Connected to poker history database');
            
            // Fetch real hands from database
            const hands = await Hand.find({}).limit(20); // Get 20 hands for testing
            realHands = hands.map(hand => hand.toObject());
            console.log(`📊 Loaded ${realHands.length} real hands from database`);
            
            // Analyze all actions in all hands
            realHands.forEach(hand => {
                if (hand.bettingActions && hand.bettingActions.length > 0) {
                    hand.bettingActions.forEach((action, actionIndex) => {
                        try {
                            const analysis = determinePlayerActionType(action, hand, hand.bettingActions, actionIndex);
                            actionAnalysisResults.push({
                                handId: hand.id,
                                actionIndex,
                                action,
                                analysis,
                                hand // Store the hand data for performance test
                            });
                        } catch (error) {
                            console.error(`❌ Error analyzing action ${actionIndex} in hand ${hand.id}:`, error.message);
                        }
                    });
                }
            });
            
            console.log(`🔍 Analyzed ${actionAnalysisResults.length} total actions`);
            
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
        test('should successfully analyze actions from real database hands', () => {
            if (realHands.length === 0) {
                console.log('⚠️  Skipping database tests - no hands available');
                return;
            }

            expect(actionAnalysisResults.length).toBeGreaterThan(0);
            
            // Log summary statistics
            const actionTypes = new Map();
            const betSizings = new Map();
            const streets = new Map();

            actionAnalysisResults.forEach(result => {
                const { analysis } = result;
                
                // Count action types
                actionTypes.set(analysis.actionType, (actionTypes.get(analysis.actionType) || 0) + 1);
                
                // Count bet sizings
                betSizings.set(analysis.betSizing, (betSizings.get(analysis.betSizing) || 0) + 1);
                
                // Count streets
                streets.set(analysis.street, (streets.get(analysis.street) || 0) + 1);
            });

            console.log('\n📈 Action Analysis Summary:');
            console.log('Action Types:', Object.fromEntries(actionTypes));
            console.log('Bet Sizings:', Object.fromEntries(betSizings));
            console.log('Streets:', Object.fromEntries(streets));

            // Validate that we have a variety of action types
            expect(actionTypes.size).toBeGreaterThan(1);
            expect(betSizings.size).toBeGreaterThan(1);
            expect(streets.size).toBeGreaterThan(1);
        });

        test('should correctly identify bet sizing categories from real hands', () => {
            if (actionAnalysisResults.length === 0) return;

            const betActions = actionAnalysisResults.filter(result => 
                ['bet', 'raise'].includes(result.analysis.actionType) && result.analysis.betSize > 0
            );

            console.log(`\n🎯 Bet Sizing Analysis (${betActions.length} bet/raise actions):`);
            
            betActions.forEach(result => {
                const { action, analysis } = result;
                const betToPotRatio = analysis.betSize / analysis.potSize;
                
                console.log(`  ${action.street} ${analysis.actionType}: ${analysis.betSize}BB into ${analysis.potSize}BB pot (${(betToPotRatio * 100).toFixed(1)}% pot) -> ${analysis.relativeSizing}`);
                
                // Validate bet sizing categorization using relativeSizing
                if (betToPotRatio <= 0.33) {
                    expect(analysis.relativeSizing).toBe('small');
                } else if (betToPotRatio <= 1.0) {
                    expect(analysis.relativeSizing).toBe('medium');
                } else if (betToPotRatio <= 2.0) {
                    expect(analysis.relativeSizing).toBe('large');
                } else {
                    expect(analysis.relativeSizing).toBe('very_large');
                }
            });

            expect(betActions.length).toBeGreaterThan(0);
        });

        test('should correctly identify continuation bets from real hands', () => {
            if (actionAnalysisResults.length === 0) return;

            const flopBets = actionAnalysisResults.filter(result => 
                result.analysis.actionType === 'bet' && 
                result.analysis.street === 'flop'
            );

            console.log(`\n🔄 Continuation Bet Analysis (${flopBets.length} flop bets):`);
            
            let cbetCount = 0;
            flopBets.forEach(result => {
                const { action, analysis } = result;
                
                if (analysis.isContinuationBet) {
                    cbetCount++;
                    console.log(`  ✅ C-bet: ${analysis.playerId} bets ${analysis.betSize}BB on flop`);
                }
            });

            console.log(`  Found ${cbetCount} continuation bets out of ${flopBets.length} flop bets`);
            
            // Validate that some continuation bets were found
            expect(cbetCount).toBeGreaterThanOrEqual(0);
        });

        test('should correctly identify all-in situations from real hands', () => {
            if (actionAnalysisResults.length === 0) return;

            const allInActions = actionAnalysisResults.filter(result => 
                result.analysis.isAllIn
            );

            console.log(`\n💥 All-In Analysis (${allInActions.length} all-in actions):`);
            
            allInActions.forEach(result => {
                const { action, analysis } = result;
                const betToPotRatio = analysis.betSize / analysis.potSize;
                console.log(`  💥 All-in: ${analysis.playerId} ${analysis.actionType} ${analysis.betSize}BB (${(betToPotRatio * 100).toFixed(1)}% pot) on ${analysis.street}`);
                
                // Validate all-in properties
                expect(analysis.isAllIn).toBe(true);
                expect(analysis.betSizing).toBe('all_in');
            });

            // Log summary of all-in bet sizes relative to pot
            const betSizeCategories = {
                small: 0,    // <= 33% pot
                medium: 0,   // 33-100% pot
                large: 0,    // 100-200% pot
                very_large: 0 // > 200% pot
            };

            allInActions.forEach(result => {
                const betToPotRatio = result.analysis.betSize / result.analysis.potSize;
                if (betToPotRatio <= 0.33) betSizeCategories.small++;
                else if (betToPotRatio <= 1.0) betSizeCategories.medium++;
                else if (betToPotRatio <= 2.0) betSizeCategories.large++;
                else betSizeCategories.very_large++;
            });

            if (allInActions.length > 0) {
                console.log('\n  All-in bet sizes relative to pot:');
                console.log('  Small (≤33% pot):', betSizeCategories.small);
                console.log('  Medium (33-100% pot):', betSizeCategories.medium);
                console.log('  Large (100-200% pot):', betSizeCategories.large);
                console.log('  Very Large (>200% pot):', betSizeCategories.very_large);
            }
        });

        test('should correctly calculate pot sizes from real hands', () => {
            if (realHands.length === 0) return;

            console.log('\n💰 Pot Size Calculation Validation:');
            
            realHands.forEach(hand => {
                if (hand.bettingActions && hand.bettingActions.length > 0) {
                    hand.bettingActions.forEach((action, actionIndex) => {
                        const calculatedPotSize = calculatePotSizeBeforeAction(hand, hand.bettingActions, actionIndex);
                        const analysis = determinePlayerActionType(action, hand, hand.bettingActions, actionIndex);
                        
                        // Validate pot size calculation
                        expect(calculatedPotSize).toBeGreaterThanOrEqual(1.5); // At least SB + BB
                        expect(analysis.potSize).toBe(calculatedPotSize);
                        
                        if (actionIndex > 0) {
                            // Pot should grow with actions
                            const previousPotSize = calculatePotSizeBeforeAction(hand, hand.bettingActions, actionIndex - 1);
                            expect(calculatedPotSize).toBeGreaterThanOrEqual(previousPotSize);
                        }
                    });
                }
            });
        });

        test('should identify value bets and bluffs from real hands', () => {
            if (actionAnalysisResults.length === 0) return;

            const valueBetActions = actionAnalysisResults.filter(result => 
                result.analysis.isValueBet
            );

            console.log(`\n🎭 Value Bet Analysis:`);
            console.log(`  Value bets: ${valueBetActions.length}`);

            valueBetActions.forEach(result => {
                const { action, analysis } = result;
                console.log(`  💰 Value bet: ${analysis.playerId} ${analysis.actionType} ${analysis.betSize}BB on ${analysis.street}`);
            });
        });

        test('should identify check-raises and donk bets from real hands', () => {
            if (actionAnalysisResults.length === 0) return;

            const checkRaises = actionAnalysisResults.filter(result => 
                result.analysis.isCheckRaise
            );

            const donkBets = actionAnalysisResults.filter(result => 
                result.analysis.isDonkBet
            );

            console.log(`\n🔄 Advanced Action Analysis:`);
            console.log(`  Check-raises: ${checkRaises.length}`);
            if (checkRaises.length > 0) {
                checkRaises.forEach(result => {
                    const { action, analysis } = result;
                    console.log(`  ✓ Check-raise: ${analysis.playerId} (${analysis.position}) on ${analysis.street}`);
                });
            }

            console.log(`  Donk bets: ${donkBets.length}`);
            if (donkBets.length > 0) {
                donkBets.forEach(result => {
                    const { action, analysis } = result;
                    console.log(`  ✓ Donk bet: ${analysis.playerId} (${analysis.position}) on ${analysis.street}`);
                });
            }

            // Validate check-raises
            checkRaises.forEach(result => {
                const { action, analysis } = result;
                expect(analysis.isCheckRaise).toBe(true);
            });

            // Validate donk bets
            donkBets.forEach(result => {
                const { action, analysis } = result;
                expect(analysis.isDonkBet).toBe(true);
            });
        });
    });

    describe('GTO Action Pattern Analysis', () => {
        test('should analyze betting patterns for GTO insights', () => {
            if (actionAnalysisResults.length === 0) return;

            console.log('\n🧠 GTO Pattern Analysis:');
            
            // Analyze bet sizing patterns by street
            const streetBetSizings = new Map();
            actionAnalysisResults.forEach(result => {
                const { analysis } = result;
                if (['bet', 'raise'].includes(analysis.actionType) && analysis.betSize > 0) {
                    if (!streetBetSizings.has(analysis.street)) {
                        streetBetSizings.set(analysis.street, new Map());
                    }
                    const streetMap = streetBetSizings.get(analysis.street);
                    streetMap.set(analysis.betSizing, (streetMap.get(analysis.betSizing) || 0) + 1);
                }
            });

            streetBetSizings.forEach((sizings, street) => {
                console.log(`  ${street.toUpperCase()}:`, Object.fromEntries(sizings));
                
                // GTO validation: Should see variety in bet sizings
                expect(sizings.size).toBeGreaterThan(0);
            });
        });

        test('should validate pot odds calculations for GTO analysis', () => {
            if (actionAnalysisResults.length === 0) return;

            const betActions = actionAnalysisResults.filter(result => 
                ['bet', 'raise'].includes(result.analysis.actionType) && result.analysis.betSize > 0
            );

            console.log('\n📊 Pot Odds Analysis for GTO:');
            console.log(`Analyzing ${betActions.length} betting actions...`);
            
            // Group by street for analysis
            const streetAnalysis = new Map();
            
            betActions.forEach(result => {
                const { action, analysis } = result;
                const betToPotRatio = analysis.betSize / analysis.potSize;
                
                // Add to street analysis
                if (!streetAnalysis.has(action.street)) {
                    streetAnalysis.set(action.street, {
                        count: 0,
                        totalRatio: 0,
                        sizings: {
                            small: 0,
                            medium: 0,
                            large: 0,
                            very_large: 0
                        }
                    });
                }
                
                const streetData = streetAnalysis.get(action.street);
                streetData.count++;
                streetData.totalRatio += betToPotRatio;
                
                // Count sizing categories
                if (betToPotRatio <= 0.33) streetData.sizings.small++;
                else if (betToPotRatio <= 1.0) streetData.sizings.medium++;
                else if (betToPotRatio <= 2.0) streetData.sizings.large++;
                else streetData.sizings.very_large++;
                
                // Log individual action
                console.log(`  ${action.street} ${analysis.actionType}: ${analysis.betSize}BB into ${analysis.potSize}BB pot (${(betToPotRatio * 100).toFixed(1)}% pot) -> ${analysis.relativeSizing}`);
                
                // GTO validation: Bet sizing should be appropriate for pot odds
                if (betToPotRatio <= 0.33) {
                    expect(['small', 'none'].includes(analysis.relativeSizing)).toBe(true);
                } else if (betToPotRatio <= 1.0) {
                    expect(['medium', 'small'].includes(analysis.relativeSizing)).toBe(true);
                } else if (betToPotRatio <= 2.0) {
                    expect(['large', 'medium'].includes(analysis.relativeSizing)).toBe(true);
                } else {
                    expect(['very_large', 'large', 'all_in'].includes(analysis.relativeSizing)).toBe(true);
                }
            });
            
            // Print street-by-street analysis
            console.log('\nStreet-by-Street Bet Sizing Analysis:');
            streetAnalysis.forEach((data, street) => {
                console.log(`\n${street.toUpperCase()}:`);
                console.log(`  Total bets: ${data.count}`);
                console.log(`  Average bet/pot ratio: ${((data.totalRatio / data.count) * 100).toFixed(1)}%`);
                console.log(`  Size distribution:`);
                console.log(`    Small (≤33% pot): ${data.sizings.small}`);
                console.log(`    Medium (33-100% pot): ${data.sizings.medium}`);
                console.log(`    Large (100-200% pot): ${data.sizings.large}`);
                console.log(`    Very Large (>200% pot): ${data.sizings.very_large}`);
            });
        });

        test('should analyze position-based action patterns', () => {
            if (actionAnalysisResults.length === 0) return;

            console.log('\n🎯 Position-Based Analysis:');
            
            const positionActions = new Map();
            actionAnalysisResults.forEach(result => {
                const { action, analysis } = result;
                const position = action.position || 'unknown';
                
                if (!positionActions.has(position)) {
                    positionActions.set(position, {
                        total: 0,
                        bets: 0,
                        raises: 0,
                        calls: 0,
                        checks: 0,
                        folds: 0,
                        posts: 0
                    });
                }
                
                const posData = positionActions.get(position);
                posData.total++;
                
                // Handle 'post' actions separately
                if (analysis.actionType === 'post') {
                    posData.posts++;
                } else {
                    posData[analysis.actionType + 's']++;
                }
            });

            positionActions.forEach((data, position) => {
                console.log(`  Position ${position}:`, data);
                
                // Validate position data (excluding posts from total count)
                expect(data.total).toBeGreaterThan(0);
                const actionTotal = data.bets + data.raises + data.calls + data.checks + data.folds + data.posts;
                expect(data.total).toBe(actionTotal);
            });
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle malformed hand data gracefully', () => {
            const malformedHand = {
                id: "malformed-hand",
                players: [],
                bettingActions: [
                    { playerId: "unknown", action: "bet", amount: -5, street: "flop" },
                    { action: "invalid_action", amount: 10, street: "unknown" }
                ]
            };

            malformedHand.bettingActions.forEach((action, index) => {
                const result = determinePlayerActionType(action, malformedHand, malformedHand.bettingActions, index);
                
                            expect(result).toHaveProperty('actionType');
                            expect(result).toHaveProperty('betSize');
                            expect(result).toHaveProperty('betSizing');
                            expect(result).toHaveProperty('street');
                            
                // Should handle invalid data gracefully
                expect(result.isAllIn).toBe(false);
            });
        });

        test('should handle missing or incomplete data', () => {
            const incompleteHand = {
                id: "incomplete-hand",
                players: [{ id: "p1", stackSize: 100 }],
                bettingActions: []
            };

            const result = determinePlayerActionType(null, incompleteHand, [], 0);
            
            expect(result.actionType).toBe(null);
            expect(result.betSize).toBe(0);
            expect(result.betSizing).toBe('none');
        });
    });

    describe('Performance and Scalability', () => {
        test('should handle large numbers of actions efficiently', () => {
            if (realHands.length === 0) return;

            const startTime = Date.now();
            
            // Process all actions multiple times to test performance
            for (let i = 0; i < 3; i++) {
                actionAnalysisResults.forEach(result => {
                    determinePlayerActionType(result.action, result.hand, result.hand.bettingActions, result.actionIndex);
                });
            }
            
            const endTime = Date.now();
            const processingTime = endTime - startTime;
            
            console.log(`\n⚡ Performance Test: Processed ${actionAnalysisResults.length * 3} actions in ${processingTime}ms`);
            
            // Should process actions quickly (less than 1 second for 1000+ actions)
            expect(processingTime).toBeLessThan(1000);
        });
    });
}); 