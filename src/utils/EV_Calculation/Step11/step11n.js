const { calculateOpponentRangeStrength } = require('./step11c');

/**
 * Step 11n: Adjust for Board Texture
 * Analyzes how different board types affect opponent response frequencies.
 * As per Step11.txt:
 * - Dry boards: More polarized responses
 * - Wet boards: More calling with draws
 * - Paired boards: More cautious responses
 * 
 * @param {Object} hand - The hand object with bettingActions and board
 * @param {Array} actions - Array of all postflop actions
 * @param {number} actionIndex - Index of the current action
 * @param {string} opponentId - The opponent's player ID
 * @param {Object} playerAction - The player's action analysis from step 11a
 * @param {Object} potOdds - Pot odds analysis from step 11b
 * @returns {Object} Board texture adjustment analysis
 */
function adjustForBoardTexture(hand, actions, actionIndex, opponentId, playerAction = {}, potOdds = {}) {
    if (!hand || !hand.board || !Array.isArray(hand.board)) {
        return {
            boardTexture: 'unknown',
            foldAdjustment: 0,
            callAdjustment: 0,
            raiseAdjustment: 0,
            textureFactors: {},
            explanation: 'Missing board data'
        };
    }

    // Get range strength analysis from step 11c
    const rangeStrength = calculateOpponentRangeStrength(hand, actions, opponentId, actionIndex, playerAction, potOdds);

    // Analyze board texture
    const textureAnalysis = analyzeBoardTexture(hand.board, rangeStrength);
    
    // Calculate adjustments based on texture type
    const adjustments = calculateTextureAdjustments(textureAnalysis, playerAction, rangeStrength);
    
    // Apply street-specific adjustments
    const streetAdjustments = applyStreetSpecificAdjustments(textureAnalysis, playerAction);
    
    // Combine all adjustments
    const finalAdjustments = {
        fold: adjustments.fold + streetAdjustments.fold,
        call: adjustments.call + streetAdjustments.call,
        raise: adjustments.raise + streetAdjustments.raise
    };

    // Generate explanation
    const explanation = generateBoardTextureExplanation(textureAnalysis, finalAdjustments, playerAction);

    return {
        boardTexture: textureAnalysis.texture,
        foldAdjustment: finalAdjustments.fold,
        callAdjustment: finalAdjustments.call,
        raiseAdjustment: finalAdjustments.raise,
        textureFactors: textureAnalysis.factors,
        rangeStrength, // Include range strength analysis from step 11c
        explanation
    };
}

/**
 * Analyze the board texture and classify it
 */
