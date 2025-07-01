const {
  extractPostflopActions,
  getActionsByStreet,
  getBoardCardsAtAction,
  getHeroHoleCards,
} = require('../extractPostflopActions');

// Sample hand JSON (same as used in villain range visualization)
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

describe('extractPostflopActions', () => {
  test('should extract only postflop actions', () => {
    const postflopActions = extractPostflopActions(hand);
    
    console.log('All postflop actions:');
    console.table(postflopActions);
    
    // Should have 6 postflop actions (2 flop + 2 turn + 2 river)
    expect(postflopActions).toHaveLength(6);
    
    // Should not contain any preflop actions
    const preflopActions = postflopActions.filter(action => action.street === 'preflop');
    expect(preflopActions).toHaveLength(0);
    
    // Should contain flop, turn, and river actions
    const flopActions = postflopActions.filter(action => action.street === 'flop');
    const turnActions = postflopActions.filter(action => action.street === 'turn');
    const riverActions = postflopActions.filter(action => action.street === 'river');
    
    expect(flopActions).toHaveLength(2);
    expect(turnActions).toHaveLength(2);
    expect(riverActions).toHaveLength(2);
  });

  test('should correctly structure action objects', () => {
    const postflopActions = extractPostflopActions(hand);
    
    // Check that each action has the expected properties
    postflopActions.forEach(action => {
      expect(action).toHaveProperty('playerId');
      expect(action).toHaveProperty('action');
      expect(action).toHaveProperty('amount');
      expect(action).toHaveProperty('street');
      expect(action).toHaveProperty('timestamp');
    });
    
    // Check specific actions
    const firstFlopAction = postflopActions.find(a => a.street === 'flop' && a.playerId === 'p1');
    expect(firstFlopAction).toEqual({
      playerId: 'p1',
      action: 'bet',
      amount: 6,
      street: 'flop',
      timestamp: '2024-06-01T12:00:08Z'
    });
  });

  test('should filter actions by street correctly', () => {
    const postflopActions = extractPostflopActions(hand);
    
    const flopActions = getActionsByStreet(postflopActions, 'flop');
    const turnActions = getActionsByStreet(postflopActions, 'turn');
    const riverActions = getActionsByStreet(postflopActions, 'river');
    
    console.log('Flop actions:');
    console.table(flopActions);
    console.log('Turn actions:');
    console.table(turnActions);
    console.log('River actions:');
    console.table(riverActions);
    
    expect(flopActions).toHaveLength(2);
    expect(turnActions).toHaveLength(2);
    expect(riverActions).toHaveLength(2);
  });

  test('should get correct board cards at each action', () => {
    const postflopActions = extractPostflopActions(hand);
    
    // Test flop action
    const flopAction = postflopActions.find(a => a.street === 'flop');
    const flopBoard = getBoardCardsAtAction(hand, flopAction);
    expect(flopBoard).toEqual(['2h', '7d', 'Jc']);
    
    // Test turn action
    const turnAction = postflopActions.find(a => a.street === 'turn');
    const turnBoard = getBoardCardsAtAction(hand, turnAction);
    expect(turnBoard).toEqual(['2h', '7d', 'Jc', 'Ts']);
    
    // Test river action
    const riverAction = postflopActions.find(a => a.street === 'river');
    const riverBoard = getBoardCardsAtAction(hand, riverAction);
    expect(riverBoard).toEqual(['2h', '7d', 'Jc', 'Ts', '9s']);
  });

  test('should get hero hole cards correctly', () => {
    const heroCards = getHeroHoleCards(hand);
    expect(heroCards).toEqual(['Ah', 'Kd']);
  });

  test('should handle edge cases', () => {
    // Test with null hand
    expect(extractPostflopActions(null)).toEqual([]);
    
    // Test with hand without bettingActions
    expect(extractPostflopActions({})).toEqual([]);
    
    // Test with hand with empty bettingActions
    expect(extractPostflopActions({ bettingActions: [] })).toEqual([]);
  });
}); 