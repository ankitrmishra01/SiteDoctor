import React from "react";
import { CheckCircle2, Clock, XCircle, RefreshCw, Radio, ShieldX, Terminal } from "lucide-react";
import { useScanStore } from "../store/scanStore.js";

export const ScanProgress: React.FC = () => {
  const { scanStatus, completedChecks, failureReason, clearScan } = useScanStore();

  if (scanStatus === "idle") return null;

  // Unreachable Target Error State
  if (scanStatus === "failed_unreachable") {
    return (
      <div className="hud-panel animate-fade-in" style={{
        marginBottom: "1rem",
        borderColor: "var(--color-critical-border)",
        background: "var(--color-critical-bg)"
      }}>
        <div className="hud-panel-header" style={{ color: "var(--color-critical-text)", background: "rgba(239, 68, 68, 0.15)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <ShieldX size={14} color="var(--color-critical)" />
            <span>DIAGNOSTIC_FAILURE // TARGET_UNREACHABLE</span>
          </div>
          <span className="tag-tech tag-critical">FAILED_UNREACHABLE</span>
        </div>

        <div style={{ padding: "1rem" }}>
          <p className="mono" style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 700 }}>
            {failureReason || "The diagnostic engine was unable to establish a connection to the specified host."}
          </p>

          <div style={{
            marginTop: "0.75rem",
            padding: "0.65rem 0.85rem",
            background: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            fontSize: "0.75rem",
            fontFamily: "var(--font-mono)",
            color: "var(--text-secondary)"
          }}>
            <strong>TROUBLESHOOTING_CHECKLIST:</strong>
            <ul style={{ paddingLeft: "1.2rem", marginTop: "0.3rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              <li>DNS: Verify domain registration and public DNS resolution.</li>
              <li>HOST: Confirm local/cloud server instance is actively listening on target port.</li>
              <li>AUTH: If root endpoint returns HTTP 401/403, public diagnostics cannot proceed without auth headers.</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={clearScan}
            className="tag-tech tag-warning"
            style={{ marginTop: "0.75rem", cursor: "pointer", padding: "0.3rem 0.6rem" }}
          >
            <RefreshCw size={12} />
            <span>RESET_SCANNER</span>
          </button>
        </div>
      </div>
    );
  }

  // System Error State
  if (scanStatus === "failed_error") {
    return (
      <div className="hud-panel animate-fade-in" style={{
        marginBottom: "1rem",
        borderColor: "var(--color-critical-border)",
        background: "var(--color-critical-bg)"
      }}>
        <div className="hud-panel-header" style={{ color: "var(--color-critical-text)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <XCircle size={14} color="var(--color-critical)" />
            <span>SYSTEM_FAILURE // RUNTIME_ERROR</span>
          </div>
          <span className="tag-tech tag-critical">SYSTEM_ERROR</span>
        </div>

        <div style={{ padding: "1rem" }}>
          <p className="mono" style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>
            {failureReason || "An unexpected error occurred during execution."}
          </p>
          <button
            type="button"
            onClick={clearScan}
            className="tag-tech tag-warning"
            style={{ marginTop: "0.75rem", cursor: "pointer", padding: "0.3rem 0.6rem" }}
          >
            <RefreshCw size={12} />
            <span>RESET_SCANNER</span>
          </button>
        </div>
      </div>
    );
  }

  const isRunning = scanStatus === "running" || scanStatus === "queued";

  return (
    <div className="hud-panel animate-fade-in" style={{ marginBottom: "1.75rem" }}>
      <div className="hud-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Terminal size={14} color="var(--accent-amber)" />
          <span>DIAGNOSTIC BATTERY EXECUTION STREAM</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Radio size={12} className={isRunning ? "animate-pulse-dot" : ""} color={isRunning ? "var(--color-pass)" : "var(--text-muted)"} />
          <span className="mono" style={{ fontSize: "0.7rem", color: isRunning ? "var(--color-pass-text)" : "var(--text-muted)" }}>
            {isRunning ? "STREAMING_LIVE" : "EXECUTION_COMPLETE"}
          </span>
        </div>
      </div>

      <div style={{ padding: "1rem 1.25rem" }}>
        {/* Completed Check Steps Stream */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {completedChecks.length === 0 ? (
            <div className="mono" style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              <Clock size={13} />
              <span>[SYSTEM_INIT]: Launching headless browser & initializing network taps...</span>
            </div>
          ) : (
            completedChecks.map((chk, i) => (
              <div key={i} className="mono" style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.75rem",
                padding: "0.25rem 0.4rem",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-xs)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <CheckCircle2 size={13} color="var(--color-pass)" />
                  <strong style={{ color: "var(--text-primary)" }}>{chk.checkName}</strong>
                  <span style={{ color: "var(--text-muted)" }}>// {chk.summary}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  {chk.findings.length > 0 && (
                    <span className="tag-tech tag-warning" style={{ fontSize: "0.65rem", padding: "0.1rem 0.35rem" }}>
                      {chk.findings.length} findings
                    </span>
                  )}
                  {chk.durationMs && (
                    <span style={{ color: "var(--text-dim)", fontSize: "0.7rem" }}>
                      {chk.durationMs}ms
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
