const { launch } = require('./browser');
(async () => {
  const browser = await launch({ defaultViewport: { width: 910, height: 730 } });
  const page = await browser.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push('PAGE-ERR: ' + e.message.slice(0, 160)));
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text().slice(0, 160)); });
  await page.goto('http://localhost:8787/', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 900));
  console.log('1) accueil affiche ?', await page.evaluate(() => !!document.querySelector('.btn-hero')));
  await page.click('.btn-hero');
  await new Promise((r) => setTimeout(r, 600));
  console.log('2) modale onboarding ?', await page.evaluate(() => document.querySelector('.overlay h2')?.textContent || 'aucune'));
  // bouton "Continuer sans compte"
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.overlay button')].find((x) => /sans compte|without account|sin cuenta|senza account/i.test(x.textContent));
    if (b) { b.click(); return b.textContent.trim(); } return null;
  });
  console.log('3) bouton invite clique :', clicked);
  await new Promise((r) => setTimeout(r, 2500));
  const st = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const R = (s) => { const e = q(s); if (!e) return 'absent'; const r = e.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); };
    return {
      workspaceVisible: !q('#workspace').classList.contains('hidden'),
      chatScroll: R('#chat-scroll'), composer: R('#composer'), sendBtn: !!q('#send-btn'), input: !!q('#input'),
      chatScrollContent: (q('#chat-scroll')?.textContent || '').trim().slice(0, 80),
      chatScrollHtmlLen: (q('#chat-scroll')?.innerHTML || '').length,
      welcome: !!q('#chat-scroll .welcome'),
      headerIcons: document.querySelectorAll('#chat-header .ibtn, #chat-header .model-btn').length,
      composerIcons: document.querySelectorAll('#composer .ibtn').length,
      landingTextInApp: /tout le monde souhaiterait|100 % gratuit|Créateur/i.test(q('#workspace')?.textContent || ''),
      emoji: /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u.test(q('#workspace')?.textContent || ''),
      applyError: q('#errbar')?.classList.contains('on') ? q('#errbar-msg').textContent : null,
      modelsLoaded: window.Chat?.MODELS?.loaded, modelCount: window.Chat?.MODELS?.list?.length,
      tab: window.J?.S?.tab,
    };
  });
  console.log('4) etat :', JSON.stringify(st, null, 1));
  console.log('5) logs :', logs.length ? logs.join('\n   ') : 'aucun');
  const empties = [];
  if (!st.workspaceVisible) empties.push('workspace masqué');
  if (!st.welcome || st.chatScrollHtmlLen < 40) empties.push('zone de chat vide');
  if (!st.composerIcons) empties.push('composeur vide');
  console.log(empties.length ? '❌ ' + empties.join(' | ') : '✅ l\'application s\'affiche avec du contenu');
  await page.screenshot({ path: '/tmp/repro-empty.png' });
  await browser.close();
})().catch((e) => { console.error('ERREUR:', e.message.split('\n')[0]); process.exit(1); });
