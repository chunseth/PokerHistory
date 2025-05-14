import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Hand from './server/models/Hand.js';

// Helper function to parse card string into array
function parseCards(cardString) {
    return cardString.replace(/[\[\]]/g, '').split(' ');
}

// Helper function to calculate position from button
function calculatePosition(buttonPosition, playerSeat, numPlayers) {
    const positions = {
        2: ['BTN/SB', 'BB'],
        3: ['BTN', 'SB', 'BB'],
        4: ['BTN', 'SB', 'BB', 'UTG'],
        5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
        6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
        7: ['BTN', 'SB', 'BB', 'UTG', 'LJ', 'HJ', 'CO'],
        8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO'],
        9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'],
        10: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO']
    };

    // For 2 players, positions are fixed
    if (numPlayers === 2) {
        return positions[2][playerSeat - 1];
    }

    // Get the base positions for the current number of players
    const basePositions = positions[numPlayers];
    
    // Calculate the position index based on the distance from the button
    // Since button is at position 0, we can directly use the playerSeat - 1 as the index
    const positionIndex = (playerSeat - 1) % numPlayers;
    
    return basePositions[positionIndex];
}

// Helper function to parse betting action
function parseBettingAction(line, playerIndex, position, street) {
    const action = {
        playerIndex,
        position,
        street,
        timestamp: new Date(),
        amount: 0
    };

    if (line.includes('folds')) {
        action.action = 'fold';
    } else if (line.includes('calls')) {
        action.action = 'call';
        const amount = parseFloat(line.match(/calls ([\d.]+)/)[1]);
        action.amount = amount;
    } else if (line.includes('raises')) {
        action.action = 'raise';
        const [toAmount] = line.match(/to ([\d.]+)/)[1];
        action.amount = parseFloat(toAmount);
    } else if (line.includes('posts')) {
        action.action = 'post';
        const amount = parseFloat(line.match(/posts ([\d.]+)/)[1]);
        action.amount = amount;
    }

    return action;
}

