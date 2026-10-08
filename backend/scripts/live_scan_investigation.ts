import { ScanQueueManager } from "../src/queue/scanQueue.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runLiveInvestigation() {
  console.log("================================================================================");
  console.log("LIVE SCAN INVESTIGATION: ETSY, EBAY, BBC, BERKSHIRE HATHAWAY");
  console.log("================================================================================");

  const manager = ScanQueueManager.getInstance();

  const targets = [
    { name: "etsy", url: "https://www.etsy.com" },
    { name: "ebay", url: "https://www.ebay.com" },
    { name: "bbc", url: "https://www.bbc.com" },
    { name: "berkshire", url: "http://berkshirehathaway.com" }
  ];

  const results: Record<string, any> = {};

  for (const t of targets) {
    console.log(`\n>>> Scanning ${t.name} (${t.url})...`);
    const start = performance.now();
    try {
      const result = await manager.executeDirect({
        url: t.url,
        type: "both",
        consent: true
      });
      const durationMs = Math.round(performance.now() - start);

      results[t.name] = {
        url: t.url,
        status: result.status,
        healthScore: result.healthScore,
        errorReason: (result as any).errorReason || (result as any).unreachableReason || null,
        durationMs,
        startedAt: result.startedAt,
        detectedStack: result.detectedStack,
        findingsCount: result.findings.length,
        summaryCounts: result.summaryCounts,
        rawMetricsSummary: {
          sslValid: result.rawMetrics.ssl?.valid,
          httpStatus: result.rawMetrics.pageLoad?.httpStatus,
          a11yViolations: result.rawMetrics.accessibility?.violationsCount
        },
        rawResult: result
      };

      console.log(`✓ Result for ${t.name}: Status=${result.status}, Score=${result.healthScore}, Findings=${result.findings.length}, Duration=${durationMs}ms`);
      if (result.detectedStack) {
        console.log(`  Stack:`, JSON.stringify(result.detectedStack));
      }
      if (result.status === "failed_unreachable" || result.status === "failed_error") {
        console.log(`  Failure Reason:`, (result as any).unreachableReason || (result as any).errorReason);
      }
    } catch (err: any) {
      console.error(`✗ Exception during scan of ${t.name}:`, err.message);
      results[t.name] = {
        url: t.url,
        status: "exception",
        error: err.message
      };
    }
  }

  const outPath = path.resolve(__dirname, "../data/live_scan_investigation_results.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
  console.log("\nSaved live scan investigation results to:", outPath);
}

runLiveInvestigation().catch(console.error);
