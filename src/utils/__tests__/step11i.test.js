const mongoose = require('mongoose');
const { Hand } = require('../../models/models');
const { determinePlayerActionType } = require('../EV_Calculation/Step11/step11a');
const { calculatePotOddsForOpponent } = require('../EV_Calculation/Step11/step11b');
const {
    adjustForMultiwayVsHeadsUp,
    getMultiwayInformation,
    countActivePlayers,
    countPlayersLeftToAct,
    calculateMultiwayPotOddsAdjustment,
    analyzeMultiwayDynamics,
    calculateHeadsUpAdjustment,
    calculateThreeWayAdjustment,
    calculateFourPlusWayAdjustment,
    calculateOverallMultiwayAdjustment
} = require('../EV_Calculation/Step11/step11i');

describe('Step 11i: Multiway vs Heads-Up Adjustments - Real Hand Validation', () => {
    let realHands = [];
    let adjustmentResults = {
        heads_up: [],
        three_way: [],
        four_plus_way: []
    };

    beforeAll(async () => {
        try {
            await mongoose.connect('mongodb://localhost:27017/pokerHistory', {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('✅ Connected to poker history database');
            
            // Query hands with more than 2 players to ensure we get multiway situations
            const hands = await Hand.find({ numPlayers: { $gt: 2 } }).limit(1000);
            realHands = hands.map(hand => hand.toObject());
            console.log(`📊 Loaded ${realHands.length} real hands from database`);
        } catch (error) {
            console.error('Failed to connect to database:', error);
        }
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    test('should analyze multiway patterns in real hands', () => {
        let totalActions = 0;
        let multiwayDistribution = {
            heads_up: 0,
            three_way: 0,
            four_plus_way: 0
        };

        let streetDistribution = {
            preflop: 0,
            flop: 0,
            turn: 0,
            river: 0
        };

        // Only log first 2 hands for clarity
        const HANDS_TO_LOG = 2;

        realHands.forEach((hand, handIndex) => {
            const actions = hand.bettingActions || [];
            let foldedPlayers = new Set(); // Track folded players throughout the hand
            let playersInPot = new Set(); // Track players who have put money in the pot
            let currentStreet = null;
            
            if (handIndex < HANDS_TO_LOG) {
                console.log(`\nHand ${hand.id}:`);
                console.log(`Total Players: ${hand.numPlayers}`);
                console.log(`Actions: ${actions.length}`);
            }
            
            actions.forEach((action, actionIndex) => {
                // Reset players in pot when street changes
                if (action.street !== currentStreet) {
                    currentStreet = action.street;
                    playersInPot.clear();
                }

                // Skip fold actions and null actions for statistics
                if (!action || !action.action) {
                    if (handIndex < HANDS_TO_LOG) {
                        console.log(`Skipping null action ${actionIndex}`);
                    }
                    return;
                }

                // Update folded players set
                if (action.action === 'fold') {
                    foldedPlayers.add(action.playerIndex);
                    if (handIndex < HANDS_TO_LOG) {
                        console.log(`Player ${action.playerIndex} folded`);
                    }
                    return; // Skip fold actions in statistics
                }

                // Track players who put money in the pot
                if (['bet', 'call', 'raise'].includes(action.action)) {
                    playersInPot.add(action.playerIndex);
                }

                // Calculate active players at this point
                const activePlayers = hand.numPlayers - foldedPlayers.size;
                const playersInvolved = playersInPot.size;

                // Get action type from step 11a
                const playerAction = determinePlayerActionType(action, hand, actions, actionIndex);

                // Get pot odds from step 11b
                const potOdds = calculatePotOddsForOpponent(
                    playerAction,
                    hand,
                    actions,
                    actionIndex,
                    action.playerId
                );

                if (handIndex < HANDS_TO_LOG) {
                    console.log(`\nProcessing action ${actionIndex}:`);
                    console.log(`Active Players: ${activePlayers}`);
                    console.log(`Players in Pot: ${playersInvolved}`);
                    console.log(`Action:`, action);
                    console.log(`Player Action:`, playerAction);
                }

                // Override the active players count in the hand object for multiway calculations
                const handWithPlayers = {
                    ...hand,
                    players: Array.from({ length: Math.max(playersInvolved, 2) }, (_, i) => ({
                        id: `player${i}`,
                        folded: false
                    }))
                };

                // Get multiway information based on players who have actually put money in
                const multiwayInfo = getMultiwayInformation(handWithPlayers, actions, actionIndex, playerAction);

                if (handIndex < HANDS_TO_LOG) {
                    console.log(`Multiway Info:`, multiwayInfo);
                }

                // Only count meaningful actions (bet, call, raise) for distribution
                if (['bet', 'call', 'raise'].includes(action.action)) {
                    // Determine multiway category based on players who have put money in
                    let actualCategory;
                    if (playersInvolved <= 2) {
                        actualCategory = 'heads_up';
                    } else if (playersInvolved === 3) {
                        actualCategory = 'three_way';
                    } else {
                        actualCategory = 'four_plus_way';
                    }

                    // Record multiway distribution
                    multiwayDistribution[actualCategory]++;
                    totalActions++;

                    // Record street distribution
                    if (action.street) {
                        streetDistribution[action.street]++;
                    }

                    // Calculate adjustments
                    const headsUpAdj = calculateHeadsUpAdjustment(multiwayInfo, playerAction);
                    const threeWayAdj = calculateThreeWayAdjustment(multiwayInfo, playerAction);
                    const fourPlusWayAdj = calculateFourPlusWayAdjustment(multiwayInfo, playerAction);

                    // Calculate overall adjustment
                    const overallAdjustment = calculateOverallMultiwayAdjustment({
                        headsUp: headsUpAdj,
                        threeWay: threeWayAdj,
                        fourPlusWay: fourPlusWayAdj,
                        multiwayInfo
                    });

                    // Record adjustment results
                    adjustmentResults[actualCategory].push({
                        multiwayInfo,
                        street: action.street,
                        adjustment: overallAdjustment,
                        playersLeftToAct: multiwayInfo.playersLeftToAct,
                        potOddsAdjustment: multiwayInfo.multiwayPotOddsAdjustment,
                        activePlayers,
                        playersInvolved
                    });
                }
            });
        });

        // Log multiway distribution
        console.log('\nMultiway Distribution:');
        Object.entries(multiwayDistribution).forEach(([category, count]) => {
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
                const avgAdj = adjustments.reduce((a, b) => a + b, 0) / results.length;
                const stdDev = Math.sqrt(
                    adjustments.reduce((sum, x) => sum + Math.pow(x - avgAdj, 2), 0) / adjustments.length
                );
                
                console.log(`Range: ${minAdj.toFixed(3)} to ${maxAdj.toFixed(3)}`);
                console.log(`Average: ${avgAdj.toFixed(3)}`);
                console.log(`Standard Deviation: ${stdDev.toFixed(3)}`);

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

                // Additional multiway-specific stats
                const avgPlayersLeft = results.reduce((sum, r) => sum + r.playersLeftToAct, 0) / results.length;
                const avgPotOddsAdj = results.reduce((sum, r) => sum + r.potOddsAdjustment, 0) / results.length;
                const avgActivePlayers = results.reduce((sum, r) => sum + r.activePlayers, 0) / results.length;
                const avgPlayersInvolved = results.reduce((sum, r) => sum + r.playersInvolved, 0) / results.length;

                // Calculate percentiles for adjustments
                const sortedAdjustments = [...adjustments].sort((a, b) => a - b);
                const p25 = sortedAdjustments[Math.floor(adjustments.length * 0.25)];
                const p75 = sortedAdjustments[Math.floor(adjustments.length * 0.75)];
                const median = adjustments.length % 2 === 0 
                    ? (sortedAdjustments[adjustments.length/2 - 1] + sortedAdjustments[adjustments.length/2]) / 2
                    : sortedAdjustments[Math.floor(adjustments.length/2)];

                console.log('\nAdjustment Percentiles:');
                console.log(`25th Percentile: ${p25.toFixed(3)}`);
                console.log(`Median: ${median.toFixed(3)}`);
                console.log(`75th Percentile: ${p75.toFixed(3)}`);

                console.log('\nMultiway Stats:');
                console.log(`Average Active Players: ${avgActivePlayers.toFixed(2)}`);
                console.log(`Average Players Actually Involved: ${avgPlayersInvolved.toFixed(2)}`);
                console.log(`Average Players Left to Act: ${avgPlayersLeft.toFixed(2)}`);
                console.log(`Average Pot Odds Adjustment: ${avgPotOddsAdj.toFixed(2)}x`);
            }
        });

        expect(totalActions).toBeGreaterThan(0);
    });

    test('should handle missing input data gracefully', () => {
        const result = adjustForMultiwayVsHeadsUp(null, null, null, null, null);
        expect(result.multiwayAdjustment).toBe(0);
        expect(result.adjustedFoldFrequency).toBe(0.5);
    });

    test('should handle missing player data gracefully', () => {
        const mockHand = {
            id: 'test123',
            numPlayers: 6,
            foldedPlayers: []
        };
        const mockPlayerAction = { street: 'flop' };

        const multiwayInfo = getMultiwayInformation(mockHand, [], 0, mockPlayerAction);
        expect(multiwayInfo.activePlayers).toBe(2); // Default to heads-up
        expect(multiwayInfo.isHeadsUp).toBe(true);
    });

    test('should calculate correct pot odds adjustments', () => {
        expect(calculateMultiwayPotOddsAdjustment(2)).toBe(1.0); // No adjustment for heads-up
        expect(calculateMultiwayPotOddsAdjustment(3)).toBe(1.2); // 20% worse for 3-way
        expect(calculateMultiwayPotOddsAdjustment(4)).toBe(1.4); // 40% worse for 4-way
        expect(calculateMultiwayPotOddsAdjustment(5)).toBe(1.6); // 60% worse for 5+ way
    });
}); 