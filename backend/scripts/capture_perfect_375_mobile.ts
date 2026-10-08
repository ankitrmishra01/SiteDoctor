import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const ARTIFACT_DIR = "C:/Users/ankit/.gemini/antigravity/brain/7afcafdb-6c52-4337-bf52-4c8637040da6";

async function main() {
  console.log("Launching Chromium for high-fidelity 375px mobile screenshots...");
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    hasTouch: true,
    isMobile: true
  });

  const page = await context.newPage();
  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });

  // 1. Light Idle (375px)
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
    localStorage.setItem("sitedoctor-theme", "light");
  });
  await page.waitForTimeout(500);
  const lightIdlePath = path.join(ARTIFACT_DIR, "screenshot_mobile_375_light_idle.png");
  await page.screenshot({ path: lightIdlePath, fullPage: false });
  console.log("Saved:", lightIdlePath);

  // 2. Light Populated (375px) - Load recent scan with full findings
  await page.evaluate(() => {
    // Check if there is history in scanStore and select the first one
    const store = (window as any).useScanStore?.getState ? (window as any).useScanStore.getState() : null;
    if (store && store.history && store.history.length > 0) {
      store.loadScanResult(store.history[0]);
    }
  });

  // If Zustand window handle isn't exposed, click the first recent target button
  const recentBtn = page.locator("button.pill.accent").first();
  if (await recentBtn.isVisible()) {
    await recentBtn.click();
    await page.waitForTimeout(600);
  }

  const lightPopulatedPath = path.join(ARTIFACT_DIR, "screenshot_mobile_375_light_populated.png");
  await page.screenshot({ path: lightPopulatedPath, fullPage: false });
  console.log("Saved:", lightPopulatedPath);

  // 3. Dark Populated (375px)
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("sitedoctor-theme", "dark");
  });
  await page.waitForTimeout(500);

  const darkPopulatedPath = path.join(ARTIFACT_DIR, "screenshot_mobile_375_dark_populated.png");
  await page.screenshot({ path: darkPopulatedPath, fullPage: false });
  console.log("Saved:", darkPopulatedPath);

  // 4. Dark Idle (375px)
  const clearInputBtn = page.locator("button[title='Clear input']");
  if (await clearInputBtn.isVisible()) {
    await clearInputBtn.click();
    await page.waitForTimeout(300);
  }

  const darkIdlePath = path.join(ARTIFACT_DIR, "screenshot_mobile_375_dark_idle.png");
  await page.screenshot({ path: darkIdlePath, fullPage: false });
  console.log("Saved:", darkIdlePath);

  await browser.close();
  console.log("All 375px mobile screenshots refreshed successfully!");
}

main().catch(console.error);
