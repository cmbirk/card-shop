import { Component, type ReactNode } from 'react';

/** Last line of defence: a broken scene shows a reload card instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('[shop] scene crashed:', error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash">
        <div className="crash-card">
          <div className="signin-title">Well, that's embarrassing.</div>
          <p>Something in the shop broke. Reloading usually sorts it out — your sign-in and anything on hold at the counter are safe.</p>
          <code>{this.state.error.message}</code>
          <button className="btn" onClick={() => location.reload()}>
            Reload the shop
          </button>
        </div>
      </div>
    );
  }
}
