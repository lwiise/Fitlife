import { chromium } from "playwright";

const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"/>
<style>
  html, body { margin: 0; padding: 0; height: 100%; }
  body { background: #EBEFF2; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1A1023; }
  .page { width: 640px; height: 800px; padding: 28px; box-sizing: border-box; display: flex; flex-direction: column; gap: 16px; }
  .header { background: #4E2490; color: white; padding: 18px 22px; border-radius: 12px; font-size: 15px; font-weight: 700; letter-spacing: 0.01em; }
  .row { display: flex; gap: 16px; align-items: center; background: #F8F9FB; padding: 18px; border-radius: 12px; border: 1px solid rgba(26,16,35,0.08); }
  .swatch { width: 64px; height: 64px; border-radius: 10px; flex-shrink: 0; }
  .purple .swatch { background: #D9B0FC; }
  .yellow .swatch { background: #F2BB16; }
  .pink .swatch { background: #C5458F; }
  .text-block { flex: 1; display: flex; flex-direction: column; gap: 6px; }
  .title { font-weight: 700; font-size: 13px; }
  .meta { font-size: 11px; opacity: 0.6; }
  .line { height: 4px; background: rgba(26,16,35,0.08); border-radius: 2px; }
  .line.short { width: 60%; }
  .footer { font-size: 9px; opacity: 0.4; margin-top: auto; }
</style></head>
<body>
  <div class="page">
    <div class="header">Fit Life - Family Dashboard</div>
    <div class="row purple">
      <div class="swatch"></div>
      <div class="text-block">
        <div class="title">Mother Plan</div>
        <div class="meta">Personalized meal plan placeholder</div>
        <div class="line"></div>
      </div>
    </div>
    <div class="row yellow">
      <div class="swatch"></div>
      <div class="text-block">
        <div class="title">Helper Plan</div>
        <div class="meta">Personalized meal plan placeholder</div>
        <div class="line"></div>
      </div>
    </div>
    <div class="row pink">
      <div class="swatch"></div>
      <div class="text-block">
        <div class="title">Kids Plan</div>
        <div class="meta">Personalized meal plan placeholder</div>
        <div class="line short"></div>
      </div>
    </div>
    <div class="footer">hero-dashboard.png placeholder · 640×800</div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 800 } });
await page.setContent(html, { waitUntil: "load" });
await page.screenshot({ path: "public/hero-dashboard.png", fullPage: false });
await browser.close();
console.log("✓ public/hero-dashboard.png");
