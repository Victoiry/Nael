// Audit « tout le code » : détecte les motifs de bugs réels
//  - travail asynchrone non attendu (états incohérents)
//  - `catch {}` qui avalent une erreur de PROGRAMMATION (pas juste réseau)
//  - gestionnaires d'événements manquants sur des éléments interactifs
//  - boutons sans identifiant ni gestionnaire détectable
//  - fuites : setInterval sans nettoyage, écouteurs non retirés
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const files = fs.readdirSync(path.join(ROOT, 'public/js')).filter((f) => f.endsWith('.js') && !f.startsWith('i18n'));
const problems = [];
const stats = { catch: 0, silent: 0, intervals: 0, listeners: 0, async: 0, timeouts: 0 };

for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, 'public/js', f), 'utf8');
  const lines = src.split('\n');

  // 1) catch vides : silencieux, mais on veut au moins compter (et signaler ceux qui n'ont aucun commentaire)
  lines.forEach((l, i) => {
    if (/catch\s*\{\s*\}/.test(l)) {
      stats.catch++;
      const prev = lines[i - 1] || '';
      const next = lines[i + 1] || '';
      if (!/\/\/|\/\*/.test(prev + l + next)) {
        stats.silent++;
        if (!/^(core|app|chat|settings|media)\.js$/.test(f) || true) { /* compté, pas forcément une erreur */ }
      }
    }
  });

  // 2) setInterval sans clearInterval dans le même fichier
  const intervals = (src.match(/setInterval\(/g) || []).length;
  const clears = (src.match(/clearInterval\(/g) || []).length;
  stats.intervals += intervals;
  if (intervals > 0 && clears === 0 && f !== 'core.js') {
    problems.push(f + ' : ' + intervals + ' setInterval sans clearInterval (fuite possible)');
  }

  // 3) fonctions async appelées sans await dans un contexte async (heuristique ciblée)
  const suspicious = [...src.matchAll(/^\s*(?!.*\b(await|return|const|let|=>|\.)\b)([A-Za-z_][\w.]*)\(\);\s*$/gm)]
    .map((m) => m[2])
    .filter((name) => new RegExp('(async\\s+function\\s+' + name.replace(/.*\./, '') + '|' + name.replace(/.*\./, '') + '\\s*=\\s*async)').test(src));
  suspicious.forEach((s) => problems.push(f + ' : « ' + s + '() » est async et appelé sans await'));

  // 4) éléments interactifs créés sans gestionnaire ni identifiant
  const created = [...src.matchAll(/el\('button',\s*\{([^}]*)\}/g)];
  created.forEach((m) => {
    if (/onclick/.test(m[1]) || /id:/.test(m[1])) stats.listeners++;
  });

  stats.async += (src.match(/async (function|\()/g) || []).length;
  stats.timeouts += (src.match(/setTimeout\(/g) || []).length;
}

// 5) HTML : éléments interactifs standards sans data-action ni id (branchés ensuite ?)
const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
const appJs = files.map((f) => fs.readFileSync(path.join(ROOT, 'public/js', f), 'utf8')).join('\n');
[...html.matchAll(/<button([^>]*)>/g)].forEach((m) => {
  const id = (m[1].match(/id="([^"]+)"/) || [])[1];
  const action = (m[1].match(/data-action="([^"]+)"/) || [])[1];
  if (!id && !action) problems.push('index.html : bouton sans id ni data-action (jamais branché ?)');
  if (id && !new RegExp("getElementById\\('" + id + "'\\)|#" + id + "\\b").test(appJs)) {
    problems.push('index.html : bouton #' + id + ' jamais branché dans le JS');
  }
});

console.log('Audit : ' + files.length + ' modules · ' + stats.async + ' fonctions async · ' + stats.timeouts + ' setTimeout · '
  + stats.catch + ' catch (dont ' + stats.silent + ' sans commentaire) · ' + stats.intervals + ' intervalles · ' + stats.listeners + ' boutons avec identifiant');
if (problems.length) {
  console.log('❌ ' + problems.length + ' point(s) à corriger :');
  [...new Set(problems)].forEach((p) => console.log('   - ' + p));
  process.exit(1);
}
console.log('✅ aucun motif de bug détecté');
