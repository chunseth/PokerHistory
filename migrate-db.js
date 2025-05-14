import mongoose from 'mongoose';
import Hand from './server/models/Hand.js';

async function migrateDatabase() {
    try {
        // Connect to both databases
        const sourceConn = await mongoose.createConnection('mongodb://localhost:27017/poker-history');
        const targetConn = await mongoose.createConnection('mongodb://localhost:27017/pokerHistory');

        console.log('Connected to both databases');

        // Get the Hand model for both databases
        const SourceHand = sourceConn.model('Hand', Hand.schema);
        const TargetHand = targetConn.model('Hand', Hand.schema);

        // Get all hands from source database
        const hands = await SourceHand.find({});
        console.log(`Found ${hands.length} hands in poker-history database`);

        // Clear the target database
        await targetConn.dropDatabase();
        console.log('Cleared pokerHistory database');

        // Insert all hands into target database
        if (hands.length > 0) {
            await TargetHand.insertMany(hands);
            console.log(`Successfully migrated ${hands.length} hands to pokerHistory database`);
        }

        // Close connections
        await sourceConn.close();
        await targetConn.close();
        console.log('Database connections closed');

    } catch (error) {
        console.error('Error during migration:', error);
        process.exit(1);
    }
}

// Run the migration
migrateDatabase(); 