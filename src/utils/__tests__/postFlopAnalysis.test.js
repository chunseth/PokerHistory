import PostFlopAnalyzer from '../postFlopAnalysis';

describe('PostFlopAnalyzer', () => {
    let analyzer;

    beforeEach(() => {
        analyzer = new PostFlopAnalyzer('IP', 100); // In position, 100 BB deep
    });

    describe('Board Texture Analysis', () => {
        it('should identify a dry board', () => {
            const board = ['2s', '7h', 'Kd'];
            const analysis = analyzer.analyzeBoardTexture(board);
            expect(analysis.description).toBe('Low connectivity, few draws');
        });

        it('should identify a wet board', () => {
            const board = ['9s', 'Ts', 'Js'];
            const analysis = analyzer.analyzeBoardTexture(board);
            expect(analysis.description).toBe('High connectivity, many draws');
        });

        it('should identify a monotone board', () => {
            const board = ['2s', '7s', 'Ks'];
            const analysis = analyzer.analyzeBoardTexture(board);
            expect(analysis.description).toBe('Three cards of same suit');
        });

        it('should identify a paired board', () => {
            const board = ['2s', '2h', 'Kd'];
            const analysis = analyzer.analyzeBoardTexture(board);
            expect(analysis.description).toBe('Two or more cards of same rank');
        });
    });

    describe('Bet Sizing', () => {
        it('should recommend smaller sizing on dry boards', () => {
            const board = ['2s', '7h', 'Kd'];
            const potSize = 100;
            const betSize = analyzer.getBetSizing('cbet', analyzer.analyzeBoardTexture(board), potSize);
            expect(betSize).toBeLessThan(potSize * 0.5);
        });

        it('should recommend larger sizing on wet boards', () => {
            const board = ['9s', 'Ts', 'Js'];
            const potSize = 100;
            const betSize = analyzer.getBetSizing('cbet', analyzer.analyzeBoardTexture(board), potSize);
            expect(betSize).toBeGreaterThan(potSize * 0.5);
        });
    });

    describe('Position-based Adjustments', () => {
        it('should adjust frequencies based on position', () => {
            const ipAnalyzer = new PostFlopAnalyzer('IP', 100);
            const oopAnalyzer = new PostFlopAnalyzer('OOP', 100);
            
            const board = ['2s', '7h', 'Kd'];
            const ipFrequency = ipAnalyzer.getActionFrequency('cbet', analyzer.analyzeBoardTexture(board));
            const oopFrequency = oopAnalyzer.getActionFrequency('cbet', analyzer.analyzeBoardTexture(board));
            
            expect(ipFrequency).toBeGreaterThan(oopFrequency);
        });
    });

    describe('Stack Depth Adjustments', () => {
        it('should adjust sizing based on stack depth', () => {
            const deepAnalyzer = new PostFlopAnalyzer('IP', 150);
            const shortAnalyzer = new PostFlopAnalyzer('IP', 30);
            
            const board = ['2s', '7h', 'Kd'];
            const potSize = 100;
            
            const deepBetSize = deepAnalyzer.getBetSizing('cbet', analyzer.analyzeBoardTexture(board), potSize);
            const shortBetSize = shortAnalyzer.getBetSizing('cbet', analyzer.analyzeBoardTexture(board), potSize);
            
            expect(deepBetSize).toBeGreaterThan(shortBetSize);
        });
    });

    describe('Hand Analysis', () => {
        it('should provide complete analysis for a hand', () => {
            const hand = ['As', 'Ks'];
            const board = ['2s', '7h', 'Kd'];
            const potSize = 100;
            
            const analysis = analyzer.analyzeHand(hand, board, potSize, 'cbet');
            
            expect(analysis).toHaveProperty('boardTexture');
            expect(analysis).toHaveProperty('recommendedAction');
            expect(analysis.recommendedAction).toHaveProperty('action');
            expect(analysis.recommendedAction).toHaveProperty('sizing');
            expect(analysis.recommendedAction).toHaveProperty('frequency');
            expect(analysis).toHaveProperty('adjustments');
        });
    });
}); 