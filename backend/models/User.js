const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    match: [/^[6-9]\d{9}$/, 'Please provide a valid Indian mobile number']
  },
  
  // OTP fields (selected: false for security)
  otp: {
    type: String,
    select: false
  },
  otpExpiry: {
    type: Date,
    select: false
  },
  
  // User profile information
  profile: {
    name: String,
    email: String,
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String
    },
    farmDetails: {
      totalArea: Number,
      location: {
        latitude: Number,
        longitude: Number
      },
      soilType: String,
      irrigationSource: String
    }
  },
  
  // User verification status
  isVerified: {
    type: Boolean,
    default: true // Auto-verify after OTP verification
  },
  
  // Authentication history
  lastLogin: Date,
  loginCount: {
    type: Number,
    default: 0
  },
  
  // Account status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ phoneNumber: 1 }, { unique: true });
userSchema.index({ 'profile.email': 1 }, { sparse: true });

// Method to generate OTP
userSchema.methods.generateOTP = function() {
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Set OTP and expiry (10 minutes from now)
  this.otp = otp;
  this.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  
  return otp;
};

// Method to verify OTP
userSchema.methods.verifyOTP = function(inputOTP) {
  // Check if OTP exists and hasn't expired
  if (!this.otp || !this.otpExpiry) {
    return false;
  }
  
  // Check if OTP has expired
  if (new Date() > this.otpExpiry) {
    return false;
  }
  
  // Check if OTP matches
  return this.otp === inputOTP;
};

// Method to clear OTP after successful verification
userSchema.methods.clearOTP = function() {
  this.otp = undefined;
  this.otpExpiry = undefined;
  this.lastLogin = new Date();
  this.loginCount += 1;
};

// Method to update profile
userSchema.methods.updateProfile = function(profileData) {
  this.profile = { ...this.profile, ...profileData };
};

// Static method to find by phone number
userSchema.statics.findByPhoneNumber = function(phoneNumber) {
  return this.findOne({ phoneNumber });
};

// Virtual for user age (if birthdate is added later)
userSchema.virtual('accountAge').get(function() {
  return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to validate phone number
userSchema.pre('save', function(next) {
  if (this.phoneNumber && !/^[6-9]\d{9}$/.test(this.phoneNumber)) {
    next(new Error('Invalid Indian mobile number format'));
  } else {
    next();
  }
});

// Instance method to get safe user data (without sensitive fields)
userSchema.methods.toSafeObject = function() {
  return {
    id: this._id,
    phoneNumber: this.phoneNumber,
    profile: this.profile,
    isVerified: this.isVerified,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('User', userSchema);
