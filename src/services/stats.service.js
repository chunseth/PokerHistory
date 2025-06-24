import apiService from './api.service';

class StatsService {
    async getPlayerStats(username) {
        try {
            const response = await apiService.getHands({ username });
            return response;
        } catch (error) {
            console.error('Error fetching player stats:', error);
            throw error;
        }
    }

    calculateHandStrength(holeCards) {
        // Simple hand strength calculation based on card values
        const [card1, card2] = holeCards;
        const values = {
            'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10,
            '9': 9, '8': 8, '7': 7, '6': 6, '5': 5,
            '4': 4, '3': 3, '2': 2
        };

        const value1 = values[card1[0]];
        const value2 = values[card2[0]];
        const isSuited = card1[1] === card2[1];
        const isPair = value1 === value2;

        if (isPair) {
            if (value1 >= 10) return 'premium';
            if (value1 >= 7) return 'strong';
            return 'medium';
        }

        if (value1 >= 12 && value2 >= 12) return 'premium';
        if (value1 >= 10 && value2 >= 10) return 'strong';
        if (value1 >= 8 && value2 >= 8) return 'medium';
        return 'weak';
    }

    // Helper method to safely get stack value
    getStackValue(stacks, position) {
        if (!stacks) return 0;
        // Handle both Map and object formats
        if (stacks instanceof Map) {
            return stacks.get(position) || 0;
        }
        return stacks[position] || 0;
    }

    // Helper method to check if hero won the hand
    didHeroWin(hand) {
        if (!hand) {
            console.log('No hand data provided');
            return false;
        }
        
        console.log(`\nChecking win for hand ${hand.id}:`);
        console.log(`Hero position: ${hand.heroPosition}`);
        console.log('Winners:', hand.winners);
        console.log('Summary:', hand.summary);
        console.log('Uncalled bet:', hand.uncalledBet);
        
        // Check winners array first using username
        if (hand.winners?.some(winner => winner.username === hand.username)) {
            console.log('Win detected: Found in winners array');
            return true;
        }

        // Check if hero won without showing (from summary)
        if (hand.summary) {
            const heroSummary = hand.summary.find(entry => 
                entry.seat === hand.heroPosition && 
                (entry.result?.includes('won') || entry.result?.includes('collected'))
            );
            if (heroSummary) {
                console.log('Win detected: Found in summary', heroSummary);
                return true;
            }
        }

        // Check if hero collected the pot
        if (hand.uncalledBet?.player === hand.username) {
            console.log('Win detected: Collected uncalled bet');
            return true;
        }

        // Check if hero's final stack is greater than starting stack
        const startingStack = this.getStackValue(hand.playerStacks, hand.heroPosition);
        const finalStack = this.getStackValue(hand.finalStacks, hand.heroPosition);
        if (finalStack > startingStack) {
            console.log('Win detected: Stack increased');
            return true;
        }

        console.log('No win detected for this hand');
        return false;
    }

    calculatePositionStats(hands) {
        const positionStats = {};
        
        hands.forEach(hand => {
            const position = hand.heroPosition;
            if (!positionStats[position]) {
                positionStats[position] = {
                    hands: 0,
                    wins: 0,
                    profit: 0,
                    stackChange: 0
                };
            }

            positionStats[position].hands++;
            
            // Check if hero won using the new helper method
            if (this.didHeroWin(hand)) {
                positionStats[position].wins++;
            }

            // Calculate profit from finalStacks
            const startingStack = this.getStackValue(hand.playerStacks, hand.heroPosition);
            const finalStack = this.getStackValue(hand.finalStacks, hand.heroPosition);
            const stackChange = finalStack - startingStack;
            positionStats[position].stackChange += stackChange;
            positionStats[position].profit += stackChange;
        });

        // Calculate win rates and average stack change
        Object.keys(positionStats).forEach(position => {
            const stats = positionStats[position];
            stats.winRate = stats.hands > 0 ? stats.wins / stats.hands : 0;
            stats.avgStackChange = stats.hands > 0 ? stats.stackChange / stats.hands : 0;
        });

        return positionStats;
    }

    calculateStreetStats(hands) {
        const streetStats = {
            preflop: { win: 0, loss: 0, potSize: 0 },
            flop: { win: 0, loss: 0, potSize: 0 },
            turn: { win: 0, loss: 0, potSize: 0 },
            river: { win: 0, loss: 0, potSize: 0 }
        };

        hands.forEach(hand => {
            // Track pot sizes
            if (hand.potSizes) {
                Object.keys(hand.potSizes).forEach(street => {
                    if (streetStats[street]) {
                        streetStats[street].potSize += hand.potSizes[street] || 0;
                    }
                });
            }

            // Track wins/losses based on showdown
            if (hand.showdown) {
                const heroWon = hand.winners.some(winner => winner.playerIndex === hand.heroPosition);
                const street = hand.currentStreet;
                if (streetStats[street]) {
                    if (heroWon) {
                        streetStats[street].win++;
                    } else {
                        streetStats[street].loss++;
                    }
                }
            }
        });

        // Calculate averages
        Object.keys(streetStats).forEach(street => {
            const stats = streetStats[street];
            stats.avgPotSize = stats.win + stats.loss > 0 ? 
                stats.potSize / (stats.win + stats.loss) : 0;
        });

        return streetStats;
    }

