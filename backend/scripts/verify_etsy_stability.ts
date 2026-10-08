import { ScanQueueManager } from "../src/queue/scanQueue.js";

async function verifyEtsyStability() {
  console.log("================================================================================");
  console.log("RUNNING CONSECUTIVE STABILITY TEST ON ETSY.COM (3 CONSECUTIVE RUNS)");
  console.log("================================================================================");

  const manager = ScanQueueManager.getInstance();
  const runs = [];

  for (let i = 1; i <= 3; i++) {
    console.log(`\n>>> [Run ${i}/3] Scanning https://www.etsy.com...`);
    const start = performance.now();
    const result = await manager.executeDirect({
      url: "https://www.etsy.com",
      type: "both",
      consent: true
    });
    const durationMs = Math.round(performance.now() - start);

    console.log(`  Run ${i} Result: Status=${result.status}, Completeness=${result.scanCompleteness}, Score=${result.healthScore}, Findings=${result.findings.length}, Duration=${durationMs}ms`);

    runs.push({
      runNumber: i,
      jobId: result.jobId,
      status: result.status,
      scanCompleteness: result.scanCompleteness,
      completenessNotice: result.completenessNotice,
      healthScore: result.healthScore,
      scoreFormula: result.scoreFormula,
      summaryCounts: result.summaryCounts,
      findings: result.findings,
      durationMs
    });
  }

  console.log("\n================================================================================");
  console.log("DETAILED FINDINGS BREAKDOWN FOR RUN 1:");
  console.log("================================================================================");
  for (const f of runs[0].findings) {
    console.log(`\n[Rule: ${f.ruleId}] Category: ${f.category}, Severity: ${f.severity}, Effort: ${f.effort}`);
    console.log(`Title: ${f.title}`);
    console.log(`Cause: ${f.plainEnglishCause}`);
    console.log(`Evidence / Technical Details: ${f.technicalDetails || "N/A"}`);
  }

  console.log("\n================================================================================");
  console.log("STABILITY COMPARISON ACROSS RUNS:");
  console.log("================================================================================");
  const score1 = runs[0].healthScore;
  const score2 = runs[1].healthScore;
  const score3 = runs[2].healthScore;
  const comp1 = runs[0].scanCompleteness;
  const comp2 = runs[1].scanCompleteness;
  const comp3 = runs[2].scanCompleteness;
  const count1 = runs[0].findings.length;
  const count2 = runs[1].findings.length;
  const count3 = runs[2].findings.length;

  console.log(`Scores: Run1=${score1}, Run2=${score2}, Run3=${score3} => Stable: ${score1 === score2 && score2 === score3}`);
  console.log(`Completeness: Run1=${comp1}, Run2=${comp2}, Run3=${comp3} => Stable: ${comp1 === comp2 && comp2 === comp3}`);
  console.log(`Findings Count: Run1=${count1}, Run2=${count2}, Run3=${count3} => Stable: ${count1 === count2 && count2 === count3}`);

  const outData = {
    runsSummary: {
      scores: [score1, score2, score3],
      completeness: [comp1, comp2, comp3],
      findingsCounts: [count1, count2, count3],
      isStable: score1 === score2 && score2 === score3 && comp1 === comp2 && comp2 === comp3
    },
    run1: runs[0],
    run2: runs[1],
    run3: runs[2]
  };

  const fs = await import("node:fs");
  const path = await import("node:path");
  const fileURLToPath = (await import("node:url")).fileURLToPath;
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.resolve(__dirname, "../data/etsy_stability_test_results.json");
  fs.writeFileSync(outPath, JSON.stringify(outData, null, 2), "utf-8");
  console.log("\nFull output saved to:", outPath);
}

verifyEtsyStability().catch(console.error);
