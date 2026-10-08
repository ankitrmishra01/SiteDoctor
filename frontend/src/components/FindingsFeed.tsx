import React, { useState, useEffect } from "react";
import { 
  Search, 
  ChevronDown, 
  ChevronUp, 
  ChevronsUpDown, 
  Shield, 
  Zap, 
  Eye, 
  Globe, 
  Server, 
  Layout,
  Calendar,
  Layers,
  SlidersHorizontal
} from "lucide-react";
import { useScanStore } from "../store/scanStore.js";
import { FindingCard } from "./FindingCard.js";
import { Category, Severity, Finding } from "../types.js";

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  security: { label: "Security & TLS Headers", icon: <Shield size={14} />, color: "var(--color-critical)" },
  performance: { label: "Performance & Core Web Vitals", icon: <Zap size={14} />, color: "var(--color-warning)" },
  accessibility: { label: "Accessibility (WCAG 2.1 AA)", icon: <Eye size={14} />, color: "#8b5cf6" },
  frontend: { label: "Frontend & Runtime DOM", icon: <Layout size={14} />, color: "#0ea5e9" },
  backend: { label: "Backend APIs & Infrastructure", icon: <Server size={14} />, color: "var(--color-pass)" },
  seo: { label: "SEO & Crawler Directives", icon: <Globe size={14} />, color: "var(--accent-primary)" }
};

interface FindingsFeedProps {
  onOpenGitHubModal?: () => void;
}

