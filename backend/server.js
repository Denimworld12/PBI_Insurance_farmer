const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// In-memory storage (use Redis/MongoDB in production)
const claimResults = new Map();

// ==================== DIRECTORY SETUP ====================

const ensureDirectories = () => {
    const dirs = ['uploads', 'temp', 'data', 'reports', 'worker'];
    dirs.forEach(dir => {
        const dirPath = path.join(__dirname, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`✅ Created directory: ${dir}`);
        }
    });
};
ensureDirectories();

// ==================== PYTHON WORKER VALIDATION ====================

const validatePythonWorker = () => {
    const workerPath = path.join(__dirname, 'worker', 'pipeline.py');
    
    if (!fs.existsSync(workerPath)) {
        console.log('⚠️ Python worker not found at:', workerPath);
        console.log('ℹ️ Python processing will use fallback mode');
        return false;
    }
    
    console.log('✅ Python worker found:', workerPath);
    return true;
};

const pythonWorkerAvailable = validatePythonWorker();

// ==================== SECURITY & MIDDLEWARE ====================

app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1 && process.env.NODE_ENV === 'production') {
            return callback(new Error('CORS policy violation'), false);
        }
        callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==================== DATABASE CONNECTION ====================

const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.log('⚠️ No MONGODB_URI found, running without database');
            return;
        }

        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
        });
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        if (process.env.NODE_ENV === 'production') {
            console.log('⚠️ Running without database in production mode');
        }
    }
};
connectDB();

// ==================== CORE ROUTES ====================

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        activeClaims: claimResults.size,
        pythonWorker: pythonWorkerAvailable ? 'available' : 'fallback_mode',
        version: '3.0.0'
    });
});

app.get('/', (req, res) => {
    res.json({
        message: 'PBI Agriculture Insurance Backend API',
        version: '3.0.0',
        status: 'running',
        endpoints: {
            auth: '/api/auth',
            insurance: '/api/insurance',
            claims: '/api/claims',
            health: '/health'
        }
    });
});

// ==================== INSURANCE ROUTES ====================

app.get('/api/insurance/list', (req, res) => {
    res.json({
        success: true,
        insurances: [
            {
                _id: '1',
                name: 'Pradhan Mantri Fasal Bima Yojana',
                type: 'crop',
                shortDescription: 'Government crop insurance with comprehensive coverage',
                imageUrl: '/placeholder-insurance.jpg',
                schemes: [{ name: 'PMFBY Basic Coverage', code: 'PMFBY001' }],
                availableStates: ['Maharashtra', 'Punjab', 'Haryana', 'UP']
            },
            {
                _id: '2',
                name: 'Weather Based Crop Insurance Scheme',
                type: 'weather',
                shortDescription: 'Weather-based protection with real-time monitoring',
                imageUrl: '/placeholder-weather.jpg',
                schemes: [{ name: 'WBCIS Weather Shield', code: 'WBCI001' }],
                availableStates: ['Gujarat', 'Karnataka', 'Tamil Nadu']
            }
        ]
    });
});

app.get('/api/insurance/:id', (req, res) => {
    const { id } = req.params;
    const insuranceData = {
        '1': {
            _id: '1',
            name: 'Pradhan Mantri Fasal Bima Yojana',
            description: 'Comprehensive crop insurance scheme',
            type: 'crop',
            schemes: [{
                name: 'PMFBY Basic Coverage',
                code: 'PMFBY001',
                seasons: ['Kharif', 'Rabi', 'Summer'],
                coverage: { percentage: 100, maxAmount: 200000 }
            }],
            availableStates: ['Maharashtra', 'Punjab', 'Haryana', 'UP']
        },
        '2': {
            _id: '2',
            name: 'Weather Based Crop Insurance Scheme',
            description: 'Insurance based on weather parameters',
            type: 'weather',
            schemes: [{
                name: 'WBCIS Weather Shield',
                code: 'WBCI001',
                seasons: ['Kharif', 'Rabi'],
                coverage: { percentage: 80, maxAmount: 150000 }
            }],
            availableStates: ['Gujarat', 'Karnataka', 'Tamil Nadu']
        }
    };

    res.json({
        success: true,
        insurance: insuranceData[id] || insuranceData['1']
    });
});

