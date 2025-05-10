import React, { useState, useEffect } from 'react';
import './HandAnalysis.css';
import {
    calculateHandStrength,
    calculateEquity,
    calculatePotOdds,
    getRecommendedAction
} from '../utils/pokerAnalysis';
import PostFlopAnalyzer from '../utils/postFlopAnalysis';

// Stack depth categories
const STACK_DEPTHS = {
    DEEP: 50,    // 50+ BB
    MID: 20,     // 20-50 BB
    SHORT: 10,   // 10-20 BB
    VERY_SHORT: 5 // <10 BB
};

// Position-specific opening ranges based on stack depth
const POSITION_RANGES = {
    UTG: {
        [STACK_DEPTHS.DEEP]: {
            open: {
                'AA,KK,QQ,JJ,TT,99,88,77,66,55,44,33,22': 1.0,
                'AKs,AQs,AJs,ATs,A9s,A8s,A7s,A6s,A5s,A4s,A3s,A2s': 0.9,
                'AKo,AQo,AJo,ATo,A9o,A8o,A7o,A6o,A5o,A4o,A3o,A2o': 0.8,
                'KQs,KJs,KTs,K9s,K8s,K7s,K6s,K5s,K4s,K3s,K2s': 0.7,
                'KQo,KJo,KTo,K9o,K8o,K7o,K6o,K5o,K4o,K3o,K2o': 0.6,
                'QJs,QTs,Q9s,Q8s,Q7s,Q6s,Q5s,Q4s,Q3s,Q2s': 0.5,
                'QJo,QTo,Q9o,Q8o,Q7o,Q6o,Q5o,Q4o,Q3o,Q2o': 0.4,
                'JTs,J9s,J8s,J7s,J6s,J5s,J4s,J3s,J2s': 0.3,
                'JTo,J9o,J8o,J7o,J6o,J5o,J4o,J3o,J2o': 0.2,
                'T9s,T8s,T7s,T6s,T5s,T4s,T3s,T2s': 0.2,
                'T9o,T8o,T7o,T6o,T5o,T4o,T3o,T2o': 0.1,
                '98s,97s,96s,95s,94s,93s,92s': 0.1,
                '98o,97o,96o,95o,94o,93o,92o': 0.05,
            },
            vsOpen: {
                'AA,KK,QQ,JJ,TT': 1.0,
                'AKs,AQs,AJs,ATs': 0.9,
                'AKo,AQo,AJo': 0.8,
                'KQs,KJs,KTs': 0.7,
                'KQo,KJo': 0.6,
                'QJs,QTs': 0.5,
                'QJo': 0.4,
            }
        },
        [STACK_DEPTHS.MID]: {
            open: {
                'AA,KK,QQ,JJ,TT,99,88,77,66,55': 1.0,
                'AKs,AQs,AJs,ATs,A9s,A8s,A7s,A6s,A5s': 0.9,
                'AKo,AQo,AJo,ATo,A9o,A8o,A7o': 0.8,
                'KQs,KJs,KTs,K9s,K8s,K7s': 0.7,
                'KQo,KJo,KTo,K9o': 0.6,
                'QJs,QTs,Q9s,Q8s': 0.5,
                'QJo,QTo,Q9o': 0.4,
                'JTs,J9s,J8s,J7s': 0.3,
                'JTo,J9o,J8o': 0.2,
                'T9s,T8s,T7s,T6s': 0.2,
                'T9o,T8o,T7o': 0.1,
                '98s,97s,96s,95s': 0.1,
                '98o,97o,96o': 0.05,
            },
            vsOpen: {
                'AA,KK,QQ,JJ,TT': 1.0,
                'AKs,AQs,AJs,ATs': 0.9,
                'AKo,AQo,AJo': 0.8,
                'KQs,KJs,KTs': 0.7,
                'KQo,KJo': 0.6,
                'QJs,QTs': 0.5,
                'QJo': 0.4,
            }
        },
        [STACK_DEPTHS.SHORT]: {
            open: {
                'AA,KK,QQ,JJ,TT,99,88,77,66,55': 1.0,
                'AKs,AQs,AJs,ATs,A9s,A8s,A7s': 0.9,
                'AKo,AQo,AJo,ATo,A9o': 0.8,
                'KQs,KJs,KTs,K9s,K8s': 0.7,
                'KQo,KJo,KTo': 0.6,
                'QJs,QTs,Q9s': 0.5,
                'QJo,QTo': 0.4,
                'JTs,J9s,J8s': 0.3,
                'JTo,J9o': 0.2,
                'T9s,T8s,T7s': 0.2,
                'T9o,T8o': 0.1,
                '98s,97s,96s': 0.1,
                '98o,97o': 0.05,
            },
            vsOpen: {
                'AA,KK,QQ,JJ,TT': 1.0,
                'AKs,AQs,AJs,ATs': 0.9,
                'AKo,AQo,AJo': 0.8,
                'KQs,KJs,KTs': 0.7,
                'KQo,KJo': 0.6,
                'QJs,QTs': 0.5,
                'QJo': 0.4,
            }
        },
        [STACK_DEPTHS.VERY_SHORT]: {
            open: {
                'AA,KK,QQ,JJ,TT,99,88,77,66,55': 1.0,
                'AKs,AQs,AJs,ATs,A9s': 0.9,
                'AKo,AQo,AJo,ATo': 0.8,
                'KQs,KJs,KTs,K9s': 0.7,
                'KQo,KJo,KTo': 0.6,
                'QJs,QTs,Q9s': 0.5,
                'QJo,QTo': 0.4,
                'JTs,J9s,J8s': 0.3,
                'JTo,J9o': 0.2,
                'T9s,T8s,T7s': 0.2,
                'T9o,T8o': 0.1,
                '98s,97s,96s': 0.1,
                '98o,97o': 0.05,
            },
            vsOpen: {
                'AA,KK,QQ,JJ,TT': 1.0,
                'AKs,AQs,AJs,ATs': 0.9,
                'AKo,AQo,AJo': 0.8,
                'KQs,KJs,KTs': 0.7,
                'KQo,KJo': 0.6,
                'QJs,QTs': 0.5,
                'QJo': 0.4,
            }
        }
    },
    // Add more positions as needed
};

