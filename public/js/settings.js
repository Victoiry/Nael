/* JARVIS — réglages (tiroir) : personnaliser, global, IA, modes, historique, mémoire, console, pont */
(function () {
  const { S, t, el, save, applyTheme, applyI18n, toast, modal, API, esc, DEFAULTS, DEFAULT_PROFILE, icon } = window.J;
  const PANEL = { current: 'personalize' };
  const NAV = [
    ['personalize', 'palette', 'nav.personalize'],
    ['global', 'globe', 'nav.global'],
    ['ai', 'cpu', 'nav.ai'],
    ['modes', 'layers', 'set.modes'],
    ['history', 'clock', 'nav.history'],
    ['memory', 'brain', 'nav.memory'],
    ['console', 'terminal', 'nav.console'],
    ['bridge', 'plug', 'nav.bridge'],
  ];

  // ------------------------------------------------------------ widgets
  const field = (labelKey, input, hint) => {
    const l = el('label', { class: 'field' }, el('span', { text: t(labelKey) }), input);
    if (hint) l.appendChild(el('small', { class: 'muted tiny', text: hint }));
    return l;
  };
  const textInput = (value, onInput, type = 'text', ph = '') => {
    const i = el('input', { type, value: value == null ? '' : value, placeholder: ph });
    i.addEventListener('input', () => onInput(i.value));
    return i;
  };
  const areaInput = (value, onInput, ph = '') => {
    const i = el('textarea', { placeholder: ph });
    i.value = value || '';
    i.addEventListener('input', () => onInput(i.value));
    return i;
  };
  function slider(labelKey, min, max, step, value, onInput) {
    const out = el('span', { class: 'chip tiny', text: String(value) });
    const r = el('input', { type: 'range', min, max, step, value });
    r.addEventListener('input', () => { out.textContent = r.value; onInput(Number(r.value)); });
    return el('div', {}, el('div', { class: 'row' }, el('span', { class: 'tiny muted', text: t(labelKey) }), el('span', { class: 'spacer' }), out), r);
  }
  function switchRow(labelKey, value, onChange, hint) {
    const sw = el('div', { class: 'switch' + (value ? ' on' : '') });
    sw.addEventListener('click', () => { const v = !sw.classList.contains('on'); sw.classList.toggle('on', v); onChange(v); });
    return el('div', { class: 'switch-row' },
      el('div', {}, el('div', { text: t(labelKey) }), hint ? el('div', { class: 'tiny muted', text: hint }) : null), sw);
  }
  function selectInput(options, value, onChange) {
    const s = el('select');
    options.forEach((o) => { const opt = el('option', { value: o.v, text: o.l }); if (String(o.v) === String(value)) opt.selected = true; s.appendChild(opt); });
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }
  const section = (titleKey, ...kids) => el('div', { class: 'panel-sec' }, el('h4', { text: t(titleKey) }), ...kids);
  const profile = () => S.settings.profiles[S.settings.activeProfile] || S.settings.profiles[0];
  function updateProfile(patch, rerender) { Object.assign(profile(), patch); save('settings'); if (rerender) render(PANEL.current); }
  const copyToClipboard = (s) => window.J.copy(s);

  // ------------------------------------------------------------ sections
  function personalize() {
    const box = el('div', {});
    const p = profile();

    const list = el('div', {});
    S.settings.profiles.forEach((pr, i) => {
      const row = el('div', { class: 'model-row' + (i === S.settings.activeProfile ? ' active' : '') },
        el('span', { class: 'radio' }),
        el('div', { class: 'nm' }, el('b', { text: pr.name || '—' }), el('small', { text: pr.aiName || '' })));
      row.addEventListener('click', () => { S.settings.activeProfile = i; save('settings'); render('personalize'); });
      list.appendChild(row);
    });
    const addBtn = el('button', { class: 'btn sm' }, icon('plus', 15), t('set.newProfile'));
    addBtn.addEventListener('click', async () => {
      const name = await J.ask({ title: t('set.newProfile'), label: t('set.profileName'), ok: t('common.add') });
      if (!name) return;
      const np = DEFAULT_PROFILE(); np.name = name;
      S.settings.profiles.push(np); S.settings.activeProfile = S.settings.profiles.length - 1; save('settings'); render('personalize');
    });
    const dupBtn = el('button', { class: 'btn sm' }, icon('copy', 15), t('set.duplicate'));
    dupBtn.addEventListener('click', () => {
      const cp = JSON.parse(JSON.stringify(profile())); cp.id = 'p' + Math.random().toString(36).slice(2, 8); cp.name += t('set.copySuffix');
      S.settings.profiles.push(cp); S.settings.activeProfile = S.settings.profiles.length - 1; save('settings'); render('personalize');
    });
    const delBtn = el('button', { class: 'btn sm danger' }, icon('trash', 15), t('nav.delete'));
    delBtn.addEventListener('click', () => {
      if (S.settings.profiles.length < 2) return toast(t('set.minOneProfile'), 'err');
      S.settings.profiles.splice(S.settings.activeProfile, 1); S.settings.activeProfile = 0; save('settings'); render('personalize');
    });
    box.appendChild(section('set.personalize', list, el('div', { class: 'row wrap', style: 'margin-top:.5rem' }, addBtn, dupBtn, delBtn)));

    const fields = el('div', {},
      field('set.profileName', textInput(p.name, (v) => updateProfile({ name: v }))),
      field('set.aiName', textInput(p.aiName, (v) => updateProfile({ aiName: v })), t('set.aiNameHint')),
      field('set.userName', textInput(p.userName, (v) => updateProfile({ userName: v }))),
      field('set.profession', textInput(p.profession, (v) => updateProfile({ profession: v }))),
      field('set.calling', textInput(p.calling, (v) => updateProfile({ calling: v }))),
      field('set.language', selectInput([
        { v: '', l: '— ' + t('common.none') + ' —' }, { v: 'Français', l: 'Français' }, { v: 'English', l: 'English' },
        { v: 'Español', l: 'Español' }, { v: 'Italiano', l: 'Italiano' }], p.language, (v) => updateProfile({ language: v }))),
      field('set.personality', areaInput(p.personality, (v) => updateProfile({ personality: v }))),
      field('set.tone', textInput(p.tone, (v) => updateProfile({ tone: v }))),
      field('set.expertise', textInput(p.expertise, (v) => updateProfile({ expertise: v }))),
      field('set.instructions', areaInput(p.instructions, (v) => updateProfile({ instructions: v }))),
      field('set.forbidden', areaInput(p.forbidden, (v) => updateProfile({ forbidden: v }))));
    box.appendChild(section('set.identity', fields));

    const voices = (window.speechSynthesis ? speechSynthesis.getVoices() : []).map((v) => ({ v: v.name, l: `${v.name} (${v.lang})` }));
    const voiceBtn = el('button', { class: 'btn sm' }, icon('volume', 15), t('set.voice'));
    voiceBtn.addEventListener('click', () => {
      const v = voices.find((x) => x.v === p.voice);
      toast(t('set.voiceTest') + (v ? ' — ' + v.l : ''));
      window.J.speak(t('land.hero'));
    });
    box.appendChild(section('set.voice',
      field('set.voice', selectInput([{ v: '', l: '— ' + t('common.none') + ' —' }, ...voices], p.voice, (v) => updateProfile({ voice: v }))),
      slider('set.voiceRate', 0.5, 2, 0.05, p.voiceRate || 1, (v) => updateProfile({ voiceRate: v })),
      slider('set.voicePitch', 0.5, 2, 0.05, p.voicePitch || 1, (v) => updateProfile({ voicePitch: v })),
      voiceBtn));
    return box;
  }

  function globalSec() {
    const g = S.settings.global;
    const box = el('div', {});
    const set = (patch, rerender) => { Object.assign(S.settings.global, patch); save('settings'); applyTheme(); if (rerender) render('global'); };
    const colorInput = (value, onChange) => { const i = el('input', { type: 'color', value }); i.addEventListener('input', () => onChange(i.value)); return i; };

    box.appendChild(section('set.language.site',
      selectInput(window.LANGS.map((l) => ({ v: l.code, l: l.label })), S.settings.lang, (v) => { window.J.setLang(v); render('global'); })));
    const accentReset = el('button', { class: 'btn sm' }, icon('refresh', 15), t('set.accentAuto'));
    accentReset.addEventListener('click', () => { set({ accent: 'auto' }, true); render('global'); });
    box.appendChild(section('set.theme',
      el('div', { class: 'col' },
        selectInput([{ v: 'dark', l: t('set.themeDark') }, { v: 'light', l: t('set.themeLight') }], g.theme, (v) => set({ theme: v }, true)),
        el('small', { class: 'muted tiny', text: t('set.themeHint') }),
        el('div', { class: 'row wrap' },
          field('set.accent', colorInput(!g.accent || g.accent === 'auto' ? (g.theme === 'light' ? '#0d0d0d' : '#ececec') : g.accent, (v) => set({ accent: v }))),
          accentReset),
        field('set.bg', selectInput([{ v: 'solid', l: t('set.bgSolid') }, { v: 'image', l: t('set.bgImage') }, { v: 'video', l: t('set.bgVideo') }], g.bgType, (v) => set({ bgType: v }, true))),
        g.bgType === 'solid' ? el('span') : field('set.bg', textInput(g.bgUrl, (v) => set({ bgUrl: v }), 'url', 'https://…')),
        el('small', { class: 'muted tiny', text: t('set.bgHint2') }),
        slider('set.glass', 0, 30, 1, g.glass, (v) => set({ glass: v })),
        slider('set.density', 0.7, 1.5, 0.05, g.density, (v) => set({ density: v })),
        slider('set.radius', 0, 26, 1, g.radius, (v) => set({ radius: v })),
        slider('set.fontSize', 12, 20, 1, g.fontSize, (v) => set({ fontSize: v })),
        field('set.font', selectInput([
          { v: "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", l: t('set.fontSystem') },
          { v: "Georgia, 'Times New Roman', serif", l: t('set.fontSerif') },
          { v: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", l: t('set.fontMono') },
        ], g.font, (v) => set({ font: v }))),
        switchRow('set.animations', g.anim, (v) => set({ anim: v })))));

    const modes = [['ask', 'approval.ask', 'approval.askl'], ['safe', 'approval.safe', 'approval.safel'], ['all', 'approval.all', 'approval.alll']];
    const modeBox = el('div', {});
    modes.forEach(([v, k, kl]) => {
      const row = el('div', { class: 'switch-row' },
        el('div', {}, el('div', { text: t(k) }), el('div', { class: 'tiny muted', text: t(kl) })),
        el('span', { class: 'chip' + (v === 'all' ? ' danger' : ''), text: S.settings.ai.approvalMode === v ? t('common.on') : t('common.off') }));
      row.addEventListener('click', () => {
        if (v === 'all') {
          const m = window.J.countdownModal({
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
    const reset = el('button', { class: 'btn sm' }, icon('refresh', 15), t('set.reset'));
    reset.addEventListener('click', () => { S.settings.global = DEFAULTS().global; save('settings'); applyTheme(); render('global'); });
    box.appendChild(el('div', { class: 'row', style: 'margin-bottom:1rem' }, reset));
    return box;
  }

  function aiSec() {
    const a = S.settings.ai;
    const box = el('div', {});
    const set = (patch) => { Object.assign(S.settings.ai, patch); save('settings'); };

    box.appendChild(section('set.ai',
      slider('set.temperature', 0, 2, 0.05, a.temperature, (v) => set({ temperature: v })),
      slider('set.maxTokens', 200, 16000, 100, a.maxTokens, (v) => set({ maxTokens: v })),
      switchRow('set.stream', a.stream, (v) => set({ stream: v })),
      switchRow('set.autoScroll', a.autoScroll, (v) => set({ autoScroll: v })),
      switchRow('set.enterSend', a.enterSend, (v) => set({ enterSend: v })),
      switchRow('set.compact', a.compact, (v) => set({ compact: v }))));

    box.appendChild(section('msg.voice',
      switchRow('set.ttsAuto', a.ttsAuto, (v) => set({ ttsAuto: v })),
      field('set.sttLang', selectInput([
        { v: '', l: 'Auto (' + (window.J.VOICE_LANGS[S.settings.lang] || 'fr-FR') + ')' },
        { v: 'fr-FR', l: 'Français' }, { v: 'en-US', l: 'English (US)' }, { v: 'es-ES', l: 'Español' }, { v: 'it-IT', l: 'Italiano' },
      ], a.sttLang, (v) => set({ sttLang: v }))),
      switchRow('set.wake', a.wake, (v) => set({ wake: v }), t('set.wakeHint')),
      switchRow('set.visionwarn', a.visionWarn, (v) => set({ visionWarn: v }))));

    box.appendChild(section('memory.title',
      switchRow('memory.title', a.useMemory, (v) => set({ useMemory: v })),
      switchRow('hist.title', a.useHistory, (v) => set({ useHistory: v })),
      switchRow('set.privateDefault', a.privateDefault, (v) => set({ privateDefault: v }))));

    // --- connexion OpenRouter : quel canal est utilisé, et test en direct
    const chan = el('span', { class: 'chip', text: t('or.checking') });
    const chanInfo = el('div', { class: 'tiny muted', text: t('or.channelHelp') });
    const paintChan = (c) => {
      chan.className = 'chip ' + (c === 'direct' || c === 'relay' ? 'paid' : c === 'server' ? 'free' : 'danger');
      chan.textContent = ({ direct: t('or.channel.direct'), server: t('or.channel.server'), relay: t('or.channel.relay') })[c] || t('or.channel.none');
    };
    J.ORapi.onChannel(paintChan);
    J.ORapi.detect(true).then(paintChan);
    const probeBtn = el('button', { class: 'btn sm' }, icon('plug', 15), t('or.probe'));
    probeBtn.addEventListener('click', async () => {
      probeBtn.disabled = true; toast(t('or.checking'));
      const c = await J.ORapi.detect(true);
      paintChan(c);
      const r = await J.ORapi.models(S.key, { force: true });
      toast(r.ok ? t('or.status.loaded', { n: r.models.length, via: r.via === 'direct' ? t('or.channel.directShort') : t('or.channel.serverShort') }) : t('or.err.' + (r.reason || 'inconnu')), r.ok ? 'ok' : 'err');
      probeBtn.disabled = false;
    });
    box.appendChild(section('or.title',
      el('div', { class: 'kv' }, el('b', { text: t('or.channel') }), chan),
      chanInfo,
      el('div', { class: 'row wrap', style: 'margin-top:.5rem' }, probeBtn,
        (() => { const b = el('button', { class: 'btn sm' }, icon('link', 15), t('or.keys')); b.addEventListener('click', () => J.openLink('https://openrouter.ai/keys')); return b; })(),
        (() => { const b = el('button', { class: 'btn sm' }, icon('link', 15), t('or.catalog')); b.addEventListener('click', () => J.openLink('https://openrouter.ai/models')); return b; })(),
        (() => { const b = el('button', { class: 'btn sm' }, icon('plug', 15), t('or.diag')); b.addEventListener('click', () => runDiagnostic()); return b; })())));

    const diagOut = el('div', { class: 'col', style: 'margin-top:.5rem' });
    async function runDiagnostic() {
      diagOut.innerHTML = '';
      diagOut.appendChild(el('div', { class: 'tiny muted dots', text: t('or.checking') }));
      const r = await J.ORapi.diagnose(S.key || '');
      diagOut.innerHTML = '';
      r.steps.forEach((st) => diagOut.appendChild(el('div', { class: 'kv' },
        el('span', { class: st.ok ? 'chip free' : 'chip danger', text: t('or.step.' + st.step) }),
        el('span', { class: 'tiny', style: 'text-align:right;flex:1', text: st.detail }))));
      if (r.channel) paintChan(r.channel);
      const copyBtn = el('button', { class: 'btn sm' }, icon('copy', 15), t('or.copyDiag'));
      copyBtn.addEventListener('click', () => {
        window.J.copy('JARVIS — diagnostic OpenRouter\n' + r.steps.map((st) => (st.ok ? 'OK  ' : 'KO  ') + st.step + ' : ' + st.detail).join('\n') + '\ncanal=' + r.channel);
        toast(t('toast.copied'), 'ok');
      });
      diagOut.appendChild(el('div', { class: 'row wrap', style: 'margin-top:.4rem' }, copyBtn));
    }

    const testBtn = el('button', { class: 'btn sm' }, icon('check', 15), t('model.test'));
    testBtn.addEventListener('click', async () => {
      toast(t('model.testing'));
      const r = await J.ORapi.testKey(S.key, window.Chat.activeModel());
      toast((r.ok ? t('model.ok') : t('model.fail')) + ' — ' + (r.latency || 0) + ' ms'
        + (r.ok ? '' : ' : ' + t('or.err.' + (r.reason || 'inconnu'))), r.ok ? 'ok' : 'err');
      paintChan(J.ORapi.channel);
    });
    const changeBtn = el('button', { class: 'btn sm' }, icon('sliders', 15), t('onb.test'));
    changeBtn.addEventListener('click', () => window.App.startOnboarding(true));
    box.appendChild(section('onb.step2.t',
      el('div', { class: 'kv' }, el('b', { text: 'OpenRouter' }), el('span', { class: 'code', text: S.key ? S.key.slice(0, 12) + '…' + S.key.slice(-4) : '—' })),
      el('div', { class: 'kv' }, el('b', { text: t('model.selected') }), el('span', { class: 'code', text: window.Chat.activeModel() })),
      el('div', { class: 'row', style: 'margin-top:.5rem' }, changeBtn, testBtn)));
    return box;
  }

  function modesSec() {
    const box = el('div', {});
    const tabs = el('div', { class: 'panel-sec' }, el('h4', { text: t('set.modes') }), el('div', { class: 'tabs', id: 'chat-tabs' }));
    box.appendChild(tabs);
    const tts = el('div', { class: 'col' },
      el('div', { class: 'tiny muted', text: t('rag.desc') }),
      el('div', { class: 'tiny muted', text: t('file.desc') }),
      el('div', { class: 'tiny muted', text: t('skill.pre') }),
      el('div', { class: 'row wrap', style: 'margin-top:.4rem' },
        (() => { const b = el('button', { class: 'btn sm' }, icon('layers', 15), t('rag.title')); b.addEventListener('click', () => window.Chat.openPlus('rag')); return b; })(),
        (() => { const b = el('button', { class: 'btn sm' }, icon('bolt', 15), t('skill.title')); b.addEventListener('click', () => window.Chat.openPlus('skill')); return b; })()));
    box.appendChild(section('set.modes', tts));
    box.appendChild(section('off.title', el('div', { class: 'tiny muted', text: t('off.desc') })));
    box.appendChild(section('priv.title', el('div', { class: 'tiny muted', text: t('priv.on') })));
    setTimeout(() => window.Chat.refreshTabs && window.Chat.refreshTabs(), 0);
    return box;
  }

  function historySec() {
    const box = el('div', {});
    const list = el('div', {});
    if (!S.hist.length) list.appendChild(el('div', { class: 'muted tiny', text: t('hist.empty') }));
    S.hist.slice(0, 60).forEach((h) => {
      const item = el('div', { class: 'hist-item' }, el('div', { class: 'q', text: h.q }), el('div', { class: 'a', text: h.a }));
      item.addEventListener('click', () => window.Chat.resumeFromHistory(h));
      list.appendChild(item);
    });
    const exp = el('button', { class: 'btn sm' }, icon('download', 15), t('hist.export'));
    exp.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ conv: S.conv, hist: S.hist, mem: S.mem }, null, 2)], { type: 'application/json' });
      const a = el('a', { href: URL.createObjectURL(blob), download: 'jarvis-export.json' }); a.click();
    });
    const clr = el('button', { class: 'btn sm danger' }, icon('trash', 15), t('hist.clear'));
    clr.addEventListener('click', () => { S.hist = []; save('hist'); render('history'); });
    box.appendChild(section('hist.title', list, el('div', { class: 'row', style: 'margin-top:.5rem' }, exp, clr)));
    return box;
  }

  function memorySec() {
    const box = el('div', {});
    const add = el('input', { type: 'text', placeholder: t('memory.add') });
    const list = el('div', {});
    const draw = () => {
      list.innerHTML = '';
      if (!S.mem.length) list.appendChild(el('div', { class: 'muted tiny', text: t('memory.empty') }));
      S.mem.forEach((m, i) => list.appendChild(el('div', { class: 'switch-row' },
        el('div', { class: 'tiny', text: m.text }),
        (() => { const b = el('button', { class: 'ibtn' }, icon('trash', 15)); b.addEventListener('click', () => { S.mem.splice(i, 1); save('mem'); draw(); }); return b; })())));
    };
    draw();
    add.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && add.value.trim()) { S.mem.unshift({ text: add.value.trim(), at: Date.now() }); add.value = ''; save('mem'); draw(); }
    });
    box.appendChild(section('memory.title', el('div', { class: 'tiny muted', text: t('memory.desc') }), add, list));
    return box;
  }

  async function consoleSec() {
    const box = el('div', {});
    const st = await API.call('/api/bridge/status').catch(() => ({ events: [] }));
    const events = el('div', {});
    (st.events || []).forEach((e) => events.appendChild(el('div', { class: 'log-line', text: new Date(e.at).toLocaleTimeString() + ' · [' + e.kind + '] ' + e.message })));
    if (!st.events?.length) events.appendChild(el('div', { class: 'muted tiny', text: t('console.empty') }));
    box.appendChild(section('console.title', events));
    return box;
  }

  async function bridgeSec() {
    const box = el('div', {});
    const st = await API.call('/api/bridge/status').catch(() => ({}));
    const dl = el('button', { class: 'btn sm primary' }, icon('download', 15), t('batch.download'));
    dl.addEventListener('click', () => window.App.downloadBat('setup'));
    const dl2 = el('button', { class: 'btn sm' }, icon('terminal', 15), t('batch.access'));
    dl2.addEventListener('click', () => window.App.downloadBat('access'));
    const codeBox = el('div', { class: 'row wrap', style: 'margin-top:.4rem' });
    const code = el('button', { class: 'btn sm' }, icon('refresh', 15), t('bridge.newcode'));
    code.addEventListener('click', async () => {
      const r = await API.call('/api/bridge/paircode', { method: 'POST' });
      copyToClipboard(String(r.code));
      codeBox.innerHTML = '';
      codeBox.append(
        el('span', { class: 'tiny muted', text: t('bridge.codeLabel') + ' : ' }),
        el('span', { class: 'code', text: String(r.code) }),
        el('span', { class: 'tiny muted', text: ' ' + t('bridge.copied') }));
    });
    const paste = el('input', { type: 'text', inputmode: 'numeric', placeholder: t('bridge.paste') });
    const verify = el('button', { class: 'btn sm' }, icon('check', 15), t('bridge.verify'));
    const paintVerify = (ok, msg) => {
      verify.disabled = false;
      verify.innerHTML = '';
      verify.append(icon(ok ? 'check' : 'close', 15), document.createTextNode(' ' + msg));
      setTimeout(() => { verify.disabled = false; verify.innerHTML = ''; verify.append(icon('check', 15), document.createTextNode(' ' + t('bridge.verify'))); }, 4000);
    };
    verify.addEventListener('click', async () => {
      const v = paste.value.trim();
      if (!v) return toast(t('bridge.paste'), 'err');
      verify.disabled = true;
      const r = await API.call('/api/bridge/verify', { method: 'POST', body: { code: v } }).catch(() => ({ ok: false, error: 'reseau' }));
      if (r.ok) { paintVerify(true, t('bridge.verifyOk')); toast(t('bridge.verifyOk'), 'ok'); paste.value = ''; setTimeout(() => render('bridge'), 900); }
      else paintVerify(false, t('bridge.err.' + (r.error || 'reseau')));
    });
    paste.addEventListener('keydown', (e) => { if (e.key === 'Enter') verify.click(); });
    box.appendChild(section('bridge.title',
      el('div', { class: 'kv' }, el('b', { text: t('bridge.title') }), el('span', { class: 'chip ' + (st.online ? 'free' : 'danger'), text: st.online ? t('bridge.online') : t('bridge.offline') })),
      el('div', { class: 'kv' }, el('b', { text: t('bridge.session') }), el('span', { class: 'code', text: S.bridge.sessionId || '—' })),
      el('div', { class: 'row wrap', style: 'margin-top:.5rem' }, dl, dl2, code),
      codeBox,
      el('div', { class: 'tiny muted', style: 'margin-top:.5rem', text: t('bridge.explain') }),
      el('div', { class: 'row wrap', style: 'margin-top:.35rem' }, paste, verify)));

    const allow = await API.call('/api/bridge/allowlist').catch(() => ({ families: [] }));
    const al = el('div', {});
    if (!allow.families?.length) al.appendChild(el('div', { class: 'muted tiny', text: t('common.none') }));
    (allow.families || []).forEach((f) => al.appendChild(el('div', { class: 'switch-row' },
      el('div', { class: 'code', text: f }),
      (() => { const b = el('button', { class: 'btn sm' }, t('approval.remove')); b.addEventListener('click', async () => { await API.call('/api/bridge/allowlist/remove', { method: 'POST', body: { family: f } }); render('bridge'); }); return b; })())));
    box.appendChild(section('approval.allowlist', al));
    return box;
  }

  // ------------------------------------------------------------ rendu
  const BUILDERS = { personalize, global: globalSec, ai: aiSec, modes: modesSec, history: historySec, memory: memorySec, console: consoleSec, bridge: bridgeSec };

  let SEQ = 0;
  async function render(name) {
    PANEL.current = name || PANEL.current;
    const seq = ++SEQ;
    const nav = document.getElementById('main-tabs');
    const body = document.getElementById('panel-body');
    if (!nav || !body) return;
    nav.innerHTML = '';
    NAV.forEach(([key, ic, labelKey]) => {
      const b = el('button', { class: 'tab' + (key === PANEL.current ? ' active' : ''), 'data-panel': key }, icon(ic, 17), el('span', { class: 'lbl', text: t(labelKey) }));
      b.addEventListener('click', () => render(key));
      nav.appendChild(b);
    });
    const title = document.getElementById('panel-title');
    if (title) title.textContent = t((NAV.find((n) => n[0] === PANEL.current) || [])[2] || 'nav.settings');
    let built;
    try { built = await BUILDERS[PANEL.current](); }
    catch (e) { built = el('div', { class: 'notice danger', text: String(e.message || e) }); }
    if (seq !== SEQ) return;            // un rendu plus recent a deja pris la main
    body.innerHTML = '';
    body.appendChild(built);
    applyI18n(body);
  }

  window.Settings = { render, get current() { return PANEL.current; } };
})();
