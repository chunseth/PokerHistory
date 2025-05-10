const mongoose = require('mongoose');
const mongoDBConnection = require('../config/mongodb.config');
const { Hand, Session, User } = require('../models/models');

class DatabaseService {
    constructor() {
        this.db = null;
    }

    async initialize() {
        try {
            // Connect to MongoDB using Mongoose
            await mongoose.connect(process.env.MONGODB_URI, {
                dbName: 'pokerHistory',
                compressors: ['zlib'],
                zlibCompressionLevel: 7
            });
            
            this.db = mongoose.connection;
            console.log('Mongoose connected successfully');
        } catch (error) {
            console.error('Failed to initialize database service:', error);
            throw error;
        }
    }

    // Hand Operations
    async saveHand(handData) {
        try {
            const hand = new Hand(handData);
            await hand.validate();
            return await hand.save();
        } catch (error) {
            if (error.name === 'ValidationError') {
                throw new Error(`Invalid hand data: ${error.message}`);
            }
            throw error;
        }
    }

    async getHand(handId) {
        try {
            return await Hand.findById(handId);
        } catch (error) {
            throw new Error(`Failed to retrieve hand: ${error.message}`);
        }
    }

    async getHandsBySession(sessionId, page = 1, limit = 10) {
        try {
            const skip = (page - 1) * limit;
            return await Hand.find({ sessionId })
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit);
        } catch (error) {
            throw new Error(`Failed to retrieve hands: ${error.message}`);
        }
    }

    // Session Operations
    async saveSession(sessionData) {
        try {
            const session = new Session(sessionData);
            await session.validate();
            return await session.save();
        } catch (error) {
            if (error.name === 'ValidationError') {
                throw new Error(`Invalid session data: ${error.message}`);
            }
            throw error;
        }
    }

    async getSession(sessionId) {
        try {
            return await Session.findById(sessionId);
        } catch (error) {
            throw new Error(`Failed to retrieve session: ${error.message}`);
        }
    }

    async getSessionsByUser(userId, page = 1, limit = 10) {
        try {
            const skip = (page - 1) * limit;
            return await Session.find({ userId })
                .sort({ startTime: -1 })
                .skip(skip)
                .limit(limit);
        } catch (error) {
            throw new Error(`Failed to retrieve sessions: ${error.message}`);
        }
    }

    // User Operations
    async saveUser(userData) {
        try {
            const user = new User(userData);
            await user.validate();
            return await user.save();
        } catch (error) {
            if (error.name === 'ValidationError') {
                throw new Error(`Invalid user data: ${error.message}`);
            }
            throw error;
        }
    }

    async getUser(userId) {
        try {
            return await User.findById(userId);
        } catch (error) {
            throw new Error(`Failed to retrieve user: ${error.message}`);
        }
    }

    async updateUserStatistics(userId, statistics) {
        try {
            return await User.findByIdAndUpdate(
                userId,
                { $set: { statistics } },
                { new: true }
            );
        } catch (error) {
            throw new Error(`Failed to update user statistics: ${error.message}`);
        }
    }

    // Error Recovery
    async recoverFromError(error) {
        try {
            if (error.name === 'MongoError' && error.code === 11000) {
                return this.handleDuplicateKeyError(error);
            }
            throw error;
        } catch (recoveryError) {
            console.error('Recovery failed:', recoveryError);
            throw error;
        }
    }

    async handleDuplicateKeyError(error) {
        return null;
    }

    async disconnect() {
        try {
            await mongoose.disconnect();
            console.log('Mongoose disconnected successfully');
        } catch (error) {
            console.error('Error disconnecting from MongoDB:', error);
            throw error;
        }
    }
}

// Create a singleton instance
const databaseService = new DatabaseService();

module.exports = databaseService; 