// ==================== FILE UPLOAD ====================

const upload = multer({
    dest: path.join(__dirname, 'uploads'),
    limits: { 
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024 
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image and video files allowed'));
        }
    }
});

app.post('/api/claims/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                error: 'No file uploaded' 
            });
        }

        const { lat, lon, client_ts, parcel_id, step_id, media_type } = req.body;
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

        console.log(`📤 File received: ${step_id} for ${parcel_id}`);

        if (!claimResults.has(parcel_id)) {
            claimResults.set(parcel_id, {
                documentId: parcel_id,
                uploaded_files: {},
                metadata: {
                    timestamp: new Date().toISOString(),
                    processing_mode: 'batch_processing'
                }
            });
        }

        const claimData = claimResults.get(parcel_id);
        claimData.uploaded_files[step_id] = {
            filePath: req.file.path,
            originalName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            coordinates,
            timestamp: Number(client_ts) || Date.now(),
            stepId: step_id,
            mediaType: media_type || 'photo'
        };
        claimResults.set(parcel_id, claimData);

        console.log(`✅ Stored ${step_id} (${Object.keys(claimData.uploaded_files).length} files total)`);

        res.json({
            success: true,
            message: 'File uploaded successfully',
            stepId: step_id,
            filesUploaded: Object.keys(claimData.uploaded_files).length
        });

    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Server error during upload', 
            details: process.env.NODE_ENV === 'development' ? error.message : 'Upload failed'
        });
    }
});

// ==================== PYTHON BATCH PROCESSING ====================

