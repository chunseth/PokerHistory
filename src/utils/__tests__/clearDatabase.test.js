const mongoose = require('mongoose');
const { Hand } = require('../../models/models');

describe('Database Cleanup', () => {
    let dbConnection;

    beforeAll(async () => {
        try {
            // Connect to database
            await mongoose.connect('mongodb://localhost:27017/pokerHistory', {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('✅ Connected to poker history database');
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
        }
    });

    afterAll(async () => {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('🔌 Disconnected from database');
        }
    });

    describe('Clear All Hands', () => {
        test('should delete all hands from the database', async () => {
            if (mongoose.connection.readyState !== 1) {
                console.log('⚠️  Skipping test - no database connection');
                return;
            }

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

            // Assertions
            expect(deleteResult.deletedCount).toBe(initialCount);
            expect(finalCount).toBe(0);

            console.log('✅ Database successfully cleared! You can now re-upload your hand history files.');
        });
    });
}); 