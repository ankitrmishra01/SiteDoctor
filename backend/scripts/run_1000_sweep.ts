import fs from "node:fs";
import path from "node:path";
import { StackDetector } from "../src/diagnostics/stackDetector.js";
import { DiagnosticsEngine } from "../src/diagnostics/engine.js";
import { BackendScanner } from "../src/scanners/backend.scanner.js";
import { FrontendScanner, UnreachableTargetError } from "../src/scanners/frontend.scanner.js";
import { SslScanner } from "../src/scanners/ssl.scanner.js";
import { HistoryStore } from "../src/storage/history.store.js";
import { ScanResult, Finding } from "../src/diagnostics/types.js";

interface SiteTarget {
  url: string;
  category: string;
}

interface SweepResult {
  url: string;
  category: string;
  status: "completed" | "failed_unreachable" | "failed_error";
  failureReason?: string;
  score: number;
  formula?: string;
  durationMs: number;
  critical: number;
  warning: number;
  info: number;
  detectedStack: any;
  topFindings: Array<{ ruleId: string; severity: string; title: string; technology?: string }>;
  timestamp: string;
}

const RESULTS_FILE = path.resolve("data", "sweep_1000_results.json");
const SITES_FILE = path.resolve("data", "sites_1000.json");
const CONCURRENCY = 6;

