import { chromium, devices } from "playwright";
import { mkdir } from "node:fs/promises";

const OUT = ".screenshots";
await mkdir(OUT, { recursive: true });

const viewports = [
  { name: "hero-375x667", width: 375, height: 667, dpr: 2 },
  { name: "hero-375", width: 375, height: 812, dpr: 2 },
  { name: "hero-768", width: 768, height: 1024, dpr: 2 },
  { name: "hero-1024", width: 1024, height: 768, dpr: 1 },
  { name: "hero-1440", width: 1440, height: 900, dpr: 1 },
];

const browser = await chromium.launch();

for (const v of viewports) {
  const ctx = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: v.dpr,
    locale: "ar-SA",
  });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  // Wait for hero entrance stagger (last delay 450ms + 400ms duration + callouts at 1.25s)
  await page.waitForTimeout(2000);
  // Capture viewport-bound (above-fold)
  await page.screenshot({
    path: `${OUT}/${v.name}.png`,
    fullPage: false,
  });
  // Scroll through page to trigger useInView observers in lower sections, then back to top
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2500); // let NumberTicker + star stagger + logo fade complete
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  // Capture full-page after observers have fired
  await page.screenshot({
    path: `${OUT}/${v.name}-full.png`,
    fullPage: true,
  });
  await ctx.close();
  console.log(`✓ ${v.name}.png`);
}

await browser.close();
