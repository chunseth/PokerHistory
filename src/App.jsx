import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import NewHandPage from './components/NewHandPage';
import HandHistoryPage from './components/HandHistoryPage';
import HandReplayPage from './components/HandReplayPage';
import ImportHandsPage from './components/ImportHandsPage';
import PlayerStats from './components/PlayerStats';
import Navbar from './components/Navbar';
import './App.css';

function App() {
    return (
        <Router>
            <div className="app">
                <Navbar />
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/new-hand" element={<NewHandPage />} />
                    <Route path="/hand-history" element={<HandHistoryPage />} />
                    <Route path="/hand-replay/:handId" element={<HandReplayPage />} />
                    <Route path="/import-hands" element={<ImportHandsPage />} />
                    <Route path="/stats/:username" element={<PlayerStats />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App; 