import { DIAGNOSTIC_RULES } from "./rules.js";
import { Finding, Severity, Category, FixStep, DetectedStack, EffortLevel, PriorityBucket } from "./types.js";

export interface RawFindingInput {
  ruleId?: string;
  category: Category;
  severity?: Severity;
  title?: string;
  technicalDetails?: string;
  metricValue?: string | number;
  plainEnglishCause?: string;
  fixSteps?: FixStep[];
  elementSelector?: string;
  wcagRule?: string;
  url?: string;
  isAiSuggested?: boolean;
}

export function determinePriorityBucket(severity: Severity, effort: EffortLevel): PriorityBucket {
  if ((severity === "critical" || severity === "warning") && effort === "low") {
    return "quick_win";
  }
  if ((severity === "critical" || severity === "warning") && (effort === "medium" || effort === "high")) {
    return "plan_next";
  }
  return "nice_to_have";
}

export class DiagnosticsEngine {
  /**
   * Transforms a raw finding into a standardized, stack-aware, rule-verified Finding object.
   * If the rule provides stack-specific remediation variants, selects the exact variant matching
   * detectedStack (e.g. Next.js, Express, Nginx, Apache, FastAPI, Django).
   * If stack is not confidently detected, explicitly marks the finding with a generic fallback disclaimer.
   */
  public static mapFinding(input: RawFindingInput, detectedStack?: DetectedStack): Finding {
    const id = `fnd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    if (input.ruleId && DIAGNOSTIC_RULES[input.ruleId]) {
      const rule = DIAGNOSTIC_RULES[input.ruleId]!;
      const severity = input.severity || rule.severity;
      const effort = rule.effort || "low";
      const priorityBucket = determinePriorityBucket(severity, effort);

      let selectedFixSteps = rule.fixSteps;
      let selectedCodeSnippet = rule.codeSnippet;
      let selectedRepoSearchQuery = rule.repoSearchQuery;
      let matchedTechnology: string | undefined = undefined;
      let isGenericFallback = false;

      // Handle stack-specific fix variant selection
      if (rule.stackVariants && rule.stackVariants.length > 0) {
        if (detectedStack && detectedStack.confidence !== "none") {
          const matchedVariant = rule.stackVariants.find(v => {
            let matches = true;
            let hasAtLeastOneSpecificTarget = false;

            if (v.targetStack.framework) {
              hasAtLeastOneSpecificTarget = true;
              if (!v.targetStack.framework.includes(detectedStack.framework)) matches = false;
            }
            if (v.targetStack.server) {
              hasAtLeastOneSpecificTarget = true;
              if (!v.targetStack.server.includes(detectedStack.server)) matches = false;
            }
            if (v.targetStack.language) {
              hasAtLeastOneSpecificTarget = true;
              if (!v.targetStack.language.includes(detectedStack.language)) matches = false;
            }

            return hasAtLeastOneSpecificTarget && matches;
          });

          if (matchedVariant) {
            selectedFixSteps = matchedVariant.fixSteps;
            selectedCodeSnippet = matchedVariant.codeSnippet || matchedVariant.fixSteps[0]?.codeSnippet;
            selectedRepoSearchQuery = matchedVariant.repoSearchQuery || rule.repoSearchQuery;
            matchedTechnology = matchedVariant.technology;
            isGenericFallback = false;
          } else {
            isGenericFallback = true;
          }
        } else {
          isGenericFallback = true;
        }

        if (isGenericFallback) {
          matchedTechnology = "Generic / Universal";
          let disclaimer = "[Stack not detected — generic web server configuration shown, verify against your actual infrastructure]";
          if (detectedStack && detectedStack.confidence !== "none") {
            if (detectedStack.cdn && detectedStack.server === "unknown") {
              disclaimer = `[Edge CDN (${detectedStack.cdn.toUpperCase()}) detected — configure headers in CDN Edge Transform Rules or on origin web server]`;
            } else if (detectedStack.framework !== "unknown" && detectedStack.server === "unknown") {
              disclaimer = `[Frontend framework (${detectedStack.framework.toUpperCase()}) detected — HTTP response headers must be configured on your origin web server or CDN]`;
            } else if (detectedStack.language !== "unknown" && detectedStack.server === "unknown") {
              disclaimer = `[Runtime (${detectedStack.language}) detected without server header plugin — configure on your web server / reverse proxy]`;
            } else if (detectedStack.server !== "unknown") {
              disclaimer = `[Server (${detectedStack.server.toUpperCase()}) detected without direct rule variant — standard server header configuration shown]`;
            }
          }

          selectedFixSteps = rule.fixSteps.map((step, idx) => {
            if (idx === 0) {
              return {
                ...step,
                instruction: `${disclaimer} ${step.instruction}`
              };
            }
            return step;
          });
        }
      }

      return {
        id,
        ruleId: rule.ruleId,
        category: rule.category,
        severity,
        effort,
        priorityBucket,
        title: rule.title,
        plainEnglishCause: rule.plainEnglishCause,
        technicalDetails: input.technicalDetails,
        metricValue: input.metricValue,
        fixSteps: selectedFixSteps,
        codeSnippet: selectedCodeSnippet,
        repoSearchQuery: selectedRepoSearchQuery,
        elementSelector: input.elementSelector,
        wcagRule: input.wcagRule,
        url: input.url,
        isVerified: true,
        isAiSuggested: false,
        stackContext: rule.stackVariants && rule.stackVariants.length > 0 ? {
          matchedTechnology,
          isGenericFallback,
          detectedStackSummary: detectedStack?.summary || "Stack not detected"
        } : undefined
      };
    }

    const fallbackSeverity = input.severity || "warning";
    const fallbackEffort: EffortLevel = "medium";
    const fallbackBucket = determinePriorityBucket(fallbackSeverity, fallbackEffort);

    // Unmatched rule fallback — explicitly marked as unverified / AI-suggested
    return {
      id,
      ruleId: input.ruleId || "CUSTOM_ANOMALY",
      category: input.category,
      severity: fallbackSeverity,
      effort: fallbackEffort,
      priorityBucket: fallbackBucket,
      title: input.title || "Detected Technical Anomaly",
      plainEnglishCause: input.plainEnglishCause || input.technicalDetails || "An anomaly was detected on this endpoint or page.",
      technicalDetails: input.technicalDetails,
      metricValue: input.metricValue,
      fixSteps: input.fixSteps || [
        {
          step: 1,
          instruction: "Inspect the technical details in server logs and browser network tools to identify the origin.",
          technology: "General"
        }
      ],
      elementSelector: input.elementSelector,
      wcagRule: input.wcagRule,
      url: input.url,
      isVerified: false,
      isAiSuggested: true
    };
  }

  /**
   * Applies stack-specific remediations to all findings in a scan once the stack is detected.
   */
  public static applyStackToFindings(findings: Finding[], detectedStack: DetectedStack): Finding[] {
    return findings.map(f => {
      if (!f.ruleId || !DIAGNOSTIC_RULES[f.ruleId]) return f;
      return this.mapFinding({
        ruleId: f.ruleId,
        category: f.category,
        severity: f.severity,
        title: f.title,
        technicalDetails: f.technicalDetails,
        metricValue: f.metricValue,
        plainEnglishCause: f.plainEnglishCause,
        elementSelector: f.elementSelector,
        wcagRule: f.wcagRule,
        url: f.url,
        isAiSuggested: f.isAiSuggested
      }, detectedStack);
    });
  }

  /**
   * Calculates the calibrated health score with per-category penalty caps.
   * Formula: Score = 100 - sum(min(25, category_penalty))
   * Ensures no single domain (e.g., contrast warnings or missing headers) can clamp a site to 0.
   */
  public static calculateHealthScore(findings: Finding[]): {
    score: number;
    formula: string;
    summaryCounts: {
      critical: number;
      warning: number;
      info: number;
      pass: number;
      total: number;
    };
    categoryBreakdown?: Record<Category, { critical: number; warning: number; info: number; penalty: number; cappedPenalty: number }>;
  } {
    if (!findings || !Array.isArray(findings)) {
      throw new Error("Invalid findings data: calculateHealthScore expects a valid array of Finding objects.");
    }

    let critical = 0;
    let warning = 0;
    let info = 0;
    let pass = 0;

    const categories: Category[] = ["frontend", "backend", "security", "performance", "accessibility", "seo"];
    const categoryMap: Record<Category, { critical: number; warning: number; info: number; penalty: number; cappedPenalty: number }> = {
      frontend: { critical: 0, warning: 0, info: 0, penalty: 0, cappedPenalty: 0 },
      backend: { critical: 0, warning: 0, info: 0, penalty: 0, cappedPenalty: 0 },
      security: { critical: 0, warning: 0, info: 0, penalty: 0, cappedPenalty: 0 },
      performance: { critical: 0, warning: 0, info: 0, penalty: 0, cappedPenalty: 0 },
      accessibility: { critical: 0, warning: 0, info: 0, penalty: 0, cappedPenalty: 0 },
      seo: { critical: 0, warning: 0, info: 0, penalty: 0, cappedPenalty: 0 }
    };

    for (const f of findings) {
      const cat = f.category && categoryMap[f.category] ? f.category : "frontend";
      if (f.severity === "critical") {
        critical++;
        categoryMap[cat].critical++;
        categoryMap[cat].penalty += 15;
      } else if (f.severity === "warning") {
        warning++;
        categoryMap[cat].warning++;
        categoryMap[cat].penalty += 5;
      } else if (f.severity === "info") {
        info++;
        categoryMap[cat].info++;
        categoryMap[cat].penalty += 1;
      } else if (f.severity === "pass") {
        pass++;
      }
    }

    // Apply per-category penalty cap (max 25 pts per category)
    let totalCappedPenalty = 0;
    for (const cat of categories) {
      categoryMap[cat].cappedPenalty = Math.min(25, categoryMap[cat].penalty);
      totalCappedPenalty += categoryMap[cat].cappedPenalty;
    }

    const score = Math.max(0, Math.min(100, Math.round(100 - totalCappedPenalty)));

    return {
      score,
      formula: `Score = 100 - sum(min(25, cat_penalty)) [Total Penalty: ${totalCappedPenalty} pts (uncapped: ${(critical * 15) + (warning * 5) + (info * 1)} pts) => ${score}/100]`,
      summaryCounts: {
        critical,
        warning,
        info,
        pass,
        total: findings.length
      },
      categoryBreakdown: categoryMap
    };
  }
}
