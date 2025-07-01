const mongoose = require('mongoose');
const { Hand } = require('../../models/models');
const {
    calculateRaiseFrequency,
    calculateBaseRaiseFrequency,
    calculateOverallRaiseFrequency
} = require('../EV_Calculation/Step11/step11k');

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

describe('Step 11k: Raise Frequency Calculations - Real Hand Validation', () => {
    let realHands = [];
    let raiseResults = {
        headsUp: [],
        multiway: [],
        blindVsBlind: []
    };

    // Track adjustment ranges
    let adjustmentRanges = {
        base: { min: Infinity, max: -Infinity },
        potOdds: { min: Infinity, max: -Infinity },
        position: { min: Infinity, max: -Infinity },
        stackDepth: { min: Infinity, max: -Infinity }
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

    test('should analyze raise frequencies in real hands', () => {
        realHands.forEach((hand, handIndex) => {
            if (!hand.bettingActions || hand.bettingActions.length < 2) return;

            // Get position order for this hand
            const positionOrder = getPositionOrder(hand.numPlayers);

            // Process each betting action in the hand
            hand.bettingActions.forEach((action, actionIndex) => {
                // Skip non-betting actions and blind posts
                if (!action.playerId || !action.position || 
                    !['bet', 'call'].includes(action.action) ||
                    action.action === 'post') return;

                // Find opponent (next player to act)
                const nextAction = hand.bettingActions[actionIndex + 1];
                if (!nextAction || !nextAction.playerId || !nextAction.position) return;

                // Skip if we don't have pot size info
                if (!hand.potSizes || !hand.potSizes[action.street]) return;

                // Add players array to hand for position calculations
                hand.players = [
                    { id: action.playerId, position: action.position },
                    { id: nextAction.playerId, position: nextAction.position }
                ];

                // Check if this is a blind vs blind situation
                const isBlindVsBlind = (action.position === 'SB' && nextAction.position === 'BB') ||
                                     (action.position === 'BB' && nextAction.position === 'SB');

                // Calculate pot odds using street pot sizes
                const potOdds = {
                    potSize: hand.potSizes[action.street],
                    callAmount: action.amount,
                    potOdds: action.amount / (hand.potSizes[action.street] + action.amount),
                    impliedOdds: 1.5, // Simplified for now
                    stackSize: hand.playerStacks[action.playerId] / (hand.blindLevel?.bigBlind || 1) // Convert to BB
                };

                // Skip if we don't have stack size info or blind level info
                if (!hand.playerStacks || !hand.playerStacks[action.playerId] || !hand.blindLevel?.bigBlind) return;

                // Mock call frequency data (would come from step11j in real usage)
                const callFrequency = {
                    baseCallFrequency: 0.5,
                    overallCallFrequency: 0.45,
                    foldFrequency: 0.35, // Add fold frequency from previous steps
                    potOddsAdjustment: 0.02,
                    impliedOddsAdjustment: 0.01,
                    positionAdjustment: 0.03,
                    stackDepthAdjustment: 0.01,
                    actionTypeAdjustment: -0.02,
                    streetAdjustment: -0.01
                };

                // Create player action object with actual pot size
                const playerAction = {
                    actionType: action.action,
                    betSizing: action.amount <= hand.potSizes[action.street] * 0.5 ? 'small' : 
                             action.amount <= hand.potSizes[action.street] ? 'medium' : 'large',
                    street: action.street,
                    playerId: action.playerId,
                    isContinuationBet: action.isCbet,
                    isBluff: false, // Would need hand strength analysis
                    potSize: hand.potSizes[action.street]
                };

                const result = calculateRaiseFrequency(
                    potOdds,
                    callFrequency,
                    playerAction,
                    hand,
                    hand.bettingActions,
                    actionIndex,
                    nextAction.playerId
                );

                // Update adjustment ranges
                adjustmentRanges.base.min = Math.min(adjustmentRanges.base.min, result.baseRaiseFrequency);
                adjustmentRanges.base.max = Math.max(adjustmentRanges.base.max, result.baseRaiseFrequency);
                adjustmentRanges.potOdds.min = Math.min(adjustmentRanges.potOdds.min, result.potOddsRaiseAdjustment);
                adjustmentRanges.potOdds.max = Math.max(adjustmentRanges.potOdds.max, result.potOddsRaiseAdjustment);
                adjustmentRanges.position.min = Math.min(adjustmentRanges.position.min, result.positionRaiseAdjustment);
                adjustmentRanges.position.max = Math.max(adjustmentRanges.position.max, result.positionRaiseAdjustment);
                adjustmentRanges.stackDepth.min = Math.min(adjustmentRanges.stackDepth.min, result.stackDepthRaiseAdjustment);
                adjustmentRanges.stackDepth.max = Math.max(adjustmentRanges.stackDepth.max, result.stackDepthRaiseAdjustment);

                // Get actual decision from history
                const actuallyRaised = nextAction && nextAction.action === 'raise';

                // Categorize results
                if (hand.numPlayers === 2) {
                    raiseResults.headsUp.push({
                        ...result,
                        street: action.street,
                        actualDecision: actuallyRaised ? 'raise' : 'other',
                        potOddsRatio: potOdds.potOdds,
                        baseRaiseFrequency: result.baseRaiseFrequency
                    });
                } else if (isBlindVsBlind) {
                    raiseResults.blindVsBlind.push({
                        ...result,
                        street: action.street,
                        actualDecision: actuallyRaised ? 'raise' : 'other',
                        potOddsRatio: potOdds.potOdds,
                        baseRaiseFrequency: result.baseRaiseFrequency
                    });
                } else {
                    raiseResults.multiway.push({
                        ...result,
                        street: action.street,
                        actualDecision: actuallyRaised ? 'raise' : 'other',
                        potOddsRatio: potOdds.potOdds,
                        baseRaiseFrequency: result.baseRaiseFrequency
                    });
                }

                // Log detailed results for analysis
                console.log(`\nHand ${hand.id}, Action ${actionIndex}, ${action.street}:`);
                console.log(`Position: ${action.position} vs ${nextAction.position}${isBlindVsBlind ? ' (Blind vs Blind)' : ''}`);
                console.log(`Action: ${action.action} ${action.amount}BB into ${hand.potSizes[action.street]}BB`);
                console.log(`Stack Size: ${potOdds.stackSize}BB`);
                console.log(`Stack-to-Pot Ratio: ${(potOdds.stackSize / hand.potSizes[action.street]).toFixed(1)}`);
                console.log(`Pot Odds: ${(potOdds.potOdds * 100).toFixed(1)}%`);
                console.log(`Base Raise Freq: ${(result.baseRaiseFrequency * 100).toFixed(1)}%`);
                console.log(`Predicted Raise Freq: ${(result.overallRaiseFrequency * 100).toFixed(1)}%`);
                console.log(`Actual Decision: ${actuallyRaised ? 'Raised' : 'Other'}`);
                console.log(`Position Adj: ${(result.positionRaiseAdjustment * 100).toFixed(1)}%`);
                console.log(`Stack Depth Adj: ${(result.stackDepthRaiseAdjustment * 100).toFixed(1)}%`);
                console.log(`Action Type Adj: ${(result.actionTypeRaiseAdjustment * 100).toFixed(1)}%`);
                console.log(`Street Adj: ${(result.streetRaiseAdjustment * 100).toFixed(1)}%`);
                console.log(`Explanation: ${result.explanation}`);

                // Validate reasonable bounds for adjustments
                expect(result.baseRaiseFrequency).toBeGreaterThanOrEqual(0.01);
                expect(result.baseRaiseFrequency).toBeLessThanOrEqual(0.3);
                expect(result.potOddsRaiseAdjustment).toBeGreaterThanOrEqual(-0.1);
                expect(result.potOddsRaiseAdjustment).toBeLessThanOrEqual(0.1);
                expect(result.positionRaiseAdjustment).toBeGreaterThanOrEqual(-0.1);
                expect(result.positionRaiseAdjustment).toBeLessThanOrEqual(0.1);
                expect(result.stackDepthRaiseAdjustment).toBeGreaterThanOrEqual(-0.1);
                expect(result.stackDepthRaiseAdjustment).toBeLessThanOrEqual(0.1);
                expect(result.overallRaiseFrequency).toBeGreaterThanOrEqual(0.01);
                expect(result.overallRaiseFrequency).toBeLessThanOrEqual(0.4);
            });
        });

        // Log adjustment ranges
        console.log('\n📊 Adjustment Ranges:');
        console.log(`Base Raise Frequency: ${(adjustmentRanges.base.min * 100).toFixed(1)}% to ${(adjustmentRanges.base.max * 100).toFixed(1)}%`);
        console.log(`Pot Odds Adjustment: ${(adjustmentRanges.potOdds.min * 100).toFixed(1)}% to ${(adjustmentRanges.potOdds.max * 100).toFixed(1)}%`);
        console.log(`Position Adjustment: ${(adjustmentRanges.position.min * 100).toFixed(1)}% to ${(adjustmentRanges.position.max * 100).toFixed(1)}%`);
        console.log(`Stack Depth Adjustment: ${(adjustmentRanges.stackDepth.min * 100).toFixed(1)}% to ${(adjustmentRanges.stackDepth.max * 100).toFixed(1)}%`);

        // Log raise frequency statistics
        console.log('\n📊 Raise Frequency Statistics:');
        
        // Heads-Up Analysis
        const huStats = calculateRaiseStats(raiseResults.headsUp);
        console.log('\n🎯 Heads-Up Situations:');
        console.log(`Total Actions: ${raiseResults.headsUp.length}`);
        console.log(`Raise Frequency Range: ${(huStats.min * 100).toFixed(1)}% to ${(huStats.max * 100).toFixed(1)}%`);
        console.log(`Average Raise Frequency: ${(huStats.avg * 100).toFixed(1)}%`);
        console.log(`Average Base Raise Frequency: ${(huStats.avgBase * 100).toFixed(1)}%`);
        console.log(`Average Pot Odds: ${(huStats.avgPotOdds * 100).toFixed(1)}%`);
        console.log(`Common Streets: ${JSON.stringify(huStats.commonStreets)}`);
        console.log(`Binary Prediction Accuracy: ${(huStats.accuracy * 100).toFixed(1)}%`);
        console.log(`Brier Score: ${huStats.brierScore.toFixed(3)} (lower is better)`);
        
        // Multiway Analysis
        const mwStats = calculateRaiseStats(raiseResults.multiway);
        console.log('\n👥 Multiway Situations:');
        console.log(`Total Actions: ${raiseResults.multiway.length}`);
        console.log(`Raise Frequency Range: ${(mwStats.min * 100).toFixed(1)}% to ${(mwStats.max * 100).toFixed(1)}%`);
        console.log(`Average Raise Frequency: ${(mwStats.avg * 100).toFixed(1)}%`);
        console.log(`Average Base Raise Frequency: ${(mwStats.avgBase * 100).toFixed(1)}%`);
        console.log(`Average Pot Odds: ${(mwStats.avgPotOdds * 100).toFixed(1)}%`);
        console.log(`Common Streets: ${JSON.stringify(mwStats.commonStreets)}`);
        console.log(`Binary Prediction Accuracy: ${(mwStats.accuracy * 100).toFixed(1)}%`);
        console.log(`Brier Score: ${mwStats.brierScore.toFixed(3)} (lower is better)`);
        
        // Blind vs Blind Analysis
        const bvbStats = calculateRaiseStats(raiseResults.blindVsBlind);
        console.log('\n🎲 Blind vs Blind Situations:');
        console.log(`Total Actions: ${raiseResults.blindVsBlind.length}`);
        console.log(`Raise Frequency Range: ${(bvbStats.min * 100).toFixed(1)}% to ${(bvbStats.max * 100).toFixed(1)}%`);
        console.log(`Average Raise Frequency: ${(bvbStats.avg * 100).toFixed(1)}%`);
        console.log(`Average Base Raise Frequency: ${(bvbStats.avgBase * 100).toFixed(1)}%`);
        console.log(`Average Pot Odds: ${(bvbStats.avgPotOdds * 100).toFixed(1)}%`);
        console.log(`Common Streets: ${JSON.stringify(bvbStats.commonStreets)}`);
        console.log(`Binary Prediction Accuracy: ${(bvbStats.accuracy * 100).toFixed(1)}%`);
        console.log(`Brier Score: ${bvbStats.brierScore.toFixed(3)} (lower is better)`);
    });
});

function calculateRaiseStats(results) {
    if (!results || results.length === 0) {
        return {
            min: 0,
            max: 0,
            avg: 0,
            avgBase: 0,
            avgPotOdds: 0,
            commonStreets: {},
            accuracy: 0,
            brierScore: 0
        };
    }

    const frequencies = results.map(r => r.overallRaiseFrequency);
    const baseFrequencies = results.map(r => r.baseRaiseFrequency);
    const potOdds = results.map(r => r.potOddsRatio);
    
    // Calculate street frequencies
    const streets = {};
    results.forEach(r => {
        streets[r.street] = (streets[r.street] || 0) + 1;
    });

    // Calculate prediction accuracy
    const correctPredictions = results.filter(r => {
        const predictedRaise = r.overallRaiseFrequency > 0.05; // Lower threshold to match our actual raise frequencies
        return (predictedRaise && r.actualDecision === 'raise') ||
               (!predictedRaise && r.actualDecision !== 'raise');
    }).length;

    // Calculate Brier score (mean squared error of probability predictions)
    const brierScore = results.reduce((sum, r) => {
        const actualProb = r.actualDecision === 'raise' ? 1 : 0;
        return sum + Math.pow(r.overallRaiseFrequency - actualProb, 2);
    }, 0) / results.length;

    return {
        min: Math.min(...frequencies),
        max: Math.max(...frequencies),
        avg: frequencies.reduce((a, b) => a + b, 0) / frequencies.length,
        avgBase: baseFrequencies.reduce((a, b) => a + b, 0) / baseFrequencies.length,
        avgPotOdds: potOdds.reduce((a, b) => a + b, 0) / potOdds.length,
        commonStreets: streets,
        accuracy: correctPredictions / results.length,
        brierScore: brierScore // Lower is better, perfect score is 0
    };
} 