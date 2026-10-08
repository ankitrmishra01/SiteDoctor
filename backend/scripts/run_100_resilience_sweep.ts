import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { ScanQueueManager } from "../src/queue/scanQueue.js";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_SITES: Array<{ url: string; type: "frontend" | "backend" | "both"; category: string }> = [
  // 1. Frameworks & Web Platforms (20)
  { url: "https://nodejs.org", type: "both", category: "Frameworks & Runtimes" },
  { url: "https://vite.dev", type: "both", category: "Frameworks & Runtimes" },
  { url: "https://react.dev", type: "both", category: "Frameworks & Runtimes" },
  { url: "https://vuejs.org", type: "both", category: "Frameworks & Runtimes" },
  { url: "https://angular.dev", type: "both", category: "Frameworks & Runtimes" },
  { url: "https://svelte.dev", type: "both", category: "Frameworks & Runtimes" },
  { url: "https://nextjs.org", type: "both", category: "Frameworks & Runtimes" },
  { url: "https://astro.build", type: "both", category: "Frameworks & Runtimes" },
  { url: "https://deno.com", type: "both", category: "Frameworks & Runtimes" },
  { url: "https://bun.sh", type: "both", category: "Frameworks & Runtimes" },
  { url: "https://expressjs.com", type: "both", category: "Frameworks & Runtimes" },
  { url: "https://fastapi.tiangolo.com", type: "both", category: "Frameworks & Runtimes" },
  { url: "https://rubyonrails.org", type: "both", category: "Frameworks & Runtimes" },
  { url: "https://laravel.com", type: "both", category: "Frameworks & Runtimes" },
  { url: "https://go.dev", type: "both", category: "Frameworks & Runtimes" },
  { url: "https://rust-lang.org", type: "both", category: "Frameworks & Runtimes" },
  { url: "https://python.org", type: "both", category: "Frameworks & Runtimes" },
  { url: "https://spring.io", type: "both", category: "Frameworks & Runtimes" },
  { url: "https://flutter.dev", type: "both", category: "Frameworks & Runtimes" },
  { url: "https://tailwindcss.com", type: "both", category: "Frameworks & Runtimes" },

  // 2. Documentation, Standards & Technical Knowledge (20)
  { url: "https://developer.mozilla.org", type: "both", category: "Docs & Standards" },
  { url: "https://en.wikipedia.org", type: "both", category: "Docs & Standards" },
  { url: "https://www.w3.org", type: "both", category: "Docs & Standards" },
  { url: "https://www.typescriptlang.org", type: "both", category: "Docs & Standards" },
  { url: "https://graphql.org", type: "both", category: "Docs & Standards" },
  { url: "https://www.docker.com", type: "both", category: "Docs & Standards" },
  { url: "https://kubernetes.io", type: "both", category: "Docs & Standards" },
  { url: "https://redis.io", type: "both", category: "Docs & Standards" },
  { url: "https://www.postgresql.org", type: "both", category: "Docs & Standards" },
  { url: "https://www.sqlite.org", type: "both", category: "Docs & Standards" },
  { url: "https://www.mongodb.com", type: "both", category: "Docs & Standards" },
  { url: "https://www.elastic.co", type: "both", category: "Docs & Standards" },
  { url: "https://www.apache.org", type: "both", category: "Docs & Standards" },
  { url: "https://www.linuxfoundation.org", type: "both", category: "Docs & Standards" },
  { url: "https://archlinux.org", type: "both", category: "Docs & Standards" },
  { url: "https://www.kernel.org", type: "both", category: "Docs & Standards" },
  { url: "https://www.gnu.org", type: "both", category: "Docs & Standards" },
  { url: "https://web.dev", type: "both", category: "Docs & Standards" },
  { url: "https://caniuse.com", type: "both", category: "Docs & Standards" },
  { url: "https://devdocs.io", type: "both", category: "Docs & Standards" },

  // 3. Cloud, Hosting & Registry Ecosystems (20)
  { url: "https://github.com", type: "both", category: "Cloud & Dev Tools" },
  { url: "https://gitlab.com", type: "both", category: "Cloud & Dev Tools" },
  { url: "https://bitbucket.org", type: "both", category: "Cloud & Dev Tools" },
  { url: "https://www.npmjs.com", type: "both", category: "Cloud & Dev Tools" },
  { url: "https://pypi.org", type: "both", category: "Cloud & Dev Tools" },
  { url: "https://crates.io", type: "both", category: "Cloud & Dev Tools" },
  { url: "https://pkg.go.dev", type: "both", category: "Cloud & Dev Tools" },
  { url: "https://packagist.org", type: "both", category: "Cloud & Dev Tools" },
  { url: "https://rubygems.org", type: "both", category: "Cloud & Dev Tools" },
  { url: "https://www.nuget.org", type: "both", category: "Cloud & Dev Tools" },
  { url: "https://vercel.com", type: "both", category: "Cloud & Dev Tools" },
  { url: "https://www.netlify.com", type: "both", category: "Cloud & Dev Tools" },
  { url: "https://www.cloudflare.com", type: "both", category: "Cloud & Dev Tools" },
  { url: "https://fly.io", type: "both", category: "Cloud & Dev Tools" },
  { url: "https://render.com", type: "both", category: "Cloud & Dev Tools" },
  { url: "https://www.digitalocean.com", type: "both", category: "Cloud & Dev Tools" },
  { url: "https://supabase.com", type: "both", category: "Cloud & Dev Tools" },
  { url: "https://firebase.google.com", type: "both", category: "Cloud & Dev Tools" },
  { url: "https://postman.com", type: "both", category: "Cloud & Dev Tools" },
  { url: "https://swagger.io", type: "both", category: "Cloud & Dev Tools" },

  // 4. Public APIs & Data Services (15)
  { url: "https://httpbin.org", type: "backend", category: "APIs & Services" },
  { url: "https://dummyjson.com", type: "backend", category: "APIs & Services" },
  { url: "https://pokeapi.co", type: "backend", category: "APIs & Services" },
  { url: "https://reqres.in", type: "backend", category: "APIs & Services" },
  { url: "https://jsonplaceholder.typicode.com", type: "backend", category: "APIs & Services" },
  { url: "https://restcountries.com", type: "backend", category: "APIs & Services" },
  { url: "https://open-meteo.com", type: "both", category: "APIs & Services" },
  { url: "https://api.github.com", type: "backend", category: "APIs & Services" },
  { url: "https://icanhazdadjoke.com", type: "both", category: "APIs & Services" },
  { url: "https://api.coindesk.com", type: "backend", category: "APIs & Services" },
  { url: "https://api.spacexdata.com", type: "backend", category: "APIs & Services" },
  { url: "https://rickandmortyapi.com", type: "both", category: "APIs & Services" },
  { url: "https://dog.ceo", type: "both", category: "APIs & Services" },
  { url: "https://catfact.ninja", type: "both", category: "APIs & Services" },
  { url: "https://worldtimeapi.org", type: "backend", category: "APIs & Services" },

  // 5. Open Source Software & Non-Profit Foundations (25)
  { url: "https://www.mozilla.org", type: "both", category: "Open Source & Foundations" },
  { url: "https://www.eff.org", type: "both", category: "Open Source & Foundations" },
  { url: "https://www.torproject.org", type: "both", category: "Open Source & Foundations" },
  { url: "https://signal.org", type: "both", category: "Open Source & Foundations" },
  { url: "https://matrix.org", type: "both", category: "Open Source & Foundations" },
  { url: "https://www.openstreetmap.org", type: "both", category: "Open Source & Foundations" },
  { url: "https://archive.org", type: "both", category: "Open Source & Foundations" },
  { url: "https://wikimediafoundation.org", type: "both", category: "Open Source & Foundations" },
  { url: "https://creativecommons.org", type: "both", category: "Open Source & Foundations" },
  { url: "https://www.fsf.org", type: "both", category: "Open Source & Foundations" },
  { url: "https://duckduckgo.com", type: "both", category: "Open Source & Foundations" },
  { url: "https://brave.com", type: "both", category: "Open Source & Foundations" },
  { url: "https://proton.me", type: "both", category: "Open Source & Foundations" },
  { url: "https://www.libreoffice.org", type: "both", category: "Open Source & Foundations" },
  { url: "https://www.blender.org", type: "both", category: "Open Source & Foundations" },
  { url: "https://www.videolan.org", type: "both", category: "Open Source & Foundations" },
  { url: "https://www.gimp.org", type: "both", category: "Open Source & Foundations" },
  { url: "https://inkscape.org", type: "both", category: "Open Source & Foundations" },
  { url: "https://www.audacityteam.org", type: "both", category: "Open Source & Foundations" },
  { url: "https://obsproject.com", type: "both", category: "Open Source & Foundations" },
  { url: "https://curl.se", type: "both", category: "Open Source & Foundations" },
  { url: "https://git-scm.com", type: "both", category: "Open Source & Foundations" },
  { url: "https://ffmpeg.org", type: "both", category: "Open Source & Foundations" },
  { url: "https://neovim.io", type: "both", category: "Open Source & Foundations" },
  { url: "https://code.visualstudio.com", type: "both", category: "Open Source & Foundations" }
];

