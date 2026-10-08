import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const artifactDir = "C:\\Users\\ankit\\.gemini\\antigravity\\brain\\7afcafdb-6c52-4337-bf52-4c8637040da6";
const repoScreenshotsDir = path.resolve(process.cwd(), "../screenshots");

fs.mkdirSync(artifactDir, { recursive: true });
fs.mkdirSync(repoScreenshotsDir, { recursive: true });

const fullScanResult = {
  jobId: "scan_full_rust",
  targetUrl: "https://www.rust-lang.org",
  scanType: "both",
  status: "completed",
  scanCompleteness: "full",
  startedAt: new Date(Date.now() - 32400).toISOString(),
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
    summary: "Rust / Cloudflare Edge"
  },
  findings: [
    {
      id: "f1",
      ruleId: "SEC_HSTS_MISSING",
      category: "security",
      severity: "warning",
      title: "Missing Strict-Transport-Security (HSTS) Header",
      plainEnglishCause: "The server does not send the Strict-Transport-Security response header to enforce HTTPS-only connections on repeat visits.",
      impact: "Vulnerable to man-in-the-middle downgrade attacks (SSL stripping).",
      isVerified: true,
      priority: "quick_win",
      fixSteps: [
        { stepNumber: 1, action: "Add Strict-Transport-Security header in edge or reverse proxy config." }
      ],
      codeDiffSnippet: {
        language: "nginx",
        filePath: "nginx.conf",
        originalSnippet: "server {\n  listen 443 ssl http2;\n  server_name rust-lang.org;\n}",
        proposedSnippet: "server {\n  listen 443 ssl http2;\n  server_name rust-lang.org;\n  add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;\n}",
        diffString: "@@ -1,4 +1,5 @@\n server {\n   listen 443 ssl http2;\n   server_name rust-lang.org;\n+  add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;\n }"
      }
    },
    {
      id: "f2",
      ruleId: "SEC_CSP_MISSING",
      category: "security",
      severity: "warning",
      title: "Missing Content-Security-Policy (CSP) Header",
      plainEnglishCause: "No Content-Security-Policy header was detected on the root HTTP response.",
      impact: "Increases risk of Cross-Site Scripting (XSS) and unauthorized script injection.",
      isVerified: true,
      priority: "plan_next",
      fixSteps: [
        { stepNumber: 1, action: "Define CSP directives matching domain script and style origins." }
      ]
    },
    {
      id: "f3",
      ruleId: "SEC_XFO_MISSING",
      category: "security",
      severity: "warning",
      title: "Missing X-Frame-Options Header",
      plainEnglishCause: "Server does not restrict iframe embedding.",
      impact: "May allow clickjacking attacks.",
      isVerified: true,
      priority: "quick_win",
      fixSteps: []
    },
    {
      id: "f4",
      ruleId: "SEO_SITEMAP_MISSING",
      category: "seo",
      severity: "info",
      title: "Sitemap XML Not Detected on Default Path",
      plainEnglishCause: "Standard /sitemap.xml returned HTTP 404.",
      impact: "Search engine crawlers may index new pages more slowly.",
      isVerified: true,
      priority: "nice_to_have",
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
  jobId: "scan_partial_etsy",
  targetUrl: "https://www.etsy.com",
  scanType: "both",
  status: "completed",
  scanCompleteness: "partial_backend_only",
  completenessNotice: "Partial scan — Frontend browser unreachable/blocked (Cloudflare / Akamai bot-wall challenge). Findings and health score reflect backend HTTP/TLS probes only. Core Web Vitals & DOM accessibility audits were skipped.",
  startedAt: new Date(Date.now() - 1272).toISOString(),
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
    detectedSignals: ["Akamai Edge Perimeter", "React hydrate bundles"],
    summary: "React / Akamai Edge"
  },
  findings: [
    {
      id: "p1",
      ruleId: "SEO_SITEMAP_MISSING",
      category: "seo",
      severity: "info",
      title: "Sitemap XML Not Detected on Default Path",
      plainEnglishCause: "Standard /sitemap.xml returned HTTP 404.",
      impact: "May affect search crawler discovery velocity.",
      isVerified: true,
      priority: "nice_to_have",
      fixSteps: []
    },
    {
      id: "p2",
      ruleId: "LIGHT_LOAD_BLOCKED_BY_WAF",
      category: "backend",
      severity: "info",
      title: "Light Concurrency Probes Intercepted by Bot-Protection / WAF",
      plainEnglishCause: "Synthetic concurrency requests were safely blocked by perimeter WAF rate-limiting.",
      impact: "Indicates active perimeter security defense.",
      isVerified: true,
      priority: "nice_to_have",
      fixSteps: []
    }
  ],
  rawMetrics: {
    ssl: { valid: true, issuer: "DigiCert TLS RSA SHA256 2020 CA1", daysRemaining: 182 },
    securityHeaders: { "strict-transport-security": "max-age=31536000", "x-content-type-options": "nosniff" }
  }
};

