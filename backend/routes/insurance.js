const express = require('express');
const router = express.Router();

// Mock insurance data since database might not be working
const mockInsurances = [
  {
    _id: '1',
    name: 'Pradhan Mantri Fasal Bima Yojana',
    type: 'crop',
    description: 'Comprehensive crop insurance scheme providing coverage against all non-preventable natural risks from sowing to harvesting.',
    shortDescription: 'Government crop insurance covering natural disasters and yield losses',
    imageUrl: '/images/pmfby.jpg',
    schemes: [
      {
        name: 'Basic Coverage',
        code: 'PMFBY001',
        seasons: ['Kharif', 'Rabi'],
        coverage: { percentage: 100, maxAmount: 200000 },
        premium: { rate: 2, minAmount: 500, maxAmount: 5000 }
      }
    ],
    availableStates: ['Maharashtra', 'Punjab', 'Haryana', 'Uttar Pradesh'],
    isActive: true
  },
  {
    _id: '2',
    name: 'Weather Based Crop Insurance Scheme',
    type: 'weather',
    description: 'Insurance based on weather parameters like rainfall, temperature, humidity, wind speed etc.',
    shortDescription: 'Weather-based crop protection against adverse climatic conditions',
    imageUrl: '/images/wbcis.jpg',
    schemes: [
      {
        name: 'Weather Shield',
        code: 'WBCI001',
        seasons: ['Kharif', 'Rabi', 'Summer'],
        coverage: { percentage: 80, maxAmount: 150000 },
        premium: { rate: 3, minAmount: 750, maxAmount: 7500 }
      }
    ],
    availableStates: ['Gujarat', 'Maharashtra', 'Karnataka', 'Tamil Nadu'],
    isActive: true
  }
];

// Get all insurance plans
router.get('/list', async (req, res) => {
  try {
    console.log('📋 Insurance list requested');
    
    const { state, type, search } = req.query;
    
    let filteredInsurances = mockInsurances.filter(insurance => insurance.isActive);
    
    if (state) {
      filteredInsurances = filteredInsurances.filter(insurance => 
        insurance.availableStates.includes(state)
      );
    }
    
    if (type) {
      filteredInsurances = filteredInsurances.filter(insurance => insurance.type === type);
    }
    
    if (search) {
      filteredInsurances = filteredInsurances.filter(insurance =>
        insurance.name.toLowerCase().includes(search.toLowerCase()) ||
        insurance.description.toLowerCase().includes(search.toLowerCase())
      );
    }

    console.log('✅ Returning', filteredInsurances.length, 'insurance plans');

    res.json({
      success: true,
      insurances: filteredInsurances,
      count: filteredInsurances.length
    });

  } catch (error) {
    console.error('❌ Get insurances error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch insurance plans',
      details: error.message
    });
  }
});

// Get insurance by ID
router.get('/:id', async (req, res) => {
  try {
    console.log('📋 Insurance details requested for ID:', req.params.id);
    
    const insurance = mockInsurances.find(ins => ins._id === req.params.id);
    
    if (!insurance || !insurance.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Insurance plan not found'
      });
    }

    console.log('✅ Returning insurance:', insurance.name);

    res.json({
      success: true,
      insurance
    });

  } catch (error) {
    console.error('❌ Get insurance details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch insurance details',
      details: error.message
    });
  }
});

// Get schemes by insurance ID and season
router.get('/:id/schemes', async (req, res) => {
  try {
    console.log('📋 Schemes requested for insurance ID:', req.params.id);
    
    const { season } = req.query;
    const insurance = mockInsurances.find(ins => ins._id === req.params.id);
    
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

    console.log('✅ Returning', schemes.length, 'schemes');

    res.json({
      success: true,
      schemes,
      insuranceName: insurance.name
    });

  } catch (error) {
    console.error('❌ Get schemes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch schemes',
      details: error.message
    });
  }
});

module.exports = router;
