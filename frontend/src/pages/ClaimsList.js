import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const CLAIM_STATUS = {
    DRAFT: 'draft',
    SUBMITTED: 'submitted',
    PROCESSING: 'processing',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    PAYOUT_COMPLETE: 'payout-complete'
};

const ClaimsList = () => {
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        fetchClaims();
    }, [filter, currentPage]);

    const fetchClaims = async () => {
        try {
            setLoading(true);

            // Mock API call - replace with actual API when backend is ready
            const mockClaims = [
                {
                    _id: '1',
                    documentId: '12345678AB',
                    status: 'processing',
                    formData: {
                        cropType: 'Rice',
                        farmArea: 5.5,
                        state: 'Maharashtra',
                        season: 'Kharif'
                    },
                    insuranceId: { name: 'PM Fasal Bima Yojana' },
                    submittedAt: new Date().toISOString(),
                    processingResult: {
                        risk: 'low',
                        phases: {
                            damageAssessment: { percentage: 25 }
                        }
                    }
                },
                {
                    _id: '2',
                    documentId: '87654321XY',
                    status: 'approved',
                    formData: {
                        cropType: 'Wheat',
                        farmArea: 3.2,
                        state: 'Punjab',
                        season: 'Rabi'
                    },
                    insuranceId: { name: 'Weather Based Crop Insurance' },
                    submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                    approvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                    financial: { approvedAmount: 15000 },
                    processingResult: {
                        risk: 'medium',
                        phases: {
                            damageAssessment: { percentage: 40 }
                        }
                    }
                }
            ];

            const filteredClaims = filter === 'all'
                ? mockClaims
                : mockClaims.filter(claim => claim.status === filter);

            setClaims(filteredClaims);
            setTotalPages(1);

        } catch (error) {
            console.error('Failed to fetch claims:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'approved': return '#4CAF50';
            case 'rejected': return '#F44336';
            case 'processing': return '#FF9800';
            case 'submitted': return '#2196F3';
            case 'payout-complete': return '#8BC34A';
            default: return '#757575';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'approved': return '✅';
            case 'rejected': return '❌';
            case 'processing': return '⏳';
            case 'submitted': return '📤';
            case 'payout-complete': return '💰';
            default: return '📋';
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const handleNewClaim = () => {
        navigate('/');
    };

    return (
        <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '2rem',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <h1 style={{ margin: 0, color: '#333' }}>📋 My Claims</h1>
                <button
                    onClick={handleNewClaim}
                    style={{
                        padding: '0.75rem 1.5rem',
                        background: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: '500'
                    }}
                >
                    ➕ New Claim
                </button>
            </div>

            {/* Filters */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                    background: 'white',
                    padding: '1rem',
                    borderRadius: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                }}>
                    {[
                        { key: 'all', label: 'All Claims' },
                        { key: 'submitted', label: 'Submitted' },
                        { key: 'processing', label: 'Processing' },
                        { key: 'approved', label: 'Approved' },
                        { key: 'payout-complete', label: 'Completed' }
                    ].map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            style={{
                                padding: '0.5rem 1rem',
                                border: 'none',
                                background: filter === key ? '#4CAF50' : '#f5f5f5',
                                color: filter === key ? 'white' : '#333',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                transition: 'all 0.3s'
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Claims List */}
            {loading ? (
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '200px'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            width: '50px',
                            height: '50px',
                            border: '5px solid #f3f3f3',
                            borderTop: '5px solid #4CAF50',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 1rem'
                        }}></div>
                        <p>Loading claims...</p>
                    </div>
                </div>
            ) : (
                <>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                        gap: '1.5rem',
                        marginBottom: '2rem'
                    }}>
                        {claims.map((claim) => (
                            <div key={claim._id} style={{
                                background: 'white',
                                borderRadius: '12px',
                                padding: '1.5rem',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                                transition: 'transform 0.3s',
                                cursor: 'pointer'
                            }}
                                onMouseEnter={(e) => e.target.style.transform = 'translateY(-5px)'}
                                onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                            >
                                {/* Claim Header */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: '1rem'
                                }}>
                                    <div>
                                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
                                            📄 {claim.documentId}
                                        </h3>
                                        <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>
                                            {claim.insuranceId?.name || 'Unknown Insurance'}
                                        </p>
                                    </div>
                                    <span
                                        style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '20px',
                                            color: 'white',
                                            fontSize: '0.75rem',
                                            fontWeight: '500',
                                            backgroundColor: getStatusColor(claim.status)
                                        }}
                                    >
                                        {getStatusIcon(claim.status)} {claim.status.replace('-', ' ').toUpperCase()}
                                    </span>
                                </div>

                                {/* Claim Details */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                        <div>
                                            <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                                                <strong>Crop:</strong> {claim.formData?.cropType}
                                            </p>
                                            <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                                                <strong>Area:</strong> {claim.formData?.farmArea} acres
                                            </p>
                                        </div>
                                        <div>
                                            <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                                                <strong>State:</strong> {claim.formData?.state}
                                            </p>
                                            <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                                                <strong>Season:</strong> {claim.formData?.season}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Dates */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                                        <strong>Submitted:</strong> {formatDate(claim.submittedAt)}
                                    </p>
                                    {claim.approvedAt && (
                                        <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: '#4CAF50' }}>
                                            <strong>Approved:</strong> {formatDate(claim.approvedAt)}
                                        </p>
                                    )}
                                </div>

                                {/* Financial Info */}
                                {claim.financial?.approvedAmount && (
                                    <div style={{
                                        background: '#e8f5e8',
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        marginBottom: '1rem'
                                    }}>
                                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#2e7d32' }}>
                                            <strong>💰 Approved Amount:</strong> ₹{claim.financial.approvedAmount.toLocaleString()}
                                        </p>
                                    </div>
                                )}

                                {/* Processing Results */}
                                {claim.processingResult && (
                                    <div style={{
                                        background: '#f5f5f5',
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        marginBottom: '1rem'
                                    }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                            <p style={{ margin: 0, fontSize: '0.875rem' }}>
                                                <strong>Risk:</strong> {claim.processingResult.risk}
                                            </p>
                                            <p style={{ margin: 0, fontSize: '0.875rem' }}>
                                                <strong>Damage:</strong> {(claim.processingResult.phases?.damageAssessment?.percentage || 0).toFixed(1)}%
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        style={{
                                            flex: 1,
                                            padding: '0.5rem',
                                            background: '#2196F3',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '0.875rem'
                                        }}
                                    >
                                        👁️ View Details
                                    </button>
                                    {claim.status === 'payout-complete' && (
                                        <button
                                            style={{
                                                flex: 1,
                                                padding: '0.5rem',
                                                background: '#4CAF50',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '0.875rem'
                                            }}
                                        >
                                            📄 Download Receipt
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Empty State */}
                    {claims.length === 0 && (
                        <div style={{
                            background: 'white',
                            padding: '3rem',
                            borderRadius: '12px',
                            textAlign: 'center',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📋</div>
                            <h3 style={{ margin: '0 0 1rem 0', color: '#333' }}>No claims found</h3>
                            <p style={{ margin: '0 0 2rem 0', color: '#666' }}>
                                {filter === 'all'
                                    ? "You haven't submitted any claims yet."
                                    : `No claims with status "${filter}" found.`
                                }
                            </p>
                            <button
                                onClick={handleNewClaim}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: '#4CAF50',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '1rem'
                                }}
                            >
                                ➕ Create Your First Claim
                            </button>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '1rem',
                            background: 'white',
                            padding: '1rem',
                            borderRadius: '12px',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                        }}>
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: currentPage === 1 ? '#ccc' : '#4CAF50',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                                }}
                            >
                                ← Previous
                            </button>
                            <span>Page {currentPage} of {totalPages}</span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: currentPage === totalPages ? '#ccc' : '#4CAF50',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                                }}
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ClaimsList;
