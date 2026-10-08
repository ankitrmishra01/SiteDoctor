import { ScanQueueManager } from "../src/queue/scanQueue.js";

async function testPartialScan() {
  console.log("=== Testing Real Partial Scan Execution on Etsy.com ===");
  const manager = ScanQueueManager.getInstance();

  const result = await manager.executeDirect({
    url: "https://www.etsy.com",
    type: "both",
    consent: true
  });

  console.log("\nResult Object:");
  console.log("Status:", result.status);
  console.log("Scan Completeness:", result.scanCompleteness);
  console.log("Completeness Notice:", result.completenessNotice);
  console.log("Health Score:", result.healthScore);
  console.log("Findings Count:", result.findings.length);
  console.log("Summary Counts:", result.summaryCounts);
  console.log("\nFull JSON Summary:");
  console.log(JSON.stringify({
    jobId: result.jobId,
    targetUrl: result.targetUrl,
    status: result.status,
    scanCompleteness: result.scanCompleteness,
    completenessNotice: result.completenessNotice,
    healthScore: result.healthScore,
    durationMs: result.durationMs,
    findingsCount: result.findings.length,
    summaryCounts: result.summaryCounts,
    rawMetrics: {
      ssl: result.rawMetrics.ssl,
      securityHeaders: result.rawMetrics.securityHeaders,
      cors: result.rawMetrics.cors,
      endpointsDiscovered: result.rawMetrics.endpointsDiscovered?.slice(0, 3)
    }
  }, null, 2));
}

testPartialScan().catch(console.error);
