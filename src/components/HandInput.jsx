import React, { useState } from 'react';
import { HandModel } from '../models/HandModel';
import { handService } from '../services/HandService';
import './HandInput.css';

const HandInput = () => {
    const [hand, setHand] = useState(new HandModel());
    const [currentPlayer, setCurrentPlayer] = useState(null);
    const [betAmount, setBetAmount] = useState('');

    const handleGameTypeChange = (e) => {
        setHand(prev => ({ ...prev, gameType: e.target.value }));
    };

    const handleNumPlayersChange = (e) => {
        const numPlayers = parseInt(e.target.value);
        setHand(prev => ({ ...prev, numPlayers }));
    };

    const handleButtonPositionChange = (e) => {
        setHand(prev => ({ ...prev, buttonPosition: parseInt(e.target.value) }));
    };

    const handleHeroPositionChange = (e) => {
        setHand(prev => ({ ...prev, heroPosition: parseInt(e.target.value) }));
    };

    const handleHeroCardsChange = (index, value) => {
        const newCards = [...hand.heroHoleCards];
        newCards[index] = value.toUpperCase();
        setHand(prev => ({ ...prev, heroHoleCards: newCards }));
    };

    const handleCommunityCardsChange = (street, index, value) => {
        const newCards = { ...hand.communityCards };
        if (street === 'flop') {
            newCards.flop = [...newCards.flop];
            newCards.flop[index] = value.toUpperCase();
        } else {
            newCards[street] = value.toUpperCase();
        }
        setHand(prev => ({ ...prev, communityCards: newCards }));
    };

    const handleAddPlayer = (stackSize) => {
        const player = hand.addPlayer(stackSize);
        setCurrentPlayer(player);
    };

    const handleBettingAction = (action) => {
        if (!currentPlayer) return;
        
        if (action === 'raise' && !betAmount) {
            alert('Please enter a bet amount');
            return;
        }

        const amount = action === 'raise' ? parseFloat(betAmount) : 0;
        hand.addBettingAction(currentPlayer.id, action, amount);
        setBetAmount('');
    };

    const handleSaveHand = () => {
        handService.saveHand(hand);
        setHand(new HandModel());
        setCurrentPlayer(null);
    };

    return (
        <div className="hand-input">
            <h2>New Hand</h2>
            
            <div className="input-section">
                <h3>Game Setup</h3>
                <div className="input-group">
                    <label>Game Type</label>
                    <select value={hand.gameType} onChange={handleGameTypeChange}>
                        <option value="cash">Cash Game</option>
                        <option value="tournament">Tournament</option>
                    </select>
                </div>

                <div className="input-group">
                    <label>Number of Players</label>
                    <input 
                        type="number" 
                        min="2" 
                        max="10" 
                        value={hand.numPlayers} 
                        onChange={handleNumPlayersChange}
                    />
                </div>

                <div className="input-group">
                    <label>Button Position</label>
                    <select value={hand.buttonPosition || ''} onChange={handleButtonPositionChange}>
                        <option value="">Select position</option>
                        {Array.from({ length: hand.numPlayers }, (_, i) => (
                            <option key={i} value={i}>Position {i + 1}</option>
                        ))}
                    </select>
                </div>

                <div className="input-group">
                    <label>Hero Position</label>
                    <select value={hand.heroPosition || ''} onChange={handleHeroPositionChange}>
                        <option value="">Select position</option>
                        {Array.from({ length: hand.numPlayers }, (_, i) => (
                            <option key={i} value={i}>Position {i + 1}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="input-section">
                <h3>Hero Cards</h3>
                <div className="hole-cards-input">
                    {hand.heroHoleCards.map((card, index) => (
                        <input
                            key={index}
                            type="text"
                            value={card}
                            onChange={(e) => handleHeroCardsChange(index, e.target.value)}
                            placeholder={`Card ${index + 1}`}
                        />
                    ))}
                </div>
            </div>

            <div className="input-section">
                <h3>Community Cards</h3>
                <div className="community-cards-input">
                    <div className="flop">
                        {hand.communityCards.flop.map((card, index) => (
                            <input
                                key={`flop-${index}`}
                                type="text"
                                value={card}
                                onChange={(e) => handleCommunityCardsChange('flop', index, e.target.value)}
                                placeholder={`Flop ${index + 1}`}
                            />
                        ))}
                    </div>
                    <input
                        type="text"
                        value={hand.communityCards.turn}
                        onChange={(e) => handleCommunityCardsChange('turn', null, e.target.value)}
                        placeholder="Turn"
                    />
                    <input
                        type="text"
                        value={hand.communityCards.river}
                        onChange={(e) => handleCommunityCardsChange('river', null, e.target.value)}
                        placeholder="River"
                    />
                </div>
            </div>

            <div className="input-section">
                <h3>Betting Actions</h3>
                <div className="betting-input">
                    <div className="action-buttons">
                        <button onClick={() => handleBettingAction('fold')}>Fold</button>
                        <button onClick={() => handleBettingAction('check')}>Check</button>
                        <button onClick={() => handleBettingAction('call')}>Call</button>
                        <div className="raise-input">
                            <input
                                type="number"
                                value={betAmount}
                                onChange={(e) => setBetAmount(e.target.value)}
                                placeholder="Raise amount"
                            />
                            <button onClick={() => handleBettingAction('raise')}>Raise</button>
                        </div>
                    </div>
                </div>
            </div>

            <button className="save-button" onClick={handleSaveHand}>
                Save Hand
            </button>
        </div>
    );
};

export default HandInput; 