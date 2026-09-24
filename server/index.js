// JARVIS server — zero dependency Node HTTP server (+ optional express if installed)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const store = require('./lib/store');
const auth = require('./lib/auth');
const or = require('./lib/openrouter');
const bridge = require('./lib/bridge');
const agent = require('./lib/agent');
const security = require('./lib/security');
const tasks = require('./lib/router-tasks');

const PORT = Number(process.env.PORT || 8787);
const PUBLIC = path.join(__dirname, '..', 'public');
const BRIDGE_DIR = path.join(__dirname, '..', 'bridge');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.map': 'application/json',
};

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function readBody(req, limit = 25 * 1024 * 1024) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > limit) { req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}
function bearer(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  const t = m ? m[1] : (req.headers['x-jarvis-auth'] || '');
  return auth.verify(t);
}
function keyOf(req, body) {
  return (body && body.key) || req.headers['x-openrouter-key'] || process.env.OPENROUTER_API_KEY || '';
}
function openRouterKey(userEmail) {
  const cloud = auth.loadCloud(userEmail) || {};
  return cloud.openrouterKey || '';
}

// ---------------------------------------------------------------- SSE helpers
function sseStart(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  return (event, data) => { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
}

// ---------------------------------------------------------------- chat route
async function handleChat(req, res, user) {
  const body = await readBody(req);
  const key = keyOf(req, body) || openRouterKey(user.email);
  if (!key) return json(res, 400, { error: 'no_key' });
  const send = sseStart(res);
  const profile = body.profile || {};
  const effort = agent.EFFORTS[body.effort] ? body.effort : 'normal';
  const eff = agent.EFFORTS[effort];
  const isAgent = body.mode === 'agent';
  const model = body.model || 'meta-llama/llama-3.3-70b-instruct:free';

  let messages = [];
  if (body.systemOverride) messages.push({ role: 'system', content: body.systemOverride });
  else messages.push({ role: 'system', content: agent.buildSystemPrompt(profile, { mode: body.mode, approvalMode: tasks.approvalMode(user.email), visionWarning: body.visionWarning }) });
  for (const m of body.messages || []) messages.push({ role: m.role, content: m.content });

  const abort = { done: false };
  req.on('close', () => { abort.done = true; });

  try {
    if (!isAgent) {
      const temp = Number.isFinite(Number(body.temperature)) && body.temperature !== undefined && body.temperature !== null ? Number(body.temperature) : eff.temperature;
      for await (const chunk of or.streamChat(key, { model, messages, temperature: temp, maxTokens: Math.min(eff.maxTokens, Number(body.maxTokens) || eff.maxTokens) })) {
        if (abort.done) break;
        if (chunk.reasoning) send('reasoning', { text: chunk.reasoning });
        if (chunk.content) send('delta', { text: chunk.content });
        if (chunk.usage) send('usage', chunk.usage);
      }
      send('done', { ok: true });
      return res.end();
    }

    // ---- AGENT MODE: tool loop
    let turns = 0;
    const maxTurns = Math.min(12, Math.max(2, Math.round(eff.maxTokens / 700)));
    while (turns++ < maxTurns && !abort.done) {
      const calls = [];
      let text = '';
      for await (const chunk of or.streamChat(key, { model, messages, temperature: eff.temperature, maxTokens: eff.maxTokens, tools: agent.TOOLS })) {
        if (abort.done) break;
        if (chunk.content) { text += chunk.content; send('delta', { text: chunk.content }); }
        if (chunk.toolCalls) {
          for (const tc of chunk.toolCalls) {
            const idx = tc.index != null ? tc.index : calls.length;
            calls[idx] = calls[idx] || { id: tc.id, type: 'function', function: { name: '', arguments: '' } };
            if (tc.id) calls[idx].id = tc.id;
            if (tc.function?.name) calls[idx].function.name += tc.function.name;
            if (tc.function?.arguments) calls[idx].function.arguments += tc.function.arguments;
          }
        }
      }
      if (!calls.length) break;
      messages.push({ role: 'assistant', content: text || null, tool_calls: calls });

      for (const call of calls) {
        if (!call) continue;
        let args = {};
        try { args = JSON.parse(call.function.arguments || '{}'); } catch {}
        const name = call.function.name;
        send('tool', { id: call.id, name, args, phase: 'start' });
        const out = await runTool({ name, args, user, send, sessionId: body.sessionId });
        send('tool', { id: call.id, name, args, phase: 'end', result: typeof out === 'string' ? out.slice(0, 4000) : out });
        messages.push({ role: 'tool', tool_call_id: call.id, content: typeof out === 'string' ? out : JSON.stringify(out) });
      }
    }
    send('done', { ok: true });
    res.end();
  } catch (e) {
    try {
      // le serveur n'a pas pu joindre OpenRouter : le navigateur peut réessayer en direct
      if (e && e.offline) send('offline', { message: String(e.message || e) });
      else send('error', { message: String(e.message || e), status: e && e.status });
      res.end();
    } catch { res.end(); }
  }
}

async function runTool({ name, args, user, send, sessionId }) {
  const sid = sessionId;
  const mk = (type, payload, risk) => tasks.requestTask({ sessionId: sid, type, payload, risk, email: user.email, needsApproval: false });

  if (name === 'screenshot' || name === 'send_screen_content') {
    const p = mk('screenshot', {}, 'safe');
    const r = await tasks.waitFor(p, 20000);
    if (r.result?.image) { send('screen', { image: r.result.image, summary: args.summary || '' }); bridge.state.lastScreenshot = r.result.image; }
    return r.result?.output || (r.offline ? 'bridge offline' : 'no screenshot');
  }
  if (name === 'list_dir' || name === 'read_file') return runApproved('list_dir' === name ? 'list_dir' : 'read_file', { path: args.path }, 'safe');
  if (name === 'web_search') return runApproved('web_search', { query: args.query }, 'safe');
  if (name === 'open_url') return runApproved('open_url', { url: args.url }, 'medium');
  if (name === 'calendar_add') return runApproved('calendar_add', { title: args.title, when: args.when }, 'medium');
  if (name === 'write_file') {
    const decision = await askUser({ user, send, command: `write ${args.path}`, risk: 'medium', family: 'write_file', payload: { path: args.path, content: args.content }, type: 'write_file' });
    if (!decision.allowed) return 'user denied the write';
    return runApproved('write_file', { path: args.path, content: args.content }, 'medium');
  }
  if (name === 'run_command') {
    const risk = security.classify(args.command);
    const fam = security.family(args.command);
    if (tasks.isAlwaysAllowed(user.email, fam)) {
      send('tool', { name, phase: 'auto', args, result: `allowed (${fam})` });
      return runApproved('run', { command: args.command, cwd: args.cwd }, risk);
    }
    const decision = await askUser({ user, send, command: args.command, risk, family: fam, payload: { command: args.command, cwd: args.cwd }, type: 'run' });
    if (!decision.allowed) return 'user denied the command';
    if (decision.always) tasks.addAlwaysAllowed(user.email, fam);
    return runApproved('run', { command: args.command, cwd: args.cwd }, risk);
  }
  return 'unknown tool';

  async function runApproved(type, payload, risk) {
    const p = mk(type, payload, risk);
    const r = await tasks.waitFor(p);
    if (r.denied) return 'denied by user';
    if (r.offline) return 'BRIDGE OFFLINE: the local runner is not connected. Tell the user to start JARVIS Bridge.';
    if (r.timeout) return 'timeout: no answer from the local bridge';
    return r.result?.output || 'done';
  }

  async function askUser({ command, risk, family, payload, type }) {
    const pending = tasks.requestTask({ sessionId: sid, type, payload, risk, email: user.email, needsApproval: true });
    pending.command = command;
    pending.family = family;
    send('approval', { id: pending.id, command, risk, family });
    const r = await tasks.waitFor(pending, 300000);
    if (r.result) return { allowed: pending.status !== 'denied', always: pending.status === 'always' };
    return { allowed: false };
  }
}

// ---------------------------------------------------------------- bridge
function serveRunnerTemplate(res, req, url) {
  const tpl = fs.readFileSync(path.join(BRIDGE_DIR, 'runner.js'), 'utf8');
  res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
  res.end(tpl);
}

function sendBat(res, tplName, vars, filename) {
  const tpl = fs.readFileSync(path.join(BRIDGE_DIR, tplName), 'utf8');
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) out = out.split(k).join(String(v));
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
  res.end('\ufeff' + out.replace(/\n/g, '\r\n'));
}

