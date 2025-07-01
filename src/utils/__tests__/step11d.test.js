const mongoose = require('mongoose');
const { Hand } = require('../../models/models');
const {
    determineStreetSpecificResponsePatterns,
    getBaseFrequenciesByStreet,
    calculateStreetAdjustments,
    applyStreetAdjustments,
    getStreetSpecificFactors
} = require('../EV_Calculation/Step11/Step11d');

describe('Step 11d: Street-Specific Response Patterns - Real Hand Validation', () => {
    let realHands = [];
    let responsePatternResults = [];

    beforeAll(async () => {
        try {
            await mongoose.connect('mongodb://localhost:27017/pokerHistory', {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('✅ Connected to poker history database');
            
            const hands = await Hand.find({}).limit(5);
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

    describe('Database Hand Response Pattern Analysis', () => {
        test('should successfully analyze street-specific response patterns from real database hands', () => {
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
                                    isContinuationBet: action.street === 'flop' && actionIndex < 3,
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
                                
                                const opponentRange = {
                                    averageStrength: 0.5 + (Math.random() * 0.3),
                                    strengthCategory: 'medium_strong',
                                    totalCombos: 1000,
                                    drawingHandsPercentage: 0.2,
                                    strongHandsPercentage: 0.3,
                                    mediumHandsPercentage: 0.4,
                                    weakHandsPercentage: 0.1,
                                    boardTexture: { texture: 'balanced' }
                                };
                                
                                try {
                                    const responsePatterns = determineStreetSpecificResponsePatterns(
                                        playerAction,
                                        potOdds,
                                        opponentRange
                                    );
                                    
                                    console.log(`hand ${hand.id}, action ${actionIndex}, street ${action.street}, fold=${responsePatterns.adjustedFoldFrequency?.toFixed(3)}, call=${responsePatterns.adjustedCallFrequency?.toFixed(3)}, raise=${responsePatterns.adjustedRaiseFrequency?.toFixed(3)}`);
                                    
                                    responsePatternResults.push({
                                        handId: hand.id,
                                        actionIndex,
                                        action,
                                        opponentId: `Player${playerIndex}`,
                                        responsePatterns
                                    });
                                } catch (error) {
                                    console.error(`Error analyzing response patterns for hand ${hand.id}, action ${actionIndex}:`, error.message);
                                }
                            });
                        }
                    });
                }
            });

            console.log(`🔍 Analyzed response patterns for ${responsePatternResults.length} bet/raise facing actions`);
            
            expect(responsePatternResults.length).toBeGreaterThan(0);
            
            const streetAnalysis = new Map();
            const frequencyRanges = {
                fold: { min: 1, max: 0 },
                call: { min: 1, max: 0 },
                raise: { min: 1, max: 0 }
            };

            responsePatternResults.forEach(result => {
                const { action, responsePatterns } = result;
                const street = action.street;
                
                if (!streetAnalysis.has(street)) {
                    streetAnalysis.set(street, {
                        count: 0,
                        totalFold: 0,
                        totalCall: 0,
                        totalRaise: 0,
                        adjustments: { fold: 0, call: 0, raise: 0 }
                    });
                }
                
                const analysis = streetAnalysis.get(street);
                analysis.count++;
                analysis.totalFold += responsePatterns.adjustedFoldFrequency || 0;
                analysis.totalCall += responsePatterns.adjustedCallFrequency || 0;
                analysis.totalRaise += responsePatterns.adjustedRaiseFrequency || 0;
                
                analysis.adjustments.fold += responsePatterns.foldFrequencyAdjustment || 0;
                analysis.adjustments.call += responsePatterns.callFrequencyAdjustment || 0;
                analysis.adjustments.raise += responsePatterns.raiseFrequencyAdjustment || 0;
                
                ['fold', 'call', 'raise'].forEach(actionType => {
                    const freq = responsePatterns[`adjusted${actionType.charAt(0).toUpperCase() + actionType.slice(1)}Frequency`] || 0;
                    frequencyRanges[actionType].min = Math.min(frequencyRanges[actionType].min, freq);
                    frequencyRanges[actionType].max = Math.max(frequencyRanges[actionType].max, freq);
                });
            });

            console.log('\n📈 Response Pattern Analysis Summary:');
            console.log('Frequency Ranges:', {
                fold: `${(frequencyRanges.fold.min * 100).toFixed(1)}% - ${(frequencyRanges.fold.max * 100).toFixed(1)}%`,
                call: `${(frequencyRanges.call.min * 100).toFixed(1)}% - ${(frequencyRanges.call.max * 100).toFixed(1)}%`,
                raise: `${(frequencyRanges.raise.min * 100).toFixed(1)}% - ${(frequencyRanges.raise.max * 100).toFixed(1)}%`
            });

            expect(streetAnalysis.size).toBeGreaterThan(0);
            expect(frequencyRanges.fold.min).toBeGreaterThanOrEqual(0);
            expect(frequencyRanges.fold.max).toBeLessThanOrEqual(1);
            expect(frequencyRanges.call.min).toBeGreaterThanOrEqual(0);
            expect(frequencyRanges.call.max).toBeLessThanOrEqual(1);
            expect(frequencyRanges.raise.min).toBeGreaterThanOrEqual(0);
            expect(frequencyRanges.raise.max).toBeLessThanOrEqual(1);
        });

        test('should correctly calculate street-specific response metrics from real hands', () => {
            if (responsePatternResults.length === 0) return;

            console.log('\n💰 Street-Specific Response Metrics:');
            
            responsePatternResults.forEach(result => {
                const { action, responsePatterns } = result;
                
                console.log(`  ${action.street} ${action.action}: fold=${responsePatterns.adjustedFoldFrequency?.toFixed(3)}, call=${responsePatterns.adjustedCallFrequency?.toFixed(3)}, raise=${responsePatterns.adjustedRaiseFrequency?.toFixed(3)}`);
                
                expect(responsePatterns.street).toBe(action.street);
                expect(responsePatterns.adjustedFoldFrequency).toBeGreaterThanOrEqual(0);
                expect(responsePatterns.adjustedFoldFrequency).toBeLessThanOrEqual(1);
                expect(responsePatterns.adjustedCallFrequency).toBeGreaterThanOrEqual(0);
                expect(responsePatterns.adjustedCallFrequency).toBeLessThanOrEqual(1);
                expect(responsePatterns.adjustedRaiseFrequency).toBeGreaterThanOrEqual(0);
                expect(responsePatterns.adjustedRaiseFrequency).toBeLessThanOrEqual(1);
                
                const total = (responsePatterns.adjustedFoldFrequency || 0) + 
                             (responsePatterns.adjustedCallFrequency || 0) + 
                             (responsePatterns.adjustedRaiseFrequency || 0);
                expect(total).toBeCloseTo(1, 1);
            });
        });
    });

    describe('GTO Street-Specific Pattern Analysis', () => {
        test('should analyze response patterns by street for GTO insights', () => {
            if (responsePatternResults.length === 0) return;

            console.log('\n🧠 GTO Street-Specific Pattern Analysis:');
            
            const streetAnalysis = new Map();
            
            responsePatternResults.forEach(result => {
                const { action, responsePatterns } = result;
                const street = action.street;
                
                if (!streetAnalysis.has(street)) {
                    streetAnalysis.set(street, {
                        count: 0,
                        totalFold: 0,
                        totalCall: 0,
                        totalRaise: 0,
                        totalAdjustments: { fold: 0, call: 0, raise: 0 }
                    });
                }
                
                const analysis = streetAnalysis.get(street);
                analysis.count++;
                analysis.totalFold += responsePatterns.adjustedFoldFrequency || 0;
                analysis.totalCall += responsePatterns.adjustedCallFrequency || 0;
                analysis.totalRaise += responsePatterns.adjustedRaiseFrequency || 0;
                
                analysis.totalAdjustments.fold += responsePatterns.foldFrequencyAdjustment || 0;
                analysis.totalAdjustments.call += responsePatterns.callFrequencyAdjustment || 0;
                analysis.totalAdjustments.raise += responsePatterns.raiseFrequencyAdjustment || 0;
            });
            
            streetAnalysis.forEach((analysis, street) => {
                const avgFold = analysis.count > 0 ? analysis.totalFold / analysis.count : 0;
                const avgCall = analysis.count > 0 ? analysis.totalCall / analysis.count : 0;
                const avgRaise = analysis.count > 0 ? analysis.totalRaise / analysis.count : 0;
                
                const avgFoldAdjustment = analysis.count > 0 ? analysis.totalAdjustments.fold / analysis.count : 0;
                const avgCallAdjustment = analysis.count > 0 ? analysis.totalAdjustments.call / analysis.count : 0;
                const avgRaiseAdjustment = analysis.count > 0 ? analysis.totalAdjustments.raise / analysis.count : 0;
                
                console.log(`  ${street.toUpperCase()}: ${analysis.count} actions`);
                console.log(`    Avg Frequencies: fold=${(avgFold * 100).toFixed(1)}%, call=${(avgCall * 100).toFixed(1)}%, raise=${(avgRaise * 100).toFixed(1)}%`);
                console.log(`    Avg Adjustments: fold=${(avgFoldAdjustment * 100).toFixed(1)}%, call=${(avgCallAdjustment * 100).toFixed(1)}%, raise=${(avgRaiseAdjustment * 100).toFixed(1)}%`);
            });
            
            expect(streetAnalysis.size).toBeGreaterThan(0);
        });
    });

    describe('Base Frequency Validation', () => {
        test('should correctly calculate base frequencies by street and bet sizing', () => {
            const streets = ['flop', 'turn', 'river'];
            const betSizings = ['small', 'medium', 'large', 'very_large', 'all_in'];
            
            streets.forEach(street => {
                betSizings.forEach(betSizing => {
                    const frequencies = getBaseFrequenciesByStreet(street, betSizing, 'bet');
                    
                    console.log(`${street} ${betSizing}: fold=${frequencies.fold}, call=${frequencies.call}, raise=${frequencies.raise}`);
                    
                    expect(frequencies.fold).toBeGreaterThanOrEqual(0);
                    expect(frequencies.fold).toBeLessThanOrEqual(1);
                    expect(frequencies.call).toBeGreaterThanOrEqual(0);
                    expect(frequencies.call).toBeLessThanOrEqual(1);
                    expect(frequencies.raise).toBeGreaterThanOrEqual(0);
                    expect(frequencies.raise).toBeLessThanOrEqual(1);
                    
                    const total = frequencies.fold + frequencies.call + frequencies.raise;
                    expect(total).toBeCloseTo(1, 2);
                });
            });
        });

        test('should show proper frequency progression by street', () => {
            const betSizing = 'medium';
            const flopFreq = getBaseFrequenciesByStreet('flop', betSizing, 'bet');
            const turnFreq = getBaseFrequenciesByStreet('turn', betSizing, 'bet');
            const riverFreq = getBaseFrequenciesByStreet('river', betSizing, 'bet');
            
            console.log('\n📊 Frequency Progression by Street (Medium Bet):');
            console.log(`Flop:  fold=${flopFreq.fold}, call=${flopFreq.call}, raise=${flopFreq.raise}`);
            console.log(`Turn:  fold=${turnFreq.fold}, call=${turnFreq.call}, raise=${turnFreq.raise}`);
            console.log(`River: fold=${riverFreq.fold}, call=${riverFreq.call}, raise=${riverFreq.raise}`);
            
            expect(flopFreq.fold).toBeGreaterThanOrEqual(turnFreq.fold);
            expect(turnFreq.fold).toBeGreaterThanOrEqual(riverFreq.fold);
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle missing or invalid data gracefully', () => {
            const result = determineStreetSpecificResponsePatterns(null, null, null);
            
            expect(result).toBeDefined();
            expect(result.street).toBe('unknown');
            expect(result.baseFoldFrequency).toBe(0.5);
            expect(result.baseCallFrequency).toBe(0.3);
            expect(result.baseRaiseFrequency).toBe(0.2);
            expect(result.explanation).toBe('Missing input data');
        });

        test('should handle edge case response pattern calculations', () => {
            const playerAction = {
                actionType: "bet",
                betSize: 5,
                betSizing: "small",
                isAllIn: false,
                street: "flop",
                position: "BTN",
                potSize: 10,
                isContinuationBet: true,
                isValueBet: false,
                isBluff: false
            };
            
            const potOdds = {
                potSize: 10,
                callAmount: 5,
                potOdds: 0.5,
                impliedOdds: 1.2,
                requiredEquity: 0.5,
                isProfitable: true
            };
            
            const opponentRange = {
                averageStrength: 0.8,
                strengthCategory: 'very_strong',
                totalCombos: 500,
                drawingHandsPercentage: 0.1,
                strongHandsPercentage: 0.7,
                mediumHandsPercentage: 0.2,
                weakHandsPercentage: 0.0,
                boardTexture: { texture: 'coordinated' }
            };
            
            const result = determineStreetSpecificResponsePatterns(
                playerAction,
                potOdds,
                opponentRange
            );
            
            expect(result).toBeDefined();
            expect(result.street).toBe('flop');
            expect(result.adjustedFoldFrequency).toBeGreaterThanOrEqual(0);
            expect(result.adjustedFoldFrequency).toBeLessThanOrEqual(1);
            expect(result.adjustedCallFrequency).toBeGreaterThanOrEqual(0);
            expect(result.adjustedCallFrequency).toBeLessThanOrEqual(1);
            expect(result.adjustedRaiseFrequency).toBeGreaterThanOrEqual(0);
            expect(result.adjustedRaiseFrequency).toBeLessThanOrEqual(1);
        });

        test('should validate street-specific factors calculation', () => {
            const playerAction = {
                actionType: "bet",
                betSize: 15,
                betSizing: "medium",
                isAllIn: false,
                street: "turn",
                position: "CO",
                potSize: 30
            };
            
            const opponentRange = {
                averageStrength: 0.6,
                strengthCategory: 'medium_strong',
                totalCombos: 800
            };
            
            const factors = getStreetSpecificFactors('turn', playerAction, opponentRange);
            
            expect(factors).toBeDefined();
            expect(factors.remainingStreets).toBe(1); // Only river left
            expect(factors.isFinalDecision).toBe(false);
            expect(factors.commitmentLevel).toBeGreaterThan(0);
            expect(factors.commitmentLevel).toBeLessThanOrEqual(1);
            expect(factors.bluffCatchingFrequency).toBeGreaterThan(0);
            expect(factors.bluffCatchingFrequency).toBeLessThanOrEqual(1);
            expect(factors.valueBettingFrequency).toBeGreaterThan(0);
            expect(factors.valueBettingFrequency).toBeLessThanOrEqual(1);
            expect(factors.drawingPotential).toBeGreaterThanOrEqual(0);
            expect(factors.drawingPotential).toBeLessThanOrEqual(1);
        });
    });
}); 