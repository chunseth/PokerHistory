const { classifyAction } = require('../EV_Calculation/MidEV/Step21/step21a');

describe('Step 21a – classifyAction', () => {
  test('Hero best action → +EV', () => {
    const res = classifyAction({ heroEV: 1.5, bestEV: 1.5 });
    expect(res.classification).toBe('+EV');
    expect(res.delta).toBe(0);
  });

  test('Hero small mistake within threshold → +EV', () => {
    const res = classifyAction({ heroEV: 1.45, bestEV: 1.5, threshold: 0.1 });
    expect(res.classification).toBe('+EV');
  });

  test('Hero big mistake → -EV', () => {
    const res = classifyAction({ heroEV: 1.0, bestEV: 1.5, threshold: 0.1 });
    expect(res.classification).toBe('-EV');
    expect(res.delta).toBeCloseTo(0.5, 3);
  });
}); 