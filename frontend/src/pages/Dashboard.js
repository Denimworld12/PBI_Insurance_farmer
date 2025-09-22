import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

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
      console.log('🔄 Fetching insurances from API...');
      const response = await api.get('/insurance/list');
      
      console.log('✅ Insurance API response:', JSON.stringify(response.data, null, 2));
      
      if (response.data.success && response.data.insurances) {
        setInsurances(response.data.insurances);
        console.log('📋 Loaded insurances:', response.data.insurances.length);
      } else {
        throw new Error('Invalid response format');
      }
      
    } catch (error) {
      console.error('❌ Failed to fetch insurances:', error);
      setError('Failed to load insurance plans. Please try again.');
      
      // Fallback to empty array
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
    console.log('🎯 Insurance selected:', JSON.stringify(insurance, null, 2));
    console.log('🎯 Navigating to claim form for insurance ID:', insurance._id);
    
    if (!insurance._id) {
      console.error('❌ No insurance ID found');
      alert('Error: Insurance ID not found. Please try again.');
      return;
    }
    
    try {
      navigate(`/claim-form/${insurance._id}`);
    } catch (error) {
      console.error('❌ Navigation error:', error);
      alert('Navigation failed. Please refresh and try again.');
    }
  };

  const handleNewClaim = () => {
    console.log('🔄 New claim button clicked');
    console.log('🔄 Available insurances:', insurances.length);
    
    if (insurances.length === 0) {
      setError('No insurance plans available. Please check your connection and try again.');
      return;
    }
    
    // Scroll to insurance section
    const insuranceSection = document.querySelector('.insurance-section');
    if (insuranceSection) {
      insuranceSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleViewClaims = () => {
    console.log('📋 View claims clicked');
    navigate('/claims');
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Hero Section */}
      <div style={{
        background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
        color: 'white',
        padding: '3rem 2rem',
        borderRadius: '16px',
        marginBottom: '2rem',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '2.5rem', margin: '0 0 1rem 0' }}>🌾 Welcome to PBI AgriInsure</h1>
        <p style={{ fontSize: '1.2rem', margin: 0, opacity: 0.9 }}>
          Photo and video-based agriculture insurance to help farmers claim crop loss quickly and securely.
        </p>
        {user && (
          <p style={{ fontSize: '1rem', margin: '1rem 0 0 0', opacity: 0.8 }}>
            Welcome back, {user.phoneNumber}! 📱
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1rem',
        marginBottom: '3rem'
      }}>
        <button 
          onClick={handleViewClaims}
          style={{
            padding: '1.5rem',
            background: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '1.1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
          onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
        >
          📋 View My Claims
        </button>
        
        <button 
          onClick={handleNewClaim}
          style={{
            padding: '1.5rem',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '1.1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
          onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
        >
          ➕ New Claim
        </button>
      </div>

      {/* Insurance Plans Section */}
      <div className="insurance-section">
        <h2 style={{ marginBottom: '1rem', color: '#333' }}>📄 Available Insurance Plans</h2>
        
        {/* Search */}
        <input
          type="text"
          placeholder="🔍 Search insurance plans..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '500px',
            padding: '1rem',
            fontSize: '1rem',
            border: '2px solid #e0e0e0',
            borderRadius: '12px',
            marginBottom: '2rem',
            outline: 'none'
          }}
          onFocus={(e) => e.target.style.borderColor = '#4CAF50'}
          onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
        />

        {/* Error Message */}
        {error && (
          <div style={{
            background: '#ffebee',
            color: '#c62828',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '2rem',
            textAlign: 'center'
          }}>
            <p>{error}</p>
            <button 
              onClick={fetchInsurances}
              style={{
                padding: '0.5rem 1rem',
                background: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                marginTop: '0.5rem'
              }}
            >
              🔄 Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '5px solid #f3f3f3',
              borderTop: '5px solid #4CAF50',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem'
            }}></div>
            <p>Loading insurance plans...</p>
          </div>
        )}

        {/* Insurance Grid */}
        {!loading && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '1.5rem'
          }}>
            {filteredInsurances.map((insurance) => (
              <div
                key={insurance._id}
                style={{
                  background: 'white',
                  border: '2px solid #f0f0f0',
                  borderRadius: '16px',
                  padding: '2rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-8px)';
                  e.target.style.borderColor = '#4CAF50';
                  e.target.style.boxShadow = '0 8px 25px rgba(76,175,80,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.borderColor = '#f0f0f0';
                  e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onClick={() => handleInsuranceSelect(insurance)}
              >
                {/* Insurance Header */}
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{
                    margin: '0 0 0.5rem 0',
                    color: '#333',
                    fontSize: '1.3rem',
                    fontWeight: '600'
                  }}>
                    {insurance.name}
                  </h3>
                  <div style={{
                    display: 'inline-block',
                    background: insurance.type === 'crop' ? '#e8f5e8' : '#e3f2fd',
                    color: insurance.type === 'crop' ? '#2e7d32' : '#1565c0',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}>
                    {insurance.type?.toUpperCase()}
                  </div>
                </div>

                {/* Description */}
                <p style={{
                  color: '#666',
                  marginBottom: '1.5rem',
                  lineHeight: '1.5'
                }}>
                  {insurance.shortDescription}
                </p>

                {/* Schemes Info */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <span style={{ color: '#666', fontSize: '0.9rem' }}>
                    🎯 {insurance.schemes?.length || 0} Scheme{insurance.schemes?.length !== 1 ? 's' : ''} Available
                  </span>
                  {insurance.availableStates && (
                    <span style={{ color: '#666', fontSize: '0.9rem' }}>
                      📍 {insurance.availableStates.length} States
                    </span>
                  )}
                </div>

                {/* Action Button */}
                <button
                  style={{
                    width: '100%',
                    padding: '1rem',
                    background: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    e.target.style.background = '#45a049';
                  }}
                  onMouseLeave={(e) => {
                    e.stopPropagation();
                    e.target.style.background = '#4CAF50';
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleInsuranceSelect(insurance);
                  }}
                >
                  Select This Insurance →
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredInsurances.length === 0 && !error && (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            background: 'white',
            borderRadius: '16px',
            border: '2px dashed #e0e0e0'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📄</div>
            <h3 style={{ margin: '0 0 1rem 0', color: '#333' }}>
              {searchTerm ? 'No matching insurance plans' : 'No insurance plans available'}
            </h3>
            <p style={{ color: '#666', marginBottom: '2rem' }}>
              {searchTerm 
                ? `No results found for "${searchTerm}". Try a different search term.`
                : 'Insurance plans will appear here once they are configured.'
              }
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Clear Search
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {insurances.length > 0 && (
        <div style={{
          background: '#f8f9fa',
          padding: '2rem',
          borderRadius: '16px',
          marginTop: '3rem',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#333' }}>📊 Quick Stats</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4CAF50' }}>
                {insurances.length}
              </div>
              <div style={{ color: '#666' }}>Insurance Plans</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2196F3' }}>
                {insurances.filter(i => i.type === 'crop').length}
              </div>
              <div style={{ color: '#666' }}>Crop Insurance</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ff9800' }}>
                {insurances.filter(i => i.type === 'weather').length}
              </div>
              <div style={{ color: '#666' }}>Weather Based</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Add CSS animation for loading spinner
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

export default Dashboard;
