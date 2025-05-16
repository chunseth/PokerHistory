import React, { useState, useEffect } from 'react';
import './PokerTable.css';
import cardBack from '../assets/BackOfCard.png';

const PokerTable = ({ onHandComplete }) => {
    const [step, setStep] = useState(1);
    const [showConfirmPanel, setShowConfirmPanel] = useState(false);
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);
    const [hand, setHand] = useState({
        username: '',
        gameType: 'cash',
        numPlayers: 6,
        buttonPosition: 0,
        heroPosition: 0,
        heroStackSize: 0,
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
        villainCards: []
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

    // Update the useEffect for initial setup
    useEffect(() => {
        // Calculate UTG position (3 seats clockwise from button)
        const utgPosition = (hand.buttonPosition - 3 + hand.numPlayers) % hand.numPlayers;
        setCurrentActionIndex(utgPosition);
        
        // Reset betting state when starting a new hand
        setCurrentBet(1); // BB is 1
        setLastRaise(0);
        setFoldedPlayers(new Set());
        setRaiseAmount(2);
        setBettingRoundComplete(false);
        setLastRaiser(null);
        setHasAllIn(false);

        // Post blinds at the start of the hand
        const sbPosition = (hand.buttonPosition - 1 + hand.numPlayers) % hand.numPlayers;
        const bbPosition = (hand.buttonPosition - 2 + hand.numPlayers) % hand.numPlayers;

        // Post small blind
        const sbAction = {
            playerIndex: sbPosition,
            position: getPlayerPosition(sbPosition),
            action: 'post',
            amount: 0.5,
            street: 'preflop'
        };

        // Post big blind
        const bbAction = {
            playerIndex: bbPosition,
            position: getPlayerPosition(bbPosition),
            action: 'post',
            amount: 1,
            street: 'preflop'
        };

        setHand(prev => ({
            ...prev,
            bettingActions: [sbAction, bbAction]
        }));

        // Set initial player bets including blinds
        setPlayerBets({
            [sbPosition]: 0.5,
            [bbPosition]: 1
        });

        // Set initial street bets for preflop
        setStreetBets({
            [sbPosition]: 0.5,
            [bbPosition]: 1
        });
    }, [hand.buttonPosition, hand.numPlayers]);

    // Handle transition to flop
    useEffect(() => {
        if (step === 7) { // Assuming step 7 is the flop
            // Reset betting state but keep folded players
            setCurrentBet(0);
            setLastRaise(0);
            setRaiseAmount(1);
            setBettingRoundComplete(false);
            setLastRaiser(null);
            // Reset street bets for the new street
            setStreetBets({});
            setCurrentStreet('flop');  // Explicitly set currentStreet to 'flop'

            // Don't filter out previous betting actions to maintain pot history
            setHand(prev => ({
                ...prev,
                currentStreet: 'flop'
            }));

            // Start from the small blind position
            const sbPosition = (hand.buttonPosition - 1 + hand.numPlayers) % hand.numPlayers;
            
            // If SB is folded, find the next active player
            if (foldedPlayers.has(sbPosition)) {
                let nextPlayer = (sbPosition - 1 + hand.numPlayers) % hand.numPlayers;
                while (foldedPlayers.has(nextPlayer) && nextPlayer !== sbPosition) {
                    nextPlayer = (nextPlayer - 1 + hand.numPlayers) % hand.numPlayers;
                }
                setCurrentActionIndex(nextPlayer);
            } else {
                setCurrentActionIndex(sbPosition);
            }
        }
    }, [step, hand.buttonPosition, hand.numPlayers, foldedPlayers]);

    // Handle transition to turn and river
    useEffect(() => {
        if (step === 9 || step === 11) { // Assuming step 9 is the turn and 11 is the river
            const street = step === 9 ? 'turn' : 'river';
            // Reset betting state but keep folded players
            setCurrentBet(0);
            setLastRaise(0);
            setRaiseAmount(1);
            setBettingRoundComplete(false);
            setLastRaiser(null);
            // Reset street bets for the new street
            setStreetBets({});
            setCurrentStreet(street);  // Set currentStreet to turn or river

            // Don't filter out previous betting actions to maintain pot history
            setHand(prev => ({
                ...prev,
                currentStreet: street
            }));

            // Start from the small blind position
            const sbPosition = (hand.buttonPosition - 1 + hand.numPlayers) % hand.numPlayers;
            
            // If SB is folded, find the next active player
            if (foldedPlayers.has(sbPosition)) {
                let nextPlayer = (sbPosition - 1 + hand.numPlayers) % hand.numPlayers;
                while (foldedPlayers.has(nextPlayer) && nextPlayer !== sbPosition) {
                    nextPlayer = (nextPlayer - 1 + hand.numPlayers) % hand.numPlayers;
                }
                setCurrentActionIndex(nextPlayer);
            } else {
                setCurrentActionIndex(sbPosition);
            }
        }
    }, [step, hand.buttonPosition, hand.numPlayers, foldedPlayers]);

    // Update raise amount when current bet changes
    useEffect(() => {
        const minRaise = currentStreet === 'preflop' ? 
            Math.max(2, currentBet + (lastRaise || 1)) : 
            Math.max(1, currentBet + (lastRaise || 0));
        
        setRaiseAmount(minRaise);
    }, [currentBet, lastRaise, currentStreet]);

    // Update the useEffect for betting street transitions
    useEffect(() => {
        if (step === 6 || step === 8 || step === 10 || step === 12) {
            setFirstActionTaken(false);
        }
    }, [step]);

    const validateCommunityCards = () => {
        if (step === 7) {
            // Validate flop cards
            return hand.communityCards.flop.every(card => card && card.length === 2);
        } else if (step === 9) {
            // Validate turn card
            return hand.communityCards.turn && hand.communityCards.turn.length === 2;
        } else if (step === 11) {
            // Validate river card
            return hand.communityCards.river && hand.communityCards.river.length === 2;
        }
        return true;
    };

    const handleNext = () => {
        // If hero has folded, allow moving to the next step
        if (heroFolded) {
            setStep(13);
            return;
        }

        // Check if hero's stack is 0 only on the stack size input step
        if (step === 4 && hand.heroStackSize === 0) {
            alert('Please enter a stack size greater than 0');
            return;
        }

        // Check if we're on the hole cards step and validate both cards
        if (step === 5) {
            const validRanks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
            const validSuits = ['c', 's', 'h', 'd'];
            
            const areCardsValid = hand.heroHoleCards.every(card => {
                if (!card || card.length !== 2) return false;
                const rank = card[0]?.toUpperCase();
                const suit = card[1]?.toLowerCase();
                return validRanks.includes(rank) && validSuits.includes(suit);
            });

            if (!areCardsValid) {
                alert('Please enter valid hole cards (e.g., Ah, Kd, Ts)');
                return;
            }
        }

        // Validate community cards
        if (!validateCommunityCards()) {
            if (step === 7) {
                alert('Please enter all three flop cards');
            } else if (step === 9) {
                alert('Please enter the turn card');
            } else if (step === 11) {
                alert('Please enter the river card');
            }
            return;
        }

        if (step < 13) {
            let nextStep = step + 1;
            
            // If there's been an all-in, skip betting streets
            if (hasAllIn) {
                if (step === 6) { // After preflop
                    nextStep = 7; // Go to flop cards
                } else if (step === 7) { // After flop cards
                    nextStep = 9; // Skip flop betting, go to turn card
                } else if (step === 9) { // After turn card
                    nextStep = 11; // Skip turn betting, go to river card
                } else if (step === 11) { // After river card
                    nextStep = 13; // Skip river betting, go to villain cards
                }
            }

            setStep(nextStep);
            
            // Only reset betting state when moving to a betting step
            if (nextStep === 8 || nextStep === 10 || nextStep === 12) {
                setCurrentBet(0);
                setLastRaise(0);
                setBettingRoundComplete(false);
                // Set action to UTG for preflop
                if (nextStep === 6) {
                    const utgPosition = (hand.buttonPosition - 3 + hand.numPlayers) % hand.numPlayers;
                    setCurrentActionIndex(utgPosition);
                }
                // For flop and later streets, the useEffect will handle setting the first active player
            }
            // Reset playerBets when moving from flop betting to turn card entry
            if (step === 8) {
                setPlayerBets({});
            }
        }
    };

    const handlePrevious = () => {
        // For betting streets, handle differently
        if (step === 6 || step === 8 || step === 10 || step === 12) {
            if (!firstActionTaken) {
                // If no action has been taken on this street, go back to previous step
                setStep(step - 1);
            } else {
                // If actions have been taken, remove the last action
                const lastAction = hand.bettingActions[hand.bettingActions.length - 1];
                
                // Remove the last action from bettingActions
                setHand(prev => ({
                    ...prev,
                    bettingActions: prev.bettingActions.slice(0, -1)
                }));

                const playerIndex = lastAction.playerIndex;
                const actionAmount = lastAction.amount || 0;

                // Find the previous betting state
                const previousActions = hand.bettingActions.slice(0, -1);
                
                // Find all raises in the current street
                const raisesInStreet = previousActions
                    .filter(action => action.action === 'raise' && action.street === currentStreet)
                    .reverse();
                
                // Get the last raise (if any)
                const lastRaiseAction = raisesInStreet[0];
                
                // Calculate the previous current bet, considering BB as base for preflop
                const previousCurrentBet = lastRaiseAction?.amount || (currentStreet === 'preflop' ? 1 : 0);
                
                // For the first raise of the street, use the standard increment
                // For subsequent raises, use the difference between the last two raises
                let raiseIncrement;
                if (!lastRaiseAction) {
                    // No raises in the street yet
                    raiseIncrement = currentStreet === 'preflop' ? 1 : 1;
                } else if (raisesInStreet.length === 1) {
                    // First raise of the street
                    if (currentStreet === 'preflop') {
                        raiseIncrement = Math.max(1, previousCurrentBet - 1);
                    } else {
                        // For postflop, the increment is the amount of the first raise
                        raiseIncrement = Math.max(1, previousCurrentBet);
                    }
                } else {
                    // Subsequent raises - use the difference between the last two raises
                    const previousRaiseAmount = raisesInStreet[1]?.amount || 0;
                    raiseIncrement = Math.max(1, lastRaiseAction.amount - previousRaiseAmount);
                }
                
                // Update currentBet and lastRaise
                setCurrentBet(previousCurrentBet);
                setLastRaise(raiseIncrement);
                
                // Update lastRaiser
                setLastRaiser(lastRaiseAction?.playerIndex || null);

                // Update playerBets and streetBets
                if (lastAction.action === 'raise' || lastAction.action === 'call') {
                    // For raises and calls, subtract the additional amount bet
                    const previousPlayerBet = streetBets[playerIndex] || 0;
                    const additionalAmount = actionAmount;
                    
                    setPlayerBets(prev => ({
                        ...prev,
                        [playerIndex]: Math.max(0, (prev[playerIndex] || 0) - additionalAmount)
                    }));

                    setStreetBets(prev => ({
                        ...prev,
                        [playerIndex]: Math.max(0, previousPlayerBet - additionalAmount)
                    }));
                }

                // If the last action was a fold, remove the player from foldedPlayers
                if (lastAction.action === 'fold') {
                    setFoldedPlayers(prev => {
                        const newFolded = new Set(prev);
                        newFolded.delete(playerIndex);
                        return newFolded;
                    });
                }

                // Set the current action back to the player who just acted
                setCurrentActionIndex(playerIndex);
                setBettingRoundComplete(false);
            }
        } else {
            // For non-betting streets, just go back to previous step
            setStep(step - 1);
        }
    };

    const getPlayerPosition = (index) => {
        if (hand.playerPositions) {
            return hand.playerPositions[index];
        }
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
        if (hand.numPlayers === 2) {
            return positions[2][index];
        }

        // Get the base positions for the current number of players
        const basePositions = positions[hand.numPlayers];
        
        // Calculate the clockwise distance from the button
        // We need to reverse the order because the seats are placed counter-clockwise
        const distanceFromButton = (hand.buttonPosition - index + hand.numPlayers) % hand.numPlayers;
        
        // The position index is the distance from the button
        return basePositions[distanceFromButton];
    };

    const handleButtonSelection = (buttonPosition) => {
        // Set the button position
        setHand(prev => ({ ...prev, buttonPosition }));
        // The useEffect will handle setting the UTG position
    };

    const getNextPlayerIndex = (currentIndex) => {
        // For 2 players, just alternate between the two positions
        if (hand.numPlayers === 2) {
            return (currentIndex + 1) % 2;
        }

        // For other player counts, move clockwise (subtract 1 since seats are counter-clockwise)
        return (currentIndex - 1 + hand.numPlayers) % hand.numPlayers;
    };

    const getNextActivePlayer = (currentIndex) => {
        let nextIndex = (currentIndex - 1 + hand.numPlayers) % hand.numPlayers; // Move clockwise
        let steps = 0;
        
        // Keep moving clockwise until we find an active player or complete a full circle
        while (steps < hand.numPlayers) {
            if (!foldedPlayers.has(nextIndex)) {
                return nextIndex;
            }
            nextIndex = (nextIndex - 1 + hand.numPlayers) % hand.numPlayers;
            steps++;
        }
        return null; // Should never happen as there should always be at least one active player
    };

    const getLastActivePlayerAfterRaiser = (raiserIndex) => {
        let currentIndex = (raiserIndex - 1 + hand.numPlayers) % hand.numPlayers; // Start one position clockwise
        let lastActivePlayer = null;
        let steps = 0;
        
        // Keep moving clockwise until we complete a full circle
        while (steps < hand.numPlayers) {
            if (!foldedPlayers.has(currentIndex)) {
                lastActivePlayer = currentIndex;
            }
            currentIndex = (currentIndex - 1 + hand.numPlayers) % hand.numPlayers;
            steps++;
        }
        return lastActivePlayer;
    };

    const handleBettingAction = (action, amount = 0) => {
        // Set firstActionTaken when the first action is taken
        if (!firstActionTaken) {
            setFirstActionTaken(true);
        }

        // Track if hero folds
        if (action === 'fold' && currentActionIndex === hand.heroPosition) {
            setHeroFolded(true);
        }

        // Handle regular betting actions
        let newAmount = amount;
        const currentPlayerBet = streetBets[currentActionIndex] || 0;
        
        if (action === 'raise') {
            // Calculate minimum raise size based on street
            const minRaise = currentStreet === 'preflop' ? 
                Math.max(2, currentBet + (lastRaise || 1)) : 
                Math.max(1, currentBet + (lastRaise || 0));
            
            // Allow all-in even if it's less than min raise
            const isAllIn = amount === (hand.heroStackSize + (streetBets[hand.heroPosition] || 0));
            
            if (!isAllIn && amount < minRaise) {
                alert(`Minimum raise is ${minRaise}BB`);
                return;
            }

            // If this is an all-in, set hasAllIn to true
            if (isAllIn) {
                setHasAllIn(true);
            }
            
            // Calculate the additional amount needed to raise
            const additionalAmount = Math.max(0, amount - currentPlayerBet);
            
            // For the first bet of a street, the last raise is the amount minus the previous bet
            // For subsequent raises, it's the difference from the current bet
            const previousBet = currentStreet === 'preflop' ? 1 : 0;
            const newLastRaise = amount - Math.max(currentBet, previousBet);
            
            setLastRaise(newLastRaise);
            setCurrentBet(amount);
            setLastRaiser(currentActionIndex);
            // Store the action index relative to the current street
            const actionsInCurrentStreet = hand.bettingActions
                .filter(action => action.street === currentStreet)
                .length;
            setLastRaiseActionIndex(actionsInCurrentStreet);
            setStreetBets(prev => ({
                ...prev,
                [currentActionIndex]: amount
            }));
            setPlayerBets(prev => ({
                ...prev,
                [currentActionIndex]: (prev[currentActionIndex] || 0) + additionalAmount
            }));

            // Update hero's stack if they are the current player
            if (currentActionIndex === hand.heroPosition) {
                setHand(prev => ({
                    ...prev,
                    heroStackSize: Math.max(0, prev.heroStackSize - additionalAmount)
                }));
            }
        } else if (action === 'call') {
            // Calculate the additional amount needed to call
            const additionalAmount = Math.max(0, currentBet - currentPlayerBet);
            
            setStreetBets(prev => ({
                ...prev,
                [currentActionIndex]: currentBet
            }));
            setPlayerBets(prev => ({
                ...prev,
                [currentActionIndex]: (prev[currentActionIndex] || 0) + additionalAmount
            }));

            // Update hero's stack if they are the current player
            if (currentActionIndex === hand.heroPosition) {
                setHand(prev => ({
                    ...prev,
                    heroStackSize: Math.max(0, prev.heroStackSize - additionalAmount)
                }));
            }
            
            newAmount = additionalAmount;
        } else if (action === 'check') {
            // For check, we don't need to update the bet amount
            newAmount = 0;
        }

        const newAction = {
            playerIndex: currentActionIndex,
            position: getPlayerPosition(currentActionIndex),
            action,
            amount: newAmount,
            street: currentStreet
        };

        // If player folds, add them to folded players
        if (action === 'fold') {
            setFoldedPlayers(prev => new Set([...prev, currentActionIndex]));
        }

        // Add the new action to bettingActions
        setHand(prev => ({
            ...prev,
            bettingActions: [...prev.bettingActions, newAction]
        }));

        // Get the next player index
        let nextPlayerIndex = (currentActionIndex - 1 + hand.numPlayers) % hand.numPlayers;
        
        // Find next active player
        while (foldedPlayers.has(nextPlayerIndex)) {
            nextPlayerIndex = (nextPlayerIndex - 1 + hand.numPlayers) % hand.numPlayers;
        }

        // Check if betting round is complete after adding the current action
        if (lastRaiser !== null) {
            // For preflop, we need to get back to the BB if no raises, or last raiser if there was a raise
            if (currentStreet === 'preflop') {
                const bbPosition = (hand.buttonPosition - 2 + hand.numPlayers) % hand.numPlayers;
                
                if (lastRaise > 0) {
                    // Get all actions in the current street after the last raise
                    const actionsAfterRaise = [...hand.bettingActions, newAction]
                        .filter(action => action.street === currentStreet)
                        .slice(lastRaiseActionIndex); // Don't include the raise action itself
                    
                    // Get all active players who haven't folded
                    const activePlayers = Array.from({ length: hand.numPlayers }, (_, i) => i)
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
                        if (amount === (hand.heroStackSize + (streetBets[hand.heroPosition] || 0))) {
                            // Only complete if we've reached the all-in player again
                            if (nextPlayerIndex === currentActionIndex) {
                                setBettingRoundComplete(true);
                                return;
                            }
                        }
                        setCurrentActionIndex(nextPlayerIndex);
                        return;
                    }

                    if (allPlayersActed) {
                        setBettingRoundComplete(true);
                        return;
                    }
                }
            } else {
                // For postflop, we need to get back to the last raiser if there was a raise
                // or complete a full round if there were no raises
                if (lastRaise > 0) {
                    // Get all actions in the current street after the last raise
                    const actionsAfterRaise = [...hand.bettingActions, newAction]
                        .filter(action => action.street === currentStreet)
                        .slice(lastRaiseActionIndex); // Don't include the raise action itself
                    
                    // Get all active players who haven't folded
                    const activePlayers = Array.from({ length: hand.numPlayers }, (_, i) => i)
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
                        if (amount === (hand.heroStackSize + (streetBets[hand.heroPosition] || 0))) {
                            // Only complete if we've reached the all-in player again
                            if (nextPlayerIndex === currentActionIndex) {
                                setBettingRoundComplete(true);
                                return;
                            }
                        }
                        setCurrentActionIndex(nextPlayerIndex);
                        return;
                    }

                    if (allPlayersActed) {
                        setBettingRoundComplete(true);
                        return;
                    }
                }
            }
        }

        // Handle betting round completion for no-raises case
        if (lastRaiser == null) {
            if (currentStreet === 'preflop') {
                const bbPosition = (hand.buttonPosition - 2 + hand.numPlayers) % hand.numPlayers;
                if (currentActionIndex === bbPosition) {
                    // Check if all players have acted
                    const actionsInCurrentStreet = [...hand.bettingActions, newAction]
                        .filter(action => action.street === currentStreet);
                    const playersWhoActed = new Set(actionsInCurrentStreet.map(action => action.playerIndex));
                    const activePlayers = Array.from({ length: hand.numPlayers }, (_, i) => i)
                        .filter(i => !foldedPlayers.has(i));
                    
                    const allPlayersActed = activePlayers.every(playerIndex => 
                        playersWhoActed.has(playerIndex)
                    );

                    if (allPlayersActed) {
                        setBettingRoundComplete(true);
                        return;
                    }
                }
            } else {
                // For postflop, we need to complete a full round
                const sbPosition = (hand.buttonPosition - 1 + hand.numPlayers) % hand.numPlayers;
                let nextActivePlayer = sbPosition;
                
                // If SB has folded, find the next active player
                if (foldedPlayers.has(sbPosition)) {
                    nextActivePlayer = getNextActivePlayer(sbPosition);
                }

                // If this is a bet (not a check), we need to continue the action
                if (action === 'raise') {
                    setCurrentActionIndex(nextPlayerIndex);
                    return;
                }

                if (nextPlayerIndex === nextActivePlayer) {
                    // Check if all players have acted
                    const actionsInCurrentStreet = [...hand.bettingActions, newAction]
                        .filter(action => action.street === currentStreet);
                    const playersWhoActed = new Set(actionsInCurrentStreet.map(action => action.playerIndex));
                    const activePlayers = Array.from({ length: hand.numPlayers }, (_, i) => i)
                        .filter(i => !foldedPlayers.has(i));
                    
                    const allPlayersActed = activePlayers.every(playerIndex => 
                        playersWhoActed.has(playerIndex)
                    );

                    if (allPlayersActed) {
                        setBettingRoundComplete(true);
                        return;
                    }
                }
            }
        }

        // Only update current action if we haven't completed the betting round
        if (!bettingRoundComplete) {
            setCurrentActionIndex(nextPlayerIndex);
        }
    };

    // Reset bettingRoundComplete when moving to a new street
    useEffect(() => {
        if (step === 6 || step === 8 || step === 10 || step === 12) {
            setBettingRoundComplete(false);
            setFirstActionTaken(false);
        }
    }, [step]);

    const renderPlayerCards = (playerIndex) => {
        const isHero = playerIndex === hand.heroPosition;
        const isVillain = !foldedPlayers.has(playerIndex) && playerIndex !== hand.heroPosition;
        const hasFolded = foldedPlayers.has(playerIndex);
        
        // Don't show cards for folded players
        if (hasFolded) {
            return null;
        }

        if (isHero) {
            return (
                <div className="player-cards">
                    {hand.heroHoleCards.map((card, index) => (
                        <div key={index} className="card-container">
                            {renderCard(card)}
                        </div>
                    ))}
                </div>
            );
        } else if (isVillain) {
            const villainCards = hand.villainCards[playerIndex] || ['', ''];
            return (
                <div className="player-cards">
                    {villainCards.map((card, index) => (
                        <div key={index} className="card-container">
                            {card ? renderCard(card) : <img src={cardBack} alt="Card Back" className="card-back" />}
                        </div>
                    ))}
                </div>
            );
        } else {
            return (
                <div className="player-cards">
                    <div className="card-container">
                        <img src={cardBack} alt="Card Back" className="card-back" />
                    </div>
                    <div className="card-container">
                        <img src={cardBack} alt="Card Back" className="card-back" />
                    </div>
                </div>
            );
        }
    };

    const renderSeats = () => {
        const seats = [];
        const centerX = 293; // Half of table width
        const centerY = 235; // Half of table height
        const radius = 140; // Distance from center to seats
        const betRadius = 1; // Smaller radius for bet amounts
        
        for (let i = 0; i < hand.numPlayers; i++) {
            const totalSeats = hand.numPlayers;
            const angleStep = (2 * Math.PI) / totalSeats;
            const angle = -((angleStep * i) - Math.PI/2);
            
            const x = centerX + 1.6 * radius * Math.cos(angle);
            const y = centerY + 0.8 * radius * Math.sin(angle);
            
            // Calculate position for bet amount
            const betX = centerX + 1.6 * betRadius * Math.cos(angle);
            const betY = centerY + 0.7 * betRadius * Math.sin(angle);

            const isButton = i === hand.buttonPosition;
            const isCurrentAction = i === currentActionIndex;
            const position = getPlayerPosition(i);
            const isHero = i === hand.heroPosition;
            const playerBet = streetBets[i] || 0;

            seats.push(
                <div
                    key={i}
                    className={`seat ${isButton ? 'button' : ''} ${isCurrentAction ? 'current-action' : ''}`}
                    style={{
                        position: 'absolute',
                        left: `${x - 30}px`, // Half of seat width
                        top: `${y - 30}px`, // Half of seat height
                    }}
                    onClick={() => {
                        if (step === 3) {
                            handleButtonSelection(i);
                        }
                    }}
                >
                    {isButton && <div className="dealer-button">D</div>}
                    <div className="player-info">
                        <div className="player-position">{position}</div>
                        {isHero && <div className="stack-size">{hand.heroStackSize}BB</div>}
                    </div>
                    {playerBet > 0 && (
                        <div className="bet-amount">
                            {playerBet}BB
                        </div>
                    )}
                    {renderPlayerCards(i)}
                </div>
            );
        }
        return seats;
    };

    const renderCommunityCards = () => {
        return (
            <div className="community-cards">
                {hand.communityCards.flop.map((card, index) => (
                    <div key={`flop-${index}`} className="card-container">
                        {renderCard(card)}
                    </div>
                ))}
                <div className="card-container">
                    {renderCard(hand.communityCards.turn)}
                </div>
                <div className="card-container">
                    {renderCard(hand.communityCards.river)}
                </div>
            </div>
        );
    };

    const renderVillainCards = () => {
        // Get all active positions (not folded) in table order
        const activePositions = [];
        // Start from button and move clockwise
        for (let i = 0; i < hand.numPlayers; i++) {
            const positionIndex = (hand.buttonPosition - i + hand.numPlayers) % hand.numPlayers;
            if (!foldedPlayers.has(positionIndex) && positionIndex !== hand.heroPosition) {
                activePositions.push({
                    index: positionIndex,
                    position: getPlayerPosition(positionIndex)
                });
            }
        }

        return (
            <div className="villain-cards">
                {activePositions.map(({ index, position }) => (
                    <div key={index} className="villain-position-row">
                        <span className="position-label">{position}:</span>
                        <input
                            type="text"
                            value={hand.villainCards[index]?.[0] || ''}
                            onChange={(e) => handleVillainCardChange(index, 0, e.target.value)}
                            placeholder="As"
                            maxLength={2}
                            className="villain-card-input"
                        />
                        <input
                            type="text"
                            value={hand.villainCards[index]?.[1] || ''}
                            onChange={(e) => handleVillainCardChange(index, 1, e.target.value)}
                            placeholder="Kd"
                            maxLength={2}
                            className="villain-card-input"
                        />
                    </div>
                ))}
            </div>
        );
    };

    const handleVillainCardChange = (playerIndex, cardIndex, value) => {
        // Allow empty value
        if (!value) {
            const newCards = [...hand.villainCards];
            if (!newCards[playerIndex]) {
                newCards[playerIndex] = ['', ''];
            }
            newCards[playerIndex][cardIndex] = '';
            setHand(prev => ({ ...prev, villainCards: newCards }));
            return;
        }

        const formattedCard = formatCardInput(value, hand.villainCards[playerIndex]?.[cardIndex]);
        
        // If formatting resulted in empty string (invalid card), don't update
        if (!formattedCard) {
            return;
        }
        
        // Check if this card matches any other villain's cards
        for (let i = 0; i < hand.numPlayers; i++) {
            if (i !== playerIndex && hand.villainCards[i]) {
                if (hand.villainCards[i][0] === formattedCard || hand.villainCards[i][1] === formattedCard) {
                    alert('This card has already been used by another player');
                    return;
                }
            }
        }

        // Check if this card matches hero's cards
        if (hand.heroHoleCards.includes(formattedCard)) {
            alert('This card has already been used by hero');
            return;
        }

        // Check if this card matches any community cards
        if (hand.communityCards.flop.includes(formattedCard) || 
            hand.communityCards.turn === formattedCard || 
            hand.communityCards.river === formattedCard) {
            alert('This card has already been used in the community cards');
            return;
        }

        const newCards = [...hand.villainCards];
        if (!newCards[playerIndex]) {
            newCards[playerIndex] = ['', ''];
        }
        newCards[playerIndex][cardIndex] = formattedCard;
        setHand(prev => ({ ...prev, villainCards: newCards }));
    };

    const getAllCards = () => {
        const cards = new Set();
        
        // Add hero's hole cards
        hand.heroHoleCards.forEach(card => {
            if (card) cards.add(card);
        });
        
        // Add community cards
        hand.communityCards.flop.forEach(card => {
            if (card) cards.add(card);
        });
        if (hand.communityCards.turn) cards.add(hand.communityCards.turn);
        if (hand.communityCards.river) cards.add(hand.communityCards.river);
        
        // Add villain cards
        hand.villainCards.forEach(card => {
            if (card) cards.add(card);
        });
        
        return cards;
    };

    const formatCardInput = (value, currentCard = '') => {
        if (!value) return '';
        
        // Get the first character (rank) and second character (suit)
        const rank = value[0]?.toUpperCase() || '';
        const suit = value[1]?.toLowerCase() || '';
        
        // Validate rank (2-9, T, J, Q, K, A)
        const validRanks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
        if (!validRanks.includes(rank)) {
            return '';
        }
        
        // Validate suit (c, s, h, d)
        const validSuits = ['c', 's', 'h', 'd'];
        if (!validSuits.includes(suit)) {
            return rank;
        }
        
        const newCard = rank + suit;
        
        // Check for duplicates, excluding the current card being edited
        const allCards = getAllCards();
        if (currentCard) allCards.delete(currentCard);
        
        if (allCards.has(newCard)) {
            alert('This card has already been used');
            return currentCard;
        }
        
        return newCard;
    };

    const handleHoleCardChange = (index, value) => {
        const newCards = [...hand.heroHoleCards];
        newCards[index] = formatCardInput(value, hand.heroHoleCards[index]);
        setHand(prev => ({ ...prev, heroHoleCards: newCards }));
    };

    const handleFlopCardChange = (index, value) => {
        const newFlop = [...hand.communityCards.flop];
        newFlop[index] = formatCardInput(value, hand.communityCards.flop[index]);
        setHand(prev => ({
            ...prev,
            communityCards: {
                ...prev.communityCards,
                flop: newFlop
            }
        }));
    };

    const handleTurnCardChange = (value) => {
        const newTurn = formatCardInput(value, hand.communityCards.turn);
        setHand(prev => ({
            ...prev,
            communityCards: {
                ...prev.communityCards,
                turn: newTurn
            }
        }));
    };

    const handleRiverCardChange = (value) => {
        const newRiver = formatCardInput(value, hand.communityCards.river);
        setHand(prev => ({
            ...prev,
            communityCards: {
                ...prev.communityCards,
                river: newRiver
            }
        }));
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

        // Convert T to 10 for display only
        const displayRank = rank === 'T' ? '10' : rank;

        return (
            <div className={`card ${colorClass}`}>
                <div className="card-rank">{displayRank}</div>
                <div className="card-suit">{suitSymbol}</div>
            </div>
        );
    };

    const calculatePotSize = () => {
        // Calculate total pot from all betting actions across all streets
        return hand.bettingActions.reduce((total, action) => {
            return total + (action.amount || 0);
        }, 0);
    };

    const calculateStreetStartPot = () => {
        // Calculate pot size from all previous streets
        return hand.bettingActions.reduce((total, action) => {
            // Include all bets from previous streets, including blinds for preflop
            if (action.street !== currentStreet) {
                return total + (action.amount || 0);
            }
            return total;
        }, 0);
    };

    // Add memoization for renderBettingActions
    const renderBettingActions = React.useCallback(() => {
        // Get the last action for the current street
        const lastAction = hand.bettingActions
            .filter(action => action.street === currentStreet)
            .slice(-1)[0];
        const isBlindPosting = lastAction?.action === 'post';
        const minRaise = currentStreet === 'preflop' ? 
            Math.max(2, currentBet + (lastRaise || 1)) : 
            Math.max(1, currentBet + (lastRaise || 0));
        const streetStartPot = calculateStreetStartPot();

        // Calculate how much the current player has bet in this street
        const playerBetAmount = streetBets[currentActionIndex] || 0;

        // Can check if current bet equals what player has bet
        const canCheck = currentBet === playerBetAmount;
        // Can fold if player has bet less than current bet
        const canFold = playerBetAmount < currentBet;
        // Can call if there's a bet to call
        const canCall = currentBet > playerBetAmount;
        
        // Calculate the total amount needed for all-in
        const heroBetInCurrentStreet = streetBets[hand.heroPosition] || 0;
        let allInAmount;

        // Can raise if the current bet is less than hero's stack size
        // or if hero can go all-in (even if it's less than min raise)
        let canRaise = currentBet < (hand.heroStackSize + heroBetInCurrentStreet) || 
            (currentActionIndex === hand.heroPosition && hand.heroStackSize >= playerBetAmount);

        const maxRaise = hand.heroStackSize + heroBetInCurrentStreet;

        // If minimum raise is greater than total available chips (remaining stack + current bet), only show all-in option
        let showAllInOnly = minRaise > (hand.heroStackSize + heroBetInCurrentStreet);
        
        if (heroBetInCurrentStreet > 0) {
            // Hero has already bet in this street - add difference between current bet and their previous bet
            allInAmount = hand.heroStackSize + heroBetInCurrentStreet;
        } else {
            // Hero hasn't bet yet in this street - just use their stack
            allInAmount = hand.heroStackSize;
        }

        // Check if there's an all-in bet in the current street
        const allInBetInStreet = hand.bettingActions
            .filter(action => action.street === currentStreet)
            .some(action => action.action === 'raise' && 
                action.amount === (hand.heroStackSize + (streetBets[hand.heroPosition] || 0)));

        // If there's an all-in bet, disable raise options
        if (allInBetInStreet) {
            canRaise = false;
            showAllInOnly = false;
        }

        return (
            <div className="betting-actions">
                {!bettingRoundComplete && (
                    <>
                        <div className="action-buttons">
                            {canFold && <button onClick={() => handleBettingAction('fold')}>Fold</button>}
                            {canCheck && <button onClick={() => handleBettingAction('check')}>Check</button>}
                            {canCall && <button onClick={() => handleBettingAction('call')}>
                                {allInBetInStreet ? 'Call All In' : `Call ${currentBet - playerBetAmount}BB`}
                            </button>}
                            {showAllInOnly && !allInBetInStreet && (
                                <button 
                                    className="raise-button"
                                    onClick={() => handleBettingAction('raise', allInAmount)}
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
                                    onClick={() => handleBettingAction('raise', raiseAmount)}
                                >
                                    Raise to {raiseAmount}BB
                                </button>
                            </div>
                        )}
                    </>
                )}
                {lastAction && (
                    <div className="last-action">
                        <span className="position">{lastAction.position}:</span>
                        <span className="action">{isBlindPosting ? 'posts' : lastAction.action}</span>
                        {lastAction.amount > 0 && (
                            <span className="amount">{lastAction.amount}BB</span>
                        )}
                    </div>
                )}
            </div>
        );
    }, [hand.bettingActions, currentStreet, currentBet, lastRaise, raiseAmount, currentActionIndex, streetBets, bettingRoundComplete, hand.heroStackSize]);

    const renderCurrentStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="step-content">
                        <h3>Enter Your ACR Username</h3>
                        <div className="username-input">
                            <input
                                type="text"
                                value={hand.username}
                                onChange={(e) => setHand(prev => ({ ...prev, username: e.target.value }))}
                                placeholder="Enter your ACR username"
                                className="username-field"
                            />
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="step-content">
                        <h3>Select Game Type</h3>
                        <div className="game-type-buttons">
                            <button
                                className={hand.gameType === 'cash' ? 'active' : ''}
                                onClick={() => setHand(prev => ({ ...prev, gameType: 'cash' }))}
                            >
                                Cash Game
                            </button>
                            <button
                                className={hand.gameType === 'tournament' ? 'active' : ''}
                                onClick={() => setHand(prev => ({ ...prev, gameType: 'tournament' }))}
                            >
                                Tournament
                            </button>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="step-content">
                        <h3>Number of Players</h3>
                        <div className="player-count">
                            <div className="player-buttons">
                                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                    <button
                                        key={num}
                                        className={`player-button ${hand.numPlayers === num ? 'active' : ''}`}
                                        onClick={() => setHand(prev => ({ ...prev, numPlayers: num }))}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="step-content">
                        <h3>Enter Hero Stack Size</h3>
                        <div className="stack-input">
                            <div className="stack-slider-container">
                                <input
                                    type="range"
                                    min="0"
                                    max="200"
                                    value={hand.heroStackSize}
                                    onChange={(e) => setHand(prev => ({ ...prev, heroStackSize: parseFloat(e.target.value) }))}
                                    className="stack-slider"
                                />
                            </div>
                            <div className="stack-markers">
                                <span></span>
                                <span>50</span>
                                <span>100</span>
                                <span>150</span>
                                <span>200</span>
                            </div>

                            <div className="stack-value">
                                {hand.heroStackSize} BB
                            </div>
                        </div>
                    </div>
                );
            case 5:
                return (
                    <div className="step-content">
                        <h3>Enter Your Hole Cards</h3>
                        <div className="card-input">
                            {hand.heroHoleCards.map((card, index) => (
                                <input
                                    key={index}
                                    type="text"
                                    value={card}
                                    onChange={(e) => handleHoleCardChange(index, e.target.value)}
                                    placeholder="As"
                                    maxLength={2}
                                />
                            ))}
                        </div>
                    </div>
                );
            case 6:
            case 8:
            case 10:
            case 12:
                return (
                    <div className="step-content">
                        <h3>Enter Betting Actions</h3>
                        <div className="current-player">
                            {bettingRoundComplete 
                                ? `${currentStreet.charAt(0).toUpperCase() + currentStreet.slice(1)} betting complete`
                                : `Current Action: ${getPlayerPosition(currentActionIndex)}`
                            }
                        </div>
                        {renderBettingActions()}
                    </div>
                );
            case 7:
                return (
                    <div className="step-content">
                        <h3>Enter Flop Cards</h3>
                        <div className="card-input">
                            <div className="flop-input">
                                {hand.communityCards.flop.map((card, index) => (
                                    <input
                                        key={`flop-${index}`}
                                        type="text"
                                        value={card}
                                        onChange={(e) => handleFlopCardChange(index, e.target.value)}
                                        placeholder="Kd"
                                        maxLength={2}
                                    />
                                ))}
                            </div>
                        </div>
                        {renderCommunityCards()}
                    </div>
                );
            case 9:
                return (
                    <div className="step-content">
                        <h3>Enter Turn Card</h3>
                        <div className="card-input">
                            <input
                                type="text"
                                value={hand.communityCards.turn}
                                onChange={(e) => handleTurnCardChange(e.target.value)}
                                placeholder="2h"
                                maxLength={2}
                            />
                        </div>
                    </div>
                );
            case 11:
                return (
                    <div className="step-content">
                        <h3>Enter River Card</h3>
                        <div className="card-input">
                            <input
                                type="text"
                                value={hand.communityCards.river}
                                onChange={(e) => handleRiverCardChange(e.target.value)}
                                placeholder="Qc"
                                maxLength={2}
                            />
                        </div>
                    </div>
                );
            case 13:
                return (
                    <div className="step-content">
                        <h3>Enter Villain Cards</h3>
                        {renderVillainCards()}
                    </div>
                );
            default:
                return null;
        }
    };

    const shouldShowPreviousButton = () => {
        // Don't show previous button when moving from betting to card entry
        if (step === 7 || step === 9 || step === 11) {
            return false;
        }
        return step > 1;
    };

    const shouldShowNextButton = () => {
        // For betting steps, only show Next button when betting is complete
        if (step === 6 || step === 8 || step === 10 || step === 12) {
            return bettingRoundComplete;
        }
        // For all other steps except the last one, show Next button
        return step < 13;
    };

    const validateHandForSaving = () => {
        // Check username first
        if (!hand.username || hand.username.trim() === '') {
            console.log('Validation failed: Username is required');
            return false;
        }

        // If hero has folded, we can save the hand regardless of other conditions
        if (heroFolded) {
            console.log('Hero folded - allowing save');
            return true;
        }

        // Check hero's stack size
        if (hand.heroStackSize < 0) {
            console.log('Validation failed: Hero stack size <= 0');
            return false;
        }

        // Check hero's hole cards
        const validRanks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
        const validSuits = ['c', 's', 'h', 'd'];
        
        const areHeroCardsValid = hand.heroHoleCards.every(card => {
            if (!card || card.length !== 2) {
                console.log('Validation failed: Invalid hero card format', card);
                return false;
            }
            const rank = card[0]?.toUpperCase();
            const suit = card[1]?.toLowerCase();
            const isValid = validRanks.includes(rank) && validSuits.includes(suit);
            if (!isValid) {
                console.log('Validation failed: Invalid hero card rank/suit', { rank, suit });
            }
            return isValid;
        });

        if (!areHeroCardsValid) {
            return false;
        }

        // Check community cards
        const areFlopCardsValid = hand.communityCards.flop.every(card => {
            if (!card || card.length !== 2) {
                console.log('Validation failed: Invalid flop card format', card);
                return false;
            }
            const rank = card[0]?.toUpperCase();
            const suit = card[1]?.toLowerCase();
            const isValid = validRanks.includes(rank) && validSuits.includes(suit);
            if (!isValid) {
                console.log('Validation failed: Invalid flop card rank/suit', { rank, suit });
            }
            return isValid;
        });

        if (!areFlopCardsValid) {
            return false;
        }

        if (!hand.communityCards.turn || hand.communityCards.turn.length !== 2) {
            console.log('Validation failed: Invalid turn card', hand.communityCards.turn);
            return false;
        }

        if (!hand.communityCards.river || hand.communityCards.river.length !== 2) {
            console.log('Validation failed: Invalid river card', hand.communityCards.river);
            return false;
        }

        // Check if there are any betting actions
        if (hand.bettingActions.length === 0) {
            console.log('Validation failed: No betting actions');
            return false;
        }

        // Check if all betting rounds are complete or if there's been an all-in
        if (!bettingRoundComplete && !hasAllIn) {
            console.log('Validation failed: Betting round not complete and no all-in');
            return false;
        }

        console.log('Hand validation passed');
        return true;
    };

    const shouldShowSaveButton = () => {
        // Show save button if we're on the last step or if hero has folded
        return step === 13 || heroFolded;
    };

    const handleSaveClick = () => {
        setShowConfirmPanel(true);
    };

    const handleConfirmSave = () => {
        setShowConfirmPanel(false);
        
        // Format the hand data for saving
        const handData = {
            username: hand.username,
            gameType: hand.gameType,
            numPlayers: hand.numPlayers,
            buttonPosition: hand.buttonPosition,
            heroPosition: hand.heroPosition,
            heroStackSize: hand.heroStackSize,
            heroHoleCards: hand.heroHoleCards,
            communityCards: {
                flop: hand.communityCards.flop,
                turn: hand.communityCards.turn,
                river: hand.communityCards.river
            },
            // Convert villain cards to the format expected by the schema
            villainCards: Object.entries(hand.villainCards)
                .filter(([_, cards]) => cards && (cards[0] || cards[1])) // Only include villains with at least one card
                .map(([playerIndex, cards]) => ({
                    playerIndex: parseInt(playerIndex),
                    cards: cards
                })),
            // Convert betting actions to the format expected by the schema
            bettingActions: hand.bettingActions.map(action => ({
                playerIndex: action.playerIndex,
                position: action.position,
                action: action.action,
                amount: action.amount,
                street: action.street,
                timestamp: new Date()
            })),
            // Convert street bets to the format expected by the schema
            streetBets: Object.entries(streetBets)
                .map(([playerIndex, amount]) => ({
                    playerIndex: parseInt(playerIndex),
                    amount: amount
                })),
            foldedPlayers: Array.from(foldedPlayers),
            currentStreet: currentStreet,
            potSize: calculatePotSize(),
            currentBet: currentBet,
            lastRaise: lastRaise,
            lastRaiser: lastRaiser
        };

        console.log('Attempting to save hand with data:', handData);

        // Call the onHandComplete callback with the formatted data
        onHandComplete(handData);
        
        handleNext();
        setShowSaveSuccess(true);
        // Hide the success message after 3 seconds
        setTimeout(() => {
            setShowSaveSuccess(false);
        }, 3000);
    };

    const handleCancelSave = () => {
        setShowConfirmPanel(false);
    };

    const renderConfirmPanel = () => {
        if (!showConfirmPanel) return null;

        return (
            <div className="confirm-panel-overlay">
                <div className="confirm-panel">
                    <h3>Confirm Hand Details</h3>
                    <div className="confirm-content">
                        <div className="confirm-section">
                            <h4>Game Information</h4>
                            <p>Game Type: {hand.gameType === 'cash' ? 'Cash Game' : 'Tournament'}</p>
                            <p>Players: {hand.numPlayers}</p>
                            <p>Hero Position: {getPlayerPosition(hand.heroPosition)}</p>
                            <p>Hero Stack: {hand.heroStackSize}BB</p>
                        </div>
                        
                        <div className="confirm-section">
                            <h4>Cards</h4>
                            <div className="confirm-cards">
                                <div className="confirm-cards-group">
                                    <div className="confirm-cards-label">Hero Cards:</div>
                                    <div className="confirm-cards-display">
                                        {hand.heroHoleCards.map((card, index) => (
                                            <div key={`hero-${index}`} className="confirm-card-container">
                                                {renderCard(card)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="confirm-cards-group">
                                    <div className="confirm-cards-label">Community Cards:</div>
                                    <div className="confirm-cards-display">
                                        {hand.communityCards.flop.map((card, index) => (
                                            <div key={`flop-${index}`} className="confirm-card-container">
                                                {renderCard(card)}
                                            </div>
                                        ))}
                                        <div className="confirm-card-container">
                                            {renderCard(hand.communityCards.turn)}
                                        </div>
                                        <div className="confirm-card-container">
                                            {renderCard(hand.communityCards.river)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="confirm-section">
                            <h4>Betting Summary</h4>
                            <p>Total Pot: {calculatePotSize()}BB</p>
                            <p>Number of Actions: {hand.bettingActions.length}</p>
                            <p>Folded Players: {Array.from(foldedPlayers).map(pos => getPlayerPosition(pos)).join(', ') || 'None'}</p>
                        </div>
                    </div>
                    
                    <div className="confirm-actions">
                        <button 
                            className="cancel-button"
                            onClick={handleCancelSave}
                        >
                            Cancel
                        </button>
                        <button 
                            className="confirm-button"
                            onClick={handleConfirmSave}
                        >
                            Confirm & Save
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="poker-table-container">
            {showSaveSuccess && (
                <div className="save-success-alert">
                    Hand saved successfully!
                </div>
            )}
            <div className="poker-table-border-effect"></div>
            <div className="poker-table">
                {renderSeats()}
                <div className="community-cards-area">
                    {renderCommunityCards()}
                </div>
                <div className="pot-display">
                    <div className="total-pot">
                        Total Pot: <span className="pot-amount">{calculatePotSize()}BB</span>
                    </div>
                    {currentStreet !== 'preflop' && (
                        <div className="street-pot">
                            Street Pot: <span className="pot-amount">{calculateStreetStartPot()}BB</span>
                        </div>
                    )}
                </div>
            </div>
            <div className="controls">
                {renderCurrentStep()}
                <div className="navigation-buttons">
                    {shouldShowPreviousButton() && (
                        <button onClick={handlePrevious}>Previous</button>
                    )}
                    {shouldShowNextButton() && (
                        <button 
                            onClick={handleNext} 
                            disabled={
                                !bettingRoundComplete && 
                                (step === 8 || step === 10 || step === 12)
                            }
                        >
                            Next
                        </button>
                    )}
                    {shouldShowSaveButton() && (
                        <button 
                            className="save-hand-button"
                            onClick={handleSaveClick}
                            disabled={!validateHandForSaving()}
                        >
                            Save Hand
                        </button>
                    )}
                </div>
            </div>
            {renderConfirmPanel()}
        </div>
    );
};

export default PokerTable; 