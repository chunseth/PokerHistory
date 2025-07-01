const { calculateEVIfOpponentCalls } = require('../EV_Calculation/MidEV/Step15/step15a');

describe('Step 15a – calculateEVIfOpponentCalls', () => {
  test('Hero always wins (equity 1) without rake', () => {
    const res = calculateEVIfOpponentCalls({ potBeforeAction: 100, betSize: 50, equity: 1 });
    // pot after = 200, hero invests 50, net profit should be 150
    expect(res.ev).toBe(150);
  });

  test('Hero always loses (equity 0)', () => {
    const res = calculateEVIfOpponentCalls({ potBeforeAction: 100, betSize: 50, equity: 0 });
    // hero loses his bet
    expect(res.ev).toBe(-50);
  });

  test('Equity 0.5 returns 50 EV', () => {
    const res = calculateEVIfOpponentCalls({ potBeforeAction: 100, betSize: 50, equity: 0.5 });
    expect(res.ev).toBe(50);
  });

  test('Rake reduces EV proportionally', () => {
    const res = calculateEVIfOpponentCalls({ potBeforeAction: 100, betSize: 50, equity: 1, rakePercent: 0.05 });
    // potAfter = 200, rake 10, hero pays full rake since equity 1
    expect(res.ev).toBe(140);
  });
}); 