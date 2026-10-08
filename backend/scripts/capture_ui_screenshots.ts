import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const artifactDir = "C:\\Users\\ankit\\.gemini\\antigravity\\brain\\7afcafdb-6c52-4337-bf52-4c8637040da6";
fs.mkdirSync(artifactDir, { recursive: true });

async function capture() {
  console.log("=== Capturing SiteDoctor UI Verification Screenshots ===");
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Viewport (1440x900)
  const contextDesktop = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await contextDesktop.newPage();
  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Set Dark Theme
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("sitedoctor-theme", "dark");
  });
  await page.waitForTimeout(500);

  // 1.1 Idle State - Dark
  console.log("Capturing 1.1: Idle State (Dark)...");
  await page.screenshot({
    path: path.join(artifactDir, "screenshot_idle_dark.png"),
    fullPage: false
  });

  // 1.2 Idle State - Light
  console.log("Capturing 1.2: Idle State (Light)...");
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
    localStorage.setItem("sitedoctor-theme", "light");
  });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(artifactDir, "screenshot_idle_light.png"),
    fullPage: false
  });

  // Switch back to Dark Theme
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("sitedoctor-theme", "dark");
  });
  await page.waitForTimeout(300);

  // 2. Trigger Real Scan on fsf.org to populate rich findings & priority buckets
  console.log("Triggering real scan on https://fsf.org...");
  const inputUrl = page.locator(".scan-box input");
  await inputUrl.fill("https://fsf.org");

  // Click .scan-btn
  const scanBtn = page.locator(".scan-btn");
  await scanBtn.click();

  // 2.1 Mid-scan Live Stream - Dark
  console.log("Capturing 2.1: Mid-scan Live Stream (Dark)...");
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(artifactDir, "screenshot_midscan_dark.png"),
    fullPage: false
  });

  // 2.2 Mid-scan Live Stream - Light
  console.log("Capturing 2.2: Mid-scan Live Stream (Light)...");
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
    localStorage.setItem("sitedoctor-theme", "light");
  });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(artifactDir, "screenshot_midscan_light.png"),
    fullPage: false
  });

  // Wait for scan to complete (status text says COMPLETE or .animate-spin disappears)
  console.log("Waiting for scan to complete...");
  try {
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes("COMPLETE") || text.includes("Diagnostic Findings");
    }, { timeout: 60000 });
  } catch {
    console.log("Waiting timeout reached, continuing to capture completed state...");
  }
  await page.waitForTimeout(3000);

  // 3.1 Completed Scan with Priority Grouping - Light
  console.log("Capturing 3.1: Completed Scan with Priority Grouping (Light)...");
  await page.screenshot({
    path: path.join(artifactDir, "screenshot_completed_light.png"),
    fullPage: true
  });

  // 3.2 Completed Scan with Priority Grouping - Dark
  console.log("Capturing 3.2: Completed Scan with Priority Grouping (Dark)...");
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("sitedoctor-theme", "dark");
  });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(artifactDir, "screenshot_completed_dark.png"),
    fullPage: true
  });

  await contextDesktop.close();

  // 4. Mobile Viewport (375x812)
  console.log("Opening 375px Mobile Viewport...");
  const contextMobile = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true
  });
  const pageMobile = await contextMobile.newPage();
  await pageMobile.goto("http://localhost:5173", { waitUntil: "networkidle" });
  await pageMobile.waitForTimeout(1000);

  // 4.1 Mobile 375px - Dark
  console.log("Capturing 4.1: Mobile 375px (Dark)...");
  await pageMobile.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("sitedoctor-theme", "dark");
  });
  await pageMobile.waitForTimeout(500);
  await pageMobile.screenshot({
    path: path.join(artifactDir, "screenshot_mobile_375_dark.png"),
    fullPage: true
  });

  // 4.2 Mobile 375px - Light
  console.log("Capturing 4.2: Mobile 375px (Light)...");
  await pageMobile.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
    localStorage.setItem("sitedoctor-theme", "light");
  });
  await pageMobile.waitForTimeout(500);
  await pageMobile.screenshot({
    path: path.join(artifactDir, "screenshot_mobile_375_light.png"),
    fullPage: true
  });

  await contextMobile.close();
  await browser.close();
  console.log("All UI verification screenshots successfully captured in artifact directory!");
}

capture().catch(console.error);
