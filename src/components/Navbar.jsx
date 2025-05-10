import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
    const location = useLocation();

    return (
        <nav className="navbar">
            <div className="nav-content">
                <Link to="/" className="nav-logo">
                    Poker History
                </Link>
                <div className="nav-links">
                    <Link 
                        to="/hand-history" 
                        className={`nav-link ${location.pathname === '/hand-history' ? 'active' : ''}`}
                    >
                        Hand History
                    </Link>
                    <Link 
                        to="/new-hand" 
                        className={`nav-link ${location.pathname === '/new-hand' ? 'active' : ''}`}
                    >
                        New Hand
                    </Link>
                </div>
            </div>
        </nav>
    );
};

export default Navbar; 