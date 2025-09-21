const express = require('express');
const multer = require('multer');
const { uploadImage, uploadVideo } = require('../config/cloudinary');
const { spawn } = require('child_process');
const path = require('path');
const exifr = require('exifr');
const auth = require('../middleware/auth.middleware.js');
const Claim = require('../models/Claims.model.js');

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|mp4|mov|webm/;
        const mimetype = allowedTypes.test(file.mimetype);
        cb(mimetype ? null : new Error('Invalid file type'), mimetype);
    }
});

// Process and upload media
router.post('/upload', auth, upload.single('media'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const {
            lat,
            lon,
            clientTs,
            stepId,
            documentId,
            runProcessing = 'false'
        } = req.body;

        // Extract EXIF data for images
        let exifData = {};
        if (req.file.mimetype.startsWith('image/')) {
            try {
                const exif = await exifr.parse(req.file.buffer);
                if (exif) {
                    exifData = {
                        camera: exif.Make && exif.Model ? `${exif.Make} ${exif.Model}` : null,
                        gpsAltitude: exif.GPSAltitude || null,
                        timestamp: exif.DateTimeOriginal || exif.CreateDate,
                        imageSize: {
                            width: exif.ExifImageWidth || exif.ImageWidth,
                            height: exif.ExifImageHeight || exif.ImageHeight
                        }
                    };
                }
            } catch (exifError) {
                console.warn('EXIF extraction failed:', exifError.message);
            }
        }

        // Upload to Cloudinary
        const uploadOptions = {
            user_id: req.userId.toString(),
            document_id: documentId,
            claim_type: stepId,
            capture_timestamp: new Date(parseInt(clientTs)).toISOString(),
            coordinates: `${lat},${lon}`
        };

        let cloudinaryResult;
        if (req.file.mimetype.startsWith('image/')) {
            cloudinaryResult = await uploadImage(req.file.buffer, uploadOptions);
        } else {
            cloudinaryResult = await uploadVideo(req.file.buffer, uploadOptions);
        }

        // Run fraud detection pipeline if requested
        let processingResult = null;
        if (runProcessing === 'true' && req.file.mimetype.startsWith('image/')) {
            try {
                // Save temporary file for pipeline processing
                const fs = require('fs');
                const tempPath = path.join(__dirname, '../temp', `${Date.now()}_${req.file.originalname}`);
                fs.writeFileSync(tempPath, req.file.buffer);

                processingResult = await runFraudDetectionPipeline(tempPath, lat, lon, clientTs);

                // Clean up temp file
                fs.unlinkSync(tempPath);
            } catch (processError) {
                console.warn('Pipeline processing failed:', processError.message);
            }
        }

        res.json({
            success: true,
            file: {
                cloudinaryUrl: cloudinaryResult.secure_url,
                publicId: cloudinaryResult.public_id,
                originalName: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype
            },
            exifData,
            coordinates: { lat: parseFloat(lat), lon: parseFloat(lon) },
            timestamp: new Date(parseInt(clientTs)),
            processingResult
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, error: 'Upload failed' });
    }
});

// Fraud detection pipeline integration
async function runFraudDetectionPipeline(filePath, lat, lon, clientTs) {
    return new Promise((resolve, reject) => {
        const parcelGeoJSON = path.join(__dirname, '../data/parcel.geojson');
        const overlayText = `${new Date(parseInt(clientTs)).toLocaleDateString()} (${new Date(parseInt(clientTs)).toLocaleDateString(undefined, { weekday: 'long' })}), ${lat}, ${lon}`;

        const python = spawn('python3', [
            path.join(__dirname, '../../worker/pipeline.py'),
            filePath,
            String(lat),
            String(lon),
            String(clientTs),
            parcelGeoJSON,
            overlayText,
            'DEFAULT_PARCEL'
        ]);

        let output = '';
        let error = '';

        python.stdout.on('data', (data) => output += data.toString());
        python.stderr.on('data', (data) => error += data.toString());

        python.on('close', (code) => {
            if (code === 0) {
                try {
                    resolve(JSON.parse(output));
                } catch (parseError) {
                    reject(new Error(`Parse error: ${parseError.message}`));
                }
            } else {
                reject(new Error(`Pipeline failed: ${error}`));
            }
        });
    });
}

module.exports = router;
