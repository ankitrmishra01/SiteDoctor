import { parse as parseYaml } from "yaml";
import { Finding } from "../diagnostics/types.js";
import { DiagnosticsEngine } from "../diagnostics/engine.js";
import { UnreachableTargetError } from "./frontend.scanner.js";

export interface BackendScanResult {
  securityHeaders: Record<string, string | null>;
  rawHeaders?: Record<string, string>;
  cors: {
    configured: boolean;
    allowOrigin: string | null;
    allowMethods: string | null;
    allowHeaders: string | null;
    allowCredentials: string | null;
  };
  endpointsDiscovered: Array<{
    path: string;
    status: number;
    latencyMs: number;
    ok: boolean;
  }>;
  lightLoad?: {
    concurrency: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgLatencyMs: number;
    minLatencyMs: number;
    p95LatencyMs: number;
    maxLatencyMs: number;
    requestsPerSecond: number;
    statusDistribution: Record<string, number>;
  };
  findings: Finding[];
}

export class BackendScanner {
  public static async scan(
    baseUrl: string,
    openApiUrl?: string,
    isApiExplicit: boolean = false
  ): Promise<BackendScanResult> {
    const findings: Finding[] = [];
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

    // 1. Audit Security Headers & CORS via direct HTTP request (Content-Type aware)
    const { headers, rawHeaders, cors, isApiTarget, securityFindings } = await this.auditHeadersAndCors(normalizedBaseUrl, openApiUrl, isApiExplicit);
    findings.push(...securityFindings);

    // 2. OpenAPI Spec Evaluation or Endpoint Discovery Fallback
    const endpointsDiscovered: Array<{ path: string; status: number; latencyMs: number; ok: boolean }> = [];

    if (openApiUrl) {
      const openApiResult = await this.evaluateOpenApiSpec(normalizedBaseUrl, openApiUrl);
      findings.push(...openApiResult.findings);
      if (openApiResult.discoveredEndpoints.length > 0) {
        endpointsDiscovered.push(...openApiResult.discoveredEndpoints);
      } else {
        // Fallback to common endpoint discovery if OpenAPI failed or returned no paths
        const discovery = await this.discoverCommonEndpoints(normalizedBaseUrl, isApiTarget);
        endpointsDiscovered.push(...discovery.endpoints);
        findings.push(...discovery.findings);
      }
    } else {
      // Standard discovery
      const discovery = await this.discoverCommonEndpoints(normalizedBaseUrl, isApiTarget);
      endpointsDiscovered.push(...discovery.endpoints);
      findings.push(...discovery.findings);
    }

    // 3. Light Concurrent Load Check (10 concurrent requests)
    const lightLoadResult = await this.performLightLoadCheck(normalizedBaseUrl);
    findings.push(...lightLoadResult.findings);

    return {
      securityHeaders: headers,
      rawHeaders,
      cors,
      endpointsDiscovered,
      lightLoad: lightLoadResult.metrics,
      findings
    };
  }

  private static async auditHeadersAndCors(
    baseUrl: string,
    openApiUrl?: string,
    isApiExplicit: boolean = false
  ): Promise<{
    headers: Record<string, string | null>;
    rawHeaders: Record<string, string>;
    cors: BackendScanResult["cors"];
    isApiTarget: boolean;
    securityFindings: Finding[];
  }> {
    const securityFindings: Finding[] = [];
    const headersMap: Record<string, string | null> = {};
    const rawHeadersMap: Record<string, string> = {};
    let isApiTarget = Boolean(openApiUrl || isApiExplicit);

    try {
      // Perform GET and preflight OPTIONS requests with Origin
      const [getResponse, optionsResponse] = await Promise.all([
        fetch(baseUrl, {
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SiteDoctor/1.0",
            "Origin": "https://example.com"
          },
          signal: AbortSignal.timeout(8000)
        }).catch(() => null),
        fetch(baseUrl, {
          method: "OPTIONS",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SiteDoctor/1.0",
            "Origin": "https://example.com",
            "Access-Control-Request-Method": "GET"
          },
          signal: AbortSignal.timeout(8000)
        }).catch(() => null)
      ]);

