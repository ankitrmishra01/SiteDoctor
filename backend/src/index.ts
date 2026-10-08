import express from "express";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import { config } from "./config.js";
import { ScanQueueManager } from "./queue/scanQueue.js";
import { HistoryStore } from "./storage/history.store.js";
import { GitHubService } from "./github/github.service.js";
import { DomainVerifier } from "./verification/domainVerifier.js";
import { AuthService } from "./auth/auth.service.js";

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS
const io = new SocketIOServer(server, {
  cors: {
    origin: config.allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Configure Queue Manager with Socket.io server
const queueManager = ScanQueueManager.getInstance();
queueManager.setSocketServer(io);

// Middleware
app.use(cors({ origin: config.allowedOrigins, credentials: true }));
app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMITING (Concrete limits requested)
// ─────────────────────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: config.rateLimits.global.windowMs,
  max: config.rateLimits.global.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: config.rateLimits.global.message
});

const scanLimiter = rateLimit({
  windowMs: config.rateLimits.scan.windowMs,
  max: config.rateLimits.scan.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: config.rateLimits.scan.message
});

const githubLimiter = rateLimit({
  windowMs: config.rateLimits.githubSearch.windowMs,
  max: config.rateLimits.githubSearch.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: config.rateLimits.githubSearch.message
});

app.use(globalLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// REST API ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// System Health
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "SiteDoctor Diagnostic Engine",
    version: "1.0.0",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Downloadable PDF Verification Report
app.get("/api/report/pdf", (_req, res) => {
  const pdfPath = path.resolve(process.cwd(), "data/SiteDoctor_Verification_Report.pdf");
  const fallbackPath = path.resolve(process.cwd(), "../SiteDoctor_Verification_Report.pdf");
  const targetPath = fs.existsSync(pdfPath) ? pdfPath : (fs.existsSync(fallbackPath) ? fallbackPath : null);

  if (targetPath) {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="SiteDoctor_Verification_Report.pdf"');
    fs.createReadStream(targetPath).pipe(res);
  } else {
    res.status(404).json({ error: "PDF report not found. Run generate_pdf_report script first." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATION HELPER & ROUTES (Category J)
// ─────────────────────────────────────────────────────────────────────────────
function getAuthenticatedUser(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.substring(7).trim();
  return AuthService.getInstance().verifyToken(token);
}

const SignupSchema = z.object({
  email: z.string().email("Valid email address is required"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  name: z.string().optional()
});

const LoginSchema = z.object({
  email: z.string().email("Valid email address is required"),
  password: z.string().min(1, "Password is required")
});

app.post("/api/auth/signup", (req, res) => {
  try {
    const parseResult = SignupSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation failed", issues: parseResult.error.issues.map(i => i.message) });
    }
    const result = AuthService.getInstance().signup(parseResult.data);
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const parseResult = LoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation failed", issues: parseResult.error.issues.map(i => i.message) });
    }
    const result = AuthService.getInstance().login(parseResult.data);
    return res.json(result);
  } catch (err: any) {
    return res.status(401).json({ error: err.message });
  }
});

app.get("/api/auth/me", (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized or expired token" });
  }
  const fullUser = AuthService.getInstance().getUserById(user.sub);
  if (!fullUser) {
    return res.status(404).json({ error: "User account not found" });
  }
  return res.json({ user: fullUser });
});

app.get("/api/auth/usage", (req, res) => {
  const user = getAuthenticatedUser(req);
  const userId = user ? user.sub : "anonymous";
  const allowance = AuthService.getInstance().checkScanAllowance(userId);
  return res.json(allowance);
});

// Scan Request Schema Validation
const ScanRequestSchema = z.object({
  url: z.string().url("Please provide a valid URL including http:// or https://"),
  type: z.enum(["frontend", "backend", "both"]),
  openApiUrl: z.string().url().optional().or(z.literal("")),
  consent: z.literal(true, {
    errorMap: () => ({ message: "You must confirm you own or have permission to scan this target." })
  }),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  repoUrl: z.string().optional()
});

// POST /api/scan - Start diagnostic scan job
app.post("/api/scan", scanLimiter, async (req, res) => {
  try {
    const parseResult = ScanRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        issues: parseResult.error.issues.map(i => i.message)
      });
    }

    const { url, type, openApiUrl, consent, sessionId, repoUrl } = parseResult.data;
    const authUser = getAuthenticatedUser(req);
    const userId = authUser ? authUser.sub : (parseResult.data.userId || "anonymous");

    // Check plan quota
    const allowance = AuthService.getInstance().checkScanAllowance(userId);
    if (!allowance.allowed) {
      return res.status(403).json({
        error: "Quota Exceeded",
        message: allowance.reason,
        usage: allowance.usage
      });
    }

    const jobId = await queueManager.addScanJob({
      url,
      type,
      userId,
      openApiUrl: openApiUrl || undefined,
      consent,
      sessionId,
      repoUrl
    });

    // Record usage
    AuthService.getInstance().recordScan(userId);

    return res.status(202).json({
      jobId,
      status: "queued",
      message: "Diagnostic scan queued successfully.",
      targetUrl: url,
      scanType: type,
      userId
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to enqueue scan", details: err.message });
  }
});

// GET /api/scan/:id - Retrieve scan result by ID
app.get("/api/scan/:id", (req, res) => {
  const result = queueManager.getScanStatus(req.params.id);
  if (!result) {
    return res.status(404).json({ error: "Scan not found or expired" });
  }
  return res.json(result);
});

// GET /api/history - Retrieve past scan records
app.get("/api/history", (req, res) => {
  const targetUrl = req.query.url as string | undefined;
  const historyStore = HistoryStore.getInstance();
  const authUser = getAuthenticatedUser(req);
  const queryUserId = req.query.userId as string | undefined;
  const effectiveUserId = authUser ? authUser.sub : queryUserId;

  if (effectiveUserId) {
    const userScans = historyStore.getHistoryByUser(effectiveUserId);
    if (targetUrl) {
      const filtered = userScans.filter(s => s.targetUrl.toLowerCase() === targetUrl.toLowerCase());
      return res.json({ targetUrl, userId: effectiveUserId, count: filtered.length, history: filtered });
    }
    return res.json({ userId: effectiveUserId, count: userScans.length, history: userScans });
  }

  if (targetUrl) {
    const scans = historyStore.getHistoryByUrl(targetUrl);
    return res.json({ targetUrl, count: scans.length, history: scans });
  }

  const recent = historyStore.getRecentScans(30);
  return res.json({ count: recent.length, history: recent });
});

// POST /api/github/connect - Connect GitHub PAT securely in volatile memory only
const GitHubConnectSchema = z.object({
  token: z.string().min(1, "GitHub Token is required"),
  repoUrl: z.string().optional(),
  sessionId: z.string().min(1, "Session ID is required")
});

app.post("/api/github/connect", githubLimiter, async (req, res) => {
  const parseResult = GitHubConnectSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parseResult.error.issues });
  }

  const { token, repoUrl, sessionId } = parseResult.data;
  const result = await GitHubService.getInstance().registerSessionToken(sessionId, token, repoUrl);

  if (!result.valid) {
    return res.status(403).json({ error: result.message, scopes: result.scopes });
  }

  return res.json({ success: true, message: result.message, scopes: result.scopes });
});

// POST /api/github/disconnect - Clear GitHub token from memory
app.post("/api/github/disconnect", (req, res) => {
  const sessionId = req.body?.sessionId;
  if (sessionId) {
    GitHubService.getInstance().clearSession(sessionId);
  }
  return res.json({ success: true, message: "GitHub session cleared from memory." });
});

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN OWNERSHIP VERIFICATION (Multi-Method Safeguards)
// ─────────────────────────────────────────────────────────────────────────────
const DomainChallengeSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
  userId: z.string().optional().default("anonymous")
});

