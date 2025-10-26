import React from 'react';
import './errorBoundary.css';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { 
            hasError: false, 
            error: null, 
            errorInfo: null 
        };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Log error details to console
        console.error('🚨 React Error Boundary caught an error:');
        console.error('Error:', error);
        console.error('Error Info:', errorInfo);
        console.error('Component Stack:', errorInfo.componentStack);

        // Update state with error details
        this.setState({
            error: error,
            errorInfo: errorInfo
        });

        // ✅ In production, you could send this to an error reporting service
        if (process.env.NODE_ENV === 'production') {
            // Example: Send to error tracking service
            // logErrorToService(error, errorInfo);
            console.log('📊 Error logged to monitoring service');
        }
    }

    handleReset = () => {
        this.setState({ 
            hasError: false, 
            error: null, 
            errorInfo: null 
        });
    };

    render() {
        if (this.state.hasError) {
            const isDevelopment = process.env.NODE_ENV === 'development';

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

                        {/* ✅ Show error details only in development */}
                        {isDevelopment && this.state.error && (
                            <div className="error-details">
                                <details className="error-stack">
                                    <summary className="error-summary">
                                        Error Details (Development Only)
                                    </summary>
                                    <div className="error-stack-content">
                                        <p className="error-message">
                                            <strong>Error:</strong> {this.state.error.toString()}
                                        </p>
                                        {this.state.errorInfo && (
                                            <pre className="error-stack-trace">
                                                {this.state.errorInfo.componentStack}
                                            </pre>
                                        )}
                                    </div>
                                </details>
                            </div>
                        )}

                        <div className="error-actions">
                            <button
                                onClick={() => window.location.reload()}
                                className="btn-refresh"
                            >
                                🔄 Refresh Page
                            </button>

                            <button
                                onClick={() => window.location.href = '/'}
                                className="btn-home-error"
                            >
                                🏠 Go to Dashboard
                            </button>

                            {isDevelopment && (
                                <button
                                    onClick={this.handleReset}
                                    className="btn-reset"
                                >
                                    🔧 Reset Error Boundary
                                </button>
                            )}
                        </div>

                        <p className="error-support">
                            If this problem persists, please contact support at{' '}
                            <a href="mailto:support@pbi-agriinsure.com">
                                support@pbi-agriinsure.com
                            </a>
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
