import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './header.css';

const Header = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setDropdownOpen(false);
  };

  const isActive = (path) => {
    return location.pathname === path ? 'nav-link active' : 'nav-link';
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [dropdownOpen]);

  return (
    <header className="header">
      <div className="header-container">
        <div className="logo">
          <Link to="/" className="logo-link">
            <span className="logo-ring">
              <img
                src={user?.avatarUrl || "/images/insurace.png"}
                alt="PBI AgriInsure"
                className="logo-img"
              />
            </span>
            <span className="logo-text">PBI AgriInsure</span>
          </Link>
        </div>

        {isAuthenticated && (
          <nav className="nav-menu">
            <Link to="/" className={isActive('/')}>
              Dashboard
            </Link>
            <Link to="/claims" className={isActive('/claims')}>
              Claims
            </Link>
            <Link to="/about-us" className={isActive('/about-us')}>
              About Us
            </Link>
            <Link to="/pricing" className={isActive('/pricing')}>
              Pricing
            </Link>
          </nav>
        )}

        {isAuthenticated && (
  <div className="relative" ref={dropdownRef}>
    <button
      onClick={() => setDropdownOpen(!dropdownOpen)}
      className="flex items-center gap-2 text-white hover:text-gray-100"
      aria-expanded={dropdownOpen}
      aria-haspopup="true"
      aria-label="User account menu"
    >
      <span className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-green-700 font-semibold">
        {user?.phoneNumber?.slice(-2) || 'U'}
      </span>
      <span className="text-sm font-medium">Account</span>
      <span className="material-symbols-outlined text-xl transition-transform duration-200"
        style={{ transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
        expand_more
      </span>
    </button>

    {dropdownOpen && (
      <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg text-gray-800 z-50 p-2">
        {/* Header */}
        <div className="flex items-center gap-3 p-3 border-b border-gray-200">
          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-green-600 text-white text-lg font-bold">
            {user?.phoneNumber?.slice(-2) || 'U'}
          </div>
          <div>
            <p className="font-semibold">Account</p>
            <p className="text-sm text-gray-500">{user?.phoneNumber}</p>
          </div>
        </div>

        {/* Menu items */}
        <div className="py-1">
          <Link
            to="/profile"
            className="flex items-center gap-3 px-3 py-2 hover:bg-green-50 rounded-lg"
            onClick={() => setDropdownOpen(false)}
          >
            <span className="material-symbols-outlined text-green-600">person</span>
            <span>My Profile</span>
          </Link>

          <Link
            to="/settings"
            className="flex items-center gap-3 px-3 py-2 hover:bg-green-50 rounded-lg"
            onClick={() => setDropdownOpen(false)}
          >
            <span className="material-symbols-outlined text-green-600">settings</span>
            <span>Settings</span>
          </Link>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 my-2"></div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center w-full gap-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
        >
          <span className="material-symbols-outlined">logout</span>
          <span>Logout</span>
        </button>
      </div>
    )}
  </div>
)}

      </div>
    </header>
  );
};

export default Header;
