const {
  getHandStrengthCategory,
  getDrawTypes,
} = require('../opponentRange');

test('Debug hand strength categories on turn/river', () => {
  const board = ['2h', '7d', 'Jc', 'Ts', '9s']; // Full board from your sample
  const turnBoard = ['2h', '7d', 'Jc', 'Ts']; // Turn board
  
  // Test some of the trash hands that are showing up (with proper suits)
  const trashHands = [
    ['4c', '3s'], // 43o
    ['5c', '3s'], // 53o  
    ['6c', '3s'], // 63o
    ['Qc', '3s'], // Q3o - fixed
  ];
  
  // Test some hands that should be strong (with proper suits)
  const strongHands = [
    ['Qh', 'Jd'], // QJ (two pair) - fixed
    ['Th', '9c'], // T9 (two pair) - fixed
    ['8c', '6d'], // 86 (straight) - fixed
    ['Js', 'Jh'], // JJ (set) - fixed
  ];
  
  console.log('=== TURN BOARD ===');
  [...trashHands, ...strongHands].forEach(hand => {
    const category = getHandStrengthCategory(hand, turnBoard);
    const draws = getDrawTypes(hand, turnBoard);
    console.log(`${hand[0]}${hand[1]}: category="${category}", draws=[${draws.join(',')}]`);
  });
  
  console.log('=== RIVER BOARD ===');
  [...trashHands, ...strongHands].forEach(hand => {
    const category = getHandStrengthCategory(hand, board);
    const draws = getDrawTypes(hand, board);
    console.log(`${hand[0]}${hand[1]}: category="${category}", draws=[${draws.join(',')}]`);
  });
}); 