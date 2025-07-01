const { determineHighestEVAction } = require('../EV_Calculation/MidEV/Step20/step20a');

describe('Step 20a – determineHighestEVAction', () => {
  test('Identifies single best action', () => {
    const cand = [
      { label: 'bet', ev: 1 },
      { label: 'check', ev: 0.5 },
      { label: 'all-in', ev: 0.8 }
    ];
    const res = determineHighestEVAction(cand);
    expect(res.best.label).toBe('bet');
    expect(res.ties.length).toBe(0);
  });

  test('Handles ties', () => {
    const cand = [
      { label: 'bet', ev: 1 },
      { label: 'check', ev: 1 },
      { label: 'fold', ev: -0.1 }
    ];
    const { best, ties } = determineHighestEVAction(cand);
    expect(best.ev).toBe(1);
    expect(ties.length).toBe(1);
    expect(ties[0].label).toBe('check');
  });
}); 