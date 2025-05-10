const mongoose = require('mongoose');
const {
    playerSchema,
    bettingActionSchema,
    handAnalysisSchema,
    handSchema,
    sessionSchema,
    userStatisticsSchema,
    userSchema
} = require('./schemas');

// Add indexes to schemas before creating models
handSchema.index({ sessionId: 1 });
handSchema.index({ timestamp: -1 });
handSchema.index({ 'heroHoleCards': 1 });
sessionSchema.index({ userId: 1 });
sessionSchema.index({ startTime: -1 });

// Create models
const Hand = mongoose.model('Hand', handSchema);
const Session = mongoose.model('Session', sessionSchema);
const User = mongoose.model('User', userSchema);

module.exports = {
    Hand,
    Session,
    User
}; 