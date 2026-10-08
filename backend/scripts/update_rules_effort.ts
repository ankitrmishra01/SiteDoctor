import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rulesPath = path.resolve(__dirname, "../src/diagnostics/rules.ts");

const effortMap: Record<string, "low" | "medium" | "high"> = {
  CORS_MISSING: "low",
  CORS_WILDCARD_CREDENTIALS: "low",
  SEC_CSP_MISSING: "low",
  SEC_HSTS_MISSING: "low",
  SEC_XFO_MISSING: "low",
  SEC_XCTO_MISSING: "low",
  SEC_SERVER_HEADER_LEAK: "low",
  SSL_EXPIRED: "low",
  SSL_EXPIRING_SOON: "low",
  SSL_SELF_SIGNED: "low",
  CONSOLE_JS_ERROR: "medium",
  NETWORK_FAILED_REQUEST: "medium",
  NETWORK_BROKEN_IMAGE: "low",
  CRAWLER_BROKEN_LINK: "low",
  CWV_LCP_POOR: "high",
  CWV_CLS_POOR: "medium",
  CWV_TBT_POOR: "high",
  PAGE_TTFB_SLOW: "medium",
  AXE_COLOR_CONTRAST: "low",
  AXE_IMAGE_ALT_MISSING: "low",
  AXE_FORM_LABEL_MISSING: "low",
  AXE_BUTTON_NAME_MISSING: "low",
  SEO_META_DESCRIPTION_MISSING: "low",
  SEO_VIEWPORT_MISSING: "low",
  SEO_ROBOTS_MISSING: "low",
  SEO_SITEMAP_MISSING: "low",
  API_HEALTH_FAIL: "medium",
  API_OPENAPI_PARSE_ERROR: "low",
  LIGHT_LOAD_HIGH_LATENCY: "high",
  LIGHT_LOAD_ERROR_RATE: "medium"
};

let content = fs.readFileSync(rulesPath, "utf-8");

for (const [ruleId, effort] of Object.entries(effortMap)) {
  const pattern = new RegExp(`(ruleId:\\s*["']${ruleId}["'],\\s*\\n\\s*category:\\s*[^,]+,\\s*\\n\\s*severity:\\s*[^,]+,)`, "g");
  if (pattern.test(content)) {
    content = content.replace(pattern, `$1\n    effort: "${effort}",`);
  } else {
    console.warn(`Could not match pattern for rule ${ruleId}`);
  }
}

fs.writeFileSync(rulesPath, content, "utf-8");
console.log("Successfully updated rules.ts with effort ratings!");
