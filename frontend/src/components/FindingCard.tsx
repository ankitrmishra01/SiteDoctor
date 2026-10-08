import React, { useState } from "react";
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  Github, 
  ShieldCheck, 
  Wrench,
  FileCode,
  Zap,
  Calendar,
  Layers
} from "lucide-react";
import { Finding } from "../types.js";

interface FindingCardProps {
  finding: Finding;
  onOpenGitHubModal?: () => void;
}

export const FindingCard: React.FC<FindingCardProps> = ({ finding, onOpenGitHubModal }) => {
  const [expanded, setExpanded] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedDiff, setCopiedDiff] = useState(false);

  const handleCopy = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyDiff = (diffText: string) => {
    navigator.clipboard.writeText(diffText);
    setCopiedDiff(true);
    setTimeout(() => setCopiedDiff(false), 2000);
  };

  const pillClass = {
    critical: "pill critical",
    warning: "pill warning",
    info: "pill",
    pass: "pill"
  }[finding.severity];

  const severityIcon = {
    critical: <AlertCircle size={12} />,
    warning: <AlertTriangle size={12} />,
    info: <Info size={12} />,
    pass: <CheckCircle2 size={12} />
  }[finding.severity];

  // Priority bucket styling
  const priorityBucket = finding.priorityBucket || "nice_to_have";
  const priorityBadge = {
    quick_win: {
      label: "QUICK WIN",
      icon: <Zap size={11} />,
      style: { background: "rgba(245, 158, 11, 0.12)", color: "var(--accent-primary)", borderColor: "rgba(245, 158, 11, 0.35)" }
    },
    plan_next: {
      label: "PLAN NEXT",
      icon: <Calendar size={11} />,
      style: { background: "rgba(14, 165, 233, 0.12)", color: "#0ea5e9", borderColor: "rgba(14, 165, 233, 0.35)" }
    },
    nice_to_have: {
      label: "NICE TO HAVE",
      icon: <Layers size={11} />,
      style: { background: "var(--bg-surface)", color: "var(--text-muted)", borderColor: "var(--line)" }
    }
  }[priorityBucket];

  // Effort styling
  const effort = finding.effort || "low";
  const effortLabel = {
    low: "LOW EFFORT",
    medium: "MED EFFORT",
    high: "HIGH EFFORT"
  }[effort];

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--line)",
      borderRadius: "var(--radius-lg)",
      marginBottom: "12px",
      boxShadow: "var(--shadow-card)",
      overflow: "hidden",
      transition: "border-color var(--transition-fast), box-shadow var(--transition-fast)"
    }}>
      {/* Card Header Row */}
      <div 
        style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          cursor: "pointer"
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Pills / Tags Row */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
            <span className={pillClass} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              {severityIcon}
              <span>{finding.severity.toUpperCase()}</span>
            </span>

            {/* Priority Bucket Pill */}
            <span 
              className="pill"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontWeight: 600,
                ...priorityBadge.style
              }}
            >
              {priorityBadge.icon}
              <span>{priorityBadge.label}</span>
            </span>

            {/* Effort Level Pill */}
            <span className="pill" style={{ font: "10px var(--font-mono)", color: "var(--text-muted)" }}>
              {effortLabel}
            </span>

            <span className="pill">
              {finding.category.toUpperCase()}
            </span>

            {finding.isVerified ? (
              <span className="pill" style={{ display: "inline-flex", alignItems: "center", gap: "3px", color: "var(--color-pass)" }}>
                <ShieldCheck size={11} />
                <span>VERIFIED</span>
              </span>
            ) : (
              <span className="pill warning">
                <span>AI-ASSIST</span>
              </span>
            )}

            {finding.metricValue && (
              <span style={{
                font: "10px var(--font-mono)",
                fontWeight: 600,
                color: "var(--accent-primary)",
                background: "var(--bg-surface)",
                padding: "2px 6px",
                borderRadius: "var(--radius-xs)"
              }}>
                {finding.metricValue}
              </span>
            )}
          </div>

          {/* Finding Title */}
          <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--ink)", margin: "4px 0", letterSpacing: "-0.01em" }}>
            {finding.title}
          </h3>

          {/* Plain English Root Cause */}
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, margin: "2px 0 0" }}>
            {finding.plainEnglishCause}
          </p>
        </div>

        {/* View / Hide Fix Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="pill"
          style={{
            cursor: "pointer",
            padding: "5px 10px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "11px",
            flexShrink: 0
          }}
        >
          <span>{expanded ? "Hide fix" : "View fix"}</span>
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Expanded Remediation Steps & Code Diffs */}
      {expanded && (
        <div style={{
          padding: "16px 20px",
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-surface)"
        }}>
          {/* Technical Evidence */}
          {finding.technicalDetails && (
            <div style={{
              marginBottom: "12px",
              padding: "8px 12px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              color: "var(--text-muted)",
              wordBreak: "break-all"
            }}>
              <strong style={{ color: "var(--ink)" }}>EVIDENCE: </strong>
              <span>{finding.technicalDetails}</span>
              {finding.elementSelector && (
                <div style={{ marginTop: "4px", color: "var(--accent-primary)" }}>
                  <span>SELECTOR: </span> <code>{finding.elementSelector}</code>
                </div>
              )}
            </div>
          )}

          {/* CODE-AWARE GITHUB FIX SECTION */}
          {finding.githubLocation ? (
            <div style={{
              marginBottom: "14px",
              background: "var(--bg-card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden"
            }}>
              {/* Header Bar */}
              <div style={{
                padding: "10px 14px",
                background: "var(--bg-elevated)",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "8px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontFamily: "var(--font-mono)" }}>
                  <FileCode size={14} color="var(--accent-primary)" />
                  <strong style={{ color: "var(--ink)" }}>{finding.githubLocation.filePath}</strong>
                  <span style={{ color: "var(--text-muted)" }}>: line {finding.githubLocation.lineNumber}</span>
                  <span className="pill" style={{ fontSize: "9px", padding: "1px 5px", color: "var(--color-pass)" }}>
                    {finding.githubLocation.confidence.toUpperCase()} CONFIDENCE
                  </span>
                </div>

                {finding.githubLocation.diff && (
                  <button
                    type="button"
                    onClick={() => handleCopyDiff(finding.githubLocation!.diff!)}
                    style={{
                      cursor: "pointer",
                      padding: "4px 10px",
                      borderRadius: "var(--radius-xs)",
                      background: "var(--accent-primary-bg)",
                      border: "1px solid var(--line)",
                      color: "var(--accent-primary)",
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                    title="Copy unified diff to clipboard"
                  >
                    {copiedDiff ? (
                      <>
                        <Check size={12} color="var(--color-pass)" />
                        <span style={{ color: "var(--color-pass)" }}>DIFF COPIED</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>COPY FIX DIFF</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Code Diff Box */}
              {finding.githubLocation.diff ? (
                <pre style={{
                  margin: 0,
                  padding: "12px 14px",
                  background: "var(--bg-code)",
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                  lineHeight: 1.5,
                  overflowX: "auto",
                  color: "#cbd5e1"
                }}>
                  {finding.githubLocation.diff.split("\n").map((line, lIdx) => {
                    let lineStyle: React.CSSProperties = { color: "#94a3b8" };
                    if (line.startsWith("+")) {
                      lineStyle = { color: "#4ade80", background: "rgba(74, 222, 128, 0.12)", display: "block", margin: "0 -14px", padding: "0 14px" };
                    } else if (line.startsWith("-")) {
                      lineStyle = { color: "#f87171", background: "rgba(248, 113, 113, 0.12)", display: "block", margin: "0 -14px", padding: "0 14px" };
                    } else if (line.startsWith("@@") || line.startsWith("---") || line.startsWith("+++")) {
                      lineStyle = { color: "#38bdf8", fontWeight: 600 };
                    }
                    return (
                      <span key={lIdx} style={lineStyle}>
                        {line}
                        {"\n"}
                      </span>
                    );
                  })}
                </pre>
              ) : finding.githubLocation.snippet ? (
                <pre style={{
                  margin: 0,
                  padding: "10px 14px",
                  background: "var(--bg-code)",
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                  color: "#f1f5f9",
                  overflowX: "auto"
                }}>
                  {finding.githubLocation.snippet}
                </pre>
              ) : null}

              {/* Disclaimer */}
              <div style={{
                padding: "6px 14px",
                background: "var(--bg-surface)",
                borderTop: "1px solid var(--border-subtle)",
                fontSize: "11px",
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)"
              }}>
                ℹ️ {finding.githubLocation.disclaimer}
              </div>
            </div>
          ) : (
            /* Connect GitHub Prompt when repo not connected */
            <div style={{
              marginBottom: "14px",
              padding: "12px 16px",
              background: "var(--bg-card)",
              border: "1px dashed var(--line)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-secondary)", fontSize: "12px" }}>
                <Github size={16} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                <span>Connect GitHub to see real file locations and code-level diffs for this finding.</span>
              </div>

              {onOpenGitHubModal && (
                <button
                  type="button"
                  onClick={onOpenGitHubModal}
                  className="pill accent"
                  style={{
                    cursor: "pointer",
                    fontSize: "11px",
                    padding: "4px 10px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <Github size={12} />
                  <span>Connect GitHub</span>
                </button>
              )}
            </div>
          )}

          {/* Standard Fix Steps & Snippets */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "var(--ink)", marginBottom: "8px" }}>
              <Wrench size={13} color="var(--accent-primary)" />
              <span>Recommended Remediation Steps</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {finding.fixSteps.map((step, idx) => (
                <div key={idx} style={{
                  padding: "10px 14px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--ink)" }}>
                      Step {step.step}: {step.instruction}
                    </span>
                    {step.technology && (
                      <span className="pill" style={{ fontSize: "9px" }}>
                        {step.technology}
                      </span>
                    )}
                  </div>

                  {step.codeSnippet && (
                    <div style={{ position: "relative", marginTop: "6px" }}>
                      <pre style={{
                        padding: "10px 12px",
                        background: "var(--bg-code)",
                        borderRadius: "var(--radius-xs)",
                        fontSize: "12px",
                        fontFamily: "var(--font-mono)",
                        color: "#f1f5f9",
                        overflowX: "auto",
                        lineHeight: 1.45
                      }}>
                        {step.codeSnippet}
                      </pre>

                      <button
                        type="button"
                        onClick={() => handleCopy(step.codeSnippet!, idx)}
                        style={{
                          position: "absolute",
                          top: "6px",
                          right: "6px",
                          cursor: "pointer",
                          padding: "4px 8px",
                          borderRadius: "var(--radius-xs)",
                          background: "rgba(255,255,255,0.15)",
                          color: "#fff",
                          fontSize: "10px",
                          fontFamily: "var(--font-mono)",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                        title="Copy code snippet"
                      >
                        {copiedIndex === idx ? (
                          <>
                            <Check size={11} color="#6ee7b7" />
                            <span style={{ color: "#6ee7b7" }}>COPIED</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            <span>COPY</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
