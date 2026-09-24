// Vérifie le canal « serveur » de bout en bout : on lance un faux OpenRouter local
// (OPENROUTER_BASE) puis le serveur JARVIS, et on contrôle toutes les routes.
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const MOCK_PORT = 8899;
const APP_PORT = 8788;
const MODELS = {
  data: [
    { id: 'mock/paid-big', name: 'Paid Big', context_length: 200000, pricing: { prompt: '0.000003', completion: '0.000015' }, architecture: { input_modalities: ['text', 'image'] } },
    { id: 'mock/free-plain', name: 'Free Plain', context_length: 131072, pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text'] } },
    { id: 'mock/free-vision', name: 'Free Vision', context_length: 65536, pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text', 'image'] } },
  ],
};

let mockHits = { models: 0, chat: 0, once: 0, credits: 0 };

function startMock() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const send = (code, obj, stream) => {
          res.writeHead(code, { 'Content-Type': stream ? 'text/event-stream' : 'application/json' });
          res.end(stream || JSON.stringify(obj));
        };
        if (req.url.startsWith('/api/v1/models')) { mockHits.models++; return send(200, MODELS); }
        if (req.url.startsWith('/api/v1/credits')) { mockHits.credits++; return send(200, { data: { total_credits: 10, total_usage: 1 } }); }
        if (req.url.startsWith('/api/v1/chat/completions')) {
          const b = JSON.parse(body || '{}');
          const auth = req.headers.authorization || '';
          if (!/^Bearer sk-or-v1-/.test(auth)) return send(401, { error: { message: 'No auth credentials found' } });
          if (b.model === 'mock/paid-big' && b.messages?.[0]?.content === 'ping') return send(200, { choices: [{ message: { content: 'pong (payant)' } }] });
          if (b.stream) {
            mockHits.chat++;
            const out = [
              'data: {"choices":[{"delta":{"content":"Réponse "},"index":0}]}\n\n',
              'data: {"choices":[{"delta":{"content":"du serveur"},"index":0}]}\n\n',
              'data: [DONE]\n\n',
            ].join('');
            res.writeHead(200, { 'Content-Type': 'text/event-stream' });
            return res.end(out);
          }
          mockHits.once++;
          return send(200, { choices: [{ message: { content: 'texte complet du serveur' } }] });
        }
        send(404, { error: 'not found' });
      });
    });
    srv.listen(MOCK_PORT, '127.0.0.1', () => resolve(srv));
  });
}

const get = (p, opts) => new Promise((resolve) => {
  const req = http.request({ host: '127.0.0.1', port: APP_PORT, path: p, method: (opts && opts.method) || 'GET', headers: (opts && opts.headers) || {} }, (res) => {
    let d = '';
    res.on('data', (c) => { d += c; });
    res.on('end', () => resolve({ status: res.statusCode, body: d }));
  });
  req.on('error', (e) => resolve({ status: 0, body: String(e.message) }));
  if (opts && opts.body) req.write(JSON.stringify(opts.body));
  req.end();
});

(async () => {
  const problems = [];
  const mock = await startMock();
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(APP_PORT), OPENROUTER_BASE: `http://127.0.0.1:${MOCK_PORT}/api/v1` },
    stdio: 'ignore',
  });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 40; i++) { const h = await get('/api/health'); if (h.status === 200) break; await wait(250); }

  // 1) sonde serveur → OpenRouter joignable
  await wait(1500);
  const probe = JSON.parse((await get('/api/or-probe')).body);
  console.log('1) sonde serveur → OpenRouter :', probe.ok ? '✅ joignable' : '❌ ' + probe.error);
  if (!probe.ok) problems.push('sonde');

  // 2) liste des modèles : 100 % API, gratuit déduit des tarifs, payants d'abord
  const m = JSON.parse((await get('/api/models?force=1')).body);
  const ids = m.models.map((x) => x.id).join(', ');
  const same = m.models.length === MODELS.data.length && MODELS.data.every((x) => m.models.some((y) => y.id === x.id));
  const freePlain = m.models.find((x) => x.id === 'mock/free-plain');
  console.log('2) modèles via /api/models :', m.models.length, '→', ids, same ? '✅' : '❌', '· source:', m.source);
  console.log('   gratuit (tarifs à 0, sans « :free ») :', freePlain && freePlain.free ? '✅' : '❌',
    '· payants en premier :', m.models[0].free === false ? '✅' : '❌');
  if (!same || !freePlain?.free || m.models[0].free !== false) problems.push('catalogue serveur');

  // 3) test de clé
  const t1 = JSON.parse((await get('/api/test-key', { method: 'POST', body: { key: 'sk-or-v1-test', model: 'mock/free-plain' } })).body);
  const t2 = JSON.parse((await get('/api/test-key', { method: 'POST', body: { key: 'bad-key', model: 'mock/free-plain' } })).body);
  console.log('3) test de clé valide :', t1.ok ? '✅' : '❌', '· clé invalide :', (t2.ok === false && t2.status === 401) ? '✅ 401' : '❌ ' + JSON.stringify(t2).slice(0, 80));
  if (!t1.ok || t2.status !== 401) problems.push('test clé serveur');

  // 4) chat en streaming (SSE) via le serveur
  const auth = await get('/api/auth/guest', { method: 'POST' });
  const token = JSON.parse(auth.body).token;
  const sse = await new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port: APP_PORT, path: '/api/chat', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve(d));
    });
    req.end(JSON.stringify({ key: 'sk-or-v1-test', model: 'mock/free-plain', mode: 'chat', messages: [{ role: 'user', content: 'salut' }] }));
  });
  const flowed = /event: delta/.test(sse) && /du serveur/.test(sse) && /event: done/.test(sse);
  console.log('4) chat SSE serveur :', flowed ? '✅ deltas + done' : '❌ ' + sse.slice(0, 120));
  if (!flowed) problems.push('chat SSE');

  // 5) /api/chat-once (studio image/vidéo)
  const once = JSON.parse((await get('/api/chat-once', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: { key: 'sk-or-v1-test', model: 'mock/free-plain', messages: [{ role: 'user', content: 'salut' }] } })).body);
  const onceOk = once.ok && /Réponse du serveur|texte complet/.test(once.content || '');
  console.log('5) /api/chat-once :', onceOk ? '✅ texte complet (' + (once.content || '').slice(0, 30) + '…)' : '❌ ' + JSON.stringify(once).slice(0, 120));
  if (!onceOk) problems.push('chat-once');

  // 6) crédits
  const bal = JSON.parse((await get('/api/balance?key=sk-or-v1-test')).body);
  console.log('6) /api/balance :', bal.balance ? '✅' : '❌');
  if (!bal.balance) problems.push('balance');

  // 7) aucune liste pré-écrite dans le code
  const lib = fs.readFileSync(path.join(ROOT, 'server/lib/openrouter.js'), 'utf8');
  console.log('7) aucune liste de modèles en dur :', !/FALLBACK_MODELS/.test(lib) ? '✅' : '❌');
  if (/FALLBACK_MODELS/.test(lib)) problems.push('liste en dur');

  console.log('   appels reçus par le faux OpenRouter :', JSON.stringify(mockHits));
  child.kill();
  mock.close();
  console.log(problems.length ? '\n❌ ' + problems.join(' | ') : '\n✅ canal serveur complet : catalogue, test de clé, SSE, chat-once, crédits');
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error('ERREUR:', e.message); process.exit(1); });