// Multiway adjustments
const MULTIWAY_ADJUSTMENTS = {
    flop: {
        cbet: {
            small: 0.4,  // 33% pot
            medium: 0.3, // 66% pot
            large: 0.1   // 100% pot
        },
        checkRaise: {
            small: 0.3,  // 33% pot
            medium: 0.3, // 66% pot
            large: 0.2   // 100% pot
        }
    },
    turn: {
        bet: {
            small: 0.2,  // 33% pot
            medium: 0.3, // 66% pot
            large: 0.2   // 100% pot
        }
    },
    river: {
        bet: {
            small: 0.1,  // 33% pot
            medium: 0.2, // 66% pot
            large: 0.3   // 100% pot
        }
    }
};

// Helper function to get stack depth category
const getStackDepthCategory = (stackSize) => {
    if (stackSize >= STACK_DEPTHS.DEEP) return STACK_DEPTHS.DEEP;
    if (stackSize >= STACK_DEPTHS.MID) return STACK_DEPTHS.MID;
    if (stackSize >= STACK_DEPTHS.SHORT) return STACK_DEPTHS.SHORT;
    return STACK_DEPTHS.VERY_SHORT;
};

// Helper function to get position-specific range
const getPositionRange = (position, stackSize, action = 'open') => {
    const stackDepth = getStackDepthCategory(stackSize);
    return POSITION_RANGES[position]?.[stackDepth]?.[action] || {};
};

// Helper function to get multiway adjustments
const getMultiwayAdjustments = (street, numPlayers) => {
    if (numPlayers <= 2) return null;
    return MULTIWAY_ADJUSTMENTS[street] || null;
};

