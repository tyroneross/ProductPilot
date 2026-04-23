import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          className="min-h-screen flex items-center justify-center p-6"
          style={{ background: "#110f0d" }}
        >
          <div className="max-w-md text-center space-y-4">
            <h2
              className="text-lg font-semibold"
              style={{ color: "#f5f0eb" }}
            >
              Something went wrong
            </h2>
            <p className="text-sm" style={{ color: "#a89a8c", lineHeight: 1.5 }}>
              {this.state.error?.message || "An unexpected error occurred while loading this page."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="inline-flex items-center justify-center rounded-md font-semibold"
              style={{
                background: "#f0b65e",
                color: "#110f0d",
                height: 44,
                padding: "0 20px",
                fontSize: 14,
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#d4a04e";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#f0b65e";
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