function analyzeBoardTexture(board, rangeStrength) {
    if (!board || board.length === 0) {
        return { texture: 'unknown', factors: {} };
    }

    const ranks = board.map(card => card[0]);
    const suits = board.map(card => card[1]);
    
    // Count ranks and suits
    const rankCounts = {};
    const suitCounts = {};
    
    ranks.forEach(rank => {
        rankCounts[rank] = (rankCounts[rank] || 0) + 1;
    });
    
    suits.forEach(suit => {
        suitCounts[suit] = (suitCounts[suit] || 0) + 1;
    });
    
    const maxRankCount = Math.max(...Object.values(rankCounts));
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    
    // Count occurrences of each suit
    const suitCountValues = Object.values(suitCounts);
    const numSuits = Object.keys(suitCounts).length;

    // Classify board texture
    let texture = 'dry';
    let factors = {};

    // Count occurrences of each rank
    const rankCountValues = Object.values(rankCounts);
    const numPairs = rankCountValues.filter(c => c === 2).length;
    const numTrips = rankCountValues.filter(c => c === 3).length;
    const numQuads = rankCountValues.filter(c => c === 4).length;

    // Trips (exactly one rank appears three times, no quads)
    if (numTrips === 1 && numQuads === 0) {
        texture = 'trips';
        factors = {
            trips: true,
            rankCounts,
            gtoImplications: 'High card removal, polarized responses, less bluffing'
        };
    }
    // Paired (exactly one pair, no trips/quads)
    else if (numPairs === 1 && numTrips === 0 && numQuads === 0) {
        texture = 'paired';
        factors = {
            paired: true,
            rankCounts,
            gtoImplications: 'Reduced flush potential, more value betting, cautious responses'
        };
    }
    // Wet boards (3+ of the same suit)
    else if (maxSuitCount >= 3) {
        texture = 'wet';
        factors = {
            suited: true,
            flushDraw: maxSuitCount === 3,
            flush: maxSuitCount >= 4,
            suitCounts,
            gtoImplications: 'High flush potential, more calling with draws, less folding'
        };
    }
    // Semi-wet (2 of the same suit, some connectivity)
    else if (maxSuitCount === 2 && board.length >= 3) {
        // Check for some connectivity
        const sortedRanks = [...new Set(ranks)].sort((a, b) => 
            '23456789TJQKA'.indexOf(a) - '23456789TJQKA'.indexOf(b)
        );
        let connected = 0;
        let gaps = [];
        for (let i = 0; i < sortedRanks.length - 1; i++) {
            const rank1 = '23456789TJQKA'.indexOf(sortedRanks[i]);
            const rank2 = '23456789TJQKA'.indexOf(sortedRanks[i + 1]);
            const gap = rank2 - rank1;
            gaps.push(gap);
            if (gap <= 2) connected++;
        }
        texture = 'semi_wet';
        factors = {
            semiWet: true,
            suitCounts,
            connectedCount: connected,
            gaps,
            gtoImplications: 'Backdoor flush potential, some straight potential, moderate draw potential'
        };
    }
    // Rainbow (all suits different, not connected)
    else if (numSuits === board.length && board.length >= 3) {
        // Check for connectivity
        const sortedRanks = [...new Set(ranks)].sort((a, b) => 
            '23456789TJQKA'.indexOf(a) - '23456789TJQKA'.indexOf(b)
        );
        let connected = 0;
        let gaps = [];
        for (let i = 0; i < sortedRanks.length - 1; i++) {
            const rank1 = '23456789TJQKA'.indexOf(sortedRanks[i]);
            const rank2 = '23456789TJQKA'.indexOf(sortedRanks[i + 1]);
            const gap = rank2 - rank1;
            gaps.push(gap);
            if (gap <= 2) connected++;
        }
        if (gaps.length > 0 && gaps.every(gap => gap >= 3)) {
            texture = 'dry';
            factors = {
                dry: true,
                rainbow: true,
                suitCounts,
                gaps,
                gtoImplications: 'Rainbow, low draw potential, polarized responses, more folding'
            };
        } else if (connected >= 2) {
            texture = 'connected';
            factors = {
                connected: true,
                connectedCount: connected,
                rainbow: true,
                suitCounts,
                gaps,
                gtoImplications: 'High straight potential, more semi-bluffing, balanced responses'
            };
        } else if (connected >= 1) {
            texture = 'semi_connected';
            factors = {
                semiConnected: true,
                connectedCount: connected,
                rainbow: true,
                suitCounts,
                gaps,
                gtoImplications: 'Moderate straight potential, balanced responses'
            };
        } else {
            texture = 'dry';
            factors = {
                dry: true,
                rainbow: true,
                suitCounts,
                gaps,
                gtoImplications: 'Rainbow, low draw potential, polarized responses, more folding'
            };
        }
    }
    // Mixed suits with some connectivity
    else {
        const sortedRanks = [...new Set(ranks)].sort((a, b) => 
            '23456789TJQKA'.indexOf(a) - '23456789TJQKA'.indexOf(b)
        );
        let connected = 0;
        let gaps = [];
        for (let i = 0; i < sortedRanks.length - 1; i++) {
            const rank1 = '23456789TJQKA'.indexOf(sortedRanks[i]);
            const rank2 = '23456789TJQKA'.indexOf(sortedRanks[i + 1]);
            const gap = rank2 - rank1;
            gaps.push(gap);
            if (gap <= 2) connected++;
        }
        
        if (connected >= 2) {
            texture = 'connected';
            factors = {
                connected: true,
                connectedCount: connected,
                suitCounts,
                gaps,
                gtoImplications: 'High straight potential, more semi-bluffing, balanced responses'
            };
        } else if (connected >= 1) {
            texture = 'semi_connected';
            factors = {
                semiConnected: true,
                connectedCount: connected,
                suitCounts,
                gaps,
                gtoImplications: 'Moderate straight potential, balanced responses'
            };
        } else {
            texture = 'dry';
            factors = {
                dry: true,
                suitCounts,
                gaps,
                gtoImplications: 'Low draw potential, polarized responses, more folding'
            };
        }
    }
    
    // Add range-specific texture factors
    factors.rangeInteraction = analyzeRangeTextureInteraction(rangeStrength, texture, factors);
    
    return { texture, factors };
}

