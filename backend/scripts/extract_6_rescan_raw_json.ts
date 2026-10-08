import { ScanQueueManager } from "../src/queue/scanQueue.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run6Sites() {
  const sites = [
    "https://slack.com",
    "https://sentry.io",
    "https://datadoghq.com",
    "https://discord.com",
    "https://cloudflare.com",
    "https://fastly.com"
  ];

  const scanQueue = ScanQueueManager.getInstance();
  const rawResults: any[] = [];

  for (const url of sites) {
    console.log(`Scanning ${url}...`);
    const res = await scanQueue.executeDirect({
      url,
      type: "both",
      consent: true
    });
    rawResults.push(res);
  }

  const outPath = path.resolve(__dirname, "../data/6_rescanned_raw_json.json");
  fs.writeFileSync(outPath, JSON.stringify(rawResults, null, 2));
  console.log(`Wrote 6 raw results to ${outPath}`);
}

run6Sites().catch(console.error);
