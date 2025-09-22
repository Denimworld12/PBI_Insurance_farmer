const express = require('express');
const multer = require('multer');
const { uploadImage, uploadVideo } = require('../config/cloudinary');
const router = express.Router();

// Configure multer for memory storage (for Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files allowed'));
    }
  }
});

// Upload media to Cloudinary
router.post('/upload', upload.single('media'), async (req, res) => {
  try {
    console.log('📁 Media upload to Cloudinary requested');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { lat, lon, timestamp, stepId, documentId } = req.body;

    // Prepare upload options
    const uploadOptions = {
      user_id: req.user?.id || 'anonymous',
      document_id: documentId || 'unknown',
      claim_type: stepId || 'general',
      capture_timestamp: timestamp || new Date().toISOString(),
      coordinates: `${lat},${lon}`,
      public_id: `${documentId}/${stepId}_${Date.now()}`
    };

    let cloudinaryResult;

    // Upload to Cloudinary based on file type
    if (req.file.mimetype.startsWith('video/')) {
      console.log('🎥 Uploading video to Cloudinary...');
      cloudinaryResult = await uploadVideo(req.file.buffer, uploadOptions);
    } else {
      console.log('📸 Uploading image to Cloudinary...');
      cloudinaryResult = await uploadImage(req.file.buffer, uploadOptions);
    }

    console.log('✅ Cloudinary upload successful:', cloudinaryResult.public_id);

    res.json({
      success: true,
      message: 'Media uploaded to Cloudinary successfully',
      cloudinary: {
        public_id: cloudinaryResult.public_id,
        url: cloudinaryResult.secure_url,
        resource_type: cloudinaryResult.resource_type,
        format: cloudinaryResult.format,
        width: cloudinaryResult.width,
        height: cloudinaryResult.height,
        bytes: cloudinaryResult.bytes
      },
      metadata: {
        coordinates: { lat: parseFloat(lat), lon: parseFloat(lon) },
        timestamp,
        stepId,
        documentId
      }
    });

  } catch (error) {
    console.error('❌ Cloudinary upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload media to Cloudinary',
      details: error.message
    });
  }
});

module.exports = router;