// sonde OpenRouter en arrière-plan (résultat exposé par /api/health)
let orProbeCache = { ok: null, checkedAt: 0 };
async function refreshOrProbe() {
  try { orProbeCache = { ...(await or.probe(6000)), checkedAt: Date.now() }; }
  catch (e) { orProbeCache = { ok: false, error: or.describe(e), checkedAt: Date.now() }; }
}
setTimeout(refreshOrProbe, 1200);
setInterval(refreshOrProbe, 5 * 60 * 1000).unref?.();

function baseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

// ---------------------------------------------------------------- API
async function api(req, res, url) {
  const { pathname } = url;
  const p = pathname.replace(/^\/api/, '');

  if (p === '/health') return json(res, 200, { ok: true, name: 'JARVIS', version: '2.0.0', bridge: bridge.state.sessions.size > 0, uptime: process.uptime(), openrouter: orProbeCache });

  // ---- auth
  if (p === '/auth/register' && req.method === 'POST') {
    const b = await readBody(req);
    const r = auth.register(b.email, b.password, b.name);
    return json(res, r.error ? 400 : 200, r);
  }
  if (p === '/auth/login' && req.method === 'POST') {
    const b = await readBody(req);
    const r = auth.login(b.email, b.password);
    return json(res, r.error ? 401 : 200, r);
  }
  if (p === '/auth/guest' && req.method === 'POST') {
    return json(res, 200, auth.issueGuest());
  }
  const user = bearer(req);
  if (p === '/auth/me') return json(res, 200, { user: user ? { email: user.sub, name: user.name } : null });

  if (p === '/auth/cloud' && req.method === 'GET') {
    if (!user) return json(res, 401, { error: 'auth' });
    return json(res, 200, { cloud: auth.loadCloud(user.sub) });
  }
  if (p === '/auth/cloud' && req.method === 'POST') {
    if (!user) return json(res, 401, { error: 'auth' });
    const b = await readBody(req);
    if (!auth.get(user.sub)) return json(res, 200, { ok: false, guest: true });
    auth.saveCloud(user.sub, b.key, b.value);
    return json(res, 200, { ok: true });
  }
  if (p === '/auth/provision' && req.method === 'POST') {
    if (!user) return json(res, 401, { error: 'auth' });
    const b = await readBody(req);
    if (!auth.get(user.sub)) return json(res, 200, { ok: true, guest: true });
    auth.saveCloud(user.sub, 'openrouterKey', b.key || '');
    auth.saveCloud(user.sub, 'openrouterModel', b.model || '');
    return json(res, 200, { ok: true });
  }

  // ---- models & key test
  if (p === '/models') {
    const key = url.searchParams.get('key') || (user && openRouterKey(user.sub)) || '';
    const force = url.searchParams.get('force') === '1';
    const r = await or.listModels(key, { force });
    return json(res, 200, {
      // la liste vient toujours de l'API OpenRouter ; rien n'est pré-écrit ici
      models: r.models || [],
      source: r.source || (r.offline ? 'offline' : 'live'),
      offline: !!r.offline,
      error: r.error || null,
      count: (r.models || []).length,
      docs: 'https://openrouter.ai/docs/features/model-routing',
      pricing: 'https://openrouter.ai/models?order=pricing-low-to-high',
    });
  }
  // le serveur peut-il joindre openrouter.ai ? (sinon le navigateur prend le relais)
  if (p === '/or-probe') {
    const r = await or.probe(Number(url.searchParams.get('timeout')) || 6000);
    return json(res, 200, r);
  }
  if (p === '/test-key' && req.method === 'POST') {
    const b = await readBody(req);
    const r = await or.testKey(b.key || openRouterKey(user && user.sub), b.model);
    return json(res, 200, r);
  }
  if (p === '/models/test' && req.method === 'POST') {
    const b = await readBody(req);
    const r = await or.testKey(b.key || openRouterKey(user && user.sub), b.model);
    return json(res, 200, r);
  }
  if (p === '/balance') {
    const key = url.searchParams.get('key') || (user && openRouterKey(user.sub)) || '';
    return json(res, 200, { balance: await or.balance(key) });
  }

  // ---- chat (réponse complète, sans streaming : studio image/vidéo)
  if (p === '/chat-once' && req.method === 'POST') {
    if (!user) return json(res, 401, { error: 'auth' });
    const b = await readBody(req);
    const key = keyOf(req, b) || openRouterKey(user.email);
    if (!key) return json(res, 400, { error: 'no_key' });
    const profile = b.profile || {};
    const messages = [];
    if (b.systemOverride) messages.push({ role: 'system', content: b.systemOverride });
    else messages.push({ role: 'system', content: agent.buildSystemPrompt(profile, { mode: b.mode }) });
    for (const m of b.messages || []) messages.push({ role: m.role, content: m.content });
    try {
      const out = await or.chatOnce(key, { model: b.model, messages, temperature: Number(b.temperature) || agent.EFFORTS[b.effort]?.temperature || 0.7, maxTokens: Number(b.maxTokens) || agent.EFFORTS[b.effort]?.maxTokens || 1500 });
      return json(res, 200, { ok: true, content: out.content, reasoning: out.reasoning, usage: out.usage });
    } catch (e) {
      return json(res, e.offline ? 503 : 502, { ok: false, error: String(e.message || e), offline: !!e.offline, status: e.status });
    }
  }

  // ---- chat
  if (p === '/chat' && req.method === 'POST') {
    if (!user) return json(res, 401, { error: 'auth' });
    return handleChat(req, res, user);
  }

  // ---- image generation
  if (p === '/image' && req.method === 'POST') {
    if (!user) return json(res, 401, { error: 'auth' });
    const b = await readBody(req);
    const key = keyOf(req, b) || openRouterKey(user.sub);
    if (!key) return json(res, 400, { error: 'no_key' });
    try {
      const r = await or.generateImage(key, { model: b.model, prompt: b.prompt, size: b.size, quality: b.quality });
      return json(res, 200, r);
    } catch (e) {
      const msg = String(e.message || e);
      const offline = /fetch failed|ENOTFOUND|ECONNRESET|ECONNREFUSED|SSL|abort/i.test(msg);
      return json(res, offline ? 503 : 500, { error: msg, offline });
    }
  }

  // ---- local bridge
  if (p === '/bridge/paircode' && req.method === 'POST') {
    if (!user) return json(res, 401, { error: 'auth' });
    const code = bridge.newPairCode();
    bridge.log('pair', 'Code de vérification généré');
    return json(res, 200, { code, expiresIn: 1800 });
  }
  if (p === '/bridge/pair' && req.method === 'POST') {
    const b = await readBody(req);
    const ok = bridge.checkPairCode(b.code);
    const sid = b.sessionId || 'sess_' + crypto.randomBytes(4).toString('hex');
    bridge.state.sessions.set(sid, { id: sid, at: Date.now(), info: b.info || {}, paired: ok });
    bridge.log('pair', ok ? 'Pont local connecté ✔' : 'Tentative de connexion sans code valide');
    return json(res, 200, { ok: true, verified: ok, sessionId: sid });
  }
  if (p === '/bridge/verify' && req.method === 'POST') {
    const b = await readBody(req);
    const code = String(b.code || '').trim();
    const now = Date.now();
    const online = [...bridge.state.sessions.values()].some((s) => now - s.at < 8000);
    const codeOk = bridge.state.pairCode && code === bridge.state.pairCode;
    if (codeOk && online) { bridge.state.pairCode = null; bridge.log('pair', 'Liaison vérifiée par le site ✔'); return json(res, 200, { ok: true, verified: true }); }
    if (codeOk && !online) return json(res, 200, { ok: false, error: 'bridge_offline' });
    if (!codeOk && online) return json(res, 200, { ok: false, error: 'code_mismatch' });
    return json(res, 200, { ok: false, error: 'no_bridge' });
  }
  if (p === '/bridge/poll' && req.method === 'POST') {
    const b = await readBody(req);
    const sid = b.sessionId;
    if (!sid) return json(res, 200, { ok: false, tasks: [] });
    const s = bridge.state.sessions.get(sid) || { id: sid, at: Date.now(), info: {} };
    s.at = Date.now();
    bridge.state.sessions.set(sid, s);
    const out = [];
    for (const pend of bridge.state.pending.values()) {
      if (pend.sessionId === sid && (pend.status === 'approved' || pend.status === 'always') && !pend.delivered && !pend.result) {
        pend.delivered = true;
        out.push({ id: pend.id, type: pend.type, payload: pend.payload });
      }
    }
    return json(res, 200, { ok: true, tasks: out, token: bridge.state.token });
  }
  if (p === '/bridge/result' && req.method === 'POST') {
    const b = await readBody(req);
    const pend = bridge.state.pending.get(b.id);
    if (pend) { pend.result = { output: b.output, image: b.image || null }; pend.status = 'done'; bridge.log('exec', String(b.output || '').slice(0, 120)); }
    return json(res, 200, { ok: true });
  }
  if (p === '/bridge/status') {
    const now = Date.now();
    const sessions = [...bridge.state.sessions.values()].map((s) => ({ ...s, online: now - s.at < 6000 }));
    return json(res, 200, { online: sessions.some((s) => s.online), sessions, events: bridge.state.events.slice(0, 30), pending: [...bridge.state.pending.values()].filter((x) => x.status === 'pending').map(pubPending) });
  }
  if (p === '/bridge/approvals') {
    return json(res, 200, { pending: [...bridge.state.pending.values()].filter((x) => x.status === 'pending').map(pubPending) });
  }
  if (p === '/bridge/decision' && req.method === 'POST') {
    const b = await readBody(req);
    const dec = b.decision === 'always' ? 'always' : b.decision === 'deny' ? 'denied' : 'approved';
    const pend = bridge.state.pending.get(b.id);
    if (!pend) return json(res, 404, { error: 'not_found' });
    pend.status = dec;
    if (dec === 'always' && user) tasks.addAlwaysAllowed(user.sub, pend.family);
    bridge.log('approval', `${dec} → ${pend.command}`);
    return json(res, 200, { ok: true, status: dec });
  }
  if (p === '/bridge/allowlist' && req.method === 'GET') {
    const list = store.get('allowFamilies', {})[user ? user.sub : ''] || [];
    return json(res, 200, { families: list });
  }
  if (p === '/bridge/allowlist/remove' && req.method === 'POST') {
    const b = await readBody(req);
    tasks.removeAlwaysAllowed(user.sub, b.family);
    return json(res, 200, { ok: true });
  }
  if (p === '/bridge/command' && req.method === 'POST') {
    const b = await readBody(req);
    const risk = security.classify(b.command);
    const pend = tasks.requestTask({ sessionId: b.sessionId, type: 'run', payload: { command: b.command, cwd: b.cwd }, risk, email: user && user.sub, needsApproval: true });
    return json(res, 200, { id: pend.id, risk });
  }
  if (p === '/bridge/screenshot/latest') {
    return json(res, 200, { image: bridge.state.lastScreenshot });
  }
  if (p === '/bridge/download/setup' ) {
    if (!user) return json(res, 401, { error: 'auth' });
    const fresh = bridge.state.pairCode && Date.now() - bridge.state.pairCodeAt < 1000 * 60 * 30;
    const code = fresh ? bridge.state.pairCode : bridge.newPairCode();
    const key = openRouterKey(user.sub) || '';
    if (key) bridge.state.proxyKey = key; // le CLI passe par /api/proxy avec cette clé
    const model = (auth.loadCloud(user.sub) || {}).openrouterModel || 'meta-llama/llama-3.3-70b-instruct:free';
    return sendBat(res, 'install-windows.bat.tpl', {
      __BASE__: baseUrl(req), __TOKEN__: bridge.state.token, __PAIRCODE__: code, __KEY__: key, __MODEL__: model,
    }, 'JARVIS-Setup.bat');
  }
  if (p === '/bridge/download/access') {
    if (!user) return json(res, 401, { error: 'auth' });
    const key = openRouterKey(user.sub) || '';
    const model = (auth.loadCloud(user.sub) || {}).openrouterModel || 'meta-llama/llama-3.3-70b-instruct:free';
    return sendBat(res, 'access-key.bat.tpl', {
      __BASE__: baseUrl(req), __TOKEN__: bridge.state.token, __KEY__: key, __MODEL__: model,
    }, 'JARVIS-Claude-Code.bat');
  }

  // ---- Relais OpenRouter via le pont local (l'ordinateur de l'utilisateur)
  //      Utilisé quand ni ce serveur ni le navigateur ne peuvent joindre openrouter.ai.
  if (p === '/or-relay' && req.method === 'POST') {
    const b = await readBody(req);
    const path = String(b.path || '');
    if (!path.startsWith('/') || path.includes('://')) return json(res, 400, { ok: false, error: 'bad_path' });
    const url = or.OPENROUTER + path;
    if (!url.startsWith(or.OPENROUTER)) return json(res, 400, { ok: false, error: 'bad_path' });
    // une session de pont en vie ?
    const now = Date.now();
    const sessions = [...bridge.state.sessions.values()].filter((s) => now - s.at < 8000 && s.paired);
    if (!sessions.length) return json(res, 200, { ok: false, error: 'bridge_offline' });
    const sessionId = sessions[0].id;
    const headers = { 'Content-Type': 'application/json' };
    if (b.key) headers.Authorization = 'Bearer ' + String(b.key);
    const task = tasks.requestTask({
      sessionId, type: 'or_http', risk: 'safe', email: user && user.sub, needsApproval: false,
      payload: { url, method: b.method || 'GET', headers, body: b.body ? JSON.stringify(b.body) : undefined, timeout: b.timeout },
    });
    const r = await tasks.waitFor(task, Math.min(Number(b.timeout) || 90000, 180000));
    if (r.offline) return json(res, 200, { ok: false, error: 'bridge_offline' });
    if (r.timeout) return json(res, 200, { ok: false, error: 'timeout', detail: 'le pont local n\'a pas répondu' });
    let out = {};
    try { out = JSON.parse((r.result && r.result.output) || '{}'); } catch {}
    bridge.log('relay', `${b.method || 'GET'} ${path} → ${out.status || 0}`);
    if (!out.status) return json(res, 200, { ok: false, error: 'reseau_ou_cors', detail: String(out.text || '').slice(0, 300) });
    return json(res, 200, { ok: true, status: out.status, text: out.text || '' });
  }

  // ---- OpenRouter proxy (used by the Claude Code CLI .bat)
  if (p.startsWith('/proxy')) {
    const token = req.headers['x-jarvis-token'] || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (token !== bridge.state.token) return json(res, 401, { error: 'bad token' });
    const key = bridge.state.proxyKey || '';
    const target = 'https://openrouter.ai/api/v1' + p.replace(/^\/proxy\/?v?1?/, '/').replace(/^\/\//, '/');
    let raw = '';
    await new Promise((r) => { req.on('data', (c) => (raw += c)); req.on('end', r); });
    try {
      const up = await fetch(target, {
        method: req.method,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': baseUrl(req), 'X-Title': 'JARVIS CLI' },
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : raw,
      });
      const txt = await up.text();
      res.writeHead(up.status, { 'Content-Type': up.headers.get('content-type') || 'application/json' });
      return res.end(txt);
    } catch (e) { return json(res, 502, { error: 'OpenRouter injoignable depuis ce serveur : ' + or.describe(e) }); }
  }
  return json(res, 404, { error: 'not_found', path: p });
}

function pubPending(x) { return { id: x.id, command: x.command, cwd: x.cwd, risk: x.risk, family: x.family, type: x.type, createdAt: x.createdAt }; }

// keep the proxy able to use a stored key
function refreshProxyKey() {
  const list = store.get('users', {});
  for (const u of Object.values(list)) {
    if (u.cloud && u.cloud.openrouterKey) { bridge.state.proxyKey = u.cloud.openrouterKey; return; }
  }
}

// ---------------------------------------------------------------- static
function serveStatic(req, res, url) {
  let file = decodeURIComponent(url.pathname);
  if (file === '/' || !path.extname(file)) file = '/index.html';
  const full = path.join(PUBLIC, path.normalize(file).replace(/^([/\\])+/, ''));
  if (!full.startsWith(PUBLIC)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(full, (err, data) => {
    if (err) {
      fs.readFile(path.join(PUBLIC, 'index.html'), (e2, d2) => {
        if (e2) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store, must-revalidate' }); res.end(d2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-store, must-revalidate' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, baseUrl(req));
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-OpenRouter-Key, X-Jarvis-Token, X-Jarvis-Auth');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  try {
    if (url.pathname.startsWith('/api/bridge/runner.js')) return serveRunnerTemplate(res, req, url);
    if (url.pathname.startsWith('/api/')) { refreshProxyKey(); return await api(req, res, url); }
    return serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    try { json(res, 500, { error: String(e.message || e) }); } catch {}
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ⚡ JARVIS — http://localhost:${PORT}\n`);
});
