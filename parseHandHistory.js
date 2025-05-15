import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Hand from './server/models/Hand.js';

// Helper function to parse card string into array
function parseCards(cardString) {
    return cardString.replace(/[\[\]]/g, '').split(' ');
}

// Define positions dictionary at module level
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

// Helper function to calculate position from button
function calculatePosition(buttonPosition, playerSeat, numPlayers, heroSeat) {
    // For 2 players, positions are fixed
    if (numPlayers === 2) {
        return positions[2][playerSeat - 1];
    }

    // Get the base positions for the current number of players
    const basePositions = positions[numPlayers];
    
    // Calculate the position index based on the distance from the button
    // We need to calculate clockwise distance from button
    const distanceFromButton = (playerSeat - buttonPosition + numPlayers) % numPlayers;
    
    return basePositions[distanceFromButton];
}

// Helper function to round to nearest 0.5
function roundToNearestHalf(num) {
    return Math.round(num * 2) / 2;
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

// Helper function to get position names array rotated so hero is always at index 0
function getRotatedPositions(numPlayers, heroTableIndex) {
    const arr = positions[numPlayers];
    // Rotate so heroTableIndex is at index 0
    return arr.slice(heroTableIndex).concat(arr.slice(0, heroTableIndex));
}

async function parseHandHistory(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Split content into individual hands
        const handBoundary = 'Game Hand #';
        const hands = content.split(handBoundary).filter(hand => hand.trim());
        
        console.log(`Found ${hands.length} hands in file`);
        
        const parsedHands = [];
        
        // Process each hand
        for (const handContent of hands) {
            try {
                // Add back the hand boundary marker that was removed by split
                const fullHandContent = handBoundary + handContent;
                const lines = fullHandContent.split('\n');

                // Initialize hand object
                const hand = {
                    communityCards: {
                        flop: [],
                        turn: null,
                        river: null
                    },
                    gameType: 'tournament', // Default to tournament, can be updated based on file content
                    bettingActions: [],
                    streetBets: [], // Will be filled as we parse
                    foldedPlayers: [],
                    villainCards: []
                };

                let currentStreet = 'preflop';
                let currentStreetActions = [];
                let buttonPosition = 0;
                let numPlayers = 0;
                let heroStackSize = 0;
                let bigBlind = 0;
                let heroSeat = 0;
                let players = new Map(); // Track players and their seats
                let heroPlayerIndex = null;
                let heroStackSizeBB = 0;
                let seatToPlayerIndex = new Map(); // Map seat numbers to player indices

                // First pass: Parse player seats and stack sizes, set heroStackSize
                for (const line of lines) {
                    if (line.startsWith('Seat ')) {
                        const match = line.match(/Seat (\d+): (\w+) \(([\d.]+)\)/);
                        if (match) {
                            numPlayers++;
                            const [_, seat, player, stack] = match;
                            const seatNum = parseInt(seat);
                            const playerIndex = numPlayers - 1; // 0-based player index
                            seatToPlayerIndex.set(seatNum, playerIndex);
                            players.set(player, {
                                seat: seatNum,
                                stack: parseFloat(stack),
                                playerIndex: playerIndex
                            });
                            if (player === 'grotle') {
                                heroSeat = seatNum;
                                heroStackSize = parseFloat(stack);
                                heroPlayerIndex = playerIndex;
                            }
                        }
                    }
                }

                console.log(`Number of players at table: ${numPlayers}`);
                console.log('Seat to player index mapping:');
                seatToPlayerIndex.forEach((playerIndex, seat) => {
                    console.log(`  Seat ${seat} -> Player Index ${playerIndex}`);
                });

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
                        const buttonSeat = parseInt(line.match(/Seat #(\d+)/)[1]);
                        const buttonPlayer = Array.from(players.entries()).find(([_, info]) => info.seat === buttonSeat);
                        if (buttonPlayer) {
                            buttonPosition = buttonPlayer[1].playerIndex; // Use playerIndex instead of seat
                            console.log(`Button player: ${buttonPlayer[0]} (Seat ${buttonSeat}, Index ${buttonPosition})`);
                        }
                    }

                    // Parse hole cards
                    if (line.includes('Dealt to grotle')) {
                        const match = line.match(/\[(.*?)\]/);
                        if (match) {
                            hand.heroHoleCards = parseCards(match[1]);
                        }
                    }

                    // Parse community cards and street transitions
                    if (line.includes('*** FLOP ***')) {
                        // Save preflop actions to streetBets
                        hand.streetBets.push([...currentStreetActions]);
                        currentStreetActions = [];
                        currentStreet = 'flop';
                        const match = line.match(/\[(.*?)\]/);
                        if (match) {
                            hand.communityCards.flop = parseCards(match[1]);
                        }
                    } else if (line.includes('*** TURN ***')) {
                        // Save flop actions to streetBets
                        hand.streetBets.push([...currentStreetActions]);
                        currentStreetActions = [];
                        currentStreet = 'turn';
                        const match = line.match(/\[(.*?)\] \[(.*?)\]/);
                        if (match) {
                            hand.communityCards.turn = match[2];
                        }
                    } else if (line.includes('*** RIVER ***')) {
                        // Save turn actions to streetBets
                        hand.streetBets.push([...currentStreetActions]);
                        currentStreetActions = [];
                        currentStreet = 'river';
                        const match = line.match(/\[(.*?)\] \[(.*?)\]/);
                        if (match) {
                            hand.communityCards.river = match[2];
                        }
                    } else if (line.includes('*** SHOW DOWN ***')) {
                        // Save river actions to streetBets
                        hand.streetBets.push([...currentStreetActions]);
                        currentStreetActions = [];
                        currentStreet = 'showdown';
                    }

                    // Parse betting actions for all streets
                    if (line.trim() && !line.includes('***') && !line.includes('Main pot') && !line.includes('Dealt to')) {
                        let actionObj = null;
                        if (line.includes('posts the small blind')) {
                            const match = line.match(/^(\w+) posts the small blind ([\d.]+)/);
                            if (match) {
                                const [_, player, amount] = match;
                                const playerInfo = players.get(player);
                                if (playerInfo) {
                                    const playerPosition = calculatePosition(buttonPosition, playerInfo.playerIndex, numPlayers, heroPlayerIndex);
                                    actionObj = {
                                        playerIndex: playerInfo.playerIndex,
                                        position: playerPosition,
                                        action: 'post',
                                        amount: parseFloat(amount) / bigBlind,
                                        street: 'preflop',
                                        timestamp: new Date(),
                                        order: hand.bettingActions.length
                                    };
                                }
                            }
                        } else if (line.includes('posts the big blind')) {
                            const match = line.match(/^(\w+) posts the big blind ([\d.]+)/);
                            if (match) {
                                const [_, player, amount] = match;
                                const playerInfo = players.get(player);
                                if (playerInfo) {
                                    const playerPosition = calculatePosition(buttonPosition, playerInfo.playerIndex, numPlayers, heroPlayerIndex);
                                    actionObj = {
                                        playerIndex: playerInfo.playerIndex,
                                        position: playerPosition,
                                        action: 'post',
                                        amount: parseFloat(amount) / bigBlind,
                                        street: 'preflop',
                                        timestamp: new Date(),
                                        order: hand.bettingActions.length
                                    };
                                }
                            }
                        } else if (line.includes('folds')) {
                            const player = line.match(/^(\w+)/)[1];
                            const playerInfo = players.get(player);
                            if (playerInfo) {
                                const playerPosition = calculatePosition(buttonPosition, playerInfo.playerIndex, numPlayers, heroPlayerIndex);
                                actionObj = {
                                    playerIndex: playerInfo.playerIndex,
                                    position: playerPosition,
                                    action: 'fold',
                                    amount: 0,
                                    street: currentStreet,
                                    timestamp: new Date(),
                                    order: hand.bettingActions.length
                                };
                                hand.foldedPlayers.push(playerInfo.playerIndex);
                            }
                        } else if (line.includes('calls')) {
                            const match = line.match(/^(\w+) calls ([\d.]+)/);
                            if (match) {
                                const [_, player, amount] = match;
                                const playerInfo = players.get(player);
                                if (playerInfo) {
                                    const playerPosition = calculatePosition(buttonPosition, playerInfo.playerIndex, numPlayers, heroPlayerIndex);
                                    let callAmountBB = parseFloat(amount) / bigBlind;
                                    
                                    // For all-in calls, use the actual call amount and mark as all-in
                                    if (line.includes('all-in')) {
                                        callAmountBB = Math.min(callAmountBB, heroStackSizeBB);
                                        actionObj = {
                                            playerIndex: playerInfo.playerIndex,
                                            position: playerPosition,
                                            action: 'call',
                                            amount: roundToNearestHalf(callAmountBB),
                                            street: currentStreet,
                                            timestamp: new Date(),
                                            order: hand.bettingActions.length,
                                            isAllIn: true
                                        };
                                    } else {
                                        actionObj = {
                                            playerIndex: playerInfo.playerIndex,
                                            position: playerPosition,
                                            action: 'call',
                                            amount: roundToNearestHalf(callAmountBB),
                                            street: currentStreet,
                                            timestamp: new Date(),
                                            order: hand.bettingActions.length,
                                            isAllIn: false
                                        };
                                    }
                                }
                            }
                        } else if (line.includes('raises')) {
                            const match = line.match(/^(\w+) raises ([\d.]+) to ([\d.]+)/);
                            if (match) {
                                const [_, player, raiseAmount, totalAmount] = match;
                                const playerInfo = players.get(player);
                                if (playerInfo) {
                                    const playerPosition = calculatePosition(buttonPosition, playerInfo.playerIndex, numPlayers, heroPlayerIndex);
                                    let raiseToAmountBB = parseFloat(totalAmount) / bigBlind;
                                    // Only adjust for blinds on preflop
                                    if (currentStreet === 'preflop') {
                                        if (playerPosition === 'BB') {
                                            raiseToAmountBB -= 1;
                                        } else if (playerPosition === 'SB') {
                                            raiseToAmountBB -= 0.5;
                                        }
                                    }
                                    if (line.includes('all-in')) {
                                        raiseToAmountBB = Math.min(raiseToAmountBB, heroStackSizeBB);
                                        actionObj = {
                                            playerIndex: playerInfo.playerIndex,
                                            position: playerPosition,
                                            action: 'raise',
                                            amount: roundToNearestHalf(raiseToAmountBB),
                                            street: currentStreet,
                                            timestamp: new Date(),
                                            order: hand.bettingActions.length,
                                            isAllIn: true
                                        };
                                    } else {
                                        raiseToAmountBB = Math.min(raiseToAmountBB, heroStackSizeBB);
                                        actionObj = {
                                            playerIndex: playerInfo.playerIndex,
                                            position: playerPosition,
                                            action: 'raise',
                                            amount: roundToNearestHalf(raiseToAmountBB),
                                            street: currentStreet,
                                            timestamp: new Date(),
                                            order: hand.bettingActions.length,
                                            isAllIn: false
                                        };
                                    }
                                }
                            }
                        } else if (line.includes('bets')) {
                            const match = line.match(/^(\w+) bets ([\d.]+)/);
                            if (match) {
                                const [_, player, amount] = match;
                                const playerInfo = players.get(player);
                                if (playerInfo) {
                                    const playerPosition = calculatePosition(buttonPosition, playerInfo.playerIndex, numPlayers, heroPlayerIndex);
                                    let betAmountBB = parseFloat(amount) / bigBlind;
                                    
                                    // Check for all-in first
                                    const isAllIn = line.includes('all-in');
                                    if (isAllIn) {
                                        betAmountBB = Math.min(betAmountBB, heroStackSizeBB);
                                    }
                                    
                                    actionObj = {
                                        playerIndex: playerInfo.playerIndex,
                                        position: playerPosition,
                                        action: 'bet',
                                        amount: roundToNearestHalf(betAmountBB),
                                        street: currentStreet,
                                        timestamp: new Date(),
                                        order: hand.bettingActions.length,
                                        isAllIn: isAllIn
                                    };
                                }
                            }
                        } else if (line.includes('checks')) {
                            const player = line.match(/^(\w+)/)[1];
                            const playerInfo = players.get(player);
                            if (playerInfo) {
                                const playerPosition = calculatePosition(buttonPosition, playerInfo.playerIndex, numPlayers, heroPlayerIndex);
                                actionObj = {
                                    playerIndex: playerInfo.playerIndex,
                                    position: playerPosition,
                                    action: 'check',
                                    amount: 0,
                                    street: currentStreet,
                                    timestamp: new Date(),
                                    order: hand.bettingActions.length
                                };
                            }
                        }
                        if (actionObj) {
                            hand.bettingActions.push(actionObj);
                            currentStreetActions.push(actionObj);
                        }
                    }

                    // Parse villain cards
                    if (line.includes('shows')) {
                        const match = line.match(/(\w+) shows \[(.*?)\]/);
                        if (match) {
                            const [_, player, cards] = match;
                            const playerInfo = players.get(player);
                            if (playerInfo) {
                                if (playerInfo.playerIndex !== heroPlayerIndex) { // Exclude hero
                                    hand.villainCards.push({
                                        playerIndex: playerInfo.playerIndex,
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

                // After parsing all lines, calculate positions based on adjusted button and player order
                const preflopActions = hand.bettingActions.filter(action => action.street === 'preflop');
                const uniqueActors = [...new Set(preflopActions.map(action => action.playerIndex))];
                
                // Create a mapping of player indices to their positions based on action order
                const playerIndexToPosition = {};
                
                // Get the appropriate position array based on number of players
                const positionArray = positions[numPlayers] || positions[6]; // Default to 6-max if not found

                // Assign positions based on action order
                uniqueActors.forEach((playerIndex, index) => {
                    playerIndexToPosition[playerIndex] = positionArray[index];
                });

                // Update all preflop actions with the correct positions
                hand.bettingActions.forEach(action => {
                    if (action.street === 'preflop') {
                        action.position = playerIndexToPosition[action.playerIndex];
                    } else {
                        // For postflop actions, calculate position based on adjusted button
                        const adjustedPosition = (action.playerIndex - buttonPosition + numPlayers) % numPlayers;
                        action.position = positions[numPlayers][adjustedPosition];
                    }
                });

                // Create streetBets array with the updated positions
                hand.streetBets = hand.bettingActions.map(action => ({
                    playerIndex: action.playerIndex,
                    position: action.position,
                    action: action.action,
                    amount: action.amount,
                    street: action.street,
                    timestamp: action.timestamp,
                    order: action.order,
                    isAllIn: action.isAllIn
                }));

                // Find hero's seat number
                const heroSeatMatch = lines.find(line => line.includes('Seat') && line.includes('grotle'));
                if (heroSeatMatch) {
                    const heroSeatNum = parseInt(heroSeatMatch.match(/Seat (\d+):/)[1]);
                    // Calculate hero's position relative to button (0-based)
                    const heroPosRelativeToButton = (heroPlayerIndex - buttonPosition + numPlayers) % numPlayers;
                    
                    // Set hero's position to 0 and adjust button position accordingly
                    hand.heroPosition = 0;
                    hand.buttonPosition = (numPlayers - heroPosRelativeToButton) % numPlayers;

                    // Get rotated positions so hero is always at index 0
                    const rotatedPositions = getRotatedPositions(numPlayers, heroPosRelativeToButton);
                    
                    // Create a mapping of original player indices to adjusted indices
                    const playerIndexToAdjustedIndex = new Map();
                    Array.from(players.entries()).forEach(([name, info]) => {
                        const adjustedIndex = (info.playerIndex - heroPlayerIndex + numPlayers) % numPlayers;
                        playerIndexToAdjustedIndex.set(info.playerIndex, adjustedIndex);
                    });
                    
                    // Adjust all betting actions to be relative to hero's position
                    hand.bettingActions = hand.bettingActions.map(action => {
                        const adjustedIndex = playerIndexToAdjustedIndex.get(action.playerIndex);
                        return {
                            ...action,
                            playerIndex: adjustedIndex,
                            position: rotatedPositions[adjustedIndex]
                        };
                    });
                    
                    // Adjust folded players indices
                    hand.foldedPlayers = hand.foldedPlayers.map(index => 
                        playerIndexToAdjustedIndex.get(index)
                    );
                    
                    // Adjust villain cards indices
                    hand.villainCards = hand.villainCards.map(villain => ({
                        ...villain,
                        playerIndex: playerIndexToAdjustedIndex.get(villain.playerIndex)
                    }));

                    // Now adjust streetBets after all indices have been adjusted
                    hand.streetBets = [
                        hand.bettingActions.filter(action => action.street === 'preflop'),
                        hand.bettingActions.filter(action => action.street === 'flop'),
                        hand.bettingActions.filter(action => action.street === 'turn'),
                        hand.bettingActions.filter(action => action.street === 'river')
                    ];

                    // DEBUG OUTPUT
                    // Print original seat numbers and player names
                    const seatOrder = Array.from(players.entries()).sort((a, b) => a[1].seat - b[1].seat);
                    console.log('Original seat order:');
                    seatOrder.forEach(([name, info]) => {
                        console.log(`  Seat ${info.seat}: ${name} (Player Index ${info.playerIndex})`);
                    });
                    // Print rotated player order
                    const rotatedOrder = seatOrder.map(([name, info]) => {
                        const adjustedIndex = playerIndexToAdjustedIndex.get(info.playerIndex);
                        return {adjustedIndex, name, seat: info.seat, playerIndex: info.playerIndex};
                    }).sort((a, b) => a.adjustedIndex - b.adjustedIndex);
                    console.log('Rotated player order (hero at index 0):');
                    rotatedOrder.forEach(({adjustedIndex, name, seat, playerIndex}) => {
                        console.log(`  Index ${adjustedIndex}: ${name} (Seat ${seat}, Original Player Index ${playerIndex})`);
                    });
                    // Print button and hero positions
                    console.log(`Assigned buttonPosition: ${hand.buttonPosition}`);
                    console.log(`Assigned heroPosition: ${hand.heroPosition}`);
                    // Print position names for each player index
                    console.log('Position names for each player index:');
                    rotatedPositions.forEach((pos, idx) => {
                        console.log(`  Index ${idx}: ${pos}`);
                    });
                } else {
                    hand.heroPosition = 0;
                    hand.buttonPosition = 0;
                }

                // Set final values
                hand.numPlayers = numPlayers;
                hand.heroStackSize = roundToNearestHalf(heroStackSizeBB);
                hand.currentStreet = currentStreet;
                hand.heroPlayerIndex = heroPlayerIndex;
                hand.potSize = roundToNearestHalf(hand.potSize);

                parsedHands.push(hand);
                
            } catch (error) {
                console.error('Error parsing individual hand:', error);
                continue; // Continue with next hand even if one fails
            }
        }

        // Print parsed hands before filtering
        console.log('PARSED HANDS BEFORE FILTERING:');
        parsedHands.forEach(hand => {
            console.log(JSON.stringify({
                id: hand.id,
                heroHoleCards: hand.heroHoleCards,
                bettingActions: hand.bettingActions,
                streetBets: hand.streetBets,
                heroPosition: hand.heroPosition,
                buttonPosition: hand.buttonPosition
            }, null, 2));
        });

        return parsedHands;
    } catch (error) {
        console.error('Error parsing hand history file:', error);
        throw error;
    }
}

// Main function to process all hand history files
async function processHandHistories(directoryPath) {
    try {
        // Read all files in the directory
        const files = fs.readdirSync(directoryPath);
        
        // Filter for .txt files
        const handHistoryFiles = files.filter(file => file.endsWith('.txt'));
        
        console.log(`Found ${handHistoryFiles.length} hand history files to process`);
        
        let totalHands = 0;
        let handsPlayed = 0;
        let handsSaved = 0;
        
        // Process each file
        for (const file of handHistoryFiles) {
            const filePath = path.join(directoryPath, file);
            console.log(`\nProcessing file: ${file}`);
            
            try {
                const hands = await parseHandHistory(filePath);
                totalHands += hands.length;
                
                // Filter out hands that end at preflop or where hero is not involved
                const playedHands = hands.filter(hand => {
                    // Get all streets in the hand
                    const streets = hand.bettingActions.map(action => action.street);
                    const uniqueStreets = [...new Set(streets)];
                    
                    // Check if hero folded preflop
                    const heroFoldedPreflop = hand.bettingActions.some(action => 
                        action.playerIndex === 0 && // hero is always at index 0
                        action.street === 'preflop' && 
                        action.action === 'fold'
                    );
                    
                    // Check if hero has any actions beyond preflop
                    const heroPostflopActions = hand.bettingActions.some(action => 
                        action.playerIndex === 0 && // hero is always at index 0
                        action.street !== 'preflop' // action is on flop or later
                    );
                    
                    // Keep the hand if it goes beyond preflop AND hero didn't fold preflop AND hero has postflop actions
                    return uniqueStreets.length > 1 && !heroFoldedPreflop && heroPostflopActions;
                });
                
                handsPlayed += playedHands.length;
                
                // Save each played hand to the database
                for (const hand of playedHands) {
                    try {
                        await Hand.updateOne(
                            { id: hand.id },
                            { $set: hand },
                            { upsert: true }
                        );
                        handsSaved++;
                    } catch (err) {
                        if (err.code === 11000) {
                            // Duplicate key error, skip
                            continue;
                        }
                        console.error(`Error saving hand ${hand.id}:`, err.message);
                    }
                }
                
                // Print the parsed hands data
                console.log(`Successfully parsed ${hands.length} hands from file`);
                console.log(`Filtered out ${hands.length - playedHands.length} preflop-only hands`);
                console.log(`Saved ${playedHands.length} hands to the database`);
                
            } catch (error) {
                console.error(`Error processing file ${file}:`, error);
                continue; // Continue with next file even if one fails
            }
        }
        
        console.log('\nSummary:');
        console.log(`Total hands processed: ${totalHands}`);
        console.log(`Hands played (beyond preflop): ${handsPlayed}`);
        console.log(`Hands saved to database: ${handsSaved}`);
        console.log(`Hands ended preflop: ${totalHands - handsPlayed}`);
        console.log(`Percentage played: ${((handsPlayed/totalHands) * 100).toFixed(2)}%`);
        
    } catch (error) {
        console.error('Error processing hand histories:', error);
        process.exit(1);
    }
}

// Execute the script
const handHistoryDir = process.argv[2] || '/Users/sethchun/Downloads/AmericasCardroom/handHistory/grotle';

async function main() {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/pokerHistory');
    console.log('Connected to MongoDB');

    await processHandHistories(handHistoryDir);

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
}

main();