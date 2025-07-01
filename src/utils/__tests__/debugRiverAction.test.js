const {
  extractPostflopActions,
  getBoardCardsAtAction,
} = require('../extractPostflopActions');

const {
  getOpponentRangeAtActionIndex,
  getDeadCards,
  generateAllCombos,
  initializePreflopRange,
  filterImpossibleCombos,
  updateRangeForAction,
  normalizeAndPruneRange,
} = require('../opponentRange');

// Sample hand JSON (same as before)
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

test('Debug river action specifically', () => {
  const postflopActions = extractPostflopActions(hand);
  const villainId = "p2";
  
  // Find the river action
  const riverActionIdx = postflopActions.findIndex(a => a.playerId === villainId && a.street === 'river');
  console.log('River action index:', riverActionIdx);
  
  if (riverActionIdx !== -1) {
    const riverAction = postflopActions[riverActionIdx];
    console.log('River action:', riverAction);
    
    // Get range before river action
    const rangeBeforeRiver = getOpponentRangeAtActionIndex(hand, postflopActions, villainId, riverActionIdx - 1);
    console.log('Range before river action:', rangeBeforeRiver.length, 'combos');
    console.log('Total weight before river:', rangeBeforeRiver.reduce((sum, {weight}) => sum + weight, 0));
    
    // Process river action manually
    const dead = getDeadCards(hand, riverAction);
    console.log('Dead cards for river:', dead);
    
    let currentRange = filterImpossibleCombos(rangeBeforeRiver, dead);
    console.log('After filtering impossible combos:', currentRange.length);
    
    const board = getBoardCardsAtAction(hand, riverAction);
    console.log('Board at river:', board);
    
    currentRange = updateRangeForAction(currentRange, riverAction.action, board);
    console.log('After updating for fold action:', currentRange.length);
    console.log('Total weight after fold:', currentRange.reduce((sum, {weight}) => sum + weight, 0));
    
    currentRange = normalizeAndPruneRange(currentRange);
    console.log('After normalize/prune:', currentRange.length);
    console.log('Total weight after normalize:', currentRange.reduce((sum, {weight}) => sum + weight, 0));
  }
}); 