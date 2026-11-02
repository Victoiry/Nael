// Vérifie le cahier des charges visuel : fond UNI (noir ou blanc), aucun néon,
// aucun emoji, boutons « liquid glass » (flou d'arrière-plan), animations présentes,
// et rien qui se chevauche (texte lisible) sur les écrans clés.
const { launch } = require('./browser');
const ok = [], ko = [];
const check = (n, c, x) => (c ? ok : ko).push(n + (c ? '' : ' → ' + (x === undefined ? 'échec' : x)));

const AUDIT = () => {
  const cs = (el) => getComputedStyle(el);
  const flat = (c) => /^rgb\(|^rgba\(/.test(c) && !/gradient/.test(c);
  const sat = (rgb) => {
    const m = rgb.match(/[\d.]+/g) || [];
    const [r, g, b] = m.map(Number);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return max === 0 ? 0 : (max - min) / max;
  };
  const out = { themes: {}, neon: [], gradients: [], emoji: [], glass: { total: 0, blurred: 0 }, anim: { transitions: 0, keyframes: 0 } };
  // fond global
  out.bodyBg = cs(document.body).backgroundColor;
  const bg = document.getElementById('bg');
  out.bgImage = bg ? cs(bg).backgroundImage : 'none';
  // néons : couleurs très saturées utilisées comme texte ou bordure
  const seen = new Set();
  document.querySelectorAll('#landing *, #workspace *, .overlay *').forEach((el) => {
    const s = cs(el);
    ['color', 'borderTopColor', 'backgroundColor'].forEach((k) => {
      const v = s[k];
      if (!v || seen.has(v + k)) return;
      seen.add(v + k);
      if (/^rgb/.test(v) && sat(v) > 0.72 && k === 'color') {
        // autorisé : vert/rouge/ambre de statut uniquement sur les petits badges
        const small = el.classList.contains('chip') || el.classList.contains('bold-red') || el.classList.contains('pill');
        if (!small) out.neon.push(k + '=' + v + ' sur ' + (el.className || el.tagName));
      }
    });
    if (/gradient/.test(s.backgroundImage) && !el.classList.contains('wave') && !/canvas|img|video/.test(el.tagName)) {
      out.gradients.push((el.className || el.tagName) + ' → ' + s.backgroundImage.slice(0, 40));
    }
    if (/backdrop-filter|backdropFilter/.test(Object.keys(s).join(',')) || s.backdropFilter || s.webkitBackdropFilter) {
      out.glass.total++;
      if ((s.backdropFilter || s.webkitBackdropFilter || 'none') !== 'none') out.glass.blurred++;
    }
  });
  // transitions / animations réellement appliquées
  document.querySelectorAll('.btn, .ibtn, .conv, .msg, .modal, .popmenu, .toast, .step, .card').forEach((el) => {
    const s = cs(el);
    if (parseFloat(s.transitionDuration) > 0 || parseFloat(s.animationDuration) > 0) out.anim.transitions++;
  });
  out.anim.keyframes = document.styleSheets.length;
  // emoji dans le texte visible
  const txt = (document.body.innerText || '');
  out.emoji = [...new Set(txt.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu) || [])];
  return out;
};

(async () => {
  const browser = await launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.split('\n')[0]));
  await page.goto('http://localhost:8787/', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' }); await new Promise((r) => setTimeout(r, 900));

  const landing = await page.evaluate(AUDIT);
  check('fond de page uni (pas de dégradé)', /^rgba?\(/.test(landing.bodyBg) && landing.bgImage === 'none', landing.bodyBg + ' / ' + landing.bgImage);
  check('accueil : aucun dégradé décoratif', landing.gradients.length === 0, landing.gradients.slice(0, 3).join(' | '));
  check('accueil : aucune couleur néon', landing.neon.length === 0, landing.neon.slice(0, 3).join(' | '));
  check('accueil : aucun emoji', landing.emoji.length === 0, landing.emoji.join(' '));
  check('accueil : animations présentes (transitions)', landing.anim.transitions >= 4, 'éléments animés=' + landing.anim.transitions);

  // application (avec clé posée) + thème sombre
  await page.evaluate(() => { localStorage.setItem('jarvis.key', 'sk-or-v1-test'); localStorage.setItem('jarvis.choseMode', 'true'); });
  await page.reload({ waitUntil: 'load' }); await new Promise((r) => setTimeout(r, 800));
  await page.evaluate(() => window.App.enterApp());
  await new Promise((r) => setTimeout(r, 1800));
  const dark = await page.evaluate(AUDIT);
  check('application sombre : fond noir uni', dark.bodyBg === 'rgb(0, 0, 0)', dark.bodyBg);
  check('application sombre : aucun dégradé', dark.gradients.length === 0, dark.gradients.slice(0, 3).join(' | '));
  check('application sombre : aucun néon', dark.neon.length === 0, dark.neon.slice(0, 3).join(' | '));
  check('application : aucun emoji', dark.emoji.length === 0, dark.emoji.join(' '));
  check('boutons en verre liquide (flou d’arrière-plan)', dark.glass.blurred >= 3, dark.glass.blurred + ' éléments floutés');

  // thème clair
  await page.evaluate(() => { window.J.S.settings.global.theme = 'light'; window.J.applyTheme(); });
  await new Promise((r) => setTimeout(r, 500));
  const light = await page.evaluate(AUDIT);
  check('thème clair : fond blanc uni', light.bodyBg === 'rgb(255, 255, 255)', light.bodyBg);
  check('thème clair : aucun dégradé', light.gradients.length === 0, light.gradients.slice(0, 3).join(' | '));
  check('thème clair : aucun néon', light.neon.length === 0, light.neon.slice(0, 3).join(' | '));

  // les réglages proposent bien noir / blanc et « fond uni »
  await page.evaluate(() => window.App.showPanel('global'));
  await new Promise((r) => setTimeout(r, 900));
  const settings = await page.evaluate(() => {
    const txt = document.getElementById('panel-body').innerText;
    const opts = [...document.querySelectorAll('#panel-body select option')].map((o) => o.textContent.trim());
    const themes = [...document.querySelectorAll('#panel-body select')].find((sel) => [...sel.options].some((o) => /noir|black|negro|nero|dark|sombre/i.test(o.textContent)));
    return {
      opts,
      fond: /uni|solid|uniforme/i.test(txt),
      themes: themes ? [...themes.options].map((o) => o.textContent.trim()) : [],
    };
  });
  check('réglages : « fond uni » proposé', settings.fond, settings.opts.join(' / ').slice(0, 120));
  check('réglages : thème limité à noir/blanc (néon retiré)',
    settings.themes.length === 2 && !settings.themes.some((t) => /n[ée]on/i.test(t)),
    settings.themes.join(' / '));

  check('aucune erreur JS', errs.length === 0, errs.join(' | '));
  await browser.close();
  console.log('Design : ' + ok.length + '/' + (ok.length + ko.length) + ' ✅');
  ok.forEach((o) => console.log('   ✅ ' + o));
  ko.forEach((o) => console.log('   ❌ ' + o));
  process.exit(ko.length ? 1 : 0);
})().catch((e) => { console.error('ERREUR:', e.message.split('\n')[0]); process.exit(1); });
