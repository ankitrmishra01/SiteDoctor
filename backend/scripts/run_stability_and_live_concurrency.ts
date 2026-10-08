import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { ScanQueueManager } from "../src/queue/scanQueue.js";
import { ScanResult } from "../src/diagnostics/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getMemorySnapshot() {
  const mem = process.memoryUsage();
  return {
    rssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
    heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10
  };
}

async function runLiveStabilityAndConcurrency() {
  console.log("================================================================================");
  console.log("SITEDOCTOR: LIVE STABILITY (WITH ETSY.COM) & REAL EXTERNAL CONCURRENT LOAD");
  console.log("================================================================================\n");

  const queue = ScanQueueManager.getInstance();

  // ─────────────────────────────────────────────────────────────────────────────
  // PART 1: CATEGORY D STABILITY AUDIT (INCLUDING ETSY.COM)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--------------------------------------------------------------------------------");
  console.log("PART 1: 3x CONSECUTIVE LIVE SCANS (STABILITY & SPREAD MEASUREMENT)");
  console.log("Targets: etsy.com (WAF protected), rust-lang.org, berkshirehathaway.com, deno.com");
  console.log("--------------------------------------------------------------------------------\n");

  const stabilityTargets = [
    "https://www.etsy.com",
    "https://www.rust-lang.org",
    "https://www.berkshirehathaway.com",
    "https://deno.com"
  ];

  const stabilityReport: any[] = [];

  for (const url of stabilityTargets) {
    console.log(`\nTesting 3 consecutive live scans on: ${url}`);
    const runs: ScanResult[] = [];

    for (let i = 1; i <= 3; i++) {
      const t0 = performance.now();
      const res = await queue.executeDirect({
        url,
        type: "backend",
        consent: true
      });
      const dur = Math.round(performance.now() - t0);
      runs.push(res);

      console.log(`  Run ${i}: Status=${res.status}, Score=${res.healthScore}/100, Findings=${res.findings.length}, Completeness=${res.scanCompleteness}, Duration=${dur}ms`);
      // 500ms cooldown between consecutive runs to prevent local socket exhaustion
      await new Promise(r => setTimeout(r, 500));
    }

    const scores = runs.map(r => r.healthScore);
    const findingCounts = runs.map(r => r.findings.length);
    const durations = runs.map(r => r.durationMs || 0);

    const scoreSpread = Math.max(...scores) - Math.min(...scores);
    const findingsSpread = Math.max(...findingCounts) - Math.min(...findingCounts);
    const durationSpread = Math.max(...durations) - Math.min(...durations);

    const siteSummary = {
      url,
      scores,
      scoreSpread,
      findingCounts,
      findingsSpread,
      durations,
      durationSpread,
      runs: runs.map((r, idx) => ({
        run: idx + 1,
        status: r.status,
        completeness: r.scanCompleteness,
        score: r.healthScore,
        findingsCount: r.findings.length,
        durationMs: r.durationMs,
        findingRuleIds: r.findings.map(f => f.ruleId),
        rawMetricsSummary: {
          httpStatus: r.rawMetrics?.pageLoad?.httpStatus,
          sslValid: r.rawMetrics?.ssl?.valid,
          lightLoadFailed: r.rawMetrics?.lightLoad?.failedRequests,
          lightLoadTotal: r.rawMetrics?.lightLoad?.totalRequests,
          statusDistribution: r.rawMetrics?.lightLoad?.statusDistribution
        }
      }))
    };

    console.log(`  -> Summary for ${url}:`);
    console.log(`     Scores: [${scores.join(", ")}] (Spread: ${scoreSpread})`);
    console.log(`     Findings Count: [${findingCounts.join(", ")}] (Spread: ${findingsSpread})`);
    console.log(`     Durations: [${durations.join("ms, ")}ms] (Spread: ${durationSpread}ms)`);

    stabilityReport.push(siteSummary);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PART 2: REAL EXTERNAL CONCURRENT LOAD TEST (10 REAL SITES SIMULTANEOUSLY)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("PART 2: REAL EXTERNAL CONCURRENT LOAD TEST (10 REAL SITES SIMULTANEOUSLY)");
  console.log("--------------------------------------------------------------------------------\n");

  const liveConcurrentUrls = [
    "https://news.ycombinator.com",
    "https://www.rust-lang.org",
    "https://deno.com",
    "https://svelte.dev",
    "https://curl.se",
    "https://go.dev",
    "https://www.python.org",
    "https://vuejs.org",
    "https://expressjs.com",
    "https://fastapi.tiangolo.com"
  ];

  console.log(`Firing 10 concurrent diagnostic scans simultaneously against real external public infrastructure...`);
  const memBefore = getMemorySnapshot();
  const tStart = performance.now();

  const concurrentPromises = liveConcurrentUrls.map((url, idx) => {
    return queue.executeDirect({
      url,
      type: "backend",
      userId: `user_live_conc_${idx + 1}`,
      consent: true
    });
  });

  const results = await Promise.allSettled(concurrentPromises);
  const totalBatchDurationMs = Math.round(performance.now() - tStart);
  const memAfter = getMemorySnapshot();

  const fulfilledResults = results.filter((r): r is PromiseFulfilledResult<ScanResult> => r.status === "fulfilled");
  const rejectedResults = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

  const completedScans = fulfilledResults.filter(r => r.value.status === "completed" || r.value.scanCompleteness.includes("partial")).length;
  const failedScans = rejectedResults.length + fulfilledResults.filter(r => r.value.status.startsWith("failed")).length;

  const durations = fulfilledResults.map(r => r.value.durationMs || 0);
  const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
  const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;

  console.log(`\nReal External Concurrent Batch Results:`);
  console.log(`  • Targets Fired: ${liveConcurrentUrls.length}`);
  console.log(`  • Completed Successfully: ${completedScans} / ${liveConcurrentUrls.length} (${Math.round((completedScans / liveConcurrentUrls.length) * 100)}%)`);
  console.log(`  • Failed / Errored: ${failedScans} / ${liveConcurrentUrls.length}`);
  console.log(`  • Total Wall-Clock Time: ${totalBatchDurationMs} ms (${(totalBatchDurationMs / 1000).toFixed(2)}s)`);
  console.log(`  • Throughput: ${(liveConcurrentUrls.length / (totalBatchDurationMs / 1000)).toFixed(2)} scans/sec across real internet`);
  console.log(`  • Individual Scan Durations -> Avg: ${avgDuration}ms | Min: ${minDuration}ms | Max: ${maxDuration}ms`);
  console.log(`  • Memory RSS -> Start: ${memBefore.rssMb}MB | End: ${memAfter.rssMb}MB (Delta: ${(memAfter.rssMb - memBefore.rssMb).toFixed(1)}MB)`);

  const realConcurrencyReport = {
    targetsFired: liveConcurrentUrls.length,
    completedScans,
    failedScans,
    totalWallClockMs: totalBatchDurationMs,
    throughputScansPerSec: Math.round((liveConcurrentUrls.length / (totalBatchDurationMs / 1000)) * 100) / 100,
    scanDurations: { avg: avgDuration, min: minDuration, max: maxDuration },
    memory: { before: memBefore, after: memAfter },
    individualResults: fulfilledResults.map(r => ({
      targetUrl: r.value.targetUrl,
      status: r.value.status,
      completeness: r.value.scanCompleteness,
      healthScore: r.value.healthScore,
      durationMs: r.value.durationMs,
      findingsCount: r.value.findings.length
    }))
  };

  const finalOutput = {
    timestamp: new Date().toISOString(),
    stabilityAudit: stabilityReport,
    realExternalConcurrencyAudit: realConcurrencyReport
  };

  const outputPath = path.resolve(__dirname, "../data/live_stability_and_concurrency_audit.json");
  fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 2), "utf-8");
  console.log(`\nAudit saved to: ${outputPath}`);

  process.exit(0);
}

runLiveStabilityAndConcurrency().catch((err) => {
  console.error("Audit error:", err);
  process.exit(1);
});
