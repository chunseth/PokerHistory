const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'pokerHistory';

class MongoDBConnection {
    constructor() {
        this.client = null;
        this.db = null;
    }

    async connect() {
        try {
            this.client = new MongoClient(MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                compressors: ['zlib'], // Enable compression
                zlibCompressionLevel: 7 // Compression level (0-9)
            });

            await this.client.connect();
            this.db = this.client.db(DB_NAME);
            console.log('Connected to MongoDB successfully');
        } catch (error) {
            console.error('MongoDB connection error:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.client) {
                await this.client.close();
                this.client = null;
                this.db = null;
                console.log('Disconnected from MongoDB');
            }
        } catch (error) {
            console.error('Error disconnecting from MongoDB:', error);
            throw error;
        }
    }

    getDatabase() {
        if (!this.db) {
            throw new Error('Database not connected');
        }
        return this.db;
    }

    isConnected() {
        return this.client && this.client.isConnected();
    }
}

// Create a singleton instance
const mongoDBConnection = new MongoDBConnection();

module.exports = mongoDBConnection; 