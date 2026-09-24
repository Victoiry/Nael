/* JARVIS — noyau : état, i18n, API, markdown, modales, voix, icônes */
(function () {
  const LANGS = [
    { code: 'fr', label: 'Français' },
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
    { code: 'it', label: 'Italiano' },
  ];
  const VOICE_LANGS = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', it: 'it-IT' };

  // ---------------------------------------------------------------- stockage
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('jarvis.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('jarvis.' + k, JSON.stringify(v)); return true; } catch { return false; } },
    getRaw(k, d) { try { const v = localStorage.getItem('jarvis.' + k); return v == null ? d : v; } catch { return d; } },
    setRaw(k, v) { try { localStorage.setItem('jarvis.' + k, v); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem('jarvis.' + k); } catch {} },
  };

  const DEFAULT_PROFILE = () => ({
    id: 'p' + Math.random().toString(36).slice(2, 8),
    name: 'Profil principal',
    aiName: 'JARVIS',
    userName: '',
    profession: '',
    calling: '',
    language: '',
    personality: '',
    tone: 'chaleureux, direct, précis',
    expertise: 'généraliste',
    instructions: '',
    forbidden: '',
    voice: '',
    voiceRate: 1,
    voicePitch: 1,
  });

  const DEFAULTS = () => ({
    lang: (navigator.language || 'fr').slice(0, 2) in { fr: 1, en: 1, es: 1, it: 1 } ? (navigator.language || 'fr').slice(0, 2) : 'fr',
    activeProfile: 0,
    profiles: [DEFAULT_PROFILE()],
    global: { theme: 'dark', accent: '#22d3ee', accent2: '#7c6cff', bgType: 'gradient', bgUrl: '', particles: true, glass: 14, density: 1, radius: 14, fontSize: 15, font: "'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif", anim: true, compact: false },
    ai: {
      model: '', effort: 'normal', temperature: 0.7, maxTokens: 4000, stream: true, autoScroll: true,
      enterSend: true, compact: false, ttsAuto: false, sttLang: '', wake: false, useMemory: true, useHistory: true,
      privateDefault: false, approvalMode: 'ask', visionWarn: true,
    },
  });

  const S = {
    settings: LS.get('settings', null) || DEFAULTS(),
    key: LS.getRaw('key', ''),
    model: LS.get('model', ''),
    conv: LS.get('conv', []),
    hist: LS.get('hist', []),
    mem: LS.get('mem', []),
    skills: LS.get('skills', []),
    auth: LS.get('auth', null),
    mode: LS.get('mode', 'chat'),
    tab: LS.get('tab', 'classic'),
    activeId: null,
    private: false,
    privateConv: null,
    user: null,
    abort: null,
    bridge: { online: false, sessionId: LS.getRaw('sess', 'sess_' + Math.random().toString(36).slice(2, 10)), verified: false },
  };
  // migration douce (nouvelles clés de réglages)
  S.settings = Object.assign(DEFAULTS(), S.settings);
  S.settings.global = Object.assign(DEFAULTS().global, S.settings.global || {});
  S.settings.ai = Object.assign(DEFAULTS().ai, S.settings.ai || {});
  if (!Array.isArray(S.settings.profiles) || !S.settings.profiles.length) S.settings.profiles = [DEFAULT_PROFILE()];

  const save = (what) => {
    const map = {
      settings: () => LS.set('settings', S.settings), model: () => LS.set('model', S.model), conv: () => LS.set('conv', S.conv),
      hist: () => LS.set('hist', S.hist), mem: () => LS.set('mem', S.mem), skills: () => LS.set('skills', S.skills),
      auth: () => LS.set('auth', S.auth), mode: () => LS.set('mode', S.mode), tab: () => LS.set('tab', S.tab),
    };
    if (!what) { Object.values(map).forEach((f) => f()); return; }
    (map[what] || (() => {}))();
  };

  // ---------------------------------------------------------------- i18n
  const lookup = (lang, key) => {
    const table = window.I18N && window.I18N[lang];
    if (!table) return undefined;
    if (table[key] != null && table[key] !== '') return table[key];
    return undefined;
  };
  function t(str, vars) {
    if (str == null) return '';
    let out = lookup(S.settings.lang, str);
    if (out == null) out = lookup('fr', str);
    if (out == null) out = lookup('en', str);
    // clé absente (vieux cache, nouvelle clé…) : on ne remplace rien, le texte
    // statique du HTML reste affiché et aucune clé brute n'apparaît jamais.
    if (out == null) return '';
    if (vars) Object.keys(vars).forEach((k) => { out = out.split('{' + k + '}').join(vars[k]); });
    return out;
  }
  function applyI18n(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((n) => {
      if (n.dataset.i18n === 'skip') return;
      const txt = t(n.dataset.i18n);
      if (txt) n.textContent = txt;
    });
    scope.querySelectorAll('[data-i18n-ph]').forEach((n) => { const txt = t(n.dataset.i18nPh); if (txt) n.placeholder = txt; });
    scope.querySelectorAll('[data-i18n-title]').forEach((n) => { const txt = t(n.dataset.i18nTitle); if (txt) { n.title = txt; n.setAttribute('aria-label', txt); } });
  }
  function setLang(code) {
    if (!LANGS.some((l) => l.code === code)) return;
    S.settings.lang = code; save('settings');
    document.documentElement.lang = code;
    applyI18n(document);
    document.querySelectorAll('select').forEach((s) => { if (s.id.startsWith('lang-select')) s.value = code; });
    document.dispatchEvent(new CustomEvent('jarvis:lang'));
  }

  // ---------------------------------------------------------------- thème
  function applyTheme() {
    const g = S.settings.global;
    const r = document.documentElement;
    r.dataset.theme = g.theme;
    const st = r.style;
    st.setProperty('--accent', g.accent);
    st.setProperty('--accent2', g.accent2);
    st.setProperty('--density', String(g.density));
    st.setProperty('--glass', g.glass + 'px');
    st.setProperty('--radius', g.radius + 'px');
    st.setProperty('--fs', g.fontSize + 'px');
    st.setProperty('--font', g.font);
    st.setProperty('--anim-speed', g.anim ? '.16s' : '0s');
    const bg = document.getElementById('bg');
    if (bg) {
      if (g.bgType === 'image' && g.bgUrl) { bg.style.backgroundImage = `url(${JSON.stringify(g.bgUrl)})`; bg.style.backgroundSize = 'cover'; bg.style.backgroundPosition = 'center'; }
      else if (g.bgType === 'video' && g.bgUrl) {
        let v = bg.querySelector('video');
        if (!v) { v = document.createElement('video'); v.autoplay = true; v.muted = true; v.loop = true; v.playsInline = true; v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover'; bg.appendChild(v); }
        if (v.getAttribute('src') !== g.bgUrl) v.setAttribute('src', g.bgUrl);
        v.play?.().catch(() => {});
      } else { bg.style.backgroundImage = ''; bg.querySelector('video')?.remove(); }
    }
    r.dataset.compact = S.settings.ai.compact ? '1' : '0';
    r.dataset.density = String(g.density);
  }

  // ---------------------------------------------------------------- DOM
  function el(tag, props, ...kids) {
    const n = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'style') n.style.cssText = v;
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (k === 'selected' || k === 'checked' || k === 'disabled') n[k] = !!v;
      else n.setAttribute(k, v);
    });
    kids.flat().forEach((c) => { if (c == null || c === false) return; n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); });
    return n;
  }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function toast(msg, kind, action) {
    const box = document.getElementById('toasts');
    if (!box) return;
    const n = el('div', { class: 'toast ' + (kind || '') }, el('span', { text: msg }));
    if (action && action.label && action.onClick) {
      const b = el('button', { class: 'btn sm', text: action.label });
      b.addEventListener('click', () => { try { action.onClick(); } finally { n.remove(); } });
      n.appendChild(b);
    }
    box.appendChild(n);
    setTimeout(() => { n.style.opacity = '0'; setTimeout(() => n.remove(), 250); }, action ? 8000 : 3800);
  }

  /** Telechargement qui marche AUSSI dans un apercu en iframe :
      on tente le lien, et on propose toujours « Ouvrir » (URL blob gardee 2 min). */
  function download(blob, filename, label) {
    let url = '';
    try { url = URL.createObjectURL(blob); } catch { url = ''; }
    if (!url) return toast(String(filename), 'err');
    const a = el('a', { href: url, download: filename, style: 'display:none' });
    document.body.appendChild(a);
    try { a.click(); } catch {}
    a.remove();
    toast((label || t('common.saved')) + ' — ' + filename, 'ok',
      { label: t('common.open'), onClick: () => openLink(url) });
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 120000);
    return url;
  }

  function modal({ title, sub, body, foot, vert, closeable = true, onClose } = {}) {
    const card = el('div', { class: 'modal' + (vert ? ' vert' : '') });
    const head = el('div', { class: 'row' }, el('h2', { text: title || '' }), el('span', { class: 'spacer' }));
    if (closeable) {
      const x = el('button', { class: 'ibtn', title: t('common.close') }, J.icon('close', 16));
      x.addEventListener('click', () => close());
      head.appendChild(x);
    }
    card.appendChild(head);
    if (sub) card.appendChild(el('div', { class: 'sub', text: sub }));
    if (body) card.appendChild(body);
    if (foot && foot.length) {
      const f = el('div', { class: 'foot' });
      foot.flat().forEach((x) => x && f.appendChild(x));
      card.appendChild(f);
    }
    const ov = el('div', { class: 'overlay' }, card);
    ov.addEventListener('click', (e) => { if (e.target === ov && closeable) close(); });
    document.body.appendChild(ov);
    function close() {
      if (!ov.parentElement) return;
      ov.remove();
      document.removeEventListener('keydown', onKey);
      onClose && onClose();
    }
    function onKey(e) { if (e.key === 'Escape' && closeable) { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', onKey);
    applyI18n(card);
    setTimeout(() => card.querySelector('input,textarea')?.focus(), 60);
    return { close, el: card, overlay: ov };
  }

  /** Modale avec compte à rebours : le DERNIER bouton reste verrouillé N secondes. */
  function countdownModal({ title, sub, body, seconds = 5, foot = [] }) {
    const btns = foot.map((f) => (typeof f === 'function' ? f() : f));
    const lock = btns[btns.length - 1];
    if (lock) {
      lock.disabled = true;
      lock.dataset.label = lock.textContent;
      let n = seconds;
      lock.textContent = lock.dataset.label + ' (' + n + ')';
      const iv = setInterval(() => {
        n -= 1;
        if (n <= 0) { clearInterval(iv); lock.disabled = false; lock.textContent = lock.dataset.label; }
        else lock.textContent = lock.dataset.label + ' (' + n + ')';
      }, 1000);
      const m = modal({ title, sub, body: el('div', {}, body || '', el('div', { class: 'notice warn tiny', style: 'margin-top:.6rem', text: t('paid.countdown') })), foot: btns, vert: true, onClose: () => clearInterval(iv) });
      return m;
    }
    return modal({ title, sub, body, foot: btns, vert: true });
  }

  /** Remplace window.prompt : saisie dans une vraie fenêtre JARVIS
      (les invites natives sont bloquées dans un aperçu en iframe). */
  function ask({ title, label, value = '', placeholder = '', ok = null } = {}) {
    return new Promise((resolve) => {
      const input = el('input', { type: 'text', value: value == null ? '' : value, placeholder });
      const okBtn = el('button', { class: 'btn primary', text: ok || t('common.ok') });
      const noBtn = el('button', { class: 'btn', text: t('common.cancel') });
      const m = modal({
        title: title || '', body: el('div', { class: 'field' }, label ? el('span', { text: label }) : null, input),
        foot: [noBtn, okBtn], vert: true, onClose: () => resolve(null),
      });
      const done = (v) => { const out = m.el ? null : null; m.close(); resolve(v); };
      okBtn.addEventListener('click', () => done(input.value.trim()));
      noBtn.addEventListener('click', () => done(null));
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(input.value.trim()); });
      setTimeout(() => input.focus(), 80);
    });
  }

  /** Remplace window.confirm. */
  function confirmBox({ title, body, ok, danger } = {}) {
    return new Promise((resolve) => {
      const okBtn = el('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), text: ok || t('common.ok') });
      const noBtn = el('button', { class: 'btn', text: t('common.cancel') });
      const m = modal({ title: title || '', body: typeof body === 'string' ? el('div', { text: body }) : body, foot: [noBtn, okBtn], vert: true, onClose: () => resolve(false) });
      okBtn.addEventListener('click', () => { m.close(); resolve(true); });
      noBtn.addEventListener('click', () => { m.close(); resolve(false); });
    });
  }

  /** Ouvre un lien externe même dans un aperçu : fenêtre, sinon onglet, sinon copie. */
  function openLink(url) {
    try { const w = window.open(url, '_blank', 'noopener'); if (w) return true; } catch {}
    try {
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      return true;
    } catch {}
    copy(url);
    toast(t('toast.copied') + ' — ' + url);
    return false;
  }

  // ---------------------------------------------------------------- API
  const authHeaders = () => (S.auth?.token ? { Authorization: 'Bearer ' + S.auth.token } : {});

  const API = {
    async call(path, { method = 'GET', body, headers } = {}) {
      try {
        const r = await fetch(path, {
          method,
          headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders(), headers || {}),
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const txt = await r.text();
        let data = {};
        try { data = txt ? JSON.parse(txt) : {}; } catch { data = { raw: txt }; }
        if (!r.ok && r.status === 401) { data.error = 'auth'; }
        return data;
      } catch (e) { return { error: String(e.message || e) }; }
    },
    /** SSE: renvoie une promesse résolue à la fin du flux. */
    async stream(path, payload, handlers = {}) {
      const ctrl = new AbortController();
      S.abort = ctrl;
      const r = await fetch(path, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      let ctype = '';
      try { ctype = (r.headers && r.headers.get) ? (r.headers.get('content-type') || '') : ''; } catch { ctype = ''; }
      const isStream = !!(r.body && typeof r.body.getReader === 'function') && (!ctype || ctype.includes('event-stream'));
      if (!r.ok || !isStream) {
        const txt = await r.text();
        let msg = txt;
        try { msg = JSON.parse(txt).error || txt; } catch {}
        handlers.error && handlers.error({ message: msg || ('HTTP ' + r.status) });
        S.abort = null;
        return;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop();
        for (const part of parts) {
          const ev = (part.match(/^event:\s*(.+)$/m) || [])[1];
          const dataLine = (part.match(/^data:\s*(.+)$/m) || [])[1];
          if (!ev || !dataLine) continue;
          let data = {};
          try { data = JSON.parse(dataLine); } catch {}
          const fn = handlers[ev];
          if (fn) fn(data);
        }
      }
      S.abort = null;
    },
    stop() { try { S.abort?.abort(); } catch {} S.abort = null; },
  };

  // ---------------------------------------------------------------- OpenRouter unifié
  /* TROIS canaux, essayés dans l'ordre, avec bascule automatique :
       1. « server » : le serveur JARVIS joint openrouter.ai (déploiement normal) ;
       2. « direct » : votre navigateur parle directement à l'API OpenRouter ;
       3. « relay »  : le pont local (fichier .bat, sur VOTRE ordinateur) fait
                       l'appel — utile si l'hébergeur bloque openrouter.ai.
     La liste des modèles vient TOUJOURS de l'API : aucune liste pré-écrite. */
  const ORapi = {
    channel: 'unknown',
    relay: false,
    lastError: null,
    detail: '',
    listeners: [],

    onChannel(fn) { this.listeners.push(fn); try { fn(this.channel); } catch {} return fn; },
    setChannel(c) {
      if (this.channel !== c) { this.channel = c; }
      this.listeners.forEach((fn) => { try { fn(c); } catch {} });
      return c;
    },

    /** Le pont local est-il connecté ? (troisième canal possible) */
    async checkRelay() {
      try {
        const st = await API.call('/api/bridge/status');
        this.relay = !!st.online;
      } catch { this.relay = false; }
      return this.relay;
    },

    /** Choisit le canal : serveur, sinon navigateur, sinon pont local. */
    async detect(force) {
      if (!force && this.channel !== 'unknown') return this.channel;
      let probe = {};
      try { probe = await API.call('/api/or-probe'); } catch {}
      if (probe && probe.ok) return this.setChannel('server');
      const direct = window.OR ? await window.OR.probeDirect() : { ok: false };
      this.lastError = (probe && probe.error) || (direct && direct.error) || 'reseau';
      this.detail = (probe && probe.error) || '';
      if (direct.ok) return this.setChannel('direct');
      if (await this.checkRelay()) return this.setChannel('relay');
      return this.setChannel('none');
    },

    // ---------- relais par le pont local (l'ordinateur de l'utilisateur)
    async relayCall(path, { method = 'GET', key, body, timeout = 90000 } = {}) {
      const r = await API.call('/api/or-relay', { method: 'POST', body: { path, method, key, body, timeout } });
      if (!r || r.ok !== true) {
        const offline = r && (r.error === 'bridge_offline' || r.error === 'no_session');
        return { ok: false, reason: offline ? 'pont_hors_ligne' : (r && r.error) || 'relais_indisponible', error: (r && (r.detail || r.error)) || '' };
      }
      return { ok: true, status: r.status, text: r.text || '' };
    },

    /** Liste des modèles via le pont local. */
    async relayModels(key) {
      const r = await this.relayCall('/models', { key, timeout: 45000 });
      if (!r.ok) return { ok: false, reason: r.reason, error: r.error, models: [] };
      if (r.status >= 400) {
        let msg = '';
        try { msg = JSON.parse(r.text).error.message; } catch { msg = r.text.slice(0, 200); }
        return { ok: false, status: r.status, reason: window.OR ? window.OR.human(msg, r.status) : 'openrouter_erreur', error: msg, models: [] };
      }
      let list = [];
      try { list = (JSON.parse(r.text).data || []).map((m) => window.OR.normalize(m)); } catch { return { ok: false, reason: 'flux_interrompu', models: [] }; }
      list.sort((a, b) => (a.free === b.free ? String(a.name).localeCompare(String(b.name)) : (a.free ? 1 : -1)));
      if (!list.length) return { ok: false, reason: 'liste_vide', models: [] };
      return { ok: true, models: list, via: 'relay' };
    },

    /** Liste des modèles, canal adapté + bascule automatique. */
    async models(key, { force } = {}) {
      await this.detect();
      const tryServer = async () => {
        const r = await API.call('/api/models?force=' + (force ? 1 : 0) + (key ? '&key=' + encodeURIComponent(key) : ''));
        if (r && Array.isArray(r.models) && r.models.length) return { ok: true, models: r.models, source: r.source || 'live', via: 'server' };
        return { ok: false, via: 'server', error: r && r.error, reason: (r && r.offline) ? 'reseau_ou_cors' : 'liste_vide' };
      };
      const tryDirect = async () => {
        if (!window.OR) return { ok: false, reason: 'inconnu' };
        const r = await window.OR.models({ key });
        if (r.ok) { this.setChannel('direct'); return { ok: true, models: r.models, via: 'direct' }; }
        if (r.cors) this.lastError = 'cors';
        return { ok: false, via: 'direct', error: r.error, reason: r.reason };
      };
      const order = this.channel === 'direct' ? [tryDirect, tryServer] : this.channel === 'relay' ? [() => this.relayModels(key), tryServer, tryDirect] : [tryServer, tryDirect, () => this.relayModels(key)];
      let out = { ok: false, reason: 'inconnu' };
      for (const fn of order) {
        out = await fn();
        if (out.ok) { if (out.via) this.setChannel(out.via); this.detail = ''; return out; }
        this.lastError = out.reason || this.lastError;
        this.detail = out.error || this.detail;
      }
      if (this.channel !== 'none') this.setChannel('none');
      return out;
    },

    /** Test de la clé sur tous les canaux disponibles. */
    async testKey(key, model) {
      await this.detect();
      const tryServer = async () => {
        const r = await API.call('/api/test-key', { method: 'POST', body: { key, model } });
        const ok = !!r && r.ok === true;
        const network = !!r && (r.status === 0 || r.offline);
        if (ok) return { ok: true, status: r.status, latency: r.latency, model: r.model || model, via: 'server' };
        if (!network && r && r.status) return { ok: false, status: r.status, latency: r.latency, detail: r.detail, reason: (r.status === 401 ? 'cle_invalide' : r.status === 402 ? 'credit' : r.status === 429 ? 'debit' : 'openrouter_erreur'), via: 'server' };
        return { ok: false, status: 0, detail: r && r.detail, reason: 'reseau_ou_cors', via: 'server' };
      };
      const tryDirect = async () => {
        if (!window.OR) return { ok: false, reason: 'inconnu', via: 'direct' };
        const r = await window.OR.testKey(key, model);
        if (r.ok) this.setChannel('direct');
        return Object.assign({ via: 'direct' }, r, { reason: r.reason || 'inconnu' });
      };
      const tryRelay = async () => {
        const r = await this.relayCall('/chat/completions', { method: 'POST', key, timeout: 60000,
          body: { model: model || this.firstFreeId(), messages: [{ role: 'user', content: 'ping' }], max_tokens: 4, stream: false } });
        if (!r.ok) return { ok: false, status: 0, reason: r.reason, error: r.error, via: 'relay' };
        if (r.status >= 400) {
          let msg = r.text.slice(0, 200);
          try { msg = JSON.parse(r.text).error.message; } catch {}
          return { ok: false, status: r.status, reason: window.OR ? window.OR.human(msg, r.status) : 'openrouter_erreur', detail: msg, via: 'relay' };
        }
        this.setChannel('relay');
        return { ok: true, status: r.status, model, via: 'relay' };
      };
      const order = this.channel === 'direct' ? [tryDirect, tryServer, tryRelay]
        : this.channel === 'relay' ? [tryRelay, tryServer, tryDirect]
        : [tryServer, tryDirect, tryRelay];
      let out = { ok: false, reason: 'inconnu' };
      for (const fn of order) {
        out = await fn();
        if (out.ok || (out.status && out.status >= 400)) { if (out.via) this.setChannel(out.via); return out; }
      }
      return out;
    },

    firstFreeId() {
      const l = (window.Chat && window.Chat.MODELS && window.Chat.MODELS.list) || [];
      const f = l.find((m) => m.free) || l[0];
      return f ? f.id : '';
    },

    /** Chat en streaming : serveur → navigateur → relais (relais = réponse d'un bloc, rejouée en streaming). */
    async chat(payload, handlers = {}) {
      await this.detect();
      const viaDirect = async () => {
        if (!window.OR) return { ok: false, reason: 'inconnu' };
        const r = await window.OR.stream(payload, handlers);
        if (r.ok) { this.setChannel('direct'); handlers.channel && handlers.channel('direct'); }
        return r;
      };
      const viaRelay = async () => {
        const body = Object.assign({}, payload, { stream: false });
        delete body.key;
        const r = await this.relayCall('/chat/completions', { method: 'POST', key: payload.key, body, timeout: 180000 });
        if (!r.ok) return { ok: false, reason: r.reason, error: r.error };
        if (r.status >= 400) {
          let msg = r.text.slice(0, 300);
          try { msg = JSON.parse(r.text).error.message; } catch {}
          handlers.error && handlers.error({ message: msg, reason: 'openrouter_erreur' });
          return { ok: false, status: r.status, reason: 'openrouter_erreur', error: msg };
        }
        let content = '', reasoning = '';
        try {
          const j = JSON.parse(r.text);
          const msg = (j.choices && j.choices[0] && j.choices[0].message) || {};
          content = typeof msg.content === 'string' ? msg.content : (msg.content || []).map((c) => c.text || '').join('');
          reasoning = msg.reasoning || '';
        } catch { return { ok: false, reason: 'flux_interrompu', error: r.text.slice(0, 200) }; }
        if (reasoning && handlers.reasoning) handlers.reasoning({ text: reasoning });
        // on rejoue la réponse en petits morceaux pour garder l'effet de streaming
        for (let i = 0; i < content.length; i += 24) {
          if (this._stopped) break;
          handlers.delta && handlers.delta({ text: content.slice(i, i + 24) });
          await new Promise((res) => setTimeout(res, 8));
        }
        this.setChannel('relay');
        handlers.channel && handlers.channel('relay');
        handlers.done && handlers.done({});
        return { ok: true, got: !!content, via: 'relay' };
      };
      const viaServer = () => new Promise((resolve) => {
        let got = false, offline = false, failed = null;
        API.stream('/api/chat', payload, Object.assign({}, handlers, {
          delta: (d) => { got = true; handlers.delta && handlers.delta(d); },
          reasoning: (d) => { got = true; handlers.reasoning && handlers.reasoning(d); },
          offline: (d) => { offline = true; failed = d; },
          error: (d) => { failed = d; },
          done: () => { handlers.done && handlers.done({}); },
        })).then(() => {
          if (offline) return resolve({ ok: false, reason: 'reseau_ou_cors', error: (failed && failed.message) || '', offline: true });
          if (failed) return resolve({ ok: false, status: failed.status, reason: failed.status === 401 ? 'cle_invalide' : failed.status === 402 ? 'credit' : failed.status === 429 ? 'debit' : 'openrouter_erreur', error: failed.message });
          handlers.channel && handlers.channel('server');
          resolve({ ok: true, got });
        }).catch((e) => resolve({ ok: false, reason: 'reseau_ou_cors', error: String((e && e.message) || e) }));
      });

      const order = this.channel === 'direct' ? [viaDirect, viaServer, viaRelay]
        : this.channel === 'relay' ? [viaRelay, viaServer, viaDirect]
        : [viaServer, viaDirect, viaRelay];
      let out = { ok: false, reason: 'inconnu' };
      for (const fn of order) {
        out = await fn();
        if (out.ok) {
          if (!out.via) this.setChannel(this.channel === 'unknown' ? 'server' : this.channel);
          return out;
        }
        if (out.aborted) return out;
        // 401/402/429 : la réponse vient d'OpenRouter, inutile de changer de canal
        if (out.status && out.status >= 400) break;
      }
      handlers.error && handlers.error({ message: out.error || 'reseau_ou_cors', reason: out.reason });
      return out;
    },

    /** Réponse complète (studio image/vidéo). */
    async chatOnce(payload) {
      await this.detect();
      const viaServer = async () => {
        const r = await API.call('/api/chat-once', { method: 'POST', body: payload });
        if (r && r.ok) return r;
        return { ok: false, reason: r && r.status ? 'openrouter_erreur' : 'reseau_ou_cors', error: (r && (r.error || r.raw)) || '' };
      };
      const viaDirect = async () => {
        if (!window.OR) return { ok: false, reason: 'inconnu' };
        const r = await window.OR.chatOnce(payload);
        if (r.ok) this.setChannel('direct');
        return r;
      };
      const viaRelay = async () => {
        const body = Object.assign({}, payload, { stream: false });
        delete body.key;
        const r = await this.relayCall('/chat/completions', { method: 'POST', key: payload.key, body, timeout: 180000 });
        if (!r.ok) return { ok: false, reason: r.reason, error: r.error };
        if (r.status >= 400) { let m = r.text.slice(0, 200); try { m = JSON.parse(r.text).error.message; } catch {} return { ok: false, reason: 'openrouter_erreur', status: r.status, error: m }; }
        try {
          const j = JSON.parse(r.text);
          const msg = (j.choices && j.choices[0] && j.choices[0].message) || {};
          const content = typeof msg.content === 'string' ? msg.content : (msg.content || []).map((c) => c.text || '').join('');
          this.setChannel('relay');
          return { ok: true, content, reasoning: msg.reasoning || '' };
        } catch { return { ok: false, reason: 'flux_interrompu', error: r.text.slice(0, 200) }; }
      };
      const order = this.channel === 'direct' ? [viaDirect, viaServer, viaRelay]
        : this.channel === 'relay' ? [viaRelay, viaServer, viaDirect]
        : [viaServer, viaDirect, viaRelay];
      let out = { ok: false, reason: 'inconnu' };
      for (const fn of order) { out = await fn(); if (out.ok) return out; }
      return out;
    },

    /** Génération d'image : serveur → navigateur → relais. */
    async image(payload) {
      await this.detect();
      const viaServer = async () => {
        const r = await API.call('/api/image', { method: 'POST', body: payload });
        if (r && r.images && r.images.length) return { ok: true, ...r };
        return { ok: false, reason: r && r.offline ? 'reseau_ou_cors' : (r && r.error) ? 'openrouter_erreur' : 'liste_vide', error: r && r.error, status: r && r.status };
      };
      const viaDirect = async () => {
        if (!window.OR) return { ok: false, reason: 'inconnu' };
        const r = await window.OR.image(payload);
        if (r.ok && r.images.length) this.setChannel('direct');
        return r;
      };
      const viaRelay = async () => {
        const body = Object.assign({}, payload, { modalities: ['image', 'text'], stream: false });
        delete body.key;
        const r = await this.relayCall('/chat/completions', { method: 'POST', key: payload.key, body, timeout: 180000 });
        if (!r.ok) return { ok: false, reason: r.reason, error: r.error };
        try {
          const j = JSON.parse(r.text);
          const msg = (j.choices && j.choices[0] && j.choices[0].message) || {};
          const imgs = [];
          for (const im of msg.images || []) { const u = (im.image_url && im.image_url.url) || im.url || im.image_url; if (u) imgs.push(u); }
          if (!imgs.length && Array.isArray(msg.content)) for (const part of msg.content) { const u = (part.image_url && part.image_url.url) || part.image_url; if (u) imgs.push(u); }
          if (imgs.length) this.setChannel('relay');
          return { ok: imgs.length > 0, images: imgs, text: typeof msg.content === 'string' ? msg.content : '', reason: imgs.length ? null : 'modele_inconnu' };
        } catch { return { ok: false, reason: 'flux_interrompu', error: r.text.slice(0, 200) }; }
      };
      const order = this.channel === 'direct' ? [viaDirect, viaServer, viaRelay]
        : this.channel === 'relay' ? [viaRelay, viaServer, viaDirect]
        : [viaServer, viaDirect, viaRelay];
      let out = { ok: false, reason: 'inconnu' };
      for (const fn of order) { out = await fn(); if (out.ok) return out; }
      return out;
    },

    /** Diagnostic complet : serveur → navigateur → pont local. */
    async diagnose(key) {
      const steps = [];
      const t0 = Date.now();
      let server = {};
      try { server = await API.call('/api/or-probe'); } catch (e) { server = { ok: false, error: String(e && e.message || e) }; }
      steps.push({ step: 'serveur', ok: !!server.ok, detail: server.ok ? 'serveur → OpenRouter OK (' + server.ms + ' ms)' : 'serveur → OpenRouter : ' + (server.error || 'échec') });
      let direct = { ok: false };
      if (window.OR) direct = await window.OR.probeDirect();
      steps.push({ step: 'navigateur', ok: !!direct.ok, detail: direct.ok ? 'navigateur → OpenRouter OK (' + direct.ms + ' ms)' : 'navigateur → OpenRouter : ' + (direct.cors ? 'bloqué par CORS' : (direct.error || 'échec')) });
      const relayOn = await this.checkRelay();
      steps.push({ step: 'pont', ok: !!relayOn, detail: relayOn ? 'pont local (votre PC) connecté et disponible comme relais' : 'pont local non connecté (lancez JARVIS-Setup.bat pour l’activer)' });
      if (key) {
        const t = await this.testKey(key, null);
        steps.push({ step: 'cle', ok: !!t.ok, detail: t.ok ? 'clé valide (' + (t.model || '') + ', via ' + t.via + ') — version ' + (t.via || '?') : 'clé : ' + t.reason + (t.detail ? ' — ' + String(t.detail).slice(0, 120) : '') });
      }
      return { ok: steps.some((s) => s.ok && s.step !== 'pont'), steps, ms: Date.now() - t0, channel: this.channel };
    },

    stop() { this._stopped = true; try { window.OR && window.OR.stop(); } catch {} API.stop(); setTimeout(() => { this._stopped = false; }, 50); },
  };

  // ---------------------------------------------------------------- markdown
  function md(src) {
    if (!src) return '';
    let s = String(src);
    const blocks = [];
    s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (m, lang, code) => {
      blocks.push('<pre><code class="lang-' + esc(lang || '') + '">' + esc(code.replace(/\n$/, '')) + '</code></pre>');
      return '\n\u0000B' + (blocks.length - 1) + '\u0000\n';
    });
    s = esc(s);
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    s = s.replace(/^#{4,6}\s+(.+)$/gm, '<h4>$1</h4>').replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
      .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>').replace(/^#\s+(.+)$/gm, '<h2>$1</h2>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|\W)\*([^*\n]+)\*/g, '$1<i>$2</i>');
    s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/^\s*&gt;\s?(.*)$/gm, '<blockquote>$1</blockquote>');
    s = s.replace(/^\s*([-*+])\s+/gm, '• ');
    s = s.replace(/^\s*(\d+)\.\s+/gm, '$1. ');
    // tableaux
    s = s.replace(/^(\|.*\|)\n\|[\s:|-]+\|\n((?:\|.*\|\n?)*)/gm, (m, head, rows) => {
      const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim());
      let out = '<table><thead><tr>' + cells(head).map((c) => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>';
      rows.trim().split('\n').forEach((row) => { out += '<tr>' + cells(row).map((c) => '<td>' + c + '</td>').join('') + '</tr>'; });
      return out + '</tbody></table>';
    });
    s = s.replace(/\u0000B(\d+)\u0000/g, (m, i) => blocks[Number(i)]);
    s = s.replace(/^\s*---\s*$/gm, '<hr>');
    s = s.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
    return '<p>' + s + '</p>';
  }

  // ---------------------------------------------------------------- voix
  function speak(text, { onend } = {}) {
    if (!text || !window.speechSynthesis) { onend && onend(); return; }
    try {
      speechSynthesis.cancel();
      const p = S.settings.profiles[S.settings.activeProfile] || {};
      const u = new SpeechSynthesisUtterance(String(text).replace(/```[\s\S]*?```/g, ' ').replace(/[*#`>]/g, '').slice(0, 5000));
      u.lang = VOICE_LANGS[S.settings.lang] || 'fr-FR';
      u.rate = p.voiceRate || 1;
      u.pitch = p.voicePitch || 1;
      if (p.voice) { const v = speechSynthesis.getVoices().find((x) => x.name === p.voice); if (v) u.voice = v; }
      u.onend = () => onend && onend();
      u.onerror = () => onend && onend();
      speechSynthesis.speak(u);
    } catch { onend && onend(); }
  }
  const stopSpeak = () => { try { speechSynthesis.cancel(); } catch {} };

  function createSTT(onPartial, onFinal) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.lang = S.settings.ai.sttLang || VOICE_LANGS[S.settings.lang] || 'fr-FR';
    rec.continuous = true; rec.interimResults = true;
    rec.onresult = (e) => {
      let full = '';
      for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript;
      const last = e.results[e.results.length - 1];
      if (last.isFinal) { onFinal && onFinal(full.trim()); rec.stop(); }
      else onPartial && onPartial(full);
    };
    rec.onerror = () => {};
    return rec;
  }

  // ---------------------------------------------------------------- cloud
  async function cloudPull() {
    if (!S.auth?.token || S.auth.guest) return;
    const r = await API.call('/api/auth/cloud');
    const c = r.cloud || {};
    if (c.openrouterKey && !S.key) { S.key = c.openrouterKey; LS.setRaw('key', S.key); }
    if (c.openrouterModel && !S.model) { S.model = c.openrouterModel; S.settings.ai.model = S.model; save('settings'); }
    if (c.settings) { S.settings = Object.assign(DEFAULTS(), c.settings); save('settings'); }
  }
  async function cloudPush() {
    if (!S.auth?.token || S.auth.guest) return;
    await API.call('/api/auth/cloud', { method: 'POST', body: { key: 'settings', value: S.settings } });
  }

  // ---------------------------------------------------------------- icônes
  const ico = (name, size = 18, cls = '') => {
    const set = window.ICONS || {};
    const d = set[name] || set.circle;
    return `<svg class="ic ${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  };
  const icon = (name, size = 18, cls = '') => {
    const wrap = document.createElement('span');
    wrap.style.cssText = 'display:inline-flex;align-items:center';
    wrap.innerHTML = ico(name, size, cls);
    return wrap.firstChild;
  };

  // ---------------------------------------------------------------- fond
  function startBg() {
    const cv = document.querySelector('#bg canvas');
    if (!cv || !S.settings.global.particles) return;
    let ctx = null;
    try { ctx = cv.getContext('2d'); } catch {}
    if (!ctx) return;
    let w, h, pts;
    const size = () => {
      w = cv.width = innerWidth; h = cv.height = innerHeight;
      pts = Array.from({ length: Math.min(70, Math.round(w / 22)) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.6 + 0.4, vy: Math.random() * 0.22 + 0.05, vx: (Math.random() - 0.5) * 0.12 }));
    };
    size();
    addEventListener('resize', size);
    const loop = () => {
      ctx.clearRect(0, 0, w, h);
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#22d3ee';
      ctx.fillStyle = accent;
      pts.forEach((p) => {
        p.x += p.vx; p.y -= p.vy;
        if (p.y < -6) { p.y = h + 6; p.x = Math.random() * w; }
        ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      });
      requestAnimationFrame(loop);
    };
    loop();
  }

  /** Copie robuste : presse-papiers moderne, sinon repli (et jamais d'erreur visible). */
  function fallbackCopy(str) {
    try {
      const ta = document.createElement('textarea');
      ta.value = str;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand ? document.execCommand('copy') : false;
      ta.remove();
      return !!ok;
    } catch { return false; }
  }
  function copy(s) {
    const str = String(s == null ? '' : s);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(str).then(() => true).catch(() => fallbackCopy(str));
      }
    } catch {}
    return Promise.resolve(fallbackCopy(str));
  }

  window.LANGS = LANGS;
  window.J = {
    S, t, el, esc, save, toast, modal, countdownModal, API, md, applyTheme, applyI18n, setLang, LS,
    DEFAULTS, DEFAULT_PROFILE, LANGS, VOICE_LANGS, ico, icon, speak, stopSpeak, createSTT, download,
    cloudPull, cloudPush, copy, startBg, ORapi, ask, confirmBox, openLink,
    get state() { return S; },
  };
  document.addEventListener('DOMContentLoaded', () => { document.documentElement.lang = S.settings.lang; applyI18n(document); startBg(); });
})();
