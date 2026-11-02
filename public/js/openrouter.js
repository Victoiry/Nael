/* JARVIS — client OpenRouter du navigateur (canal « direct »)
   Objectifs : aucun modèle pré-écrit, aucune liste locale, en-têtes minimaux
   (moins de pré-vol CORS), reprises automatiques, et diagnostic précis
   lorsqu'un navigateur ne peut pas joindre openrouter.ai. */
(function () {
  const BASE = 'https://openrouter.ai/api/v1';
  const OR = { abort: null, lastError: null, corsHint: false };

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
    return mods.includes('image') || /vl|vision|gpt-4o|gpt-4o|gpt-5|gemini|claude-3|claude-4|pixtral|llava|qwen.*vl/i.test((m && m.id) || '');
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
  /** En-têtes MINIMAUX : Authorization seulement si une clé est fournie,
      Content-Type uniquement pour un corps JSON. Moins d'en-têtes = pré-vol
      CORS plus simple (et souvent aucun pré-vol au tout). */
  function headers(key, json) {
    const h = {};
    if (key) h.Authorization = 'Bearer ' + key;
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }
  function human(e, status) {
    if (status === 401) return 'cle_invalide';
    if (status === 402) return 'credit';
    if (status === 403) return 'refuse';
    if (status === 404) return 'modele_inconnu';
    if (status === 429) return 'debit';
    if (status >= 500) return 'openrouter_erreur';
    const msg = String((e && e.message) || e || '');
    if (/abort/i.test(msg)) return 'annule';
    if (/Failed to fetch|NetworkError|Load failed|CORS/i.test(msg)) return 'reseau_ou_cors';
    return 'inconnu';
  }
  const text = async (r) => { try { return await r.text(); } catch { return ''; } };
  function apiDetail(t) {
    try { const j = JSON.parse(t); return (j.error && (j.error.message || j.error)) || j.message || t; } catch { return t; }
  }

  /** Requête avec délai + reprises (jamais plus d'une reprise). */
  async function req(path, { method = 'GET', key, body, ms = 25000, retries = 1 } = {}) {
    let last;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), ms);
      try {
        return await fetch(BASE + path, {
          method,
          headers: headers(key, body !== undefined),
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: ctrl.signal,
          mode: 'cors',
          cache: 'no-store',
          credentials: 'omit',
        });
      } catch (e) {
        last = e;
        OR.lastError = human(e);
      } finally { clearTimeout(to); }
      if (attempt < retries) await new Promise((r) => setTimeout(r, 900));
    }
    throw last;
  }

  /** Le réseau est-il correct mais CORS bloquant ? (fetch opaque en no-cors) */
  async function corsBlocked() {
    try { await fetch(BASE + '/models', { mode: 'no-cors', cache: 'no-store' }); OR.corsHint = true; return true; }
    catch { OR.corsHint = false; return false; }
  }

  // ---------------------------------------------------------------- sonde
  async function probeDirect(ms = 12000) {
    const t0 = Date.now();
    try {
      const r = await req('/models', { ms, retries: 0 });
      if (r.ok) return { ok: true, status: r.status, ms: Date.now() - t0 };
      return { ok: false, status: r.status, ms: Date.now() - t0, error: 'HTTP ' + r.status };
    } catch (e) {
      const net = await corsBlocked();
      return { ok: false, status: 0, ms: Date.now() - t0, error: human(e), cors: net };
    }
  }

  // ---------------------------------------------------------------- modèles
  /** Liste réelle : GET /models est public, une clé n'est donc PAS nécessaire. */
  async function models({ key } = {}) {
    try {
      const r = await req('/models', { key, ms: 25000, retries: 1 });
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
      const net = await corsBlocked();
      return { ok: false, reason: human(e), cors: net, error: String((e && e.message) || e), models: [] };
    }
  }

  // ---------------------------------------------------------------- test de clé
  async function testKey(key, model) {
    const t0 = Date.now();
    if (!key) return { ok: false, status: 0, reason: 'sans_cle', latency: 0 };
    if (!model) {
      const list = await models({ key });
      if (!list.ok) return { ok: false, status: list.status || 0, reason: list.reason, latency: Date.now() - t0, detail: list.error || '' };
      const pick = list.models.find((m) => m.free) || list.models[0];
      model = pick && pick.id;
    }
    try {
      const r = await req('/chat/completions', {
        method: 'POST', key, ms: 40000, retries: 0,
        body: { model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 4, stream: false },
      });
      const t = await text(r);
      return {
        ok: r.ok, status: r.status, model, latency: Date.now() - t0, via: 'direct',
        reason: r.ok ? null : human(t, r.status), detail: apiDetail(t).slice(0, 300), source: 'direct',
      };
    } catch (e) {
      const net = await corsBlocked();
      return { ok: false, status: 0, model, latency: Date.now() - t0, via: 'direct', reason: human(e), cors: net, detail: String((e && e.message) || e) };
    }
  }

  // ---------------------------------------------------------------- streaming
  async function stream(payload, h = {}) {
    const { key, ...body } = payload;
    const ctrl = new AbortController();
    OR.abort = ctrl;
    let r;
    try {
      r = await req('/chat/completions', { method: 'POST', key, body: Object.assign({ stream: true }, body), ms: 180000, retries: 0 });
    } catch (e) {
      OR.abort = null;
      const reason = human(e);
      if (reason === 'annule') return { ok: false, aborted: true, reason };
      const net = await corsBlocked();
      return { ok: false, reason, cors: net, error: String((e && e.message) || e) };
    }
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
    let buf = '', got = false;
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
          if (p === '[DONE]') { OR.abort = null; h.done && h.done({}); return { ok: true, got }; }
          let json; try { json = JSON.parse(p); } catch { continue; }
          if (json.error) {
            OR.abort = null;
            const m = apiDetail(JSON.stringify(json));
            h.error && h.error({ message: m, reason: 'openrouter_erreur' });
            return { ok: false, reason: 'openrouter_erreur', error: m };
          }
          const ch = json.choices && json.choices[0];
          if (!ch) continue;
          const d = ch.delta || {};
          if (d.content) { got = true; h.delta && h.delta({ text: d.content }); }
          const reas = d.reasoning || d.reasoning_content;
          if (reas) { got = true; h.reasoning && h.reasoning({ text: reas }); }
          if (d.tool_calls && h.toolCalls) h.toolCalls(d.tool_calls);
          if (json.usage && h.usage) h.usage(json.usage);
          if (ch.finish_reason && h.finish) h.finish(ch.finish_reason);
        }
      }
      OR.abort = null;
      h.done && h.done({});
      return { ok: true, got };
    } catch (e) {
      OR.abort = null;
      if (/abort/i.test(String(e && e.message))) return { ok: false, aborted: true, reason: 'annule' };
      return { ok: false, reason: 'flux_interrompu', got, error: String((e && e.message) || e) };
    }
  }

  /** Réponse complète (studio image/vidéo, relais sans streaming). */
  async function chatOnce(payload) {
    let out = '', reasoning = '';
    const res = await stream(payload, {
      delta: (d) => { out += d.text; },
      reasoning: (d) => { reasoning += d.text; },
    });
    if (!res.ok) return Object.assign({ content: out, reasoning }, res);
    return { ok: true, content: out, reasoning };
  }

  /** Génération d'image (chat multimodal). */
  async function image({ key, model, prompt, size }) {
    try {
      const r = await req('/chat/completions', {
        method: 'POST', key, ms: 180000, retries: 0,
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
      const net = await corsBlocked();
      return { ok: false, reason: human(e), cors: net, error: String((e && e.message) || e) };
    }
  }

  /** Diagnostic complet côté navigateur (affiché dans les réglages). */
  async function diagnose(key) {
    const steps = [];
    const t0 = Date.now();
    const net = await corsBlocked();
    steps.push({ step: 'reseau', ok: net, detail: net ? 'openrouter.ai est joignable (TLS/HTTP OK)' : 'impossible de joindre openrouter.ai (réseau, pare-feu ou bloqueur)' });
    const p = await probeDirect();
    steps.push({ step: 'liste', ok: !!p.ok, detail: p.ok ? 'API /models accessible en direct (' + p.ms + ' ms)' : (p.cors ? 'accès bloqué par CORS' : 'échec : ' + p.error) });
    if (key) {
      const t = await testKey(key, null);
      steps.push({
        step: 'cle', ok: !!t.ok,
        detail: t.ok ? 'clé valide (' + (t.model || '') + ', ' + t.latency + ' ms)' : 'échec : ' + t.reason + (t.detail ? ' — ' + String(t.detail).slice(0, 120) : ''),
      });
    }
    return { ok: steps.every((s) => s.ok), steps, ms: Date.now() - t0 };
  }

  const stop = () => { try { OR.abort && OR.abort.abort(); } catch {} OR.abort = null; };

  window.OR = { BASE, probeDirect, models, testKey, stream, chatOnce, image, diagnose, corsBlocked, stop, isFree, supportsVision, normalize, human, state: OR };
})();
