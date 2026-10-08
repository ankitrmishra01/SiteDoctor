import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Click HTTPBIN.ORG preset
  const preset = page.locator("button:has-text('HTTPBIN.ORG')");
  if (await preset.isVisible()) {
    await preset.click();
  }
  await page.locator("input[type='checkbox']").check();
  await page.click("button:has-text('EXECUTE_DIAGNOSTICS')");
  console.log("Waiting for scan to complete...");
  await page.waitForSelector("text=EXPORT_REPORT", { timeout: 60000 });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: "C:/Users/ankit/.gemini/antigravity/brain/7afcafdb-6c52-4337-bf52-4c8637040da6/screenshot_hierarchy_anchor.png", fullPage: true });
  console.log("SAVED_HIERARCHY_SCREENSHOT");
  await browser.close();
}

main().catch(err => {
  console.error("Capture error:", err);
  process.exit(1);
});
