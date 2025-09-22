const express = require('express');
const router = express.Router();

// Mock claims data
const mockClaims = [];

// Get user's claims list
router.get('/list', async (req, res) => {
  try {
    console.log('📋 Claims list requested');
    
    const { status, page = 1, limit = 10 } = req.query;
    
    let filteredClaims = mockClaims;
    if (status && status !== 'all') {
      filteredClaims = mockClaims.filter(claim => claim.status === status);
    }

    const totalPages = Math.ceil(filteredClaims.length / limit);

    console.log('✅ Returning', filteredClaims.length, 'claims');

    res.json({
      success: true,
      claims: filteredClaims,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalClaims: filteredClaims.length,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('❌ Get claims error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch claims',
      details: error.message
    });
  }
});

// Initialize a new claim
router.post('/initialize', async (req, res) => {
  try {
    console.log('📋 Claim initialization requested');
    
    const { insuranceId, formData } = req.body;

    // Generate document ID
    const numbers = Math.floor(10000000 + Math.random() * 90000000);
    const letters = Math.random().toString(36).substring(2, 4).toUpperCase();
    const documentId = numbers + letters;

    const newClaim = {
      id: 'claim_' + Date.now(),
      documentId,
      insuranceId,
      formData: formData || {},
      status: 'draft',
      createdAt: new Date().toISOString()
    };

    mockClaims.push(newClaim);

    console.log('✅ Claim initialized:', documentId);

    res.status(201).json({
      success: true,
      message: 'Claim initialized successfully',
      claim: {
        id: newClaim.id,
        documentId: newClaim.documentId,
        status: newClaim.status
      }
    });

  } catch (error) {
    console.error('❌ Initialize claim error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize claim',
      details: error.message
    });
  }
});

// Complete claim processing
router.post('/complete', async (req, res) => {
  try {
    console.log('📋 Claim completion requested');
    
    const { documentId, media, processingResult } = req.body;

    const claim = mockClaims.find(c => c.documentId === documentId);
    if (!claim) {
      return res.status(404).json({
        success: false,
        error: 'Claim not found'
      });
    }

    // Update claim
    claim.media = media;
    claim.processingResult = processingResult;
    claim.status = 'submitted';
    claim.submittedAt = new Date().toISOString();

    console.log('✅ Claim completed:', documentId);

    res.json({
      success: true,
      message: 'Claim processing completed',
      claim: {
        id: claim.id,
        documentId: claim.documentId,
        status: claim.status
      }
    });

  } catch (error) {
    console.error('❌ Complete claim error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete claim processing',
      details: error.message
    });
  }
});
// Get claim results by document ID
router.get('/results/:documentId', async (req, res) => {
  try {
    console.log('📋 Claim results requested for:', req.params.documentId);
    
    // In a real app, fetch from database
    // For now, return mock data with the structure expected by frontend
    const mockClaimData = {
      documentId: req.params.documentId,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      processingResult: {
        final: {
          risk: 'low',
          verification_level: 'auto-approve',
          need_physical_check: false
        },
        phases: {
          meta_validation: { valid: true },
          geofencing: { location_valid: true },
          forensics: { tampering_detected: false },
          weather_correlation: { inconsistent: false },
          damage_assessment: {
            damage_percentage: 0.25,
            method: 'Vegetation Index Analysis',
            confidence: 0.85,
            vegetation_health: 0.75
          }
        }
      },
      media: {
        'corner-ne': { stepInfo: { type: 'photo' }, cloudinaryUrl: 'https://via.placeholder.com/300x200' },
        'corner-nw': { stepInfo: { type: 'photo' }, cloudinaryUrl: 'https://via.placeholder.com/300x200' },
        'corner-se': { stepInfo: { type: 'photo' }, cloudinaryUrl: 'https://via.placeholder.com/300x200' },
        'corner-sw': { stepInfo: { type: 'photo' }, cloudinaryUrl: 'https://via.placeholder.com/300x200' },
        'damaged-crop': { stepInfo: { type: 'photo' }, cloudinaryUrl: 'https://via.placeholder.com/300x200' },
        'farm-video': { stepInfo: { type: 'video' }, cloudinaryUrl: 'https://via.placeholder.com/300x200' }
      }
    };

    res.json({
      success: true,
      claim: mockClaimData
    });

  } catch (error) {
    console.error('❌ Get claim results error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch claim results'
    });
  }
});

module.exports = router;
