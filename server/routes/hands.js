import express from 'express';
import Hand from '../models/Hand.js';

const router = express.Router();

// Get all hands with optional filters
router.get('/', async (req, res) => {
    try {
        const {
            sortBy = 'timestamp',
            position,
            minStackSize,
            maxStackSize,
            holeCards,
            gameType,
            startDate,
            endDate,
            tournamentName
        } = req.query;

        console.log('Received query params:', req.query); // Debug log

        // Build query
        const query = {};
        
        // Add date range filter if dates are provided
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            console.log('Date range:', {
                startDate,
                endDate,
                parsedStart: start.toISOString(),
                parsedEnd: end.toISOString()
            });

            query.timestamp = {
                $gte: start,
                $lte: end
            };
        }
        
        // Add tournament name filter if provided
        if (tournamentName) {
            query.tournamentName = { $regex: tournamentName, $options: 'i' }; // Case-insensitive search
        }
        
        // Add other filters if they exist
        if (position) query.heroPosition = position;
        if (gameType) query.gameType = gameType;
        
        // Stack size range
        if (minStackSize || maxStackSize) {
            query.heroStackSize = {};
            if (minStackSize) query.heroStackSize.$gte = Number(minStackSize);
            if (maxStackSize) query.heroStackSize.$lte = Number(maxStackSize);
        }

        // Hole cards filter
        if (holeCards) {
            const cards = holeCards.split(',');
            if (cards.length === 2 && cards[0] && cards[1]) {
                // First card should be exact match
                const firstCard = cards[0].length >= 2 ? 
                    cards[0][0].toUpperCase() + cards[0][1].toLowerCase() : 
                    cards[0].toUpperCase();
                
                // Second card can be partial (rank only)
                const secondCard = cards[1].toUpperCase();
                
                // Create an array of possible matches for the second card
                const possibleSecondCards = ['h', 'd', 'c', 's'].map(suit => secondCard + suit);
                
                // Match first card exactly and second card with any suit
                query.$and = [
                    { heroHoleCards: { $regex: `^${firstCard}` } },
                    { heroHoleCards: { $in: possibleSecondCards } }
                ];
            } else if (cards[0]) {
                // For single card, convert to proper case for regex
                const firstCard = cards[0];
                if (firstCard.length >= 2) {
                    const formattedCard = firstCard[0].toUpperCase() + firstCard[1].toLowerCase();
                    query.heroHoleCards = { $regex: `^${formattedCard}` };
                } else {
                    // For single character (rank only), match any card with that rank
                    query.heroHoleCards = { $regex: `^${firstCard.toUpperCase()}` };
                }
            }
        }

        console.log('MongoDB query:', JSON.stringify(query, null, 2)); // Debug log

        const hands = await Hand.find(query)
            .sort({ [sortBy]: -1 });

        console.log(`Found ${hands.length} hands`); // Debug log

        res.json(hands);
    } catch (error) {
        console.error('Error fetching hands:', error);
        res.status(500).json({ 
            message: 'Error fetching hands',
            error: error.message 
        });
    }
});

// Get a single hand by ID
router.get('/:id', async (req, res) => {
    try {
        console.log('Fetching hand with ID:', req.params.id);
        const hand = await Hand.findById(req.params.id);
        console.log('Found hand:', JSON.stringify(hand, null, 2));
        
        if (!hand) {
            return res.status(404).json({ message: 'Hand not found' });
        }
        res.json(hand);
    } catch (error) {
        console.error('Error fetching hand:', error);
        res.status(500).json({ 
            message: 'Error fetching hand',
            error: error.message 
        });
    }
});

// Create a new hand
router.post('/', async (req, res) => {
    try {
        console.log('Received hand data:', req.body); // Debug log
        
        const hand = new Hand(req.body);
        const savedHand = await hand.save();
        
        console.log('Saved hand:', savedHand); // Debug log
        res.status(201).json(savedHand);
    } catch (error) {
        console.error('Error creating hand:', error);
        res.status(400).json({ 
            message: 'Error creating hand', 
            error: error.message,
            validationErrors: error.errors // Include validation errors if any
        });
    }
});

// Update a hand
router.patch('/:id', async (req, res) => {
    try {
        console.log('Updating hand:', req.params.id, 'with data:', req.body);
        
        const hand = await Hand.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );
        
        if (!hand) {
            return res.status(404).json({ message: 'Hand not found' });
        }
        
        console.log('Updated hand:', hand);
        res.json(hand);
    } catch (error) {
        console.error('Error updating hand:', error);
        res.status(400).json({ 
            message: 'Error updating hand', 
            error: error.message,
            validationErrors: error.errors
        });
    }
});

// Delete a hand
router.delete('/:id', async (req, res) => {
    try {
        console.log('Attempting to delete hand with ID:', req.params.id);
        
        // Validate the ID format
        if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: 'Invalid hand ID format' });
        }

        const hand = await Hand.findByIdAndDelete(req.params.id);
        
        if (!hand) {
            console.log('No hand found with ID:', req.params.id);
            return res.status(404).json({ message: 'Hand not found' });
        }

        console.log('Successfully deleted hand:', hand);
        res.json({ message: 'Hand deleted successfully', deletedHand: hand });
    } catch (error) {
        console.error('Error deleting hand:', error);
        res.status(500).json({ 
            message: 'Error deleting hand',
            error: error.message 
        });
    }
});

export default router; 