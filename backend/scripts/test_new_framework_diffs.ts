import { GitHubService } from "../src/github/github.service.js";
import { Finding } from "../src/diagnostics/types.js";
import { DIAGNOSTIC_RULES } from "../src/diagnostics/rules.js";

async function testNewFrameworkDiffs() {
  console.log("================================================================================");
  console.log("TESTING CODE DIFFS FOR 3 NEW STACKS: GO (GIN), DJANGO (PYTHON), SVELTEKIT");
  console.log("================================================================================");

  const githubService = GitHubService.getInstance();
  const sessionId = "session_new_diffs_" + Date.now();

  function setupSession(owner: string, repo: string) {
    (githubService as any).sessionStore.set(sessionId, {
      token: "",
      repoOwner: owner,
      repoName: repo,
      expiresAt: Date.now() + 3600000,
      lastActive: Date.now()
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REPO 1: Go (gin-gonic/examples)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[1. Go / Gin] Testing against https://github.com/gin-gonic/examples...");
  setupSession("gin-gonic", "examples");

  const goFinding: Partial<Finding> = {
    ruleId: "CORS_MISSING",
    category: "backend",
    severity: "critical",
    title: "CORS Header Missing on API Endpoint"
  };

  const goLoc = await githubService.locateCodeInRepo(sessionId, "gin.Default()", goFinding, "https://github.com/gin-gonic/examples");
  console.log("Go Result:");
  console.log("  Target File:", goLoc?.filePath);
  console.log("  Line Number:", goLoc?.lineNumber);
  console.log("  Confidence:", goLoc?.confidence);
  console.log("  Diff Snippet:\n", goLoc?.diff);

  // ─────────────────────────────────────────────────────────────────────────────
  // REPO 2: Django (django/django)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[2. Python / Django] Testing against https://github.com/django/django...");
  setupSession("django", "django");

  const djangoFinding: Partial<Finding> = {
    ruleId: "SEC_CSP_MISSING",
    category: "security",
    severity: "warning",
    title: "Content Security Policy (CSP) Header Missing"
  };

  const djangoLoc = await githubService.locateCodeInRepo(sessionId, "MIDDLEWARE", djangoFinding, "https://github.com/django/django");
  console.log("\nDjango Result:");
  console.log("  Target File:", djangoLoc?.filePath);
  console.log("  Line Number:", djangoLoc?.lineNumber);
  console.log("  Confidence:", djangoLoc?.confidence);
  console.log("  Diff Snippet:\n", djangoLoc?.diff);

  // ─────────────────────────────────────────────────────────────────────────────
  // REPO 3: SvelteKit (sveltejs/kit)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[3. SvelteKit] Testing against https://github.com/sveltejs/kit...");
  setupSession("sveltejs", "kit");

  const svelteFinding: Partial<Finding> = {
    ruleId: "SEC_CSP_MISSING",
    category: "security",
    severity: "warning",
    title: "Content Security Policy (CSP) Header Missing"
  };

  const svelteLoc = await githubService.locateCodeInRepo(sessionId, "respond", svelteFinding, "https://github.com/sveltejs/kit");
  console.log("\nSvelteKit Result:");
  console.log("  Target File:", svelteLoc?.filePath);
  console.log("  Line Number:", svelteLoc?.lineNumber);
  console.log("  Confidence:", svelteLoc?.confidence);
  console.log("  Diff Snippet:\n", svelteLoc?.diff);
}

testNewFrameworkDiffs().catch(console.error);