async function processBatchWithPython(parcelId) {
    console.log(`🐍 Starting batch Python processing for: ${parcelId}`);

    const claimData = claimResults.get(parcelId);
    if (!claimData?.uploaded_files) {
        throw new Error('No uploaded files found');
    }

    const files = claimData.uploaded_files;
    const cornerSteps = ['corner-ne', 'corner-nw', 'corner-se', 'corner-sw'];
    const cornerFiles = cornerSteps.map(step => files[step]).filter(f => f?.mediaType === 'photo');
    const damageFile = files['damaged-crop'];

    if (cornerFiles.length < 4) {
        return generateFallbackResult(files, `Only ${cornerFiles.length}/4 corner images`);
    }
    if (!damageFile) {
        return generateFallbackResult(files, 'Missing damage image');
    }

    const workerPath = path.join(__dirname, 'worker', 'pipeline.py');
    if (!fs.existsSync(workerPath)) {
        console.log('⚠️ Python worker not found');
        return generateFallbackResult(files, 'Python worker unavailable');
    }

    const cadastralPath = path.join(__dirname, 'data', 'parcel.geojson');
    if (!fs.existsSync(cadastralPath)) {
        const { lat, lon } = cornerFiles[0].coordinates;
        const boundary = {
            type: "FeatureCollection",
            features: [{
                type: "Feature",
                properties: { parcel_id: parcelId },
                geometry: {
                    type: "Polygon",
                    coordinates: [[
                        [lon - 0.003, lat - 0.003],
                        [lon + 0.003, lat - 0.003],
                        [lon + 0.003, lat + 0.003],
                        [lon - 0.003, lat + 0.003],
                        [lon - 0.003, lat - 0.003]
                    ]]
                }
            }]
        };
        fs.mkdirSync(path.dirname(cadastralPath), { recursive: true });
        fs.writeFileSync(cadastralPath, JSON.stringify(boundary, null, 2));
        console.log('✅ Created cadastral boundary');
    }

    const pythonCommand = process.env.PYTHON_COMMAND || 'python';
    const args = [
        workerPath,
        ...cornerFiles.flatMap(f => [f.filePath, String(f.coordinates.lat), String(f.coordinates.lon)]),
        damageFile.filePath,
        '50.0',
        '100000',
        cadastralPath,
        parcelId,
        '1'
    ];

    console.log(`🚀 Executing Python: ${pythonCommand} with ${args.length} arguments`);

    return new Promise((resolve, reject) => {
        const py = spawn(pythonCommand, args, {
            cwd: process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';
        const timeout = setTimeout(() => {
            py.kill();
            reject(new Error('Python timeout (60s)'));
        }, 60000);

        py.stdout.on('data', data => stdout += data.toString());
        py.stderr.on('data', data => {
            const msg = data.toString();
            console.log('[PYTHON]:', msg);
            stderr += msg;
        });

        py.on('close', code => {
            clearTimeout(timeout);
            if (code !== 0) {
                reject(new Error(`Python failed with code ${code}: ${stderr}`));
                return;
            }
            try {
                const result = JSON.parse(stdout);
                console.log('✅ Python processing completed');
                resolve(result);
            } catch (error) {
                reject(new Error(`Invalid JSON from Python: ${error.message}`));
            }
        });

        py.on('error', error => {
            clearTimeout(timeout);
            reject(new Error(`Failed to start Python: ${error.message}`));
        });
    });
}

function generateFallbackResult(files, reason) {
    console.log(`⚠️ Fallback result: ${reason}`);
    return {
        claim_id: `FALLBACK_${Date.now()}`,
        processing_timestamp: new Date().toISOString(),
        overall_assessment: {
            final_decision: 'MANUAL_REVIEW',
            confidence_score: 0.3,
            risk_level: 'medium',
            manual_review_required: true
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
            currency: 'INR'
        },
        verification_evidence: {
            authenticity_verified: false,
            location_verified: false,
            processing_note: reason
        },
        recommendation: {
            action: 'SCHEDULE_MANUAL_REVIEW',
            processing_priority: 'high'
        },
        audit_trail: {
            processed_by: 'Fallback_System',
            fallback_reason: reason
        }
    };
}

function determineClaimDecision(pythonResult) {
    const confidence = pythonResult.overall_assessment?.confidence_score || 0;
    
    if (confidence >= 0.70) {
        return {
            decision: 'APPROVE',
            status: 'approved',
            action: 'PROCESS_PAYOUT',
            risk: 'low',
            manual_review_required: false,
            reason: `High confidence (${(confidence * 100).toFixed(1)}%) - Claim approved for payout`,
            next_steps: 'Payout will be processed within 3-5 business days',
            user_message: '✅ Claim Approved! Your payout is being processed.',
            payout_approved: true
        };
    } else if (confidence >= 0.30 && confidence < 0.70) {
        return {
            decision: 'MANUAL_REVIEW',
            status: 'manual_review',
            action: 'SCHEDULE_MANUAL_REVIEW',
            risk: 'medium',
            manual_review_required: true,
            reason: `Moderate confidence (${(confidence * 100).toFixed(1)}%) - Requires manual verification`,
            next_steps: 'Our team will review your claim within 2-3 business days',
            user_message: '🔍 Manual Review Required - Our team will verify your claim',
            payout_approved: false
        };
    } else {
        return {
            decision: 'REJECT',
            status: 'rejected',
            action: 'REQUEST_RESUBMISSION',
            risk: 'high',
            manual_review_required: false,
            reason: `Low confidence (${(confidence * 100).toFixed(1)}%) - Insufficient or unclear evidence`,
            next_steps: 'Please re-submit your claim with clearer evidence',
            user_message: '❌ Claim Rejected - Please capture clearer images and re-submit',
            payout_approved: false
        };
    }
}

function mapPythonToFrontend(pythonResult) {
    const confidence = pythonResult.overall_assessment?.confidence_score || 0;
    const decision = determineClaimDecision(pythonResult);
    
    return {
        overall_confidence: confidence,
        recommendation: {
            status: decision.status,
            reason: decision.reason,
            action: decision.action,
            next_steps: decision.next_steps,
            user_message: decision.user_message
        },
        final_decision: {
            decision: decision.decision,
            risk_level: decision.risk,
            manual_review_required: decision.manual_review_required,
            confidence_score: confidence,
            threshold_applied: confidence >= 0.70 ? 'auto_approve' : 
                              confidence >= 0.30 ? 'manual_review' : 'reject_retry',
            payout_approved: decision.payout_approved
        },
        summary: {
            total_files_processed: 5,
            successful_extractions: pythonResult.verification_evidence?.authenticity_verified ? 5 : 3,
            failed_extractions: 0,
            exif_data_extracted: 5,
            weather_data_obtained: pythonResult.verification_evidence?.weather_supports_claim ? 5 : 0,
            geofencing_successful: pythonResult.verification_evidence?.location_verified ? 5 : 0,
            coordinate_matches: pythonResult.verification_evidence?.location_verified ? 5 : 0
        },
        damage_assessment: pythonResult.damage_assessment || {},
        payout_calculation: {
            ...pythonResult.payout_calculation,
            payout_approved: decision.payout_approved,
            payout_status: decision.decision === 'APPROVE' ? 'processing' : 
                          decision.decision === 'MANUAL_REVIEW' ? 'pending_review' : 'rejected',
            final_payout_amount: decision.payout_approved ? 
                                pythonResult.payout_calculation?.final_payout_amount : 0
        },
        verification_evidence: pythonResult.verification_evidence || {},
        detailed_scores: pythonResult.detailed_scores || {},
        fraud_indicators: pythonResult.fraud_indicators || {},
        full_analysis: pythonResult
    };
}

// ==================== CLAIMS ENDPOINTS ====================

// Initialize claim
app.post('/api/claims/initialize', async (req, res) => {
    try {
        console.log('📋 Claim initialization requested');
        
        const { insuranceId, formData } = req.body;

        const timestamp = Date.now().toString().slice(-8);
        const random = Math.floor(Math.random() * 90 + 10);
        const letters = Math.random().toString(36).substring(2, 4).toUpperCase();
        const documentId = `CLM-${timestamp}${random}-${letters}`;

        // Store in claimResults for processing
        claimResults.set(documentId, {
            documentId,
            insuranceId,
            formData: formData || {},
            uploaded_files: {},
            status: 'draft',
            createdAt: new Date().toISOString(),
            metadata: {
                timestamp: new Date().toISOString(),
                processing_mode: 'batch_processing'
            }
        });

        console.log(`✅ Claim initialized: ${documentId}`);

        res.status(201).json({
            success: true,
            message: 'Claim initialized successfully',
            claim: {
                id: `claim_${Date.now()}`,
                documentId,
                status: 'draft'
            }
        });

    } catch (error) {
        console.error('❌ Initialize claim error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to initialize claim'
        });
    }
});

// Complete claim (with Python processing)
app.post('/api/claims/complete', async (req, res) => {
    console.log('🎯 COMPLETION - Starting batch processing');
    const { documentId, media, totalSteps, completedSteps } = req.body;

    try {
        if (!documentId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Document ID is required' 
            });
        }

        if (!claimResults.has(documentId)) {
            return res.status(404).json({ 
                success: false, 
                error: 'Document not found. Please reinitialize the claim.' 
            });
        }

        console.log('🐍 Triggering Python batch processing...');
        let pythonResult;
        
        try {
            pythonResult = await processBatchWithPython(documentId);
        } catch (error) {
            console.error('❌ Python failed:', error.message);
            const claimData = claimResults.get(documentId);
            pythonResult = generateFallbackResult(claimData.uploaded_files, error.message);
        }

        const claimData = claimResults.get(documentId);
        claimData.aggregated_analysis = mapPythonToFrontend(pythonResult);
        claimData.metadata.status = 'completed';
        claimData.metadata.completedAt = new Date().toISOString();
        claimData.status = 'submitted';
        claimResults.set(documentId, claimData);

        // Cleanup uploaded files (optional)
        Object.values(claimData.uploaded_files || {}).forEach(file => {
            if (file.filePath && fs.existsSync(file.filePath)) {
                fs.unlink(file.filePath, (err) => {
                    if (err) console.error('File cleanup error:', err);
                });
            }
        });

        console.log('✅ Batch processing completed');

        res.json({
            success: true,
            message: 'Claim completed successfully',
            claim: {
                id: `claim-${documentId}`,
                documentId,
                status: 'submitted',
                completedAt: new Date().toISOString(),
                processingResult: claimData.aggregated_analysis
            }
        });

    } catch (error) {
        console.error('❌ Completion error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to complete claim',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Processing failed'
        });
    }
});

