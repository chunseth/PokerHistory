const mongoose = require('mongoose');
const { adjustForBoardTexture } = require('../EV_Calculation/Step11/step11n');
let realHands = [];
let Hand;

describe('Step 11n: Board Texture Analysis', () => {
    beforeAll(async () => {
        try {
            await mongoose.connect('mongodb://localhost:27017/pokerHistory', {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            // Dynamically import Hand model (ESM)
            Hand = (await import('../../../server/models/Hand.js')).default;
            console.log('✅ Connected to poker history database');
            // Fetch real hands from database
            const hands = await Hand.find({}).limit(100);
            realHands = hands.map(hand => hand.toObject());
            console.log(`📊 Loaded ${realHands.length} real hands from database`);
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
        }
    });

    afterAll(async () => {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('🔌 Disconnected from database');
        }
    });

    test('should analyze board texture from real hand data', async () => {
        if (realHands.length === 0) {
            console.log('No hands with board data found in database. Skipping real data test.');
            return;
        }

        // Aggregate statistics for full board and flop only
        const aggregateTextureStatsFull = {
            dry: 0, wet: 0, semi_wet: 0, connected: 0, semi_connected: 0, paired: 0, trips: 0, unknown: 0, total: 0
        };
        const aggregateTextureStatsFlop = {
            dry: 0, wet: 0, semi_wet: 0, connected: 0, semi_connected: 0, paired: 0, trips: 0, unknown: 0, total: 0
        };

        for (const hand of realHands) {
            // Reconstruct full board from communityCards
            const fullBoard = [
                ...(hand.communityCards?.flop || []),
                ...(hand.communityCards?.turn ? [hand.communityCards.turn] : []),
                ...(hand.communityCards?.river ? [hand.communityCards.river] : [])
            ];
            // Flop only
            const flopBoard = (hand.communityCards?.flop || []);

            // Analyze full board
            if (fullBoard.length >= 3) {
                const bettingActions = hand.bettingActions || [];
                const currentAction = bettingActions[0] || {};
                const playerAction = { actionType: currentAction.action, betSize: currentAction.amount || 0, betSizing: 'small', street: 'flop', potSize: 20 };
                const potOdds = { callAmount: currentAction.amount || 0, potSize: 20, potOdds: (currentAction.amount || 0) / (20 + (currentAction.amount || 0)) };
                const handWithBoard = { ...hand, board: fullBoard };
                const result = adjustForBoardTexture(handWithBoard, bettingActions, 0, currentAction.playerId || '', playerAction, potOdds);
                aggregateTextureStatsFull[result.boardTexture]++;
                aggregateTextureStatsFull.total++;
            }
            // Analyze flop only
            if (flopBoard.length === 3) {
                const bettingActions = hand.bettingActions || [];
                const currentAction = bettingActions[0] || {};
                const playerAction = { actionType: currentAction.action, betSize: currentAction.amount || 0, betSizing: 'small', street: 'flop', potSize: 20 };
                const potOdds = { callAmount: currentAction.amount || 0, potSize: 20, potOdds: (currentAction.amount || 0) / (20 + (currentAction.amount || 0)) };
                const handWithBoard = { ...hand, board: flopBoard };
                const result = adjustForBoardTexture(handWithBoard, bettingActions, 0, currentAction.playerId || '', playerAction, potOdds);
                aggregateTextureStatsFlop[result.boardTexture]++;
                aggregateTextureStatsFlop.total++;
            }
        }

        // Print aggregate statistics for full board
        console.log(`\n🎯 AGGREGATE BOARD TEXTURE STATISTICS (FULL BOARD):`);
        console.log(`📊 Total analyses: ${aggregateTextureStatsFull.total}`);
        Object.entries(aggregateTextureStatsFull).forEach(([texture, count]) => {
            if (texture !== 'total' && count > 0) {
                const percentage = (count / aggregateTextureStatsFull.total * 100).toFixed(1);
                console.log(`  - ${texture.toUpperCase()}: ${count} (${percentage}%)`);
            }
        });

        // Print aggregate statistics for flop only
        console.log(`\n🎯 AGGREGATE BOARD TEXTURE STATISTICS (FLOP ONLY):`);
        console.log(`📊 Total analyses: ${aggregateTextureStatsFlop.total}`);
        Object.entries(aggregateTextureStatsFlop).forEach(([texture, count]) => {
            if (texture !== 'total' && count > 0) {
                const percentage = (count / aggregateTextureStatsFlop.total * 100).toFixed(1);
                console.log(`  - ${texture.toUpperCase()}: ${count} (${percentage}%)`);
            }
        });

        // Validate that we have a variety of board textures
        const textureTypesFull = Object.keys(aggregateTextureStatsFull).filter(key => key !== 'total' && aggregateTextureStatsFull[key] > 0);
        const textureTypesFlop = Object.keys(aggregateTextureStatsFlop).filter(key => key !== 'total' && aggregateTextureStatsFlop[key] > 0);
        console.log(`\n✅ Found ${textureTypesFull.length} board texture types (full board): ${textureTypesFull.join(', ')}`);
        console.log(`✅ Found ${textureTypesFlop.length} board texture types (flop only): ${textureTypesFlop.join(', ')}`);
        expect(textureTypesFull.length).toBeGreaterThan(1);
        expect(textureTypesFlop.length).toBeGreaterThan(1);
    });

    test('should handle edge cases correctly', () => {
        // Test with no board data
        const handWithNoBoard = {
            bettingActions: [
                { playerId: 'player1', action: 'bet', amount: 10 }
            ]
        };

        const result1 = adjustForBoardTexture(
            handWithNoBoard,
            [],
            0,
            'player2',
            {},
            {}
        );

        expect(result1.boardTexture).toBe('unknown');
        expect(result1.foldAdjustment).toBe(0);
        expect(result1.callAdjustment).toBe(0);
        expect(result1.raiseAdjustment).toBe(0);
        expect(result1.explanation).toContain('Missing board data');

        // Test with missing data
        const result2 = adjustForBoardTexture(
            null,
            [],
            0,
            'player1',
            {},
            {}
        );

        expect(result2.boardTexture).toBe('unknown');
        expect(result2.explanation).toContain('Missing board data');
    });

    test('should apply GTO-based texture adjustments correctly', () => {
        // Test dry board
        const dryBoardHand = {
            board: ['Ah', '7d', '2c'],
            bettingActions: [
                { playerId: 'player1', action: 'bet', amount: 10 }
            ]
        };

        const result1 = adjustForBoardTexture(
            dryBoardHand,
            dryBoardHand.bettingActions,
            0,
            'player2',
            { actionType: 'bet', betSize: 10, street: 'flop' },
            { callAmount: 10, potSize: 20 }
        );

        expect(result1.boardTexture).toBe('dry');
        expect(result1.foldAdjustment).toBeGreaterThan(0); // Should increase fold frequency
        expect(result1.callAdjustment).toBeLessThan(0); // Should decrease call frequency
        expect(result1.explanation).toContain('dry');

        // Test wet board
        const wetBoardHand = {
            board: ['Ah', 'Kh', 'Qh'],
            bettingActions: [
                { playerId: 'player1', action: 'bet', amount: 10 }
            ]
        };

        const result2 = adjustForBoardTexture(
            wetBoardHand,
            wetBoardHand.bettingActions,
            0,
            'player2',
            { actionType: 'bet', betSize: 10, street: 'flop' },
            { callAmount: 10, potSize: 20 }
        );

        expect(result2.boardTexture).toBe('wet');
        expect(result2.foldAdjustment).toBeLessThan(0); // Should decrease fold frequency
        expect(result2.callAdjustment).toBeGreaterThan(0); // Should increase call frequency
        expect(result2.explanation).toContain('wet');

        // Test paired board
        const pairedBoardHand = {
            board: ['Ah', 'Ad', '7c'],
            bettingActions: [
                { playerId: 'player1', action: 'bet', amount: 10 }
            ]
        };

        const result3 = adjustForBoardTexture(
            pairedBoardHand,
            pairedBoardHand.bettingActions,
            0,
            'player2',
            { actionType: 'bet', betSize: 10, street: 'flop' },
            { callAmount: 10, potSize: 20 }
        );

        expect(result3.boardTexture).toBe('paired');
        expect(result3.raiseAdjustment).toBeLessThan(0); // Should decrease raise frequency
        expect(result3.explanation).toContain('paired');
    });

    test('should respect range strength context from step 11c', () => {
        // Test with strong range on dry board
        const strongRangeHand = {
            board: ['Ah', '7d', '2c'], // Dry board
            bettingActions: [
                { playerId: 'player1', action: 'bet', amount: 10 }
            ]
        };

        const result = adjustForBoardTexture(
            strongRangeHand,
            strongRangeHand.bettingActions,
            0,
            'player2',
            { actionType: 'bet', betSize: 10, street: 'flop' },
            { callAmount: 10, potSize: 20 }
        );

        // Should include range strength analysis from step 11c
        expect(result.rangeStrength).toBeDefined();
        expect(result.rangeStrength.averageStrength).toBeDefined();
        expect(result.rangeStrength.strengthCategory).toBeDefined();

        // Range strength should affect the adjustments
        if (result.rangeStrength.averageStrength > 0.7) {
            // Strong range on dry board should reduce fold frequency
            expect(result.foldAdjustment).toBeLessThan(0.2); // Less than maximum dry board fold increase
        }
    });

    test('should apply street-specific adjustments correctly', () => {
        const testBoard = ['Ah', 'Kh', 'Qh']; // Wet board
        const testHand = {
            board: testBoard,
            bettingActions: [
                { playerId: 'player1', action: 'bet', amount: 10 }
            ]
        };

        // Test flop
        const flopResult = adjustForBoardTexture(
            testHand,
            testHand.bettingActions,
            0,
            'player2',
            { actionType: 'bet', betSize: 10, street: 'flop' },
            { callAmount: 10, potSize: 20 }
        );

        // Test turn
        const turnResult = adjustForBoardTexture(
            testHand,
            testHand.bettingActions,
            0,
            'player2',
            { actionType: 'bet', betSize: 10, street: 'turn' },
            { callAmount: 10, potSize: 20 }
        );

        // Test river
        const riverResult = adjustForBoardTexture(
            testHand,
            testHand.bettingActions,
            0,
            'player2',
            { actionType: 'bet', betSize: 10, street: 'river' },
            { callAmount: 10, potSize: 20 }
        );

        // River should have stronger texture impact than flop
        expect(Math.abs(riverResult.callAdjustment)).toBeGreaterThanOrEqual(Math.abs(flopResult.callAdjustment));
        expect(Math.abs(riverResult.foldAdjustment)).toBeGreaterThanOrEqual(Math.abs(flopResult.foldAdjustment));

        // All should be wet board adjustments
        expect(flopResult.boardTexture).toBe('wet');
        expect(turnResult.boardTexture).toBe('wet');
        expect(riverResult.boardTexture).toBe('wet');
    });
}); 