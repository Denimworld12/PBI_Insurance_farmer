import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import './ClaimResults.css';

const ClaimResults = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSection, setExpandedSection] = useState(null);

  useEffect(() => {
    fetchResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`Fetching results for document: ${documentId}`);
      
      // ✅ FIXED: Using api utility instead of fetch
      const response = await api.get(`/claims/results/${documentId}`);
      const data = response.data;

      if (data.success && data.processing_result) {
        setResult(data.processing_result);
        console.log('Results loaded successfully');
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error loading results:', err);
      
      const errorMessage = err.response?.data?.message || 
        err.message || 
        'Failed to load claim results';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (loading) {
    return (
      <div className="results-page">
        <div className="loading-container">
          <div className="spinner-large"></div>
          <h2>Analyzing Your Claim...</h2>
          <p>Document ID: {documentId}</p>
          <p className="loading-subtext">Processing AI analysis and verification</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="results-page">
        <div className="error-container">
          <div className="error-icon">❌</div>
          <h2>Error Loading Results</h2>
          <p className="error-message">{error || 'No results found'}</p>
          <div className="error-actions">
            <button onClick={fetchResults} className="btn-secondary">
              🔄 Try Again
            </button>
            <button onClick={() => navigate('/')} className="btn-primary">
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const confidence = result.overall_confidence || 0;
  const decision = result.final_decision || {};
  const recommendation = result.recommendation || {};
  const summary = result.summary || {};
  const damage = result.damage_assessment || {};
  const payout = result.payout_calculation || {};
  const verification = result.verification_evidence || {};

  const getStatusClass = (status) => {
    const statusMap = {
      'approved': 'status-approved',
      'manual_review': 'status-review',
      'rejected': 'status-rejected',
      'error': 'status-error'
    };
    return statusMap[status?.toLowerCase()] || 'status-default';
  };

  const getDecisionIcon = (decision) => {
    const icons = {
      'APPROVE': '✅',
      'MANUAL_REVIEW': '🔍',
      'REJECT': '❌',
      'ERROR': '⚠️'
    };
    return icons[decision] || '❓';
  };

  return (
    <div className="results-page">
      <div className="results-container">
        
        <div className="results-header">
          <div className="header-left">
            <h1>Claim Analysis Result</h1>
            <p className="document-id">Document ID: {documentId}</p>
          </div>
          <div className="header-right">
            <button onClick={() => navigate('/')} className="btn-secondary">
              ← Back
            </button>
          </div>
        </div>

        <div className={`status-card ${getStatusClass(recommendation.status)}`}>
          <div className="status-header">
            <div className="status-icon">
              {getDecisionIcon(decision.decision)}
            </div>
            <div className="status-content">
              <h2>{decision.decision || 'UNKNOWN'}</h2>
              <p className="status-message">{recommendation.user_message || 'Processing complete'}</p>
            </div>
          </div>
          
          <div className="confidence-bar">
            <div className="confidence-label">
              <span>AI Confidence Score</span>
              <span className="confidence-value">{(confidence * 100).toFixed(1)}%</span>
            </div>
            <div className="progress-bar">
              <div 
                className={`progress-fill ${confidence >= 0.7 ? 'high' : confidence >= 0.3 ? 'medium' : 'low'}`}
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
          </div>

          <div className="status-details">
            <div className="detail-row">
              <span className="detail-label">Reason:</span>
              <span className="detail-value">{recommendation.reason || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Next Action:</span>
              <span className="detail-value">{recommendation.next_steps || 'N/A'}</span>
            </div>
          </div>
        </div>

        {payout && Object.keys(payout).length > 0 && (
          <div className="payout-card">
            <h3>💰 Payout Information</h3>
            <div className="payout-grid">
              <div className="payout-item">
                <span className="payout-label">Sum Insured</span>
                <span className="payout-amount">
                  ₹{(payout.sum_insured || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="payout-item">
                <span className="payout-label">Damage %</span>
                <span className="payout-amount">{payout.damage_percent || 0}%</span>
              </div>
              <div className="payout-item highlight">
                <span className="payout-label">Final Payout</span>
                <span className="payout-amount">
                  ₹{(payout.final_payout_amount || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="payout-item">
                <span className="payout-label">Status</span>
                <span className={`payout-status ${payout.payout_status}`}>
                  {payout.payout_status?.replace(/_/g, ' ').toUpperCase() || 'PENDING'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="expandable-sections">
          
          <div className="expandable-card">
            <div 
              className="card-header" 
              onClick={() => toggleSection('summary')}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  toggleSection('summary');
                }
              }}
            >
              <h3>📊 Processing Summary</h3>
              <span className="toggle-icon">{expandedSection === 'summary' ? '−' : '+'}</span>
            </div>
            {expandedSection === 'summary' && (
              <div className="card-content">
                <div className="summary-grid">
                  <div className="summary-item">
                    <div className="summary-value">{summary.total_files_processed || 0}</div>
                    <div className="summary-label">Files Processed</div>
                  </div>
                  <div className="summary-item">
                    <div className="summary-value success">{summary.successful_extractions || 0}</div>
                    <div className="summary-label">Successful</div>
                  </div>
                  <div className="summary-item">
                    <div className="summary-value">{summary.exif_data_extracted || 0}</div>
                    <div className="summary-label">EXIF Extracted</div>
                  </div>
                  <div className="summary-item">
                    <div className="summary-value">{summary.weather_data_obtained || 0}</div>
                    <div className="summary-label">Weather Verified</div>
                  </div>
                  <div className="summary-item">
                    <div className="summary-value">{summary.geofencing_successful || 0}</div>
                    <div className="summary-label">Geofencing OK</div>
                  </div>
                  <div className="summary-item">
                    <div className="summary-value">{summary.coordinate_matches || 0}</div>
                    <div className="summary-label">GPS Matches</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {damage && Object.keys(damage).length > 0 && (
            <div className="expandable-card">
              <div 
                className="card-header" 
                onClick={() => toggleSection('damage')}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    toggleSection('damage');
                  }
                }}
              >
                <h3>🌾 Damage Assessment</h3>
                <span className="toggle-icon">{expandedSection === 'damage' ? '−' : '+'}</span>
              </div>
              {expandedSection === 'damage' && (
                <div className="card-content">
                  <div className="damage-comparison">
                    <div className="damage-item">
                      <span className="damage-label">AI Calculated</span>
                      <span className="damage-value">{damage.ai_calculated_damage_percent || 0}%</span>
                    </div>
                    <div className="damage-item">
                      <span className="damage-label">Farmer Claimed</span>
                      <span className="damage-value">{damage.farmer_claimed_damage_percent || 0}%</span>
                    </div>
                    <div className="damage-item highlight">
                      <span className="damage-label">Final Damage</span>
                      <span className="damage-value">{damage.final_damage_percent || 0}%</span>
                    </div>
                  </div>
                  <div className="damage-meta">
                    <div className="meta-row">
                      <span>Severity:</span>
                      <span className={`severity-badge ${damage.severity}`}>
                        {damage.severity?.toUpperCase() || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {verification && Object.keys(verification).length > 0 && (
            <div className="expandable-card">
              <div 
                className="card-header" 
                onClick={() => toggleSection('verification')}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    toggleSection('verification');
                  }
                }}
              >
                <h3>✓ Verification Evidence</h3>
                <span className="toggle-icon">{expandedSection === 'verification' ? '−' : '+'}</span>
              </div>
              {expandedSection === 'verification' && (
                <div className="card-content">
                  <div className="verification-list">
                    <div className={`verification-item ${verification.authenticity_verified ? 'verified' : 'not-verified'}`}>
                      <span className="check-icon">{verification.authenticity_verified ? '✓' : '✗'}</span>
                      <span>Authenticity Verified</span>
                    </div>
                    <div className={`verification-item ${verification.location_verified ? 'verified' : 'not-verified'}`}>
                      <span className="check-icon">{verification.location_verified ? '✓' : '✗'}</span>
                      <span>Location Verified</span>
                    </div>
                    <div className={`verification-item ${verification.damage_verified ? 'verified' : 'not-verified'}`}>
                      <span className="check-icon">{verification.damage_verified ? '✓' : '✗'}</span>
                      <span>Damage Verified</span>
                    </div>
                    <div className={`verification-item ${verification.weather_supports_claim ? 'verified' : 'not-verified'}`}>
                      <span className="check-icon">{verification.weather_supports_claim ? '✓' : '✗'}</span>
                      <span>Weather Supports Claim</span>
                    </div>
                  </div>
                  {verification.processing_note && (
                    <div className="verification-note">
                      <strong>Note:</strong> {verification.processing_note}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {result.detailed_scores && Object.keys(result.detailed_scores).length > 0 && (
            <div className="expandable-card">
              <div 
                className="card-header" 
                onClick={() => toggleSection('scores')}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    toggleSection('scores');
                  }
                }}
              >
                <h3>📈 Detailed Scores</h3>
                <span className="toggle-icon">{expandedSection === 'scores' ? '−' : '+'}</span>
              </div>
              {expandedSection === 'scores' && (
                <div className="card-content">
                  <div className="scores-list">
                    {Object.entries(result.detailed_scores).map(([key, value]) => (
                      <div key={key} className="score-row">
                        <span className="score-label">{key.replace(/_/g, ' ').toUpperCase()}</span>
                        <div className="score-bar">
                          <div 
                            className="score-fill"
                            style={{ width: `${(value || 0) * 100}%` }}
                          />
                          <span className="score-value">{((value || 0) * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {result.fraud_indicators && (
            <div className="expandable-card">
              <div 
                className="card-header" 
                onClick={() => toggleSection('fraud')}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    toggleSection('fraud');
                  }
                }}
              >
                <h3>🚨 Fraud Analysis</h3>
                <span className="toggle-icon">{expandedSection === 'fraud' ? '−' : '+'}</span>
              </div>
              {expandedSection === 'fraud' && (
                <div className="card-content">
                  <div className="fraud-summary">
                    <div className="fraud-stat">
                      <span className="fraud-label">Red Flags</span>
                      <span className="fraud-value">{result.fraud_indicators.total_red_flags || 0}</span>
                    </div>
                    <div className="fraud-stat">
                      <span className="fraud-label">Fraud Likelihood</span>
                      <span className="fraud-value">
                        {((result.fraud_indicators.fraud_likelihood || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  {result.fraud_indicators.fraud_indicators?.length > 0 && (
                    <div className="fraud-list">
                      {result.fraud_indicators.fraud_indicators.map((indicator, idx) => (
                        <div key={idx} className={`fraud-item severity-${indicator.severity}`}>
                          <span className="fraud-category">{indicator.category}</span>
                          <span className="fraud-detail">{indicator.detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="action-buttons">
          <button onClick={() => navigate('/')} className="btn-primary">
            Back to Dashboard
          </button>
          <button onClick={fetchResults} className="btn-secondary">
            🔄 Refresh Results
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClaimResults;