    calculateHandStrengthStats(hands) {
        const handStrengthStats = {
            premium: { count: 0, win: 0, profit: 0 },
            strong: { count: 0, win: 0, profit: 0 },
            medium: { count: 0, win: 0, profit: 0 },
            weak: { count: 0, win: 0, profit: 0 }
        };

        hands.forEach(hand => {
            const strength = this.calculateHandStrength(hand.heroHoleCards);
            handStrengthStats[strength].count++;
            
            // Check if hero won using the new helper method
            if (this.didHeroWin(hand)) {
                handStrengthStats[strength].win++;
            }

            // Calculate profit
            const startingStack = this.getStackValue(hand.playerStacks, hand.heroPosition);
            const finalStack = this.getStackValue(hand.finalStacks, hand.heroPosition);
            const profit = finalStack - startingStack;
            handStrengthStats[strength].profit += profit;
        });

        // Calculate win rates and average profit
        Object.keys(handStrengthStats).forEach(strength => {
            const stats = handStrengthStats[strength];
            stats.winRate = stats.count > 0 ? stats.win / stats.count : 0;
            stats.avgProfit = stats.count > 0 ? stats.profit / stats.count : 0;
        });

        return handStrengthStats;
    }

    calculatePreflopStats(hands) {
        let vpip = 0;
        let pfr = 0;
        let threeBet = 0;
        let totalHands = hands.length;

        hands.forEach(hand => {
            // Check for VPIP (Voluntarily Put money In Pot)
            const preflopActions = hand.bettingActions.filter(action => 
                action.street === 'preflop' && 
                action.playerIndex === hand.heroPosition
            );
            
            if (preflopActions.some(action => 
                ['call', 'raise', 'bet'].includes(action.action) && 
                action.amount > 0
            )) {
                vpip++;
            }

            // Check for PFR (Pre-Flop Raise)
            if (preflopActions.some(action => 
                action.action === 'raise' && 
                action.amount > 0
            )) {
                pfr++;
            }

            // Check for 3-bet
            const preflopRaises = hand.bettingActions.filter(action => 
                action.street === 'preflop' && 
                action.action === 'raise'
            );
            if (preflopRaises.length >= 2 && 
                preflopRaises[preflopRaises.length - 1].playerIndex === hand.heroPosition) {
                threeBet++;
            }
        });

        return {
            vpip: totalHands > 0 ? vpip / totalHands : 0,
            pfr: totalHands > 0 ? pfr / totalHands : 0,
            threeBet: totalHands > 0 ? threeBet / totalHands : 0
        };
    }

    async calculateAllStats(username) {
        try {
            const hands = await apiService.getHands({ username });
            const totalHands = hands.length;
            
            console.log(`\nCalculating stats for ${username}:`);
            console.log(`Total hands: ${totalHands}`);
            
            // Calculate total profit from stack changes
            const totalProfit = hands.reduce((sum, hand) => {
                const startingStack = this.getStackValue(hand.playerStacks, hand.heroPosition);
                const finalStack = this.getStackValue(hand.finalStacks, hand.heroPosition);
                return sum + (finalStack - startingStack);
            }, 0);

            // Calculate win rate using the didHeroWin helper method
            const totalWins = hands.filter(hand => this.didHeroWin(hand)).length;
            const winRate = totalHands > 0 ? totalWins / totalHands : 0;

            console.log(`\nWin rate calculation:`);
            console.log(`Total wins: ${totalWins}`);
            console.log(`Win rate: ${(winRate * 100).toFixed(1)}%`);
            console.log(`Total profit: ${totalProfit.toFixed(2)} BB`);

            // Calculate position stats
            const positionStats = this.calculatePositionStats(hands);
            console.log('\nPosition stats:', positionStats);

            // Calculate street stats
            const streetStats = this.calculateStreetStats(hands);
            console.log('\nStreet stats:', streetStats);

            // Calculate hand strength stats
            const handStrengthStats = this.calculateHandStrengthStats(hands);
            console.log('\nHand strength stats:', handStrengthStats);

            // Calculate preflop stats
            const { vpip, pfr, threeBet } = this.calculatePreflopStats(hands);
            console.log('\nPreflop stats:', { vpip, pfr, threeBet });

            return {
                totalHands,
                totalProfit,
                winRate,
                vpip,
                pfr,
                threeBet,
                positionStats,
                streetStats,
                handStrength: handStrengthStats
            };
        } catch (error) {
            console.error('Error calculating stats:', error);
            throw error;
        }
    }
}

export default new StatsService(); 