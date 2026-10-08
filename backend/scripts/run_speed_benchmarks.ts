import { ScanQueueManager } from "../src/queue/scanQueue.js";
import { FrontendScanner } from "../src/scanners/frontend.scanner.js";
import { BackendScanner } from "../src/scanners/backend.scanner.js";
import { SslScanner } from "../src/scanners/ssl.scanner.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runBenchmarks() {
  console.log("=== STARTING SPEED & ACCURACY BENCHMARK SUITE ===");
  const targets = [
    { url: "https://developer.mozilla.org", name: "MDN Docs (Complex SSR + Static)" },
    { url: "https://vite.dev", name: "Vite Docs (Fast SPA / Static)" },
    { url: "https://github.com", name: "GitHub (High Security / Large DOM)" }
  ];

  const results: any[] = [];
  const scanQueue = ScanQueueManager.getInstance();

  for (const target of targets) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Scanning: ${target.url} (${target.name})`);

    // Measure isolated stage durations
    console.log(`- Running isolated SSL scan...`);
    const sslStart = Date.now();
    await SslScanner.scan(target.url);
    const sslDuration = Date.now() - sslStart;

    console.log(`- Running isolated Frontend scan...`);
    const feStart = Date.now();
    await FrontendScanner.scan(target.url);
    const feDuration = Date.now() - feStart;

    console.log(`- Running isolated Backend scan...`);
    const beStart = Date.now();
    await BackendScanner.scan(target.url);
    const beDuration = Date.now() - beStart;

    // Run combined parallel scan through the engine queue
    console.log(`- Running parallelized engine scan...`);
    const parallelStart = Date.now();
    const fullScan = await scanQueue.executeDirect({
      url: target.url,
      type: "both",
      consent: true
    });
    const parallelTotalDuration = Date.now() - parallelStart;

    const sequentialSum = sslDuration + feDuration + beDuration;
    const speedup = (sequentialSum / parallelTotalDuration).toFixed(2);

    console.log(`[RESULTS] Target: ${target.url}`);
    console.log(`- SSL Stage (isolated): ${sslDuration}ms`);
    console.log(`- Frontend Stage (isolated): ${feDuration}ms`);
    console.log(`- Backend Stage (isolated): ${beDuration}ms`);
    console.log(`- Sequential Sum: ${sequentialSum}ms`);
    console.log(`- Parallel Engine Total: ${parallelTotalDuration}ms (Speedup: ${speedup}x)`);
    console.log(`- Health Score: ${fullScan.healthScore}/100`);
    console.log(`- Total Findings: ${fullScan.findings.length}`);
    console.log(`- Detected Stacks: ${JSON.stringify(fullScan.detectedStacks || [])}`);

    results.push({
      target: target.url,
      name: target.name,
      isolatedTimings: {
        sslMs: sslDuration,
        frontendMs: feDuration,
        backendMs: beDuration,
        sequentialSumMs: sequentialSum
      },
      parallelEngineTimingMs: parallelTotalDuration,
      speedupFactor: `${speedup}x`,
      scanResult: {
        id: fullScan.id,
        targetUrl: fullScan.targetUrl,
        healthScore: fullScan.healthScore,
        categoryScores: fullScan.categoryScores,
        detectedStacks: fullScan.detectedStacks,
        findingsCount: fullScan.findings.length,
        findings: fullScan.findings
      }
    });
  }

  const outPath = path.resolve(__dirname, "../data/speed_and_mdn_benchmark.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nWrote complete results to ${outPath}`);
}

runBenchmarks().catch(err => {
  console.error("Benchmark error:", err);
  process.exit(1);
});
