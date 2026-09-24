// Detecte les BOUTONS MORTS : ceux qui ne provoquent AUCUNE mutation DOM ni
// aucun effet de bord (ouverture, copie, telechargement, requete reseau).
// Verifie aussi qu'aucune invite native (prompt/confirm/alert) n'est utilisee :
// elles sont bloquees dans un apercu en iframe -> bouton qui « ne fait rien ».
const { launch } = require('./browser');

const INSTRUMENT = () => {
  window.__side = [];
  window.__native = [];
  ['prompt', 'confirm', 'alert'].forEach((k) => {
    window[k] = (...a) => { window.__native.push(k + ':' + String(a[0] || '').slice(0, 60)); return k === 'confirm' ? false : ''; };
  });
  const o = window.open; window.open = (...a) => { window.__side.push('open:' + String(a[0]).slice(0, 60)); return o.apply(window, a); };
  window.__mut = 0;
  const mo = new MutationObserver((recs) => { window.__mut += recs.length; });
  window.__observe = () => mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  window.__reset = () => { window.__mut = 0; window.__side = []; };
  navigator.clipboard.writeText = async (t) => { window.__side.push('copy:' + String(t).slice(0, 20)); };
  const of = window.fetch; window.fetch = (...a) => { window.__side.push('fetch:' + String(a[0]).slice(0, 70)); return of.apply(window, a); };
  URL.createObjectURL = ((orig) => (blob) => { window.__side.push('blob:' + (blob && blob.size)); return orig.call(URL, blob); })(URL.createObjectURL.bind(URL));
  window.__observe();
};

(async () => {
  const browser = await launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1360, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 140)));

  await page.goto('http://localhost:8787/', { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('jarvis.key', 'sk-or-v1-test'); localStorage.setItem('jarvis.choseMode', 'true'); });
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(INSTRUMENT);
  await new Promise((r) => setTimeout(r, 700));
  await page.evaluate(() => window.App.enterApp());
  await new Promise((r) => setTimeout(r, 1800));
  await page.evaluate(INSTRUMENT);

  const dead = [];
  const quiet = async () => {
    for (let i = 0; i < 12; i++) {
      const m = await page.evaluate(() => window.__mut);
      if (m === 0) return;
      await page.evaluate(() => window.__reset());
      await new Promise((r) => setTimeout(r, 150));
    }
  };
  const scan = async (label, selector) => {
    // on marque chaque bouton : les index ne survivent pas aux re-rendus
    const n = await page.evaluate(({ sel, label }) => {
      const nodes = [...document.querySelectorAll(sel)].filter((x) => !/^(select|input|option)$/i.test(x.tagName));
      nodes.forEach((x, i) => x.setAttribute('data-vb', label + '|' + i));
      return nodes.length;
    }, { sel: selector, label });
    for (let i = 0; i < n; i++) {
      const tag = label + '|' + i;
      await quiet();
      const ok = await page.evaluate((t) => {
        const node = document.querySelector('[data-vb="' + CSS.escape(t) + '"]');
        if (!node || node.disabled || node.getAttribute('aria-disabled') === 'true') return false;
        node.scrollIntoView({ block: 'center' });
        return true;
      }, tag);
      if (!ok) continue;
      await new Promise((r) => setTimeout(r, 180));
      await page.evaluate(() => window.__reset());
      await page.evaluate((t) => {
        const node = document.querySelector('[data-vb="' + CSS.escape(t) + '"]');
        node && node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }, tag);
      // certains effets sont asynchrones (toBlob, fetch) : on laisse jusqu'a 3 s
      let r = { mut: 0, side: [] };
      for (let k = 0; k < 12; k++) {
        await new Promise((res) => setTimeout(res, 250));
        r = await page.evaluate((t) => {
          const node = document.querySelector('[data-vb="' + CSS.escape(t) + '"]');
          return { mut: window.__mut, side: window.__side.slice(0, 3), gone: !node, label: node ? (node.textContent || '').trim().slice(0, 40) : '' };
        }, tag);
        if (r.mut > 0 || r.side.length || r.gone) break;
      }
      if (r.mut === 0 && !r.side.length && !r.gone) {
        const why = await page.evaluate(() => ({
          toasts: !!document.getElementById('toasts'),
          shell: !!document.getElementById('chat-scroll'),
          vis: !document.getElementById('panel') || true,
        }));
        dead.push(label + ' #' + i + ' « ' + r.label + ' »' + (why.toasts && why.shell ? ' [état ok → bouton réellement inerte]' : ' [interface re-rendue]'));
      }
      await page.evaluate(() => {
        document.querySelectorAll('.overlay').forEach((o) => o.remove());
        document.querySelectorAll('.popmenu').forEach((o) => o.remove());
        document.querySelectorAll('.toast').forEach((o) => o.remove());
      });
      await new Promise((r) => setTimeout(r, 120));
    }
    console.log(label + ' → ' + n + ' boutons testés');
  };

  await scan('accueil', '#landing button, #lp-nav button');
  await scan('en-tete + barre laterale', '#chat-header button, #sidebar button, .side-foot button');
  await scan('composeur', '#composer button');
  for (const panel of ['personalize', 'global', 'ai', 'modes', 'history', 'memory', 'console', 'bridge']) {
    await page.evaluate((p) => window.App.showPanel(p), panel);
    await new Promise((r) => setTimeout(r, 600));
    const dup = await page.evaluate(() => {
      const b = document.getElementById('panel-body');
      const s = [...b.querySelectorAll(':scope > *')];
      return s.length;
    });
    if (dup > 1) dead.push('réglages:' + panel + ' → ' + dup + ' blocs rendus en double');
    await scan('reglages:' + panel, '#panel-body button');
  }
  for (const tab of ['multitask', 'image', 'video', 'offline']) {
    await page.evaluate((tb) => { window.App.togglePanel(false); window.Chat.setTab(tb); }, tab);
    await new Promise((r) => setTimeout(r, 900));
    await scan('onglet:' + tab, '#chat-scroll button, #chat-scroll select');
  }

  const native = await page.evaluate(() => window.__native || []);
  console.log('invites natives appelées :', native.length ? '❌ ' + native.join(' | ') : '✅ aucune');
  if (native.length) errors.push('invites natives: ' + native.slice(0, 4).join(', '));
  if (dead.length) console.log('❌ boutons sans effet (' + dead.length + ') :\n - ' + [...new Set(dead)].join('\n - '));
  else console.log('✅ aucun bouton sans effet');
  if (errors.length) console.log('❌ erreurs JS :', [...new Set(errors)].slice(0, 6).join(' | '));
  await browser.close();
  process.exit(dead.length || native.length || errors.length ? 1 : 0);
})().catch((e) => { console.error('ERREUR:', e.message.split('\n')[0]); process.exit(1); });