app.post("/api/domains/challenge", (req, res) => {
  const parseResult = DomainChallengeSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid domain request", issues: parseResult.error.issues });
  }

  const { domain, userId } = parseResult.data;
  const verifier = DomainVerifier.getInstance();
  const challenge = verifier.createChallenge(domain, userId);

  return res.json({
    success: true,
    domain: challenge.domain,
    token: challenge.token,
    verified: challenge.verified,
    expiresAt: challenge.expiresAt,
    instructions: challenge.instructions
  });
});

app.post("/api/domains/verify", async (req, res) => {
  const parseResult = DomainChallengeSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid verification request", issues: parseResult.error.issues });
  }

  const { domain, userId } = parseResult.data;
  const verifier = DomainVerifier.getInstance();
  const result = await verifier.verifyDomain(domain, userId);

  return res.json(result);
});

app.get("/api/domains/status", (req, res) => {
  const domain = req.query.domain as string;
  const userId = (req.query.userId as string) || "anonymous";

  if (!domain) {
    return res.status(400).json({ error: "Query parameter 'domain' is required" });
  }

  const verifier = DomainVerifier.getInstance();
  const verified = verifier.isDomainVerified(domain, userId);

  return res.json({
    domain: verifier.sanitizeDomain(domain),
    userId,
    verified
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ABUSE & UNCONSENTED SCAN REPORTING
// ─────────────────────────────────────────────────────────────────────────────
const AbuseReportSchema = z.object({
  targetUrl: z.string().min(1, "Target URL is required"),
  reporterEmail: z.string().email("Valid reporter email required"),
  reason: z.string().min(5, "Please provide reason details")
});

app.post("/api/abuse/report", (req, res) => {
  const parseResult = AbuseReportSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid abuse report", issues: parseResult.error.issues });
  }

  const verifier = DomainVerifier.getInstance();
  const report = verifier.reportAbuse({
    ...parseResult.data,
    ipAddress: req.ip
  });

  return res.status(201).json({
    success: true,
    message: "Abuse report received. Our security team will review and take appropriate mitigation actions.",
    reportId: report.id
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET.IO EVENT HANDLING
// ─────────────────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  // Join room for a specific scan job
  socket.on("scan:subscribe", (jobId: string) => {
    socket.join(`scan:${jobId}`);
  });

  // On socket disconnect, purge session auth if tied to socket ID
  socket.on("disconnect", () => {
    GitHubService.getInstance().clearSession(socket.id);
  });
});

// Start HTTP Server
server.listen(config.port, () => {
  console.log(`\n🏥 SiteDoctor Backend Engine running at http://localhost:${config.port}`);
  console.log(`🔌 WebSockets active | Storage FIFO limit: ${config.storage.maxScansPerUrl}/url (Cap: ${config.storage.maxTotalScans})`);
  console.log(`🛡️ Rate limits active: Scan (5/hr), GitHub (20/hr), Global (100/15m)\n`);
});
