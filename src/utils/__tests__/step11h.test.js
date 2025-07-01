const mongoose = require('mongoose');
const { Hand } = require('../../models/models');
const { determinePlayerActionType, calculatePotSizeBeforeAction } = require('../EV_Calculation/Step11/step11a');
const { calculatePotOddsForOpponent } = require('../EV_Calculation/Step11/step11b');
const {
    adjustForStackDepth,
    getStackDepthInformation,
    calculateDeepStackAdjustment,
    calculateMediumStackAdjustment,
    calculateShortStackAdjustment,
    calculateAllInAdjustment,
    calculateOverallStackAdjustment
} = require('../EV_Calculation/Step11/step11h');

describe('Step 11h: Stack Depth Adjustments - Real Hand Validation', () => {
    let realHands = [];
    let adjustmentResults = {
        deep: [],
        medium: [],
        short: [],
        all_in: []
    };

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

    test('should analyze stack depth patterns in real hands', () => {
        let totalActions = 0;
        let stackDepthDistribution = {
            deep: 0,
            medium: 0,
            short: 0,
            all_in: 0
        };

        let streetDistribution = {
            preflop: 0,
            flop: 0,
            turn: 0,
            river: 0
        };

        realHands.forEach((hand, handIndex) => {
            const actions = hand.bettingActions || [];
            if (!hand.blindLevel?.bigBlind) {
                console.log(`Skipping hand ${hand.id} - missing blind level`);
                return;
            }
            const bigBlind = hand.blindLevel.bigBlind;
            
            if (handIndex < 5) {
                console.log(`\nHand ${hand.id}:`);
                console.log(`Actions:`, actions.length);
                console.log(`Player Stacks:`, hand.playerStacks);
                console.log(`Big Blind:`, bigBlind);
            }
            
            actions.forEach((action, actionIndex) => {
                if (!action || !action.action || action.action === 'fold') {
                    if (handIndex < 5) {
                        console.log(`Skipping action ${actionIndex}:`, action);
                    }
                    return;
                }

                // Get action type and pot size from step 11a
                const playerAction = determinePlayerActionType(action, hand, actions, actionIndex);
                const potSize = calculatePotSizeBeforeAction(hand, actions, actionIndex);

                // Convert stacks to big blinds
                const effectiveStack = hand.playerStacks?.[action.playerId] || 0;
                const effectiveStackBB = effectiveStack / bigBlind;

                // Get pot odds from step 11b
                const potOdds = calculatePotOddsForOpponent(
                    {
                        playerId: action.playerId,
                        actionType: action.action,
                        betSizing: action.amount > 0 ? (action.amount > potSize * 0.75 ? 'large' : 'small') : 'none',
                        street: action.street,
                        potSize,
                        betSize: action.amount || 0,
                        position: action.position || 'unknown',
                        isAllIn: false,
                        isValueBet: false,
                        isContinuationBet: false
                    },
                    hand,
                    actions,
                    actionIndex,
                    action.playerId
                );

                // Override effective stack with BB units
                potOdds.effectiveStack = effectiveStackBB;

                if (handIndex < 5) {
                    console.log(`\nProcessing action ${actionIndex}:`);
                    console.log(`Action:`, action);
                    console.log(`Player Action:`, playerAction);
                    console.log(`Pot Odds:`, potOdds);
                }

                // Get stack depth adjustment
                const stackDepthInfo = getStackDepthInformation(potOdds, playerAction, hand, actions, actionIndex, action.playerId);

                if (handIndex < 5) {
                    console.log(`Stack Depth Info:`, stackDepthInfo);
                }

                // Record stack depth distribution
                stackDepthDistribution[stackDepthInfo.stackDepthCategory]++;
                totalActions++;

                // Record street distribution
                if (action.street) {
                    streetDistribution[action.street]++;
                }

                // Record adjustment results
                adjustmentResults[stackDepthInfo.stackDepthCategory].push({
                    stackDepthInfo,
                    street: action.street,
                    adjustment: calculateOverallStackAdjustment({
                        deepStack: calculateDeepStackAdjustment(stackDepthInfo, playerAction),
                        mediumStack: calculateMediumStackAdjustment(stackDepthInfo, playerAction),
                        shortStack: calculateShortStackAdjustment(stackDepthInfo, playerAction),
                        allIn: calculateAllInAdjustment(stackDepthInfo, playerAction),
                        stackDepthInfo
                    })
                });
            });
        });

        // Log stack depth distribution
        console.log('\nStack Depth Distribution:');
        Object.entries(stackDepthDistribution).forEach(([category, count]) => {
            console.log(`${category}: ${count} actions (${(count / totalActions * 100).toFixed(1)}%)`);
        });

        // Log adjustment statistics for each category
        Object.entries(adjustmentResults).forEach(([category, results]) => {
            if (results.length > 0) {
                console.log(`\n${category} Adjustments:`);
                console.log(`Total Actions: ${results.length}`);
                const adjustments = results.map(r => r.adjustment);
                const minAdj = Math.min(...adjustments);
                const maxAdj = Math.max(...adjustments);
                const avgAdj = adjustments.reduce((a, b) => a + b, 0) / adjustments.length;
                
                console.log(`Range: ${minAdj.toFixed(1)}% to ${maxAdj.toFixed(1)}%`);
                console.log(`Average: ${avgAdj.toFixed(1)}%`);

                // Validate adjustment ranges align with GTO principles
                switch(category) {
                    case 'deep':
                        expect(minAdj).toBeGreaterThanOrEqual(-15.0); // At least -15%
                        expect(maxAdj).toBeLessThanOrEqual(-5.0); // Up to -5%
                        expect(avgAdj).toBeLessThanOrEqual(-7.0); // Average should be negative
                        break;
                    case 'medium':
                        expect(minAdj).toBeGreaterThanOrEqual(-2.0); // Not too negative
                        expect(maxAdj).toBeLessThanOrEqual(5.0); // Up to +5% adjustment
                        expect(Math.abs(avgAdj)).toBeLessThanOrEqual(3.0); // Balanced average
                        break;
                    case 'short':
                        expect(minAdj).toBeGreaterThanOrEqual(10.0); // At least +10%
                        expect(maxAdj).toBeLessThanOrEqual(20.0); // Up to +20%
                        expect(avgAdj).toBeGreaterThan(12.0); // Strong positive average
                        break;
                    case 'all_in':
                        expect(minAdj).toBeGreaterThanOrEqual(20.0); // At least +20%
                        expect(maxAdj).toBeLessThanOrEqual(30.0); // Up to +30%
                        expect(avgAdj).toBeGreaterThan(22.0); // Strong positive average
                        break;
                }

                // Street distribution for this category
                const categoryStreetDist = {
                    preflop: 0,
                    flop: 0,
                    turn: 0,
                    river: 0
                };

                results.forEach(r => {
                    if (r.street) {
                        categoryStreetDist[r.street]++;
                    }
                });

                console.log('\nStreet Distribution:');
                Object.entries(categoryStreetDist).forEach(([street, count]) => {
                    console.log(`${street}: ${count} actions (${(count / results.length * 100).toFixed(1)}%)`);
                });
            }
        });

        expect(totalActions).toBeGreaterThan(0);
    });

    test('should handle missing input data gracefully', () => {
        const result = adjustForStackDepth(null, null, null, null, null, null, null);
        expect(result.stackDepthAdjustment).toBe(0);
        expect(result.adjustedFoldFrequency).toBe(0.5);
    });

    test('should throw error when blind level is missing', () => {
        const mockHand = {
            id: 'test123',
            blindLevel: null
        };
        const mockPotOdds = { effectiveStack: 100 };
        const mockPlayerAction = { street: 'flop' };

        expect(() => {
            getStackDepthInformation(mockPotOdds, mockPlayerAction, mockHand, [], 0, 'player1');
        }).toThrow('Missing blind level in hand data');
    });
});

function calculateStackStats(results) {
    if (!results.length) {
        return {
            min: 0,
            max: 0,
            avg: 0,
            commonStreets: {}
        };
    }

    const adjustments = results.map(r => r.overallStackAdjustment);
    const streets = results.map(r => r.street);
    const streetCounts = streets.reduce((acc, street) => {
        acc[street] = (acc[street] || 0) + 1;
        return acc;
    }, {});

    return {
        min: Math.min(...adjustments),
        max: Math.max(...adjustments),
        avg: adjustments.reduce((a, b) => a + b, 0) / adjustments.length,
        commonStreets: streetCounts
    };
} 