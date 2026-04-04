import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '2rem',
          textAlign: 'center',
          color: '#e2e8f0',
        }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Quelque chose s'est mal passé</h2>
          <p style={{ marginBottom: '1.5rem', color: '#94a3b8', maxWidth: '400px' }}>
            Une erreur inattendue est survenue. Essaie de recharger la page.
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.95rem',
              }}
            >
              Réessayer
            </button>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: '#e2e8f0',
                cursor: 'pointer',
                fontSize: '0.95rem',
              }}
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
