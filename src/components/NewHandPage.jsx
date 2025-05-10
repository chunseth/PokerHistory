import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PokerTable from './PokerTable';
import apiService from '../services/api.service';
import './NewHandPage.css';

const NewHandPage = () => {
    const navigate = useNavigate();
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);
    const [error, setError] = useState(null);

    const handleHandComplete = async (handData) => {
        try {
            console.log('Saving hand data:', handData);
            const savedHand = await apiService.createHand(handData);
            console.log('Hand saved successfully:', savedHand);
            
            // Show success message
            setShowSaveSuccess(true);
            setError(null);
            
            navigate('/hand-history');
        } catch (error) {
            console.error('Error saving hand:', error);
            setError(error.response?.data?.message || 'Failed to save hand. Please try again.');
            setShowSaveSuccess(false);
        }
    };

    return (
        <div className="new-hand-page">
            {showSaveSuccess && (
                <div className="save-success-alert">
                    Hand saved successfully!
                </div>
            )}
            {error && (
                <div className="error-alert">
                    {error}
                </div>
            )}
            <PokerTable onHandComplete={handleHandComplete} />
        </div>
    );
};

export default NewHandPage; 