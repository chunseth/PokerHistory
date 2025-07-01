const mongoose = require('mongoose');
const { Hand } = require('../../models/models');

const { calculateWeightedResponseProbabilities } = require('../EV_Calculation/Step11/step11o1');
const { validateResponseFrequencies } = require('../EV_Calculation/Step11/step11p');
const { calculateNashEquilibriumGTOResponses } = require('../EV_Calculation/Step11/step11o');
const { storeResponseFrequencies, storeGTOFrequencies } = require('../EV_Calculation/Step11/step11q');

// Helper imports to recreate pipeline context
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

describe('Step 11q: Persistence Test', () => {
    let sampleHand;
    let actionIndex;

    beforeAll(async () => {
        await mongoose.connect('mongodb://localhost:27017/pokerHistory', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        sampleHand = await Hand.findOne({ 'bettingActions.0': { $exists: true } });
        if (!sampleHand) throw new Error('No hand with betting actions found in DB');
    });

    afterAll(async () => {
        await mongoose.disconnect();
    });

    test('should store validated and GTO frequencies inside betting action', async () => {
        const hand = sampleHand.toObject();
        const ba = hand.bettingActions.find(a => a.amount > 0) || hand.bettingActions[0];
        actionIndex = hand.bettingActions.indexOf(ba);
        const board = hand.board || [];

        // Build context
        const playerAction = determinePlayerActionType(ba, hand, hand.bettingActions, actionIndex);
        const potOdds = calculatePotOddsForOpponent(playerAction, hand, hand.bettingActions, actionIndex, ba.playerId || 'villain');
        const rangeStrength = calculateOpponentRangeStrength(hand, hand.bettingActions, ba.playerId || 'villain', actionIndex, playerAction, potOdds);
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
        const actionPatternAdj = analyzeOpponentPreviousActions(hand.bettingActions, actionIndex, ba.playerId || 'villain');
        const boardTextureAdj = adjustForBoardTexture({ ...hand, board }, hand.bettingActions, actionIndex, ba.playerId || 'villain', playerAction, potOdds);

        // Step 11o1
        const weighted = calculateWeightedResponseProbabilities(
            { ...hand, board },
            hand.bettingActions,
            actionIndex,
            ba.playerId || 'villain',
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

        const validated = validateResponseFrequencies(weighted);

        // Persist response frequencies
        await storeResponseFrequencies(hand._id, actionIndex, validated);

        // Step 11o
        const gto = calculateNashEquilibriumGTOResponses(
            { ...hand, board },
            hand.bettingActions,
            actionIndex,
            ba.playerId || 'villain',
            weighted,
            potOdds,
            playerAction,
            boardTextureAdj,
            {},
            {}
        );

        await storeGTOFrequencies(hand._id, actionIndex, gto);

        // Reload hand to verify persistence
        const updatedHand = await Hand.findById(hand._id);
        const stored = updatedHand.bettingActions[actionIndex];

        expect(stored.responseFrequencies).toBeDefined();
        expect(stored.gtoFrequencies).toBeDefined();

        const sum = stored.responseFrequencies.fold + stored.responseFrequencies.call + stored.responseFrequencies.raise;
        expect(sum).toBeCloseTo(1, 3);
    });
}); 