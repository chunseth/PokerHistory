import mongoose from 'mongoose';
import Hand from './server/models/Hand.js';

async function printHandFields() {
    try {
        await mongoose.connect('mongodb://localhost:27017/pokerHistory');
        const hand = await Hand.findOne();
        if (!hand) {
            console.log('No hand found in the database.');
            process.exit(0);
        }
        console.log('Hand document fields:');
        console.log(Object.keys(hand.toObject()));
        console.log('\nFull document:');
        console.dir(hand.toObject(), { depth: null });
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error fetching hand fields:', error);
        process.exit(1);
    }
}

printHandFields(); 