const { estimateEquityVsRaisingRange } = require('../EV_Calculation/MidEV/Step13/step13a');

/**
 * Deterministic river scenarios to ensure Step 13 wrapper works.
 */

describe('Step 13a – estimateEquityVsRaisingRange', () => {
  test('Hero crushed by villain set → equity 0', () => {
    const board = ['As', 'Kh', 'Qc', '2d', '3h'];
    const heroRange = [{ combo: ['Td', '9d'], weight: 1 }]; // no pair
    const raiseRange = [{ combo: ['Ad', 'Ac'], weight: 1 }]; // top set

    const { equity } = estimateEquityVsRaisingRange({ board, heroRange, raiseRange });
    expect(equity).toBe(0);
  });

  test('Hero vs identical hand → equity 0.5', () => {
    const board = ['2s', '2h', '2d', '2c', '5s'];
    const heroRange = [{ combo: ['As', 'Ks'], weight: 1 }];
    const raiseRange = [{ combo: ['Ah', 'Kh'], weight: 1 }];

    const { equity } = estimateEquityVsRaisingRange({ board, heroRange, raiseRange });
    expect(equity).toBe(0.5);
  });
}); 