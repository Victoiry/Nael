const { launch } = require('./browser');
(async () => {
  const browser = await launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:8787/', { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.setItem('jarvis.key', JSON.stringify('sk-or-v1-x')); localStorage.setItem('jarvis.choseMode','true'); });
  await page.reload({ waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 600));
  await page.evaluate(() => window.App.enterApp());
  await new Promise((r) => setTimeout(r, 1400));
  const d = await page.evaluate(() => {
    const R = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return `${Math.round(r.y)}..${Math.round(r.bottom)} (h=${Math.round(r.height)})`; };
    const top = document.getElementById('chat-header'), tabs = document.getElementById('main-tabs');
    return {
      cls: top.className, vh: innerHeight,
      topbar: R('#chat-header'), grid: R('#main-grid'), maincol: R('#main-col'), chatScroll: R('#chat-scroll'), composer: R('#composer'),
      tabsClient: tabs.clientWidth, tabsScroll: tabs.scrollWidth, topClient: top.clientWidth, topScroll: top.scrollWidth,
      wsH: getComputedStyle(document.getElementById('workspace')).height,
      cols: getComputedStyle(document.getElementById('main-grid')).gridTemplateColumns,
      widths: ['#main-grid','#sidebar','#main-col','#panel','#composer','.wrap','#chat-scroll'].map((sel) => {
        const e = document.querySelector(sel); if (!e) return sel + '=absent';
        const r = e.getBoundingClientRect(); return sel + '=' + Math.round(r.x) + '..' + Math.round(r.right) + ' w' + Math.round(r.width);
      }),
      panelwVar: getComputedStyle(document.documentElement).getPropertyValue('--panelw'),
      measure: (() => {
        const top = document.getElementById('chat-header'), tabs = document.getElementById('main-tabs');
        const cls = top.className;
        const val = { cls, topClient: top.clientWidth, topScroll: top.scrollWidth, tabsClient: tabs.clientWidth, tabsScroll: tabs.scrollWidth };
        top.classList.remove('compact', 'tight');
        val.afterRemove = { topClient: top.clientWidth, topScroll: top.scrollWidth, tabsClient: tabs.clientWidth, tabsScroll: tabs.scrollWidth,
          kids: [...top.children].reduce((n, e) => n + e.getBoundingClientRect().width, 0) };
        top.className = cls;
        return val;
      })(),
      gridRows: getComputedStyle(document.getElementById('main-grid')).gridTemplateRows,
      mainGridRows: getComputedStyle(document.getElementById('main-grid')).gridTemplateRows,
      composerKids: [...document.getElementById('composer').querySelectorAll('*')].slice(0, 24).map((e) => {
        const r = e.getBoundingClientRect();
        return `${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]} ${Math.round(r.width)}x${Math.round(r.height)}`;
      }),
    };
  });
  console.log(JSON.stringify(d, null, 1));
  // test : recalcul manuel
  await page.evaluate(() => window.App.fitTabsForTest && window.App.fitTabsForTest());
  await browser.close();
})().catch((e) => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
