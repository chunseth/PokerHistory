// Core poker game logic for managing betting rounds, street transitions, and game state

class PokerGameLogic {
    constructor(numPlayers = 6) {
        this.numPlayers = numPlayers;
        this.buttonPosition = 0;
        this.currentStreet = 'preflop';
        this.currentBet = 0;
        this.lastRaise = 0;
        this.lastRaiser = null;
        this.lastRaiseActionIndex = null;
        this.foldedPlayers = new Set();
        this.streetBets = {};
        this.bettingActions = [];
        this.hasAllIn = false;
        this.bettingRoundComplete = false;
        this.firstActionTaken = false;
        this.potSize = 0;
    }

    // Initialize a new hand
    initializeHand(buttonPosition) {
        this.buttonPosition = buttonPosition;
        this.currentStreet = 'preflop';
        this.currentBet = 1; // BB is 1
        this.lastRaise = 0;
        this.foldedPlayers = new Set();
        this.streetBets = {};
        this.bettingActions = [];
        this.hasAllIn = false;
        this.bettingRoundComplete = false;
        this.firstActionTaken = false;
        this.potSize = 0;

        // Set initial action to UTG
        return (this.buttonPosition - 3 + this.numPlayers) % this.numPlayers;
    }

    // Get player position name (BTN, SB, BB, etc.)
    getPlayerPosition(index) {
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

        if (this.numPlayers === 2) {
            return positions[2][index];
        }

        const basePositions = positions[this.numPlayers];
        const distanceFromButton = (this.buttonPosition - index + this.numPlayers) % this.numPlayers;
        return basePositions[distanceFromButton];
    }

    // Add a betting action and update game state
    addBettingAction(action) {
        this.bettingActions.push(action);
        this.firstActionTaken = true;

        if (action.action === 'fold') {
            this.foldedPlayers.add(action.playerIndex);
        } else if (action.action === 'post') {
            // Handle blind posts
            this.streetBets[action.playerIndex] = action.amount;
            if (action.position === 'BB') {
                this.currentBet = action.amount;
            }
            this.potSize += action.amount;
        } else if (action.action === 'raise') {
            const currentPlayerBet = this.streetBets[action.playerIndex] || 0;
            const additionalAmount = Math.max(0, action.amount - currentPlayerBet);
            
            // Update street bets
            this.streetBets[action.playerIndex] = action.amount;
            
            // Check if this is an all-in
            const isAllIn = action.amount === (action.playerStack + currentPlayerBet);
            
            if (isAllIn) {
                // For all-ins, we need to check if this is a valid raise
                const previousBet = this.currentStreet === 'preflop' ? 1 : 0;
                const minRaiseAmount = Math.max(this.currentBet, previousBet) + (this.lastRaise || 1);
                
                console.warn('All-in check:', {
                    amount: action.amount,
                    minRaiseAmount,
                    currentBet: this.currentBet,
                    previousBet,
                    lastRaise: this.lastRaise
                });
                
                if (action.amount >= minRaiseAmount) {
                    // This is a valid all-in raise
                    this.lastRaise = action.amount - Math.max(this.currentBet, previousBet);
                    this.currentBet = action.amount;
                    this.lastRaiser = action.playerIndex;
                    this.lastRaiseActionIndex = this.bettingActions.length;
                    this.hasAllIn = true;
                    console.warn('Valid all-in raise:', {
                        lastRaiser: this.lastRaiser,
                        lastRaise: this.lastRaise,
                        currentBet: this.currentBet
                    });
                } else {
                    // This is an all-in call
                    this.currentBet = Math.max(this.currentBet, action.amount);
                    console.warn('All-in call:', {
                        currentBet: this.currentBet,
                        amount: action.amount
                    });
                }
            } else {
                // Regular raise
                const previousBet = this.currentStreet === 'preflop' ? 1 : 0;
                this.lastRaise = action.amount - Math.max(this.currentBet, previousBet);
                this.currentBet = action.amount;
                this.lastRaiser = action.playerIndex;
                this.lastRaiseActionIndex = this.bettingActions.length;
                console.warn('Regular raise:', {
                    lastRaiser: this.lastRaiser,
                    lastRaise: this.lastRaise,
                    currentBet: this.currentBet,
                    actionIndex: this.lastRaiseActionIndex
                });
            }
            
            // Update pot size
            this.potSize += additionalAmount;
        } else if (action.action === 'call') {
            const currentPlayerBet = this.streetBets[action.playerIndex] || 0;
            const additionalAmount = this.currentBet - currentPlayerBet;
            this.streetBets[action.playerIndex] = this.currentBet;
            this.potSize += additionalAmount;
        }

        // Check if betting round is complete
        this.checkBettingRoundComplete(action);
    }

