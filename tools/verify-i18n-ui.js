// Verifie qu'aucune cle de traduction brute n'apparait a l'ecran (4 langues, accueil + app)
const { launch } = require('./browser');
(async () => {
  const browser = await launch({ defaultViewport: { width: 1280, height: 800 } });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
  await page.goto('http://localhost:8787/', { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 900));
  let fails = 0;
  for (const lang of ['fr', 'en', 'es', 'it']) {
    await page.evaluate((l) => window.J.setLang(l), lang);
    await new Promise((r) => setTimeout(r, 250));
    const rep = await page.evaluate(() => {
      const re = /\b(?:lp|land|nav|auth|onb|model|paid|batch|msg|mode|rag|file|skill|effort|img|vid|qual|tab|mt|cmp|code|priv|off|set|approval|memory|hist|console|bridge|toast|common)\.[a-zA-Z0-9_.]{2,}/;
      const all = [...document.querySelectorAll('#landing *, #lp-nav *, .btn-hero *')];
      const bad = all.filter((e) => e.children.length === 0 && re.test(e.textContent || '')).map((e) => (e.textContent || '').trim().slice(0, 40));
      const empty = all.filter((e) => e.children.length === 0 && !(e.textContent || '').trim() && e.tagName !== 'BR').length;
      return { bad: [...new Set(bad)], empty, lang: document.documentElement.lang, cta: document.querySelector('.btn-hero .txt b')?.textContent };
    });
    const p = [];
    if (rep.bad.length) p.push('cles brutes: ' + rep.bad.join(' | '));
    if (rep.lang !== lang) p.push('langue html=' + rep.lang);
    if (!rep.cta || !rep.cta.trim()) p.push('bouton sans texte');
    console.log(`${lang} → ${p.length ? '❌ ' + p.join(' | ') : '✅ OK'}  (bouton = "${rep.cta}")`);
    if (p.length) fails++;
  }
  // dans l'app
  await page.evaluate(() => {
    localStorage.setItem('jarvis.key', JSON.stringify('sk-or-v1-x'));
    localStorage.setItem('jarvis.choseMode', 'true');
  });
  await page.reload({ waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 700));
  await page.evaluate(() => window.App.enterApp());
  await new Promise((r) => setTimeout(r, 1500));
  for (const lang of ['fr', 'en', 'es', 'it']) {
    await page.evaluate((l) => window.J.setLang(l), lang);
    await new Promise((r) => setTimeout(r, 300));
    const bad = await page.evaluate(() => {
      const re = /\b(?:set|nav|tab|mode|rag|effort|img|vid|qual|console|bridge|memory|hist|approval)\.[a-zA-Z0-9_.]{2,}/;
      return [...new Set([...document.querySelectorAll('#workspace *')].filter((e) => e.children.length === 0 && re.test(e.textContent || '')).map((e) => (e.textContent || '').trim().slice(0, 40)))];
    });
    console.log(`app/${lang} → ${bad.length ? '❌ ' + bad.join(' | ') : '✅ OK'}`);
    if (bad.length) fails++;
  }
  if (errs.length) { console.log('erreurs JS: ' + errs.join(' | ')); fails++; }
  console.log(fails ? `\n${fails} probleme(s)` : '\nAucune cle brute, aucune erreur');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERREUR:', e.message.split('\n')[0]); process.exit(1); });
