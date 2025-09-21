const cloudinary = require('cloudinary').v2;

/**
 * Cloudinary configuration for media upload and management
 * Handles image and video storage with metadata
 */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload image to Cloudinary with user metadata
 * @param {Buffer} fileBuffer - Image file buffer
 * @param {Object} options - Upload options including user_id, document_id, etc.
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadImage = async (fileBuffer, options = {}) => {
  try {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        resource_type: 'image',
        folder: 'pbi-agriculture-insurance/images',
        public_id: options.public_id || undefined,
        context: {
          user_id: options.user_id || '',
          document_id: options.document_id || '',
          claim_type: options.claim_type || '',
          capture_timestamp: options.capture_timestamp || new Date().toISOString(),
          coordinates: options.coordinates || ''
        },
        transformation: [
          { width: 1920, height: 1080, crop: 'limit', quality: 'auto' },
          { fetch_format: 'auto' }
        ],
        tags: [
          'agriculture',
          'insurance',
          'claim',
          options.claim_type || 'general'
        ]
      };

      cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log(`✅ Image uploaded to Cloudinary: ${result.public_id}`);
            resolve(result);
          }
        }
      ).end(fileBuffer);
    });
  } catch (error) {
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
  try {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        resource_type: 'video',
        folder: 'pbi-agriculture-insurance/videos',
        public_id: options.public_id || undefined,
        context: {
          user_id: options.user_id || '',
          document_id: options.document_id || '',
          claim_type: options.claim_type || '',
          capture_timestamp: options.capture_timestamp || new Date().toISOString(),
          coordinates: options.coordinates || ''
        },
        transformation: [
          { width: 1280, height: 720, crop: 'limit', quality: 'auto' }
        ],
        tags: [
          'agriculture',
          'insurance',
          'claim',
          'video',
          options.claim_type || 'general'
        ]
      };

      cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('Cloudinary video upload error:', error);
            reject(error);
          } else {
            console.log(`✅ Video uploaded to Cloudinary: ${result.public_id}`);
            resolve(result);
          }
        }
      ).end(fileBuffer);
    });
  } catch (error) {
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
  try {
    const uploadOptions = {
      folder: 'pbi-agriculture-insurance',
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
        'claim'
      ]
    };

    const result = await cloudinary.uploader.upload(filePath, uploadOptions);
    console.log(`✅ File uploaded to Cloudinary: ${result.public_id}`);
    return result;

  } catch (error) {
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
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    
    console.log(`✅ Media deleted from Cloudinary: ${publicId}`);
    return result;
  } catch (error) {
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
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: resourceType
    });
    
    return result;
  } catch (error) {
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
  try {
    const defaultOptions = {
      quality: 'auto',
      fetch_format: 'auto'
    };

    const transformOptions = { ...defaultOptions, ...options };
    
    return cloudinary.url(publicId, transformOptions);
  } catch (error) {
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
  try {
    const searchOptions = {
      expression: `tags:${tags.join(' AND tags:')}`,
      max_results: options.max_results || 50,
      next_cursor: options.next_cursor
    };

    const result = await cloudinary.search
      .expression(searchOptions.expression)
      .max_results(searchOptions.max_results)
      .execute();

    return result;
  } catch (error) {
    throw new Error(`Media search failed: ${error.message}`);
  }
};

/**
 * Get Cloudinary configuration status
 * @returns {Object} Configuration status
 */
const getConfigStatus = () => {
  const isConfigured = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

  return {
    configured: isConfigured,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'not_set',
    apiKey: process.env.CLOUDINARY_API_KEY ? 'set' : 'not_set',
    apiSecret: process.env.CLOUDINARY_API_SECRET ? 'set' : 'not_set'
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
      throw new Error('Cloudinary not configured. Check environment variables.');
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

module.exports = {
  cloudinary,
  uploadImage,
  uploadVideo,
  uploadFile,
  deleteMedia,
  getMediaDetails,
  getOptimizedUrl,
  searchByTags,
  getConfigStatus,
  testConnection
};
