import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('❌ React Error Boundary caught an error:', error);
        console.error('Error Info:', errorInfo);
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '2rem',
                    textAlign: 'center',
                    background: '#fff',
                    borderRadius: '8px',
                    margin: '2rem',
                    border: '2px solid #f44336'
                }}>
                    <h2 style={{ color: '#f44336', marginBottom: '1rem' }}>⚠️ Something went wrong</h2>
                    <p style={{ marginBottom: '1rem' }}>
                        The application encountered an unexpected error. Please refresh the page or try again.
                    </p>

                    <div style={{ marginTop: '2rem' }}>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '1rem 2rem',
                                background: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                marginRight: '1rem'
                            }}
                        >
                            🔄 Refresh Page
                        </button>

                        <button
                            onClick={() => window.location.href = '/'}
                            style={{
                                padding: '1rem 2rem',
                                background: '#666',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '1rem'
                            }}
                        >
                            🏠 Go to Dashboard
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
