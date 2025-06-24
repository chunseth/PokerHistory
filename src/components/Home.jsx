import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './Home.css';
import cardBack from '../assets/BackOfCard.png';
import PokerGameLogic from '../utils/PokerGameLogic';

const HomePage = () => {
    const heroCardsRef = React.useRef(null);
    const [forceUpdate, setForceUpdate] = useState(0);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [gameLogic] = useState(() => new PokerGameLogic(6));
    const [currentActionIndex, setCurrentActionIndex] = useState(null);
    const [raiseAmount, setRaiseAmount] = useState(2);
    const [communityCards, setCommunityCards] = useState([]);
    const [playerStacks, setPlayerStacks] = useState({
        'BTN': 100,
        'SB': 100,
        'BB': 100,
        'UTG': 100,
        'HJ': 100,
        'CO': 100
    });

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Initialize game when component mounts
    useEffect(() => {
        // Initialize stacks first
        setPlayerStacks({
            'BTN': 100,
            'SB': 100,
            'BB': 100,
            'UTG': 100,
            'HJ': 100,
            'CO': 100
        });

        // Then initialize the hand
        const initialActionIndex = gameLogic.initializeHand(0); // Start with BTN at position 0
        setCurrentActionIndex(initialActionIndex);

        // Post blinds
        const sbPosition = (gameLogic.buttonPosition - 1 + gameLogic.numPlayers) % gameLogic.numPlayers;
        const bbPosition = (gameLogic.buttonPosition - 2 + gameLogic.numPlayers) % gameLogic.numPlayers;

        // Post small blind
        handleBettingAction('post', 0.5, sbPosition);
        // Post big blind
        handleBettingAction('post', 1, bbPosition);
    }, []);

    // Generate random cards
    const generateRandomCards = (count, excludeCards = []) => {
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
        const suits = ['c', 's', 'h', 'd'];
        const usedCards = new Set([...excludeCards, ...communityCards]);
        const newCards = [];

        while (newCards.length < count) {
            const rank = ranks[Math.floor(Math.random() * ranks.length)];
            const suit = suits[Math.floor(Math.random() * suits.length)];
            const card = rank + suit;
            
            if (!usedCards.has(card)) {
                usedCards.add(card);
                newCards.push(card);
            }
        }

        return newCards;
    };

    // Generate cards synchronously
    if (!heroCardsRef.current) {
        heroCardsRef.current = generateRandomCards(2);
        setForceUpdate(prev => prev + 1);
    }

    const handleBettingAction = (action, amount = 0, forcedPlayerIndex = null) => {
        const currentPosition = gameLogic.getPlayerPosition(forcedPlayerIndex ?? currentActionIndex);
        const currentStack = playerStacks[currentPosition];
        const currentPlayerBet = gameLogic.streetBets[forcedPlayerIndex ?? currentActionIndex] || 0;

        const bettingAction = {
            playerIndex: forcedPlayerIndex ?? currentActionIndex,
            position: currentPosition,
            action,
            amount,
            street: gameLogic.currentStreet,
            playerStack: currentStack
        };

        gameLogic.addBettingAction(bettingAction);

        // Update player stacks
        if (action === 'raise' || action === 'call' || action === 'post') {
            let additionalAmount;
            if (action === 'post') {
                additionalAmount = amount; // For blinds, use the full amount
            } else if (action === 'raise') {
                additionalAmount = amount - currentPlayerBet;
            } else { // call
                additionalAmount = gameLogic.currentBet - currentPlayerBet;
            }

            setPlayerStacks(prev => {
                const newStacks = { ...prev };
                newStacks[currentPosition] = Math.max(0, prev[currentPosition] - additionalAmount);
                return newStacks;
            });
        }

        // If betting round is complete, set currentActionIndex to null to show Next Street button
        if (gameLogic.bettingRoundComplete) {
            setCurrentActionIndex(null);
        } else {
            // Move to next active player
            const nextPlayerIndex = gameLogic.getNextActivePlayer(forcedPlayerIndex ?? currentActionIndex);
            if (nextPlayerIndex !== null) {
                setCurrentActionIndex(nextPlayerIndex);
            }
        }

        // Update raise amount for next action
        const minRaise = gameLogic.calculateMinRaise(
            playerStacks[gameLogic.getPlayerPosition(currentActionIndex)],
            gameLogic.streetBets[currentActionIndex] || 0
        );
        setRaiseAmount(minRaise);
    };

    const handleNextStreet = () => {
        const nextPlayerIndex = gameLogic.transitionToNextStreet();
        if (nextPlayerIndex !== null) {
            setCurrentActionIndex(nextPlayerIndex);
            
            // Deal new community cards based on the street
            if (gameLogic.currentStreet === 'flop') {
                setCommunityCards(generateRandomCards(3, heroCardsRef.current));
            } else if (gameLogic.currentStreet === 'turn') {
                setCommunityCards(prev => [...prev, ...generateRandomCards(1, [...heroCardsRef.current, ...prev])]);
            } else if (gameLogic.currentStreet === 'river') {
                setCommunityCards(prev => [...prev, ...generateRandomCards(1, [...heroCardsRef.current, ...prev])]);
            }
        }
    };

    const renderCard = (card) => {
        if (!card) return null;
        const rank = card[0]?.toUpperCase() || '';
        const suit = card[1]?.toLowerCase() || '';
        
        const suitSymbol = {
            's': '♠',
            'h': '♥',
            'd': '♦',
            'c': '♣'
        }[suit] || '';

        const colorClass = {
            'h': 'red',
            'd': 'diamonds',
            'c': 'clubs',
            's': ''
        }[suit] || '';

        const displayRank = rank === 'T' ? '10' : rank;

        return (
            <div className={`home-card ${colorClass}`}>
                <div className="home-card-rank">{displayRank}</div>
                <div className="home-card-suit">{suitSymbol}</div>
            </div>
        );
    };

    const renderSeats = () => {
        const seats = [];
        
        const centerX = isMobile ? 180 : 303;
        const centerY = isMobile ? 155 : 240;
        const radius = isMobile ? 90 : 155;
        
        for (let i = 0; i < 6; i++) {
            const angleStep = (2 * Math.PI) / 6;
            const angle = -((angleStep * i) - Math.PI/2);
            
            const x = centerX + 1.6 * radius * Math.cos(angle);
            const y = centerY + 0.9 * radius * Math.sin(angle);

            const position = gameLogic.getPlayerPosition(i);
            const isButton = i === gameLogic.buttonPosition;
            const isCurrentAction = i === currentActionIndex;
            const stack = playerStacks[position];
            const streetBet = gameLogic.streetBets[i] || 0;
            const hasFolded = gameLogic.foldedPlayers.has(i);

            seats.push(
                <div
                    key={i}
                    className={`home-seat ${isCurrentAction ? 'current-action' : ''} ${hasFolded ? 'folded' : ''}`}
                    style={{
                        position: 'absolute',
                        left: `${x - (isMobile ? 12 : 15)}px`,
                        top: `${y - (isMobile ? 12 : 15)}px`,
                    }}
                >
                    {isButton && <div className="home-dealer-button">D</div>}
                    <div className="home-player-cards">
                        {i === 0 ? (
                            <div style={{ display: 'flex', gap: '2px' }}>
                                {heroCardsRef.current.map((card, index) => (
                                    <div key={index} className="home-card-container">
                                        {renderCard(card)}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <>
                                <div className="home-card-container">
                                    <img src={cardBack} alt="Card Back" className="home-card-back" />
                                </div>
                                <div className="home-card-container">
                                    <img src={cardBack} alt="Card Back" className="home-card-back" />
                                </div>
                            </>
                        )}
                    </div>
                    <div className="home-player-stack">
                        {stack}BB
                    </div>
                    {streetBet > 0 && (
                        <div className="home-player-bet">
                            {streetBet}BB
                        </div>
                    )}
                </div>
            );
        }
        return seats;
    };

    const renderBettingControls = () => {
        // Show Next Street button if betting round is complete
        if (gameLogic.bettingRoundComplete) {
            return (
                <div className="betting-controls">
                    <div className="current-action">
                        {gameLogic.currentStreet === 'preflop' ? 'Preflop Complete' : 
                         gameLogic.currentStreet === 'flop' ? 'Flop Complete' :
                         gameLogic.currentStreet === 'turn' ? 'Turn Complete' : 'River Complete'}
                    </div>
                    <div className="action-buttons">
                        <button 
                            onClick={handleNextStreet}
                            className="next-street-button"
                        >
                            {gameLogic.currentStreet === 'preflop' ? 'Deal Flop' : 
                             gameLogic.currentStreet === 'flop' ? 'Deal Turn' :
                             gameLogic.currentStreet === 'turn' ? 'Deal River' : 'Showdown'}
                        </button>
                    </div>
                </div>
            );
        }

        // Show betting controls if there's a current action
        if (currentActionIndex === null || currentActionIndex === undefined) return null;

        const currentPosition = gameLogic.getPlayerPosition(currentActionIndex);
        const currentStack = playerStacks[currentPosition];
        const currentPlayerBet = gameLogic.streetBets[currentActionIndex] || 0;
        const canCheck = gameLogic.currentBet === currentPlayerBet;
        const canCall = gameLogic.currentBet > currentPlayerBet;
        const minRaise = gameLogic.calculateMinRaise(currentStack, currentPlayerBet);
        const maxRaise = gameLogic.calculateMaxRaise(currentStack, currentPlayerBet);
        const isAllIn = minRaise >= maxRaise;

        return (
            <div className="betting-controls">
                <div className="current-action">
                    {currentPosition}'s Action
                </div>
                <div className="action-buttons">
                    <button onClick={() => handleBettingAction('fold')}>Fold</button>
                    {canCheck && <button onClick={() => handleBettingAction('check')}>Check</button>}
                    {canCall && (
                        <button onClick={() => handleBettingAction('call')}>
                            Call {gameLogic.currentBet - currentPlayerBet}BB
                        </button>
                    )}
                    {minRaise <= maxRaise && !isAllIn && (
                        <div className="raise-controls">
                            <input
                                type="range"
                                min={minRaise}
                                max={maxRaise}
                                value={raiseAmount}
                                onChange={(e) => setRaiseAmount(parseFloat(e.target.value))}
                                step="0.5"
                            />
                            <button onClick={() => handleBettingAction('raise', raiseAmount)}>
                                Raise to {raiseAmount}BB
                            </button>
                        </div>
                    )}
                    {isAllIn && (
                        <button 
                            onClick={() => handleBettingAction('raise', maxRaise)}
                            className="all-in-button"
                        >
                            All In {maxRaise}BB
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="home-container">
            <div className="home-poker-table">
                <div className="home-table-container">
                    <div className="home-table-content">
                        {communityCards.length === 0 && (
                            <h1>PokerHistory.pro</h1>
                        )}
                        <div className="game-info">
                            <div className="pot-size">
                                Pot: {gameLogic.calculatePotSize()}BB
                            </div>
                        </div>
                        <div className="home-community-cards">
                            {[...Array(5)].map((_, index) => {
                                const shouldShowCard = 
                                    (gameLogic.currentStreet === 'preflop' && false) ||
                                    (gameLogic.currentStreet === 'flop' && index < 3) ||
                                    (gameLogic.currentStreet === 'turn' && index < 4) ||
                                    (gameLogic.currentStreet === 'river' && index < 5);
                                
                                return (
                                    <div 
                                        key={index} 
                                        className={`home-card-container ${!shouldShowCard ? 'invisible' : ''}`}
                                    >
                                        {index < communityCards.length ? renderCard(communityCards[index]) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {renderSeats()}
                </div>
            </div>

            {renderBettingControls()}

            <div className="home-controls">
                <div className="action-buttons">
                    <Link to="/new-hand" className="action-button">
                        New Hand
                        <span className="tooltip">Manually input custom hands</span>
                    </Link>
                    <Link to="/hand-history" className="action-button">
                        Hand History
                        <span className="tooltip">Replay your hands to find the weak spots in your game</span>
                    </Link>
                    <Link to="/import-hands" className="action-button">
                        Import Hands
                        <span className="tooltip">Upload ACR hand history files</span>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default HomePage; 
