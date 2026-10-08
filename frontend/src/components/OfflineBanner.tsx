import React, { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      style={{
        background: "var(--color-critical-bg)",
        borderBottom: "1px solid var(--color-critical-border)",
        color: "var(--color-critical-text)",
        padding: "10px 16px",
        fontSize: "12px",
        fontFamily: "var(--font-mono)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        textAlign: "center",
        position: "sticky",
        top: 0,
        zIndex: 100
      }}
    >
      <WifiOff size={15} />
      <span>
        <strong>OFFLINE:</strong> Network disconnected. Cached scan history is available offline — reconnect to network to trigger new live audits.
      </span>
    </div>
  );
};
