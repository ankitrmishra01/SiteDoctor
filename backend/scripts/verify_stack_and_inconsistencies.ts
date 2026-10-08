import { StackDetector } from "../src/diagnostics/stackDetector.js";
import { DiagnosticsEngine } from "../src/diagnostics/engine.js";
import { BackendScanner } from "../src/scanners/backend.scanner.js";
import { FrontendScanner } from "../src/scanners/frontend.scanner.js";
import { SslScanner } from "../src/scanners/ssl.scanner.js";
import fs from "node:fs";

async function runScanForTarget(targetUrl: string, type: "frontend" | "backend" | "both" = "both") {
  console.log(`\nScanning ${targetUrl}...`);
  const allFindings = [];
  let feResult: any = null;
  let beResult: any = null;

  try {
    const ssl = await SslScanner.scan(targetUrl);
    allFindings.push(...ssl.findings);
  } catch {}

  try {
    feResult = await FrontendScanner.scan(targetUrl);
    allFindings.push(...feResult.findings);
  } catch (err: any) {
    console.warn(`  Frontend scan note for ${targetUrl}: ${err.message}`);
  }

  try {
    beResult = await BackendScanner.scan(targetUrl);
    allFindings.push(...beResult.findings);
  } catch (err: any) {
    console.warn(`  Backend scan note for ${targetUrl}: ${err.message}`);
  }

  const detectedStack = StackDetector.detect({
    headers: beResult?.rawHeaders || beResult?.securityHeaders,
    htmlContent: feResult?.stackSignals?.htmlContent,
    cookies: feResult?.stackSignals?.cookies,
    generatorMeta: feResult?.stackSignals?.generatorMeta
  });

  const calibratedFindings = DiagnosticsEngine.applyStackToFindings(allFindings, detectedStack);
  const scoreResult = DiagnosticsEngine.calculateHealthScore(calibratedFindings);

  return {
    url: targetUrl,
    detectedStack,
    scoreResult,
    findings: calibratedFindings
  };
}

async function main() {
  console.log("===============================================================================");
  console.log("PART 1: RESOLVING DATA INCONSISTENCIES (fsf.org & gnu.org)");
  console.log("===============================================================================");

  // 1. FSF.org
  console.log("1. Re-scanning https://www.fsf.org ...");
  const fsfResult = await runScanForTarget("https://www.fsf.org");
  console.log(`FSF Score: ${fsfResult.scoreResult.score}/100 (Formula: ${fsfResult.scoreResult.formula})`);
  console.log(`FSF Detected Stack:`, JSON.stringify(fsfResult.detectedStack, null, 2));
  fs.writeFileSync("data/fsf_live_scan.json", JSON.stringify(fsfResult, null, 2));

  // 2. GNU.org
  console.log("\n2. Re-scanning https://www.gnu.org ...");
  try {
    const gnuResult = await runScanForTarget("https://www.gnu.org");
    console.log(`GNU Score: ${gnuResult.scoreResult.score}/100`);
    fs.writeFileSync("data/gnu_live_scan.json", JSON.stringify(gnuResult, null, 2));
  } catch (err: any) {
    console.log(`GNU Error encountered:`, err.message);
    fs.writeFileSync("data/gnu_live_scan.json", JSON.stringify({ error: err.message, stack: err.stack }, null, 2));
  }

  console.log("\n===============================================================================");
  console.log("PART 2: 3 REAL SITES WITH 3 DIFFERENT DETECTED STACKS (CSP / Security Headers)");
  console.log("===============================================================================");

  // Test Site A: Next.js on Vercel
  const siteA = await runScanForTarget("https://vite.dev");
  const siteB = await runScanForTarget("https://fastapi.tiangolo.com");
  const siteC = await runScanForTarget("https://developer.mozilla.org");

  const results = {
    fsf: fsfResult,
    siteA,
    siteB,
    siteC
  };

  fs.writeFileSync("data/track1_examples.json", JSON.stringify(results, null, 2));
  console.log("Saved Track 1 and Inconsistency results to data/track1_examples.json and data/fsf_live_scan.json");
}

main().catch(console.error);
