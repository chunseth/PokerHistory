import {
    calculateHandStrength,
    calculateEquity,
    calculatePotOdds,
    getRecommendedAction,
    parseCard,
    evaluateHand
} from '../pokerAnalysis';

describe('Poker Analysis Utilities', () => {
    describe('parseCard', () => {
        it('should correctly parse a valid card', () => {
            const result = parseCard('As');
            expect(result).toEqual({ rank: 'A', suit: 's' });
        });

        it('should return null for invalid card', () => {
            const result = parseCard('invalid');
            expect(result).toBeNull();
        });
    });

    describe('evaluateHand', () => {
        it('should evaluate a royal flush correctly', () => {
            const cards = ['As', 'Ks', 'Qs', 'Js', 'Ts'];
            expect(evaluateHand(cards)).toBe(8000);
        });

        it('should evaluate a four of a kind correctly', () => {
            const cards = ['As', 'Ac', 'Ad', 'Ah', 'Ks'];
            expect(evaluateHand(cards)).toBe(7000);
        });

        it('should evaluate a full house correctly', () => {
            const cards = ['As', 'Ac', 'Ad', 'Ks', 'Kc'];
            expect(evaluateHand(cards)).toBe(6000);
        });

        it('should evaluate a flush correctly', () => {
            const cards = ['As', 'Ks', 'Qs', 'Js', '9s'];
            expect(evaluateHand(cards)).toBe(5000);
        });

        it('should evaluate a straight correctly', () => {
            const cards = ['9c', 'Td', 'Jh', 'Qs', 'Kc']; // Mixed suit straight
            expect(evaluateHand(cards)).toBe(4000);
        });

        it('should evaluate a three of a kind correctly', () => {
            const cards = ['As', 'Ac', 'Ad', 'Ks', 'Qs'];
            expect(evaluateHand(cards)).toBe(3000);
        });

        it('should evaluate a two pair correctly', () => {
            const cards = ['As', 'Ac', 'Ks', 'Kc', 'Qs'];
            expect(evaluateHand(cards)).toBe(2000);
        });

        it('should evaluate a one pair correctly', () => {
            const cards = ['As', 'Ac', 'Ks', 'Qs', 'Js'];
            expect(evaluateHand(cards)).toBe(1000);
        });

        it('should evaluate high card correctly', () => {
            const cards = ['As', 'Ks', 'Qs', 'Js', '9s'];
            expect(evaluateHand(cards)).toBe(5000); // Flush
        });
    });

    describe('calculateHandStrength', () => {
        it('should return 0 for invalid input', () => {
            expect(calculateHandStrength(null, [])).toBe(0);
            expect(calculateHandStrength([], [])).toBe(0);
            expect(calculateHandStrength(['As'], [])).toBe(0);
        });

        it('should calculate hand strength for a royal flush', () => {
            const holeCards = ['As', 'Ks'];
            const communityCards = ['Qs', 'Js', 'Ts'];
            const strength = calculateHandStrength(holeCards, communityCards);
            expect(strength).toBeGreaterThan(0.9); // Should be very close to 1
        });

        it('should calculate hand strength for a weak hand', () => {
            const holeCards = ['2s', '7h']; // Unconnected, unsuited low cards
            const communityCards = ['4c', 'Td', 'As'];
            const strength = calculateHandStrength(holeCards, communityCards);
            expect(strength).toBeLessThan(0.5); // Should be relatively low
        });
    });

    describe('calculateEquity', () => {
        it('should return 0 for invalid input', () => {
            expect(calculateEquity(null, [], {})).toBe(0);
            expect(calculateEquity([], [], {})).toBe(0);
            expect(calculateEquity(['As'], [], {})).toBe(0);
        });

        it('should calculate equity for a strong hand', () => {
            const holeCards = ['As', 'Ks'];
            const communityCards = ['Qs', 'Js', 'Ts'];
            const equity = calculateEquity(holeCards, communityCards, {});
            expect(equity).toBeGreaterThan(0.5); // Should be above 50%
        });

        it('should calculate equity for a weak hand', () => {
            const holeCards = ['2s', '7h']; // Unconnected, unsuited low cards
            const communityCards = ['4c', 'Td', 'As'];
            const equity = calculateEquity(holeCards, communityCards, {});
            expect(equity).toBeLessThan(0.5); // Should be below 50%
        });
    });

    describe('calculatePotOdds', () => {
        it('should calculate pot odds correctly', () => {
            expect(calculatePotOdds(10, 90)).toBe(0.1); // 10% pot odds
            expect(calculatePotOdds(50, 50)).toBe(0.5); // 50% pot odds
            expect(calculatePotOdds(90, 10)).toBe(0.9); // 90% pot odds
        });

        it('should handle zero pot size', () => {
            expect(calculatePotOdds(10, 0)).toBe(1); // 100% pot odds
        });
    });

    describe('getRecommendedAction', () => {
        it('should recommend raise for strong preflop hand', () => {
            const action = getRecommendedAction(
                'preflop',
                'BTN',
                'open',
                1.5,
                1,
                0.9, // Strong hand
                0.8, // High equity
                0.1  // Low pot odds
            );
            expect(action.action).toBe('raise');
            expect(action.frequency).toBe(1.0);
        });

        it('should recommend check for weak postflop hand', () => {
            const action = getRecommendedAction(
                'flop',
                'BTN',
                'cbet',
                100,
                50,
                0.2, // Weak hand
                0.3, // Low equity
                0.5  // High pot odds
            );
            expect(action.action).toBe('check');
            expect(action.frequency).toBe(1.0);
        });

        it('should recommend bet for strong postflop hand', () => {
            const action = getRecommendedAction(
                'flop',
                'BTN',
                'cbet',
                100,
                50,
                0.8, // Strong hand
                0.8, // High equity
                0.5  // Medium pot odds
            );
            expect(action.action).toBe('bet');
            expect(action.frequency).toBeGreaterThan(0.5);
        });
    });
}); 