async function scanSingleSite(site: SiteTarget): Promise<SweepResult> {
  const start = performance.now();
  const allFindings: Finding[] = [];
  let feResult: any = null;
  let beResult: any = null;

  try {
    // 1. SSL Scan
    try {
      const ssl = await SslScanner.scan(site.url);
      allFindings.push(...ssl.findings);
    } catch {}

    // 2. Frontend Browser & WCAG Scan
    try {
      feResult = await FrontendScanner.scan(site.url);
      allFindings.push(...feResult.findings);
    } catch (err: any) {
      if (err instanceof UnreachableTargetError) {
        throw err;
      }
      // Non-fatal frontend failure fallback to backend
    }

    // 3. Backend & API Scan
    try {
      beResult = await BackendScanner.scan(site.url);
      allFindings.push(...beResult.findings);
    } catch (err: any) {
      if (err instanceof UnreachableTargetError) {
        throw err;
      }
    }

    // 4. Stack Detection & Calibration
    const detectedStack = StackDetector.detect({
      headers: beResult?.rawHeaders || beResult?.securityHeaders,
      htmlContent: feResult?.stackSignals?.htmlContent,
      cookies: feResult?.stackSignals?.cookies,
      generatorMeta: feResult?.stackSignals?.generatorMeta
    });

    const calibratedFindings = DiagnosticsEngine.applyStackToFindings(allFindings, detectedStack);
    const scoreResult = DiagnosticsEngine.calculateHealthScore(calibratedFindings);
    const durationMs = Math.round(performance.now() - start);

    // Persist to HistoryStore
    const scanResult: ScanResult = {
      jobId: `sweep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      targetUrl: site.url,
      scanType: "both",
      status: "completed",
      startedAt: new Date(Date.now() - durationMs).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs,
      healthScore: scoreResult.score,
      scoreFormula: scoreResult.formula,
      summaryCounts: scoreResult.summaryCounts,
      findings: calibratedFindings,
      detectedStack,
      rawMetrics: {
        pageLoad: feResult?.pageLoad,
        coreWebVitals: feResult?.coreWebVitals,
        accessibility: feResult?.accessibility,
        securityHeaders: beResult?.securityHeaders,
        cors: beResult?.cors,
        endpointsDiscovered: beResult?.endpointsDiscovered,
        lightLoad: beResult?.lightLoad
      }
    };
    HistoryStore.getInstance().saveScan(scanResult);

    return {
      url: site.url,
      category: site.category,
      status: "completed",
      score: scoreResult.score,
      formula: scoreResult.formula,
      durationMs,
      critical: scoreResult.summaryCounts.critical,
      warning: scoreResult.summaryCounts.warning,
      info: scoreResult.summaryCounts.info,
      detectedStack,
      topFindings: calibratedFindings.slice(0, 5).map(f => ({
        ruleId: f.ruleId,
        severity: f.severity,
        title: f.title,
        technology: f.stackContext?.matchedTechnology
      })),
      timestamp: new Date().toISOString()
    };
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - start);
    const isUnreachable = err instanceof UnreachableTargetError || err.message?.includes("timed out") || err.message?.includes("fetch failed");
    return {
      url: site.url,
      category: site.category,
      status: isUnreachable ? "failed_unreachable" : "failed_error",
      failureReason: err.message || "Failed to complete audit",
      score: 0,
      durationMs,
      critical: 0,
      warning: 0,
      info: 0,
      detectedStack: { server: "unknown", framework: "unknown", language: "unknown", confidence: "none", detectedSignals: [], summary: "Unreachable" },
      topFindings: [],
      timestamp: new Date().toISOString()
    };
  }
}

async function main() {
  console.log("===============================================================================");
  console.log("🚀 SITEDOCTOR 1000-SITE RESILIENCE & ADAPTIVE STACK SWEEP");
  console.log(`Concurrency: ${CONCURRENCY} workers | Persistence: ${RESULTS_FILE}`);
  console.log("===============================================================================");

  if (!fs.existsSync(SITES_FILE)) {
    console.error("Sites file not found. Please run generate_1000_sites.ts first.");
    process.exit(1);
  }

  const allSites: SiteTarget[] = JSON.parse(fs.readFileSync(SITES_FILE, "utf-8"));
  let completedResults: SweepResult[] = [];

  if (fs.existsSync(RESULTS_FILE)) {
    try {
      completedResults = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf-8"));
      console.log(`Resuming sweep: Found ${completedResults.length} previously completed sites.`);
    } catch {}
  }

  const completedMap = new Map<string, SweepResult>(completedResults.map(r => [r.url, r]));
  const remainingSites = allSites.filter(s => !completedMap.has(s.url));

  console.log(`Remaining targets to scan: ${remainingSites.length} / ${allSites.length}`);

  let currentIndex = 0;
  let activeWorkers = 0;

  const saveProgress = () => {
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(Array.from(completedMap.values()), null, 2));
  };

  const printProgressStats = () => {
    const total = completedMap.size;
    const completed = Array.from(completedMap.values()).filter(r => r.status === "completed");
    const unreachable = Array.from(completedMap.values()).filter(r => r.status === "failed_unreachable");
    const error = Array.from(completedMap.values()).filter(r => r.status === "failed_error");
    const avgScore = completed.length > 0 ? (completed.reduce((a, b) => a + b.score, 0) / completed.length).toFixed(1) : "N/A";
    
    console.log(`\n📊 SWEEP PROGRESS: [${total} / ${allSites.length}] (${Math.round((total / allSites.length) * 100)}%)`);
    console.log(`   ✓ Completed: ${completed.length} | ✕ Unreachable: ${unreachable.length} | ! Errored: ${error.length} | Avg Score: ${avgScore}/100\n`);
  };

  return new Promise<void>((resolve) => {
    const launchWorker = async () => {
      if (currentIndex >= remainingSites.length) {
        if (activeWorkers === 0) {
          saveProgress();
          printProgressStats();
          resolve();
        }
        return;
      }

      const site = remainingSites[currentIndex++];
      activeWorkers++;

      try {
        const res = await scanSingleSite(site);
        completedMap.set(site.url, res);
        console.log(`[${completedMap.size}/${allSites.length}] ${res.status === "completed" ? "✓" : "✕"} ${res.url} -> Score: ${res.score}/100 (${res.durationMs}ms) Stack: ${res.detectedStack?.summary || "N/A"}`);
        
        // Save incrementally every 5 scans
        if (completedMap.size % 5 === 0) {
          saveProgress();
        }
        if (completedMap.size % 25 === 0) {
          printProgressStats();
        }
      } catch (err: any) {
        console.error(`Worker error on ${site.url}:`, err);
      } finally {
        activeWorkers--;
        launchWorker();
      }
    };

    // Launch worker pool
    const poolSize = Math.min(CONCURRENCY, remainingSites.length);
    for (let i = 0; i < poolSize; i++) {
      launchWorker();
    }
  });
}

main().catch(console.error);
