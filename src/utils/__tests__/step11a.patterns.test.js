const {
    checkIfCheckRaise,
    checkIfDonkBet
} = require('../EV_Calculation/Step11/step11a');

describe('Step 11a: Special Pattern Detection Tests', () => {
    describe('Check-Raise Detection', () => {
        test('should correctly identify a check-raise pattern', () => {
            const checkRaiseHand = {
                id: 'test-hand-1',
                players: [
                    { id: 'PlayerA', position: 'BB' },
                    { id: 'PlayerB', position: 'BTN' }
                ],
                bettingActions: [
                    // Preflop
                    { playerId: 'PlayerA', action: 'post', amount: 1, position: 'BB', street: 'preflop' },
                    { playerId: 'PlayerB', action: 'raise', amount: 3, position: 'BTN', street: 'preflop' },
                    { playerId: 'PlayerA', action: 'call', amount: 2, position: 'BB', street: 'preflop' },
                    // Flop
                    { playerId: 'PlayerA', action: 'check', amount: 0, position: 'BB', street: 'flop' },
                    { playerId: 'PlayerB', action: 'bet', amount: 5, position: 'BTN', street: 'flop' },
                    { playerId: 'PlayerA', action: 'raise', amount: 15, position: 'BB', street: 'flop' }
                ]
            };

            // Test the check-raise action (last action in the sequence)
            const isCheckRaise = checkIfCheckRaise(
                checkRaiseHand.bettingActions[5], // The raise action
                checkRaiseHand,
                checkRaiseHand.bettingActions,
                5 // Index of the raise action
            );

            expect(isCheckRaise).toBe(true);

            // Test that other actions in the hand are not check-raises
            for (let i = 0; i < 5; i++) {
                const notCheckRaise = checkIfCheckRaise(
                    checkRaiseHand.bettingActions[i],
                    checkRaiseHand,
                    checkRaiseHand.bettingActions,
                    i
                );
                expect(notCheckRaise).toBe(false);
            }
        });
    });

    describe('Donk Bet Detection', () => {
        test('should correctly identify a donk bet pattern', () => {
            const donkBetHand = {
                id: 'test-hand-2',
                players: [
                    { id: 'PlayerA', position: 'BTN' },
                    { id: 'PlayerB', position: 'BB' }
                ],
                bettingActions: [
                    // Preflop
                    { playerId: 'PlayerB', action: 'post', amount: 1, position: 'BB', street: 'preflop' },
                    { playerId: 'PlayerA', action: 'raise', amount: 3, position: 'BTN', street: 'preflop' },
                    { playerId: 'PlayerB', action: 'call', amount: 2, position: 'BB', street: 'preflop' },
                    // Flop
                    { playerId: 'PlayerB', action: 'bet', amount: 5, position: 'BB', street: 'flop' }
                ]
            };

            // Test the donk bet action
            const isDonkBet = checkIfDonkBet(
                donkBetHand.bettingActions[3], // The bet action
                donkBetHand,
                donkBetHand.bettingActions,
                3 // Index of the bet action
            );

            expect(isDonkBet).toBe(true);

            // Test that other actions in the hand are not donk bets
            for (let i = 0; i < 3; i++) {
                const notDonkBet = checkIfDonkBet(
                    donkBetHand.bettingActions[i],
                    donkBetHand,
                    donkBetHand.bettingActions,
                    i
                );
                expect(notDonkBet).toBe(false);
            }
        });
    });
}); 