// Parcours utilisateur complet, comme un vrai visiteur :
//  accueil -> « Lancer JARVIS » -> écrire -> envoyer -> réponse en direct ->
//  historique, redimensionnement du panneau, 4 langues, sélecteur de modèle.
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const { launch } = require('./browser');

const ROOT = path.join(__dirname, '..');
const MOCK = 8901, APP = 8791;
const MODELS = { data: [
  { id: 'mock/paid-big', name: 'Paid Big', context_length: 200000, pricing: { prompt: '0.000003', completion: '0.000015' }, architecture: { input_modalities: ['text'] } },
  { id: 'mock/free-vision', name: 'Free Vision', context_length: 65536, pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text', 'image'] } },
] };
const ok = [], ko = [];
const check = (n, c, x) => (c ? ok : ko).push(n + (c ? '' : ' → ' + (x || 'échec')));

function startMock() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let body = ''; req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const js = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
        if (req.url.startsWith('/api/v1/models')) return js(200, MODELS);
        if (req.url.startsWith('/api/v1/credits')) return js(200, { data: { total_credits: 5, total_usage: 0.1 } });
        if (req.url.startsWith('/api/v1/chat/completions')) {
          const b = JSON.parse(body || '{}');
          if (!/^Bearer sk-or-v1-/.test(req.headers.authorization || '')) return js(401, { error: { message: 'No auth credentials found' } });
          if (b.stream) { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); return res.end('data: {"choices":[{"delta":{"content":"Bonjour, "}}]}\n\ndata: {"choices":[{"delta":{"content":"je suis JARVIS."}}]}\n\ndata: [DONE]\n\n'); }
          return js(200, { choices: [{ message: { content: 'Bonjour, je suis JARVIS.' } }] });
        }
        res.writeHead(404); res.end('{}');
      });
    });
    srv.listen(MOCK, '127.0.0.1', () => resolve(srv));
  });
}

