const mongoose = require('mongoose');
const { Hand } = require('../../models/models');
const {
    adjustForPosition,
    getPositionInformation,
    calculateInPositionAdjustment,
    calculateOutOfPositionAdjustment,
    calculateBlindAdjustment,
    calculateOverallPositionAdjustment
} = require('../EV_Calculation/Step11/step11g');

describe('Step 11g: Position-Based Adjustments - Real Hand Validation', () => {
    let realHands = [];
    let adjustmentResults = {
        inPosition: [],
        outOfPosition: [],
        blindVsBlind: []
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

    test('should analyze position-based patterns in real hands', () => {
        realHands.forEach((hand, handIndex) => {
            if (!hand.bettingActions || hand.bettingActions.length < 2) return;

            // Process each betting action in the hand
            hand.bettingActions.forEach((action, actionIndex) => {
                if (!action.playerId || !action.position) return;

                // Find opponent (next player to act)
                const nextAction = hand.bettingActions[actionIndex + 1];
                if (!nextAction || !nextAction.playerId || !nextAction.position) return;

                // Check if this is a blind vs blind situation
                const isBlindVsBlind = (action.position === 'SB' && nextAction.position === 'BB') ||
                                     (action.position === 'BB' && nextAction.position === 'SB');

                // Mock range strength adjustment from step 11f
                const mockRangeStrengthAdjustment = {
                    overallAdjustment: Math.random() * 0.2 - 0.1 // -10% to +10%
                };

                // Create a modified hand object with position information
                const handWithPositions = {
                    ...hand,
                    players: [
                        { id: action.playerId, position: action.position },
                        { id: nextAction.playerId, position: nextAction.position }
                    ],
                    isBlindVsBlind // Add this flag for the position adjustment logic
                };

                const result = adjustForPosition(
                    {
                        playerId: action.playerId,
                        actionType: action.action,
                        betSizing: action.amount > 0 ? (action.amount > hand.potSize * 0.75 ? 'large' : 'small') : 'none',
                        street: action.street,
                        isContinuationBet: false,
                        isValueBet: false,
                        isBluff: false
                    },
                    handWithPositions,
                    nextAction.playerId,
                    mockRangeStrengthAdjustment
                );

                // Categorize results by position type
                if (isBlindVsBlind) {
                    adjustmentResults.blindVsBlind.push({
                        ...result,
                        street: action.street // Add street info for analysis
                    });
                } else if (result.positionInfo.isOpponentInPosition) {
                    adjustmentResults.inPosition.push({
                        ...result,
                        street: action.street
                    });
                } else if (result.positionInfo.isPlayerInPosition) {
                    adjustmentResults.outOfPosition.push({
                        ...result,
                        street: action.street
                    });
                }

                // Log detailed results for analysis
                console.log(`\nHand ${hand.id}, Action ${actionIndex}, ${action.street}:`);
                console.log(`Position Info: ${action.position} vs ${nextAction.position}${isBlindVsBlind ? ' (Blind vs Blind)' : ''}`);
                console.log(`Action: ${action.action} ${action.amount}`);
                console.log(`In Position Adj: ${result.inPositionAdjustment.toFixed(3)}`);
                console.log(`Out of Position Adj: ${result.outOfPositionAdjustment.toFixed(3)}`);
                console.log(`Blind Adj: ${result.blindAdjustment.toFixed(3)}`);
                console.log(`Overall Adj: ${result.overallPositionAdjustment.toFixed(3)}`);
                console.log(`Final Fold Freq: ${result.adjustedFoldFrequency.toFixed(3)}`);
                console.log(`Explanation: ${result.explanation}`);

                // Validate adjustment ranges
                expect(result.adjustedFoldFrequency).toBeGreaterThanOrEqual(0.05);
                expect(result.adjustedFoldFrequency).toBeLessThanOrEqual(0.95);
            });
        });

        // Log position-based statistics
        console.log('\n📊 Position-Based Statistics:');
        
        // In-Position Analysis
        const ipStats = calculatePositionStats(adjustmentResults.inPosition);
        console.log('\n💺 In-Position Actions:');
        console.log(`Total Actions: ${adjustmentResults.inPosition.length}`);
        console.log(`Adjustment Range: ${(ipStats.min * 100).toFixed(1)}% to ${(ipStats.max * 100).toFixed(1)}%`);
        console.log(`Average Adjustment: ${(ipStats.avg * 100).toFixed(1)}%`);
        console.log(`Common Streets: ${JSON.stringify(ipStats.commonStreets)}`);
        
        // Out-of-Position Analysis
        const oopStats = calculatePositionStats(adjustmentResults.outOfPosition);
        console.log('\n🔄 Out-of-Position Actions:');
        console.log(`Total Actions: ${adjustmentResults.outOfPosition.length}`);
        console.log(`Adjustment Range: ${(oopStats.min * 100).toFixed(1)}% to ${(oopStats.max * 100).toFixed(1)}%`);
        console.log(`Average Adjustment: ${(oopStats.avg * 100).toFixed(1)}%`);
        console.log(`Common Streets: ${JSON.stringify(oopStats.commonStreets)}`);
        
        // Blind vs Blind Analysis
        const bvbStats = calculatePositionStats(adjustmentResults.blindVsBlind);
        console.log('\n🎯 Blind vs Blind Actions:');
        console.log(`Total Actions: ${adjustmentResults.blindVsBlind.length}`);
        console.log(`Adjustment Range: ${(bvbStats.min * 100).toFixed(1)}% to ${(bvbStats.max * 100).toFixed(1)}%`);
        console.log(`Average Adjustment: ${(bvbStats.avg * 100).toFixed(1)}%`);
        console.log(`Common Streets: ${JSON.stringify(bvbStats.commonStreets)}`);
    });

    test('should handle missing input data gracefully', () => {
        const result = adjustForPosition(null, null, null, null);
        
        expect(result).toBeDefined();
        expect(result.adjustedFoldFrequency).toBe(0.5);
        expect(result.explanation).toBe('Missing input data');
    });
});

function calculatePositionStats(results) {
    if (!results.length) {
        return {
            min: 0,
            max: 0,
            avg: 0,
            commonStreets: {}
        };
    }

    const adjustments = results.map(r => r.overallPositionAdjustment);
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