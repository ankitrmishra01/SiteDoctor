import React, { useState, useRef } from "react";
import { Play, Globe, AlertCircle, ShieldAlert, ChevronDown, ChevronUp, Terminal, X } from "lucide-react";
import { useScanStore } from "../store/scanStore.js";
import { ScanType } from "../types.js";

export const ScanForm: React.FC = () => {
  const { startScan, scanStatus, rateLimitError, history, loadScanResult } = useScanStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState("https://developer.mozilla.org");
  const [scanType, setScanType] = useState<ScanType>("both");
  const [openApiUrl, setOpenApiUrl] = useState("");
  const [consent, setConsent] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isScanning = scanStatus === "queued" || scanStatus === "running";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!url || !url.trim()) {
      setValidationError("Please enter a target URL to scan.");
      return;
    }

    try {
      new URL(url);
    } catch {
      setValidationError("Invalid URL format. Please include http:// or https:// (e.g. https://example.com)");
      return;
    }

    if (!consent) {
      setValidationError("Authorization required: Please check the consent box confirming you have permission to scan this target.");
      return;
    }

    await startScan({
      url: url.trim(),
      type: scanType,
      openApiUrl: openApiUrl.trim() || undefined,
      consent: true
    });
  };

  const handleDemoPreset = (demoUrl: string, type: ScanType, openApi?: string) => {
    setUrl(demoUrl);
    setScanType(type);
    if (openApi) {
      setOpenApiUrl(openApi);
      setShowAdvanced(true);
    } else {
      setOpenApiUrl("");
      setShowAdvanced(false);
    }
    setConsent(true);
    setValidationError(null);

    // If existing scan exists in history, load it immediately into dashboard
    const existing = history.find(s => {
      try {
        return new URL(s.targetUrl).origin.toLowerCase() === new URL(demoUrl).origin.toLowerCase();
      } catch {
        return s.targetUrl.toLowerCase() === demoUrl.toLowerCase();
      }
    });
    if (existing) {
      loadScanResult(existing);
    }
  };

  return (
    <div className="hud-panel" style={{ marginBottom: "1.75rem" }}>
      {/* Panel Header */}
      <div className="hud-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Terminal size={14} color="var(--accent-amber)" />
          <span>TARGET URL // DIAGNOSTIC SCAN CONFIGURATION</span>
        </div>
        <div className="mono" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
          MODE: {scanType.toUpperCase()}
        </div>
      </div>

      <div style={{ padding: "1.25rem 1.5rem" }}>
        {/* Rate Limit Alert */}
        {rateLimitError && (
          <div style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.5rem",
            padding: "0.6rem 0.75rem",
            borderRadius: "var(--radius-xs)",
            background: "var(--color-warning-bg)",
            border: "1px solid var(--color-warning-border)",
            color: "var(--color-warning-text)",
            marginBottom: "0.75rem",
            fontSize: "0.8rem",
            fontFamily: "var(--font-mono)"
          }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>
              <strong>RATE_LIMIT_EXCEEDED:</strong> {rateLimitError.message} (Retry after ~{rateLimitError.retryAfterMinutes}m)
            </div>
          </div>
        )}

        {/* Validation Error Alert */}
        {validationError && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.5rem 0.75rem",
            borderRadius: "var(--radius-xs)",
            background: "var(--color-critical-bg)",
            border: "1px solid var(--color-critical-border)",
            color: "var(--color-critical-text)",
            marginBottom: "0.75rem",
            fontSize: "0.8rem",
            fontFamily: "var(--font-mono)"
          }}>
            <AlertCircle size={15} />
            <span>ERR: {validationError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Main Full-Width Input Row */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            <div style={{
              flex: "1 1 320px",
              display: "flex",
              alignItems: "center",
              background: "var(--bg-input)",
              border: "1px solid var(--border-card)",
              borderRadius: "var(--radius-xs)",
              padding: "0 0.75rem",
              position: "relative"
            }}>
              <Globe size={15} color="var(--text-muted)" style={{ marginRight: "0.5rem", flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="https://example.com or https://api.yourdomain.com"
                disabled={isScanning}
                className="mono"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--text-primary)",
                  padding: "0.65rem 0",
                  fontSize: "0.9rem"
                }}
              />
              {url && !isScanning && (
                <button
                  type="button"
                  onClick={() => {
                    setUrl("");
                    inputRef.current?.focus();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0.2rem 0.35rem",
                    color: "var(--text-muted)",
                    borderRadius: "var(--radius-xs)",
                    transition: "color var(--transition-fast)"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  title="Clear input"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Execute Scan Button */}
            <button
              type="submit"
              disabled={isScanning}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem",
                padding: "0.65rem 1.4rem",
                borderRadius: "var(--radius-xs)",
                background: isScanning ? "var(--bg-surface)" : "var(--accent-amber)",
                color: isScanning ? "var(--text-muted)" : "#0a0d10",
                fontWeight: 700,
                fontSize: "0.85rem",
                fontFamily: "var(--font-mono)",
                cursor: isScanning ? "not-allowed" : "pointer"
              }}
            >
              {isScanning ? (
                <>
                  <div className="animate-spin" style={{
                    width: "13px",
                    height: "13px",
                    border: "2px solid rgba(0,0,0,0.3)",
                    borderTopColor: "#000",
                    borderRadius: "50%"
                  }} />
                  <span>RUNNING_SCAN...</span>
                </>
              ) : (
                <>
                  <Play size={14} fill="#0a0d10" />
                  <span>EXECUTE_DIAGNOSTICS</span>
                </>
              )}
            </button>
          </div>

          {/* Scope Selector & Consent Bar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
            background: "var(--bg-surface)",
            padding: "0.5rem 0.75rem",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-xs)",
            marginBottom: "0.75rem"
          }}>
            {/* Scope Buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
              <span className="mono" style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginRight: "0.3rem" }}>
                SCOPE:
              </span>
              
              <button
                type="button"
                onClick={() => setScanType("both")}
                className={`tag-tech ${scanType === "both" ? "tag-warning" : "tag-neutral"}`}
              >
                [ FULL-STACK: BOTH ]
              </button>

              <button
                type="button"
                onClick={() => setScanType("frontend")}
                className={`tag-tech ${scanType === "frontend" ? "tag-warning" : "tag-neutral"}`}
              >
                [ FRONTEND ONLY ]
              </button>

              <button
                type="button"
                onClick={() => setScanType("backend")}
                className={`tag-tech ${scanType === "backend" ? "tag-warning" : "tag-neutral"}`}
              >
                [ BACKEND API ONLY ]
              </button>
            </div>

            {/* Mandatory Authorization Checkbox */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <input
                id="consent-checkbox"
                type="checkbox"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  if (e.target.checked) setValidationError(null);
                }}
                style={{ width: "14px", height: "14px", cursor: "pointer", accentColor: "var(--accent-amber)" }}
              />
              <label htmlFor="consent-checkbox" style={{ fontSize: "0.75rem", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-mono)" }}>
                <ShieldAlert size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: "3px", color: "var(--accent-amber)" }} />
                AUTH_CONFIRM: I own or have permission to scan this host
              </label>
            </div>
          </div>

          {/* Advanced OpenAPI Spec Accordion */}
          <div style={{ marginBottom: "0.5rem" }}>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
                fontSize: "0.75rem",
                fontFamily: "var(--font-mono)",
                color: "var(--text-muted)",
                padding: "0.2rem 0"
              }}
            >
              <span>{showAdvanced ? "[-] HIDE_OPENAPI_SPEC_OPTIONS" : "[+] CONFIGURE_OPENAPI_SPEC_URL"}</span>
              {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {showAdvanced && (
              <div style={{
                marginTop: "0.4rem",
                padding: "0.6rem 0.75rem",
                background: "var(--bg-input)",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--border-subtle)"
              }}>
                <label className="mono" style={{ display: "block", fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                  OPENAPI / SWAGGER SPEC URL (JSON or YAML):
                </label>
                <input
                  type="text"
                  value={openApiUrl}
                  onChange={(e) => setOpenApiUrl(e.target.value)}
                  placeholder="https://api.yourdomain.com/openapi.json"
                  className="mono"
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "1px solid var(--border-card)",
                    borderRadius: "var(--radius-xs)",
                    padding: "0.4rem 0.6rem",
                    color: "var(--text-primary)",
                    fontSize: "0.8rem",
                    outline: "none"
                  }}
                />
              </div>
            )}
          </div>

          {/* Recent Scanned Targets & Preset Buttons */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            flexWrap: "wrap",
            paddingTop: "0.5rem",
            borderTop: "1px solid var(--border-subtle)",
            fontSize: "0.725rem",
            fontFamily: "var(--font-mono)",
            color: "var(--text-muted)"
          }}>
            {history.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap", marginRight: "0.5rem" }}>
                <span style={{ color: "var(--accent-cyan)", fontWeight: 700 }}>RECENT:</span>
                {Array.from(new Set(history.map(s => s.targetUrl))).slice(0, 4).map((recentUrl) => {
                  const scan = history.find(s => s.targetUrl === recentUrl);
                  let host = recentUrl;
                  try { host = new URL(recentUrl).hostname; } catch {}
                  return (
                    <button
                      key={recentUrl}
                      type="button"
                      onClick={() => {
                        if (scan) {
                          setUrl(recentUrl);
                          setScanType(scan.scanType);
                          loadScanResult(scan);
                        }
                      }}
                      className="tag-tech tag-info"
                      style={{ cursor: "pointer", padding: "0.15rem 0.45rem" }}
                      title={`Load latest scan for ${recentUrl}`}
                    >
                      <span>{host}</span>
                      {scan && <span className="mono" style={{ opacity: 0.85, fontWeight: 700 }}>[{scan.healthScore}]</span>}
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
              <span>PRESETS:</span>
              
              <button
                type="button"
                onClick={() => handleDemoPreset("https://developer.mozilla.org", "both")}
                className="tag-tech tag-neutral"
              >
                mdn-docs
              </button>

              <button
                type="button"
                onClick={() => handleDemoPreset("https://vite.dev", "both")}
                className="tag-tech tag-neutral"
              >
                vite.dev (SPA)
              </button>

              <button
                type="button"
                onClick={() => handleDemoPreset("https://en.wikipedia.org", "both")}
                className="tag-tech tag-neutral"
              >
                wikipedia
              </button>

              <button
                type="button"
                onClick={() => handleDemoPreset("https://github.com", "both")}
                className="tag-tech tag-neutral"
              >
                github
              </button>

              <button
                type="button"
                onClick={() => handleDemoPreset("https://httpbin.org", "backend")}
                className="tag-tech tag-neutral"
              >
                httpbin.org (API)
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
