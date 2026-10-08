import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173").split(","),
  
  // Rate limits (concrete numbers required by spec)
  rateLimits: {
    // POST /api/scan: max 5 requests per IP per hour
    scan: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5,
      message: {
        error: "Too many scan requests",
        code: "RATE_LIMIT_SCAN_EXCEEDED",
        retryAfterMinutes: 60,
        message: "Scan rate limit exceeded (max 5 scans per hour per IP). Please wait before scanning again."
      }
    },
    // POST /api/github/search: max 20 requests per IP per hour
    githubSearch: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 20,
      message: {
        error: "Too many GitHub search requests",
        code: "RATE_LIMIT_GITHUB_SEARCH_EXCEEDED",
        retryAfterMinutes: 60,
        message: "GitHub search rate limit exceeded (max 20 searches per hour per IP). Please wait before searching again."
      }
    },
    // Global fallback: max 100 requests per IP per 15 min across all routes
    global: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      message: {
        error: "Too many requests",
        code: "RATE_LIMIT_GLOBAL_EXCEEDED",
        retryAfterMinutes: 15,
        message: "Global rate limit exceeded (max 100 requests per 15 min). Please try again later."
      }
    }
  },

  // GitHub token session security settings (in-memory only, never written to disk)
  github: {
    sessionIdleTimeoutMs: 30 * 60 * 1000 // 30 minutes idle timeout
  },

  // Storage caps
  storage: {
    maxScansPerUrl: 50,
    maxTotalScans: 500
  }
};
