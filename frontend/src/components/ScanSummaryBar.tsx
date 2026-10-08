import React, { useState } from "react";
import { RotateCw, Download, GitCompare, Clock, Globe } from "lucide-react";
import { useScanStore } from "../store/scanStore.js";

interface ScanSummaryBarProps {
  onOpenCompareModal: () => void;
}

export const ScanSummaryBar: React.FC<ScanSummaryBarProps> = ({ onOpenCompareModal }) => {
  const { currentScan, scanStatus, startScan, history } = useScanStore();
  const [showExportMenu, setShowExportMenu] = useState(false);

  if (scanStatus !== "completed" || !currentScan) return null;

  const { critical, warning, info } = currentScan.summaryCounts;

  const urlHistoryCount = history.filter(s => {
    try {
      return new URL(s.targetUrl).origin === new URL(currentScan.targetUrl).origin;
    } catch {
      return s.targetUrl === currentScan.targetUrl;
    }
  }).length;

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
    md += `**Scan Date:** ${currentScan.completedAt || new Date().toISOString()}\n`;
    md += `**Scan Completeness:** \`${currentScan.scanCompleteness ? currentScan.scanCompleteness.toUpperCase() : "FULL"}\`\n`;
    if (currentScan.completenessNotice) {
      md += `> ⚠️ **Notice:** ${currentScan.completenessNotice}\n\n`;
    }
    md += `**Health Score:** ${currentScan.healthScore} / 100\n`;
    md += `**Formula:** \`${currentScan.scoreFormula}\`\n\n`;
    md += `## Summary Counts\n`;
    md += `- Critical Issues: ${critical}\n`;
    md += `- Warnings: ${warning}\n`;
    md += `- Info Notices: ${info}\n\n`;
    md += `## Diagnostic Findings (${currentScan.findings.length})\n\n`;

    for (const f of currentScan.findings) {
      md += `### [${f.severity.toUpperCase()}] [${f.category}] ${f.title}\n`;
      md += `**Plain-English Cause:** ${f.plainEnglishCause}\n\n`;
      if (f.technicalDetails) md += `**Evidence:** \`${f.technicalDetails}\`\n\n`;
      if (f.elementSelector) md += `**Element:** \`${f.elementSelector}\`\n\n`;
      if (f.fixSteps && f.fixSteps.length > 0) {
        md += `**Actionable Fix Steps:**\n`;
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

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border-card)",
      borderRadius: "var(--radius-xs)",
      padding: "0.5rem 0.85rem",
      marginBottom: "1rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: "0.75rem",
      boxShadow: "0 2px 6px rgba(0,0,0,0.5)"
    }}>
      {/* Target Telemetry */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <Globe size={15} color="var(--accent-cyan)" />
          <span className="mono" style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {currentScan.targetUrl}
          </span>
        </div>

        {/* Counts */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <span className="tag-tech tag-critical">{critical} CRITICAL</span>
          <span className="tag-tech tag-warning">{warning} WARNINGS</span>
          <span className="tag-tech tag-info">{info} NOTICES</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          <Clock size={12} />
          <span>{currentScan.durationMs ? `${(currentScan.durationMs / 1000).toFixed(2)}s` : "N/A"}</span>
        </div>

        <span className="tag-tech tag-neutral" style={{ fontSize: "0.675rem" }}>
          MODE: {currentScan.scanType.toUpperCase()}
        </span>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        {/* Re-Scan Button */}
        <button
          type="button"
          onClick={handleReScan}
          className="tag-tech tag-warning"
          style={{ cursor: "pointer", padding: "0.3rem 0.6rem" }}
          title="Re-run scan against this exact URL"
        >
          <RotateCw size={12} />
          <span>RE-SCAN</span>
        </button>

        {/* Compare Scans Button */}
        {urlHistoryCount >= 2 && (
          <button
            type="button"
            onClick={onOpenCompareModal}
            className="tag-tech tag-info"
            style={{ cursor: "pointer", padding: "0.3rem 0.6rem" }}
            title="Diff against previous scans of this URL"
          >
            <GitCompare size={12} />
            <span>COMPARE_SCANS ({urlHistoryCount})</span>
          </button>
        )}

        {/* Export Report Menu */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="tag-tech tag-neutral"
            style={{ cursor: "pointer", padding: "0.3rem 0.6rem" }}
            title="Download full findings report"
          >
            <Download size={12} />
            <span>EXPORT_REPORT</span>
          </button>

          {showExportMenu && (
            <div style={{
              position: "absolute",
              top: "100%",
              right: 0,
              marginTop: "0.35rem",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-card)",
              borderRadius: "var(--radius-xs)",
              padding: "0.35rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.2rem",
              minWidth: "150px",
              zIndex: 60
            }}>
              <button
                type="button"
                onClick={handleExportJson}
                className="mono"
                style={{
                  textAlign: "left",
                  padding: "0.35rem 0.5rem",
                  fontSize: "0.75rem",
                  color: "var(--text-primary)",
                  borderRadius: "var(--radius-xs)",
                  background: "transparent"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                📄 Download JSON (.json)
              </button>

              <button
                type="button"
                onClick={handleExportMarkdown}
                className="mono"
                style={{
                  textAlign: "left",
                  padding: "0.35rem 0.5rem",
                  fontSize: "0.75rem",
                  color: "var(--text-primary)",
                  borderRadius: "var(--radius-xs)",
                  background: "transparent"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                📝 Download Markdown (.md)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
