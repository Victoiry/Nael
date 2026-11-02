// Vérifie le canal « relay » : l'appel OpenRouter part du PONT LOCAL (l'ordinateur
// de l'utilisateur) — indispensable quand l'hébergeur bloque openrouter.ai.
//   1) protocole : /api/or-relay sans pont -> bridge_offline ; avec pont -> réponse de l'API
//   2) navigateur : serveur ET accès direct hors service -> JARVIS bascule sur le pont
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const { launch } = require('./browser');

const ROOT = path.join(__dirname, '..');
const MOCK = 8899, APP = 8790;
const MODELS = { data: [
  { id: 'mock/free-vision', name: 'Free Vision', context_length: 65536, pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text', 'image'] } },
  { id: 'mock/paid-big', name: 'Paid Big', context_length: 200000, pricing: { prompt: '0.000003', completion: '0.000015' }, architecture: { input_modalities: ['text'] } },
] };
let hits = { relayed: 0 };
const ok = [], ko = [];
const check = (name, cond, extra) => { (cond ? ok : ko).push(name + (cond ? '' : ' → ' + (extra || 'échec'))); };

function startMock() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let body = ''; req.on('data', (c) => { body += c; });
      req.on('end', () => {
        if (req.url.startsWith('/api/v1/models')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(MODELS)); }
        if (req.url.startsWith('/api/v1/chat/completions')) {
          const auth = req.headers.authorization || '';
          if (!/^Bearer sk-or-v1-/.test(auth)) { res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'No auth credentials found' } })); }
          const b = JSON.parse(body || '{}');
          if (b.stream) { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); return res.end('data: {"choices":[{"delta":{"content":"Bonjour "}}]}\n\ndata: {"choices":[{"delta":{"content":"depuis votre PC"}}]}\n\ndata: [DONE]\n\n'); }
          res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ choices: [{ message: { content: 'texte via pont' } }] }));
        }
        res.writeHead(404); res.end('{}');
      });
    });
    srv.listen(MOCK, '127.0.0.1', () => resolve(srv));
  });
}
const call = (p, opts = {}) => new Promise((resolve) => {
  const req = http.request({ host: '127.0.0.1', port: APP, path: p, method: opts.method || 'GET', headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } }, (res) => {
    let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => { let j = {}; try { j = JSON.parse(d); } catch { j = { raw: d.slice(0, 200) }; } resolve({ status: res.statusCode, body: j }); });
  });
  req.on('error', (e) => resolve({ status: 0, body: { error: e.message } }));
  if (opts.body) req.write(JSON.stringify(opts.body));
  req.end();
});

