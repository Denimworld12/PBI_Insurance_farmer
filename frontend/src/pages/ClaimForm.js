
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClaim } from '../contexts/ClaimContext';
import { INDIAN_STATES, SEASONS, CROP_TYPES, LOSS_REASONS } from '../utils/constants';
import api from '../utils/api';

const ClaimForm = () => {
  const { insuranceId } = useParams();
  const navigate = useNavigate();
  const { claimState, setSelectedInsurance, updateFormData, generateDocumentId } = useClaim();
  
  const [insurance, setInsurance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    state: '',
    season: '',
    scheme: '',
    year: new Date().getFullYear(),
    insuranceNumber: '',
    cropType: '',
    farmArea: '',
    lossReason: '',
    lossDescription: ''
  });

  useEffect(() => {
    fetchInsuranceDetails();
  }, [insuranceId]);

  const fetchInsuranceDetails = async () => {
    try {
      const response = await api.get(`/insurance/${insuranceId}`);
      setInsurance(response.data.insurance);
      setSelectedInsurance(response.data.insurance);
    } catch (error) {
      console.error('Failed to fetch insurance details:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.state) newErrors.state = 'State is required';
    if (!formData.season) newErrors.season = 'Season is required';
    if (!formData.scheme) newErrors.scheme = 'Scheme is required';
    if (!formData.insuranceNumber) newErrors.insuranceNumber = 'Insurance number is required';
    if (!formData.cropType) newErrors.cropType = 'Crop type is required';
    if (!formData.farmArea || formData.farmArea <= 0) newErrors.farmArea = 'Valid farm area is required';
    if (!formData.lossReason) newErrors.lossReason = 'Loss reason is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      setLoading(true);
      
      // Update claim context
      updateFormData(formData);
      
      // Generate document ID
      const documentId = generateDocumentId();
      
      // Save initial claim data
      await api.post('/claims/initialize', {
        insuranceId,
        formData,
        documentId
      });

      // Navigate to media capture
      navigate(`/media-capture/${documentId}`);
      
    } catch (error) {
      console.error('Failed to initialize claim:', error);
      alert('Failed to proceed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading insurance details...</div>;
  }

  const availableSchemes = insurance?.schemes?.filter(scheme => 
    !formData.season || scheme.seasons.includes(formData.season)
  ) || [];

  return (
    <div className="claim-form-container">
      <div className="claim-form-header">
        <h1>Insurance Claim Form</h1>
        <div className="insurance-info">
          <h2>{insurance?.name}</h2>
          <p>{insurance?.description}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="claim-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="state">State *</label>
            <select
              id="state"
              name="state"
              value={formData.state}
              onChange={handleInputChange}
              className={errors.state ? 'error' : ''}
              required
            >
              <option value="">Select State</option>
              {INDIAN_STATES.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
            {errors.state && <span className="error-text">{errors.state}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="season">Season *</label>
            <select
              id="season"
              name="season"
              value={formData.season}
              onChange={handleInputChange}
              className={errors.season ? 'error' : ''}
              required
            >
              <option value="">Select Season</option>
              {SEASONS.map(season => (
                <option key={season} value={season}>{season}</option>
              ))}
            </select>
            {errors.season && <span className="error-text">{errors.season}</span>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="scheme">Scheme *</label>
            <select
              id="scheme"
              name="scheme"
              value={formData.scheme}
              onChange={handleInputChange}
              className={errors.scheme ? 'error' : ''}
              required
            >
              <option value="">Select Scheme</option>
              {availableSchemes.map(scheme => (
                <option key={scheme.code} value={scheme.code}>
                  {scheme.name} ({scheme.code})
                </option>
              ))}
            </select>
            {errors.scheme && <span className="error-text">{errors.scheme}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="year">Year *</label>
            <input
              type="number"
              id="year"
              name="year"
              value={formData.year}
              onChange={handleInputChange}
              min="2020"
              max={new Date().getFullYear() + 1}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="insuranceNumber">Insurance Number *</label>
          <input
            type="text"
            id="insuranceNumber"
            name="insuranceNumber"
            value={formData.insuranceNumber}
            onChange={handleInputChange}
            className={errors.insuranceNumber ? 'error' : ''}
            placeholder="Enter your insurance policy number"
            required
          />
          {errors.insuranceNumber && <span className="error-text">{errors.insuranceNumber}</span>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="cropType">Crop Type *</label>
            <select
              id="cropType"
              name="cropType"
              value={formData.cropType}
              onChange={handleInputChange}
              className={errors.cropType ? 'error' : ''}
              required
            >
              <option value="">Select Crop Type</option>
              {CROP_TYPES.map(crop => (
                <option key={crop} value={crop}>{crop}</option>
              ))}
            </select>
            {errors.cropType && <span className="error-text">{errors.cropType}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="farmArea">Farm Area (acres) *</label>
            <input
              type="number"
              id="farmArea"
              name="farmArea"
              value={formData.farmArea}
              onChange={handleInputChange}
              className={errors.farmArea ? 'error' : ''}
              placeholder="Enter area in acres"
              min="0.1"
              step="0.1"
              required
            />
            {errors.farmArea && <span className="error-text">{errors.farmArea}</span>}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="lossReason">Loss Reason *</label>
          <select
            id="lossReason"
            name="lossReason"
            value={formData.lossReason}
            onChange={handleInputChange}
            className={errors.lossReason ? 'error' : ''}
            required
          >
            <option value="">Select Loss Reason</option>
            {LOSS_REASONS.map(reason => (
              <option key={reason} value={reason}>
                {reason.charAt(0).toUpperCase() + reason.slice(1)}
              </option>
            ))}
          </select>
          {errors.lossReason && <span className="error-text">{errors.lossReason}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="lossDescription">Loss Description</label>
          <textarea
            id="lossDescription"
            name="lossDescription"
            value={formData.lossDescription}
            onChange={handleInputChange}
            placeholder="Describe the crop loss in detail..."
            rows="4"
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn-secondary"
          >
            ← Back to Dashboard
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Processing...' : 'Proceed to Media Capture →'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ClaimForm;
