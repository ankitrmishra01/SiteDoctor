import React, { useState } from "react";
import { X, GitCompare, ArrowRight, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import { useScanStore } from "../store/scanStore.js";

interface CompareScansModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompareScansModal: React.FC<CompareScansModalProps> = ({ isOpen, onClose }) => {
  const { history, currentScan } = useScanStore();
  const [scanAId, setScanAId] = useState<string>("");
  const [scanBId, setScanBId] = useState<string>("");

  if (!isOpen || !currentScan) return null;

  const urlScans = (history && history.length > 0)
    ? history.filter(s => {
        try {
          return new URL(s.targetUrl).origin === new URL(currentScan.targetUrl).origin;
        } catch {
          return s.targetUrl === currentScan.targetUrl;
        }
      })
    : [currentScan];

  const scanA = urlScans.find(s => s.jobId === scanAId) || (urlScans.length > 1 ? urlScans[1] : urlScans[0]) || currentScan;
  const scanB = urlScans.find(s => s.jobId === scanBId) || currentScan || urlScans[0];

  if (!scanA || !scanB) return null;

  // Diff findings by ruleId & title
  const findingsA = scanA.findings || [];
  const findingsB = scanB.findings || [];

  const mapA = new Map(findingsA.map(f => [f.ruleId + ":" + f.title, f]));
  const mapB = new Map(findingsB.map(f => [f.ruleId + ":" + f.title, f]));

  const fixedFindings = findingsA.filter(f => !mapB.has(f.ruleId + ":" + f.title));
  const newFindings = findingsB.filter(f => !mapA.has(f.ruleId + ":" + f.title));
  const persistentFindings = findingsB.filter(f => mapA.has(f.ruleId + ":" + f.title));

  const scoreDelta = scanB.healthScore - scanA.healthScore;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.6)",
      backdropFilter: "blur(3px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 100,
      padding: "20px"
    }}>
      <div style={{
        width: "100%",
        maxWidth: "680px",
        maxHeight: "88vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-elevated)",
        overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "14px", color: "var(--ink)" }}>
            <GitCompare size={16} color="var(--accent-primary)" />
            <span>Compare Diagnostic Scans</span>
          </div>
          <button type="button" onClick={onClose} style={{ color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "20px", overflowY: "auto" }}>
          {/* Scan Dropdown Selectors */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            background: "var(--bg-surface)",
            padding: "12px 16px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-subtle)",
            marginBottom: "16px"
          }}>
            {/* Scan A Selector */}
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: "4px" }}>
                BASELINE (BEFORE):
              </label>
              <select
                value={scanA.jobId}
                onChange={(e) => setScanAId(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--bg-card)",
                  color: "var(--ink)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-xs)",
                  padding: "6px 8px",
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                  outline: "none"
                }}
              >
                {urlScans.map((s, idx) => (
                  <option key={s.jobId} value={s.jobId}>
                    Run #{idx + 1} — {s.healthScore}/100 ({new Date(s.startedAt).toLocaleTimeString()})
                  </option>
                ))}
              </select>
            </div>

            <ArrowRight size={16} color="var(--text-muted)" style={{ marginTop: "16px" }} />

            {/* Scan B Selector */}
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: "4px" }}>
                COMPARISON (AFTER):
              </label>
              <select
                value={scanB.jobId}
                onChange={(e) => setScanBId(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--bg-card)",
                  color: "var(--ink)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-xs)",
                  padding: "6px 8px",
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                  outline: "none"
                }}
              >
                {urlScans.map((s, idx) => (
                  <option key={s.jobId} value={s.jobId}>
                    Run #{idx + 1} — {s.healthScore}/100 ({new Date(s.startedAt).toLocaleTimeString()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Delta Banner */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            background: scoreDelta > 0 ? "var(--color-pass-bg)" : scoreDelta < 0 ? "var(--color-critical-bg)" : "var(--bg-surface)",
            border: `1px solid ${scoreDelta > 0 ? "var(--color-pass-border)" : scoreDelta < 0 ? "var(--color-critical-border)" : "var(--border-subtle)"}`,
            marginBottom: "18px",
            fontSize: "13px"
          }}>
            <div>
              Score Delta: <strong style={{ color: scoreDelta >= 0 ? "var(--color-pass-text)" : "var(--color-critical-text)" }}>
                {scanA.healthScore} → {scanB.healthScore} ({scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta} pts)
              </strong>
            </div>
            <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
              {fixedFindings.length} fixed · {newFindings.length} new · {persistentFindings.length} persistent
            </div>
          </div>

          {/* Diff Breakdown Sections */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Fixed Issues */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                <CheckCircle2 size={14} color="var(--color-pass)" />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-pass-text)" }}>
                  Resolved / Fixed ({fixedFindings.length})
                </span>
              </div>
              {fixedFindings.length === 0 ? (
                <div style={{ fontSize: "12px", color: "var(--text-muted)", paddingLeft: "20px" }}>
                  No issues resolved between these scans.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {fixedFindings.map((f, i) => (
                    <div key={i} style={{
                      fontSize: "12px",
                      padding: "6px 10px",
                      borderRadius: "var(--radius-xs)",
                      background: "var(--color-pass-bg)",
                      border: "1px solid var(--color-pass-border)",
                      color: "var(--color-pass-text)"
                    }}>
                      ✓ [FIXED] {f.title} ({f.category})
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* New Regressions */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                <AlertCircle size={14} color="var(--color-critical)" />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-critical-text)" }}>
                  New Regressions ({newFindings.length})
                </span>
              </div>
              {newFindings.length === 0 ? (
                <div style={{ fontSize: "12px", color: "var(--text-muted)", paddingLeft: "20px" }}>
                  No new regressions detected.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {newFindings.map((f, i) => (
                    <div key={i} style={{
                      fontSize: "12px",
                      padding: "6px 10px",
                      borderRadius: "var(--radius-xs)",
                      background: "var(--color-critical-bg)",
                      border: "1px solid var(--color-critical-border)",
                      color: "var(--color-critical-text)"
                    }}>
                      + [NEW] {f.title} ({f.category})
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Persistent Issues */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                <AlertTriangle size={14} color="var(--color-warning)" />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-warning-text)" }}>
                  Persistent Issues ({persistentFindings.length})
                </span>
              </div>
              {persistentFindings.length === 0 ? (
                <div style={{ fontSize: "12px", color: "var(--text-muted)", paddingLeft: "20px" }}>
                  Zero persistent issues.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {persistentFindings.map((f, i) => (
                    <div key={i} style={{
                      fontSize: "12px",
                      padding: "6px 10px",
                      borderRadius: "var(--radius-xs)",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-secondary)"
                    }}>
                      • {f.title} ({f.category})
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
