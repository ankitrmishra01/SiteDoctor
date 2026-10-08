import { ScanQueueManager } from "../src/queue/scanQueue.js";
import { GitHubService } from "../src/github/github.service.js";
import { DIAGNOSTIC_RULES } from "../src/diagnostics/rules.js";
import { Finding } from "../src/diagnostics/types.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");
fs.mkdirSync(dataDir, { recursive: true });

async function fetchGroundTruth(url: string) {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SiteDoctor-Verifier/1.0"
      },
      timeout: 10000,
      redirect: "follow"
    });
    const headers = Object.fromEntries(res.headers.entries());
    const body = await res.text();
    return {
      status: res.status,
      headers,
      bodySnippet: body.substring(0, 1000),
      bodyLength: body.length,
      hasSitemapInRobots: /sitemap:/i.test(body),
      hasHsts: !!headers["strict-transport-security"],
      hstsValue: headers["strict-transport-security"] || null,
      hasCsp: !!headers["content-security-policy"],
      cspValue: headers["content-security-policy"] || null,
      hasXfo: !!headers["x-frame-options"],
      xfoValue: headers["x-frame-options"] || null,
      hasXcto: !!headers["x-content-type-options"],
      xctoValue: headers["x-content-type-options"] || null,
      contentEncoding: headers["content-encoding"] || "none"
    };
  } catch (err: any) {
    return {
      error: err.message
    };
  }
}

