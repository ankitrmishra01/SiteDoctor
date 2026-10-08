import { Queue, Worker, Job } from "bullmq";
import { Server as SocketIOServer } from "socket.io";
import { ScanRequest, ScanResult, Finding, CheckEventPayload, ScanStatus } from "../diagnostics/types.js";
import { FrontendScanner, UnreachableTargetError } from "../scanners/frontend.scanner.js";
import { BackendScanner } from "../scanners/backend.scanner.js";
import { SslScanner } from "../scanners/ssl.scanner.js";
import { DiagnosticsEngine } from "../diagnostics/engine.js";
import { StackDetector } from "../diagnostics/stackDetector.js";
import { HistoryStore } from "../storage/history.store.js";
import { GitHubService } from "../github/github.service.js";
import { config } from "../config.js";

export class ScanQueueManager {
  private static instance: ScanQueueManager;
  private io: SocketIOServer | null = null;
  private bullQueue: Queue | null = null;
  private bullWorker: Worker | null = null;
  private activeJobs = new Map<string, ScanResult>();

  private constructor() {
    this.initBullMQ();
  }

  public static getInstance(): ScanQueueManager {
    if (!ScanQueueManager.instance) {
      ScanQueueManager.instance = new ScanQueueManager();
    }
    return ScanQueueManager.instance;
  }

  public setSocketServer(io: SocketIOServer): void {
    this.io = io;
  }

  private async initBullMQ(): Promise<void> {
    try {
      this.bullQueue = new Queue("sitedoctor-scans", {
        connection: { url: config.redisUrl },
        defaultJobOptions: { removeOnComplete: true, removeOnFail: true }
      });

      this.bullWorker = new Worker(
        "sitedoctor-scans",
        async (job: Job<ScanRequest>) => {
          await this.executeScanJob(job.id || `job_${Date.now()}`, job.data);
        },
        { connection: { url: config.redisUrl }, concurrency: 2 }
      );

      this.bullWorker.on("error", (err) => {
        // Fall back seamlessly to in-memory processing
        console.info("[ScanQueue] Redis connection not active. Running with built-in in-memory queue fallback.");
        this.bullQueue = null;
        this.bullWorker = null;
      });
    } catch {
      console.info("[ScanQueue] Redis queue init skipped. Running with built-in in-memory queue.");
      this.bullQueue = null;
      this.bullWorker = null;
    }
  }

  public async addScanJob(request: ScanRequest): Promise<string> {
    const jobId = `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const initialResult: ScanResult = {
      jobId,
      userId: request.userId,
      targetUrl: request.url,
      scanType: request.type,
      status: "queued",
      scanCompleteness: request.type === "both" ? "full" : (request.type === "backend" ? "partial_backend_only" : "partial_frontend_only"),
      startedAt: new Date().toISOString(),
      healthScore: 100,
      scoreFormula: "Pending scan completion",
      summaryCounts: { critical: 0, warning: 0, info: 0, pass: 0, total: 0 },
      findings: [],
      rawMetrics: {}
    };

    this.activeJobs.set(jobId, initialResult);

    if (this.bullQueue) {
      try {
        await this.bullQueue.add("scan", request, { jobId });
        return jobId;
      } catch {
        // Fallback to in-memory execution if BullMQ add fails
      }
    }

    // In-memory async execution
    setImmediate(() => {
      this.executeScanJob(jobId, request).catch((err) => {
        console.error(`[ScanQueue] In-memory job ${jobId} execution error:`, err);
      });
    });

    return jobId;
  }

  public async executeDirect(request: ScanRequest): Promise<ScanResult> {
    const jobId = `direct_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const initialResult: ScanResult = {
      jobId,
      userId: request.userId,
      targetUrl: request.url,
      scanType: request.type,
      status: "queued",
      scanCompleteness: request.type === "both" ? "full" : (request.type === "backend" ? "partial_backend_only" : "partial_frontend_only"),
      startedAt: new Date().toISOString(),
      healthScore: 100,
      scoreFormula: "Pending scan completion",
      summaryCounts: { critical: 0, warning: 0, info: 0, pass: 0, total: 0 },
      findings: [],
      rawMetrics: {}
    };
    this.activeJobs.set(jobId, initialResult);
    await this.executeScanJob(jobId, request);
    return this.activeJobs.get(jobId)!;
  }

  public getScanStatus(jobId: string): ScanResult | undefined {
    return this.activeJobs.get(jobId) || HistoryStore.getInstance().getScanById(jobId);
  }

