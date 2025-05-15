import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Hand from '../models/Hand.js';

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
                            buttonPosition = buttonPlayer[1].playerIndex;
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
                        hand.streetBets.push([...currentStreetActions]);
                        currentStreetActions = [];
                        currentStreet = 'flop';
                        const match = line.match(/\[(.*?)\]/);
                        if (match) {
                            hand.communityCards.flop = parseCards(match[1]);
                        }
                    } else if (line.includes('*** TURN ***')) {
                        hand.streetBets.push([...currentStreetActions]);
                        currentStreetActions = [];
                        currentStreet = 'turn';
                        const match = line.match(/\[(.*?)\] \[(.*?)\]/);
                        if (match) {
                            hand.communityCards.turn = match[2];
                        }
                    } else if (line.includes('*** RIVER ***')) {
                        hand.streetBets.push([...currentStreetActions]);
                        currentStreetActions = [];
                        currentStreet = 'river';
                        const match = line.match(/\[(.*?)\] \[(.*?)\]/);
                        if (match) {
                            hand.communityCards.river = match[2];
                        }
                    } else if (line.includes('*** SHOW DOWN ***')) {
                        hand.streetBets.push([...currentStreetActions]);
                        currentStreetActions = [];
                        currentStreet = 'showdown';
                    }

                    // Parse betting actions
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
                                if (playerInfo.playerIndex !== heroPlayerIndex) {
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
                const positionArray = positions[numPlayers] || positions[6];

                // Assign positions based on action order
                uniqueActors.forEach((playerIndex, index) => {
                    playerIndexToPosition[playerIndex] = positionArray[index];
                });

                // Update all preflop actions with the correct positions
                hand.bettingActions.forEach(action => {
                    if (action.street === 'preflop') {
                        action.position = playerIndexToPosition[action.playerIndex];
                    } else {
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
                    const heroPosRelativeToButton = (heroPlayerIndex - buttonPosition + numPlayers) % numPlayers;
                    
                    hand.heroPosition = 0;
                    hand.buttonPosition = (numPlayers - heroPosRelativeToButton) % numPlayers;

                    const rotatedPositions = getRotatedPositions(numPlayers, heroPosRelativeToButton);
                    
                    const playerIndexToAdjustedIndex = new Map();
                    Array.from(players.entries()).forEach(([name, info]) => {
                        const adjustedIndex = (info.playerIndex - heroPlayerIndex + numPlayers) % numPlayers;
                        playerIndexToAdjustedIndex.set(info.playerIndex, adjustedIndex);
                    });
                    
                    hand.bettingActions = hand.bettingActions.map(action => {
                        const adjustedIndex = playerIndexToAdjustedIndex.get(action.playerIndex);
                        return {
                            ...action,
                            playerIndex: adjustedIndex,
                            position: rotatedPositions[adjustedIndex]
                        };
                    });
                    
                    hand.foldedPlayers = hand.foldedPlayers.map(index => 
                        playerIndexToAdjustedIndex.get(index)
                    );
                    
                    hand.villainCards = hand.villainCards.map(villain => ({
                        ...villain,
                        playerIndex: playerIndexToAdjustedIndex.get(villain.playerIndex)
                    }));

                    hand.streetBets = [
                        hand.bettingActions.filter(action => action.street === 'preflop'),
                        hand.bettingActions.filter(action => action.street === 'flop'),
                        hand.bettingActions.filter(action => action.street === 'turn'),
                        hand.bettingActions.filter(action => action.street === 'river')
                    ];
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
                continue;
            }
        }

        return parsedHands;
    } catch (error) {
        console.error('Error parsing hand history file:', error);
        throw error;
    }
}

// Main function to process all hand history files
export async function processHandHistories(filePath, tournamentName) {
    try {
        console.log(`Processing file: ${filePath}`);
        
        let totalHands = 0;
        let handsPlayed = 0;
        let handsSaved = 0;
        
        try {
            const hands = await parseHandHistory(filePath);
            totalHands += hands.length;
            
            // Filter out hands that end at preflop or where hero is not involved
            const playedHands = hands.filter(hand => {
                const streets = hand.bettingActions.map(action => action.street);
                const uniqueStreets = [...new Set(streets)];
                
                const heroFoldedPreflop = hand.bettingActions.some(action => 
                    action.playerIndex === 0 && 
                    action.street === 'preflop' && 
                    action.action === 'fold'
                );
                
                const heroPostflopActions = hand.bettingActions.some(action => 
                    action.playerIndex === 0 && 
                    action.street !== 'preflop'
                );
                
                return uniqueStreets.length > 1 && !heroFoldedPreflop && heroPostflopActions;
            });
            
            handsPlayed += playedHands.length;
            
            // Save each played hand to the database
            for (const hand of playedHands) {
                try {
                    // Add tournament name if provided
                    if (tournamentName) {
                        hand.tournamentName = tournamentName;
                    }
                    
                    await Hand.updateOne(
                        { id: hand.id },
                        { $set: hand },
                        { upsert: true }
                    );
                    handsSaved++;
                } catch (err) {
                    if (err.code === 11000) {
                        continue;
                    }
                    console.error(`Error saving hand ${hand.id}:`, err.message);
                }
            }
            
            console.log(`Successfully parsed ${hands.length} hands from file`);
            console.log(`Filtered out ${hands.length - playedHands.length} preflop-only hands`);
            console.log(`Saved ${playedHands.length} hands to the database`);
            
        } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
        }
        
        return {
            totalHands,
            handsPlayed,
            handsSaved
        };
        
    } catch (error) {
        console.error('Error processing hand histories:', error);
        throw error;
    }
} 