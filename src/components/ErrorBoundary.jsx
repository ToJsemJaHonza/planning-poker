import { Component } from 'react';
import { pixel } from './room/styles';

/**
 * App-wide error boundary.
 *
 * Firebase hiccups, malformed Realtime Database state, or a bad render in
 * any of the pixel-art sprite components should NOT nuke the entire session.
 * This boundary:
 *   1. Catches errors in any descendant render / lifecycle
 *   2. Shows a clear, in-style fallback screen
 *   3. Offers a "Try again" button that clears the error state
 *   4. Dumps the error to the console so the user can share it
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
    this.handleReset = this.handleReset.bind(this);
    this.handleHardReload = this.handleHardReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] caught:', error, info);
    this.setState({ info });
  }

  handleReset() {
    this.setState({ error: null, info: null });
  }

  handleHardReload() {
    try {
      // Keep their name but drop the current room so they land back on Landing
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.location.href = url.toString();
    } catch {
      window.location.reload();
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={styles.wrap} data-testid="error-boundary">
        <div style={styles.card}>
          <div style={styles.emoji}>💥</div>
          <div style={styles.title}>Something broke</div>
          <div style={styles.msg}>{String(this.state.error?.message || this.state.error)}</div>
          <div style={styles.row}>
            <button onClick={this.handleReset} style={styles.btn}>Try again</button>
            <button onClick={this.handleHardReload} style={styles.btnSecondary}>Leave room</button>
          </div>
          <div style={styles.hint}>The error has been logged to your browser console.</div>
        </div>
      </div>
    );
  }
}

const styles = {
  wrap: {
    position: 'fixed', inset: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: '#e8dcc8', fontFamily: pixel, zIndex: 9999,
  },
  card: {
    background: '#f5f0e4',
    border: '4px solid #d4a853',
    padding: '1.5rem 2rem',
    textAlign: 'center',
    maxWidth: '90vw',
    boxShadow: '6px 6px 0 #b8922e',
  },
  emoji: { fontSize: '3rem', marginBottom: '0.5rem' },
  title: { fontSize: '0.9rem', color: '#d4a853', marginBottom: '0.8rem' },
  msg: {
    fontSize: '0.55rem', color: '#2a2a3a', margin: '0.8rem 0 1.2rem',
    wordBreak: 'break-word', maxWidth: '480px',
  },
  row: { display: 'flex', gap: '0.8rem', justifyContent: 'center' },
  btn: {
    padding: '0.5rem 1rem', fontSize: '0.6rem',
    background: '#d4a853', color: '#1e1e2e',
    border: '3px solid #b8922e', cursor: 'pointer',
    fontFamily: pixel, boxShadow: '3px 3px 0 #b8922e',
  },
  btnSecondary: {
    padding: '0.5rem 1rem', fontSize: '0.6rem',
    background: '#f5f0e4', color: '#2a2a3a',
    border: '3px solid #d4a853', cursor: 'pointer',
    fontFamily: pixel,
  },
  hint: {
    fontSize: '0.45rem', color: '#888', marginTop: '1rem',
    fontFamily: pixel,
  },
};
