import Hand from '../models/hand.model';
import mongoose from 'mongoose';

class HandService {
    constructor() {
        this.isConnected = false;
        this.MONGODB_URI = 'mongodb://localhost:27017/pokerHistory';
    }

    async connect() {
        if (!this.isConnected) {
            try {
                await mongoose.connect(this.MONGODB_URI, {
                    dbName: 'pokerHistory',
                    compressors: ['zlib'],
                    zlibCompressionLevel: 7
                });
                this.isConnected = true;
                console.log('Connected to MongoDB for hand service');
            } catch (error) {
                console.error('Failed to connect to MongoDB:', error);
                throw error;
            }
        }
    }

    async disconnect() {
        if (this.isConnected) {
            try {
                await mongoose.disconnect();
                this.isConnected = false;
                console.log('Disconnected from MongoDB');
            } catch (error) {
                console.error('Error disconnecting from MongoDB:', error);
                throw error;
            }
        }
    }

    async saveHand(handData) {
        try {
            await this.connect();
            
            // Create a new hand document
            const hand = new Hand(handData);
            
            // Validate the hand data
            await hand.validate();
            
            // Save the hand
            const savedHand = await hand.save();
            console.log('Hand saved successfully:', savedHand.id);
            
            return savedHand;
        } catch (error) {
            console.error('Error saving hand:', error);
            if (error.name === 'ValidationError') {
                throw new Error(`Invalid hand data: ${error.message}`);
            }
            throw error;
        }
    }

    async getHand(handId) {
        try {
            await this.connect();
            const hand = await Hand.findById(handId);
            if (!hand) {
                throw new Error('Hand not found');
            }
            return hand;
        } catch (error) {
            console.error('Error retrieving hand:', error);
            throw error;
        }
    }

    async getHandsByDateRange(startDate, endDate, limit = 50) {
        try {
            await this.connect();
            return await Hand.find({
                timestamp: {
                    $gte: startDate,
                    $lte: endDate
                }
            })
            .sort({ timestamp: -1 })
            .limit(limit);
        } catch (error) {
            console.error('Error retrieving hands by date range:', error);
            throw error;
        }
    }

    async getHandsByPosition(position, limit = 50) {
        try {
            await this.connect();
            return await Hand.find({ heroPosition: position })
                .sort({ timestamp: -1 })
                .limit(limit);
        } catch (error) {
            console.error('Error retrieving hands by position:', error);
            throw error;
        }
    }

    async getHandsByGameType(gameType, limit = 50) {
        try {
            await this.connect();
            return await Hand.find({ gameType })
                .sort({ timestamp: -1 })
                .limit(limit);
        } catch (error) {
            console.error('Error retrieving hands by game type:', error);
            throw error;
        }
    }

    async deleteHand(handId) {
        try {
            await this.connect();
            const result = await Hand.findByIdAndDelete(handId);
            if (!result) {
                throw new Error('Hand not found');
            }
            return true;
        } catch (error) {
            console.error('Error deleting hand:', error);
            throw error;
        }
    }

    async updateHand(handId, updates) {
        try {
            await this.connect();
            const hand = await Hand.findByIdAndUpdate(
                handId,
                { $set: updates },
                { new: true, runValidators: true }
            );
            if (!hand) {
                throw new Error('Hand not found');
            }
            return hand;
        } catch (error) {
            console.error('Error updating hand:', error);
            throw error;
        }
    }
}

// Create a singleton instance
const handService = new HandService();

export default handService; 