/**
 * Calculate adjustments based on board texture
 */
function calculateTextureAdjustments(textureAnalysis, playerAction, rangeStrength) {
    const { texture, factors } = textureAnalysis;
    const adjustments = { fold: 0, call: 0, raise: 0 };
    
    switch (texture) {
        case 'dry':
            // Dry boards: More polarized responses, more folding
            adjustments.fold += 0.15;  // +15% fold frequency
            adjustments.call -= 0.1;   // -10% call frequency
            adjustments.raise -= 0.05; // -5% raise frequency
            break;
            
        case 'wet':
            // Wet boards: More calling with draws, less folding
            adjustments.fold -= 0.2;   // -20% fold frequency
            adjustments.call += 0.25;  // +25% call frequency
            adjustments.raise -= 0.05; // -5% raise frequency
            break;
            
        case 'connected':
            // Connected boards: More semi-bluffing, balanced responses
            adjustments.fold -= 0.1;   // -10% fold frequency
            adjustments.call += 0.05;  // +5% call frequency
            adjustments.raise += 0.05; // +5% raise frequency
            break;
            
        case 'semi_connected':
            // Semi-connected boards: Moderate adjustments
            adjustments.fold -= 0.05;  // -5% fold frequency
            adjustments.call += 0.1;   // +10% call frequency
            adjustments.raise -= 0.05; // -5% raise frequency
            break;
            
        case 'paired':
            // Paired boards: More cautious, less bluffing
            adjustments.fold += 0.1;   // +10% fold frequency
            adjustments.call += 0.05;  // +5% call frequency
            adjustments.raise -= 0.15; // -15% raise frequency
            break;
            
        case 'trips':
            // Trips boards: Very polarized, lots of folding
            adjustments.fold += 0.25;  // +25% fold frequency
            adjustments.call -= 0.15;  // -15% call frequency
            adjustments.raise -= 0.1;  // -10% raise frequency
            break;
            
        case 'semi_wet':
            // Semi-wet boards: Backdoor flush potential, moderate adjustments
            adjustments.fold -= 0.05;  // -5% fold frequency
            adjustments.call += 0.1;   // +10% call frequency
            adjustments.raise -= 0.05; // -5% raise frequency
            break;
    }
    
    // Adjust based on opponent range strength vs board texture
    const rangeStrengthValue = rangeStrength.averageStrength || 0.5;
    if (rangeStrengthValue > 0.7 && texture === 'dry') {
        // Strong range on dry board: less folding
        adjustments.fold -= 0.1;
        adjustments.call += 0.1;
    } else if (rangeStrengthValue < 0.3 && texture === 'wet') {
        // Weak range on wet board: more folding
        adjustments.fold += 0.1;
        adjustments.call -= 0.1;
    }
    
    return adjustments;
}

/**
 * Apply street-specific texture adjustments
 */
function applyStreetSpecificAdjustments(textureAnalysis, playerAction) {
    const adjustments = { fold: 0, call: 0, raise: 0 };
    const { texture } = textureAnalysis;
    const street = playerAction.street || 'flop';
    
    if (street === 'flop') {
        // Flop: Texture has moderate impact
        if (texture === 'wet') {
            adjustments.call += 0.05; // More calling with flush draws
        } else if (texture === 'dry') {
            adjustments.fold += 0.05; // More folding on dry flop
        }
    } else if (street === 'turn') {
        // Turn: Texture has stronger impact
        if (texture === 'wet') {
            adjustments.call += 0.1; // Much more calling with flush draws
        } else if (texture === 'dry') {
            adjustments.fold += 0.1; // More folding on dry turn
        }
    } else if (street === 'river') {
        // River: Texture has strongest impact
        if (texture === 'wet') {
            adjustments.call += 0.15; // Very high calling with flush draws
        } else if (texture === 'dry') {
            adjustments.fold += 0.15; // Much more folding on dry river
        }
    }
    
    return adjustments;
}

