import { FrontendScanner, UnreachableTargetError } from "../dist/scanners/frontend.scanner.js";
import { BackendScanner } from "../dist/scanners/backend.scanner.js";
import { SslScanner } from "../dist/scanners/ssl.scanner.js";
import { DiagnosticsEngine } from "../dist/diagnostics/engine.js";
import { HistoryStore } from "../dist/storage/history.store.js";

async function runDirectSweep() {
  console.log("Fetching public repositories for user: ankitrmishra01...");
  const res = await fetch("https://api.github.com/users/ankitrmishra01/repos?per_page=100", {
    headers: { "User-Agent": "SiteDoctor-Repo-Discovery/1.0" }
  });
  const repos = await res.json();
  if (!Array.isArray(repos)) {
    console.error("Failed to list repos:", repos);
    return;
  }

  console.log(`Found ${repos.length} public repositories.\n`);
  const projectResults = [];

  for (const repo of repos) {
    let liveUrl = repo.homepage ? repo.homepage.trim() : null;
    let source = "homepage field";

    if (!liveUrl) {
      try {
        const readmeRes = await fetch(`https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}/README.md`);
        if (readmeRes.ok) {
          const readmeText = await readmeRes.text();
          const deployMatch = readmeText.match(/https?:\/\/[^\s\)\>\]"']+(?:vercel\.app|netlify\.app|onrender\.com|render\.com|railway\.app|github\.io|pages\.dev)[^\s\)\>\]"']*/i)
            || readmeText.match(/(?:Live Demo|Live Site|Deployed at|Live URL|Website)[\s:\-–—*#\[\]\(\)]+((?:https?:\/\/)[^\s\)\>\]"']+)/i);
          if (deployMatch) {
            liveUrl = deployMatch[1] || deployMatch[0];
            source = "README deployment link";
          }
        }
      } catch {}
    }

    if (liveUrl) {
      liveUrl = liveUrl.replace(/[\)\>\]"'\.,]+$/, "").trim();
      if (!liveUrl.startsWith("http")) {
        liveUrl = "https://" + liveUrl;
      }
    }

    projectResults.push({
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      liveUrl,
      source: liveUrl ? source : "no deployment link found"
    });
  }

  console.log("=== REPOSITORY DISCOVERY LIST ===");
  for (const p of projectResults) {
    console.log(`- ${p.name}: ${p.liveUrl ? `${p.liveUrl} (${p.source})` : "no deployment link found"}`);
  }

  const activeDeployments = projectResults.filter(p => p.liveUrl);
  // Deduplicate URLs (e.g. portfolio and ankitrmishra01 point to same site)
  const uniqueDeployments = [];
  const seenUrls = new Set();
  for (const p of activeDeployments) {
    if (!seenUrls.has(p.liveUrl)) {
      seenUrls.add(p.liveUrl);
      uniqueDeployments.push(p);
    }
  }

  console.log(`\nFound ${uniqueDeployments.length} unique live deployment URLs to scan.`);

  for (const proj of uniqueDeployments) {
    console.log(`\n============================================================`);
    console.log(`Scanning Project: ${proj.name} -> ${proj.liveUrl}`);
    console.log(`============================================================`);

    const jobId = `sweep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const allFindings = [];
    const startTime = performance.now();

    const scanResult = {
      jobId,
      targetUrl: proj.liveUrl,
      scanType: "both",
      status: "running",
      startedAt: new Date().toISOString(),
      healthScore: 100,
      scoreFormula: "",
      summaryCounts: { critical: 0, warning: 0, info: 0, pass: 0, total: 0 },
      findings: [],
      rawMetrics: {}
    };

    try {
      // 1. SSL Scan
      const ssl = await SslScanner.scan(proj.liveUrl);
      scanResult.rawMetrics.ssl = ssl;
      allFindings.push(...ssl.findings);

      // 2. Frontend Scan (Playwright + Axe + CWV + Links)
      const fe = await FrontendScanner.scan(proj.liveUrl);
      scanResult.rawMetrics.pageLoad = fe.pageLoad;
      scanResult.rawMetrics.coreWebVitals = fe.coreWebVitals;
      scanResult.rawMetrics.accessibility = fe.accessibility;
      scanResult.rawMetrics.crawledLinks = fe.crawledLinks;
      allFindings.push(...fe.findings);

      // 3. Backend Scan (Headers + CORS + Discovery + Light Load)
      const be = await BackendScanner.scan(proj.liveUrl);
      scanResult.rawMetrics.securityHeaders = be.securityHeaders;
      scanResult.rawMetrics.cors = be.cors;
      scanResult.rawMetrics.endpointsDiscovered = be.endpointsDiscovered;
      scanResult.rawMetrics.lightLoad = be.lightLoad;
      allFindings.push(...be.findings);

      // 4. Score Calculation
      const { score, formula, summaryCounts } = DiagnosticsEngine.calculateHealthScore(allFindings);
      scanResult.status = "completed";
      scanResult.completedAt = new Date().toISOString();
      scanResult.durationMs = Math.round(performance.now() - startTime);
      scanResult.healthScore = score;
      scanResult.scoreFormula = formula;
      scanResult.summaryCounts = summaryCounts;
      scanResult.findings = allFindings;

      // Save to history store
      HistoryStore.getInstance().saveScan(scanResult);

      console.log(`RESULT FOR ${proj.name}:`);
      console.log(`Status: ${scanResult.status}`);
      console.log(`Health Score: ${scanResult.healthScore} / 100`);
      console.log(`Formula: ${scanResult.scoreFormula}`);
      console.log(`Metrics: TTFB=${fe.pageLoad.ttfbMs}ms, Load=${fe.pageLoad.loadTimeMs}ms, LCP=${fe.coreWebVitals.lcpMs}ms, A11y Violations=${fe.accessibility.violationsCount}, CORS=${be.cors.configured}`);
      console.log(`Summary: Critical=${summaryCounts.critical}, Warning=${summaryCounts.warning}, Info=${summaryCounts.info}, Pass=${summaryCounts.pass}`);
      console.log(`Findings (${allFindings.length}):`);
      for (const f of allFindings) {
        console.log(`  • [${f.severity.toUpperCase()}] [${f.category}] ${f.title}`);
        console.log(`    Cause: ${f.plainEnglishCause}`);
        if (f.technicalDetails) console.log(`    Evidence: ${f.technicalDetails.substring(0, 120)}`);
      }
    } catch (err) {
      if (err instanceof UnreachableTargetError) {
        scanResult.status = "failed_unreachable";
        scanResult.failureReason = err.reason;
        scanResult.healthScore = 0;
        scanResult.scoreFormula = "Scan failed: Target URL is unreachable";
        HistoryStore.getInstance().saveScan(scanResult);
        console.log(`RESULT FOR ${proj.name}:`);
        console.log(`Status: failed_unreachable`);
        console.log(`Failure Reason: ${err.reason}`);
      } else {
        scanResult.status = "failed_error";
        scanResult.failureReason = err.message || String(err);
        scanResult.healthScore = 0;
        HistoryStore.getInstance().saveScan(scanResult);
        console.log(`RESULT FOR ${proj.name}:`);
        console.log(`Status: failed_error`);
        console.log(`Failure Reason: ${err.message}`);
      }
    }
  }

  console.log("\nSweep complete. All results saved to history store.");
}

runDirectSweep().catch(console.error);
