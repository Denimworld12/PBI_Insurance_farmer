
import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Header = () => {
    const { isAuthenticated, user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (path) => {
        return location.pathname === path ? 'nav-link active' : 'nav-link';
    };

    return (
        <header className="header">
            <div className="header-container">
                <div className="logo">
                    <Link to="/" className="logo-link">
                        🌾 PBI AgriInsure
                    </Link>
                </div>

                {isAuthenticated && (
                    <nav className="nav-menu">
                        <Link to="/" className={isActive('/')}>
                            🏠 Dashboard
                        </Link>
                        <Link to="/claims" className={isActive('/claims')}>
                            📋 Claims
                        </Link>
                    </nav>
                )}

                {isAuthenticated && (
                    <div className="user-menu">
                        <div className="user-info">
                            <span className="user-phone">📱 {user?.phoneNumber}</span>
                        </div>
                        <button onClick={handleLogout} className="logout-btn">
                            🚪 Logout
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
};

export default Header;
