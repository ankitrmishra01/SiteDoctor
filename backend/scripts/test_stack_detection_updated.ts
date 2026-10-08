import { ScanQueueManager } from "../src/queue/scanQueue.js";
import { SslScanner } from "../src/scanners/ssl.scanner.js";
import { FrontendScanner } from "../src/scanners/frontend.scanner.js";
import { BackendScanner } from "../src/scanners/backend.scanner.js";
import { StackDetector } from "../src/diagnostics/stackDetector.js";
import { DiagnosticsEngine } from "../src/diagnostics/engine.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testUpdatedStacks() {
  console.log("=== TESTING UPDATED STACK DETECTION & REMEDIATIONS ===");
  const targets = [
    "https://fsf.org",
    "https://nextjs.org",
    "https://httpbin.org",
    "https://datadoghq.com"
  ];

  const scanQueue = ScanQueueManager.getInstance();
  const outputs: any = {};

  for (const url of targets) {
    console.log(`Scanning ${url}...`);
    const scanResult = await scanQueue.executeDirect({
      url,
      type: "both",
      consent: true
    });

    const cspFinding = scanResult.findings.find(f => f.ruleId === "SEC_CSP_MISSING");
    const hstsFinding = scanResult.findings.find(f => f.ruleId === "SEC_HSTS_MISSING");
    const anyFinding = scanResult.findings[0];

    outputs[url] = {
      url: scanResult.targetUrl,
      healthScore: scanResult.healthScore,
      detectedStack: scanResult.detectedStack,
      findingsCount: scanResult.findings.length,
      sampleCspFinding: cspFinding || anyFinding,
      sampleHstsFinding: hstsFinding
    };
  }

  const outPath = path.resolve(__dirname, "../data/updated_stack_test_results.json");
  fs.writeFileSync(outPath, JSON.stringify(outputs, null, 2));
  console.log(`Wrote test results to ${outPath}`);
}

testUpdatedStacks().catch(console.error);
