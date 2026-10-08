import { ScanQueueManager } from "../src/queue/scanQueue.js";

async function testEtsyWafClassification() {
  console.log("=== Testing Etsy.com Scan with New WAF vs Server Error Logic ===");
  const manager = ScanQueueManager.getInstance();

  const result = await manager.executeDirect({
    url: "https://www.etsy.com",
    type: "both",
    consent: true
  });

  console.log("\nScan Result:");
  console.log("Target:", result.targetUrl);
  console.log("Status:", result.status);
  console.log("Scan Completeness:", result.scanCompleteness);
  console.log("Health Score:", result.healthScore);
  console.log("Summary Counts:", result.summaryCounts);
  console.log("\nFindings Array:");
  for (const f of result.findings) {
    console.log(`\n- [${f.ruleId}] Category: ${f.category}, Severity: ${f.severity}, Effort: ${f.effort}`);
    console.log(`  Title: ${f.title}`);
    console.log(`  Cause: ${f.plainEnglishCause}`);
    console.log(`  Technical Details: ${f.technicalDetails}`);
  }

  const hasWafFinding = result.findings.some(f => f.ruleId === "LIGHT_LOAD_BLOCKED_BY_WAF");
  const hasCapacityFinding = result.findings.some(f => f.ruleId === "LIGHT_LOAD_ERROR_RATE");

  console.log("\n=== Accuracy Verification ===");
  console.log("Triggered LIGHT_LOAD_BLOCKED_BY_WAF (info):", hasWafFinding);
  console.log("Triggered LIGHT_LOAD_ERROR_RATE (critical capacity bug):", hasCapacityFinding);
  console.log("Correct Classification:", hasWafFinding && !hasCapacityFinding);
}

testEtsyWafClassification().catch(console.error);
