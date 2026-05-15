import { chromium } from "playwright";

const demos = [
  {
    name: "demo-dashboard",
    header: "لوحة التحكم — العائلة",
    accent: "#4E2490",
    panels: [
      { label: "خطة الأم", swatch: "#D9B0FC", meta: "1,650 سعرة · عربي" },
      { label: "خطة الأب", swatch: "#F2BB16", meta: "2,200 kcal · English" },
      { label: "خطة الأولاد", swatch: "#C5458F", meta: "1,400 سعرة · عربي" },
      { label: "خطة الخادمة", swatch: "#1A1023", meta: "1,800 kcal · Tagalog" },
    ],
  },
  {
    name: "demo-day",
    header: "خطة اليوم — الجمعة",
    accent: "#C5458F",
    panels: [
      { label: "الفطور", swatch: "#F2BB16", meta: "07:30 · 420 سعرة" },
      { label: "السناك", swatch: "#D9B0FC", meta: "10:30 · 180 سعرة" },
      { label: "الغداء", swatch: "#4E2490", meta: "13:30 · 680 سعرة" },
      { label: "العشاء", swatch: "#C5458F", meta: "19:30 · 520 سعرة" },
    ],
  },
  {
    name: "demo-chat",
    header: "المحادثة الذكية بالعربي",
    accent: "#4E2490",
    panels: [
      { label: "أنتِ", swatch: "#EBEFF2", meta: "ممكن بدائل للأرز؟" },
      { label: "فيت لايف", swatch: "#D9B0FC", meta: "أكيد، جربي الكينوا أو البرغل" },
      { label: "أنتِ", swatch: "#EBEFF2", meta: "كم سعرة في الكينوا؟" },
      { label: "فيت لايف", swatch: "#D9B0FC", meta: "نصف كوب = 110 سعرة" },
    ],
  },
];

function html({ header, accent, panels }) {
  const rows = panels
    .map(
      (p) => `
    <div class="row">
      <div class="swatch" style="background:${p.swatch}"></div>
      <div class="text">
        <div class="label">${p.label}</div>
        <div class="meta">${p.meta}</div>
        <div class="bar"></div>
        <div class="bar short"></div>
      </div>
    </div>`,
    )
    .join("");
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><style>
  html,body{margin:0;padding:0;height:100%;background:#EBEFF2;font-family:system-ui,-apple-system,"Segoe UI","Tajawal",sans-serif;color:#1A1023}
  .frame{width:1280px;height:800px;padding:32px 48px;box-sizing:border-box;display:flex;flex-direction:column;gap:18px}
  .topbar{display:flex;align-items:center;justify-content:space-between}
  .title{font-size:24px;font-weight:800;color:${accent}}
  .pill{font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(26,16,35,0.55)}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;flex:1}
  .row{display:flex;align-items:center;gap:18px;background:#F8F9FB;padding:24px;border-radius:14px;border:1px solid rgba(26,16,35,0.06)}
  .swatch{width:64px;height:64px;border-radius:12px;flex-shrink:0}
  .text{flex:1;display:flex;flex-direction:column;gap:6px}
  .label{font-size:15px;font-weight:700}
  .meta{font-size:12px;opacity:0.6}
  .bar{height:5px;background:rgba(26,16,35,0.08);border-radius:3px;margin-top:6px}
  .bar.short{width:55%}
  .footer{font-size:10px;opacity:0.4;text-align:center;letter-spacing:0.06em}
  </style></head><body>
  <div class="frame">
    <div class="topbar">
      <div class="title">${header}</div>
      <div class="pill">PLACEHOLDER · 1280×800</div>
    </div>
    <div class="grid">${rows}</div>
    <div class="footer">replace before launch</div>
  </div></body></html>`;
}

const browser = await chromium.launch();
for (const d of demos) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.setContent(html(d), { waitUntil: "load" });
  await page.screenshot({ path: `public/${d.name}.png`, fullPage: false });
  await page.close();
  console.log(`✓ public/${d.name}.png`);
}
await browser.close();
