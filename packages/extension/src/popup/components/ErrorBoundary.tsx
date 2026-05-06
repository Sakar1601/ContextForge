import React from 'react'

interface State { hasError: boolean; message: string }

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: React.PropsWithChildren) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: String(err) }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            padding: '16px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            margin: 8,
            fontSize: 13,
            color: '#991b1b',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Something went wrong</div>
          <div style={{ fontSize: 11, color: '#b91c1c', wordBreak: 'break-word' }}>
            {this.state.message}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            style={{
              marginTop: 8, padding: '4px 12px', borderRadius: 5,
              border: '1px solid #fca5a5', background: '#fff',
              cursor: 'pointer', fontSize: 12, color: '#991b1b',
            }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
