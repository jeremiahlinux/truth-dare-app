import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";

type ConnectionStatus = "connected" | "connecting" | "disconnected";

export function ConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>("connected");

  useEffect(() => {
    const handleOnline = () => setStatus("connected");
    const handleOffline = () => setStatus("disconnected");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check initial status
    setStatus(navigator.onLine ? "connected" : "disconnected");

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (status === "connected") {
    return (
      <div className="flex items-center gap-2 text-sm text-foreground/70">
        <Wifi className="w-4 h-4 text-accent animate-pulse" />
        <span>Connected</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-destructive">
      <WifiOff className="w-4 h-4" />
      <span>Disconnected</span>
    </div>
  );
}