async function runFreshSweep() {
  console.log(`\n================================================================`);
  console.log(` STARTING FRESH 100-SITE RESILIENCE SWEEP (PARALLEL ENGINE)`);
  console.log(` Concurrency = 2 | Bounded Crawler | Parallel SSL/FE/BE Probes`);
  console.log(`================================================================\n`);

  const scanQueue = ScanQueueManager.getInstance();
  const results: any[] = [];
  const CONCURRENCY = 2;
  let currentIndex = 0;

  async function worker(workerId: number) {
    while (currentIndex < TARGET_SITES.length) {
      const index = currentIndex++;
      const target = TARGET_SITES[index];
      if (!target) break;

      const startTime = Date.now();
      try {
        const scanRes = await scanQueue.executeDirect({
          url: target.url,
          type: target.type,
          consent: true
        });

        const duration = Date.now() - startTime;
        results.push({
          index: index + 1,
          url: target.url,
          category: target.category,
          type: target.type,
          status: scanRes.status,
          healthScore: scanRes.healthScore,
          durationMs: duration,
          failureReason: scanRes.failureReason,
          findingsCount: scanRes.findings.length,
          detectedStack: scanRes.detectedStack?.summary
        });

        console.log(`[Worker ${workerId}] [${index + 1}/${TARGET_SITES.length}] ${scanRes.status === "completed" ? "✓" : "✕"} ${target.url} -> Status: ${scanRes.status}, Score: ${scanRes.healthScore}/100, Duration: ${duration}ms, Stack: ${scanRes.detectedStack?.summary || "N/A"}`);
      } catch (err: any) {
        const duration = Date.now() - startTime;
        results.push({
          index: index + 1,
          url: target.url,
          category: target.category,
          type: target.type,
          status: "failed_error",
          healthScore: 0,
          durationMs: duration,
          failureReason: err.message,
          findingsCount: 0
        });
        console.log(`[Worker ${workerId}] [${index + 1}/${TARGET_SITES.length}] ✕ ${target.url} -> Error: ${err.message}`);
      }

      // 200ms spacing between targets
      await new Promise(r => setTimeout(r, 200));
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1));
  await Promise.all(workers);

  results.sort((a, b) => a.index - b.index);

  // Group failures
  const completed = results.filter(r => r.status === "completed");
  const unreachable = results.filter(r => r.status === "failed_unreachable");
  const errored = results.filter(r => r.status === "failed_error");

  const failureReasons: Record<string, number> = {};
  results.filter(r => r.status !== "completed").forEach(r => {
    const reason = r.failureReason || "Unknown Failure";
    failureReasons[reason] = (failureReasons[reason] || 0) + 1;
  });

  const scores = completed.map(r => r.healthScore);
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "0";

  const summary = {
    totalAttempted: TARGET_SITES.length,
    completedCount: completed.length,
    completionRate: `${((completed.length / TARGET_SITES.length) * 100).toFixed(1)}%`,
    unreachableCount: unreachable.length,
    erroredCount: errored.length,
    averageScore: avgScore,
    failureReasonsGrouped: failureReasons,
    results
  };

  const outputPath = path.resolve(__dirname, "../data/sweep_100_fresh_results.json");
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), "utf8");
  console.log(`\n================================================================`);
  console.log(` SWEEP COMPLETED!`);
  console.log(` Total Targets: ${TARGET_SITES.length}`);
  console.log(` Completed: ${completed.length} (${((completed.length / TARGET_SITES.length) * 100).toFixed(1)}%)`);
  console.log(` Unreachable: ${unreachable.length}`);
  console.log(` Errored: ${errored.length}`);
  console.log(` Average Score: ${avgScore}/100`);
  console.log(` Failure Reasons:`, JSON.stringify(failureReasons, null, 2));
  console.log(` Saved complete data to: ${outputPath}`);
  console.log(`================================================================\n`);
}

runFreshSweep().catch(console.error);
