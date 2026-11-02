// OpenRouter client (server side) — catalogue, test de clé, streaming, images
// Aucune liste pré-écrite : les modèles viennent TOUJOURS de l'API OpenRouter.
// Base surchargeable (auto-hébergement, proxy, tests) : OPENROUTER_BASE=…
const OPENROUTER = (process.env.OPENROUTER_BASE || 'https://openrouter.ai/api/v1').replace(/\/$/, '');

// ---------------------------------------------------------------- utilitaires
/** Gratuit = tarif d'entrée ET de sortie à 0 (données de l'API) ou identifiant :free / /free. */
function isFree(m) {
  const id = String((m && m.id) || '').toLowerCase();
  if (id.includes('/free') || id.includes(':free')) return true;
  const p = m && m.pricing ? m.pricing : null;
  if (!p) return false;
  const a = Number(p.prompt);
  const b = Number(p.completion);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return a === 0 && b === 0;
}
function priceOf(m) {
  const p = m && m.pricing ? Number(m.pricing.prompt) : NaN;
  return Number.isFinite(p) ? p : NaN;
}
function supportsVision(m) {
  const mods = (m && m.architecture && m.architecture.input_modalities) || [];
  return mods.includes('image') || /vl|vision|gpt-4o|gpt-5|gemini|claude-3|claude-4|pixtral|llava|qwen.*vl/i.test((m && m.id) || '');
}
function normalize(m) {
  return {
    id: m.id,
    name: m.name || m.id,
    free: isFree(m),
    vision: supportsVision(m),
    context: m.context_length || m.top_provider?.context_length || 0,
    pricePrompt: priceOf(m),
    priceCompletion: m?.pricing ? Number(m.pricing.completion) : NaN,
    description: String(m.description || '').slice(0, 300),
    modalities: (m.architecture && m.architecture.input_modalities) || ['text'],
  };
}
function describe(e) {
  const c = (e && (e.cause && e.cause.code)) || (e && e.code) || '';
  if (c === 'ENOTFOUND') return 'DNS introuvable (openrouter.ai)';
  if (c === 'ECONNRESET' || c === 'EPIPE' || c === 'ECONNREFUSED') return 'connexion bloquée vers openrouter.ai (' + c + ')';
  if (String(e && e.message || '').includes('SSL')) return 'connexion TLS bloquée vers openrouter.ai';
  return String((e && e.message) || e || 'erreur réseau');
}

async function req(url, opts = {}, ms = 20000) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally { clearTimeout(to); }
}

// ---------------------------------------------------------------- catalogue
let cache = { at: 0, list: null };

/**
 * Liste live depuis OpenRouter. En cas d'échec réseau on renvoie { offline:true }
 * (jamais de fausse liste : le navigateur prend le relais côté client).
 */
async function listModels(key, { force = false, timeout = 15000 } = {}) {
  if (!force && cache.list && Date.now() - cache.at < 1000 * 60 * 10) return { models: cache.list, source: 'cache' };
  try {
    const r = await req(`${OPENROUTER}/models`, { headers: key ? { Authorization: `Bearer ${key}` } : {} }, timeout);
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return { models: [], offline: true, status: r.status, error: `OpenRouter ${r.status} ${t.slice(0, 200)}` };
    }
    const j = await r.json();
    const list = (j.data || []).map(normalize)
      .sort((a, b) => (a.free === b.free ? String(a.name).localeCompare(String(b.name)) : (a.free ? 1 : -1))); // payants d'abord
    cache = { at: Date.now(), list };
    return { models: list, source: 'live', count: list.length };
  } catch (e) {
    return { models: [], offline: true, status: 0, error: describe(e) };
  }
}

/** Test rapide : OpenRouter est-il joignable depuis ce processus ? */
async function probe(ms = 6000) {
  const started = Date.now();
  try {
    const r = await req(`${OPENROUTER}/models`, {}, ms);
    return { ok: r.ok, status: r.status, ms: Date.now() - started };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - started, error: describe(e) };
  }
}

