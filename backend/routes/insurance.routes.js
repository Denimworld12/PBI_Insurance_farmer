
const express = require('express');
const Insurance = require('../models/Insurance.model.js');
const auth = require('../middleware/auth.middleware.js');
const router = express.Router();

/**
 * Get all active insurance plans
 * GET /api/insurance/list
 */
router.get('/list', async (req, res) => {
    try {
        const { state, type, search } = req.query;

        // Build filter query
        let filter = { isActive: true };

        if (state) {
            filter.availableStates = { $in: [state] };
        }

        if (type) {
            filter.type = type;
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const insurances = await Insurance.find(filter)
            .select('name description shortDescription imageUrl type schemes availableStates stats')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            insurances,
            count: insurances.length
        });

    } catch (error) {
        console.error('Get insurances error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch insurance plans'
        });
    }
});

/**
 * Get insurance details by ID
 * GET /api/insurance/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const insurance = await Insurance.findById(req.params.id);

        if (!insurance || !insurance.isActive) {
            return res.status(404).json({
                success: false,
                error: 'Insurance plan not found'
            });
        }

        res.json({
            success: true,
            insurance
        });

    } catch (error) {
        console.error('Get insurance details error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch insurance details'
        });
    }
});

/**
 * Get schemes by insurance ID and season
 * GET /api/insurance/:id/schemes
 */
router.get('/:id/schemes', async (req, res) => {
    try {
        const { season } = req.query;
        const insurance = await Insurance.findById(req.params.id);

        if (!insurance || !insurance.isActive) {
            return res.status(404).json({
                success: false,
                error: 'Insurance plan not found'
            });
        }

        let schemes = insurance.schemes;

        if (season) {
            schemes = schemes.filter(scheme =>
                scheme.seasons.includes(season)
            );
        }

        res.json({
            success: true,
            schemes,
            insuranceName: insurance.name
        });

    } catch (error) {
        console.error('Get schemes error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch schemes'
        });
    }
});

/**
 * Create new insurance plan (Admin only)
 * POST /api/insurance/create
 */
router.post('/create', auth, async (req, res) => {
    try {
        // Add admin check here if needed
        const insurance = new Insurance(req.body);
        await insurance.save();

        res.status(201).json({
            success: true,
            message: 'Insurance plan created successfully',
            insurance
        });

    } catch (error) {
        console.error('Create insurance error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create insurance plan'
        });
    }
});

/**
 * Get insurance types and categories
 * GET /api/insurance/types
 */
router.get('/meta/types', (req, res) => {
    res.json({
        success: true,
        types: ['crop', 'livestock', 'weather', 'equipment'],
        categories: ['government', 'private', 'cooperative'],
        seasons: ['Kharif', 'Rabi', 'Summer']
    });
});

// Mock data route for development
if (process.env.NODE_ENV === 'development') {
    router.get('/dev/seed', async (req, res) => {
        try {
            const mockInsurances = [
                {
                    name: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
                    description: 'Comprehensive crop insurance scheme providing coverage against all non-preventable natural risks from sowing to harvesting.',
                    shortDescription: 'Government crop insurance covering natural disasters and yield losses',
                    imageUrl: '/images/pmfby.jpg',
                    type: 'crop',
                    category: 'government',
                    schemes: [
                        {
                            name: 'Basic Coverage',
                            code: 'PMFBY001',
                            coverage: { percentage: 100, maxAmount: 200000 },
                            premium: { rate: 2, minAmount: 500, maxAmount: 5000 },
                            seasons: ['Kharif', 'Rabi'],
                            eligibleCrops: ['Rice', 'Wheat', 'Maize', 'Cotton', 'Sugarcane'],
                            riskCoverage: ['drought', 'flood', 'pest', 'disease', 'hail', 'cyclone']
                        }
                    ],
                    availableStates: ['Maharashtra', 'Punjab', 'Haryana', 'Uttar Pradesh', 'Rajasthan'],
                    eligibility: {
                        minFarmSize: 0.1,
                        maxFarmSize: 100,
                        farmerTypes: ['landowner', 'tenant', 'sharecropper'],
                        crops: ['Rice', 'Wheat', 'Maize', 'Cotton']
                    },
                    isActive: true
                },
                {
                    name: 'Weather Based Crop Insurance Scheme (WBCIS)',
                    description: 'Insurance based on weather parameters like rainfall, temperature, humidity, wind speed etc.',
                    shortDescription: 'Weather-based crop protection against adverse climatic conditions',
                    imageUrl: '/images/wbcis.jpg',
                    type: 'weather',
                    category: 'government',
                    schemes: [
                        {
                            name: 'Weather Shield',
                            code: 'WBCI001',
                            coverage: { percentage: 80, maxAmount: 150000 },
                            premium: { rate: 3, minAmount: 750, maxAmount: 7500 },
                            seasons: ['Kharif', 'Rabi', 'Summer'],
                            eligibleCrops: ['All crops'],
                            riskCoverage: ['drought', 'excess_rain', 'temperature', 'humidity']
                        }
                    ],
                    availableStates: ['Gujarat', 'Maharashtra', 'Karnataka', 'Tamil Nadu'],
                    eligibility: {
                        minFarmSize: 0.5,
                        maxFarmSize: 50,
                        farmerTypes: ['landowner', 'tenant']
                    },
                    isActive: true
                }
            ];

            await Insurance.insertMany(mockInsurances);

            res.json({
                success: true,
                message: 'Mock insurance data seeded successfully',
                count: mockInsurances.length
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to seed data: ' + error.message
            });
        }
    });
}

module.exports = router;

