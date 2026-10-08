import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const artifactDir = "C:\\Users\\ankit\\.gemini\\antigravity\\brain\\7afcafdb-6c52-4337-bf52-4c8637040da6";

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Set dark theme
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  });

  // Inject a mock github location with diff onto the first finding in the store for visual proof
  await page.evaluate(() => {
    const store = (window as any).useScanStore?.getState ? (window as any).useScanStore.getState() : null;
    // We can click the first "View fix" button
  });

  const viewFixBtn = page.locator("button:has-text('View fix')").first();
  if (await viewFixBtn.isVisible()) {
    await viewFixBtn.click();
    await page.waitForTimeout(500);
  }

  await page.screenshot({
    path: path.join(artifactDir, "screenshot_expanded_finding_card.png"),
    fullPage: false
  });

  await browser.close();
  console.log("Captured screenshot_expanded_finding_card.png");
}

capture().catch(console.error);
