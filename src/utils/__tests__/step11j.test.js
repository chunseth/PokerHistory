const mongoose = require('mongoose');
const { Hand } = require('../../models/models');
const {
    calculateCallFrequency,
    calculateBaseCallFrequency,
    calculateOverallCallFrequency
} = require('../EV_Calculation/Step11/step11j');

// Get position order based on number of players
function getPositionOrder(numPlayers) {
    switch (numPlayers) {
        case 2:
            return ['SB', 'BB'];
        case 3:
            return ['BTN', 'SB', 'BB'];
        case 4:
            return ['CO', 'BTN', 'SB', 'BB'];
        case 5:
            return ['HJ', 'CO', 'BTN', 'SB', 'BB'];
        case 6:
            return ['MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
        case 7:
            return ['UTG', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
        case 8:
            return ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
        case 9:
            return ['UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
        default:
            return ['UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
    }
}

describe('Step 11j: Call Frequency Calculations - Real Hand Validation', () => {
    let realHands = [];
    let callResults = {
        headsUp: [],
        multiway: [],
        blindVsBlind: []
    };

    beforeAll(async () => {
        try {
            await mongoose.connect('mongodb://localhost:27017/pokerHistory', {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('✅ Connected to poker history database');
            
            const hands = await Hand.find().limit(100);
            realHands = hands.map(hand => hand.toObject());
            console.log(`📊 Loaded ${realHands.length} real hands from database`);
            
            // Log the structure of the first hand
            if (realHands.length > 0) {
                console.log('\n📋 Example Hand Structure:');
                console.log(JSON.stringify(realHands[0], null, 2));
            }
        } catch (error) {
            console.error('Failed to connect to database:', error);
        }
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    test('should analyze call frequencies in real hands', () => {
        realHands.forEach((hand, handIndex) => {
            if (!hand.bettingActions || hand.bettingActions.length < 2) return;

            // Get position order for this hand
            const positionOrder = getPositionOrder(hand.numPlayers);

            // Process each betting action in the hand
            hand.bettingActions.forEach((action, actionIndex) => {
                // Skip non-betting actions and blind posts
                if (!action.playerId || !action.position || 
                    !['bet', 'raise'].includes(action.action) ||
                    action.action === 'post') return;

                // Find opponent (next player to act)
                const nextAction = hand.bettingActions[actionIndex + 1];
                if (!nextAction || !nextAction.playerId || !nextAction.position) return;

                // Skip if we don't have pot size info
                if (!hand.potSizes || !hand.potSizes[action.street]) return;

                // Check if this is a blind vs blind situation
                const isBlindVsBlind = (action.position === 'SB' && nextAction.position === 'BB') ||
                                     (action.position === 'BB' && nextAction.position === 'SB');

                // Calculate pot odds using street pot sizes
                const potOdds = {
                    potSize: hand.potSizes[action.street],
                    callAmount: action.amount,
                    potOdds: action.amount / (hand.potSizes[action.street] + action.amount),
                    impliedOdds: 1.5, // Simplified for now
                    stackToPotRatio: action.stackToPot || 5
                };

                // Calculate base call frequency based on pot odds
                let baseCallFrequency = 0.33; // Default to MDF-inspired baseline
                const potOddsRatio = potOdds.potOdds;

                if (potOddsRatio <= 0.2) {
                    baseCallFrequency = 0.80; // Very good odds - call 80% of the time
                } else if (potOddsRatio <= 0.33) {
                    baseCallFrequency = 0.65; // Good odds - call 65% of the time
                } else if (potOddsRatio <= 0.5) {
                    baseCallFrequency = 0.45; // Decent odds - call 45% of the time
                } else if (potOddsRatio <= 0.75) {
                    baseCallFrequency = 0.30; // Poor odds - call 30% of the time
                } else {
                    baseCallFrequency = 0.15; // Very poor odds - call 15% of the time
                }

                // Stack depth info
                const stackDepthInfo = {
                    stackDepthCategory: action.stackToPot > 10 ? 'deep' : action.stackToPot > 5 ? 'medium' : 'shallow',
                    stackToPotRatio: action.stackToPot || 5,
                    isTournament: hand.tournamentId != null,
                    overallStackAdjustment: 0.1 // Will be calculated by step11h
                };

                // Multiway info
                const multiwayAdjustment = {
                    multiwayInfo: {
                        isHeadsUp: hand.numPlayers === 2,
                        isThreeWay: hand.numPlayers === 3,
                        isFourPlusWay: hand.numPlayers > 3,
                        playersLeftToAct: hand.numPlayers - 2,
                        activePlayerCount: hand.numPlayers,
                        multiwayPotOddsAdjustment: 0.1 // Will be calculated by step11i
                    },
                    overallMultiwayAdjustment: 0.1 // Will be calculated by step11i
                };

                // Position info
                const positionAdjustment = {
                    positionInfo: {
                        playerPosition: action.position,
                        opponentPosition: nextAction.position,
                        isPlayerInPosition: positionOrder.indexOf(action.position) < positionOrder.indexOf(nextAction.position),
                        isOpponentInPosition: positionOrder.indexOf(nextAction.position) < positionOrder.indexOf(action.position),
                        isBlindVsBlind,
                        isPlayerBlind: ['SB', 'BB'].includes(action.position),
                        isOpponentBlind: ['SB', 'BB'].includes(nextAction.position)
                    },
                    overallPositionAdjustment: 0.1 // Will be calculated by step11g
                };

                const result = calculateCallFrequency(
                    potOdds,
                    stackDepthInfo,
                    multiwayAdjustment,
                    positionAdjustment,
                    {
                        actionType: action.action,
                        betSizing: action.amount <= action.potSize * 0.5 ? 'small' : 
                                 action.amount <= action.potSize ? 'medium' : 'large',
                        street: action.street,
                        playerId: action.playerId,
                        isContinuationBet: action.isCbet,
                        isBluff: false // Would need hand strength analysis
                    },
                    hand,
                    hand.bettingActions,
                    actionIndex,
                    nextAction.playerId
                );

                // Get actual decision from history
                const actuallyCalledOrRaised = nextAction && ['call', 'raise'].includes(nextAction.action);

                // Categorize results
                if (hand.numPlayers === 2) {
                    callResults.headsUp.push({
                        ...result,
                        street: action.street,
                        actualDecision: actuallyCalledOrRaised ? 'call/raise' : 'fold',
                        potOddsRatio,
                        baseCallFrequency
                    });
                } else if (isBlindVsBlind) {
                    callResults.blindVsBlind.push({
                        ...result,
                        street: action.street,
                        actualDecision: actuallyCalledOrRaised ? 'call/raise' : 'fold',
                        potOddsRatio,
                        baseCallFrequency
                    });
                } else {
                    callResults.multiway.push({
                        ...result,
                        street: action.street,
                        actualDecision: actuallyCalledOrRaised ? 'call/raise' : 'fold',
                        potOddsRatio,
                        baseCallFrequency
                    });
                }

                // Log detailed results for analysis
                console.log(`\nHand ${hand.id}, Action ${actionIndex}, ${action.street}:`);
                console.log(`Position: ${action.position} vs ${nextAction.position}${isBlindVsBlind ? ' (Blind vs Blind)' : ''}`);
                console.log(`Action: ${action.action} ${action.amount}BB into ${hand.potSizes[action.street]}BB`);
                console.log(`Pot Odds: ${(potOddsRatio * 100).toFixed(1)}%`);
                console.log(`Base Call Freq: ${(baseCallFrequency * 100).toFixed(1)}%`);
                console.log(`Predicted Call Freq: ${(result.overallCallFrequency * 100).toFixed(1)}%`);
                console.log(`Actual Decision: ${actuallyCalledOrRaised ? 'Called/Raised' : 'Folded'}`);
                console.log(`Position Adj: ${(result.positionAdjustment * 100).toFixed(1)}%`);
                console.log(`Stack Depth Adj: ${(result.stackDepthAdjustment * 100).toFixed(1)}%`);
                console.log(`Multiway Adj: ${(result.multiwayAdjustment * 100).toFixed(1)}%`);
                console.log(`Explanation: ${result.explanation}`);

                // Validate reasonable bounds
                expect(result.overallCallFrequency).toBeGreaterThanOrEqual(0.05);
                expect(result.overallCallFrequency).toBeLessThanOrEqual(0.95);
            });
        });

        // Log call frequency statistics
        console.log('\n📊 Call Frequency Statistics:');
        
        // Heads-Up Analysis
        const huStats = calculateCallStats(callResults.headsUp);
        console.log('\n🎯 Heads-Up Situations:');
        console.log(`Total Actions: ${callResults.headsUp.length}`);
        console.log(`Call Frequency Range: ${(huStats.min * 100).toFixed(1)}% to ${(huStats.max * 100).toFixed(1)}%`);
        console.log(`Average Call Frequency: ${(huStats.avg * 100).toFixed(1)}%`);
        console.log(`Average Base Call Frequency: ${(huStats.avgBase * 100).toFixed(1)}%`);
        console.log(`Average Pot Odds: ${(huStats.avgPotOdds * 100).toFixed(1)}%`);
        console.log(`Common Streets: ${JSON.stringify(huStats.commonStreets)}`);
        console.log(`Prediction Accuracy: ${(huStats.accuracy * 100).toFixed(1)}%`);
        
        // Multiway Analysis
        const mwStats = calculateCallStats(callResults.multiway);
        console.log('\n👥 Multiway Situations:');
        console.log(`Total Actions: ${callResults.multiway.length}`);
        console.log(`Call Frequency Range: ${(mwStats.min * 100).toFixed(1)}% to ${(mwStats.max * 100).toFixed(1)}%`);
        console.log(`Average Call Frequency: ${(mwStats.avg * 100).toFixed(1)}%`);
        console.log(`Average Base Call Frequency: ${(mwStats.avgBase * 100).toFixed(1)}%`);
        console.log(`Average Pot Odds: ${(mwStats.avgPotOdds * 100).toFixed(1)}%`);
        console.log(`Common Streets: ${JSON.stringify(mwStats.commonStreets)}`);
        console.log(`Prediction Accuracy: ${(mwStats.accuracy * 100).toFixed(1)}%`);
        
        // Blind vs Blind Analysis
        const bvbStats = calculateCallStats(callResults.blindVsBlind);
        console.log('\n🎲 Blind vs Blind Situations:');
        console.log(`Total Actions: ${callResults.blindVsBlind.length}`);
        console.log(`Call Frequency Range: ${(bvbStats.min * 100).toFixed(1)}% to ${(bvbStats.max * 100).toFixed(1)}%`);
        console.log(`Average Call Frequency: ${(bvbStats.avg * 100).toFixed(1)}%`);
        console.log(`Average Base Call Frequency: ${(bvbStats.avgBase * 100).toFixed(1)}%`);
        console.log(`Average Pot Odds: ${(bvbStats.avgPotOdds * 100).toFixed(1)}%`);
        console.log(`Common Streets: ${JSON.stringify(bvbStats.commonStreets)}`);
        console.log(`Prediction Accuracy: ${(bvbStats.accuracy * 100).toFixed(1)}%`);
    });

    test('should handle missing input data gracefully', () => {
        const result = calculateCallFrequency(null, null, null, null, null, null, [], 0, '');
        expect(result.overallCallFrequency).toBe(0);
        expect(result.explanation).toBe('Missing input data');
    });
});

function calculateCallStats(results) {
    if (!results.length) {
        return {
            min: 0,
            max: 0,
            avg: 0,
            avgBase: 0,
            avgPotOdds: 0,
            commonStreets: {},
            accuracy: 0
        };
    }

    const frequencies = results.map(r => r.overallCallFrequency);
    const baseFrequencies = results.map(r => r.baseCallFrequency);
    const potOdds = results.map(r => r.potOddsRatio);
    const streets = results.map(r => r.street);
    const streetCounts = streets.reduce((acc, street) => {
        acc[street] = (acc[street] || 0) + 1;
        return acc;
    }, {});

    // Calculate prediction accuracy
    const correctPredictions = results.filter(r => {
        const predictedCall = r.overallCallFrequency > 0.5;
        const actuallyCalledOrRaised = r.actualDecision === 'call/raise';
        return predictedCall === actuallyCalledOrRaised;
    }).length;

    return {
        min: Math.min(...frequencies),
        max: Math.max(...frequencies),
        avg: frequencies.reduce((a, b) => a + b, 0) / frequencies.length,
        avgBase: baseFrequencies.reduce((a, b) => a + b, 0) / baseFrequencies.length,
        avgPotOdds: potOdds.reduce((a, b) => a + b, 0) / potOdds.length,
        commonStreets: streetCounts,
        accuracy: correctPredictions / results.length
    };
} 