async function testKey(key, model) {
  const started = Date.now();
  const target = model || '';
  if (!target) {
    const list = await listModels(key, { force: true, timeout: 12000 });
    if (list.offline) return { ok: false, status: 0, offline: true, latency: Date.now() - started, detail: list.error };
    const pick = list.models.find((m) => m.free) || list.models[0];
    model = pick && pick.id;
  }
  try {
    const r = await req(`${OPENROUTER}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'JARVIS' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 4, stream: false }),
    }, 25000);
    const text = await r.text();
    return { ok: r.ok, status: r.status, model, latency: Date.now() - started, detail: text.slice(0, 400) };
  } catch (e) {
    return { ok: false, status: 0, offline: true, model, latency: Date.now() - started, detail: describe(e) };
  }
}

async function balance(key) {
  try {
    const r = await req(`${OPENROUTER}/credits`, { headers: { Authorization: `Bearer ${key}` } }, 12000);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function headers(key, extra) {
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://jarvis.local',
    'X-Title': 'JARVIS',
    ...(extra || {}),
  };
}

// ---------------------------------------------------------------- streaming
async function* streamChat(key, { model, messages, temperature = 0.7, maxTokens = 2048, tools }) {
  const body = { model, messages, temperature, stream: true };
  if (maxTokens) body.max_tokens = maxTokens;
  if (tools && tools.length) body.tools = tools;
  let r;
  try {
    r = await req(`${OPENROUTER}/chat/completions`, { method: 'POST', headers: headers(key), body: JSON.stringify(body) }, 60000);
  } catch (e) {
    const err = new Error(describe(e));
    err.offline = true;
    throw err;
  }
  if (!r.ok || !r.body) {
    const t = await r.text().catch(() => '');
    const err = new Error(`OpenRouter ${r.status}: ${t.slice(0, 300)}`);
    err.status = r.status;
    throw err;
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n');
    buf = parts.pop();
    for (const line of parts) {
      const s = line.trim();
      if (!s.startsWith('data:')) continue;
      const payload = s.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const choice = json.choices && json.choices[0];
        if (!choice) continue;
        const d = choice.delta || {};
        yield {
          content: d.content || '',
          reasoning: d.reasoning || d.reasoning_content || '',
          toolCalls: d.tool_calls || null,
          finish: choice.finish_reason || null,
          usage: json.usage || null,
        };
      } catch { /* fragment ignoré */ }
    }
  }
}

async function chatOnce(key, opts) {
  let out = '';
  let reasoning = '';
  let usage = null;
  for await (const c of streamChat(key, opts)) {
    out += c.content || '';
    reasoning += c.reasoning || '';
    usage = c.usage || usage;
  }
  return { content: out, reasoning, usage };
}

async function generateImage(key, { model, prompt, size }) {
  const r = await req(`${OPENROUTER}/chat/completions`, {
    method: 'POST',
    headers: headers(key),
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text'],
      ...(size ? { image_config: { aspect_ratio: size } } : {}),
    }),
  }, 90000);
  const text = await r.text();
  if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${text.slice(0, 300)}`);
  let json; try { json = JSON.parse(text); } catch { throw new Error('réponse OpenRouter illisible'); }
  const msg = json.choices?.[0]?.message || {};
  const imgs = [];
  for (const im of msg.images || []) {
    const url = im.image_url?.url || im.url || im.image_url;
    if (url) imgs.push(url);
  }
  if (!imgs.length && Array.isArray(msg.content)) {
    for (const part of msg.content) {
      const u = part.image_url?.url || part.image_url;
      if (u) imgs.push(u);
    }
  }
  return { images: imgs, text: typeof msg.content === 'string' ? msg.content : '' };
}

module.exports = { listModels, probe, testKey, streamChat, chatOnce, generateImage, isFree, priceOf, supportsVision, normalize, balance, describe, OPENROUTER, cache };
