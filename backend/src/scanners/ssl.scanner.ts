import tls from "node:tls";
import { URL } from "node:url";
import { Finding } from "../diagnostics/types.js";
import { DiagnosticsEngine } from "../diagnostics/engine.js";

export interface SslScanResult {
  valid: boolean;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysRemaining?: number;
  protocol?: string;
  findings: Finding[];
}

export class SslScanner {
  public static async scan(targetUrl: string): Promise<SslScanResult> {
    const findings: Finding[] = [];
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return { valid: false, findings };
    }

    if (parsedUrl.protocol !== "https:") {
      findings.push(
        DiagnosticsEngine.mapFinding({
          ruleId: "SEC_HSTS_MISSING",
          category: "security",
          severity: "warning",
          title: "Site Not Using HTTPS",
          plainEnglishCause: "The target URL is served over unencrypted plain HTTP. All traffic, form submissions, and authentication cookies can be intercepted in transit.",
          technicalDetails: `Protocol: ${parsedUrl.protocol}`
        })
      );
      return {
        valid: false,
        findings
      };
    }

    const host = parsedUrl.hostname;
    const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 443;

    return new Promise<SslScanResult>((resolve) => {
      const socket = tls.connect(
        {
          host,
          port,
          servername: host,
          rejectUnauthorized: false, // We check validity ourselves to inspect self-signed certs
          timeout: 8000
        },
        () => {
          const cert = socket.getPeerCertificate();
          const authorized = socket.authorized;
          const authorizationError = socket.authorizationError;
          const protocol = socket.getProtocol() || "TLS";

          socket.end();

          if (!cert || Object.keys(cert).length === 0) {
            findings.push(
              DiagnosticsEngine.mapFinding({
                ruleId: "SSL_EXPIRED",
                category: "security",
                severity: "critical",
                title: "No SSL Certificate Returned",
                plainEnglishCause: "The server accepted a TLS connection but did not present a valid peer certificate.",
                technicalDetails: `Host: ${host}:${port}`
              })
            );
            return resolve({ valid: false, protocol, findings });
          }

          const validToDate = new Date(cert.valid_to);
          const validFromDate = new Date(cert.valid_from);
          const now = new Date();
          const msRemaining = validToDate.getTime() - now.getTime();
          const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
          const rawIssuer = typeof cert.issuer === "object" && cert.issuer ? (cert.issuer.O || cert.issuer.CN || "Unknown Issuer") : "Unknown Issuer";
          const issuer = Array.isArray(rawIssuer) ? rawIssuer.join(", ") : String(rawIssuer);

          // Check if expired
          if (msRemaining <= 0) {
            findings.push(
              DiagnosticsEngine.mapFinding({
                ruleId: "SSL_EXPIRED",
                category: "security",
                severity: "critical",
                technicalDetails: `Expired on: ${cert.valid_to} (Days expired: ${Math.abs(daysRemaining)})`
              })
            );
          } else if (daysRemaining < 30) {
            findings.push(
              DiagnosticsEngine.mapFinding({
                ruleId: "SSL_EXPIRING_SOON",
                category: "security",
                severity: "warning",
                technicalDetails: `Expires in ${daysRemaining} days (${cert.valid_to})`
              })
            );
          }

          // Check if self-signed or unauthorized
          if (!authorized && authorizationError) {
            findings.push(
              DiagnosticsEngine.mapFinding({
                ruleId: "SSL_SELF_SIGNED",
                category: "security",
                severity: "critical",
                technicalDetails: `TLS authorization error: ${authorizationError.message || String(authorizationError)}`
              })
            );
          }

          resolve({
            valid: authorized && msRemaining > 0,
            issuer,
            validFrom: cert.valid_from,
            validTo: cert.valid_to,
            daysRemaining,
            protocol,
            findings
          });
        }
      );

      socket.on("error", (err) => {
        findings.push(
          DiagnosticsEngine.mapFinding({
            ruleId: "CUSTOM_ANOMALY",
            category: "security",
            severity: "critical",
            title: "TLS Handshake Failed",
            plainEnglishCause: "Failed to establish an encrypted TLS connection with the target server.",
            technicalDetails: err.message
          })
        );
        resolve({ valid: false, findings });
      });

      socket.on("timeout", () => {
        socket.destroy();
        findings.push(
          DiagnosticsEngine.mapFinding({
            ruleId: "CUSTOM_ANOMALY",
            category: "security",
            severity: "warning",
            title: "TLS Connection Timeout",
            plainEnglishCause: "Connecting to the server for SSL certificate inspection timed out after 8 seconds."
          })
        );
        resolve({ valid: false, findings });
      });
    });
  }
}
