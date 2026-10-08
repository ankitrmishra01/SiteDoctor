import { DiagnosticRule } from "./types.js";

export const DIAGNOSTIC_RULES: Record<string, DiagnosticRule> = {
  // ─────────────────────────────────────────────────────────────────────────────
  // CORS RULES (Stack-Aware)
  // ─────────────────────────────────────────────────────────────────────────────
  CORS_MISSING: {
    ruleId: "CORS_MISSING",
    category: "backend",
    severity: "critical",
    effort: "low",
    title: "CORS Header Missing on API Endpoint",
    plainEnglishCause: "The server did not send the 'Access-Control-Allow-Origin' response header when requested from a cross-origin domain. Modern browsers will block client-side JavaScript requests to this API.",
    fixSteps: [
      {
        step: 1,
        instruction: "Configure your server to send the 'Access-Control-Allow-Origin' header for authorized client origins.",
        technology: "Universal HTTP Header",
        codeSnippet: `Access-Control-Allow-Origin: https://yourfrontend.com\nAccess-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\nAccess-Control-Allow-Headers: Content-Type, Authorization`
      }
    ],
    repoSearchQuery: "Access-Control-Allow-Origin",
    stackVariants: [
      {
        targetStack: { framework: ["nextjs"] },
        technology: "Next.js (next.config.js)",
        fixSteps: [
          {
            step: 1,
            instruction: "Add cross-origin headers to API route patterns inside next.config.js.",
            technology: "Next.js",
            codeSnippet: `// next.config.js / next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: process.env.NEXT_PUBLIC_FRONTEND_URL || "https://yourfrontend.com" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Requested-With" },
          { key: "Access-Control-Allow-Credentials", value: "true" }
        ]
      }
    ];
  }
};
export default nextConfig;`
          }
        ],
        repoSearchQuery: "async headers()"
      },
      {
        targetStack: { server: ["express"], language: ["node"] },
        technology: "Express.js / Node.js",
        fixSteps: [
          {
            step: 1,
            instruction: "Install and mount the cors package at the top of your Express middleware chain.",
            technology: "Express.js",
            codeSnippet: `// npm install cors @types/cors
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'https://yourfrontend.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));`
          }
        ],
        repoSearchQuery: "app.use(cors"
      },
      {
        targetStack: { framework: ["fastapi"], language: ["python"] },
        technology: "FastAPI / Starlette",
        fixSteps: [
          {
            step: 1,
            instruction: "Mount FastAPI's built-in CORSMiddleware to handle CORS headers and OPTIONS preflights.",
            technology: "FastAPI / Python",
            codeSnippet: `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CLIENT_ORIGIN", "https://yourfrontend.com")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)`
          }
        ],
        repoSearchQuery: "add_middleware(CORSMiddleware"
      },
      {
        targetStack: { framework: ["django"], language: ["python"] },
        technology: "Django",
        fixSteps: [
          {
            step: 1,
            instruction: "Install django-cors-headers and add CorsMiddleware to your MIDDLEWARE setting.",
            technology: "Django",
            codeSnippet: `# pip install django-cors-headers
# settings.py
INSTALLED_APPS = [
    ...,
    'corsheaders',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # Place at the very top
    'django.middleware.common.CommonMiddleware',
    ...
]

CORS_ALLOWED_ORIGINS = [
    "https://yourfrontend.com",
]`
          }
        ],
        repoSearchQuery: "CORS_ALLOWED_ORIGINS"
      },
      {
        targetStack: { server: ["nginx"] },
        technology: "Nginx Reverse Proxy",
        fixSteps: [
          {
            step: 1,
            instruction: "Add CORS headers and handle OPTIONS preflight inside the Nginx location block.",
            technology: "Nginx",
            codeSnippet: `location /api/ {
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' '$http_origin' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, X-Requested-With' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Content-Length' 0;
        add_header 'Content-Type' 'text/plain; charset=utf-8';
        return 204;
    }
    add_header 'Access-Control-Allow-Origin' '$http_origin' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    proxy_pass http://127.0.0.1:4000;
}`
          }
        ],
        repoSearchQuery: "Access-Control-Allow-Origin"
      },
      {
        targetStack: { server: ["apache"] },
        technology: "Apache HTTP Server (.htaccess)",
        fixSteps: [
          {
            step: 1,
            instruction: "Enable mod_headers and configure CORS in your .htaccess or httpd.conf.",
            technology: "Apache",
            codeSnippet: `<IfModule mod_headers.c>
    Header always set Access-Control-Allow-Origin "https://yourfrontend.com"
    Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
    Header always set Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With"
    Header always set Access-Control-Allow-Credentials "true"
</IfModule>`
          }
        ],
        repoSearchQuery: "Header always set Access-Control-Allow-Origin"
      }
    ]
  },

  CORS_WILDCARD_CREDENTIALS: {
    ruleId: "CORS_WILDCARD_CREDENTIALS",
    category: "security",
    severity: "critical",
    effort: "low",
    title: "Insecure CORS Wildcard with Credentials",
    plainEnglishCause: "The API returns Access-Control-Allow-Origin: * while allowing credentials (cookies/auth headers). Modern browsers strictly reject this response for security reasons, breaking authentication.",
    fixSteps: [
      {
        step: 1,
        instruction: "Replace the wildcard '*' origin with an explicit list of trusted origin URLs or a dynamic origin validator.",
        technology: "Universal CORS Config",
        codeSnippet: `// Explicit origins required when Access-Control-Allow-Credentials is true
Access-Control-Allow-Origin: https://app.yourdomain.com
Access-Control-Allow-Credentials: true`
      }
    ],
    repoSearchQuery: "cors(",
    stackVariants: [
      {
        targetStack: { server: ["express"], language: ["node"] },
        technology: "Express.js / Node.js",
        fixSteps: [
          {
            step: 1,
            instruction: "Provide an explicit origin array or validation function to the cors middleware.",
            technology: "Express.js",
            codeSnippet: `app.use(cors({
  origin: ['https://app.yourdomain.com', 'http://localhost:3000'],
  credentials: true
}));`
          }
        ],
        repoSearchQuery: "cors({"
      },
      {
        targetStack: { framework: ["fastapi"], language: ["python"] },
        technology: "FastAPI / Python",
        fixSteps: [
          {
            step: 1,
            instruction: "Specify explicit origins in allow_origins when allow_credentials=True.",
            technology: "FastAPI",
            codeSnippet: `app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://app.yourdomain.com", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)`
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // SECURITY HEADERS (Stack-Aware)
  // ─────────────────────────────────────────────────────────────────────────────
  SEC_CSP_MISSING: {
    ruleId: "SEC_CSP_MISSING",
    category: "security",
    severity: "warning",
    effort: "low",
    title: "Missing Content-Security-Policy (CSP) Header",
    plainEnglishCause: "No Content-Security-Policy header was detected. Without a CSP, the application is vulnerable to Cross-Site Scripting (XSS), clickjacking, and rogue script injection.",
    fixSteps: [
      {
        step: 1,
        instruction: "Configure a restrictive Content Security Policy specifying trusted script, style, image, and connect origins.",
        technology: "Universal HTTP Header",
        codeSnippet: `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:;`
      }
    ],
    repoSearchQuery: "Content-Security-Policy",
    stackVariants: [
      {
        targetStack: { framework: ["nextjs"] },
        technology: "Next.js (next.config.js)",
        fixSteps: [
          {
            step: 1,
            instruction: "Define your Content Security Policy inside next.config.js headers configuration.",
            technology: "Next.js",
            codeSnippet: `// next.config.js
const cspHeader = \`
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https:;
    style-src 'self' 'unsafe-inline' https:;
    img-src 'self' blob: data: https:;
    font-src 'self' https: data:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
\`.replace(/\\s{2,}/g, ' ').trim();

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: cspHeader },
        ],
      },
    ];
  },
};`
          }
        ],
        repoSearchQuery: "Content-Security-Policy"
      },
      {
        targetStack: { server: ["express"], language: ["node"] },
        technology: "Express.js (Helmet)",
        fixSteps: [
          {
            step: 1,
            instruction: "Use helmet's contentSecurityPolicy middleware in your Express app.",
            technology: "Express (Helmet)",
            codeSnippet: `// npm install helmet
import express from 'express';
import helmet from 'helmet';

const app = express();
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "https://api.yourdomain.com"]
  }
}));`
          }
        ],
        repoSearchQuery: "helmet.contentSecurityPolicy"
      },
      {
        targetStack: { server: ["nginx"] },
        technology: "Nginx Server Block",
        fixSteps: [
          {
            step: 1,
            instruction: "Add the Content-Security-Policy header directive in your Nginx server block.",
            technology: "Nginx",
            codeSnippet: `# /etc/nginx/sites-available/your-site
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; connect-src 'self' https:;" always;`
          }
        ],
        repoSearchQuery: "add_header Content-Security-Policy"
      },
      {
        targetStack: { server: ["apache"] },
        technology: "Apache HTTP Server (.htaccess)",
        fixSteps: [
          {
            step: 1,
            instruction: "Set Content-Security-Policy in .htaccess or virtual host definition.",
            technology: "Apache",
            codeSnippet: `<IfModule mod_headers.c>
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:;"
</IfModule>`
          }
        ],
        repoSearchQuery: "Header always set Content-Security-Policy"
      },
      {
        targetStack: { server: ["vercel"] },
        technology: "Vercel (vercel.json)",
        fixSteps: [
          {
            step: 1,
            instruction: "Define global security headers in vercel.json at the repository root.",
            technology: "Vercel",
            codeSnippet: `{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:;"
        }
      ]
    }
  ]
}`
          }
        ],
        repoSearchQuery: "vercel.json"
      }
    ]
  },

  SEC_HSTS_MISSING: {
    ruleId: "SEC_HSTS_MISSING",
    category: "security",
    severity: "warning",
    effort: "low",
    title: "Missing Strict-Transport-Security (HSTS) Header",
    plainEnglishCause: "The server does not enforce HTTPS connections via HSTS. Users communicating over insecure networks are vulnerable to SSL stripping and man-in-the-middle (MITM) attacks.",
    fixSteps: [
      {
        step: 1,
        instruction: "Configure the Strict-Transport-Security HTTP header to require HTTPS connections for at least 1 year.",
        technology: "Universal HTTP Header",
        codeSnippet: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
      }
    ],
    repoSearchQuery: "Strict-Transport-Security",
    stackVariants: [
      {
        targetStack: { server: ["nginx"] },
        technology: "Nginx Server Block",
        fixSteps: [
          {
            step: 1,
            instruction: "Add the Strict-Transport-Security header to your HTTPS server block in Nginx.",
            technology: "Nginx",
            codeSnippet: `server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
}`
          }
        ],
        repoSearchQuery: "add_header Strict-Transport-Security"
      },
      {
        targetStack: { server: ["apache"] },
        technology: "Apache (.htaccess)",
        fixSteps: [
          {
            step: 1,
            instruction: "Add the HSTS header via mod_headers in Apache.",
            technology: "Apache",
            codeSnippet: `<IfModule mod_headers.c>
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
</IfModule>`
          }
        ],
        repoSearchQuery: "Header always set Strict-Transport-Security"
      },
      {
        targetStack: { framework: ["nextjs"] },
        technology: "Next.js (next.config.js)",
        fixSteps: [
          {
            step: 1,
            instruction: "Add Strict-Transport-Security to headers list in next.config.js.",
            technology: "Next.js",
            codeSnippet: `// next.config.js
module.exports = {
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }
      ]
    }];
  }
};`
          }
        ],
        repoSearchQuery: "Strict-Transport-Security"
      },
      {
        targetStack: { server: ["express"], language: ["node"] },
        technology: "Express.js (Helmet)",
        fixSteps: [
          {
            step: 1,
            instruction: "Configure Helmet HSTS middleware in Express.",
            technology: "Express (Helmet)",
            codeSnippet: `import helmet from 'helmet';
app.use(helmet.hsts({
  maxAge: 31536000,
  includeSubDomains: true,
  preload: true
}));`
          }
        ],
        repoSearchQuery: "helmet.hsts"
      }
    ]
  },

  SEC_XFO_MISSING: {
    ruleId: "SEC_XFO_MISSING",
    category: "security",
    severity: "warning",
    effort: "low",
    title: "Missing X-Frame-Options Header (Clickjacking Risk)",
    plainEnglishCause: "The page does not set X-Frame-Options, allowing third-party malicious sites to embed your pages inside an iframe and trick users into clicking hidden buttons (clickjacking).",
    fixSteps: [
      {
        step: 1,
        instruction: "Send X-Frame-Options: SAMEORIGIN or DENY on all HTML responses.",
        technology: "Universal HTTP Header",
        codeSnippet: `X-Frame-Options: SAMEORIGIN`
      }
    ],
    repoSearchQuery: "X-Frame-Options",
    stackVariants: [
      {
        targetStack: { server: ["nginx"] },
        technology: "Nginx Server Block",
        fixSteps: [
          {
            step: 1,
            instruction: "Add X-Frame-Options in your Nginx configuration.",
            technology: "Nginx",
            codeSnippet: `add_header X-Frame-Options "SAMEORIGIN" always;`
          }
        ]
      },
      {
        targetStack: { server: ["apache"] },
        technology: "Apache (.htaccess)",
        fixSteps: [
          {
            step: 1,
            instruction: "Add X-Frame-Options in Apache configuration.",
            technology: "Apache",
            codeSnippet: `Header always set X-Frame-Options "SAMEORIGIN"`
          }
        ]
      },
      {
        targetStack: { framework: ["nextjs"] },
        technology: "Next.js (next.config.js)",
        fixSteps: [
          {
            step: 1,
            instruction: "Set X-Frame-Options in next.config.js headers.",
            technology: "Next.js",
            codeSnippet: `{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }`
          }
        ]
      },
      {
        targetStack: { server: ["express"], language: ["node"] },
        technology: "Express.js (Helmet)",
        fixSteps: [
          {
            step: 1,
            instruction: "Enable Helmet frameguard in Express.",
            technology: "Express (Helmet)",
            codeSnippet: `app.use(helmet.frameguard({ action: 'sameorigin' }));`
          }
        ]
      }
    ]
  },

  SEC_XCTO_MISSING: {
    ruleId: "SEC_XCTO_MISSING",
    category: "security",
    severity: "warning",
    effort: "low",
    title: "Missing X-Content-Type-Options: nosniff",
    plainEnglishCause: "Browsers may attempt MIME-type sniffing on responses lacking 'nosniff', which can lead to executable script execution from user-uploaded images or text files.",
    fixSteps: [
      {
        step: 1,
        instruction: "Send X-Content-Type-Options: nosniff on all responses.",
        technology: "Universal HTTP Header",
        codeSnippet: `X-Content-Type-Options: nosniff`
      }
    ],
    repoSearchQuery: "X-Content-Type-Options",
    stackVariants: [
      {
        targetStack: { server: ["nginx"] },
        technology: "Nginx Server Block",
        fixSteps: [
          {
            step: 1,
            instruction: "Add X-Content-Type-Options header in Nginx configuration.",
            technology: "Nginx",
            codeSnippet: `add_header X-Content-Type-Options "nosniff" always;`
          }
        ]
      },
      {
        targetStack: { server: ["apache"] },
        technology: "Apache (.htaccess)",
        fixSteps: [
          {
            step: 1,
            instruction: "Add X-Content-Type-Options in Apache .htaccess.",
            technology: "Apache",
            codeSnippet: `Header always set X-Content-Type-Options "nosniff"`
          }
        ]
      },
      {
        targetStack: { framework: ["nextjs"] },
        technology: "Next.js (next.config.js)",
        fixSteps: [
          {
            step: 1,
            instruction: "Add X-Content-Type-Options to next.config.js headers.",
            technology: "Next.js",
            codeSnippet: `{ key: 'X-Content-Type-Options', value: 'nosniff' }`
          }
        ]
      },
      {
        targetStack: { server: ["express"], language: ["node"] },
        technology: "Express.js (Helmet)",
        fixSteps: [
          {
            step: 1,
            instruction: "Enable Helmet noSniff middleware in Express.",
            technology: "Express (Helmet)",
            codeSnippet: `app.use(helmet.noSniff());`
          }
        ]
      }
    ]
  },

  SEC_SERVER_HEADER_LEAK: {
    ruleId: "SEC_SERVER_HEADER_LEAK",
    category: "security",
    severity: "info",
    effort: "low",
    title: "Server Identity Information Leaked",
    plainEnglishCause: "The server is disclosing its underlying software and version number via the 'Server' or 'X-Powered-By' response header. This aids attackers in footprinting known CVE vulnerabilities.",
    fixSteps: [
      {
        step: 1,
        instruction: "Suppress or sanitize Server and X-Powered-By response headers in your web server configuration.",
        technology: "Universal Server Hardening",
        codeSnippet: `# Remove Server and X-Powered-By response headers`
      }
    ],
    repoSearchQuery: "ServerTokens",
    stackVariants: [
      {
        targetStack: { server: ["nginx"] },
        technology: "Nginx (nginx.conf)",
        fixSteps: [
          {
            step: 1,
            instruction: "Disable server version numbers in the http block of /etc/nginx/nginx.conf.",
            technology: "Nginx",
            codeSnippet: `# /etc/nginx/nginx.conf
http {
    server_tokens off;
    more_clear_headers Server; # If using headers-more module
}`
          }
        ],
        repoSearchQuery: "server_tokens off;"
      },
      {
        targetStack: { server: ["apache"] },
        technology: "Apache (httpd.conf)",
        fixSteps: [
          {
            step: 1,
            instruction: "Set ServerTokens to Prod and ServerSignature to Off in httpd.conf.",
            technology: "Apache",
            codeSnippet: `# httpd.conf / apache2.conf
ServerTokens Prod
ServerSignature Off`
          }
        ],
        repoSearchQuery: "ServerTokens Prod"
      },
      {
        targetStack: { server: ["express"], language: ["node"] },
        technology: "Express.js",
        fixSteps: [
          {
            step: 1,
            instruction: "Disable the X-Powered-By header on your Express app instance.",
            technology: "Express.js",
            codeSnippet: `const app = express();
app.disable('x-powered-by');`
          }
        ],
        repoSearchQuery: "app.disable('x-powered-by')"
      },
      {
        targetStack: { framework: ["nextjs"] },
        technology: "Next.js (next.config.js)",
        fixSteps: [
          {
            step: 1,
            instruction: "Set poweredByHeader: false in next.config.js.",
            technology: "Next.js",
            codeSnippet: `// next.config.js
module.exports = {
  poweredByHeader: false,
};`
          }
        ],
        repoSearchQuery: "poweredByHeader: false"
      },
      {
        targetStack: { language: ["php"] },
        technology: "PHP (php.ini)",
        fixSteps: [
          {
            step: 1,
            instruction: "Turn off expose_php in your php.ini configuration.",
            technology: "PHP",
            codeSnippet: `; php.ini
expose_php = Off`
          }
        ],
        repoSearchQuery: "expose_php"
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // SSL / TLS CERTIFICATE (Universal)
  // ─────────────────────────────────────────────────────────────────────────────
  SSL_EXPIRED: {
    ruleId: "SSL_EXPIRED",
    category: "security",
    severity: "critical",
    effort: "low",
    title: "SSL / TLS Certificate is Expired",
    plainEnglishCause: "The TLS certificate for this domain has expired. Browsers will display a full-page security warning blocking visitors from accessing your site.",
    fixSteps: [
      {
        step: 1,
        instruction: "Renew your SSL certificate immediately via your hosting provider, Cloudflare, or Certbot (Let's Encrypt).",
        technology: "Certbot / Let's Encrypt",
        codeSnippet: `sudo certbot renew --force-renewal
sudo systemctl reload nginx`
      }
    ]
  },

  SSL_EXPIRING_SOON: {
    ruleId: "SSL_EXPIRING_SOON",
    category: "security",
    severity: "warning",
    effort: "low",
    title: "SSL Certificate Expiring in < 30 Days",
    plainEnglishCause: "The TLS certificate is valid but expires in less than 30 days. Auto-renewal may be misconfigured or failing.",
    fixSteps: [
      {
        step: 1,
        instruction: "Verify automated renewal cron and DNS verification hooks.",
        technology: "SSL Monitoring",
        codeSnippet: `sudo certbot renew --dry-run`
      }
    ]
  },

  SSL_SELF_SIGNED: {
    ruleId: "SSL_SELF_SIGNED",
    category: "security",
    severity: "critical",
    effort: "low",
    title: "Self-Signed or Untrusted SSL Certificate",
    plainEnglishCause: "The certificate was not signed by a recognized Certificate Authority (CA). Browsers will reject the connection as unsafe.",
    fixSteps: [
      {
        step: 1,
        instruction: "Obtain a free trusted certificate from Let's Encrypt or your cloud platform (AWS ACM, Cloudflare, Vercel).",
        technology: "SSL / DNS"
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // FRONTEND PAGE LOAD & ERRORS (Universal)
  // ─────────────────────────────────────────────────────────────────────────────
  CONSOLE_JS_ERROR: {
    ruleId: "CONSOLE_JS_ERROR",
    category: "frontend",
    severity: "critical",
    effort: "medium",
    title: "Uncaught JavaScript Console Error",
    plainEnglishCause: "A JavaScript runtime exception or unhandled promise rejection occurred in the browser console during page execution, risking broken UI workflows.",
    fixSteps: [
      {
        step: 1,
        instruction: "Review the stack trace and wrap root components in Error Boundaries to isolate errors gracefully.",
        technology: "React / JavaScript",
        codeSnippet: `class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error("Caught UI error:", error, info); }
  render() {
    if (this.state.hasError) return <h2>Something went wrong.</h2>;
    return this.props.children;
  }
}`
      }
    ],
    repoSearchQuery: "ErrorBoundary"
  },

  NETWORK_FAILED_REQUEST: {
    ruleId: "NETWORK_FAILED_REQUEST",
    category: "frontend",
    severity: "critical",
    effort: "medium",
    title: "Failed Network Request (4xx / 5xx)",
    plainEnglishCause: "The browser attempted to load a resource or hit an API endpoint that returned an HTTP error code, resulting in failed data rendering or broken UI.",
    fixSteps: [
      {
        step: 1,
        instruction: "Check if the requested API route or asset URL is deployed and accessible. Ensure authentication tokens and request URLs are correct.",
        technology: "API Client"
      }
    ],
    repoSearchQuery: "fetch("
  },

  NETWORK_BROKEN_IMAGE: {
    ruleId: "NETWORK_BROKEN_IMAGE",
    category: "frontend",
    severity: "warning",
    effort: "low",
    title: "Broken Image Asset (404 Not Found)",
    plainEnglishCause: "An <img> tag or CSS background referenced an image URL that returned a 404 HTTP status code, displaying a broken image icon to users.",
    fixSteps: [
      {
        step: 1,
        instruction: "Verify the image path in your static assets folder or public CDN bucket, or add a fallback image handler.",
        technology: "HTML / React",
        codeSnippet: `<img 
  src="/assets/image.png" 
  alt="Descriptive label" 
  onError={(e) => { e.currentTarget.src = '/assets/fallback.png'; }} 
/>`
      }
    ],
    repoSearchQuery: "<img"
  },

  CRAWLER_BROKEN_LINK: {
    ruleId: "CRAWLER_BROKEN_LINK",
    category: "frontend",
    severity: "warning",
    effort: "low",
    title: "Broken Internal Link (404 Not Found)",
    plainEnglishCause: "The internal page crawler encountered a link leading to a 404 dead page on your domain. Broken links damage user experience and SEO rankings.",
    fixSteps: [
      {
        step: 1,
        instruction: "Update or remove the dead href link, or configure a 301 redirect on your server.",
        technology: "Routing"
      }
    ],
    repoSearchQuery: "href="
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CORE WEB VITALS (Universal)
  // ─────────────────────────────────────────────────────────────────────────────
  CWV_LCP_POOR: {
    ruleId: "CWV_LCP_POOR",
    category: "performance",
    severity: "critical",
    effort: "high",
    title: "Poor Largest Contentful Paint (LCP > 4.0s)",
    plainEnglishCause: "The largest visible element (hero image, banner, or heading) took longer than 4.0 seconds to render, signaling significant perceptual slowness.",
    fixSteps: [
      {
        step: 1,
        instruction: "Preload critical hero images and optimize image formats using modern AVIF/WebP.",
        technology: "HTML",
        codeSnippet: `<link rel="preload" as="image" href="/hero.webp" fetchpriority="high" />`
      },
      {
        step: 2,
        instruction: "Ensure server response time (TTFB) is fast and avoid render-blocking CSS/JavaScript.",
        technology: "Performance"
      }
    ],
    repoSearchQuery: "<link rel=\"preload\""
  },

  CWV_CLS_POOR: {
    ruleId: "CWV_CLS_POOR",
    category: "performance",
    severity: "critical",
    effort: "medium",
    title: "High Cumulative Layout Shift (CLS > 0.25)",
    plainEnglishCause: "Elements on the page jumped or shifted position while loading, causing a jarring visual experience and accidental clicks.",
    fixSteps: [
      {
        step: 1,
        instruction: "Always specify explicit width and height dimensions or aspect-ratio on images, videos, and dynamic ad containers.",
        technology: "CSS / HTML",
        codeSnippet: `img, video {
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 9;
}`
      }
    ],
    repoSearchQuery: "aspect-ratio"
  },

  CWV_TBT_POOR: {
    ruleId: "CWV_TBT_POOR",
    category: "performance",
    severity: "warning",
    effort: "high",
    title: "High Total Blocking Time (TBT > 600ms)",
    plainEnglishCause: "Long-running JavaScript tasks blocked the main browser thread for over 600ms, delaying user interactivity and responsiveness.",
    fixSteps: [
      {
        step: 1,
        instruction: "Code-split heavy bundles with dynamic imports, defer analytics scripts, and break up heavy loops.",
        technology: "JavaScript",
        codeSnippet: `// Dynamic import / Code splitting
import React, { Suspense, lazy } from 'react';
const HeavyChart = lazy(() => import('./HeavyChart'));`
      }
    ],
    repoSearchQuery: "React.lazy"
  },

  PAGE_TTFB_SLOW: {
    ruleId: "PAGE_TTFB_SLOW",
    category: "performance",
    severity: "warning",
    effort: "medium",
    title: "Slow Time to First Byte (TTFB > 800ms)",
    plainEnglishCause: "The server took over 800ms before sending the first byte of HTML. This is typically caused by un-cached database queries, slow SSR rendering, or distant server regions.",
    fixSteps: [
      {
        step: 1,
        instruction: "Implement HTTP edge caching (Cloudflare / Vercel Edge / Fastly) and optimize backend database queries.",
        technology: "Caching / CDN",
        codeSnippet: `// Cache-Control header
res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');`
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // ACCESSIBILITY (axe-core WCAG 2.1 AA - Universal)
  // ─────────────────────────────────────────────────────────────────────────────
  AXE_COLOR_CONTRAST: {
    ruleId: "AXE_COLOR_CONTRAST",
    category: "accessibility",
    severity: "warning",
    effort: "low",
    title: "Insufficient Color Contrast (WCAG 1.4.3 AA)",
    plainEnglishCause: "Text elements do not meet the minimum 4.5:1 contrast ratio against their background color, making text hard or impossible to read for users with visual impairments.",
    fixSteps: [
      {
        step: 1,
        instruction: "Adjust the foreground text color or background color to satisfy WCAG AA contrast guidelines.",
        technology: "CSS",
        codeSnippet: `/* Before: #888888 on #ffffff (ratio ~3.5:1 - FAILS) */
/* After:  #595959 on #ffffff (ratio >= 4.5:1 - PASSES) */
.accessible-text {
  color: #595959;
}`
      }
    ],
    repoSearchQuery: "color:"
  },

  AXE_IMAGE_ALT_MISSING: {
    ruleId: "AXE_IMAGE_ALT_MISSING",
    category: "accessibility",
    severity: "warning",
    effort: "low",
    title: "Image Missing Alternative Text (WCAG 1.1.1)",
    plainEnglishCause: "An <img> element does not have an 'alt' attribute. Screen readers cannot describe the image to visually impaired users.",
    fixSteps: [
      {
        step: 1,
        instruction: "Add a descriptive 'alt' attribute to the <img> tag, or alt=\"\" if the image is purely decorative.",
        technology: "HTML",
        codeSnippet: `<img src="/avatar.jpg" alt="User profile photo" />
<!-- If decorative -->
<img src="/divider.svg" alt="" role="presentation" />`
      }
    ],
    repoSearchQuery: "<img"
  },

  AXE_FORM_LABEL_MISSING: {
    ruleId: "AXE_FORM_LABEL_MISSING",
    category: "accessibility",
    severity: "warning",
    effort: "low",
    title: "Form Input Missing Associated Label (WCAG 4.1.2)",
    plainEnglishCause: "An <input>, <select>, or <textarea> element does not have an associated <label> or aria-label, leaving assistive technologies unable to announce the field's purpose.",
    fixSteps: [
      {
        step: 1,
        instruction: "Associate an explicit <label for=\"id\"> with the input or add an aria-label attribute.",
        technology: "HTML",
        codeSnippet: `<label htmlFor="user-email">Email Address</label>
<input id="user-email" type="email" name="email" />`
      }
    ],
    repoSearchQuery: "<input"
  },

  AXE_BUTTON_NAME_MISSING: {
    ruleId: "AXE_BUTTON_NAME_MISSING",
    category: "accessibility",
    severity: "warning",
    effort: "low",
    title: "Button Missing Accessible Name (WCAG 4.1.2)",
    plainEnglishCause: "An icon-only <button> element does not have inner text or an aria-label attribute, so screen readers only announce 'button' without indicating its function.",
    fixSteps: [
      {
        step: 1,
        instruction: "Add an aria-label attribute or a visually-hidden text span inside the button.",
        technology: "HTML / React",
        codeSnippet: `<button type="button" aria-label="Close dialog">
  <CloseIcon />
</button>`
      }
    ],
    repoSearchQuery: "<button"
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // SEO BASICS (Universal)
  // ─────────────────────────────────────────────────────────────────────────────
  SEO_META_DESCRIPTION_MISSING: {
    ruleId: "SEO_META_DESCRIPTION_MISSING",
    category: "seo",
    severity: "warning",
    effort: "low",
    title: "Missing Meta Description Tag",
    plainEnglishCause: "The HTML document lacks a <meta name=\"description\"> tag. Search engines may display arbitrary page text in search result snippets.",
    fixSteps: [
      {
        step: 1,
        instruction: "Add a concise, informative meta description (50-160 characters) inside the <head> tag.",
        technology: "HTML / Next.js",
        codeSnippet: `<head>
  <meta name="description" content="SiteDoctor — Real-Time Full-Stack Health & Fix Diagnostics Platform." />
</head>`
      }
    ],
    repoSearchQuery: "name=\"description\""
  },

  SEO_VIEWPORT_MISSING: {
    ruleId: "SEO_VIEWPORT_MISSING",
    category: "seo",
    severity: "critical",
    effort: "low",
    title: "Missing Mobile Viewport Meta Tag",
    plainEnglishCause: "The document lacks a viewport meta tag. Mobile browsers will render the page at desktop width, breaking responsive mobile usability.",
    fixSteps: [
      {
        step: 1,
        instruction: "Add the standard mobile viewport tag to the document <head>.",
        technology: "HTML",
        codeSnippet: `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`
      }
    ],
    repoSearchQuery: "name=\"viewport\""
  },

  SEO_ROBOTS_MISSING: {
    ruleId: "SEO_ROBOTS_MISSING",
    category: "seo",
    severity: "info",
    effort: "low",
    title: "Missing robots.txt File",
    plainEnglishCause: "No robots.txt file was found at the root of the domain. Having a robots.txt allows you to direct crawler traffic and specify sitemap locations.",
    fixSteps: [
      {
        step: 1,
        instruction: "Create a public/robots.txt file at the root of your web server.",
        technology: "Robots.txt",
        codeSnippet: `User-agent: *
Allow: /
Sitemap: https://yourdomain.com/sitemap.xml`
      }
    ],
    repoSearchQuery: "robots.txt"
  },

  SEO_SITEMAP_MISSING: {
    ruleId: "SEO_SITEMAP_MISSING",
    category: "seo",
    severity: "info",
    effort: "low",
    title: "Missing sitemap.xml File",
    plainEnglishCause: "No sitemap.xml file was discovered at /sitemap.xml. Sitemaps help search engine crawlers index all your public URLs efficiently.",
    fixSteps: [
      {
        step: 1,
        instruction: "Generate and host a sitemap.xml file at the root of your domain.",
        technology: "Sitemap",
        codeSnippet: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://yourdomain.com/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // BACKEND / API DISCOVERY & LOAD (Stack-Aware)
  // ─────────────────────────────────────────────────────────────────────────────
  API_HEALTH_FAIL: {
    ruleId: "API_HEALTH_FAIL",
    category: "backend",
    severity: "critical",
    effort: "medium",
    title: "Health Check Endpoint Unreachable or Failing",
    plainEnglishCause: "Probing common health check routes (/health, /api/health) returned an error or 404 status. Automated monitors and orchestrators (Kubernetes, AWS ALB) rely on this endpoint to verify container health.",
    fixSteps: [
      {
        step: 1,
        instruction: "Expose a lightweight /health or /api/health route that returns status 200 and basic runtime status.",
        technology: "Universal HTTP Endpoint",
        codeSnippet: `GET /health -> HTTP 200 {"status": "ok"}`
      }
    ],
    repoSearchQuery: "/health",
    stackVariants: [
      {
        targetStack: { framework: ["nextjs"] },
        technology: "Next.js Route Handler",
        fixSteps: [
          {
            step: 1,
            instruction: "Create a lightweight Route Handler in app/api/health/route.ts (or pages/api/health.ts).",
            technology: "Next.js",
            codeSnippet: `// app/api/health/route.ts
export async function GET() {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString()
  });
}`
          }
        ],
        repoSearchQuery: "app/api/health"
      },
      {
        targetStack: { server: ["express"], language: ["node"] },
        technology: "Express.js",
        fixSteps: [
          {
            step: 1,
            instruction: "Expose a health check route on your Express server.",
            technology: "Express.js",
            codeSnippet: `app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});`
          }
        ],
        repoSearchQuery: "app.get('/health'"
      },
      {
        targetStack: { framework: ["fastapi"], language: ["python"] },
        technology: "FastAPI",
        fixSteps: [
          {
            step: 1,
            instruction: "Add a GET /health route in FastAPI.",
            technology: "FastAPI",
            codeSnippet: `@app.get("/health")
def health_check():
    return {"status": "ok"}`
          }
        ]
      },
      {
        targetStack: { server: ["nginx"] },
        technology: "Nginx Direct Response",
        fixSteps: [
          {
            step: 1,
            instruction: "Configure Nginx to return a direct JSON 200 status for /health.",
            technology: "Nginx",
            codeSnippet: `location = /health {
    access_log off;
    add_header Content-Type application/json;
    return 200 '{"status":"ok"}';
}`
          }
        ]
      }
    ]
  },

  API_OPENAPI_PARSE_ERROR: {
    ruleId: "API_OPENAPI_PARSE_ERROR",
    category: "backend",
    severity: "info",
    effort: "low",
    title: "OpenAPI Spec Ingestion Fallback",
    plainEnglishCause: "The provided OpenAPI / Swagger spec URL could not be parsed as valid JSON/YAML. SiteDoctor automatically fell back to probing standard common endpoints.",
    fixSteps: [
      {
        step: 1,
        instruction: "Verify that the OpenAPI spec URL returns valid JSON or YAML compliant with OpenAPI 3.0 / Swagger 2.0.",
        technology: "OpenAPI / Swagger"
      }
    ]
  },

  LIGHT_LOAD_HIGH_LATENCY: {
    ruleId: "LIGHT_LOAD_HIGH_LATENCY",
    category: "performance",
    severity: "warning",
    effort: "high",
    title: "High Latency Under Light Concurrent Load (10 Reqs)",
    plainEnglishCause: "During a light test with 10 concurrent requests, average response latency exceeded 1500ms. This indicates potential thread contention, unindexed database queries, or server resource bottlenecks.",
    fixSteps: [
      {
        step: 1,
        instruction: "Profile backend handlers, add database indexes on queried fields, and implement connection pooling.",
        technology: "Backend Optimization"
      }
    ]
  },

  LIGHT_LOAD_BLOCKED_BY_WAF: {
    ruleId: "LIGHT_LOAD_BLOCKED_BY_WAF",
    category: "backend",
    severity: "info",
    effort: "low",
    title: "Concurrent Requests Intercepted by Bot-Protection / WAF",
    plainEnglishCause: "Concurrent health probe requests were intercepted with HTTP 401/403/429 responses. This is the expected behavior of an active Web Application Firewall (WAF) or anti-bot defense (e.g. Akamai, Cloudflare, PerimeterX) mitigating automated traffic patterns, not a backend capacity or stability defect.",
    fixSteps: [
      {
        step: 1,
        instruction: "If running automated diagnostics in CI/CD, whitelist the scanner IP or User-Agent header in your WAF / Edge rate-limiting rules.",
        technology: "WAF / Rate Limiter"
      }
    ]
  },

  LIGHT_LOAD_ERROR_RATE: {
    ruleId: "LIGHT_LOAD_ERROR_RATE",
    category: "backend",
    severity: "critical",
    effort: "medium",
    title: "Server 5xx Errors / Connection Resets Under Concurrent Load",
    plainEnglishCause: "The server produced 5xx internal server errors (500, 502, 503, 504), socket connection resets, or network timeouts when handling 10 simultaneous requests. This indicates genuine backend distress, thread pool exhaustion, or unhandled exceptions under concurrency.",
    fixSteps: [
      {
        step: 1,
        instruction: "Inspect server logs for unhandled exception stack traces, increase database connection pool limits, and configure proper worker process concurrency.",
        technology: "Backend Capacity & Pool Tuning"
      }
    ]
  }
};