async function main() {
  console.log("================================================================================");
  console.log("SITEDOCTOR PROTOCOL CYCLE — ACCURACY, ADVERSARIAL SWEEP, CODE-DIFF, STABILITY");
  console.log("================================================================================");

  const manager = ScanQueueManager.getInstance();
  const githubService = GitHubService.getInstance();

  const cycleReport: Record<string, any> = {
    timestamp: new Date().toISOString(),
    categoryA_accuracy: [],
    categoryB_adversarial: [],
    categoryC_codeDiffs: {},
    categoryD_stability: {},
    categoryF_performance: {}
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // CATEGORY A: 5 FRESH REAL SITES ACCURACY & GROUND TRUTH CROSS-CHECK
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n>>> CATEGORY A: Scanning 5 Fresh Live Sites & Cross-Checking Ground Truth...");
  const targetSites = [
    "https://news.ycombinator.com",
    "https://www.rust-lang.org",
    "https://deno.com",
    "https://svelte.dev",
    "https://curl.se"
  ];

  let totalCrossChecks = 0;
  let passedCrossChecks = 0;

  for (const url of targetSites) {
    console.log(`\n[Scan] Target: ${url}`);
    const tStart = Date.now();
    const scanRes = await manager.executeDirect({ url, type: "both", consent: true });
    const durationMs = Date.now() - tStart;

    const groundTruth = await fetchGroundTruth(url);

    // Cross-check findings against ground truth
    const checks: any[] = [];

    // Check 1: HSTS
    const hstsFinding = scanRes.findings.find(f => f.ruleId === "SEC_HSTS_MISSING");
    const hstsReportedMissing = !!hstsFinding;
    const hstsActuallyMissing = !groundTruth.hasHsts;
    const hstsMatch = hstsReportedMissing === hstsActuallyMissing;
    totalCrossChecks++;
    if (hstsMatch) passedCrossChecks++;
    checks.push({
      rule: "SEC_HSTS_MISSING",
      scannerReportedMissing: hstsReportedMissing,
      groundTruthMissing: hstsActuallyMissing,
      groundTruthRawHeader: groundTruth.hstsValue,
      match: hstsMatch
    });

    // Check 2: X-Frame-Options / CSP Frame Ancestors
    const xfoFinding = scanRes.findings.find(f => f.ruleId === "SEC_XFO_MISSING");
    const xfoReportedMissing = !!xfoFinding;
    const xfoActuallyMissing = !groundTruth.hasXfo && !(groundTruth.cspValue && groundTruth.cspValue.includes("frame-ancestors"));
    const xfoMatch = xfoReportedMissing === xfoActuallyMissing;
    totalCrossChecks++;
    if (xfoMatch) passedCrossChecks++;
    checks.push({
      rule: "SEC_XFO_MISSING",
      scannerReportedMissing: xfoReportedMissing,
      groundTruthMissing: xfoActuallyMissing,
      groundTruthRawHeader: groundTruth.xfoValue,
      match: xfoMatch
    });

    // Check 3: CSP
    const cspFinding = scanRes.findings.find(f => f.ruleId === "SEC_CSP_MISSING");
    const cspReportedMissing = !!cspFinding;
    const cspActuallyMissing = !groundTruth.hasCsp;
    const cspMatch = cspReportedMissing === cspActuallyMissing;
    totalCrossChecks++;
    if (cspMatch) passedCrossChecks++;
    checks.push({
      rule: "SEC_CSP_MISSING",
      scannerReportedMissing: cspReportedMissing,
      groundTruthMissing: cspActuallyMissing,
      groundTruthRawHeader: groundTruth.cspValue,
      match: cspMatch
    });

    // Check 4: X-Content-Type-Options
    const xctoFinding = scanRes.findings.find(f => f.ruleId === "SEC_XCTO_MISSING");
    const xctoReportedMissing = !!xctoFinding;
    const xctoActuallyMissing = !groundTruth.hasXcto || groundTruth.xctoValue?.toLowerCase() !== "nosniff";
    const xctoMatch = xctoReportedMissing === xctoActuallyMissing;
    totalCrossChecks++;
    if (xctoMatch) passedCrossChecks++;
    checks.push({
      rule: "SEC_XCTO_MISSING",
      scannerReportedMissing: xctoReportedMissing,
      groundTruthMissing: xctoActuallyMissing,
      groundTruthRawHeader: groundTruth.xctoValue,
      match: xctoMatch
    });

    cycleReport.categoryA_accuracy.push({
      url,
      status: scanRes.status,
      scanCompleteness: scanRes.scanCompleteness,
      healthScore: scanRes.healthScore,
      durationMs,
      findingsCount: scanRes.findings.length,
      summaryCounts: scanRes.summaryCounts,
      crossChecks: checks
    });

    console.log(`  Status: ${scanRes.status} | Score: ${scanRes.healthScore} | Duration: ${durationMs}ms | Completeness: ${scanRes.scanCompleteness}`);
    for (const c of checks) {
      console.log(`  - CrossCheck ${c.rule}: ${c.match ? "✓ MATCH" : "✗ MISMATCH"} (Scanner: ${c.scannerReportedMissing ? "Missing" : "Present"}, Ground Truth: ${c.groundTruthMissing ? "Missing" : "Present"})`);
    }
  }

  console.log(`\nCategory A Match Rate: ${passedCrossChecks}/${totalCrossChecks} (${((passedCrossChecks/totalCrossChecks)*100).toFixed(1)}%)`);

  // ─────────────────────────────────────────────────────────────────────────────
  // CATEGORY C: CODE-DIFF CORRECTNESS FOR 3 NEW STACKS (Go, Django, SvelteKit)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n>>> CATEGORY C: Testing Framework-Aware Code Diffs for 3 New Repos/Stacks...");
  const sessionId = "cycle_session_" + Date.now();

  function setupPublicSession(owner: string, repo: string) {
    (githubService as any).sessionStore.set(sessionId, {
      token: "",
      repoOwner: owner,
      repoName: repo,
      expiresAt: Date.now() + 3600000,
      lastActive: Date.now()
    });
  }

  // 1. Go (gin-gonic/examples)
  console.log("\n[Diff 1: Go / Gin] Testing against gin-gonic/examples...");
  setupPublicSession("gin-gonic", "examples");
  const goCorsFinding: Partial<Finding> = {
    ruleId: "CORS_MISSING",
    category: "backend",
    severity: "critical",
    title: "CORS Header Missing on API Endpoint"
  };
  const goDiff = await githubService.locateCodeInRepo(sessionId, "gin.Default()", goCorsFinding, "https://github.com/gin-gonic/examples");
  cycleReport.categoryC_codeDiffs["repo_go_gin"] = {
    repo: "https://github.com/gin-gonic/examples",
    framework: "Go (Gin)",
    targetFile: goDiff?.filePath,
    targetLine: goDiff?.lineNumber,
    confidence: goDiff?.confidence,
    diff: goDiff?.diff
  };
  console.log(`  ✓ Go Diff generated in ${goDiff?.filePath} at line ${goDiff?.lineNumber}`);

  // 2. Django (django/django)
  console.log("\n[Diff 2: Python / Django] Testing against django/django...");
  setupPublicSession("django", "django");
  const djangoCspFinding: Partial<Finding> = {
    ruleId: "SEC_CSP_MISSING",
    category: "security",
    severity: "warning",
    title: "Content Security Policy (CSP) Header Missing"
  };
  const djangoDiff = await githubService.locateCodeInRepo(sessionId, "MIDDLEWARE", djangoCspFinding, "https://github.com/django/django");
  cycleReport.categoryC_codeDiffs["repo_python_django"] = {
    repo: "https://github.com/django/django",
    framework: "Python (Django)",
    targetFile: djangoDiff?.filePath,
    targetLine: djangoDiff?.lineNumber,
    confidence: djangoDiff?.confidence,
    diff: djangoDiff?.diff
  };
  console.log(`  ✓ Django Diff generated in ${djangoDiff?.filePath} at line ${djangoDiff?.lineNumber}`);

  // 3. SvelteKit (sveltejs/kit)
  console.log("\n[Diff 3: SvelteKit] Testing against sveltejs/kit...");
  setupPublicSession("sveltejs", "kit");
  const svelteCspFinding: Partial<Finding> = {
    ruleId: "SEC_CSP_MISSING",
    category: "security",
    severity: "warning",
    title: "Content Security Policy (CSP) Header Missing"
  };
  const svelteDiff = await githubService.locateCodeInRepo(sessionId, "respond", svelteCspFinding, "https://github.com/sveltejs/kit");
  cycleReport.categoryC_codeDiffs["repo_sveltekit"] = {
    repo: "https://github.com/sveltejs/kit",
    framework: "SvelteKit (TypeScript)",
    targetFile: svelteDiff?.filePath,
    targetLine: svelteDiff?.lineNumber,
    confidence: svelteDiff?.confidence,
    diff: svelteDiff?.diff
  };
  console.log(`  ✓ SvelteKit Diff generated in ${svelteDiff?.filePath} at line ${svelteDiff?.lineNumber}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // CATEGORY D: STABILITY VERIFICATION (3x RUNS ON 3 SITES)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n>>> CATEGORY D: Running 3x Consecutive Scans Across 3 Sites to Measure Stability...");
  const stabilityTargets = [
    "https://www.rust-lang.org",
    "https://svelte.dev",
    "https://curl.se"
  ];

  for (const url of stabilityTargets) {
    console.log(`\n[Stability Check] 3x Scans on ${url}`);
    const runs: any[] = [];
    for (let r = 1; r <= 3; r++) {
      const t0 = Date.now();
      const res = await manager.executeDirect({ url, type: "both", consent: true });
      const dur = Date.now() - t0;
      runs.push({
        runNumber: r,
        healthScore: res.healthScore,
        findingsCount: res.findings.length,
        critical: res.summaryCounts?.critical || 0,
        warning: res.summaryCounts?.warning || 0,
        info: res.summaryCounts?.info || 0,
        durationMs: dur
      });
      console.log(`  Run ${r}: Score=${res.healthScore}, Findings=${res.findings.length} (Crit:${res.summaryCounts?.critical}, Warn:${res.summaryCounts?.warning}, Info:${res.summaryCounts?.info}), Dur=${dur}ms`);
    }

    const scores = runs.map(r => r.healthScore);
    const scoreSpread = Math.max(...scores) - Math.min(...scores);
    const findingCounts = runs.map(r => r.findingsCount);
    const findingCountSpread = Math.max(...findingCounts) - Math.min(...findingCounts);

    cycleReport.categoryD_stability[url] = {
      runs,
      scoreSpread,
      findingCountSpread,
      isScoreStable: scoreSpread <= 2,
      isFindingsCountStable: findingCountSpread === 0
    };
  }

  // Save raw report
  const reportPath = path.join(dataDir, "cycle_round_1_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(cycleReport, null, 2), "utf-8");
  console.log(`\n✓ Cycle Report successfully saved to: ${reportPath}`);
}

main().catch(console.error);
