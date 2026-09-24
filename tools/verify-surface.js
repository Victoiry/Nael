// Audit statique du code : detecte les appels morts (methodes qui n'existent plus,
// elements HTML references mais absents) — la cause n°1 des « boutons qui ne font rien ».
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const jsFiles = fs.readdirSync(path.join(ROOT, 'public/js')).filter((f) => f.endsWith('.js'));
const app = jsFiles.map((f) => ({ f, src: read('public/js/' + f) }));
const all = app.map((a) => a.src).join('\n');
const html = read('public/index.html');
const problems = [];

// ---------- 1) surface de l'API OpenRouter (ORapi + OR)
const coreSrc = read('public/js/core.js');
const orSrc = read('public/js/openrouter.js');
const orapiBlock = coreSrc.slice(coreSrc.indexOf('const ORapi = {'));
const orapiDef = new Set([
  ...[...orapiBlock.matchAll(/\n\s{4}(?:async\s+)?([a-zA-Z_]\w*)\s*\(/g)].map((m) => m[1]),   // méthodes
  ...[...orapiBlock.matchAll(/\n\s{4}([a-zA-Z_]\w*)\s*:/g)].map((m) => m[1]),                 // propriétés
]);
const orDef = new Set([
  ...[...orSrc.matchAll(/\n\s{2}(?:async\s+)?function\s+([a-zA-Z_]\w*)/g)].map((m) => m[1]),
  ...[...orSrc.matchAll(/\bOR\.([a-zA-Z_]\w*)\s*=/g)].map((m) => m[1]),
  ...[...orSrc.matchAll(/window\.OR\s*=\s*\{([^}]*)\}/g)].flatMap((m) => m[1].split(',').map((x) => x.split(':')[0].trim())).filter(Boolean),
  'state',
]);
const usedOr = new Set([...all.matchAll(/(?:window\.)?ORapi\.([a-zA-Z_]\w*)/g)].map((m) => m[1]));
const usedOrClient = new Set([...all.matchAll(/(?:window\.)?OR\.([a-zA-Z_]\w*)/g)].map((m) => m[1]));
usedOr.forEach((n) => { if (!orapiDef.has(n)) problems.push('ORapi.' + n + ' est appelé mais n’existe pas dans core.js'); });
usedOrClient.forEach((n) => { if (!orDef.has(n)) problems.push('OR.' + n + ' est appelé mais n’existe pas dans openrouter.js'); });

// ---------- 2) helpers J.xxx exportes par core.js
const expBlock = coreSrc.slice(coreSrc.lastIndexOf('window.J = {'), coreSrc.indexOf('\n  };', coreSrc.lastIndexOf('window.J = {')));
const expDef = new Set([
  ...expBlock.matchAll(/(?:^|[{,])\s*([a-zA-Z_]\w*)\s*(?=[,}])/g),
  ...expBlock.matchAll(/get\s+([a-zA-Z_]\w*)\s*\(/g),
].map((m) => m[1]).map((x) => (typeof x === 'string' ? x : x[1])).filter(Boolean));
[...all.matchAll(/(?<![\w.$])(?:window\.)?J\.([a-zA-Z_]\w*)/g)].map((m) => m[1]).forEach((n) => {
  if (!expDef.has(n)) problems.push('J.' + n + ' est utilisé mais n’est pas exporté par core.js');
});

// ---------- 3) getElementById / querySelector('#id') -> l'element existe-t-il vraiment ?
const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const jsIds = new Set([...all.matchAll(/\bid:\s*'([^']+)'/g), ...all.matchAll(/\bid:\s*"([^"]+)"/g)].map((m) => m[1]));
const known = new Set([...htmlIds, ...jsIds]);
const referenced = new Set([
  ...[...all.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]),
  ...[...all.matchAll(/querySelector\(['"]#([A-Za-z][\w-]*)['"]\)/g)].map((m) => m[1]),
]);
const OPTIONAL_IDS = ['studio'];   // créés uniquement dans certains onglets (garde `if (x)`)
referenced.forEach((id) => {
  const dyn = jsIds.has(id) || OPTIONAL_IDS.includes(id);
  if (!htmlIds.has(id) && !dyn) problems.push('#' + id + ' est utilisé dans le JS mais n’existe pas dans index.html');
});

// ---------- 4) data-action de l'accueil -> un gestionnaire doit être branché
const actions = [...html.matchAll(/data-action="([^"]+)"/g)].map((m) => m[1]);
[...new Set(actions)].forEach((a) => {
  const wired = new RegExp("data-action=\\\\\"?" + a + "|dataset\\.action|'\\[data-action").test(all) && all.includes('data-action');
  if (!wired) problems.push('data-action="' + a + '" sans gestionnaire de clic');
});

console.log('Surface ORapi : ' + usedOr.size + ' appels · client OR : ' + usedOrClient.size + ' appels · J.x : ' + expDef.size + ' exports');
console.log('Éléments HTML : ' + htmlIds.size + ' · référencés dans le JS : ' + referenced.size + ' · actions : ' + [...new Set(actions)].join(', '));
if (problems.length) {
  console.log('❌ ' + problems.length + ' incohérence(s) :');
  [...new Set(problems)].forEach((p) => console.log('   - ' + p));
  process.exit(1);
}
console.log('✅ aucun appel mort, aucun élément manquant');
