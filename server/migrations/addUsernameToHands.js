import mongoose from 'mongoose';
import Hand from '../models/Hand.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/poker-history';

async function migrate() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Update all hands that don't have a username
        const result = await Hand.updateMany(
            { username: { $exists: false } },
            { $set: { username: 'grotle' } } // Default username
        );

        console.log(`Updated ${result.modifiedCount} hands with default username`);

        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate(); 