(async () => {
  const mock = await startMock();
  const server = spawn('node', ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: String(APP), OPENROUTER_BASE: `http://127.0.0.1:${MOCK}/api/v1` }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));

  const browser = await launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(e.message.slice(0, 140)));
  page.on('dialog', (d) => d.dismiss());

  await page.goto(`http://localhost:${APP}/`, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });

  // 1) le bouton de lancement de l'accueil ouvre l'application
  const landingVisible = await page.evaluate(() => !document.getElementById('landing').classList.contains('hidden'));
  await page.evaluate(() => { const b = document.querySelector('#lp-nav button[data-action="start"], #landing button[data-action="start"], #landing .btn-hero'); b && b.click(); });
  await new Promise((r) => setTimeout(r, 900));
  // « Commencer sans compte » : aucune inscription requise
  const guest = await page.evaluate(() => {
    const b = document.getElementById('onb-skip') || [...document.querySelectorAll('.overlay button')].find((x) => /sans compte|without an account|sin cuenta|senza account|invit/i.test(x.textContent || ''));
    if (b) { b.click(); return true; }
    return false;
  });
  await new Promise((r) => setTimeout(r, 1600));
  const appVisible = await page.evaluate(() => !document.getElementById('workspace').classList.contains('hidden'));
  check('accueil puis « Lancer JARVIS » puis « sans compte » → application ouverte', landingVisible && guest && appVisible, 'landing=' + landingVisible + ' guest=' + guest + ' app=' + appVisible);
  // on repart avec une clé enregistrée (le parcours normal d'un utilisateur qui a testé sa clé)
  await page.evaluate(() => { localStorage.setItem('jarvis.key', 'sk-or-v1-test'); localStorage.setItem('jarvis.choseMode', 'true'); });
  await page.reload({ waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 700));
  await page.evaluate(() => { const b = document.querySelector('#lp-nav button[data-action="start"]'); b && b.click(); });
  await new Promise((r) => setTimeout(r, 1600));

  // 2) les modèles arrivent de l'API (canal serveur)
  await page.waitForFunction(() => /mock|Free|Paid/.test(document.getElementById('model-btn').textContent || ''), { timeout: 15000 }).catch(() => {});
  const modelBtn = await page.evaluate(() => (document.getElementById('model-btn').textContent || '').trim());
  check('sélecteur de modèle alimenté par l’API', /Free|Paid|mock/.test(modelBtn), modelBtn.slice(0, 60));

  // 3) écrire + cliquer sur « envoyer » -> réponse en direct
  await page.evaluate(() => { const i = document.getElementById('input'); i.value = 'Bonjour JARVIS'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.evaluate(() => document.getElementById('send-btn').click());
  await page.waitForFunction(() => /je suis JARVIS/.test(document.getElementById('chat-scroll').textContent || ''), { timeout: 20000 }).catch(() => {});
  const answer = await page.evaluate(() => document.getElementById('chat-scroll').textContent || '');
  check('réponse reçue et affichée après un clic sur le bouton d’envoi', /je suis JARVIS/.test(answer), answer.slice(-90));
  const convs = await page.evaluate(() => document.querySelectorAll('#conv-list .conv').length);
  check('conversation enregistrée dans l’historique', convs >= 1, 'conversations=' + convs);

  // 4) panneau droit : ouverture + redimensionnement au glisser
  await page.evaluate(() => document.getElementById('panel-toggle').click());
  await new Promise((r) => setTimeout(r, 700));
  const w1 = await page.evaluate(() => document.getElementById('panel').getBoundingClientRect().width);
  const box = await page.evaluate(() => { const g = document.getElementById('panel-resizer').getBoundingClientRect(); return { x: g.x + 3, y: g.y + 200 }; });
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x - 220, box.y, { steps: 12 });
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 400));
  const w2 = await page.evaluate(() => document.getElementById('panel').getBoundingClientRect().width);
  check('panneau droit redimensionnable au glisser', Math.abs(w2 - w1) > 120, 'avant=' + Math.round(w1) + ' après=' + Math.round(w2));
  const savedW = await page.evaluate(() => localStorage.getItem('jarvis.panelW'));
  check('largeur du panneau mémorisée', !!Number(savedW), 'panelW=' + savedW);
  const quarter = await page.evaluate(() => {
    const p = document.getElementById('panel');
    p.style.removeProperty('--panel-w');
    return Math.round(p.getBoundingClientRect().width / window.innerWidth * 100);
  });
  check('largeur par défaut ≈ un quart de l’écran', quarter >= 20 && quarter <= 32, quarter + '% de la fenêtre');

  // 5) les 4 langues, sans clé brute affichée
  for (const lang of ['en', 'es', 'it', 'fr']) {
    await page.select('#lang-select', lang);
    await new Promise((r) => setTimeout(r, 350));
    const bad = await page.evaluate(() => {
      const txt = document.body.innerText || '';
      // une clé brute ressemble à « msg.placeholder » ; on ignore l'e-mail du créateur
      const m = txt.match(/(?<![@\w])[a-z]{2,12}\.[a-z][a-zA-Z0-9_]{2,}(?![@\w.\-])/g) || [];
      return m.filter((x) => !/\.(js|css|png|com|net|ai|io|bat|json|md|html|pdf|py|ts)$/.test(x)).slice(0, 6);
    });
    check('langue « ' + lang + ' » sans clé de traduction visible', bad.length === 0, bad.join(', '));
  }

  // 6) sélecteur de modèle : la liste vient de l'API, gratuit/payant indiqué
  await page.evaluate(() => document.getElementById('model-btn').click());
  await new Promise((r) => setTimeout(r, 1200));
  const pop = await page.evaluate(() => {
    const menu = document.querySelector('.popmenu');
    const txt = (menu ? menu.innerText : '') + ' ' + document.getElementById('model-btn').innerText;
    return { txt: txt.slice(0, 160), paidModel: /Paid Big/.test(txt), freeModel: /Free Vision/.test(txt), mark: /FREE|PAID/.test(txt) };
  });
  check('sélecteur de modèle : liste issue de l’API + repère gratuit/payant', pop.paidModel && pop.freeModel && pop.mark, JSON.stringify(pop));
  await page.evaluate(() => document.querySelectorAll('.overlay,.popmenu').forEach((o) => o.remove()));

  check('aucune erreur JS pendant tout le parcours', jsErrors.length === 0, jsErrors.join(' | '));
  await browser.close();
  server.kill(); mock.close();
  console.log('Parcours utilisateur : ' + ok.length + '/' + (ok.length + ko.length) + ' ✅');
  ok.forEach((o) => console.log('   ✅ ' + o));
  ko.forEach((o) => console.log('   ❌ ' + o));
  process.exit(ko.length ? 1 : 0);
})().catch((e) => { console.error('ERREUR:', e.message.split('\n')[0]); process.exit(1); });
