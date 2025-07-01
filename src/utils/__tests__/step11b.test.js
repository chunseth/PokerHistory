const mongoose = require('mongoose');
const { Hand } = require('../../models/models');
const {
    calculatePotOddsForOpponent,
    calculateBasicPotOdds,
    calculateImpliedOdds,
    calculateReverseImpliedOdds,
    calculateMinimumEquity,
    arePotOddsFavorable
} = require('../EV_Calculation/Step11/step11b');
const { calculatePotSizeBeforeAction, determineBetSizing, checkIfAllIn, determinePlayerActionType } = require('../EV_Calculation/Step11/step11a');

describe('Step 11b: Pot Odds Analysis - Real Hand Validation', () => {
    let realHands = [];
    let potOddsResults = [];

    beforeAll(async () => {
        try {
            // Connect to database
            await mongoose.connect('mongodb://localhost:27017/pokerHistory', {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('✅ Connected to poker history database');
            
            // Fetch real hands from database
            const hands = await Hand.find({}).limit(100); // Get 100 hands for testing
            realHands = hands.map(hand => hand.toObject());
            console.log(`📊 Loaded ${realHands.length} real hands from database`);
            
            // Debug: Show structure of first hand
            if (realHands.length > 0) {
                const firstHand = realHands[0];
                console.log('\n🔍 DEBUG: First hand structure:');
                console.log('Hand ID:', firstHand.id);
                console.log('All fields:', Object.keys(firstHand));
                console.log('Players field:', firstHand.players);
                console.log('Players type:', typeof firstHand.players);
                console.log('BettingActions length:', firstHand.bettingActions ? firstHand.bettingActions.length : 'undefined');
                if (firstHand.bettingActions && firstHand.bettingActions.length > 0) {
                    console.log('First betting action:', firstHand.bettingActions[0]);
                }
            }
            
            realHands.forEach(hand => {
                if (hand.bettingActions && hand.bettingActions.length > 0) {
                    // Extract unique players from betting actions
                    const players = new Set();
                    hand.bettingActions.forEach(action => {
                        if (action.playerIndex !== undefined) {
                            players.add(action.playerIndex);
                        }
                    });
                    
                    // Track folded players by playerIndex
                    const foldedPlayers = new Set();
                    hand.bettingActions.forEach((action, actionIndex) => {
                        if (action.action === 'fold') {
                            foldedPlayers.add(action.playerIndex);
                        }
                        if (['bet', 'raise'].includes(action.action)) {
                            // Calculate pot size before this action
                            const potSize = calculatePotSizeBeforeAction(hand, hand.bettingActions, actionIndex);
                            
                            // Analyze the action using step11a
                            const playerAction = determinePlayerActionType(action, hand, hand.bettingActions, actionIndex);
                            
                            // Find all players who are still active and not the bettor
                            const activePlayers = Array.from(players).filter(playerIndex => 
                                !foldedPlayers.has(playerIndex) && 
                                playerIndex !== action.playerIndex
                            );
                            
                            console.log(`\nDEBUG: hand ${hand.id}, actionIndex ${actionIndex}, action:`, action);
                            console.log('  playerAction:', playerAction);
                            console.log('  activePlayers:', activePlayers);
                            console.log('  foldedPlayers:', Array.from(foldedPlayers));
                            console.log('  all players:', Array.from(players));
                            console.log('  raiser:', action.playerIndex); // Log the raiser explicitly
                            
                            // Calculate pot odds for each active player
                            activePlayers.forEach(playerIndex => {
                                // Build playerAction for this context
                                const pa = {
                                    actionType: action.action,
                                    betSize: action.amount || 0,
                                    potSize: potSize, // Use calculated pot size
                                    betSizing: determineBetSizing(action.amount || 0, potSize, checkIfAllIn(action)),
                                    isAllIn: checkIfAllIn(action),
                                    street: action.street,
                                    position: `Player${playerIndex}`
                                };
                                
                                const potOdds = calculatePotOddsForOpponent(
                                    pa,
                                    hand,
                                    hand.bettingActions,
                                    actionIndex,
                                    `Player${playerIndex}`
                                );
                                
                                // Debug log with pot size
                                console.log(`    Facing player: Player${playerIndex}, callAmount=${potOdds.callAmount}, potSize=${potSize}, street=${action.street}`);
                                
                                potOddsResults.push({
                                    handId: hand.id,
                                    actionIndex,
                                    action,
                                    opponentId: `Player${playerIndex}`,
                                    potOdds: {
                                        ...potOdds,
                                        potSize: potSize
                                    }
                                });
                            });
                        }
                    });
                }
            });
            // Print summary of all nonzero callAmounts
            const nonzeroCalls = potOddsResults.filter(r => r.potOdds.callAmount > 0);
            console.log(`\nSUMMARY: Found ${nonzeroCalls.length} actions with callAmount > 0`);
            nonzeroCalls.forEach(r => {
                console.log(`  hand ${r.handId}, action ${r.actionIndex}, opponent ${r.opponentId}, callAmount=${r.potOdds.callAmount}, potSize=${r.potOdds.potSize}, street=${r.potOdds.street}`);
            });
            
            console.log(`🔍 Analyzed pot odds for ${potOddsResults.length} bet/raise facing actions`);
            
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

    describe('Database Hand Pot Odds Analysis', () => {
        test('should successfully calculate pot odds from real database hands', () => {
            if (realHands.length === 0) {
                console.log('⚠️  Skipping database tests - no hands available');
                return;
            }

            expect(potOddsResults.length).toBeGreaterThan(0);
            
            const potOddsRanges = new Map();
            const stackToPotRanges = new Map();

            potOddsResults.forEach(result => {
                const { potOdds } = result;
                
                // Categorize pot odds ranges based on the actual values we see
                const potOddsRatio = potOdds.potOddsRatio || potOdds.potOdds || 0;
                if (potOddsRatio <= 0.3) {
                    potOddsRanges.set('low', (potOddsRanges.get('low') || 0) + 1);
                } else if (potOddsRatio <= 0.6) {
                    potOddsRanges.set('medium', (potOddsRanges.get('medium') || 0) + 1);
                } else {
                    potOddsRanges.set('high', (potOddsRanges.get('high') || 0) + 1);
                }
                
                // Categorize stack-to-pot ratios (since we don't have stack data, all will be low)
                stackToPotRanges.set('low', (stackToPotRanges.get('low') || 0) + 1);
            });

            console.log('\n📈 Pot Odds Analysis Summary:');
            console.log('Pot Odds Ranges:', Object.fromEntries(potOddsRanges));
            console.log('Stack-to-Pot Ranges:', Object.fromEntries(stackToPotRanges));

            // Validate that we have a variety of pot odds ranges
            expect(potOddsRanges.size).toBeGreaterThan(1);
            // Note: Stack-to-pot ranges will all be "low" since we don't have stack size data
            expect(stackToPotRanges.size).toBeGreaterThanOrEqual(1);
        });

        test('should correctly calculate pot odds ratios from real hands', () => {
            if (potOddsResults.length === 0) return;

            console.log(`\n💰 Pot Odds Ratio Analysis (${potOddsResults.length} actions):`);
            
            potOddsResults.forEach(result => {
                const { action, potOdds } = result;
                
                console.log(`  ${action.street} ${action.action}: ${action.amount}BB call -> ${(potOdds.potOdds * 100).toFixed(1)}% pot odds`);
                
                expect(potOdds.potOdds).toBeGreaterThanOrEqual(0);
                expect(potOdds.callAmount).toBeGreaterThanOrEqual(0);
                expect(potOdds.effectiveStack).toBeGreaterThanOrEqual(0);
            });
        });

        test('should correctly calculate implied odds from real hands', () => {
            if (potOddsResults.length === 0) return;

            console.log(`\n🎯 Implied Odds Analysis (${potOddsResults.length} actions):`);
            
            potOddsResults.forEach(result => {
                const { action, potOdds } = result;
                
                console.log(`  ${action.street} ${action.action}: ${potOdds.impliedOdds.toFixed(2)}x implied odds, ${potOdds.reverseImpliedOdds.toFixed(2)}x reverse implied odds`);
                
                expect(potOdds.impliedOdds).toBeGreaterThan(0);
                expect(potOdds.reverseImpliedOdds).toBeGreaterThan(0);
            });
        });
    });

    describe('GTO Pot Odds Pattern Analysis', () => {
        test('should analyze pot odds patterns by street for GTO insights', () => {
            if (potOddsResults.length === 0) return;

            console.log('\n🧠 GTO Pot Odds Pattern Analysis:');
            
            const streetPotOdds = new Map();
            potOddsResults.forEach(result => {
                const { action, potOdds } = result;
                const street = action.street;
                
                if (!streetPotOdds.has(street)) {
                    streetPotOdds.set(street, {
                        total: 0,
                        avgPotOdds: 0,
                        totalPotOdds: 0
                    });
                }
                
                const streetData = streetPotOdds.get(street);
                streetData.total++;
                streetData.totalPotOdds += potOdds.potOdds;
                streetData.avgPotOdds = streetData.totalPotOdds / streetData.total;
            });

            streetPotOdds.forEach((data, street) => {
                console.log(`  ${street.toUpperCase()}: ${data.total} actions, avg pot odds: ${(data.avgPotOdds * 100).toFixed(1)}%`);
                expect(data.total).toBeGreaterThan(0);
                expect(data.avgPotOdds).toBeGreaterThan(0);
            });
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle edge case pot odds calculations', () => {
            const smallBetHand = {
                players: [{ id: "p1", stackSize: 100 }],
                bettingActions: [
                    { playerId: "p1", action: "bet", amount: 0.5, street: "flop" }
                ]
            };
            
            const playerAction = {
                actionType: "bet",
                betSize: 0.5,
                potSize: 10,
                betSizing: "small",
                isAllIn: false,
                street: "flop",
                position: 0
            };
            
            const potOdds = calculatePotOddsForOpponent(playerAction, smallBetHand, smallBetHand.bettingActions, 0, "p1");
            expect(potOdds.potOdds).toBeGreaterThan(0);
            expect(potOdds.callAmount).toBe(0.5);
        });

        test('should handle missing or invalid data gracefully', () => {
            const result = calculatePotOddsForOpponent(null, null, [], 0, null);
            expect(result.potOdds).toBe(0);
            expect(result.callAmount).toBe(0);
            expect(result.effectiveStack).toBe(0);
        });

        test('should correctly calculate basic pot odds', () => {
            const potOdds = calculateBasicPotOdds(5, 20);
            expect(potOdds).toBe(0.2); // 5 / (20 + 5) = 0.2
            
            const zeroCall = calculateBasicPotOdds(0, 20);
            expect(zeroCall).toBe(0);
        });

        test('should correctly determine if pot odds are favorable', () => {
            const favorable = arePotOddsFavorable(0.25, 0.3); // 25% pot odds, 30% equity
            expect(favorable).toBe(true);
            
            const unfavorable = arePotOddsFavorable(0.25, 0.2); // 25% pot odds, 20% equity
            expect(unfavorable).toBe(false);
        });
    });
}); 