async function parseHandHistory(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        // Initialize hand object
        const hand = {
            communityCards: {
                flop: [],
                turn: null,
                river: null
            },
            gameType: 'tournament', // Default to tournament, can be updated based on file content
            bettingActions: [],
            streetBets: [],
            foldedPlayers: [],
            villainCards: []
        };

        let currentStreet = 'preflop';
        let buttonPosition = 0;
        let numPlayers = 0;
        let heroStackSize = 0;
        let bigBlind = 0;
        let heroSeat = 0;
        let players = new Map(); // Track players and their seats
        let heroPlayerIndex = null;
        let heroStackSizeBB = 0;

        // First pass: Parse player seats and stack sizes, set heroStackSize
        for (const line of lines) {
            if (line.startsWith('Seat ')) {
                const match = line.match(/Seat (\d+): (\w+) \(([\d.]+)\)/);
                if (match) {
                    numPlayers++;
                    const [_, seat, player, stack] = match;
                    const seatNum = parseInt(seat);
                    players.set(player, {
                        seat: seatNum,
                        stack: parseFloat(stack)
                    });
                    if (player === 'grotle') {
                        heroSeat = seatNum;
                        heroStackSize = parseFloat(stack);
                        heroPlayerIndex = seatNum - 1; // zero-based
                    }
                }
            }
        }

        // Second pass: Parse the rest of the hand
        for (const line of lines) {
            // Parse game type and tournament info
            if (line.startsWith('Game Hand #')) {
                const [handId, tournamentId] = line.match(/#(\d+)/g).map(m => m.substring(1));
                hand.id = handId;
                hand._id = new mongoose.Types.ObjectId();
                
                // Extract timestamp
                const timestampMatch = line.match(/(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/);
                if (timestampMatch) {
                    hand.timestamp = new Date(timestampMatch[1]);
                }

                // Extract blinds
                const blindsMatch = line.match(/Level \d+ \(([\d.]+)\/([\d.]+)\)/);
                if (blindsMatch) {
                    bigBlind = parseFloat(blindsMatch[2]);
                    heroStackSizeBB = heroStackSize / bigBlind;
                }
            }

            // Parse button position
            if (line.includes('is the button')) {
                buttonPosition = parseInt(line.match(/Seat #(\d+)/)[1]) - 1; // zero-based
            }

            // Parse hole cards
            if (line.includes('Dealt to grotle')) {
                const match = line.match(/\[(.*?)\]/);
                if (match) {
                    hand.heroHoleCards = parseCards(match[1]);
                }
            }

            // Parse community cards
            if (line.includes('*** FLOP ***')) {
                currentStreet = 'flop';
                const match = line.match(/\[(.*?)\]/);
                if (match) {
                    hand.communityCards.flop = parseCards(match[1]);
                }
            } else if (line.startsWith('*** TURN ***')) {
                currentStreet = 'turn';
                const match = line.match(/\[(.*?)\] \[(.*?)\]/);
                if (match) {
                    hand.communityCards.turn = match[2];
                }
            } else if (line.startsWith('*** RIVER ***')) {
                currentStreet = 'river';
                const match = line.match(/\[(.*?)\] \[(.*?)\]/);
                if (match) {
                    hand.communityCards.river = match[2];
                }
            }

            // Parse betting actions for small and big blinds
            if (line.includes('posts the small blind')) {
                const match = line.match(/(\w+) posts the small blind ([\d.]+)/);
                if (match) {
                    const [_, player, amount] = match;
                    const playerInfo = players.get(player);
                    if (playerInfo) {
                        const position = calculatePosition(buttonPosition, playerInfo.seat, numPlayers);
                        const postAmount = Math.min(parseFloat(amount) / bigBlind, heroStackSizeBB);
                        hand.bettingActions.push({
                            playerIndex: playerInfo.seat - 1,
                            position,
                            action: 'post',
                            amount: postAmount,
                            street: 'preflop',
                            timestamp: new Date()
                        });
                    }
                }
            } else if (line.includes('posts the big blind')) {
                const match = line.match(/(\w+) posts the big blind ([\d.]+)/);
                if (match) {
                    const [_, player, amount] = match;
                    const playerInfo = players.get(player);
                    if (playerInfo) {
                        const position = calculatePosition(buttonPosition, playerInfo.seat, numPlayers);
                        const postAmount = Math.min(parseFloat(amount) / bigBlind, heroStackSizeBB);
                        hand.bettingActions.push({
                            playerIndex: playerInfo.seat - 1,
                            position,
                            action: 'post',
                            amount: postAmount,
                            street: 'preflop',
                            timestamp: new Date()
                        });
                    }
                }
            } else if (line.includes('*** HOLE CARDS ***')) {
                // Start tracking preflop actions
                currentStreet = 'preflop';
            } else if (line.includes('*** FLOP ***')) {
                // Stop tracking preflop actions
                currentStreet = 'flop';
                // Save preflop betting actions to streetBets
                hand.streetBets.push({
                    street: 'preflop',
                    actions: [...hand.bettingActions]
                });
                // Don't clear bettingActions - keep the complete history
            } else if (currentStreet === 'preflop' && line.trim() && !line.includes('***')) {
                // Parse preflop betting actions
                if (line.includes('folds')) {
                    const player = line.match(/^(\w+)/)[1];
                    const playerInfo = players.get(player);
                    if (playerInfo) {
                        const position = calculatePosition(buttonPosition, playerInfo.seat, numPlayers);
                        hand.bettingActions.push({
                            playerIndex: playerInfo.seat - 1,
                            position,
                            action: 'fold',
                            amount: 0,
                            street: 'preflop',
                            timestamp: new Date()
                        });
                        hand.foldedPlayers.push(playerInfo.seat - 1);
                    }
                } else if (line.includes('calls')) {
                    const match = line.match(/^(\w+) calls ([\d.]+)/);
                    if (match) {
                        const [_, player, amount] = match;
                        const playerInfo = players.get(player);
                        if (playerInfo) {
                            const position = calculatePosition(buttonPosition, playerInfo.seat, numPlayers);
                            let callAmountBB = parseFloat(amount) / bigBlind;
                            // Check for all-in
                            if (line.includes('all-in')) {
                                // If all-in amount is less than heroStackSizeBB, use heroStackSizeBB
                                if (callAmountBB < heroStackSizeBB) {
                                    callAmountBB = heroStackSizeBB;
                                } else {
                                    // If all-in amount is greater, cap at heroStackSizeBB
                                    callAmountBB = heroStackSizeBB;
                                }
                            } else {
                                // For non-all-in calls, cap at heroStackSizeBB
                                callAmountBB = Math.min(callAmountBB, heroStackSizeBB);
                            }
                            hand.bettingActions.push({
                                playerIndex: playerInfo.seat - 1,
                                position,
                                action: 'call',
                                amount: callAmountBB,
                                street: 'preflop',
                                timestamp: new Date()
                            });
                        }
                    }
                } else if (line.includes('raises')) {
                    const match = line.match(/^(\w+) raises ([\d.]+) to ([\d.]+)/);
                    if (match) {
                        const [_, player, raiseAmount, totalAmount] = match;
                        const playerInfo = players.get(player);
                        if (playerInfo) {
                            const position = calculatePosition(buttonPosition, playerInfo.seat, numPlayers);
                            let raiseToAmountBB = parseFloat(totalAmount) / bigBlind;
                            // Check for all-in
                            if (line.includes('all-in')) {
                                // If all-in amount is less than heroStackSizeBB, use heroStackSizeBB
                                if (raiseToAmountBB < heroStackSizeBB) {
                                    raiseToAmountBB = heroStackSizeBB;
                                } else {
                                    // If all-in amount is greater, cap at heroStackSizeBB
                                    raiseToAmountBB = heroStackSizeBB;
                                }
                            } else {
                                // For non-all-in raises, cap at heroStackSizeBB
                                raiseToAmountBB = Math.min(raiseToAmountBB, heroStackSizeBB);
                            }
                            hand.bettingActions.push({
                                playerIndex: playerInfo.seat - 1,
                                position,
                                action: 'raise',
                                amount: raiseToAmountBB,
                                street: 'preflop',
                                timestamp: new Date()
                            });
                        }
                    }
                }
            }

            // Parse villain cards
            if (line.includes('shows')) {
                const match = line.match(/(\w+) shows \[(.*?)\]/);
                if (match) {
                    const [_, player, cards] = match;
                    const playerInfo = players.get(player);
                    if (playerInfo) {
                        const playerIndex = playerInfo.seat - 1;
                        if (playerIndex !== heroPlayerIndex) { // Exclude hero
                            hand.villainCards.push({
                                playerIndex,
                                cards: parseCards(cards)
                            });
                        }
                    }
                }
            }

            // Parse pot size
            if (line.includes('Main pot')) {
                const match = line.match(/Main pot ([\d.]+)/);
                if (match) {
                    const potSize = parseFloat(match[1]);
                    hand.potSize = potSize / bigBlind;
                }
            }
        }

        // Set final values
        hand.numPlayers = numPlayers;
        hand.buttonPosition = buttonPosition;
        hand.heroPosition = calculatePosition(buttonPosition, heroSeat, numPlayers);
        hand.heroStackSize = heroStackSizeBB;
        hand.currentStreet = currentStreet;

        return hand;
    } catch (error) {
        console.error('Error parsing hand history:', error);
        throw error;
    }
}

// Main function to process all hand history files
async function processHandHistories(directoryPath) {
    try {
        const filePath = path.join(directoryPath, 'HH20250426 SCHEDULEDID-G33460037T7 TN-Lightning PKO - $8 GTD GAMETYPE-Hold\'em LIMIT-no CUR-REAL OND-F BUYIN-0.txt');
        const hand = await parseHandHistory(filePath);
        
        // Print the parsed hand data
        console.log('Parsed Hand Data:');
        console.log(JSON.stringify(hand, null, 2));
        
    } catch (error) {
        console.error('Error processing hand histories:', error);
        process.exit(1);
    }
}

// Execute the script
const handHistoryDir = 'src/assets';
processHandHistories(handHistoryDir); 