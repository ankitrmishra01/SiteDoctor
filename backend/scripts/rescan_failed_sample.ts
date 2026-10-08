import fs from "node:fs";
import path from "node:path";
import { chromium, Browser } from "playwright";
import { ScanQueueManager } from "../src/queue/scanQueue.js";
import { DiagnosticsEngine } from "../src/diagnostics/engine.js";
import { SslScanner } from "../src/scanners/ssl.scanner.js";
import { BackendScanner } from "../src/scanners/backend.scanner.js";
import { FrontendScanner, UnreachableTargetError } from "../src/scanners/frontend.scanner.js";
import { StackDetector } from "../src/diagnostics/stackDetector.js";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SweepResult {
  url: string;
  category: string;
  status: "completed" | "failed_unreachable" | "failed_error";
  failureReason?: string;
  score: number;
  durationMs: number;
}

async function runRescanSample() {
  console.log("=== RESCANNING 100-SITE SAMPLE FROM PREVIOUS FAILED TARGETS ===");

  const sweepFile = path.resolve(__dirname, "../data/sweep_1000_results.json");
  const data: SweepResult[] = JSON.parse(fs.readFileSync(sweepFile, "utf-8"));
  
  // Extract 100 failed targets
  const failedTargets = data
    .filter(d => d.status === "failed_unreachable")
    .map(d => ({ url: d.url.split("?")[0], category: d.category })) // clean query params
    .slice(0, 100);

  // Remove duplicates by domain
  const uniqueTargets: Array<{ url: string; category: string }> = [];
  const seen = new Set<string>();
  for (const t of failedTargets) {
    if (!seen.has(t.url)) {
      seen.add(t.url);
      uniqueTargets.push(t);
    }
  }

  console.log(`Selected ${uniqueTargets.length} unique failed targets for verification sweep.`);

  const scanQueue = ScanQueueManager.getInstance();
  const results: any[] = [];
  let completedCount = 0;
  let failedCount = 0;

  // Run with controlled concurrency = 2 and graceful delay
  const CONCURRENCY = 2;
  let idx = 0;

  const runWorker = async () => {
    while (idx < uniqueTargets.length) {
      const target = uniqueTargets[idx++];
      const startTime = Date.now();
      try {
        const scanRes = await scanQueue.executeDirect({
          url: target.url,
          type: "both",
          consent: true
        });

        const duration = Date.now() - startTime;
        if (scanRes.status === "completed") {
          completedCount++;
          console.log(`[${idx}/${uniqueTargets.length}] ✓ COMPLETED: ${target.url} -> Score: ${scanRes.healthScore}/100 (${duration}ms)`);
          results.push({
            url: target.url,
            status: "completed",
            score: scanRes.healthScore,
            findingsCount: scanRes.findings.length,
            durationMs: duration
          });
        } else {
          failedCount++;
          console.log(`[${idx}/${uniqueTargets.length}] ✕ FAILED: ${target.url} -> ${scanRes.failureReason} (${duration}ms)`);
          results.push({
            url: target.url,
            status: scanRes.status,
            failureReason: scanRes.failureReason,
            score: 0,
            durationMs: duration
          });
        }
      } catch (err: any) {
        failedCount++;
        console.log(`[${idx}/${uniqueTargets.length}] ✕ ERROR: ${target.url} -> ${err.message}`);
        results.push({
          url: target.url,
          status: "failed_error",
          failureReason: err.message,
          score: 0,
          durationMs: Date.now() - startTime
        });
      }

      // 250ms spacing between targets
      await new Promise(r => setTimeout(r, 250));
    }
  };

  const workers = Array.from({ length: CONCURRENCY }, () => runWorker());
  await Promise.all(workers);

  const outPath = path.resolve(__dirname, "../data/rescan_100_failed_sample_results.json");
  fs.writeFileSync(outPath, JSON.stringify({
    totalAttempted: uniqueTargets.length,
    completedCount,
    failedCount,
    completionRate: `${((completedCount / uniqueTargets.length) * 100).toFixed(1)}%`,
    results
  }, null, 2));

  console.log(`\n=== RESCAN RESULTS ===`);
  console.log(`Total Attempted: ${uniqueTargets.length}`);
  console.log(`Successfully Completed: ${completedCount} (${((completedCount / uniqueTargets.length) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failedCount}`);
  console.log(`Wrote results to ${outPath}`);
}

runRescanSample().catch(console.error);
