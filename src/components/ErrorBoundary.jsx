import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    console.error('Component error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '2rem', background: 'var(--red-bg)', border: '1px solid var(--red)',
          borderRadius: 'var(--radius-lg)', margin: '1rem',
        }}>
          <div style={{ fontSize: 18, marginBottom: 8 }}>⚠ Something went wrong</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => this.setState({ error: null, info: null })}
              style={{ padding: '7px 16px', borderRadius: 'var(--radius)', background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13 }}
            >Try again</button>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '7px 16px', borderRadius: 'var(--radius)', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border2)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13 }}
            >Reload page</button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.info && (
            <pre style={{ marginTop: 12, fontSize: 11, color: 'var(--text3)', overflow: 'auto', maxHeight: 200 }}>
              {this.state.info.componentStack}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
