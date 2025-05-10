import React, { useState, useEffect } from 'react';
import './BotPokerGame.css';
import cardBack from '../assets/BackOfCard.png';
import { calculateHandStrength, getHandDescription } from '../utils/handEvaluator';

// Bot difficulty levels and their corresponding strategies
const BOT_DIFFICULTY = {
    EASY: 'easy',
    MEDIUM: 'medium',
    HARD: 'hard'
};

// Bot personality types
const BOT_PERSONALITY = {
    TIGHT_PASSIVE: 'tight_passive',
    LOOSE_AGGRESSIVE: 'loose_aggressive',
    BALANCED: 'balanced'
};

const BotPokerGame = () => {
    const [gameState, setGameState] = useState({
        gameType: 'cash',
        numPlayers: 6,
        buttonPosition: 0,
        heroPosition: 0,
        heroStackSize: 100,
        heroHoleCards: ['', ''],
        communityCards: {
            flop: ['', '', ''],
            turn: '',
            river: ''
        },
        players: [],
        bettingActions: [],
        currentStreet: 'preflop',
        potSize: 0,
        villainCards: [],
        botStacks: {},
        botPersonalities: {}
    });

    const [currentActionIndex, setCurrentActionIndex] = useState(0);
    const [currentStreet, setCurrentStreet] = useState('preflop');
    const [foldedPlayers, setFoldedPlayers] = useState(new Set());
    const [currentBet, setCurrentBet] = useState(0);
    const [lastRaise, setLastRaise] = useState(0);
    const [raiseAmount, setRaiseAmount] = useState(2);
    const [bettingRoundComplete, setBettingRoundComplete] = useState(false);
    const [playerBets, setPlayerBets] = useState({});
    const [lastRaiser, setLastRaiser] = useState(null);
    const [lastRaiseActionIndex, setLastRaiseActionIndex] = useState(null);
    const [streetBets, setStreetBets] = useState({});
    const [firstActionTaken, setFirstActionTaken] = useState(false);
    const [heroFolded, setHeroFolded] = useState(false);
    const [hasAllIn, setHasAllIn] = useState(false);
    const [gamePhase, setGamePhase] = useState('setup'); // setup, playing, showdown
    const [botDifficulty, setBotDifficulty] = useState(BOT_DIFFICULTY.MEDIUM);
    const [revealedVillains, setRevealedVillains] = useState(new Set());

    // Initialize the game
    useEffect(() => {
        if (gamePhase === 'setup') {
            initializeGame();
        }
    }, [gamePhase]);

    const initializeGame = () => {
        // Initialize players array with proper stack sizes
        const players = [];
        for (let i = 0; i < gameState.numPlayers; i++) {
            players.push({
                position: i,
                stackSize: i === gameState.heroPosition ? gameState.heroStackSize : 100,
                cards: i === gameState.heroPosition ? gameState.heroHoleCards : [],
                bet: 0,
                folded: false,
                personality: i === gameState.heroPosition ? null : getRandomBotPersonality()
            });
        }

        setGameState(prev => ({
            ...prev,
            players,
            bettingActions: [],
            currentStreet: 'preflop',
            potSize: 0
        }));

        // Deal initial cards
        dealCards();
        
        // Post blinds
        postBlinds();
        
        setGamePhase('playing');
    };

    const getRandomBotPersonality = () => {
        const personalities = Object.values(BOT_PERSONALITY);
        return personalities[Math.floor(Math.random() * personalities.length)];
    };

    const dealCards = () => {
        // Create a deck of cards
        const deck = createDeck();
        shuffleDeck(deck);

        // Deal hero's cards
        const heroCards = [deck.pop(), deck.pop()];
        
        // Deal bot cards
        const botCards = {};
        for (let i = 0; i < gameState.numPlayers; i++) {
            if (i !== gameState.heroPosition) {
                botCards[i] = [deck.pop(), deck.pop()];
            }
        }

        // Deal community cards
        const flop = [deck.pop(), deck.pop(), deck.pop()];
        const turn = deck.pop();
        const river = deck.pop();

        // Update players' cards
        setGameState(prev => ({
            ...prev,
            players: prev.players.map(player => ({
                ...player,
                cards: player.position === prev.heroPosition ? heroCards : botCards[player.position] || []
            })),
            communityCards: {
                flop,
                turn,
                river
            }
        }));
    };

    const createDeck = () => {
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
        const suits = ['c', 's', 'h', 'd'];
        const deck = [];

        for (const rank of ranks) {
            for (const suit of suits) {
                deck.push(rank + suit);
            }
        }

        return deck;
    };

    const shuffleDeck = (deck) => {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    };

    const postBlinds = () => {
        const sbPosition = (gameState.buttonPosition - 1 + gameState.numPlayers) % gameState.numPlayers;
        const bbPosition = (gameState.buttonPosition - 2 + gameState.numPlayers) % gameState.numPlayers;

        // Post small blind (0.5BB)
        setGameState(prev => ({
            ...prev,
            players: prev.players.map(player => {
                if (player.position === sbPosition) {
                    return {
                        ...player,
                        stackSize: player.stackSize - 0.5,
                        bet: 0.5
                    };
                }
                return player;
            }),
            bettingActions: [...prev.bettingActions, {
                playerIndex: sbPosition,
                position: getPlayerPosition(sbPosition),
                action: 'post',
                amount: 0.5,
                street: 'preflop'
            }],
            currentBet: 0.5 // Set initial current bet
        }));

        // Post big blind (1BB)
        setGameState(prev => ({
            ...prev,
            players: prev.players.map(player => {
                if (player.position === bbPosition) {
                    return {
                        ...player,
                        stackSize: player.stackSize - 1,
                        bet: 1
                    };
                }
                return player;
            }),
            bettingActions: [...prev.bettingActions, {
                playerIndex: bbPosition,
                position: getPlayerPosition(bbPosition),
                action: 'post',
                amount: 1,
                street: 'preflop'
            }],
            currentBet: 1 // Update current bet to BB amount
        }));

        // Set initial action to UTG
        const utgPosition = (gameState.buttonPosition - 3 + gameState.numPlayers) % gameState.numPlayers;
        setCurrentActionIndex(utgPosition);
    };

    const handleBotAction = (playerIndex, action, amount = 0) => {
        // Calculate the amount to deduct from stack
        const player = gameState.players.find(p => p.position === playerIndex);
        const currentBet = gameState.currentBet || 0;
        const playerBetAmount = player?.bet || 0;
        const amountToCall = currentBet - playerBetAmount;
        
        // For raises, the total amount is the difference between the raise amount and current bet
        const totalAmount = action === 'raise' ? (amount - playerBetAmount) : 
                           action === 'call' ? amountToCall : 0;

        // Calculate the new bet amount
        const newBetAmount = action === 'fold' ? playerBetAmount :
                            action === 'raise' ? amount :
                            action === 'call' ? currentBet : 0;

        // Update player's stack and bet
        setGameState(prev => ({
            ...prev,
            players: prev.players.map(player => {
                if (player.position === playerIndex) {
                    const newStack = player.stackSize - totalAmount;
                    return {
                        ...player,
                        stackSize: Math.max(0, newStack),
                        bet: newBetAmount
                    };
                }
                return player;
            }),
            bettingActions: [...prev.bettingActions, {
                playerIndex,
                position: getPlayerPosition(playerIndex),
                action,
                amount: totalAmount,
                street: currentStreet
            }],
            currentBet: action === 'raise' ? amount : prev.currentBet
        }));

        // If bot folds, add to folded players
        if (action === 'fold') {
            setFoldedPlayers(prev => new Set([...prev, playerIndex]));
            setGameState(prev => ({
                ...prev,
                players: prev.players.map(player => 
                    player.position === playerIndex 
                        ? { ...player, folded: true }
                        : player
                )
            }));
        }

        // Update current bet if it's a raise
        if (action === 'raise') {
            setCurrentBet(amount);
            setLastRaise(amount - currentBet);
            setLastRaiser(playerIndex);
            setLastRaiseActionIndex(gameState.bettingActions.length);
        }

        // Check if betting round is complete
        const isBettingRoundComplete = checkBettingRoundComplete(playerIndex, action, totalAmount);
        if (isBettingRoundComplete) {
            setBettingRoundComplete(true);
            handleNextStreet();
            return;
        }

        // Move to next player
        const nextPlayerIndex = getNextActivePlayer(playerIndex);
        setCurrentActionIndex(nextPlayerIndex);
    };

    const checkBettingRoundComplete = (currentPlayerIndex, action, amount) => {
        if (lastRaiser !== null) {
            // For preflop, we need to get back to the BB if no raises, or last raiser if there was a raise
            if (currentStreet === 'preflop') {
                const bbPosition = (gameState.buttonPosition - 2 + gameState.numPlayers) % gameState.numPlayers;
                
                if (lastRaise > 0) {
                    // Get all actions in the current street after the last raise
                    const actionsAfterRaise = [...gameState.bettingActions, {
                        playerIndex: currentPlayerIndex,
                        action,
                        amount,
                        street: currentStreet
                    }].filter(action => action.street === currentStreet)
                      .slice(lastRaiseActionIndex);

                    // Get all active players who haven't folded
                    const activePlayers = Array.from({ length: gameState.numPlayers }, (_, i) => i)
                        .filter(i => !foldedPlayers.has(i));

                    // Get all players who have acted after the raise (including the raiser)
                    const playersWhoActed = new Set(actionsAfterRaise.map(action => action.playerIndex));

                    // Check if all active players have acted after the raise
                    const allPlayersActed = activePlayers.every(playerIndex => 
                        playersWhoActed.has(playerIndex)
                    );

                    // If this is a raise, we need to continue the action
                    if (action === 'raise') {
                        // For all-in raises, we need to continue until we reach the all-in player again
                        if (amount === (gameState.heroStackSize + (streetBets[gameState.heroPosition] || 0))) {
                            // Only complete if we've reached the all-in player again
                            const nextPlayerIndex = getNextActivePlayer(currentPlayerIndex);
                            return nextPlayerIndex === currentPlayerIndex;
                        }
                        return false;
                    }

                    return allPlayersActed;
                }
            } else {
                // For postflop, we need to get back to the last raiser if there was a raise
                // or complete a full round if there were no raises
                if (lastRaise > 0) {
                    // Get all actions in the current street after the last raise
                    const actionsAfterRaise = [...gameState.bettingActions, {
                        playerIndex: currentPlayerIndex,
                        action,
                        amount,
                        street: currentStreet
                    }].filter(action => action.street === currentStreet)
                      .slice(lastRaiseActionIndex);

                    // Get all active players who haven't folded
                    const activePlayers = Array.from({ length: gameState.numPlayers }, (_, i) => i)
                        .filter(i => !foldedPlayers.has(i));

                    // Get all players who have acted after the raise (including the raiser)
                    const playersWhoActed = new Set(actionsAfterRaise.map(action => action.playerIndex));

                    // Check if all active players have acted after the raise
                    const allPlayersActed = activePlayers.every(playerIndex => 
                        playersWhoActed.has(playerIndex)
                    );

                    // If this is a raise, we need to continue the action
                    if (action === 'raise') {
                        // For all-in raises, we need to continue until we reach the all-in player again
                        if (amount === (gameState.heroStackSize + (streetBets[gameState.heroPosition] || 0))) {
                            // Only complete if we've reached the all-in player again
                            const nextPlayerIndex = getNextActivePlayer(currentPlayerIndex);
                            return nextPlayerIndex === currentPlayerIndex;
                        }
                        return false;
                    }

                    return allPlayersActed;
                }
            }
        }

        // Handle betting round completion for no-raises case
        if (lastRaiser === null) {
            if (currentStreet === 'preflop') {
                const bbPosition = (gameState.buttonPosition - 2 + gameState.numPlayers) % gameState.numPlayers;
                if (currentPlayerIndex === bbPosition) {
                    // Check if all players have acted
                    const actionsInCurrentStreet = [...gameState.bettingActions, {
                        playerIndex: currentPlayerIndex,
                        action,
                        amount,
                        street: currentStreet
                    }].filter(action => action.street === currentStreet);
                    
                    const playersWhoActed = new Set(actionsInCurrentStreet.map(action => action.playerIndex));
                    const activePlayers = Array.from({ length: gameState.numPlayers }, (_, i) => i)
                        .filter(i => !foldedPlayers.has(i));

                    return activePlayers.every(playerIndex => 
                        playersWhoActed.has(playerIndex)
                    );
                }
            } else {
                // For postflop, we need to complete a full round
                const sbPosition = (gameState.buttonPosition - 1 + gameState.numPlayers) % gameState.numPlayers;
                let nextActivePlayer = sbPosition;
                
                // If SB has folded, find the next active player
                if (foldedPlayers.has(sbPosition)) {
                    nextActivePlayer = getNextActivePlayer(sbPosition);
                }

                // If this is a bet (not a check), we need to continue the action
                if (action === 'raise') {
                    return false;
                }

                const nextPlayerIndex = getNextActivePlayer(currentPlayerIndex);
                if (nextPlayerIndex === nextActivePlayer) {
                    // Check if all players have acted
                    const actionsInCurrentStreet = [...gameState.bettingActions, {
                        playerIndex: currentPlayerIndex,
                        action,
                        amount,
                        street: currentStreet
                    }].filter(action => action.street === currentStreet);
                    
                    const playersWhoActed = new Set(actionsInCurrentStreet.map(action => action.playerIndex));
                    const activePlayers = Array.from({ length: gameState.numPlayers }, (_, i) => i)
                        .filter(i => !foldedPlayers.has(i));

                    return activePlayers.every(playerIndex => 
                        playersWhoActed.has(playerIndex)
                    );
                }
            }
        }

        return false;
    };

    const handleNextAction = () => {
        const currentPlayer = gameState.players[currentActionIndex];
        
        // If it's hero's turn, don't proceed
        if (currentActionIndex === gameState.heroPosition) {
            return;
        }

        // If betting round is complete, move to next street
        if (bettingRoundComplete) {
            handleNextStreet();
            return;
        }

        // Get bot action
        const botAction = getBotAction(currentActionIndex);
        handleBotAction(currentActionIndex, botAction.action, botAction.amount);
    };

    const handlePreviousAction = () => {
        // Find the last action in the current street
        const currentStreetActions = gameState.bettingActions.filter(
            action => action.street === currentStreet
        );
        
        if (currentStreetActions.length === 0) {
            return;
        }

        const lastAction = currentStreetActions[currentStreetActions.length - 1];
        
        // Remove the last action
        setGameState(prev => ({
            ...prev,
            bettingActions: prev.bettingActions.filter((_, index) => 
                index !== prev.bettingActions.length - 1
            ),
            players: prev.players.map(player => {
                if (player.position === lastAction.playerIndex) {
                    return {
                        ...player,
                        stackSize: player.stackSize + (lastAction.amount || 0),
                        bet: player.bet - (lastAction.amount || 0),
                        folded: lastAction.action === 'fold' ? false : player.folded
                    };
                }
                return player;
            })
        }));

        // Update current action index
        setCurrentActionIndex(lastAction.playerIndex);
    };

    const handleNextStreet = () => {
        // Reset betting round state
        setBettingRoundComplete(false);
        setLastRaise(0);
        setLastRaiser(null);
        setCurrentBet(0);
        setStreetBets({});
        setRaiseAmount(2); // Reset raise amount to default

        // Move to next street
        switch (currentStreet) {
            case 'preflop':
                setCurrentStreet('flop');
                // Deal flop
                setGameState(prev => ({
                    ...prev,
                    communityCards: {
                        ...prev.communityCards,
                        flop: prev.communityCards.flop
                    }
                }));
                break;
            case 'flop':
                setCurrentStreet('turn');
                // Deal turn
                setGameState(prev => ({
                    ...prev,
                    communityCards: {
                        ...prev.communityCards,
                        turn: prev.communityCards.turn
                    }
                }));
                break;
            case 'turn':
                setCurrentStreet('river');
                // Deal river
                setGameState(prev => ({
                    ...prev,
                    communityCards: {
                        ...prev.communityCards,
                        river: prev.communityCards.river
                    }
                }));
                break;
            case 'river':
                // End of hand, show showdown
                handleShowdown();
                return;
        }

        // Reset player bets for the new street
        setGameState(prev => ({
            ...prev,
            players: prev.players.map(player => ({
                ...player,
                bet: 0
            }))
        }));

        // Start new betting round from first active player after button
        const firstToAct = getNextActivePlayer(gameState.buttonPosition);
        setCurrentActionIndex(firstToAct);

        // If first to act is a bot, let them act
        if (firstToAct !== gameState.heroPosition) {
            setTimeout(() => {
                const botAction = getBotAction(firstToAct);
                handleBotAction(firstToAct, botAction.action, botAction.amount);
            }, 1000);
        }
    };

    const handleShowdown = () => {
        // TODO: Implement showdown logic
        console.log('Showdown!');
        // For now, just reset the game
        setGamePhase('setup');
    };

    const getBotAction = (position) => {
        const player = gameState.players.find(p => p.position === position);
        if (!player) return { action: 'fold' }; // Safety check

        const personality = player.personality;
        
        // Format community cards into a single array
        const communityCardsArray = [
            ...gameState.communityCards.flop,
            gameState.communityCards.turn,
            gameState.communityCards.river
        ].filter(card => card); // Remove empty strings

        const handStrength = calculateHandStrength(player.cards, communityCardsArray);
        const potSize = calculatePotSize();
        const currentBet = gameState.currentBet;
        const playerBet = player.bet || 0;
        const toCall = currentBet - playerBet;
        const stackSize = player.stackSize;
        const playerPosition = player.position;
        const isButton = playerPosition === gameState.buttonPosition;
        const isSmallBlind = playerPosition === (gameState.buttonPosition + 1) % gameState.numPlayers;
        const isBigBlind = playerPosition === (gameState.buttonPosition + 2) % gameState.numPlayers;
        const isPreFlop = communityCardsArray.length === 0;
        const isFlop = communityCardsArray.length === 3;
        const isTurn = communityCardsArray.length === 4;
        const isRiver = communityCardsArray.length === 5;

        // Calculate pot odds
        const potOdds = toCall / (potSize + toCall);

        // Calculate position strength (0 to 1)
        const positionStrength = isButton ? 1 : isSmallBlind ? 0.8 : isBigBlind ? 0.9 : 0.7;

        // Calculate stage strength (0 to 1)
        const stageStrength = isPreFlop ? 0.5 : isFlop ? 0.7 : isTurn ? 0.8 : 0.9;

        // Calculate overall strength (0 to 1)
        const overallStrength = (handStrength * 0.6) + (positionStrength * 0.2) + (stageStrength * 0.2);

        // Personality-based adjustments
        let aggressionFactor = 1;
        let tightnessFactor = 1;

        switch (personality) {
            case 'tightPassive':
                tightnessFactor = 1.5;
                aggressionFactor = 0.7;
                break;
            case 'looseAggressive':
                tightnessFactor = 0.7;
                aggressionFactor = 1.5;
                break;
            case 'balanced':
                tightnessFactor = 1;
                aggressionFactor = 1;
                break;
        }

        // Adjust overall strength based on personality
        const adjustedStrength = overallStrength * tightnessFactor;

        // Decision making
        if (adjustedStrength < 0.3) {
            // Weak hand
            if (toCall === 0) {
                return { action: 'check' };
            } else if (potOdds < 0.2) {
                return { action: 'call' };
            } else {
                return { action: 'fold' };
            }
        } else if (adjustedStrength < 0.6) {
            // Medium hand
            if (toCall === 0) {
                return { action: 'check' };
            } else if (potOdds < 0.3) {
                return { action: 'call' };
            } else if (aggressionFactor > 1 && Math.random() < 0.3) {
                const raiseAmount = Math.min(
                    Math.floor(potSize * 0.75 * aggressionFactor),
                    stackSize
                );
                return { action: 'raise', amount: raiseAmount };
            } else {
                return { action: 'fold' };
            }
        } else {
            // Strong hand
            if (toCall === 0) {
                if (aggressionFactor > 1 && Math.random() < 0.7) {
                    const raiseAmount = Math.min(
                        Math.floor(potSize * 0.75 * aggressionFactor),
                        stackSize
                    );
                    return { action: 'raise', amount: raiseAmount };
                }
                return { action: 'check' };
            } else if (potOdds < 0.4) {
                if (aggressionFactor > 1 && Math.random() < 0.5) {
                    const raiseAmount = Math.min(
                        Math.floor(potSize * 0.75 * aggressionFactor),
                        stackSize
                    );
                    return { action: 'raise', amount: raiseAmount };
                }
                return { action: 'call' };
            } else if (aggressionFactor > 1 && Math.random() < 0.3) {
                const raiseAmount = Math.min(
                    Math.floor(potSize * 0.75 * aggressionFactor),
                    stackSize
                );
                return { action: 'raise', amount: raiseAmount };
            } else {
                return { action: 'call' };
            }
        }
    };

    const handleHeroAction = (action, amount = 0) => {
        if (action === 'fold') {
            setHeroFolded(true);
        }

        // Calculate the amount to deduct from stack
        const player = gameState.players.find(p => p.position === gameState.heroPosition);
        const currentBet = gameState.currentBet || 0;
        const playerBetAmount = player?.bet || 0;
        const amountToCall = currentBet - playerBetAmount;
        
        // For raises, the total amount is the difference between the raise amount and current bet
        const totalAmount = action === 'raise' ? (amount - playerBetAmount) : 
                           action === 'call' ? amountToCall : 0;

        // Calculate the new bet amount
        const newBetAmount = action === 'fold' ? playerBetAmount :
                            action === 'raise' ? amount :
                            action === 'call' ? currentBet : 0;

        // Update hero's stack and bet
        setGameState(prev => ({
            ...prev,
            players: prev.players.map(player => {
                if (player.position === gameState.heroPosition) {
                    const newStack = player.stackSize - totalAmount;
                    return {
                        ...player,
                        stackSize: Math.max(0, newStack),
                        bet: newBetAmount
                    };
                }
                return player;
            }),
            bettingActions: [...prev.bettingActions, {
                playerIndex: gameState.heroPosition,
                position: getPlayerPosition(gameState.heroPosition),
                action,
                amount: totalAmount,
                street: currentStreet
            }],
            currentBet: action === 'raise' ? amount : prev.currentBet
        }));

        // If hero folds, update folded state
        if (action === 'fold') {
            setFoldedPlayers(prev => new Set([...prev, gameState.heroPosition]));
        }

        // Update current bet if it's a raise
        if (action === 'raise') {
            setCurrentBet(amount);
            setLastRaise(amount - currentBet);
            setLastRaiser(gameState.heroPosition);
            setLastRaiseActionIndex(gameState.bettingActions.length);
        }

        // Check if betting round is complete
        const isBettingRoundComplete = checkBettingRoundComplete(gameState.heroPosition, action, totalAmount);
        if (isBettingRoundComplete) {
            setBettingRoundComplete(true);
            handleNextStreet();
            return;
        }

        // Move to next player
        let nextPlayerIndex = getNextActivePlayer(gameState.heroPosition);
        setCurrentActionIndex(nextPlayerIndex);
    };

    const isBettingRoundComplete = () => {
        // Implementation similar to PokerTable.jsx
        // Check if all active players have acted and betting is complete
        return bettingRoundComplete;
    };

    const getNextActivePlayer = (currentIndex) => {
        let nextIndex = (currentIndex - 1 + gameState.numPlayers) % gameState.numPlayers;
        let steps = 0;
        
        while (steps < gameState.numPlayers) {
            if (!foldedPlayers.has(nextIndex)) {
                return nextIndex;
            }
            nextIndex = (nextIndex - 1 + gameState.numPlayers) % gameState.numPlayers;
            steps++;
        }
        return null;
    };

    const getPlayerPosition = (index) => {
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

        if (gameState.numPlayers === 2) {
            return positions[2][index];
        }

        const basePositions = positions[gameState.numPlayers];
        const distanceFromButton = (gameState.buttonPosition - index + gameState.numPlayers) % gameState.numPlayers;
        return basePositions[distanceFromButton];
    };

    const handleVillainCardClick = (playerIndex) => {
        setRevealedVillains(prev => {
            const newRevealed = new Set(prev);
            if (newRevealed.has(playerIndex)) {
                newRevealed.delete(playerIndex);
            } else {
                newRevealed.add(playerIndex);
            }
            return newRevealed;
        });
    };

    const renderQuestionMarkCard = () => {
        return (
            <div className="card question-mark">
                <div className="card-rank">?</div>
            </div>
        );
    };

    const renderPlayerCards = (playerIndex) => {
        const isHero = playerIndex === gameState.heroPosition;
        const isVillain = !foldedPlayers.has(playerIndex) && playerIndex !== gameState.heroPosition;
        const hasFolded = foldedPlayers.has(playerIndex);
        const player = gameState.players.find(p => p.position === playerIndex);
        const isRevealed = revealedVillains.has(playerIndex);
        
        if (hasFolded) {
            return null;
        }

        if (isHero) {
            return (
                <div className="player-cards">
                    {player?.cards.map((card, index) => (
                        <div key={index} className="card-container">
                            {renderCard(card)}
                        </div>
                    ))}
                </div>
            );
        } else {
            return (
                <div 
                    className="player-cards" 
                    onClick={isVillain ? () => handleVillainCardClick(playerIndex) : undefined}
                    style={{ cursor: isVillain ? 'pointer' : 'default' }}
                >
                    {player?.cards.map((card, index) => (
                        <div key={index} className="card-container">
                            {isRevealed ? 
                                (card ? renderCard(card) : renderQuestionMarkCard()) : 
                                <img src={cardBack} alt="Card Back" className="card-back" />
                            }
                        </div>
                    ))}
                </div>
            );
        }
    };

    const renderSeats = () => {
        const seats = [];
        const centerX = 283; // Half of table width
        const centerY = 270; // Half of table height
        const radius = 140; // Distance from center to seats
        
        for (let i = 0; i < gameState.numPlayers; i++) {
            const totalSeats = gameState.numPlayers;
            const angleStep = (2 * Math.PI) / totalSeats;
            const angle = -((angleStep * i) - Math.PI/2);
            
            const x = centerX + 1.6 * radius * Math.cos(angle);
            const y = centerY + 1.2 * radius * Math.sin(angle);

            const isButton = i === gameState.buttonPosition;
            const isCurrentAction = i === currentActionIndex;
            const position = getPlayerPosition(i);
            const isHero = i === gameState.heroPosition;
            const player = gameState.players[i];
            const playerBet = player?.bet || 0;
            const isVillain = !foldedPlayers.has(i) && i !== gameState.heroPosition;

            // Check if this is the small blind or big blind position
            const isSmallBlind = i === (gameState.buttonPosition - 1 + gameState.numPlayers) % gameState.numPlayers;
            const isBigBlind = i === (gameState.buttonPosition - 2 + gameState.numPlayers) % gameState.numPlayers;

            // Get the last action for this player in the current street
            const lastAction = gameState.bettingActions
                .filter(action => action.street === currentStreet && action.playerIndex === i)
                .slice(-1)[0];

            // Determine if we should show the bet amount
            const showBet = playerBet > 0 || (lastAction && lastAction.action !== 'fold');

            seats.push(
                <div
                    key={i}
                    className={`seat ${isButton ? 'button' : ''} ${isCurrentAction ? 'current-action' : ''}`}
                    style={{
                        position: 'absolute',
                        left: `${x - 30}px`,
                        top: `${y - 30}px`,
                    }}
                >
                    {isButton && <div className="dealer-button">D</div>}
                    <div className="player-info">
                        <div 
                            className={`player-position ${isVillain ? 'clickable' : ''}`}
                            onClick={isVillain ? () => handleVillainCardClick(i) : undefined}
                        >
                            {position}
                        </div>
                        <div className="stack-size">{player?.stackSize || 0}BB</div>
                    </div>
                    {showBet && (
                        <div className="bet-amount">
                            {isSmallBlind && lastAction?.action === 'post' ? '0.5BB' :
                             isBigBlind && lastAction?.action === 'post' ? '1BB' :
                             `${playerBet}BB`}
                        </div>
                    )}
                    {renderPlayerCards(i)}
                </div>
            );
        }
        return seats;
    };

    const renderCommunityCards = () => {
        const { flop, turn, river } = gameState.communityCards;
        
        return (
            <div className="community-cards">
                {/* Show flop cards if we're at flop or later */}
                {currentStreet !== 'preflop' && flop.map((card, index) => (
                    <div key={`flop-${index}`} className="card-container">
                        {renderCard(card)}
                    </div>
                ))}
                {/* Show turn card if we're at turn or river */}
                {currentStreet !== 'preflop' && currentStreet !== 'flop' && (
                    <div className="card-container">
                        {renderCard(turn)}
                    </div>
                )}
                {/* Show river card only if we're at river */}
                {currentStreet === 'river' && (
                    <div className="card-container">
                        {renderCard(river)}
                    </div>
                )}
            </div>
        );
    };

    const renderCard = (card) => {
        if (!card) return null;
        const rank = card[0]?.toUpperCase() || '';
        const suit = card[1]?.toLowerCase() || '';
        const suitSymbol = {
            's': '♠',
            'h': '♥',
            'd': '♦',
            'c': '♣'
        }[suit] || '';

        const colorClass = {
            'h': 'red',
            'd': 'diamonds',
            'c': 'clubs',
            's': ''
        }[suit] || '';

        const displayRank = rank === 'T' ? '10' : rank;

        return (
            <div className={`card ${colorClass}`}>
                <div className="card-rank">{displayRank}</div>
                <div className="card-suit">{suitSymbol}</div>
            </div>
        );
    };

    const renderBettingActions = () => {
        const lastAction = gameState.bettingActions
            .filter(action => action.street === currentStreet)
            .slice(-1)[0];
        const isBlindPosting = lastAction?.action === 'post';
        
        // Calculate minimum raise amount
        const minRaise = currentStreet === 'preflop' ? 
            Math.max(2, gameState.currentBet + (lastRaise || 1)) : 
            Math.max(1, gameState.currentBet + (lastRaise || 0));

        // Get current player's bet amount
        const player = gameState.players.find(p => p.position === gameState.heroPosition);
        const playerBetAmount = player?.bet || 0;

        // Debug logging
        console.log('Debug betting actions:', {
            lastAction,
            currentBet: gameState.currentBet,
            playerBetAmount,
            isBlindPosting,
            lastActionAmount: lastAction?.amount,
            lastActionType: lastAction?.action
        });

        // Calculate available actions
        const isFacingRaise = lastAction?.action === 'raise' || 
            (lastAction?.action === 'post' && lastAction?.amount === 1); // Treat BB posting as a raise
        const canCheck = gameState.currentBet === playerBetAmount && !isFacingRaise;
        const canFold = playerBetAmount < gameState.currentBet;
        const canCall = gameState.currentBet > playerBetAmount;

        // Debug logging for action conditions
        console.log('Action conditions:', {
            isFacingRaise,
            canCheck,
            canFold,
            canCall,
            currentBet: gameState.currentBet,
            playerBetAmount
        });

        // Calculate raise amounts
        const heroStack = player?.stackSize || 0;
        const heroBetInCurrentStreet = playerBetAmount;
        const maxRaise = heroStack + heroBetInCurrentStreet;
        const showAllInOnly = minRaise > maxRaise;
        const allInAmount = maxRaise;

        // Check if there's an all-in bet in the current street
        const allInBetInStreet = gameState.bettingActions
            .filter(action => action.street === currentStreet)
            .some(action => action.action === 'raise' && 
                action.amount === maxRaise);

        // Determine if raising is allowed
        const canRaise = !allInBetInStreet && 
            (gameState.currentBet < maxRaise || 
            (currentActionIndex === gameState.heroPosition && heroStack >= playerBetAmount));

        return (
            <div className="betting-actions">
                {lastAction && (
                    <div className="last-action">
                        <span className="position">{lastAction.position}:</span>
                        <span className="action">{isBlindPosting ? 'posts' : lastAction.action}</span>
                        {lastAction.amount > 0 && (
                            <span className="amount">{lastAction.amount}BB</span>
                        )}
                    </div>
                )}
                {!bettingRoundComplete && currentActionIndex === gameState.heroPosition && (
                    <>
                        <div className="action-buttons">
                            {canFold && <button onClick={() => handleHeroAction('fold')}>Fold</button>}
                            {canCheck && <button onClick={() => handleHeroAction('check')}>Check</button>}
                            {canCall && <button onClick={() => handleHeroAction('call')}>
                                {allInBetInStreet ? 'Call All In' : `Call ${gameState.currentBet - playerBetAmount}BB`}
                            </button>}
                            {showAllInOnly && !allInBetInStreet && (
                                <button 
                                    className="raise-button"
                                    onClick={() => handleHeroAction('raise', allInAmount)}
                                >
                                    All In {allInAmount}BB
                                </button>
                            )}
                        </div>
                        {canRaise && !showAllInOnly && !allInBetInStreet && (
                            <div className="raise-slider-container">
                                <div className="raise-slider">
                                    <input
                                        type="range"
                                        min={minRaise}
                                        max={maxRaise}
                                        value={raiseAmount}
                                        onChange={(e) => setRaiseAmount(parseFloat(e.target.value))}
                                        step="0.5"
                                        className="raise-slider-input"
                                    />
                                    <div className="raise-markers">
                                        <span>{minRaise}BB</span>
                                        <span>{Math.round((maxRaise - minRaise) / 3 + minRaise)}BB</span>
                                        <span>{Math.round((maxRaise - minRaise) * 2 / 3 + minRaise)}BB</span>
                                        <span>{maxRaise}BB</span>
                                    </div>
                                </div>
                                <button 
                                    className="raise-button"
                                    onClick={() => handleHeroAction('raise', raiseAmount)}
                                >
                                    Raise to {raiseAmount}BB
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };

    const calculatePotSize = () => {
        return gameState.bettingActions.reduce((total, action) => {
            return total + (action.amount || 0);
        }, 0);
    };

    return (
        <div className="poker-table-container">
            <div className="poker-table">
                {renderSeats()}
                <div className="community-cards-area">
                    {renderCommunityCards()}
                </div>
                <div className="pot-display">
                    <div className="total-pot">
                        Total Pot: <span className="pot-amount">{calculatePotSize()}BB</span>
                    </div>
                </div>
            </div>
            <div className="controls">
                {gamePhase === 'setup' && (
                    <div className="setup-controls">
                        <h3>Game Setup</h3>
                        <div className="difficulty-selector">
                            <label>Bot Difficulty:</label>
                            <select 
                                value={botDifficulty}
                                onChange={(e) => setBotDifficulty(e.target.value)}
                            >
                                <option value={BOT_DIFFICULTY.EASY}>Easy</option>
                                <option value={BOT_DIFFICULTY.MEDIUM}>Medium</option>
                                <option value={BOT_DIFFICULTY.HARD}>Hard</option>
                            </select>
                        </div>
                        <button onClick={() => setGamePhase('playing')}>
                            Start Game
                        </button>
                    </div>
                )}
                {gamePhase === 'playing' && (
                    <div className="betting-controls">
                        {renderBettingActions()}
                        <div className="navigation-controls">
                            <button 
                                onClick={handlePreviousAction}
                                disabled={gameState.bettingActions.length === 0}
                            >
                                Previous Action
                            </button>
                            <button 
                                onClick={handleNextAction}
                                disabled={currentActionIndex === gameState.heroPosition}
                            >
                                Next Action
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BotPokerGame; 