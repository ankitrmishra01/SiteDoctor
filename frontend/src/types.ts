export type ScanStatus = 
  | "idle"
  | "queued" 
  | "running" 
  | "completed" 
  | "failed_unreachable" 
  | "failed_error";

export type ScanType = "frontend" | "backend" | "both";

export type Category = 
  | "all"
  | "frontend" 
  | "backend" 
  | "security" 
  | "performance" 
  | "accessibility" 
  | "seo";

export type Severity = "critical" | "warning" | "info" | "pass";

export type ServerType = 
  | "nginx" 
  | "apache" 
  | "caddy" 
  | "express" 
  | "fastapi" 
  | "django" 
  | "laravel" 
  | "rails" 
  | "spring" 
  | "cloudflare" 
  | "vercel" 
  | "netlify" 
  | "github_pages" 
  | "iis" 
  | "unknown";

export type FrameworkType = 
  | "nextjs" 
  | "react" 
  | "vue" 
  | "nuxt" 
  | "svelte" 
  | "angular" 
  | "wordpress" 
  | "astro" 
  | "gatsby" 
  | "django" 
  | "fastapi" 
  | "laravel" 
  | "rails" 
  | "spring" 
  | "unknown";

export type LanguageType = 
  | "node" 
  | "python" 
  | "php" 
  | "ruby" 
  | "go" 
  | "rust" 
  | "java" 
  | "csharp" 
  | "unknown";

export interface DetectedStack {
  server: ServerType;
  framework: FrameworkType;
  language: LanguageType;
  confidence: "high" | "medium" | "low" | "none";
  detectedSignals: string[];
  summary: string;
}

export interface FixStep {
  step: number;
  instruction: string;
  codeSnippet?: string;
  technology?: string;
}

export type EffortLevel = "low" | "medium" | "high";
export type PriorityBucket = "quick_win" | "plan_next" | "nice_to_have";

export interface GitHubLocation {
  filePath: string;
  lineNumber: number;
  snippet?: string;
  surroundingContext?: {
    startLine: number;
    endLine: number;
    lines: Array<{ lineNumber: number; content: string; isTarget?: boolean }>;
  };
  diff?: string;
  confidence: "high" | "medium" | "low";
  disclaimer: string;
}

export interface Finding {
  id: string;
  ruleId: string;
  category: Category;
  severity: Severity;
  effort?: EffortLevel;
  priorityBucket?: PriorityBucket;
  title: string;
  plainEnglishCause: string;
  technicalDetails?: string;
  metricValue?: string | number;
  fixSteps: FixStep[];
  codeSnippet?: string;
  repoSearchQuery?: string;
  githubLocation?: GitHubLocation;
  isAiSuggested?: boolean;
  isVerified: boolean;
  elementSelector?: string;
  wcagRule?: string;
  url?: string;
  stackContext?: {
    matchedTechnology?: string;
    isGenericFallback: boolean;
    detectedStackSummary?: string;
  };
}

export interface CheckEventPayload {
  jobId: string;
  checkName: string;
  category: Category;
  status: "running" | "completed" | "failed";
  durationMs?: number;
  summary: string;
  findings: Finding[];
  timestamp: string;
}

export type ScanCompleteness = 
  | "full" 
  | "partial_backend_only" 
  | "partial_frontend_only" 
  | "failed_unreachable" 
  | "failed_error";

export interface ScanResult {
  jobId: string;
  targetUrl: string;
  scanType: ScanType;
  status: ScanStatus;
  scanCompleteness: ScanCompleteness;
  completenessNotice?: string;
  failureReason?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  healthScore: number;
  scoreFormula: string;
  summaryCounts: {
    critical: number;
    warning: number;
    info: number;
    pass: number;
    total: number;
  };
  findings: Finding[];
  detectedStack?: DetectedStack;
  rawMetrics: {
    pageLoad?: {
      httpStatus?: number;
      ttfbMs?: number;
      domContentLoadedMs?: number;
      loadTimeMs?: number;
    };
    coreWebVitals?: {
      lcpMs?: number;
      cls?: number;
      fcpMs?: number;
      tbtMs?: number;
      ttfbMs?: number;
    };
    ssl?: {
      valid: boolean;
      issuer?: string;
      validFrom?: string;
      validTo?: string;
      daysRemaining?: number;
      protocol?: string;
    };
    securityHeaders?: Record<string, string | null>;
    cors?: {
      configured: boolean;
      allowOrigin?: string | null;
      allowMethods?: string | null;
      allowHeaders?: string | null;
      allowCredentials?: string | null;
    };
    endpointsDiscovered?: Array<{
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
    accessibility?: {
      violationsCount: number;
      passesCount: number;
    };
    crawledLinks?: Array<{
      url: string;
      status: number;
      ok: boolean;
    }>;
  };
}

export interface ScanRequest {
  url: string;
  type: ScanType;
  openApiUrl?: string;
  consent: boolean;
  sessionId?: string;
  repoUrl?: string;
}
