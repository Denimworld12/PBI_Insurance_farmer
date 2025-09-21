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

// Import routes (CORRECTED PATHS)
const authRoutes = require('./routes/auth.routes.js');
const insuranceRoutes = require('./routes/insurance.routes.js');
const claimRoutes = require('./routes/claims.routes.js');
const mediaRoutes = require('./routes/media.routes.js');

// Import middleware (CORRECTED PATH)
const auth = require('./middleware/auth.middleware.js');

const app = express();
const PORT = process.env.PORT || 5000;

// Create necessary directories
const ensureDirectories = () => {
    const dirs = ['uploads', 'temp', 'data'];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`✅ Created directory: ${dir}`);
        }
    });
};

ensureDirectories();

// Security middleware
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
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database connection (FIXED - REMOVED DEPRECATED OPTIONS)
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI );
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        console.log('💡 Make sure MongoDB is running or check your MONGODB_URI in .env');
        // Don't exit in development to allow mock routes to work
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }
};

// Connect to database
connectDB();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Home route
app.get('/', (req, res) => {
    res.json({
        message: 'PBI Agriculture Insurance Backend API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            insurance: '/api/insurance',
            claims: '/api/claims',
            media: '/api/media',
            health: '/health'
        }
    });
});

// Try to use actual routes, fall back to mock routes if files don't exist
let useRealRoutes = true;

// Check if route files exist
const routeFiles = [
    './routes/auth.routes.js',
    './routes/insurance.routes.js',
    './routes/claims.routes.js',
    './routes/media.routes.js'
];

routeFiles.forEach(file => {
    if (!fs.existsSync(path.join(__dirname, file))) {
        console.log(`⚠️ Route file not found: ${file} - Using mock routes`);
        useRealRoutes = false;
    }
});

// Use real routes if all files exist
if (useRealRoutes) {
    try {
        app.use('/api/auth', authRoutes);
        app.use('/api/insurance', insuranceRoutes);
        app.use('/api/claims', claimRoutes);
        app.use('/api/media', mediaRoutes);
        console.log('✅ Using real API routes');
    } catch (error) {
        console.log('⚠️ Error loading routes, falling back to mock routes');
        useRealRoutes = false;
    }
}

// Mock routes for development
if (!useRealRoutes) {
    console.log('🔧 Using mock routes for development');
    
    // Mock auth routes
    app.post('/api/auth/send-otp', (req, res) => {
        const { phoneNumber } = req.body;
        console.log(`📱 Mock OTP sent to: ${phoneNumber}`);
        res.json({
            success: true,
            message: 'OTP sent successfully',
            devOTP: '123456' // Development OTP
        });
    });

    app.post('/api/auth/verify-otp', (req, res) => {
        const { phoneNumber, otp } = req.body;
        if (otp === '123456') {
            res.json({
                success: true,
                token: 'mock-jwt-token',
                user: {
                    id: 'mock-user-id',
                    phoneNumber,
                    isVerified: true
                }
            });
        } else {
            res.status(400).json({ success: false, error: 'Invalid OTP' });
        }
    });

    // Mock insurance routes
    app.get('/api/insurance/list', (req, res) => {
        res.json({
            success: true,
            insurances: [
                {
                    _id: '1',
                    name: 'Pradhan Mantri Fasal Bima Yojana',
                    type: 'crop',
                    shortDescription: 'Comprehensive crop insurance for all farmers',
                    imageUrl: '/placeholder-insurance.jpg',
                    schemes: [{ name: 'Basic Coverage', code: 'PMFBY001' }]
                },
                {
                    _id: '2',
                    name: 'Weather Based Crop Insurance',
                    type: 'weather',
                    shortDescription: 'Protection against adverse weather conditions',
                    imageUrl: '/placeholder-weather.jpg',
                    schemes: [{ name: 'Weather Shield', code: 'WBCI001' }]
                }
            ]
        });
    });

    app.get('/api/insurance/:id', (req, res) => {
        const { id } = req.params;
        res.json({
            success: true,
            insurance: {
                _id: id,
                name: 'Sample Insurance',
                description: 'Sample insurance description',
                schemes: [{ name: 'Basic', code: 'BASIC001', seasons: ['Kharif', 'Rabi'] }]
            }
        });
    });

    // Mock claims routes  
    app.get('/api/claims/list', (req, res) => {
        res.json({
            success: true,
            claims: [],
            pagination: {
                currentPage: 1,
                totalPages: 1,
                totalClaims: 0
            }
        });
    });

    app.post('/api/claims/initialize', (req, res) => {
        const documentId = Math.floor(10000000 + Math.random() * 90000000) + 
                          Math.random().toString(36).substring(2, 4).toUpperCase();
        res.json({
            success: true,
            message: 'Claim initialized successfully',
            claim: {
                id: 'mock-claim-id',
                documentId,
                status: 'draft'
            }
        });
    });

    app.post('/api/claims/complete', (req, res) => {
        res.json({
            success: true,
            message: 'Claim processing completed',
            claim: {
                id: 'mock-claim-id',
                documentId: req.body.documentId,
                status: 'submitted'
            }
        });
    });

    // Mock media routes
    app.post('/api/media/upload', (req, res) => {
        res.json({
            success: true,
            message: 'Media upload simulated',
            file: {
                url: '/mock-upload-url',
                filename: 'mock-file.jpg'
            }
        });
    });
}

