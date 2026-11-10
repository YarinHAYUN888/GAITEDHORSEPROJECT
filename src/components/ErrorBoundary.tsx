import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6" dir="rtl">
        <div className="bg-card border border-border rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">משהו השתבש</h2>
          <p className="text-sm text-muted-foreground">Something went wrong</p>
          {this.state.error && (
            <p className="text-xs text-muted-foreground bg-muted rounded p-2 break-words max-h-24 overflow-auto">
              {this.state.error.message}
            </p>
          )}
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition"
            >
              <RefreshCw className="h-4 w-4" />
              טען מחדש
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition"
            >
              <Home className="h-4 w-4" />
              דף הבית
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
