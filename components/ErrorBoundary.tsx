import React from 'react';

interface ErrorBoundaryState { hasError: boolean; error?: Error; }

class ErrorBoundary extends React.Component<React.PropsWithChildren<{ onReset?: () => void }>, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('Boundary caught error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-md flex flex-col gap-4">
            <h2 className="text-xl font-bold text-red-400">Unexpected Error</h2>
            <p className="text-xs text-gray-300 break-all max-h-32 overflow-auto">{this.state.error?.message}</p>
            <div className="flex gap-2">
              <button onClick={this.handleReset} className="flex-1 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">Reset UI</button>
              <button onClick={() => window.location.reload()} className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm">Reload</button>
            </div>
            <p className="text-[10px] text-gray-500 text-center">State may be partially lost. Reload for full reset.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
