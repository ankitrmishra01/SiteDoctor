import { DetectedStack, ServerType, FrameworkType, LanguageType } from "./types.js";

export interface StackDetectionInput {
  headers?: Record<string, string | null | undefined>;
  htmlContent?: string;
  cookies?: string[];
  generatorMeta?: string;
  jsGlobals?: string[];
  statusBody?: string;
}

export class StackDetector {
  /**
   * Evaluates HTTP response headers, DOM/HTML indicators, cookies, and status bodies
   * to determine the server environment, edge CDN, frontend framework, and backend runtime.
   */
  public static detect(input: StackDetectionInput): DetectedStack {
    const signals: string[] = [];
    const headers = input.headers || {};
    const html = input.htmlContent || "";
    const cookies = input.cookies || [];
    const statusBody = input.statusBody || "";
    const generator = input.generatorMeta || "";

    // Normalize header keys for case-insensitive lookup
    const headerMap: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (v) {
        headerMap[k.toLowerCase()] = String(v).trim();
      }
    }

    const serverHeader = headerMap["server"] || "";
    const xPoweredBy = headerMap["x-powered-by"] || "";
    const via = headerMap["via"] || "";

    let server: ServerType = "unknown";
    let framework: FrameworkType = "unknown";
    let language: LanguageType = "unknown";
    let cdn: DetectedStack["cdn"] = undefined;

