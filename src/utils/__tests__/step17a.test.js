const { weightOutcomeEVs } = require('../EV_Calculation/MidEV/Step17/step17a');

describe('Step 17a – weightOutcomeEVs', () => {
  test('Probabilities already sum to 1', () => {
    const res = weightOutcomeEVs({ evFold: 50, evCall: 30, evRaise: -20, probabilities: { fold: 0.4, call: 0.4, raise: 0.2 } });
    expect(res.totalEV).toBeCloseTo(50*0.4 + 30*0.4 -20*0.2, 3);
    expect(res.sanity.probSum).toBe(1);
  });

  test('Probabilities auto-normalise', () => {
    const res = weightOutcomeEVs({ evFold: 100, evCall: 0, evRaise: 0, probabilities: { fold: 2, call: 1, raise: 1 } });
    // After normalisation fold=0.5 call=0.25 raise=0.25 -> total EV 50
    expect(res.totalEV).toBeCloseTo(50, 2);
  });
}); 