      if (getResponse && (getResponse.status === 401 || getResponse.status === 403)) {
        throw new UnreachableTargetError(`Target URL is protected by an authentication wall (HTTP ${getResponse.status} ${getResponse.status === 401 ? "Unauthorized" : "Forbidden"}). SiteDoctor cannot perform public automated scanning without credentials.`);
      }

      const resp = getResponse || optionsResponse;
      if (resp) {
        const rawHeaders = resp.headers;
        rawHeaders.forEach((val, key) => {
          rawHeadersMap[key.toLowerCase()] = val;
        });

        headersMap["strict-transport-security"] = rawHeaders.get("strict-transport-security");
        headersMap["content-security-policy"] = rawHeaders.get("content-security-policy");
        headersMap["x-frame-options"] = rawHeaders.get("x-frame-options");
        headersMap["x-content-type-options"] = rawHeaders.get("x-content-type-options");
        headersMap["referrer-policy"] = rawHeaders.get("referrer-policy");
        headersMap["permissions-policy"] = rawHeaders.get("permissions-policy");
        headersMap["server"] = rawHeaders.get("server");
        headersMap["x-powered-by"] = rawHeaders.get("x-powered-by");

        // Determine API-ness from Content-Type and explicit scope
        const respContentType = (rawHeaders.get("content-type") || "").toLowerCase();
        const isJsonOrXmlApi = respContentType.includes("application/json") ||
                               respContentType.includes("application/ld+json") ||
                               respContentType.includes("application/problem+json") ||
                               respContentType.includes("application/vnd.api+json") ||
                               respContentType.includes("application/xml") ||
                               respContentType.includes("text/xml") ||
                               respContentType.includes("application/x-yaml");
        const isHtmlWebsite = respContentType.includes("text/html") || respContentType.includes("application/xhtml+xml");

        isApiTarget = Boolean(openApiUrl || isApiExplicit || (isJsonOrXmlApi && !isHtmlWebsite));

        // Inspect Security Headers
        if (baseUrl.startsWith("https://") && !headersMap["strict-transport-security"]) {
          securityFindings.push(
            DiagnosticsEngine.mapFinding({
              ruleId: "SEC_HSTS_MISSING",
              category: "security",
              severity: "warning",
              technicalDetails: "Strict-Transport-Security header is absent in response headers."
            })
          );
        }

        if (!headersMap["content-security-policy"]) {
          securityFindings.push(
            DiagnosticsEngine.mapFinding({
              ruleId: "SEC_CSP_MISSING",
              category: "security",
              severity: "warning",
              technicalDetails: "Content-Security-Policy header is absent."
            })
          );
        }

        if (!headersMap["x-frame-options"] && !headersMap["content-security-policy"]?.includes("frame-ancestors")) {
          securityFindings.push(
            DiagnosticsEngine.mapFinding({
              ruleId: "SEC_XFO_MISSING",
              category: "security",
              severity: "warning",
              technicalDetails: "X-Frame-Options header is absent."
            })
          );
        }

        if (headersMap["x-content-type-options"]?.toLowerCase() !== "nosniff") {
          securityFindings.push(
            DiagnosticsEngine.mapFinding({
              ruleId: "SEC_XCTO_MISSING",
              category: "security",
              severity: "warning",
              technicalDetails: "X-Content-Type-Options: nosniff header is absent."
            })
          );
        }

        if (headersMap["x-powered-by"] || (headersMap["server"] && headersMap["server"]?.match(/(express|apache|nginx|kestrel)\/[\d\.]+/i))) {
          securityFindings.push(
            DiagnosticsEngine.mapFinding({
              ruleId: "SEC_SERVER_HEADER_LEAK",
              category: "security",
              severity: "info",
              technicalDetails: `Server signature leaked: X-Powered-By='${headersMap["x-powered-by"] || ""}', Server='${headersMap["server"] || ""}'`
            })
          );
        }
      }

      // Inspect CORS from either GET or OPTIONS
      const corsOrigin = optionsResponse?.headers.get("access-control-allow-origin") || getResponse?.headers.get("access-control-allow-origin");
      const corsMethods = optionsResponse?.headers.get("access-control-allow-methods") || getResponse?.headers.get("access-control-allow-methods");
      const corsHeaders = optionsResponse?.headers.get("access-control-allow-headers") || getResponse?.headers.get("access-control-allow-headers");
      const corsCredentials = optionsResponse?.headers.get("access-control-allow-credentials") || getResponse?.headers.get("access-control-allow-credentials");

