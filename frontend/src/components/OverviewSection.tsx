import React, { useState } from "react";
import { HelpCircle, Download, RotateCw, GitCompare } from "lucide-react";
import { useScanStore } from "../store/scanStore.js";

interface OverviewSectionProps {
  onOpenCompareModal: () => void;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({ onOpenCompareModal }) => {
  const { currentScan, history, startScan, loadScanResult } = useScanStore();
  const [showFormulaTooltip, setShowFormulaTooltip] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  if (!currentScan) return null;

  const score = currentScan.healthScore;
  const scoreColor = score >= 90 ? "var(--color-pass)" : score >= 70 ? "var(--color-warning)" : "var(--color-critical)";
  const { critical, warning, info } = currentScan.summaryCounts;

  // Filter history for current target
  const urlHistory = history.filter(s => {
    try {
      const u1 = new URL(s.targetUrl).origin;
      const u2 = new URL(currentScan.targetUrl).origin;
      return u1.toLowerCase() === u2.toLowerCase();
    } catch {
      return s.targetUrl.toLowerCase() === currentScan.targetUrl.toLowerCase();
    }
  });

  const handleReScan = () => {
    startScan({
      url: currentScan.targetUrl,
      type: currentScan.scanType,
      consent: true
    });
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentScan, null, 2));
    const a = document.createElement("a");
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `sitedoctor-report-${new URL(currentScan.targetUrl).hostname}-${Date.now()}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setShowExportMenu(false);
  };

  const handleExportMarkdown = () => {
    let md = `# SiteDoctor Diagnostic Report\n\n`;
    md += `**Target URL:** ${currentScan.targetUrl}\n`;
    md += `**Health Score:** ${currentScan.healthScore} / 100\n`;
    md += `**Formula:** \`${currentScan.scoreFormula}\`\n\n`;
    md += `## Summary Counts\n`;
    md += `- Critical: ${critical}\n`;
    md += `- Warnings: ${warning}\n`;
    md += `- Info: ${info}\n\n`;
    md += `## Findings (${currentScan.findings.length})\n\n`;
    for (const f of currentScan.findings) {
      md += `### [${f.severity.toUpperCase()}] ${f.title}\n`;
      md += `**Category:** ${f.category}\n`;
      md += `**Cause:** ${f.plainEnglishCause}\n`;
      if (f.technicalDetails) md += `**Details:** \`${f.technicalDetails}\`\n`;
      if (f.fixSteps && f.fixSteps.length > 0) {
        md += `\n**Fix Steps:**\n`;
        for (const st of f.fixSteps) {
          md += `${st.step}. ${st.instruction}\n`;
          if (st.codeSnippet) {
            md += `\`\`\`${st.technology || "js"}\n${st.codeSnippet}\n\`\`\`\n`;
          }
        }
      }
      md += `\n---\n\n`;
    }
    const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(md);
    const a = document.createElement("a");
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `sitedoctor-report-${new URL(currentScan.targetUrl).hostname}-${Date.now()}.md`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setShowExportMenu(false);
  };

  // Human-readable summary copy
  let dynamicSummary = "A well-optimized deployment with robust security headers and good Core Web Vitals.";
  if (critical > 0) {
    dynamicSummary = `Found ${critical} critical issue${critical === 1 ? "" : "s"} requiring immediate attention, primarily in ${currentScan.findings.find(f => f.severity === "critical")?.category || "system"} architecture.`;
  } else if (warning > 0) {
    dynamicSummary = `A solid baseline with ${warning} recommended improvement${warning === 1 ? "" : "s"} across security headers, image optimization, or accessibility contrast.`;
  }

  // Top issues (max 4)
  const topIssues = currentScan.findings.slice(0, 4);

  return (
    <section className="section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
        <div className="section-label">Overview & Diagnostics Summary</div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={handleReScan}
            className="navbtn"
            style={{ padding: "6px 12px", fontSize: "11px", background: "var(--bg-surface)", color: "var(--ink)", border: "1px solid var(--border-card)" }}
            title="Re-run diagnosis on this target"
          >
            <RotateCw size={12} />
            <span>Re-Scan</span>
          </button>

          {urlHistory.length >= 2 && (
            <button
              type="button"
              onClick={onOpenCompareModal}
              className="navbtn"
              style={{ padding: "6px 12px", fontSize: "11px", background: "var(--bg-surface)", color: "var(--ink)", border: "1px solid var(--border-card)" }}
              title="Compare with previous scan runs"
            >
              <GitCompare size={12} />
              <span>Compare ({urlHistory.length})</span>
            </button>
          )}

          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="navbtn"
              style={{ padding: "6px 12px", fontSize: "11px" }}
              title="Export diagnostic report"
            >
              <Download size={12} />
              <span>Export</span>
            </button>

            {showExportMenu && (
              <div style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "6px",
                background: "var(--bg-card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-sm)",
                padding: "6px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                minWidth: "160px",
                boxShadow: "var(--shadow-elevated)",
                zIndex: 60
              }}>
                <button
                  type="button"
                  onClick={handleExportJson}
                  style={{
                    textAlign: "left",
                    padding: "6px 10px",
                    fontSize: "12px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--ink)",
                    borderRadius: "var(--radius-xs)"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  📄 Export JSON (.json)
                </button>
                <button
                  type="button"
                  onClick={handleExportMarkdown}
                  style={{
                    textAlign: "left",
                    padding: "6px 10px",
                    fontSize: "12px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--ink)",
                    borderRadius: "var(--radius-xs)"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  📝 Export Markdown (.md)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overview-grid">
        {/* Score Card */}
        <div className="score-card fade" style={currentScan.scanCompleteness && currentScan.scanCompleteness !== "full" ? { border: "2px dashed var(--color-warning)", background: "rgba(234, 179, 8, 0.04)" } : undefined}>
          <div>
            {currentScan.scanCompleteness && currentScan.scanCompleteness !== "full" && (
              <div style={{ font: "10px var(--font-mono)", color: "var(--color-warning)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
                ▲ PROVISIONAL (PARTIAL AUDIT — NON-COMPARABLE)
              </div>
            )}
            <div className="score-big" style={{ color: currentScan.scanCompleteness && currentScan.scanCompleteness !== "full" ? "var(--color-warning)" : scoreColor }}>
              {score}
              <small>{currentScan.scanCompleteness && currentScan.scanCompleteness !== "full" ? " (PROVISIONAL)" : "/100"}</small>
            </div>
            <div className="score-copy">{dynamicSummary}</div>

            {/* Formula breakdown button */}
            <div style={{ marginTop: "14px", position: "relative" }}>
              <button
                type="button"
                onMouseEnter={() => setShowFormulaTooltip(true)}
                onMouseLeave={() => setShowFormulaTooltip(false)}
                onClick={() => setShowFormulaTooltip(!showFormulaTooltip)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                  padding: 0
                }}
              >
                <HelpCircle size={12} />
                <span style={{ textDecoration: "underline" }}>View weighted scoring formula</span>
              </button>

              {showFormulaTooltip && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  marginTop: "8px",
                  width: "360px",
                  padding: "14px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-card)",
                  border: "1px solid var(--line)",
                  fontSize: "12px",
                  zIndex: 50,
                  boxShadow: "var(--shadow-elevated)"
                }}>
                  <div style={{ font: "10px var(--font-mono)", color: "var(--accent-primary)", textTransform: "uppercase", marginBottom: "6px", fontWeight: 700 }}>
                    FORMULA BREAKDOWN:
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", background: "var(--bg-surface)", padding: "6px 10px", borderRadius: "var(--radius-xs)", marginBottom: "8px", fontSize: "11px" }}>
                    Score = 100 - (critical × 15) - (warning × 5) - (info × 1)
                  </div>
                  <div style={{ font: "11px var(--font-mono)", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "3px" }}>
                    <div>• {critical} Critical (-{critical * 15} pts)</div>
                    <div>• {warning} Warnings (-{warning * 5} pts)</div>
                    <div>• {info} Notices (-{info * 1} pts)</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Historical Trend Bars */}
          <div className="chart-container">
            <div className="chart-header">
              <span>HEALTH · RECENT SCANS</span>
              <span>{urlHistory.length} RUNS</span>
            </div>

            <div className="line-chart-bars">
              {urlHistory.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", font: "10px var(--font-mono)", color: "var(--text-muted)" }}>
                  Single baseline run
                </div>
              ) : (
                urlHistory.slice(-8).map((sc) => {
                  const isCurrent = sc.jobId === currentScan.jobId;
                  const barHeight = Math.max(15, sc.healthScore);
                  return (
                    <div
                      key={sc.jobId}
                      className={`chart-bar ${isCurrent ? "active" : ""}`}
                      style={{ height: `${barHeight}%` }}
                      onClick={() => loadScanResult(sc)}
                      title={`${sc.healthScore}/100 at ${new Date(sc.startedAt).toLocaleTimeString()}`}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Recommended Fixes / Issues Card */}
        <div className="issues-card fade delay">
          <div className="card-title">
            <span>Recommended fixes</span>
            <span style={{ font: "10px var(--font-mono)", color: "var(--text-muted)" }}>
              {topIssues.length.toString().padStart(2, "0")}
            </span>
          </div>

          {topIssues.length === 0 ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--color-pass)", font: "12px var(--font-mono)" }}>
              ✓ All automated diagnostic checks passed.
            </div>
          ) : (
            topIssues.map((issue) => {
              const iconType = issue.severity === "critical" ? "!" : issue.category === "seo" ? "⌕" : issue.severity === "pass" ? "✓" : "!";
              const iconClass = issue.severity === "critical" ? "critical" : issue.severity === "pass" ? "pass" : "warning";
              const pillClass = issue.severity === "critical" ? "pill critical" : issue.category === "seo" ? "pill accent" : "pill warning";

              return (
                <div key={issue.id} className="issue-row">
                  <div className="issue-left">
                    <i className={`issue-icon ${iconClass}`}>{iconType}</i>
                    <span className="issue-title-text" title={issue.title}>
                      {issue.title}
                    </span>
                  </div>
                  <span className={pillClass}>
                    {issue.category.toUpperCase()}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};
