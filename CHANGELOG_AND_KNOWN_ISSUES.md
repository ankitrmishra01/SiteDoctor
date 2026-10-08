# SiteDoctor — Changelog & Known Issues

This log tracks all architectural enhancements, empirical audits, ground-truth validations, and remaining constraints under the **SiteDoctor Self-Verification & Production Readiness Protocol**.

---

## [Round 4] — Response Content-Type API Scoping, Provisional Partial-Scan UI, 8 Concurrent Full-Browser Benchmark & Honest Production Gates
**Execution Date**: 2026-10-08  
**Raw Data Evidence**:
- [`backend/data/six_sites_api_classification_audit.json`](file:///c:/Users/ankit/OneDrive/Desktop/SiteDoctor/backend/data/six_sites_api_classification_audit.json)
- [`backend/data/benchmark_8_concurrent_full_scans.json`](file:///c:/Users/ankit/OneDrive/Desktop/SiteDoctor/backend/data/benchmark_8_concurrent_full_scans.json)
- Visual Artifacts: [`screenshots/screenshot_full_scan_score.png`](file:///c:/Users/ankit/OneDrive/Desktop/SiteDoctor/screenshots/screenshot_full_scan_score.png), [`screenshots/screenshot_provisional_partial_scan_score.png`](file:///c:/Users/ankit/OneDrive/Desktop/SiteDoctor/screenshots/screenshot_provisional_partial_scan_score.png)

### 1. Architectural Fix: HTTP Response `Content-Type` API Scoping & Etsy Score Math
1. **Replacement of URL Heuristic with Response Content-Type Detection**:
   - *Problem*: Previously, `isApiTarget` checked for `"api."` in the hostname or paths like `/api/`, `/v1/`, `/graphql`. This caused false negatives for valid APIs hosted on standard domain names (e.g. `httpbin.org/json`, `dummyjson.com/products`, `pokeapi.co/api/v2/pokemon`) and risked false positives when scanning general websites in backend mode.
   - *Fix Applied*: Refactored [`backend/src/scanners/backend.scanner.ts`](file:///c:/Users/ankit/OneDrive/Desktop/SiteDoctor/backend/src/scanners/backend.scanner.ts) so that `isApiTarget` is determined dynamically from the HTTP response `Content-Type` header (`application/json`, `application/xml`, `text/xml`, `application/ld+json`), alongside explicit user selection of the `Backend API Only` scope.
   - *Empirical Verification across 6 Targets*:
     - `https://httpbin.org/json` $\rightarrow$ Detected as `API Target` (`application/json`), Health Score: 63/100, `CORS_MISSING`: `false`.
     - `https://dummyjson.com/products` $\rightarrow$ Detected as `API Target` (`application/json; charset=utf-8`), Health Score: 78/100, `CORS_MISSING`: `false`.
     - `https://pokeapi.co/api/v2/pokemon` $\rightarrow$ Detected as `API Target` (`application/json; charset=utf-8`), Health Score: 69/100, `CORS_MISSING`: `false`.
     - `https://www.etsy.com` $\rightarrow$ Detected as `HTML Website` (`text/html`), Health Score: 98/100 (`partial_backend_only`), `CORS_MISSING`: `false`.
     - `https://www.rust-lang.org` $\rightarrow$ Detected as `HTML Website` (`text/html; charset=utf-8`), Health Score: 73/100 (`full`), `CORS_MISSING`: `false`.
     - `https://www.berkshirehathaway.com` $\rightarrow$ Detected as `HTML Website` (`text/html`), Health Score: 63/100 (`full`), `CORS_MISSING`: `false`.
     - **Accuracy**: **6 / 6** targets correctly classified (**100.0%**).
   - *Etsy Scoring Mathematics Clarification (93 vs 98)*:
     In [`backend/src/scanners/backend.scanner.ts`](file:///c:/Users/ankit/OneDrive/Desktop/SiteDoctor/backend/src/scanners/backend.scanner.ts) (line 245), `CORS_MISSING` was mapped with `severity: "warning"` (carrying a 5-point category penalty, not the 15-point critical penalty defined in rules.ts). Therefore, removing `CORS_MISSING` reduced the backend category penalty from 7 points (`CORS_MISSING` [5] + `SEO_SITEMAP_MISSING` [1] + `LIGHT_LOAD_BLOCKED_BY_WAF` [1]) down to 2 points (`SEO_SITEMAP_MISSING` [1] + `LIGHT_LOAD_BLOCKED_BY_WAF` [1]).
     $$\text{Score}_{\text{with CORS}} = 100 - (5 + 1 + 1) = 93$$
     $$\text{Score}_{\text{without CORS}} = 100 - (1 + 1) = 98$$
     The score delta was exactly $+5\text{ points}$.

---

### 2. UI/UX: Provisional Partial-Scan Score Presentation
For scans where `scanCompleteness !== "full"` (e.g. backend-only probes or when Cloudflare/Akamai bot-protection blocks headless browser execution):
- The score card in [`frontend/src/components/HealthScoreCard.tsx`](file:///c:/Users/ankit/OneDrive/Desktop/SiteDoctor/frontend/src/components/HealthScoreCard.tsx) and [`frontend/src/components/OverviewSection.tsx`](file:///c:/Users/ankit/OneDrive/Desktop/SiteDoctor/frontend/src/components/OverviewSection.tsx) renders with a prominent `▲ PROVISIONAL (PARTIAL AUDIT — NON-COMPARABLE)` header badge and a dashed amber warning border.
- The headline score explicitly appends `(PROVISIONAL)` to prevent misleading comparisons against full-stack browser scores.
- An explanatory note clarifies that DOM accessibility and Core Web Vitals were omitted.

---

### 3. Capacity Benchmark: 8 Concurrent Full-Browser Scans on Real Public Targets
Executed 8 simultaneous full browser diagnostic scans (Playwright Chromium + axe-core + HTTP/TLS probes + Core Web Vitals) against 8 live external domains:
`rust-lang.org`, `deno.com`, `svelte.dev`, `curl.se`, `go.dev`, `python.org`, `vuejs.org`, `expressjs.com`.

- **Total Batch Wall-Clock Duration**: **59.73s**
- **Average Latency per Target**: **52.67s** (Min: 27.82s for `vuejs.org`, Max: 59.68s for `deno.com`)
- **Peak RSS Memory**: **384.0 MB**
- **Peak Heap Memory**: **206.0 MB**
- **End RSS Memory**: **187.1 MB** (Clean garbage collection release upon browser pool cleanup)
- **Completion Rate**: **8 / 8** (**100.0%** successful full diagnostic runs)

---

### 4. Production Readiness Gates Status Table (Original Definitions)

| Gate Item | Status | Evidence & Current Implementation State |
| :--- | :--- | :--- |
| **G1: Multi-Method Domain Ownership Verification** | **DONE** | Full challenge lifecycle implemented in [`backend/src/auth/domainVerification.service.ts`](file:///c:/Users/ankit/OneDrive/Desktop/SiteDoctor/backend/src/auth/domainVerification.service.ts): DNS TXT (`_sitedoctor-challenge`), HTTP `.well-known` upload, and HTML `<head>` meta tags. Verified with unit and mock tests. |
| **G2: Real Scan Path Domain Enforcement** | **PARTIAL** | Verification logic and bypass flags exist, but unverified public domains are currently permitted to run in read-only non-destructive mode. Stricter blocking mode can be toggled via `ENFORCE_DOMAIN_VERIFICATION=true`. |
| **G3: Account-Based Rate Limiting & Abuse Intake** | **DONE** | Per-user rate limits enforced in [`backend/src/auth/auth.service.ts`](file:///c:/Users/ankit/OneDrive/Desktop/SiteDoctor/backend/src/auth/auth.service.ts) (10 scans/mo Free tier quota) and `POST /api/abuse/report` operational for domain dispute intake. |
| **G4: Terms of Service & Privacy Policy Drafts** | **DONE** | Formal ToS and Privacy Policy documents drafted and bundled in [`data/legal/TERMS_OF_SERVICE.md`](file:///c:/Users/ankit/OneDrive/Desktop/SiteDoctor/data/legal/TERMS_OF_SERVICE.md) and [`data/legal/PRIVACY_POLICY.md`](file:///c:/Users/ankit/OneDrive/Desktop/SiteDoctor/data/legal/PRIVACY_POLICY.md). |
| **I1: Production Cloud Hosting Deployment** | **NOT STARTED** | Currently runs locally in development/Docker container mode. Cloud container orchestration (e.g. AWS ECS / GCP Cloud Run / Fly.io) not yet provisioned. |
| **I2: External Uptime & Synthetics Monitoring** | **NOT STARTED** | Built-in `/api/health` endpoint exists, but external synthetic health checks (e.g. BetterStack, Datadog, or Uptime Kuma) are not connected. |
| **K1: Onboarding Flow & First-Run View** | **DONE** | Dashboard features preset chip selectors (`mdn-docs`, `vite.dev`, `wikipedia`, `github`, `httpbin.org`), recent scan recall, and scope toggles. |
| **K2: Empty & Error States** | **DONE** | Handled across network timeouts, WAF blocks, unreachable origins, offline state banners, and quota limit errors. |
| **K3: WCAG Accessibility (A11y) Pass** | **DONE** | Dashboard UI audited with high contrast ratios, semantic HTML headings, full keyboard focus rings, and ARIA labels. |

---

## [Round 3] — 100-Site Ground-Truth Cross-Check, Stability Analysis & Empirical Reconciliation
**Execution Date**: 2026-09-30  
**Raw Data Evidence**: [`backend/data/accuracy_100_sites_empirical_report.json`](file:///c:/Users/ankit/OneDrive/Desktop/SiteDoctor/backend/data/accuracy_100_sites_empirical_report.json)

### 1. 100-Site Audit Metric & Scope Reconciliation
- **Headline Ground-Truth Metric**: **472 / 475** assertions matched (**99.37%**) across 95 reachable targets (**5 checks per site** on HTTP status, HSTS, X-Content-Type-Options, X-Frame-Options, and SSL certificate validity).
- **Unreachable Targets (5 sites)**: `gnu.org` (Docs), `api.coindesk.com` (APIs), `worldtimeapi.org` (APIs), `creativecommons.org` (Open Source), `inkscape.org` (Open Source).
- **Score Stability**: Tested 3x runs on Etsy (98/98/98, spread 0), Rust-lang (63/63/63, spread 0), Deno (80/80/80, spread 0), Berkshire Hathaway (68/68/63, spread 5 due to remote socket latency spike).

---

## [Round 2] — Multi-Stack Automated Code Diffs & Voluntary Volatile PAT Authentication
**Execution Date**: 2026-09-30  
- Verified AST-aware automated diff generation across 8 major web stacks: Next.js, Express, Fastify, Django, FastAPI, Go Gin, SvelteKit, and Ruby on Rails.
- Implemented volatile in-memory session token isolation for GitHub Personal Access Tokens.

---

## [Round 1] — Combined Accuracy, Code-Aware AST Diffs, Load Stability & Safeguards Architecture
**Execution Date**: 2026-09-29  
- Fixed WAF perimeter blocking misclassification (`LIGHT_LOAD_BLOCKED_BY_WAF`).
- Fixed multi-line block comment & docstring parser boundary handling in GitHub diff engine.
