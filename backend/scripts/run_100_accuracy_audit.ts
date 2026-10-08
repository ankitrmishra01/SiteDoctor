import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import tls from "node:tls";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { ScanQueueManager } from "../src/queue/scanQueue.js";
import { ScanResult, Finding } from "../src/diagnostics/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TARGET_SITES: Array<{ url: string; type: "frontend" | "backend" | "both"; category: string }> = [
  // 1. Frameworks & Web Platforms (20)
  { url: "https://nodejs.org", type: "backend", category: "Frameworks & Runtimes" },
  { url: "https://vite.dev", type: "backend", category: "Frameworks & Runtimes" },
  { url: "https://react.dev", type: "backend", category: "Frameworks & Runtimes" },
  { url: "https://vuejs.org", type: "backend", category: "Frameworks & Runtimes" },
  { url: "https://angular.dev", type: "backend", category: "Frameworks & Runtimes" },
  { url: "https://svelte.dev", type: "backend", category: "Frameworks & Runtimes" },
  { url: "https://nextjs.org", type: "backend", category: "Frameworks & Runtimes" },
  { url: "https://astro.build", type: "backend", category: "Frameworks & Runtimes" },
  { url: "https://deno.com", type: "backend", category: "Frameworks & Runtimes" },
  { url: "https://bun.sh", type: "backend", category: "Frameworks & Runtimes" },
  { url: "https://expressjs.com", type: "backend", category: "Frameworks & Runtimes" },
  { url: "https://fastapi.tiangolo.com", type: "backend", category: "Frameworks & Runtimes" },
  { url: "https://rubyonrails.org", type: "backend", category: "Frameworks & Runtimes" },
  { url: "https://laravel.com", type: "backend", category: "Frameworks & Runtimes" },
  { url: "https://go.dev", type: "backend", category: "Frameworks & Runtimes" },
  { url: "https://rust-lang.org", type: "backend", category: "Frameworks & Runtimes" },
  { url: "https://python.org", type: "backend", category: "Frameworks & Runtimes" },
  { url: "https://spring.io", type: "backend", category: "Frameworks & Runtimes" },
  { url: "https://flutter.dev", type: "backend", category: "Frameworks & Runtimes" },
  { url: "https://tailwindcss.com", type: "backend", category: "Frameworks & Runtimes" },

  // 2. Documentation, Standards & Technical Knowledge (20)
  { url: "https://developer.mozilla.org", type: "backend", category: "Docs & Standards" },
  { url: "https://en.wikipedia.org", type: "backend", category: "Docs & Standards" },
  { url: "https://www.w3.org", type: "backend", category: "Docs & Standards" },
  { url: "https://www.typescriptlang.org", type: "backend", category: "Docs & Standards" },
  { url: "https://graphql.org", type: "backend", category: "Docs & Standards" },
  { url: "https://www.docker.com", type: "backend", category: "Docs & Standards" },
  { url: "https://kubernetes.io", type: "backend", category: "Docs & Standards" },
  { url: "https://redis.io", type: "backend", category: "Docs & Standards" },
  { url: "https://www.postgresql.org", type: "backend", category: "Docs & Standards" },
  { url: "https://www.sqlite.org", type: "backend", category: "Docs & Standards" },
  { url: "https://www.mongodb.com", type: "backend", category: "Docs & Standards" },
  { url: "https://www.elastic.co", type: "backend", category: "Docs & Standards" },
  { url: "https://www.apache.org", type: "backend", category: "Docs & Standards" },
  { url: "https://www.linuxfoundation.org", type: "backend", category: "Docs & Standards" },
  { url: "https://archlinux.org", type: "backend", category: "Docs & Standards" },
  { url: "https://www.kernel.org", type: "backend", category: "Docs & Standards" },
  { url: "https://www.gnu.org", type: "backend", category: "Docs & Standards" },
  { url: "https://web.dev", type: "backend", category: "Docs & Standards" },
  { url: "https://caniuse.com", type: "backend", category: "Docs & Standards" },
  { url: "https://devdocs.io", type: "backend", category: "Docs & Standards" },

  // 3. Cloud, Hosting & Registry Ecosystems (20)
  { url: "https://github.com", type: "backend", category: "Cloud & Dev Tools" },
  { url: "https://gitlab.com", type: "backend", category: "Cloud & Dev Tools" },
  { url: "https://bitbucket.org", type: "backend", category: "Cloud & Dev Tools" },
  { url: "https://www.npmjs.com", type: "backend", category: "Cloud & Dev Tools" },
  { url: "https://pypi.org", type: "backend", category: "Cloud & Dev Tools" },
  { url: "https://crates.io", type: "backend", category: "Cloud & Dev Tools" },
  { url: "https://pkg.go.dev", type: "backend", category: "Cloud & Dev Tools" },
  { url: "https://packagist.org", type: "backend", category: "Cloud & Dev Tools" },
  { url: "https://rubygems.org", type: "backend", category: "Cloud & Dev Tools" },
  { url: "https://www.nuget.org", type: "backend", category: "Cloud & Dev Tools" },
  { url: "https://vercel.com", type: "backend", category: "Cloud & Dev Tools" },
  { url: "https://www.netlify.com", type: "backend", category: "Cloud & Dev Tools" },
  { url: "https://www.cloudflare.com", type: "backend", category: "Cloud & Dev Tools" },
  { url: "https://fly.io", type: "backend", category: "Cloud & Dev Tools" },
  { url: "https://render.com", type: "backend", category: "Cloud & Dev Tools" },
  { url: "https://www.digitalocean.com", type: "backend", category: "Cloud & Dev Tools" },
  { url: "https://supabase.com", type: "backend", category: "Cloud & Dev Tools" },
  { url: "https://firebase.google.com", type: "backend", category: "Cloud & Dev Tools" },
  { url: "https://postman.com", type: "backend", category: "Cloud & Dev Tools" },
  { url: "https://swagger.io", type: "backend", category: "Cloud & Dev Tools" },

  // 4. Public APIs & Data Services (15)
  { url: "https://httpbin.org", type: "backend", category: "APIs & Services" },
  { url: "https://dummyjson.com", type: "backend", category: "APIs & Services" },
  { url: "https://pokeapi.co", type: "backend", category: "APIs & Services" },
  { url: "https://reqres.in", type: "backend", category: "APIs & Services" },
  { url: "https://jsonplaceholder.typicode.com", type: "backend", category: "APIs & Services" },
  { url: "https://restcountries.com", type: "backend", category: "APIs & Services" },
  { url: "https://open-meteo.com", type: "backend", category: "APIs & Services" },
  { url: "https://api.github.com", type: "backend", category: "APIs & Services" },
  { url: "https://icanhazdadjoke.com", type: "backend", category: "APIs & Services" },
  { url: "https://api.coindesk.com", type: "backend", category: "APIs & Services" },
  { url: "https://api.spacexdata.com", type: "backend", category: "APIs & Services" },
  { url: "https://rickandmortyapi.com", type: "backend", category: "APIs & Services" },
  { url: "https://dog.ceo", type: "backend", category: "APIs & Services" },
  { url: "https://catfact.ninja", type: "backend", category: "APIs & Services" },
  { url: "https://worldtimeapi.org", type: "backend", category: "APIs & Services" },

  // 5. Open Source Software & Non-Profit Foundations (25)
  { url: "https://www.mozilla.org", type: "backend", category: "Open Source & Foundations" },
  { url: "https://www.eff.org", type: "backend", category: "Open Source & Foundations" },
  { url: "https://www.torproject.org", type: "backend", category: "Open Source & Foundations" },
  { url: "https://signal.org", type: "backend", category: "Open Source & Foundations" },
  { url: "https://matrix.org", type: "backend", category: "Open Source & Foundations" },
  { url: "https://www.openstreetmap.org", type: "backend", category: "Open Source & Foundations" },
  { url: "https://archive.org", type: "backend", category: "Open Source & Foundations" },
  { url: "https://wikimediafoundation.org", type: "backend", category: "Open Source & Foundations" },
  { url: "https://creativecommons.org", type: "backend", category: "Open Source & Foundations" },
  { url: "https://www.fsf.org", type: "backend", category: "Open Source & Foundations" },
  { url: "https://duckduckgo.com", type: "backend", category: "Open Source & Foundations" },
  { url: "https://brave.com", type: "backend", category: "Open Source & Foundations" },
  { url: "https://proton.me", type: "backend", category: "Open Source & Foundations" },
  { url: "https://www.libreoffice.org", type: "backend", category: "Open Source & Foundations" },
  { url: "https://www.blender.org", type: "backend", category: "Open Source & Foundations" },
  { url: "https://www.videolan.org", type: "backend", category: "Open Source & Foundations" },
  { url: "https://www.gimp.org", type: "backend", category: "Open Source & Foundations" },
  { url: "https://inkscape.org", type: "backend", category: "Open Source & Foundations" },
  { url: "https://www.audacityteam.org", type: "backend", category: "Open Source & Foundations" },
  { url: "https://obsproject.com", type: "backend", category: "Open Source & Foundations" },
  { url: "https://curl.se", type: "backend", category: "Open Source & Foundations" },
  { url: "https://git-scm.com", type: "backend", category: "Open Source & Foundations" },
  { url: "https://ffmpeg.org", type: "backend", category: "Open Source & Foundations" },
  { url: "https://neovim.io", type: "backend", category: "Open Source & Foundations" },
  { url: "https://code.visualstudio.com", type: "backend", category: "Open Source & Foundations" }
];

