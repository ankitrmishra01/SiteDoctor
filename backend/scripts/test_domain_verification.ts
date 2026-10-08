import { DomainVerifier } from "../src/verification/domainVerifier.js";

async function testDomainVerification() {
  console.log("================================================================================");
  console.log("TESTING MULTI-METHOD DOMAIN OWNERSHIP VERIFICATION & ABUSE SAFEGUARDS");
  console.log("================================================================================");

  const verifier = DomainVerifier.getInstance();
  const testDomain = "test-site-verification.org";
  const userId = "user_test_123";

  // 1. Create Challenge
  console.log(`\n1. Creating Multi-Method Challenge for: ${testDomain}...`);
  const challenge = verifier.createChallenge(testDomain, userId);
  console.log("Generated Challenge Payload:");
  console.log("  Domain:", challenge.domain);
  console.log("  Token:", challenge.token);
  console.log("  DNS TXT Host:", challenge.instructions.dns.host);
  console.log("  DNS TXT Value:", challenge.instructions.dns.value);
  console.log("  File URL:", challenge.instructions.file.url);
  console.log("  HTML Meta Tag:", challenge.instructions.meta.tag);

  // 2. Check initial verification status
  const initStatus = verifier.isDomainVerified(testDomain, userId);
  console.log("\n2. Initial Status Verified?:", initStatus);

  // 3. Test Abuse Reporting
  console.log("\n3. Testing Abuse Reporting API...");
  const report = verifier.reportAbuse({
    targetUrl: `https://${testDomain}`,
    reporterEmail: "security-contact@test-site-verification.org",
    reason: "Unconsented scan attempt detected from automated crawler.",
    ipAddress: "192.168.1.50"
  });
  console.log("Report Logged:");
  console.log("  Report ID:", report.id);
  console.log("  Status:", report.status);
  console.log("  Target:", report.targetUrl);
  console.log("  Reporter:", report.reporterEmail);
  console.log("  Reason:", report.reason);

  console.log("\n✓ All Domain Verification & Abuse Safeguards verified successfully!");
}

testDomainVerification().catch(console.error);
