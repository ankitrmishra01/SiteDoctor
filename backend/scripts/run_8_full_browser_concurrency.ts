import { ScanQueueManager } from "../src/queue/scanQueue.js";
import v8 from "node:v8";

async function run8FullBrowserScans() {
  console.log("================================================================================");
  console.log("ITEM 4: 8 CONCURRENT FULL BROWSER SCANS BENCHMARK (REAL PUBLIC TARGETS)");
  console.log("================================================================================\n");

  const targets = [
    "https://www.rust-lang.org",
    "https://deno.com",
    "https://svelte.dev",
    "https://curl.se",
    "https://go.dev",
    "https://www.python.org",
    "https://vuejs.org",
    "https://expressjs.com"
  ];

  const queue = ScanQueueManager.getInstance();

  const memBefore = process.memoryUsage();
  console.log(`Starting 8 Concurrent Full Scans at ${new Date().toISOString()}`);
  console.log(`Initial Memory -> RSS: ${(memBefore.rss / (1024 * 1024)).toFixed(1)} MB | Heap Used: ${(memBefore.heapUsed / (1024 * 1024)).toFixed(1)} MB\n`);

  let maxRss = memBefore.rss;
  let maxHeapUsed = memBefore.heapUsed;

  const memSampler = setInterval(() => {
    const cur = process.memoryUsage();
    if (cur.rss > maxRss) maxRss = cur.rss;
    if (cur.heapUsed > maxHeapUsed) maxHeapUsed = cur.heapUsed;
  }, 250);

  const startTime = Date.now();

  try {
    const scanPromises = targets.map(async (url, idx) => {
      const itemStart = Date.now();
      try {
        const result = await queue.executeDirect({
          url,
          type: "both",
          consent: true
        });
        const duration = Date.now() - itemStart;
        console.log(`[#${idx + 1}] Completed ${url} in ${(duration / 1000).toFixed(2)}s | Score: ${result.healthScore}/100 | Completeness: ${result.scanCompleteness}`);
        return {
          url,
          success: true,
          durationMs: duration,
          healthScore: result.healthScore,
          completeness: result.scanCompleteness,
          findingsCount: result.findings.length
        };
      } catch (err: any) {
        const duration = Date.now() - itemStart;
        console.error(`[#${idx + 1}] Failed ${url} in ${(duration / 1000).toFixed(2)}s: ${err.message}`);
        return {
          url,
          success: false,
          durationMs: duration,
          error: err.message
        };
      }
    });

    const results = await Promise.all(scanPromises);
    clearInterval(memSampler);
    const totalDurationMs = Date.now() - startTime;
    const memAfter = process.memoryUsage();

    console.log("\n================================================================================");
    console.log("BENCHMARK RESULTS & RESOURCE USAGE");
    console.log("================================================================================");
    console.log(`Total Wall-Clock Time: ${(totalDurationMs / 1000).toFixed(2)}s (across 8 concurrent full scans)`);
    console.log(`Average Latency per Target: ${(results.reduce((a, b) => a + b.durationMs, 0) / results.length / 1000).toFixed(2)}s`);
    console.log(`Peak RSS Memory: ${(maxRss / (1024 * 1024)).toFixed(1)} MB`);
    console.log(`Peak Heap Used: ${(maxHeapUsed / (1024 * 1024)).toFixed(1)} MB`);
    console.log(`End RSS Memory: ${(memAfter.rss / (1024 * 1024)).toFixed(1)} MB`);
    console.log(`Successful Scans: ${results.filter(r => r.success).length} / ${results.length}`);
    console.log("================================================================================\n");

    const fs = await import("node:fs");
    const path = await import("node:path");
    const outData = {
      benchmark: "8 Concurrent Full Browser Scans",
      timestamp: new Date().toISOString(),
      targetsCount: targets.length,
      totalWallClockMs: totalDurationMs,
      averageDurationMs: results.reduce((a, b) => a + b.durationMs, 0) / results.length,
      peakRssMb: parseFloat((maxRss / (1024 * 1024)).toFixed(1)),
      peakHeapUsedMb: parseFloat((maxHeapUsed / (1024 * 1024)).toFixed(1)),
      results
    };

    fs.writeFileSync(path.resolve(process.cwd(), "data/benchmark_8_concurrent_full_scans.json"), JSON.stringify(outData, null, 2));
    console.log("Saved raw benchmark data to data/benchmark_8_concurrent_full_scans.json");
    process.exit(0);
  } catch (e) {
    clearInterval(memSampler);
    console.error("Benchmark failed with error:", e);
    process.exit(1);
  }
}

run8FullBrowserScans();
