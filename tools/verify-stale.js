// Simule un navigateur avec un i18n.js ANCIEN en cache : la page doit rester lisible (jamais de cle brute)
const { launch } = require('./browser');
const fs = require('fs');
const path = require('path');

(async () => {
  const fresh = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'i18n.js'), 'utf8');
  // version ancienne : on supprime toutes les cles lp.* (comme avant la mise a jour)
  const stale = fresh.replace(/^\s*"lp\.[^"]+":.*$/gm, '');
  const browser = await launch({ defaultViewport: { width: 910, height: 730 } });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    if (r.url().includes('/js/i18n.js') && !r.url().includes('fresh=1')) return r.respond({ status: 200, contentType: 'text/javascript; charset=utf-8', body: stale });
    r.continue();
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 100)));
  await page.goto('http://localhost:8787/', { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 1200));
  const rep = await page.evaluate(() => {
    const re = /\b(?:lp|land|set|nav|model|paid|batch|msg|effort|img|vid|qual|tab|mode)\.[a-zA-Z0-9_.]{2,}/;
    const nodes = [...document.querySelectorAll('#landing *')].filter((e) => e.children.length === 0);
    const raw = [...new Set(nodes.filter((e) => re.test(e.textContent || '')).map((e) => (e.textContent || '').trim().slice(0, 40)))];
    return {
      raw,
      cta: document.querySelector('.btn-hero .txt b')?.textContent?.trim(),
      h1: document.querySelector('#lp-hero h1')?.textContent?.trim().slice(0, 50),
      navBtn: document.querySelector('#lp-nav .lp-nav-cta')?.textContent?.trim(),
      errbar: document.getElementById('errbar')?.classList.contains('on'),
      errbarText: document.getElementById('errbar-msg')?.textContent?.slice(0, 60),
    };
  });
  console.log('--- Avec un ancien i18n.js en cache ---');
  console.log('cles brutes a l\'ecran :', rep.raw.length ? '❌ ' + rep.raw.join(' | ') : '✅ aucune');
  console.log('titre            :', rep.h1 || '❌ vide');
  console.log('bouton principal :', rep.cta || '❌ vide');
  console.log('bouton barre     :', rep.navBtn || '❌ vide');
  console.log('bandeau d\'alerte :', rep.errbar ? '✅ affiche — ' + rep.errbarText : '⚠️ absent (la page reste utilisable)');
  if (errs.length) console.log('erreurs JS :', errs.join(' | '));
  await page.screenshot({ path: '/tmp/preview-stale.png' });
  // la page fraiche, taille reelle de l'apercu
  await page.close();
  const p2 = await browser.newPage();
  await p2.setViewport({ width: 910, height: 730 });
  await p2.goto('http://localhost:8787/', { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 900));
  await p2.screenshot({ path: '/tmp/preview-910x730.png' });
  await p2.screenshot({ path: '/tmp/preview-910x730-full.png', fullPage: true });
  const ok = await p2.evaluate(() => ({
    cta: document.querySelector('.btn-hero .txt b')?.textContent?.trim(),
    sub: document.querySelector('.btn-hero .txt small')?.textContent?.trim(),
    nav: [...document.querySelectorAll('.lp-links a')].map((a) => a.textContent.trim()),
    sel: document.querySelector('#lang-select-landing option')?.textContent,
  }));
  console.log('\n--- Version fraiche (taille de l\'apercu 910x730) ---');
  console.log(JSON.stringify(ok, null, 1));
  await browser.close();
  process.exit(rep.raw.length ? 1 : 0);
})().catch((e) => { console.error('ERREUR:', e.message.split('\n')[0]); process.exit(1); });