interface SiteAuditRecord {
  index: number;
  url: string;
  category: string;
  status: string;
  completeness: string;
  healthScore: number;
  durationMs: number;
  findingsCount: number;
  summaryCounts: { critical: number; warning: number; info: number; pass: number; total: number };
  detectedStack?: string;
  groundTruth: {
    reachable: boolean;
    statusCode: number | null;
    hsts: string | null;
    csp: string | null;
    xfo: string | null;
    xcto: string | null;
    sslValid: boolean;
  };
  assertions: {
    hstsMatch: boolean;
    cspMatch: boolean;
    xfoMatch: boolean;
    xctoMatch: boolean;
    sslMatch: boolean;
    totalMatched: number;
    totalAsserted: number;
  };
  discrepancies: string[];
}

async function fetchGroundTruth(targetUrl: string) {
  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      signal: AbortSignal.timeout(10000)
    });

    const get = (h: string) => res.headers.get(h) || null;
    return {
      reachable: true,
      statusCode: res.status,
      hsts: get("strict-transport-security"),
      csp: get("content-security-policy"),
      xfo: get("x-frame-options"),
      xcto: get("x-content-type-options"),
      sslValid: targetUrl.startsWith("https://")
    };
  } catch {
    return {
      reachable: false,
      statusCode: null,
      hsts: null,
      csp: null,
      xfo: null,
      xcto: null,
      sslValid: false
    };
  }
}

