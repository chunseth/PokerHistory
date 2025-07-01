const { 
    getHeroRangeAfterActions,
    getHeroRangeAtActionIndex,
    formatHeroRangeWithProbabilities,
    getHeroDeadCards,
    generateHeroCombos,
    initializeHeroPreflopRange
} = require('./src/utils/heroRange.js');

const { extractPostflopActions } = require('./src/utils/actionExtractor.js');

/**
 * Test script to visualize hero range at different stages
 */
async function testHeroRangeVisualization() {
    console.log('🎯 HERO RANGE VISUALIZATION TEST\n');
    
    // Sample hand data (you can replace with real database data)
    const sampleHand = {
        players: [
            { playerId: 'player1', position: 1, cards: ['Ah', 'Kh'] },
            { playerId: 'player2', position: 2, cards: ['Qd', 'Jd'] },
            { playerId: 'player3', position: 3, cards: ['Td', '9d'] },
            { playerId: 'player4', position: 4, cards: ['8c', '7c'] }
        ],
        actions: [
            { playerId: 'player1', action: 'fold', amount: 0, street: 'preflop' },
            { playerId: 'player2', action: 'call', amount: 1, street: 'preflop' },
            { playerId: 'player3', action: 'call', amount: 1, street: 'preflop' },
            { playerId: 'player4', action: 'call', amount: 1, street: 'preflop' },
            { playerId: 'player2', action: 'check', amount: 0, street: 'flop' },
            { playerId: 'player3', action: 'bet', amount: 2, street: 'flop' },
            { playerId: 'player4', action: 'call', amount: 2, street: 'flop' },
            { playerId: 'player2', action: 'fold', amount: 0, street: 'flop' },
            { playerId: 'player3', action: 'check', amount: 0, street: 'turn' },
            { playerId: 'player4', action: 'bet', amount: 4, street: 'turn' },
            { playerId: 'player3', action: 'fold', amount: 0, street: 'turn' }
        ],
        board: ['2h', '7d', 'Kh', '9c'],
        pot: 12,
        street: 'turn'
    };

    const heroId = 'player4'; // Let's analyze player4's range
    const context = {
        position: 4,
        betSize: 3,
        potSize: 6,
        stackDepth: 100,
        gameType: 'cash'
    };

    // Extract postflop actions
    const postflopActions = extractPostflopActions(sampleHand.actions);

    console.log('�� TESTING HERO RANGE CONSTRUCTION\n');

    // Test 1: Initial preflop range
    console.log('1️⃣ INITIAL PREFLOP RANGE');
    console.log('=' .repeat(50));
    
    const deadCards = getHeroDeadCards(sampleHand, postflopActions[0]);
    const heroCombos = generateHeroCombos(deadCards);
    const preflopRange = initializeHeroPreflopRange(heroCombos, context);
    const preflopProbs = formatHeroRangeWithProbabilities(preflopRange);
    
    console.log(`Total hands in range: ${preflopRange.length}`);
    console.log(`Dead cards: ${deadCards.join(', ')}`);
    console.log('\nTop 15 hands by probability:');
    console.table(preflopProbs.slice(0, 15));

    // Test 2: Range after flop action
    console.log('\n2️⃣ RANGE AFTER FLOP ACTION');
    console.log('=' .repeat(50));
    
    const flopActionIndex = 6; // After player4 calls the flop bet
    const flopRange = getHeroRangeAtActionIndex(sampleHand, postflopActions, heroId, flopActionIndex, context);
    const flopProbs = formatHeroRangeWithProbabilities(flopRange);
    
    console.log(`Total hands in range: ${flopRange.length}`);
    console.log(`Board at this point: ${sampleHand.board.slice(0, 3).join(', ')}`);
    console.log('\nTop 15 hands by probability:');
    console.table(flopProbs.slice(0, 15));

    // Test 3: Final range after all actions
    console.log('\n3️⃣ FINAL RANGE AFTER ALL ACTIONS');
    console.log('=' .repeat(50));
    
    const finalRange = getHeroRangeAfterActions(sampleHand, postflopActions, heroId, context);
    const finalProbs = formatHeroRangeWithProbabilities(finalRange);
    
    console.log(`Total hands in range: ${finalRange.length}`);
    console.log(`Final board: ${sampleHand.board.join(', ')}`);
    console.log('\nTop 20 hands by probability:');
    console.table(finalProbs.slice(0, 20));

    // Test 4: Range analysis summary
    console.log('\n4️⃣ RANGE ANALYSIS SUMMARY');
    console.log('=' .repeat(50));
    
    const highProb = finalProbs.filter(h => h.probability >= 5.0);
    const medProb = finalProbs.filter(h => h.probability >= 1.0 && h.probability < 5.0);
    const lowProb = finalProbs.filter(h => h.probability < 1.0);
    
    console.log(`High probability hands (≥5%): ${highProb.length}`);
    console.log(`Medium probability hands (1-5%): ${medProb.length}`);
    console.log(`Low probability hands (<1%): ${lowProb.length}`);
    
    console.log('\nHigh probability hands:');
    highProb.forEach(h => console.log(`  ${h.handType}: ${h.probability}%`));
    
    console.log('\nRange strength indicators:');
    const avgProb = finalProbs.reduce((sum, h) => sum + h.probability, 0) / finalProbs.length;
    console.log(`Average hand probability: ${avgProb.toFixed(2)}%`);
    console.log(`Range tightness: ${finalProbs.length < 50 ? 'Tight' : finalProbs.length < 100 ? 'Medium' : 'Loose'}`);

    // Test 5: Compare ranges at different stages
    console.log('\n5️⃣ RANGE EVOLUTION COMPARISON');
    console.log('=' .repeat(50));
    
    const stages = [
        { name: 'Preflop', range: preflopRange },
        { name: 'After Flop', range: flopRange },
        { name: 'Final', range: finalRange }
    ];
    
    console.log('Range size evolution:');
    stages.forEach(stage => {
        const probs = formatHeroRangeWithProbabilities(stage.range);
        const highCount = probs.filter(h => h.probability >= 5.0).length;
        console.log(`  ${stage.name}: ${stage.range.length} total, ${highCount} high-prob hands`);
    });

    // Test 6: Specific hand tracking
    console.log('\n6️⃣ SPECIFIC HAND TRACKING');
    console.log('=' .repeat(50));
    
    const trackedHands = ['AKs', 'QJo', '77', 'T9s', 'A2o'];
    
    trackedHands.forEach(handType => {
        const preflopWeight = preflopProbs.find(h => h.handType === handType)?.probability || 0;
        const flopWeight = flopProbs.find(h => h.handType === handType)?.probability || 0;
        const finalWeight = finalProbs.find(h => h.handType === handType)?.probability || 0;
        
        console.log(`${handType}: ${preflopWeight.toFixed(2)}% → ${flopWeight.toFixed(2)}% → ${finalWeight.toFixed(2)}%`);
    });

    console.log('\n✅ HERO RANGE VISUALIZATION TEST COMPLETE\n');
}

/**
 * Interactive test function for manual testing
 */
function interactiveHeroRangeTest() {
    console.log('�� INTERACTIVE HERO RANGE TEST\n');
    console.log('Enter hand details to test hero range construction:');
    
    // This would integrate with your actual database/input system
    console.log('(This function would prompt for hand data and display results)');
}

// Run the test
if (require.main === module) {
    testHeroRangeVisualization().catch(console.error);
}

module.exports = {
    testHeroRangeVisualization,
    interactiveHeroRangeTest
}; 