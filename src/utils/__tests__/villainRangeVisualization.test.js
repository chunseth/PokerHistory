const {
  extractPostflopActions,
  getBoardCardsAtAction,
} = require('../extractPostflopActions');

const {
  getOpponentRangeAtActionIndex,
} = require('../opponentRange');

// Helper: Convert a combo to a hand type string (e.g., "AKs", "QJo", "77")
function comboToHandType([c1, c2]) {
  const rankOrder = '23456789TJQKA';
  const r1 = c1[0], r2 = c2[0];
  const s1 = c1[1], s2 = c2[1];
  let high = r1, low = r2;
  if (rankOrder.indexOf(r2) > rankOrder.indexOf(r1)) {
    high = r2; low = r1;
  }
  if (high === low) return high + high; // Pair
  if (s1 === s2) return high + low + 's'; // Suited
  return high + low + 'o'; // Offsuit
}

// Format range for visualization with probabilities: { handType: probability }
function formatRangeWithProbabilities(range) {
  const handTypeWeights = {};
  range.forEach(({ hand, weight }) => {
    const handType = comboToHandType(hand);
    handTypeWeights[handType] = (handTypeWeights[handType] || 0) + weight;
  });
  
  // Convert weights to probabilities (weights already sum to 1, so they are probabilities)
  return Object.entries(handTypeWeights)
    .sort((a, b) => b[1] - a[1])
    .map(([handType, probability]) => ({ 
      handType, 
      probability: +(probability * 100).toFixed(2) // Convert to percentage
    }));
}

// Sample hand JSON (from 9.6a)
const hand = {
  "id": "hand123",
  "sessionId": "session1",
  "timestamp": "2024-06-01T12:00:00Z",
  "gameType": "cash",
  "numPlayers": 6,
  "buttonPosition": 2,
  "heroPosition": 4,
  "heroStackSize": 100,
  "heroHoleCards": ["Ah", "Kd"],
  "communityCards": {
    "flop": ["2h", "7d", "Jc"],
    "turn": "Ts",
    "river": "9s"
  },
  "players": [
    { "id": "p1", "name": "Hero", "stackSize": 100, "position": 4, "holeCards": ["Ah", "Kd"], "isActive": true },
    { "id": "p2", "name": "Villain", "stackSize": 100, "position": 5, "isActive": true },
    { "id": "p3", "name": "Player3", "stackSize": 100, "position": 0, "isActive": true },
    { "id": "p4", "name": "Player4", "stackSize": 100, "position": 1, "isActive": true },
    { "id": "p5", "name": "Player5", "stackSize": 100, "position": 2, "isActive": true },
    { "id": "p6", "name": "Player6", "stackSize": 100, "position": 3, "isActive": true }
  ],
  "bettingActions": [
    // Preflop
    { "playerId": "p3", "action": "fold", "amount": 0, "street": "preflop", "timestamp": "2024-06-01T12:00:01Z" },
    { "playerId": "p4", "action": "call", "amount": 1, "street": "preflop", "timestamp": "2024-06-01T12:00:02Z" },
    { "playerId": "p5", "action": "fold", "amount": 0, "street": "preflop", "timestamp": "2024-06-01T12:00:03Z" },
    { "playerId": "p6", "action": "fold", "amount": 0, "street": "preflop", "timestamp": "2024-06-01T12:00:04Z" },
    { "playerId": "p1", "action": "raise", "amount": 4, "street": "preflop", "timestamp": "2024-06-01T12:00:05Z" },
    { "playerId": "p2", "action": "call", "amount": 4, "street": "preflop", "timestamp": "2024-06-01T12:00:06Z" },
    { "playerId": "p4", "action": "fold", "amount": 0, "street": "preflop", "timestamp": "2024-06-01T12:00:07Z" },
    // Flop
    { "playerId": "p1", "action": "bet", "amount": 6, "street": "flop", "timestamp": "2024-06-01T12:00:08Z" },
    { "playerId": "p2", "action": "call", "amount": 6, "street": "flop", "timestamp": "2024-06-01T12:00:09Z" },
    // Turn
    { "playerId": "p1", "action": "bet", "amount": 12, "street": "turn", "timestamp": "2024-06-01T12:00:10Z" },
    { "playerId": "p2", "action": "call", "amount": 12, "street": "turn", "timestamp": "2024-06-01T12:00:11Z" },
    // River
    { "playerId": "p1", "action": "bet", "amount": 24, "street": "river", "timestamp": "2024-06-01T12:00:12Z" },
    { "playerId": "p2", "action": "fold", "amount": 0, "street": "river", "timestamp": "2024-06-01T12:00:13Z" }
  ]
};

test('Villain range probabilities by street', () => {
  const postflopActions = extractPostflopActions(hand);

  // Identify villain
  const heroId = hand.players.find(p => p.position === hand.heroPosition).id;
  const villainIds = Array.from(
    new Set(postflopActions.map(a => a.playerId))
  ).filter(id => id !== heroId);
  const villainId = villainIds[0];

  // Helper: get last action index for villain on a given street
  function getLastVillainActionIndexOnStreet(actions, villainId, street) {
    let idx = -1;
    actions.forEach((a, i) => {
      if (a.playerId === villainId && a.street === street) idx = i;
    });
    return idx;
  }

  const streets = ['flop', 'turn', 'river'];
  const villainRangesByStreet = {};

  streets.forEach(street => {
    const idx = getLastVillainActionIndexOnStreet(postflopActions, villainId, street);
    if (idx !== -1) {
      villainRangesByStreet[street] = getOpponentRangeAtActionIndex(
        hand,
        postflopActions,
        villainId,
        idx
      );
    }
  });

  // Output probabilities for each street
  streets.forEach(street => {
    const rangeWithProbs = formatRangeWithProbabilities(villainRangesByStreet[street] || []);
    
    console.log(`=== Villain Range Probabilities After Last ${street.charAt(0).toUpperCase() + street.slice(1)} Action ===`);
    console.log(`Board: ${getBoardCardsAtAction(hand, { street }).join(' ')}`);
    console.log(`Total hands in range: ${villainRangesByStreet[street]?.length || 0}`);
    
    // Show top 20 most likely hands
    console.table(rangeWithProbs.slice(0, 20));
    
    // Show probability ranges
    const highProb = rangeWithProbs.filter(h => h.probability >= 5.0);
    const medProb = rangeWithProbs.filter(h => h.probability >= 1.0 && h.probability < 5.0);
    const lowProb = rangeWithProbs.filter(h => h.probability < 1.0);
    
    console.log(`\nProbability Summary:`);
    console.log(`High probability (≥5%): ${highProb.length} hands`);
    console.log(`Medium probability (1-5%): ${medProb.length} hands`);
    console.log(`Low probability (<1%): ${lowProb.length} hands`);
    
    // Verify total probability sums to 100%
    const totalProbability = rangeWithProbs.reduce((sum, { probability }) => sum + probability, 0);
    console.log(`Total probability: ${totalProbability.toFixed(2)}%`);
    
    // Basic assertion: total probability should be close to 100%
    expect(totalProbability).toBeGreaterThan(99.5);
    expect(totalProbability).toBeLessThan(100.5);
  });
}); 