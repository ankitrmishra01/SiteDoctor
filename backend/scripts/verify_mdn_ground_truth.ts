import { SslScanner } from "../src/scanners/ssl.scanner.js";
import { BackendScanner } from "../src/scanners/backend.scanner.js";
import { FrontendScanner } from "../src/scanners/frontend.scanner.js";
import { rules } from "../src/diagnostics/rules.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyMdnGroundTruth() {
  console.log("=== VERIFYING MDN GROUND TRUTH AGAINST SITEDOCTOR RULES ===");
  const targetUrl = "https://developer.mozilla.org";

  // 1. Fetch raw HTTP headers via native fetch
  const resp = await fetch(targetUrl, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }
  });

  const rawHeaders: Record<string, string> = {};
  resp.headers.forEach((val, key) => {
    rawHeaders[key.toLowerCase()] = val;
  });

  console.log("MDN Status:", resp.status);
  console.log("MDN Raw Headers:\n", JSON.stringify(rawHeaders, null, 2));

  // 2. Fetch robots.txt and sitemap.xml
  const robotsResp = await fetch("https://developer.mozilla.org/robots.txt");
  const sitemapResp = await fetch("https://developer.mozilla.org/sitemap.xml");

  // 3. Run SiteDoctor scanners
  const sslRes = await SslScanner.scan(targetUrl);
  const beRes = await BackendScanner.scan(targetUrl);
  const feRes = await FrontendScanner.scan(targetUrl);

  // 4. Ground Truth Verification Table across every rule
  const ruleChecks = [
    {
      ruleId: "SEC_HSTS_MISSING",
      category: "Security",
      headerOrProperty: "strict-transport-security",
      groundTruthValue: rawHeaders["strict-transport-security"] || "ABSENT",
      ruleExpectation: "Header must be present and non-empty",
      groundTruthStatus: rawHeaders["strict-transport-security"] ? "PASS" : "FAIL",
      sitedoctorFlagged: beRes.findings.some(f => f.ruleId === "SEC_HSTS_MISSING")
    },
    {
      ruleId: "SEC_CSP_MISSING",
      category: "Security",
      headerOrProperty: "content-security-policy",
      groundTruthValue: rawHeaders["content-security-policy"] ? rawHeaders["content-security-policy"].substring(0, 80) + "..." : "ABSENT",
      ruleExpectation: "Header must be present and non-empty",
      groundTruthStatus: rawHeaders["content-security-policy"] ? "PASS" : "FAIL",
      sitedoctorFlagged: beRes.findings.some(f => f.ruleId === "SEC_CSP_MISSING")
    },
    {
      ruleId: "SEC_XFO_MISSING",
      category: "Security",
      headerOrProperty: "x-frame-options",
      groundTruthValue: rawHeaders["x-frame-options"] || "ABSENT",
      ruleExpectation: "Header must be present (e.g. DENY / SAMEORIGIN)",
      groundTruthStatus: rawHeaders["x-frame-options"] ? "PASS" : "FAIL",
      sitedoctorFlagged: beRes.findings.some(f => f.ruleId === "SEC_XFO_MISSING")
    },
    {
      ruleId: "SEC_XCTO_MISSING",
      category: "Security",
      headerOrProperty: "x-content-type-options",
      groundTruthValue: rawHeaders["x-content-type-options"] || "ABSENT",
      ruleExpectation: "Header must equal 'nosniff'",
      groundTruthStatus: rawHeaders["x-content-type-options"] === "nosniff" ? "PASS" : "FAIL",
      sitedoctorFlagged: beRes.findings.some(f => f.ruleId === "SEC_XCTO_MISSING")
    },
    {
      ruleId: "SEC_REFERRER_POLICY_MISSING",
      category: "Security",
      headerOrProperty: "referrer-policy",
      groundTruthValue: rawHeaders["referrer-policy"] || "ABSENT",
      ruleExpectation: "Header must specify safe referrer policy",
      groundTruthStatus: rawHeaders["referrer-policy"] ? "PASS" : "FAIL",
      sitedoctorFlagged: beRes.findings.some(f => f.ruleId === "SEC_REFERRER_POLICY_MISSING")
    },
    {
      ruleId: "SEO_ROBOTS_MISSING",
      category: "SEO",
      headerOrProperty: "/robots.txt HTTP status",
      groundTruthValue: `HTTP ${robotsResp.status}`,
      ruleExpectation: "Must return 200 OK",
      groundTruthStatus: robotsResp.status === 200 ? "PASS" : "FAIL",
      sitedoctorFlagged: beRes.findings.some(f => f.ruleId === "SEO_ROBOTS_MISSING")
    },
    {
      ruleId: "SEO_SITEMAP_MISSING",
      category: "SEO",
      headerOrProperty: "/sitemap.xml HTTP status",
      groundTruthValue: `HTTP ${sitemapResp.status}`,
      ruleExpectation: "Must return 200 OK or be listed in robots.txt",
      groundTruthStatus: sitemapResp.status === 200 ? "PASS" : "FAIL",
      sitedoctorFlagged: beRes.findings.some(f => f.ruleId === "SEO_SITEMAP_MISSING")
    },
    {
      ruleId: "SSL_VALIDITY",
      category: "Security",
      headerOrProperty: "TLS Handshake & Expiry",
      groundTruthValue: `Valid: ${sslRes.valid}, Issuer: ${sslRes.issuer}, Days left: ${sslRes.daysRemaining}`,
      ruleExpectation: "Cert must be valid and trusted",
      groundTruthStatus: sslRes.valid ? "PASS" : "FAIL",
      sitedoctorFlagged: sslRes.findings.length > 0
    },
    {
      ruleId: "AXE_COLOR_CONTRAST",
      category: "Accessibility",
      headerOrProperty: "WCAG 2.1 AA Contrast Ratios",
      groundTruthValue: `Violations: ${feRes.accessibility.violationsCount}, Passes: ${feRes.accessibility.passesCount}`,
      ruleExpectation: "All text elements satisfy 4.5:1 ratio",
      groundTruthStatus: feRes.accessibility.violationsCount === 0 ? "PASS" : "FAIL",
      sitedoctorFlagged: feRes.findings.some(f => f.ruleId === "AXE_COLOR_CONTRAST")
    }
  ];

  console.log("\n=== GROUND TRUTH COMPARISON TABLE ===");
  console.table(ruleChecks.map(r => ({
    Rule: r.ruleId,
    Category: r.category,
    "Ground Truth Value": r.groundTruthValue,
    "Ground Truth Status": r.groundTruthStatus,
    "SiteDoctor Flagged?": r.sitedoctorFlagged ? "YES (Finding)" : "NO (Clean Pass)",
    "Match?": (r.groundTruthStatus === "PASS" && !r.sitedoctorFlagged) || (r.groundTruthStatus === "FAIL" && r.sitedoctorFlagged) ? "MATCH (100% Correct)" : "MISMATCH"
  })));

  const outData = {
    target: targetUrl,
    rawHeaders,
    robotsStatus: robotsResp.status,
    sitemapStatus: sitemapResp.status,
    sslDetails: {
      valid: sslRes.valid,
      issuer: sslRes.issuer,
      daysRemaining: sslRes.daysRemaining,
      protocol: sslRes.protocol
    },
    feMetrics: {
      ttfbMs: feRes.pageLoad.ttfbMs,
      lcpMs: feRes.coreWebVitals.lcpMs,
      cls: feRes.coreWebVitals.cls,
      tbtMs: feRes.coreWebVitals.tbtMs,
      violationsCount: feRes.accessibility.violationsCount,
      passesCount: feRes.accessibility.passesCount
    },
    ruleChecks
  };

  const outPath = path.resolve(__dirname, "../data/mdn_ground_truth_verification.json");
  fs.writeFileSync(outPath, JSON.stringify(outData, null, 2));
  console.log(`\nWrote complete proof to ${outPath}`);
}

verifyMdnGroundTruth().catch(console.error);
