/* JARVIS — chat : composeur, modèles, effort, vocal, live, RAG, skills, modes */
(function () {
  const { S, t, el, save, toast, modal, API, md, esc, countdownModal, ico, icon } = window.J;

  const PRESET_SKILLS = [
    { id: 'sk1', name: 'Traducteur', instr: 'Traduis tout ce que je te donne en conservant le ton et les nuances.' },
    { id: 'sk2', name: 'Rédacteur', instr: 'Rédige des textes clairs, structurés et convaincants.' },
    { id: 'sk3', name: 'Revue de code', instr: 'Analyse le code, trouve les bugs, propose des améliorations concrètes.' },
    { id: 'sk4', name: 'Chercheur', instr: 'Cherche, croise les sources et donne une synthèse sourcée.' },
    { id: 'sk5', name: 'Coach', instr: 'Aide-moi à progresser avec un plan d\'action étape par étape.' },
    { id: 'sk6', name: 'Data analyste', instr: 'Analyse les données, calcule, présente les résultats en tableaux.' },
    { id: 'sk7', name: 'Mathématicien', instr: 'Résous les problèmes étape par étape en justifiant chaque calcul.' },
    { id: 'sk8', name: 'Résumeur', instr: 'Résume en points clés, sans perdre l\'essentiel.' },
  ];
  const CTX = { ragFiles: [], ragWeb: [], ragNotes: [], files: [], skills: [] };
  const MODELS = { list: [], loaded: false };
  const V = { on: false, live: false, stream: null, sending: false, loop: false };

  const EFFORTS = ['ultra_saver', 'mini', 'normal', 'high', 'very_high', 'max', 'ultra'];
  const WARN = ['high', 'very_high', 'max', 'ultra'];
  const TABS = [
    ['classic', 'nav.new', 'chat'], ['multitask', 'tab.multitask', 'grid'], ['compare', 'tab.compare', 'scale'],
    ['code', 'tab.code', 'code'], ['private', 'tab.private', 'shield'], ['offline', 'tab.offline', 'offline'],
    ['image', 'tab.image', 'image'], ['video', 'tab.video', 'film'],
  ];

  const profile = () => S.settings.profiles[S.settings.activeProfile] || {};
  const firstFree = () => (MODELS.list.find((m) => m.free) || MODELS.list[0] || {}).id;
  const activeModel = () => S.settings.ai.model || S.model || firstFree() || 'meta-llama/llama-3.3-70b-instruct:free';
  const modelInfo = (id) => MODELS.list.find((m) => m.id === id);

  // ------------------------------------------------------------ composeur
  function buildComposer() {
    const c = document.getElementById('composer');
    if (!c) return;
    c.innerHTML = '';
    const wrap = el('div', { class: 'wrap' });
    const chips = el('div', { class: 'ctx-chips' });
    const box = el('div', { class: 'box' });

    const plus = el('button', { class: 'ibtn tip', id: 'plus-btn', 'data-tip': t('msg.plus') }, icon('plus', 19));
    plus.addEventListener('click', (e) => { e.stopPropagation(); openPlusMenu(plus); });

    const ta = el('textarea', { id: 'input', placeholder: t('msg.placeholder'), rows: 1 });
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'; });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && S.settings.ai.enterSend) { e.preventDefault(); send(); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
    });

    const effortBtn = el('button', { class: 'btn sm ghost tip', 'data-tip': t('effort.label') }, icon('sliders', 15), el('span', { class: 'effort-lbl', text: t('effort.' + (S.settings.ai.effort || 'normal')) }));
    effortBtn.addEventListener('click', (e) => { e.stopPropagation(); openEffortMenu(effortBtn); });

    const voiceBtn = el('button', { class: 'ibtn tip', id: 'voice-btn', 'data-tip': t('msg.voice') }, icon('mic', 19));
    voiceBtn.addEventListener('click', () => toggleVoice());

    const liveBtn = el('button', { class: 'ibtn tip', id: 'live-btn', 'data-tip': t('msg.live') }, icon('camera', 19));
    liveBtn.addEventListener('click', () => toggleLive());

    const sendBtn = el('button', { class: 'ibtn tip', id: 'send-btn', 'data-tip': t('msg.send'), style: 'color:var(--accent)' }, icon('send', 19));
    sendBtn.addEventListener('click', () => { if (S.abort || (window.OR && window.OR.state.abort)) J.ORapi.stop(); else send(); });

    box.append(el('div', { class: 'tools' }, plus), ta, el('div', { class: 'right' }, effortBtn, voiceBtn, liveBtn, sendBtn));
    const hint = el('div', { class: 'composer-hint' },
      el('span', { text: t('effort.label') + ' : ' + t('effort.' + S.settings.ai.effort) + (WARN.includes(S.settings.ai.effort) ? ' — ' + t('effort.more') : '') }),
      el('span', { text: t(S.settings.ai.enterSend ? 'msg.enter' : 'msg.enterCtrl') }));

    wrap.append(chips, box, hint);
    c.appendChild(wrap);
    Chat.ta = ta;
    renderChips();
  }

  function renderChips() {
    const box = document.querySelector('#composer .ctx-chips');
    if (!box) return;
    box.innerHTML = '';
    const add = (label, onX, cls = '', ic = 'clip') => {
      const chip = el('span', { class: 'chip ' + cls }, icon(ic, 13), el('span', { text: label }));
      const x = el('button', { class: 'ibtn', style: 'width:18px;height:18px' }, icon('close', 12));
      x.addEventListener('click', () => { onX(); renderChips(); });
      chip.appendChild(x); box.appendChild(chip);
    };
    CTX.ragFiles.forEach((f, i) => add(f.name, () => CTX.ragFiles.splice(i, 1), '', 'folder'));
    CTX.ragWeb.forEach((w, i) => add(w.url.slice(0, 30), () => CTX.ragWeb.splice(i, 1), '', 'globe'));
    CTX.ragNotes.forEach((n, i) => add(n.slice(0, 26), () => CTX.ragNotes.splice(i, 1), '', 'book'));
    CTX.files.forEach((f, i) => add(f.name, () => CTX.files.splice(i, 1), '', 'clip'));
    CTX.skills.forEach((s, i) => add(s.name, () => CTX.skills.splice(i, 1), 'free', 'bolt'));
    if (S.private) add(t('tab.private'), () => setTab('classic'), 'danger', 'shield');
    if (S.tab !== 'classic') add(t('tab.' + S.tab), () => setTab('classic'), '', 'layers');
  }

  // ------------------------------------------------------------ menus
  function menuAt(anchor, items, width = 260) {
    document.querySelectorAll('.popmenu').forEach((m) => m.remove());
    const m = el('div', { class: 'popmenu', style: `min-width:${width}px;max-height:70vh;width:max-content` });
    items.forEach((it) => {
      if (it.hr) { m.appendChild(el('div', { style: 'height:1px;background:var(--border);margin:.3rem .2rem' })); return; }
      const row = el('div', { class: 'model-row' + (it.active ? ' active' : '') });
      if (it.radio) row.appendChild(el('span', { class: 'radio' }));
      else if (it.icon) row.appendChild(icon(it.icon, 17));
      row.appendChild(el('div', { class: 'nm' },
        el('b', { html: it.label }),
        it.sub ? el('small', { text: it.sub }) : null));
      if (it.tag) row.appendChild(el('span', { class: 'chip ' + (it.tagClass || ''), text: it.tag }));
      row.addEventListener('click', () => { m.remove(); it.onClick && it.onClick(); });
      m.appendChild(row);
    });
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    const top = Math.min(r.bottom + 6, innerHeight - m.offsetHeight - 8);
    m.style.top = Math.max(8, top) + 'px';
    m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 10)) + 'px';
    setTimeout(() => {
      const closer = (ev) => { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('click', closer); } };
      document.addEventListener('click', closer);
    }, 0);
  }

  function openEffortMenu(anchor) {
    menuAt(anchor, EFFORTS.map((k) => ({
      label: t('effort.' + k), active: S.settings.ai.effort === k, radio: true,
      sub: WARN.includes(k) ? t('effort.more') : (k === 'ultra_saver' || k === 'mini' ? t('effort.less') : t('effort.note.normal')),
      tag: WARN.includes(k) ? () => '' : '',
      onClick: () => {
        if (WARN.includes(k) && S.settings.ai.effort !== k) {
          modal({ title: t('effort.warn.title'), sub: t('effort.warn.body', { level: t('effort.' + k) }),
            body: el('div', { class: 'notice warn', text: t('effort.more') }),
            foot: [el('button', { class: 'btn', text: t('common.cancel'), onclick: () => document.querySelector('.overlay').remove() }),
              el('button', { class: 'btn primary', text: t('common.ok'), onclick: () => { document.querySelector('.overlay').remove(); applyEffort(k); } })] });
        } else applyEffort(k);
      },
    })), 300);
  }
  const applyEffort = (k) => { S.settings.ai.effort = k; save('settings'); buildComposer(); };

  async function loadModels(force) {
    if (MODELS.loaded && !force) return MODELS.list;
    const btn = document.getElementById('model-btn');
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => openModelMenu(btn));
    }
    if (btn) { btn.innerHTML = ''; btn.append(icon('loader', 16), el('span', { class: 'nm', text: t('or.loading') })); }
    const r = await J.ORapi.models(S.key, { force });
    if (r.ok) {
      MODELS.list = r.models;
      MODELS.loaded = true;
      MODELS.via = r.via;
      // rien n'est pré-choisi : si aucun modèle n'est encore défini, on prend le premier gratuit renvoyé par l'API
      if (!S.settings.ai.model) {
        const free = firstFree();
        if (free) { S.settings.ai.model = free; S.model = free; save('settings'); }
      }
      if (!MODELS.list.some((m) => m.id === S.settings.ai.model) && MODELS.list.length) {
        const free = firstFree();
        if (free) { S.settings.ai.model = free; S.model = free; save('settings'); }
      }
    } else {
      MODELS.list = [];
      MODELS.loaded = false;
      MODELS.error = r.reason || 'inconnu';
      MODELS.detail = r.error || '';
    }
    if (!r.ok) toast(t('or.err.' + (r.reason || 'inconnu')), 'err');
    else if (r.via === 'direct') toast(t('or.channel.direct'));
    paintModelButton();
    return MODELS.list;
  }

  /** Bandeau d'erreur quand OpenRouter est injoignable + bouton Réessayer. */
  function modelsBanner() {
    const retry = el('button', { class: 'btn sm primary' }, icon('refresh', 15), t('or.retry'));
    retry.addEventListener('click', async () => { await loadModels(true); renderMessages(); });
    const keysBtn = el('button', { class: 'btn sm' }, icon('link', 15), t('or.keys'));
    keysBtn.addEventListener('click', () => J.openLink('https://openrouter.ai/keys'));
    const diagBtn = el('button', { class: 'btn sm' }, icon('plug', 15), t('or.diag'));
    diagBtn.addEventListener('click', () => window.App.showPanel('ai'));
    return el('div', { class: 'notice danger', style: 'max-width:680px;margin:2rem auto' },
      el('b', { text: t('or.offline.title') }),
      el('div', { class: 'tiny', text: t('or.err.' + (MODELS.error || 'inconnu')) }),
      el('div', { class: 'tiny muted', text: MODELS.detail || '' }),
      el('div', { class: 'row wrap', style: 'margin-top:.5rem' }, retry, keysBtn, diagBtn));
  }
  function paintModelButton() {
    const btn = document.getElementById('model-btn');
    if (!btn) return;
    btn.innerHTML = '';
    if (!MODELS.list.length) {
      btn.append(icon('warning', 16), el('span', { class: 'nm', text: t('or.channel.none') }), icon('chevron', 14));
      btn.classList.add('chip');
      return;
    }
    const id = activeModel();
    const info = modelInfo(id);
    btn.append(icon(info && info.vision ? 'eye' : 'cpu', 16),
      el('span', { class: 'nm', text: info ? info.name : id }),
      el('span', { class: 'chip ' + (info && info.free ? 'free' : 'paid'), text: info ? (info.free ? 'FREE' : 'PAID') : '—' }),
      icon('chevron', 14));
  }

  function openModelMenu(anchor) {
    if (!MODELS.list.length) {
      return menuAt(anchor, [
        { label: t('or.offline.title'), sub: t('or.err.' + (MODELS.error || 'inconnu')), icon: 'warning',
          onClick: async () => { await loadModels(true); renderMessages(); } },
        { label: t('or.keys'), icon: 'link', onClick: () => J.openLink('https://openrouter.ai/keys') },
      ], 320);
    }
    const items = MODELS.list.slice(0, 80).map((m) => ({
      label: m.name, sub: m.id + (m.context ? ' · ' + (m.context / 1000).toFixed(0) + 'k' : '') + (m.vision ? ' · ' + t('model.vision') : ' · ' + t('model.novision')),
      tag: m.free ? 'FREE' : 'PAID', tagClass: m.free ? 'free' : 'paid', active: m.id === activeModel(),
      onClick: async () => {
        if (!m.free && !(await paidWarning(m.id))) return;
        S.settings.ai.model = m.id; S.model = m.id; save('settings'); save('model');
        if (S.auth && !S.auth.guest) API.call('/api/auth/provision', { method: 'POST', body: { key: S.key, model: m.id } });
        paintModelButton(); toast(t('model.selected') + ' : ' + m.id, 'ok');
      },
    }));
    items.unshift({ label: t('model.title'), sub: t('model.docs'), icon: 'sliders', onClick: () => window.App.openModelTest(S.key) });
    items.splice(1, 0, { hr: true });
    menuAt(anchor, items, 340);
  }

  const paidWarning = (model) => new Promise((resolve) => {
    countdownModal({
      title: t('paid.title'), body: t('paid.body', { model }), seconds: 5,
      foot: [
        () => el('button', { class: 'btn', text: t('paid.chooseFree'), onclick: () => { m.close(); resolve(false); } }),
        () => el('button', { class: 'btn', text: t('common.cancel'), onclick: () => { m.close(); resolve(false); } }),
        () => el('button', { class: 'btn primary', text: t('common.ok'), onclick: () => { m.close(); resolve(true); } }),
      ],
    });
  });

  // ------------------------------------------------------------ menu +
  function openPlusMenu(anchor) {
    menuAt(anchor, [
      { label: t('rag.title'), sub: t('rag.desc'), icon: 'layers', onClick: openRag },
      { label: t('file.title'), sub: t('file.desc'), icon: 'clip', onClick: () => pickFiles() },
      { label: t('skill.title'), sub: t('skill.pre'), icon: 'bolt', onClick: openSkills },
      { hr: true },
      { label: t('tab.multitask'), icon: 'grid', onClick: () => setTab('multitask') },
      { label: t('tab.compare'), icon: 'scale', onClick: () => setTab('compare') },
      { label: t('tab.code'), icon: 'code', onClick: () => setTab('code') },
      { label: t('tab.private'), sub: t('priv.on'), icon: 'shield', onClick: () => setTab('private') },
      { label: t('tab.offline'), sub: t('off.desc'), icon: 'offline', onClick: () => setTab('offline') },
      { hr: true },
      { label: t('img.title'), icon: 'image', onClick: () => setTab('image') },
      { label: t('vid.title'), icon: 'film', onClick: () => setTab('video') },
      { hr: true },
      { label: t('nav.history'), icon: 'clock', onClick: () => window.App.showPanel('history') },
      { label: t('nav.memory'), icon: 'brain', onClick: () => window.App.showPanel('memory') },
    ], 300);
  }

  function openRag() {
    const body = el('div', { class: 'col' });
    const mk = (titleKey, arr, inputNode, nameOf) => {
      const box = el('div', { class: 'panel-sec' }, el('h4', { text: t(titleKey) + ' (' + arr.length + '/5)' }));
      arr.forEach((x, i) => box.appendChild(el('div', { class: 'switch-row' },
        el('div', { class: 'tiny', text: nameOf(x) }),
        el('button', { class: 'ibtn', onclick: () => { arr.splice(i, 1); m.close(); openRag(); } }, icon('trash', 15)))));
      box.appendChild(inputNode);
      return box;
    };
    const fileInput = el('input', { type: 'file', multiple: true, accept: '.txt,.md,.json,.csv,.js,.ts,.py,.html,.css,.pdf,.docx' });
    fileInput.addEventListener('change', async () => {
      for (const f of fileInput.files) {
        if (CTX.ragFiles.length >= 5) { toast(t('rag.limited'), 'err'); break; }
        CTX.ragFiles.push({ name: f.name, text: (await f.text()).slice(0, 120000) });
      }
      toast(t('toast.saved'), 'ok'); m.close(); renderChips();
    });
    const urlIn = el('input', { type: 'url', placeholder: t('rag.addurl') });
    urlIn.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter' || !urlIn.value.trim()) return;
      if (CTX.ragWeb.length >= 5) return toast(t('rag.limited'), 'err');
      const u = urlIn.value.trim();
      CTX.ragWeb.push({ url: u, text: '' }); urlIn.value = ''; renderChips(); toast(t('common.loading'));
      try { const r = await fetch('https://r.jina.ai/' + u); CTX.ragWeb[CTX.ragWeb.length - 1].text = (await r.text()).slice(0, 60000); toast(t('toast.saved'), 'ok'); }
      catch { try { const r2 = await fetch(u); CTX.ragWeb[CTX.ragWeb.length - 1].text = (await r2.text()).slice(0, 60000); } catch { toast(t('toast.error'), 'err'); } }
    });
    const noteIn = el('input', { type: 'text', placeholder: t('rag.addnote') });
    noteIn.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !noteIn.value.trim()) return;
      if (CTX.ragNotes.length >= 5) return toast(t('rag.limited'), 'err');
      CTX.ragNotes.push(noteIn.value.trim()); noteIn.value = ''; toast(t('toast.saved'), 'ok'); renderChips();
    });
    body.append(
      mk('rag.files', CTX.ragFiles, fileInput, (f) => f.name),
      mk('rag.web', CTX.ragWeb, urlIn, (w) => w.url),
      mk('rag.notes', CTX.ragNotes, noteIn, (n) => n));
    const m = modal({ title: t('rag.title'), sub: t('rag.desc'), body, onClose: renderChips });
  }

  function pickFiles() {
    const input = el('input', { type: 'file', multiple: true });
    input.addEventListener('change', async () => {
      for (const f of input.files) {
        if (CTX.files.length >= 3) { toast(t('file.limited'), 'err'); break; }
        if (/^image\//.test(f.type)) {
          const dataUrl = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(f); });
          CTX.files.push({ name: f.name, image: dataUrl });
        } else CTX.files.push({ name: f.name, text: (await f.text()).slice(0, 120000) });
      }
      renderChips(); toast(t('toast.saved'), 'ok');
    });
    input.click();
  }

  function openSkills() {
    const body = el('div', { class: 'col' });
    const mine = el('div', { class: 'panel-sec' }, el('h4', { text: t('skill.mine') }));
    const drawMine = () => {
      mine.querySelectorAll('.switch-row').forEach((e) => e.remove());
      if (!S.skills.length) mine.appendChild(el('div', { class: 'muted tiny', text: t('skill.empty') }));
      S.skills.forEach((s, i) => mine.appendChild(el('div', { class: 'switch-row' },
        el('div', {}, el('div', { class: 'tiny', text: s.name }), el('div', { class: 'tiny muted', text: (s.instr || '').slice(0, 60) })),
        el('div', { class: 'row' },
          el('button', { class: 'btn sm', text: t('common.add'), onclick: () => { add(s); m.close(); } }),
          el('button', { class: 'ibtn', onclick: () => { S.skills.splice(i, 1); save('skills'); drawMine(); } }, icon('trash', 15))))));
    };
    drawMine();
    const pre = el('div', { class: 'panel-sec' }, el('h4', { text: t('skill.pre') }));
    PRESET_SKILLS.forEach((s) => pre.appendChild(el('div', { class: 'switch-row' },
      el('div', {}, el('div', { class: 'tiny', text: s.name }), el('div', { class: 'tiny muted', text: s.instr.slice(0, 58) })),
      el('button', { class: 'btn sm', text: t('common.add'), onclick: () => { add(s); m.close(); } }))));
    const name = el('input', { type: 'text', placeholder: t('skill.namet') });
    const instr = el('textarea', { placeholder: t('skill.instrt') });
    const create = el('div', { class: 'panel-sec' }, el('h4', { text: t('skill.create') }), name, instr,
      el('button', { class: 'btn sm primary', style: 'margin-top:.5rem', text: t('skill.add'), onclick: () => {
        if (!name.value.trim()) return;
        S.skills.unshift({ id: 'sk' + Date.now(), name: name.value.trim(), instr: instr.value });
        save('skills'); name.value = ''; instr.value = ''; drawMine(); toast(t('toast.saved'), 'ok');
      } }));
    const add = (s) => { if (!CTX.skills.find((x) => x.name === s.name)) CTX.skills.push(s); renderChips(); };
    const m = modal({ title: t('skill.title'), body, vert: true });
    body.append(mine, pre, create);
  }

  // ------------------------------------------------------------ contexte
  function contextBlock() {
    const parts = [];
    const p = profile();
    if (S.settings.ai.useMemory && S.mem.length && !S.private) parts.push('Mémoire (ce que tu sais de moi) :\n' + S.mem.map((m) => '- ' + m.text).join('\n'));
    if (CTX.skills.length) parts.push('Skills actifs :\n' + CTX.skills.map((s) => '- ' + s.name + ' : ' + s.instr).join('\n'));
    const rag = [];
    CTX.ragFiles.forEach((f) => rag.push(`### Fichier ${f.name}\n${f.text}`));
    CTX.ragWeb.forEach((w) => rag.push(`### Page ${w.url}\n${w.text || '(non chargée)'}`));
    CTX.ragNotes.forEach((n) => rag.push(`### Note\n${n}`));
    CTX.files.forEach((f) => f.text && rag.push(`### Fichier joint ${f.name}\n${f.text}`));
    if (rag.length) parts.push('Contexte RAG fourni par l\'utilisateur :\n' + rag.join('\n\n').slice(0, 40000));
    if (p.userName) parts.push('Mon nom : ' + p.userName);
    return parts.join('\n\n');
  }

  function currentConv() {
    let c = S.conv.find((x) => x.id === S.activeId);
    if (!c) {
      c = { id: 'c' + Date.now(), title: t('nav.new'), mode: S.mode, messages: [], at: Date.now() };
      if (!S.private) { S.conv.unshift(c); S.activeId = c.id; save('conv'); }
      else S.privateConv = c;
    }
    return c;
  }

  // ------------------------------------------------------------ messages
  const view = () => document.getElementById('chat-scroll');
  function renderMessages() {
    const box = view();
    if (!box) return;
    box.classList.remove('grid-mode');
    box.innerHTML = '';
    const conv = currentConv();
    if (!conv.messages.length) return renderWelcome();
    conv.messages.forEach((m) => box.appendChild(node(m)));
    if (S.settings.ai.autoScroll) box.scrollTop = box.scrollHeight;
  }
  function renderWelcome() {
    const box = view();
    box.classList.remove('grid-mode');
    box.innerHTML = '';
    const p = profile();
    if (!MODELS.list.length) box.appendChild(modelsBanner());
    box.appendChild(el('div', { class: 'welcome' },
      el('div', { class: 'mark' }),
      el('h2', { text: p.aiName ? p.aiName + ' — ' + t('land.feat1') : t('land.hero') }),
      el('p', { class: 'tiny', text: t('land.sub') }),
      el('div', { class: 'row wrap', style: 'justify-content:center;gap:.35rem;margin-top:.4rem' },
        ...[t('lp.do.d1t'), t('lp.do.d2t'), t('lp.do.d5t'), t('lp.do.d4t')].map((x) => el('span', { class: 'chip', text: x })))));
  }

  function node(m) {
    const wrap = el('div', { class: 'msg ' + (m.role === 'user' ? 'user' : 'ai') });
    const av = el('div', { class: 'av' }, icon(m.role === 'user' ? 'user' : 'sparkle', 16));
    const bubble = el('div', { class: 'bubble' });
    if (m.reasoning) bubble.appendChild(el('div', { class: 'reason', text: m.reasoning }));
    const content = Array.isArray(m.content) ? m.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n') : m.content;
    const body = el('div', { class: 'md', html: md(content || '') });
    bubble.appendChild(body);
    if (Array.isArray(m.content)) m.content.filter((c) => c.type === 'image_url').forEach((c) => bubble.appendChild(el('img', { src: c.image_url.url, class: 'screen-shot' })));
    if (m.tools?.length) m.tools.forEach((tl) => bubble.appendChild(el('div', { class: 'tool-line', text: tl })));
    if (m.image) bubble.appendChild(el('img', { src: m.image, class: 'screen-shot' }));

    const acts = el('div', { class: 'msg-actions' });
    const ab = (ic, title, fn) => { const b = el('button', { class: 'ibtn tip', 'data-tip': title }, icon(ic, 15)); b.addEventListener('click', fn); return b; };
    acts.appendChild(ab('copy', t('toast.copied'), () => window.J.copy(content || '')));
    if (m.role !== 'user') acts.appendChild(ab('volume', t('set.ttsAuto'), () => window.J.speak(content || '')));
    if (m.role === 'user') acts.appendChild(ab('pencil', t('nav.rename'), () => { if (Chat.ta) { Chat.ta.value = content || ''; Chat.ta.focus(); } }));
    if (S.mode === 'agent' && m.role !== 'user') acts.appendChild(ab('terminal', t('code.run'), () => runOnPC(content || '')));
    bubble.appendChild(acts);
    wrap.append(av, bubble);
    return wrap;
  }

  async function runOnPC(text) {
    const cmd = await J.ask({ title: t('code.run'), label: t('approval.command'), value: (String(text).match(/`([^`]+)`/) || [])[1] || '', ok: t('common.send') });
    if (!cmd) return;
    const r = await API.call('/api/bridge/command', { method: 'POST', body: { command: cmd, sessionId: S.bridge.sessionId } });
    toast(t('approval.request') + ' — ' + (r.risk || ''), 'ok');
  }

  // ------------------------------------------------------------ envoi
  async function send(textOverride, opts = {}) {
    const ta = Chat.ta || document.getElementById('input');
    const text = (textOverride !== undefined ? textOverride : ta?.value || '').trim();
    if (!text && !CTX.files.some((f) => f.image)) {
      if (textOverride === undefined) { toast(t('msg.empty'), 'err'); ta && ta.focus(); }
      return;
    }
    if (!S.key) { toast(t('toast.nokey'), 'err'); return window.App.startOnboarding(true); }
    if (V.sending) return;

    const conv = currentConv();
    const ctx = contextBlock();
    const content = [];
    if (ctx) content.push({ type: 'text', text: ctx });
    if (text) content.push({ type: 'text', text });
    CTX.files.filter((f) => f.image).forEach((f) => content.push({ type: 'image_url', image_url: { url: f.image } }));
    const simple = content.length === 1 && content[0].type === 'text' ? content[0].text : content;

    const userMsg = { role: 'user', content: simple, at: Date.now() };
    conv.messages.push(userMsg);
    if (conv.messages.length === 1) { conv.title = text.slice(0, 48) || t('nav.new'); window.App.renderConvList(); }
    CTX.files = []; CTX.ragFiles = []; CTX.ragWeb = []; CTX.ragNotes = [];
    if (ta) { ta.value = ''; ta.style.height = 'auto'; }
    renderChips();
    const box = view();
    if (box.querySelector('.welcome')) box.innerHTML = '';
    box.appendChild(node(userMsg));

    const model = opts.model || activeModel();
    const info = modelInfo(model);
    const aiMsg = { role: 'assistant', content: '', reasoning: '', tools: [] };
    conv.messages.push(aiMsg);
    const aiNode = node(aiMsg);
    box.appendChild(aiNode);
    const bubble = aiNode.querySelector('.bubble');
    const live = el('div', { class: 'md' });
    bubble.insertBefore(live, bubble.firstChild);
    const think = el('div', { class: 'tiny muted dots', text: t('common.thinking') });
    bubble.insertBefore(think, live);
    V.sending = true;
    document.getElementById('send-btn')?.classList.add('rec');

    const messages = conv.messages.filter((m) => m !== aiMsg).map((m) => ({ role: m.role, content: m.content }));
    let announced = false;
    try {
      const res = await J.ORapi.chat({
        key: S.key, model,
        messages: S.private ? messages.slice(-4) : messages,
        effort: S.settings.ai.effort, mode: S.mode, maxTokens: S.settings.ai.maxTokens,
        profile: profile(), sessionId: S.bridge.sessionId, temperature: S.settings.ai.temperature,
        visionWarning: S.settings.ai.visionWarn && info && !info.vision,
      }, {
        channel: (c) => { if (c === 'direct' && !announced) { announced = true; toast(t('or.channel.direct')); } },
        delta: (d) => { aiMsg.content += d.text; live.innerHTML = md(aiMsg.content); if (S.settings.ai.autoScroll) box.scrollTop = box.scrollHeight; },
        reasoning: (d) => {
          aiMsg.reasoning += d.text;
          let r = bubble.querySelector('.reason');
          if (!r) { r = el('div', { class: 'reason' }); bubble.insertBefore(r, bubble.firstChild); }
          r.textContent = aiMsg.reasoning;
        },
        tool: (d) => {
          if (d.phase === 'start') {
            aiMsg.tools.push(d.name);
            bubble.appendChild(el('div', { class: 'tool-line dots', text: d.name + ' ' + (d.args?.command || d.args?.path || d.args?.query || '') }));
          } else {
            const lines = bubble.querySelectorAll('.tool-line');
            const last = lines[lines.length - 1];
            if (last) { last.classList.remove('dots'); last.textContent = d.name + ' — ' + String(d.result || '').slice(0, 160); }
          }
        },
        screen: (d) => { if (d.image) { aiMsg.image = d.image; bubble.appendChild(el('img', { src: d.image, class: 'screen-shot' })); } },
        approval: (d) => window.App.showApproval(d),
        error: (d) => { /* l'erreur finale est traitée après le retour du canal */ },
        done: () => {},
      });
      if (!res.ok && !res.aborted) {
        aiMsg.content += (aiMsg.content ? '\n\n' : '') + '**' + t('or.offline.title') + '** — ' + t('or.err.' + (res.reason || 'inconnu'))
          + (res.error ? '\n\n`' + String(res.error).slice(0, 300) + '`' : '');
        live.innerHTML = md(aiMsg.content);
        MODELS.error = res.reason || MODELS.error;
        MODELS.detail = res.error || MODELS.detail;
        paintModelButton();
      }
    } catch (e) {
      if (String(e.name) !== 'AbortError') { aiMsg.content += '\n\n' + String(e.message || e); live.innerHTML = md(aiMsg.content); }
    }
    think.remove();
    V.sending = false;
    document.getElementById('send-btn')?.classList.remove('rec');
    if (!S.private && S.settings.ai.useHistory) { S.hist.unshift({ q: text, a: aiMsg.content.slice(0, 400), at: Date.now(), conv: conv.id }); save('hist'); }
    if (S.settings.ai.ttsAuto && !opts.noSpeak) window.J.speak(aiMsg.content);
    conv.at = Date.now();
    save('conv');
    if (V.loop && V.on) listenOnce();
    return aiMsg.content;
  }

  // ------------------------------------------------------------ vocal / live
  function hud(show, text) {
    const h = document.getElementById('voice-hud');
    h.classList.toggle('on', show);
    if (text !== undefined) document.getElementById('hud-text').textContent = text;
    const wave = document.getElementById('wave');
    if (show && !wave.children.length) for (let i = 0; i < 14; i++) wave.appendChild(el('i', { style: `animation-delay:${i * 0.06}s` }));
  }
  function toggleVoice() {
    V.on = !V.on; V.loop = V.on;
    document.getElementById('voice-btn')?.classList.toggle('rec', V.on);
    if (V.on) { hud(true, t('msg.voice.on')); listenOnce(); } else stopVoice();
  }
  function stopVoice() {
    V.on = false; V.loop = false;
    try { V.rec?.stop(); } catch {}
    window.J.stopSpeak(); hud(false);
    document.getElementById('voice-btn')?.classList.remove('rec');
  }
  function listenOnce() {
    if (!V.on) return;
    const rec = window.J.createSTT((full) => { hud(true, full); if (Chat.ta) Chat.ta.value = full; }, async (finalTxt) => {
      const said = (finalTxt || Chat.ta?.value || '').trim();
      if (!said) { if (V.on) setTimeout(listenOnce, 400); return; }
      if (Chat.ta) Chat.ta.value = '';
      const answer = await send(said, { noSpeak: true });
      window.J.speak(String(answer || '').slice(0, 1200), { onend: () => { if (V.on && V.loop) setTimeout(listenOnce, 300); } });
      if (!window.speechSynthesis) setTimeout(listenOnce, 1200);
    }, () => hud(true, t('msg.voice.on')));
    if (!rec) { toast(t('voice.unsupported'), 'err'); V.on = false; return; }
    V.rec = rec;
    try { rec.start(); } catch {}
  }
  async function toggleLive() {
    V.live = !V.live;
    document.getElementById('live-btn')?.classList.toggle('rec', V.live);
    const video = document.getElementById('live-video');
    if (V.live) {
      try {
        V.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        video.srcObject = V.stream; video.classList.remove('hidden');
        hud(true, t('msg.live')); V.on = true; V.loop = true; liveLoop();
      } catch { toast(t('live.nocam'), 'err'); V.live = false; }
    } else {
      V.stream?.getTracks().forEach((tr) => tr.stop());
      video.classList.add('hidden'); video.srcObject = null; stopVoice();
    }
  }
  async function liveLoop() {
    if (!V.live) return;
    const rec = window.J.createSTT((full) => { if (Chat.ta) Chat.ta.value = full; }, async (finalTxt) => {
      const said = (finalTxt || '').trim();
      if (!said) { if (V.live) setTimeout(liveLoop, 500); return; }
      if (Chat.ta) Chat.ta.value = '';
      const shot = grabFrame();
      const info = modelInfo(activeModel());
      if (shot && info && info.vision) CTX.files.push({ name: 'live-frame.jpg', image: shot });
      else if (shot && info && !info.vision) toast(t('live.needsvision'));
      const answer = await send(said, { noSpeak: true });
      window.J.speak(String(answer || '').slice(0, 1000), { onend: () => { if (V.live) setTimeout(liveLoop, 300); } });
      if (!window.speechSynthesis) setTimeout(liveLoop, 1500);
    });
    if (!rec) return;
    V.rec = rec; try { rec.start(); } catch {}
  }
  function grabFrame() {
    const v = document.getElementById('live-video');
    if (!v || !v.videoWidth) return null;
    const c = document.createElement('canvas');
    c.width = 640; c.height = Math.round(640 * v.videoHeight / v.videoWidth);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  }

  // ------------------------------------------------------------ modes
  function tabList(container) {
    container.innerHTML = '';
    TABS.forEach(([key, labelKey, ic]) => {
      const b = el('button', { class: 'tab' + (S.tab === key ? ' active' : ''), 'data-tab': key }, icon(ic, 16), el('span', { class: 'lbl', text: t(labelKey) }));
      b.addEventListener('click', () => setTab(key));
      container.appendChild(b);
    });
  }

  function setTab(tab) {
    const prev = S.tab;
    S.tab = tab;
    S.private = tab === 'private';
    // le composeur disparaît pour les modes grille et les studios
    const composer = document.getElementById('composer');
    composer.classList.toggle('hidden', ['multitask', 'compare'].includes(tab));
    const studio = document.getElementById('studio');
    if (studio) { studio.classList.add('hidden'); studio.innerHTML = ''; }
    const box = view();
    box.classList.remove('grid-mode');
    renderChips();
    tabList(document.getElementById('chat-tabs') || el('div'));
    const list = document.getElementById('main-tabs');
    if (list && !list.querySelector('[data-tab]')) { /* le tiroir garde ses sections */ }

    if (tab === 'image' || tab === 'video') return window.Media.open(tab);
    if (tab === 'multitask' || tab === 'compare') return renderGrid(tab);
    if (tab === 'offline') return renderOffline();
    if (tab === 'private' && prev !== 'private') toast(t('priv.on'));
    renderMessages();
  }

  function cell(model) {
    const box = el('div', { class: 'cell' });
    const sel = el('select');
    (MODELS.list.length ? MODELS.list : [{ id: model, name: model, free: true }]).slice(0, 60)
      .forEach((m) => sel.appendChild(el('option', { value: m.id, text: (m.free ? '' : 'PAID · ') + m.name, selected: m.id === model })));
    sel.addEventListener('change', async () => {
      const info = modelInfo(sel.value);
      if (info && !info.free && !(await paidWarning(sel.value))) { sel.value = box.dataset.model; return; }
      box.dataset.model = sel.value;
    });
    box.dataset.model = model;
    box.appendChild(el('div', { class: 'head' }, sel));

    const body = el('div', { class: 'body' });
    const input = el('input', { type: 'text', placeholder: t('msg.placeholder') });
    const go = el('button', { class: 'ibtn', style: 'color:var(--accent)' }, icon('send', 17));
    const run = async () => {
      const q = input.value.trim();
      if (!q) { toast(t('msg.empty'), 'err'); input.focus(); return; }
      input.value = '';
      body.appendChild(el('div', { class: 'bubble', html: md('**' + t('common.you') + ' :** ' + q) }));
      const out = el('div', { class: 'bubble', html: '<span class="dots muted"></span>' });
      body.appendChild(out);
      let acc = '';
      try {
        const res = await J.ORapi.chat({ key: S.key, model: box.dataset.model, messages: [{ role: 'user', content: q }], effort: S.settings.ai.effort, profile: profile() }, {
          delta: (d) => { acc += d.text; out.innerHTML = md(acc); },
          error: (d) => { out.innerHTML += '<br>' + esc(d.message); },
          done: () => {},
        });
        if (!res.ok && !res.aborted) out.innerHTML = esc(t('or.err.' + (res.reason || 'inconnu'))) + (res.error ? '<br><span class="muted tiny">' + esc(String(res.error).slice(0, 200)) + '</span>' : '');
      } catch (e) { out.innerHTML = esc(String(e.message || e)); }
      body.scrollTop = body.scrollHeight;
    };
    go.addEventListener('click', run);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && S.settings.ai.enterSend) run(); });
    box.append(body, el('div', { class: 'inputline' }, input, go));
    return box;
  }

  function renderGrid(kind) {
    const box = view();
    box.innerHTML = '';
    box.classList.add('grid-mode');
    const grid = el('div', { class: 'grid2 ' + (kind === 'multitask' ? 'mt' : 'cmp'), id: 'mt-wrap', style: 'flex:1' });
    if (kind === 'multitask') grid.append(cell(activeModel()), cell(MODELS.list[1]?.id || activeModel()), cell(MODELS.list[2]?.id || activeModel()), cell(MODELS.list[3]?.id || activeModel()));
    else grid.append(cell(MODELS.list[0]?.id || activeModel()), cell(MODELS.list[1]?.id || activeModel()));
    box.appendChild(grid);
  }

  function renderOffline() {
    const box = view();
    box.classList.remove('grid-mode');
    box.innerHTML = '';
    const bar = el('div', { class: 'panel-sec', style: 'max-width:780px;margin:0 auto' },
      el('b', { text: t('off.title') }), el('div', { class: 'tiny muted', text: t('off.desc') }),
      el('div', { class: 'row', style: 'margin-top:.5rem' },
        el('input', { type: 'text', id: 'local-url', value: window.J.LS.get('localUrl', 'http://127.0.0.1:11434') }),
        el('button', { class: 'btn sm primary', text: t('off.detect'), onclick: detectLocal })),
      el('div', { id: 'local-list', class: 'tiny muted', style: 'margin-top:.4rem' }));
    box.appendChild(bar);
  }
  async function detectLocal() {
    const url = document.getElementById('local-url').value.replace(/\/$/, '');
    window.J.LS.set('localUrl', url);
    const out = document.getElementById('local-list');
    out.textContent = t('common.loading');
    try {
      const r = await fetch(url + (url.includes('11434') ? '/api/tags' : '/v1/models'));
      const j = await r.json();
      const names = (j.models || j.data || []).map((m) => m.name || m.id);
      out.textContent = names.length ? t('off.found', { n: names.length }) + ' — ' + names.slice(0, 12).join(', ') : t('off.none');
      if (names.length) { MODELS.list = names.map((n) => ({ id: 'local/' + n, name: n, free: true, vision: true, local: true })); paintModelButton(); }
    } catch { out.textContent = t('off.none'); }
  }

  const Chat = {
    CTX, MODELS, EFFORTS, buildComposer, renderMessages, renderChips, setTab, send, toggleVoice, toggleLive,
    openRag, openSkills,
    openPlus: (kind) => (kind === 'rag' ? openRag()
      : kind === 'skill' ? openSkills()
        : openPlusMenu(document.getElementById('plus-btn') || document.getElementById('composer') || document.body)),
    stopVoice, loadModels, paidWarning, activeModel, modelInfo, contextBlock, PRESET_SKILLS, paintModelButton, hud,
    resumeFromHistory(h) {
      S.activeId = h.conv || null; setTab('classic');
      if (!S.conv.find((c) => c.id === h.conv)) {
        const c = { id: h.conv || 'c' + Date.now(), title: h.q.slice(0, 40), messages: [{ role: 'user', content: h.q }, { role: 'assistant', content: h.a }], at: Date.now() };
        S.conv.unshift(c); S.activeId = c.id; save('conv'); window.App.renderConvList();
      }
      renderMessages();
    },
    newConv() {
      const c = { id: 'c' + Date.now(), title: t('nav.new'), mode: S.mode, messages: [], at: Date.now() };
      if (!S.private) { S.conv.unshift(c); S.activeId = c.id; save('conv'); }
      else { S.privateConv = c; S.activeId = c.id; }
      setTab('classic'); renderWelcome(); window.App.renderConvList();
    },
    openConv(id) { S.activeId = id; setTab('classic'); },
  };
  window.Chat = Chat;
})();
