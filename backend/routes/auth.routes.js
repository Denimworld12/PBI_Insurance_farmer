const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User.model.js'); // FIXED PATH
const { sendSMS } = require('../utils/smsService');
const router = express.Router();

// Send OTP for login
router.post('/send-otp', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber || !/^[6-9]\d{9}$/.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Valid 10-digit Indian mobile number required'
      });
    }

    let user = await User.findOne({ phoneNumber }).select('+otp +otpExpiry');
    if (!user) {
      user = new User({ phoneNumber });
    }

    const otp = user.generateOTP(); // This method now exists
    await user.save();

    // Send SMS via Twilio
    const message = `Your PBI AgriInsure verification code is: ${otp}. Valid for 10 minutes.`;
    const smsResult = await sendSMS(phoneNumber, message);

    if (!smsResult.success) {
      console.log('SMS sending failed, but continuing in development mode');
    }

    res.json({
      success: true,
      message: 'OTP sent successfully',
      // Include OTP in development mode only
      ...(process.env.NODE_ENV === 'development' && { devOTP: otp })
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ success: false, error: 'Failed to send OTP' });
  }
});

// Verify OTP and login
router.post('/verify-otp', async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    const user = await User.findOne({ phoneNumber }).select('+otp +otpExpiry');
    if (!user) {
      return res.status(400).json({ success: false, error: 'User not found' });
    }

    if (!user.verifyOTP(otp)) {
      return res.status(400).json({ success: false, error: 'Invalid or expired OTP' });
    }

    user.clearOTP();
    await user.save();

    const token = jwt.sign(
      { userId: user._id, phoneNumber: user.phoneNumber },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: user.toSafeObject() // Using the safe method
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify OTP' });
  }
});

module.exports = router;
