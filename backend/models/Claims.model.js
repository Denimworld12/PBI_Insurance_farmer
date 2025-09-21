
const mongoose = require('mongoose');

/**
 * Claim Schema - Handles crop loss insurance claims
 * Includes media capture, processing results, and claim lifecycle
 */
const claimSchema = new mongoose.Schema({
  // Unique document identifier (8 digits + 2 letters)
  documentId: {
    type: String,
    required: true,
    unique: true,
    match: [/^\d{8}[A-Z]{2}$/, 'Document ID must be 8 digits followed by 2 capital letters']
  },

  // References
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  insuranceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Insurance',
    required: [true, 'Insurance ID is required']
  },

  // Form data from Step 1
  formData: {
    state: {
      type: String,
      required: [true, 'State is required']
    },
    season: {
      type: String,
      enum: ['Kharif', 'Rabi', 'Summer'],
      required: [true, 'Season is required']
    },
    scheme: {
      type: String,
      required: [true, 'Scheme is required']
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: 2020,
      max: new Date().getFullYear() + 1
    },
    insuranceNumber: {
      type: String,
      required: [true, 'Insurance number is required'],
      trim: true
    },
    cropType: String,
    farmArea: Number, // in acres
    estimatedLoss: Number, // farmer's initial estimate
    lossReason: {
      type: String,
      enum: ['drought', 'flood', 'pest', 'disease', 'hail', 'cyclone', 'other']
    },
    lossDescription: String
  },

  // Insurance policy details
  policyDetails: {
    policyNumber: String,
    sumInsured: Number,
    premiumPaid: Number,
    isPaid: { type: Boolean, default: false },
    policyStartDate: Date,
    policyEndDate: Date,
    coverageType: String
  },

  // Media data with Cloudinary URLs and metadata
  media: {
    // 4 corner photos of the farm
    cornerPhotos: [{
      corner: {
        type: String,
        enum: ['NE', 'NW', 'SE', 'SW'],
        required: true
      },
      cloudinaryUrl: {
        type: String,
        required: true
      },
      publicId: String,
      coordinates: {
        lat: { type: Number, required: true },
        lon: { type: Number, required: true }
      },
      timestamp: {
        type: Date,
        required: true
      },
      exifData: {
        camera: String,
        gpsAltitude: Number,
        imageSize: {
          width: Number,
          height: Number
        }
      },
      processingResult: mongoose.Schema.Types.Mixed // From pipeline.py
    }],
    
    // Damaged crop photo
    damagedCropPhoto: {
      cloudinaryUrl: {
        type: String,
        required: true
      },
      publicId: String,
      coordinates: {
        lat: { type: Number, required: true },
        lon: { type: Number, required: true }
      },
      timestamp: {
        type: Date,
        required: true
      },
      exifData: {
        camera: String,
        gpsAltitude: Number,
        imageSize: {
          width: Number,
          height: Number
        }
      },
      processingResult: mongoose.Schema.Types.Mixed // Detailed analysis
    },

    // 10-second farm video
    farmVideo: {
      cloudinaryUrl: {
        type: String,
        required: true
      },
      publicId: String,
      duration: Number, // in seconds
      coordinates: {
        lat: { type: Number, required: true },
        lon: { type: Number, required: true }
      },
      timestamp: {
        type: Date,
        required: true
      },
      videoMetadata: {
        resolution: String,
        frameRate: Number,
        codec: String,
        fileSize: Number
      }
    }
  },

  // Processing results from worker/pipeline.py
  processingResult: {
    // Overall assessment
    risk: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true
    },
    verificationLevel: {
      type: String,
      enum: ['auto-approve', 'manual-review', 'reject', 'expedite-payout'],
      required: true
    },
    needPhysicalCheck: {
      type: Boolean,
      default: false
    },
    
    // Detailed phase results
    phases: {
      metaValidation: {
        valid: Boolean,
        exifDetails: mongoose.Schema.Types.Mixed
      },
      geofencing: {
        matched: Boolean,
        parcelDetails: mongoose.Schema.Types.Mixed
      },
      forensics: {
        tamperSuspect: Boolean,
        tamperScore: Number,
        duplicateHash: String,
        overlayConsistent: Boolean
      },
      weatherCorrelation: {
        mismatch: Boolean,
        weatherData: mongoose.Schema.Types.Mixed,
        source: String
      },
      damageAssessment: {
        percentage: Number,
        affectedArea: Number,
        severity: String
      }
    },

    // Confidence scores
    confidence: {
      overall: { type: Number, min: 0, max: 100 },
      authenticity: { type: Number, min: 0, max: 100 },
      damage: { type: Number, min: 0, max: 100 },
      location: { type: Number, min: 0, max: 100 }
    },

    processedAt: {
      type: Date,
      default: Date.now
    },
    processingTime: Number // in seconds
  },

  // Claim status and lifecycle
  status: {
    type: String,
    enum: [
      'draft',           // Being filled by user
      'submitted',       // Submitted for processing
      'processing',      // Under automated/manual review
      'field-verification', // Physical inspection needed
      'approved',        // Claim approved
      'rejected',        // Claim rejected
      'payout-pending',  // Approved but payment pending
      'payout-complete', // Claim settled
      'disputed'         // Under dispute resolution
    ],
    default: 'draft'
  },

  // Review and approval workflow
  reviewProcess: {
    automatedReview: {
      completed: { type: Boolean, default: false },
      completedAt: Date,
      result: String,
      confidence: Number
    },
    manualReview: {
      assigned: Boolean,
      assignedTo: String, // Reviewer ID
      assignedAt: Date,
      completed: Boolean,
      completedAt: Date,
      result: String,
      comments: String,
      additionalDocumentsRequested: [String]
    },
    fieldVerification: {
      required: { type: Boolean, default: false },
      scheduled: Boolean,
      scheduledDate: Date,
      inspector: String,
      completed: Boolean,
      completedAt: Date,
      report: String,
      photos: [String], // Additional verification photos
      result: String
    }
  },

  // Financial details
  financial: {
    claimedAmount: {
      type: Number,
      min: 0
    },
    assessedAmount: {
      type: Number,
      min: 0
    },
    approvedAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    deductions: [{
      reason: String,
      amount: Number
    }],
    payoutMethod: {
      type: String,
      enum: ['bank-transfer', 'cheque', 'digital-wallet']
    },
    payoutDetails: {
      bankAccount: String,
      ifscCode: String,
      accountHolder: String
    },
    transactionId: String,
    payoutDate: Date
  },

  // Rejection details
  rejection: {
    reason: String,
    details: String,
    canAppeal: { type: Boolean, default: true },
    appealDeadline: Date
  },

  // Important timestamps
  submittedAt: Date,
  processedAt: Date,
  approvedAt: Date,
  rejectedAt: Date,
  payoutAt: Date,

  // Communication history
  communications: [{
    type: { type: String, enum: ['sms', 'email', 'system'] },
    message: String,
    sentAt: { type: Date, default: Date.now },
    status: String
  }],

  // Additional metadata
  metadata: {
    userAgent: String,
    ipAddress: String,
    deviceInfo: String,
    appVersion: String,
    submissionSource: { type: String, enum: ['web', 'mobile'], default: 'web' }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
claimSchema.index({ documentId: 1 });
claimSchema.index({ userId: 1, status: 1 });
claimSchema.index({ insuranceId: 1 });
claimSchema.index({ 'formData.state': 1, 'formData.season': 1 });
claimSchema.index({ status: 1, createdAt: -1 });
claimSchema.index({ submittedAt: -1 });

// Generate unique document ID before saving
claimSchema.pre('save', function(next) {
  if (!this.documentId) {
    // Generate 8 random digits
    const numbers = Math.floor(10000000 + Math.random() * 90000000);
    // Generate 2 random capital letters
    const letters = Math.random().toString(36).substring(2, 4).toUpperCase();
    this.documentId = numbers + letters;
  }
  next();
});

// Virtual for claim age in days
claimSchema.virtual('ageInDays').get(function() {
  return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Method to update status
claimSchema.methods.updateStatus = function(newStatus, reason = '') {
  const oldStatus = this.status;
  this.status = newStatus;
  
  // Update relevant timestamp
  switch(newStatus) {
    case 'submitted':
      this.submittedAt = new Date();
      break;
    case 'processing':
      this.processedAt = new Date();
      break;
    case 'approved':
      this.approvedAt = new Date();
      break;
    case 'rejected':
      this.rejectedAt = new Date();
      if (reason) this.rejection.reason = reason;
      break;
    case 'payout-complete':
      this.payoutAt = new Date();
      break;
  }

  // Add to communications
  this.communications.push({
    type: 'system',
    message: `Status changed from ${oldStatus} to ${newStatus}${reason ? ': ' + reason : ''}`,
    sentAt: new Date(),
    status: 'sent'
  });
};

// Method to calculate total media count
claimSchema.methods.getMediaCount = function() {
  return {
    photos: this.media.cornerPhotos.length + (this.media.damagedCropPhoto ? 1 : 0),
    videos: this.media.farmVideo ? 1 : 0,
    total: this.media.cornerPhotos.length + (this.media.damagedCropPhoto ? 1 : 0) + (this.media.farmVideo ? 1 : 0)
  };
};

// Static method to get claims by status for
