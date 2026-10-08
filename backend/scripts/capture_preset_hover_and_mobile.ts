import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const ARTIFACT_DIR = "C:/Users/ankit/.gemini/antigravity/brain/7afcafdb-6c52-4337-bf52-4c8637040da6";

async function main() {
  console.log("Capturing exact screenshot proofs...");
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop View with Preset Hover State
  const desktopCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const desktopPage = await desktopCtx.newPage();
  await desktopPage.goto("http://localhost:5173", { waitUntil: "networkidle" });
  await desktopPage.waitForTimeout(500);

  // Hover over the preset chip
  const presetBtn = desktopPage.locator("button.preset-chip").filter({ hasText: "vite.dev (SPA)" }).first();
  await presetBtn.hover();
  await desktopPage.waitForTimeout(300);

  const hoverPath = path.join(ARTIFACT_DIR, "screenshot_preset_chip_hover.png");
  await desktopPage.screenshot({ path: hoverPath, fullPage: false });
  console.log("Saved preset hover screenshot:", hoverPath);
  await desktopCtx.close();

  // 2. Mobile 375px Populated View (Light Theme)
  const mobileCtx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    hasTouch: true,
    isMobile: true
  });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto("http://localhost:5173", { waitUntil: "networkidle" });

  // Click mdn-docs or vite.dev preset to populate dashboard
  const mobilePresetBtn = mobilePage.locator("button.preset-chip").filter({ hasText: "vite.dev (SPA)" }).first();
  if (await mobilePresetBtn.isVisible()) {
    await mobilePresetBtn.click();
    await mobilePage.waitForTimeout(1000);
  }

  // Set light theme
  await mobilePage.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
    localStorage.setItem("sitedoctor-theme", "light");
  });
  await mobilePage.waitForTimeout(500);
  const mobileLightPopulated = path.join(ARTIFACT_DIR, "screenshot_mobile_375_light_populated.png");
  await mobilePage.screenshot({ path: mobileLightPopulated, fullPage: false });
  console.log("Saved mobile light populated screenshot:", mobileLightPopulated);

  // Set dark theme
  await mobilePage.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("sitedoctor-theme", "dark");
  });
  await mobilePage.waitForTimeout(500);
  const mobileDarkPopulated = path.join(ARTIFACT_DIR, "screenshot_mobile_375_dark_populated.png");
  await mobilePage.screenshot({ path: mobileDarkPopulated, fullPage: false });
  console.log("Saved mobile dark populated screenshot:", mobileDarkPopulated);

  await mobileCtx.close();
  await browser.close();
  console.log("All screenshots captured successfully!");
}

main().catch(console.error);
