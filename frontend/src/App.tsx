import React, { useEffect, useState } from "react";
import { Header } from "./components/Header.js";
import { HeroScanSection } from "./components/HeroScanSection.js";
import { OverviewSection } from "./components/OverviewSection.js";
import { BentoMetricGrid } from "./components/BentoMetricGrid.js";
import { FindingsFeed } from "./components/FindingsFeed.js";
import { GitHubModal } from "./components/GitHubModal.js";
import { CompareScansModal } from "./components/CompareScansModal.js";
import { OfflineBanner } from "./components/OfflineBanner.js";
import { useScanStore } from "./store/scanStore.js";

export const App: React.FC = () => {
  const { initSocket, fetchHistory } = useScanStore();
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  useEffect(() => {
    initSocket();
    fetchHistory();
  }, [initSocket, fetchHistory]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <OfflineBanner />
      <div className="container">
        <Header onOpenGitHubModal={() => setIsGitHubModalOpen(true)} />

        <main style={{ flex: 1 }}>
          <HeroScanSection />
          <OverviewSection onOpenCompareModal={() => setIsCompareModalOpen(true)} />
          <BentoMetricGrid />
          <FindingsFeed onOpenGitHubModal={() => setIsGitHubModalOpen(true)} />
        </main>

        <footer style={{
          borderTop: "1px solid var(--line)",
          padding: "24px 0 36px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "12px",
          color: "var(--text-muted)",
          fontFamily: "var(--font-mono)",
          marginTop: "auto"
        }}>
          <div>SiteDoctor — Website health, clearly.</div>
          <div>Real-time rule-based diagnostics & automated remediation</div>
        </footer>
      </div>

      <GitHubModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
      />

      <CompareScansModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
      />
    </div>
  );
};

export default App;
