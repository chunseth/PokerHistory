const mongoose = require('mongoose');
const { Hand } = require('../../models/models');
const { calculateWeightedResponseProbabilities } = require('../EV_Calculation/Step11/step11o1');
const { calculateNashEquilibriumGTOResponses } = require('../EV_Calculation/Step11/step11o');

describe('Step 11o1 (Weighted) and Step 11o (Nash Equilibrium) Integration Test', () => {
    let realHands = [];

    beforeAll(async () => {
        try {
            // Connect to database
            await mongoose.connect('mongodb://localhost:27017/pokerHistory', {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('✅ Connected to poker history database');
            
            // Fetch real hands from database
            const hands = await Hand.find({}).limit(20);
            realHands = hands.map(hand => hand.toObject());
            console.log(`📊 Loaded ${realHands.length} real hands from database`);
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            realHands = [];
        }
    });

    afterAll(async () => {
        try {
            await mongoose.disconnect();
            console.log('🔌 Disconnected from database');
        } catch (error) {
            console.error('Error disconnecting from database:', error.message);
        }
    });

    test('should calculate both weighted and GTO response frequencies for real hands', () => {
        // Check if we have hands to process
        if (!realHands || realHands.length === 0) {
            console.log('No hands available for testing');
            return;
        }

        const results = [];
        let processedCount = 0;

        // Process first 10 hands with betting actions
        for (const hand of realHands) {
            if (processedCount >= 10) break;
            
            if (!hand.bettingActions || hand.bettingActions.length === 0) {
                continue;
            }

            // Find betting actions (skip checks and folds, and zero amounts)
            const bettingActions = hand.bettingActions.filter(action => 
                action.action !== 'check' && action.action !== 'fold' && action.amount > 0
            );

            if (bettingActions.length === 0) continue;

            // Process each betting action
            for (let i = 0; i < bettingActions.length; i++) {
                const action = bettingActions[i];
                
                // Use amount for bet size
                const betSize = action.amount;
                // Fallback for pot size (if not present, set to null)
                const potSize = action.potSize || null;

                // Skip if no bet size
                if (!betSize) continue;

                const actionIndex = hand.bettingActions.indexOf(action);
                const board = hand.board || [];

                try {
                    // Import step functions to get real calculated adjustments
                    const { determinePlayerActionType } = require('../EV_Calculation/Step11/step11a');
                    const { calculatePotOddsForOpponent } = require('../EV_Calculation/Step11/step11b');
                    const { calculateOpponentRangeStrength } = require('../EV_Calculation/Step11/step11c');
                    const { determineStreetSpecificResponsePatterns } = require('../EV_Calculation/Step11/Step11d');
                    const { calculateBaseFoldFrequency } = require('../EV_Calculation/Step11/step11e');
                    const { adjustForOpponentRangeStrength } = require('../EV_Calculation/Step11/step11f');
                    const { adjustForMultiwayVsHeadsUp } = require('../EV_Calculation/Step11/step11i');
                    const { adjustRaiseFrequencyForBetSizing } = require('../EV_Calculation/Step11/step11l');
                    const { analyzeOpponentPreviousActions } = require('../EV_Calculation/Step11/step11m');

                    // Debug: Log action and hand data
                    console.log(`\nDebug Action ${i}:`, {
                        action: action.action,
                        amount: action.amount,
                        street: action.street,
                        board: board,
                        boardLength: board.length
                    });

                    // Calculate real adjustments using step functions
                    const playerAction = determinePlayerActionType(action, hand, hand.bettingActions, actionIndex);
                    console.log('playerAction:', playerAction);
                    
                    const potOdds = calculatePotOddsForOpponent(playerAction, hand, hand.bettingActions, actionIndex, action.playerId || 'villain');
                    console.log('potOdds:', potOdds);
                    
                    const rangeStrength = calculateOpponentRangeStrength(hand, hand.bettingActions, action.playerId || 'villain', actionIndex, playerAction, potOdds);
                    console.log('rangeStrength:', rangeStrength);
                    
                    const streetPatterns = determineStreetSpecificResponsePatterns(playerAction, potOdds, rangeStrength);
                    console.log('streetPatterns:', streetPatterns);
                    
                    const baseFrequencies = calculateBaseFoldFrequency(playerAction, potOdds, rangeStrength, streetPatterns);
                    console.log('baseFrequencies:', baseFrequencies);
                    
                    const rangeAdjustments = adjustForOpponentRangeStrength(rangeStrength, playerAction, potOdds, baseFrequencies.baseFoldFrequency);
                    console.log('rangeAdjustments:', rangeAdjustments);
                    
                    const stackDepthAdjustment = {}; // Placeholder, can be added if you have stack depth logic
                    const multiwayAdjustments = adjustForMultiwayVsHeadsUp(hand, hand.bettingActions, actionIndex, playerAction, stackDepthAdjustment);
                    console.log('multiwayAdjustments:', multiwayAdjustments);
                    
                    const betInfo = {
                        betSize: playerAction.betSize,
                        potSize: playerAction.potSize,
                        isAllIn: playerAction.isAllIn,
                        betSizing: playerAction.betSizing
                    };
                    console.log('betInfo:', betInfo);
                    
                    const currentRaiseFreq = 0.1; // Placeholder, you can use a more dynamic value if available
                    const betSizingAdjustments = adjustRaiseFrequencyForBetSizing(betInfo, currentRaiseFreq, rangeStrength);
                    console.log('betSizingAdjustments:', betSizingAdjustments);
                    
                    const actionPatternAdjustments = analyzeOpponentPreviousActions(hand.bettingActions, actionIndex, action.playerId || 'villain');
                    console.log('actionPatternAdjustments:', actionPatternAdjustments);
                    
                    // Board texture adjustments (already using step11n in your code)
                    const { adjustForBoardTexture } = require('../EV_Calculation/Step11/step11n');
                    const boardTextureAdjustments = adjustForBoardTexture({ ...hand, board }, hand.bettingActions, actionIndex, action.playerId || 'villain', playerAction, potOdds);
                    console.log('boardTextureAdjustments:', boardTextureAdjustments);

                    // Weighted
                    const weighted = calculateWeightedResponseProbabilities(
                        { ...hand, board },
                        hand.bettingActions,
                        actionIndex,
                        action.playerId || 'villain',
                        playerAction,
                        potOdds,
                        rangeStrength,
                        streetPatterns,
                        baseFrequencies,
                        rangeAdjustments,
                        {}, // positionAdjustments (not implemented here)
                        {}, // stackAdjustments (not implemented here)
                        multiwayAdjustments,
                        {}, // callAnalysis (not implemented here)
                        {}, // raiseAnalysis (not implemented here)
                        betSizingAdjustments,
                        actionPatternAdjustments,
                        boardTextureAdjustments
                    );
                    console.log('weighted result:', weighted);

                    // GTO
                    const gto = calculateNashEquilibriumGTOResponses(
                        { ...hand, board },
                        hand.bettingActions,
                        actionIndex,
                        action.playerId || 'villain',
                        weighted,
                        potOdds,
                        playerAction,
                        boardTextureAdjustments,
                        {}, // positionAdjustments (not implemented here)
                        {}, // stackAdjustments (not implemented here)
                    );
                    console.log('gto result:', gto);

                    // Calculate pot size for display
                    const potSize = potOdds.potSize || playerAction.potSize || 100; // Fallback to 100 if not available

                    results.push({
                        handId: hand._id,
                        actionIndex,
                        actionType: action.action,
                        betSize: betSize,
                        potSize: potSize,
                        callAmount: action.callAmount,
                        board: board.join(' '),
                        weighted: {
                            fold: weighted.probabilities?.fold || 0,
                            call: weighted.probabilities?.call || 0,
                            raise: weighted.probabilities?.raise || 0
                        },
                        gto: {
                            fold: gto.frequencies?.fold || 0,
                            call: gto.frequencies?.call || 0,
                            raise: gto.frequencies?.raise || 0
                        }
                    });

                    processedCount++;
                    if (processedCount >= 10) break;

                } catch (error) {
                    console.log(`Error processing action ${i} in hand ${hand._id}:`, error.message);
                    continue;
                }
            }
        }

        console.log(`\n=== Step 11o1 (Weighted) vs Step 11o (GTO) Results ===`);
        console.log(`Processed ${results.length} betting actions from real hands\n`);

        results.forEach((result, index) => {
            console.log(`Action ${index + 1}:`);
            console.log(`  Hand ID: ${result.handId}`);
            console.log(`  Action: ${result.actionType} $${result.betSize} (Pot: $${result.potSize})`);
            console.log(`  Board: ${result.board}`);
            console.log(`  Weighted: Fold ${(result.weighted.fold * 100).toFixed(1)}%, Call ${(result.weighted.call * 100).toFixed(1)}%, Raise ${(result.weighted.raise * 100).toFixed(1)}%`);
            console.log(`  GTO:     Fold ${(result.gto.fold * 100).toFixed(1)}%, Call ${(result.gto.call * 100).toFixed(1)}%, Raise ${(result.gto.raise * 100).toFixed(1)}%`);
            console.log('');
        });

        // Basic validation
        expect(results.length).toBeGreaterThan(0);
        
        results.forEach(result => {
            // Check that all probabilities are between 0 and 1
            expect(result.weighted.fold).toBeGreaterThanOrEqual(0);
            expect(result.weighted.call).toBeGreaterThanOrEqual(0);
            expect(result.weighted.raise).toBeGreaterThanOrEqual(0);
            expect(result.gto.fold).toBeGreaterThanOrEqual(0);
            expect(result.gto.call).toBeGreaterThanOrEqual(0);
            expect(result.gto.raise).toBeGreaterThanOrEqual(0);
        });
    });
}); 