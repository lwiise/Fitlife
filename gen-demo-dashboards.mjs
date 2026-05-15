import { chromium } from "playwright";

const dashboards = [
  {
    file: "demo-dashboard-1.png",
    title: "خطة الأم",
    accent: "#4E2490",
    meals: ["إفطار", "غداء", "عشاء"],
    swatchBg: "#D9B0FC",
  },
  {
    file: "demo-dashboard-2.png",
    title: "خطة الخادمة (Tagalog)",
    accent: "#C5458F",
    meals: ["Almusal", "Tanghalian", "Hapunan"],
    swatchBg: "#F2BB16",
  },
  {
    file: "demo-dashboard-3.png",
    title: "التقدم الأسبوعي",
    accent: "#F2BB16",
    meals: ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء"],
    swatchBg: "#C5458F",
  },
];

const browser = await chromium.launch();
for (const d of dashboards) {
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><style>
  html,body{margin:0;padding:0;height:100%;background:#EBEFF2;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1A1023}
  .frame{width:1280px;height:800px;padding:48px 64px;box-sizing:border-box;display:flex;flex-direction:column;gap:32px}
  .header{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid rgba(26,16,35,0.1);padding-bottom:20px}
  .h-title{font-size:28px;font-weight:800;color:${d.accent}}
  .h-meta{font-size:13px;color:rgba(26,16,35,0.55);font-weight:600;letter-spacing:0.06em}
  .grid{display:grid;grid-template-columns:repeat(${Math.min(d.meals.length, 3)},1fr);gap:24px;flex:1}
  .card{background:#F8F9FB;border:1px solid rgba(26,16,35,0.08);border-radius:16px;padding:24px;display:flex;flex-direction:column;gap:14px}
  .card-num{font-size:12px;font-weight:700;letter-spacing:0.15em;color:rgba(26,16,35,0.45);text-transform:uppercase}
  .card-title{font-size:18px;font-weight:700}
  .swatch{height:88px;border-radius:12px;background:${d.swatchBg};margin-top:6px}
  .line{height:6px;background:rgba(26,16,35,0.08);border-radius:3px}
  .line.short{width:55%}
  .line.tiny{width:30%;height:4px}
  .footer{font-size:10px;color:rgba(26,16,35,0.35);text-align:start;letter-spacing:0.08em}
  </style></head><body>
  <div class="frame">
    <div class="header">
      <div class="h-title">${d.title}</div>
      <div class="h-meta">${d.file} · demo dashboard placeholder · 1280×800</div>
    </div>
    <div class="grid">
      ${d.meals.slice(0, 3).map((m, i) => `
        <div class="card">
          <div class="card-num">٠${i + 1} · ${m}</div>
          <div class="swatch"></div>
          <div class="line"></div>
          <div class="line short"></div>
          <div class="line tiny"></div>
        </div>
      `).join("")}
    </div>
    <div class="footer">Fit Life · placeholder build</div>
  </div></body></html>`;

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: `public/${d.file}` });
  await page.close();
  console.log(`✓ public/${d.file}`);
}
await browser.close();