    // ─────────────────────────────────────────────────────────────────────────
    // 1. EDGE CDN / REVERSE PROXY DETECTION
    // ─────────────────────────────────────────────────────────────────────────
    if (headerMap["cf-ray"] || serverHeader.toLowerCase().includes("cloudflare")) {
      cdn = "cloudflare";
      signals.push("Edge CDN / Reverse Proxy: Cloudflare (`cf-ray`) detected");
    } else if (headerMap["x-fastly-request-id"] || headerMap["fastly-debug-digest"] || serverHeader.toLowerCase().includes("fastly")) {
      cdn = "fastly";
      signals.push("Edge CDN: Fastly Edge Cloud detected");
    } else if (headerMap["x-akamai-transformed"] || serverHeader.toLowerCase().includes("akamai")) {
      cdn = "akamai";
      signals.push("Edge CDN: Akamai Intelligent Edge detected");
    } else if (headerMap["x-amz-cf-id"] || headerMap["x-amz-cf-pop"]) {
      cdn = "cloudfront";
      signals.push("Edge CDN: AWS CloudFront detected");
    } else if (headerMap["x-vercel-id"] || serverHeader.toLowerCase() === "vercel" || headerMap["x-vercel-cache"]) {
      cdn = "vercel";
      server = "vercel";
      signals.push("Vercel Edge Network / Serverless hosting detected");
    } else if (headerMap["x-nf-request-id"] || serverHeader.toLowerCase().includes("netlify")) {
      cdn = "netlify";
      server = "netlify";
      signals.push("Netlify Edge Network / Application Gateway detected");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. FRAMEWORK DETECTION (HTML, DOM, Headers, Cookies)
    // ─────────────────────────────────────────────────────────────────────────
    if (
      html.includes("__NEXT_DATA__") || 
      html.includes("/_next/") || 
      headerMap["x-nextjs-cache"] || 
      headerMap["x-nextjs-matched-path"] || 
      xPoweredBy.toLowerCase().includes("next.js")
    ) {
      framework = "nextjs";
      language = "node";
      signals.push("Next.js hydration payload / `_next` static routing detected");
    } else if (
      html.includes("wp-content") || 
      html.includes("wp-includes") || 
      html.includes("wp-json") || 
      generator.toLowerCase().includes("wordpress")
    ) {
      framework = "wordpress";
      language = "php";
      signals.push("WordPress CMS directory structure / generator meta detected");
    } else if (html.includes("__NUXT__") || html.includes("/_nuxt/")) {
      framework = "nuxt";
      language = "node";
      signals.push("Nuxt.js SSR hydration payload detected");
    } else if (html.includes("astro-island") || generator.toLowerCase().includes("astro")) {
      framework = "astro";
      language = "node";
      signals.push("Astro island component architecture detected");
    } else if (html.includes("___gatsby") || generator.toLowerCase().includes("gatsby")) {
      framework = "gatsby";
      language = "node";
      signals.push("Gatsby static hydration root detected");
    } else if (html.includes("__vue_app__") || (html.includes("data-v-") && !html.includes("swagger"))) {
      framework = "vue";
      signals.push("Vue component scope attributes detected");
    } else if (html.includes("ng-version") || html.includes("<app-root")) {
      framework = "angular";
      language = "node";
      signals.push("Angular runtime root container detected");
    } else if (html.includes("svelte-") || html.includes("__svelte")) {
      framework = "svelte";
      signals.push("Svelte scoped stylesheet / component markers detected");
    } else if (
      (html.includes("data-reactroot") || html.includes("__reactContainer")) && 
      !html.includes("swagger-ui") && 
      !html.includes("flasgger")
    ) {
      framework = "react";
      language = "node";
      signals.push("React DOM client container marker detected");
    }

    // Backend framework & session cookies
    if (cookies.some(c => c.toLowerCase().includes("csrftoken")) || statusBody.includes("Django")) {
      if (framework === "unknown") framework = "django";
      if (language === "unknown") language = "python";
      signals.push("Django CSRF token cookie / session detected");
    } else if (cookies.some(c => c.toLowerCase().includes("laravel_session")) || headerMap["x-laravel-cache"]) {
      if (framework === "unknown") framework = "laravel";
      if (language === "unknown") language = "php";
      signals.push("Laravel session cookie detected");
    } else if (cookies.some(c => c.toLowerCase().includes("_rails_session"))) {
      if (framework === "unknown") framework = "rails";
      if (language === "unknown") language = "ruby";
      signals.push("Ruby on Rails session cookie detected");
    } else if (statusBody.includes('"detail":') && (serverHeader.includes("uvicorn") || serverHeader.includes("hypercorn"))) {
      if (framework === "unknown") framework = "fastapi";
      if (language === "unknown") language = "python";
      signals.push("FastAPI / Starlette Pydantic error response signature detected");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. ORIGIN SERVER & RUNTIME DETECTION
    // ─────────────────────────────────────────────────────────────────────────
    if (headerMap["x-github-request-id"] || serverHeader.toLowerCase() === "github.com") {
      server = "github_pages";
      signals.push("GitHub Pages static web server headers detected");
    } else if (serverHeader.toLowerCase().includes("nginx") || serverHeader.toLowerCase().includes("openresty")) {
      server = "nginx";
      signals.push(`Nginx web server header detected: \`${serverHeader}\``);
    } else if (serverHeader.toLowerCase().includes("apache") || serverHeader.toLowerCase().includes("coyote")) {
      server = "apache";
      signals.push(`Apache HTTP server header detected: \`${serverHeader}\``);
    } else if (serverHeader.toLowerCase().includes("caddy")) {
      server = "caddy";
      signals.push("Caddy automatic HTTPS reverse proxy detected");
    } else if (serverHeader.toLowerCase().includes("microsoft-iis") || xPoweredBy.toLowerCase().includes("asp.net")) {
      server = "iis";
      language = "csharp";
      signals.push("Microsoft IIS / ASP.NET runtime detected");
    } else if (xPoweredBy.toLowerCase().includes("express") || cookies.some(c => c.toLowerCase().includes("connect.sid"))) {
      server = "express";
      language = "node";
      signals.push("Express.js / Node.js runtime signature detected");
    } else if (serverHeader.toLowerCase().includes("uvicorn") || serverHeader.toLowerCase().includes("gunicorn")) {
      language = "python";
      signals.push(`Python WSGI/ASGI server header detected: \`${serverHeader}\``);
    }

    // Language deduction from X-Powered-By if not already known
    if (language === "unknown") {
      if (xPoweredBy.toLowerCase().includes("php")) {
        language = "php";
        signals.push(`PHP runtime signature in X-Powered-By: \`${xPoweredBy}\``);
      } else if (xPoweredBy.toLowerCase().includes("node") || xPoweredBy.toLowerCase().includes("express")) {
        language = "node";
        signals.push(`Node.js runtime signature in X-Powered-By: \`${xPoweredBy}\``);
      } else if (xPoweredBy.toLowerCase().includes("python")) {
        language = "python";
        signals.push(`Python runtime signature in X-Powered-By: \`${xPoweredBy}\``);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. CONFIDENCE SCORING & SUMMARY FORMATTING
    // ─────────────────────────────────────────────────────────────────────────
    let confidence: DetectedStack["confidence"] = "none";
    if (signals.length >= 2) {
      confidence = "high";
    } else if (signals.length === 1) {
      confidence = "medium";
    } else {
      confidence = "none";
    }

    let summary = "Stack not detected — generic server configuration";
    if (confidence !== "none") {
      const parts: string[] = [];
      if (framework !== "unknown") parts.push(framework.toUpperCase());
      if (server !== "unknown") parts.push(server.toUpperCase());
      if (language !== "unknown" && !parts.some(p => p.toLowerCase() === language)) parts.push(`(${language})`);
      if (cdn && !parts.some(p => p.toLowerCase() === cdn)) parts.push(`via ${cdn.toUpperCase()} CDN`);

      summary = parts.length > 0 ? parts.join(" on ") : "Web Server detected";
      if (confidence === "high") summary += " [Verified]";
    }

    return {
      server,
      framework,
      language,
      cdn,
      confidence,
      detectedSignals: signals,
      summary
    };
  }
}
