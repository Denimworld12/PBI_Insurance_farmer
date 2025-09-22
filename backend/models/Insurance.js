
const express = require('express');
const Claim = require('./Claims.js');
const Insurance = require('./Insurance.js');
const auth = require('../middleware/auth.js');
const router = express.Router();

/**
 * Initialize a new claim
 * POST /api/claims/initialize
 */
router.post('/initialize', auth, async (req, res) => {
  try {
    const { insuranceId, formData, documentId } = req.body;

    // Verify insurance exists
    const insurance = await Insurance.findById(insuranceId);
    if (!insurance) {
      return res.status(404).json({
        success: false,
        error: 'Insurance plan not found'
      });
    }

    // Create new claim
    const claim = new Claim({
      userId: req.userId,
      insuranceId,
      documentId,
      formData,
      status: 'draft'
    });

    await claim.save();

    res.status(201).json({
      success: true,
      message: 'Claim initialized successfully',
      claim: {
        id: claim._id,
        documentId: claim.documentId,
        status: claim.status
      }
    });

  } catch (error) {
    console.error('Initialize claim error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize claim'
    });
  }
});

/**
 * Submit completed claim
 * POST /api/claims/submit
 */
router.post('/submit', auth, async (req, res) => {
  try {
    const { documentId, media, processingResult } = req.body;

    const claim = await Claim.findOne({ 
      documentId, 
      userId: req.userId 
    });

    if (!claim) {
      return res.status(404).json({
        success: false,
        error: 'Claim not found'
      });
    }

    // Update claim with media and processing results
    claim.media = media;
    claim.processingResult = processingResult;
    claim.status = 'submitted';
    claim.submittedAt = new Date();

    // Update status based on processing result
    if (processingResult && processingResult.final) {
      switch (processingResult.final.verification_level) {
        case 'auto-approve':
          claim.status = 'approved';
          claim.approvedAt = new Date();
          break;
        case 'reject':
          claim.status = 'rejected';
          claim.rejectedAt = new Date();
          break;
        case 'manual-review':
          claim.status = 'processing';
          break;
        case 'expedite-payout':
          claim.status = 'payout-pending';
          break;
      }
    }

    await claim.save();

    res.json({
      success: true,
      message: 'Claim submitted successfully',
      claim: {
        id: claim._id,
        documentId: claim.documentId,
        status: claim.status
      }
    });

  } catch (error) {
    console.error('Submit claim error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit claim'
    });
  }
});

/**
 * Get user's claims list
 * GET /api/claims/list
 */
router.get('/list', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    // Build filter
    let filter = { userId: req.userId };
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get claims
    const claims = await Claim.find(filter)
      .populate('insuranceId', 'name type')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-media.cornerPhotos.processingResult -media.damagedCropPhoto.processingResult');

    // Get total count for pagination
    const totalClaims = await Claim.countDocuments(filter);
    const totalPages = Math.ceil(totalClaims / limit);

    res.json({
      success: true,
      claims,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalClaims,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Get claims error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch claims'
    });
  }
});

/**
 * Get claim details by ID
 * GET /api/claims/:id
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const claim = await Claim.findOne({
      _id: req.params.id,
      userId: req.userId
    }).populate('insuranceId');

    if (!claim) {
      return res.status(404).json({
        success: false,
        error: 'Claim not found'
      });
    }

    res.json({
      success: true,
      claim
    });

  } catch (error) {
    console.error('Get claim details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch claim details'
    });
  }
});

/**
 * Update claim status (for admin/system use)
 * PUT /api/claims/:id/status
 */
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status, reason } = req.body;
    
    const claim = await Claim.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({
        success: false,
        error: 'Claim not found'
      });
    }

    claim.updateStatus(status, reason);
    await claim.save();

    res.json({
      success: true,
      message: 'Claim status updated successfully',
      claim: {
        id: claim._id,
        status: claim.status
      }
    });

  } catch (error) {
    console.error('Update claim status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update claim status'
    });
  }
});

/**
 * Get claim statistics for user
 * GET /api/claims/stats
 */
router.get('/user/stats', auth, async (req, res) => {
  try {
    const stats = await Claim.aggregate([
      { $match: { userId: req.userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalClaims = await Claim.countDocuments({ userId: req.userId });
    
    const formattedStats = {
      total: totalClaims,
      byStatus: {}
    };

    stats.forEach(stat => {
      formattedStats.byStatus[stat._id] = stat.count;
    });

    res.json({
      success: true,
      stats: formattedStats
    });

  } catch (error) {
    console.error('Get claim stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch claim statistics'
    });
  }
});

/**
 * Complete claim processing (called after media upload)
 * POST /api/claims/complete
 */
router.post('/complete', auth, async (req, res) => {
  try {
    const { documentId, media, processingResult } = req.body;

    const claim = await Claim.findOne({ 
      documentId,
      userId: req.userId 
    });

    if (!claim) {
      return res.status(404).json({
        success: false,
        error: 'Claim not found'
      });
    }

    // Update claim with final data
    if (media) claim.media = { ...claim.media, ...media };
    if (processingResult) claim.processingResult = processingResult;
    
    claim.status = 'submitted';
    claim.submittedAt = new Date();

    // Auto-process based on risk assessment
    if (processingResult?.final) {
      const { risk, verification_level, need_physical_check } = processingResult.final;
      
      if (verification_level === 'auto-approve' && risk === 'low') {
        claim.status = 'approved';
        claim.approvedAt = new Date();
      } else if (verification_level === 'reject') {
        claim.status = 'rejected';
        claim.rejectedAt = new Date();
        claim.rejection = {
          reason: 'Automated rejection due to high risk factors',
          details: `Risk: ${risk}, Verification: ${verification_level}`
        };
      } else {
        claim.status = need_physical_check ? 'field-verification' : 'processing';
      }
    }

    await claim.save();

    res.json({
      success: true,
      message: 'Claim processing completed',
      claim: {
        id: claim._id,
        documentId: claim.documentId,
        status: claim.status,
        processingResult: claim.processingResult?.final
      }
    });

  } catch (error) {
    console.error('Complete claim error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete claim processing'
    });
  }
});

module.exports = router;

