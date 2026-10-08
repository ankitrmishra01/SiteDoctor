import { chromium } from "playwright";
import path from "node:path";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const artifactDir = "C:/Users/ankit/.gemini/antigravity/brain/7afcafdb-6c52-4337-bf52-4c8637040da6";

  // Mock scan payloads
  const fullScanResult = {
    jobId: "scan_full_123",
    targetUrl: "https://www.rust-lang.org",
    scanType: "both",
    status: "completed",
    scanCompleteness: "full",
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 32400,
    healthScore: 73,
    scoreFormula: "Score = 100 - sum(min(25, cat_penalty)) [Total Penalty: 27 pts => 73/100]",
    summaryCounts: { critical: 0, warning: 5, info: 2, pass: 8, total: 15 },
    detectedStack: {
      server: "cloudflare",
      framework: "unknown",
      language: "rust",
      confidence: "high",
      detectedSignals: ["Server: cloudflare", "HTML Rust layout"],
      summary: "Rust / Cloudflare"
    },
    findings: [
      {
        id: "f1",
        ruleId: "SEC_HSTS_MISSING",
        category: "security",
        severity: "warning",
        title: "Missing Strict-Transport-Security (HSTS) Header",
        plainEnglishCause: "Server does not enforce HTTPS connections via HSTS.",
        isVerified: true,
        fixSteps: []
      },
      {
        id: "f2",
        ruleId: "SEC_CSP_MISSING",
        category: "security",
        severity: "warning",
        title: "Missing Content-Security-Policy (CSP) Header",
        plainEnglishCause: "Content-Security-Policy header is absent.",
        isVerified: true,
        fixSteps: []
      }
    ],
    rawMetrics: {
      pageLoad: { httpStatus: 200, loadTimeMs: 1420 },
      ssl: { valid: true, issuer: "Cloudflare Inc ECC CA-3", daysRemaining: 84 },
      accessibility: { violationsCount: 2, passesCount: 24 }
    }
  };

  const partialScanResult = {
    jobId: "scan_partial_456",
    targetUrl: "https://www.etsy.com",
    scanType: "both",
    status: "completed",
    scanCompleteness: "partial_backend_only",
    completenessNotice: "Partial scan — Frontend browser unreachable/blocked (Cloudflare / Akamai bot-wall challenge). Findings and health score reflect backend HTTP/TLS probes only. Core Web Vitals & DOM accessibility audits were skipped.",
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 1272,
    healthScore: 98,
    scoreFormula: "Score = 100 - sum(min(25, cat_penalty)) [Total Penalty: 2 pts => 98/100]",
    summaryCounts: { critical: 0, warning: 0, info: 2, pass: 10, total: 12 },
    detectedStack: {
      server: "akamai",
      framework: "react",
      language: "php",
      confidence: "medium",
      detectedSignals: ["Akamai Perimeter Defense"],
      summary: "React / Akamai Edge"
    },
    findings: [
      {
        id: "f3",
        ruleId: "SEO_SITEMAP_MISSING",
        category: "seo",
        severity: "info",
        title: "Sitemap XML Not Detected on Standard Path",
        plainEnglishCause: "Standard /sitemap.xml returned HTTP 404.",
        isVerified: true,
        fixSteps: []
      },
      {
        id: "f4",
        ruleId: "LIGHT_LOAD_BLOCKED_BY_WAF",
        category: "backend",
        severity: "info",
        title: "Light Concurrency Probes Intercepted by Bot-Protection / WAF",
        plainEnglishCause: "Requests were safely blocked by perimeter WAF rate-limiting.",
        isVerified: true,
        fixSteps: []
      }
    ],
    rawMetrics: {
      ssl: { valid: true, issuer: "DigiCert TLS RSA SHA256 2020 CA1", daysRemaining: 182 },
      securityHeaders: { "strict-transport-security": "max-age=31536000", "x-content-type-options": "nosniff" }
    }
  };

  // 1. Render Full Scan on dev server or inject state
  console.log("Navigating to http://localhost:5173...");
  await page.goto("http://localhost:5173", { waitUntil: "networkidle" }).catch(async () => {
    console.log("Local Vite server not active on 5173, opening index directly...");
  });

  // Inject Full Scan
  await page.evaluate((full) => {
    localStorage.setItem("sitedoctor-history", JSON.stringify([full]));
    // @ts-ignore
    window.__mockSetCurrentScan?.(full);
  }, fullScanResult);

  // Reload with state
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Take Full Scan Screenshot
  const fullPath = path.resolve(artifactDir, "screenshot_full_scan_score.png");
  await page.screenshot({ path: fullPath, fullPage: false });
  console.log(`Saved Full Scan Screenshot to: ${fullPath}`);

  // Inject Partial Scan
  await page.evaluate((partial) => {
    localStorage.setItem("sitedoctor-history", JSON.stringify([partial]));
    // @ts-ignore
    window.__mockSetCurrentScan?.(partial);
  }, partialScanResult);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Take Partial Scan Screenshot
  const partialPath = path.resolve(artifactDir, "screenshot_provisional_partial_scan_score.png");
  await page.screenshot({ path: partialPath, fullPage: false });
  console.log(`Saved Provisional Partial Scan Screenshot to: ${partialPath}`);

  await browser.close();
}

main().catch(console.error);
