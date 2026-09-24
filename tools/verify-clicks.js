// Clique PARTOUT dans l'interface (panneaux, menus, boutons, onglets) et vérifie
// qu'aucune erreur JavaScript n'est déclenchée — c'est le test qui attrape les
// « m is not defined » et autres références cassées avant que l'utilisateur ne les voie.
const { launch } = require('./browser');

const PANELS = ['personalize', 'global', 'ai', 'modes', 'history', 'memory', 'console', 'bridge'];

(async () => {
  const browser = await launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 860 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
  // les invites (prompt) sont refusées automatiquement, sinon Chromium bloque la page
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/ERR_CONNECTION_CLOSED|fonts.googleapis|Failed to load resource/i.test(t)) errors.push('console: ' + t.slice(0, 140));
  });

  await page.goto('http://localhost:8787/', { waitUntil: 'load' });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('jarvis.key', 'sk-or-v1-test');
    localStorage.setItem('jarvis.choseMode', 'true');
  });
  await page.reload({ waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 900));
  await page.evaluate(() => window.App.enterApp());
  await new Promise((r) => setTimeout(r, 1500));

  const problems = [];
  const note = (where, list) => {
    list.forEach((e) => problems.push(where + ' → ' + e));
  };

  // --- 1) chaque panneau de réglages : on clique tous les boutons et interrupteurs
  for (const name of PANELS) {
    await page.evaluate((p) => window.App.showPanel(p), name);
    await new Promise((r) => setTimeout(r, 500));
    const count = await page.evaluate(() => document.querySelectorAll('#panel-body button, #panel-body .switch, #panel-body .model-row').length);
    for (let i = 0; i < count; i++) {
      const before = errors.length;
      await page.evaluate(({ name, i }) => {
        const nodes = [...document.querySelectorAll('#panel-body button, #panel-body .switch, #panel-body .model-row')];
        const n = nodes[i];
        if (!n) return;
        n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }, { name, i });
      await new Promise((r) => setTimeout(r, 140));
      // on referme tout ce qui s'est ouvert (modales, invites) pour continuer le parcours
      await page.evaluate(() => {
        document.querySelectorAll('.overlay').forEach((o) => o.remove());
        document.querySelectorAll('.popmenu').forEach((o) => o.remove());
      });
      if (errors.length > before) note('panneau ' + name + ' / bouton ' + i, errors.slice(before));
    }
    console.log('panneau', name, '→', count, 'contrôles cliqués');
  }

  // --- 2) barre du haut + composeur + menu « + »
  await page.evaluate(() => { document.querySelectorAll('.overlay').forEach((o) => o.remove()); window.App.togglePanel(false); });
  const header = await page.evaluate(() => document.querySelectorAll('#chat-header button, #composer .ibtn, #composer button, .side-foot button, #sidebar button, #conv-search').length);
  for (let i = 0; i < header; i++) {
    const before = errors.length;
    await page.evaluate((i) => {
      const nodes = [...document.querySelectorAll('#chat-header button, #composer .ibtn, #composer button, .side-foot button, #sidebar button')];
      const n = nodes[i];
      if (n) n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, i);
    await new Promise((r) => setTimeout(r, 200));
    await page.evaluate(() => { document.querySelectorAll('.overlay').forEach((o) => o.remove()); document.querySelectorAll('.popmenu').forEach((o) => o.remove()); });
    if (errors.length > before) note('en-tête/bouton ' + i, errors.slice(before));
  }
  console.log('en-tête, barre latérale et composeur →', header, 'boutons cliqués');

  // --- 3) chaque entrée du menu « + »
  for (const idx of [0, 1, 2, 3, 4, 5, 6, 8, 10, 12]) {
    const before = errors.length;
    await page.evaluate(async (idx) => {
      const plus = document.querySelector('#composer .tools .ibtn');
      plus.click();
      await new Promise((r) => setTimeout(r, 40));
      const items = [...document.querySelectorAll('.popmenu .model-row')];
      if (items[idx]) items[idx].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, idx);
    await new Promise((r) => setTimeout(r, 500));
    await page.evaluate(() => { document.querySelectorAll('.overlay').forEach((o) => o.remove()); document.querySelectorAll('.popmenu').forEach((o) => o.remove()); });
    if (errors.length > before) note('menu + entrée ' + idx, errors.slice(before));
  }
  console.log('menu « + » → entrées ouvertes');

  // --- 4) tous les onglets de chat
  for (const tab of ['classic', 'multitask', 'compare', 'code', 'private', 'offline', 'image', 'video']) {
    const before = errors.length;
    await page.evaluate((t) => window.Chat.setTab(t), tab);
    await new Promise((r) => setTimeout(r, 600));
    await page.evaluate(() => { document.querySelectorAll('.overlay').forEach((o) => o.remove()); });
    if (errors.length > before) note('onglet ' + tab, errors.slice(before));
  }
  console.log('onglets → classique, multitâche, comparaison, code, privé, hors ligne, image, vidéo');

  // --- 5) sélecteur de modèle, effort, langues
  await page.evaluate(() => { window.Chat.setTab('classic'); document.getElementById('model-btn').click(); });
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => document.querySelectorAll('.popmenu').forEach((o) => o.remove()));
  for (const lang of ['fr', 'en', 'es', 'it']) {
    const before = errors.length;
    await page.evaluate((l) => window.J.setLang(l), lang);
    await new Promise((r) => setTimeout(r, 350));
    if (errors.length > before) note('langue ' + lang, errors.slice(before));
  }
  console.log('sélecteur de modèle + 4 langues');

  // --- 6) erreurs d'API affichées (jeton invalide / réseau simulés)
  await page.evaluate(() => {
    window.J.ORapi.channel = 'none';
    window.Chat.MODELS.list = [];
    window.Chat.MODELS.error = 'reseau_ou_cors';
    window.Chat.MODELS.detail = 'simulation';
    window.Chat.renderMessages();
  });
  await new Promise((r) => setTimeout(r, 400));
  const banner = await page.evaluate(() => (document.getElementById('chat-scroll').textContent || '').includes('OpenRouter'));
  console.log('bandeau d’erreur OpenRouter affiché :', banner ? '✅' : '❌');
  if (!banner) problems.push('bandeau absent');

  if (problems.length) {
    console.log('\n❌ problèmes (' + problems.length + ') :\n' + [...new Set(problems)].slice(0, 12).join('\n'));
  } else {
    console.log('\n✅ aucun clic ne casse l’interface, aucune erreur JS');
  }
  await page.screenshot({ path: '/tmp/clicks.png' });
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error('ERREUR:', e.message.split('\n')[0]); process.exit(1); });
