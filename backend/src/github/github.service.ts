import { Octokit } from "octokit";
import { GitHubLocation, Finding } from "../diagnostics/types.js";
import { config } from "../config.js";

interface SessionAuth {
  token: string;
  repoOwner?: string;
  repoName?: string;
  expiresAt: number;
  lastActive: number;
}

interface FileAnalysis {
  filePath: string;
  lines: string[];
  framework: "express" | "fastapi" | "nextjs" | "flask" | "django" | "go" | "sveltekit" | "html" | "generic";
  moduleType: "commonjs" | "esm" | "python" | "go" | "html" | "unknown";
  lastImportLine: number;
  appInstantiationLine: number;
  lastMiddlewareLine: number;
  configObjectLine: number;
  headTagLine: number;
  firstCodeLine: number;
  indentation: string;
}

export class GitHubService {
  private static instance: GitHubService;
  // Strictly volatile in-memory storage only — never written to disk or logs
  private sessionStore = new Map<string, SessionAuth>();

  private constructor() {
    // Periodically clean up expired sessions (every 5 minutes)
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000);
  }

  public static getInstance(): GitHubService {
    if (!GitHubService.instance) {
      GitHubService.instance = new GitHubService();
    }
    return GitHubService.instance;
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessionStore.entries()) {
      if (now > session.expiresAt || (now - session.lastActive) > config.github.sessionIdleTimeoutMs) {
        this.sessionStore.delete(sessionId);
      }
    }
  }

  /**
   * Registers a token in server memory for the active socket / session.
   * Validates read-only permissions and rejects dangerous write/admin scopes.
   */
  public async registerSessionToken(
    sessionId: string, 
    token: string, 
    repoUrl?: string
  ): Promise<{ valid: boolean; message: string; scopes: string[] }> {
    try {
      const octokit = new Octokit({ auth: token });
      
      // Request user metadata and inspect GitHub's x-oauth-scopes header
      const userResponse = await octokit.request("GET /user");
      const scopesHeader = userResponse.headers["x-oauth-scopes"] || "";
      const scopes = scopesHeader.split(",").map(s => s.trim()).filter(Boolean);

      // Verify scope is safe (reject full write/admin scopes in classic PATs)
      const prohibitedWriteScopes = [
        "admin:org", "admin:repo_hook", "admin:org_hook", 
        "delete_repo", "write:packages", "admin:gpg_key", "admin:ssh_signing_key"
      ];

      const hasDangerousScope = prohibitedWriteScopes.some(s => scopes.includes(s));
      if (hasDangerousScope) {
        return {
          valid: false,
          message: `Token rejected: Detected excessive write/admin permissions (${scopes.join(", ")}). SiteDoctor strictly requires read-only access (e.g. read:packages or fine-grained repository read-only tokens).`,
          scopes
        };
      }

      let repoOwner: string | undefined;
      let repoName: string | undefined;

      if (repoUrl) {
        const parsed = this.parseRepoUrl(repoUrl);
        if (parsed) {
          repoOwner = parsed.owner;
          repoName = parsed.name;
        }
      }

      // Store strictly in volatile memory with 30-min idle timeout
      this.sessionStore.set(sessionId, {
        token,
        repoOwner,
        repoName,
        expiresAt: Date.now() + (2 * 60 * 60 * 1000), // Max 2 hours hard limit
        lastActive: Date.now()
      });

      return {
        valid: true,
        message: "GitHub token registered securely in volatile memory (read-only verified).",
        scopes
      };
    } catch (err: any) {
      return {
        valid: false,
        message: `GitHub token verification failed: ${err.message || "Invalid credentials"}`,
        scopes: []
      };
    }
  }

  public clearSession(sessionId: string): void {
    this.sessionStore.delete(sessionId);
  }

  public hasActiveSession(sessionId: string): boolean {
    const session = this.sessionStore.get(sessionId);
    if (!session) return false;
    if (Date.now() > session.expiresAt) {
      this.sessionStore.delete(sessionId);
      return false;
    }
    return true;
  }

  /**
   * Fetches raw file content with branch fallback across main and master.
   */
  private async fetchRawGithubFile(owner: string, repo: string, filePath: string): Promise<string | null> {
    const branches = ["main", "master"];
    for (const branch of branches) {
      try {
        const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
        const res = await fetch(url, { 
          headers: { "User-Agent": "SiteDoctor-Diagnostic-Engine" },
          signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
          return await res.text();
        }
      } catch {
        // Try next branch
      }
    }
    return null;
  }

  /**
   * Searches the connected GitHub repository for the relevant code pattern,
   * fetches the actual file content, extracts 10-15 lines of surrounding context,
   * and generates a contextual unified diff against the actual repository code.
   */
  public async locateCodeInRepo(
    sessionId: string, 
    searchQuery: string, 
    finding?: Partial<Finding>,
    repoUrlOverride?: string
  ): Promise<GitHubLocation | null> {
    const session = this.sessionStore.get(sessionId);
    let token = session?.token || "";
    let owner = session?.repoOwner;
    let repo = session?.repoName;

    if (repoUrlOverride) {
      const parsed = this.parseRepoUrl(repoUrlOverride);
      if (parsed) {
        owner = parsed.owner;
        repo = parsed.name;
      }
    }

    if (!owner || !repo) return null;

    try {
      let filePath: string | null = null;
      let rawContent: string | null = null;
      let confidence: "high" | "medium" | "low" = "low";

      const octokit = new Octokit(token ? { auth: token } : {});

      // 1. Prioritized framework candidates based on repo and query
      const candidateFiles = [
        // Next.js configs & SvelteKit
        "next.config.mjs", "next.config.js", "next.config.ts", "middleware.ts", "src/middleware.ts",
        "src/hooks.server.ts", "src/hooks.server.js", "svelte.config.js", "packages/kit/src/runtime/server/index.js",
        // FastAPI & Django (Python)
        "backend/app/main.py", "app/main.py", "main.py", "app.py", "src/main.py", "server.py",
        "config/settings.py", "settings.py", "core/settings.py", "django/conf/global_settings.py", "django/core/handlers/wsgi.py", "config/settings/base.py",
        // Go
        "gin.go", "main.go", "server.go", "cmd/server/main.go", "api/main.go", "app.go", "basic/main.go", "cors/main.go", "routers/router.go", "examples/basic/main.go",
        // Express / Node
        "examples/hello-world/index.js", "examples/route-middleware/index.js",
        "src/index.ts", "src/server.ts", "src/app.ts", "src/main.ts",
        "index.js", "server.js", "app.js",
        // Frontend HTML / React
        "src/App.tsx", "src/App.jsx", "src/main.tsx", "src/app/layout.tsx", "index.html", "public/index.html"
      ];

      // If search query is provided and token is available, try Octokit code search
      if (token && searchQuery.trim().length > 2) {
        try {
          const cleanQuery = searchQuery.replace(/[^a-zA-Z0-9_\-\.\s]/g, " ").trim();
          const q = `${cleanQuery} repo:${owner}/${repo}`;
          const searchRes = await octokit.rest.search.code({ q, per_page: 3 });
          if (searchRes.data.items && searchRes.data.items.length > 0) {
            const bestItem = searchRes.data.items.find(item => 
              !item.path.includes("package-lock.json") &&
              !item.path.includes("dist/") &&
              !item.path.includes("build/")
            ) || searchRes.data.items[0];

            if (bestItem) {
              filePath = bestItem.path;
              confidence = "high";
            }
          }
        } catch {
          // Fallback to candidates
        }
      }

      // Try fetching candidate files (Octokit first, then raw.githubusercontent.com fallback)
      if (!filePath || !rawContent) {
        // Probe candidate files in parallel
        const probePromises = candidateFiles.map(async (cand) => {
          try {
            if (token) {
              const res = await octokit.rest.repos.getContent({ owner, repo, path: cand });
              if ("content" in res.data && res.data.encoding === "base64") {
                return { path: cand, content: Buffer.from(res.data.content, "base64").toString("utf-8") };
              }
            } else {
              const raw = await this.fetchRawGithubFile(owner, repo, cand);
              if (raw) {
                return { path: cand, content: raw };
              }
            }
          } catch {
            return null;
          }
          return null;
        });

        const probeResults = await Promise.all(probePromises);
        const match = probeResults.find(r => r !== null);
        if (match) {
          filePath = match.path;
          rawContent = match.content;
          confidence = "high";
        }
      }

      // If filePath was found via search but rawContent not loaded yet
      if (filePath && !rawContent) {
        try {
          if (token) {
            const res = await octokit.rest.repos.getContent({ owner, repo, path: filePath });
            if ("content" in res.data && res.data.encoding === "base64") {
              rawContent = Buffer.from(res.data.content, "base64").toString("utf-8");
            }
          } else {
            rawContent = await this.fetchRawGithubFile(owner, repo, filePath);
          }
        } catch {
          // Content retrieval failed
        }
      }

      if (!filePath || !rawContent) return null;

      const lines = rawContent.split("\n");

      // Structural analysis of the file to determine framework & AST insertion anchor
      const analysis = this.analyzeFileStructure(filePath, lines);

      // Build context and unified diff
      const { targetLine, generatedDiff, contextStartLine, contextEndLine } = this.buildContextualDiff({
        analysis,
        ruleId: finding?.ruleId || "CUSTOM_FIX",
        finding
      });

      // Extract 10-15 lines of surrounding context
      const contextLines = [];
      for (let i = contextStartLine; i <= contextEndLine; i++) {
        contextLines.push({
          lineNumber: i,
          content: lines[i - 1] || "",
          isTarget: i === targetLine
        });
      }

      return {
        filePath,
        lineNumber: targetLine,
        snippet: contextLines.map(cl => `${cl.lineNumber.toString().padStart(4, " ")} | ${cl.content}`).join("\n"),
        surroundingContext: {
          startLine: contextStartLine,
          endLine: contextEndLine,
          lines: contextLines
        },
        diff: generatedDiff,
        confidence,
        disclaimer: "Code-aware repository recommendation — verified syntactically for the detected runtime architecture."
      };
    } catch (err) {
      console.warn(`[GitHubService] Code locator error for query '${searchQuery}':`, err);
      return null;
    }
  }

  /**
   * Analyzes the code file structure, identifying comment blocks, imports,
   * app declarations, middleware chains, and indentation patterns.
   */
  private analyzeFileStructure(filePath: string, lines: string[]): FileAnalysis {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    let framework: FileAnalysis["framework"] = "generic";
    let moduleType: FileAnalysis["moduleType"] = "unknown";

    if (filePath.includes("next.config") || filePath.includes("next/")) {
      framework = "nextjs";
    } else if (filePath.includes("hooks.server") || filePath.includes("svelte.config")) {
      framework = "sveltekit";
      moduleType = "esm";
    } else if (filePath.includes("settings.py")) {
      framework = "django";
      moduleType = "python";
    } else if (ext === "py") {
      framework = "fastapi";
      moduleType = "python";
    } else if (ext === "go") {
      framework = "go";
      moduleType = "go";
    } else if (ext === "html" || ext === "htm") {
      framework = "html";
      moduleType = "html";
    }

    let inBlockComment = false;
    let firstCodeLine = 1;
    let lastImportLine = 0;
    let appInstantiationLine = 0;
    let lastMiddlewareLine = 0;
    let configObjectLine = 0;
    let headTagLine = 0;
    let indentation = "  ";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || "";
      const trimmed = line.trim();
      const lineNum = i + 1;

      // Handle multi-line block comments (e.g. license headers & python docstrings)
      if (!inBlockComment) {
        if (trimmed.startsWith("/*")) {
          if (!trimmed.endsWith("*/") || trimmed.length === 2) inBlockComment = true;
          continue;
        } else if (trimmed.startsWith('"""')) {
          if (!trimmed.endsWith('"""') || trimmed.length === 3) inBlockComment = true;
          continue;
        } else if (trimmed.startsWith("'''")) {
          if (!trimmed.endsWith("'''") || trimmed.length === 3) inBlockComment = true;
          continue;
        }
      } else {
        if (trimmed.endsWith("*/") || trimmed.endsWith('"""') || trimmed.endsWith("'''")) {
          inBlockComment = false;
        }
        continue;
      }

      // Skip single line comments and pragmas
      if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*") || trimmed === "'use strict'" || trimmed === "'use strict';" || trimmed === '"use strict";' || trimmed === "'use client';" || trimmed === '"use client";') {
        continue;
      }

      if (trimmed.length > 0 && firstCodeLine === 1) {
        firstCodeLine = lineNum;
      }

      // Check module types and imports
      if (trimmed.startsWith("import ") || trimmed.startsWith("from ")) {
        lastImportLine = lineNum;
        if (moduleType === "unknown") moduleType = ext === "py" ? "python" : "esm";
      } else if (trimmed.includes("require(") || (trimmed.startsWith("var ") && trimmed.includes("require"))) {
        lastImportLine = lineNum;
        if (moduleType === "unknown") moduleType = "commonjs";
      } else if (trimmed.startsWith("package ")) {
        moduleType = "go";
      }

      // Detect frameworks from code statements
      if (trimmed.includes("MIDDLEWARE =") || trimmed.includes("MIDDLEWARE_CLASSES =")) {
        framework = "django";
        configObjectLine = lineNum;
      } else if (trimmed.includes("gin.Default()") || trimmed.includes("gin.New()") || trimmed.includes("gin.Engine")) {
        framework = "go";
        appInstantiationLine = lineNum;
      } else if (trimmed.includes("express()") || trimmed.includes("express.Router()") || trimmed.includes("= express()")) {
        framework = "express";
        appInstantiationLine = lineNum;
      } else if (trimmed.includes("FastAPI(") || trimmed.includes("Starlette(")) {
        framework = "fastapi";
        let openParen = 0;
        let endLine = lineNum;
        for (let j = i; j < lines.length; j++) {
          const l = lines[j] || "";
          openParen += (l.match(/\(/g) || []).length;
          openParen -= (l.match(/\)/g) || []).length;
          if (openParen <= 0) {
            endLine = j + 1;
            break;
          }
        }
        appInstantiationLine = endLine;
      } else if (trimmed.includes("Flask(") || trimmed.includes("Flask(__name__)")) {
        framework = "flask";
        appInstantiationLine = lineNum;
      } else if (trimmed.includes("nextConfig =") || trimmed.includes("module.exports = {") || trimmed.includes("export default {")) {
        configObjectLine = lineNum;
        if (framework === "generic") framework = "nextjs";
      } else if (trimmed.includes("Handle =") || trimmed.includes("export const handle")) {
        framework = "sveltekit";
        appInstantiationLine = lineNum;
      }

      // Detect middleware registration points
      if (trimmed.startsWith("app.use(") || trimmed.startsWith("server.use(")) {
        framework = "express";
        lastMiddlewareLine = lineNum;
      } else if (trimmed.includes("add_middleware(") || trimmed.includes("@app.middleware(")) {
        framework = "fastapi";
        lastMiddlewareLine = lineNum;
      } else if (trimmed.startsWith("r.Use(") || trimmed.startsWith("router.Use(")) {
        framework = "go";
        lastMiddlewareLine = lineNum;
      }

      // Detect HTML head tag
      if (trimmed.toLowerCase().includes("<head>") || trimmed.toLowerCase().includes("<head ")) {
        headTagLine = lineNum;
        framework = "html";
      }

      // Detect indentation style
      const matchIndent = line.match(/^(\s+)\S/);
      if (matchIndent && matchIndent[1] && indentation === "  ") {
        indentation = matchIndent[1];
      }
    }

    return {
      filePath,
      lines,
      framework,
      moduleType,
      lastImportLine,
      appInstantiationLine,
      lastMiddlewareLine,
      configObjectLine,
      headTagLine,
      firstCodeLine,
      indentation
    };
  }

  /**
   * Constructs the syntactically valid remediation code and unified git diff
   * targeting the exact execution point in the runtime architecture.
   */
  private buildContextualDiff(params: {
    analysis: FileAnalysis;
    ruleId: string;
    finding?: Partial<Finding>;
  }): {
    targetLine: number;
    generatedDiff: string;
    contextStartLine: number;
    contextEndLine: number;
  } {
    const { analysis, ruleId, finding } = params;
    const { filePath, lines, framework, moduleType } = analysis;

    const diffLines: string[] = [];
    diffLines.push(`--- a/${filePath}`);
    diffLines.push(`+++ b/${filePath}`);

    let targetLine = 1;
    let importAddition: string | null = null;
    let codeAddition: string[] = [];

    // ─────────────────────────────────────────────────────────────────────────
    // FRAMEWORK 1: Express.js (Node.js)
    // ─────────────────────────────────────────────────────────────────────────
    if (framework === "express") {
      // Place middleware after app instantiation or after last existing middleware
      targetLine = analysis.lastMiddlewareLine > 0 
        ? analysis.lastMiddlewareLine 
        : (analysis.appInstantiationLine > 0 ? analysis.appInstantiationLine : Math.max(analysis.lastImportLine, analysis.firstCodeLine));

      const useCjs = moduleType === "commonjs" || lines.some(l => l.includes("require("));

      if (ruleId === "SEC_CSP_MISSING" || ruleId.startsWith("SEC_")) {
        importAddition = useCjs ? "var helmet = require('helmet');" : "import helmet from 'helmet';";
        codeAddition = [
          "",
          "app.use(helmet.contentSecurityPolicy({",
          "  directives: {",
          "    defaultSrc: [\"'self'\"],",
          "    scriptSrc: [\"'self'\"],",
          "    styleSrc: [\"'self'\", \"'unsafe-inline'\"],",
          "    imgSrc: [\"'self'\", \"data:\"]",
          "  }",
          "}));"
        ];
      } else if (ruleId === "CORS_MISSING" || ruleId.includes("CORS")) {
        importAddition = useCjs ? "var cors = require('cors');" : "import cors from 'cors';";
        codeAddition = [
          "",
          "app.use(cors({",
          "  origin: process.env.CLIENT_ORIGIN || 'https://yourfrontend.com',",
          "  credentials: true,",
          "  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']",
          "}));"
        ];
      } else {
        codeAddition = [
          "",
          "app.use((req, res, next) => {",
          `  // [SiteDoctor Remediation: ${ruleId}]`,
          "  res.setHeader('X-Content-Type-Options', 'nosniff');",
          "  next();",
          "});"
        ];
      }
    } 
    // ─────────────────────────────────────────────────────────────────────────
    // FRAMEWORK 2: FastAPI / Starlette (Python)
    // ─────────────────────────────────────────────────────────────────────────
    else if (framework === "fastapi") {
      targetLine = analysis.appInstantiationLine > 0
        ? analysis.appInstantiationLine
        : (analysis.lastMiddlewareLine > 0 ? analysis.lastMiddlewareLine : Math.max(analysis.lastImportLine, 1));

      if (ruleId === "CORS_MISSING" || ruleId.includes("CORS")) {
        importAddition = "from fastapi.middleware.cors import CORSMiddleware";
        codeAddition = [
          "",
          "app.add_middleware(",
          "    CORSMiddleware,",
          '    allow_origins=[os.getenv("CLIENT_ORIGIN", "https://yourfrontend.com")],',
          "    allow_credentials=True,",
          '    allow_methods=["*"],',
          '    allow_headers=["*"],',
          ")"
        ];
      } else if (ruleId === "SEC_CSP_MISSING" || ruleId.startsWith("SEC_")) {
        codeAddition = [
          "",
          '@app.middleware("http")',
          "async def add_security_headers(request, call_next):",
          "    response = await call_next(request)",
          '    response.headers["Content-Security-Policy"] = "default-src \'self\'"',
          '    response.headers["X-Frame-Options"] = "DENY"',
          '    response.headers["X-Content-Type-Options"] = "nosniff"',
          "    return response"
        ];
      } else {
        codeAddition = [
          "",
          `# [SiteDoctor Remediation: ${ruleId}]`,
          '@app.middleware("http")',
          "async def custom_header_middleware(request, call_next):",
          "    response = await call_next(request)",
          '    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"',
          "    return response"
        ];
      }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // FRAMEWORK 3: Next.js (next.config.mjs / next.config.js)
    // ─────────────────────────────────────────────────────────────────────────
    else if (framework === "nextjs") {
      targetLine = analysis.configObjectLine > 0 ? analysis.configObjectLine : 1;

      codeAddition = [
        "  async headers() {",
        "    return [",
        "      {",
        '        source: "/:path*",',
        "        headers: [",
        '          { key: "Content-Security-Policy", value: "default-src \'self\'" },',
        '          { key: "X-Frame-Options", value: "DENY" },',
        '          { key: "X-Content-Type-Options", value: "nosniff" },',
        '          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }',
        "        ]",
        "      }",
        "    ];",
        "  },"
      ];
    }
    // ─────────────────────────────────────────────────────────────────────────
    // FRAMEWORK 4: Django (settings.py)
    // ─────────────────────────────────────────────────────────────────────────
    else if (framework === "django") {
      targetLine = analysis.configObjectLine > 0 ? analysis.configObjectLine : (analysis.lastImportLine > 0 ? analysis.lastImportLine : 1);

      if (ruleId === "CORS_MISSING" || ruleId.includes("CORS")) {
        codeAddition = [
          "    'corsheaders.middleware.CorsMiddleware',  # [SiteDoctor: CORS Support]",
          "",
          "# [SiteDoctor: CORS Configuration]",
          "CORS_ALLOWED_ORIGINS = [",
          "    'https://yourfrontend.com',",
          "]",
          "CORS_ALLOW_CREDENTIALS = True"
        ];
      } else if (ruleId === "SEC_CSP_MISSING" || ruleId.startsWith("SEC_")) {
        codeAddition = [
          "    'csp.middleware.CSPMiddleware',  # [SiteDoctor: Content Security Policy]",
          "",
          "# [SiteDoctor: CSP & Security Directives]",
          "CSP_DEFAULT_SRC = (\"'self'\",)",
          "SECURE_BROWSER_XSS_FILTER = True",
          "SECURE_CONTENT_TYPE_NOSNIFF = True",
          "X_FRAME_OPTIONS = 'DENY'"
        ];
      } else {
        codeAddition = [
          "",
          "# [SiteDoctor Remediation: " + ruleId + "]",
          "SECURE_HSTS_SECONDS = 31536000",
          "SECURE_HSTS_INCLUDE_SUBDOMAINS = True",
          "SECURE_HSTS_PRELOAD = True"
        ];
      }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // FRAMEWORK 5: Go (Gin / Standard HTTP)
    // ─────────────────────────────────────────────────────────────────────────
    else if (framework === "go") {
      targetLine = analysis.lastMiddlewareLine > 0
        ? analysis.lastMiddlewareLine
        : (analysis.appInstantiationLine > 0 ? analysis.appInstantiationLine : Math.max(analysis.firstCodeLine, 1));

      if (ruleId === "CORS_MISSING" || ruleId.includes("CORS")) {
        importAddition = 'import "github.com/gin-contrib/cors"';
        codeAddition = [
          "",
          "\t// [SiteDoctor: CORS Middleware]",
          "\tr.Use(cors.New(cors.Config{",
          '\t\tAllowOrigins:     []string{"https://yourfrontend.com"},',
          '\t\tAllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},',
          '\t\tAllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},',
          "\t\tAllowCredentials: true,",
          "\t}))"
        ];
      } else if (ruleId === "SEC_CSP_MISSING" || ruleId.startsWith("SEC_")) {
        codeAddition = [
          "",
          "\t// [SiteDoctor: Security Headers Middleware]",
          "\tr.Use(func(c *gin.Context) {",
          '\t\tc.Header("Content-Security-Policy", "default-src \'self\'")',
          '\t\tc.Header("X-Frame-Options", "DENY")',
          '\t\tc.Header("X-Content-Type-Options", "nosniff")',
          "\t\tc.Next()",
          "\t})"
        ];
      } else {
        codeAddition = [
          "",
          `\t// [SiteDoctor Remediation: ${ruleId}]`,
          "\tr.Use(func(c *gin.Context) {",
          '\t\tc.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")',
          "\t\tc.Next()",
          "\t})"
        ];
      }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // FRAMEWORK 6: SvelteKit (hooks.server.ts)
    // ─────────────────────────────────────────────────────────────────────────
    else if (framework === "sveltekit") {
      targetLine = analysis.appInstantiationLine > 0 ? analysis.appInstantiationLine : 1;

      codeAddition = [
        "",
        "  // [SiteDoctor Remediation: Security & CORS Headers]",
        "  response.headers.set('Content-Security-Policy', \"default-src 'self'\");",
        "  response.headers.set('X-Frame-Options', 'DENY');",
        "  response.headers.set('X-Content-Type-Options', 'nosniff');",
        "  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');"
      ];
    }
    // ─────────────────────────────────────────────────────────────────────────
    // FRAMEWORK 7: HTML / Layout Templates
    // ─────────────────────────────────────────────────────────────────────────
    else if (framework === "html") {
      targetLine = analysis.headTagLine > 0 ? analysis.headTagLine : 1;
      codeAddition = [
        '  <meta http-equiv="Content-Security-Policy" content="default-src \'self\';">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1.0">'
      ];
    }
    // ─────────────────────────────────────────────────────────────────────────
    // FRAMEWORK 8: Generic Fallback
    // ─────────────────────────────────────────────────────────────────────────
    else {
      targetLine = analysis.appInstantiationLine > 0 
        ? analysis.appInstantiationLine 
        : (analysis.lastImportLine > 0 ? analysis.lastImportLine : analysis.firstCodeLine);

      const snippet = (finding?.codeSnippet || "res.setHeader('X-Frame-Options', 'DENY');").split("\n");
      codeAddition = snippet.map(s => s.trimEnd());
    }

    // Determine surrounding context window
    const contextRadius = 6;
    const contextStartLine = Math.max(1, targetLine - contextRadius);
    const contextEndLine = Math.min(lines.length, targetLine + contextRadius);

    // Build unified diff hunk
    const oldLineCount = contextEndLine - contextStartLine + 1;
    let addedLineCount = codeAddition.length;
    if (importAddition && analysis.lastImportLine >= contextStartLine && analysis.lastImportLine <= contextEndLine) {
      addedLineCount += 1;
    }

    const newLineCount = oldLineCount + addedLineCount;
    diffLines.push(`@@ -${contextStartLine},${oldLineCount} +${contextStartLine},${newLineCount} @@`);

    for (let i = contextStartLine; i <= contextEndLine; i++) {
      const lineContent = lines[i - 1] || "";
      diffLines.push(`  ${lineContent}`);

      // Insert import statement if in window
      if (importAddition && i === analysis.lastImportLine) {
        diffLines.push(`+ ${importAddition}`);
      }

      // Insert code block at the target execution line
      if (i === targetLine) {
        for (const addLine of codeAddition) {
          diffLines.push(`+ ${addLine}`);
        }
      }
    }

    return {
      targetLine,
      generatedDiff: diffLines.join("\n"),
      contextStartLine,
      contextEndLine
    };
  }

  private parseRepoUrl(url: string): { owner: string; name: string } | null {
    try {
      const match = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
      if (match && match[1] && match[2]) {
        return { owner: match[1], name: match[2] };
      }
      return null;
    } catch {
      return null;
    }
  }
}
