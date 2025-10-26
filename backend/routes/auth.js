const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendOTP, isValidPhoneNumber } = require('../utils/smsService');
const router = express.Router();

// JWT Secret with fallback
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '30d';

/**
 * Send OTP for login/signup
 * POST /api/auth/send-otp
 */
router.post('/send-otp', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    // Validate phone number
    if (!phoneNumber || !isValidPhoneNumber(phoneNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Valid 10-digit Indian mobile number required (6-9 start)'
      });
    }

    // Find or create user
    let user = await User.findOne({ phoneNumber }).select('+otp +otpExpiry');
    
    if (!user) {
      user = new User({ 
        phoneNumber,
        isVerified: false,
        createdAt: new Date()
      });
      console.log(`📝 New user created: ${phoneNumber}`);
    } else {
      console.log(`👤 Existing user: ${phoneNumber}`);
    }

    // Generate OTP
    const otp = user.generateOTP();
    await user.save();

    console.log(`🔐 OTP generated for ${phoneNumber}: ${otp}`);

    // Send SMS
    const smsResult = await sendOTP(phoneNumber, otp);

    if (!smsResult.success && process.env.NODE_ENV === 'production') {
      console.error('❌ SMS sending failed in production:', smsResult);
      // In production, we might want to fail if SMS doesn't send
      // For now, we'll log but continue
    }

    // Response
    const response = {
      success: true,
      message: 'OTP sent successfully',
      expiresIn: '10 minutes'
    };

    // Include OTP only in development mode
    if (process.env.NODE_ENV === 'development') {
      response.devOTP = otp;
      response.devNote = 'OTP included for development only';
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Send OTP error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send OTP',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Verify OTP and login
 * POST /api/auth/verify-otp
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    // Validate inputs
    if (!phoneNumber || !otp) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number and OTP required' 
      });
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format'
      });
    }

    // Find user
    const user = await User.findOne({ phoneNumber }).select('+otp +otpExpiry');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found. Please request OTP first.' 
      });
    }

    // Verify OTP
    if (!user.verifyOTP(otp)) {
      console.log(`❌ Invalid OTP attempt for ${phoneNumber}`);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid or expired OTP' 
      });
    }

    console.log(`✅ OTP verified for ${phoneNumber}`);

    // Mark user as verified
    user.isVerified = true;
    user.lastLoginAt = new Date();
    user.clearOTP();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        phoneNumber: user.phoneNumber,
        isVerified: true
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    console.log(`🎫 Token generated for ${phoneNumber}`);

    // Send response
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: user.toSafeObject(),
      expiresIn: JWT_EXPIRY
    });

  } catch (error) {
    console.error('❌ Verify OTP error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to verify OTP',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Verify JWT token (optional - for token refresh)
 * GET /api/auth/verify-token
 */
router.get('/verify-token', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: user.toSafeObject(),
      tokenValid: true
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }

    console.error('❌ Token verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify token'
    });
  }
});

/**
 * Logout (optional - mainly for cleanup)
 * POST /api/auth/logout
 */
router.post('/logout', async (req, res) => {
  try {
    // In a stateless JWT system, logout is handled client-side
    // But we can log it for analytics
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log(`👋 User logged out: ${decoded.phoneNumber}`);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    // Even if token is invalid, we return success for logout
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
});

module.exports = router;
