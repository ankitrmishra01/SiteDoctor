import { GitHubService } from "../src/github/github.service.js";
import { Finding } from "../src/diagnostics/types.js";
import { DIAGNOSTIC_RULES } from "../src/diagnostics/rules.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTest() {
  console.log("=== Testing Real Code-Level Fix & Diff Extraction ===");
  const githubService = GitHubService.getInstance();
  const sessionId = "test_session_" + Date.now();

  // Test with public repo: expressjs/express
  const repoUrl1 = "https://github.com/expressjs/express";
  // We register session without token or with anonymous token for public repo inspection
  // In GitHubService, we can register session or test locate directly
  // Let's set the session in memory
  (githubService as any).sessionStore.set(sessionId, {
    token: "", // Public read
    repoOwner: "expressjs",
    repoName: "express",
    expiresAt: Date.now() + 3600000,
    lastActive: Date.now()
  });

  // Finding 1: SEC_CSP_MISSING on Express backend repo
  const ruleCsp = DIAGNOSTIC_RULES["SEC_CSP_MISSING"]!;
  const finding1: Partial<Finding> = {
    ruleId: "SEC_CSP_MISSING",
    category: "security",
    severity: "warning",
    title: ruleCsp.title,
    codeSnippet: ruleCsp.codeSnippet || "Content-Security-Policy: default-src 'self';",
    fixSteps: ruleCsp.fixSteps,
    repoSearchQuery: "app.use("
  };

  console.log("\n[Test 1] Locating code and generating diff for SEC_CSP_MISSING in expressjs/express...");
  const location1 = await githubService.locateCodeInRepo(sessionId, "app.use(", finding1, repoUrl1);

  // Finding 2: CORS_MISSING on Express backend repo
  const ruleCors = DIAGNOSTIC_RULES["CORS_MISSING"]!;
  const finding2: Partial<Finding> = {
    ruleId: "CORS_MISSING",
    category: "backend",
    severity: "critical",
    title: ruleCors.title,
    codeSnippet: `app.use(cors({\n  origin: 'https://yourfrontend.com',\n  credentials: true\n}));`,
    fixSteps: ruleCors.fixSteps,
    repoSearchQuery: "app = express()"
  };

  console.log("\n[Test 2] Locating code and generating diff for CORS_MISSING in expressjs/express...");
  const location2 = await githubService.locateCodeInRepo(sessionId, "app = express()", finding2, repoUrl1);

  const testResults = {
    test1_csp: {
      ruleId: "SEC_CSP_MISSING",
      repo: repoUrl1,
      location: location1
    },
    test2_cors: {
      ruleId: "CORS_MISSING",
      repo: repoUrl1,
      location: location2
    }
  };

  const outputPath = path.resolve(__dirname, "../data/github_code_aware_diff_proof.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(testResults, null, 2), "utf-8");

  console.log("\n=== Test Results Output ===");
  console.log("Finding 1 (SEC_CSP_MISSING) Diff:");
  console.log(location1?.diff);
  console.log("\nFinding 2 (CORS_MISSING) Diff:");
  console.log(location2?.diff);
  console.log("\nSaved proof to:", outputPath);
}

runTest().catch(console.error);
