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
            tournamentName,
            username
        } = req.query;

        console.log('Received query params:', req.query); // Debug log

        // Build query
        const query = {};
        
        // Add username filter if provided
        if (username) {
            query.username = username;
            console.log('Added username filter:', username);
        }
        
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
            console.log('Processing hole cards filter:', holeCards);
            const cards = holeCards.split(',');
            console.log('Split cards:', cards);

            if (cards.length === 2 && cards[0] && cards[1]) {
                // Format both cards properly
                const firstCard = cards[0].length >= 2 ? 
                    cards[0][0].toUpperCase() + cards[0][1].toLowerCase() : 
                    cards[0].toUpperCase();
                
                const secondCard = cards[1].length >= 2 ? 
                    cards[1][0].toUpperCase() + cards[1][1].toLowerCase() : 
                    cards[1].toUpperCase();
                
                console.log('Formatted cards:', { firstCard, secondCard });
                console.log('Card lengths:', { 
                    firstCardLength: cards[0].length, 
                    secondCardLength: cards[1].length 
                });

                if (cards[0].length >= 2 && cards[1].length >= 2) {
                    // Both cards have rank and suit - exact match
                    console.log('Both cards have rank and suit - using exact match');
                    query.heroHoleCards = { $all: [firstCard, secondCard] };
                    console.log('Query for exact match:', query.heroHoleCards);
                } else if (cards[0].length >= 2) {
                    // First card has rank and suit, second card is rank only
                    console.log('First card has rank and suit, second card is rank only');
                    const possibleSecondCards = ['h', 'd', 'c', 's'].map(suit => secondCard + suit);
                    // If ranks are the same, exclude the first card's suit from possible second cards
                    if (firstCard[0] === secondCard[0]) {
                        const firstCardSuit = firstCard[1];
                        const filteredSecondCards = possibleSecondCards.filter(card => card[1] !== firstCardSuit);
                        query.$and = [
                            { heroHoleCards: { $regex: `^${firstCard}` } },
                            { heroHoleCards: { $in: filteredSecondCards } }
                        ];
                    } else {
                        query.$and = [
                            { heroHoleCards: { $regex: `^${firstCard}` } },
                            { heroHoleCards: { $in: possibleSecondCards } }
                        ];
                    }
                    console.log('Query for partial match:', query.$and);
                } else if (cards[1].length >= 2) {
                    // First card is rank only, second card has rank and suit
                    console.log('First card is rank only, second card has rank and suit');
                    const possibleFirstCards = ['h', 'd', 'c', 's'].map(suit => firstCard + suit);
                    // If ranks are the same, exclude the second card's suit from possible first cards
                    if (firstCard === secondCard[0]) {
                        const secondCardSuit = secondCard[1];
                        const filteredFirstCards = possibleFirstCards.filter(card => card[1] !== secondCardSuit);
                        query.$and = [
                            { heroHoleCards: { $in: filteredFirstCards } },
                            { heroHoleCards: { $regex: `^${secondCard}` } }
                        ];
                    } else {
                        query.$and = [
                            { heroHoleCards: { $in: possibleFirstCards } },
                            { heroHoleCards: { $regex: `^${secondCard}` } }
                        ];
                    }
                    console.log('Query for partial match:', query.$and);
                } else {
                    // Both cards are rank only
                    console.log('Both cards are rank only');
                    if (firstCard === secondCard) {
                        // If ranks are the same, we need to ensure we get two different cards
                        const possibleCards = ['h', 'd', 'c', 's'].map(suit => firstCard + suit);
                        // Create all possible combinations of two different cards
                        const combinations = [];
                        for (let i = 0; i < possibleCards.length; i++) {
                            for (let j = i + 1; j < possibleCards.length; j++) {
                                combinations.push([possibleCards[i], possibleCards[j]]);
                            }
                        }
                        query.$or = combinations.map(combo => ({
                            heroHoleCards: { $all: combo }
                        }));
                        console.log('Same rank combinations:', combinations);
                    } else {
                        const possibleFirstCards = ['h', 'd', 'c', 's'].map(suit => firstCard + suit);
                        const possibleSecondCards = ['h', 'd', 'c', 's'].map(suit => secondCard + suit);
                        query.$and = [
                            { heroHoleCards: { $in: possibleFirstCards } },
                            { heroHoleCards: { $in: possibleSecondCards } }
                        ];
                    }
                    console.log('Query for rank only:', query.$or || query.$and);
                }
            } else if (cards[0]) {
                // For single card, convert to proper case for regex
                console.log('Single card filter');
                const firstCard = cards[0];
                if (firstCard.length >= 2) {
                    const formattedCard = firstCard[0].toUpperCase() + firstCard[1].toLowerCase();
                    query.heroHoleCards = { $regex: `^${formattedCard}` };
                    console.log('Query for single card with suit:', query.heroHoleCards);
                } else {
                    // For single character (rank only), match any card with that rank
                    query.heroHoleCards = { $regex: `^${firstCard.toUpperCase()}` };
                    console.log('Query for single card rank only:', query.heroHoleCards);
                }
            }
        }

        console.log('Final MongoDB query:', JSON.stringify(query, null, 2)); // Debug log

        // First, let's check if there are any hands in the database at all
        const totalHands = await Hand.countDocuments();
        console.log('Total hands in database:', totalHands);

        const hands = await Hand.find(query)
            .sort({ [sortBy]: -1 });

        console.log(`Found ${hands.length} hands matching query`);
        if (hands.length > 0) {
            console.log('First hand sample:', JSON.stringify(hands[0], null, 2));
        }

        res.json(hands);
    } catch (error) {
        console.error('Error fetching hands:', error);
        res.status(500).json({ 
            message: 'Error fetching hands',
            error: error.message 
        });
    }
});

// Get unique usernames
router.get('/usernames', async (req, res) => {
    try {
        const usernames = await Hand.distinct('username');
        res.json(usernames);
    } catch (error) {
        console.error('Error fetching usernames:', error);
        res.status(500).json({ 
            message: 'Error fetching usernames',
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