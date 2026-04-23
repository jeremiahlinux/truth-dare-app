import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4">
        <div className="w-full rounded-2xl border border-border bg-card/70 p-8 text-center backdrop-blur-sm">
          <div className="mb-6 flex justify-center">
            <div className="relative rounded-full bg-destructive/10 p-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
          </div>

          <h1 className="mb-2 text-5xl font-black tracking-tight text-accent">404</h1>

          <h2 className="mb-3 text-xl font-semibold">
            Page Not Found
          </h2>

          <p className="mb-8 text-foreground/70 leading-relaxed">
            Sorry, the page you are looking for doesn't exist.
            <br />
            It may have been moved or deleted.
          </p>

          <div
            id="not-found-button-group"
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button
              onClick={handleGoHome}
              className="bg-accent text-background hover:bg-accent/90 px-6 py-2.5 rounded-lg"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
