import React from "react";
import { Moon, Sun, Github, ShieldCheck } from "lucide-react";
import { useScanStore } from "../store/scanStore.js";

interface HeaderProps {
  onOpenGitHubModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenGitHubModal }) => {
  const { theme, toggleTheme, socketConnected, githubConnected, githubRepoUrl } = useScanStore();

  return (
    <nav className="fade">
      {/* Logo */}
      <div className="logo">
        <div className="logoIcon">✓</div>
        <span>SiteDoctor</span>
      </div>

      {/* Nav Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {/* Connection status tag */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "11px",
          fontFamily: "var(--font-mono)",
          color: socketConnected ? "var(--color-pass-text)" : "var(--color-warning-text)",
          padding: "4px 8px",
          borderRadius: "var(--radius-xs)",
          background: socketConnected ? "var(--color-pass-bg)" : "var(--color-warning-bg)",
          border: `1px solid ${socketConnected ? "var(--color-pass-border)" : "var(--color-warning-border)"}`
        }}>
          <span style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: socketConnected ? "var(--color-pass)" : "var(--color-warning)"
          }} />
          <span>{socketConnected ? "LIVE SOCKET" : "OFFLINE"}</span>
        </div>

        {/* GitHub Repository Connect Button */}
        <button
          type="button"
          onClick={onOpenGitHubModal}
          className="navbtn"
          title={githubConnected ? `Connected: ${githubRepoUrl}` : "Connect GitHub Repository for exact code/line fixes"}
        >
          <Github size={13} />
          <span>{githubConnected ? "GitHub Connected" : "Connect Repo"}</span>
          {githubConnected && <ShieldCheck size={12} color="var(--color-pass)" />}
        </button>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="theme-toggle-btn"
          title={`Switch to ${theme === "dark" ? "Light ('ops daylight')" : "Dark ('control room')"} theme`}
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </nav>
  );
};