/**
 * Analyze how opponent range interacts with board texture
 */
function analyzeRangeTextureInteraction(rangeStrength, texture, factors) {
    const rangeStrengthValue = rangeStrength.averageStrength || 0.5;
    const drawingHands = rangeStrength.drawingHandsPercentage || 0;
    
    let interaction = {
        strengthVsTexture: 'neutral',
        drawingPotential: 'low',
        bluffCatchingPotential: 'medium'
    };
    
    // Analyze strength vs texture
    if (texture === 'dry' && rangeStrengthValue > 0.6) {
        interaction.strengthVsTexture = 'strong_vs_dry';
    } else if (texture === 'wet' && drawingHands > 0.3) {
        interaction.strengthVsTexture = 'drawing_vs_wet';
    } else if (texture === 'connected' && rangeStrengthValue < 0.4) {
        interaction.strengthVsTexture = 'weak_vs_connected';
    }
    
    // Analyze drawing potential
    if (drawingHands > 0.4) {
        interaction.drawingPotential = 'high';
    } else if (drawingHands > 0.2) {
        interaction.drawingPotential = 'medium';
    }
    
    // Analyze bluff catching potential
    if (rangeStrengthValue > 0.5 && rangeStrengthValue < 0.8) {
        interaction.bluffCatchingPotential = 'high';
    } else if (rangeStrengthValue < 0.3) {
        interaction.bluffCatchingPotential = 'low';
    }
    
    return interaction;
}

/**
 * Generate explanation for board texture adjustments
 */
function generateBoardTextureExplanation(textureAnalysis, adjustments, playerAction) {
    const { texture, factors } = textureAnalysis;
    const explanations = [];
    
    explanations.push(`Board texture: ${texture}`);
    
    if (factors.gtoImplications) {
        explanations.push(`GTO implications: ${factors.gtoImplications}`);
    }
    
    // Range interaction
    if (factors.rangeInteraction) {
        const interaction = factors.rangeInteraction;
        if (interaction.strengthVsTexture !== 'neutral') {
            explanations.push(`Range interaction: ${interaction.strengthVsTexture.replace('_', ' ')}`);
        }
        if (interaction.drawingPotential !== 'low') {
            explanations.push(`Drawing potential: ${interaction.drawingPotential}`);
        }
    }
    
    // Adjustment explanations
    if (adjustments.fold > 0.05) {
        explanations.push(`Board texture increases fold frequency by ${(adjustments.fold * 100).toFixed(1)}%`);
    } else if (adjustments.fold < -0.05) {
        explanations.push(`Board texture decreases fold frequency by ${(Math.abs(adjustments.fold) * 100).toFixed(1)}%`);
    }
    
    if (adjustments.call > 0.05) {
        explanations.push(`Board texture increases call frequency by ${(adjustments.call * 100).toFixed(1)}%`);
    } else if (adjustments.call < -0.05) {
        explanations.push(`Board texture decreases call frequency by ${(Math.abs(adjustments.call) * 100).toFixed(1)}%`);
    }
    
    if (adjustments.raise > 0.05) {
        explanations.push(`Board texture increases raise frequency by ${(adjustments.raise * 100).toFixed(1)}%`);
    } else if (adjustments.raise < -0.05) {
        explanations.push(`Board texture decreases raise frequency by ${(Math.abs(adjustments.raise) * 100).toFixed(1)}%`);
    }
    
    // Street context
    if (playerAction.street) {
        explanations.push(`Street: ${playerAction.street}`);
    }
    
    return explanations.join('. ');
}

module.exports = {
    adjustForBoardTexture,
    analyzeBoardTexture,
    calculateTextureAdjustments,
    applyStreetSpecificAdjustments,
    analyzeRangeTextureInteraction,
    generateBoardTextureExplanation
}; 