export const FindingsFeed: React.FC<FindingsFeedProps> = ({ onOpenGitHubModal }) => {
  const { 
    currentScan, 
    liveFindings, 
    scanStatus, 
    selectedCategory, 
    setSelectedCategory, 
    selectedSeverity, 
    setSelectedSeverity,
    selectedPriority,
    setSelectedPriority,
    searchFilter, 
    setSearchFilter 
  } = useScanStore();

  const findings = currentScan?.findings || liveFindings;

  // Track expanded/collapsed state per category
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // When new scan or category filter changes, auto-expand categories with critical issues or single selected category
  useEffect(() => {
    const initialExpanded: Record<string, boolean> = {};
    const categories: Category[] = ["security", "performance", "accessibility", "frontend", "backend", "seo"];

    for (const cat of categories) {
      const catFindings = findings.filter(f => f.category === cat);
      const hasCritical = catFindings.some(f => f.severity === "critical");
      initialExpanded[cat] = hasCritical || selectedCategory === cat || findings.length <= 4;
    }
    setExpandedCategories(initialExpanded);
  }, [findings, selectedCategory]);

  if (findings.length === 0 && scanStatus !== "running") return null;

  // Calculate priority bucket counts across all findings
  const priorityCounts = {
    all: findings.length,
    quick_win: findings.filter(f => (f.priorityBucket || "nice_to_have") === "quick_win").length,
    plan_next: findings.filter(f => (f.priorityBucket || "nice_to_have") === "plan_next").length,
    nice_to_have: findings.filter(f => (f.priorityBucket || "nice_to_have") === "nice_to_have").length
  };

  // Calculate category counts
  const categoryCounts: Record<string, number> = { all: findings.length };
  for (const f of findings) {
    categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1;
  }

  // Filter findings based on category, severity, priority bucket, and search term
  const filteredFindings = findings.filter((f) => {
    if (selectedCategory !== "all" && f.category !== selectedCategory) return false;
    if (selectedSeverity !== "all" && f.severity !== selectedSeverity) return false;
    if (selectedPriority !== "all" && (f.priorityBucket || "nice_to_have") !== selectedPriority) return false;

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const matchTitle = f.title.toLowerCase().includes(q);
      const matchCause = f.plainEnglishCause.toLowerCase().includes(q);
      const matchDetails = f.technicalDetails?.toLowerCase().includes(q) || false;
      const matchRule = f.ruleId.toLowerCase().includes(q);
      if (!matchTitle && !matchCause && !matchDetails && !matchRule) return false;
    }

    return true;
  });

  const categoriesOrder: Category[] = ["security", "performance", "accessibility", "frontend", "backend", "seo"];
  const severitiesOrder: Record<Severity, number> = {
    critical: 1,
    warning: 2,
    info: 3,
    pass: 4
  };

  // Group filtered findings by category
  const groupedFindings: Record<string, Finding[]> = {};
  for (const f of filteredFindings) {
    const cat = f.category || "frontend";
    if (!groupedFindings[cat]) groupedFindings[cat] = [];
    groupedFindings[cat].push(f);
  }

  // Sort findings inside each group by severity
  for (const cat in groupedFindings) {
    groupedFindings[cat].sort((a, b) => {
      const rankA = severitiesOrder[a.severity] || 99;
      const rankB = severitiesOrder[b.severity] || 99;
      return rankA - rankB;
    });
  }

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleExpandAll = () => {
    const allExp: Record<string, boolean> = {};
    categoriesOrder.forEach(c => (allExp[c] = true));
    setExpandedCategories(allExp);
  };

  const handleCollapseAll = () => {
    const allCol: Record<string, boolean> = {};
    categoriesOrder.forEach(c => (allCol[c] = false));
    setExpandedCategories(allCol);
  };

  const allExpanded = categoriesOrder.every(c => expandedCategories[c] || !groupedFindings[c]);

  return (
    <section className="section" style={{ paddingBottom: "80px" }}>
      {/* Section Header with Search & Filters */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="section-label" style={{ margin: 0 }}>
            Diagnostic Findings ({filteredFindings.length} / {findings.length})
          </div>
          <button
            type="button"
            onClick={allExpanded ? handleCollapseAll : handleExpandAll}
            className="pill"
            style={{ fontSize: "10px", padding: "4px 8px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
            title={allExpanded ? "Collapse all category groups" : "Expand all category groups"}
          >
            <ChevronsUpDown size={11} />
            <span>{allExpanded ? "Collapse All" : "Expand All"}</span>
          </button>
        </div>

        {/* Search & Severity Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            background: "var(--bg-card)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-sm)",
            padding: "4px 10px",
            boxShadow: "var(--shadow-sm)"
          }}>
            <Search size={13} color="var(--text-muted)" style={{ marginRight: "6px" }} />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter by title / rule..."
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--ink)",
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                width: "150px"
              }}
            />
          </div>

          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value as any)}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-sm)",
              padding: "5px 10px",
              color: "var(--ink)",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
              outline: "none",
              cursor: "pointer"
            }}
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical Only</option>
            <option value="warning">Warnings Only</option>
            <option value="info">Info / Notices</option>
          </select>
        </div>
      </div>

      {/* PRIORITY VIEW FILTER BAR (Impact vs. Effort Classification) */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "10px",
        padding: "10px 14px",
        background: "var(--bg-card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-md)",
        marginBottom: "14px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: "4px" }}>
            <SlidersHorizontal size={12} />
            <span>FIX PRIORITY:</span>
          </span>

          <button
            type="button"
            onClick={() => setSelectedPriority("all")}
            className={`pill ${selectedPriority === "all" ? "accent" : ""}`}
            style={{ cursor: "pointer", padding: "4px 10px", fontSize: "11px" }}
          >
            <span>ALL ({priorityCounts.all})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPriority("quick_win")}
            className="pill"
            style={{
              cursor: "pointer",
              padding: "4px 10px",
              fontSize: "11px",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              background: selectedPriority === "quick_win" ? "var(--accent-primary-bg)" : undefined,
              borderColor: selectedPriority === "quick_win" ? "var(--accent-primary)" : undefined,
              color: selectedPriority === "quick_win" ? "var(--accent-primary)" : undefined,
              fontWeight: selectedPriority === "quick_win" ? 600 : undefined
            }}
            title="High or Critical severity issues that require Low effort"
          >
            <Zap size={11} color="var(--accent-primary)" />
            <span>⚡ QUICK WINS ({priorityCounts.quick_win})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPriority("plan_next")}
            className="pill"
            style={{
              cursor: "pointer",
              padding: "4px 10px",
              fontSize: "11px",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              background: selectedPriority === "plan_next" ? "rgba(14, 165, 233, 0.12)" : undefined,
              borderColor: selectedPriority === "plan_next" ? "#0ea5e9" : undefined,
              color: selectedPriority === "plan_next" ? "#0ea5e9" : undefined,
              fontWeight: selectedPriority === "plan_next" ? 600 : undefined
            }}
            title="High or Critical severity issues requiring Medium or High structural effort"
          >
            <Calendar size={11} color="#0ea5e9" />
            <span>📋 PLAN NEXT ({priorityCounts.plan_next})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPriority("nice_to_have")}
            className="pill"
            style={{
              cursor: "pointer",
              padding: "4px 10px",
              fontSize: "11px",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              background: selectedPriority === "nice_to_have" ? "var(--bg-surface)" : undefined,
              borderColor: selectedPriority === "nice_to_have" ? "var(--text-muted)" : undefined,
              color: selectedPriority === "nice_to_have" ? "var(--ink)" : undefined,
              fontWeight: selectedPriority === "nice_to_have" ? 600 : undefined
            }}
            title="Low severity or informational items"
          >
            <Layers size={11} />
            <span>💡 NICE TO HAVE ({priorityCounts.nice_to_have})</span>
          </button>
        </div>

        {selectedPriority !== "all" && (
          <button
            type="button"
            onClick={() => setSelectedPriority("all")}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              fontSize: "11px",
              cursor: "pointer",
              textDecoration: "underline"
            }}
          >
            Clear priority filter
          </button>
        )}
      </div>

      {/* Category Filter Tabs */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        overflowX: "auto",
        paddingBottom: "10px",
        marginBottom: "18px",
        borderBottom: "1px solid var(--line)"
      }}>
        <button
          type="button"
          onClick={() => setSelectedCategory("all")}
          className={`pill ${selectedCategory === "all" ? "accent" : ""}`}
          style={{ cursor: "pointer", padding: "6px 12px", fontSize: "11px" }}
        >
          <span>ALL CATEGORIES</span>
          <span style={{ opacity: 0.75, marginLeft: "4px" }}>({categoryCounts["all"] || 0})</span>
        </button>

        {categoriesOrder.map((cat) => {
          const isSelected = selectedCategory === cat;
          const count = categoryCounts[cat] || 0;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`pill ${isSelected ? "accent" : ""}`}
              style={{ cursor: "pointer", padding: "6px 12px", fontSize: "11px" }}
            >
              <span>{cat.toUpperCase()}</span>
              <span style={{ opacity: 0.75, marginLeft: "4px" }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Grouped Findings Feed */}
      <div>
        {filteredFindings.length === 0 ? (
          <div style={{
            padding: "36px 20px",
            textAlign: "center",
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--line)"
          }}>
            No diagnostic findings matched your current filter criteria.
          </div>
        ) : (
          categoriesOrder.map((cat) => {
            const catFindings = groupedFindings[cat];
            if (!catFindings || catFindings.length === 0) return null;

            const meta = CATEGORY_META[cat] || { label: cat.toUpperCase(), icon: <Layout size={14} />, color: "var(--accent-primary)" };
            const isExpanded = expandedCategories[cat] ?? true;

            const critCount = catFindings.filter(f => f.severity === "critical").length;
            const warnCount = catFindings.filter(f => f.severity === "warning").length;
            const infoCount = catFindings.filter(f => f.severity === "info").length;

            return (
              <div
                key={cat}
                style={{
                  marginBottom: "16px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-lg)",
                  overflow: "hidden",
                  boxShadow: "var(--shadow-sm)"
                }}
              >
                {/* Category Header Row (Collapsible Accordion Trigger) */}
                <button
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 18px",
                    background: isExpanded ? "var(--bg-surface)" : "var(--bg-card)",
                    borderBottom: isExpanded ? "1px solid var(--line)" : "none",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "var(--ink)",
                    transition: "background var(--transition-fast)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ color: meta.color, display: "flex", alignItems: "center" }}>
                      {meta.icon}
                    </span>
                    <strong style={{ fontSize: "13px", fontWeight: 600, letterSpacing: "-0.01em" }}>
                      {meta.label}
                    </strong>
                    <span style={{ font: "11px var(--font-mono)", color: "var(--text-muted)" }}>
                      ({catFindings.length})
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {critCount > 0 && (
                      <span className="pill critical" style={{ fontSize: "10px", padding: "2px 7px" }}>
                        {critCount} CRITICAL
                      </span>
                    )}
                    {warnCount > 0 && (
                      <span className="pill warning" style={{ fontSize: "10px", padding: "2px 7px" }}>
                        {warnCount} WARN
                      </span>
                    )}
                    {infoCount > 0 && (
                      <span className="pill" style={{ fontSize: "10px", padding: "2px 7px" }}>
                        {infoCount} INFO
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                  </div>
                </button>

                {/* Category Findings Body */}
                {isExpanded && (
                  <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {catFindings.map((finding) => (
                      <FindingCard 
                        key={finding.id} 
                        finding={finding} 
                        onOpenGitHubModal={onOpenGitHubModal}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
