import { chromium } from "playwright";

const steps = [
  {
    file: "step-1.png",
    bg: "#D9B0FC",
    fg: "#1A1023",
    label: "Step 01",
    headline: "تخصيص العائلة",
    sub: "أدخلي أفراد عائلتك ولغاتهم",
    swatch: "#4E2490",
  },
  {
    file: "step-2.png",
    bg: "#F2BB16",
    fg: "#1A1023",
    label: "Step 02",
    headline: "خطة كل فرد",
    sub: "وجبات مخصصة بالذكاء الاصطناعي",
    swatch: "#1A1023",
  },
  {
    file: "step-3.png",
    bg: "#C5458F",
    fg: "#FFFFFF",
    label: "Step 03",
    headline: "تطبيق يومي",
    sub: "وصفات ومقادير بلغة كل فرد",
    swatch: "#FFFFFF",
  },
];

const browser = await chromium.launch();

for (const s of steps) {
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"/>
<style>
  html, body { margin: 0; padding: 0; height: 100%; }
  body { background: ${s.bg}; font-family: system-ui, -apple-system, "Segoe UI", "Tajawal", sans-serif; color: ${s.fg}; }
  .page { width: 640px; height: 800px; padding: 48px; box-sizing: border-box; display: flex; flex-direction: column; gap: 18px; }
  .label { font-size: 14px; letter-spacing: 0.22em; text-transform: uppercase; font-weight: 800; opacity: 0.85; }
  .headline { font-size: 56px; font-weight: 800; line-height: 1.05; max-width: 12ch; margin-top: 12px; }
  .sub { font-size: 17px; opacity: 0.78; max-width: 24ch; line-height: 1.6; margin-top: 6px; }
  .spacer { flex: 1; }
  .panel { background: rgba(255,255,255,0.55); backdrop-filter: blur(2px); border-radius: 14px; padding: 22px; box-shadow: 0 1px 0 rgba(0,0,0,0.04); }
  .panel-row { display: flex; align-items: center; gap: 14px; }
  .swatch { width: 44px; height: 44px; border-radius: 10px; background: ${s.swatch}; flex-shrink: 0; }
  .panel-text { flex: 1; }
  .panel-title { font-size: 13px; font-weight: 700; }
  .panel-meta { font-size: 11px; opacity: 0.6; margin-top: 4px; }
  .panel-line { height: 4px; background: rgba(0,0,0,0.08); border-radius: 2px; margin-top: 8px; width: 100%; }
  .panel-line.short { width: 60%; }
  .footer { font-size: 10px; opacity: 0.5; margin-top: 8px; }
</style></head>
<body>
  <div class="page">
    <div class="label">${s.label}</div>
    <div class="headline">${s.headline}</div>
    <div class="sub">${s.sub}</div>
    <div class="spacer"></div>
    <div class="panel">
      <div class="panel-row">
        <div class="swatch"></div>
        <div class="panel-text">
          <div class="panel-title">${s.headline}</div>
          <div class="panel-meta">Placeholder · ${s.label}</div>
          <div class="panel-line"></div>
          <div class="panel-line short"></div>
        </div>
      </div>
    </div>
    <div class="footer">${s.file} placeholder · 640×800</div>
  </div>
</body></html>`;

  const page = await browser.newPage({ viewport: { width: 640, height: 800 } });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: `public/${s.file}`, fullPage: false });
  await page.close();
  console.log(`✓ public/${s.file}`);
}

await browser.close();
