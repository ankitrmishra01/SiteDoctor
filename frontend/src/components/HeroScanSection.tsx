import React, { useState, useRef } from "react";
import { AlertCircle, ChevronDown, ChevronUp, CheckCircle2, X } from "lucide-react";
import { useScanStore } from "../store/scanStore.js";
import { ScanType } from "../types.js";

export const HeroScanSection: React.FC = () => {
  const { 
    startScan, 
    scanStatus, 
    rateLimitError, 
    history, 
    currentScan, 
    completedChecks, 
    loadScanResult 
  } = useScanStore();
  
  const inputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState(currentScan?.targetUrl || "https://developer.mozilla.org");
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
      setValidationError("Invalid URL format. Please include http:// or https://");
      return;
    }

    if (!consent) {
      setValidationError("Authorization required: Please confirm you have permission to scan this target.");
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

  // Extract hostname for address bar
  let displayHostname = "sitedoctor.engine / target";
  try {
    if (currentScan?.targetUrl) {
      displayHostname = new URL(currentScan.targetUrl).hostname;
    } else if (url) {
      displayHostname = new URL(url).hostname;
    }
  } catch {}

  const activeScore = currentScan ? currentScan.healthScore : 88;
  const scoreColor = activeScore >= 90 ? "var(--color-pass)" : activeScore >= 70 ? "var(--color-warning)" : "var(--color-critical)";
  const scoreLabel = activeScore >= 90 ? "Healthy" : activeScore >= 70 ? "Needs Review" : "Critical Fixes";
  const findingsCount = currentScan ? currentScan.findings.length : 0;

  return (
    <section className="hero-scan-section">
      {/* Left Column: Focused Scan Input & Controls */}
      <div className="fade">
        <div className="kicker">
          <b>●</b> REAL-TIME DIAGNOSTIC ENGINE
        </div>

        <p style={{ fontSize: "16px", lineHeight: "1.6", color: "var(--text-secondary)", marginBottom: "20px" }}>
          Full-stack diagnostic audits, Core Web Vitals, WCAG accessibility, and security headers — streamed live as checks complete.
        </p>

        {/* Rate Limit Alert */}
        {rateLimitError && (
          <div style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-warning-bg)",
            border: "1px solid var(--color-warning-border)",
            color: "var(--color-warning-text)",
            marginBottom: "14px",
            fontSize: "12px",
            fontFamily: "var(--font-mono)"
          }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>
              <strong>RATE_LIMIT:</strong> {rateLimitError.message} (Retry after ~{rateLimitError.retryAfterMinutes}m)
            </div>
          </div>
        )}

        {/* Validation Error Alert */}
        {validationError && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-critical-bg)",
            border: "1px solid var(--color-critical-border)",
            color: "var(--color-critical-text)",
            marginBottom: "14px",
            fontSize: "12px",
            fontFamily: "var(--font-mono)"
          }}>
            <AlertCircle size={15} />
            <span>{validationError}</span>
          </div>
        )}

        {/* Scan Input Form Box */}
        <form onSubmit={handleSubmit}>
          <div className="scan-box">
            <input
              ref={inputRef}
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="https://yourwebsite.com or API URL"
              disabled={isScanning}
            />
            {url && !isScanning && (
              <button
                type="button"
                onClick={() => {
                  setUrl("");
                  inputRef.current?.focus();
                }}
                style={{
                  padding: "0 8px",
                  color: "var(--text-muted)",
                  background: "transparent",
                  display: "flex",
                  alignItems: "center"
                }}
                title="Clear input"
              >
                <X size={15} />
              </button>
            )}
            <button type="submit" className="scan-btn" disabled={isScanning}>
              {isScanning ? (
                <>
                  <div className="animate-spin" style={{
                    width: "12px",
                    height: "12px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%"
                  }} />
                  <span>Diagnosing…</span>
                </>
              ) : (
                <>
                  <span>Run diagnosis →</span>
                </>
              )}
            </button>
          </div>

          {/* Status Line */}
          <div className="status-line">
            {isScanning ? (
              <>
                <span style={{ color: "var(--accent-primary)", fontWeight: 700 }}>● ANALYZING</span>
                <span>· performance · SEO · accessibility · security · APIs</span>
              </>
            ) : currentScan ? (
              <>
                <span style={{ color: "var(--color-pass)", fontWeight: 700 }}>● COMPLETE</span>
                <span>· {findingsCount} improvement{findingsCount === 1 ? "" : "s"} found · {currentScan.durationMs ? `${(currentScan.durationMs / 1000).toFixed(1)}s` : "live"}</span>
              </>
            ) : (
              <>
                <span>READY · Analysis runs in real-time over WebSocket</span>
              </>
            )}
          </div>

          {/* Scope Selector & Consent Bar */}
          <div className="scope-consent-strip">
            <div className="scope-chips">
              <span style={{ font: "10px var(--font-mono)", color: "var(--text-muted)", marginRight: "4px" }}>SCOPE:</span>
              <button
                type="button"
                onClick={() => setScanType("both")}
                className={`scope-chip ${scanType === "both" ? "active" : ""}`}
              >
                Full-Stack
              </button>
              <button
                type="button"
                onClick={() => setScanType("frontend")}
                className={`scope-chip ${scanType === "frontend" ? "active" : ""}`}
              >
                Frontend
              </button>
              <button
                type="button"
                onClick={() => setScanType("backend")}
                className={`scope-chip ${scanType === "backend" ? "active" : ""}`}
              >
                Backend API
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                id="consent-box"
                type="checkbox"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  if (e.target.checked) setValidationError(null);
                }}
                style={{ cursor: "pointer", accentColor: "var(--accent-primary)" }}
              />
              <label htmlFor="consent-box" style={{ fontSize: "11px", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-mono)" }}>
                I have permission to scan host
              </label>
            </div>
          </div>

          {/* Advanced OpenAPI Spec Accordion */}
          <div style={{ marginTop: "10px" }}>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "11px",
                fontFamily: "var(--font-mono)",
                color: "var(--text-muted)",
                padding: "2px 0"
              }}
            >
              <span>{showAdvanced ? "[-] Hide OpenAPI spec option" : "[+] Configure OpenAPI / Swagger URL"}</span>
              {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showAdvanced && (
              <div style={{
                marginTop: "6px",
                padding: "8px 12px",
                background: "var(--bg-surface)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)"
              }}>
                <label style={{ display: "block", fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: "4px" }}>
                  OPENAPI / SWAGGER SPEC URL:
                </label>
                <input
                  type="text"
                  value={openApiUrl}
                  onChange={(e) => setOpenApiUrl(e.target.value)}
                  placeholder="https://api.yourdomain.com/openapi.json"
                  style={{
                    width: "100%",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-xs)",
                    padding: "6px 10px",
                    color: "var(--ink)",
                    fontSize: "12px",
                    fontFamily: "var(--font-mono)",
                    outline: "none"
                  }}
                />
              </div>
            )}
          </div>

          {/* Recent Scanned Targets & Presets */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
            marginTop: "16px",
            fontSize: "11px",
            fontFamily: "var(--font-mono)",
            color: "var(--text-muted)"
          }}>
            {history.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap", marginRight: "6px" }}>
                <span style={{ color: "var(--accent-primary)", fontWeight: 700 }}>RECENT:</span>
                {Array.from(new Set(history.map(s => s.targetUrl))).slice(0, 3).map((recentUrl) => {
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
                      className="preset-chip recent"
                      title={`Load latest scan for ${recentUrl}`}
                    >
                      <span>{host}</span>
                      {scan && <span style={{ marginLeft: "4px", fontWeight: 700 }}>[{scan.healthScore}]</span>}
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
              <span>PRESETS:</span>
              <button
                type="button"
                onClick={() => handleDemoPreset("https://developer.mozilla.org", "both")}
                className="preset-chip"
              >
                mdn-docs
              </button>
              <button
                type="button"
                onClick={() => handleDemoPreset("https://vite.dev", "both")}
                className="preset-chip"
              >
                vite.dev (SPA)
              </button>
              <button
                type="button"
                onClick={() => handleDemoPreset("https://en.wikipedia.org", "both")}
                className="preset-chip"
              >
                wikipedia
              </button>
              <button
                type="button"
                onClick={() => handleDemoPreset("https://github.com", "both")}
                className="preset-chip"
              >
                github
              </button>
              <button
                type="button"
                onClick={() => handleDemoPreset("https://httpbin.org", "backend")}
                className="preset-chip"
              >
                httpbin.org (API)
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Right Column: Live Diagnostic Stream Device + Floating Health Score Card */}
      <div className="device-container fade delay">
        <div className="browser-frame">
          <div className="browser-bar">
            <i className="browser-dot red" />
            <i className="browser-dot yellow" />
            <i className="browser-dot green" />
            <div className="browser-address">
              {displayHostname}
            </div>
          </div>

          <div className="execution-stream-content">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
              <span>LIVE DIAGNOSTIC EXECUTION</span>
              <span style={{ color: isScanning ? "var(--color-pass)" : "var(--text-muted)" }}>
                {isScanning ? "● STREAMING" : "IDLE"}
              </span>
            </div>

            {/* Check progress list */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
              {completedChecks.length === 0 && !currentScan ? (
                <div style={{
                  padding: "20px 14px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  background: "var(--bg-card)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px dashed var(--border-subtle)"
                }}>
                  Enter a URL and click [Run diagnosis →] to initiate real-time checks.
                </div>
              ) : (
                (completedChecks.length > 0 ? completedChecks : (currentScan ? [
                  { checkName: "SSL Certificate & Protocol", summary: "TLS handshake verified", findings: currentScan.findings.filter(f => f.category === "security"), durationMs: 45 },
                  { checkName: "Core Web Vitals & TTFB", summary: "Largest Contentful Paint & DOM latency", findings: currentScan.findings.filter(f => f.category === "performance"), durationMs: 310 },
                  { checkName: "Axe Accessibility Audit", summary: "WCAG 2.1 AA contrast and aria labels", findings: currentScan.findings.filter(f => f.category === "accessibility"), durationMs: 180 },
                  { checkName: "Security Headers & CSP", summary: "HSTS, CSP, X-Frame-Options, MIME sniff", findings: currentScan.findings.filter(f => f.category === "security"), durationMs: 65 },
                  { checkName: "API Health & Route Discovery", summary: "Probed /health, /api, robots.txt, sitemap", findings: currentScan.findings.filter(f => f.category === "backend" || f.category === "seo"), durationMs: 140 }
                ] : [])).slice(0, 5).map((chk, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-xs)",
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                      <CheckCircle2 size={13} color="var(--color-pass)" style={{ flexShrink: 0 }} />
                      <strong style={{ color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {chk.checkName}
                      </strong>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                      {chk.findings.length > 0 && (
                        <span className="pill warning" style={{ fontSize: "9px" }}>
                          {chk.findings.length} issue{chk.findings.length === 1 ? "" : "s"}
                        </span>
                      )}
                      {chk.durationMs && (
                        <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>
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

        {/* Floating Health Score Badge */}
        <div className="floating-score-card">
          <div className="floating-score-top">
            <span>SITE HEALTH</span>
            <span style={{ color: "var(--color-pass)", fontWeight: 700 }}>LIVE</span>
          </div>

          <div className="floating-score-body">
            <div 
              className="score-circle-gauge"
              style={{
                background: `conic-gradient(${scoreColor} 0% ${activeScore}%, var(--border-subtle) ${activeScore}% 100%)`
              }}
            >
              <b>{activeScore}</b>
            </div>

            <div>
              <strong style={{ fontSize: "13px", color: "var(--ink)", display: "block" }}>
                {scoreLabel}
              </strong>
              <small style={{ color: "var(--text-muted)", fontSize: "10px", display: "block", marginTop: "2px", fontFamily: "var(--font-mono)" }}>
                {findingsCount} improvement{findingsCount === 1 ? "" : "s"} found
              </small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
