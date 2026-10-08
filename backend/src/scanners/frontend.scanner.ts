import { chromium, Browser, Page } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { Finding } from "../diagnostics/types.js";
import { DiagnosticsEngine } from "../diagnostics/engine.js";

export class UnreachableTargetError extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = "UnreachableTargetError";
  }
}

export interface FrontendScanResult {
  pageLoad: {
    httpStatus: number;
    ttfbMs: number;
    domContentLoadedMs: number;
    loadTimeMs: number;
  };
  coreWebVitals: {
    lcpMs: number;
    cls: number;
    fcpMs: number;
    tbtMs: number;
    ttfbMs: number;
  };
  accessibility: {
    violationsCount: number;
    passesCount: number;
  };
  crawledLinks: Array<{
    url: string;
    status: number;
    ok: boolean;
  }>;
  findings: Finding[];
  stackSignals?: {
    htmlContent?: string;
    cookies?: string[];
    generatorMeta?: string;
  };
}

export class FrontendScanner {
  public static async scan(targetUrl: string): Promise<FrontendScanResult> {
    const findings: Finding[] = [];
    const crawledLinks: Array<{ url: string; status: number; ok: boolean }> = [];
    let browser: Browser | null = null;

    try {
      browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-blink-features=AutomationControlled"
        ]
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      });

      const page = await context.newPage();

      // Console errors & network tab listeners
      const consoleErrors: string[] = [];
      const failedRequests: Array<{ url: string; status: number; statusText: string }> = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });

      page.on("pageerror", (err) => {
        consoleErrors.push(`Uncaught Exception: ${err.message}`);
      });

      page.on("response", (resp) => {
        const status = resp.status();
        if (status >= 400) {
          failedRequests.push({
            url: resp.url(),
            status,
            statusText: resp.statusText()
          });
        }
      });

      page.on("requestfailed", (req) => {
        const failure = req.failure();
        failedRequests.push({
          url: req.url(),
          status: 0,
          statusText: failure ? failure.errorText : "Network Request Failed"
        });
      });

      // 1. Initial Page Navigation & Reachability Gate
      const navStart = performance.now();
      let response = null;

      try {
        response = await page.goto(targetUrl, {
          waitUntil: "domcontentloaded",
          timeout: 20000
        });
      } catch (navErr: any) {
        const errMsg = navErr.message || "";
        if (errMsg.includes("ERR_NAME_NOT_RESOLVED")) {
          throw new UnreachableTargetError(`DNS lookup failed for '${targetUrl}': Hostname could not be resolved.`);
        } else if (errMsg.includes("ERR_CONNECTION_REFUSED")) {
          throw new UnreachableTargetError(`Connection refused by target server at '${targetUrl}'. Ensure the server is online and accepting connections.`);
        } else if (errMsg.includes("ERR_CONNECTION_TIMED_OUT") || errMsg.includes("Timeout")) {
          throw new UnreachableTargetError(`Connection timed out while loading '${targetUrl}' after 20 seconds.`);
        } else if (errMsg.includes("ERR_CERT_")) {
          throw new UnreachableTargetError(`SSL certificate error prevented connection to '${targetUrl}'.`);
        }
        throw new UnreachableTargetError(`Failed to load target URL '${targetUrl}': ${errMsg}`);
      }

      if (!response) {
        throw new UnreachableTargetError(`No response received from '${targetUrl}'.`);
      }

      const initialStatus = response.status();
      // Blocked by auth wall on base page
      if (initialStatus === 401 || initialStatus === 403) {
        throw new UnreachableTargetError(`Target URL is protected by an authentication wall (HTTP ${initialStatus}). SiteDoctor cannot perform public automated scanning without credentials.`);
      }

      // Allow page to settle quickly (up to 2.5s for dynamic hydration)
      try {
        await Promise.race([
          page.waitForLoadState("load", { timeout: 2500 }),
          new Promise((resolve) => setTimeout(resolve, 2500))
        ]);
      } catch {
        // Continue if full load times out
      }

      // Collect Navigation Timing & Performance Metrics
      const timingMetrics = await page.evaluate(() => {
        const navEntries = performance.getEntriesByType("navigation");
        if (navEntries.length > 0) {
          const nav = navEntries[0] as PerformanceNavigationTiming;
          return {
            ttfb: Math.round(nav.responseStart - nav.requestStart),
            domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
            loadTime: Math.round(nav.loadEventEnd > 0 ? nav.loadEventEnd - nav.startTime : performance.now())
          };
        }
        return {
          ttfb: 0,
          domContentLoaded: 0,
          loadTime: 0
        };
      });

      const totalLoadTime = timingMetrics.loadTime || Math.round(performance.now() - navStart);
      const ttfb = timingMetrics.ttfb;

      if (ttfb > 800) {
        findings.push(
          DiagnosticsEngine.mapFinding({
            ruleId: "PAGE_TTFB_SLOW",
            category: "performance",
            severity: "warning",
            metricValue: `${ttfb}ms`,
            technicalDetails: `Time to First Byte: ${ttfb}ms (Recommended: < 800ms)`
          })
        );
      }

      // 2. Map Console Errors & Network Failures
      for (const cErr of consoleErrors.slice(0, 5)) {
        findings.push(
          DiagnosticsEngine.mapFinding({
            ruleId: "CONSOLE_JS_ERROR",
            category: "frontend",
            severity: "critical",
            technicalDetails: cErr
          })
        );
      }

      const targetOrigin = new URL(targetUrl).origin;
      for (const req of failedRequests.slice(0, 8)) {
        const isImage = req.url.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)(\?.*)?$/i);
        const isThirdPartyAnalytics = !req.url.startsWith(targetOrigin) && 
          req.url.match(/(google-analytics|googletagmanager|doubleclick|sentry|hotjar|clarity|facebook|analytics|telemetry|beacon)/i);

        if (isThirdPartyAnalytics) {
          // Non-critical third-party telemetry blocked in headless environment
          continue;
        }

        if (isImage && req.status === 404) {
          findings.push(
            DiagnosticsEngine.mapFinding({
              ruleId: "NETWORK_BROKEN_IMAGE",
              category: "frontend",
              severity: "warning",
              technicalDetails: `Broken image (HTTP 404): ${req.url}`
            })
          );
        } else {
          findings.push(
            DiagnosticsEngine.mapFinding({
              ruleId: "NETWORK_FAILED_REQUEST",
              category: "frontend",
              severity: req.status >= 500 ? "critical" : "warning",
              technicalDetails: `Failed asset/request (HTTP ${req.status}): ${req.url}`
            })
          );
        }
      }

      // 3. Core Web Vitals (Real metrics via PerformanceObserver & Performance APIs)
      const cwv = await page.evaluate(async () => {
        return new Promise<{
          lcp: number;
          cls: number;
          fcp: number;
          tbt: number;
        }>((resolve) => {
          let lcp = 0;
          let cls = 0;
          let fcp = 0;
          let tbt = 0;

          // Paint timings
          const paintEntries = performance.getEntriesByType("paint");
          for (const entry of paintEntries) {
            if (entry.name === "first-contentful-paint") {
              fcp = Math.round(entry.startTime);
            }
          }

          // LCP Observer
          try {
            const lcpObserver = new PerformanceObserver((entryList) => {
              const entries = entryList.getEntries();
              const lastEntry = entries[entries.length - 1];
              if (lastEntry) {
                lcp = Math.round(lastEntry.startTime);
              }
            });
            lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
          } catch {}

          // CLS Observer
          try {
            const clsObserver = new PerformanceObserver((entryList) => {
              for (const entry of entryList.getEntries() as any[]) {
                if (!entry.hadRecentInput) {
                  cls += entry.value;
                }
              }
            });
            clsObserver.observe({ type: "layout-shift", buffered: true });
          } catch {}

          // Long Tasks Observer (TBT approximation)
          try {
            const longTaskObserver = new PerformanceObserver((entryList) => {
              for (const entry of entryList.getEntries()) {
                if (entry.duration > 50) {
                  tbt += (entry.duration - 50);
                }
              }
            });
            longTaskObserver.observe({ type: "longtask", buffered: true });
          } catch {}

          // Gather layout shifts and paints
          setTimeout(() => {
            resolve({
              lcp: lcp || fcp || 0,
              cls: Number(cls.toFixed(3)),
              fcp: fcp || 0,
              tbt: Math.round(tbt)
            });
          }, 1000);
        });
      });

      if (cwv.lcp > 4000) {
        findings.push(
          DiagnosticsEngine.mapFinding({
            ruleId: "CWV_LCP_POOR",
            category: "performance",
            severity: "critical",
            metricValue: `${cwv.lcp}ms`,
            technicalDetails: `Largest Contentful Paint: ${cwv.lcp}ms (Poor > 4000ms)`
          })
        );
      }

      if (cwv.cls > 0.25) {
        findings.push(
          DiagnosticsEngine.mapFinding({
            ruleId: "CWV_CLS_POOR",
            category: "performance",
            severity: "critical",
            metricValue: `${cwv.cls}`,
            technicalDetails: `Cumulative Layout Shift: ${cwv.cls} (Poor > 0.25)`
          })
        );
      }

      if (cwv.tbt > 600) {
        findings.push(
          DiagnosticsEngine.mapFinding({
            ruleId: "CWV_TBT_POOR",
            category: "performance",
            severity: "warning",
            metricValue: `${cwv.tbt}ms`,
            technicalDetails: `Total Blocking Time: ${cwv.tbt}ms (Threshold: 600ms)`
          })
        );
      }

      // 4. SEO Basics Evaluation
      const seoData = await page.evaluate(() => {
        const title = document.title;
        const metaDesc = document.querySelector("meta[name='description']")?.getAttribute("content");
        const viewport = document.querySelector("meta[name='viewport']")?.getAttribute("content");
        const ogTitle = document.querySelector("meta[property='og:title']")?.getAttribute("content");
        const ogImage = document.querySelector("meta[property='og:image']")?.getAttribute("content");
        const canonical = document.querySelector("link[rel='canonical']")?.getAttribute("href");
        const imagesWithoutAlt = Array.from(document.querySelectorAll("img:not([alt])")).length;

        return {
          hasTitle: Boolean(title && title.trim().length > 0),
          titleLength: title ? title.length : 0,
          hasMetaDesc: Boolean(metaDesc && metaDesc.trim().length > 0),
          hasViewport: Boolean(viewport),
          hasOg: Boolean(ogTitle || ogImage),
          hasCanonical: Boolean(canonical),
          imagesWithoutAlt
        };
      });

      if (!seoData.hasMetaDesc) {
        findings.push(
          DiagnosticsEngine.mapFinding({
            ruleId: "SEO_META_DESCRIPTION_MISSING",
            category: "seo",
            severity: "warning",
            technicalDetails: "Missing <meta name=\"description\"> tag in document head."
          })
        );
      }

      if (!seoData.hasViewport) {
        findings.push(
          DiagnosticsEngine.mapFinding({
            ruleId: "SEO_VIEWPORT_MISSING",
            category: "seo",
            severity: "critical",
            technicalDetails: "Missing mobile viewport meta tag <meta name=\"viewport\">."
          })
        );
      }

      if (seoData.imagesWithoutAlt > 0) {
        findings.push(
          DiagnosticsEngine.mapFinding({
            ruleId: "AXE_IMAGE_ALT_MISSING",
            category: "accessibility",
            severity: "warning",
            metricValue: `${seoData.imagesWithoutAlt} images`,
            technicalDetails: `Found ${seoData.imagesWithoutAlt} <img> element(s) without an alt attribute.`
          })
        );
      }

      // 5. Accessibility Audit via axe-core
      let violationsCount = 0;
      let passesCount = 0;

      try {
        const axeResults = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        violationsCount = axeResults.violations.length;
        passesCount = axeResults.passes.length;

        for (const violation of axeResults.violations.slice(0, 10)) {
          let ruleId = "CUSTOM_ANOMALY";
          if (violation.id === "color-contrast") ruleId = "AXE_COLOR_CONTRAST";
          else if (violation.id === "image-alt") ruleId = "AXE_IMAGE_ALT_MISSING";
          else if (violation.id === "label") ruleId = "AXE_FORM_LABEL_MISSING";
          else if (violation.id === "button-name") ruleId = "AXE_BUTTON_NAME_MISSING";

          const firstNode = violation.nodes[0];
          const targetSelector = firstNode ? firstNode.target.join(", ") : undefined;

          findings.push(
            DiagnosticsEngine.mapFinding({
              ruleId,
              category: "accessibility",
              severity: violation.impact === "critical" || violation.impact === "serious" ? "warning" : "info",
              title: `WCAG Violation: ${violation.help}`,
              plainEnglishCause: violation.description,
              technicalDetails: `Rule: ${violation.id} (${violation.impact || "minor"}). ${firstNode ? `HTML: ${firstNode.html}` : ""}`,
              elementSelector: targetSelector,
              wcagRule: violation.id
            })
          );
        }
      } catch (axeErr: any) {
        console.warn("[FrontendScanner] Axe audit execution error:", axeErr.message);
      }

      // 6. Internal Link Crawler (Crawl up to 15 internal links concurrently)
      const internalHrefs: string[] = await page.evaluate((origin) => {
        const links = Array.from(document.querySelectorAll("a[href]"));
        const urls = new Set<string>();
        for (const l of links) {
          const href = l.getAttribute("href");
          if (href && !href.startsWith("#") && !href.startsWith("javascript:") && !href.startsWith("mailto:")) {
            try {
              const fullUrl = new URL(href, window.location.href);
              if (fullUrl.origin === origin) {
                urls.add(fullUrl.href);
              }
            } catch {}
          }
        }
        return Array.from(urls);
      }, new URL(targetUrl).origin);

      const linksToCrawl = internalHrefs.slice(0, 15);
      
      // Parallel batch crawler (concurrency = 5)
      const checkLink = async (linkUrl: string) => {
        try {
          let linkResp = await fetch(linkUrl, {
            method: "HEAD",
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SiteDoctor/1.0" },
            signal: AbortSignal.timeout(1800)
          }).catch(() => null);

          // If HEAD returned 405 Method Not Allowed, fallback to GET with Range
          if (linkResp && linkResp.status === 405) {
            linkResp = await fetch(linkUrl, {
              method: "GET",
              headers: { 
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SiteDoctor/1.0",
                "Range": "bytes=0-0"
              },
              signal: AbortSignal.timeout(1800)
            }).catch(() => null);
          }

          if (linkResp) {
            const ok = linkResp.status >= 200 && linkResp.status < 400;
            crawledLinks.push({ url: linkUrl, status: linkResp.status, ok });

            if (linkResp.status === 404) {
              findings.push(
                DiagnosticsEngine.mapFinding({
                  ruleId: "CRAWLER_BROKEN_LINK",
                  category: "frontend",
                  severity: "warning",
                  technicalDetails: `Internal link returned HTTP 404: ${linkUrl}`,
                  url: linkUrl
                })
              );
            }
          } else {
            crawledLinks.push({ url: linkUrl, status: 0, ok: false });
          }
        } catch {
          crawledLinks.push({ url: linkUrl, status: 0, ok: false });
        }
      };

      await Promise.all(linksToCrawl.map(checkLink));

      // Extract lightweight stack detection markers
      let htmlContent = "";
      let generatorMeta = "";
      let cookies: string[] = [];

      try {
        htmlContent = (await page.content()).substring(0, 100000);
        generatorMeta = await page.locator('meta[name="generator"]').getAttribute("content").catch(() => "") || "";
        const cookiesObj = await context.cookies();
        cookies = cookiesObj.map(c => `${c.name}=${c.value}`);
      } catch {}

      await browser.close();
      browser = null;

      return {
        pageLoad: {
          httpStatus: initialStatus,
          ttfbMs: ttfb,
          domContentLoadedMs: timingMetrics.domContentLoaded,
          loadTimeMs: totalLoadTime
        },
        coreWebVitals: {
          lcpMs: cwv.lcp,
          cls: cwv.cls,
          fcpMs: cwv.fcp,
          tbtMs: cwv.tbt,
          ttfbMs: ttfb
        },
        accessibility: {
          violationsCount,
          passesCount
        },
        crawledLinks,
        findings,
        stackSignals: {
          htmlContent,
          generatorMeta,
          cookies
        }
      };
    } catch (err) {
      if (browser) {
        await browser.close().catch(() => {});
      }
      throw err;
    }
  }
}
