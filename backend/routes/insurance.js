const express = require('express');
const router = express.Router();

// Mock insurance data (will be replaced by database in production)
const mockInsurances = [
  {
    _id: '1',
    name: 'Pradhan Mantri Fasal Bima Yojana',
    type: 'crop',
    description: 'Comprehensive crop insurance scheme providing coverage against all non-preventable natural risks from sowing to harvesting. The scheme aims to stabilize farmer income and encourage adoption of innovative practices.',
    shortDescription: 'Government crop insurance covering natural disasters and yield losses',
    imageUrl: '/images/pmfby.jpg',
    schemes: [
      {
        name: 'PMFBY Basic Coverage',
        code: 'PMFBY001',
        seasons: ['Kharif', 'Rabi'],
        coverage: { 
          percentage: 100, 
          maxAmount: 200000,
          description: 'Complete coverage from sowing to harvesting'
        },
        premium: { 
          rate: 2, 
          minAmount: 500, 
          maxAmount: 5000,
          subsidyRate: 50
        }
      },
      {
        name: 'PMFBY Plus',
        code: 'PMFBY002',
        seasons: ['Kharif', 'Rabi', 'Summer'],
        coverage: { 
          percentage: 100, 
          maxAmount: 300000,
          description: 'Extended coverage including post-harvest losses'
        },
        premium: { 
          rate: 2.5, 
          minAmount: 750, 
          maxAmount: 7500,
          subsidyRate: 60
        }
      }
    ],
    availableStates: ['Maharashtra', 'Punjab', 'Haryana', 'Uttar Pradesh', 'Madhya Pradesh'],
    eligibility: {
      farmerTypes: ['Small', 'Medium', 'Large'],
      landOwnership: ['Owner', 'Tenant', 'Sharecropper'],
      minLandArea: 0.5,
      maxLandArea: null
    },
    features: [
      'Coverage for all natural perils',
      'Post-harvest losses covered',
      'Localized calamities included',
      'Prevented sowing coverage'
    ],
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z'
  },
  {
    _id: '2',
    name: 'Weather Based Crop Insurance Scheme',
    type: 'weather',
    description: 'Insurance based on weather parameters like rainfall, temperature, humidity, wind speed etc. Uses weather indices and satellite data for quick claim settlement without crop cutting experiments.',
    shortDescription: 'Weather-based crop protection against adverse climatic conditions',
    imageUrl: '/images/wbcis.jpg',
    schemes: [
      {
        name: 'WBCIS Weather Shield',
        code: 'WBCI001',
        seasons: ['Kharif', 'Rabi'],
        coverage: { 
          percentage: 80, 
          maxAmount: 150000,
          description: 'Protection against adverse weather events'
        },
        premium: { 
          rate: 3, 
          minAmount: 750, 
          maxAmount: 7500,
          subsidyRate: 40
        }
      },
      {
        name: 'WBCIS Premium',
        code: 'WBCI002',
        seasons: ['Kharif', 'Rabi', 'Summer'],
        coverage: { 
          percentage: 90, 
          maxAmount: 200000,
          description: 'Comprehensive weather-based coverage'
        },
        premium: { 
          rate: 3.5, 
          minAmount: 1000, 
          maxAmount: 10000,
          subsidyRate: 50
        }
      }
    ],
    availableStates: ['Gujarat', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Rajasthan'],
    eligibility: {
      farmerTypes: ['Small', 'Medium', 'Large'],
      landOwnership: ['Owner', 'Tenant'],
      minLandArea: 1,
      maxLandArea: null
    },
    features: [
      'Quick claim settlement',
      'No crop cutting required',
      'Satellite-based monitoring',
      'Real-time weather tracking'
    ],
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z'
  },
  {
    _id: '3',
    name: 'Coconut Palm Insurance Scheme',
    type: 'specialty',
    description: 'Specialized insurance for coconut palm trees providing coverage against natural calamities, diseases, and fire. Covers trees from 4 to 60 years of age.',
    shortDescription: 'Specialized insurance for coconut palm cultivation',
    imageUrl: '/images/cpis.jpg',
    schemes: [
      {
        name: 'CPIS Standard',
        code: 'CPIS001',
        seasons: ['Annual'],
        coverage: { 
          percentage: 100, 
          maxAmount: 100000,
          description: 'Per tree coverage up to ₹900'
        },
        premium: { 
          rate: 4, 
          minAmount: 500, 
          maxAmount: 4000,
          subsidyRate: 50
        }
      }
    ],
    availableStates: ['Kerala', 'Tamil Nadu', 'Karnataka', 'Andhra Pradesh', 'Goa'],
    eligibility: {
      farmerTypes: ['Small', 'Medium', 'Large'],
      landOwnership: ['Owner'],
      minLandArea: 0.25,
      maxLandArea: null
    },
    features: [
      'Tree-wise coverage',
      'Disease protection',
      'Fire damage coverage',
      'Natural calamity protection'
    ],
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z'
  }
];

/**
 * Get all insurance plans
 * GET /api/insurance/list
 */
router.get('/list', async (req, res) => {
  try {
    console.log('📋 Insurance list requested');
    
    const { state, type, search, active = 'true' } = req.query;
    
    let filteredInsurances = [...mockInsurances];
    
    // Filter by active status
    if (active === 'true') {
      filteredInsurances = filteredInsurances.filter(insurance => insurance.isActive);
    }
    
    // Filter by state
    if (state) {
      filteredInsurances = filteredInsurances.filter(insurance => 
        insurance.availableStates.some(s => 
          s.toLowerCase() === state.toLowerCase()
        )
      );
    }
    
    // Filter by type
    if (type) {
      filteredInsurances = filteredInsurances.filter(insurance => 
        insurance.type === type
      );
    }
    
    // Filter by search query
    if (search) {
      const searchLower = search.toLowerCase();
      filteredInsurances = filteredInsurances.filter(insurance =>
        insurance.name.toLowerCase().includes(searchLower) ||
        insurance.description.toLowerCase().includes(searchLower) ||
        insurance.shortDescription.toLowerCase().includes(searchLower)
      );
    }

    console.log(`✅ Returning ${filteredInsurances.length} insurance plans`);

    res.json({
      success: true,
      insurances: filteredInsurances,
      count: filteredInsurances.length,
      filters: {
        state,
        type,
        search,
        active
      }
    });

  } catch (error) {
    console.error('❌ Get insurances error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch insurance plans',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get insurance by ID
 * GET /api/insurance/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📋 Insurance details requested for ID: ${id}`);
    
    const insurance = mockInsurances.find(ins => ins._id === id);
    
    if (!insurance) {
      return res.status(404).json({
        success: false,
        error: 'Insurance plan not found'
      });
    }

    if (!insurance.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Insurance plan is no longer active'
      });
    }

    console.log(`✅ Returning insurance: ${insurance.name}`);

    res.json({
      success: true,
      insurance
    });

  } catch (error) {
    console.error('❌ Get insurance details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch insurance details',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get schemes by insurance ID and optional season filter
 * GET /api/insurance/:id/schemes
 */
router.get('/:id/schemes', async (req, res) => {
  try {
    const { id } = req.params;
    const { season } = req.query;
    
    console.log(`📋 Schemes requested for insurance ID: ${id}, season: ${season || 'all'}`);
    
    const insurance = mockInsurances.find(ins => ins._id === id);
    
    if (!insurance) {
      return res.status(404).json({
        success: false,
        error: 'Insurance plan not found'
      });
    }

    if (!insurance.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Insurance plan is no longer active'
      });
    }

    let schemes = [...insurance.schemes];
    
    // Filter by season if provided
    if (season) {
      schemes = schemes.filter(scheme => 
        scheme.seasons.some(s => 
          s.toLowerCase() === season.toLowerCase()
        )
      );
    }

    console.log(`✅ Returning ${schemes.length} schemes for ${insurance.name}`);

    res.json({
      success: true,
      schemes,
      insuranceId: insurance._id,
      insuranceName: insurance.name,
      insuranceType: insurance.type,
      count: schemes.length
    });

  } catch (error) {
    console.error('❌ Get schemes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch schemes',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get available states for insurance plans
 * GET /api/insurance/states/list
 */
router.get('/states/list', async (req, res) => {
  try {
    console.log('📋 Available states requested');
    
    const { type } = req.query;
    
    let insurances = mockInsurances.filter(ins => ins.isActive);
    
    if (type) {
      insurances = insurances.filter(ins => ins.type === type);
    }
    
    // Get unique states
    const statesSet = new Set();
    insurances.forEach(insurance => {
      insurance.availableStates.forEach(state => statesSet.add(state));
    });
    
    const states = Array.from(statesSet).sort();
    
    console.log(`✅ Returning ${states.length} available states`);
    
    res.json({
      success: true,
      states,
      count: states.length
    });

  } catch (error) {
    console.error('❌ Get states error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available states',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get insurance types
 * GET /api/insurance/types/list
 */
router.get('/types/list', async (req, res) => {
  try {
    console.log('📋 Insurance types requested');
    
    const types = [...new Set(mockInsurances
      .filter(ins => ins.isActive)
      .map(ins => ins.type)
    )].sort();
    
    console.log(`✅ Returning ${types.length} insurance types`);
    
    res.json({
      success: true,
      types: types.map(type => ({
        value: type,
        label: type.charAt(0).toUpperCase() + type.slice(1),
        count: mockInsurances.filter(ins => ins.type === type && ins.isActive).length
      })),
      count: types.length
    });

  } catch (error) {
    console.error('❌ Get types error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch insurance types',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Calculate premium for a scheme
 * POST /api/insurance/:id/calculate-premium
 */
router.post('/:id/calculate-premium', async (req, res) => {
  try {
    const { id } = req.params;
    const { schemeCode, sumInsured, landArea } = req.body;
    
    console.log(`💰 Premium calculation requested for insurance: ${id}, scheme: ${schemeCode}`);
    
    // Validation
    if (!sumInsured || !landArea) {
      return res.status(400).json({
        success: false,
        error: 'Sum insured and land area are required'
      });
    }
    
    const insurance = mockInsurances.find(ins => ins._id === id);
    
    if (!insurance || !insurance.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Insurance plan not found'
      });
    }
    
    const scheme = insurance.schemes.find(s => s.code === schemeCode);
    
    if (!scheme) {
      return res.status(404).json({
        success: false,
        error: 'Scheme not found'
      });
    }
    
    // Calculate premium
    const basePremium = (sumInsured * scheme.premium.rate) / 100;
    const adjustedPremium = Math.max(
      scheme.premium.minAmount,
      Math.min(basePremium, scheme.premium.maxAmount)
    );
    
    const subsidyAmount = (adjustedPremium * scheme.premium.subsidyRate) / 100;
    const farmerShare = adjustedPremium - subsidyAmount;
    
    console.log(`✅ Premium calculated: Total=${adjustedPremium}, Farmer=${farmerShare}`);
    
    res.json({
      success: true,
      premium: {
        totalPremium: adjustedPremium,
        subsidyAmount,
        farmerShare,
        subsidyRate: scheme.premium.subsidyRate,
        sumInsured,
        landArea,
        premiumPerAcre: adjustedPremium / landArea
      },
      insurance: {
        name: insurance.name,
        type: insurance.type
      },
      scheme: {
        name: scheme.name,
        code: scheme.code
      }
    });

  } catch (error) {
    console.error('❌ Premium calculation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate premium',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
