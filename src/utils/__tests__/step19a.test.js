const { compareActions } = require('../EV_Calculation/MidEV/Step19/step19a');

describe('Step 19a – compareActions', () => {
  const candidates = [
    { label: 'bet 2/3', ev: 1.2 },
    { label: 'check', ev: 1.4 },
    { label: 'all-in', ev: 0.9 }
  ];

  test('Returns best and delta correctly when hero not best', () => {
    const { best, hero, delta } = compareActions({ actualIndex: 0, candidates });
    expect(best.label).toBe('check');
    expect(hero.label).toBe('bet 2/3');
    expect(delta).toBeCloseTo(0.2, 3);
  });

  test('Delta is zero when hero action is best', () => {
    const { delta } = compareActions({ actualIndex: 1, candidates });
    expect(delta).toBe(0);
  });
}); 