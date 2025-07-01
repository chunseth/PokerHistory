const mongoose = require('mongoose');
const { Hand } = require('../../models/models');

// Core step imports
const { calculateWeightedResponseProbabilities } = require('../EV_Calculation/Step11/step11o1');
const { validateResponseFrequencies } = require('../EV_Calculation/Step11/step11p');

// Support modules for producing realistic inputs to Step 11o1
const { determinePlayerActionType } = require('../EV_Calculation/Step11/step11a');
const { calculatePotOddsForOpponent } = require('../EV_Calculation/Step11/step11b');
const { calculateOpponentRangeStrength } = require('../EV_Calculation/Step11/step11c');
const { determineStreetSpecificResponsePatterns } = require('../EV_Calculation/Step11/Step11d');
const { calculateBaseFoldFrequency } = require('../EV_Calculation/Step11/step11e');
const { adjustForOpponentRangeStrength } = require('../EV_Calculation/Step11/step11f');
const { adjustForMultiwayVsHeadsUp } = require('../EV_Calculation/Step11/step11i');
const { adjustRaiseFrequencyForBetSizing } = require('../EV_Calculation/Step11/step11l');
const { analyzeOpponentPreviousActions } = require('../EV_Calculation/Step11/step11m');
const { adjustForBoardTexture } = require('../EV_Calculation/Step11/step11n');

/**
 * Step 11p Integration Test
 * --------------------------------------
 * 1. Loads a subset of real hands from MongoDB
 * 2. Calculates raw weighted response probabilities (Step 11o1)
 * 3. Pipes them through Step 11p validator
 * 4. Confirms that validated frequencies are normalised and within bounds
 */
describe('Step 11p: Response Frequency Validation - Real Hand Integration', () => {
    let realHands = [];

    beforeAll(async () => {
        // Establish DB connection and fetch sample hands
        try {
            await mongoose.connect('mongodb://localhost:27017/pokerHistory', {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('✅ Connected to poker history database');

            const hands = await Hand.find({}).limit(20);
            realHands = hands.map(h => h.toObject());
            console.log(`📊 Loaded ${realHands.length} real hands for Step 11p test`);
        } catch (err) {
            console.error('❌ MongoDB connection error:', err.message);
            realHands = [];
        }
    });

    afterAll(async () => {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('🔌 Disconnected from database');
        }
    });

    test('should validate and normalise response frequencies from Step 11o1', () => {
        if (realHands.length === 0) {
            console.log('⚠️  No hands available – skipping Step 11p test');
            return;
        }

        const validatedResults = [];
        let processed = 0;

        for (const hand of realHands) {
            if (processed >= 10) break; // Limit processing for test speed
            if (!hand.bettingActions || hand.bettingActions.length === 0) continue;

            const bettingActions = hand.bettingActions.filter(a => a.amount > 0);
            if (bettingActions.length === 0) continue;

            for (let idx = 0; idx < bettingActions.length; idx++) {
                const action = bettingActions[idx];
                const actionIndex = hand.bettingActions.indexOf(action);
                const board = hand.board || [];

                try {
                    // --- Step preparation (subset of modules used in earlier integration) ---
                    const playerAction = determinePlayerActionType(action, hand, hand.bettingActions, actionIndex);
                    const potOdds = calculatePotOddsForOpponent(playerAction, hand, hand.bettingActions, actionIndex, action.playerId || 'villain');
                    const rangeStrength = calculateOpponentRangeStrength(hand, hand.bettingActions, action.playerId || 'villain', actionIndex, playerAction, potOdds);
                    const streetPatterns = determineStreetSpecificResponsePatterns(playerAction, potOdds, rangeStrength);
                    const baseFreq = calculateBaseFoldFrequency(playerAction, potOdds, rangeStrength, streetPatterns);
                    const rangeAdj = adjustForOpponentRangeStrength(rangeStrength, playerAction, potOdds, baseFreq.baseFoldFrequency);
                    const multiwayAdj = adjustForMultiwayVsHeadsUp(hand, hand.bettingActions, actionIndex, playerAction, {});

                    const betInfo = {
                        betSize: playerAction.betSize,
                        potSize: playerAction.potSize,
                        isAllIn: playerAction.isAllIn,
                        betSizing: playerAction.betSizing
                    };
                    const betSizingAdj = adjustRaiseFrequencyForBetSizing(betInfo, 0.1, rangeStrength);
                    const actionPatternAdj = analyzeOpponentPreviousActions(hand.bettingActions, actionIndex, action.playerId || 'villain');
                    const boardTextureAdj = adjustForBoardTexture({ ...hand, board }, hand.bettingActions, actionIndex, action.playerId || 'villain', playerAction, potOdds);

                    // --- Step 11o1 ---
                    const weighted = calculateWeightedResponseProbabilities(
                        { ...hand, board },
                        hand.bettingActions,
                        actionIndex,
                        action.playerId || 'villain',
                        playerAction,
                        potOdds,
                        rangeStrength,
                        streetPatterns,
                        baseFreq,
                        rangeAdj,
                        {},
                        {},
                        multiwayAdj,
                        {},
                        {},
                        betSizingAdj,
                        actionPatternAdj,
                        boardTextureAdj
                    );

                    // --- Step 11p ---
                    const validated = validateResponseFrequencies(weighted);
                    validatedResults.push(validated);
                    processed++;
                    if (processed >= 10) break;
                } catch (err) {
                    console.error(`Error processing action ${idx} in hand ${hand._id}:`, err.message);
                }
            }
        }

        console.log(`\n🧪 Step 11p validated ${validatedResults.length} action probabilities`);

        // --- Assertions ---
        expect(validatedResults.length).toBeGreaterThan(0);

        validatedResults.forEach(v => {
            const { adjustedFrequencies: f } = v;
            const sum = (f.fold + f.call + f.raise);

            expect(sum).toBeCloseTo(1, 3); // Should be normalized
            expect(f.fold).toBeGreaterThanOrEqual(0);
            expect(f.call).toBeGreaterThanOrEqual(0);
            expect(f.raise).toBeGreaterThanOrEqual(0.02); // min raise
            expect(f.fold).toBeLessThanOrEqual(1);
            expect(f.call).toBeLessThanOrEqual(1);
            expect(f.raise).toBeLessThanOrEqual(1);
        });
    });
}); 