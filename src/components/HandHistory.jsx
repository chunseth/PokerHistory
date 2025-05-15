import React, { useState } from 'react';
import PokerTable from './PokerTable';
import handService from '../services/hand.service';
import './HandHistory.css';

const HandHistory = () => {
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [savedHandId, setSavedHandId] = useState(null);

    const handleHandComplete = async (handData) => {
        setIsSaving(true);
        setError(null);
        setSuccess(false);
        setSavedHandId(null);

        try {
            // Save the hand to MongoDB
            const savedHand = await handService.saveHand(handData);
            console.log('Hand saved successfully:', savedHand);
            setSuccess(true);
            setSavedHandId(savedHand.id);
        } catch (error) {
            console.error('Error saving hand:', error);
            setError(error.message || 'Failed to save hand');
        } finally {
            setIsSaving(false);
        }
    };

    // Add a helper for future-proofing if position display is needed
    const getPlayerPosition = (hand, index) => {
        if (hand.playerPositions) {
            return hand.playerPositions[index];
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
        if (hand.numPlayers === 2) {
            return positions[2][index];
        }
        const basePositions = positions[hand.numPlayers];
        const distanceFromButton = (hand.buttonPosition - index + hand.numPlayers) % hand.numPlayers;
        return basePositions[distanceFromButton];
    };

    return (
        <div className="hand-history">
            <div className="hand-history-header">
                <h1>Poker Hand History</h1>
                <div className="hand-history-controls">
                    {savedHandId && (
                        <button 
                            className="view-hand-button"
                            onClick={() => window.open(`/hand/${savedHandId}`, '_blank')}
                        >
                            View Saved Hand
                        </button>
                    )}
                </div>
            </div>
            
            {error && (
                <div className="message error-message">
                    <div className="message-icon">⚠️</div>
                    <div className="message-content">
                        <h3>Error Saving Hand</h3>
                        <p>{error}</p>
                    </div>
                </div>
            )}
            
            {success && (
                <div className="message success-message">
                    <div className="message-icon">✓</div>
                    <div className="message-content">
                        <h3>Hand Saved Successfully!</h3>
                        <p>Your hand has been saved to the database.</p>
                    </div>
                </div>
            )}
            
            <div className="poker-table-container">
                <PokerTable onHandComplete={handleHandComplete} />
                
                {isSaving && (
                    <div className="loading-overlay">
                        <div className="loading-content">
                            <div className="loading-spinner"></div>
                            <div className="loading-text">
                                <h3>Saving Hand</h3>
                                <p>Please wait while we save your hand to the database...</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HandHistory; 