  private emitToRoom(jobId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`scan:${jobId}`).emit(event, data);
    }
  }

  private async executeScanJob(jobId: string, request: ScanRequest): Promise<void> {
    const scanResult: ScanResult = this.activeJobs.get(jobId) || {
      jobId,
      userId: request.userId,
      targetUrl: request.url,
      scanType: request.type,
      status: "running",
      scanCompleteness: request.type === "both" ? "full" : (request.type === "backend" ? "partial_backend_only" : "partial_frontend_only"),
      startedAt: new Date().toISOString(),
      healthScore: 100,
      scoreFormula: "",
      summaryCounts: { critical: 0, warning: 0, info: 0, pass: 0, total: 0 },
      findings: [],
      rawMetrics: {}
    };

    scanResult.status = "running";
    this.activeJobs.set(jobId, scanResult);
    this.emitToRoom(jobId, "scan:started", { jobId, targetUrl: request.url, scanType: request.type });

    const allFindings: Finding[] = [];
    const startTime = performance.now();

    try {
      // ─────────────────────────────────────────────────────────────────────────
      // 1. CONCURRENT SCANNER EXECUTION (SSL + Frontend + Backend in Parallel)
      // ─────────────────────────────────────────────────────────────────────────
      const sslPromise = (async () => {
        const sslStart = performance.now();
        const sslResult = await SslScanner.scan(request.url);
        const sslDuration = Math.round(performance.now() - sslStart);
        scanResult.rawMetrics.ssl = {
          valid: sslResult.valid,
          issuer: sslResult.issuer,
          validFrom: sslResult.validFrom,
          validTo: sslResult.validTo,
          daysRemaining: sslResult.daysRemaining,
          protocol: sslResult.protocol
        };
        this.emitCheckCompleted(jobId, "SSL / TLS Certificate", "security", sslDuration, sslResult.findings, sslResult.valid ? "SSL certificate is valid and active" : "SSL issues detected");
        return sslResult;
      })();

      const fePromise = (async () => {
        if (request.type !== "frontend" && request.type !== "both") return null;
        const feStart = performance.now();
        const feResult = await FrontendScanner.scan(request.url);
        const feDuration = Math.round(performance.now() - feStart);
        scanResult.rawMetrics.pageLoad = feResult.pageLoad;
        scanResult.rawMetrics.coreWebVitals = feResult.coreWebVitals;
        scanResult.rawMetrics.accessibility = feResult.accessibility;
        scanResult.rawMetrics.crawledLinks = feResult.crawledLinks;
        this.emitCheckCompleted(jobId, "Frontend Browser & Accessibility", "frontend", feDuration, feResult.findings, `Page loaded in ${feResult.pageLoad.loadTimeMs}ms, ${feResult.accessibility.violationsCount} a11y violations found`);
        return feResult;
      })();

      const bePromise = (async () => {
        if (request.type !== "backend" && request.type !== "both") return null;
        const beStart = performance.now();
        const beResult = await BackendScanner.scan(request.url, request.openApiUrl, request.type === "backend");
        const beDuration = Math.round(performance.now() - beStart);
        scanResult.rawMetrics.securityHeaders = beResult.securityHeaders;
        scanResult.rawMetrics.cors = beResult.cors;
        scanResult.rawMetrics.endpointsDiscovered = beResult.endpointsDiscovered;
        scanResult.rawMetrics.lightLoad = beResult.lightLoad;
        this.emitCheckCompleted(jobId, "Backend API & Security Headers", "backend", beDuration, beResult.findings, `Probed ${beResult.endpointsDiscovered.length} endpoints, CORS: ${beResult.cors.configured ? "Configured" : "Missing"}`);
        return beResult;
      })();

      let feError: string | null = null;
      let beError: string | null = null;
      let sslError: string | null = null;

      let sslResult: any = null;
      let feResult: any = null;
      let beResult: any = null;

      try {
        sslResult = await sslPromise;
      } catch (err: any) {
        sslError = err.message || "SSL probe failed";
      }

      try {
        feResult = await fePromise;
      } catch (err: any) {
        feError = err instanceof UnreachableTargetError ? err.reason : (err.message || "Frontend browser probe failed");
      }

      try {
        beResult = await bePromise;
      } catch (err: any) {
        beError = err.message || "Backend probe failed";
      }

      // If all probes failed, terminate as unreachable
      if (!sslResult && !feResult && !beResult) {
        throw new UnreachableTargetError(feError || beError || sslError || `Target URL '${request.url}' is unreachable.`);
      }

      if (sslResult?.findings) allFindings.push(...sslResult.findings);
      if (feResult?.findings) allFindings.push(...feResult.findings);
      if (beResult?.findings) allFindings.push(...beResult.findings);

      // Determine scan completeness
      let scanCompleteness: ScanResult["scanCompleteness"] = "full";
      let completenessNotice: string | undefined = undefined;

      if (request.type === "both") {
        if (feError && beResult) {
          scanCompleteness = "partial_backend_only";
          completenessNotice = `Partial scan — Frontend browser unreachable/blocked (${feError}). Only HTTP/TLS and API probes executed. Core Web Vitals & DOM accessibility audits were skipped.`;
        } else if (beError && feResult) {
          scanCompleteness = "partial_frontend_only";
          completenessNotice = `Partial scan — Backend probe unreachable (${beError}). Only frontend browser audit executed.`;
        } else {
          scanCompleteness = "full";
        }
      } else if (request.type === "backend") {
        scanCompleteness = "partial_backend_only";
        completenessNotice = "Backend API & Security probe only (Frontend browser audit not requested).";
      } else if (request.type === "frontend") {
        scanCompleteness = "partial_frontend_only";
        completenessNotice = "Frontend browser audit only (Backend API & SSL deep probes not requested).";
      }

      // ─────────────────────────────────────────────────────────────────────────
      // 4. STACK DETECTION & ADAPTIVE REMEDIATION CALIBRATION
      // ─────────────────────────────────────────────────────────────────────────
      const detectedStack = StackDetector.detect({
        headers: beResult?.rawHeaders || beResult?.securityHeaders,
        htmlContent: feResult?.stackSignals?.htmlContent,
        cookies: feResult?.stackSignals?.cookies,
        generatorMeta: feResult?.stackSignals?.generatorMeta
      });

      scanResult.detectedStack = detectedStack;

      // Calibrate all findings with stack-specific remediation instructions & code snippets
      const calibratedFindings = DiagnosticsEngine.applyStackToFindings(allFindings, detectedStack);

      // ─────────────────────────────────────────────────────────────────────────
      // 5. GITHUB REPO CODE LOCATOR (Optional Heuristic Line Finder)
      // ─────────────────────────────────────────────────────────────────────────
      if (request.sessionId && GitHubService.getInstance().hasActiveSession(request.sessionId)) {
        for (const finding of calibratedFindings) {
          if (finding.repoSearchQuery) {
            try {
              const location = await GitHubService.getInstance().locateCodeInRepo(
                request.sessionId,
                finding.repoSearchQuery,
                finding,
                request.repoUrl
              );
              if (location) {
                finding.githubLocation = location;
              }
            } catch {}
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────────────
      // 6. SCORE COMPUTATION & FINALIZATION
      // ─────────────────────────────────────────────────────────────────────────
      const { score, formula, summaryCounts } = DiagnosticsEngine.calculateHealthScore(calibratedFindings);
      const totalDuration = Math.round(performance.now() - startTime);

      scanResult.status = "completed";
      scanResult.scanCompleteness = scanCompleteness;
      scanResult.completenessNotice = completenessNotice;
      scanResult.completedAt = new Date().toISOString();
      scanResult.durationMs = totalDuration;
      scanResult.healthScore = score;
      scanResult.scoreFormula = formula;
      scanResult.summaryCounts = summaryCounts;
      scanResult.findings = calibratedFindings;

      this.activeJobs.set(jobId, scanResult);
      HistoryStore.getInstance().saveScan(scanResult);

      this.emitToRoom(jobId, "scan:completed", scanResult);
    } catch (err: any) {
      const totalDuration = Math.round(performance.now() - startTime);
      scanResult.completedAt = new Date().toISOString();
      scanResult.durationMs = totalDuration;
      scanResult.scanCompleteness = "failed_unreachable";

      if (err instanceof UnreachableTargetError) {
        scanResult.status = "failed_unreachable";
        scanResult.failureReason = err.reason;
        scanResult.healthScore = 0;
        scanResult.scoreFormula = "Scan failed: Target URL is unreachable";
        this.activeJobs.set(jobId, scanResult);
        this.emitToRoom(jobId, "scan:failed_unreachable", {
          jobId,
          status: "failed_unreachable",
          failureReason: err.reason
        });
      } else {
        scanResult.status = "failed_error";
        scanResult.scanCompleteness = "failed_error";
        scanResult.failureReason = err.message || "An unexpected error occurred during the scan.";
        scanResult.healthScore = 0;
        scanResult.scoreFormula = "Scan terminated due to system error";
        this.activeJobs.set(jobId, scanResult);
        this.emitToRoom(jobId, "scan:failed_error", {
          jobId,
          status: "failed_error",
          failureReason: scanResult.failureReason
        });
      }
    }
  }

  private emitCheckCompleted(
    jobId: string,
    checkName: string,
    category: any,
    durationMs: number,
    findings: Finding[],
    summary: string
  ): void {
    const payload: CheckEventPayload = {
      jobId,
      checkName,
      category,
      status: "completed",
      durationMs,
      summary,
      findings,
      timestamp: new Date().toISOString()
    };
    this.emitToRoom(jobId, "scan:check_completed", payload);
  }
}
