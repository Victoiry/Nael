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

  function toast(msg, kind) {
    const box = document.getElementById('toasts');
    if (!box) return;
    const n = el('div', { class: 'toast ' + (kind || ''), text: msg });
    box.appendChild(n);
    setTimeout(() => { n.style.opacity = '0'; setTimeout(() => n.remove(), 250); }, 3800);
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

  const copy = (s) => { try { navigator.clipboard.writeText(String(s)); } catch {} };

  window.LANGS = LANGS;
  window.J = {
    S, t, el, esc, save, toast, modal, countdownModal, API, md, applyTheme, applyI18n, setLang, LS,
    DEFAULTS, DEFAULT_PROFILE, LANGS, VOICE_LANGS, ico, icon, speak, stopSpeak, createSTT,
    cloudPull, cloudPush, copy, startBg,
    get state() { return S; },
  };
  document.addEventListener('DOMContentLoaded', () => { document.documentElement.lang = S.settings.lang; applyI18n(document); startBg(); });
})();
