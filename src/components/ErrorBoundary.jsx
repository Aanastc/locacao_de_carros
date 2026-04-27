import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary pegou um erro:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#ce0a31' }}>Ops! Algo deu errado.</h2>
          <p>Ocorreu um erro inesperado na tela.</p>
          <pre style={{ textAlign: 'left', background: '#f5f5f5', padding: '1rem', overflow: 'auto', borderRadius: '8px', color: '#333' }}>
            {this.state.error?.toString()}
            <br />
            {this.state.errorInfo?.componentStack}
          </pre>
          <button 
            onClick={() => window.location.href = '/'}
            style={{ marginTop: '1rem', padding: '10px 20px', background: '#ce0a31', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            Voltar ao Início
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
