const { launch } = require('./browser');
(async () => {
  const args = [...chromium.args, '--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'];
  const path = await chromium.executablePath();
  console.log('binaire:', path);
  const browser = await launch({ defaultViewport: { width: Number(process.env.W||1280), height: Number(process.env.H||800) } });
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0,200)); });
  page.on('pageerror', (e) => console.log('PAGE-ERR:', e.message.slice(0, 300)));
  page.on('requestfailed', (r) => console.log('REQ-FAIL:', r.url().slice(0, 90), r.failure()?.errorText));
  await page.goto(process.env.URL || 'http://localhost:8787/', { waitUntil: 'load', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: process.env.OUT || '/tmp/landing.png', fullPage: false });
  // infos de layout
  const info = await page.evaluate(() => {
    const g = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), text: (e.textContent || '').trim().slice(0, 40) }; };
    return { vh: innerHeight, vw: innerWidth, scrollH: document.documentElement.scrollHeight,
      h1: g('#landing h1'), cta: g('.cta'), start: g('#btn-start'), footer: g('footer.credit'), brand: g('#landing .brand'), legal: g('[data-i18n="land.legal"]') };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})().catch((e) => { console.error('ERREUR:', e.message); process.exit(1); });
