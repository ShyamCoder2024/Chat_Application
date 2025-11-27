import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', textAlign: 'center', marginTop: '50px', fontFamily: 'system-ui, sans-serif' }}>
                    <h1 style={{ color: '#e74c3c' }}>Something went wrong.</h1>
                    <p style={{ color: '#7f8c8d' }}>We're sorry, but an unexpected error occurred.</p>
                    <div style={{ margin: '20px 0', padding: '10px', background: '#f8f9fa', borderRadius: '4px', display: 'inline-block', textAlign: 'left' }}>
                        <code style={{ color: '#c0392b' }}>{this.state.error?.message}</code>
                    </div>
                    <br />
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '10px 20px',
                            marginTop: '20px',
                            cursor: 'pointer',
                            background: '#3498db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '16px'
                        }}
                    >
                        Reload Application
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