(async () => {
  const mock = await startMock();
  const server = spawn('node', ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: String(APP), OPENROUTER_BASE: `http://127.0.0.1:${MOCK}/api/v1` }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));

  // ---- 1) protocole : aucun pont connecté
  let r = await call('/api/or-relay', { method: 'POST', body: { path: '/models', method: 'GET' } });
  check('sans pont : bridge_offline', r.body.error === 'bridge_offline', JSON.stringify(r.body));

  // ---- chemin interdit
  r = await call('/api/or-relay', { method: 'POST', body: { path: 'https://evil.example/x' } });
  check('chemin interdit refusé', r.status === 400, JSON.stringify(r.body));

  // ---- 2) appairage du faux pont (jeton invité = « Commencer sans compte »)
  const guest = await call('/api/auth/guest', { method: 'POST', body: {} });
  const token = guest.body.token;
  const code = (await call('/api/bridge/paircode', { method: 'POST', headers: { Authorization: 'Bearer ' + token } })).body.code;
  const sid = 'sess_test_relay';
  await call('/api/bridge/pair', { method: 'POST', body: { code, sessionId: sid, info: { os: 'test' } } });

  // le « pont » : boucle de polling + exécution réelle de la requête demandée
  let alive = true;
  const bridged = [];
  (async () => {
    while (alive) {
      const p = await call('/api/bridge/poll', { method: 'POST', body: { sessionId: sid } });
      for (const t of (p.body.tasks || [])) {
        if (t.type !== 'or_http') continue;
        hits.relayed++;
        let out = { status: 0, text: 'ERROR' };
        try {
          const resp = await fetch(t.payload.url, { method: t.payload.method, headers: t.payload.headers, body: t.payload.body });
          out = { status: resp.status, text: (await resp.text()).slice(0, 300000) };
        } catch (e) { out.text = 'ERROR: ' + e.message; }
        bridged.push({ url: t.payload.url, status: out.status });
        await call('/api/bridge/result', { method: 'POST', body: { id: t.id, output: JSON.stringify(out) } });
      }
      await new Promise((res) => setTimeout(res, 250));
    }
  })();

  // ---- relais : la liste des modèles doit revenir par le pont
  r = await call('/api/or-relay', { method: 'POST', body: { path: '/models', method: 'GET' } });
  let list = []; try { list = JSON.parse(r.body.text).data; } catch {}
  check('pont en ligne : réponse de l’API relayée', r.body.ok === true && r.body.status === 200 && list.length === 2, JSON.stringify(r.body).slice(0, 160));
  check('l’URL relayée est bien openrouter/la base configurée', /\/api\/v1\/models$/.test((bridged[0] || {}).url || ''), (bridged[0] || {}).url);

  // ---- chat relayé (SSE complet)
  r = await call('/api/or-relay', { method: 'POST', body: { path: '/chat/completions', method: 'POST', key: 'sk-or-v1-test', body: { model: 'mock/free-vision', stream: true, messages: [{ role: 'user', content: 'salut' }] } } });
  check('chat relayé (SSE)', r.body.ok === true && /depuis votre PC/.test(r.body.text || ''), String(r.body.text || '').slice(0, 120));

  // ---- 3) navigateur : serveur + direct hors service -> bascule sur le pont
  const browser = await launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1360, height: 900 });
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(e.message.slice(0, 120)));
  await page.evaluateOnNewDocument(() => {
    const real = window.fetch;
    window.fetch = (input, init) => {
      const u = String(typeof input === 'string' ? input : (input && input.url) || '');
      if (/openrouter\.ai/.test(u) || /\/api\/(or-probe|models|models\/test|test-key)/.test(u)) return Promise.reject(new Error('réseau bloqué (test)'));
      return real(input, init);
    };
    localStorage.setItem('jarvis.key', 'sk-or-v1-test');
    localStorage.setItem('jarvis.choseMode', 'true');
  });
  page.on('console', () => {});
  await page.goto(`http://localhost:${APP}/`, { waitUntil: 'load' });
  await page.evaluate(() => window.App.enterApp());
  const chan = await page.evaluate(async () => { await window.J.ORapi.detect(true); return window.J.ORapi.channel; });
  check('le navigateur bascule sur le canal « relay »', chan === 'relay', 'canal=' + chan);
  const m = await page.evaluate(async () => { const r = await window.J.ORapi.models('sk-or-v1-test', { force: true }); return { ok: r.ok, n: (r.models || []).length, via: r.via, reason: r.reason }; });
  check('liste des modèles obtenue par le pont', m.ok === true && m.n === 2 && m.via === 'relay', JSON.stringify(m));
  const chat = await page.evaluate(() => new Promise((resolve) => {
    let acc = '';
    window.J.ORapi.chat({ key: 'sk-or-v1-test', model: 'mock/free-vision', messages: [{ role: 'user', content: 'salut' }] }, {
      delta: (d) => { acc += d.text; }, done: () => resolve(acc), error: () => resolve('err:' + acc),
    }).then((r) => setTimeout(() => resolve(acc || ('vide:' + JSON.stringify(r))), 400));
  }));
  // le pont n'est pas en flux : JARVIS rejoue la réponse complète en morceaux
  check('réponse du chat affichée via le pont', /depuis votre PC|texte via pont/.test(chat), chat.slice(0, 60));
  check('aucune erreur JS dans la page', jsErrors.length === 0, jsErrors.join(' | '));
  await browser.close();

  alive = false;
  server.kill(); mock.close();
  console.log('Canal relay : ' + ok.length + '/' + (ok.length + ko.length) + ' vérifications ✅');
  ok.forEach((o) => console.log('   ✅ ' + o));
  ko.forEach((o) => console.log('   ❌ ' + o));
  process.exit(ko.length ? 1 : 0);
})().catch((e) => { console.error('ERREUR:', e.message.split('\n')[0]); process.exit(1); });
