import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const ClaimResults = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const [claimData, setClaimData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (documentId) {
      fetchRealClaimResults();
    }
  }, [documentId]);

  const fetchRealClaimResults = async () => {
    try {
      console.log('Fetching REAL extracted data for:', documentId);

      const response = await fetch(`http://localhost:5000/api/claims/results/${documentId}`);
      const data = await response.json();

      if (response.ok && data.success && data.claim) {
        console.log('Real extracted data loaded');
        setClaimData(data.claim);
      } else {
        console.log('No real data found, showing empty state');
        setError('No analysis data available for this claim');
      }
    } catch (error) {
      console.error('Failed to fetch real data:', error);
      setError('Failed to load claim analysis: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="results-page">
        <div className="loading-container">
          <div className="loading-card">
            <div className="loading-animation">
              <div className="spinner"></div>
            </div>
            <div className="loading-content">
              <h2>Analyzing Claim Data</h2>
              <p>Processing EXIF metadata, weather data, and geofencing verification...</p>
              <div className="loading-progress">
                <div className="progress-bar"></div>
              </div>
              <span className="document-reference">Document ID: {documentId}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !claimData) {
    return (
      <div className="results-page">
        <div className="error-container">
          <div className="error-card">
            <div className="error-icon">
              <div className="error-symbol">!</div>
            </div>
            <div className="error-content">
              <h2>Analysis Data Unavailable</h2>
              <p className="error-description">
                {error || 'Unable to retrieve extracted data for this claim'}
              </p>
              <div className="error-actions">
                <button onClick={fetchRealClaimResults} className="btn-retry">
                  <span className="btn-icon">↻</span>
                  Retry Analysis
                </button>
                <button onClick={() => navigate('/')} className="btn-home">
                  <span className="btn-icon">←</span>
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Extract real data from claim
  const aggregated = claimData.aggregated_analysis || claimData.processingResult;
  const individual = claimData.individual_results || {};
  const hasRealData = Object.keys(individual).length > 0;

  return (
    <div className="results-page">
      <div className="results-container">

        {/* Page Header */}
        <div className="page-header">
          <div className="header-content">
            <div className="title-section">
              <h1 className="page-title">Claim Analysis Report</h1>
              <p className="page-subtitle">Real-time data extraction and verification results</p>
            </div>
            <div className="document-badge">
              <span className="badge-label">Document ID</span>
              <span className="badge-value">{claimData.documentId}</span>
            </div>
          </div>
          <div className="meta-info">
            <div className="meta-item">
              <span className="meta-label">Processing Mode:</span>
              <span className="meta-value">Real Data Extraction</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Submitted:</span>
              <span className="meta-value">{new Date(claimData.submittedAt).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Overall Assessment Card */}
        {aggregated?.overall_confidence !== undefined && (
          <div className="assessment-section">
            <div className="section-header">
              <h2>Overall Assessment</h2>
            </div>

            <div className="assessment-grid">
              {/* Confidence Score Card */}
              <div className="confidence-card">
                <div className="card-header">
                  <h3>Confidence Score</h3>
                  <div className="header-icon score-icon"></div>
                </div>
                <div className="confidence-display">
                  <div className={`confidence-circle ${aggregated.overall_confidence >= 0.7 ? 'high' :
                    aggregated.overall_confidence >= 0.5 ? 'medium' : 'low'}`}>
                    <span className="confidence-number">{(aggregated.overall_confidence * 100).toFixed(0)}</span>
                    <span className="confidence-percent">%</span>
                  </div>
                  <div className="confidence-label">
                    {aggregated.overall_confidence >= 0.7 ? 'High Confidence' :
                      aggregated.overall_confidence >= 0.5 ? 'Medium Confidence' : 'Low Confidence'}
                  </div>
                </div>
              </div>

              {/* Recommendation Card */}
              <div className="recommendation-card">
                <div className="card-header">
                  <h3>Recommendation</h3>
                  <div className="header-icon recommendation-icon"></div>
                </div>
                <div className="recommendation-content">
                  <div className={`status-badge ${aggregated.recommendation?.status?.toLowerCase()}`}>
                    {aggregated.recommendation?.status?.toUpperCase()}
                  </div>
                  <div className="recommendation-details">
                    <div className="detail-item">
                      <span className="detail-label">Reason:</span>
                      <span className="detail-value">{aggregated.recommendation?.reason}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Action:</span>
                      <span className="detail-value">{aggregated.recommendation?.action}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Statistics */}
            {aggregated.summary && (
              <div className="statistics-card">
                <div className="card-header">
                  <h3>Processing Summary</h3>
                  <div className="header-icon stats-icon"></div>
                </div>
                <div className="stats-grid">
                  <div className="stat-item">
                    <div className="stat-value successful">{aggregated.summary.successful_extractions}</div>
                    <div className="stat-label">Successful Extractions</div>
                    <div className="stat-description">Files processed successfully</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value exif">{aggregated.summary.exif_data_extracted || 0}</div>
                    <div className="stat-label">EXIF Data Found</div>
                    <div className="stat-description">Metadata extracted</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value weather">{aggregated.summary.weather_data_obtained || 0}</div>
                    <div className="stat-label">Weather Verified</div>
                    <div className="stat-description">Weather conditions matched</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value coordinates">{aggregated.summary.coordinate_matches || 0}</div>
                    <div className="stat-label">Location Matches</div>
                    <div className="stat-description">Coordinates verified</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Individual File Analysis */}
        {hasRealData && (
          <div className="analysis-section">
            <div className="section-header">
              <h2>Individual File Analysis</h2>
              <p className="section-subtitle">Detailed analysis for each uploaded file</p>
            </div>

            <div className="files-grid">
              {Object.entries(individual).map(([stepId, result]) => (
                <div key={stepId} className={`file-card ${result.confidence_assessment?.overall_confidence >= 0.7 ? 'high-confidence' :
                    result.confidence_assessment?.overall_confidence >= 0.5 ? 'medium-confidence' : 'low-confidence'
                  }`}>

                  {/* File Header */}
                  <div className="file-card-header">
                    <div className="file-info">
                      <div className={`file-type-icon ${stepId.includes('video') ? 'video' : 'image'}`}></div>
                      <div className="file-details">
                        <h4 className="file-name">{stepId.replace('-', ' ').toUpperCase()}</h4>
                        <span className="file-type">{stepId.includes('video') ? 'Video File' : 'Image File'}</span>
                      </div>
                    </div>
                    {result.confidence_assessment?.overall_confidence && (
                      <div className={`confidence-badge ${result.confidence_assessment.overall_confidence >= 0.7 ? 'high' :
                          result.confidence_assessment.overall_confidence >= 0.5 ? 'medium' : 'low'
                        }`}>
                        {(result.confidence_assessment.overall_confidence * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>

                  {/* Analysis Results */}
                  <div className="analysis-results">

                    {/* EXIF Data Card */}
                    {result.extracted_exif_data && (
                      <div className="data-card exif-card">
                        <div className="data-card-header">
                          <h5>EXIF Metadata</h5>
                          <div className={`status-indicator ${result.extracted_exif_data.available ? 'success' : 'error'}`}></div>
                        </div>
                        <div className="data-card-content">
                          {result.extracted_exif_data.available ? (
                            <div className="exif-success">
                              <div className="field-summary">
                                <span className="field-count">{result.extracted_exif_data.extracted_fields?.length || 0}</span>
                                <span className="field-label">Fields Extracted</span>
                              </div>
                              {result.extracted_exif_data.extracted_fields?.length > 0 && (
                                <div className="field-tags">
                                  {result.extracted_exif_data.extracted_fields.slice(0, 4).map(field => (
                                    <span key={field} className="field-tag">{field}</span>
                                  ))}
                                  {result.extracted_exif_data.extracted_fields.length > 4 && (
                                    <span className="field-tag more">+{result.extracted_exif_data.extracted_fields.length - 4} more</span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="data-error">
                              <span className="error-text">{result.extracted_exif_data.error || 'No EXIF data found'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Coordinate Verification Card */}
                    {result.coordinate_analysis && (
                      <div className="data-card coordinate-card">
                        <div className="data-card-header">
                          <h5>Location Verification</h5>
                          <div className={`status-indicator ${result.coordinate_analysis.coordinates_available ? 'success' : 'error'}`}></div>
                        </div>
                        <div className="data-card-content">
                          {result.coordinate_analysis.coordinates_available ? (
                            <div className="coordinate-success">
                              <div className="coordinate-comparison">
                                <div className="coord-item">
                                  <span className="coord-label">EXIF Location</span>
                                  <span className="coord-value">
                                    {result.coordinate_analysis.exif_coordinates.lat.toFixed(4)},
                                    {result.coordinate_analysis.exif_coordinates.lon.toFixed(4)}
                                  </span>
                                </div>
                                <div className="coord-item">
                                  <span className="coord-label">Claimed Location</span>
                                  <span className="coord-value">
                                    {result.coordinate_analysis.claimed_coordinates.lat.toFixed(4)},
                                    {result.coordinate_analysis.claimed_coordinates.lon.toFixed(4)}
                                  </span>
                                </div>
                              </div>
                              <div className="match-result">
                                <div className="distance-info">
                                  <span className="distance-value">{result.coordinate_analysis.distance_meters}m</span>
                                  <span className="distance-label">Distance Apart</span>
                                </div>
                                <div className={`match-status ${result.coordinate_analysis.coordinates_match ? 'match' : 'no-match'}`}>
                                  {result.coordinate_analysis.match_level.replace('_', ' ').toUpperCase()}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="data-error">
                              <span className="error-text">{result.coordinate_analysis.error}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Weather Verification Card */}
                    {result.weather_verification && (
                      <div className="data-card weather-card">
                        <div className="data-card-header">
                          <h5>Weather Verification</h5>
                          <div className={`status-indicator ${result.weather_verification.api_success ? 'success' : 'error'}`}></div>
                        </div>
                        <div className="data-card-content">
                          {result.weather_verification.api_success ? (
                            <div className="weather-success">
                              <div className="weather-metrics">
                                <div className="weather-metric">
                                  <span className="metric-value">{result.weather_verification.processed_data?.temperature_avg}°C</span>
                                  <span className="metric-label">Temperature</span>
                                </div>
                                <div className="weather-metric">
                                  <span className="metric-value">{result.weather_verification.processed_data?.precipitation_mm || 0}mm</span>
                                  <span className="metric-label">Precipitation</span>
                                </div>
                                <div className="weather-metric">
                                  <span className="metric-value">{result.weather_verification.processed_data?.humidity_percent}%</span>
                                  <span className="metric-label">Humidity</span>
                                </div>
                                <div className="weather-metric">
                                  <span className="metric-value">{result.weather_verification.processed_data?.pressure_mb}mb</span>
                                  <span className="metric-label">Pressure</span>
                                </div>
                              </div>
                              <div className="weather-source">
                                <span>{result.weather_verification.source} • {result.weather_verification.stations_used?.length || 0} stations</span>
                              </div>
                            </div>
                          ) : (
                            <div className="data-error">
                              <span className="error-text">{result.weather_verification.error || 'Weather data unavailable'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Geofencing Card */}
                    {result.geofencing_analysis && (
                      <div className="data-card geofencing-card">
                        <div className="data-card-header">
                          <h5>Property Boundary Check</h5>
                          <div className={`status-indicator ${result.geofencing_analysis.geofencing_available ? 'success' : 'error'}`}></div>
                        </div>
                        <div className="data-card-content">
                          {result.geofencing_analysis.geofencing_available ? (
                            <div className="geofencing-success">
                              <div className={`boundary-status ${result.geofencing_analysis.point_inside_boundary ? 'inside' : 'outside'}`}>
                                <div className="status-icon"></div>
                                <div className="status-text">
                                  {result.geofencing_analysis.point_inside_boundary ?
                                    'Inside Property Boundary' :
                                    'Outside Property Boundary'}
                                </div>
                              </div>
                              {result.geofencing_analysis.parcels_checked?.map((parcel, idx) => (
                                <div key={idx} className="parcel-details">
                                  <div className="parcel-info">
                                    <span className="parcel-id">Parcel: {parcel.parcel_id}</span>
                                    <span className="boundary-distance">{parcel.distance_to_boundary_meters}m from boundary</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="data-error">
                              <span className="error-text">{result.geofencing_analysis.error}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* File Processing Info */}
                  <div className="processing-meta">
                    <div className="meta-grid">
                      <div className="meta-detail">
                        <span className="meta-key">File:</span>
                        <span className="meta-val">{result.input_data?.uploaded_file}</span>
                      </div>
                      <div className="meta-detail">
                        <span className="meta-key">Processing Time:</span>
                        <span className="meta-val">{result.processing_info?.processing_time_ms}ms</span>
                      </div>
                      <div className="meta-detail">
                        <span className="meta-key">Version:</span>
                        <span className="meta-val">{result.processing_info?.version}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="action-bar">
          <div className="action-buttons">
            <button onClick={() => navigate('/claims')} className="btn-action primary">
              <span className="btn-icon">📋</span>
              View All Claims
            </button>
            <button onClick={() => navigate('/')} className="btn-action secondary">
              <span className="btn-icon">🏠</span>
              Dashboard
            </button>
            <button onClick={fetchRealClaimResults} className="btn-action refresh">
              <span className="btn-icon">🔄</span>
              Refresh Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimResults;
