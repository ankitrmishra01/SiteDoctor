import { StackDetector } from "../src/diagnostics/stackDetector.js";
import { DiagnosticsEngine } from "../src/diagnostics/engine.js";
import { BackendScanner } from "../src/scanners/backend.scanner.js";
import { FrontendScanner } from "../src/scanners/frontend.scanner.js";
import fs from "node:fs";

async function scanAndExtractCsp(url: string) {
  console.log(`Scanning ${url}...`);
  let beResult: any = null;
  let feResult: any = null;

  try {
    beResult = await BackendScanner.scan(url);
  } catch (err: any) {
    console.warn(`Backend scan note: ${err.message}`);
  }

  try {
    feResult = await FrontendScanner.scan(url);
  } catch (err: any) {
    console.warn(`Frontend scan note: ${err.message}`);
  }

  const detectedStack = StackDetector.detect({
    headers: beResult?.rawHeaders || beResult?.securityHeaders,
    htmlContent: feResult?.stackSignals?.htmlContent,
    cookies: feResult?.stackSignals?.cookies,
    generatorMeta: feResult?.stackSignals?.generatorMeta
  });

  // Specifically map the SEC_CSP_MISSING rule under this detected stack
  const cspFinding = DiagnosticsEngine.mapFinding({
    ruleId: "SEC_CSP_MISSING",
    category: "security",
    severity: "warning",
    technicalDetails: `Content-Security-Policy header is absent on ${url}`
  }, detectedStack);

  const hstsFinding = DiagnosticsEngine.mapFinding({
    ruleId: "SEC_HSTS_MISSING",
    category: "security",
    severity: "warning",
    technicalDetails: `Strict-Transport-Security header is absent on ${url}`
  }, detectedStack);

  const serverLeakFinding = DiagnosticsEngine.mapFinding({
    ruleId: "SEC_SERVER_HEADER_LEAK",
    category: "security",
    severity: "info",
    technicalDetails: `Server header leaked on ${url}: ${beResult?.rawHeaders?.["server"] || "unknown"}`
  }, detectedStack);

  return {
    url,
    detectedStack,
    cspFinding,
    hstsFinding,
    serverLeakFinding
  };
}

async function main() {
  console.log("===============================================================================");
  console.log("EVALUATING 3 REAL SITES WITH 3 DIFFERENT REAL STACKS");
  console.log("===============================================================================");

  // Example 1: Nginx Server
  const ex1 = await scanAndExtractCsp("https://www.fsf.org");

  // Example 2: Next.js on Vercel
  const ex2 = await scanAndExtractCsp("https://nextjs.org");

  // Example 3: Unidentified / Generic Server (httpbin.org or unadvertised host)
  const ex3 = await scanAndExtractCsp("https://httpbin.org");

  const comparison = {
    example1_nginx: ex1,
    example2_nextjs_vercel: ex2,
    example3_generic: ex3
  };

  fs.writeFileSync("data/3_stack_comparison.json", JSON.stringify(comparison, null, 2));
  console.log("3 Stack Comparison saved to data/3_stack_comparison.json");
}

main().catch(console.error);
