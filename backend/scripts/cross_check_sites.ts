import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function fetchLiveHeaders(url: string) {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      redirect: "follow"
    });

    const headers: Record<string, string> = {};
    res.headers.forEach((val, key) => {
      headers[key.toLowerCase()] = val;
    });

    return {
      status: res.status,
      finalUrl: res.url,
      headers
    };
  } catch (err: any) {
    return { error: err.message };
  }
}

async function runCrossCheck() {
  console.log("=== Cross-Checking SiteDoctor Diagnostic Findings vs Ground Truth (curl/fetch) ===");

  // Site 1: berkshirehathaway.com
  const site1Url = "http://berkshirehathaway.com";
  console.log(`\n1. Fetching ground truth headers for ${site1Url}...`);
  const site1Live = await fetchLiveHeaders(site1Url);

  // Site 2: pypi.org
  const site2Url = "https://pypi.org";
  console.log(`\n2. Fetching ground truth headers for ${site2Url}...`);
  const site2Live = await fetchLiveHeaders(site2Url);

  const crossCheckData = {
    site1: {
      url: site1Url,
      groundTruth: {
        httpStatus: site1Live.status,
        finalUrl: site1Live.finalUrl,
        serverHeader: site1Live.headers?.["server"] || null,
        csp: site1Live.headers?.["content-security-policy"] || null,
        hsts: site1Live.headers?.["strict-transport-security"] || null,
        xfo: site1Live.headers?.["x-frame-options"] || null,
        xcto: site1Live.headers?.["x-content-type-options"] || null
      }
    },
    site2: {
      url: site2Url,
      groundTruth: {
        httpStatus: site2Live.status,
        finalUrl: site2Live.finalUrl,
        serverHeader: site2Live.headers?.["server"] || null,
        csp: site2Live.headers?.["content-security-policy"] || null,
        hsts: site2Live.headers?.["strict-transport-security"] || null,
        xfo: site2Live.headers?.["x-frame-options"] || null,
        xcto: site2Live.headers?.["x-content-type-options"] || null
      }
    }
  };

  const outPath = path.resolve(__dirname, "../data/cross_check_ground_truth.json");
  fs.writeFileSync(outPath, JSON.stringify(crossCheckData, null, 2), "utf-8");
  console.log("\nGround truth headers captured:");
  console.log(JSON.stringify(crossCheckData, null, 2));
}

runCrossCheck().catch(console.error);
