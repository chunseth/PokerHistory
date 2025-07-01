const { calculateEVIfOpponentRaises } = require('../EV_Calculation/MidEV/Step16/step16a');

describe('Step 16a – calculateEVIfOpponentRaises', () => {
  test('Hero folds to raise → EV is -heroBet', () => {
    const res = calculateEVIfOpponentRaises({ potBeforeAction: 100, heroBetSize: 20, villainRaiseSize: 80, heroEquity: 0 });
    expect(res.details.heroChoice).toBe('fold');
    expect(res.ev).toBe(-20);
  });

  test('Hero calls raise with high equity → chooses call', () => {
    const res = calculateEVIfOpponentRaises({ potBeforeAction: 100, heroBetSize: 20, villainRaiseSize: 80, heroEquity: 0.7 });
    expect(res.details.heroChoice).toBe('call');
    // EV_call calculation quick check – should be greater than -20
    expect(res.ev).toBeGreaterThan(-20);
  });
}); 