import React, { useState } from "react";
import { Github, X, ShieldCheck, AlertCircle, Lock, Trash2 } from "lucide-react";
import { useScanStore } from "../store/scanStore.js";

interface GitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitHubModal: React.FC<GitHubModalProps> = ({ isOpen, onClose }) => {
  const { sessionId, githubConnected, githubRepoUrl, setGithubSession } = useScanStore();
  
  const [token, setToken] = useState("");
  const [repoUrl, setRepoUrl] = useState(githubRepoUrl || "");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!token.trim()) {
      setErrorMsg("Please enter a GitHub Personal Access Token.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/github/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          repoUrl: repoUrl.trim() || undefined,
          sessionId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to verify token permissions.");
        setLoading(false);
        return;
      }

      setGithubSession(true, repoUrl.trim());
      setSuccessMsg("GitHub connection verified! Read-only token held in volatile memory.");
      setToken("");
      setLoading(false);
    } catch (err: any) {
      setErrorMsg(`Connection error: ${err.message}`);
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch("/api/github/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });
      setGithubSession(false, "");
      setSuccessMsg("GitHub session cleared.");
    } catch {
      setGithubSession(false, "");
    }
  };

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
        maxWidth: "480px",
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
            <Github size={16} color="var(--accent-primary)" />
            <span>Connect GitHub Repository</span>
          </div>
          <button type="button" onClick={onClose} style={{ color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "20px" }}>
          {/* Security Box */}
          <div style={{
            padding: "12px 14px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-sm)",
            fontSize: "12px",
            color: "var(--text-secondary)",
            marginBottom: "16px",
            lineHeight: 1.5
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ink)", fontWeight: 600, marginBottom: "4px" }}>
              <Lock size={13} color="var(--accent-primary)" />
              <span>Volatile Session Memory Only</span>
            </div>
            Your token is held strictly in volatile RAM for the duration of this socket session. Tokens are never written to disk or logs, and write permissions are rejected.
          </div>

          {errorMsg && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "var(--radius-xs)",
              background: "var(--color-critical-bg)",
              border: "1px solid var(--color-critical-border)",
              color: "var(--color-critical-text)",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
              marginBottom: "12px"
            }}>
              <AlertCircle size={14} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "var(--radius-xs)",
              background: "var(--color-pass-bg)",
              border: "1px solid var(--color-pass-border)",
              color: "var(--color-pass-text)",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
              marginBottom: "12px"
            }}>
              <ShieldCheck size={14} />
              <span>{successMsg}</span>
            </div>
          )}

          {githubConnected ? (
            <div>
              <div style={{
                padding: "12px 14px",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                marginBottom: "16px"
              }}>
                <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>CONNECTED REPO:</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent-primary)", marginTop: "4px" }}>
                  {githubRepoUrl || "Global Read-Only Scope"}
                </div>
              </div>

              <button
                type="button"
                onClick={handleDisconnect}
                className="pill critical"
                style={{ width: "100%", justifyContent: "center", padding: "8px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
              >
                <Trash2 size={13} />
                <span>Disconnect & Clear Token</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleConnect}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: "4px" }}>
                  GITHUB PERSONAL ACCESS TOKEN (READ-ONLY):
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="github_pat_11..."
                  style={{
                    width: "100%",
                    background: "var(--bg-card)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-sm)",
                    padding: "8px 12px",
                    color: "var(--ink)",
                    fontSize: "13px",
                    fontFamily: "var(--font-mono)",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: "4px" }}>
                  REPOSITORY URL (OPTIONAL):
                </label>
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/yourname/yourrepo"
                  style={{
                    width: "100%",
                    background: "var(--bg-card)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-sm)",
                    padding: "8px 12px",
                    color: "var(--ink)",
                    fontSize: "13px",
                    fontFamily: "var(--font-mono)",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="pill"
                  style={{ flex: 1, padding: "8px 12px", justifyContent: "center", cursor: "pointer" }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="navbtn"
                  style={{ flex: 2, justifyContent: "center", cursor: loading ? "not-allowed" : "pointer" }}
                >
                  {loading ? "Verifying…" : "Connect Repository"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
