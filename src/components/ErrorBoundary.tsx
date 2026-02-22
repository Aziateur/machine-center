import React from 'react';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '40px',
                    background: '#1a1a2e',
                    color: '#fff',
                    fontFamily: 'monospace',
                    height: '100vh',
                }}>
                    <h2 style={{ color: '#ef4444', marginBottom: '16px' }}>Something went wrong</h2>
                    <pre style={{
                        background: '#111',
                        padding: '16px',
                        borderRadius: '8px',
                        overflow: 'auto',
                        fontSize: '13px',
                        lineHeight: '1.6',
                    }}>
                        {this.state.error?.message}
                        {'\n\n'}
                        {this.state.error?.stack}
                    </pre>
                    <button
                        onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
                        style={{
                            marginTop: '16px',
                            padding: '8px 16px',
                            background: '#4262FF',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                        }}
                    >
                        Go Back to Dashboard
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
