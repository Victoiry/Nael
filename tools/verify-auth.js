// Vérifie le système de connexion et l'exigence « aucun compte obligatoire » :
//   1) connexion réelle : on n'annonce « connecté » que si le serveur le confirme ;
//   2) la session SURVIT au rechargement (bug « connecté mais pas connecté ») ;
//   3) la session invitée silencieuse n'écrase jamais un compte connecté ;
//   4) déconnexion réelle ;
//   5) le pont local et le .bat fonctionnent SANS compte ;
//   6) la fenêtre de clé n'a qu'UN bouton : « Tester » -> « Test OK ».
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const { launch } = require('./browser');

const ROOT = path.join(__dirname, '..');
const MOCK = 8907, APP = 8797;
const MODELS = { data: [
  { id: 'mock/free-vision', name: 'Free Vision', context_length: 65536, pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text', 'image'] } },
  { id: 'mock/paid-big', name: 'Paid Big', context_length: 200000, pricing: { prompt: '0.000003', completion: '0.000015' }, architecture: { input_modalities: ['text'] } },
] };
const ok = [], ko = [];
const check = (n, c, x) => (c ? ok : ko).push(n + (c ? '' : ' → ' + (x === undefined ? 'échec' : x)));

function startMock() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let body = ''; req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const js = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
        if (req.url.startsWith('/api/v1/models')) return js(200, MODELS);
        if (req.url.startsWith('/api/v1/credits')) return js(200, { data: { total_credits: 5, total_usage: 0.2 } });
        if (req.url.startsWith('/api/v1/chat/completions')) return js(200, { choices: [{ message: { content: 'ok' } }] });
        js(404, {});
      });
    });
    srv.listen(MOCK, '127.0.0.1', () => resolve(srv));
  });
}
const call = (p, opts = {}) => new Promise((resolve) => {
  const req = http.request({ host: '127.0.0.1', port: APP, path: p, method: opts.method || 'GET', headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } }, (res) => {
    let d = ''; res.on('data', (c) => d += c); res.on('end', () => { let j = {}; try { j = JSON.parse(d); } catch { j = { raw: d.slice(0, 120) }; } resolve({ status: res.statusCode, body: j }); });
  });
  req.on('error', (e) => resolve({ status: 0, body: { error: e.message } }));
  if (opts.body) req.write(JSON.stringify(opts.body)); req.end();
});