const HandAnalysis = ({ handData }) => {
    const [analysis, setAnalysis] = useState({
        preflop: null,
        flop: null,
        turn: null,
        river: null
    });

    useEffect(() => {
        if (handData) {
            // Analyze each street as it's revealed
            const newAnalysis = { ...analysis };

            // Preflop analysis
            if (handData.heroHoleCards) {
                const handStrength = calculateHandStrength(handData.heroHoleCards, []);
                const equity = calculateEquity(handData.heroHoleCards, [], getPositionRange(handData.heroPosition, handData.heroStackSize));
                const potOdds = calculatePotOdds(1, 1.5); // Assuming BB is 1 and SB is 0.5

                newAnalysis.preflop = {
                    handStrength,
                    equity,
                    potOdds,
                    recommendedAction: getRecommendedAction(
                        'preflop',
                        handData.heroPosition,
                        'open',
                        1.5,
                        1,
                        handStrength,
                        equity,
                        potOdds
                    ),
                    stackDepth: getStackDepthCategory(handData.heroStackSize),
                    positionRange: getPositionRange(handData.heroPosition, handData.heroStackSize)
                };
            }

            // Post-flop analysis
            if (handData.communityCards) {
                const isIP = handData.heroPosition === 'BTN' || handData.heroPosition === 'CO';
                const postFlopAnalyzer = new PostFlopAnalyzer(
                    isIP ? 'IP' : 'OOP',
                    handData.heroStackSize
                );

                // Flop analysis
                if (handData.communityCards.flop) {
                    const flopAnalysis = postFlopAnalyzer.analyzeHand(
                        handData.heroHoleCards,
                        handData.communityCards.flop,
                        handData.potSize,
                        'cbet'
                    );

                    newAnalysis.flop = {
                        ...flopAnalysis,
                        handStrength: calculateHandStrength(
                            handData.heroHoleCards,
                            handData.communityCards.flop
                        ),
                        equity: calculateEquity(
                            handData.heroHoleCards,
                            handData.communityCards.flop,
                            getPositionRange(handData.heroPosition, handData.heroStackSize)
                        ),
                        potOdds: calculatePotOdds(
                            handData.currentBet,
                            handData.potSize
                        )
                    };
                }

                // Turn analysis
                if (handData.communityCards.turn) {
                    const turnAnalysis = postFlopAnalyzer.analyzeHand(
                        handData.heroHoleCards,
                        [...handData.communityCards.flop, handData.communityCards.turn],
                        handData.potSize,
                        'turn'
                    );

                    newAnalysis.turn = {
                        ...turnAnalysis,
                        handStrength: calculateHandStrength(
                            handData.heroHoleCards,
                            [...handData.communityCards.flop, handData.communityCards.turn]
                        ),
                        equity: calculateEquity(
                            handData.heroHoleCards,
                            [...handData.communityCards.flop, handData.communityCards.turn],
                            getPositionRange(handData.heroPosition, handData.heroStackSize)
                        ),
                        potOdds: calculatePotOdds(
                            handData.currentBet,
                            handData.potSize
                        )
                    };
                }

                // River analysis
                if (handData.communityCards.river) {
                    const riverAnalysis = postFlopAnalyzer.analyzeHand(
                        handData.heroHoleCards,
                        [...handData.communityCards.flop, handData.communityCards.turn, handData.communityCards.river],
                        handData.potSize,
                        'river'
                    );

                    newAnalysis.river = {
                        ...riverAnalysis,
                        handStrength: calculateHandStrength(
                            handData.heroHoleCards,
                            [...handData.communityCards.flop, handData.communityCards.turn, handData.communityCards.river]
                        ),
                        equity: calculateEquity(
                            handData.heroHoleCards,
                            [...handData.communityCards.flop, handData.communityCards.turn, handData.communityCards.river],
                            getPositionRange(handData.heroPosition, handData.heroStackSize)
                        ),
                        potOdds: calculatePotOdds(
                            handData.currentBet,
                            handData.potSize
                        )
                    };
                }
            }

            setAnalysis(newAnalysis);
        }
    }, [handData]);

    const renderStreetAnalysis = (street) => {
        const streetAnalysis = analysis[street];
        if (!streetAnalysis) return null;

        return (
            <div className="street-analysis">
                <h3>{street.charAt(0).toUpperCase() + street.slice(1)} Analysis</h3>
                <div className="analysis-metrics">
                    <div className="metric">
                        <h4>Hand Strength</h4>
                        <p>{(streetAnalysis.handStrength * 100).toFixed(1)}%</p>
                    </div>
                    <div className="metric">
                        <h4>Equity</h4>
                        <p>{(streetAnalysis.equity * 100).toFixed(1)}%</p>
                    </div>
                    <div className="metric">
                        <h4>Pot Odds</h4>
                        <p>{(streetAnalysis.potOdds * 100).toFixed(1)}%</p>
                    </div>
                </div>
                <div className="recommendation">
                    <h4>GTO Recommendation</h4>
                    <p>Action: {streetAnalysis.recommendedAction.action}</p>
                    <p>Sizing: {streetAnalysis.recommendedAction.sizing}BB</p>
                    <p>Frequency: {(streetAnalysis.recommendedAction.frequency * 100).toFixed(1)}%</p>
                    <p>Reasoning: {streetAnalysis.recommendedAction.reasoning}</p>
                </div>
                {street === 'preflop' && streetAnalysis.stackDepth && (
                    <div className="stack-depth">
                        <h4>Stack Depth Analysis</h4>
                        <p>Category: {streetAnalysis.stackDepth === STACK_DEPTHS.DEEP ? 'Deep' :
                            streetAnalysis.stackDepth === STACK_DEPTHS.MID ? 'Mid' :
                            streetAnalysis.stackDepth === STACK_DEPTHS.SHORT ? 'Short' : 'Very Short'}</p>
                    </div>
                )}
                {streetAnalysis.multiwayAdjustments && (
                    <div className="multiway-adjustments">
                        <h4>Multiway Adjustments</h4>
                        <p>Small Bet: {(streetAnalysis.multiwayAdjustments.cbet?.small * 100 || 
                            streetAnalysis.multiwayAdjustments.bet?.small * 100).toFixed(1)}%</p>
                        <p>Medium Bet: {(streetAnalysis.multiwayAdjustments.cbet?.medium * 100 || 
                            streetAnalysis.multiwayAdjustments.bet?.medium * 100).toFixed(1)}%</p>
                        <p>Large Bet: {(streetAnalysis.multiwayAdjustments.cbet?.large * 100 || 
                            streetAnalysis.multiwayAdjustments.bet?.large * 100).toFixed(1)}%</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="hand-analysis-container">
            <h2>Hand Analysis</h2>
            {renderStreetAnalysis('preflop')}
            {renderStreetAnalysis('flop')}
            {renderStreetAnalysis('turn')}
            {renderStreetAnalysis('river')}
        </div>
    );
};

export default HandAnalysis; 