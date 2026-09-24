// Vérifie TOUTE la chaîne OpenRouter sans dépendre du réseau du bac à sable :
// on intercepte les appels https://openrouter.ai/api/v1/* dans le navigateur.
//   • liste des modèles 100 % issue de l'API (aucune liste pré-écrite)
//   • gratuit/payant déduit des tarifs renvoyés par l'API
//   • test de clé : succès, 401, 429
//   • chat en streaming via le navigateur quand le serveur est bloqué
const { launch } = require('./browser');

const MODELS = {
  data: [
    { id: 'acme/paid-flagship', name: 'Paid Flagship', context_length: 200000, pricing: { prompt: '0.000003', completion: '0.000015' }, architecture: { input_modalities: ['text', 'image'] } },
    { id: 'acme/paid-cheap', name: 'Paid Cheap', context_length: 32000, pricing: { prompt: '0.0000001', completion: '0.0000004' }, architecture: { input_modalities: ['text'] } },
    // gratuit SANS « :free » dans l'identifiant : seule l'API le dit (tarifs à 0)
    { id: 'acme/zero-cost', name: 'Zero Cost', context_length: 131072, pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text'] } },
    { id: 'acme/marked-free:free', name: 'Marked Free', context_length: 65536, pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text', 'image'] } },
  ],
};

const SSE = [
  'data: {"choices":[{"delta":{"content":"Bonjour"},"index":0}]}\n\n',
  'data: {"choices":[{"delta":{"content":" depuis OpenRouter"},"index":0}]}\n\n',
  'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"total_tokens":12}}\n\n',
  'data: [DONE]\n\n',
].join('');

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,content-type,x-title,http-referer',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
};

(async () => {
  const browser = await launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const seen = { models: 0, chats: 0, serverBlocked: 0 };
  const pulls = [];
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));

  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    const url = req.url();
    // 1) on simule un serveur sans accès à openrouter.ai (comme dans l'aperçu)
    if (url.includes('/api/or-probe')) {
      seen.serverBlocked++;
      return req.respond({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ ok: false, status: 0, error: 'connexion bloquée vers openrouter.ai (ECONNRESET)' }) });
    }
    // 2) on simule l'API OpenRouter elle-même
    if (url.startsWith('https://openrouter.ai/api/v1')) {
      if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS, body: '' });
      if (url.includes('/models')) {
        seen.models++;
        return req.respond({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(MODELS) });
      }
      if (url.includes('/chat/completions')) {
        seen.chats++;
        const body = JSON.parse(req.postData() || '{}');
        pulls.push(body);
        if (body.model === 'acme/paid-flagship') {
          return req.respond({ status: 401, contentType: 'application/json', headers: CORS, body: JSON.stringify({ error: { message: 'No auth credentials found', code: 401 } }) });
        }
        if (body.model === 'acme/paid-cheap') {
          return req.respond({ status: 429, contentType: 'application/json', headers: CORS, body: JSON.stringify({ error: { message: 'Rate limit exceeded', code: 429 } }) });
        }
        if (body.stream) {
          return req.respond({ status: 200, headers: Object.assign({ 'content-type': 'text/event-stream' }, CORS), body: SSE });
        }
        return req.respond({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'pong' } }] }) });
      }
    }
    req.continue();
  });

  const problems = [];
  await page.goto('http://localhost:8787/', { waitUntil: 'load' });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('jarvis.key', 'sk-or-v1-test');
    localStorage.setItem('jarvis.choseMode', 'true');
  });
  await page.reload({ waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 700));

  // ---------- 1) canal détecté : serveur bloqué → navigateur
  const chan = await page.evaluate(() => window.J.ORapi.detect(true));
  console.log('1) canal détecté :', chan, chan === 'direct' ? '✅ (bascule navigateur)' : '❌ attendu "direct"');
  if (chan !== 'direct') problems.push('canal=' + chan);

  // ---------- 2) liste des modèles depuis l'API
  const list = await page.evaluate(() => window.J.ORapi.models(localStorage.getItem('jarvis.key') ? null : null, { force: true }));
  const ids = (list.models || []).map((m) => m.id).join(', ');
  console.log('2) modèles renvoyés par l’API :', list.models.length, '→', ids);
  const expect = MODELS.data.map((m) => m.id);
  const same = list.models.length === expect.length && expect.every((id) => list.models.some((m) => m.id === id));
  console.log('   liste identique à l’API (aucune liste pré-écrite) :', same ? '✅' : '❌');
  if (!same) problems.push('liste ≠ API');

  const zero = list.models.find((m) => m.id === 'acme/zero-cost');
  const paid = list.models.find((m) => m.id === 'acme/paid-cheap');
  console.log('   gratuit détecté par les tarifs (sans « :free ») :', zero && zero.free ? '✅' : '❌', '· payant :', paid && !paid.free ? '✅' : '❌');
  if (!(zero && zero.free && paid && !paid.free)) problems.push('détection gratuit/payant');
  console.log('   ordre (payants d’abord) :', list.models[0].free === false ? '✅' : '❌');

  // ---------- 3) test de clé : succès / 401 / 429
  const ok = await page.evaluate(() => window.J.ORapi.testKey('sk-or-v1-test', 'acme/marked-free:free'));
  console.log('3) test de clé (modèle gratuit) :', JSON.stringify(ok.ok), ok.ok ? '✅' : '❌', '·', ok.latency + 'ms ·', ok.via);
  if (!ok.ok) problems.push('test clé OK échoue');
  const bad = await page.evaluate(() => window.J.ORapi.testKey('sk-or-v1-test', 'acme/paid-flagship'));
  console.log('   clé refusée (401) :', bad.reason === 'cle_invalide' ? '✅' : '❌', '→', bad.reason, '· HTTP', bad.status);
  if (bad.reason !== 'cle_invalide') problems.push('401 mal géré');
  const rate = await page.evaluate(() => window.J.ORapi.testKey('sk-or-v1-test', 'acme/paid-cheap'));
  console.log('   débit (429) :', rate.reason === 'debit' ? '✅' : '❌', '→', rate.reason);
  if (rate.reason !== 'debit') problems.push('429 mal géré');

  // ---------- 4) chat en streaming via le navigateur
  await page.evaluate(() => { window.App.enterApp(); });
  await new Promise((r) => setTimeout(r, 1200));
  await page.evaluate(() => {
    const ov = document.querySelectorAll('.overlay');
    ov.forEach((o) => o.remove());
    window.J.S.settings.ai.model = 'acme/marked-free:free';
    window.Chat.loadModels(true);
  });
  await new Promise((r) => setTimeout(r, 700));
  const before = seen.chats;
  await page.evaluate(() => {
    const ta = document.getElementById('input');
    ta.value = 'Bonjour JARVIS';
    document.getElementById('send-btn').click();
  });
  await new Promise((r) => setTimeout(r, 1800));
  const chat = await page.evaluate(() => ({
    text: (document.getElementById('chat-scroll').textContent || '').trim(),
    channel: window.J.ORapi.channel,
  }));
  console.log('4) réponse streamée :', /Bonjour depuis OpenRouter/.test(chat.text) ? '✅' : '❌', '· canal:', chat.channel);
  if (!/Bonjour depuis OpenRouter/.test(chat.text)) problems.push('streaming navigateur');
  console.log('   appels chat interceptés :', seen.chats - before, '· modèles :', seen.models, '· sondes serveur :', seen.serverBlocked);

  // ---------- 5) erreur OpenRouter affichée dans le chat (plus jamais de silence)
  await page.setRequestInterception(false);
  await page.setRequestInterception(true);
  page.removeAllListeners('request');
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/or-probe')) return req.respond({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ ok: false, status: 0 }) });
    if (url.startsWith('https://openrouter.ai/api/v1')) {
      if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS, body: '' });
      if (url.includes('/models')) return req.respond({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(MODELS) });
      return req.respond({ status: 402, contentType: 'application/json', headers: CORS, body: JSON.stringify({ error: { message: 'Insufficient credits', code: 402 } }) });
    }
    req.continue();
  });
  await page.evaluate(() => {
    window.J.S.settings.ai.model = 'acme/paid-cheap';
    document.getElementById('input').value = 'autre question';
    document.getElementById('send-btn').click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  const errChat = await page.evaluate(() => (document.getElementById('chat-scroll').textContent || '').trim());
  const shown = /402|crédit|credit/i.test(errChat);
  console.log('5) erreur OpenRouter visible dans le chat (402) :', shown ? '✅' : '❌');
  if (!shown) problems.push('erreur non affichée');

  // ---------- 6) image générée par l'API (le studio passe par le même canal)
  const img = await page.evaluate(() => window.OR.image({ key: 'sk-or-v1-test', model: 'acme/marked-free:free', prompt: 'test' }));
  const imgOk = img.ok || img.reason === 'credit'; // ici le faux serveur répond 402 à tout chat/completions
  console.log('6) studio image : appel passé par l’API OpenRouter :', imgOk ? '✅' : '❌', img.ok ? '(image reçue)' : '(erreur API correctement remontée : ' + img.reason + ')');
  if (!imgOk) problems.push('image');

  if (errs.length) { console.log('❌ erreurs JS :', errs[0]); problems.push('JS'); }
  console.log(problems.length ? '\n❌ ' + problems.join(' | ') : '\n✅ chaîne OpenRouter complète : liste, test, erreurs, streaming');
  await page.screenshot({ path: '/tmp/openrouter.png' });
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error('ERREUR:', e.message.split('\n')[0]); process.exit(1); });
