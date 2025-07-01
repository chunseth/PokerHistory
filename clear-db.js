import mongoose from 'mongoose';
import Hand from './server/models/Hand.js';

async function clearDatabase() {
    try {
        // Connect to database
        await mongoose.connect('mongodb://localhost:27017/pokerHistory', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to poker history database');

        // Count existing hands
        const initialCount = await Hand.countDocuments();
        console.log(`📊 Found ${initialCount} hands in database before deletion`);

        if (initialCount === 0) {
            console.log('📭 Database is already empty');
            return;
        }

        // Delete all hands
        const deleteResult = await Hand.deleteMany({});
        console.log(`🗑️  Deleted ${deleteResult.deletedCount} hands from database`);

        // Verify deletion
        const finalCount = await Hand.countDocuments();
        console.log(`📊 Found ${finalCount} hands in database after deletion`);

        console.log('✅ Database successfully cleared! You can now re-upload your hand history files.');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from database');
    }
}

clearDatabase(); 