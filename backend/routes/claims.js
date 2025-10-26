const express = require('express');
const router = express.Router();

// In-memory storage (will be replaced by database in production)
// This will be shared with server.js through require
let mockClaims = [];

/**
 * Get user's claims list
 * GET /api/claims/list
 */
router.get('/list', async (req, res) => {
  try {
    console.log('📋 Claims list requested');
    
    const { status, page = 1, limit = 10, sortBy = 'createdAt' } = req.query;
    
    // Filter by status if provided
    let filteredClaims = [...mockClaims];
    if (status && status !== 'all') {
      filteredClaims = filteredClaims.filter(claim => claim.status === status);
    }

    // Sort claims (newest first by default)
    filteredClaims.sort((a, b) => {
      const dateA = new Date(a[sortBy] || a.createdAt);
      const dateB = new Date(b[sortBy] || b.createdAt);
      return dateB - dateA;
    });

    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedClaims = filteredClaims.slice(startIndex, endIndex);
    
    const totalPages = Math.ceil(filteredClaims.length / parseInt(limit));

    console.log(`✅ Returning ${paginatedClaims.length}/${filteredClaims.length} claims (page ${page}/${totalPages})`);

    res.json({
      success: true,
      claims: paginatedClaims,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalClaims: filteredClaims.length,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('❌ Get claims error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch claims',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Initialize a new claim
 * POST /api/claims/initialize
 */
router.post('/initialize', async (req, res) => {
  try {
    console.log('📋 Claim initialization requested');
    
    const { insuranceId, formData } = req.body;

    // Validate input
    if (!insuranceId) {
      return res.status(400).json({
        success: false,
        error: 'Insurance ID is required'
      });
    }

    // Generate unique document ID (8 digits + 2 letters)
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 90 + 10);
    const letters = Math.random().toString(36).substring(2, 4).toUpperCase();
    const documentId = `${timestamp}${random}${letters}`;

    const newClaim = {
      id: `claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      documentId,
      insuranceId,
      formData: formData || {},
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      media: {},
      processingResult: null
    };

    mockClaims.push(newClaim);

    console.log(`✅ Claim initialized: ${documentId} (${newClaim.id})`);

    res.status(201).json({
      success: true,
      message: 'Claim initialized successfully',
      claim: {
        id: newClaim.id,
        documentId: newClaim.documentId,
        status: newClaim.status,
        createdAt: newClaim.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Initialize claim error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize claim',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Update claim with form data
 * PUT /api/claims/:documentId/update
 */
router.put('/:documentId/update', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { formData } = req.body;

    console.log(`📝 Updating claim: ${documentId}`);

    const claim = mockClaims.find(c => c.documentId === documentId);
    if (!claim) {
      return res.status(404).json({
        success: false,
        error: 'Claim not found'
      });
    }

    // Update form data
    claim.formData = { ...claim.formData, ...formData };
    claim.updatedAt = new Date().toISOString();

    console.log(`✅ Claim updated: ${documentId}`);

    res.json({
      success: true,
      message: 'Claim updated successfully',
      claim: {
        id: claim.id,
        documentId: claim.documentId,
        status: claim.status
      }
    });

  } catch (error) {
    console.error('❌ Update claim error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update claim',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Complete claim processing
 * POST /api/claims/complete
 */
router.post('/complete', async (req, res) => {
  try {
    console.log('🎯 Claim completion requested');
    
    const { documentId, media, processingResult } = req.body;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      });
    }

    const claim = mockClaims.find(c => c.documentId === documentId);
    
    if (!claim) {
      return res.status(404).json({
        success: false,
        error: 'Claim not found'
      });
    }

    // Update claim with processing results
    claim.media = media || claim.media;
    claim.processingResult = processingResult || claim.processingResult;
    claim.status = 'submitted';
    claim.submittedAt = new Date().toISOString();
    claim.updatedAt = new Date().toISOString();

    console.log(`✅ Claim completed: ${documentId}`);

    res.json({
      success: true,
      message: 'Claim processing completed',
      claim: {
        id: claim.id,
        documentId: claim.documentId,
        status: claim.status,
        submittedAt: claim.submittedAt,
        processingResult: claim.processingResult
      }
    });

  } catch (error) {
    console.error('❌ Complete claim error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete claim processing',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get claim results by document ID
 * GET /api/claims/results/:documentId
 */
router.get('/results/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    console.log(`📊 Claim results requested for: ${documentId}`);
    
    // Find claim in mock data
    const claim = mockClaims.find(c => c.documentId === documentId);
    
    if (claim) {
      console.log(`✅ Claim found: ${documentId}`);
      
      return res.json({
        success: true,
        claim: {
          documentId: claim.documentId,
          status: claim.status || 'submitted',
          submittedAt: claim.submittedAt || claim.createdAt,
          formData: claim.formData,
          processingResult: claim.processingResult,
          media: claim.media || {}
        },
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'memory_storage'
        }
      });
    }

    // If not found, return mock data for testing
    console.log(`⚠️ Claim not found, returning mock data for: ${documentId}`);
    
    const mockClaimData = {
      documentId: documentId,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      processingResult: {
        overall_confidence: 0.85,
        recommendation: {
          status: 'approved',
          reason: 'High confidence automated verification',
          action: 'PROCESS_PAYOUT',
          next_steps: 'Payout will be processed within 3-5 business days',
          user_message: '✅ Claim Approved! Your payout is being processed.'
        },
        final_decision: {
          decision: 'APPROVE',
          risk_level: 'low',
          manual_review_required: false,
          confidence_score: 0.85,
          threshold_applied: 'auto_approve',
          payout_approved: true
        },
        summary: {
          total_files_processed: 5,
          successful_extractions: 5,
          failed_extractions: 0,
          exif_data_extracted: 5,
          weather_data_obtained: 5,
          geofencing_successful: 5,
          coordinate_matches: 5
        },
        damage_assessment: {
          ai_calculated_damage_percent: 35.0,
          farmer_claimed_damage_percent: 50.0,
          final_damage_percent: 42.5,
          severity: 'moderate'
        },
        payout_calculation: {
          sum_insured: 100000,
          damage_percent: 42.5,
          final_payout_amount: 42500,
          currency: 'INR',
          payout_approved: true,
          payout_status: 'processing'
        },
        verification_evidence: {
          authenticity_verified: true,
          location_verified: true,
          damage_verified: true,
          weather_supports_claim: true
        }
      },
      media: {
        'corner-ne': { 
          stepInfo: { type: 'photo', title: 'North-East Corner' }, 
          cloudinaryUrl: '/placeholder-image.jpg' 
        },
        'corner-nw': { 
          stepInfo: { type: 'photo', title: 'North-West Corner' }, 
          cloudinaryUrl: '/placeholder-image.jpg' 
        },
        'corner-se': { 
          stepInfo: { type: 'photo', title: 'South-East Corner' }, 
          cloudinaryUrl: '/placeholder-image.jpg' 
        },
        'corner-sw': { 
          stepInfo: { type: 'photo', title: 'South-West Corner' }, 
          cloudinaryUrl: '/placeholder-image.jpg' 
        },
        'damaged-crop': { 
          stepInfo: { type: 'photo', title: 'Damaged Crop' }, 
          cloudinaryUrl: '/placeholder-image.jpg' 
        },
        'farm-video': { 
          stepInfo: { type: 'video', title: 'Farm Video' }, 
          cloudinaryUrl: '/placeholder-video.mp4' 
        }
      }
    };

    res.json({
      success: true,
      claim: mockClaimData,
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'mock_fallback',
        note: 'Claim not found in storage, returning mock data for testing'
      }
    });

  } catch (error) {
    console.error('❌ Get claim results error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch claim results',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get claim by document ID (full details)
 * GET /api/claims/:documentId
 */
router.get('/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    console.log(`📋 Claim details requested for: ${documentId}`);

    const claim = mockClaims.find(c => c.documentId === documentId);

    if (!claim) {
      return res.status(404).json({
        success: false,
        error: 'Claim not found'
      });
    }

    console.log(`✅ Claim found: ${documentId}`);

    res.json({
      success: true,
      claim: claim
    });

  } catch (error) {
    console.error('❌ Get claim error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch claim',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Delete claim (draft only)
 * DELETE /api/claims/:documentId
 */
router.delete('/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    console.log(`🗑️ Delete claim requested: ${documentId}`);

    const claimIndex = mockClaims.findIndex(c => c.documentId === documentId);

    if (claimIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Claim not found'
      });
    }

    const claim = mockClaims[claimIndex];

    // Only allow deletion of draft claims
    if (claim.status !== 'draft') {
      return res.status(400).json({
        success: false,
        error: 'Only draft claims can be deleted'
      });
    }

    mockClaims.splice(claimIndex, 1);
    console.log(`✅ Claim deleted: ${documentId}`);

    res.json({
      success: true,
      message: 'Claim deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete claim error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete claim',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Export router and mockClaims for use in server.js
module.exports = router;
module.exports.mockClaims = mockClaims;
