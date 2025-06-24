import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import statsService from '../services/stats.service';
import './PlayerStats.css';

const PlayerStats = () => {
    const { username } = useParams();
    const [stats, setStats] = useState({
        totalHands: 0,
        totalProfit: 0,
        winRate: 0,
        vpip: 0,
        pfr: 0,
        threeBet: 0,
        positionStats: {},
        streetStats: {
            preflop: { win: 0, loss: 0 },
            flop: { win: 0, loss: 0 },
            turn: { win: 0, loss: 0 },
            river: { win: 0, loss: 0 }
        },
        handStrength: {
            premium: { count: 0, win: 0 },
            strong: { count: 0, win: 0 },
            medium: { count: 0, win: 0 },
            weak: { count: 0, win: 0 }
        }
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchStats = async () => {
        try {
            setLoading(true);
            setError(null);
            const statsData = await statsService.calculateAllStats(username);
            setStats(statsData);
        } catch (err) {
            setError(err.message || 'Failed to load player statistics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (username) {
            fetchStats();
        }
    }, [username]);

    const renderPositionStats = () => {
        return Object.entries(stats.positionStats).map(([position, data]) => (
            <div key={position} className="position-stat">
                <h4>{position}</h4>
                <div className="stat-grid">
                    <div className="stat-item">
                        <span className="stat-label">Hands</span>
                        <span className="stat-value">{data.hands}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Win Rate</span>
                        <span className="stat-value">{(data.winRate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Profit</span>
                        <span className="stat-value">{data.profit.toFixed(2)} BB</span>
                    </div>
                </div>
            </div>
        ));
    };

    const renderStreetStats = () => {
        return Object.entries(stats.streetStats).map(([street, data]) => (
            <div key={street} className="street-stat">
                <h4>{street.charAt(0).toUpperCase() + street.slice(1)}</h4>
                <div className="stat-grid">
                    <div className="stat-item">
                        <span className="stat-label">Win Rate</span>
                        <span className="stat-value">
                            {((data.win / (data.win + data.loss)) * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Wins</span>
                        <span className="stat-value">{data.win}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Losses</span>
                        <span className="stat-value">{data.loss}</span>
                    </div>
                </div>
            </div>
        ));
    };

    const renderHandStrengthStats = () => {
        return Object.entries(stats.handStrength).map(([strength, data]) => (
            <div key={strength} className="hand-strength-stat">
                <h4>{strength.charAt(0).toUpperCase() + strength.slice(1)}</h4>
                <div className="stat-grid">
                    <div className="stat-item">
                        <span className="stat-label">Win Rate</span>
                        <span className="stat-value">
                            {((data.win / data.count) * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Count</span>
                        <span className="stat-value">{data.count}</span>
                    </div>
                </div>
            </div>
        ));
    };

    if (loading) {
        return (
            <div className="player-stats-container">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Loading statistics...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="player-stats-container">
                <div className="error-message">
                    <h2>Error</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="player-stats-container">
            <div className="stats-header">
                <h1>{username}'s Statistics</h1>
                <button 
                    className="refresh-button"
                    onClick={fetchStats}
                    disabled={loading}
                >
                    {loading ? 'Refreshing...' : 'Refresh Stats'}
                </button>
            </div>
            
            <div className="overall-stats">
                <div className="stat-card">
                    <h3>Overall Performance</h3>
                    <div className="stat-grid">
                        <div className="stat-item">
                            <span className="stat-label">Total Hands</span>
                            <span className="stat-value">{stats.totalHands}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Win Rate</span>
                            <span className="stat-value">{(stats.winRate * 100).toFixed(1)}%</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Total Profit</span>
                            <span className="stat-value">{stats.totalProfit.toFixed(2)} BB</span>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <h3>Preflop Stats</h3>
                    <div className="stat-grid">
                        <div className="stat-item">
                            <span className="stat-label">VPIP</span>
                            <span className="stat-value">{(stats.vpip * 100).toFixed(1)}%</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">PFR</span>
                            <span className="stat-value">{(stats.pfr * 100).toFixed(1)}%</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">3-Bet</span>
                            <span className="stat-value">{(stats.threeBet * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="detailed-stats">
                <div className="stat-section">
                    <h2>Position Statistics</h2>
                    <div className="position-stats-grid">
                        {renderPositionStats()}
                    </div>
                </div>

                <div className="stat-section">
                    <h2>Street Statistics</h2>
                    <div className="street-stats-grid">
                        {renderStreetStats()}
                    </div>
                </div>

                <div className="stat-section">
                    <h2>Hand Strength Statistics</h2>
                    <div className="hand-strength-stats-grid">
                        {renderHandStrengthStats()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayerStats; 