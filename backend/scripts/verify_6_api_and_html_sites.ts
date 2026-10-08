import { ScanQueueManager } from "../src/queue/scanQueue.js";
import { BackendScanner } from "../src/scanners/backend.scanner.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTest() {
  console.log("================================================================================");
  console.log("ITEM 1: VERIFICATION OF 6 TARGETS (3 APIS ON NON-API HOSTNAMES vs 3 HTML SITES)");
  console.log("================================================================================\n");

  const targets = [
    // 3 Real APIs on non-"api." hostnames
    { name: "httpbin.org (API)", url: "https://httpbin.org/json", isApiExpected: true, scanType: "backend" as const },
    { name: "dummyjson.com (API)", url: "https://dummyjson.com/products", isApiExpected: true, scanType: "backend" as const },
    { name: "pokeapi.co (API)", url: "https://pokeapi.co/api/v2/pokemon", isApiExpected: true, scanType: "backend" as const },
    // 3 HTML Websites
    { name: "etsy.com (HTML Website)", url: "https://www.etsy.com", isApiExpected: false, scanType: "both" as const },
    { name: "rust-lang.org (HTML Website)", url: "https://www.rust-lang.org", isApiExpected: false, scanType: "both" as const },
    { name: "berkshirehathaway.com (HTML Website)", url: "https://www.berkshirehathaway.com", isApiExpected: false, scanType: "both" as const }
  ];

  const results: any[] = [];
  const queue = ScanQueueManager.getInstance();

  for (const t of targets) {
    console.log(`\nScanning: ${t.name} (${t.url}) [Expected API Target: ${t.isApiExpected}]...`);
    
    // Test direct backend scanner classification
    const beResult = await BackendScanner.scan(t.url, undefined, t.scanType === "backend");
    const scanRes = await queue.executeDirect({
      url: t.url,
      type: t.scanType,
      consent: true
    });

    const ruleIds = scanRes.findings.map(f => f.ruleId);
    const corsMissingFired = ruleIds.includes("CORS_MISSING");

    // Raw classification
    const classification = t.scanType === "backend" || (beResult.rawHeaders["content-type"] || "").includes("json") ? "API Target" : "HTML Website";

    console.log(`  -> Status: ${scanRes.status} | Completeness: ${scanRes.scanCompleteness}`);
    console.log(`  -> Health Score: ${scanRes.healthScore}/100`);
    console.log(`  -> Score Formula: ${scanRes.scoreFormula}`);
    console.log(`  -> Findings Count: ${scanRes.findings.length} (${ruleIds.join(", ") || "None"})`);
    console.log(`  -> CORS_MISSING Fired?: ${corsMissingFired}`);
    console.log(`  -> Classification Match?: ${t.isApiExpected ? (classification === "API Target") : (classification === "HTML Website")}`);

    results.push({
      name: t.name,
      url: t.url,
      scanType: t.scanType,
      expectedIsApi: t.isApiExpected,
      detectedClassification: classification,
      healthScore: scanRes.healthScore,
      scoreFormula: scanRes.scoreFormula,
      completeness: scanRes.scanCompleteness,
      findingsCount: scanRes.findings.length,
      findingRuleIds: ruleIds,
      corsMissingFired,
      rawMetrics: {
        httpStatus: scanRes.rawMetrics?.pageLoad?.httpStatus,
        contentType: beResult.rawHeaders["content-type"],
        cors: scanRes.rawMetrics?.cors,
        sslValid: scanRes.rawMetrics?.ssl?.valid
      }
    });
  }

  const outPath = path.resolve(__dirname, "../data/six_sites_api_classification_audit.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\nResults saved to: ${outPath}`);
}

runTest().catch(console.error);
