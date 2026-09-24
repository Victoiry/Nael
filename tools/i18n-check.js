// Vérifie que TOUTES les clés i18n utilisées existent dans les 4 langues
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

global.window = {};
require(path.join(ROOT, 'public/js/i18n.js'));
const I18N = global.window.I18N;
const LANGS = ['fr', 'en', 'es', 'it'];

const used = new Set();
for (const f of ['public/index.html']) {
  const txt = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of txt.matchAll(/data-i18n(?:-ph|-title)?="([^"]+)"/g)) used.add(m[1]);
}
for (const f of fs.readdirSync(path.join(ROOT, 'public/js'))) {
  if (f === 'i18n.js') continue;
  const txt = fs.readFileSync(path.join(ROOT, 'public/js', f), 'utf8');
  for (const m of txt.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)) used.add(m[1]);
  for (const m of txt.matchAll(/'(set|nav|tab|mode|model|paid|batch|voice|live|img|vid|qual|cmp|off|priv|rag|skill|approval|memory|hist|console|bridge|toast|common|auth|land|lp)\.[a-zA-Z0-9_.]+'/g)) used.add(m[0].slice(1, -1));
}

let problems = 0;
const missing = {};
const isDynamic = (k) => k.endsWith('.');
for (const l of LANGS) {
  missing[l] = [...used].filter((k) => !isDynamic(k) && I18N[l][k] === undefined);
  if (missing[l].length) problems += missing[l].length;
}
const keysByLang = LANGS.map((l) => `${l}:${Object.keys(I18N[l]).length}`).join(' ');

used.delete('nav.');
console.log(`Clés utilisées : ${used.size} · Clés par langue → ${keysByLang}`);
for (const l of LANGS) {
  if (missing[l].length) console.log(`❌ ${l} — ${missing[l].length} manquante(s) : ${missing[l].slice(0, 12).join(', ')}`);
  else console.log(`✅ ${l} — complete`);
}
// langues incomplètes entre elles
const fr = new Set(Object.keys(I18N.fr));
for (const l of LANGS.filter((x) => x !== 'fr')) {
  const diff = [...fr].filter((k) => I18N[l][k] === undefined);
  if (diff.length) { console.log(`⚠️  ${l} — ${diff.length} clé(s) de moins que fr : ${diff.slice(0, 10).join(', ')}`); problems++; }
}
console.log(problems ? '\n❌ PROBLEMES DE TRADUCTION' : '\n✅ traductions completes et coherentes');
process.exit(problems ? 1 : 0);
