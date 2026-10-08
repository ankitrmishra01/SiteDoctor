import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ScanQueueManager } from "../src/queue/scanQueue.js";
import { GitHubService } from "../src/github/github.service.js";
import { ScanResult, Finding } from "../src/diagnostics/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface EmpiricalCheck {
  url: string;
  actualHeaders: Record<string, string | null>;
  scanResult: {
    status: string;
    completeness: string;
    score: number;
    durationMs?: number;
    findingsCount: number;
    findings: Array<{ ruleId: string; severity: string; title: string }>;
  };
  headerCrossCheck: {
    hsts: { groundTruthPresent: boolean; detectedByScanner: boolean; match: boolean; rawHeader: string | null };
    xfo: { groundTruthPresent: boolean; detectedByScanner: boolean; match: boolean; rawHeader: string | null };
    csp: { groundTruthPresent: boolean; detectedByScanner: boolean; match: boolean; rawHeader: string | null };
    xcto: { groundTruthPresent: boolean; detectedByScanner: boolean; match: boolean; rawHeader: string | null };
  };
  allMatched: boolean;
}

// 1. Fetch raw headers directly using native fetch to establish ground truth
async function fetchGroundTruthHeaders(targetUrl: string): Promise<Record<string, string | null>> {
  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      signal: AbortSignal.timeout(15000)
    });

    const get = (h: string) => res.headers.get(h) || null;
    return {
      hsts: get("strict-transport-security"),
      xfo: get("x-frame-options"),
      csp: get("content-security-policy"),
      xcto: get("x-content-type-options"),
      cors: get("access-control-allow-origin"),
      server: get("server")
    };
  } catch (err: any) {
    return {
      hsts: null,
      xfo: null,
      csp: null,
      xcto: null,
      cors: null,
      server: null,
      error: err.message
    };
  }
}