// Get claim results
app.get('/api/claims/results/:documentId', (req, res) => {
    console.log('📊 RESULTS - Request for:', req.params.documentId);
    const { documentId } = req.params;

    if (claimResults.has(documentId)) {
        const claimData = claimResults.get(documentId);
        
        res.json({
            success: true,
            claim: {
                documentId,
                status: 'submitted',
                submitted_at: claimData.metadata?.completedAt || new Date().toISOString()
            },
            processing_result: claimData.aggregated_analysis || {},
            media: {},
            individual_results: {},
            metadata: {
                ...claimData.metadata,
                data_source: 'python_batch_processing',
                pythonWorker: pythonWorkerAvailable ? 'used' : 'fallback'
            }
        });
    } else {
        console.log('⚠️ Document not found');
        res.json({
            success: true,
            claim: {
                documentId,
                status: 'submitted',
                submitted_at: new Date().toISOString()
            },
            processing_result: {
                overall_confidence: 0.0,
                recommendation: {
                    status: 'error',
                    reason: 'Claim data not found',
                    user_message: '❌ Error: Claim data not found'
                }
            },
            media: {},
            individual_results: {},
            metadata: {
                timestamp: new Date().toISOString(),
                data_source: 'mock_fallback',
                error: 'Document not found'
            }
        });
    }
});

