import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiService from '../services/api.service';
import HandReplay from './HandReplay';
import './HandReplayPage.css';

const HandReplayPage = () => {
    const { handId } = useParams();
    const navigate = useNavigate();
    const [handData, setHandData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchHand = async () => {
            try {
                setLoading(true);
                setError(null);
                console.log('Fetching hand with ID:', handId);
                const data = await apiService.getHand(handId);
                console.log('Fetched hand data:', JSON.stringify(data, null, 2));
                setHandData(data);

                // Mark the hand as viewed
                if (!data.viewed) {
                    await apiService.updateHand(handId, { viewed: true });
                }
            } catch (error) {
                console.error('Error fetching hand:', error);
                setError('Failed to load hand. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchHand();
    }, [handId]);

    if (loading) {
        return <div className="loading-message">Loading hand...</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    if (!handData) {
        return <div className="error-message">Hand not found</div>;
    }

    return (
        <div className="hand-replay-page">
            <div className="hand-replay-header">
                <button 
                    className="back-button"
                    onClick={() => navigate('/hand-history')}
                >
                    ←
                </button>
                <div className="title-container">
                    <h1>Hand Replay</h1>
                </div>
            </div>
            <HandReplay handData={handData} />
        </div>
    );
};

export default HandReplayPage; 