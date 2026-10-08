import { describe, it, expect } from "vitest";
import { DIAGNOSTIC_RULES } from "../src/diagnostics/rules.js";
import { DiagnosticsEngine } from "../src/diagnostics/engine.js";

describe("Diagnostic Rules & Engine", () => {
  it("should contain verified rules with concrete causes and fix steps", () => {
    expect(DIAGNOSTIC_RULES["CORS_MISSING"]).toBeDefined();
    expect(DIAGNOSTIC_RULES["CORS_MISSING"]?.severity).toBe("critical");
    expect(DIAGNOSTIC_RULES["CORS_MISSING"]?.fixSteps.length).toBeGreaterThan(0);

    expect(DIAGNOSTIC_RULES["SEC_HSTS_MISSING"]).toBeDefined();
    expect(DIAGNOSTIC_RULES["CWV_LCP_POOR"]).toBeDefined();
    expect(DIAGNOSTIC_RULES["AXE_COLOR_CONTRAST"]).toBeDefined();
  });

  it("should map raw finding to verified rule correctly", () => {
    const mapped = DiagnosticsEngine.mapFinding({
      ruleId: "CORS_MISSING",
      category: "backend",
      technicalDetails: "Origin header failed"
    });

    expect(mapped.isVerified).toBe(true);
    expect(mapped.isAiSuggested).toBe(false);
    expect(mapped.severity).toBe("critical");
    expect(mapped.title).toBe("CORS Header Missing on API Endpoint");
  });

  it("should map unmatched finding to AI-suggested / unverified fallback", () => {
    const unmapped = DiagnosticsEngine.mapFinding({
      ruleId: "UNKNOWN_CUSTOM_ERROR",
      category: "frontend",
      title: "Unknown Framework Warning",
      plainEnglishCause: "Custom bundle error"
    });

    expect(unmapped.isVerified).toBe(false);
    expect(unmapped.isAiSuggested).toBe(true);
    expect(unmapped.title).toBe("Unknown Framework Warning");
  });

  it("should accurately compute health score with formula: 100 - (critical*15) - (warning*5) - (info*1)", () => {
    // 0 issues -> 100
    const perfectScore = DiagnosticsEngine.calculateHealthScore([]);
    expect(perfectScore.score).toBe(100);
    expect(perfectScore.summaryCounts.total).toBe(0);

    // 1 critical (-15), 2 warnings (-10), 3 info (-3) = 100 - 28 = 72
    const findings = [
      DiagnosticsEngine.mapFinding({ ruleId: "CORS_MISSING", category: "backend" }), // critical
      DiagnosticsEngine.mapFinding({ ruleId: "SEC_HSTS_MISSING", category: "security" }), // warning
      DiagnosticsEngine.mapFinding({ ruleId: "CWV_TBT_POOR", category: "performance" }), // warning
      DiagnosticsEngine.mapFinding({ ruleId: "SEC_SERVER_HEADER_LEAK", category: "security" }), // info
      DiagnosticsEngine.mapFinding({ ruleId: "SEO_ROBOTS_MISSING", category: "seo" }), // info
      DiagnosticsEngine.mapFinding({ ruleId: "SEO_SITEMAP_MISSING", category: "seo" }) // info
    ];

    const result = DiagnosticsEngine.calculateHealthScore(findings);
    expect(result.score).toBe(72);
    expect(result.summaryCounts.critical).toBe(1);
    expect(result.summaryCounts.warning).toBe(2);
    expect(result.summaryCounts.info).toBe(3);

    // Extreme penalties should clamp at 0
    const severeFindings = Array.from({ length: 10 }).map(() =>
      DiagnosticsEngine.mapFinding({ ruleId: "CORS_MISSING", category: "backend" })
    );
    const clampedResult = DiagnosticsEngine.calculateHealthScore(severeFindings);
    expect(clampedResult.score).toBe(0);
  });
});
