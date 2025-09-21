import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const Dashboard = () => {
    const [insurances, setInsurances] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        // Mock data for development
        setInsurances([
            {
                _id: '1',
                name: 'Pradhan Mantri Fasal Bima Yojana',
                type: 'crop',
                shortDescription: 'Comprehensive crop insurance for all farmers',
                imageUrl: '/insurance1.jpg',
                schemes: [{ name: 'Basic Coverage' }]
            },
            {
                _id: '2',
                name: 'Weather Based Crop Insurance',
                type: 'weather',
                shortDescription: 'Protection against adverse weather conditions',
                imageUrl: '/insurance2.jpg',
                schemes: [{ name: 'Weather Shield' }]
            }
        ]);
        setLoading(false);
    }, []);

    const filteredInsurances = insurances.filter(insurance =>
        insurance.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="dashboard">
            <div className="hero-section">
                <h1>🌾 Welcome to PBI AgriInsure</h1>
                <p>We provide photo- and video-based agriculture insurance to help farmers claim crop loss quickly and securely.</p>
            </div>

            <div className="dashboard-actions">
                <button onClick={() => navigate('/claims')} className="action-btn">
                    📋 View My Claims
                </button>
                <button className="action-btn">📞 Contact Support</button>
            </div>

            <div className="insurance-section">
                <h2>Available Insurance Plans</h2>
                <input
                    type="text"
                    placeholder="🔍 Search insurance plans..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                />

                <div className="insurance-grid">
                    {filteredInsurances.map((insurance) => (
                        <div
                            key={insurance._id}
                            className="insurance-card"
                            onClick={() => navigate(`/claim-form/${insurance._id}`)}
                        >
                            <h3>{insurance.name}</h3>
                            <p>{insurance.shortDescription}</p>
                            <span>{insurance.schemes?.length || 0} Schemes Available</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
