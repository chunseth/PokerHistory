import express from 'express';
import Hand from '../models/Hand.js';

const router = express.Router();

// Get player statistics
router.get('/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        // Get all hands for the player
        const hands = await Hand.find({ 'players.username': username });
        
        if (!hands || hands.length === 0) {
            return res.status(404).json({ message: 'No hands found for this player' });
        }

        // Calculate basic statistics
        const totalHands = hands.length;
        const totalProfit = hands.reduce((sum, hand) => {
            const playerHand = hand.players.find(p => p.username === username);
            return sum + (playerHand?.profit || 0);
        }, 0);
        const winRate = hands.filter(hand => {
            const playerHand = hand.players.find(p => p.username === username);
            return playerHand?.profit > 0;
        }).length / totalHands;

        // Calculate position statistics
        const positionStats = {};
        hands.forEach(hand => {
            const playerHand = hand.players.find(p => p.username === username);
            if (playerHand) {
                const position = playerHand.position;
                if (!positionStats[position]) {
                    positionStats[position] = {
                        hands: 0,
                        wins: 0,
                        profit: 0
                    };
                }
                positionStats[position].hands++;
                if (playerHand.profit > 0) {
                    positionStats[position].wins++;
                }
                positionStats[position].profit += playerHand.profit;
            }
        });

        // Calculate win rates for each position
        Object.keys(positionStats).forEach(position => {
            const stats = positionStats[position];
            stats.winRate = stats.hands > 0 ? stats.wins / stats.hands : 0;
        });

        // Calculate street statistics
        const streetStats = {
            preflop: { win: 0, loss: 0 },
            flop: { win: 0, loss: 0 },
            turn: { win: 0, loss: 0 },
            river: { win: 0, loss: 0 }
        };

        hands.forEach(hand => {
            const playerHand = hand.players.find(p => p.username === username);
            if (playerHand) {
                ['preflop', 'flop', 'turn', 'river'].forEach(street => {
                    if (playerHand[`${street}Profit`] > 0) {
                        streetStats[street].win++;
                    } else if (playerHand[`${street}Profit`] < 0) {
                        streetStats[street].loss++;
                    }
                });
            }
        });

        // Calculate preflop statistics
        let vpip = 0;
        let pfr = 0;
        let threeBet = 0;

        hands.forEach(hand => {
            const playerHand = hand.players.find(p => p.username === username);
            if (playerHand) {
                if (playerHand.voluntarilyPlayed) vpip++;
                if (playerHand.raisedPreflop) pfr++;
                if (playerHand.threeBet) threeBet++;
            }
        });

        // Calculate hand strength statistics
        const handStrengthStats = {
            premium: { count: 0, win: 0 },
            strong: { count: 0, win: 0 },
            medium: { count: 0, win: 0 },
            weak: { count: 0, win: 0 }
        };

        hands.forEach(hand => {
            const playerHand = hand.players.find(p => p.username === username);
            if (playerHand) {
                const strength = calculateHandStrength(playerHand.holeCards);
                handStrengthStats[strength].count++;
                if (playerHand.profit > 0) {
                    handStrengthStats[strength].win++;
                }
            }
        });

        res.json({
            totalHands,
            totalProfit,
            winRate,
            vpip: totalHands > 0 ? vpip / totalHands : 0,
            pfr: totalHands > 0 ? pfr / totalHands : 0,
            threeBet: totalHands > 0 ? threeBet / totalHands : 0,
            positionStats,
            streetStats,
            handStrength: handStrengthStats
        });
    } catch (error) {
        console.error('Error getting player stats:', error);
        res.status(500).json({ message: 'Error getting player statistics' });
    }
});

// Helper function to calculate hand strength
function calculateHandStrength(holeCards) {
    if (!holeCards || holeCards.length !== 2) return 'weak';

    const [card1, card2] = holeCards;
    const values = {
        'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10,
        '9': 9, '8': 8, '7': 7, '6': 6, '5': 5,
        '4': 4, '3': 3, '2': 2
    };

    const value1 = values[card1[0]];
    const value2 = values[card2[0]];
    const isSuited = card1[1] === card2[1];
    const isPair = value1 === value2;

    if (isPair) {
        if (value1 >= 10) return 'premium';
        if (value1 >= 7) return 'strong';
        return 'medium';
    }

    if (value1 >= 12 && value2 >= 12) return 'premium';
    if (value1 >= 10 && value2 >= 10) return 'strong';
    if (value1 >= 8 && value2 >= 8) return 'medium';
    return 'weak';
}

export default router; 