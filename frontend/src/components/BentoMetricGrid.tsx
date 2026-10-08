import React from "react";
import { useScanStore } from "../store/scanStore.js";

export const BentoMetricGrid: React.FC = () => {
  const { currentScan } = useScanStore();

  if (!currentScan) return null;

  const raw = currentScan.rawMetrics || {};
  const findings = currentScan.findings || [];

  // Frontend / Core Web Vitals
  const lcp = raw.coreWebVitals?.lcpMs;
  const lcpDisplay = lcp ? `${(lcp / 1000).toFixed(1)}s` : "Good";
  const lcpStatus = !lcp || lcp < 2500 ? "good" : lcp < 4000 ? "warn" : "critical";
  const lcpFoot = lcp ? `LCP ${lcp}ms · TTFB ${raw.coreWebVitals?.ttfbMs || raw.pageLoad?.ttfbMs || 0}ms` : "Fast initial paint";

  // Backend / API Health
  const backendFindings = findings.filter(f => f.category === "backend");
  const apiHealthStatus = backendFindings.some(f => f.ruleId === "API_HEALTH_FAIL") ? "404" : "200";
  const apiFoot = backendFindings.length === 0 ? "All probes healthy" : `${backendFindings.length} endpoint alert${backendFindings.length === 1 ? "" : "s"}`;
  const apiStatusClass = backendFindings.length === 0 ? "good" : "warn";

  // Security & SSL
  const secFindings = findings.filter(f => f.category === "security");
  const sslDays = raw.ssl?.daysRemaining !== undefined ? `${raw.ssl.daysRemaining}d` : "TLS";
  const secFoot = `SSL valid · ${secFindings.length} missing header${secFindings.length === 1 ? "" : "s"}`;
  const secStatusClass = secFindings.length === 0 ? "good" : "warn";

  // Performance & Load
  const p95 = raw.lightLoad?.p95LatencyMs || raw.pageLoad?.loadTimeMs;
  const p95Display = p95 ? `${p95}ms` : "Fast";
  const perfFoot = raw.lightLoad ? `${raw.lightLoad.requestsPerSecond || 0} rps under load` : "Low latency";
  const perfStatusClass = !p95 || p95 < 1500 ? "good" : "warn";

  // Accessibility / WCAG
  const axeViolations = raw.accessibility?.violationsCount !== undefined ? raw.accessibility.violationsCount : findings.filter(f => f.category === "accessibility").length;
  const axeDisplay = axeViolations.toString().padStart(2, "0");
  const axeFoot = axeViolations === 0 ? "Zero WCAG violations" : `${axeViolations} contrast/aria issue${axeViolations === 1 ? "" : "s"}`;
  const axeStatusClass = axeViolations === 0 ? "good" : "warn";

  // SEO & Discovery
  const seoFindings = findings.filter(f => f.category === "seo");
  const seoDisplay = seoFindings.length === 0 ? "100" : `${Math.max(60, 100 - seoFindings.length * 15)}`;
  const seoFoot = seoFindings.length === 0 ? "Sitemap & robots valid" : `${seoFindings.length} metadata opportunity`;
  const seoStatusClass = seoFindings.length === 0 ? "good" : "warn";

  return (
    <div className="bento-grid">
      {/* 1. Core Web Vitals */}
      <div className="metric-card fade">
        <div className="metric-label">Frontend / CWV</div>
        <div className="metric-num">{lcpDisplay}</div>
        <div className={`metric-foot ${lcpStatus}`}>{lcpFoot}</div>
      </div>

      {/* 2. Backend & APIs */}
      <div className="metric-card fade delay">
        <div className="metric-label">Backend / API</div>
        <div className="metric-num">{apiHealthStatus}</div>
        <div className={`metric-foot ${apiStatusClass}`}>{apiFoot}</div>
      </div>

      {/* 3. Security & SSL */}
      <div className="metric-card fade delay">
        <div className="metric-label">Security & SSL</div>
        <div className="metric-num">{sslDays}</div>
        <div className={`metric-foot ${secStatusClass}`}>{secFoot}</div>
      </div>

      {/* 4. Performance */}
      <div className="metric-card fade">
        <div className="metric-label">Performance</div>
        <div className="metric-num">{p95Display}</div>
        <div className={`metric-foot ${perfStatusClass}`}>{perfFoot}</div>
      </div>

      {/* 5. Accessibility */}
      <div className="metric-card fade delay">
        <div className="metric-label">Accessibility</div>
        <div className="metric-num">{axeDisplay}</div>
        <div className={`metric-foot ${axeStatusClass}`}>{axeFoot}</div>
      </div>

      {/* 6. SEO */}
      <div className="metric-card fade delay">
        <div className="metric-label">SEO & Meta</div>
        <div className="metric-num">{seoDisplay}</div>
        <div className={`metric-foot ${seoStatusClass}`}>{seoFoot}</div>
      </div>
    </div>
  );
};
