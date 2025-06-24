import mongoose from 'mongoose';

// Schema for betting actions
const bettingActionSchema = new mongoose.Schema({
    playerIndex: { 
        type: Number, 
        required: true,
        min: 0,
        max: 9
    },
    position: { 
        type: String, 
        required: true,
        enum: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO']
    },
    action: { 
        type: String, 
        required: true,
        enum: ['fold', 'check', 'call', 'raise', 'post', 'bet']
    },
    amount: { 
        type: Number, 
        required: true,
        min: 0
    },
    street: { 
        type: String, 
        required: true,
        enum: ['preflop', 'flop', 'turn', 'river']
    },
    timestamp: { 
        type: Date, 
        required: true,
        default: Date.now
    },
    isAllIn: {
        type: Boolean,
        default: false
    }
}, { _id: false });

// Schema for villain cards
const villainCardsSchema = new mongoose.Schema({
    playerIndex: {
        type: Number,
        required: true,
        min: 0,
        max: 9
    },
    cards: {
        type: [String],
        validate: {
            validator: function(cards) {
                return cards.length <= 2 && cards.every(card => 
                    !card || /^[2-9TJQKA][cdhs]$/.test(card)
                );
            },
            message: 'Invalid villain cards'
        }
    }
}, { _id: false });

// Schema for street bets
const streetBetsSchema = new mongoose.Schema({
    playerIndex: {
        type: Number,
        required: true,
        min: 0,
        max: 9
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: false });

// Main hand schema
const handSchema = new mongoose.Schema({
    id: { 
        type: String, 
        required: true, 
        unique: true,
        default: () => Date.now().toString()
    },
    username: {
        type: String,
        required: true
    },
    timestamp: { 
        type: Date, 
        required: true,
        default: Date.now
    },
    gameType: { 
        type: String, 
        required: true,
        enum: ['cash', 'tournament']
    },
    tournamentName: {
        type: String,
        required: false
    },
    numPlayers: { 
        type: Number, 
        required: true,
        min: 2,
        max: 10
    },
    buttonPosition: { 
        type: Number, 
        required: true,
        min: 0,
        max: 9
    },
    heroPosition: { 
        type: Number, 
        required: true,
        min: 0,
        max: 9
    },
    heroStackSize: { 
        type: Number, 
        required: true,
        min: 0
    },
    heroHoleCards: { 
        type: [String], 
        required: true,
        validate: {
            validator: function(cards) {
                return cards.length === 2 && cards.every(card => 
                    /^[2-9TJQKA][cdhs]$/.test(card)
                );
            },
            message: 'Invalid hero hole cards'
        }
    },
    communityCards: {
        flop: { 
            type: [String],
            validate: {
                validator: function(cards) {
                    return cards.length === 3 && cards.every(card => 
                        /^[2-9TJQKA][cdhs]$/.test(card)
                    );
                },
                message: 'Invalid flop cards'
            }
        },
        turn: { 
            type: String,
            validate: {
                validator: function(card) {
                    return !card || /^[2-9TJQKA][cdhs]$/.test(card);
                },
                message: 'Invalid turn card'
            }
        },
        river: { 
            type: String,
            validate: {
                validator: function(card) {
                    return !card || /^[2-9TJQKA][cdhs]$/.test(card);
                },
                message: 'Invalid river card'
            }
        }
    },
    villainCards: [villainCardsSchema],
    bettingActions: [bettingActionSchema],
    streetBets: [streetBetsSchema],
    foldedPlayers: [{
        type: Number,
        min: 0,
        max: 9
    }],
    currentStreet: { 
        type: String, 
        required: true,
        enum: ['preflop', 'flop', 'turn', 'river']
    },
    potSize: { 
        type: Number, 
        required: true,
        min: 0
    },
    currentBet: { 
        type: Number, 
        required: true,
        min: 0
    },
    lastRaise: { 
        type: Number, 
        required: true,
        min: 0
    },
    lastRaiser: { 
        type: Number,
        min: 0,
        max: 9
    },
    viewed: {
        type: Boolean,
        default: false
    },
    tournamentInfo: {
        tournamentId: String,
        buyIn: Number,
        limitType: {
            type: String,
            enum: ['No Limit', 'Pot Limit', 'Fixed Limit']
        },
        currency: String
    },
    blindLevel: {
        level: Number,
        smallBlind: Number,
        bigBlind: Number,
        ante: Number
    },
    playerStacks: {
        type: Map,
        of: Number
    },
    finalStacks: {
        type: Map,
        of: Number
    },
    potSizes: {
        preflop: Number,
        flop: Number,
        turn: Number,
        river: Number,
        final: Number
    },
    showdown: {
        board: [String],
        hands: [{
            player: String,
            cards: [String],
            description: String,
            board: [String]
        }]
    },
    winners: [{
        playerIndex: Number,
        username: String,
        position: String,
        isWinner: Boolean,
        amount: Number,
        hand: {
            description: String,
            cards: [String]
        }
    }],
    losers: [{
        playerIndex: Number,
        username: String,
        position: String,
        isWinner: Boolean,
        amount: Number,
        hand: {
            description: String,
            cards: [String]
        }
    }],
    uncalledBet: {
        amount: Number,
        player: String
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Add indexes for common queries
handSchema.index({ timestamp: -1 });
handSchema.index({ gameType: 1, timestamp: -1 });
handSchema.index({ heroPosition: 1, timestamp: -1 });

// Virtual for getting the final pot size
handSchema.virtual('finalPotSize').get(function() {
    return this.bettingActions.reduce((total, action) => total + action.amount, 0);
});

// Method to get all betting actions for a specific street
handSchema.methods.getStreetActions = function(street) {
    return this.bettingActions.filter(action => action.street === street);
};

// Method to get all active players at a specific point
handSchema.methods.getActivePlayers = function() {
    return Array.from({ length: this.numPlayers }, (_, i) => i)
        .filter(i => !this.foldedPlayers.includes(i));
};

// Method to get the current bet for a specific player
handSchema.methods.getPlayerBet = function(playerIndex) {
    const streetBet = this.streetBets.find(bet => bet.playerIndex === playerIndex);
    return streetBet ? streetBet.amount : 0;
};

const Hand = mongoose.model('Hand', handSchema);

export default Hand; 