// Get claims list
app.get('/api/claims/list', (req, res) => {
    try {
        console.log('📋 Claims list requested');
        
        const claims = Array.from(claimResults.entries()).map(([docId, data]) => ({
            documentId: docId,
            status: data.status || 'draft',
            submittedAt: data.metadata?.completedAt || data.createdAt,
            insuranceId: data.insuranceId
        }));

        res.json({
            success: true,
            claims,
            count: claims.length
        });

    } catch (error) {
        console.error('❌ Get claims error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch claims'
        });
    }
});

// ==================== ERROR HANDLING ====================

app.use((error, req, res, next) => {
    console.error('Global error:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                success: false,
                error: 'File too large (max 50MB)' 
            });
        }
        return res.status(400).json({ 
            success: false,
            error: error.message 
        });
    }
    
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

app.use('*', (req, res) => {
    res.status(404).json({ 
        success: false,
        error: 'Route not found', 
        path: req.originalUrl 
    });
});

// ==================== GRACEFUL SHUTDOWN ====================

const gracefulShutdown = () => {
    console.log('\n🛑 Shutting down gracefully...');
    if (mongoose.connection.readyState === 1) {
        mongoose.connection.close(() => {
            console.log('📴 MongoDB closed');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// ==================== START SERVER ====================

app.listen(PORT, () => {
    console.log(`\n🚀 PBI AgriInsure Backend v3.0`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔧 Health: http://localhost:${PORT}/health`);
    console.log(`🐍 Python Worker: ${pythonWorkerAvailable ? 'Available' : 'Fallback Mode'}`);
    console.log(`📊 Decision Logic: ≥70%=APPROVE, 30-70%=REVIEW, <30%=REJECT`);
    console.log(`🔐 CORS: ${allowedOrigins.join(', ')}\n`);
});

module.exports = app;
