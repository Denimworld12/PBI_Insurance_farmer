const cloudinary = require('cloudinary').v2;

/**
 * Cloudinary configuration for media upload and management
 * Handles image and video storage with metadata
 * Works in optional mode - gracefully handles missing configuration
 */

// Check if Cloudinary is configured
const isConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

// Configure Cloudinary if credentials are available
if (isConfigured) {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });
    console.log('✅ Cloudinary configured successfully');
  } catch (error) {
    console.error('❌ Cloudinary configuration error:', error.message);
  }
} else {
  console.log('⚠️ Cloudinary not configured - missing environment variables');
  console.log('ℹ️ Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to enable');
}

/**
 * Upload image to Cloudinary with user metadata
 * @param {Buffer} fileBuffer - Image file buffer
 * @param {Object} options - Upload options including user_id, document_id, etc.
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadImage = async (fileBuffer, options = {}) => {
  if (!isConfigured) {
    throw new Error('Cloudinary not configured. Please set environment variables.');
  }

  try {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        resource_type: 'image',
        folder: options.folder || 'pbi-agriculture-insurance/images',
        public_id: options.public_id || undefined,
        overwrite: options.overwrite || false,
        context: {
          user_id: options.user_id || '',
          document_id: options.document_id || '',
          claim_type: options.claim_type || '',
          capture_timestamp: options.capture_timestamp || new Date().toISOString(),
          coordinates: options.coordinates || ''
        },
        transformation: [
          { 
            width: options.maxWidth || 1920, 
            height: options.maxHeight || 1080, 
            crop: 'limit', 
            quality: 'auto:good' 
          },
          { fetch_format: 'auto' }
        ],
        tags: [
          'agriculture',
          'insurance',
          'claim',
          options.claim_type || 'general',
          ...(options.additionalTags || [])
        ]
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary image upload error:', error.message);
            reject(error);
          } else {
            console.log(`✅ Image uploaded to Cloudinary: ${result.public_id}`);
            resolve(result);
          }
        }
      );

      uploadStream.end(fileBuffer);
    });
  } catch (error) {
    console.error('❌ Cloudinary image upload failed:', error);
    throw new Error(`Cloudinary image upload failed: ${error.message}`);
  }
};

/**
 * Upload video to Cloudinary with user metadata
 * @param {Buffer} fileBuffer - Video file buffer
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadVideo = async (fileBuffer, options = {}) => {
  if (!isConfigured) {
    throw new Error('Cloudinary not configured. Please set environment variables.');
  }

  try {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        resource_type: 'video',
        folder: options.folder || 'pbi-agriculture-insurance/videos',
        public_id: options.public_id || undefined,
        overwrite: options.overwrite || false,
        context: {
          user_id: options.user_id || '',
          document_id: options.document_id || '',
          claim_type: options.claim_type || '',
          capture_timestamp: options.capture_timestamp || new Date().toISOString(),
          coordinates: options.coordinates || ''
        },
        transformation: [
          { 
            width: options.maxWidth || 1280, 
            height: options.maxHeight || 720, 
            crop: 'limit', 
            quality: 'auto:good',
            video_codec: 'auto'
          }
        ],
        tags: [
          'agriculture',
          'insurance',
          'claim',
          'video',
          options.claim_type || 'general',
          ...(options.additionalTags || [])
        ],
        eager: [
          { 
            width: 640, 
            height: 360, 
            crop: 'scale', 
            format: 'mp4',
            video_codec: 'h264'
          }
        ],
        eager_async: true
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary video upload error:', error.message);
            reject(error);
          } else {
            console.log(`✅ Video uploaded to Cloudinary: ${result.public_id}`);
            resolve(result);
          }
        }
      );

      uploadStream.end(fileBuffer);
    });
  } catch (error) {
    console.error('❌ Cloudinary video upload failed:', error);
    throw new Error(`Cloudinary video upload failed: ${error.message}`);
  }
};

/**
 * Upload file directly from file path
 * @param {string} filePath - Local file path
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadFile = async (filePath, options = {}) => {
  if (!isConfigured) {
    throw new Error('Cloudinary not configured. Please set environment variables.');
  }

  try {
    const uploadOptions = {
      folder: options.folder || 'pbi-agriculture-insurance',
      public_id: options.public_id || undefined,
      overwrite: options.overwrite || false,
      context: {
        user_id: options.user_id || '',
        document_id: options.document_id || '',
        claim_type: options.claim_type || '',
        capture_timestamp: options.capture_timestamp || new Date().toISOString(),
        coordinates: options.coordinates || ''
      },
      tags: [
        'agriculture',
        'insurance',
        'claim',
        ...(options.additionalTags || [])
      ]
    };

    const result = await cloudinary.uploader.upload(filePath, uploadOptions);
    console.log(`✅ File uploaded to Cloudinary: ${result.public_id}`);
    return result;

  } catch (error) {
    console.error('❌ Cloudinary file upload failed:', error);
    throw new Error(`Cloudinary file upload failed: ${error.message}`);
  }
};

/**
 * Delete media from Cloudinary
 * @param {string} publicId - Public ID of the media to delete
 * @param {string} resourceType - 'image' or 'video'
 * @returns {Promise<Object>} Deletion result
 */
