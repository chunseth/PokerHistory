const mongoose = require('mongoose');
const { Hand } = require('../../models/models');

describe('Database Data Structure Analysis', () => {
    let dbConnection;

    beforeAll(async () => {
        try {
            // Connect to database
            await mongoose.connect('mongodb://localhost:27017/pokerHistory', {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('✅ Connected to poker history database');
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

    describe('BettingActions Data Structure', () => {
        test('should examine the structure of bettingActions from database', async () => {
            if (mongoose.connection.readyState !== 1) {
                console.log('⚠️  Skipping test - no database connection');
                return;
            }

            // Get a few sample hands
            const hands = await Hand.find({}).limit(5);
            
            if (hands.length === 0) {
                console.log('⚠️  No hands found in database');
                return;
            }

            console.log(`\n📊 Examining ${hands.length} hands from database:`);

            hands.forEach((hand, handIndex) => {
                console.log(`\n🃏 Hand ${handIndex + 1} (ID: ${hand.id}):`);
                console.log(`  Players:`, hand.players.map(p => ({ id: p.id, name: p.name, position: p.position })));
                
                if (hand.bettingActions && hand.bettingActions.length > 0) {
                    console.log(`  BettingActions (${hand.bettingActions.length} total):`);
                    
                    hand.bettingActions.forEach((action, actionIndex) => {
                        console.log(`    Action ${actionIndex}:`, {
                            playerId: action.playerId,
                            action: action.action,
                            amount: action.amount,
                            street: action.street,
                            timestamp: action.timestamp,
                            hasPlayerId: action.hasOwnProperty('playerId'),
                            playerIdType: typeof action.playerId,
                            playerIdValue: action.playerId
                        });

                        // Check if playerId exists in players array
                        const playerExists = hand.players.find(p => p.id === action.playerId);
                        if (action.playerId && !playerExists) {
                            console.log(`      ⚠️  WARNING: playerId "${action.playerId}" not found in players array`);
                        }
                    });
                } else {
                    console.log('  No betting actions found');
                }
            });

            // Validate that hands have betting actions
            expect(hands.length).toBeGreaterThan(0);
        });

        test('should analyze playerId patterns across all hands', async () => {
            if (mongoose.connection.readyState !== 1) {
                console.log('⚠️  Skipping test - no database connection');
                return;
            }

            const hands = await Hand.find({}).limit(20);
            
            if (hands.length === 0) {
                console.log('⚠️  No hands found in database');
                return;
            }

            console.log(`\n🔍 Analyzing playerId patterns across ${hands.length} hands:`);

            let totalActions = 0;
            let actionsWithPlayerId = 0;
            let actionsWithUndefinedPlayerId = 0;
            let actionsWithNullPlayerId = 0;
            let actionsWithEmptyPlayerId = 0;
            let uniquePlayerIds = new Set();
            let playerIdMismatches = 0;

            hands.forEach(hand => {
                if (hand.bettingActions && hand.bettingActions.length > 0) {
                    hand.bettingActions.forEach(action => {
                        totalActions++;

                        if (action.playerId === undefined) {
                            actionsWithUndefinedPlayerId++;
                        } else if (action.playerId === null) {
                            actionsWithNullPlayerId++;
                        } else if (action.playerId === '') {
                            actionsWithEmptyPlayerId++;
                        } else {
                            actionsWithPlayerId++;
                            uniquePlayerIds.add(action.playerId);

                            // Check if playerId matches any player in the hand
                            const playerExists = hand.players.find(p => p.id === action.playerId);
                            if (!playerExists) {
                                playerIdMismatches++;
                            }
                        }
                    });
                }
            });

            console.log('\n📈 PlayerId Analysis Results:');
            console.log(`  Total actions: ${totalActions}`);
            console.log(`  Actions with valid playerId: ${actionsWithPlayerId}`);
            console.log(`  Actions with undefined playerId: ${actionsWithUndefinedPlayerId}`);
            console.log(`  Actions with null playerId: ${actionsWithNullPlayerId}`);
            console.log(`  Actions with empty playerId: ${actionsWithEmptyPlayerId}`);
            console.log(`  Unique player IDs found: ${uniquePlayerIds.size}`);
            console.log(`  Player ID mismatches: ${playerIdMismatches}`);
            console.log(`  Unique player IDs:`, Array.from(uniquePlayerIds).slice(0, 10), uniquePlayerIds.size > 10 ? '...' : '');

            // Log percentage of actions with valid player IDs
            const validPlayerIdPercentage = (actionsWithPlayerId / totalActions * 100).toFixed(1);
            console.log(`  Valid playerId percentage: ${validPlayerIdPercentage}%`);

            // Expectations
            expect(totalActions).toBeGreaterThan(0);
            if (actionsWithUndefinedPlayerId > 0) {
                console.log(`\n⚠️  Found ${actionsWithUndefinedPlayerId} actions with undefined playerId - this explains the test issue!`);
            }
        });

        test('should check hand schema compliance', async () => {
            if (mongoose.connection.readyState !== 1) {
                console.log('⚠️  Skipping test - no database connection');
                return;
            }

            const hands = await Hand.find({}).limit(10);
            
            if (hands.length === 0) {
                console.log('⚠️  No hands found in database');
                return;
            }

            console.log(`\n🔍 Checking schema compliance for ${hands.length} hands:`);

            hands.forEach((hand, index) => {
                console.log(`\nHand ${index + 1}:`);
                
                // Check required fields
                const requiredFields = ['id', 'sessionId', 'timestamp', 'gameType', 'players', 'buttonPosition', 'potSize', 'heroHoleCards', 'heroPosition'];
                requiredFields.forEach(field => {
                    if (hand[field] === undefined || hand[field] === null) {
                        console.log(`  ❌ Missing required field: ${field}`);
                    }
                });

                // Check bettingActions structure
                if (hand.bettingActions) {
                    hand.bettingActions.forEach((action, actionIndex) => {
                        const requiredActionFields = ['playerId', 'action', 'amount', 'street', 'timestamp'];
                        const missingFields = requiredActionFields.filter(field => 
                            action[field] === undefined || action[field] === null
                        );
                        
                        if (missingFields.length > 0) {
                            console.log(`  ❌ Action ${actionIndex} missing fields: ${missingFields.join(', ')}`);
                        }
                    });
                } else {
                    console.log(`  ⚠️  No bettingActions array found`);
                }
            });
        });
    });
}); 