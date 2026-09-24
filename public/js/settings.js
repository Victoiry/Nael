/* JARVIS — panneau de réglages (personnaliser / global / IA / historique / mémoire / console / pont) */
(function () {
  const { S, t, el, save, applyTheme, applyI18n, toast, modal, API, esc, DEFAULTS, DEFAULT_PROFILE } = window.J;
  const PANEL = {};

  // ---------- widgets ----------
  function field(labelKey, input, hint) {
    const l = el('label', { class: 'field' }, el('span', { text: t(labelKey) }), input);
    if (hint) l.appendChild(el('small', { class: 'muted tiny', text: hint }));
    return l;
  }
  function textInput(value, onInput, type = 'text', ph = '') {
    const i = el('input', { type, value: value == null ? '' : value, placeholder: ph });
    i.addEventListener('input', () => onInput(i.value));
    return i;
  }
  function areaInput(value, onInput, ph = '') {
    const i = el('textarea', { placeholder: ph });
    i.value = value || '';
    i.addEventListener('input', () => onInput(i.value));
    return i;
  }
  function slider(labelKey, min, max, step, value, onInput) {
    const r = el('input', { type: 'range', min, max, step, value });
    const out = el('span', { class: 'chip tiny', text: String(value) });
    r.addEventListener('input', () => { out.textContent = r.value; onInput(Number(r.value)); });
    return el('div', {}, el('div', { class: 'row' }, el('span', { class: 'tiny muted', text: t(labelKey) }), el('span', { class: 'spacer' }), out), r);
  }
  function switchRow(labelKey, value, onChange, hint) {
    const sw = el('div', { class: 'switch' + (value ? ' on' : '') });
    sw.addEventListener('click', () => { const v = !sw.classList.contains('on'); sw.classList.toggle('on', v); onChange(v); });
    const lab = el('div', {}, el('div', { text: t(labelKey) }), hint ? el('div', { class: 'tiny muted', text: hint }) : null);
    return el('div', { class: 'switch-row' }, lab, sw);
  }
  function selectInput(options, value, onChange) {
    const s = el('select');
    options.forEach((o) => {
      const opt = el('option', { value: o.v, text: o.l });
      if (String(o.v) === String(value)) opt.selected = true;
      s.appendChild(opt);
    });
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }
  function section(titleKey, ...kids) {
    const sec = el('div', { class: 'panel-sec' }, el('h4', { text: t(titleKey) }), ...kids);
    return sec;
  }
  function profile() { return S.settings.profiles[S.settings.activeProfile] || S.settings.profiles[0]; }
  function updateProfile(patch, rerender = false) {
    const p = profile();
    Object.assign(p, patch);
    save('settings');
    if (rerender) render(PANEL.current);
  }

  // ---------- sections ----------
  function personalize() {
    const box = el('div', { class: 'col' });
    const p = profile();

    const list = el('div', { class: 'col' });
    S.settings.profiles.forEach((pr, i) => {
      const row = el('div', { class: 'model-row' + (i === S.settings.activeProfile ? ' active' : '') },
        el('span', { class: 'radio' }),
        el('div', { class: 'nm' }, el('b', { text: pr.name || '—' }), el('small', { text: pr.aiName || '' })),
        el('span', { class: 'chip tiny', text: t('set.profileActive'), style: i === S.settings.activeProfile ? '' : 'display:none' }));
      row.addEventListener('click', () => { S.settings.activeProfile = i; save('settings'); render('personalize'); });
      list.appendChild(row);
    });
    box.appendChild(section('set.personalize', list,
      el('div', { class: 'row', style: 'margin-top:.5rem' },
        el('button', { class: 'btn sm', text: '+ ' + t('set.newProfile'), onclick: () => {
          const name = prompt(t('set.profileName'));
          if (!name) return;
          const np = DEFAULT_PROFILE(); np.name = name;
          S.settings.profiles.push(np); S.settings.activeProfile = S.settings.profiles.length - 1; save('settings'); render('personalize');
        } }),
        el('button', { class: 'btn sm', text: t('set.duplicate'), onclick: () => {
          const cp = JSON.parse(JSON.stringify(profile())); cp.id = 'p' + Math.random().toString(36).slice(2, 8); cp.name += ' (copie)';
          S.settings.profiles.push(cp); S.settings.activeProfile = S.settings.profiles.length - 1; save('settings'); render('personalize');
        } }),
        el('button', { class: 'btn sm danger', text: t('nav.delete'), onclick: () => {
          if (S.settings.profiles.length < 2) return toast('min 1', 'err');
          S.settings.profiles.splice(S.settings.activeProfile, 1);
          S.settings.activeProfile = 0; save('settings'); render('personalize');
        } }))));

    const fields = el('div', {},
      field('set.profileName', textInput(p.name, (v) => updateProfile({ name: v })),
        t('set.profileName')),
      field('set.aiName', textInput(p.aiName, (v) => updateProfile({ aiName: v })), t('set.aiNameHint')),
      field('set.avatar', textInput(p.avatar, (v) => updateProfile({ avatar: v }))),
      field('set.userName', textInput(p.userName, (v) => updateProfile({ userName: v }))),
      field('set.profession', textInput(p.profession, (v) => updateProfile({ profession: v }))),
      field('set.calling', textInput(p.calling, (v) => updateProfile({ calling: v }))),
      field('set.language', selectInput(
        [{ v: '', l: '— ' + t('common.none') + ' —' }, { v: 'Français', l: 'Français' }, { v: 'English', l: 'English' }, { v: 'Español', l: 'Español' }, { v: 'Italiano', l: 'Italiano' }],
        p.language, (v) => updateProfile({ language: v }))),
      field('set.personality', areaInput(p.personality, (v) => updateProfile({ personality: v }))),
      field('set.tone', textInput(p.tone, (v) => updateProfile({ tone: v }))),
      field('set.expertise', textInput(p.expertise, (v) => updateProfile({ expertise: v }))),
      field('set.instructions', areaInput(p.instructions, (v) => updateProfile({ instructions: v }))),
      field('set.forbidden', areaInput(p.forbidden, (v) => updateProfile({ forbidden: v }))));

    const voices = (window.speechSynthesis ? speechSynthesis.getVoices() : []).map((v) => ({ v: v.name, l: `${v.name} (${v.lang})` }));
    const voiceSel = selectInput([{ v: '', l: '— ' + t('common.none') + ' —' }, ...voices], p.voice, (v) => updateProfile({ voice: v }));
    const voiceBox = el('div', {},
      field('set.voice', voiceSel),
      slider('set.voiceRate', 0.5, 2, 0.05, p.voiceRate || 1, (v) => updateProfile({ voiceRate: v })),
      slider('set.voicePitch', 0.5, 2, 0.05, p.voicePitch || 1, (v) => updateProfile({ voicePitch: v })),
      el('button', { class: 'btn sm', text: '▶ ' + t('set.voice'), onclick: () => window.J.speak(t('land.hero')) }));
    box.appendChild(section('set.voice', voiceBox));
    box.appendChild(section('set.identity', fields));
    return box;
  }

  function globalSec() {
    const g = S.settings.global;
    const box = el('div', { class: 'col' });
    const set = (patch, rerender) => { Object.assign(S.settings.global, patch); save('settings'); applyTheme(); if (rerender) render('global'); };

    box.appendChild(section('set.language.site',
      selectInput(window.LANGS.map((l) => ({ v: l.code, l: l.flag + ' ' + l.label })), S.settings.lang, (v) => { window.J.setLang(v); render('global'); })));

    box.appendChild(section('set.theme',
      el('div', { class: 'col' },
        selectInput([{ v: 'dark', l: t('set.themeDark') }, { v: 'light', l: t('set.themeLight') }, { v: 'neon', l: t('set.themeNeon') }], g.theme, (v) => set({ theme: v }, true)),
        field('set.accent', (() => { const i = el('input', { type: 'color', value: g.accent }); i.addEventListener('input', () => set({ accent: i.value })); return i; })()),
        field('set.accent', (() => { const i = el('input', { type: 'color', value: g.accent2 }); i.addEventListener('input', () => set({ accent2: i.value })); return i; })()),
        field('set.bg', selectInput([{ v: 'gradient', l: 'Gradient' }, { v: 'image', l: 'Image (URL)' }, { v: 'video', l: 'Vidéo (URL)' }], g.bgType, (v) => set({ bgType: v }, true))),
        field('set.bg', textInput(g.bgUrl, (v) => set({ bgUrl: v }), 'url', 'https://…')),
        el('small', { class: 'muted tiny', text: t('set.bgHint') }),
        switchRow('set.bgParticles', g.particles, (v) => set({ particles: v })),
        slider('set.glass', 0, 40, 1, g.glass, (v) => set({ glass: v })),
        slider('set.density', 0.7, 1.5, 0.05, g.density, (v) => set({ density: v })),
        slider('set.radius', 0, 30, 1, g.radius, (v) => set({ radius: v })),
        slider('set.fontSize', 12, 20, 1, g.fontSize, (v) => set({ fontSize: v })),
        field('set.font', selectInput([
          { v: "'Inter', 'Segoe UI', system-ui, sans-serif", l: 'Inter / Segoe' },
          { v: "Georgia, 'Times New Roman', serif", l: 'Serif' },
          { v: "'JetBrains Mono', Consolas, monospace", l: 'Monospace' },
          { v: "'Comic Sans MS', cursive", l: 'Comic Sans' },
        ], g.font, (v) => set({ font: v }))),
        switchRow('set.animations', g.anim, (v) => set({ anim: v })))));

    const modes = [['ask', 'approval.ask', 'approval.askl'], ['safe', 'approval.safe', 'approval.safel'], ['all', 'approval.all', 'approval.alll']];
    const modeBox = el('div', { class: 'col' });
    modes.forEach(([v, k, kl]) => {
      const active = S.settings.ai.approvalMode === v;
      const row = el('div', { class: 'switch-row' },
        el('div', {}, el('div', { text: t(k) }), el('div', { class: 'tiny muted', text: t(kl) })),
        el('span', { class: 'chip' + (v === 'all' ? ' danger' : ''), text: active ? '●' : '○' }));
      row.addEventListener('click', () => {
        if (v === 'all') {
          window.J.countdownModal({
            title: t('approval.danger.title'), body: t('approval.danger.body'), seconds: 5,
            foot: [
              () => el('button', { class: 'btn', text: t('common.cancel'), onclick: () => m.close() }),
              () => el('button', { class: 'btn', text: t('approval.ask'), onclick: () => { S.settings.ai.approvalMode = 'ask'; save('settings'); m.close(); render('global'); } }),
              () => el('button', { class: 'btn primary', text: t('common.ok'), onclick: () => { S.settings.ai.approvalMode = 'all'; save('settings'); m.close(); render('global'); toast(t('toast.saved'), 'ok'); } }),
            ],
          }); return;
        }
        S.settings.ai.approvalMode = v; save('settings'); render('global');
      });
      modeBox.appendChild(row);
    });
    box.appendChild(section('set.approval', modeBox));
    box.appendChild(el('button', { class: 'btn sm danger', text: t('set.reset'), onclick: () => { S.settings.global = DEFAULTS().global; save('settings'); applyTheme(); render('global'); } }));
    return box;
  }

  function aiSec() {
    const a = S.settings.ai;
    const box = el('div', { class: 'col' });
    const set = (patch) => { Object.assign(S.settings.ai, patch); save('settings'); };

    box.appendChild(section('set.ai',
      field('set.temperature', slider('set.temperature', 0, 2, 0.05, a.temperature, (v) => set({ temperature: v }))),
      field('set.maxTokens', slider('set.maxTokens', 200, 16000, 100, a.maxTokens, (v) => set({ maxTokens: v }))),
      switchRow('set.stream', a.stream, (v) => set({ stream: v })),
      switchRow('set.autoScroll', a.autoScroll, (v) => set({ autoScroll: v })),
      switchRow('set.enterSend', a.enterSend, (v) => set({ enterSend: v })),
      switchRow('set.compact', a.compact, (v) => set({ compact: v })),
      switchRow('set.privateDefault', a.privateDefault, (v) => set({ privateDefault: v }, true))));

    box.appendChild(section('msg.voice',
      switchRow('set.ttsAuto', a.ttsAuto, (v) => set({ ttsAuto: v })),
      field('set.sttLang', selectInput([
        { v: '', l: 'Auto (' + (window.J.VOICE_LANGS[S.settings.lang] || 'fr-FR') + ')' },
        { v: 'fr-FR', l: 'Français' }, { v: 'en-US', l: 'English (US)' }, { v: 'en-GB', l: 'English (UK)' },
        { v: 'es-ES', l: 'Español' }, { v: 'it-IT', l: 'Italiano' }, { v: 'de-DE', l: 'Deutsch' }, { v: 'ar-SA', l: 'العربية' },
      ], a.sttLang, (v) => set({ sttLang: v }))),
      switchRow('set.wake', a.wake, (v) => set({ wake: v }), t('set.wakeHint')),
      switchRow('set.visionwarn', a.visionWarn, (v) => set({ visionWarn: v }))));

    box.appendChild(section('video.unsupported',
      switchRow('memory.title', a.useMemory, (v) => set({ useMemory: v })),
      switchRow('hist.title', a.useHistory, (v) => set({ useHistory: v }))));

    const keyBox = el('div', { class: 'col' },
      el('div', { class: 'kv' }, el('b', { text: 'OpenRouter key' }), el('span', { class: 'code', text: S.key ? S.key.slice(0, 14) + '…' + S.key.slice(-4) : '—' })),
      el('div', { class: 'row' },
        el('button', { class: 'btn sm', text: t('onb.test'), onclick: () => window.App.startOnboarding(true) }),
        el('button', { class: 'btn sm', text: t('model.test'), onclick: async () => {
          toast(t('model.testing'));
          const r = await API.call('/api/test-key', { method: 'POST', body: { key: S.key, model: S.model } });
          toast((r.ok ? t('model.ok') : t('model.fail')) + ' — ' + (r.latency || 0) + ' ms', r.ok ? 'ok' : 'err');
        } })));
    box.appendChild(section('onb.step2.t', keyBox));
    return box;
  }

  function historySec() {
    const box = el('div', { class: 'col' });
    const list = el('div', {});
    if (!S.hist.length) list.appendChild(el('div', { class: 'muted tiny', text: t('hist.empty') }));
    S.hist.slice(0, 60).forEach((h, i) => {
      const item = el('div', { class: 'hist-item' },
        el('div', { class: 'q', text: h.q }),
        el('div', { class: 'a', text: h.a }));
      item.addEventListener('click', () => window.Chat.resumeFromHistory(h));
      list.appendChild(item);
    });
    box.appendChild(section('hist.title', list,
      el('div', { class: 'row', style: 'margin-top:.5rem' },
        el('button', { class: 'btn sm', text: t('hist.export'), onclick: () => {
          const blob = new Blob([JSON.stringify({ conv: S.conv, hist: S.hist, mem: S.mem }, null, 2)], { type: 'application/json' });
          const a = el('a', { href: URL.createObjectURL(blob), download: 'jarvis-export.json' }); a.click();
        } }),
        el('button', { class: 'btn sm danger', text: t('hist.clear'), onclick: () => { S.hist = []; save('hist'); render('history'); } }))));
    return box;
  }

  function memorySec() {
    const box = el('div', { class: 'col' });
    const add = el('input', { type: 'text', placeholder: t('memory.add') });
    const list = el('div', {});
    const draw = () => {
      list.innerHTML = '';
      if (!S.mem.length) list.appendChild(el('div', { class: 'muted tiny', text: t('memory.empty') }));
      S.mem.forEach((m, i) => list.appendChild(el('div', { class: 'switch-row' },
        el('div', { class: 'tiny', text: m.text }),
        el('button', { class: 'btn sm danger', text: '✕', onclick: () => { S.mem.splice(i, 1); save('mem'); draw(); } }))));
    };
    draw();
    add.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && add.value.trim()) { S.mem.unshift({ text: add.value.trim(), at: Date.now() }); add.value = ''; save('mem'); draw(); }
    });
    box.appendChild(section('memory.title', el('div', { class: 'tiny muted', text: t('memory.desc') }), add, list));
    return box;
  }

  async function consoleSec() {
    const box = el('div', { class: 'col' });
    const st = await API.call('/api/bridge/status');
    const events = el('div', {});
    (st.events || []).forEach((e) => events.appendChild(el('div', { class: 'log-line', text: new Date(e.at).toLocaleTimeString() + ' · [' + e.kind + '] ' + e.message })));
    if (!st.events?.length) events.appendChild(el('div', { class: 'muted tiny', text: t('console.empty') }));
    box.appendChild(section('console.title', events));
    return box;
  }

  async function bridgeSec() {
    const box = el('div', { class: 'col' });
    const st = await API.call('/api/bridge/status');
    const online = st.online;
    box.appendChild(section('bridge.title',
      el('div', { class: 'kv' }, el('b', { text: t('bridge.title') }), el('span', { class: 'chip ' + (online ? 'free' : 'danger'), text: online ? t('bridge.online') : t('bridge.offline') })),
      el('div', { class: 'tiny muted', text: S.bridge.sessionId }),
      el('div', { class: 'row', style: 'margin-top:.5rem' },
        el('button', { class: 'btn sm primary', text: t('batch.download'), onclick: () => window.App.downloadBat('setup') }),
        el('button', { class: 'btn sm', text: t('batch.access'), onclick: () => window.App.downloadBat('access') })),
      el('div', { class: 'row', style: 'margin-top:.5rem' },
        el('button', { class: 'btn sm', text: t('bridge.newcode'), onclick: async () => {
          const r = await API.call('/api/bridge/paircode', { method: 'POST' });
          toast(t('bridge.paircode') + ' : ' + r.code, 'ok');
          copyToClipboard(String(r.code));
        } }))));

    const allow = await API.call('/api/bridge/allowlist');
    const al = el('div', {});
    if (!allow.families?.length) al.appendChild(el('div', { class: 'muted tiny', text: t('common.none') }));
    (allow.families || []).forEach((f) => al.appendChild(el('div', { class: 'switch-row' },
      el('div', { class: 'code', text: f }),
      el('button', { class: 'btn sm', text: t('approval.remove'), onclick: async () => { await API.call('/api/bridge/allowlist/remove', { method: 'POST', body: { family: f } }); render('bridge'); } }))));
    box.appendChild(section('approval.allowlist', al));
    return box;
  }
  function copyToClipboard(s) { navigator.clipboard?.writeText(s).then(() => toast(t('toast.copied'), 'ok')); }

  // ---------- render ----------
  const BUILDERS = { personalize, global: globalSec, ai: aiSec, history: historySec, memory: memorySec, console: consoleSec, bridge: bridgeSec };

  async function render(name) {
    PANEL.current = name || PANEL.current || 'personalize';
    const body = document.getElementById('panel-body');
    if (!body) return;
    body.innerHTML = '';
    body.appendChild(el('div', { class: 'panel-head' },
      el('b', { text: t('nav.' + (PANEL.current === 'console' ? 'console' : PANEL.current)) }),
      el('button', { class: 'icon-btn', html: '✕', onclick: () => window.AppclosePanel && window.AppclosePanel() })));
    try {
      const content = await BUILDERS[PANEL.current]();
      body.appendChild(content);
    } catch (e) { body.appendChild(el('div', { class: 'notice danger', text: String(e.message || e) })); }
    applyI18n(body);
    document.querySelectorAll('#main-tabs .tab').forEach((b) => b.classList.toggle('active', b.dataset.panel === PANEL.current));
  }

  window.Settings = { render, get current() { return PANEL.current; } };
})();