async function saveToBoth(page: any, baseName: string, fullPage: boolean = false) {
  const artPath = path.join(artifactDir, `${baseName}.png`);
  const repoPath = path.join(repoScreenshotsDir, `${baseName}.png`);
  await page.screenshot({ path: artPath, fullPage });
  await page.screenshot({ path: repoPath, fullPage });
  console.log(`Saved screenshot: ${baseName}.png`);
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  // Desktop Viewport
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  console.log("Navigating to frontend at http://localhost:5173...");
  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // 1. FULL SCAN - DARK MODE
  console.log("Rendering Full Scan (Dark Mode)...");
  await page.evaluate((full) => {
    const store = (window as any).useScanStore.getState();
    store.setTheme("dark");
    store.loadScanResult(full);
  }, fullScanResult);
  await page.waitForTimeout(800);
  await saveToBoth(page, "screenshot_dark_control_room", false);
  await saveToBoth(page, "screenshot_full_scan_score", false);

  // 2. FULL SCAN - LIGHT MODE
  console.log("Rendering Full Scan (Light Mode)...");
  await page.evaluate(() => {
    const store = (window as any).useScanStore.getState();
    store.setTheme("light");
  });
  await page.waitForTimeout(600);
  await saveToBoth(page, "screenshot_light_ops_daylight", false);

  // 3. PROVISIONAL PARTIAL SCAN - DARK MODE
  console.log("Rendering Provisional Partial Scan (Dark Mode)...");
  await page.evaluate((partial) => {
    const store = (window as any).useScanStore.getState();
    store.setTheme("dark");
    store.loadScanResult(partial);
  }, partialScanResult);
  await page.waitForTimeout(800);
  await saveToBoth(page, "screenshot_provisional_partial_scan_score", false);

  // 4. OPEN CODE FIX MODAL
  console.log("Rendering GitHub Code-Aware Fix Modal...");
  await page.evaluate((full) => {
    const store = (window as any).useScanStore.getState();
    store.loadScanResult(full);
  }, fullScanResult);
  await page.waitForTimeout(400);

  // Click on the first fix button / PR preview if present
  const fixBtn = page.locator("button:has-text('Fix via GitHub PR')").first();
  if (await fixBtn.isVisible()) {
    await fixBtn.click();
    await page.waitForTimeout(600);
    await saveToBoth(page, "screenshot_github_fix_modal", false);
    // Close modal
    const closeBtn = page.locator("button:has-text('Cancel')").or(page.locator(".modal-close")).first();
    if (await closeBtn.isVisible()) await closeBtn.click();
    await page.waitForTimeout(300);
  }

  // 5. MOBILE 375px VIEWPORT
  console.log("Capturing Mobile 375px views...");
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto("http://localhost:5173", { waitUntil: "networkidle" });

  // Mobile Dark
  await mobilePage.evaluate((full) => {
    const store = (window as any).useScanStore.getState();
    store.setTheme("dark");
    store.loadScanResult(full);
  }, fullScanResult);
  await mobilePage.waitForTimeout(800);
  await saveToBoth(mobilePage, "screenshot_mobile_375_dark", false);

  // Mobile Light
  await mobilePage.evaluate(() => {
    const store = (window as any).useScanStore.getState();
    store.setTheme("light");
  });
  await mobilePage.waitForTimeout(600);
  await saveToBoth(mobilePage, "screenshot_mobile_375_light", false);

  await browser.close();
  console.log("\nAll screenshots successfully captured and saved to both artifact and repo directories!");
}

run().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
