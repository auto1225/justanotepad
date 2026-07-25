import { Component, type ReactNode } from 'react'
import { trackEvent } from '../lib/analytics'
import type { ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * Phase 9 — React Error Boundary.
 * 자식 컴포넌트의 throw 를 catch 해서 친절한 fallback UI 표시.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[jan v2] error boundary caught', error, info)
    trackEvent('error_boundary', { message: error.message, stack: (error.stack || '').slice(0, 500) })
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui,sans-serif', maxWidth: 600, margin: '40px auto' }}>
          <h2 style={{ color: '#D32F2F' }}>앗, 오류가 발생했습니다</h2>
          <p style={{ color: '#666' }}>아래 메시지를 복사해 보고하시면 도움이 됩니다.</p>
          <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, overflow: 'auto', fontSize: 12 }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack?.split('\n').slice(0, 8).join('\n')}
          </pre>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button onClick={this.reset} style={{ padding: '8px 16px', background: '#D97757', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer' }}>
              다시 시도
            </button>
            <button onClick={() => location.reload()} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer' }}>
              페이지 새로고침
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