// Legacy upload route (your existing pipeline integration)
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image and video files are allowed'));
        }
    }
});

app.post("/api/claims/upload", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const lat = parseFloat(req.body.lat);
        const lon = parseFloat(req.body.lon);
        const overlayText = req.body.overlay_text || "";
        const clientTs = Number(req.body.client_ts) || Date.now();
        const parcelId = req.body.parcel_id || "DEFAULT_PARCEL";

        // Validate coordinates
        if (isNaN(lat) || isNaN(lon)) {
            return res.status(400).json({ error: 'Invalid coordinates provided' });
        }

        // Ensure cadastral data exists
        const cadastralPath = path.join(__dirname, "data", "parcel.geojson");
        if (!fs.existsSync(cadastralPath)) {
            const sampleParcel = {
                "type": "FeatureCollection",
                "features": [{
                    "type": "Feature",
                    "properties": {
                        "parcel_id": "DEFAULT_PARCEL",
                        "owner": "Sample Farmer",
                        "area": 5.5,
                        "crop_type": "Rice"
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[72.0, 19.0], [72.01, 19.0], [72.01, 19.01], [72.0, 19.01], [72.0, 19.0]]]
                    }
                }]
            };
            fs.writeFileSync(cadastralPath, JSON.stringify(sampleParcel, null, 2));
        }

        // Check if Python worker exists
        const workerPath = path.join(__dirname, "../worker/pipeline.py");
        if (!fs.existsSync(workerPath)) {
            console.log(`⚠️ Python worker not found at: ${workerPath}`);
            // Return mock processing result
            const mockResult = {
                final: {
                    risk: 'low',
                    verification_level: 'auto-approve',
                    need_physical_check: false
                },
                phases: {
                    damage_pct: Math.random() * 0.5, // Random damage 0-50%
                    forensics: { overlay_consistent: true },
                    geo_match: true
                },
                metadata: {
                    uploadedFile: req.file.originalname,
                    fileSize: req.file.size,
                    coordinates: { lat, lon },
                    timestamp: new Date(clientTs).toISOString(),
                    processingTime: 1000,
                    mode: 'mock'
                }
            };
            
            // Clean up uploaded file
            fs.unlink(filePath, () => {});
            
            return res.json(mockResult);
        }

        // Run actual Python pipeline
        const py = spawn("python3", [
            workerPath,
            filePath,
            String(lat),
            String(lon),
            String(clientTs),
            cadastralPath,
            overlayText,
            parcelId
        ], {
            cwd: process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let out = "";
        let err = "";

        py.stdout.on("data", (data) => {
            out += data.toString();
        });

        py.stderr.on("data", (data) => {
            const errorMsg = data.toString();
            console.log("PYTHON STDERR:", errorMsg);
            err += errorMsg;
        });

        py.on("close", (code) => {
            try {
                if (code !== 0) {
                    throw new Error(`Pipeline failed with code ${code}: ${err}`);
                }

                let result;
                try {
                    result = JSON.parse(out);
                } catch (parseError) {
                    throw new Error(`Failed to parse pipeline output: ${parseError.message}\nOutput: ${out}`);
                }

                result.metadata = {
                    uploadedFile: req.file.originalname,
                    fileSize: req.file.size,
                    coordinates: { lat, lon },
                    timestamp: new Date(clientTs).toISOString(),
                    processingTime: Date.now() - clientTs
                };

                res.json(result);

            } catch (error) {
                console.error('Pipeline processing error:', error);
                res.status(500).json({
                    error: error.message,
                    details: {
                        stderr: err,
                        stdout: out,
                        code: code
                    }
                });
            } finally {
                fs.unlink(filePath, (unlinkError) => {
                    if (unlinkError) {
                        console.error('Failed to delete temp file:', unlinkError);
                    }
                });
            }
        });

        py.on('error', (error) => {
            console.error('Failed to start Python process:', error);
            res.status(500).json({
                error: 'Failed to start image processing pipeline',
                details: error.message
            });
        });

        const timeout = setTimeout(() => {
            py.kill('SIGKILL');
            res.status(408).json({
                error: 'Pipeline processing timeout',
                details: 'Processing took too long and was terminated'
            });
        }, 60000);

        py.on('close', () => {
            clearTimeout(timeout);
        });

    } catch (error) {
        console.error('Upload endpoint error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Cloudinary test route
app.get('/api/test/cloudinary', async (req, res) => {
    try {
        const { testConnection } = require('./config/cloudinary');
        const result = await testConnection();
        res.json(result);
    } catch (error) {
        res.json({
            success: false,
            error: 'Cloudinary config not found',
            message: 'Create config/cloudinary.js file'
        });
    }
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);

    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'File too large',
                details: 'Maximum file size is 50MB'
            });
        }
    }

    res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Handle 404
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
    });
});

// Graceful shutdown
const gracefulShutdown = () => {
    console.log('\n🛑 Received shutdown signal, shutting down gracefully...');

    if (mongoose.connection.readyState === 1) {
        mongoose.connection.close(() => {
            console.log('📴 MongoDB connection closed');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
app.listen(PORT, () => {
    console.log(`🚀 PBI Agriculture Insurance Backend running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📂 Upload directory: ${path.join(__dirname, 'uploads')}`);
    console.log(`🔧 Health check: http://localhost:${PORT}/health`);
    console.log(`🔧 API docs: http://localhost:${PORT}/`);
});

module.exports = app;
