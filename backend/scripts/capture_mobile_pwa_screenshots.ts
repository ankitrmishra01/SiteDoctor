import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const ARTIFACT_DIR = "C:/Users/ankit/.gemini/antigravity/brain/7afcafdb-6c52-4337-bf52-4c8637040da6";

async function main() {
  console.log("Launching Chromium for Mobile 375px & PWA Audit...");
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 375, height: 812 }, // iPhone 13/14/15 375px width
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    hasTouch: true,
    isMobile: true
  });

  const page = await context.newPage();

  // 1. Mobile Light Theme - Idle State
  console.log("Navigating to http://localhost:5173 (Light Idle 375px)...");
  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
    localStorage.setItem("sitedoctor-theme", "light");
  });
  await page.waitForTimeout(600);

  const lightIdlePath = path.join(ARTIFACT_DIR, "screenshot_mobile_375_light_idle.png");
  await page.screenshot({ path: lightIdlePath, fullPage: false });
  console.log("Saved:", lightIdlePath);

  // 2. Mobile Light Theme - Populated State
  console.log("Populating scan data on 375px (Light Populated)...");
  const mdnPreset = page.locator("button:has-text('mdn-docs')");
  if (await mdnPreset.isVisible()) {
    await mdnPreset.click();
    await page.waitForTimeout(800);
  }

  const lightPopulatedPath = path.join(ARTIFACT_DIR, "screenshot_mobile_375_light_populated.png");
  await page.screenshot({ path: lightPopulatedPath, fullPage: false });
  console.log("Saved:", lightPopulatedPath);

  // 3. Mobile Dark Theme - Populated State
  console.log("Switching to Dark Theme (Dark Populated 375px)...");
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("sitedoctor-theme", "dark");
  });
  await page.waitForTimeout(600);

  const darkPopulatedPath = path.join(ARTIFACT_DIR, "screenshot_mobile_375_dark_populated.png");
  await page.screenshot({ path: darkPopulatedPath, fullPage: false });
  console.log("Saved:", darkPopulatedPath);

  // 4. Mobile Dark Theme - Idle State
  console.log("Capturing Dark Idle 375px...");
  const clearBtn = page.locator("button[title='Clear input']");
  if (await clearBtn.isVisible()) {
    await clearBtn.click();
    await page.waitForTimeout(400);
  }

  const darkIdlePath = path.join(ARTIFACT_DIR, "screenshot_mobile_375_dark_idle.png");
  await page.screenshot({ path: darkIdlePath, fullPage: false });
  console.log("Saved:", darkIdlePath);

  // 5. PWA Manifest & Service Worker Verification
  console.log("Verifying PWA manifest and Service Worker registration...");
  const manifestHref = await page.locator("link[rel='manifest']").getAttribute("href");
  const swRegistered = await page.evaluate(async () => {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.length > 0;
    }
    return false;
  });

  console.log(`PWA Manifest link: ${manifestHref}`);
  console.log(`Service Worker registered in browser: ${swRegistered}`);

  await browser.close();
  console.log("All mobile screenshots and PWA verification completed!");
}

main().catch(err => {
  console.error("Mobile capture error:", err);
  process.exit(1);
});
