const { estimateEquityVsCallingRange } = require('../EV_Calculation/MidEV/Step12/step12a');

/**
 * Simple deterministic river scenarios to validate Step 12 logic.
 */

describe('Step 12a – estimateEquityVsCallingRange', () => {
  test('Hero nuts vs. dominated hand on the river → equity 1', () => {
    const board = ['2c', '3d', '4h', '5s', '9c'];
    const heroRange = [{ combo: ['As', 'Ad'], weight: 1 }];
    const callRange = [{ combo: ['Ks', 'Kd'], weight: 1 }];

    const { equity } = estimateEquityVsCallingRange({ board, heroRange, callRange });
    expect(equity).toBe(1);
  });

  test('Exact tie on the river → equity 0.5', () => {
    const board = ['2c', '3d', '4h', '5s', '6c']; // board straight 2-6
    const heroRange = [{ combo: ['As', 'Ah'], weight: 1 }]; // plays the board
    const callRange = [{ combo: ['Kd', 'Kh'], weight: 1 }];

    const { equity } = estimateEquityVsCallingRange({ board, heroRange, callRange });
    expect(equity).toBe(0.5);
  });

  test('Missing inputs → returns neutral equity 0.5', () => {
    const { equity } = estimateEquityVsCallingRange();
    expect(equity).toBe(0.5);
  });
}); 