// Vérifie le cadrage de l'accueil à toutes les tailles + captures
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const SIZES = [[1280, 800], [1280, 420], [1440, 900], [1024, 600], [820, 1180], [768, 500], [430, 932], [390, 760], [360, 480]];
const inter = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
(async () => {
  const browser = await puppeteer.launch({ args: [...chromium.args, '--no-sandbox', '--disable-gpu', '--single-process', '--no-zygote', '--disable-dev-shm-usage'],
    executablePath: await chromium.executablePath(), headless: true });
  let fails = 0;
  for (const [w, h] of SIZES) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
    await page.goto('http://localhost:8787/', { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 900));
    const rep = await page.evaluate(() => {
      const box = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), t: (e.textContent || '').trim().slice(0, 30) }; };
      return { vw: innerWidth, vh: innerHeight, scroll: document.documentElement.scrollHeight,
        start: box('#btn-start'), ctaBar: box('#cta-bar'), footer: box('footer.credit'),
        h1: box('#landing h1'), sub: box('#landing .sub'), feats: box('#landing .feats'), brand: box('#landing .brand'), orb: box('#landing .orb') };
    });
    const p = [];
    if (!rep.start) p.push('PAS DE BOUTON COMMENCER');
    else {
      if (rep.start.y < 0 || rep.start.y + rep.start.h > rep.vh) p.push('bouton hors écran');
      if (rep.start.w < 60 || rep.start.h < 20) p.push('bouton trop petit ' + rep.start.w + 'x' + rep.start.h);
    }
    const boxes = [['h1', rep.h1], ['sub', rep.sub], ['feats', rep.feats], ['brand', rep.brand], ['orb', rep.orb], ['cta', rep.ctaBar]];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const [na, a] = boxes[i], [nb, b] = boxes[j];
      if (a && b && inter(a, b)) p.push('chevauchement ' + na + '/' + nb);
    }
    if (rep.h1 && rep.h1.y < 0) p.push('titre coupé en haut');
    if (rep.footer && rep.ctaBar && inter(rep.footer, rep.ctaBar)) p.push('pied de page sur le bouton');
    if (rep.scroll > rep.vh + 4) p.push('debordement vertical ' + rep.scroll + '>' + rep.vh);
    if (errs.length) p.push('erreur JS: ' + errs[0]);
    console.log(`${w}x${h} → ${p.length ? '❌ ' + p.join(' | ') : '✅ OK'}`);
    if (p.length) fails++;
    await page.screenshot({ path: `/tmp/layout-${w}x${h}.png` });
    await page.close();
  }
  console.log(fails ? `\n${fails} taille(s) en echec` : '\nToutes les tailles sont bonnes');
  await browser.close();
})().catch((e) => { console.error('ERREUR:', e.message.split('\n')[0]); process.exit(1); });
