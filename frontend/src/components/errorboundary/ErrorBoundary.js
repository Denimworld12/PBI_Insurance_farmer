import React from 'react';
import './errorBoundary.css';
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('React Error Boundary caught an error:', error);
        console.error('Error Info:', errorInfo);
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary-container">
                    <div className="error-boundary-card">
                        <div className="error-icon">
                            <span className="error-symbol">!</span>
                        </div>

                        <h2 className="error-title">Something went wrong</h2>
                        <p className="error-description">
                            The application encountered an unexpected error. Please refresh the page or return to the dashboard.
                        </p>

                        <div className="error-actions">
                            <button
                                onClick={() => window.location.reload()}
                                className="btn-refresh"
                            >
                                Refresh Page
                            </button>

                            <button
                                onClick={() => window.location.href = '/'}
                                className="btn-home-error"
                            >
                                Go to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
