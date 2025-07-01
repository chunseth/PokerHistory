const { calculateEVIfOpponentFolds } = require('../EV_Calculation/MidEV/Step14/step14a');

describe('Step 14a – calculateEVIfOpponentFolds', () => {
  test('Zero pot returns 0 EV', () => {
    const { ev } = calculateEVIfOpponentFolds({ potBeforeAction: 0 });
    expect(ev).toBe(0);
  });

  test('Positive pot returns same EV when no rake', () => {
    const { ev } = calculateEVIfOpponentFolds({ potBeforeAction: 100 });
    expect(ev).toBe(100);
  });

  test('Rake applied with cap', () => {
    const { ev, details } = calculateEVIfOpponentFolds({ potBeforeAction: 200, rakePercent: 0.05, rakeCap: 5 });
    expect(details.rakeCharged).toBe(5); // capped
    expect(ev).toBe(195);
  });
}); 