(async () => {
  const mock = await startMock();
  const server = spawn('node', ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: String(APP), OPENROUTER_BASE: `http://127.0.0.1:${MOCK}/api/v1` }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1300));

  const email = 'compte' + Date.now() + '@example.com';
  const reg = await call('/api/auth/register', { method: 'POST', body: { email, password: 'secret123', name: 'Compte Test' } });
  check('inscription par l’API', reg.status === 200 && !!reg.body.token, JSON.stringify(reg.body).slice(0, 80));

  const browser = await launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(e.message.slice(0, 140)));
  page.on('dialog', (d) => d.dismiss());

  await page.goto(`http://localhost:${APP}/`, { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('jarvis.key', 'sk-or-v1-test'); localStorage.setItem('jarvis.choseMode', 'true'); });
  await page.reload({ waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate(() => window.App.enterApp());   // bouton « Lancer JARVIS »
  await new Promise((r) => setTimeout(r, 1200));

  // 1) au démarrage : invocation invitée silencieuse (aucun compte demandé), aucun écran bloquant
  const boot = await page.evaluate(() => ({ app: !document.getElementById('workspace').classList.contains('hidden'), guest: !!(window.J.S.auth && window.J.S.auth.guest), modal: !!document.querySelector('.overlay') }));
  check('démarrage sans compte, sans écran d’inscription', boot.app && boot.guest && !boot.modal, JSON.stringify(boot));

  // 2) connexion par l’interface
  await page.evaluate(() => document.getElementById('btn-auth-top').click());
  await new Promise((r) => setTimeout(r, 400));
  const labels = await page.evaluate(() => [...document.querySelectorAll('.overlay .modal button')].map((x) => x.textContent.trim()));
  const tabRegister = /créer le compte|create account|crear cuenta|crea account/i.test(labels.join('|'));
  check('la fenêtre de connexion propose aussi « créer un compte » (jamais imposé)', tabRegister, labels.join(' / ').slice(0, 90));
  await page.evaluate((mail) => {
    const i = [...document.querySelectorAll('.overlay input')];
    i[0].value = mail; i[1].value = 'secret123';
    const btns = [...document.querySelectorAll('.overlay .modal button')].filter((x) => /^(se connecter|sign in|iniciar|accedi)$/i.test(x.textContent.trim()));
    (btns[btns.length - 1] || btns[0]).click();
  }, email);
  await new Promise((r) => setTimeout(r, 2200));
  const after = await page.evaluate(() => ({
    email: (window.J.S.auth || {}).email, guest: (window.J.S.auth || {}).guest,
    name: document.getElementById('me-name').textContent, state: document.getElementById('me-state').textContent,
    modal: !!document.querySelector('.overlay .modal'),
    toast: [...document.querySelectorAll('.toast')].map((x) => x.textContent.trim()).join(' | '),
  }));
  check('connexion : la session est celle du compte', after.email === email && after.guest === false, JSON.stringify(after).slice(0, 140));
  check('l’interface affiche le compte (bandeau + état synchronisé)', after.name === 'Compte Test' && /sync/i.test(after.state), after.name + ' / ' + after.state);
  check('la fenêtre se ferme et le message nomme le compte', !after.modal && after.toast.includes(email), after.toast.slice(0, 80));
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('jarvis.auth') || '{}'));
  check('le jeton stocké est bien celui du compte', stored.email === email && stored.guest === false, JSON.stringify(stored).slice(0, 80));
  check('le jeton stocké est valide côté serveur', (await call('/api/auth/me', { headers: { Authorization: 'Bearer ' + stored.token } })).body.user?.email === email);

  // 3) LE bug signalé : après rechargement, on doit rester connecté
  await page.reload({ waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 2200));
  const reloaded = await page.evaluate(() => ({ email: (window.J.S.auth || {}).email, guest: (window.J.S.auth || {}).guest, name: document.getElementById('me-name').textContent, state: document.getElementById('me-state').textContent }));
  check('la session survit au rechargement (connecté pour de vrai)', reloaded.email === email && reloaded.guest === false, JSON.stringify(reloaded).slice(0, 120));
  check('le bandeau reste sur le compte après rechargement', reloaded.name === 'Compte Test', reloaded.name);

  // 4) une session invitée ne doit jamais écraser un compte
  await page.evaluate(() => window.J.API.call('/api/auth/guest', { method: 'POST' }));
  await page.evaluate(async () => { window.J.S.auth = null; await window.App.enterApp(); });
  await new Promise((r) => setTimeout(r, 1500));
  const notOverwritten = await page.evaluate(() => JSON.parse(localStorage.getItem('jarvis.auth') || '{}').email);
  check('l’invité silencieux n’écrase jamais le compte', notOverwritten === email, notOverwritten);

  // 5) déconnexion réelle
  await page.reload({ waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 2000));
  await page.evaluate(() => document.getElementById('btn-auth-top').click());
  await new Promise((r) => setTimeout(r, 1500));
  const out = await page.evaluate(() => ({ guest: !!(window.J.S.auth || {}).guest, state: document.getElementById('me-state').textContent }));
  check('déconnexion : retour en mode local sans écran bloquant', out.guest === true && /local/i.test(out.state), JSON.stringify(out));

  // 6) aucun compte requis pour le pont local et le .bat
  const gt = await call('/api/auth/guest', { method: 'POST' });
  const pc = await call('/api/bridge/paircode', { method: 'POST', headers: { Authorization: 'Bearer ' + gt.body.token } });
  check('code de vérification disponible sans compte', pc.status === 200 && /^\d{6}$/.test(String(pc.body.code || '')), pc.status + ' ' + JSON.stringify(pc.body).slice(0, 50));
  const bat = await call('/api/bridge/download/setup', { headers: { Authorization: 'Bearer ' + gt.body.token } });
  check('téléchargement du .bat sans compte', bat.status === 200, 'HTTP ' + bat.status);

  // 7) fenêtre de clé : UN seul bouton « Tester » qui passe à « Test OK »
  await page.evaluate(() => { localStorage.removeItem('jarvis.key'); location.reload(); });
  await new Promise((r) => setTimeout(r, 1800));
  await page.evaluate(() => window.App.startOnboarding(true));
  await new Promise((r) => setTimeout(r, 700));
  const LAST = "(() => { const m = [...document.querySelectorAll('.overlay .modal')]; return m[m.length - 1]; })()";
  const onb = await page.evaluate((last) => {
    const modal = eval(last);
    return {
      all: [...modal.querySelectorAll('button')].map((x) => x.textContent.trim()),
      primary: [...modal.querySelectorAll('button.btn.primary')].map((x) => x.textContent.trim()),
      links: [...modal.querySelectorAll('button.link-muted')].length,
    };
  }, LAST);
  const onbMain = onb.all.filter((x) => /^(tester|test|probar|prova)$/i.test(x)).length;
  check('écran de la clé : un seul bouton d’action « Tester »', onbMain === 1 && onb.primary.length === 1,
    'boutons=' + onb.all.join(' / ').slice(0, 80) + ' · principaux=' + onb.primary.join(','));
  await page.evaluate((last) => {
    const modal = eval(last);
    const i = [...modal.querySelectorAll('input')].pop();
    i.value = 'sk-or-v1-test'; i.dispatchEvent(new Event('input', { bubbles: true }));
    [...modal.querySelectorAll('button')].find((x) => /^(tester|test|probar|prova)$/i.test(x.textContent.trim())).click();
  }, LAST);
  await new Promise((r) => setTimeout(r, 2500));
  const pop = await page.evaluate((last) => {
    const modal = eval(last);
    return {
      buttons: [...modal.querySelectorAll('button.btn')].map((x) => x.textContent.trim()).filter(Boolean),
      primary: modal.querySelectorAll('button.btn.primary').length,
      rows: modal.querySelectorAll('.model-row').length,
    };
  }, LAST);
  check('liste des modèles issue de l’API dans la fenêtre', pop.rows >= 2, 'lignes=' + pop.rows);
  const testOnly = pop.buttons.filter((x) => /tester|test|probar|prova/i.test(x)).length;
  check('fenêtre de test : un seul bouton d’action « Tester » (pas de second bouton)',
    testOnly === 1 && pop.primary === 1 && !pop.buttons.some((x) => /continuer|continue|enregistrer|guardar|salva/i.test(x)),
    testOnly + ' bouton(s) Tester · ' + pop.primary + ' principal · ' + pop.buttons.join(' / ').slice(0, 90));
  const rows = await page.evaluate((last) => eval(last).querySelectorAll('.model-row').length, LAST);
  check('la liste contient bien des modèles cliquables', rows >= 2, 'lignes=' + rows);
  // on choisit un modèle GRATUIT (les payants sont en tête et exigent le compte à rebours)
  await page.evaluate((last) => {
    const modal = eval(last);
    const free = [...modal.querySelectorAll('.model-row')].find((r) => /FREE/i.test(r.textContent));
    (free || modal.querySelector('.model-row')).click();
    const b = [...modal.querySelectorAll('button')].find((x) => /^(tester|test|probar|prova)/i.test(x.textContent.trim()));
    b && b.click();
  }, LAST);
  let okState = { label: '', key: false };
  for (let i = 0; i < 25; i++) {                      // la fenêtre se ferme 0,9 s après le succès
    await new Promise((r) => setTimeout(r, 150));
    const st = await page.evaluate(() => ({
      label: (document.querySelector('#model-test-ok') || {}).textContent || '',
      toast: [...document.querySelectorAll('.toast')].map((x) => x.textContent.trim()).join(' | '),
      key: !!window.J.S.key,
    }));
    if (/test ok/i.test(st.label) || /test ok/i.test(st.toast)) { okState = st; break; }
    okState = st;
  }
  check('après un test réussi : le bouton affiche « Test OK »', /test ok/i.test(okState.label + ' ' + okState.toast), '« ' + (okState.label || okState.toast).slice(0, 70) + ' »');
  check('la clé testée est bien celle enregistrée', okState.key === true);

  check('aucune erreur JS dans tout le parcours', jsErrors.length === 0, jsErrors.join(' | '));

  await browser.close();
  server.kill(); mock.close();
  console.log('Connexion & comptes : ' + ok.length + '/' + (ok.length + ko.length) + ' ✅');
  ok.forEach((o) => console.log('   ✅ ' + o));
  ko.forEach((o) => console.log('   ❌ ' + o));
  process.exit(ko.length ? 1 : 0);
})().catch((e) => { console.error('ERREUR:', e.message.split('\n')[0]); process.exit(1); });
