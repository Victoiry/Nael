// smoke test front : charge index.html dans jsdom, exécute boot + parcours principaux
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..', 'public');
const PORT = 8791;
const log = [];
const vc = new VirtualConsole();
const seen = new Set();
function note(s) { const k = String(s).slice(0, 90); if (!seen.has(k)) { seen.add(k); log.push(String(s).split('\n').slice(0, 3).join(' | ')); } }
vc.on('jsdomError', (e) => note('JSDOM-ERROR: ' + (e.message || String(e))));
vc.on('error', (...a) => note('ERROR: ' + a.join(' ')));

// mini serveur statique pour que jsdom charge /js/*.js
const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const f = path.join(ROOT, p === '/' ? 'index.html' : p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('x'); }
  res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' });
  res.end(fs.readFileSync(f));
});

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const dom = await JSDOM.fromURL(`http://localhost:${PORT}/index.html`, {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
  });
  const w = dom.window;
  // stubs
  w.fetch = async (url, opts = {}) => {
    const body = opts.body ? JSON.parse(opts.body) : {};
    const fake = (obj) => ({ ok: true, status: 200, text: async () => JSON.stringify(obj), json: async () => obj });
    if (String(url).includes('/api/models')) return fake({ models: [
      { id: 'paid/x', name: 'Paid X', free: false, vision: true, context: 8000, pricePrompt: 1 },
      { id: 'free/y:free', name: 'Free Y', free: true, vision: false, context: 8000, pricePrompt: 0 },
    ] });
    if (String(url).includes('/api/test-key')) return fake({ ok: true, status: 200, latency: 42, model: body.model, detail: 'pong' });
    if (String(url).includes('/api/bridge/status')) return fake({ online: false, sessions: [], events: [], pending: [] });
    if (String(url).includes('/api/bridge/approvals')) return fake({ pending: [] });
    if (String(url).includes('/api/bridge/allowlist')) return fake({ families: [] });
    if (String(url).includes('/api/bridge/paircode')) return fake({ code: '123456' });
    if (String(url).includes('/api/auth/me')) return fake({ user: null });
    if (String(url).includes('/api/chat')) return fake({});
    return fake({ ok: true });
  };
  await new Promise((r) => setTimeout(r, 900));
  const err = [];
  try {
    w.App.start();                       // ouvre l'onboarding
    await new Promise((r) => setTimeout(r, 100));
    const modalTitle = w.document.querySelector('.overlay h2')?.textContent;
    console.log('onboarding modal:', modalTitle);
    w.App.openModelTest('sk-or-v1-test', null);  // pop-up des modèles
    await new Promise((r) => setTimeout(r, 400));
    console.log('modals ouverts:', w.document.querySelectorAll('.overlay').length);
    console.log('liste modèles:', w.document.querySelectorAll('.model-row').length);
    console.log('avertissement rouge:', !!w.document.querySelector('.bold-red'));
    const moreBtn = [...w.document.querySelectorAll('.overlay button')].find((b) => /infos|info/i.test(b.textContent));
    moreBtn?.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 120));
    console.log('docs link:', !!w.document.querySelector('a[href*="openrouter.ai/docs"]'));
    console.log('pricing link:', !!w.document.querySelector('a[href*="openrouter.ai/models"]'));
    w.document.querySelector('.overlay:last-of-type')?.remove();
    // choisir le modèle payant -> popup payant
    const rows = [...w.document.querySelectorAll('.model-row')];
    const paidRow = rows.find((r) => r.textContent.includes('Paid X'));
    paidRow?.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    const paidModal = [...w.document.querySelectorAll('.overlay h2')].map((h) => h.textContent);
    console.log('popup payant:', paidModal.some((x) => /PAYANT|PAID/.test(x || '')));
    // entrer dans l'app
    w.J.S.key = 'sk-or-v1-test'; w.J.S.settings.ai.model = 'paid/x';
    w.document.querySelectorAll('.overlay').forEach((o) => o.remove());
    w.App.enterApp();
    await new Promise((r) => setTimeout(r, 500));
    console.log('workspace visible:', !w.document.getElementById('workspace').classList.contains('hidden'));
    console.log('composer construit:', !!w.document.getElementById('send-btn'), !!w.document.getElementById('input'));
    console.log('boutons bas:', [...w.document.querySelectorAll('.quickbar .btn')].length);
    console.log('langue (4):', w.document.querySelectorAll('#lang-select option').length);
    // panneaux
    for (const p of ['personalize', 'global', 'ai', 'history', 'memory', 'console', 'bridge']) {
      w.App.showPanel(p);
      await new Promise((r) => setTimeout(r, 60));
      const body = w.document.getElementById('panel-body');
      if (!body.textContent.trim()) err.push('panneau vide: ' + p);
    }
    console.log('panneaux ok');
    // onglets du chat
    for (const tab of ['classic', 'multitask', 'compare', 'code', 'private', 'offline']) {
      w.Chat.setTab(tab);
      await new Promise((r) => setTimeout(r, 120));
      const cells = w.document.querySelectorAll('#mt-wrap .cell').length;
      const scroller = w.document.querySelectorAll('#chat-scroll .bubble').length;
      console.log('onglet', tab, '→ cellules:', cells, 'bulles:', scroller, 'composer caché:', w.document.getElementById('composer').classList.contains('hidden'));
    }
    w.Chat.setTab('classic');
    // ---- envoi d'un message (streaming simulé) ----
    const sse = [
      'event: delta\ndata: {"text":"Bonjour"}\n\n',
      'event: delta\ndata: {"text":" Nael"}\n\n',
      'event: tool\ndata: {"name":"run_command","args":{"command":"ls -la"},"phase":"start"}\n\n',
      'event: reasoning\ndata: {"text":"je réfléchis"}\n\n',
      'event: tool\ndata: {"name":"run_command","phase":"end","result":"total 0"}\n\n',
      'event: done\ndata: {}\n\n',
    ];
    const realFetch = w.fetch;
    w.fetch = async (url, opts) => {
      if (String(url).includes('/api/chat')) {
        let i = 0;
        const enc = new w.TextEncoder();
        return { ok: true, status: 200, text: async () => '', body: { getReader: () => ({ read: () => Promise.resolve(i < sse.length ? { value: enc.encode(sse[i++]), done: false } : { done: true }) }) } };
      }
      return realFetch(url, opts);
    };
    w.Chat.setTab('classic');
    w.document.getElementById('input').value = 'Salut JARVIS';
    w.document.getElementById('send-btn').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
    const txt = w.document.getElementById('chat-scroll').textContent;
    console.log('réponse streamée reçue :', /Bonjour Nael/.test(txt));
    console.log('ligne outil affichée :', /run_command/.test(txt));
    console.log('raisonnement affiché :', /je réfléchis/.test(txt));
    console.log('conversation enregistrée :', w.J.S.conv.length);

    // ---- modale d'approbation de commande ----
    w.App.showApproval({ id: 'x1', command: 'nano notes.txt', risk: 'medium', family: 'nano', cwd: '/home' });
    await new Promise((r) => setTimeout(r, 80));
    console.log('modale approbation :', [...w.document.querySelectorAll('.overlay h2')].some((h) => /Commande|Command/.test(h.textContent)));
    console.log('boutons refuser/toujours/accepter :', [...w.document.querySelectorAll('.overlay .btn')].map((b) => b.textContent.trim()).slice(-3).join(' | '));
    w.document.querySelectorAll('.overlay').forEach((o) => o.remove());

    // studios
    w.Media.open('image');
    await new Promise((r) => setTimeout(r, 100));
    console.log('studio image champs:', w.document.querySelectorAll('#studio input, #studio select, #studio textarea').length);
    w.Media.open('video');
    await new Promise((r) => setTimeout(r, 100));
    console.log('studio vidéo sliders:', w.document.querySelectorAll('#studio input[type=range]').length);
    // i18n : 4 langues
    for (const l of ['fr', 'en', 'es', 'it']) {
      w.J.setLang(l);
      const missing = [...w.document.querySelectorAll('[data-i18n]')].filter((e) => e.textContent === e.dataset.i18n).map((e) => e.dataset.i18n);
      if (missing.length) err.push(l + ' clés manquantes: ' + missing.slice(0, 6).join(','));
    }
    console.log('i18n testé');
  } catch (e) { err.push('EXCEPTION: ' + (e.stack || e.message)); }
  if (err.length) console.log('\n❌ PROBLEMES:\n' + err.join('\n'));
  else console.log('\n✅ aucune erreur détectée');
  if (log.length) console.log('\nJournal:\n' + log.slice(0, 20).join('\n'));
  dom.window.close(); server.close(); process.exit(0);
})();
