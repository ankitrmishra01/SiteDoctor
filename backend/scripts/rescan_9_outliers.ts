import { SslScanner } from "../src/scanners/ssl.scanner.js";
import { FrontendScanner } from "../src/scanners/frontend.scanner.js";
import { BackendScanner } from "../src/scanners/backend.scanner.js";
import { DiagnosticsEngine } from "../src/diagnostics/engine.js";
import { Finding } from "../src/diagnostics/types.js";
import fs from "node:fs";
import path from "node:path";

const OUTLIER_SITES = [
  "https://fastapi.tiangolo.com",
  "https://laravel.com",
  "https://go.dev",
  "https://crates.io",
  "https://render.com",
  "https://www.mozilla.org",
  "https://www.fsf.org",
  "https://www.videolan.org",
  "https://bitbucket.org"
];

// Load old results
const oldResultsRaw = fs.readFileSync(path.resolve("data/sweep_100_results.json"), "utf8");
const oldResults = JSON.parse(oldResultsRaw);

async function scanSite(url: string) {
  const start = performance.now();
  const findings: Finding[] = [];
  let duration = 0;

  try {
    const ssl = await SslScanner.scan(url);
    findings.push(...ssl.findings);

    const fe = await FrontendScanner.scan(url);
    findings.push(...fe.findings);

    const be = await BackendScanner.scan(url, undefined, false);
    findings.push(...be.findings);

    duration = Math.round(performance.now() - start);
    const scoreResult = DiagnosticsEngine.calculateHealthScore(findings);

    return {
      url,
      status: "completed",
      healthScore: scoreResult.score,
      formula: scoreResult.formula,
      summaryCounts: scoreResult.summaryCounts,
      durationMs: duration,
      findings
    };
  } catch (err: any) {
    duration = Math.round(performance.now() - start);
    return {
      url,
      status: "error",
      healthScore: 0,
      error: err.message,
      durationMs: duration,
      findings: []
    };
  }
}

async function run() {
  console.log("Re-scanning 9 outlier sites with live calibrated engine...");
  const results = [];

  for (const url of OUTLIER_SITES) {
    console.log(`Scanning ${url}...`);
    const res = await scanSite(url);
    const old = oldResults.find((r: any) => r.url === url) || { healthScore: 0, criticalCount: 0, durationMs: 0 };
    
    results.push({
      url,
      oldScore: old.healthScore,
      newScore: res.healthScore,
      oldCritical: old.criticalCount,
      newCritical: res.summaryCounts?.critical ?? 0,
      oldWarning: old.warningCount,
      newWarning: res.summaryCounts?.warning ?? 0,
      oldDurationSec: (old.durationMs / 1000).toFixed(1),
      newDurationSec: (res.durationMs / 1000).toFixed(1),
      status: res.status,
      findings: res.findings
    });

    console.log(`-> ${url} | Old Score: ${old.healthScore} (Crit: ${old.criticalCount}) => New Score: ${res.healthScore} (Crit: ${res.summaryCounts?.critical ?? 0}) in ${(res.durationMs / 1000).toFixed(1)}s`);
  }

  fs.writeFileSync("data/rescan_9_outliers_results.json", JSON.stringify(results, null, 2));
  console.log("Saved results to data/rescan_9_outliers_results.json");
}

run().catch(console.error);
