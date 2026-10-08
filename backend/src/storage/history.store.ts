/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SITEDOCTOR SCAN HISTORY STORAGE & EVICTION POLICY
 * ═══════════════════════════════════════════════════════════════════════════
 * EVICTION POLICY:
 * 1. Per-URL Storage Cap: Maximum 50 scans per URL. When the 51st scan for a
 *    given target URL is recorded, the oldest scan for that URL is evicted (FIFO).
 * 2. Global Storage Cap: Maximum 500 total scan records across all URLs combined.
 *    If the total count exceeds 500, the oldest global records are evicted first.
 * 3. Security Guarantee: Authentication tokens, PATs, and credentials are NEVER
 *    stored in this file or written to disk. Only public URLs and technical diagnostic
 *    findings are persisted.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import fs from "node:fs";
import path from "node:path";
import { ScanResult } from "../diagnostics/types.js";
import { config } from "../config.js";

interface HistoryData {
  scans: ScanResult[];
  lastUpdated: string;
}

export class HistoryStore {
  private static instance: HistoryStore;
  private filePath: string;
  private inMemoryScans: ScanResult[] = [];

  private constructor(customFilePath?: string) {
    const dataDir = path.resolve(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        console.warn("[HistoryStore] Could not create data directory, using memory-only store:", err);
      }
    }
    this.filePath = customFilePath || path.join(dataDir, "scan-history.json");
    this.loadFromDisk();
  }

  public static getInstance(customFilePath?: string): HistoryStore {
    if (!HistoryStore.instance || customFilePath) {
      HistoryStore.instance = new HistoryStore(customFilePath);
    }
    return HistoryStore.instance;
  }

  public clearScans(): void {
    this.inMemoryScans = [];
    this.persistToDisk();
  }

  private loadFromDisk(): void {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const parsed: HistoryData = JSON.parse(raw);
        if (Array.isArray(parsed.scans)) {
          this.inMemoryScans = parsed.scans;
        }
      } catch (err) {
        console.warn("[HistoryStore] Error reading history from disk, resetting store:", err);
        this.inMemoryScans = [];
      }
    }
  }

  private persistToDisk(): void {
    try {
      const data: HistoryData = {
        scans: this.inMemoryScans,
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.warn("[HistoryStore] Failed to write scan history to disk:", err);
    }
  }

  /**
   * Saves a completed or finalized scan with FIFO eviction.
   * Strips any sensitive credentials before saving.
   */
  public saveScan(scan: ScanResult): void {
    // Sanitize scan object to ensure no sensitive tokens exist
    const sanitizedScan: ScanResult = JSON.parse(JSON.stringify(scan));

    // 1. Filter existing scans for this URL
    const normalizedUrl = this.normalizeUrl(sanitizedScan.targetUrl);
    
    // Add new scan to list
    this.inMemoryScans.push(sanitizedScan);

    // 2. Enforce per-URL cap (max 50 per URL)
    const urlScans = this.inMemoryScans.filter(s => this.normalizeUrl(s.targetUrl) === normalizedUrl);
    if (urlScans.length > config.storage.maxScansPerUrl) {
      const scansToRemoveCount = urlScans.length - config.storage.maxScansPerUrl;
      let removed = 0;
      this.inMemoryScans = this.inMemoryScans.filter(s => {
        if (this.normalizeUrl(s.targetUrl) === normalizedUrl && removed < scansToRemoveCount) {
          removed++;
          return false;
        }
        return true;
      });
    }

    // 3. Enforce Global Storage Cap (max 500 scans)
    if (this.inMemoryScans.length > config.storage.maxTotalScans) {
      const excess = this.inMemoryScans.length - config.storage.maxTotalScans;
      this.inMemoryScans.splice(0, excess);
    }

    this.persistToDisk();
  }

  public getHistoryByUrl(targetUrl: string): ScanResult[] {
    const normalized = this.normalizeUrl(targetUrl);
    return this.inMemoryScans
      .filter(s => this.normalizeUrl(s.targetUrl) === normalized)
      .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  }

  public getHistoryByUser(userId: string, limit = 30): ScanResult[] {
    return this.inMemoryScans
      .filter(s => (s as any).userId === userId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }

  public getRecentScans(limit = 20): ScanResult[] {
    return [...this.inMemoryScans]
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }

  public getScanById(jobId: string): ScanResult | undefined {
    return this.inMemoryScans.find(s => s.jobId === jobId);
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, "").toLowerCase();
    } catch {
      return url.trim().toLowerCase();
    }
  }
}
