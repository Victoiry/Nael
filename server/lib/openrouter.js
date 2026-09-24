// OpenRouter client: model catalogue, key test, streaming chat, images, vision
const OPENROUTER = 'https://openrouter.ai/api/v1';

const FALLBACK_MODELS = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', context_length: 128000, pricing: { prompt: '0.00000015', completion: '0.0000006' }, architecture: { input_modalities: ['text', 'image'] } },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', context_length: 200000, pricing: { prompt: '0.000003', completion: '0.000015' }, architecture: { input_modalities: ['text', 'image'] } },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', context_length: 1000000, pricing: { prompt: '0.0000001', completion: '0.0000004' }, architecture: { input_modalities: ['text', 'image'] } },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (free)', context_length: 131072, pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text'] } },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (free)', context_length: 163840, pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text'] } },
];

function isFree(id) {
  const s = String(id || '').toLowerCase();
  return s.includes('/free') || s.includes(':free') || s.endsWith(':free');
}
function priceOf(m) {
  const p = m && m.pricing ? Number(m.pricing.prompt) : NaN;
  return Number.isFinite(p) ? p : NaN;
}
function supportsVision(m) {
  const mods = (m && m.architecture && m.architecture.input_modalities) || [];
  return mods.includes('image') || /vl|vision|gpt-4o|gemini|claude-3|claude-4|pixtral|llava|qwen.*vl/i.test(m.id || '');
}

let cache = { at: 0, list: null };

async function listModels(key, { force = false } = {}) {
  if (!force && cache.list && Date.now() - cache.at < 1000 * 60 * 10) return cache.list;
  try {
    const r = await fetch(`${OPENROUTER}/models`, {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
    });
    if (!r.ok) throw new Error('status ' + r.status);
    const j = await r.json();
    let list = (j.data || []).map((m) => ({ ...m, free: isFree(m.id), supportsVision: supportsVision(m) }));
    list.sort((a, b) => {
      if (a.free !== b.free) return a.free ? 1 : -1; // paid first (as requested)
      return String(a.name || a.id).localeCompare(String(b.name || b.id));
    });
    cache = { at: Date.now(), list };
    return list;
  } catch (e) {
    const list = FALLBACK_MODELS.map((m) => ({ ...m, free: isFree(m.id), supportsVision: supportsVision(m) }))
      .sort((a, b) => (a.free === b.free ? 0 : a.free ? 1 : -1));
    return list;
  }
}

async function testKey(key, model) {
  const started = Date.now();
  const models = await listModels(key, { force: true });
  const fallback = models.find((m) => m.free) || { id: 'meta-llama/llama-3.3-70b-instruct:free' };
  const target = model || fallback.id;
  try {
    const r = await fetch(`${OPENROUTER}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: target,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
        stream: false,
      }),
    });
    const text = await r.text();
    return { ok: r.ok, status: r.status, model: target, latency: Date.now() - started, detail: text.slice(0, 400), modelsCount: models.length };
  } catch (e) {
    return { ok: false, status: 0, model: target, latency: Date.now() - started, detail: String(e.message || e), modelsCount: models.length };
  }
}

async function balance(key) {
  try {
    const r = await fetch(`${OPENROUTER}/credits`, { headers: { Authorization: `Bearer ${key}` } });
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

// Streaming chat completion -> yields {delta} chunks via async generator
async function* streamChat(key, { model, messages, temperature = 0.7, maxTokens = 2048, tools }) {
  const body = { model, messages, temperature, stream: true };
  if (maxTokens) body.max_tokens = maxTokens;
  if (tools && tools.length) body.tools = tools;
  const r = await fetch(`${OPENROUTER}/chat/completions`, { method: 'POST', headers: headers(key), body: JSON.stringify(body) });
  if (!r.ok || !r.body) {
    const t = await r.text().catch(() => '');
    throw new Error(`OpenRouter ${r.status}: ${t.slice(0, 300)}`);
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
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
      } catch { /* ignore partial */ }
    }
  }
}

async function chatOnce(key, opts) {
  let out = '';
  let reasoning = '';
  for await (const c of streamChat(key, opts)) {
    out += c.content || '';
    reasoning += c.reasoning || '';
  }
  return { content: out, reasoning };
}

async function generateImage(key, { model = 'google/gemini-2.5-flash-image-preview', prompt, size, quality, n = 1 }) {
  // OpenRouter image generation: multimodal chat returning images
  const r = await fetch(`${OPENROUTER}/chat/completions`, {
    method: 'POST',
    headers: headers(key),
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text'],
      ...(size ? { image_config: { aspect_ratio: size } } : {}),
    }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${text.slice(0, 300)}`);
  let json; try { json = JSON.parse(text); } catch { throw new Error('bad json'); }
  const msg = json.choices?.[0]?.message || {};
  const imgs = [];
  const images = msg.images || [];
  for (const im of images) {
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

module.exports = { listModels, testKey, streamChat, chatOnce, generateImage, isFree, priceOf, supportsVision, balance, OPENROUTER, cache };
