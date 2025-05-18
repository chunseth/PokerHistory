import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Home.css';
import cardBack from '../assets/BackOfCard.png';

const HomePage = () => {
    const heroCardsRef = React.useRef(null);
    const [forceUpdate, setForceUpdate] = useState(0);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Generate cards synchronously
    if (!heroCardsRef.current) {
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
        const suits = ['c', 's', 'h', 'd'];
        const usedCards = new Set();
        const newHeroCards = [];

        // Generate exactly 2 random cards for hero
        while (newHeroCards.length < 2) {
            const rank = ranks[Math.floor(Math.random() * ranks.length)];
            const suit = suits[Math.floor(Math.random() * suits.length)];
            const card = rank + suit;
            
            if (!usedCards.has(card)) {
                usedCards.add(card);
                newHeroCards.push(card);
                console.log('Generated card:', card);
            }
        }

        console.log('Final hero cards:', newHeroCards);
        heroCardsRef.current = newHeroCards;
        // Force a re-render after cards are generated
        setForceUpdate(prev => prev + 1);
    }

    const renderCard = (card) => {
        console.log('Rendering card:', card);
        if (!card) {
            console.log('Card is null or empty');
            return null;
        }
        const rank = card[0]?.toUpperCase() || '';
        const suit = card[1]?.toLowerCase() || '';
        console.log('Card parsed - Rank:', rank, 'Suit:', suit);
        
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

        // Convert T to 10 for display only
        const displayRank = rank === 'T' ? '10' : rank;

        return (
            <div className={`home-card ${colorClass}`}>
                <div className="home-card-rank">{displayRank}</div>
                <div className="home-card-suit">{suitSymbol}</div>
            </div>
        );
    };

    const renderSeats = () => {
        console.log('Current hero cards:', heroCardsRef.current);
        const seats = [];
        
        // Adjust dimensions based on screen size
        const centerX = isMobile ? 180 : 303; // Half of table width
        const centerY = isMobile ? 155 : 240; // Half of table height
        const radius = isMobile ? 90 : 155; // Distance from center to seats
        
        for (let i = 0; i < 6; i++) {
            const angleStep = (2 * Math.PI) / 6;
            const angle = -((angleStep * i) - Math.PI/2);
            
            const x = centerX + 1.6 * radius * Math.cos(angle);
            const y = centerY + 0.9 * radius * Math.sin(angle);

            const position = ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'][i];
            const isHero = i === 0; // First player (BTN) is now hero

            if (isHero) {
                console.log('Rendering hero seat with cards:', heroCardsRef.current);
            }

            seats.push(
                <div
                    key={i}
                    className="home-seat"
                    style={{
                        position: 'absolute',
                        left: `${x - (isMobile ? 12 : 15)}px`,
                        top: `${y - (isMobile ? 12 : 15)}px`,
                    }}
                >
                    <div className="home-player-cards">
                        {isHero ? (
                            heroCardsRef.current ? (
                                <div style={{ display: 'flex', gap: '2px' }}>
                                    {heroCardsRef.current.map((card, index) => (
                                        <div key={index} className="home-card-container">
                                            {renderCard(card)}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    <div className="home-card-container">
                                        <img src={cardBack} alt="Card Back" className="home-card-back" />
                                    </div>
                                    <div className="home-card-container">
                                        <img src={cardBack} alt="Card Back" className="home-card-back" />
                                    </div>
                                </>
                            )
                        ) : (
                            <>
                                <div className="home-card-container">
                                    <img src={cardBack} alt="Card Back" className="home-card-back" />
                                </div>
                                <div className="home-card-container">
                                    <img src={cardBack} alt="Card Back" className="home-card-back" />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            );
        }
        return seats;
    };

    return (
        <div className="home-container">
            <div className="home-poker-table">
                <div className="home-table-container">
                    <div className="home-table-content">
                        <h1>PokerHistory.pro</h1>
                    </div>
                    {renderSeats()}
                </div>
            </div>

            <div className="home-controls">
                <div className="action-buttons">
                    <Link to="/new-hand" className="action-button">
                        New Hand
                        <span className="tooltip">Manually input custom hands</span>
                    </Link>
                    <Link to="/hand-history" className="action-button">
                        Hand History
                        <span className="tooltip">Replay your hands to find the weak spots in your game</span>
                    </Link>
                    <Link to="/import-hands" className="action-button">
                        Import Hands
                        <span className="tooltip">Upload ACR hand history files</span>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default HomePage; 
