import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import './Login.css';

const Login = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const handleSendOTP = async (e) => {
    e.preventDefault();
    
    if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await api.post('/auth/send-otp', { phoneNumber });
      
      if (response.data.success) {
        setStep(2);
        setError('');
        console.log('✅ OTP sent successfully');
      }
    } catch (error) {
      console.error('❌ Failed to send OTP:', error);
      const errorMessage = error.response?.data?.error || 
        error.response?.data?.message || 
        'Failed to send OTP. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    
    if (otp.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await api.post('/auth/verify-otp', { phoneNumber, otp });
      
      if (response.data.success) {
        login(response.data.token, response.data.user);
        console.log('✅ Login successful');
        navigate(from, { replace: true });
      }
    } catch (error) {
      console.error('❌ OTP verification failed:', error);
      const errorMessage = error.response?.data?.error || 
        error.response?.data?.message || 
        'Invalid OTP. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeNumber = () => {
    setStep(1);
    setOtp('');
    setError('');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand-header">
          <img 
            src="/images/government-emblem.png" 
            alt="Government Emblem"
            loading="lazy"
          />
          <h1>🌾 PBI AgriInsure</h1>
          <p>Ministry of Agriculture & Farmers Welfare</p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleSendOTP} className="login-form">
            <h2>Login with Mobile Number</h2>
            <div className="phone-input">
              <span>+91</span>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 10-digit mobile number"
                maxLength="10"
                pattern="[6-9][0-9]{9}"
                required
                autoFocus
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
            <p className="login-info">
              You will receive a 6-digit verification code
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="login-form">
            <h2>Enter Verification Code</h2>
            <p className="otp-info">We've sent a 6-digit OTP to +91 {phoneNumber}</p>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter OTP"
              maxLength="6"
              pattern="[0-9]{6}"
              className="otp-input"
              required
              autoFocus
            />
            {error && <div className="error-message">{error}</div>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>
            <button 
              type="button" 
              className="btn-link" 
              onClick={handleChangeNumber}
              disabled={loading}
            >
              Change Number
            </button>
          </form>
        )}
      </div>

      <footer className="login-footer">
        <p>© 2025 Government of India | Digital Agriculture Mission</p>
      </footer>
    </div>
  );
};

export default Login;
