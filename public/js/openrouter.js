/* JARVIS — client OpenRouter côté navigateur
   Le serveur peut être bloqué (hébergement, pare-feu, sandbox) : dans ce cas
   l'application parle directement à openrouter.ai depuis votre navigateur.
   La liste des modèles vient toujours de l'API, jamais d'une liste pré-écrite. */
(function () {
  const BASE = 'https://openrouter.ai/api/v1';
  const OR = { abort: null, channel: 'unknown', lastProbe: null, lastError: null };

  // ---------------------------------------------------------------- outils
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };
  function isFree(m) {
    const id = String((m && m.id) || '').toLowerCase();
    if (id.includes('/free') || id.includes(':free')) return true;
    const p = (m && m.pricing) || null;
    if (!p) return false;
    const a = num(p.prompt), b = num(p.completion);
    return Number.isFinite(a) && Number.isFinite(b) && a === 0 && b === 0;
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
      context: m.context_length || (m.top_provider && m.top_provider.context_length) || 0,
      pricePrompt: num(m.pricing && m.pricing.prompt),
      priceCompletion: num(m.pricing && m.pricing.completion),
      description: String(m.description || '').slice(0, 300),
      modalities: (m.architecture && m.architecture.input_modalities) || ['text'],
    };
  }
  function headers(key, extra) {
    const h = { 'Content-Type': 'application/json', 'X-Title': 'JARVIS' };
    try { h['HTTP-Referer'] = location.origin; } catch {}
    if (key) h.Authorization = 'Bearer ' + key;
    return Object.assign(h, extra || {});
  }
  /** Erreur lisible : réseau, CORS, clé, crédit, débit… */
  function human(e, status) {
    const msg = String((e && e.message) || e || '');
    if (status === 401) return 'cle_invalide';
    if (status === 402) return 'credit';
    if (status === 403) return 'refuse';
    if (status === 404) return 'modele_inconnu';
    if (status === 429) return 'debit';
    if (status >= 500) return 'openrouter_erreur';
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'reseau_ou_cors';
    if (/abort/i.test(msg)) return 'annule';
    return 'inconnu';
  }
  async function req(path, { method = 'GET', key, body, ms = 20000 } = {}) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(BASE + path, {
        method,
        headers: headers(key),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });
      return r;
    } finally { clearTimeout(to); }
  }
  const text = async (r) => { try { return await r.text(); } catch { return ''; } };
  function apiDetail(t) { try { const j = JSON.parse(t); return (j.error && (j.error.message || j.error)) || j.message || t; } catch { return t; } }

  // ---------------------------------------------------------------- sonde
  /** Le navigateur peut-il joindre OpenRouter ? (utilisé pour choisir le canal) */
  async function probeDirect(ms = 8000) {
    const t0 = Date.now();
    try {
      const r = await req('/models', { ms });
      return { ok: r.ok, status: r.status, ms: Date.now() - t0 };
    } catch (e) {
      return { ok: false, status: 0, ms: Date.now() - t0, error: human(e) };
    }
  }

  // ---------------------------------------------------------------- modèles
  /** Liste réelle des modèles (API OpenRouter, jamais de liste pré-écrite). */
  async function models({ key } = {}) {
    try {
      const r = await req('/models', { key, ms: 20000 });
      if (!r.ok) {
        const t = await text(r);
        return { ok: false, status: r.status, reason: human(t, r.status), error: apiDetail(t).slice(0, 300), models: [] };
      }
      const j = await r.json();
      const list = (j.data || []).map(normalize)
        .sort((a, b) => (a.free === b.free ? String(a.name).localeCompare(String(b.name)) : (a.free ? 1 : -1))); // payants d'abord
      if (!list.length) return { ok: false, reason: 'liste_vide', models: [] };
      return { ok: true, models: list, count: list.length, source: 'direct' };
    } catch (e) {
      return { ok: false, reason: human(e), error: String((e && e.message) || e), models: [] };
    }
  }

  // ---------------------------------------------------------------- test de clé
  async function testKey(key, model) {
    const t0 = Date.now();
    if (!model) {
      const list = await models({ key });
      if (!list.ok) return { ok: false, status: list.status || 0, reason: list.reason, latency: Date.now() - t0, detail: list.error || '' };
      const pick = list.models.find((m) => m.free) || list.models[0];
      model = pick && pick.id;
    }
    try {
      const r = await req('/chat/completions', {
        method: 'POST', key, ms: 30000,
        body: { model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 4, stream: false },
      });
      const t = await text(r);
      return { ok: r.ok, status: r.status, model, latency: Date.now() - t0, reason: r.ok ? null : human(t, r.status), detail: apiDetail(t).slice(0, 300), source: 'direct' };
    } catch (e) {
      return { ok: false, status: 0, model, latency: Date.now() - t0, reason: human(e), detail: String((e && e.message) || e) };
    }
  }

  // ---------------------------------------------------------------- streaming
  /** Chat en direct depuis le navigateur : mêmes évènements que le serveur. */
  async function stream(payload, h = {}) {
    const { key, ...body } = payload;
    const ctrl = new AbortController();
    OR.abort = ctrl;
    let r;
    try {
      r = await req('/chat/completions', { method: 'POST', key, body: Object.assign({ stream: true }, body), ms: 120000 });
    } catch (e) {
      OR.abort = null;
      const reason = human(e);
      if (reason === 'annule') return { ok: false, aborted: true, reason };
      return { ok: false, reason, error: String((e && e.message) || e) };
    }
    r.__ctrl = ctrl;
    if (!r.ok) {
      const t = await text(r);
      OR.abort = null;
      return { ok: false, status: r.status, reason: human(t, r.status), error: apiDetail(t).slice(0, 300) };
    }
    if (!r.body || !r.body.getReader) {
      const t = await text(r);
      OR.abort = null;
      let j; try { j = JSON.parse(t); } catch {}
      const msg = j && j.choices && j.choices[0] && j.choices[0].message;
      if (msg && msg.content && h.delta) h.delta({ text: msg.content });
      h.done && h.done({});
      return { ok: true, nonStreamed: true };
    }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n');
        buf = parts.pop();
        for (const line of parts) {
          const s = line.trim();
          if (!s.startsWith('data:')) continue;
          const p = s.slice(5).trim();
          if (p === '[DONE]') { OR.abort = null; h.done && h.done({}); return { ok: true }; }
          let json; try { json = JSON.parse(p); } catch { continue; }
          if (json.error) {
            OR.abort = null;
            h.error && h.error({ message: apiDetail(JSON.stringify(json)), reason: human('', json.error.code) });
            return { ok: false, reason: 'openrouter_erreur', error: apiDetail(JSON.stringify(json)) };
          }
          const ch = json.choices && json.choices[0];
          if (!ch) continue;
          const d = ch.delta || {};
          if (d.content && h.delta) h.delta({ text: d.content });
          const reas = d.reasoning || d.reasoning_content;
          if (reas && h.reasoning) h.reasoning({ text: reas });
          if (d.tool_calls && h.toolCalls) h.toolCalls(d.tool_calls);
          if (json.usage && h.usage) h.usage(json.usage);
          if (ch.finish_reason && h.finish) h.finish(ch.finish_reason);
        }
      }
      OR.abort = null;
      h.done && h.done({});
      return { ok: true };
    } catch (e) {
      OR.abort = null;
      if (/abort/i.test(String(e && e.message))) return { ok: false, aborted: true, reason: 'annule' };
      return { ok: false, reason: 'flux_interrompu', error: String((e && e.message) || e) };
    }
  }

  /** Réponse complète (non streamée) : utilisée par le studio image/vidéo. */
  async function chatOnce(payload) {
    let out = '', reasoning = '';
    const res = await stream(payload, {
      delta: (d) => { out += d.text; },
      reasoning: (d) => { reasoning += d.text; },
    });
    if (!res.ok) return { ok: false, ...res, content: out, reasoning };
    return { ok: true, content: out, reasoning };
  }

  /** Génération d'image (chat multimodal) directement depuis le navigateur. */
  async function image({ key, model, prompt, size }) {
    try {
      const r = await req('/chat/completions', {
        method: 'POST', key, ms: 120000,
        body: { model, messages: [{ role: 'user', content: prompt }], modalities: ['image', 'text'], ...(size ? { image_config: { aspect_ratio: size } } : {}) },
      });
      const t = await text(r);
      if (!r.ok) return { ok: false, status: r.status, reason: human(t, r.status), error: apiDetail(t).slice(0, 300) };
      const j = JSON.parse(t);
      const msg = (j.choices && j.choices[0] && j.choices[0].message) || {};
      const imgs = [];
      for (const im of msg.images || []) { const u = (im.image_url && im.image_url.url) || im.url || im.image_url; if (u) imgs.push(u); }
      if (!imgs.length && Array.isArray(msg.content)) for (const part of msg.content) { const u = (part.image_url && part.image_url.url) || part.image_url; if (u) imgs.push(u); }
      return { ok: true, images: imgs, text: typeof msg.content === 'string' ? msg.content : '' };
    } catch (e) {
      return { ok: false, reason: human(e), error: String((e && e.message) || e) };
    }
  }

  const stop = () => { try { OR.abort && OR.abort.abort(); } catch {} OR.abort = null; };

  window.OR = { BASE, probeDirect, models, testKey, stream, chatOnce, image, stop, isFree, supportsVision, normalize, human, state: OR };
})();