const deleteMedia = async (publicId, resourceType = 'image') => {
  if (!isConfigured) {
    throw new Error('Cloudinary not configured. Please set environment variables.');
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true
    });
    
    if (result.result === 'ok') {
      console.log(`✅ Media deleted from Cloudinary: ${publicId}`);
    } else {
      console.log(`⚠️ Media deletion result: ${result.result} for ${publicId}`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Cloudinary deletion failed:', error);
    throw new Error(`Cloudinary deletion failed: ${error.message}`);
  }
};

/**
 * Get media details by public ID
 * @param {string} publicId - Public ID of the media
 * @param {string} resourceType - 'image' or 'video'
 * @returns {Promise<Object>} Media details
 */
const getMediaDetails = async (publicId, resourceType = 'image') => {
  if (!isConfigured) {
    throw new Error('Cloudinary not configured. Please set environment variables.');
  }

  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
      image_metadata: true,
      colors: true,
      exif: true
    });
    
    return result;
  } catch (error) {
    console.error('❌ Failed to get media details:', error);
    throw new Error(`Failed to get media details: ${error.message}`);
  }
};

/**
 * Generate optimized URL for media
 * @param {string} publicId - Public ID of the media
 * @param {Object} options - Transformation options
 * @returns {string} Optimized URL
 */
const getOptimizedUrl = (publicId, options = {}) => {
  if (!isConfigured) {
    console.warn('Cloudinary not configured, returning placeholder URL');
    return '/placeholder-image.jpg';
  }

  try {
    const defaultOptions = {
      quality: 'auto:good',
      fetch_format: 'auto',
      secure: true
    };

    const transformOptions = { ...defaultOptions, ...options };
    
    return cloudinary.url(publicId, transformOptions);
  } catch (error) {
    console.error('❌ Failed to generate optimized URL:', error);
    throw new Error(`Failed to generate optimized URL: ${error.message}`);
  }
};

/**
 * Search media by tags
 * @param {Array} tags - Array of tags to search for
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results
 */
const searchByTags = async (tags, options = {}) => {
  if (!isConfigured) {
    throw new Error('Cloudinary not configured. Please set environment variables.');
  }

  try {
    const searchExpression = `tags:${tags.join(' AND tags:')}`;
    
    const searchOptions = {
      expression: searchExpression,
      max_results: options.max_results || 50,
      sort_by: options.sort_by || [['created_at', 'desc']],
      with_field: options.with_field || []
    };

    let search = cloudinary.search
      .expression(searchOptions.expression)
      .max_results(searchOptions.max_results)
      .sort_by(...searchOptions.sort_by);

    if (options.next_cursor) {
      search = search.next_cursor(options.next_cursor);
    }

    const result = await search.execute();
    return result;

  } catch (error) {
    console.error('❌ Media search failed:', error);
    throw new Error(`Media search failed: ${error.message}`);
  }
};

/**
 * Search media by document ID
 * @param {string} documentId - Document ID to search for
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results
 */
const searchByDocumentId = async (documentId, options = {}) => {
  if (!isConfigured) {
    throw new Error('Cloudinary not configured. Please set environment variables.');
  }

  try {
    const searchExpression = `context.document_id=${documentId}`;
    
    let search = cloudinary.search
      .expression(searchExpression)
      .max_results(options.max_results || 50)
      .sort_by('created_at', 'desc');

    const result = await search.execute();
    return result;

  } catch (error) {
    console.error('❌ Document search failed:', error);
    throw new Error(`Document search failed: ${error.message}`);
  }
};

/**
 * Get Cloudinary configuration status
 * @returns {Object} Configuration status
 */
const getConfigStatus = () => {
  return {
    configured: isConfigured,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'not_set',
    apiKey: process.env.CLOUDINARY_API_KEY ? '***set***' : 'not_set',
    apiSecret: process.env.CLOUDINARY_API_SECRET ? '***set***' : 'not_set',
    environment: process.env.NODE_ENV || 'development'
  };
};

/**
 * Initialize Cloudinary and test connection
 * @returns {Promise<Object>} Connection test result
 */
const testConnection = async () => {
  try {
    const status = getConfigStatus();
    
    if (!status.configured) {
      return {
        success: false,
        message: 'Cloudinary not configured. Check environment variables.',
        status
      };
    }

    // Test with a simple API call
    const result = await cloudinary.api.ping();
    
    return {
      success: true,
      message: 'Cloudinary connection successful',
      status: result
    };
  } catch (error) {
    return {
      success: false,
      message: `Cloudinary connection failed: ${error.message}`,
      error: error.message
    };
  }
};

/**
 * Get usage stats (admin only)
 * @returns {Promise<Object>} Usage statistics
 */
const getUsageStats = async () => {
  if (!isConfigured) {
    throw new Error('Cloudinary not configured. Please set environment variables.');
  }

  try {
    const result = await cloudinary.api.usage();
    return result;
  } catch (error) {
    console.error('❌ Failed to get usage stats:', error);
    throw new Error(`Failed to get usage stats: ${error.message}`);
  }
};

module.exports = {
  cloudinary,
  uploadImage,
  uploadVideo,
  uploadFile,
  deleteMedia,
  getMediaDetails,
  getOptimizedUrl,
  searchByTags,
  searchByDocumentId,
  getConfigStatus,
  testConnection,
  getUsageStats,
  isConfigured
};