async function runRound2Verification() {
  console.log("================================================================================");
  console.log("SITEDOCTOR ROUND 2: FULL PROTOCOL AUDIT, EMPIRICAL ACCURACY & STABILITY");
  console.log("================================================================================");

  const queue = ScanQueueManager.getInstance();
  const gh = GitHubService.getInstance();

  const report: Record<string, any> = {
    timestamp: new Date().toISOString(),
    round: 2,
    accuracyGroundTruth: [] as EmpiricalCheck[],
    stabilityEvaluation: [] as any[],
    codeAwareDiffs: [] as any[]
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Category A: 5 Fresh Live Target Sites Ground-Truth Accuracy
  // ─────────────────────────────────────────────────────────────────────────────
  const targetSites = [
    "https://go.dev",
    "https://www.python.org",
    "https://fastapi.tiangolo.com",
    "https://expressjs.com",
    "https://vuejs.org"
  ];

  console.log("\n[PHASE 1] Executing Category A & B Ground-Truth Audits across 5 Fresh Live Sites...");
  let totalHeaderChecks = 0;
  let totalHeaderMatches = 0;

  for (const siteUrl of targetSites) {
    console.log(`\nAuditing live target: ${siteUrl}`);
    
    // A. Fetch ground truth
    const groundTruth = await fetchGroundTruthHeaders(siteUrl);
    console.log("  Ground truth headers:", {
      hsts: !!groundTruth.hsts,
      xfo: !!groundTruth.xfo,
      csp: !!groundTruth.csp,
      xcto: !!groundTruth.xcto
    });

    // B. Run SiteDoctor scan
    const scan = await queue.executeDirect({
      url: siteUrl,
      type: "both",
      consent: true
    });

    const ruleIds = new Set(scan.findings.map(f => f.ruleId));

    // Security header rule definitions:
    // Missing rule fires => Scanner detected header is ABSENT
    // Missing rule NOT fired => Scanner detected header is PRESENT
    const checkHeader = (headerName: string, missingRuleId: string, rawVal: string | null) => {
      const gtPresent = !!rawVal;
      const scannerDetectedMissing = ruleIds.has(missingRuleId);
      const scannerDetectedPresent = !scannerDetectedMissing;
      const match = gtPresent === scannerDetectedPresent;
      return {
        groundTruthPresent: gtPresent,
        detectedByScanner: scannerDetectedPresent,
        match,
        rawHeader: rawVal
      };
    };

    const hstsCheck = checkHeader("HSTS", "SEC_HSTS_MISSING", groundTruth.hsts);
    const xfoCheck = checkHeader("X-Frame-Options", "SEC_XFO_MISSING", groundTruth.xfo);
    const cspCheck = checkHeader("CSP", "SEC_CSP_MISSING", groundTruth.csp);
    const xctoCheck = checkHeader("X-Content-Type-Options", "SEC_XCTO_MISSING", groundTruth.xcto);

    const siteMatches = [hstsCheck, xfoCheck, cspCheck, xctoCheck].filter(c => c.match).length;
    totalHeaderChecks += 4;
    totalHeaderMatches += siteMatches;

    const siteAudit: EmpiricalCheck = {
      url: siteUrl,
      actualHeaders: groundTruth,
      scanResult: {
        status: scan.status,
        completeness: scan.scanCompleteness,
        score: scan.healthScore,
        durationMs: scan.durationMs,
        findingsCount: scan.findings.length,
        findings: scan.findings.map(f => ({ ruleId: f.ruleId, severity: f.severity, title: f.title }))
      },
      headerCrossCheck: {
        hsts: hstsCheck,
        xfo: xfoCheck,
        csp: cspCheck,
        xcto: xctoCheck
      },
      allMatched: siteMatches === 4
    };

    console.log(`  Scan Result: Status=${scan.status}, Score=${scan.healthScore}, Findings=${scan.findings.length}, Completeness=${scan.scanCompleteness}`);
    console.log(`  Cross-Check: ${siteMatches}/4 matched (HSTS: ${hstsCheck.match}, XFO: ${xfoCheck.match}, CSP: ${cspCheck.match}, XCTO: ${xctoCheck.match})`);

    report.accuracyGroundTruth.push(siteAudit);
  }

  console.log(`\nCategory A Total: ${totalHeaderMatches}/${totalHeaderChecks} empirical header checks matched ground truth.`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Category C: Code-Aware AST Diffs on 2 Additional Frameworks
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[PHASE 2] Executing Category C Code-Aware AST Diff Validations...");
  
  // Test 1: FastAPI in Python
  const findingFastApi: Finding = {
    id: "f_fastapi_1",
    ruleId: "SEC_CORS_WILDCARD_WITH_CREDENTIALS",
    category: "security",
    severity: "critical",
    title: "CORS Configured with Permissive Wildcard and Credentials",
    plainEnglishCause: "FastAPI allows wildcard origin with credentials, opening session hijacking risks.",
    fixSteps: [],
    isVerified: true
  };
  const diffFastApi = await gh.suggestFixLocation("tiangolo/fastapi", findingFastApi);
  console.log("  FastAPI Diff Result:", {
    filePath: diffFastApi?.filePath,
    lineNumber: diffFastApi?.lineNumber,
    hasDiff: !!diffFastApi?.diff,
    confidence: diffFastApi?.confidence
  });
  report.codeAwareDiffs.push({
    framework: "FastAPI",
    repo: "tiangolo/fastapi",
    result: diffFastApi
  });

  // Test 2: Express in Node.js
  const findingExpress: Finding = {
    id: "f_express_1",
    ruleId: "SEC_XFO_MISSING",
    category: "security",
    severity: "warning",
    title: "Missing X-Frame-Options Header",
    plainEnglishCause: "Clickjacking attacks possible due to missing X-Frame-Options.",
    fixSteps: [],
    isVerified: true
  };
  const diffExpress = await gh.suggestFixLocation("expressjs/express", findingExpress);
  console.log("  Express Diff Result:", {
    filePath: diffExpress?.filePath,
    lineNumber: diffExpress?.lineNumber,
    hasDiff: !!diffExpress?.diff,
    confidence: diffExpress?.confidence
  });
  report.codeAwareDiffs.push({
    framework: "Express",
    repo: "expressjs/express",
    result: diffExpress
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Category D: Deterministic Stability Tests (3x Consecutive Scans)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[PHASE 3] Executing Category D Stability Audits (3x consecutive scans on 2 live domains)...");
  const stabilityDomains = ["https://go.dev", "https://vuejs.org"];

  for (const domain of stabilityDomains) {
    console.log(`\nTesting stability on: ${domain}`);
    const runs: ScanResult[] = [];
    for (let r = 1; r <= 3; r++) {
      const res = await queue.executeDirect({
        url: domain,
        type: "backend",
        consent: true
      });
      console.log(`  Run ${r}: Score=${res.healthScore}, Findings=${res.findings.length}, Duration=${res.durationMs}ms`);
      runs.push(res);
    }

    const scores = runs.map(r => r.healthScore);
    const findingCounts = runs.map(r => r.findings.length);
    const scoreSpread = Math.max(...scores) - Math.min(...scores);
    const findingsSpread = Math.max(...findingCounts) - Math.min(...findingCounts);

    console.log(`  Stability Outcome: Score Spread=${scoreSpread}, Findings Spread=${findingsSpread}`);

    report.stabilityEvaluation.push({
      domain,
      scores,
      findingCounts,
      scoreSpread,
      findingsSpread,
      stable: scoreSpread === 0 && findingsSpread === 0,
      runs: runs.map(r => ({
        healthScore: r.healthScore,
        findingsCount: r.findings.length,
        durationMs: r.durationMs
      }))
    });
  }

  // Save report
  const reportPath = path.resolve(__dirname, "../data/cycle_round_2_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`\n✓ Round 2 Full Protocol Report saved to: ${reportPath}`);

  // Exit cleanly
  process.exit(0);
}

runRound2Verification().catch((err) => {
  console.error("Round 2 Verification Error:", err);
  process.exit(1);
});
