import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
    const location = useLocation();

    const isActive = (path) => {
        return location.pathname === path;
    };

    return (
        <nav className="navbar">
            <div className="nav-content">
                <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
                    Home
                </Link>
                <Link to="/new-hand" className={`nav-link ${isActive('/new-hand') ? 'active' : ''}`}>
                    New Hand
                </Link>
                <Link to="/hand-history" className={`nav-link ${isActive('/hand-history') ? 'active' : ''}`}>
                    Hand History
                </Link>
                <Link to="/import-hands" className={`nav-link ${isActive('/import-hands') ? 'active' : ''}`}>
                    Import Hands
                </Link>
                <Link to="/stats/grotle" className={`nav-link ${isActive('/stats/grotle') ? 'active' : ''}`}>
                    Statistics
                </Link>
            </div>
        </nav>
    );
};

export default Navbar; 