    // Check if the current betting round is complete
    checkBettingRoundComplete(lastAction) {
        console.warn('=== CHECKING BETTING ROUND COMPLETE ===');
        console.warn('Current street:', this.currentStreet);
        console.warn('Last raiser:', this.lastRaiser);
        console.warn('Last raise action index:', this.lastRaiseActionIndex);
        console.warn('Last action:', lastAction);

        // Get all actions in the current street
        const streetActions = this.bettingActions.filter(action => action.street === this.currentStreet);
        const activePlayers = Array.from({ length: this.numPlayers }, (_, i) => i)
            .filter(i => !this.foldedPlayers.has(i));

        // If there's been a raise, we need to complete a full round after the raise
        if (this.lastRaiser !== null) {
            // Find the last raise action in the street
            const lastRaiseAction = streetActions.reduce((last, action, index) => {
                if (action.action === 'raise') {
                    return { action, index };
                }
                return last;
            }, null);
            
            console.warn('Last raise action in street:', lastRaiseAction);
            
            if (lastRaiseAction) {
                // Get all actions after the last raise
                const actionsAfterRaise = streetActions.slice(lastRaiseAction.index + 1);
                const playersWhoActed = new Set(actionsAfterRaise.map(action => action.playerIndex));
                
                console.warn('Actions after raise:', actionsAfterRaise);
                console.warn('Players who acted after raise:', Array.from(playersWhoActed));
                
                // For all-in situations
                if (this.hasAllIn) {
                    const allInAction = lastRaiseAction.action;
                    const allInAmount = allInAction.amount;
                    
                    console.warn('Checking all-in situation:', {
                        allInAmount,
                        lastRaiser: this.lastRaiser,
                        actionsAfterRaise
                    });
                    
                    // Check if any player can still raise
                    const canStillRaise = activePlayers.some(playerIndex => {
                        const currentBet = this.streetBets[playerIndex] || 0;
                        const playerStack = allInAction.playerStack;
                        const minRaiseAmount = allInAmount + (this.lastRaise || 1);
                        return (playerStack + currentBet) >= minRaiseAmount;
                    });

                    console.warn('Can still raise:', canStillRaise);

                    // For all-in raises, we need to ensure all players act after the all-in
                    const playersToAct = activePlayers.filter(playerIndex => 
                        playerIndex !== this.lastRaiser && 
                        !playersWhoActed.has(playerIndex)
                    );
                    
                    console.warn('All-in action check:', {
                        playersToAct,
                        playersWhoActed: Array.from(playersWhoActed)
                    });

                    if (playersToAct.length === 0) {
                        this.bettingRoundComplete = true;
                        console.warn('Betting round complete due to all-in and all players acted');
                        return;
                    }
                } else {
                    // For regular raises, we need all players to act after the raise
                    const playersToAct = activePlayers.filter(playerIndex => 
                        playerIndex !== this.lastRaiser && 
                        !playersWhoActed.has(playerIndex)
                    );
                    
                    console.warn('Regular raise action check:', {
                        playersToAct,
                        playersWhoActed: Array.from(playersWhoActed)
                    });

                    if (playersToAct.length === 0) {
                        this.bettingRoundComplete = true;
                        console.warn('Betting round complete - all players acted after raise');
                        return;
                    }
                }
            }
        } else {
            // Handle no-raises case
            if (this.currentStreet === 'preflop') {
                const bbPosition = (this.buttonPosition - 2 + this.numPlayers) % this.numPlayers;
                
                // For preflop, we need to complete a full round after BB
                if (lastAction.playerIndex === bbPosition) {
                    const playersWhoActed = new Set(streetActions.map(action => action.playerIndex));
                    const allPlayersActed = activePlayers.every(playerIndex => 
                        playersWhoActed.has(playerIndex)
                    );

                    if (allPlayersActed) {
                        this.bettingRoundComplete = true;
                        console.warn('Betting round complete - preflop no raise');
                        return;
                    }
                }
            } else {
                // For postflop, complete a full round
                const sbPosition = (this.buttonPosition - 1 + this.numPlayers) % this.numPlayers;
                let nextActivePlayer = sbPosition;
                
                if (this.foldedPlayers.has(sbPosition)) {
                    nextActivePlayer = this.getNextActivePlayer(sbPosition);
                }

                if (lastAction.playerIndex === nextActivePlayer) {
                    const playersWhoActed = new Set(streetActions.map(action => action.playerIndex));
                    const allPlayersActed = activePlayers.every(playerIndex => 
                        playersWhoActed.has(playerIndex)
                    );

                    if (allPlayersActed) {
                        this.bettingRoundComplete = true;
                        console.warn('Betting round complete - postflop no raise');
                        return;
                    }
                }
            }
        }
    }

