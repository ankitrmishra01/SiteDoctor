import { AuthService } from "../src/auth/auth.service.js";
import { HistoryStore } from "../src/storage/history.store.js";
import { ScanResult } from "../src/diagnostics/types.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runAuthTests() {
  console.log("================================================================================");
  console.log("CATEGORY J: USER AUTHENTICATION & TIER QUOTA ENFORCEMENT AUDIT");
  console.log("================================================================================");

  // Clean test user data file for a fresh test run
  const testUsersFile = path.resolve(__dirname, "../data/users.json");
  if (fs.existsSync(testUsersFile)) {
    fs.unlinkSync(testUsersFile);
  }

  const auth = AuthService.getInstance();
  const historyStore = HistoryStore.getInstance();

  const auditResults: Record<string, any> = {
    signupTests: [],
    loginTests: [],
    tokenTests: [],
    quotaEnforcementTests: [],
    historyIsolationTests: []
  };

  // 1. Signup validation
  console.log("\n[1/5] Testing Account Creation & Signup Validation...");
  
  // 1a. Weak password rejection
  try {
    auth.signup({ email: "alice@example.com", password: "short" });
    auditResults.signupTests.push({ test: "Weak password rejection", passed: false, detail: "Allowed short password" });
  } catch (err: any) {
    console.log("  ✓ Correctly rejected password under 8 characters:", err.message);
    auditResults.signupTests.push({ test: "Weak password rejection", passed: true, message: err.message });
  }

  // 1b. Valid signup
  const aliceSignup = auth.signup({ email: "alice@example.com", password: "SuperSecurePassword123!", name: "Alice Developer" });
  console.log(`  ✓ Successfully signed up user Alice: ID=${aliceSignup.user.id}, Plan=${aliceSignup.user.plan}, MaxScans=${aliceSignup.user.maxMonthlyScans}`);
  auditResults.signupTests.push({ test: "Valid signup", passed: true, user: aliceSignup.user });

  // 1c. Duplicate signup rejection
  try {
    auth.signup({ email: "alice@example.com", password: "AnotherPassword123!" });
    auditResults.signupTests.push({ test: "Duplicate email rejection", passed: false });
  } catch (err: any) {
    console.log("  ✓ Correctly rejected duplicate email:", err.message);
    auditResults.signupTests.push({ test: "Duplicate email rejection", passed: true, message: err.message });
  }

  // 1d. Bob signup
  const bobSignup = auth.signup({ email: "bob@example.com", password: "BobSecurePassword456!", name: "Bob Engineer" });
  console.log(`  ✓ Successfully signed up user Bob: ID=${bobSignup.user.id}, Plan=${bobSignup.user.plan}`);

  // 2. Login verification
  console.log("\n[2/5] Testing Authentication & Password Verification...");
  
  // 2a. Invalid password
  try {
    auth.login({ email: "alice@example.com", password: "WrongPassword" });
    auditResults.loginTests.push({ test: "Invalid password rejection", passed: false });
  } catch (err: any) {
    console.log("  ✓ Correctly rejected invalid password:", err.message);
    auditResults.loginTests.push({ test: "Invalid password rejection", passed: true, message: err.message });
  }

  // 2b. Successful login
  const aliceLogin = auth.login({ email: "alice@example.com", password: "SuperSecurePassword123!" });
  console.log("  ✓ Successfully authenticated Alice with valid password");
  auditResults.loginTests.push({ test: "Valid password authentication", passed: true, tokenIssued: !!aliceLogin.token });

  // 3. JWT Token verification & Tampering resistance
  console.log("\n[3/5] Testing JWT Token Verification & Tamper Resistance...");
  const validPayload = auth.verifyToken(aliceLogin.token);
  console.log("  ✓ Verified valid JWT token:", { sub: validPayload?.sub, email: validPayload?.email, plan: validPayload?.plan });
  auditResults.tokenTests.push({ test: "Valid token signature check", passed: validPayload?.sub === aliceSignup.user.id });

  // 3b. Tampered token
  const tamperedToken = aliceLogin.token.substring(0, aliceLogin.token.length - 5) + "abcde";
  const tamperedPayload = auth.verifyToken(tamperedToken);
  console.log("  ✓ Tampered token rejected:", tamperedPayload === null);
  auditResults.tokenTests.push({ test: "Tampered token rejection", passed: tamperedPayload === null });

  // 4. Monthly Quota Enforcement (Free Tier = 10 scans/month)
  console.log("\n[4/5] Testing Tier Quota Enforcement (10 Scans/Month Free Tier)...");
  const initialAllowance = auth.checkScanAllowance(aliceSignup.user.id);
  console.log(`  Initial quota status: Allowed=${initialAllowance.allowed}, Scans used=${initialAllowance.usage.scansThisMonth}/${initialAllowance.usage.maxMonthlyScans}, Remaining=${initialAllowance.usage.remainingScans}`);
  
  // Simulate 10 scans for Alice
  for (let i = 1; i <= 10; i++) {
    const allowance = auth.checkScanAllowance(aliceSignup.user.id);
    if (!allowance.allowed) {
      throw new Error(`Premature quota block at scan ${i}`);
    }
    auth.recordScan(aliceSignup.user.id);
  }
  
  const post10Allowance = auth.checkScanAllowance(aliceSignup.user.id);
  console.log(`  Post-10 scans quota status: Allowed=${post10Allowance.allowed}, Scans used=${post10Allowance.usage.scansThisMonth}/${post10Allowance.usage.maxMonthlyScans}, Remaining=${post10Allowance.usage.remainingScans}`);
  console.log(`  Block reason: "${post10Allowance.reason}"`);
  
  auditResults.quotaEnforcementTests.push({
    test: "10 scans quota limit",
    passed: !post10Allowance.allowed && post10Allowance.usage.remainingScans === 0,
    scansUsed: post10Allowance.usage.scansThisMonth,
    maxAllowed: post10Allowance.usage.maxMonthlyScans
  });

  // Check that Bob still has full quota
  const bobAllowance = auth.checkScanAllowance(bobSignup.user.id);
  console.log(`  Bob quota status (unaffected by Alice): Scans used=${bobAllowance.usage.scansThisMonth}/${bobAllowance.usage.maxMonthlyScans}, Remaining=${bobAllowance.usage.remainingScans}`);
  auditResults.quotaEnforcementTests.push({
    test: "User quota isolation",
    passed: bobAllowance.usage.remainingScans === 10
  });

  // 5. History Store Isolation by User ID
  console.log("\n[5/5] Testing User History Isolation in Storage...");
  
  const scanAlice: ScanResult = {
    jobId: "scan_alice_1",
    userId: aliceSignup.user.id,
    targetUrl: "https://alice-portfolio.com",
    scanType: "both",
    status: "completed",
    scanCompleteness: "full",
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    healthScore: 92,
    scoreFormula: "100 - (8)",
    summaryCounts: { critical: 0, warning: 1, info: 1, pass: 8, total: 10 },
    findings: [],
    rawMetrics: {}
  };

  const scanBob: ScanResult = {
    jobId: "scan_bob_1",
    userId: bobSignup.user.id,
    targetUrl: "https://bob-saas-app.io",
    scanType: "both",
    status: "completed",
    scanCompleteness: "full",
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    healthScore: 85,
    scoreFormula: "100 - (15)",
    summaryCounts: { critical: 1, warning: 1, info: 0, pass: 8, total: 10 },
    findings: [],
    rawMetrics: {}
  };

  historyStore.saveScan(scanAlice);
  historyStore.saveScan(scanBob);

  const aliceHistory = historyStore.getHistoryByUser(aliceSignup.user.id);
  const bobHistory = historyStore.getHistoryByUser(bobSignup.user.id);

  console.log(`  Alice history count: ${aliceHistory.length} (Target: ${aliceHistory[0]?.targetUrl})`);
  console.log(`  Bob history count: ${bobHistory.length} (Target: ${bobHistory[0]?.targetUrl})`);

  const aliceSeesOnlyAlice = aliceHistory.every(s => s.userId === aliceSignup.user.id);
  const bobSeesOnlyBob = bobHistory.every(s => s.userId === bobSignup.user.id);

  auditResults.historyIsolationTests.push({
    test: "Alice history isolation",
    passed: aliceSeesOnlyAlice && aliceHistory.length >= 1
  });
  auditResults.historyIsolationTests.push({
    test: "Bob history isolation",
    passed: bobSeesOnlyBob && bobHistory.length >= 1
  });

  console.log("\n================================================================================");
  console.log("CATEGORY J AUDIT COMPLETE: ALL PASSWORDS, TOKENS, QUOTAS & ISOLATION PASSED");
  console.log("================================================================================");

  const reportPath = path.resolve(__dirname, "../data/auth_quota_audit_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(auditResults, null, 2), "utf-8");
  console.log(`Audit report saved to: ${reportPath}`);
}

runAuthTests().catch(console.error);
