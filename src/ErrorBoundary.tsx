import { Component, type ErrorInfo, type ReactNode } from "react";
import { STORAGE_KEY } from "./app/storage";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Top-level crash guard. A render error in a serverless PWA would otherwise
 * leave a blank screen with the user's only copy of their data trapped in
 * localStorage. This catches the error, shows a recovery screen, and — most
 * importantly — offers a one-tap export so no data is ever lost to a crash.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface the stack in the console for debugging / bug reports.
    console.error("Fishroom crashed:", error, info.componentStack);
  }

  exportData = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? "{}";
      const blob = new Blob([raw], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fishroom-recovery-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      /* nothing else we can safely do */
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <div className="crash-card">
          <div className="crash-emoji" aria-hidden>
            🐟💔
          </div>
          <h1>Something went wrong</h1>
          <p>
            Fishroom hit an unexpected error. Your tanks are still saved on this
            device — export a backup first, then reload.
          </p>
          <div className="crash-actions">
            <button className="crash-primary" onClick={this.exportData}>
              ⬇️ Export my data
            </button>
            <button onClick={() => window.location.reload()}>Reload app</button>
          </div>
          <pre className="crash-detail">{this.state.error.message}</pre>
        </div>
      </div>
    );
  }
}
