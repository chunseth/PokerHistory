const mongoose = require('mongoose');
const { Hand } = require('../../models/models');
const {
    calculateOpponentRangeStrength,
    assessOpponentRangeStrength
} = require('../EV_Calculation/Step11/step11c');
const { calculateHandStrength } = require('../handStrength');

describe('Step 11c: Opponent Range Strength Assessment - Real Hand Validation', () => {
    let realHands = [];
    let rangeStrengthResults = [];
    let showdownAnalysis = [];

    beforeAll(async () => {
        try {
            await mongoose.connect('mongodb://localhost:27017/pokerHistory', {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('✅ Connected to poker history database');
            
            // Find hands that went to showdown by looking for hands with hero and villain cards
            const hands = await Hand.find({
                $and: [
                    { heroHoleCards: { $exists: true, $ne: [] } },
                    { villainCards: { $exists: true, $ne: [] } },
                    { 'communityCards.river': { $exists: true } }
                ]
            }).limit(100);
            
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

    describe('Database Hand Range Strength Analysis', () => {
        test('should successfully analyze opponent range strength from real database hands', () => {
            if (realHands.length === 0) {
                console.log('⚠️  Skipping database tests - no hands available');
                return;
            }

            realHands.forEach(hand => {
                if (hand.bettingActions && hand.bettingActions.length > 0) {
                    const players = new Set();
                    hand.bettingActions.forEach(action => {
                        if (action.playerIndex !== undefined) {
                            players.add(action.playerIndex);
                        }
                    });
                    
                    const foldedPlayers = new Set();
                    hand.bettingActions.forEach((action, actionIndex) => {
                        if (action.action === 'fold') {
                            foldedPlayers.add(action.playerIndex);
                        }
                        if (['bet', 'raise'].includes(action.action)) {
                            const activePlayers = Array.from(players).filter(playerIndex => 
                                !foldedPlayers.has(playerIndex) && 
                                playerIndex !== action.playerIndex
                            );
                            
                            activePlayers.forEach(playerIndex => {
                                const playerAction = {
                                    actionType: action.action,
                                    betSize: action.amount,
                                    betSizing: action.amount > 20 ? 'large' : action.amount > 10 ? 'medium' : 'small',
                                    isAllIn: action.isAllIn || false,
                                    street: action.street,
                                    position: `Player${playerIndex}`,
                                    potSize: 20,
                                    isContinuationBet: false,
                                    isValueBet: false,
                                    isBluff: false
                                };
                                
                                const potOdds = {
                                    potSize: 20,
                                    callAmount: action.amount,
                                    potOdds: action.amount / 20,
                                    impliedOdds: 1.2,
                                    requiredEquity: action.amount / 20,
                                    isProfitable: true
                                };
                                
            const actions = [
                                    { playerId: `Player${action.playerIndex}`, action: action.action, amount: action.amount, street: action.street, timestamp: action.timestamp },
                                    { playerId: `Player${playerIndex}`, action: 'call', amount: action.amount, street: action.street, timestamp: action.timestamp }
                                ];
                                
                                try {
                                    const rangeStrength = calculateOpponentRangeStrength(
                                        hand,
                actions, 
                                        `Player${playerIndex}`,
                                        1,
                                        playerAction,
                                        potOdds
                                    );
                                    
                                    console.log(`hand ${hand.id}, action ${actionIndex}, opponent Player${playerIndex}, strength=${rangeStrength.averageStrength?.toFixed(3)}, category=${rangeStrength.strengthCategory}`);
                                    
                                    rangeStrengthResults.push({
                                        handId: hand.id,
                                        actionIndex,
                                        action,
                                        opponentId: `Player${playerIndex}`,
                                        rangeStrength
                                    });
                                } catch (error) {
                                    console.error(`Error analyzing range strength for hand ${hand.id}, action ${actionIndex}:`, error.message);
                                }
                            });
                        }
                    });
                }
            });

            console.log(`🔍 Analyzed range strength for ${rangeStrengthResults.length} bet/raise facing actions`);
            
            expect(rangeStrengthResults.length).toBeGreaterThan(0);
            
            const strengthCategories = new Map();
            const averageStrengths = [];

            rangeStrengthResults.forEach(result => {
                const { rangeStrength } = result;
                strengthCategories.set(rangeStrength.strengthCategory, (strengthCategories.get(rangeStrength.strengthCategory) || 0) + 1);
                if (rangeStrength.averageStrength !== undefined) {
                    averageStrengths.push(rangeStrength.averageStrength);
                }
            });

            console.log('\n📈 Range Strength Analysis Summary:');
            console.log('Strength Categories:', Object.fromEntries(strengthCategories));
            console.log('Average Strength Range:', averageStrengths.length > 0 ? `${Math.min(...averageStrengths).toFixed(3)} - ${Math.max(...averageStrengths).toFixed(3)}` : 'N/A');

            expect(strengthCategories.size).toBeGreaterThan(0);
            if (averageStrengths.length > 0) {
                expect(Math.min(...averageStrengths)).toBeGreaterThanOrEqual(0);
                expect(Math.max(...averageStrengths)).toBeLessThanOrEqual(1);
            }
        });

        test('should correctly calculate range strength metrics from real hands', () => {
            if (rangeStrengthResults.length === 0) return;

            console.log('\n💰 Range Strength Metrics Analysis:');
            
            rangeStrengthResults.forEach(result => {
                const { action, rangeStrength } = result;
                
                console.log(`  ${action.street} ${action.action}: strength=${rangeStrength.averageStrength?.toFixed(3)}, category=${rangeStrength.strengthCategory}, combos=${rangeStrength.totalCombos}`);
                
                if (rangeStrength.averageStrength !== undefined) {
                    expect(rangeStrength.averageStrength).toBeGreaterThanOrEqual(0);
                    expect(rangeStrength.averageStrength).toBeLessThanOrEqual(1);
                }
                
                expect(rangeStrength.strengthCategory).toBeDefined();
                expect(rangeStrength.totalCombos).toBeGreaterThanOrEqual(0);
                expect(rangeStrength.boardTexture).toBeDefined();
            });
        });
    });

    describe('GTO Range Strength Pattern Analysis', () => {
        test('should analyze range strength patterns by street for GTO insights', () => {
            if (rangeStrengthResults.length === 0) return;

            console.log('\n🧠 GTO Range Strength Pattern Analysis:');
            
            const streetAnalysis = new Map();
            
            rangeStrengthResults.forEach(result => {
                const { action, rangeStrength } = result;
                const street = action.street;
                
                if (!streetAnalysis.has(street)) {
                    streetAnalysis.set(street, {
                        count: 0,
                        totalStrength: 0,
                        categories: new Map()
                    });
                }
                
                const analysis = streetAnalysis.get(street);
                analysis.count++;
                if (rangeStrength.averageStrength !== undefined) {
                    analysis.totalStrength += rangeStrength.averageStrength;
                }
                
                const category = rangeStrength.strengthCategory;
                analysis.categories.set(category, (analysis.categories.get(category) || 0) + 1);
            });
            
            streetAnalysis.forEach((analysis, street) => {
                const avgStrength = analysis.count > 0 ? analysis.totalStrength / analysis.count : 0;
                console.log(`  ${street.toUpperCase()}: ${analysis.count} actions, avg strength: ${avgStrength.toFixed(3)}`);
                
                const categoryDist = Object.fromEntries(analysis.categories);
                console.log(`    Categories:`, categoryDist);
            });
            
            expect(streetAnalysis.size).toBeGreaterThan(0);
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle edge case range strength calculations', () => {
            const edgeCaseHand = {
                id: "edge-case",
                heroHoleCards: ["Ah", "Kh"],
                communityCards: {
                    flop: ["2h", "3d", "4c"]
                },
                bettingActions: [
                    { playerIndex: 0, action: "bet", amount: 5, street: "flop", timestamp: new Date() }
                ]
            };
            
            const playerAction = {
                actionType: "bet",
                betSize: 5,
                betSizing: "small",
                isAllIn: false,
                street: "flop",
                position: "BTN",
                potSize: 10
            };
            
            const potOdds = {
                potSize: 10,
                callAmount: 5,
                potOdds: 0.5,
                impliedOdds: 1.2,
                requiredEquity: 0.5,
                isProfitable: true
            };
            
            const actions = [
                { playerId: "Player0", action: "bet", amount: 5, street: "flop", timestamp: new Date() },
                { playerId: "Player1", action: "call", amount: 5, street: "flop", timestamp: new Date() }
            ];
            
            const result = calculateOpponentRangeStrength(
                edgeCaseHand,
                actions,
                "Player1",
                1,
                playerAction,
                potOdds
            );
            
            expect(result).toBeDefined();
            expect(result.averageStrength).toBeGreaterThanOrEqual(0);
            expect(result.averageStrength).toBeLessThanOrEqual(1);
        });

        test('should handle missing or invalid data gracefully', () => {
            const result = calculateOpponentRangeStrength(null, [], null, 0);
            
            expect(result).toBeDefined();
            expect(result.averageStrength).toBe(0);
            expect(result.strengthCategory).toBe('unknown');
        });
    });

    describe('Showdown Hand Analysis', () => {
        test('should compare predicted ranges with actual showdown hands', () => {
            realHands.forEach(hand => {
                // Skip hands without showdown data
                if (!hand.heroHoleCards || !hand.villainCards || !hand.communityCards.river) {
                    return;
                }

                console.log(`\n📍 Analyzing showdown hand ${hand.id}`);

                // Analyze hero's actions
                const heroActions = hand.bettingActions.filter(action => 
                    action.playerIndex === hand.heroPosition
                );

                // Get the last aggressive action (bet/raise) for each street
                const lastActions = new Map();
                heroActions.forEach(action => {
                    if (['bet', 'raise'].includes(action.action)) {
                        lastActions.set(action.street, action);
                    }
                });

                // For each street's last action, calculate the predicted range
                ['preflop', 'flop', 'turn', 'river'].forEach(street => {
                    const lastAction = lastActions.get(street);
                    if (!lastAction) return;

                    const actionIndex = hand.bettingActions.findIndex(a => 
                        a.playerIndex === lastAction.playerIndex && 
                        a.action === lastAction.action &&
                        a.street === lastAction.street
                    );

                    if (actionIndex === -1) return;

                    try {
                        const rangeStrength = calculateOpponentRangeStrength(
                            hand,
                            hand.bettingActions.slice(0, actionIndex + 1),
                            `Player${hand.heroPosition}`,
                            actionIndex,
                            {
                                actionType: lastAction.action,
                                betSize: lastAction.amount,
                                street: lastAction.street,
                                position: `Player${hand.heroPosition}`,
                                potSize: lastAction.potSize || hand.potSize || 20
                            },
                            {
                                potSize: lastAction.potSize || hand.potSize || 20,
                                callAmount: lastAction.amount,
                                potOdds: lastAction.amount / (lastAction.potSize || hand.potSize || 20),
                                impliedOdds: 1.2,
                                isProfitable: true
                            }
                        );

                        showdownAnalysis.push({
                            handId: hand.id,
                            playerIndex: hand.heroPosition,
                            street,
                            actualHoleCards: hand.heroHoleCards,
                            predictedRangeStrength: rangeStrength.averageStrength,
                            predictedCategory: rangeStrength.strengthCategory,
                            actualHandStrength: calculateActualHandStrength(
                                hand.heroHoleCards,
                                hand.communityCards,
                                street
                            )
                        });

                        // Also analyze villain's actual hand if available
                        if (hand.villainCards.length === 2) {
                            showdownAnalysis.push({
                                handId: hand.id,
                                playerIndex: -1, // villain
                                street,
                                actualHoleCards: hand.villainCards,
                                predictedRangeStrength: null, // we don't predict villain's range
                                predictedCategory: null,
                                actualHandStrength: calculateActualHandStrength(
                                    hand.villainCards,
                                    hand.communityCards,
                                    street
                                )
                            });
                        }

                    } catch (error) {
                        console.error(`Error analyzing showdown hand ${hand.id} at street ${street}:`, error.message);
                    }
                });
            });

            // Print showdown analysis summary
            console.log('\n🎯 Showdown Analysis Summary:');
            
            const streetAnalysis = new Map();
            showdownAnalysis.forEach(analysis => {
                if (!streetAnalysis.has(analysis.street)) {
                    streetAnalysis.set(analysis.street, {
                        count: 0,
                        predictedTotal: 0,
                        actualTotal: 0,
                        differences: [],
                        heroActual: [],
                        villainActual: []
                    });
                }

                const stats = streetAnalysis.get(analysis.street);
                stats.count++;
                
                if (analysis.playerIndex === -1) {
                    // Villain data
                    stats.villainActual.push(analysis.actualHandStrength);
                } else {
                    // Hero data
                    if (analysis.predictedRangeStrength !== null) {
                        stats.predictedTotal += analysis.predictedRangeStrength;
                        stats.differences.push(Math.abs(analysis.predictedRangeStrength - analysis.actualHandStrength));
                    }
                    stats.heroActual.push(analysis.actualHandStrength);
                }
                stats.actualTotal += analysis.actualHandStrength;
            });

            streetAnalysis.forEach((stats, street) => {
                const avgPredicted = stats.predictedTotal / (stats.heroActual.length || 1);
                const avgHeroActual = stats.heroActual.reduce((a, b) => a + b, 0) / (stats.heroActual.length || 1);
                const avgVillainActual = stats.villainActual.reduce((a, b) => a + b, 0) / (stats.villainActual.length || 1);
                const avgDiff = stats.differences.reduce((a, b) => a + b, 0) / (stats.differences.length || 1);
                
                console.log(`\n${street.toUpperCase()}:`);
                console.log(`  Hands analyzed: ${stats.count}`);
                console.log(`  Hero hands: ${stats.heroActual.length}`);
                console.log(`  Villain hands: ${stats.villainActual.length}`);
                console.log(`  Average predicted strength: ${avgPredicted.toFixed(3)}`);
                console.log(`  Average hero actual strength: ${avgHeroActual.toFixed(3)}`);
                console.log(`  Average villain actual strength: ${avgVillainActual.toFixed(3)}`);
                console.log(`  Average prediction difference: ${avgDiff.toFixed(3)}`);
            });

            expect(showdownAnalysis.length).toBeGreaterThan(0);
        });
    });
});

/**
 * Calculate the actual strength of a hand at a given street
 * @param {Array} holeCards - Player's hole cards
 * @param {Object} communityCards - Community cards object with flop, turn, river
 * @param {string} street - The street to calculate strength for
 * @returns {number} Hand strength value between 0 and 1
 */
function calculateActualHandStrength(holeCards, communityCards, street) {
    if (!holeCards || holeCards.length !== 2 || !communityCards) return 0;

    let board = [];
    const flop = communityCards.flop || [];
    const turn = communityCards.turn ? [communityCards.turn] : [];
    const river = communityCards.river ? [communityCards.river] : [];

    switch(street) {
        case 'preflop':
            board = [];
            break;
        case 'flop':
            board = flop;
            break;
        case 'turn':
            board = [...flop, ...turn];
            break;
        case 'river':
            board = [...flop, ...turn, ...river];
            break;
        default:
            return 0;
    }

    return calculateHandStrength(holeCards, board);
} 