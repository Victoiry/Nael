// Vérifie que rien ne dépasse de la barre du haut et que le panneau est bien cadré (plusieurs tailles)
const { launch } = require('./browser');
const SIZES = [[1440, 900], [1280, 800], [1180, 720], [1024, 600], [910, 730], [900, 640], [768, 560], [430, 932]];
(async () => {
  const browser = await launch();
  let fails = 0;
  for (const [w, h] of SIZES) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message.slice(0, 100)));
    await page.goto('http://localhost:8787/', { waitUntil: 'load' });
    await page.evaluate(() => {
      localStorage.setItem('jarvis.key', JSON.stringify('sk-or-v1-test'));
      const s = JSON.parse(localStorage.getItem('jarvis.settings') || '{}');
      s.ai = Object.assign({ model: 'free/y:free' }, s.ai || {});
      localStorage.setItem('jarvis.settings', JSON.stringify(s));
      localStorage.setItem('jarvis.choseMode', 'true');
    });
    await page.reload({ waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 700));
    await page.evaluate(() => window.App.enterApp());
    await new Promise((r) => setTimeout(r, 1200));
    const closedPanel = await page.evaluate(() => {
      const p = document.getElementById('panel');
      return { hidden: p.classList.contains('hidden'), w: Math.round(p.getBoundingClientRect().width) };
    });
    await page.evaluate(() => window.App.togglePanel(true, 'global'));
    await new Promise((r) => setTimeout(r, 600));
    const rep = await page.evaluate(() => {
      const top = document.getElementById('chat-header');
      const rect = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), t: (e.textContent || '').trim().slice(0, 22) }; };
      const kids = [...top.children].map(rect);
      const overflow = kids.filter((k) => k.x + k.w > innerWidth + 1 || k.x < -1);
      const grid = getComputedStyle(document.getElementById('main-grid')).gridTemplateColumns;
      const panel = document.getElementById('panel');
      const pr = panel ? rect(panel) : null;
      const composer = rect(document.getElementById('composer'));
      const landing = document.getElementById('landing');
      const sidebar = document.getElementById('sidebar');
      return { vw: innerWidth, vh: innerHeight, kids, overflow, grid, pr, composer, compact: top.className,
        landingHidden: landing.classList.contains('hidden'),
        sidebarW: Math.round(sidebar.getBoundingClientRect().width),
        chatW: Math.round(document.getElementById('chat-scroll').getBoundingClientRect().width),
        scroll: document.documentElement.scrollHeight,
        chatScrollBottom: Math.round(document.getElementById('chat-scroll').getBoundingClientRect().bottom) };
    });
    const p = [];
    if (rep.overflow.length) p.push('déborde: ' + rep.overflow.map((k) => k.t.slice(0, 10) + '@' + (k.x + k.w)).join(','));
    if (rep.pr && rep.pr.x + rep.pr.w > rep.vw + 1) p.push('panneau hors écran (droite=' + (rep.pr.x + rep.pr.w) + ')');
    if (rep.pr && rep.pr.w < 200) p.push('panneau trop étroit ' + rep.pr.w);
    if (!rep.landingHidden) p.push('accueil encore visible dans l\'app');
    if (!closedPanel.hidden || closedPanel.w !== 0) p.push('tiroir de réglages ouvert par défaut');
    if (rep.sidebarW < 180 && rep.vw > 900) p.push('barre latérale trop étroite ' + rep.sidebarW);
    if (rep.chatW < rep.vw * 0.5 && rep.vw > 900) p.push('zone de chat trop étroite ' + rep.chatW);
    if (rep.vw <= 860 && rep.chatW < rep.vw - 8) p.push('zone de chat trop étroite (mobile) ' + rep.chatW);
    if (rep.scroll > rep.vh + 4) p.push('page défile ' + rep.scroll + '/' + rep.vh);
    if (rep.composer.y + rep.composer.h > rep.vh + 1) p.push('barre de saisie coupée');
    if (rep.chatScrollBottom > rep.composer.y + 1) p.push('chat passe sous la barre de saisie');
    if (errs.length) p.push('erreur JS: ' + errs[0]);
    console.log(`${w}x${h} → ${p.length ? '❌ ' + p.join(' | ') : '✅ OK'}  [${rep.compact}]`);
    if (p.length) fails++;
    await page.screenshot({ path: `/tmp/app-${w}x${h}.png` });
    await page.close();
  }
  console.log(fails ? `\n${fails} taille(s) en échec` : '\nToutes les tailles sont bonnes');
  await browser.close();
})().catch((e) => { console.error('ERREUR:', e.message.split('\n')[0]); process.exit(1); });
