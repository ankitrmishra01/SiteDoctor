import React, { useState } from "react";
import { AlertCircle, AlertTriangle, Info, HelpCircle, CheckCircle2, Clock, Globe } from "lucide-react";
import { useScanStore } from "../store/scanStore.js";

export const HealthScoreCard: React.FC = () => {
  const { currentScan, scanStatus } = useScanStore();
  const [showFormulaTooltip, setShowFormulaTooltip] = useState(false);

  if (scanStatus !== "completed" || !currentScan) return null;

  const score = currentScan.healthScore;
  const scoreColor = score >= 90 ? "var(--color-pass)" : score >= 70 ? "var(--color-warning)" : "var(--color-critical)";
  const scoreBg = score >= 90 ? "var(--color-pass-bg)" : score >= 70 ? "var(--color-warning-bg)" : "var(--color-critical-bg)";
  const scoreBorder = score >= 90 ? "var(--color-pass-border)" : score >= 70 ? "var(--color-warning-border)" : "var(--color-critical-border)";

  const isPartialScan = currentScan.scanCompleteness && currentScan.scanCompleteness !== "full";
  const partialLabel = currentScan.scanCompleteness === "partial_backend_only" 
    ? "BACKEND PROBES ONLY" 
    : currentScan.scanCompleteness === "partial_frontend_only" 
    ? "FRONTEND ONLY" 
    : "PARTIAL PROBES";

  const { critical, warning, info, pass } = currentScan.summaryCounts;
  const statusLabel = isPartialScan
    ? `PROVISIONAL // ${partialLabel} (NON-COMPARABLE)`
    : score >= 90 ? "HEALTHY // OPTIMAL" : score >= 70 ? "WARNING // REMEDIATION_RECOMMENDED" : "CRITICAL // IMMEDIATE_ACTION_REQUIRED";

  return (
    <div className="hud-panel" style={{
      marginBottom: "2rem",
      position: "relative",
      border: isPartialScan ? `2px dashed var(--color-warning)` : `2px solid ${scoreBorder}`,
      boxShadow: isPartialScan 
        ? `0 0 20px rgba(0,0,0,0.7), inset 0 0 30px rgba(234, 179, 8, 0.08)` 
        : `0 0 20px rgba(0,0,0,0.7), inset 0 0 30px ${scoreBg}`
    }}>
      <div className="hud-panel-header" style={{
        background: "var(--bg-surface)",
        borderBottom: isPartialScan ? "1px dashed var(--color-warning)" : `1px solid ${scoreBorder}`,
        padding: "0.85rem 1.5rem"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ color: isPartialScan ? "var(--color-warning)" : scoreColor, fontSize: "1rem" }}>
            {isPartialScan ? "▲" : "●"}
          </span>
          <span style={{ color: "var(--text-primary)", fontWeight: 800, letterSpacing: "0.08em" }}>
            {isPartialScan ? "PROVISIONAL HEALTH SCORE // PARTIAL AUDIT (NON-COMPARABLE)" : "PRIMARY HEALTH SCORE // FULL DIAGNOSTIC AUDIT"}
          </span>
        </div>
        <div className="mono" style={{ fontSize: "0.75rem", color: isPartialScan ? "var(--color-warning)" : scoreColor, fontWeight: 700 }}>
          {statusLabel}
        </div>
      </div>

      {/* Partial Scan Warning Banner if not a full browser + backend audit */}
      {isPartialScan && (
        <div style={{
          background: "var(--color-warning-bg)",
          borderBottom: "1px dashed var(--color-warning-border)",
          padding: "0.85rem 1.5rem",
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
          color: "var(--color-warning-text)"
        }}>
          <AlertTriangle size={18} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: "2px" }} />
          <div style={{ fontSize: "0.825rem", fontFamily: "var(--font-mono)", lineHeight: 1.45 }}>
            <strong style={{ textTransform: "uppercase", color: "var(--color-warning)" }}>[PROVISIONAL SCORE — NON-COMPARABLE]:</strong> {currentScan.completenessNotice || "Frontend browser probe was unreachable or skipped. Findings and health score reflect backend HTTP/TLS probes only. This score cannot be directly compared against full browser audit scores."}
          </div>
        </div>
      )}

      <div style={{
        padding: "1.75rem 2rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "2rem"
      }}>
        {/* Left: Large Anchor Score Gauge & Metadata */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.75rem", flexWrap: "wrap" }}>
          {/* Visual Score Gauge (Dashed + Provisional badge for partial, Solid anchor for full) */}
          <div style={{
            position: "relative",
            width: "140px",
            height: "140px",
            borderRadius: "var(--radius-xs)",
            background: isPartialScan ? "rgba(234, 179, 8, 0.06)" : scoreBg,
            border: isPartialScan ? `3px dashed var(--color-warning)` : `3px solid ${scoreBorder}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: isPartialScan ? "0 0 15px rgba(234, 179, 8, 0.15)" : `0 0 15px ${scoreBg}`
          }}>
            <span className="mono" style={{ fontSize: "3.2rem", fontWeight: 800, color: isPartialScan ? "var(--color-warning)" : scoreColor, lineHeight: 1 }}>
              {score}
            </span>
            {isPartialScan ? (
              <span className="mono" style={{ fontSize: "0.6rem", fontWeight: 800, color: "var(--color-warning)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "6px", textAlign: "center" }}>
                PROVISIONAL
              </span>
            ) : (
              <span className="mono" style={{ fontSize: "0.65rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: "6px" }}>
                / 100 PTS
              </span>
            )}
            {isPartialScan && (
              <span className="mono" style={{ fontSize: "0.55rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "2px" }}>
                {partialLabel}
              </span>
            )}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Globe size={18} color="var(--accent-cyan)" />
              <h2 className="mono" style={{ fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
                {currentScan.targetUrl}
              </h2>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginTop: "0.45rem", fontSize: "0.8rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <Clock size={14} />
                <span>DURATION: <strong style={{ color: "var(--text-primary)" }}>{currentScan.durationMs ? `${(currentScan.durationMs / 1000).toFixed(2)}s` : "N/A"}</strong></span>
              </div>
              <span>|</span>
              <span>AUDIT: <strong style={{ color: currentScan.scanCompleteness === "full" ? "var(--color-pass)" : "var(--color-warning)" }}>{isPartialScan ? `PROVISIONAL (${currentScan.scanCompleteness?.toUpperCase()})` : "FULL AUDIT"}</strong></span>
              <span>|</span>
              <span>TIMESTAMP: <strong style={{ color: "var(--text-primary)" }}>{currentScan.completedAt ? new Date(currentScan.completedAt).toLocaleTimeString() : "N/A"}</strong></span>
            </div>

            {/* Exact Mathematical Formula Breakdown Hover/Click */}
            <div style={{ marginTop: "0.75rem", position: "relative" }}>
              <button
                type="button"
                onMouseEnter={() => setShowFormulaTooltip(true)}
                onMouseLeave={() => setShowFormulaTooltip(false)}
                onClick={() => setShowFormulaTooltip(!showFormulaTooltip)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.775rem",
                  color: "var(--accent-cyan)",
                  background: "transparent",
                  padding: 0,
                  fontFamily: "var(--font-mono)"
                }}
              >
                <HelpCircle size={14} />
                <span style={{ textDecoration: "underline" }}>[ VIEW EXACT WEIGHTED FORMULA BREAKDOWN ]</span>
              </button>

              {showFormulaTooltip && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  marginTop: "0.5rem",
                  width: "420px",
                  padding: "1rem",
                  borderRadius: "var(--radius-xs)",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-card)",
                  fontSize: "0.775rem",
                  zIndex: 50,
                  color: "var(--text-primary)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.8)"
                }}>
                  <div className="mono" style={{ fontWeight: 800, marginBottom: "0.5rem", color: "var(--accent-amber)", fontSize: "0.825rem" }}>WEIGHTED_SCORING_MODEL:</div>
                  <div style={{ fontFamily: "var(--font-mono)", background: "var(--bg-code)", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-xs)", marginBottom: "0.6rem", border: "1px solid var(--border-subtle)" }}>
                    Score = 100 - (critical × 15) - (warning × 5) - (info × 1)
                  </div>
                  <div className="mono" style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.725rem", color: "var(--text-secondary)" }}>
                    <div>• <strong>{critical} Critical</strong> finding(s) × 15 = <span style={{ color: "var(--color-critical)" }}>-{critical * 15} pts</span></div>
                    <div>• <strong>{warning} Warning(s)</strong> × 5 = <span style={{ color: "var(--color-warning)" }}>-{warning * 5} pts</span></div>
                    <div>• <strong>{info} Info notice(s)</strong> × 1 = <span style={{ color: "var(--color-info)" }}>-{info * 1} pts</span></div>
                    <div style={{ marginTop: "0.4rem", paddingTop: "0.4rem", borderTop: "1px solid var(--border-subtle)", fontWeight: 800, color: "var(--text-primary)", fontSize: "0.8rem" }}>
                      Calculated: 100 - {critical * 15} - {warning * 5} - {info * 1} = <span style={{ color: scoreColor }}>{score} / 100</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Supporting Telemetry Metric Blocks */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap"
        }}>
          <div style={{
            padding: "0.75rem 1.15rem",
            borderRadius: "var(--radius-xs)",
            background: "var(--color-critical-bg)",
            border: "1px solid var(--color-critical-border)",
            display: "flex",
            alignItems: "center",
            gap: "0.65rem",
            minWidth: "100px"
          }}>
            <AlertCircle size={20} color="var(--color-critical)" />
            <div>
              <div className="mono" style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-critical-text)", lineHeight: 1 }}>{critical}</div>
              <div className="mono" style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", marginTop: "2px" }}>Critical</div>
            </div>
          </div>

          <div style={{
            padding: "0.75rem 1.15rem",
            borderRadius: "var(--radius-xs)",
            background: "var(--color-warning-bg)",
            border: "1px solid var(--color-warning-border)",
            display: "flex",
            alignItems: "center",
            gap: "0.65rem",
            minWidth: "100px"
          }}>
            <AlertTriangle size={20} color="var(--color-warning)" />
            <div>
              <div className="mono" style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-warning-text)", lineHeight: 1 }}>{warning}</div>
              <div className="mono" style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", marginTop: "2px" }}>Warnings</div>
            </div>
          </div>

          <div style={{
            padding: "0.75rem 1.15rem",
            borderRadius: "var(--radius-xs)",
            background: "var(--color-info-bg)",
            border: "1px solid var(--color-info-border)",
            display: "flex",
            alignItems: "center",
            gap: "0.65rem",
            minWidth: "100px"
          }}>
            <Info size={20} color="var(--color-info)" />
            <div>
              <div className="mono" style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-info-text)", lineHeight: 1 }}>{info}</div>
              <div className="mono" style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", marginTop: "2px" }}>Notices</div>
            </div>
          </div>

          <div style={{
            padding: "0.75rem 1.15rem",
            borderRadius: "var(--radius-xs)",
            background: "var(--color-pass-bg)",
            border: "1px solid var(--color-pass-border)",
            display: "flex",
            alignItems: "center",
            gap: "0.65rem",
            minWidth: "100px"
          }}>
            <CheckCircle2 size={20} color="var(--color-pass)" />
            <div>
              <div className="mono" style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-pass-text)", lineHeight: 1 }}>{pass}</div>
              <div className="mono" style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", marginTop: "2px" }}>Passed</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
