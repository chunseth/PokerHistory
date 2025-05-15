import React, { useState, useEffect } from 'react';
import './PokerTable.css';
import './HandReplay.css';
import cardBack from '../assets/BackOfCard.png';

const HandReplay = ({ handData }) => {
    const [currentActionIndex, setCurrentActionIndex] = useState(-1);
    const [currentStreet, setCurrentStreet] = useState('preflop');
    const [foldedPlayers, setFoldedPlayers] = useState(new Set());
    const [currentBet, setCurrentBet] = useState(0);
    const [lastRaise, setLastRaise] = useState(0);
    const [playerBets, setPlayerBets] = useState({});
    const [streetBets, setStreetBets] = useState({});
    const [lastRaiser, setLastRaiser] = useState(null);
    const [potSize, setPotSize] = useState(0);
    const [actionAnimation, setActionAnimation] = useState('visible');
    const [revealedVillains, setRevealedVillains] = useState(new Set());
    const [isStreetTransition, setIsStreetTransition] = useState(false);

    // Initialize the hand state
    useEffect(() => {
        if (handData) {
            // Set initial blinds
            const sbPosition = (handData.buttonPosition + 1 + handData.numPlayers) % handData.numPlayers;
            const bbPosition = (handData.buttonPosition + 2 + handData.numPlayers) % handData.numPlayers;
            
            setPlayerBets({
                [sbPosition]: 0.5,
                [bbPosition]: 1
            });
            
            setStreetBets({
                [sbPosition]: 0.5,
                [bbPosition]: 1
            });
            
            setCurrentBet(1);
            setPotSize(1.5);
        }
    }, [handData]);

    const getPlayerPosition = (index) => {
        if (handData.playerPositions) {
            return handData.playerPositions[index];
        }
        const positions = {
            2: ['BTN/SB', 'BB'],
            3: ['BTN', 'SB', 'BB'],
            4: ['BTN', 'SB', 'BB', 'UTG'],
            5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
            6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
            7: ['BTN', 'SB', 'BB', 'UTG', 'LJ', 'HJ', 'CO'],
            8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO'],
            9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'],
            10: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO']
        };

        if (handData.numPlayers === 2) {
            return positions[2][index];
        }

        const basePositions = positions[handData.numPlayers];
        // Calculate clockwise distance from button
        const distanceFromButton = (index - handData.buttonPosition + handData.numPlayers) % handData.numPlayers;
        return basePositions[distanceFromButton];
    };

    const handleNextAction = () => {
        if (!handData?.bettingActions) {
            return;
        }

        // If we're in a street transition, move to the next action
        if (isStreetTransition) {
            setIsStreetTransition(false);
            setActionAnimation('visible');
            return;
        }

        // If we're at the end of the current street's actions, check if we need to transition to the next street
        if (currentActionIndex >= 0 && currentActionIndex < handData.bettingActions.length - 1) {
            const currentAction = handData.bettingActions[currentActionIndex];
            const nextAction = handData.bettingActions[currentActionIndex + 1];
            
            // If the next action is in a different street, transition to that street first
            if (nextAction.street !== currentAction.street) {
                setCurrentStreet(nextAction.street);
                setStreetBets({});
                setCurrentBet(0);
                setLastRaise(0);
                setCurrentActionIndex(prev => prev + 1);
                setIsStreetTransition(true);
                setActionAnimation('visible');
                return;
            }
        }

        // If we've reached the end of betting actions but haven't shown all streets
        if (currentActionIndex === handData.bettingActions.length - 1) {
            const currentAction = handData.bettingActions[currentActionIndex];
            if (currentAction.street === 'preflop') {
                setCurrentStreet('flop');
                setIsStreetTransition(true);
                setActionAnimation('visible');
                return;
            } else if (currentAction.street === 'flop') {
                setCurrentStreet('turn');
                setIsStreetTransition(true);
                setActionAnimation('visible');
                return;
            } else if (currentAction.street === 'turn') {
                setCurrentStreet('river');
                setIsStreetTransition(true);
                setActionAnimation('visible');
                return;
            } else if (currentAction.street === 'river') {
                // If we're at the river, we're done with the hand
                return;
            }
        }

        if (currentActionIndex < handData.bettingActions.length - 1) {
            // Start slide out animation
            setActionAnimation('slide-out');

            const nextAction = handData.bettingActions[currentActionIndex + 1];
            
            // Skip blind posting actions
            if (nextAction.action === 'post' && nextAction.street === 'preflop') {
                setCurrentActionIndex(prev => prev + 1);
                setActionAnimation('visible');
                return;
            }

            // Update player bets and pot size
            const playerIndex = nextAction.playerIndex;
            const actionAmount = nextAction.amount || 0;
            
            if (nextAction.action === 'fold') {
                setFoldedPlayers(prev => new Set([...prev, playerIndex]));
            } else if (nextAction.action === 'raise') {
                const totalBet = currentBet + actionAmount;
                setLastRaise(actionAmount);
                setCurrentBet(totalBet);
                setLastRaiser(playerIndex);
            }

            // Update player bets
            setPlayerBets(prev => ({
                ...prev,
                [playerIndex]: (prev[playerIndex] || 0) + actionAmount
            }));

            // Update street bets
            setStreetBets(prev => ({
                ...prev,
                [playerIndex]: (prev[playerIndex] || 0) + actionAmount
            }));

            // Update pot size
            setPotSize(prev => prev + actionAmount);

            // Move to next action
            setCurrentActionIndex(prev => prev + 1);
            
            // Start slide in animation
            setActionAnimation('slide-in');
            
            setActionAnimation('visible');
        }
    };

    const handlePreviousAction = () => {
        // If we're in a street transition, go back to the last action of the previous street
        if (isStreetTransition) {
            setIsStreetTransition(false);
            setActionAnimation('visible');
            return;
        }

        if (currentActionIndex >= 0) {
            // Start slide out animation
            setActionAnimation('slide-out');

            const currentAction = handData.bettingActions[currentActionIndex];
            
            // If we're at the start of a street, go back to the previous street's last action
            if (currentActionIndex > 0) {
                const prevAction = handData.bettingActions[currentActionIndex - 1];
                if (prevAction.street !== currentAction.street) {
                    setCurrentStreet(prevAction.street);
                    setStreetBets({});
                    setCurrentBet(0);
                    setLastRaise(0);
                    setCurrentActionIndex(prev => prev - 1);
                    setActionAnimation('visible');
                    return;
                }
            }

            // Update player bets and pot size
            const playerIndex = currentAction.playerIndex;
            const actionAmount = currentAction.amount || 0;

            if (currentAction.action === 'fold') {
                setFoldedPlayers(prev => {
                    const newFolded = new Set(prev);
                    newFolded.delete(playerIndex);
                    return newFolded;
                });
            } else if (currentAction.action === 'raise') {
                const prevRaises = handData.bettingActions
                    .slice(0, currentActionIndex)
                    .filter(action => action.action === 'raise' && action.street === currentAction.street)
                    .reverse();
                
                if (prevRaises.length > 0) {
                    setLastRaise(prevRaises[0].amount);
                    setCurrentBet(prevRaises[0].amount);
                } else {
                    setLastRaise(0);
                    setCurrentBet(0);
                }
                
                setLastRaiser(prevRaises.length > 0 ? prevRaises[0].playerIndex : null);
            }

            // Update player bets
            setPlayerBets(prev => ({
                ...prev,
                [playerIndex]: Math.max(0, (prev[playerIndex] || 0) - actionAmount)
            }));

            // Update street bets
            setStreetBets(prev => ({
                ...prev,
                [playerIndex]: Math.max(0, (prev[playerIndex] || 0) - actionAmount)
            }));

            // Update pot size
            setPotSize(prev => prev - actionAmount);

            setCurrentActionIndex(prev => prev - 1);
            
            // Start slide in animation
            setActionAnimation('slide-in');
            
            setActionAnimation('visible');
        }
    };

    const handleVillainCardClick = (playerIndex) => {
        setRevealedVillains(prev => {
            const newRevealed = new Set(prev);
            if (newRevealed.has(playerIndex)) {
                newRevealed.delete(playerIndex);
            } else {
                newRevealed.add(playerIndex);
            }
            return newRevealed;
        });
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
            <div className={`card ${colorClass}`}>
                <div className="card-rank">{displayRank}</div>
                <div className="card-suit">{suitSymbol}</div>
            </div>
        );
    };

    const renderQuestionMarkCard = () => {
        return (
            <div className="card question-mark">
                <div className="card-rank">?</div>
            </div>
        );
    };

    const renderPlayerCards = (playerIndex) => {
        const isHero = playerIndex === handData.heroPosition;
        const isVillain = !foldedPlayers.has(playerIndex) && playerIndex !== handData.heroPosition;
        const hasFolded = foldedPlayers.has(playerIndex);
        const isRevealed = revealedVillains.has(playerIndex);
        
        if (hasFolded) {
            return null;
        }

        if (isHero) {
            return (
                <div className="player-cards">
                    {handData.heroHoleCards.map((card, index) => (
                        <div key={index} className="card-container">
                            {renderCard(card)}
                        </div>
                    ))}
                </div>
            );
        } else if (isVillain) {
            const villainCards = handData.villainCards.find(vc => vc.playerIndex === playerIndex)?.cards || ['', ''];
            return (
                <div className="player-cards" onClick={() => handleVillainCardClick(playerIndex)}>
                    {villainCards.map((card, index) => (
                        <div key={index} className="card-container">
                            {isRevealed ? 
                                (card ? renderCard(card) : renderQuestionMarkCard()) : 
                                <img src={cardBack} alt="Card Back" className="card-back" />
                            }
                        </div>
                    ))}
                </div>
            );
        } else {
            return (
                <div className="player-cards">
                    <div className="card-container">
                        <img src={cardBack} alt="Card Back" className="card-back" />
                    </div>
                    <div className="card-container">
                        <img src={cardBack} alt="Card Back" className="card-back" />
                    </div>
                </div>
            );
        }
    };

    const renderCommunityCards = () => {
        const showFlop = currentStreet !== 'preflop';
        const showTurn = currentStreet === 'turn' || currentStreet === 'river';
        const showRiver = currentStreet === 'river';

        return (
            <div className="community-cards">
                {showFlop && handData.communityCards.flop.map((card, index) => (
                    <div key={`flop-${index}`} className="card-container">
                        {renderCard(card)}
                    </div>
                ))}
                {showTurn && (
                    <div className="card-container">
                        {renderCard(handData.communityCards.turn)}
                    </div>
                )}
                {showRiver && (
                    <div className="card-container">
                        {renderCard(handData.communityCards.river)}
                    </div>
                )}
            </div>
        );
    };

    const renderSeats = () => {
        const seats = [];
        const centerX = 293;
        const centerY = 235;
        const radius = 140;
        const betRadius = 1;
        
        for (let i = 0; i < handData.numPlayers; i++) {
            const totalSeats = handData.numPlayers;
            const angleStep = (2 * Math.PI) / totalSeats;
            // Mirror the angle calculation but keep hero at bottom
            const angle = ((angleStep * i) + Math.PI/2);
            
            const x = centerX + 1.6 * radius * Math.cos(angle);
            const y = centerY + 0.8 * radius * Math.sin(angle);
            
            const betX = centerX + 1.6 * betRadius * Math.cos(angle);
            const betY = centerY + 0.7 * betRadius * Math.sin(angle);

            const isButton = i === handData.buttonPosition;
            const position = getPlayerPosition(i);
            const isHero = i === handData.heroPosition;
            const playerBet = streetBets[i] || 0;
            const isVillain = !foldedPlayers.has(i) && i !== handData.heroPosition;

            // Get the last action for this player in the current street
            const lastAction = currentActionIndex >= 0 ? 
                handData.bettingActions[currentActionIndex] : null;
            const showCheck = lastAction && 
                lastAction.playerIndex === i && 
                lastAction.action === 'check' &&
                lastAction.street === currentStreet &&
                // Exclude BB's preflop check
                !(lastAction.street === 'preflop' && 
                  getPlayerPosition(i) === 'BB' && 
                  lastAction.action === 'check');

            // Check if this is the current player's action
            const isCurrentPlayer = lastAction && lastAction.playerIndex === i;

            seats.push(
                <div
                    key={i}
                    className={`seat ${isButton ? 'button' : ''}`}
                    style={{
                        position: 'absolute',
                        left: `${x - 30}px`,
                        top: `${y - 30}px`,
                    }}
                >
                    {isButton && <div className="dealer-button">D</div>}
                    <div className="player-info">
                        <div 
                            className={`player-position ${isVillain ? 'clickable' : ''} ${isCurrentPlayer ? 'active' : ''}`}
                            onClick={isVillain ? () => handleVillainCardClick(i) : undefined}
                        >
                            {position}
                        </div>
                        {isHero && <div className="stack-size">{handData.heroStackSize}BB</div>}
                    </div>
                    {playerBet > 0 && (
                        <div className="bet-amount">
                            {playerBet}BB
                        </div>
                    )}
                    {showCheck && (
                        <div 
                            className="check-action"
                            style={{
                                left: `${betX - 300}px`,
                                top: `${betY - 320}px`,
                            }}
                        >
                            Check
                        </div>
                    )}
                    {renderPlayerCards(i)}
                </div>
            );
        }
        return seats;
    };

    const renderCurrentAction = () => {
        if (currentActionIndex < 0) return null;
        
        // If we're in a street transition, show the transition message
        if (isStreetTransition) {
            return (
                <div className={`last-action ${actionAnimation}`}>
                    <span className="action">Dealing {currentStreet}</span>
                </div>
            );
        }

        const action = handData.bettingActions[currentActionIndex];
        return (
            <div className={`last-action ${actionAnimation}`}>
                <span className="position">{action.position}:</span>
                <span className="action">{action.action}</span>
                {action.amount > 0 && (
                    <span className="amount">{action.amount}BB</span>
                )}
            </div>
        );
    };

    return (
        <div className="poker-table-container">
            <div className="poker-table">
                {renderSeats()}
                <div className="community-cards-area">
                    {renderCommunityCards()}
                </div>
                <div className="pot-display">
                    <div>Pot: <span className="pot-amount">{potSize}BB</span></div>
                </div>
            </div>
            <div className="controls">
                <div className="step-content">
                    {renderCurrentAction()}
                </div>
                <div className="navigation-buttons">
                    <button 
                        onClick={handlePreviousAction}
                        disabled={currentActionIndex < 0 && !isStreetTransition}
                        className={currentActionIndex < 0 && !isStreetTransition ? 'disabled' : ''}
                    >
                        Previous
                    </button>
                    <button 
                        onClick={handleNextAction}
                        disabled={!handData?.bettingActions || 
                            (currentActionIndex >= (handData?.bettingActions?.length - 1) && 
                             currentStreet === 'river' && 
                             !isStreetTransition)}
                        className={(!handData?.bettingActions || 
                            (currentActionIndex >= (handData?.bettingActions?.length - 1) && 
                             currentStreet === 'river' && 
                             !isStreetTransition)) ? 'disabled' : ''}
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HandReplay; 