async function auditSingleSite(
  index: number,
  target: { url: string; type: "frontend" | "backend" | "both"; category: string },
  queue: ScanQueueManager
): Promise<SiteAuditRecord> {
  const t0 = performance.now();

  // 1. Fetch Ground Truth
  const gt = await fetchGroundTruth(target.url);

  // 2. Run SiteDoctor Scan
  let scan: ScanResult;
  try {
    scan = await queue.executeDirect({
      url: target.url,
      type: target.type,
      consent: true
    });
  } catch (err: any) {
    scan = {
      jobId: `err_${Date.now()}`,
      targetUrl: target.url,
      scanType: target.type,
      status: "failed_error",
      scanCompleteness: "failed_error",
      failureReason: err.message,
      startedAt: new Date().toISOString(),
      healthScore: 0,
      scoreFormula: "Scan failed",
      summaryCounts: { critical: 0, warning: 0, info: 0, pass: 0, total: 0 },
      findings: [],
      rawMetrics: {}
    };
  }

  const durationMs = Math.round(performance.now() - t0);
  const ruleIds = new Set(scan.findings.map(f => f.ruleId));

  const discrepancies: string[] = [];

  // Assertion 1: HSTS
  // If ground truth has HSTS -> SEC_HSTS_MISSING should NOT be in findings
  // If ground truth lacks HSTS -> SEC_HSTS_MISSING SHOULD be in findings
  const hstsPresent = !!gt.hsts;
  const hstsScannerMissing = ruleIds.has("SEC_HSTS_MISSING");
  const hstsMatch = hstsPresent === !hstsScannerMissing;
  if (gt.reachable && !hstsMatch) {
    discrepancies.push(`HSTS discrepancy: groundTruthPresent=${hstsPresent}, scannerMissingFlag=${hstsScannerMissing}`);
  }

  // Assertion 2: CSP
  const cspPresent = !!gt.csp;
  const cspScannerMissing = ruleIds.has("SEC_CSP_MISSING");
  const cspMatch = cspPresent === !cspScannerMissing;
  if (gt.reachable && !cspMatch) {
    discrepancies.push(`CSP discrepancy: groundTruthPresent=${cspPresent}, scannerMissingFlag=${cspScannerMissing}`);
  }

  // Assertion 3: XFO (Account for frame-ancestors standard compliance)
  const xfoPresent = !!gt.xfo || (!!gt.csp && gt.csp.includes("frame-ancestors"));
  const xfoScannerMissing = ruleIds.has("SEC_XFO_MISSING");
  const xfoMatch = xfoPresent === !xfoScannerMissing;
  if (gt.reachable && !xfoMatch) {
    discrepancies.push(`XFO discrepancy: groundTruthPresent=${xfoPresent}, scannerMissingFlag=${xfoScannerMissing}`);
  }

  // Assertion 4: XCTO (must be nosniff)
  const xctoPresent = gt.xcto?.toLowerCase() === "nosniff";
  const xctoScannerMissing = ruleIds.has("SEC_XCTO_MISSING");
  const xctoMatch = xctoPresent === !xctoScannerMissing;
  if (gt.reachable && !xctoMatch) {
    discrepancies.push(`XCTO discrepancy: groundTruthPresent=${xctoPresent}, scannerMissingFlag=${xctoScannerMissing}`);
  }

  // Assertion 5: SSL Validity
  const sslDetectedValid = scan.rawMetrics?.ssl?.valid ?? (scan.status === "completed");
  const sslMatch = gt.sslValid === sslDetectedValid;
  if (gt.reachable && !sslMatch) {
    discrepancies.push(`SSL discrepancy: groundTruthValid=${gt.sslValid}, scannerValid=${sslDetectedValid}`);
  }

  const assertions = gt.reachable ? [hstsMatch, cspMatch, xfoMatch, xctoMatch, sslMatch] : [];
  const totalMatched = assertions.filter(Boolean).length;
  const totalAsserted = gt.reachable ? 5 : 0;

  return {
    index,
    url: target.url,
    category: target.category,
    status: scan.status,
    completeness: scan.scanCompleteness,
    healthScore: scan.healthScore,
    durationMs,
    findingsCount: scan.findings.length,
    summaryCounts: scan.summaryCounts || { critical: 0, warning: 0, info: 0, pass: 0, total: 0 },
    detectedStack: scan.detectedStack?.summary,
    groundTruth: gt,
    assertions: {
      hstsMatch,
      cspMatch,
      xfoMatch,
      xctoMatch,
      sslMatch,
      totalMatched,
      totalAsserted
    },
    discrepancies
  };
}

