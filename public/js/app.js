/* JARVIS — coquille de l'application : accueil, barre latérale, en-tête, réglages, sécurité */
(function () {
  const { S, t, el, save, modal, toast, API, applyTheme, applyI18n, setLang, esc, countdownModal, LS, ico, icon, cloudPull, cloudPush, copy } = window.J;
  const A = { pendingPair: null, code: null };
  const linkBtn = (url, label, cls) => {
    const b = el('button', { class: 'btn sm ' + (cls || '') }, icon('link', 15), label);
    b.addEventListener('click', () => J.openLink(url));
    return b;
  };
  const approving = new Set();
  let verifyTimer = null;

  // ============================================================ erreurs
  function showError(msg) {
    const bar = document.getElementById('errbar'), txt = document.getElementById('errbar-msg');
    if (!bar || !txt) return;
    txt.textContent = msg; bar.classList.add('on');
  }
  window.addEventListener('error', (e) => showError(e.message || 'script error'));
  window.addEventListener('unhandledrejection', (e) => showError((e.reason && (e.reason.message || e.reason)) || 'promise error'));

  // ============================================================ démarrage
  function boot() {
    applyTheme(); applyI18n(document);
    // garde-fou : si une brique manque, on ne laisse JAMAIS un écran vide
    if (!window.Chat || !window.Settings || !window.Media || !window.J.ico) {
      showError('Module manquant — rechargez la page (Ctrl+Shift+R).');
    }

    // icônes statiques
    const setIcon = (id, name, size = 18) => { const e = document.getElementById(id); if (e) { e.innerHTML = ''; e.appendChild(icon(name, size)); } };
    const newBtn0 = document.getElementById('btn-new');
    if (newBtn0) { newBtn0.innerHTML = ''; newBtn0.append(icon('plus', 17), el('span', { text: t('nav.new') })); }
    setIcon('side-toggle', 'panel'); setIcon('sidebar-toggle', 'menu'); setIcon('panel-toggle', 'gear');
    setIcon('panel-close', 'close'); setIcon('errbar-close', 'close');
    setupPanelResize();
    document.getElementById('errbar-close')?.addEventListener('click', () => document.getElementById('errbar').classList.remove('on'));
    // bandeau vocal / Live : ces deux boutons doivent répondre
    document.getElementById('hud-stop')?.addEventListener('click', () => window.Chat.stopVoice());
    document.getElementById('hud-send')?.addEventListener('click', () => {
      const val = (window.Chat.ta && window.Chat.ta.value || '').trim();
      window.Chat.stopVoice();
      if (val) window.Chat.send(val, { noSpeak: !S.settings.ai.ttsAuto });
      else toast(t('msg.placeholder'), 'err');
    });
    setIcon('btn-auth-top', 'user'); setIcon('send-btn', 'send');
    document.addEventListener('jarvis:lang', () => { const b = document.getElementById('btn-new'); if (b) { b.innerHTML = ''; b.append(icon('plus', 17), el('span', { text: t('nav.new') })); } });

    // langues (accueil + application)
    const sels = ['lang-select', 'lang-select-landing'].map((id) => document.getElementById(id)).filter(Boolean);
    sels.forEach((sel) => {
      window.LANGS.forEach((l) => sel.appendChild(el('option', { value: l.code, text: l.code.toUpperCase() + ' — ' + l.label, selected: l.code === S.settings.lang })));
      sel.addEventListener('change', () => {
        setLang(sel.value);
        sels.forEach((o) => { if (o !== sel) o.value = sel.value; });
        buildModeSwitch(); window.Chat.buildComposer(); window.Settings.render(window.Settings.current);
      });
    });

    // accueil
    document.querySelectorAll('[data-action="start"]').forEach((b) => b.addEventListener('click', () => start(false)));
    document.querySelectorAll('[data-action="login"]').forEach((b) => b.addEventListener('click', () => openAuth()));

    // actions
    document.getElementById('sidebar-toggle').addEventListener('click', () => document.getElementById('main-grid').classList.toggle('side-open'));
    document.getElementById('side-toggle').addEventListener('click', () => {
      document.getElementById('main-grid').classList.remove('side-open');
    });
    document.getElementById('panel-toggle').addEventListener('click', () => togglePanel());
    document.getElementById('panel-close').addEventListener('click', () => togglePanel(false));
    document.getElementById('btn-new').addEventListener('click', () => window.Chat.newConv());
    document.getElementById('conv-search').addEventListener('input', renderConvList);
    document.getElementById('btn-auth-top').addEventListener('click', () => (S.auth && !S.auth.guest ? logout() : openAuth()));
    document.getElementById('user-row')?.addEventListener('click', (e) => { if (e.target.closest('button')) return; togglePanel(true, 'personalize'); });
    document.getElementById('bridge-chip').addEventListener('click', () => togglePanel(true, 'bridge'));
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { document.querySelectorAll('.popmenu').forEach((m) => m.remove()); if (document.getElementById('panel').classList.contains('hidden') === false) togglePanel(false); }
    });
    document.addEventListener('jarvis:lang', () => { applyI18n(document); renderConvList(); window.Chat.buildComposer(); });

    // glisser n'importe où : on ferme les menus
    window.addEventListener('resize', () => document.getElementById('main-grid').classList.remove('side-open'));

    // session : on vérifie TOUJOURS le jeton auprès du serveur avant d'afficher « connecté »
    AUTH.restore();

    // modèles : en arrière-plan, jamais bloquant pour l'interface
    window.Chat.loadModels().catch(() => {});

    renderConvList(); pollBridge(); pollApprovals();

    const params = new URLSearchParams(location.search);
    if (params.get('pair')) { A.pendingPair = params.get('pair'); start(false); }
  }

  // ============================================================ lancement
  function start(force) {
    if (!S.key || force) return startOnboarding(force);
    enterApp();
  }

  function startOnboarding(force) {
    const body = el('div', {});
    const steps = el('div', { class: 'steps' });
    const mk = (n, key, ...kids) => steps.appendChild(el('div', { class: 'step' }, el('span', { class: 'n', text: n }),
      el('div', {}, el('b', { text: t(key) }), ...kids)));
    mk(1, 'onb.step1.t',
      el('div', { class: 'tiny muted', text: t('onb.step1.a') }),
      el('div', { class: 'tiny muted', text: t('onb.step1.b') }),
      el('div', { class: 'tiny muted', text: t('onb.step1.c') }),
      (() => { const b = el('button', { class: 'link-muted', style: 'margin-top:.35rem' }, t('onb.step1.link')); b.addEventListener('click', () => J.openLink('https://openrouter.ai/keys')); return b; })());

    const keyInput = el('input', { type: 'password', placeholder: t('onb.step2.p'), value: S.key || '' });
    mk(2, 'onb.step2.t', keyInput, el('div', { class: 'tiny muted', text: t('onb.free') }));
    mk(3, 'onb.step3.t', el('div', { class: 'tiny muted', text: t('onb.step3.d') }));
    body.appendChild(steps);

    const testBtn = el('button', { class: 'btn primary', id: 'onb-test' }, icon('check', 16), el('span', { text: t('onb.test') }));
    // aucun compte n'est demandé : un simple lien discret pour continuer plus tard
    const skip = el('button', { class: 'link-muted', id: 'onb-skip', text: t('onb.later'), onclick: () => { m.close(); enterApp(); } });
    keyInput.addEventListener('input', () => { keyInput.style.borderColor = ''; });
    testBtn.addEventListener('click', () => {
      const k = keyInput.value.trim();
      if (!/^sk-or-v1-/.test(k)) { keyInput.style.borderColor = 'var(--danger)'; return toast(t('auth.err.invalid'), 'err'); }
      openModelTest(k, m);
    });
    const foot = el('div', { class: 'col', style: 'align-items:stretch;gap:.4rem' }, testBtn, el('div', { class: 'center' }, skip));
    const m = modal({ title: t('onb.title'), sub: t('auth.subtitle'), body, foot: [foot], vert: true, closeable: !force });
    if (A.pendingPair) { m.close(); openBatchStep(A.pendingPair); }
  }

  // ---------- quel modèle tester ? (popup verticale, liste issue de l'API OpenRouter)
  async function openModelTest(keyInput, prevModal) {
    let key = String(keyInput || '').trim();
    const body = el('div', {});
    body.appendChild(el('div', { class: 'notice danger' },
      el('div', { class: 'bold-red', text: t('model.warn') }),
      el('div', { class: 'tiny', text: t('model.warn2') })));

    const chanChip = el('span', { class: 'chip', text: t('or.checking') });
    const status = el('div', { class: 'tiny muted', text: t('or.checking') });
    const search = el('input', { type: 'text', placeholder: t('model.search') });
    const listBox = el('div', { class: 'model-list', style: 'max-height:270px' });
    const footMsg = el('div', { class: 'tiny muted' });
    const btnTest = el('button', { class: 'btn primary', id: 'model-test-btn' }, icon('check', 16), el('span', { text: t('model.test') }));
    const btnLater = el('button', { class: 'link-muted' }, el('span', { text: t('model.optional') }));
    const btnReload = el('button', { class: 'btn sm' }, icon('refresh', 15), t('or.retry'));
    const btnMore = el('button', { class: 'btn sm ghost' }, icon('book', 15), t('model.more'));

    btnMore.addEventListener('click', () => modal({
      title: t('model.more'),
      body: el('div', { class: 'col' },
        el('div', { class: 'notice warn' }, el('b', { class: 'bold-red', text: t('model.warn') }), el('div', { class: 'tiny', text: t('model.warn2') })),
        el('div', { class: 'tiny', text: t('model.freeDetail') }),
        el('div', { class: 'tiny', text: t('model.paidDetail') }),
        el('div', { class: 'tiny muted', text: t('or.channelHelp') }),
        el('div', { class: 'row wrap', style: 'margin-top:.6rem' },
          linkBtn('https://openrouter.ai/docs/features/model-routing', t('model.docs')),
          linkBtn('https://openrouter.ai/models', t('model.pricing')),
          linkBtn('https://openrouter.ai/keys', t('or.keys')))),
    }));

    let models = [], selected = null, unlocked = false;

    const paintChannel = (via) => {
      chanChip.className = 'chip ' + (via === 'direct' || via === 'relay' ? 'paid' : via === 'server' ? 'free' : 'danger');
      chanChip.textContent = ({ direct: t('or.channel.directShort'), server: t('or.channel.serverShort'), relay: t('or.channel.relayShort') })[via] || t('or.channel.none');
    };
    J.ORapi.onChannel(paintChannel);
    paintChannel(J.ORapi.channel);

    function draw() {
      const q = search.value.toLowerCase();
      listBox.innerHTML = '';
      const shown = models.filter((m) => !q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
      if (!shown.length) {
        listBox.appendChild(el('div', { class: 'center muted tiny', style: 'padding:1rem', text: models.length ? t('common.none') : status.textContent }));
        return;
      }
      shown.slice(0, 400).forEach((m) => {
        const price = Number.isFinite(m.pricePrompt) && !m.free
          ? '$' + (m.pricePrompt * 1e6).toFixed(2) + ' / M tokens'
          : t('model.priceFree');
        const row = el('div', { class: 'model-row' + (selected === m.id ? ' active' : '') },
          el('span', { class: 'radio' }),
          el('div', { class: 'nm' }, el('b', { text: m.name }),
            el('small', { text: m.id + (m.context ? ' · ' + (m.context / 1000).toFixed(0) + 'k' : '') + ' · ' + (m.vision ? t('model.vision') : t('model.novision')) + ' · ' + price })),
          el('span', { class: 'chip ' + (m.free ? 'free' : 'paid'), text: m.free ? 'FREE' : 'PAID' }));
        row.addEventListener('click', async () => {
          selected = m.id; unlocked = !!m.free; draw();
          if (!m.free) { unlocked = await paidConsent(m.id); btnTest.disabled = !unlocked; }
          if (m.context && S.settings.ai) S.settings.ai.context = m.context;
        });
        listBox.appendChild(row);
      });
    }

    async function loadModels(force) {
      listBox.innerHTML = '';
      listBox.appendChild(el('div', { class: 'center muted tiny dots', style: 'padding:1rem', text: t('or.loading') }));
      status.textContent = t('or.loading');
      const r = await J.ORapi.models(key, { force });
      models = r.models || [];
      if (r.via) paintChannel(r.via);
      if (r.ok) {
        status.textContent = t('or.status.loaded', { n: models.length, via: r.via === 'direct' ? t('or.channel.directShort') : t('or.channel.serverShort') });
        status.className = 'tiny muted';
      } else {
        status.textContent = t('or.err.' + (r.reason || 'inconnu'));
        status.className = 'tiny bold-red';
        listBox.innerHTML = '';
        listBox.appendChild(el('div', { class: 'notice danger', style: 'margin:.6rem' },
          el('b', { text: t('or.offline.title') }),
          el('div', { class: 'tiny', text: t('or.err.' + (r.reason || 'inconnu')) }),
          el('div', { class: 'tiny muted', text: r.error || '' })));
      }
      draw();
      return r;
    }

    btnReload.addEventListener('click', () => loadModels(true));

    btnTest.addEventListener('click', async () => {
      if (!selected) return toast(t('model.selected'), 'err');
      if (!key || !/^sk-or-v1-/.test(key)) key = (LS.getRaw('key', '') || '').trim();
      if (!key) { keyField.classList.remove('hidden'); keyField.querySelector('input').focus(); return toast(t('or.err.sans_cle'), 'err'); }
      const info = models.find((x) => x.id === selected);
      if (info && !info.free && !unlocked) return toast(t('paid.title'), 'err');
      btnTest.disabled = true; btnTest.textContent = t('model.testing');
      const out = el('div', { class: 'notice test-out' }, el('span', { class: 'dots', text: t('model.testing') }));
      body.querySelectorAll('.notice.test-out').forEach((n) => n.remove());
      body.appendChild(out);
      const r = await J.ORapi.testKey(key, selected);
      out.className = 'notice test-out ' + (r.ok ? 'ok' : 'danger');
      out.innerHTML = `<b>${r.ok ? t('model.ok') : t('model.fail')}</b> — ${t('model.latency')} ${r.latency} ms`
        + (r.status ? ` · HTTP ${r.status}` : '')
        + ` · ${({ direct: t('or.channel.directShort'), server: t('or.channel.serverShort'), relay: t('or.channel.relayShort') })[r.via] || ''}`
        + `<div class="tiny">${r.ok ? '' : esc(t('or.err.' + (r.reason || 'inconnu')))}</div>`
        + `<div class="tiny muted code">${esc((r.detail || '').slice(0, 200))}</div>`;
      if (r.via) paintChannel(r.via);
      btnTest.disabled = false; btnTest.textContent = t('model.test');
      if (r.ok) {
        // clé testée AVANT d'être enregistrée, puis un seul bouton qui passe à « Test OK »
        S.key = key; S.model = selected; S.settings.ai.model = selected;
        save('settings'); save('model'); LS.setRaw('key', key);
        if (S.auth && !S.auth.guest) API.call('/api/auth/provision', { method: 'POST', body: { key, model: selected } });
        footMsg.textContent = t('model.savedLocal');
        window.Chat.loadModels(true).catch(() => {});
        btnTest.disabled = true;
        btnTest.classList.remove('primary');
        btnTest.classList.add('ok'); btnTest.id = 'model-test-ok';
        btnTest.innerHTML = '';
        btnTest.append(icon('check', 16), el('span', { text: t('model.testOk') }));
        toast(t('model.testOk') + ' — ' + ((models.find((x) => x.id === selected) || {}).name || selected), 'ok');
        setTimeout(() => { prevModal?.close(); m.close(); if (!window.J.S.inApp) enterApp(); else window.Chat.buildComposer(); }, 900);
      } else {
        btnTest.disabled = false;
      }
    });
    btnLater.addEventListener('click', () => { prevModal?.close(); m.close(); openBatchStep(); });   // pont local : optionnel
    search.addEventListener('input', draw);

    const keyIn = el('input', { type: 'password', placeholder: t('onb.step2.p'), value: key });
    keyIn.addEventListener('input', () => { key = keyIn.value.trim(); });
    const keyField = el('div', { class: 'field' + (key ? ' hidden' : ''), style: 'margin-top:.5rem' },
      el('span', { text: t('onb.step2.t') }), keyIn);

    body.append(
      el('div', { class: 'row', style: 'margin:.6rem 0 .3rem' }, el('b', { text: t('model.list') }), el('span', { class: 'spacer' }), chanChip, btnReload, btnMore),
      search, listBox, status, keyField, footMsg);
    const footRow = el('div', { class: 'col', style: 'align-items:stretch;gap:.35rem' }, btnTest, el('div', { class: 'center' }, btnLater));
    const m = modal({ title: t('model.title'), sub: t('model.warn'), body, foot: [footRow], vert: true });
    await loadModels(true);
  }

  function paidConsent(model) {
    return new Promise((resolve) => {
      countdownModal({
        title: t('paid.title'), body: t('paid.body', { model }), seconds: 5,
        foot: [
          () => el('button', { class: 'btn', text: t('paid.chooseFree'), onclick: () => { m.close(); resolve(false); } }),
          () => el('button', { class: 'btn', text: t('common.cancel'), onclick: () => { m.close(); resolve(false); } }),
          () => el('button', { class: 'btn primary', text: t('paid.unlock'), onclick: () => { m.close(); resolve(true); } }),
        ],
      });
    });
  }

  // ---------- .bat + numéro de vérification
  async function openBatchStep(prefillCode) {
    const body = el('div', {});
    body.appendChild(el('div', { class: 'notice' }, el('b', { text: t('batch.title') }), el('div', { class: 'tiny', text: t('batch.desc') })));

    const codeTxt = el('div', { class: 'code', style: 'font-size:1.6rem;letter-spacing:.3em;padding:.5rem 1rem;display:inline-block;margin:.6rem 0', text: '······' });
    const copyBtn = el('button', { class: 'btn sm' }, icon('copy', 15), t('toast.copied'));
    copyBtn.addEventListener('click', () => window.J.copy(codeTxt.textContent));
    const refresh = el('button', { class: 'btn sm' }, icon('refresh', 15), t('bridge.newcode'));
    refresh.addEventListener('click', loadCode);
    body.appendChild(el('div', { class: 'center' },
      el('div', { class: 'tiny muted', text: t('bridge.paircode') }), codeTxt,
      el('div', { class: 'row', style: 'justify-content:center;margin:.2rem 0 .4rem' }, copyBtn, refresh)));

    const dl = el('button', { class: 'btn primary' }, icon('download', 16), t('batch.download'));
    dl.addEventListener('click', () => downloadBat('setup'));
    const dl2 = el('button', { class: 'btn' }, icon('terminal', 16), t('batch.access'));
    dl2.addEventListener('click', () => downloadBat('access'));
    body.appendChild(el('div', { class: 'row wrap', style: 'margin:.5rem 0' }, dl, dl2));
    body.appendChild(el('div', { class: 'tiny muted', text: t('batch.hint') }));

    const verifyIn = el('input', { type: 'text', placeholder: t('batch.random'), value: prefillCode || '' });
    const verifyBtn = el('button', { class: 'btn primary' }, icon('check', 16), t('batch.verify'));
    const status = el('div', { class: 'notice tiny', text: '…' });
    body.append(el('div', { class: 'field', style: 'margin-top:.8rem' }, el('span', { text: t('batch.random') }), verifyIn), el('div', { class: 'row' }, verifyBtn), status);

    const enter = el('button', { class: 'btn primary hidden' }, icon('check', 16), t('batch.done'));
    enter.addEventListener('click', () => { m.close(); enterApp(); });

    async function loadCode() {
      const r = await API.call('/api/bridge/paircode', { method: 'POST' });
      codeTxt.textContent = r.code; A.code = String(r.code);
      clearInterval(verifyTimer);
      verifyTimer = setInterval(async () => {
        const st = await API.call('/api/bridge/status');
        if (st.online) { status.className = 'notice ok tiny'; status.textContent = t('batch.verified'); enter.classList.remove('hidden'); clearInterval(verifyTimer); }
      }, 2000);
    }
    verifyBtn.addEventListener('click', async () => {
      verifyBtn.disabled = true;
      const r = await API.call('/api/bridge/verify', { method: 'POST', body: { code: verifyIn.value.trim() } });
      verifyBtn.disabled = false;
      if (r.ok) { status.className = 'notice ok tiny'; status.textContent = t('batch.verified'); enter.classList.remove('hidden'); S.bridge.verified = true; save('settings'); }
      else { status.className = 'notice danger tiny'; status.textContent = t('batch.fail'); }
    });

    const m = modal({ title: t('batch.title'), sub: t('batch.desc'), body, foot: [enter], vert: true, onClose: () => clearInterval(verifyTimer) });
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
    } catch { toast(t('toast.error'), 'err'); }
  }

  // ============================================================ application
  function enterApp() {
    try { return enterAppInner(); }
    catch (e) {
      showError('Affichage impossible : ' + (e.message || e) + ' — rechargez (Ctrl+Shift+R).');
      document.getElementById('landing').classList.add('hidden');
      document.getElementById('workspace').classList.remove('hidden');
      const c = document.getElementById('chat-scroll');
      if (c && !c.textContent.trim()) c.appendChild(el('div', { class: 'notice danger', style: 'max-width:640px;margin:2rem auto', text: String(e.message || e) }));
    }
  }

  function enterAppInner() {
    S.inApp = true;
    document.getElementById('landing').classList.add('hidden');
    document.getElementById('workspace').classList.remove('hidden');
    document.body.classList.add('app-mode');
    window.scrollTo(0, 0);

    buildModeSwitch();
    window.Chat.buildComposer();                 // rendu immédiat, sans attendre le réseau
    window.Chat.setTab(S.tab || 'classic');
    renderConvList(); paintUser();
    try { window.Settings.render('personalize'); } catch {}
    togglePanel(false);
    if (!LS.get('choseMode', false)) askMode();
  }

  function askMode() {
    const pick = (mode) => { S.mode = mode; save('mode'); LS.set('choseMode', true); buildModeSwitch(); m.close(); if (mode === 'agent') toast(t('mode.agentl')); };
    const body = el('div', { class: 'col' },
      el('div', { class: 'model-row', onclick: () => pick('chat') }, icon('chat', 20),
        el('div', { class: 'nm' }, el('b', { text: t('mode.chat') }), el('small', { text: t('mode.chatl') }))),
      el('div', { class: 'model-row', onclick: () => pick('agent') }, icon('robot', 20),
        el('div', { class: 'nm' }, el('b', { text: t('mode.agent') }), el('small', { text: t('mode.agentl') }))));
    const m = modal({ title: t('mode.title'), body, vert: true, closeable: false });
  }

  function buildModeSwitch() {
    const box = document.getElementById('mode-switch');
    if (!box) return;
    box.innerHTML = '';
    [['chat', 'chat', 'mode.chat'], ['agent', 'robot', 'mode.agent']].forEach(([k, ic, key]) => {
      const b = el('button', { class: k === S.mode ? 'active' : '' }, icon(ic, 15), el('span', { text: t(key) }));
      b.addEventListener('click', () => { S.mode = k; save('mode'); buildModeSwitch(); if (k === 'agent') toast(t('mode.agentl')); });
      box.appendChild(b);
    });
  }

  // ---------- panneau droit : 1/4 de l'écran par défaut, redimensionnable au glisser
  function setupPanelResize() {
    const panel = document.getElementById('panel');
    const grip = document.getElementById('panel-resizer');
    if (!panel || !grip) return;
    const saved = Number(LS.get('panelW', 0)) || 0;
    const apply = (w) => {
      const max = Math.max(300, Math.min(window.innerWidth * 0.92, 980));
      const px = Math.round(Math.max(300, Math.min(max, w)));
      panel.style.setProperty('--panel-w', px + 'px');
      LS.set('panelW', px);
      return px;
    };
    if (saved) apply(saved);
    let dragging = false;
    const move = (e) => {
      if (!dragging) return;
      const x = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : null);
      if (x === null) return;
      apply(window.innerWidth - x);
      e.preventDefault();
    };
    const stop = () => {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove('resizing');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    grip.addEventListener('pointerdown', (e) => {
      dragging = true;
      document.body.classList.add('resizing');
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', stop);
      e.preventDefault();
    });
    grip.addEventListener('dblclick', () => { panel.style.removeProperty('--panel-w'); LS.set('panelW', 0); });
    window.addEventListener('resize', () => { if (Number(LS.get('panelW', 0))) apply(Number(LS.get('panelW', 0))); });
  }

  // ---------- réglages
  const PANEL_TITLE = { personalize: 'nav.personalize', global: 'nav.global', ai: 'nav.ai', modes: 'set.modes', history: 'nav.history', memory: 'nav.memory', console: 'nav.console', bridge: 'nav.bridge' };
  function showPanel(name, silent) {
    if (silent) window.Settings.render(name);
    else togglePanel(true, name);
  }
  function togglePanel(force, name) {
    const panel = document.getElementById('panel');
    const open = force === undefined ? panel.classList.contains('hidden') : force;
    panel.classList.toggle('hidden', !open);
    document.getElementById('panel-toggle').classList.toggle('active', open);
    if (open && name) window.Settings.render(name);
  }

  async function refreshCredit() {
    const st = await API.call('/api/bridge/status').catch(() => ({}));
    return st;
  }

  // ---------- conversations
  function renderConvList() {
    const box = document.getElementById('conv-list');
    if (!box) return;
    const q = (document.getElementById('conv-search')?.value || '').toLowerCase();
    box.innerHTML = '';
    const list = S.conv.filter((c) => (c.messages || []).length > 0 && (!q || (c.title || '').toLowerCase().includes(q)));
    if (!list.length) box.appendChild(el('div', { class: 'tiny muted', style: 'padding:.5rem', text: t('nav.none') }));
    list.forEach((c) => {
      const row = el('div', { class: 'conv' + (c.id === S.activeId ? ' active' : '') },
        icon('chat', 15),
        el('div', { class: 't', text: c.title || t('nav.new') }));
      const menu = el('button', { class: 'ibtn', style: 'width:26px;height:26px' });
      menu.appendChild(icon('sliders', 14));
      menu.addEventListener('click', (e) => { e.stopPropagation(); convMenu(e.currentTarget, c); });
      row.appendChild(menu);
      row.addEventListener('click', () => { S.activeId = c.id; S.tab = 'classic'; window.Chat.setTab('classic'); window.Chat.renderMessages(); renderConvList(); });
      box.appendChild(row);
    });
  }
  function convMenu(anchor, c) {
    document.querySelectorAll('.popmenu').forEach((m) => m.remove());
    const m = el('div', { class: 'popmenu', style: 'min-width:170px' });
    const item = (ic, label, fn) => { const r = el('div', { class: 'model-row' }, icon(ic, 15), el('div', { class: 'nm' }, el('b', { text: label }))); r.addEventListener('click', () => { m.remove(); fn(); }); return r; };
    m.append(
      item('pencil', t('nav.rename'), async () => {
        const n = await J.ask({ title: t('nav.rename'), label: t('nav.new'), value: c.title || '', ok: t('common.save') });
        if (n) { c.title = n; save('conv'); renderConvList(); toast(t('toast.saved'), 'ok'); }
      }),
      item('trash', t('nav.delete'), () => { S.conv = S.conv.filter((x) => x.id !== c.id); if (S.activeId === c.id) S.activeId = null; save('conv'); renderConvList(); window.Chat.renderMessages(); }));
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    m.style.top = Math.min(r.bottom + 6, innerHeight - m.offsetHeight - 8) + 'px';
    m.style.left = Math.max(8, r.left - 150) + 'px';
    setTimeout(() => document.addEventListener('click', function close(ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('click', close); } }), 0);
  }

  // ---------- compte
  /* ---------------- session : une seule source de vérité ----------------
     - l'invité silencieux sert au pont local (aucun compte requis) ;
     - une réponse d'invité arrivée APRÈS une connexion est ignorée (fin du « connecté mais pas connecté ») ;
     - on ne dit « connecté » qu'après vérification du jeton par /api/auth/me. */
  const AUTH = {
    seq: 0,
    paint() { paintUser(); },
    async restore() {
      const cur = S.auth;
      if (cur && cur.token) {
        // jeton stocké : on demande au serveur qui il est vraiment
        let me = null, transport = false;
        try {
          const r = await API.call('/api/auth/me', { headers: { Authorization: 'Bearer ' + cur.token } });
          if (r && r.user) me = r.user;
          else if (r && r.error) transport = true;   // réseau/serveur en panne : on garde la session locale
        } catch { transport = true; }
        if (me) {
          S.auth = Object.assign({}, cur, { name: me.name, email: me.email, guest: !!cur.guest });
          save('auth'); paintUser();
          if (!S.auth.guest) { try { await window.J.cloudPull(); } catch {} }   // jamais bloquant
          return S.auth;
        }
        if (!transport) { S.auth = null; LS.del('auth'); }   // le serveur a dit « personne » : jeton réellement invalide
        else { paintUser(); return S.auth; }
      }
      paintUser();
      return AUTH.guest();
    },
    async guest() {
      const mine = ++AUTH.seq;
      try {
        const r = await API.call('/api/auth/guest', { method: 'POST' });
        // JAMAIS d'écrasement d'une session connectée : ni en mémoire, ni dans le stockage
        const stored = LS.get('auth', null);
        const real = (S.auth && !S.auth.guest) || (stored && !stored.guest);
        if (!r.token || AUTH.seq !== mine || real) return S.auth;
        S.auth = { token: r.token, name: r.user.name, email: r.user.email, guest: true };
        save('auth'); paintUser();
        return S.auth;
      } catch { return S.auth; }
    },
    async login(mode, { email, password, name }) {
      const mine = ++AUTH.seq;
      const r = await API.call('/api/auth/' + mode, { method: 'POST', body: { email, password, name } });
      if (!r || !r.token) return { ok: false, error: (r && r.error) || 'reseau' };
      // vérification réelle avant d'annoncer quoi que ce soit
      const me = await API.call('/api/auth/me', { headers: { Authorization: 'Bearer ' + r.token } });
      if (AUTH.seq !== mine) return { ok: false, error: 'annule' };
      if (!me.user) return { ok: false, error: 'session' };
      S.auth = { token: r.token, name: me.user.name, email: me.user.email, guest: false };
      save('auth'); paintUser();
      try { await window.J.cloudPull(); } catch {}
      return { ok: true, user: S.auth };
    },
    async logout() {
      AUTH.seq++;
      S.auth = null; LS.del('auth'); paintUser();
      await AUTH.guest();
    },
  };

  function paintUser() {
    const logged = !!(S.auth && !S.auth.guest);
    const name = logged ? (S.auth.name || S.auth.email) : t('auth.guestName');
    document.getElementById('me-name').textContent = name;
    document.getElementById('me-mail').textContent = logged ? (S.auth.email || '') : t('auth.guestnote');
    const chip = document.getElementById('me-state');
    if (chip) {
      chip.className = 'chip ' + (logged ? 'free' : '');
      chip.textContent = logged ? t('auth.synced') : t('auth.local');
    }
    document.getElementById('me-avatar').textContent = (name || 'U').trim().charAt(0).toUpperCase();
    const btn = document.getElementById('btn-auth-top');
    if (btn) { btn.innerHTML = ''; btn.appendChild(icon(S.auth && !S.auth.guest ? 'logout' : 'user', 16)); btn.title = S.auth && !S.auth.guest ? t('auth.logout') : t('auth.login'); }
  }
  function openAuth(startMode) {
    const email = el('input', { type: 'email', placeholder: t('auth.email'), autocomplete: 'email' });
    const pass = el('input', { type: 'password', placeholder: t('auth.password'), autocomplete: 'current-password' });
    const name = el('input', { type: 'text', placeholder: t('auth.name'), class: 'hidden' });
    const err = el('div', { class: 'notice danger tiny hidden' });
    const busy = el('div', { class: 'tiny muted hidden dots', text: t('auth.working') });
    let mode = startMode === 'register' ? 'register' : 'login';
    const tLogin = el('button', { class: 'btn sm' + (mode === 'login' ? ' primary' : ''), text: t('auth.login') });
    const tReg = el('button', { class: 'btn sm' + (mode === 'register' ? ' primary' : ''), text: t('auth.register') });
    const tabs = el('div', { class: 'row', style: 'margin-bottom:.8rem' }, tLogin, tReg);
    const sync = (m) => {
      mode = m;
      tLogin.classList.toggle('primary', m === 'login');
      tReg.classList.toggle('primary', m === 'register');
      name.classList.toggle('hidden', m !== 'register');
      tabIntro.textContent = m === 'register' ? t('auth.optional') : t('auth.why');
      go.textContent = m === 'register' ? t('auth.register') : t('auth.login');
    };
    tLogin.addEventListener('click', () => sync('login'));
    tReg.addEventListener('click', () => sync('register'));
    const tabIntro = el('div', { class: 'tiny muted', style: 'margin-bottom:.6rem', text: mode === 'register' ? t('auth.optional') : t('auth.why') });
    const go = el('button', { class: 'btn primary', text: mode === 'register' ? t('auth.register') : t('auth.login') });
    const submit = async () => {
      err.classList.add('hidden'); busy.classList.remove('hidden');
      const res = await AUTH.login(mode, { email: email.value.trim(), password: pass.value, name: name.value.trim() });
      busy.classList.add('hidden');
      if (!res.ok) {
        err.classList.remove('hidden');
        err.textContent = t('auth.err.' + (res.error || 'reseau'));
        return;
      }
      m.close();
      toast(t('auth.welcome', { email: res.user.email }), 'ok');
      if (!S.inApp) { if (S.key) enterApp(); else startOnboarding(false); }
      else { renderConvList(); applyTheme(); window.Chat.buildComposer(); applyI18n(document); }
    };
    go.addEventListener('click', submit);
    [email, pass, name].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }));
    const guest = el('button', { class: 'btn sm ghost', text: t('auth.guestShort') });
    guest.addEventListener('click', async () => { await AUTH.guest(); m.close(); toast(t('auth.guestnote')); if (!S.inApp) { if (S.key) enterApp(); else startOnboarding(false); } });
    const body = el('div', {}, tabIntro, tabs,
      el('div', { class: 'field' }, email), el('div', { class: 'field' }, pass), el('div', { class: 'field' }, name), err, busy);
    const m = modal({ title: t('auth.title'), sub: t('auth.subtitle'), body, foot: [guest, go], vert: true });
    setTimeout(() => email.focus(), 100);
  }
  function logout() { AUTH.logout(); toast(t('auth.logout')); }

  // ---------- pont local
  async function pollBridge() {
    const tick = async () => {
      try {
        const st = await API.call('/api/bridge/status');
        S.bridge.online = !!st.online;
        const chip = document.getElementById('bridge-chip');
        if (chip) {
          chip.innerHTML = '';
          chip.append(icon('plug', 15), el('span', { text: (st.online ? t('bridge.online') : t('bridge.offline')) }));
          chip.style.color = st.online ? 'var(--ok)' : 'var(--muted)';
        }
      } catch {}
    };
    tick(); setInterval(tick, 5000);
  }
  async function pollApprovals() {
    setInterval(async () => {
      if (S.mode !== 'agent') return;
      try {
        const r = await API.call('/api/bridge/approvals');
        (r.pending || []).forEach((p) => { if (!approving.has(p.id)) { approving.add(p.id); showApproval(p); } });
      } catch {}
    }, 2500);
  }
  function showApproval(p) {
    const body = el('div', {},
      el('div', { class: 'notice ' + (p.risk === 'high' ? 'danger' : p.risk === 'safe' ? 'ok' : 'warn') },
        el('div', { class: 'tiny muted', text: t('approval.request') }),
        el('div', { class: 'code', text: p.command }),
        el('div', { class: 'row', style: 'margin-top:.4rem' },
          el('span', { class: 'chip ' + (p.risk === 'high' ? 'danger' : p.risk === 'safe' ? 'free' : 'paid'), text: t('approval.risk') + ' : ' + t('approval.risk.' + p.risk) }),
          p.family ? el('span', { class: 'chip', text: p.family }) : null)));
    const decide = async (d) => {
      await API.call('/api/bridge/decision', { method: 'POST', body: { id: p.id, decision: d } });
      if (d === 'always') toast(t('approval.alwaysAdded', { f: p.family }), 'ok');
      m.close();
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
  window.App = { start, startOnboarding, openModelTest, openBatchStep, enterApp, showPanel, showApproval, renderConvList, openAuth, paidConsent, downloadBat, togglePanel, refreshCredit };
})();
