import React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { TrendingUp, RotateCw, Eye } from "lucide-react";
import { useScanStore } from "../store/scanStore.js";

export const HistoricalTrends: React.FC = () => {
  const { history, currentScan, startScan, loadScanResult } = useScanStore();

  const targetUrl = currentScan?.targetUrl;
  if (!targetUrl) return null;

  // Filter history strictly for the currently active target URL
  const urlHistory = history.filter(s => {
    try {
      const u1 = new URL(s.targetUrl).origin + new URL(s.targetUrl).pathname.replace(/\/+$/, "");
      const u2 = new URL(targetUrl).origin + new URL(targetUrl).pathname.replace(/\/+$/, "");
      return u1.toLowerCase() === u2.toLowerCase();
    } catch {
      return s.targetUrl.toLowerCase() === targetUrl.toLowerCase();
    }
  });

  if (urlHistory.length === 0) return null;

  const chartData = urlHistory.map((scan) => {
    const date = new Date(scan.startedAt);
    const timeLabel = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    const dateLabel = `${date.getMonth() + 1}/${date.getDate()} ${timeLabel}`;

    return {
      name: dateLabel,
      score: scan.healthScore,
      critical: scan.summaryCounts.critical,
      warnings: scan.summaryCounts.warning,
      jobId: scan.jobId
    };
  });

  const handleReScanRun = (scanUrl: string, scanType: any) => {
    startScan({
      url: scanUrl,
      type: scanType || "both",
      consent: true
    });
  };

  return (
    <div className="hud-panel" style={{ marginBottom: "2rem" }}>
      <div className="hud-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <TrendingUp size={14} color="var(--accent-cyan)" />
          <span>HISTORICAL HEALTH TRENDS // TARGET: {targetUrl}</span>
        </div>
        <div className="mono" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
          RUNS_LOGGED: {urlHistory.length}
        </div>
      </div>

      <div style={{ padding: "1.25rem 1.5rem" }}>
        {urlHistory.length === 1 ? (
          <div style={{
            padding: "0.75rem",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-xs)",
            fontSize: "0.775rem",
            fontFamily: "var(--font-mono)",
            color: "var(--text-secondary)"
          }}>
            [TELEMETRY_NOTICE]: Single baseline run recorded for this target. Click <strong>[RE-SCAN]</strong> to record additional data points and populate the trend line.
          </div>
        ) : (
          <div style={{ width: "100%", height: 180, marginBottom: "1rem" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 15, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="var(--border-subtle)" />
                <XAxis 
                  dataKey="name" 
                  stroke="var(--text-muted)" 
                  fontSize={10} 
                  tickLine={false} 
                  fontFamily="JetBrains Mono"
                />
                <YAxis 
                  domain={[0, 100]} 
                  stroke="var(--text-muted)" 
                  fontSize={10} 
                  tickLine={false} 
                  fontFamily="JetBrains Mono"
                />
                <Tooltip 
                  contentStyle={{
                    background: "var(--bg-card)",
                    borderColor: "var(--border-card)",
                    borderRadius: "2px",
                    color: "var(--text-primary)",
                    fontSize: "11px",
                    fontFamily: "JetBrains Mono"
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "JetBrains Mono" }} />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  name="Health Score (/100)" 
                  stroke="var(--accent-cyan)" 
                  strokeWidth={2} 
                  dot={{ r: 3, fill: "var(--accent-cyan)" }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="critical" 
                  name="Critical" 
                  stroke="var(--color-critical)" 
                  strokeWidth={1.5} 
                  dot={{ r: 2, fill: "var(--color-critical)" }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="warnings" 
                  name="Warnings" 
                  stroke="var(--accent-amber)" 
                  strokeWidth={1.5} 
                  dot={{ r: 2, fill: "var(--accent-amber)" }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Historical Scans Table with 1-Click Re-Scan Buttons */}
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.75rem",
            fontFamily: "var(--font-mono)",
            textAlign: "left"
          }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-card)", color: "var(--text-muted)" }}>
                <th style={{ padding: "0.4rem 0.6rem" }}>SCAN_TIMESTAMP</th>
                <th style={{ padding: "0.4rem 0.6rem" }}>HEALTH_SCORE</th>
                <th style={{ padding: "0.4rem 0.6rem" }}>ISSUES (C/W/I)</th>
                <th style={{ padding: "0.4rem 0.6rem" }}>DURATION</th>
                <th style={{ padding: "0.4rem 0.6rem", textAlign: "right" }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {urlHistory.slice(-5).reverse().map((s) => (
                <tr key={s.jobId} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "0.4rem 0.6rem", color: "var(--text-secondary)" }}>
                    {new Date(s.startedAt).toLocaleTimeString()} ({new Date(s.startedAt).toLocaleDateString()})
                  </td>
                  <td style={{ padding: "0.4rem 0.6rem" }}>
                    <strong style={{ color: s.healthScore >= 80 ? "var(--color-pass-text)" : s.healthScore >= 50 ? "var(--accent-amber)" : "var(--color-critical-text)" }}>
                      {s.healthScore}/100
                    </strong>
                  </td>
                  <td style={{ padding: "0.4rem 0.6rem" }}>
                    <span style={{ color: "var(--color-critical-text)" }}>{s.summaryCounts.critical}C</span> /{" "}
                    <span style={{ color: "var(--color-warning-text)" }}>{s.summaryCounts.warning}W</span> /{" "}
                    <span style={{ color: "var(--color-info-text)" }}>{s.summaryCounts.info}I</span>
                  </td>
                  <td style={{ padding: "0.4rem 0.6rem", color: "var(--text-dim)" }}>
                    {s.durationMs ? `${(s.durationMs / 1000).toFixed(2)}s` : "N/A"}
                  </td>
                  <td style={{ padding: "0.4rem 0.6rem", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                      {s.jobId !== currentScan?.jobId && (
                        <button
                          type="button"
                          onClick={() => loadScanResult(s)}
                          className="tag-tech tag-info"
                          style={{ cursor: "pointer", padding: "0.15rem 0.45rem" }}
                          title="View this historical scan report"
                        >
                          <Eye size={10} />
                          <span>VIEW</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleReScanRun(s.targetUrl, s.scanType)}
                        className="tag-tech tag-warning"
                        style={{ cursor: "pointer", padding: "0.15rem 0.45rem" }}
                        title="Re-run scan against this URL"
                      >
                        <RotateCw size={10} />
                        <span>RE-SCAN</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
