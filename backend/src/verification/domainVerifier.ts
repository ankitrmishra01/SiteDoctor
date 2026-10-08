import dns from "node:dns/promises";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storageFile = path.resolve(__dirname, "../../data/domain_verifications.json");

export interface DomainChallenge {
  domain: string;
  userId: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  verified: boolean;
  verifiedAt?: number;
  verificationMethod?: "dns_txt" | "file_upload" | "meta_tag";
  instructions: {
    dns: {
      type: "TXT";
      host: string;
      value: string;
    };
    file: {
      url: string;
      expectedContent: string;
    };
    meta: {
      tag: string;
      placement: string;
    };
  };
}

export interface AbuseReport {
  id: string;
  targetUrl: string;
  reporterEmail: string;
  reason: string;
  timestamp: string;
  ipAddress?: string;
  status: "received" | "under_review" | "resolved" | "dismissed";
}

export class DomainVerifier {
  private static instance: DomainVerifier;
  private challenges = new Map<string, DomainChallenge>();
  private abuseReports: AbuseReport[] = [];

  private constructor() {
    this.loadFromDisk();
  }

  public static getInstance(): DomainVerifier {
    if (!DomainVerifier.instance) {
      DomainVerifier.instance = new DomainVerifier();
    }
    return DomainVerifier.instance;
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(storageFile)) {
        const data = JSON.parse(fs.readFileSync(storageFile, "utf-8"));
        if (data.challenges) {
          for (const c of data.challenges) {
            this.challenges.set(`${c.userId}:${c.domain}`, c);
          }
        }
        if (data.abuseReports) {
          this.abuseReports = data.abuseReports;
        }
      }
    } catch {
      // In-memory fallback
    }
  }

  private saveToDisk(): void {
    try {
      fs.mkdirSync(path.dirname(storageFile), { recursive: true });
      const payload = {
        challenges: Array.from(this.challenges.values()),
        abuseReports: this.abuseReports
      };
      fs.writeFileSync(storageFile, JSON.stringify(payload, null, 2), "utf-8");
    } catch {
      // Best effort
    }
  }

  public sanitizeDomain(rawUrlOrDomain: string): string {
    try {
      if (!rawUrlOrDomain.startsWith("http://") && !rawUrlOrDomain.startsWith("https://")) {
        rawUrlOrDomain = `https://${rawUrlOrDomain}`;
      }
      const parsed = new URL(rawUrlOrDomain);
      return parsed.hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return rawUrlOrDomain.toLowerCase().replace(/^www\./, "").split("/")[0] || "";
    }
  }

  /**
   * Generates a multi-method domain ownership challenge for the user.
   */
  public createChallenge(rawDomain: string, userId = "anonymous"): DomainChallenge {
    const domain = this.sanitizeDomain(rawDomain);
    const key = `${userId}:${domain}`;

    const existing = this.challenges.get(key);
    if (existing && existing.verified) {
      return existing;
    }

    const token = `sitedoctor-verify-${crypto.randomBytes(16).toString("hex")}`;
    const now = Date.now();
    const challenge: DomainChallenge = {
      domain,
      userId,
      token,
      createdAt: now,
      expiresAt: now + 7 * 24 * 60 * 60 * 1000, // 7 days validity
      verified: false,
      instructions: {
        dns: {
          type: "TXT",
          host: `_sitedoctor-challenge.${domain}`,
          value: token
        },
        file: {
          url: `https://${domain}/.well-known/sitedoctor-verification.txt`,
          expectedContent: token
        },
        meta: {
          tag: `<meta name="sitedoctor-verification" content="${token}">`,
          placement: "Inside <head> of your homepage HTML"
        }
      }
    };

    this.challenges.set(key, challenge);
    this.saveToDisk();
    return challenge;
  }

  public isDomainVerified(rawDomain: string, userId = "anonymous"): boolean {
    const domain = this.sanitizeDomain(rawDomain);
    // Allow localhost / local tests by default
    if (domain === "localhost" || domain === "127.0.0.1" || domain.endsWith(".local")) {
      return true;
    }
    const key = `${userId}:${domain}`;
    const challenge = this.challenges.get(key);
    return Boolean(challenge?.verified);
  }

  /**
   * Verifies domain ownership against DNS TXT, .well-known file, or HTML meta tag.
   */
  public async verifyDomain(rawDomain: string, userId = "anonymous"): Promise<{
    verified: boolean;
    method?: "dns_txt" | "file_upload" | "meta_tag";
    message: string;
    details?: any;
  }> {
    const domain = this.sanitizeDomain(rawDomain);
    const key = `${userId}:${domain}`;
    let challenge = this.challenges.get(key);

    if (!challenge) {
      challenge = this.createChallenge(domain, userId);
    }

    if (challenge.verified) {
      return {
        verified: true,
        method: challenge.verificationMethod,
        message: `Domain ${domain} is already verified.`
      };
    }

    const expectedToken = challenge.token;

    // METHOD 1: DNS TXT Check
    try {
      const txtRecords = await dns.resolveTxt(`_sitedoctor-challenge.${domain}`);
      const flatRecords = txtRecords.flat();
      if (flatRecords.some(r => r.includes(expectedToken))) {
        challenge.verified = true;
        challenge.verifiedAt = Date.now();
        challenge.verificationMethod = "dns_txt";
        this.saveToDisk();
        return {
          verified: true,
          method: "dns_txt",
          message: `Successfully verified domain ${domain} via DNS TXT challenge.`
        };
      }
    } catch {
      // Fall through to next method
    }

    // METHOD 2: Well-Known File Check
    try {
      const fileUrl = `https://${domain}/.well-known/sitedoctor-verification.txt`;
      const res = await fetch(fileUrl, {
        headers: { "User-Agent": "SiteDoctor-Domain-Verifier/1.0" },
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const text = (await res.text()).trim();
        if (text.includes(expectedToken)) {
          challenge.verified = true;
          challenge.verifiedAt = Date.now();
          challenge.verificationMethod = "file_upload";
          this.saveToDisk();
          return {
            verified: true,
            method: "file_upload",
            message: `Successfully verified domain ${domain} via HTTP .well-known file challenge.`
          };
        }
      }
    } catch {
      // Fall through to next method
    }

    // METHOD 3: HTML <meta> Tag Check
    try {
      const pageUrl = `https://${domain}/`;
      const res = await fetch(pageUrl, {
        headers: { "User-Agent": "SiteDoctor-Domain-Verifier/1.0" },
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const html = await res.text();
        const metaRegex = new RegExp(`<meta[^>]*name=["']sitedoctor-verification["'][^>]*content=["']${expectedToken}["']`, "i");
        const metaRegexAlt = new RegExp(`<meta[^>]*content=["']${expectedToken}["'][^>]*name=["']sitedoctor-verification["']`, "i");
        if (metaRegex.test(html) || metaRegexAlt.test(html)) {
          challenge.verified = true;
          challenge.verifiedAt = Date.now();
          challenge.verificationMethod = "meta_tag";
          this.saveToDisk();
          return {
            verified: true,
            method: "meta_tag",
            message: `Successfully verified domain ${domain} via HTML <meta> tag challenge.`
          };
        }
      }
    } catch {
      // Not verified
    }

    return {
      verified: false,
      message: `Verification failed for domain ${domain}. Please ensure either DNS TXT record, .well-known file, or HTML <meta> tag is deployed with token '${expectedToken}'.`
    };
  }

  /**
   * Records an abuse or unconsented scan report.
   */
  public reportAbuse(params: { targetUrl: string; reporterEmail: string; reason: string; ipAddress?: string }): AbuseReport {
    const report: AbuseReport = {
      id: `abuse_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      targetUrl: params.targetUrl,
      reporterEmail: params.reporterEmail,
      reason: params.reason,
      ipAddress: params.ipAddress,
      timestamp: new Date().toISOString(),
      status: "received"
    };

    this.abuseReports.unshift(report);
    this.saveToDisk();
    return report;
  }

  public getAbuseReports(): AbuseReport[] {
    return this.abuseReports;
  }
}
