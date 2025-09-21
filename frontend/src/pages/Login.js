
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

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
        try {
            const response = await api.post('/auth/send-otp', { phoneNumber });
            if (response.data.success) {
                setStep(2);
                setError('');
            }
        } catch (error) {
            setError(error.response?.data?.error || 'Failed to send OTP');
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
        try {
            const response = await api.post('/auth/verify-otp', { phoneNumber, otp });
            if (response.data.success) {
                login(response.data.token, response.data.user);
                navigate(from, { replace: true });
            }
        } catch (error) {
            setError(error.response?.data?.error || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h1>🌾 PBI AgriInsure</h1>
                <p>Agriculture Insurance Made Simple</p>

                {step === 1 ? (
                    <form onSubmit={handleSendOTP}>
                        <h2>Login with Mobile Number</h2>
                        <div className="phone-input">
                            <span>+91</span>
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="Enter 10-digit mobile number"
                                maxLength="10"
                                required
                            />
                        </div>
                        {error && <div className="error-message">{error}</div>}
                        <button type="submit" disabled={loading}>
                            {loading ? 'Sending...' : 'Send OTP'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyOTP}>
                        <h2>Enter Verification Code</h2>
                        <p>Enter the 6-digit code sent to +91 {phoneNumber}</p>
                        <input
                            type="text"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            placeholder="000000"
                            maxLength="6"
                            required
                        />
                        {error && <div className="error-message">{error}</div>}
                        <button type="submit" disabled={loading}>
                            {loading ? 'Verifying...' : 'Verify & Login'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Login;