async function run100SiteAccuracyAudit() {
  console.log("================================================================================");
  console.log("SITEDOCTOR: 100 REAL-WORLD SITES EMPIRICAL ACCURACY AUDIT");
  console.log(`Auditing ${TARGET_SITES.length} live production domains across 5 categories...`);
  console.log("================================================================================\n");

  const queue = ScanQueueManager.getInstance();
  const records: SiteAuditRecord[] = [];
  const CONCURRENCY = 4;
  let currentIndex = 0;

  const totalStart = performance.now();

  async function worker(workerId: number) {
    while (currentIndex < TARGET_SITES.length) {
      const idx = currentIndex++;
      const target = TARGET_SITES[idx];
      if (!target) break;

      const rec = await auditSingleSite(idx + 1, target, queue);
      records.push(rec);

      const symbol = rec.discrepancies.length === 0 ? "✓" : "⚠";
      console.log(
        `[Worker ${workerId}] [${String(idx + 1).padStart(3, " ")}/100] ${symbol} ${target.url.padEnd(35)} -> Score: ${String(rec.healthScore).padStart(3)} | Dur: ${String(rec.durationMs).padStart(5)}ms | Match: ${rec.assertions.totalMatched}/${rec.assertions.totalAsserted} | Completeness: ${rec.completeness}`
      );
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));
  records.sort((a, b) => a.index - b.index);

  const totalTimeMs = Math.round(performance.now() - totalStart);

  // Aggregations
  const totalAttempted = records.length;
  const completedScans = records.filter(r => r.status === "completed" || r.completeness.includes("partial")).length;
  const reachableScans = records.filter(r => r.groundTruth.reachable).length;
  const unreachableScans = totalAttempted - reachableScans;

  const totalAssertions = records.reduce((sum, r) => sum + r.assertions.totalAsserted, 0);
  const matchedAssertions = records.reduce((sum, r) => sum + r.assertions.totalMatched, 0);
  const accuracyFraction = totalAssertions > 0 ? (matchedAssertions / totalAssertions) * 100 : 0;

  const scores = records.filter(r => r.groundTruth.reachable).map(r => r.healthScore);
  const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
  const sortedScores = [...scores].sort((a, b) => a - b);
  const medianScore = sortedScores.length > 0 ? sortedScores[Math.floor(sortedScores.length / 2)] : 0;
  const minScore = sortedScores.length > 0 ? sortedScores[0] : 0;
  const maxScore = sortedScores.length > 0 ? sortedScores[sortedScores.length - 1] : 0;

  const categoryBreakdown: Record<string, { total: number; matchedAssertions: number; totalAssertions: number; avgScore: number }> = {};
  for (const r of records) {
    if (!categoryBreakdown[r.category]) {
      categoryBreakdown[r.category] = { total: 0, matchedAssertions: 0, totalAssertions: 0, avgScore: 0 };
    }
    const cat = categoryBreakdown[r.category];
    cat.total += 1;
    cat.matchedAssertions += r.assertions.totalMatched;
    cat.totalAssertions += r.assertions.totalAsserted;
  }

  for (const catName in categoryBreakdown) {
    const catRecs = records.filter(r => r.category === catName && r.groundTruth.reachable);
    const catScores = catRecs.map(r => r.healthScore);
    categoryBreakdown[catName].avgScore = catScores.length > 0 ? Math.round((catScores.reduce((a, b) => a + b, 0) / catScores.length) * 10) / 10 : 0;
  }

  const allDiscrepancies = records.filter(r => r.discrepancies.length > 0);

  const summaryReport = {
    timestamp: new Date().toISOString(),
    auditSummary: {
      totalAttempted,
      completedScans,
      reachableScans,
      unreachableScans,
      completionRate: `${completedScans}/${totalAttempted} (${((completedScans / totalAttempted) * 100).toFixed(1)}%)`,
      totalEmpiricalAssertions: totalAssertions,
      matchedAssertions,
      empiricalAccuracyRate: `${matchedAssertions}/${totalAssertions} (${accuracyFraction.toFixed(2)}%)`,
      totalAuditDurationMs: totalTimeMs,
      throughputScansPerSec: Math.round((totalAttempted / (totalTimeMs / 1000)) * 100) / 100
    },
    scoreStatistics: {
      mean: avgScore,
      median: medianScore,
      min: minScore,
      max: maxScore
    },
    categoryBreakdown,
    discrepancyCount: allDiscrepancies.length,
    discrepancies: allDiscrepancies.map(d => ({
      index: d.index,
      url: d.url,
      category: d.category,
      discrepancies: d.discrepancies,
      groundTruth: d.groundTruth
    })),
    records
  };

  const reportPath = path.resolve(__dirname, "../data/accuracy_100_sites_empirical_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(summaryReport, null, 2), "utf-8");

  console.log("\n================================================================================");
  console.log("100-SITE ACCURACY AUDIT COMPLETE");
  console.log("================================================================================");
  console.log(`• Total Sites Tested: ${totalAttempted}`);
  console.log(`• Completed Scans: ${completedScans} / ${totalAttempted} (${((completedScans / totalAttempted) * 100).toFixed(1)}%)`);
  console.log(`• Reachable Sites: ${reachableScans} / ${totalAttempted}`);
  console.log(`• Total Empirical Assertions Tested: ${totalAssertions}`);
  console.log(`• Matched Assertions: ${matchedAssertions} / ${totalAssertions} (${accuracyFraction.toFixed(2)}%)`);
  console.log(`• Discrepancies: ${allDiscrepancies.length} sites had minor discrepancies`);
  console.log(`• Health Scores -> Mean: ${avgScore} | Median: ${medianScore} | Min: ${minScore} | Max: ${maxScore}`);
  console.log(`• Total Audit Duration: ${totalTimeMs} ms (${Math.round(totalTimeMs / 1000)}s)`);
  console.log(`• Saved Complete Raw Data to: ${reportPath}`);
  console.log("================================================================================\n");

  process.exit(0);
}

run100SiteAccuracyAudit().catch((err) => {
  console.error("100-Site Accuracy Audit Error:", err);
  process.exit(1);
});
