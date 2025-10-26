const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT Secret with fallback
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
const auth = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.header('Authorization');
        
        if (!authHeader) {
            return res.status(401).json({ 
                success: false,
                error: 'Access denied. No authorization header provided.' 
            });
        }

        // Extract token
        const token = authHeader.replace('Bearer ', '').trim();

        if (!token) {
            return res.status(401).json({ 
                success: false,
                error: 'Access denied. No token provided.' 
            });
        }

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (jwtError) {
            if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({ 
                    success: false,
                    error: 'Token expired. Please login again.',
                    code: 'TOKEN_EXPIRED'
                });
            }
            if (jwtError.name === 'JsonWebTokenError') {
                return res.status(401).json({ 
                    success: false,
                    error: 'Invalid token.',
                    code: 'INVALID_TOKEN'
                });
            }
            throw jwtError;
        }

        // Find user
        const user = await User.findById(decoded.userId).select('-otp -otpExpiry');

        if (!user) {
            return res.status(401).json({ 
                success: false,
                error: 'User not found. Token may be invalid.',
                code: 'USER_NOT_FOUND'
            });
        }

        // Check if user is verified
        if (!user.isVerified) {
            return res.status(403).json({ 
                success: false,
                error: 'Account not verified. Please verify your phone number.',
                code: 'USER_NOT_VERIFIED'
            });
        }

        // Attach user to request
        req.user = user;
        req.userId = user._id;
        req.userPhone = user.phoneNumber;

        next();

    } catch (error) {
        console.error('❌ Auth middleware error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Authentication failed.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Optional authentication middleware
 * Attaches user if token is present, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        
        if (!authHeader) {
            return next();
        }

        const token = authHeader.replace('Bearer ', '').trim();

        if (!token) {
            return next();
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = await User.findById(decoded.userId).select('-otp -otpExpiry');

            if (user && user.isVerified) {
                req.user = user;
                req.userId = user._id;
                req.userPhone = user.phoneNumber;
            }
        } catch (jwtError) {
            // Silent fail for optional auth
            console.log('Optional auth: Invalid token');
        }

        next();

    } catch (error) {
        console.error('❌ Optional auth error:', error);
        next();
    }
};

/**
 * Admin authentication middleware
 * Requires authenticated user with admin role
 */
const adminAuth = async (req, res, next) => {
    try {
        // First run regular auth
        await auth(req, res, () => {});

        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        // Check admin role
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin privileges required.',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }

        next();

    } catch (error) {
        console.error('❌ Admin auth error:', error);
        res.status(500).json({
            success: false,
            error: 'Authorization failed.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    auth,
    optionalAuth,
    adminAuth
};