    // Get the next active player
    getNextActivePlayer(currentIndex) {
        let nextIndex = (currentIndex - 1 + this.numPlayers) % this.numPlayers;
        let steps = 0;
        
        while (steps < this.numPlayers) {
            if (!this.foldedPlayers.has(nextIndex)) {
                return nextIndex;
            }
            nextIndex = (nextIndex - 1 + this.numPlayers) % this.numPlayers;
            steps++;
        }
        return null;
    }

    // Transition to the next street
    transitionToNextStreet() {
        const streets = ['preflop', 'flop', 'turn', 'river'];
        const currentIndex = streets.indexOf(this.currentStreet);
        
        if (currentIndex < streets.length - 1) {
            this.currentStreet = streets[currentIndex + 1];
            this.currentBet = 0;
            this.lastRaise = 0;
            this.lastRaiser = null;
            this.streetBets = {};
            this.bettingRoundComplete = false;
            this.firstActionTaken = false;
            
            // Start from the small blind position
            const sbPosition = (this.buttonPosition - 1 + this.numPlayers) % this.numPlayers;
            
            // If SB is folded, find the next active player
            if (this.foldedPlayers.has(sbPosition)) {
                return this.getNextActivePlayer(sbPosition);
            }
            return sbPosition;
        }
        return null;
    }

    // Calculate minimum raise amount
    calculateMinRaise(playerStack, currentPlayerBet) {
        const minRaise = this.currentStreet === 'preflop' ? 
            Math.max(2, this.currentBet + (this.lastRaise || 1)) : 
            Math.max(1, this.currentBet + (this.lastRaise || 0));
        
        // If minimum raise is greater than total available chips, return all-in amount
        if (minRaise > (playerStack + currentPlayerBet)) {
            return playerStack + currentPlayerBet;
        }
        
        return minRaise;
    }

    // Calculate maximum raise amount
    calculateMaxRaise(playerStack, currentPlayerBet) {
        return playerStack + currentPlayerBet;
    }

    // Calculate total pot size
    calculatePotSize() {
        return this.potSize;
    }

    // Calculate pot size for current street
    calculateStreetPot() {
        return this.bettingActions
            .filter(action => action.street === this.currentStreet)
            .reduce((total, action) => total + (action.amount || 0), 0);
    }
}

export default PokerGameLogic; 