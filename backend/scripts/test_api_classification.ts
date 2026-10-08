import { performance } from "node:perf_hooks";

async function probeTarget(url: string) {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SiteDoctor/1.0",
        "Accept": "application/json, text/html, */*"
      },
      signal: AbortSignal.timeout(8000)
    });
    const contentType = res.headers.get("content-type") || "none";
    const status = res.status;
    const dur = Math.round(performance.now() - start);
    return { url, status, contentType, ok: true, durationMs: dur };
  } catch (err: any) {
    return { url, status: 0, contentType: "error", ok: false, error: err.message, durationMs: Math.round(performance.now() - start) };
  }
}

async function main() {
  const targets = [
    // 3 Real APIs on non-"api." hostnames
    "https://httpbin.org",
    "https://dummyjson.com",
    "https://pokeapi.co",
    // 3 Real HTML Websites
    "https://www.etsy.com",
    "https://www.rust-lang.org",
    "https://www.berkshirehathaway.com"
  ];

  console.log("PROBING 6 TARGETS FOR CONTENT-TYPE & API SIGNALS:\n");
  for (const t of targets) {
    const r = await probeTarget(t);
    console.log(`URL: ${r.url}`);
    console.log(`  Status: ${r.status} | Content-Type: ${r.contentType} | Duration: ${r.durationMs}ms`);
  }
}

main().catch(console.error);
