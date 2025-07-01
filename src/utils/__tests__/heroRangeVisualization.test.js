const {
  extractPostflopActions,
  getBoardCardsAtAction,
} = require('../extractPostflopActions');

const {
  getHeroRangeAtActionIndex,
  formatHeroRangeWithProbabilities,
} = require('../heroRange');

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

// Sample hand JSON (same as villainRangeVisualization.test.js)
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

test('Hero range probabilities by street', () => {
  const postflopActions = extractPostflopActions(hand);

  // Identify hero
  const heroId = hand.players.find(p => p.position === hand.heroPosition).id;

  // Context for hero range analysis
  const context = {
    position: 'cutoff', // Hero is in cutoff position
    betSize: 6, // Average bet size
    potSize: 12, // Average pot size
    stackDepth: 100, // Stack depth
    gameType: 'cash'
  };

  // Helper: get last action index for hero on a given street
  function getLastHeroActionIndexOnStreet(actions, heroId, street) {
    let idx = -1;
    actions.forEach((a, i) => {
      if (a.playerId === heroId && a.street === street) idx = i;
    });
    return idx;
  }

  const streets = ['flop', 'turn', 'river'];
  const heroRangesByStreet = {};

  streets.forEach(street => {
    const idx = getLastHeroActionIndexOnStreet(postflopActions, heroId, street);
    if (idx !== -1) {
      heroRangesByStreet[street] = getHeroRangeAtActionIndex(
        hand,
        postflopActions,
        heroId,
        idx,
        context
      );
    }
  });

  // Output probabilities for each street
  streets.forEach(street => {
    const rangeWithProbs = formatHeroRangeWithProbabilities(heroRangesByStreet[street] || []);
    
    console.log(`=== Hero Range Probabilities After Last ${street.charAt(0).toUpperCase() + street.slice(1)} Action ===`);
    console.log(`Board: ${getBoardCardsAtAction(hand, { street }).join(' ')}`);
    console.log(`Hero's actual hand: ${hand.heroHoleCards.join(' ')}`);
    console.log(`Total hands in range: ${heroRangesByStreet[street]?.length || 0}`);
    
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
    
    // Check if hero's actual hand is in the range
    const heroHandType = comboToHandType(hand.heroHoleCards);
    const heroHandInRange = rangeWithProbs.find(h => h.handType === heroHandType);
    if (heroHandInRange) {
      console.log(`\nHero's actual hand (${heroHandType}) probability: ${heroHandInRange.probability}%`);
    } else {
      console.log(`\nHero's actual hand (${heroHandType}) not found in range!`);
    }
    
    // Verify total probability sums to 100%
    const totalProbability = rangeWithProbs.reduce((sum, { probability }) => sum + probability, 0);
    console.log(`Total probability: ${totalProbability.toFixed(2)}%`);
    
    // Basic assertion: total probability should be close to 100%
    expect(totalProbability).toBeGreaterThan(99.5);
    expect(totalProbability).toBeLessThan(100.5);
  });
});

test('Hero range evolution throughout the hand', () => {
  const postflopActions = extractPostflopActions(hand);
  const heroId = hand.players.find(p => p.position === hand.heroPosition).id;
  
  const context = {
    position: 'cutoff',
    betSize: 6,
    potSize: 12,
    stackDepth: 100,
    gameType: 'cash'
  };

  console.log(`\n=== Hero Range Evolution Throughout Hand ===`);
  console.log(`Hero's actual hand: ${hand.heroHoleCards.join(' ')}`);
  console.log(`Hero ID: ${heroId}`);

  // Track range at each hero action
  let currentRange = null;
  let actionCount = 0;

  postflopActions.forEach((action, idx) => {
    if (action.playerId === heroId) {
      actionCount++;
      currentRange = getHeroRangeAtActionIndex(hand, postflopActions, heroId, idx, context);
      const rangeWithProbs = formatHeroRangeWithProbabilities(currentRange);
      
      console.log(`\n--- Action ${actionCount}: ${action.action.toUpperCase()} on ${action.street} ---`);
      console.log(`Board: ${getBoardCardsAtAction(hand, action).join(' ')}`);
      console.log(`Action: ${action.action} ${action.amount > 0 ? `($${action.amount})` : ''}`);
      console.log(`Range size: ${currentRange.length} hands`);
      
      // Show top 10 hands
      console.log(`Top 10 hands:`);
      rangeWithProbs.slice(0, 10).forEach((hand, i) => {
        console.log(`  ${i + 1}. ${hand.handType}: ${hand.probability}%`);
      });
      
      // Check hero's actual hand
      const heroHandType = comboToHandType(hand.heroHoleCards);
      const heroHandInRange = rangeWithProbs.find(h => h.handType === heroHandType);
      if (heroHandInRange) {
        console.log(`Hero's hand (${heroHandType}): ${heroHandInRange.probability}%`);
      } else {
        console.log(`Hero's hand (${heroHandType}): NOT IN RANGE!`);
      }
    }
  });
});

test('Hero range comparison: preflop vs postflop', () => {
  const postflopActions = extractPostflopActions(hand);
  const heroId = hand.players.find(p => p.position === hand.heroPosition).id;
  
  const context = {
    position: 'cutoff',
    betSize: 6,
    potSize: 12,
    stackDepth: 100,
    gameType: 'cash'
  };

  // Get preflop range (before any postflop actions)
  const preflopRange = getHeroRangeAtActionIndex(hand, postflopActions, heroId, -1, context);
  const preflopProbs = formatHeroRangeWithProbabilities(preflopRange);

  // Get final range (after all actions)
  const finalRange = getHeroRangeAtActionIndex(hand, postflopActions, heroId, postflopActions.length - 1, context);
  const finalProbs = formatHeroRangeWithProbabilities(finalRange);

  console.log(`\n=== Hero Range Comparison: Preflop vs Final ===`);
  console.log(`Hero's actual hand: ${hand.heroHoleCards.join(' ')}`);
  
  console.log(`\nPreflop Range (${preflopRange.length} hands):`);
  console.table(preflopProbs.slice(0, 15));
  
  console.log(`\nFinal Range (${finalRange.length} hands):`);
  console.table(finalProbs.slice(0, 15));
  
  // Compare hero's hand probability
  const heroHandType = comboToHandType(hand.heroHoleCards);
  const preflopHeroProb = preflopProbs.find(h => h.handType === heroHandType)?.probability || 0;
  const finalHeroProb = finalProbs.find(h => h.handType === heroHandType)?.probability || 0;
  
  console.log(`\nHero's hand (${heroHandType}) probability change:`);
  console.log(`  Preflop: ${preflopHeroProb}%`);
  console.log(`  Final: ${finalHeroProb}%`);
  console.log(`  Change: ${(finalHeroProb - preflopHeroProb).toFixed(2)}%`);
  
  // Assertions
  expect(preflopRange.length).toBeGreaterThan(0);
  expect(finalRange.length).toBeGreaterThan(0);
  expect(preflopProbs.reduce((sum, { probability }) => sum + probability, 0)).toBeGreaterThan(99.5);
  expect(finalProbs.reduce((sum, { probability }) => sum + probability, 0)).toBeGreaterThan(99.5);
}); 