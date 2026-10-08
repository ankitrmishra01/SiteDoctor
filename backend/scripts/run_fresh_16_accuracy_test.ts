import { ScanQueueManager } from "../src/queue/scanQueue.js";
import { ScanResult } from "../src/diagnostics/types.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FRESH_TEST_SITES = [
  // E-commerce (2)
  { url: "https://www.etsy.com", category: "E-Commerce", expected: "Modern SSR / Edge CDN" },
  { url: "https://www.ebay.com", category: "E-Commerce", expected: "Enterprise multi-datacenter" },

  // News / Media (2)
  { url: "https://www.bbc.com", category: "News / Media", expected: "Next.js / Node CDN" },
  { url: "https://www.theverge.com", category: "News / Media", expected: "Vox Chorus / Cloudflare" },

  // Smaller / Less Polished / Minimal (2)
  { url: "http://berkshirehathaway.com", category: "Minimal / Legacy", expected: "Static Apache / Raw HTML" },
  { url: "http://info.cern.ch", category: "Minimal / Historical", expected: "Raw HTML / Legacy Web" },

  // Tech / Modern / Open Source (10)
  { url: "https://deno.land", category: "Developer Tools", expected: "Deno / Fresh / Cloudflare" },
  { url: "https://bun.sh", category: "Developer Tools", expected: "Next.js / Vercel" },
  { url: "https://redis.io", category: "Databases & Tools", expected: "Gatsby / Vercel / Cloudflare" },
  { url: "https://www.postgresql.org", category: "Databases & Tools", expected: "Python / Django / Nginx" },
  { url: "https://nginx.org", category: "Infrastructure", expected: "Nginx Pure Static" },
  { url: "https://archlinux.org", category: "Linux & Distros", expected: "Python / Django / Nginx" },
  { url: "https://www.kernel.org", category: "Linux & Distros", expected: "Nginx / Linux" },
  { url: "https://huggingface.co", category: "AI & ML", expected: "Svelte / Node" },
  { url: "https://www.kaggle.com", category: "AI & ML", expected: "Angular / Google CDN" },
  { url: "https://pypi.org", category: "Package Managers", expected: "Python / Pyramid / Fastly" }
];

async function runFreshAccuracyTest() {
  console.log(`\n=== Running Fresh 16-Site Diagnostic Accuracy Sweep ===\n`);
  const queue = ScanQueueManager.getInstance();
  const results: any[] = [];
  const startTime = Date.now();

  // Run with concurrency = 2
  const concurrency = 2;
  for (let i = 0; i < FRESH_TEST_SITES.length; i += concurrency) {
    const chunk = FRESH_TEST_SITES.slice(i, i + concurrency);
    const promises = chunk.map(async (site, chunkIdx) => {
      const idx = i + chunkIdx + 1;
      const sStart = Date.now();
      console.log(`[${idx}/${FRESH_TEST_SITES.length}] Scanning ${site.url} (${site.category})...`);
      try {
        const scanRes = await queue.executeDirect({
          url: site.url,
          type: "both",
          consent: true
        });
        const duration = Date.now() - sStart;
        console.log(`  -> [${scanRes.status.toUpperCase()}] ${site.url} | Score: ${scanRes.healthScore}/100 | Time: ${duration}ms | Findings: ${scanRes.findings.length} | Stack: ${scanRes.detectedStack?.summary || "N/A"}`);
        return {
          index: idx,
          url: site.url,
          category: site.category,
          status: scanRes.status,
          healthScore: scanRes.healthScore,
          durationMs: duration,
          findingsCount: scanRes.findings.length,
          detectedStack: scanRes.detectedStack,
          summaryCounts: scanRes.summaryCounts,
          rawFindings: scanRes.findings
        };
      } catch (err: any) {
        console.error(`  -> [FAILED] ${site.url}:`, err.message);
        return {
          index: idx,
          url: site.url,
          category: site.category,
          status: "failed_error",
          error: err.message
        };
      }
    });

    const chunkResults = await Promise.all(promises);
    results.push(...chunkResults);
  }

  const completed = results.filter(r => r.status === "completed");
  const failed = results.filter(r => r.status !== "completed");
  const avgScore = completed.length > 0
    ? (completed.reduce((acc, r) => acc + (r.healthScore || 0), 0) / completed.length).toFixed(1)
    : "0";

  const summary = {
    totalAttempted: FRESH_TEST_SITES.length,
    completedCount: completed.length,
    failedCount: failed.length,
    completionRate: `${((completed.length / FRESH_TEST_SITES.length) * 100).toFixed(1)}%`,
    averageScore: `${avgScore}/100`,
    totalTimeSeconds: Math.round((Date.now() - startTime) / 1000),
    results
  };

  const outPath = path.resolve(__dirname, "../data/fresh_16_sites_accuracy_results.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), "utf-8");

  console.log(`\n================================================================`);
  console.log(`Sweep Finished in ${summary.totalTimeSeconds}s`);
  console.log(`Completed: ${completed.length}/${FRESH_TEST_SITES.length} (${summary.completionRate})`);
  console.log(`Average Score: ${summary.averageScore}`);
  console.log(`Saved results to: ${outPath}`);
  console.log(`================================================================\n`);
}

runFreshAccuracyTest().catch(console.error);
