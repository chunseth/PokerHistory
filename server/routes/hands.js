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
            gameType
        } = req.query;

        console.log('Received query params:', req.query); // Debug log

        // Build query
        const query = {};
        
        // Add filters if they exist
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
            try {
                const cards = holeCards.split(',')
                    .map(card => card.toUpperCase().trim())
                    .filter(card => card.length > 0); // Keep all non-empty cards

                console.log('Processed hole cards:', cards); // Debug log

                if (cards.length > 0) {
                    // Use $all to ensure all specified cards are present
                    query.heroHoleCards = {
                        $all: cards.map(card => {
                            // If it's a single character (rank only), match any suit
                            if (card.length === 1) {
                                return new RegExp(`^${card}[cdhs]$`, 'i');
                            }
                            // Otherwise match the exact card
                            return new RegExp(`^${card}$`, 'i');
                        })
                    };
                }
            } catch (error) {
                console.error('Error processing hole cards filter:', error);
                // Don't apply the filter if there's an error
            }
        }

        // Build sort options
        const sortOptions = {};
        switch (sortBy) {
            case 'stackSize':
                sortOptions.heroStackSize = -1;
                break;
            case 'potSize':
                sortOptions.potSize = -1;
                break;
            default:
                sortOptions.timestamp = -1;
        }

        console.log('Final query:', JSON.stringify(query, null, 2)); // Debug log
        console.log('Sort options:', sortOptions); // Debug log

        const hands = await Hand.find(query).sort(sortOptions);
        console.log('Found hands:', hands.length); // Debug log
        
        res.json(hands);
    } catch (error) {
        console.error('Error fetching hands:', error);
        console.error('Error stack:', error.stack); // Add stack trace
        res.status(500).json({ 
            message: 'Error fetching hands',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
        const hand = await Hand.findByIdAndDelete(req.params.id);
        if (!hand) {
            return res.status(404).json({ message: 'Hand not found' });
        }
        res.json({ message: 'Hand deleted successfully' });
    } catch (error) {
        console.error('Error deleting hand:', error);
        res.status(500).json({ 
            message: 'Error deleting hand',
            error: error.message 
        });
    }
});

export default router; 