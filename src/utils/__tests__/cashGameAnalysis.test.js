import {
    CashGameAnalyzer,
    RakeConfig,
    POSITION_CONFIGS,
    PLAYER_TYPES
} from '../cashGameAnalysis';

describe('Cash Game Analysis', () => {
    describe('Position Configurations', () => {
        it('should have correct positions for 9-max', () => {
            expect(POSITION_CONFIGS[9]).toEqual([
                'UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'
            ]);
        });

        it('should have correct positions for 6-max', () => {
            expect(POSITION_CONFIGS[6]).toEqual([
                'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'
            ]);
        });

        it('should have correct positions for heads-up', () => {
            expect(POSITION_CONFIGS[2]).toEqual([
                'BTN/SB', 'BB'
            ]);
        });
    });

    describe('Rake Calculations', () => {
        let rakeConfig;

        beforeEach(() => {
            rakeConfig = new RakeConfig(5, 5, true); // 5% rake, $5 cap, no flop no drop
        });

        it('should calculate rake correctly for small pots', () => {
            expect(rakeConfig.calculateRake(50, true)).toBe(2.5); // 5% of $50
        });

        it('should respect rake cap for large pots', () => {
            expect(rakeConfig.calculateRake(200, true)).toBe(5); // Capped at $5
        });

        it('should not take rake when no flop and noFlopNoDrop is true', () => {
            expect(rakeConfig.calculateRake(100, false)).toBe(0);
        });
    });

    describe('Player Type Adjustments', () => {
        it('should have correct adjustments for loose-passive players', () => {
            const adjustments = PLAYER_TYPES['loose-passive'].adjustments;
            expect(adjustments.bluffFrequency).toBeGreaterThan(1); // More bluffing
            expect(adjustments.valueSize).toBeGreaterThan(1);      // Bigger value bets
            expect(adjustments.callThreshold).toBeLessThan(1);     // Tighter calling
        });

        it('should have correct adjustments for tight-aggressive players', () => {
            const adjustments = PLAYER_TYPES['tight-aggressive'].adjustments;
            expect(adjustments.bluffFrequency).toBeLessThan(1);   // Less bluffing
            expect(adjustments.callThreshold).toBeGreaterThan(1);  // Wider calling
        });
    });

    describe('Cash Game Analyzer', () => {
        let analyzer;
        let rakeConfig;

        beforeEach(() => {
            rakeConfig = new RakeConfig(5, 5, true);
            analyzer = new CashGameAnalyzer(6, rakeConfig); // 6-max game
        });

        it('should correctly assign positions', () => {
            expect(analyzer.getPosition(0)).toBe('LJ');
            expect(analyzer.getPosition(3)).toBe('BTN');
            expect(analyzer.getPosition(5)).toBe('BB');
        });

        it('should analyze a street correctly', () => {
            const streetState = {
                street: 'flop',
                heroPosition: 'BTN',
                heroHoldings: ['As', 'Ks'],
                effectiveStack: 150, // 150 BB deep
                potSize: 100,
                lastAction: 'check',
                board: ['Qh', 'Jh', '2s'],
                opponentType: 'tight-aggressive',
                hasFlop: true
            };

            const analysis = analyzer.analyzeStreet(streetState);

            // Check the structure of the analysis
            expect(analysis).toHaveProperty('recommendation');
            expect(analysis).toHaveProperty('potDetails');
            expect(analysis).toHaveProperty('adjustments');

            // Check pot calculations
            expect(analysis.potDetails.rawPot).toBe(100);
            expect(analysis.potDetails.rake).toBe(5); // Should be capped at 5
            expect(analysis.potDetails.netPot).toBe(95);

            // Check deep stack adjustments are applied
            expect(analysis.adjustments.deep.postflop.cbetFrequency).toBeLessThan(1);
            expect(analysis.adjustments.deep.postflop.drawValue).toBeGreaterThan(1);
        });

        it('should maintain hand history', () => {
            const streetState = {
                street: 'flop',
                heroPosition: 'BTN',
                heroHoldings: ['As', 'Ks'],
                effectiveStack: 150,
                potSize: 100,
                lastAction: 'check',
                board: ['Qh', 'Jh', '2s'],
                opponentType: 'tight-aggressive',
                hasFlop: true
            };

            analyzer.analyzeStreet(streetState);
            const history = analyzer.getHandHistory();

            expect(history).toHaveLength(1);
            expect(history[0]).toHaveProperty('street', 'flop');
            expect(history[0]).toHaveProperty('action');
            expect(history[0]).toHaveProperty('explanation');
            expect(history[0]).toHaveProperty('rake');
            expect(history[0]).toHaveProperty('timestamp');
        });
    });
}); 