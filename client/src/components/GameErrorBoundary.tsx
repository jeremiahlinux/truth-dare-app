import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GameErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Game Error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <h1 className="text-4xl font-bold neon-text mb-4">Oops!</h1>
            <p className="text-foreground/80 mb-6">
              Something went wrong during the game. Please try again.
            </p>
            <p className="text-sm text-foreground/60 mb-8 font-mono bg-card/50 p-4 rounded-lg">
              {this.state.error?.message}
            </p>
            <Button
              onClick={this.handleReset}
              className="bg-accent hover:bg-accent/90 text-background font-bold px-8 py-6 neon-glow-primary"
            >
              Return to Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
