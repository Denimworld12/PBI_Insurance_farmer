const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Check if Cloudinary is configured
const cloudinaryConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_SECRET
);

let uploadImage, uploadVideo;

// Try to load Cloudinary if configured
if (cloudinaryConfigured) {
  try {
    const cloudinary = require('../config/cloudinary');
    uploadImage = cloudinary.uploadImage;
    uploadVideo = cloudinary.uploadVideo;
    console.log('✅ Cloudinary integration enabled');
  } catch (error) {
    console.log('⚠️ Cloudinary config not found, using local storage');
  }
}

// Configure multer
const storage = cloudinaryConfigured && uploadImage ? 
  multer.memoryStorage() : // Memory storage for Cloudinary
  multer.diskStorage({      // Disk storage for local
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  });

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files allowed'));
    }
  }
});

/**
 * Upload media (Cloudinary or Local)
 * POST /api/media/upload
 */
router.post('/upload', upload.single('media'), async (req, res) => {
  try {
    console.log('📁 Media upload requested');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { lat, lon, timestamp, stepId, documentId } = req.body;

    // Validate coordinates
    const coordinates = {
      lat: parseFloat(lat),
      lon: parseFloat(lon)
    };

    if (isNaN(coordinates.lat) || isNaN(coordinates.lon)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates'
      });
    }

    const metadata = {
      coordinates,
      timestamp: timestamp || new Date().toISOString(),
      stepId: stepId || 'unknown',
      documentId: documentId || 'unknown',
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    };

    // Try Cloudinary upload if configured
    if (cloudinaryConfigured && (uploadImage || uploadVideo)) {
      try {
        console.log('☁️ Uploading to Cloudinary...');

        const uploadOptions = {
          user_id: req.user?.id || 'anonymous',
          document_id: documentId || 'unknown',
          claim_type: stepId || 'general',
          capture_timestamp: timestamp || new Date().toISOString(),
          coordinates: `${lat},${lon}`,
          public_id: `${documentId}/${stepId}_${Date.now()}`
        };

        let cloudinaryResult;

        if (req.file.mimetype.startsWith('video/')) {
          console.log('🎥 Uploading video to Cloudinary...');
          cloudinaryResult = await uploadVideo(req.file.buffer, uploadOptions);
        } else {
          console.log('📸 Uploading image to Cloudinary...');
          cloudinaryResult = await uploadImage(req.file.buffer, uploadOptions);
        }

        console.log('✅ Cloudinary upload successful:', cloudinaryResult.public_id);

        return res.json({
          success: true,
          message: 'Media uploaded to Cloudinary successfully',
          storage: 'cloudinary',
          cloudinary: {
            public_id: cloudinaryResult.public_id,
            url: cloudinaryResult.secure_url,
            resource_type: cloudinaryResult.resource_type,
            format: cloudinaryResult.format,
            width: cloudinaryResult.width,
            height: cloudinaryResult.height,
            bytes: cloudinaryResult.bytes
          },
          metadata
        });

      } catch (cloudinaryError) {
        console.error('⚠️ Cloudinary upload failed, falling back to local:', cloudinaryError.message);
        // Continue to local storage fallback
      }
    }

    // Local storage (fallback or default)
    console.log('💾 Using local storage');

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

    console.log('✅ Local upload successful:', req.file.filename);

    res.json({
      success: true,
      message: 'Media uploaded successfully',
      storage: 'local',
      file: {
        filename: req.file.filename,
        path: req.file.path,
        url: fileUrl,
        mimeType: req.file.mimetype,
        size: req.file.size
      },
      metadata
    });

  } catch (error) {
    console.error('❌ Media upload error:', error);
    
    // Cleanup file if it was saved locally
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Cleanup error:', err);
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to upload media',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Upload failed'
    });
  }
});

/**
 * Delete media (Cloudinary or Local)
 * DELETE /api/media/:identifier
 */
router.delete('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { storage = 'local' } = req.query;

    console.log(`🗑️ Delete media requested: ${identifier} (${storage})`);

    if (storage === 'cloudinary' && cloudinaryConfigured) {
      // Delete from Cloudinary
      const cloudinary = require('cloudinary').v2;
      const result = await cloudinary.uploader.destroy(identifier);
      
      console.log('✅ Cloudinary delete result:', result);

      return res.json({
        success: true,
        message: 'Media deleted from Cloudinary',
        result
      });
    } else {
      // Delete from local storage
      const filePath = path.join(__dirname, '../uploads', identifier);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      fs.unlinkSync(filePath);
      console.log('✅ Local file deleted');

      return res.json({
        success: true,
        message: 'Media deleted from local storage'
      });
    }

  } catch (error) {
    console.error('❌ Delete media error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete media',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Delete failed'
    });
  }
});

/**
 * Get media info
 * GET /api/media/:identifier
 */
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { storage = 'local' } = req.query;

    console.log(`📊 Media info requested: ${identifier} (${storage})`);

    if (storage === 'cloudinary' && cloudinaryConfigured) {
      // Get Cloudinary info
      const cloudinary = require('cloudinary').v2;
      const result = await cloudinary.api.resource(identifier);

      return res.json({
        success: true,
        storage: 'cloudinary',
        info: {
          public_id: result.public_id,
          url: result.secure_url,
          format: result.format,
          resource_type: result.resource_type,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
          created_at: result.created_at
        }
      });
    } else {
      // Get local file info
      const filePath = path.join(__dirname, '../uploads', identifier);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      const stats = fs.statSync(filePath);
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

      return res.json({
        success: true,
        storage: 'local',
        info: {
          filename: identifier,
          url: `${baseUrl}/uploads/${identifier}`,
          size: stats.size,
          created_at: stats.birthtime,
          modified_at: stats.mtime
        }
      });
    }

  } catch (error) {
    console.error('❌ Get media info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get media info',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Failed'
    });
  }
});

/**
 * Get storage status
 * GET /api/media/status/check
 */
router.get('/status/check', (req, res) => {
  res.json({
    success: true,
    storage: {
      cloudinary: {
        configured: cloudinaryConfigured,
        available: !!(uploadImage && uploadVideo),
        status: cloudinaryConfigured ? 'active' : 'not_configured'
      },
      local: {
        configured: true,
        available: true,
        status: 'active',
        directory: path.join(__dirname, '../uploads')
      },
      default: cloudinaryConfigured ? 'cloudinary' : 'local'
    }
  });
});

module.exports = router;
