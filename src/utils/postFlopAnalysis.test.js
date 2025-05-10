import PostFlopAnalyzer from './postFlopAnalysis';

describe('PostFlopAnalyzer', () => {
    let analyzer;

    beforeEach(() => {
        // Create a new analyzer instance before each test
        analyzer = new PostFlopAnalyzer('IP', 100); // IP position, 100BB stack
    });

    describe('analyzeHand', () => {
        test('should return normalized frequencies that sum to 1', () => {
            const board = ['Ah', 'Kd', 'Qc']; // Dry board
            const hand = ['As', 'Ks'];
            const analysis = analyzer.analyzeHand(hand, board, 10, 'flop');
            
            const totalFreq = analysis.frequencies.bet.freq + analysis.frequencies.check.freq;
            expect(totalFreq).toBeCloseTo(1, 5);
        });

        test('should adjust frequencies based on stack depth', () => {
            // Test deep stack
            const deepAnalyzer = new PostFlopAnalyzer('IP', 200);
            const deepAnalysis = deepAnalyzer.analyzeHand(['As', 'Ks'], ['Ah', 'Kd', 'Qc'], 10, 'flop');
            
            // Test short stack
            const shortAnalyzer = new PostFlopAnalyzer('IP', 30);
            const shortAnalysis = shortAnalyzer.analyzeHand(['As', 'Ks'], ['Ah', 'Kd', 'Qc'], 10, 'flop');
            
            // Deep stack should bet more frequently
            expect(deepAnalysis.frequencies.bet.freq).toBeGreaterThan(shortAnalysis.frequencies.bet.freq);
        });

        test('should have different frequencies for different board textures', () => {
            // Dry board
            const dryBoard = ['Ah', 'Kd', 'Qc'];
            const dryAnalysis = analyzer.analyzeHand(['As', 'Ks'], dryBoard, 10, 'flop');
            
            // Wet board
            const wetBoard = ['Ah', 'Kh', 'Qh'];
            const wetAnalysis = analyzer.analyzeHand(['As', 'Ks'], wetBoard, 10, 'flop');
            
            // Should bet more on dry boards
            expect(dryAnalysis.frequencies.bet.freq).toBeGreaterThan(wetAnalysis.frequencies.bet.freq);
        });

        test('should have different frequencies for IP vs OOP', () => {
            // IP analyzer
            const ipAnalyzer = new PostFlopAnalyzer('IP', 100);
            const ipAnalysis = ipAnalyzer.analyzeHand(['As', 'Ks'], ['Ah', 'Kd', 'Qc'], 10, 'flop');
            
            // OOP analyzer
            const oopAnalyzer = new PostFlopAnalyzer('OOP', 100);
            const oopAnalysis = oopAnalyzer.analyzeHand(['As', 'Ks'], ['Ah', 'Kd', 'Qc'], 10, 'flop');
            
            // IP should bet more frequently
            expect(ipAnalysis.frequencies.bet.freq).toBeGreaterThan(oopAnalysis.frequencies.bet.freq);
        });

        test('should have reasonable bet sizing based on board texture', () => {
            // Dry board
            const dryBoard = ['Ah', 'Kd', 'Qc'];
            const dryAnalysis = analyzer.analyzeHand(['As', 'Ks'], dryBoard, 10, 'flop');
            
            // Wet board
            const wetBoard = ['Ah', 'Kh', 'Qh'];
            const wetAnalysis = analyzer.analyzeHand(['As', 'Ks'], wetBoard, 10, 'flop');
            
            // Should bet smaller on dry boards
            expect(dryAnalysis.frequencies.bet.size).toBeLessThan(wetAnalysis.frequencies.bet.size);
        });

        test('should have reasonable frequencies for all board textures', () => {
            const boardTypes = {
                dry: ['Ah', 'Kd', 'Qc'],
                wet: ['Ah', 'Kh', 'Qh'],
                monotone: ['Ah', 'Kh', 'Qh'],
                paired: ['Ah', 'Ad', 'Qc']
            };

            for (const [type, board] of Object.entries(boardTypes)) {
                const analysis = analyzer.analyzeHand(['As', 'Ks'], board, 10, 'flop');
                
                // Bet frequency should be between 0.4 and 0.8
                expect(analysis.frequencies.bet.freq).toBeGreaterThanOrEqual(0.4);
                expect(analysis.frequencies.bet.freq).toBeLessThanOrEqual(0.8);
                
                // Check frequency should be between 0.2 and 0.6
                expect(analysis.frequencies.check.freq).toBeGreaterThanOrEqual(0.2);
                expect(analysis.frequencies.check.freq).toBeLessThanOrEqual(0.6);
                
                // Bet sizing should be between 0.33 and 0.75
                expect(analysis.frequencies.bet.size).toBeGreaterThanOrEqual(0.33);
                expect(analysis.frequencies.bet.size).toBeLessThanOrEqual(0.75);
            }
        });
    });
}); 