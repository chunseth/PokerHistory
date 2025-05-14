const { Schema } = require('mongoose');

// Player Schema
const playerSchema = new Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    stackSize: { type: Number, required: true },
    position: { type: Number, required: true, min: 0, max: 8 },
    holeCards: { type: [String], validate: {
        validator: function(cards) {
            return cards.length <= 2 && cards.every(card => 
                /^[2-9TJQKA][cdhs]$/.test(card)
            );
        },
        message: 'Invalid hole cards'
    }},
    isActive: { type: Boolean, default: true }
}, { _id: false });

// Betting Action Schema
const bettingActionSchema = new Schema({
    playerId: { type: String, required: true },
    action: { 
        type: String, 
        required: true,
        enum: ['fold', 'check', 'call', 'bet', 'raise']
    },
    amount: { type: Number, required: true, min: 0 },
    street: { 
        type: String, 
        required: true,
        enum: ['preflop', 'flop', 'turn', 'river']
    },
    timestamp: { type: Date, required: true }
}, { _id: false });

// Hand Analysis Schema
const handAnalysisSchema = new Schema({
    preflop: {
        handStrength: { type: Number, min: 0, max: 1 },
        equity: { type: Number, min: 0, max: 1 },
        potOdds: { type: Number, min: 0 },
        recommendedAction: String
    },
    flop: {
        handStrength: { type: Number, min: 0, max: 1 },
        equity: { type: Number, min: 0, max: 1 },
        potOdds: { type: Number, min: 0 },
        outs: [Number],
        drawTypes: [String],
        recommendedAction: String
    },
    turn: {
        handStrength: { type: Number, min: 0, max: 1 },
        equity: { type: Number, min: 0, max: 1 },
        potOdds: { type: Number, min: 0 },
        outs: [Number],
        drawTypes: [String],
        recommendedAction: String
    },
    river: {
        handStrength: { type: Number, min: 0, max: 1 },
        equity: { type: Number, min: 0, max: 1 },
        potOdds: { type: Number, min: 0 },
        recommendedAction: String
    }
}, { _id: false });

// Hand Schema
const handSchema = new Schema({
    id: { type: String, required: true, unique: true },
    sessionId: { type: String, required: true },
    timestamp: { type: Date, required: true },
    gameType: { 
        type: String, 
        required: true,
        enum: ['cash', 'tournament']
    },
    players: [playerSchema],
    buttonPosition: { type: Number, required: true, min: 0, max: 8 },
    communityCards: {
        flop: { 
            type: [String],
            validate: {
                validator: function(cards) {
                    return !cards || (cards.length === 3 && cards.every(card => 
                        /^[2-9TJQKA][cdhs]$/.test(card)
                    ));
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
    bettingActions: [bettingActionSchema],
    potSize: { type: Number, required: true, min: 0 },
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
    heroPosition: { type: Number, required: true, min: 0, max: 8 },
    notes: String,
    analysis: handAnalysisSchema
}, { timestamps: true });

// Session Schema
const sessionSchema = new Schema({
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: Date,
    gameType: { 
        type: String, 
        required: true,
        enum: ['cash', 'tournament']
    },
    buyIn: { type: Number, required: true, min: 0 },
    cashOut: { type: Number, min: 0 },
    hands: [{ type: String, ref: 'Hand' }]
}, { timestamps: true });

// User Statistics Schema
const userStatisticsSchema = new Schema({
    handsPlayed: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    vpip: { type: Number, default: 0 },
    pfr: { type: Number, default: 0 },
    threeBet: { type: Number, default: 0 },
    foldToCbet: { type: Number, default: 0 },
    foldTo3bet: { type: Number, default: 0 },
    foldToSteal: { type: Number, default: 0 },
    btnSteal: { type: Number, default: 0 },
    sbFoldToSteal: { type: Number, default: 0 },
    bbFoldToSteal: { type: Number, default: 0 },
    cbetFlop: { type: Number, default: 0 },
    cbetTurn: { type: Number, default: 0 },
    cbetRiver: { type: Number, default: 0 },
    afq: { type: Number, default: 0 },
    wtsd: { type: Number, default: 0 },
    w$sd: { type: Number, default: 0 },
    avgOpenSize: { type: Number, default: 0 },
    avg3betSize: { type: Number, default: 0 },
    avgCbetSize: { type: Number, default: 0 },
    itm: { type: Number, default: 0 },
    avgFinish: { type: Number, default: 0 }
}, { _id: false });

// User Schema
const userSchema = new Schema({
    id: { type: String, required: true, unique: true },
    username: { 
        type: String, 
        required: true, 
        unique: true,
        index: true
    },
    sessions: [{ type: String, ref: 'Session' }],
    statistics: userStatisticsSchema
}, { timestamps: true });

module.exports = {
    playerSchema,
    bettingActionSchema,
    handAnalysisSchema,
    handSchema,
    sessionSchema,
    userStatisticsSchema,
    userSchema
}; 