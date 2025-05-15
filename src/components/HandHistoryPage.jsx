import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api.service';
import './HandHistoryPage.css';

const HandHistoryPage = () => {
    const navigate = useNavigate();
    const [hands, setHands] = useState([]);
    const [selectedDate, setSelectedDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingTournamentName, setEditingTournamentName] = useState(null);
    const [tournamentName, setTournamentName] = useState('');
    const [filters, setFilters] = useState({
        gameType: '',
        minStack: 0,
        maxStack: 200,
        holeCards: ['', '']
    });

    useEffect(() => {
        if (selectedDate) {
            fetchHands();
        } else {
            setHands([]);
        }
    }, [selectedDate, filters.maxStack, filters.holeCards]);

    const fetchHands = async () => {
        try {
            setLoading(true);
            // Create start and end dates for the selected day in local timezone
            const [year, month, day] = selectedDate.split('-').map(Number);
            const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
            const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);

            console.log('Fetching hands with date range:', {
                selectedDate,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            });

            const response = await apiService.getHands({
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                minStackSize: filters.minStack,
                maxStackSize: filters.maxStack,
                holeCards: filters.holeCards.join(','),
                gameType: filters.gameType
            });
            console.log('Received hands:', response);
            setHands(response);
        } catch (error) {
            console.error('Error fetching hands:', error);
            setError('Failed to load hands');
        } finally {
            setLoading(false);
        }
    };

    const handleDateChange = (e) => {
        const newDate = e.target.value;
        if (newDate) {
            setSelectedDate(newDate);
        }
    };

    const handleStackRangeChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: Number(value)
        }));
    };

    const handleHoleCardsChange = (index, value) => {
        setFilters(prev => ({
            ...prev,
            holeCards: prev.holeCards.map((card, i) => i === index ? value : card)
        }));
    };

    const handleDeleteHand = async (handId) => {
        try {
            await apiService.deleteHand(handId);
            setHands(prev => prev.filter(hand => hand.id !== handId));
        } catch (error) {
            console.error('Error deleting hand:', error);
            setError('Failed to delete hand');
        }
    };

    const handleTournamentNameChange = async (handId, newName) => {
        try {
            await apiService.updateHand(handId, { tournamentName: newName });
            setHands(prev => prev.map(hand => 
                hand.id === handId ? { ...hand, tournamentName: newName } : hand
            ));
            setEditingTournamentName(null);
        } catch (error) {
            console.error('Error updating tournament name:', error);
            setError('Failed to update tournament name');
        }
    };

    return (
        <div className="hand-history-page">
            <div className="hand-history-content">
                <h1>Hand History</h1>
                
                <div className="filters-section">
                    <div className="filter-group" key="date-filter">
                        <label>Date:</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={handleDateChange}
                            className="date-picker"
                            min="2000-01-01"
                            max="2100-12-31"
                        />
                    </div>

                    <div className="filter-group" key="stack-range">
                        <label>Stack Size (BB):</label>
                        <div className="stack-range">
                            <input
                                type="range"
                                name="maxStack"
                                min="0"
                                max="200"
                                value={filters.maxStack}
                                onChange={handleStackRangeChange}
                            />
                            <div className="stack-values">
                                <span>{filters.minStack}</span>
                                <span>{filters.maxStack}</span>
                            </div>
                        </div>
                    </div>

                    <div className="filter-group" key="hole-cards">
                        <label>Hole Cards:</label>
                        <div className="hole-cards-input">
                            <input
                                type="text"
                                value={filters.holeCards[0]}
                                onChange={(e) => handleHoleCardsChange(0, e.target.value)}
                                placeholder="Card 1"
                                maxLength={2}
                            />
                            <input
                                type="text"
                                value={filters.holeCards[1]}
                                onChange={(e) => handleHoleCardsChange(1, e.target.value)}
                                placeholder="Card 2"
                                maxLength={2}
                            />
                        </div>
                        <div className="card-format-hint">
                            Format: Ah Kd
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="loading-message">Loading hands...</div>
                ) : !selectedDate ? (
                    <div className="no-hands-message">Select a date to view hands</div>
                ) : hands.length === 0 ? (
                    <div className="no-hands-message">No hands found for this date</div>
                ) : (
                    <div className="hands-grid">
                        {hands.map(hand => (
                            <div key={hand.id} className="hand-card">
                                <div className="hand-header">
                                    <span className="hand-date">
                                        {new Date(hand.timestamp).toLocaleString(undefined, {
                                            year: 'numeric',
                                            month: 'numeric',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                    <div className="hand-actions">
                                        {editingTournamentName === hand.id ? (
                                            <input
                                                type="text"
                                                value={tournamentName}
                                                onChange={(e) => setTournamentName(e.target.value)}
                                                onBlur={() => handleTournamentNameChange(hand.id, tournamentName)}
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleTournamentNameChange(hand.id, tournamentName);
                                                    }
                                                }}
                                                className="tournament-name-input"
                                                autoFocus
                                            />
                                        ) : (
                                            <span 
                                                className="hand-game-type clickable"
                                                onClick={() => {
                                                    setEditingTournamentName(hand.id);
                                                    setTournamentName(hand.tournamentName || '');
                                                }}
                                            >
                                                {hand.tournamentName || 'Tournament'}
                                            </span>
                                        )}
                                        <button 
                                            className="delete-button"
                                            onClick={() => handleDeleteHand(hand.id)}
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>

                                <div className="hand-details">
                                    <div className="detail-column">
                                        <div className="detail-label">Stack:</div>
                                        <div className="detail-value">{hand.heroStackSize} BB</div>
                                    </div>
                                    <div className="detail-column">
                                        <div className="detail-label">Pot:</div>
                                        <div className="detail-value">{hand.potSize} BB</div>
                                    </div>
                                    <div className="detail-row">
                                        <div className="cards-display">
                                            {hand.heroHoleCards?.map((card, index) => (
                                                <div 
                                                    key={index} 
                                                    className={`card ${card[1] === 'h' ? 'hearts' : 
                                                                card[1] === 'd' ? 'diamonds' : 
                                                                card[1] === 'c' ? 'clubs' : 'spades'}`}
                                                >
                                                    <span className="card-rank">{card[0]}</span>
                                                    <span className="card-suit">
                                                        {card[1] === 'h' ? '♥' : 
                                                         card[1] === 'd' ? '♦' : 
                                                         card[1] === 'c' ? '♣' : '♠'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="hand-hover-details">
                                    <div className="hover-detail-row">
                                        <span className="hover-detail-label">Community Cards:</span>
                                        <div className="community-cards-display">
                                            {hand.communityCards?.flop?.map((card, index) => (
                                                <div 
                                                    key={index} 
                                                    className={`card ${card[1] === 'h' ? 'hearts' : 
                                                                card[1] === 'd' ? 'diamonds' : 
                                                                card[1] === 'c' ? 'clubs' : 'spades'}`}
                                                >
                                                    <span className="card-rank">{card[0]}</span>
                                                    <span className="card-suit">
                                                        {card[1] === 'h' ? '♥' : 
                                                         card[1] === 'd' ? '♦' : 
                                                         card[1] === 'c' ? '♣' : '♠'}
                                                    </span>
                                                </div>
                                            ))}
                                            {hand.communityCards?.turn && (
                                                <div 
                                                    className={`card ${hand.communityCards.turn[1] === 'h' ? 'hearts' : 
                                                                hand.communityCards.turn[1] === 'd' ? 'diamonds' : 
                                                                hand.communityCards.turn[1] === 'c' ? 'clubs' : 'spades'}`}
                                                >
                                                    <span className="card-rank">{hand.communityCards.turn[0]}</span>
                                                    <span className="card-suit">
                                                        {hand.communityCards.turn[1] === 'h' ? '♥' : 
                                                         hand.communityCards.turn[1] === 'd' ? '♦' : 
                                                         hand.communityCards.turn[1] === 'c' ? '♣' : '♠'}
                                                    </span>
                                                </div>
                                            )}
                                            {hand.communityCards?.river && (
                                                <div 
                                                    className={`card ${hand.communityCards.river[1] === 'h' ? 'hearts' : 
                                                                hand.communityCards.river[1] === 'd' ? 'diamonds' : 
                                                                hand.communityCards.river[1] === 'c' ? 'clubs' : 'spades'}`}
                                                >
                                                    <span className="card-rank">{hand.communityCards.river[0]}</span>
                                                    <span className="card-suit">
                                                        {hand.communityCards.river[1] === 'h' ? '♥' : 
                                                         hand.communityCards.river[1] === 'd' ? '♦' : 
                                                         hand.communityCards.river[1] === 'c' ? '♣' : '♠'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HandHistoryPage;