import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { HistoryStore } from "../src/storage/history.store.js";
import { ScanResult } from "../src/diagnostics/types.js";

const testDbPath = path.resolve(process.cwd(), "data", "test-scan-history.json");

describe("HistoryStore FIFO Eviction & Storage Limits", () => {
  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
  });

  it("should cap scans to 50 per URL and strictly evict oldest entries first (FIFO)", () => {
    const store = HistoryStore.getInstance(testDbPath);
    store.clearScans();
    const testUrl = "https://test-fifo-order.example.com";

    // Insert 55 sequential scans with increasing timestamps
    const baseTime = 1700000000000;
    for (let i = 1; i <= 55; i++) {
      const scan: ScanResult = {
        jobId: `job_eviction_${i}`,
        targetUrl: testUrl,
        scanType: "frontend",
        status: "completed",
        startedAt: new Date(baseTime + i * 60000).toISOString(),
        healthScore: 70 + (i % 20),
        scoreFormula: "Score = 100 - penalties",
        summaryCounts: { critical: 0, warning: 0, info: 0, pass: 0, total: 0 },
        findings: [],
        rawMetrics: {}
      };
      store.saveScan(scan);
    }

    const history = store.getHistoryByUrl(testUrl);
    
    // 1. Assert length is strictly 50
    expect(history.length).toBe(50);

    // 2. Assert that the first 5 oldest entries (job_eviction_1 through job_eviction_5) were completely purged
    for (let i = 1; i <= 5; i++) {
      expect(history.find(s => s.jobId === `job_eviction_${i}`)).toBeUndefined();
    }

    // 3. Assert that entries 6 through 55 are all present in exact chronological FIFO order
    for (let i = 6; i <= 55; i++) {
      const expectedJobId = `job_eviction_${i}`;
      expect(history[i - 6]?.jobId).toBe(expectedJobId);
    }

    // 4. Oldest retained item must be job_eviction_6, newest must be job_eviction_55
    expect(history[0]?.jobId).toBe("job_eviction_6");
    expect(history[49]?.jobId).toBe("job_eviction_55");
  });

  it("should enforce global storage cap of 500 scans", () => {
    const store = HistoryStore.getInstance(testDbPath);
    store.clearScans();
    
    // Save 501 unique URL scans
    for (let i = 1; i <= 501; i++) {
      const scan: ScanResult = {
        jobId: `global_scan_${i}`,
        targetUrl: `https://domain-${i}.example.org`,
        scanType: "frontend",
        status: "completed",
        startedAt: new Date(Date.now() + i * 1000).toISOString(),
        healthScore: 90,
        scoreFormula: "Score = 100",
        summaryCounts: { critical: 0, warning: 0, info: 0, pass: 0, total: 0 },
        findings: [],
        rawMetrics: {}
      };
      store.saveScan(scan);
    }

    const recent = store.getRecentScans(1000);
    expect(recent.length).toBeLessThanOrEqual(500);
  });
});
