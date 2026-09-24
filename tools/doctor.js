#!/usr/bin/env node
// Diagnostic JARVIS : vérifie Node, réseau OpenRouter, serveur local et pont local.
const os = require('os');
const PORT = Number(process.env.PORT || 8787);
const BASE = process.env.JARVIS_URL || `http://localhost:${PORT}`;
const lang = (process.env.JARVIS_LANG || 'fr').slice(0, 2);
const T = {
  fr: {
    node: 'Node.js', need: 'requis : v18 ou plus', net: 'Accès réseau à openrouter.ai',
    server: 'Serveur JARVIS local', bridge: 'Pont local (agent sur le PC)',
    key: 'Clé OpenRouter (OPENROUTER_API_KEY)', ok: 'OK', ko: 'ÉCHEC', warn: 'À VERIFIER',
    nonet: "Pas d'accès à openrouter.ai : les modèles, le chat et les images ne fonctionneront pas ici.",
    noserver: 'Lancez le serveur : node server/index.js',
    nobridge: "Normal si vous n'avez pas encore exécuté JARVIS-Setup.bat (l'IA ne pourra pas agir sur le PC).",
    nokey: 'Facultatif : la clé se saisit dans le site (étape 2).',
    url: 'Ouvrez', done: 'Diagnostic terminé.',
  },
  en: {
    node: 'Node.js', need: 'required: v18+', net: 'Network access to openrouter.ai',
    server: 'Local JARVIS server', bridge: 'Local bridge (PC agent)',
    key: 'OpenRouter key (OPENROUTER_API_KEY)', ok: 'OK', ko: 'FAIL', warn: 'CHECK',
    nonet: 'No access to openrouter.ai: models, chat and images will not work here.',
    noserver: 'Start the server: node server/index.js',
    nobridge: 'Normal if you have not run JARVIS-Setup.bat yet (the AI could not act on your PC).',
    nokey: 'Optional: the key is entered on the website (step 2).',
    url: 'Open', done: 'Diagnostic complete.',
  },
  es: {
    node: 'Node.js', need: 'requerido: v18+', net: 'Acceso de red a openrouter.ai',
    server: 'Servidor JARVIS local', bridge: 'Puente local (agente en el PC)',
    key: 'Clave OpenRouter (OPENROUTER_API_KEY)', ok: 'OK', ko: 'FALLO', warn: 'REVISAR',
    nonet: 'Sin acceso a openrouter.ai: los modelos, el chat y las imágenes no funcionarán aquí.',
    noserver: 'Arranca el servidor: node server/index.js',
    nobridge: 'Normal si aún no has ejecutado JARVIS-Setup.bat (la IA no podrá actuar en tu PC).',
    nokey: 'Opcional: la clave se introduce en el sitio (paso 2).',
    url: 'Abre', done: 'Diagnóstico completado.',
  },
  it: {
    node: 'Node.js', need: 'richiesto: v18+', net: 'Accesso di rete a openrouter.ai',
    server: 'Server JARVIS locale', bridge: 'Ponte locale (agente sul PC)',
    key: 'Chiave OpenRouter (OPENROUTER_API_KEY)', ok: 'OK', ko: 'FALLITO', warn: 'DA CONTROLLARE',
    nonet: "Nessun accesso a openrouter.ai: modelli, chat e immagini non funzioneranno qui.",
    noserver: 'Avvia il server: node server/index.js',
    nobridge: 'Normale se non hai ancora eseguito JARVIS-Setup.bat (l\'IA non potrà agire sul PC).',
    nokey: 'Facoltativo: la chiave si inserisce nel sito (passo 2).',
    url: 'Apri', done: 'Diagnostica completata.',
  },
}[lang] || {};

function line(status, label, detail) {
  const icon = status === 'ok' ? '✅' : status === 'warn' ? '⚠️ ' : '❌';
  console.log(`${icon} ${label}${detail ? ' — ' + detail : ''}`);
}

(async () => {
  console.log('\n=== JARVIS — diagnostic / diagnostic ===\n');

  const major = Number(process.versions.node.split('.')[0]);
  line(major >= 18 ? 'ok' : 'ko', `${T.node} v${process.versions.node}`, T.need);

  try {
    const r = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(10000) });
    const j = await r.json();
    const count = (j.data || []).length;
    line('ok', T.net, `${count} models`);
  } catch (e) {
    line('ko', T.net, String(e.message || e));
    console.log('   ℹ️  ' + T.nonet);
  }

  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) });
    const j = await r.json();
    line('ok', T.server, `${BASE} · v${j.version}`);
  } catch {
    line('ko', T.server, BASE);
    console.log('   ℹ️  ' + T.noserver);
  }

  try {
    const r = await fetch(`${BASE}/api/bridge/status`, { signal: AbortSignal.timeout(5000) });
    const j = await r.json();
    if (j.online) line('ok', T.bridge, `session ${j.sessions?.[0]?.id || ''}`);
    else { line('warn', T.bridge, ''); console.log('   ℹ️  ' + T.nobridge); }
  } catch { line('warn', T.bridge, ''); }

  const key = process.env.OPENROUTER_API_KEY;
  if (key) {
    try {
      const r = await fetch(`${BASE}/api/test-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }), signal: AbortSignal.timeout(20000) });
      const j = await r.json();
      line(j.ok ? 'ok' : 'ko', T.key, `HTTP ${j.status} · ${j.latency} ms`);
    } catch (e) { line('warn', T.key, String(e.message || e)); }
  } else {
    line('warn', T.key, '');
    console.log('   ℹ️  ' + T.nokey);
  }

  console.log(`\n${T.url} ${BASE}\n${T.done}\n`);
})();
