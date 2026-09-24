const { launch } = require('./browser');
(async () => {
  const browser = await launch({ defaultViewport: { width: Number(process.env.W || 1280), height: Number(process.env.H || 800) } });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGE-ERR:', e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 160)); });
  await page.goto('http://localhost:8787/', { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 800));
  // 1. clic sur Commencer
  await page.click('.btn-hero');
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: '/tmp/step1-onboarding.png' });
  console.log('modal ouverte:', await page.evaluate(() => !!document.querySelector('.overlay')));
  // 2. simuler une clé déjà enregistrée puis entrer
  await page.evaluate(() => {
    localStorage.setItem('jarvis.key', JSON.stringify('sk-or-v1-test'));
    localStorage.setItem('jarvis.model', JSON.stringify('free/y:free'));
    const s = JSON.parse(localStorage.getItem('jarvis.settings') || '{}');
    s.ai = Object.assign({ model: 'free/y:free' }, s.ai || {});
    localStorage.setItem('jarvis.settings', JSON.stringify(s));
  });
  await page.goto('http://localhost:8787/', { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 600));
  await page.evaluate(() => window.App.enterApp());
  await new Promise((r) => setTimeout(r, 1200));
  await page.evaluate(() => { const rows = document.querySelectorAll('.overlay .model-row'); if (rows[0]) rows[0].click(); });
  await new Promise((r) => setTimeout(r, 500));

  await page.screenshot({ path: '/tmp/step2-workspace.png' });
  const info = await page.evaluate(() => ({
    grid: getComputedStyle(document.getElementById('main-grid')).gridTemplateColumns,
    panelOpen: document.getElementById('main-grid').className,
    composer: !!document.getElementById('send-btn'),
    tabs: [...document.querySelectorAll('#main-tabs .tab')].map((b) => b.textContent),
    overflow: document.documentElement.scrollHeight + '/' + innerHeight,
    chatTabs: [...document.querySelectorAll('#chat-tabs .tab')].map((b) => b.textContent),
    headerIcons: document.querySelectorAll('#chat-header .ibtn, #chat-header .model-btn').length,
    composerIcons: document.querySelectorAll('#composer .ibtn').length,
  }));
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})().catch((e) => { console.error('ERREUR:', e.message.split('\n')[0]); process.exit(1); });
