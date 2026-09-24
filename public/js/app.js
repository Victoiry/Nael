/* JARVIS — application : accueil, clé OpenRouter, modèle, .bat, vérification, espace de travail */
(function () {
  const { S, t, el, save, modal, toast, API, applyTheme, applyI18n, setLang, esc, countdownModal, LS } = window.J;
  const A = {};
  let approving = new Set();
  let verifyTimer = null;

  // =========================================================== boot
  function showError(msg) {
    const bar = document.getElementById('errbar');
    const txt = document.getElementById('errbar-msg');
    if (!bar || !txt) return;
    txt.textContent = '⚠ ' + msg;
    bar.classList.add('on');
  }
  window.addEventListener('error', (e) => showError(e.message || 'script error'));
  window.addEventListener('unhandledrejection', (e) => showError((e.reason && (e.reason.message || e.reason)) || 'promise error'));

  function boot() {
    applyTheme(); applyI18n(document);
    if (S.settings.ai.privateDefault) S.private = true;
    const sels = ['lang-select', 'lang-select-landing'].map((id) => document.getElementById(id)).filter(Boolean);
    sels.forEach((sel) => {
      window.LANGS.forEach((l) => sel.appendChild(el('option', { value: l.code, text: l.flag + ' ' + l.code.toUpperCase(), title: l.label, selected: l.code === S.settings.lang })));
      sel.title = window.LANGS.map((l) => l.label).join(' / ');
      sel.addEventListener('change', () => {
        setLang(sel.value);
        sels.forEach((o) => { if (o !== sel) o.value = sel.value; });
        buildModeSwitch(); window.Chat.buildComposer(); window.Settings.render(window.Settings.current);
      });
    });


    document.querySelectorAll('[data-action="start"]').forEach((b) => b.addEventListener('click', () => start(false)));
    document.querySelectorAll('[data-action="login"]').forEach((b) => b.addEventListener('click', () => openAuth()));
    document.getElementById('btn-auth-top').addEventListener('click', () => (S.auth ? logout() : openAuth()));
    document.getElementById('btn-new').addEventListener('click', () => window.Chat.newConv());
    document.getElementById('conv-search').addEventListener('input', renderConvList);
    document.getElementById('panel-toggle').addEventListener('click', () => togglePanel());
    document.getElementById('side-toggle').addEventListener('click', () => document.getElementById('main-grid').classList.toggle('no-side'));
    document.querySelectorAll('#main-tabs .tab').forEach((b) => b.addEventListener('click', () => showPanel(b.dataset.panel)));
    document.querySelectorAll('#chat-tabs .tab').forEach((b) => b.addEventListener('click', () => window.Chat.setTab(b.dataset.tab)));
    document.getElementById('hud-stop').addEventListener('click', () => { window.Chat.stopVoice(); window.Chat.toggleLive && A.stopLive(); });
    document.getElementById('hud-send').addEventListener('click', () => { window.Chat.stopVoice(); window.Chat.send(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.popmenu').forEach((m) => m.remove()); });
    document.addEventListener('jarvis:lang', () => { applyI18n(document); renderConvList(); window.Chat.buildComposer(); });
    window.AppclosePanel = () => togglePanel(false);

    resizer();
    pollBridge();
    fitTabs();
    addEventListener('resize', fitTabs);

    // session « sans compte » silencieuse : nécessaire pour le pont local et les .bat
    if (!S.auth) {
      API.call('/api/auth/guest', { method: 'POST' }).then((r) => {
        if (r.token) { S.auth = { token: r.token, name: r.user.name, email: r.user.email, guest: true }; save('auth'); paintUser(); }
      }).catch(() => {});
    } else paintUser();

    const params = new URLSearchParams(location.search);
    if (params.get('pair')) { A.pendingPair = params.get('pair'); start(false, true); }
    if (S.auth) { API.call('/api/auth/me').then((r) => { S.user = r.user; paintUser(); }); }
    window.Chat.loadModels().then(() => { if (MODELOK()) window.Chat.buildComposer(); });
    function MODELOK() { return true; }
  }

  // onglets : texte si la place le permet, sinon icônes seules
  function fitTabs() {
    const top = document.getElementById('topbar');
    const tabs = document.getElementById('main-tabs');
    if (!top || !tabs || top.offsetParent === null) return;   // barre masquée : rien à mesurer
    top.classList.remove('compact', 'tight');
    const others = [...top.children].filter((e) => e !== tabs);
    const used = others.reduce((n, e) => n + e.getBoundingClientRect().width, 0);
    const need = [...tabs.children].reduce((n, b) => n + b.getBoundingClientRect().width, 0) + 18;
    const avail = top.clientWidth - used;
    if (need > avail) top.classList.add('compact');            // icônes seules
    if (avail < 600) top.classList.add('tight');               // tout en icônes
  }

  // =========================================================== start / onboarding
  async function start(forceOnboarding, fromPair) {
    if (!S.key || forceOnboarding) return startOnboarding(forceOnboarding, fromPair);
    enterApp();
  }

  function startOnboarding(force, fromPair) {
    if (S.key && !force) return enterApp();
    const body = el('div', {});
    const steps = el('div', { class: 'steps' });
    const mk = (n, titleKey, ...kids) => steps.appendChild(el('div', { class: 'step' }, el('div', { class: 'n', text: n }), el('div', { style: 'flex:1' }, el('b', { text: t(titleKey) }), ...kids)));

    mk(1, 'onb.step1.t',
      el('div', { class: 'tiny', text: t('onb.step1.a') }),
      el('div', { class: 'tiny', text: t('onb.step1.b') }),
      el('div', { class: 'tiny', text: t('onb.step1.c') }),
      el('div', { class: 'row', style: 'margin-top:.4rem' },
        el('a', { class: 'btn sm', href: 'https://openrouter.ai/keys', target: '_blank', rel: 'noopener', text: '🔑 ' + t('onb.step1.link') })));

    const keyInput = el('input', { type: 'password', placeholder: t('onb.step2.p'), value: S.key || '' });
    mk(2, 'onb.step2.t', keyInput, el('div', { class: 'tiny muted', text: t('onb.free') }));
    mk(3, 'onb.step3.t', el('div', { class: 'tiny', text: t('onb.step3.d') }));
    body.appendChild(steps);

    const testBtn = el('button', { class: 'btn primary', text: t('onb.test') });
    const skip = el('button', { class: 'btn', text: t('auth.guest'), onclick: () => { m.close(); enterApp(); } });
    testBtn.addEventListener('click', () => {
      const k = keyInput.value.trim();
      if (!/^sk-or-v1-/.test(k)) return toast(t('auth.err.invalid'), 'err');
      openModelTest(k, m);
    });
    const m = modal({ title: t('onb.title'), sub: t('auth.subtitle'), body, foot: [skip, testBtn], vert: true, closeable: !force });
    A._onb = m;
    if (fromPair && A.pendingPair) { m.close(); openBatchStep(A.pendingPair); }
  }

  // ---------- pop-up verticale : quel modèle tester ?
  async function openModelTest(key, prevModal) {
    const body = el('div', {});
    const warn = el('div', { class: 'notice danger' },
      el('div', { class: 'bold-red', text: '⚠ ' + t('model.warn') }),
      el('div', { class: 'tiny', text: t('model.warn2') }));
    const search = el('input', { type: 'text', placeholder: t('model.search') });
    const listBox = el('div', { class: 'model-list', style: 'max-height:280px;overflow:auto' });
    const footMsg = el('div', { class: 'tiny muted' });

    const btnTest = el('button', { class: 'btn primary', text: t('model.test') });
    const btnSave = el('button', { class: 'btn primary hidden', text: t('model.save') });
    const btnMore = el('button', { class: 'btn', text: 'ℹ ' + t('model.more') });
    btnMore.addEventListener('click', () => {
      modal({ title: t('model.more'), body: el('div', { class: 'col' },
        el('div', { class: 'notice warn' }, el('b', { class: 'bold-red', text: t('model.warn') }), el('div', { class: 'tiny', text: t('model.warn2') })),
        el('div', { class: 'tiny', text: 'Free models: identifiers ending with :free or containing /free. They cost 0 credits (rate limited).' }),
        el('div', { class: 'tiny', text: 'Paid models: everything else. Pricing is per million tokens, charged from your OpenRouter credit.' }),
        el('div', { class: 'row wrap', style: 'margin-top:.6rem' },
          el('a', { class: 'btn sm', href: 'https://openrouter.ai/docs/features/model-routing', target: '_blank', rel: 'noopener', text: '📖 ' + t('model.docs') }),
          el('a', { class: 'btn sm', href: 'https://openrouter.ai/models', target: '_blank', rel: 'noopener', text: '💳 ' + t('model.pricing') }),
          el('a', { class: 'btn sm', href: 'https://openrouter.ai/models?max_price=0', target: '_blank', rel: 'noopener', text: '🆓 ' + t('model.list') }))),
      });
    });

    let models = [];
    let selected = null;
    let unlocked = false;

    function draw() {
      const q = search.value.toLowerCase();
      listBox.innerHTML = '';
      models.filter((m) => !q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)).slice(0, 300).forEach((m) => {
        const row = el('div', { class: 'model-row' + (selected === m.id ? ' active' : '') },
          el('span', { class: 'radio' }),
          el('div', { class: 'nm' },
            el('b', { text: m.name }),
            el('small', { text: m.id + ' · ' + (m.context ? (m.context / 1000).toFixed(0) + 'k ctx' : '') + (m.vision ? ' · 👁 vision' : ' · sans vision') })),
          el('span', { class: 'chip ' + (m.free ? 'free' : 'paid'), text: m.free ? '🆓 FREE' : '💳 PAID' }));
        row.addEventListener('click', async () => {
          selected = m.id;
          unlocked = m.free;
          draw();
          if (!m.free) {
            unlocked = false;
            const ok = await paidConsent(m.id);
            if (ok) { unlocked = true; btnTest.disabled = false; }
            else { btnTest.disabled = true; }
          }
        });
        listBox.appendChild(row);
      });
    }

    btnTest.addEventListener('click', async () => {
      if (!selected) return toast(t('model.selected'), 'err');
      const info = models.find((x) => x.id === selected);
      if (info && !info.free && !unlocked) return toast(t('paid.title'), 'err');
      btnTest.disabled = true; btnTest.textContent = t('model.testing');
      const out = el('div', { class: 'notice' }, el('span', { class: 'dots', text: t('model.testing') }));
      body.querySelectorAll('.notice.test-out').forEach((n) => n.remove());
      out.classList.add('test-out'); body.appendChild(out);
      const r = await API.call('/api/test-key', { method: 'POST', body: { key, model: selected } });
      out.className = 'notice test-out ' + (r.ok ? 'ok' : 'danger');
      out.innerHTML = `<b>${r.ok ? t('model.ok') : t('model.fail')}</b> — ${t('model.latency')} ${r.latency} ms · HTTP ${r.status}
        <div class="tiny muted code">${esc((r.detail || '').slice(0, 200))}</div>`;
      btnTest.disabled = false; btnTest.textContent = t('model.test');
      if (r.ok) {
        btnTest.classList.add('hidden'); btnSave.classList.remove('hidden');
        S.key = key; S.model = selected; S.settings.ai.model = selected;
        save('settings'); save('model'); LS.setRaw('key', key);
        if (S.auth && !S.auth.guest) API.call('/api/auth/provision', { method: 'POST', body: { key, model: selected } });
        footMsg.textContent = t('onb.step3.d');
        window.Chat.loadModels(true).then(() => window.Chat.buildComposer());
      }
    });

    btnSave.addEventListener('click', () => {
      prevModal?.close();
      m.close();
      openBatchStep();
    });

    search.addEventListener('input', draw);
    body.append(warn, el('div', { class: 'row', style: 'margin:.6rem 0' }, el('b', { text: t('model.list') }), el('span', { class: 'spacer' }), btnMore), search, listBox, footMsg);

    const m = modal({ title: t('model.title'), sub: t('model.warn'), body, foot: [btnTest, btnSave], vert: true });
    listBox.appendChild(el('div', { class: 'dots muted center', text: t('common.loading') }));
    models = await API.call('/api/models?key=' + encodeURIComponent(key)).then((r) => r.models || []);
    window.Chat.MODELS.list = models; window.Chat.MODELS.loaded = true;
    draw();
  }

  async function paidConsent(model) {
    return new Promise((resolve) => {
      countdownModal({
        title: t('paid.title'), body: t('paid.body', { model }), seconds: 5,
        foot: [
          () => el('button', { class: 'btn', text: t('paid.chooseFree'), onclick: () => { m.close(); resolve(false); } }),
          () => el('button', { class: 'btn', text: t('common.cancel'), onclick: () => { m.close(); resolve(false); } }),
          () => el('button', { class: 'btn primary', text: t('common.ok') + ' → ' + t('paid.unlock'), onclick: () => { m.close(); resolve(true); } }),
        ],
      });
    });
  }

  // ---------- étape .bat + vérification
  async function openBatchStep(prefillCode) {
    const body = el('div', {});
    body.appendChild(el('div', { class: 'notice' }, el('b', { text: t('batch.title') }), el('div', { class: 'tiny', text: t('batch.desc') })));

    const codeBox = el('div', { class: 'center', style: 'margin:1rem 0' });
    const codeTxt = el('div', { class: 'code', style: 'font-size:1.7rem;letter-spacing:.35em;padding:.6rem 1rem;display:inline-block' , text: '······' });
    const refresh = el('button', { class: 'btn sm', text: '⟳ ' + t('bridge.newcode'), onclick: loadCode });
    const copyBtn = el('button', { class: 'btn sm', text: '⧉ ' + t('toast.copied'), onclick: () => window.J.copy(codeTxt.textContent) });
    codeBox.append(el('div', { class: 'tiny muted', text: t('bridge.paircode') }), el('div', {}, codeTxt), el('div', { class: 'row', style: 'justify-content:center;margin-top:.4rem' }, copyBtn, refresh));

    const dl = el('button', { class: 'btn primary', text: '⤓ ' + t('batch.download') });
    dl.addEventListener('click', () => downloadBat('setup'));
    const dl2 = el('button', { class: 'btn', text: '⤓ ' + t('batch.access') });
    dl2.addEventListener('click', () => downloadBat('access'));
    body.appendChild(el('div', { class: 'row wrap', style: 'margin:.6rem 0' }, dl, dl2));
    body.appendChild(el('div', { class: 'tiny muted', text: t('batch.hint') }));
    body.appendChild(codeBox);

    const verifyIn = el('input', { type: 'text', placeholder: t('batch.random'), value: prefillCode || '' });
    const verifyBtn = el('button', { class: 'btn primary', text: t('batch.verify') });
    const status = el('div', { class: 'notice tiny', text: '…' });
    body.append(el('div', { class: 'field' }, el('span', { text: t('batch.random') }), verifyIn), el('div', { class: 'row' }, verifyBtn), status);

    const enter = el('button', { class: 'btn primary hidden', text: t('batch.done'), onclick: () => { m.close(); enterApp(); } });
    const skip = el('button', { class: 'btn', text: t('auth.guest'), onclick: () => { m.close(); enterApp(); } });

    async function loadCode() {
      const r = await API.call('/api/bridge/paircode', { method: 'POST' });
      codeTxt.textContent = r.code;
      A.code = String(r.code);
      verifyIn.value = prefillCode || verifyIn.value || '';
      status.textContent = t('batch.hint');
      clearInterval(verifyTimer);
      verifyTimer = setInterval(async () => {
        const st = await API.call('/api/bridge/status');
        if (st.online) { status.className = 'notice ok tiny'; status.textContent = t('batch.verified'); enter.classList.remove('hidden'); clearInterval(verifyTimer); }
      }, 2000);
    }

    verifyBtn.addEventListener('click', async () => {
      verifyBtn.disabled = true; verifyBtn.textContent = t('batch.verifying');
      const r = await API.call('/api/bridge/verify', { method: 'POST', body: { code: verifyIn.value.trim() } });
      verifyBtn.disabled = false; verifyBtn.textContent = t('batch.verify');
      if (r.ok) { status.className = 'notice ok tiny'; status.textContent = t('batch.verified'); enter.classList.remove('hidden'); S.bridge.verified = true; save('settings'); }
      else { status.className = 'notice danger tiny'; status.textContent = t('batch.fail'); }
    });

    const m = modal({ title: t('batch.title'), sub: t('batch.desc'), body, foot: [enter, skip], vert: true, onClose: () => clearInterval(verifyTimer) });
    await loadCode();
    if (prefillCode) verifyBtn.click();
  }

  async function downloadBat(kind) {
    try {
      const headers = {};
      if (S.auth?.token) headers.Authorization = 'Bearer ' + S.auth.token;
      const r = await fetch('/api/bridge/download/' + kind, { headers });
      if (!r.ok) { toast(t('toast.error') + ' (' + r.status + ')', 'err'); if (r.status === 401) openAuth(); return; }
      const blob = await r.blob();
      const a = el('a', { href: URL.createObjectURL(blob), download: kind === 'setup' ? 'JARVIS-Setup.bat' : 'JARVIS-Claude-Code.bat' });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(t('batch.title') + ' → ' + t('batch.desc').slice(0, 60) + '…', 'ok');
    } catch (e) { toast(t('toast.error'), 'err'); }
  }

  // =========================================================== app
  function enterApp() {
    document.getElementById('landing').classList.add('hidden');
    document.body.classList.add('app-mode');    // l'app tient dans l'ecran, plus de defilement
    window.scrollTo(0, 0);
    document.getElementById('workspace').classList.remove('hidden');
    buildModeSwitch();
    window.Chat.loadModels().then(() => { window.Chat.buildComposer(); window.Chat.setTab(S.tab || 'classic'); });
    renderConvList(); paintUser();
    showPanel('personalize', true);
    fitTabs();
    requestAnimationFrame(fitTabs);
    setTimeout(fitTabs, 400);              // après chargement des polices
    addEventListener('resize', fitTabs);
    if (window.ResizeObserver) new ResizeObserver(fitTabs).observe(document.getElementById('topbar'));
    if (!LS.get('choseMode', false)) askMode();
    pollApprovals();
  }

  function askMode() {
    const body = el('div', { class: 'col' },
      el('div', { class: 'model-row', onclick: () => { S.mode = 'chat'; save('mode'); LS.set('choseMode', true); buildModeSwitch(); m.close(); window.Chat.setTab('classic'); } },
        el('div', { class: 'nm' }, el('b', { text: '💬 ' + t('mode.chat') }), el('small', { text: t('mode.chatl') }))),
      el('div', { class: 'model-row', onclick: () => { S.mode = 'agent'; save('mode'); LS.set('choseMode', true); buildModeSwitch(); m.close(); } },
        el('div', { class: 'nm' }, el('b', { text: '🤖 ' + t('mode.agent') }), el('small', { text: t('mode.agentl') }))));
    const m = modal({ title: t('mode.title'), body, vert: true });
  }

  function buildModeSwitch() {
    let box = document.getElementById('mode-switch');
    if (!box) {
      box = el('div', { class: 'tabs', id: 'mode-switch', style: 'margin-left:.4rem' });
      const top = document.getElementById('topbar');
      top.insertBefore(box, document.getElementById('main-tabs'));
    }
    box.innerHTML = '';
    [['chat', '💬', 'mode.chat'], ['agent', '🤖', 'mode.agent']].forEach(([k, ico, key]) => {
      const b = el('button', { class: 'tab' + (S.mode === k ? ' active' : '') });
      b.append(el('span', { class: 'tab-ico', text: ico }), el('span', { class: 'tab-txt', text: t(key) }));
      b.addEventListener('click', () => { S.mode = k; save('mode'); buildModeSwitch(); fitTabs(); if (k === 'agent') toast(t('mode.agentl')); });
      box.appendChild(b);
    });
  }

  // ---------- panel
  function showPanel(name, silent) {
    const grid = document.getElementById('main-grid');
    grid.classList.add('panel-open');
    window.Settings.render(name);
    if (!silent) { /* keep open */ }
  }
  function togglePanel(force) {
    const grid = document.getElementById('main-grid');
    const open = force === undefined ? !grid.classList.contains('panel-open') : force;
    grid.classList.toggle('panel-open', open);
    if (open) window.Settings.render(window.Settings.current);
  }
  function resizer() {
    const rz = document.getElementById('resizer');
    const grid = document.getElementById('main-grid');
    let dragging = false;
    rz.addEventListener('mousedown', () => { dragging = true; document.body.style.userSelect = 'none'; });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const w = Math.max(240, Math.min(innerWidth * 0.62, innerWidth - e.clientX - 8));
      document.documentElement.style.setProperty('--panelw', w + 'px');
    });
    window.addEventListener('mouseup', () => { dragging = false; document.body.style.userSelect = ''; });
    rz.addEventListener('dblclick', () => document.documentElement.style.setProperty('--panelw', '25vw'));
  }

  // ---------- conversations
  function renderConvList() {
    const box = document.getElementById('conv-list');
    if (!box) return;
    const q = (document.getElementById('conv-search')?.value || '').toLowerCase();
    box.innerHTML = '';
    const list = S.conv.filter((c) => (c.messages || []).length > 0 && (!q || (c.title || '').toLowerCase().includes(q)));
    if (!list.length) box.appendChild(el('div', { class: 'muted tiny', text: t('nav.none') }));
    list.forEach((c) => {
      const row = el('div', { class: 'conv' + (c.id === S.activeId ? ' active' : '') },
        el('span', { text: '💬' }),
        el('div', { class: 't', text: c.title || t('nav.new') }),
        el('button', { class: 'btn sm ghost', text: '⋯', onclick: (e) => { e.stopPropagation(); convMenu(e.currentTarget, c); } }));
      row.addEventListener('click', () => { S.activeId = c.id; window.Chat.setTab('classic'); window.Chat.renderMessages(); renderConvList(); });
      box.appendChild(row);
    });
  }
  function convMenu(anchor, c) {
    const m = el('div', { class: 'popmenu glass', style: 'position:fixed;z-index:50;padding:.3rem;min-width:170px' });
    const item = (label, fn) => { const r = el('div', { class: 'model-row', style: 'border:0', text: label }); r.addEventListener('click', () => { m.remove(); fn(); }); return r; };
    m.append(
      item('✎ ' + t('nav.rename'), () => { const n = prompt(t('nav.rename'), c.title); if (n) { c.title = n; save('conv'); renderConvList(); } }),
      item('🗑 ' + t('nav.delete'), () => { S.conv = S.conv.filter((x) => x.id !== c.id); if (S.activeId === c.id) S.activeId = null; save('conv'); renderConvList(); window.Chat.renderMessages(); }));
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    m.style.top = r.bottom + 6 + 'px'; m.style.left = Math.max(8, r.left - 120) + 'px';
    setTimeout(() => document.addEventListener('click', function close(ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('click', close); } }), 0);
  }

  // ---------- auth
  function paintUser() {
    document.getElementById('me-name').textContent = S.auth ? (S.auth.name || 'Invité') : t('auth.guest');
    document.getElementById('me-mail').textContent = S.auth ? (S.auth.guest ? t('auth.guestnote') : S.auth.email || '') : '';
    document.getElementById('btn-auth-top').textContent = S.auth ? t('auth.logout') : t('auth.login');
  }
  function openAuth() {
    const body = el('div', {});
    const email = el('input', { type: 'email', placeholder: t('auth.email') });
    const pass = el('input', { type: 'password', placeholder: t('auth.password') });
    const name = el('input', { type: 'text', placeholder: t('auth.name') });
    const err = el('div', { class: 'notice danger tiny hidden' });
    let mode = 'login';
    const tabs = el('div', { class: 'tabs', style: 'margin-bottom:.8rem' });
    const tLogin = el('button', { class: 'tab active', text: t('auth.login') });
    const tReg = el('button', { class: 'tab', text: t('auth.register') });
    tLogin.addEventListener('click', () => { mode = 'login'; tLogin.classList.add('active'); tReg.classList.remove('active'); name.classList.add('hidden'); });
    tReg.addEventListener('click', () => { mode = 'register'; tReg.classList.add('active'); tLogin.classList.remove('active'); name.classList.remove('hidden'); });
    tabs.append(tLogin, tReg);
    name.classList.add('hidden');
    body.append(tabs, el('div', { class: 'field' }, email), el('div', { class: 'field' }, pass), el('div', { class: 'field' }, name), err);

    const go = el('button', { class: 'btn primary', text: t('auth.login') });
    go.addEventListener('click', async () => {
      const r = await API.call('/api/auth/' + mode, { method: 'POST', body: { email: email.value, password: pass.value, name: name.value } });
      if (r.error) { err.classList.remove('hidden'); err.textContent = t('auth.err.' + r.error); return; }
      S.auth = { token: r.token, name: r.user.name, email: r.user.email };
      save('auth'); paintUser(); m.close();
      await window.J.cloudPull();
      toast(t('toast.saved'), 'ok');
      applyTheme(); window.Chat.buildComposer(); renderConvList();
    });
    const guest = el('button', { class: 'btn', text: t('auth.guest'), onclick: async () => {
      const r = await API.call('/api/auth/guest', { method: 'POST' });
      S.auth = { token: r.token, name: r.user.name, email: r.user.email, guest: true };
      save('auth'); paintUser(); m.close(); toast(t('auth.guestnote'));
    } });
    const m = modal({ title: t('auth.title'), sub: t('auth.subtitle'), body, foot: [guest, go], vert: true });
  }
  function logout() { S.auth = null; save('auth'); paintUser(); toast(t('auth.logout')); }
  function showLanding() {
    document.getElementById('workspace').classList.add('hidden');
    document.getElementById('landing').classList.remove('hidden');
    document.body.classList.remove('app-mode');
  }

  // ---------- bridge
  async function pollBridge() {
    setInterval(async () => {
      try {
        const st = await API.call('/api/bridge/status');
        S.bridge.online = !!st.online;
        const chip = document.getElementById('bridge-chip');
        if (chip) { chip.className = 'chip ' + (st.online ? 'free' : 'danger'); chip.textContent = (st.online ? '● ' : '○ ') + t('bridge.' + (st.online ? 'online' : 'offline')); chip.onclick = () => showPanel('bridge'); }
        const mini = document.getElementById('bridge-mini');
        if (mini) mini.innerHTML = st.online ? t('batch.verified') : t('batch.fail');
      } catch {}
    }, 5000);
  }
  async function pollApprovals() {
    setInterval(async () => {
      try {
        if (!S.mode || S.mode !== 'agent') return;
        const r = await API.call('/api/bridge/approvals');
        (r.pending || []).forEach((p) => { if (!approving.has(p.id)) { approving.add(p.id); showApproval(p); } });
      } catch {}
    }, 2500);
  }
  function showApproval(p) {
    const body = el('div', {});
    body.appendChild(el('div', { class: 'notice ' + (p.risk === 'high' ? 'danger' : p.risk === 'safe' ? 'ok' : 'warn') },
      el('div', { class: 'tiny muted', text: t('approval.request') }),
      el('div', { class: 'code', text: p.command }),
      el('div', { class: 'row', style: 'margin-top:.4rem' },
        el('span', { class: 'chip ' + (p.risk === 'high' ? 'danger' : p.risk === 'safe' ? 'free' : 'paid'), text: t('approval.risk') + ' : ' + t('approval.risk.' + p.risk) }),
        p.family ? el('span', { class: 'chip', text: 'type : ' + p.family }) : null)));
    const decide = async (d) => {
      const r = await API.call('/api/bridge/decision', { method: 'POST', body: { id: p.id, decision: d } });
      if (d === 'always') toast(t('approval.alwaysAdded', { f: p.family }), 'ok');
      m.close();
      if (r.error) toast(r.error, 'err');
    };
    const m = modal({ title: t('approval.request'), sub: p.cwd || '', body, vert: true, closeable: false,
      foot: [
        el('button', { class: 'btn danger', text: t('approval.deny'), onclick: () => decide('deny') }),
        el('button', { class: 'btn', text: t('approval.always'), onclick: () => decide('always') }),
        el('button', { class: 'btn primary', text: t('approval.accept'), onclick: () => decide('accept') }),
      ], onClose: () => approving.delete(p.id) });
  }

  A.stopLive = () => { const b = document.getElementById('live-btn'); if (b && b.classList.contains('rec')) window.Chat.toggleLive(); };
  window.addEventListener('DOMContentLoaded', boot);
  window.App = { start, startOnboarding, openModelTest, openBatchStep, enterApp, showLanding, showPanel, showApproval, renderConvList, openAuth, paidConsent, downloadBat };
})();
