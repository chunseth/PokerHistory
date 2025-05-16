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
    const [deleteConfirmation, setDeleteConfirmation] = useState({ show: false, handId: null });
    const [filters, setFilters] = useState({
        gameType: '',
        minStack: 0,
        maxStack: 200,
        holeCards: ['', ''],
        tournamentName: ''
    });

    useEffect(() => {
        fetchHands();
    }, [selectedDate, filters.maxStack, filters.holeCards, filters.tournamentName]);

    const fetchHands = async () => {
        try {
            setLoading(true);
            let queryParams = {
                minStackSize: filters.minStack,
                maxStackSize: filters.maxStack,
                holeCards: filters.holeCards.join(','),
                gameType: filters.gameType,
                tournamentName: filters.tournamentName
            };

            if (selectedDate) {
                const [year, month, day] = selectedDate.split('-').map(Number);
                const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
                const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
                queryParams.startDate = startDate.toISOString();
                queryParams.endDate = endDate.toISOString();
            }

            console.log('Fetching hands with params:', queryParams);

            const response = await apiService.getHands(queryParams);
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
        // Only allow valid card ranks (2-9, T, J, Q, K, A) and suits (h, d, c, s)
        const validRank = /^[2-9TJQKA]$/i;
        const validSuit = /^[hdcs]$/i;
        
        // If it's a single character, check if it's a valid rank
        if (value.length === 1 && !validRank.test(value)) {
            // Reset the field if invalid rank
            setFilters(prev => ({
                ...prev,
                holeCards: prev.holeCards.map((card, i) => i === index ? '' : card)
            }));
            return;
        }
        
        // If it's two characters, check if it's a valid rank and suit
        if (value.length === 2) {
            const rank = value[0].toUpperCase();
            const suit = value[1].toLowerCase();
            if (!validRank.test(rank) || !validSuit.test(suit)) {
                // Reset the field if invalid rank or suit
                setFilters(prev => ({
                    ...prev,
                    holeCards: prev.holeCards.map((card, i) => i === index ? '' : card)
                }));
                return;
            }
        }
        
        // If we get here, the input is valid
        setFilters(prev => ({
            ...prev,
            holeCards: prev.holeCards.map((card, i) => i === index ? value : card)
        }));
    };

    const handleDeleteClick = (handId) => {
        setDeleteConfirmation({ show: true, handId });
    };

    const handleDeleteConfirm = async () => {
        try {
            const response = await apiService.deleteHand(deleteConfirmation.handId);
            if (response.deletedHand) {
                setHands(prev => prev.filter(hand => hand._id !== deleteConfirmation.handId));
            } else {
                setError('Failed to delete hand: No confirmation from server');
            }
        } catch (error) {
            console.error('Error deleting hand:', error);
            setError(error.response?.data?.message || 'Failed to delete hand');
        } finally {
            setDeleteConfirmation({ show: false, handId: null });
        }
    };

    const handleDeleteCancel = () => {
        setDeleteConfirmation({ show: false, handId: null });
    };

    const handleTournamentNameChange = async (handId, newName) => {
        try {
            await apiService.updateHand(handId, { tournamentName: newName });
            setHands(prev => prev.map(hand => 
                hand._id === handId ? { ...hand, tournamentName: newName } : hand
            ));
            setEditingTournamentName(null);
        } catch (error) {
            console.error('Error updating tournament name:', error);
            setError('Failed to update tournament name');
        }
    };

    const handleTournamentNameSearch = (e) => {
        setFilters(prev => ({
            ...prev,
            tournamentName: e.target.value
        }));
    };

    return (
        <div className="hand-history-page">
            <div className="hand-history-content">
                <h1>Hand History</h1>
                
                <div className="filters-section">
                    <div className="filters-row">
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

                    <div className="filters-row">
                        <div className="filter-group tournament-search" key="tournament-search">
                            <label>Tournament Name:</label>
                            <input
                                type="text"
                                value={filters.tournamentName}
                                onChange={handleTournamentNameSearch}
                                placeholder="Search by tournament name"
                                className="tournament-search-input"
                            />
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
                ) : hands.length === 0 ? (
                    <div className="no-hands-message">
                        {!selectedDate && !filters.tournamentName ? 
                            "Select a date or enter a tournament name to view hands" :
                            "No hands found matching your criteria"}
                    </div>
                ) : (
                    <div className="hands-grid">
                        {hands.map(hand => (
                            <div key={hand._id} className="hand-card">
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
                                        {editingTournamentName === hand._id ? (
                                            <input
                                                type="text"
                                                value={tournamentName}
                                                onChange={(e) => setTournamentName(e.target.value)}
                                                onBlur={() => handleTournamentNameChange(hand._id, tournamentName)}
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleTournamentNameChange(hand._id, tournamentName);
                                                    }
                                                }}
                                                className="tournament-name-input"
                                                autoFocus
                                            />
                                        ) : (
                                            <span 
                                                className="hand-game-type clickable"
                                                onClick={() => {
                                                    setEditingTournamentName(hand._id);
                                                    setTournamentName(hand.tournamentName || '');
                                                }}
                                            >
                                                {hand.tournamentName || 'Tournament'}
                                            </span>
                                        )}
                                        <button 
                                            className="delete-button"
                                            onClick={() => handleDeleteClick(hand._id)}
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

                {deleteConfirmation.show && (
                    <div className="confirmation-dialog-overlay">
                        <div className="confirmation-dialog">
                            <h3>Confirm Deletion</h3>
                            <p>Are you sure you want to delete this hand? This action cannot be undone.</p>
                            <div className="confirmation-buttons">
                                <button 
                                    className="confirm-button"
                                    onClick={handleDeleteConfirm}
                                >
                                    Delete
                                </button>
                                <button 
                                    className="cancel-button"
                                    onClick={handleDeleteCancel}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HandHistoryPage;