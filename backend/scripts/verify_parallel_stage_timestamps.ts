import { SslScanner } from "../src/scanners/ssl.scanner.js";
import { FrontendScanner } from "../src/scanners/frontend.scanner.js";
import { BackendScanner } from "../src/scanners/backend.scanner.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface StageTiming {
  stage: string;
  startIso: string;
  endIso: string;
  startEpochMs: number;
  endEpochMs: number;
  durationMs: number;
}

interface SiteTimingVerification {
  url: string;
  name: string;
  overallStartIso: string;
  overallEndIso: string;
  totalWallClockMs: number;
  stages: {
    ssl: StageTiming;
    frontend: StageTiming;
    backend: StageTiming;
  };
  concurrencyProof: {
    stagesSimultaneousLaunchDeltaMs: number;
    sequentialSumMs: number;
    timeSavedMs: number;
    parallelOverlapPercentage: string;
  };
}

async function verifyParallelTimings() {
  console.log("=== EXECUTING PARALLEL STAGE TIMING PROOF VIA PROMISE.ALL ===");

  const targets = [
    { url: "https://developer.mozilla.org", name: "MDN Web Docs" },
    { url: "https://vite.dev", name: "Vite Docs" },
    { url: "https://github.com", name: "GitHub" }
  ];

  const results: SiteTimingVerification[] = [];

  for (const target of targets) {
    console.log(`\nScanning: ${target.url} (${target.name})`);
    const overallStartMs = Date.now();
    const overallStartIso = new Date(overallStartMs).toISOString();

    let sslStage: StageTiming = {} as any;
    let feStage: StageTiming = {} as any;
    let beStage: StageTiming = {} as any;

    const sslPromise = (async () => {
      const startMs = Date.now();
      const startIso = new Date(startMs).toISOString();
      await SslScanner.scan(target.url);
      const endMs = Date.now();
      const endIso = new Date(endMs).toISOString();
      sslStage = {
        stage: "SSL Certificate & TLS Handshake",
        startIso,
        endIso,
        startEpochMs: startMs,
        endEpochMs: endMs,
        durationMs: endMs - startMs
      };
    })();

    const fePromise = (async () => {
      const startMs = Date.now();
      const startIso = new Date(startMs).toISOString();
      await FrontendScanner.scan(target.url);
      const endMs = Date.now();
      const endIso = new Date(endMs).toISOString();
      feStage = {
        stage: "Frontend Browser, WCAG Axe & Crawler",
        startIso,
        endIso,
        startEpochMs: startMs,
        endEpochMs: endMs,
        durationMs: endMs - startMs
      };
    })();

    const bePromise = (async () => {
      const startMs = Date.now();
      const startIso = new Date(startMs).toISOString();
      await BackendScanner.scan(target.url);
      const endMs = Date.now();
      const endIso = new Date(endMs).toISOString();
      beStage = {
        stage: "Backend Headers, CORS & API Endpoints",
        startIso,
        endIso,
        startEpochMs: startMs,
        endEpochMs: endMs,
        durationMs: endMs - startMs
      };
    })();

    // Concurrent execution
    await Promise.all([sslPromise, fePromise, bePromise]);

    const overallEndMs = Date.now();
    const overallEndIso = new Date(overallEndMs).toISOString();
    const totalWallClockMs = overallEndMs - overallStartMs;

    const sequentialSum = sslStage.durationMs + feStage.durationMs + beStage.durationMs;
    const launchDelta = Math.max(sslStage.startEpochMs, feStage.startEpochMs, beStage.startEpochMs) - 
                        Math.min(sslStage.startEpochMs, feStage.startEpochMs, beStage.startEpochMs);

    const verification: SiteTimingVerification = {
      url: target.url,
      name: target.name,
      overallStartIso,
      overallEndIso,
      totalWallClockMs,
      stages: {
        ssl: sslStage,
        frontend: feStage,
        backend: beStage
      },
      concurrencyProof: {
        stagesSimultaneousLaunchDeltaMs: launchDelta,
        sequentialSumMs: sequentialSum,
        timeSavedMs: sequentialSum - totalWallClockMs,
        parallelOverlapPercentage: `${(((sequentialSum - totalWallClockMs) / sequentialSum) * 100).toFixed(1)}%`
      }
    };

    console.log(`Overall Duration: ${totalWallClockMs}ms (Sequential would be ${sequentialSum}ms)`);
    console.log(`- SSL:      ${sslStage.startIso.substring(11, 23)} -> ${sslStage.endIso.substring(11, 23)} (${sslStage.durationMs}ms)`);
    console.log(`- Frontend: ${feStage.startIso.substring(11, 23)} -> ${feStage.endIso.substring(11, 23)} (${feStage.durationMs}ms)`);
    console.log(`- Backend:  ${beStage.startIso.substring(11, 23)} -> ${beStage.endIso.substring(11, 23)} (${beStage.durationMs}ms)`);
    console.log(`- Concurrent launch delta: ${launchDelta}ms across all 3 promises`);

    results.push(verification);
  }

  const outPath = path.resolve(__dirname, "../data/parallel_stage_timing_proof.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nWrote complete parallel timing evidence to ${outPath}`);
}

verifyParallelTimings().catch(console.error);
