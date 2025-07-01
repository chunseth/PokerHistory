const mongoose = require('mongoose');
const { Hand } = require('../../models/models');
const { adjustRaiseFrequencyForPreviousActions } = require('../EV_Calculation/Step11/step11m');

describe('Step 11m: Previous Action Analysis', () => {
    let realHands = [];

    beforeAll(async () => {
        try {
            await mongoose.connect('mongodb://localhost:27017/pokerHistory', {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
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

    test('should analyze previous actions from real hand data', async () => {
        // If no hands found, skip this test but log it
        if (realHands.length === 0) {
            console.log('No hands with betting actions found in database. Skipping real data test.');
            return;
        }

        expect(realHands.length).toBeGreaterThan(0);

        for (const hand of realHands) {
            console.log(`\n=== Testing Hand: ${hand._id || hand.id} ===`);
            
            const bettingActions = hand.bettingActions;
            console.log(`Total betting actions: ${bettingActions ? bettingActions.length : 0}`);
            if (!bettingActions || bettingActions.length < 2) continue;
            
            // Debug: Log all actions in this hand
            console.log('\n📋 All betting actions in this hand:');
            bettingActions.forEach((action, idx) => {
                console.log(`  Action ${idx}: ${action.playerId} - ${action.action} (amount: ${action.amount || 'N/A'})`);
            });
            
            // Get all unique players in this hand
            const allPlayers = [...new Set(bettingActions.map(action => action.playerId).filter(Boolean))];
            console.log(`\n👥 Players in hand: ${allPlayers.join(', ')}`);
            
            // Sample actions from throughout the hand to get better distribution
            const actionIndices = [];
            if (bettingActions.length > 1) {
                // Sample more actions to get better distribution
                actionIndices.push(1); // Early action
                if (bettingActions.length > 3) {
                    actionIndices.push(2); // Second action
                }
                if (bettingActions.length > 5) {
                    actionIndices.push(3); // Third action
                    actionIndices.push(Math.floor(bettingActions.length / 4)); // Quarter way
                }
                if (bettingActions.length > 8) {
                    actionIndices.push(4); // Fourth action
                    actionIndices.push(5); // Fifth action
                }
                if (bettingActions.length > 10) {
                    actionIndices.push(Math.floor(bettingActions.length / 2)); // Half way
                }
                if (bettingActions.length > 12) {
                    actionIndices.push(Math.floor(bettingActions.length / 2) + 1); // After half
                }
                if (bettingActions.length > 15) {
                    actionIndices.push(Math.floor(3 * bettingActions.length / 4)); // Three quarters
                }
                if (bettingActions.length > 18) {
                    actionIndices.push(bettingActions.length - 4); // Near end
                    actionIndices.push(bettingActions.length - 3); // Near end
                }
                if (bettingActions.length > 20) {
                    actionIndices.push(bettingActions.length - 2); // Very near end
                }
            }
            
            // Also specifically look for betting actions (bet/raise) to analyze
            const bettingActionIndices = [];
            bettingActions.forEach((action, idx) => {
                if (action.action === 'bet' || action.action === 'raise') {
                    bettingActionIndices.push(idx);
                }
            });
            
            console.log(`\n🎯 Found ${bettingActionIndices.length} betting actions at indices: ${bettingActionIndices.join(', ')}`);
            
            // Add some betting action indices to our sample
            if (bettingActionIndices.length > 0) {
                bettingActionIndices.slice(0, 3).forEach(idx => {
                    if (!actionIndices.includes(idx)) {
                        actionIndices.push(idx);
                    }
                });
            }
            
            // Sort action indices to process in order
            actionIndices.sort((a, b) => a - b);
            
            console.log(`📊 Sampling actions at indices: ${actionIndices.join(', ')}`);
            
            // Track action type distribution across all players
            const actionTypeStats = {
                aggressive: 0,
                passive: 0,
                fold: 0,
                post: 0,
                total: 0
            };
            
            for (const actionIndex of actionIndices) {
                const currentAction = bettingActions[actionIndex];
                if (!currentAction || !currentAction.playerId) continue;
                
                // Track action type for statistics
                switch (currentAction.action) {
                    case 'bet':
                    case 'raise':
                        actionTypeStats.aggressive++;
                        break;
                    case 'call':
                    case 'check':
                        actionTypeStats.passive++;
                        break;
                    case 'fold':
                        actionTypeStats.fold++;
                        break;
                    case 'post':
                        actionTypeStats.post++;
                        break;
                }
                actionTypeStats.total++;
                
                // Find an opponent (different player)
                const opponentId = bettingActions.find(a => a.playerId && a.playerId !== currentAction.playerId)?.playerId;
                if (!opponentId) continue;
                
                console.log(`\n--- Action ${actionIndex}: ${currentAction.action} by ${currentAction.playerId} ---`);
                console.log(`Analyzing opponent: ${opponentId}`);
                
                // Debug: Log opponent's previous actions specifically
                console.log('\n🔍 Opponent previous actions:');
                for (let i = 0; i < actionIndex; i++) {
                    const action = bettingActions[i];
                    if (action && action.playerId === opponentId) {
                        console.log(`  Action ${i}: ${action.action} (amount: ${action.amount || 'N/A'})`);
                    }
                }
                
                // Test with different base raise frequencies
                const baseRaiseFreqs = [0.3, 0.5, 0.7];
                
                for (const baseRaiseFreq of baseRaiseFreqs) {
                    const result = adjustRaiseFrequencyForPreviousActions(
                        hand, 
                        actionIndex, 
                        opponentId, 
                        baseRaiseFreq
                    );
                    
                    console.log(`\nBase raise freq: ${(baseRaiseFreq * 100).toFixed(1)}%`);
                    console.log(`Adjusted raise freq: ${(result.raiseFreq * 100).toFixed(1)}%`);
                    console.log(`Explanation: ${result.explanation}`);
                    
                    // Validate results
                    expect(result.raiseFreq).toBeGreaterThanOrEqual(0);
                    expect(result.raiseFreq).toBeLessThanOrEqual(0.8);
                    expect(result.previousActionAnalysis).toBeDefined();
                    expect(result.explanation).toBeDefined();
                    expect(result.rangeStrength).toBeDefined(); // Now includes range strength from step 11c
                    
                    // Log previous action analysis
                    const analysis = result.previousActionAnalysis;
                    console.log(`Previous actions: ${analysis.totalActions} total`);
                    if (analysis.totalActions > 0) {
                        console.log(`  - Aggressive: ${(analysis.aggressivePercentage * 100).toFixed(1)}%`);
                        console.log(`  - Passive: ${(analysis.passivePercentage * 100).toFixed(1)}%`);
                        console.log(`  - Folds: ${(analysis.foldPercentage * 100).toFixed(1)}%`);
                        console.log(`  - Recent actions: ${analysis.recentActions}`);
                    }
                    
                    // Log range strength from step 11c
                    const rangeStrength = result.rangeStrength;
                    console.log(`Range strength: ${rangeStrength.strengthCategory} (${(rangeStrength.averageStrength * 100).toFixed(1)}%)`);
                }
            }
            
            // Log action type distribution for this hand
            console.log(`\n📊 Action type distribution for this hand:`);
            console.log(`  - Aggressive (bet/raise): ${actionTypeStats.aggressive} (${actionTypeStats.total > 0 ? (actionTypeStats.aggressive / actionTypeStats.total * 100).toFixed(1) : 0}%)`);
            console.log(`  - Passive (call/check): ${actionTypeStats.passive} (${actionTypeStats.total > 0 ? (actionTypeStats.passive / actionTypeStats.total * 100).toFixed(1) : 0}%)`);
            console.log(`  - Folds: ${actionTypeStats.fold} (${actionTypeStats.total > 0 ? (actionTypeStats.fold / actionTypeStats.total * 100).toFixed(1) : 0}%)`);
            console.log(`  - Posts: ${actionTypeStats.post} (${actionTypeStats.total > 0 ? (actionTypeStats.post / actionTypeStats.total * 100).toFixed(1) : 0}%)`);
            console.log(`  - Total actions analyzed: ${actionTypeStats.total}`);
        }
    });

    test('should handle edge cases correctly', () => {
        // Test with no previous actions
        const handWithNoActions = {
            bettingActions: [
                { playerId: 'player1', action: 'bet', amount: 10 }
            ]
        };
        
        const result1 = adjustRaiseFrequencyForPreviousActions(
            handWithNoActions, 
            0, 
            'player2', 
            0.5
        );
        
        // Should include range strength analysis from step 11c
        expect(result1.rangeStrength).toBeDefined();
        expect(result1.previousActionAnalysis.totalActions).toBe(0);
        
        // If range is weak, should have hard override
        if (result1.rangeStrength.strengthCategory === 'weak') {
            expect(result1.raiseFreq).toBe(0.45); // 0.5 * 0.9
            expect(result1.explanation).toContain('Weak range: hard override');
        } else {
            expect(result1.raiseFreq).toBe(0.5); // Should remain unchanged
        }
        
        // Test with missing data
        const result2 = adjustRaiseFrequencyForPreviousActions(
            null, 
            0, 
            'player1', 
            0.5
        );
        
        expect(result2.raiseFreq).toBe(0.5);
        expect(result2.explanation).toContain('Missing input data');
    });

    test('should apply GTO-based adjustments correctly', () => {
        // Test aggressive opponent
        const aggressiveHand = {
            bettingActions: [
                { playerId: 'opponent', action: 'bet', amount: 20 },
                { playerId: 'hero', action: 'call', amount: 20 },
                { playerId: 'opponent', action: 'raise', amount: 40 },
                { playerId: 'hero', action: 'call', amount: 20 }
            ]
        };
        
        const result1 = adjustRaiseFrequencyForPreviousActions(
            aggressiveHand, 
            3, 
            'opponent', 
            0.5
        );
        
        // Check if range strength affects the result
        if (result1.rangeStrength.strengthCategory === 'weak') {
            // Weak range overrides all other adjustments
            expect(result1.raiseFreq).toBe(0.45); // 0.5 * 0.9
            expect(result1.explanation).toContain('Weak range: hard override');
        } else {
            // Should reduce raise frequency against aggressive opponent
            expect(result1.raiseFreq).toBeLessThan(0.5);
            expect(result1.explanation).toContain('aggressive');
        }
        
        // Test passive opponent
        const passiveHand = {
            bettingActions: [
                { playerId: 'opponent', action: 'call', amount: 10 },
                { playerId: 'hero', action: 'bet', amount: 20 },
                { playerId: 'opponent', action: 'call', amount: 10 },
                { playerId: 'hero', action: 'bet', amount: 30 }
            ]
        };
        
        const result2 = adjustRaiseFrequencyForPreviousActions(
            passiveHand, 
            3, 
            'opponent', 
            0.5
        );
        
        // Check if range strength affects the result
        if (result2.rangeStrength.strengthCategory === 'weak') {
            // Weak range overrides all other adjustments
            expect(result2.raiseFreq).toBe(0.45); // 0.5 * 0.9
            expect(result2.explanation).toContain('Weak range: hard override');
        } else {
            // Should increase raise frequency against passive opponent
            expect(result2.raiseFreq).toBeGreaterThan(0.5);
            expect(result2.explanation).toContain('passive');
        }
        
        // Test folding opponent
        const foldingHand = {
            bettingActions: [
                { playerId: 'opponent', action: 'fold' },
                { playerId: 'hero', action: 'bet', amount: 20 },
                { playerId: 'opponent', action: 'fold' },
                { playerId: 'hero', action: 'bet', amount: 30 }
            ]
        };
        
        const result3 = adjustRaiseFrequencyForPreviousActions(
            foldingHand, 
            3, 
            'opponent', 
            0.5
        );
        
        // Check if range strength affects the result
        if (result3.rangeStrength.strengthCategory === 'weak') {
            // Weak range overrides all other adjustments
            expect(result3.raiseFreq).toBe(0.45); // 0.5 * 0.9
            expect(result3.explanation).toContain('Weak range: hard override');
        } else {
            // Should increase raise frequency against folding opponent
            expect(result3.raiseFreq).toBeGreaterThan(0.5);
            expect(result3.explanation).toContain('fold');
        }
    });

    test('should respect range strength context from step 11c', () => {
        const testHand = {
            bettingActions: [
                { playerId: 'opponent', action: 'call', amount: 10 },
                { playerId: 'hero', action: 'bet', amount: 20 }
            ]
        };
        
        // Test with different base frequencies to see range strength effects
        const result1 = adjustRaiseFrequencyForPreviousActions(
            testHand, 
            1, 
            'opponent', 
            0.5
        );
        
        // Should include range strength analysis from step 11c
        expect(result1.rangeStrength).toBeDefined();
        expect(result1.rangeStrength.strengthCategory).toBeDefined();
        expect(result1.rangeStrength.averageStrength).toBeDefined();
        
        // Test with a higher base frequency to see the weak range effect more clearly
        const result2 = adjustRaiseFrequencyForPreviousActions(
            testHand, 
            1, 
            'opponent', 
            0.7
        );
        
        // Should include range strength analysis
        expect(result2.rangeStrength).toBeDefined();
        
        // If range is weak, should have hard override
        if (result2.rangeStrength.strengthCategory === 'weak') {
            expect(result2.explanation).toContain('Weak range: hard override');
            expect(result2.raiseFreq).toBeLessThan(0.7);
        }
    });
}); 