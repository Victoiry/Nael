/* JARVIS core: state, i18n, UI helpers, api, markdown, voice, media */
(function () {
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('jarvis:' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('jarvis:' + k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem('jarvis:' + k); } catch {} },
    raw(k, d) { try { return sessionStorage.getItem('jarvis:' + k) || d; } catch { return d; } },
    setRaw(k, v) { try { sessionStorage.setItem('jarvis:' + k, v); } catch {} },
  };

  const DEFAULT_PROFILE = () => ({
    id: 'p' + Math.random().toString(36).slice(2, 8),
    name: 'Mon réglage',
    aiName: 'JARVIS',
    userName: '',
    profession: '',
    language: '',
    calling: '',
    personality: 'Professionnel, précis, chaleureux, proactif',
    tone: 'Direct et clair',
    instructions: '',
    forbidden: '',
    expertise: 'Adapte-toi à mon niveau',
    avatar: '🤖',
    voice: '',
    voiceRate: 1,
    voicePitch: 1,
  });

  const DEFAULTS = () => ({
    lang: (navigator.language || 'fr').slice(0, 2).toLowerCase().match(/^(fr|en|es|it)$/) ? (navigator.language || 'fr').slice(0, 2).toLowerCase() : 'fr',
    profiles: [DEFAULT_PROFILE()],
    activeProfile: 0,
    global: {
      theme: 'dark', accent: '#22d3ee', accent2: '#a855f7',
      bgType: 'gradient', bgUrl: '', particles: true, glass: 18, density: 1, radius: 16,
      font: "'Inter', 'Segoe UI', system-ui, sans-serif", fontSize: 15, anim: true,
    },
    ai: {
      temperature: 0.7, maxTokens: 2000, stream: true, autoScroll: true, enterSend: true,
      ttsAuto: false, sttLang: '', wake: true, visionWarn: true, compact: false, privateDefault: false,
      approvalMode: 'ask', maxRisk: 'high', model: '', effort: 'normal', useMemory: true, useHistory: true,
    },
  });

  function deepMerge(base, over) {
    if (Array.isArray(base)) return Array.isArray(over) ? over : base;
    if (typeof base === 'object' && base) {
      const out = { ...base };
      for (const k of Object.keys(over || {})) out[k] = (typeof base[k] === 'object' && base[k] && !Array.isArray(base[k])) ? deepMerge(base[k], over[k]) : (over[k] === undefined ? base[k] : over[k]);
      return out;
    }
    return over === undefined ? base : over;
  }

  const S = {
    settings: deepMerge(DEFAULTS(), LS.get('settings', {})),
    conv: LS.get('convs', []),
    mem: LS.get('mem', []),
    skills: LS.get('skills', []),
    hist: LS.get('hist', []),
    key: LS.raw('key', '') || LS.get('key', ''),
    model: LS.get('model', ''),
    auth: LS.get('auth', null),
    user: null,
    mode: LS.get('mode', 'chat'),
    tab: 'classic',
    activeId: null,
    bridge: { sessionId: LS.raw('bsid', '') || ('sess_' + Math.random().toString(36).slice(2, 8)), online: false, verified: !!LS.get('paired', false) },
    private: false,
    abort: null,
  };

  const listeners = [];
  function save(what) {
    if (what === 'settings' || !what) LS.set('settings', S.settings);
    if (what === 'conv' || !what) LS.set('convs', S.conv.slice(0, 200));
    if (what === 'mem' || !what) LS.set('mem', S.mem);
    if (what === 'skills' || !what) LS.set('skills', S.skills);
    if (what === 'hist' || !what) LS.set('hist', S.hist.slice(0, 300));
    if (what === 'auth' || !what) LS.set('auth', S.auth);
    if (what === 'key' || !what) { LS.setRaw('key', S.key); }
    if (what === 'model' || !what) LS.set('model', S.model);
    if (what === 'mode' || !what) LS.set('mode', S.mode);
    listeners.forEach((f) => { try { f(what); } catch {} });
    if (!S.private) cloudPush();
  }
  const onSave = (f) => listeners.push(f);

  // ---------------- i18n
  function t(key, vars) {
    const dict = window.I18N[S.settings.lang] || window.I18N.fr;
    let s = dict[key] !== undefined ? dict[key] : (window.I18N.en[key] !== undefined ? window.I18N.en[key] : key);
    if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }
  function applyI18n(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((e) => { e.textContent = t(e.dataset.i18n); });
    scope.querySelectorAll('[data-i18n-ph]').forEach((e) => { e.placeholder = t(e.dataset.i18nPh); });
    scope.querySelectorAll('[data-i18n-title]').forEach((e) => { e.title = t(e.dataset.i18nTitle); });
    document.documentElement.lang = S.settings.lang;
  }
  function setLang(l) { S.settings.lang = l; save('settings'); applyI18n(document); document.dispatchEvent(new CustomEvent('jarvis:lang')); }

  // ---------------- theme
  function applyTheme() {
    const g = S.settings.global;
    const r = document.documentElement;
    r.dataset.theme = g.theme;
    r.dataset.anim = g.anim ? '1' : '0';
    r.style.setProperty('--accent', g.accent);
    r.style.setProperty('--accent2', g.accent2);
    r.style.setProperty('--glass', g.glass + 'px');
    r.style.setProperty('--density', g.density);
    r.style.setProperty('--radius', g.radius + 'px');
    r.style.setProperty('--font', g.font);
    r.style.setProperty('--fs', g.fontSize + 'px');
    const layer = document.querySelector('#bg .layer');
    const cv = document.querySelector('#bg canvas');
    if (layer) {
      if (g.bgType === 'image' && g.bgUrl) { layer.style.backgroundImage = `url("${g.bgUrl}")`; layer.style.display = 'block'; }
      else if (g.bgType === 'video' && g.bgUrl) { layer.style.display = 'none'; ensureBgVideo(g.bgUrl); }
      else { layer.style.backgroundImage = 'none'; layer.style.display = 'none'; }
    }
    if (cv) cv.style.display = g.particles ? 'block' : 'none';
    if (g.particles) startParticles();
  }
  let bgVideo = null;
  function ensureBgVideo(url) {
    if (bgVideo && bgVideo.src === url) return;
    if (bgVideo) bgVideo.remove();
    bgVideo = document.createElement('video');
    bgVideo.src = url; bgVideo.muted = true; bgVideo.loop = true; bgVideo.autoplay = true; bgVideo.playsInline = true;
    bgVideo.className = 'layer'; bgVideo.style.display = 'block';
    document.getElementById('bg').appendChild(bgVideo);
  }
  let pAnim = null;
  function startParticles() {
    const cv = document.querySelector('#bg canvas');
    if (!cv || pAnim) return;
    const ctx = cv.getContext && cv.getContext('2d');
    if (!ctx) return;
    let w, h, dots;
    const resize = () => { w = cv.width = innerWidth; h = cv.height = innerHeight; dots = Array.from({ length: 60 }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: Math.random() * 1.9 + .5 })); };
    resize(); addEventListener('resize', resize);
    const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#22d3ee';
    pAnim = setInterval(() => {
      if (!S.settings.global.particles) return;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = accent(); ctx.globalAlpha = .5;
      dots.forEach((d) => { d.x += d.vx; d.y += d.vy; if (d.x < 0 || d.x > w) d.vx *= -1; if (d.y < 0 || d.y > h) d.vy *= -1; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill(); });
      ctx.globalAlpha = .12; ctx.strokeStyle = accent();
      for (let i = 0; i < dots.length; i++) for (let j = i + 1; j < dots.length; j++) {
        const a = dots[i], b = dots[j], dx = a.x - b.x, dy = a.y - b.y;
        if (dx * dx + dy * dy < 13000) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
    }, 40);
  }

  // ---------------- api
  const API = {
    base: '',
    async call(path, opts = {}) {
      const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
      if (S.auth?.token) headers.Authorization = 'Bearer ' + S.auth.token;
      const r = await fetch(path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
      const txt = await r.text();
      try { return JSON.parse(txt); } catch { return { raw: txt }; }
    },
    async stream(path, body, handlers) {
      const headers = { 'Content-Type': 'application/json' };
      if (S.auth?.token) headers.Authorization = 'Bearer ' + S.auth.token;
      const ctrl = new AbortController();
      S.abort = ctrl;
      const r = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
      if (!r.ok || !r.body) { const tx = await r.text().catch(() => ''); throw new Error('HTTP ' + r.status + ' ' + tx.slice(0, 200)); }
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n'); buf = parts.pop();
        for (const part of parts) {
          const ev = (part.match(/^event:\s*(.+)$/m) || [])[1];
          const dataLine = (part.match(/^data:\s*(.+)$/m) || [])[1];
          if (!ev || !dataLine) continue;
          try { handlers[ev] && handlers[ev](JSON.parse(dataLine)); } catch {}
        }
      }
      S.abort = null;
    },
    stop() { try { S.abort?.abort(); } catch {} S.abort = null; },
  };

  // ---------------- ui
  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null) n.setAttribute(k, v);
    }
    kids.flat().forEach((k) => k && n.appendChild(typeof k === 'string' ? document.createTextNode(k) : k));
    return n;
  }
  function toast(msg, kind = '') {
    const box = document.getElementById('toasts');
    const n = el('div', { class: 'toast ' + kind, text: msg });
    box.appendChild(n);
    setTimeout(() => { n.style.opacity = '0'; setTimeout(() => n.remove(), 300); }, 3600);
  }
  function modal({ title, sub, body, foot, vert, onClose, closeable = true }) {
    const overlay = el('div', { class: 'overlay' });
    const m = el('div', { class: 'modal' + (vert ? ' vert' : '') });
    if (title) m.appendChild(el('h2', { text: title }));
    if (sub) m.appendChild(el('div', { class: 'sub', text: sub }));
    if (body) m.appendChild(typeof body === 'string' ? el('div', { html: body }) : body);
    if (foot) { const f = el('div', { class: 'foot' }); (Array.isArray(foot) ? foot : [foot]).forEach((b) => f.appendChild(b)); m.appendChild(f); }
    overlay.appendChild(m);
    if (closeable) overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    function close() { overlay.remove(); onClose && onClose(); }
    return { overlay, modal: m, close };
  }
  function countdownModal({ title, body, foot, seconds = 5 }) {
    const notice = el('div', { class: 'notice danger' });
    const wrap = el('div', {}, notice);
    const m = modal({ title, sub: body, body: wrap, vert: true });
    let left = seconds;
    const btns = [];
    const f = el('div', { class: 'foot' });
    (foot || []).forEach((fn) => { const b = fn(); btns.push(b); f.appendChild(b); });
    m.modal.appendChild(f);
    function tick() {
      notice.innerHTML = '<b>' + t('paid.wait', { s: left }) + '</b>';
      btns.forEach((b, i) => { if (i > 1) b.disabled = left > 0; });
      if (left <= 0) { notice.className = 'notice ok'; notice.innerHTML = '<b>✔</b>'; return; }
      left--; setTimeout(tick, 1000);
    }
    tick();
    return m;
  }
  function md(text) {
    let s = String(text || '');
    const blocks = [];
    s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => { blocks.push(code); return `\u0000B${blocks.length - 1}\u0000`; });
    s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|\W)\*([^*\n]+)\*/g, '$1<i>$2</i>')
      .replace(/^### (.*)$/gm, '<h4>$1</h4>')
      .replace(/^## (.*)$/gm, '<h3>$1</h3>')
      .replace(/^# (.*)$/gm, '<h3>$1</h3>')
      .replace(/^\s*[-*] (.*)$/gm, '• $1')
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/g, '<br>');
    s = s.replace(/\u0000B(\d+)\u0000/g, (_, i) => '<pre><code>' + String(blocks[+i]).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</code></pre>');
    return s;
  }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function copy(text) { navigator.clipboard?.writeText(text).then(() => toast(t('toast.copied'), 'ok')); }

  // ---------------- voice
  const VOICE_LANGS = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', it: 'it-IT' };
  function sttLang() { return S.settings.ai.sttLang || VOICE_LANGS[S.settings.lang] || 'fr-FR'; }
  function createSTT(onText, onEnd, onStart) {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) return null;
    const r = new Rec();
    r.lang = sttLang(); r.continuous = true; r.interimResults = true;
    let finalTxt = '';
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalTxt += res[0].transcript;
        else interim += res[0].transcript;
      }
      onText(finalTxt + interim, finalTxt);
    };
    r.onerror = () => {};
    r.onstart = () => onStart && onStart();
    r.onend = () => onEnd && onEnd(finalTxt);
    return r;
  }
  function speak(text, opts = {}) {
    if (!window.speechSynthesis) { toast('Speech synthesis unavailable', 'err'); return; }
    const p = S.settings.profiles[S.settings.activeProfile] || {};
    const u = new SpeechSynthesisUtterance(String(text).replace(/```[\s\S]*?```/g, ' code ').slice(0, 4000));
    u.lang = VOICE_LANGS[S.settings.lang] || 'fr-FR';
    u.rate = p.voiceRate || 1; u.pitch = p.voicePitch || 1;
    if (p.voice) { const v = speechSynthesis.getVoices().find((x) => x.name === p.voice); if (v) u.voice = v; }
    if (opts.onend) u.onend = opts.onend;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
  function stopSpeak() { try { speechSynthesis.cancel(); } catch {} }

  // ---------------- cloud sync
  let pushTimer = null;
  function cloudPush() {
    if (!S.auth?.token || S.auth.guest) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      try {
        await API.call('/api/auth/cloud', { method: 'POST', body: { key: 'settings', value: S.settings } });
        await API.call('/api/auth/cloud', { method: 'POST', body: { key: 'convs', value: S.conv.slice(0, 60) } });
        await API.call('/api/auth/cloud', { method: 'POST', body: { key: 'mem', value: S.mem } });
        await API.call('/api/auth/cloud', { method: 'POST', body: { key: 'skills', value: S.skills } });
      } catch {}
    }, 1500);
  }
  async function cloudPull() {
    if (!S.auth?.token || S.auth.guest) return;
    try {
      const r = await API.call('/api/auth/cloud');
      if (r.cloud?.settings) S.settings = deepMerge(DEFAULTS(), r.cloud.settings);
      if (Array.isArray(r.cloud?.convs) && r.cloud.convs.length) S.conv = r.cloud.convs;
      if (Array.isArray(r.cloud?.mem)) S.mem = r.cloud.mem;
      if (Array.isArray(r.cloud?.skills) && r.cloud.skills.length) S.skills = r.cloud.skills;
    } catch {}
  }

  window.J = { LS, S, t, applyI18n, setLang, applyTheme, el, toast, modal, countdownModal, md, esc, copy, API, save, onSave, DEFAULTS, DEFAULT_PROFILE, deepMerge, createSTT, speak, stopSpeak, sttLang, cloudPush, cloudPull, VOICE_LANGS };
})();
