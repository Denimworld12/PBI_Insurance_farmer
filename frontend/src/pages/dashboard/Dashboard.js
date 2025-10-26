import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import './dashboard.css';
const Dashboard = () => {
  const [insurances, setInsurances] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchInsurances();
  }, []);

  const fetchInsurances = async () => {
    try {
      console.log('Fetching insurances from API...');
      const response = await api.get('/insurance/list');

      if (response.data.success && response.data.insurances) {
        setInsurances(response.data.insurances);
        console.log('Loaded insurances:', response.data.insurances.length);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Failed to fetch insurances:', error);
      setError('Failed to load insurance plans. Please try again.');
      setInsurances([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredInsurances = insurances.filter(insurance =>
    insurance.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    insurance.shortDescription?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInsuranceSelect = (insurance) => {
    console.log('Insurance selected:', insurance._id);
    if (!insurance._id) {
      alert('Error: Insurance ID not found. Please try again.');
      return;
    }
    try {
      navigate(`/claim-form/${insurance._id}`);
    } catch (error) {
      console.error('Navigation error:', error);
      alert('Navigation failed. Please refresh and try again.');
    }
  };

  const handleNewClaim = () => {
    if (insurances.length === 0) {
      setError('No insurance plans available. Please check your connection and try again.');
      return;
    }
    const insuranceSection = document.querySelector('.insurance-section');
    if (insuranceSection) {
      insuranceSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleViewClaims = () => {
    navigate('/claims');
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        {/* Hero Section - IMAGE PLACEMENT #1: Farmer using phone in field */}
        <section className="hero-section">
          <div className="hero-content">
            <div className="hero-text " style={{ justifyContent: "left", textAlign: "left" }}>
              <h1 className="hero-title">Photo & Video-Based Crop Insurance</h1>
              <p className="hero-description">
                Submit real-time GPS-tagged evidence of crop damage. Get fair, fast claim verification powered by AI and blockchain technology—designed for climate-vulnerable smallholder farmers.
              </p>
              {user && (

                <p className="hero-user">Signed in: XXXXXXXX{user.phoneNumber.slice(-2)}</p>
              )}
            </div>
            <div className="hero-image">
              {/* IMAGE: Farmer in field holding smartphone, capturing damaged crops */}
              <img
                src="/images\frontFarmer.png"
                alt="Farmer using smartphone to document crop damage in the field"
                className="hero-img"
                style={{ height: "300px" }}
              />
            </div>
          </div>
        </section>

        {/* Quick Action Buttons */}
        <div className="action-buttons-grid">
          <button onClick={handleViewClaims} className="action-btn action-btn-primary">
            View My Claims
          </button>
          <button onClick={handleNewClaim} className="action-btn action-btn-success">
            New Claim
          </button>
        </div>

        {/* How It Works Section - IMAGE PLACEMENT #2: Process icons/illustrations */}
        <section className="how-it-works-section">
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">
            A hybrid model combining parametric triggers with visual evidence validation
          </p>

          <div className="how-it-works-grid">
            <div className="how-card">
              <div className="how-icon">
                {/* IMAGE: Icon showing phone with GPS pin */}
                <img src="/images/gps-capture-icon.jpg" alt="GPS capture" />
              </div>
              <h3 className="how-card-title">1. Capture Evidence</h3>
              <p className="how-card-text">
                Use your smartphone to capture photos or videos of crop damage. GPS coordinates are automatically embedded to verify location.
              </p>
            </div>

            <div className="how-card">
              <div className="how-icon">
                {/* IMAGE: Icon showing AI brain analyzing image */}
                <img src="/images/ai-verify-icon.jpg" alt="AI verification" />
              </div>
              <h3 className="how-card-title">2. AI Verification</h3>
              <p className="how-card-text">
                Our deepfake detection AI validates media authenticity and device metadata, preventing fraud while ensuring genuine claims are processed instantly.
              </p>
            </div>

            <div className="how-card">
              <div className="how-icon">
                {/* IMAGE: Icon showing checkmark with blockchain chain */}
                <img src="/images/claim-approval-icon.jpg" alt="Claim approval" style={{ width: "50px" }} />
              </div>
              <h3 className="how-card-title">3. Fast Approval</h3>
              <p className="how-card-text">
                Parametric indicators trigger eligibility, then visual evidence adjusts payouts to match actual damage—reducing basis risk and ensuring fair compensation.
              </p>
            </div>
          </div>
        </section>

        {/* Why Choose Us Section - IMAGE PLACEMENT #3: Comparison graphic */}
        <section className="features-section">
          <h2 className="section-title">Why Choose PBI AgriInsure?</h2>

          <div className="features-comparison">
            <div className="comparison-visual">
              {/* IMAGE: Side-by-side comparison - Traditional vs. Hybrid model */}
              <img
                src="/images/traditional-vs-hybrid-model.png"
                alt="Comparison showing traditional index-based insurance vs. our hybrid visual verification model"
                className="comparison-img"
              />
            </div>

            <div className="features-list">
              <div className="feature-item">
                <div className="feature-icon feature-icon-reduce">
                  <span>📉</span>
                </div>
                <div className="feature-content">
                  <h4 className="feature-title">Reduces Basis Risk</h4>
                  <p className="feature-text">
                    Traditional index-based models often fail to reflect actual farmer losses. Our hybrid approach combines satellite triggers with real visual evidence, ensuring payouts match ground reality.
                  </p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon feature-icon-speed">
                  <span>⚡</span>
                </div>
                <div className="feature-content">
                  <h4 className="feature-title">Faster Verification</h4>
                  <p className="feature-text">
                    Skip lengthy manual inspections. AI-powered fraud detection and automated eligibility checks cut verification times from weeks to hours.
                  </p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon feature-icon-trust">
                  <span>🔒</span>
                </div>
                <div className="feature-content">
                  <h4 className="feature-title">Transparent & Secure</h4>
                  <p className="feature-text">
                    Blockchain validation, device-level metadata checks, and manual audit trails for high-risk cases ensure both security and fairness.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Impact Stats */}
        <section className="stats-section">
          <h2 className="section-title">Built for Climate-Vulnerable Regions</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">80%</div>
              <div className="stat-label">Faster Claim Processing</div>
              <div className="stat-desc">Compared to traditional manual inspections</div>
            </div>

            <div className="stat-card">
              <div className="stat-number">95%</div>
              <div className="stat-label">Fraud Detection Accuracy</div>
              <div className="stat-desc">AI-powered deepfake & metadata validation</div>
            </div>

            <div className="stat-card">
              <div className="stat-number">24/7</div>
              <div className="stat-label">Claim Submission</div>
              <div className="stat-desc">Submit evidence anytime, anywhere</div>
            </div>

            <div className="stat-card">
              <div className="stat-number">100%</div>
              <div className="stat-label">GPS Verification</div>
              <div className="stat-desc">Location-tagged proof for every claim</div>
            </div>
          </div>
        </section>

        {/* Trust & Technology Section - IMAGE PLACEMENT #4: Tech visualization */}
        <section className="trust-section">
          <div className="trust-content">
            <div className="trust-text">
              <h2 className="section-title">AI-Powered Fraud Prevention</h2>
              <p className="trust-description ">
                Our deepfake detection model analyzes device metadata, compression artifacts, and GPS consistency to flag manipulated media. High-risk cases undergo manual review, balancing speed with security.
              </p>
              <ul className="trust-list ">
                <li className="trust-list-item">Device-level EXIF data validation</li>
                <li className="trust-list-item">Compression artifact analysis</li>
                <li className="trust-list-item">Geospatial coordinate matching</li>
                <li className="trust-list-item">Manual audit for flagged submissions</li>
              </ul>
            </div>
            <div className="trust-visual">
              {/* IMAGE: Diagram showing AI fraud detection layers */}
              <img
                src="/images/ai-fraud-detection-layers.png"
                alt="Visualization of AI fraud detection workflow with device metadata, deepfake analysis, and manual review"
                className="trust-img"
              />
            </div>
          </div>
        </section>

        {/* Insurance Plans Section */}
        <section className="insurance-section">
          <h2 className="section-title">Available Insurance Plans</h2>

          <div className="insurance-search-wrapper">
            <svg
              className="search-icon"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1110.5 3a7.5 7.5 0 016.15 13.65z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search insurance plans..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="insurance-search"
            />
          </div>


          {error && (
            <div className="error-banner">
              <p className="error-text">{error}</p>
              <button onClick={fetchInsurances} className="btn-retry">
                Retry
              </button>
            </div>
          )}

          {loading && (
            <div className="loading-container">
              <div className="loading-spinner" />
              <p className="loading-text">Loading insurance plans...</p>
            </div>
          )}

          {!loading && (
            <div className="insurance-grid">
              {filteredInsurances.map((insurance) => (
                <div
                  key={insurance._id}
                  className="insurance-card"
                  onClick={() => handleInsuranceSelect(insurance)}
                >
                  <div className="insurance-header">
                    <h3 className="insurance-name">
                      <img src="/images/government-emblem.png" alt="Government Emblem" className="government-emblem" />
                      {insurance.name}
                    </h3>
                    <span className={`insurance-badge insurance-badge-${insurance.type}`}>
                      {insurance.type?.toUpperCase()}
                    </span>
                  </div>

                  <p className="insurance-description">
                    {insurance.shortDescription}
                  </p>

                  <div className="insurance-meta">
                    <span className="meta-text">
                      {(insurance.schemes?.length || 0)} Scheme{insurance.schemes?.length !== 1 ? 's' : ''}
                    </span>
                    {insurance.availableStates && (
                      <span className="meta-text">{insurance.availableStates.length} States</span>
                    )}
                  </div>

                  <button className="insurance-select-btn">
                    Select This Insurance
                  </button>
                </div>
              ))}
            </div>
          )}

          {!loading && filteredInsurances.length === 0 && !error && (
            <div className="empty-state">
              <h3 className="empty-title">
                {searchTerm ? 'No matching insurance plans' : 'No insurance plans available'}
              </h3>
              <p className="empty-text">
                {searchTerm
                  ? `No results found for "${searchTerm}". Try a different search term.`
                  : 'Insurance plans will appear here once they are configured.'}
              </p>
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="btn-clear">
                  Clear Search
                </button>
              )}
            </div>
          )}
        </section>

        {/* Bottom CTA - IMAGE PLACEMENT #5: Dashboard preview */}
        <section className="cta-section">
          <div className="cta-content">
            <div className="cta-text">
              <h2 className="cta-title">Ready to protect your crops?</h2>
              <p className="cta-description">
                Join thousands of farmers using smart insurance powered by visual evidence and AI verification.
              </p>
              <button onClick={handleNewClaim} className="cta-btn">
                Start Your First Claim
              </button>
            </div>
            <div className="cta-preview">
              {/* IMAGE: Screenshot of claim tracking dashboard */}
              <img
                src="/images/dashboard-preview.png"
                alt="Preview of PBI AgriInsure claim tracking dashboard showing real-time status updates"
                className="cta-preview-img"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
