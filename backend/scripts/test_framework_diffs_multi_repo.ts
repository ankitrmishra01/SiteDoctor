import { GitHubService } from "../src/github/github.service.js";
import { Finding } from "../src/diagnostics/types.js";
import { DIAGNOSTIC_RULES } from "../src/diagnostics/rules.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMultiRepoDiffTest() {
  console.log("================================================================================");
  console.log("TESTING FRAMEWORK-AWARE REPOSITORY CODE DIFF EXTRACTION (3 DISTINCT FRAMEWORKS)");
  console.log("================================================================================");

  const githubService = GitHubService.getInstance();
  const sessionId = "test_session_multi_" + Date.now();

  // Helper to register public repo session
  function setupSession(owner: string, repo: string) {
    (githubService as any).sessionStore.set(sessionId, {
      token: "", // Public read via unauthenticated Octokit
      repoOwner: owner,
      repoName: repo,
      expiresAt: Date.now() + 3600000,
      lastActive: Date.now()
    });
  }

  const results: Record<string, any> = {};

  // ─────────────────────────────────────────────────────────────────────────────
  // REPO 1: Express.js (expressjs/express)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[REPO 1: Express.js] Testing against https://github.com/expressjs/express...");
  setupSession("expressjs", "express");

  const findingExpressCsp: Partial<Finding> = {
    ruleId: "SEC_CSP_MISSING",
    category: "security",
    severity: "warning",
    title: "Content Security Policy (CSP) Header Missing",
    codeSnippet: "app.use(helmet.contentSecurityPolicy({ directives: { defaultSrc: [\"'self'\"] } }));",
    fixSteps: DIAGNOSTIC_RULES["SEC_CSP_MISSING"]?.fixSteps
  };

  const findingExpressCors: Partial<Finding> = {
    ruleId: "CORS_MISSING",
    category: "backend",
    severity: "critical",
    title: "CORS Header Missing on API Endpoint",
    codeSnippet: "app.use(cors({ origin: 'https://yourfrontend.com', credentials: true }));",
    fixSteps: DIAGNOSTIC_RULES["CORS_MISSING"]?.fixSteps
  };

  const locExpressCsp = await githubService.locateCodeInRepo(sessionId, "express()", findingExpressCsp, "https://github.com/expressjs/express");
  const locExpressCors = await githubService.locateCodeInRepo(sessionId, "express()", findingExpressCors, "https://github.com/expressjs/express");

  results["repo_1_express"] = {
    repo: "https://github.com/expressjs/express",
    framework: "Express.js (Node.js)",
    findings: {
      SEC_CSP_MISSING: locExpressCsp,
      CORS_MISSING: locExpressCors
    }
  };

  console.log("✓ Express CSP Diff generated:", locExpressCsp?.filePath, "Target Line:", locExpressCsp?.lineNumber);
  console.log("✓ Express CORS Diff generated:", locExpressCors?.filePath, "Target Line:", locExpressCors?.lineNumber);

  // ─────────────────────────────────────────────────────────────────────────────
  // REPO 2: FastAPI / Python (fastapi/full-stack-fastapi-template)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[REPO 2: FastAPI] Testing against https://github.com/fastapi/full-stack-fastapi-template...");
  setupSession("fastapi", "full-stack-fastapi-template");

  const findingFastApiCsp: Partial<Finding> = {
    ruleId: "SEC_CSP_MISSING",
    category: "security",
    severity: "warning",
    title: "Content Security Policy (CSP) Header Missing",
    codeSnippet: "@app.middleware('http')\nasync def add_csp(request, call_next):\n    response = await call_next(request)\n    response.headers['Content-Security-Policy'] = \"default-src 'self'\"\n    return response",
    fixSteps: DIAGNOSTIC_RULES["SEC_CSP_MISSING"]?.fixSteps
  };

  const findingFastApiCors: Partial<Finding> = {
    ruleId: "CORS_MISSING",
    category: "backend",
    severity: "critical",
    title: "CORS Header Missing on API Endpoint",
    codeSnippet: "app.add_middleware(CORSMiddleware, allow_origins=['https://yourfrontend.com'])",
    fixSteps: DIAGNOSTIC_RULES["CORS_MISSING"]?.fixSteps
  };

  const locFastApiCsp = await githubService.locateCodeInRepo(sessionId, "FastAPI(", findingFastApiCsp, "https://github.com/fastapi/full-stack-fastapi-template");
  const locFastApiCors = await githubService.locateCodeInRepo(sessionId, "CORSMiddleware", findingFastApiCors, "https://github.com/fastapi/full-stack-fastapi-template");

  results["repo_2_fastapi"] = {
    repo: "https://github.com/fastapi/full-stack-fastapi-template",
    framework: "FastAPI / Python",
    findings: {
      SEC_CSP_MISSING: locFastApiCsp,
      CORS_MISSING: locFastApiCors
    }
  };

  console.log("✓ FastAPI CSP Diff generated:", locFastApiCsp?.filePath, "Target Line:", locFastApiCsp?.lineNumber);
  console.log("✓ FastAPI CORS Diff generated:", locFastApiCors?.filePath, "Target Line:", locFastApiCors?.lineNumber);

  // ─────────────────────────────────────────────────────────────────────────────
  // REPO 3: Next.js (shadcn-ui/taxonomy)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[REPO 3: Next.js] Testing against https://github.com/shadcn-ui/taxonomy...");
  setupSession("shadcn-ui", "taxonomy");

  const findingNextJsCsp: Partial<Finding> = {
    ruleId: "SEC_CSP_MISSING",
    category: "security",
    severity: "warning",
    title: "Content Security Policy (CSP) Header Missing",
    codeSnippet: "async headers() { return [ { source: '/:path*', headers: [ { key: 'Content-Security-Policy', value: \"default-src 'self'\" } ] } ]; }",
    fixSteps: DIAGNOSTIC_RULES["SEC_CSP_MISSING"]?.fixSteps
  };

  const locNextJsCsp = await githubService.locateCodeInRepo(sessionId, "nextConfig", findingNextJsCsp, "https://github.com/shadcn-ui/taxonomy");

  results["repo_3_nextjs"] = {
    repo: "https://github.com/shadcn-ui/taxonomy",
    framework: "Next.js (React)",
    findings: {
      SEC_CSP_MISSING: locNextJsCsp
    }
  };

  console.log("✓ Next.js CSP Diff generated:", locNextJsCsp?.filePath, "Target Line:", locNextJsCsp?.lineNumber);

  // Save full results to JSON artifact
  const outPath = path.resolve(__dirname, "../data/multi_framework_diff_proof.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");

  console.log("\n================================================================================");
  console.log("ALL 3 REPOSITORIES TESTED & SAVED TO:", outPath);
  console.log("================================================================================");
  console.log("\n--- [Diff Output Preview: Express CSP] ---");
  console.log(locExpressCsp?.diff);
  console.log("\n--- [Diff Output Preview: Express CORS] ---");
  console.log(locExpressCors?.diff);
  console.log("\n--- [Diff Output Preview: FastAPI CSP] ---");
  console.log(locFastApiCsp?.diff);
  console.log("\n--- [Diff Output Preview: Next.js CSP] ---");
  console.log(locNextJsCsp?.diff);
}

runMultiRepoDiffTest().catch(console.error);
