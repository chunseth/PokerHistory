import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api.service';
import './HandHistoryPage.css';

const HandHistoryPage = () => {
    const navigate = useNavigate();
    const [hands, setHands] = useState([]);
    const [sortBy, setSortBy] = useState('timestamp');
    const [filterPosition, setFilterPosition] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingTournamentName, setEditingTournamentName] = useState(null);
    const [tournamentName, setTournamentName] = useState('');
    const [filters, setFilters] = useState({
        gameType: '',
        position: '',
        minStack: 0,
        maxStack: 200,
        holeCards: ['', '']
    });

    const getPositionName = (position, numPlayers = 6) => {
        const positions = {
            2: ['BTN/SB', 'BB'],
            3: ['BTN', 'SB', 'BB'],
            4: ['BTN', 'SB', 'BB', 'UTG'],
            5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
            6: ['BTN', 'SB', 'BB', 'UTG', 'MP', 'CO'],
            7: ['BTN', 'SB', 'BB', 'UTG', 'MP', 'HJ', 'CO'],
            8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'HJ', 'CO'],
            9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO'],
            10: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO']
        };

        // For 2 players, positions are fixed
        if (numPlayers === 2) {
            return positions[2][position];
        }

        // Get the base positions for the current number of players
        const basePositions = positions[numPlayers];
        
        // Calculate the clockwise distance from the button
        // We need to reverse the order because the seats are placed counter-clockwise
        const distanceFromButton = (position + numPlayers) % numPlayers;
        
        // The position index is the distance from the button
        return basePositions[distanceFromButton] || position;
    };

    useEffect(() => {
        fetchHands();
    }, [sortBy, filterPosition, filters.maxStack, filters.holeCards]);

    const fetchHands = async () => {
        try {
            setLoading(true);
            setError(null);

            // Convert hole cards to regex patterns
            const holeCardsPattern = filters.holeCards
                .filter(card => card)
                .map(card => {
                    // If only rank is provided, match any suit
                    if (card.length === 1) {
                        return `${card}[cdhs]`;
                    }
                    return card;
                })
                .join(',');

            const apiFilters = {
                sortBy,
                position: filterPosition !== 'all' ? filterPosition : undefined,
                minStackSize: 0,
                maxStackSize: filters.maxStack,
                holeCards: holeCardsPattern || undefined
            };

            console.log('Sending filters:', apiFilters);

            const data = await apiService.getHands(apiFilters);
            setHands(data);
        } catch (error) {
            console.error('Error fetching hands:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Failed to load hands. Please try again later.';
            setError(errorMessage);
            setHands([]);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteHand = async (handId) => {
        if (window.confirm('Are you sure you want to delete this hand?')) {
            try {
                await apiService.deleteHand(handId);
                // Refresh the hands list
                fetchHands();
            } catch (error) {
                console.error('Error deleting hand:', error);
                setError('Failed to delete hand. Please try again later.');
            }
        }
    };

    const handleHandClick = (handId) => {
        navigate(`/hand-replay/${handId}`);
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

    const isValidCard = (card) => {
        if (!card || card.length !== 2) return false;
        const rank = card[0]?.toUpperCase();
        const suit = card[1]?.toLowerCase();
        const validRanks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
        const validSuits = ['c', 's', 'h', 'd'];
        return validRanks.includes(rank) && validSuits.includes(suit);
    };

    const handleHoleCardChange = (index, value) => {
        const newValue = value.toUpperCase();
        if (newValue.length > 2) return;
        
        const newHoleCards = [...filters.holeCards];
        newHoleCards[index] = newValue;
        
        setFilters(prev => ({
            ...prev,
            holeCards: newHoleCards
        }));
    };

    const handleStackChange = (e) => {
        const value = parseInt(e.target.value);
        setFilters(prev => ({
            ...prev,
            maxStack: value
        }));
    };

    const handleTournamentNameClick = (e, hand) => {
        e.stopPropagation();
        if (hand.gameType === 'tournament') {
            setEditingTournamentName(hand._id);
            setTournamentName(hand.tournamentName || '');
        }
    };

    const handleTournamentNameChange = (e) => {
        setTournamentName(e.target.value);
    };

    const handleTournamentNameSubmit = async (e, handId) => {
        e.stopPropagation();
        try {
            const updatedHand = await apiService.updateHand(handId, { tournamentName });
            if (updatedHand) {
                setEditingTournamentName(null);
                // Update the hand in the local state instead of refetching all hands
                setHands(prevHands => 
                    prevHands.map(hand => 
                        hand._id === handId 
                            ? { ...hand, tournamentName } 
                            : hand
                    )
                );
            }
        } catch (error) {
            console.error('Error updating tournament name:', error);
            setError(error.response?.data?.message || 'Failed to update tournament name');
        }
    };

    const handleTournamentNameKeyPress = (e, handId) => {
        if (e.key === 'Enter') {
            handleTournamentNameSubmit(e, handId);
        } else if (e.key === 'Escape') {
            setEditingTournamentName(null);
        }
    };

    return (
        <div className="hand-history-page">
            <div className="hand-history-content">
                <h1>Hand History</h1>
                
                <div className="filters-section">
                    <div className="filter-group" key="sort-filter">
                        <label>Sort By:</label>
                        <select 
                            value={sortBy} 
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="timestamp">Date</option>
                            <option value="stackSize">Stack Size</option>
                            <option value="potSize">Pot Size</option>
                        </select>
                    </div>

                    <div className="filter-group" key="position-filter">
                        <label>Position:</label>
                        <select 
                            value={filterPosition} 
                            onChange={(e) => setFilterPosition(e.target.value)}
                        >
                            <option value="all">All Positions</option>
                            <option value="BTN">Button</option>
                            <option value="SB">Small Blind</option>
                            <option value="BB">Big Blind</option>
                            <option value="UTG">UTG</option>
                            <option value="MP">MP</option>
                            <option value="CO">Cutoff</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>Stack Size (BB)</label>
                        <div className="stack-range">
                            <input
                                type="range"
                                min="1"
                                max="200"
                                value={filters.maxStack}
                                onChange={handleStackChange}
                            />
                            <div className="stack-values">
                                <span>0</span>
                                <span>{filters.maxStack}</span>
                            </div>
                        </div>
                    </div>

                    <div className="filter-group" key="hole-cards-filter">
                        <label>Hole Cards:</label>
                        <div className="hole-cards-input">
                            <input
                                type="text"
                                value={filters.holeCards[0]}
                                onChange={(e) => handleHoleCardChange(0, e.target.value)}
                                placeholder="1st card (e.g., Ah)"
                                maxLength={2}
                            />
                            <input
                                type="text"
                                value={filters.holeCards[1]}
                                onChange={(e) => handleHoleCardChange(1, e.target.value)}
                                placeholder="2nd card (e.g., Kd)"
                                maxLength={2}
                            />
                        </div>
                        <div className="card-format-hint">
                            Valid format: 2-9, T, J, Q, K, A followed by c, s, h, d
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
                    <div className="no-hands-message">No hands found matching your criteria</div>
                ) : (
                    <div className="hands-grid">
                        {hands.map(hand => (
                            <div 
                                key={hand._id} 
                                className="hand-card"
                                onClick={() => handleHandClick(hand._id)}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="hand-header">
                                    <span className="hand-date">
                                        {new Date(hand.timestamp).toLocaleDateString()}
                                    </span>
                                    <div className="hand-actions">
                                        {editingTournamentName === hand._id ? (
                                            <input
                                                type="text"
                                                value={tournamentName}
                                                onChange={handleTournamentNameChange}
                                                onKeyDown={(e) => handleTournamentNameKeyPress(e, hand._id)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="tournament-name-input"
                                                placeholder="Enter tournament name"
                                                autoFocus
                                            />
                                        ) : (
                                            <span 
                                                className={`hand-game-type ${hand.gameType === 'tournament' ? 'clickable' : ''}`}
                                                onClick={(e) => handleTournamentNameClick(e, hand)}
                                            >
                                                {hand.gameType === 'tournament' && hand.tournamentName 
                                                    ? hand.tournamentName 
                                                    : hand.gameType.toUpperCase()}
                                            </span>
                                        )}
                                        <button 
                                            className="delete-button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteHand(hand._id);
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="hand-details">
                                    <div className="detail-row" key="position">
                                        <span className="detail-label">Position:</span>
                                        <span className="detail-value">{getPositionName(hand.heroPosition, hand.numPlayers)}</span>
                                    </div>
                                    <div className="detail-row" key="stack">
                                        <span className="detail-label">Stack:</span>
                                        <span className="detail-value">{hand.heroStackSize}BB</span>
                                    </div>
                                    <div className="detail-row" key="hole-cards">
                                        <span className="detail-label">Hole Cards:</span>
                                        <div className="cards-display">
                                            {hand.heroHoleCards.map((card, index) => (
                                                <div key={`${hand._id}-card-${index}`}>
                                                    {renderCard(card)}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="hand-hover-details">
                                    <div className="hover-detail-row" key="community-cards">
                                        <span className="hover-detail-label">Community Cards:</span>
                                        <div className="community-cards-display">
                                            {hand.communityCards.flop.map((card, index) => (
                                                <div key={`${hand._id}-flop-${index}`}>
                                                    {renderCard(card)}
                                                </div>
                                            ))}
                                            {hand.communityCards.turn && (
                                                <div key={`${hand._id}-turn`}>
                                                    {renderCard(hand.communityCards.turn)}
                                                </div>
                                            )}
                                            {hand.communityCards.river && (
                                                <div key={`${hand._id}-river`}>
                                                    {renderCard(hand.communityCards.river)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="hover-detail-row" key="pot-size">
                                        <span className="hover-detail-label">Pot Size:</span>
                                        <span className="hover-detail-value">{hand.potSize}BB</span>
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