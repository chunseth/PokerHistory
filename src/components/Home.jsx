import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

const Home = () => {
    const navigate = useNavigate();

    return (
        <div className="home-container">
            <div className="home-content">
                <h1>Poker Hand History</h1>
                <div className="navigation-cards">
                    <div 
                        className="nav-card"
                        onClick={() => navigate('/new-hand')}
                    >
                        <h2>Record New Hand</h2>
                        <p>Enter details of a new poker hand</p>
                        <div className="card-icon">📝</div>
                    </div>
                    <div 
                        className="nav-card"
                        onClick={() => navigate('/hand-history')}
                    >
                        <h2>View Hand History</h2>
                        <p>Review your saved poker hands</p>
                        <div className="card-icon">📊</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home; 