      const corsResult = {
        configured: Boolean(corsOrigin),
        allowOrigin: corsOrigin ?? null,
        allowMethods: corsMethods ?? null,
        allowHeaders: corsHeaders ?? null,
        allowCredentials: corsCredentials ?? null
      };

      if (!corsOrigin) {
        if (isApiTarget) {
          securityFindings.push(
            DiagnosticsEngine.mapFinding({
              ruleId: "CORS_MISSING",
              category: "backend",
              severity: "critical",
              technicalDetails: "Access-Control-Allow-Origin was not returned on API target when Origin header was sent."
            })
          );
        }
      } else if (corsOrigin === "*" && corsCredentials === "true") {
        securityFindings.push(
          DiagnosticsEngine.mapFinding({
            ruleId: "CORS_WILDCARD_CREDENTIALS",
            category: "security",
            severity: "critical",
            technicalDetails: "Access-Control-Allow-Origin: * combined with Access-Control-Allow-Credentials: true."
          })
        );
      }

      return {
        headers: headersMap,
        rawHeaders: rawHeadersMap,
        cors: corsResult,
        isApiTarget,
        securityFindings
      };
    } catch (err: any) {
      return {
        headers: headersMap,
        rawHeaders: rawHeadersMap,
        cors: { configured: false, allowOrigin: null, allowMethods: null, allowHeaders: null, allowCredentials: null },
        isApiTarget,
        securityFindings: isApiTarget ? [
          DiagnosticsEngine.mapFinding({
            ruleId: "CORS_MISSING",
            category: "backend",
            severity: "warning",
            technicalDetails: `Could not verify CORS headers: ${err.message}`
          })
        ] : []
      };
    }
  }

  private static async evaluateOpenApiSpec(
    baseUrl: string,
    openApiUrl: string
  ): Promise<{
    findings: Finding[];
    discoveredEndpoints: Array<{ path: string; status: number; latencyMs: number; ok: boolean }>;
  }> {
    const findings: Finding[] = [];
    const discoveredEndpoints: Array<{ path: string; status: number; latencyMs: number; ok: boolean }> = [];

    try {
      const resp = await fetch(openApiUrl, {
        headers: { "User-Agent": "SiteDoctor-Diagnostic-Bot/1.0" },
        signal: AbortSignal.timeout(10000)
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      }

      const text = await resp.text();
      let specObj: any;
      try {
        specObj = JSON.parse(text);
      } catch {
        // Attempt YAML parse
        try {
          specObj = parseYaml(text);
        } catch (yamlErr: any) {
          throw new Error(`Invalid JSON / YAML syntax: ${yamlErr.message}`);
        }
      }

      if (!specObj || typeof specObj !== "object" || !specObj.paths) {
        throw new Error("Spec document does not contain an OpenAPI 'paths' object.");
      }

      // Ingest paths from OpenAPI spec
      const paths = Object.keys(specObj.paths).slice(0, 15); // Check top 15 routes
      for (const p of paths) {
        // Substitute path variables with sample IDs (e.g. /users/{id} -> /users/1)
        const cleanPath = p.replace(/\{[^}]+\}/g, "1");
        const targetEndpoint = `${baseUrl}${cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`}`;
        
        const start = performance.now();
        try {
          const epResp = await fetch(targetEndpoint, {
            method: "GET",
            headers: { "User-Agent": "SiteDoctor-Diagnostic-Bot/1.0" },
            signal: AbortSignal.timeout(5000)
          });
          const latency = Math.round(performance.now() - start);

          discoveredEndpoints.push({
            path: cleanPath,
            status: epResp.status,
            latencyMs: latency,
            ok: epResp.status >= 200 && epResp.status < 400
          });

          if (epResp.status >= 500) {
            findings.push(
              DiagnosticsEngine.mapFinding({
                ruleId: "NETWORK_FAILED_REQUEST",
                category: "backend",
                severity: "critical",
                title: `OpenAPI Endpoint Returned Server Error (${epResp.status})`,
                technicalDetails: `Route ${cleanPath} returned HTTP ${epResp.status} in ${latency}ms`
              })
            );
          }
        } catch (epErr: any) {
          discoveredEndpoints.push({
            path: cleanPath,
            status: 0,
            latencyMs: Math.round(performance.now() - start),
            ok: false
          });
        }
      }
    } catch (err: any) {
      // Catch parse/fetch errors gracefully — EMIT INFO FINDING and fallback to endpoint discovery
      findings.push(
        DiagnosticsEngine.mapFinding({
          ruleId: "API_OPENAPI_PARSE_ERROR",
          category: "backend",
          severity: "info",
          technicalDetails: `Failed to fetch/parse OpenAPI spec from '${openApiUrl}': ${err.message}`
        })
      );
    }

    return { findings, discoveredEndpoints };
  }

  private static async discoverCommonEndpoints(baseUrl: string, isApiTarget: boolean): Promise<{
    endpoints: Array<{ path: string; status: number; latencyMs: number; ok: boolean }>;
    findings: Finding[];
  }> {
    const endpoints: Array<{ path: string; status: number; latencyMs: number; ok: boolean }> = [];
    const findings: Finding[] = [];

    const commonPaths = [
      "/",
      "/health",
      "/api",
      "/api/health",
      "/robots.txt",
      "/sitemap.xml",
      "/.well-known/security.txt"
    ];

    let healthCheckFound = false;

    const probePromises = commonPaths.map(async (path) => {
      const url = `${baseUrl}${path}`;
      const start = performance.now();
      try {
        const resp = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SiteDoctor/1.0"
          },
          signal: AbortSignal.timeout(2500)
        });
        const latency = Math.round(performance.now() - start);
        const ok = resp.status >= 200 && resp.status < 400;

        if (path === "/robots.txt" && resp.status === 404) {
          findings.push(
            DiagnosticsEngine.mapFinding({
              ruleId: "SEO_ROBOTS_MISSING",
              category: "seo",
              severity: "info",
              technicalDetails: "HTTP 404 on /robots.txt"
            })
          );
        }

        if (path === "/sitemap.xml" && resp.status === 404) {
          findings.push(
            DiagnosticsEngine.mapFinding({
              ruleId: "SEO_SITEMAP_MISSING",
              category: "seo",
              severity: "info",
              technicalDetails: "HTTP 404 on /sitemap.xml"
            })
          );
        }

        if ((path === "/health" || path === "/api/health") && ok) {
          healthCheckFound = true;
        }

        return {
          path,
          status: resp.status,
          latencyMs: latency,
          ok
        };
      } catch {
        return {
          path,
          status: 0,
          latencyMs: Math.round(performance.now() - start),
          ok: false
        };
      }
    });

    const probedResults = await Promise.all(probePromises);
    endpoints.push(...probedResults);

    if (!healthCheckFound && isApiTarget) {
      findings.push(
        DiagnosticsEngine.mapFinding({
          ruleId: "API_HEALTH_FAIL",
          category: "backend",
          severity: "critical",
          technicalDetails: "Neither /health nor /api/health returned an active 2xx status code on API target."
        })
      );
    }

    return { endpoints, findings };
  }

  private static async performLightLoadCheck(baseUrl: string): Promise<{
    metrics: BackendScanResult["lightLoad"];
    findings: Finding[];
  }> {
    const findings: Finding[] = [];
    const concurrency = 10;
    const requests: Promise<{ status: number; latency: number; ok: boolean }>[] = [];
    const overallStart = performance.now();

    for (let i = 0; i < concurrency; i++) {
      requests.push(
        (async () => {
          const reqStart = performance.now();
          try {
            const resp = await fetch(baseUrl, {
              method: "GET",
              headers: { "User-Agent": "SiteDoctor-Diagnostic-Bot/1.0" },
              signal: AbortSignal.timeout(6000)
            });
            const latency = Math.round(performance.now() - reqStart);
            return { status: resp.status, latency, ok: resp.status >= 200 && resp.status < 400 };
          } catch {
            const latency = Math.round(performance.now() - reqStart);
            return { status: 0, latency, ok: false };
          }
        })()
      );
    }

    const results = await Promise.all(requests);
    const overallDurationSec = Math.max(0.1, (performance.now() - overallStart) / 1000);

    const latencies = results.map(r => r.latency).sort((a, b) => a - b);
    const successfulRequests = results.filter(r => r.ok).length;
    const failedRequests = concurrency - successfulRequests;
    const avgLatencyMs = Math.round(latencies.reduce((acc, l) => acc + l, 0) / latencies.length);
    const minLatencyMs = latencies[0] || 0;
    const maxLatencyMs = latencies[latencies.length - 1] || 0;
    const p95LatencyMs = latencies[Math.floor(latencies.length * 0.95)] || maxLatencyMs;

    const statusDistribution: Record<string, number> = {};
    for (const r of results) {
      const key = r.status ? String(r.status) : "Network_Error";
      statusDistribution[key] = (statusDistribution[key] || 0) + 1;
    }

    if (avgLatencyMs > 1500) {
      findings.push(
        DiagnosticsEngine.mapFinding({
          ruleId: "LIGHT_LOAD_HIGH_LATENCY",
          category: "performance",
          severity: "warning",
          metricValue: `${avgLatencyMs}ms avg`,
          technicalDetails: `Avg latency: ${avgLatencyMs}ms (P95: ${p95LatencyMs}ms) under 10 concurrent requests.`
        })
      );
    }

    if (failedRequests > 0) {
      let wafCount = 0;
      let serverErrorCount = 0;
      let timeoutOrNetworkCount = 0;

      for (const r of results) {
        if (!r.ok) {
          if (r.status === 401 || r.status === 403 || r.status === 429) {
            wafCount++;
          } else if (r.status >= 500 && r.status < 600) {
            serverErrorCount++;
          } else {
            timeoutOrNetworkCount++;
          }
        }
      }

      // If all or majority of failures are 401/403/429 (WAF rate limiting / bot protection)
      if (wafCount > 0 && wafCount >= failedRequests * 0.8) {
        findings.push(
          DiagnosticsEngine.mapFinding({
            ruleId: "LIGHT_LOAD_BLOCKED_BY_WAF",
            category: "backend",
            severity: "info",
            metricValue: `${wafCount}/${concurrency} WAF blocked`,
            technicalDetails: `Concurrent probe requests intercepted by WAF / rate-limiting defenses (${wafCount}/${concurrency} returned HTTP 401/403/429). Status distribution: ${JSON.stringify(statusDistribution)}`
          })
        );
      } else if (serverErrorCount > 0 || (serverErrorCount + timeoutOrNetworkCount) >= 2) {
        // Genuine 5xx server strain or significant (>=20%) connection drops
        findings.push(
          DiagnosticsEngine.mapFinding({
            ruleId: "LIGHT_LOAD_ERROR_RATE",
            category: "backend",
            severity: "critical",
            metricValue: `${serverErrorCount + timeoutOrNetworkCount}/${concurrency} failed`,
            technicalDetails: `Server produced 5xx errors or connection drops under 10 concurrent requests (${serverErrorCount} server errors, ${timeoutOrNetworkCount} network/timeout drops). Status distribution: ${JSON.stringify(statusDistribution)}`
          })
        );
      } else if (timeoutOrNetworkCount === 1) {
        // Single isolated transient network timeout
        findings.push(
          DiagnosticsEngine.mapFinding({
            ruleId: "LIGHT_LOAD_ERROR_RATE",
            category: "backend",
            severity: "warning",
            metricValue: `1/${concurrency} dropped`,
            technicalDetails: `Single transient request timeout observed under 10 concurrent requests. Status distribution: ${JSON.stringify(statusDistribution)}`
          })
        );
      }
    }

    return {
      metrics: {
        concurrency,
        totalRequests: concurrency,
        successfulRequests,
        failedRequests,
        avgLatencyMs,
        minLatencyMs,
        p95LatencyMs,
        maxLatencyMs,
        requestsPerSecond: Math.round(concurrency / overallDurationSec),
        statusDistribution
      },
      findings
    };
  }
}
