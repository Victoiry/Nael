/* JARVIS — chat : compositeur, effort, modèles, vocal, live, RAG, skills, onglets */
(function () {
  const { S, t, el, save, toast, modal, API, md, esc, countdownModal } = window.J;

  const PRESET_SKILLS = [
    { id: 'sk1', name: 'Traducteur', instr: 'Traduis tout ce que je te donne en conservant le ton et les nuances.', icon: '🌍' },
    { id: 'sk2', name: 'Rédacteur', instr: 'Rédige des textes clairs, structurés et convaincants.', icon: '✍️' },
    { id: 'sk3', name: 'Revue de code', instr: 'Analyse le code, trouve les bugs, propose des améliorations concrètes.', icon: '🐞' },
    { id: 'sk4', name: 'Chercheur', instr: 'Cherche, croise les sources et donne une synthèse sourcée.', icon: '🔎' },
    { id: 'sk5', name: 'Coach', instr: 'Aide-moi à progresser avec un plan d\'action étape par étape.', icon: '🎯' },
    { id: 'sk6', name: 'Data analyste', instr: 'Analyse les données, calcule, et présente les résultats en tableaux.', icon: '📊' },
    { id: 'sk7', name: 'Mathématicien', instr: 'Résous les problèmes étape par étape en justifiant chaque calcul.', icon: '➗' },
    { id: 'sk8', name: 'Résumeur', instr: 'Résume en points clés, sans perdre l\'essentiel.', icon: '📝' },
  ];
  const CTX = { ragFiles: [], ragWeb: [], ragNotes: [], files: [], skills: [] };
  const MODELS = { list: [], loaded: false };
  const V = { on: false, live: false, stream: null, interim: '', sending: false, loop: false };

  function profile() { return S.settings.profiles[S.settings.activeProfile] || {}; }
  function activeModel() { return S.settings.ai.model || S.model || MODELS.list[0]?.id || 'meta-llama/llama-3.3-70b-instruct:free'; }
  function modelInfo(id) { return MODELS.list.find((m) => m.id === id); }

  // ---------------------------------------------------------------- composer
  function buildComposer() {
    const c = document.getElementById('composer');
    c.innerHTML = '';
    const wrap = el('div', { class: 'wrap' });
    const chips = el('div', { class: 'ctx-chips', id: 'ctx-chips' });
    const box = el('div', { class: 'box glass' });

    // ---- left tools (+) ----
    const plus = el('button', { class: 'icon-btn tip', 'data-tip': t('msg.plus'), html: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>' });
    plus.addEventListener('click', (e) => { e.stopPropagation(); openPlusMenu(plus); });
    const left = el('div', { class: 'tools' }, plus);

    // ---- textarea ----
    const ta = el('textarea', { id: 'input', placeholder: t('msg.placeholder'), rows: 1 });
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 220) + 'px'; });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && S.settings.ai.enterSend) { e.preventDefault(); send(); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
    });

    // ---- right tools ----
    const right = el('div', { class: 'right' });

    // effort
    const effBtn = el('button', { class: 'btn sm tip', 'data-tip': t('effort.label'), text: '⚙ ' + t('effort.' + (S.settings.ai.effort || 'normal')) });
    effBtn.addEventListener('click', (e) => { e.stopPropagation(); openEffortMenu(effBtn); });
    const effortWrap = el('div', { class: 'tip', style: 'display:inline-block' }, effBtn);

    // models
    const modelBtn = el('button', { class: 'btn sm tip', 'data-tip': t('model.selected'), text: shortModel(activeModel()) });
    modelBtn.addEventListener('click', (e) => { e.stopPropagation(); openModelMenu(modelBtn); });

    // voice
    const voiceBtn = el('button', { class: 'icon-btn tip', id: 'voice-btn', 'data-tip': t('msg.voice'), html: '<svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z"/><path d="M19 11a7 7 0 0 1-14 0"/><path d="M12 18v3"/></svg>' });
    voiceBtn.addEventListener('click', () => toggleVoice());

    // live
    const liveBtn = el('button', { class: 'icon-btn tip', id: 'live-btn', 'data-tip': t('msg.live') + ' — ' + t('msg.live.hint'), html: '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="13" height="12" rx="2"/><path d="M15 10l7-4v12l-7-4"/></svg>' });
    liveBtn.addEventListener('click', () => toggleLive());

    // send / stop
    const sendBtn = el('button', { class: 'icon-btn tip', id: 'send-btn', 'data-tip': t('msg.send'), html: '<svg viewBox="0 0 24 24"><path d="M4 12l16-8-6 8 6 8z"/></svg>' });
    sendBtn.addEventListener('click', () => { if (S.abort) { API.stop(); } else send(); });

    right.append(effortWrap, modelBtn, voiceBtn, liveBtn, sendBtn);
    box.append(left, ta, right);

    // ---- bottom quick bar ----
    const quick = el('div', { class: 'quickbar' });
    const qb = (label, icon, fn, cls = '') => { const b = el('button', { class: 'btn sm ' + cls, html: icon + ' ' + esc(label) }); b.addEventListener('click', fn); return b; };
    quick.append(
      qb(t('img.title'), '🖼️', () => window.Media.open('image')),
      qb(t('vid.title'), '🎬', () => window.Media.open('video')),
      qb(t('tab.multitask'), '🧩', () => setTab('multitask')),
      qb(t('tab.compare'), '⚖️', () => setTab('compare')),
      qb(t('tab.code'), '⌨️', () => setTab('code')),
      qb(t('tab.private'), '🕵️', () => setTab('private'), 'priv'),
      qb(t('tab.offline'), '📴', () => setTab('offline')),
    );
    const hint = el('div', { class: 'composer-hint', text: (S.settings.ai.enterSend ? 'Enter ↵' : 'Ctrl+Enter ↵') + ' · ' + t('effort.label') + ': ' + t('effort.' + S.settings.ai.effort) });

    wrap.append(chips, box, quick, hint);
    c.appendChild(wrap);
    Chat.ta = ta;
    renderChips();
  }

  function shortModel(id) { const m = modelInfo(id); const n = m ? m.name : id; return (m && !m.free ? '💳 ' : '🆓 ') + (n.length > 26 ? n.slice(0, 24) + '…' : n); }

  function renderChips() {
    const box = document.getElementById('ctx-chips');
    if (!box) return;
    box.innerHTML = '';
    const add = (label, onX, cls = '') => {
      const c = el('span', { class: 'chip ' + cls }, el('span', { text: label }));
      const x = el('button', { class: 'btn sm', style: 'padding:0 .3rem;border:0;background:none', text: '✕' });
      x.addEventListener('click', () => { onX(); renderChips(); });
      c.appendChild(x); box.appendChild(c);
    };
    CTX.ragFiles.forEach((f, i) => add('📄 ' + f.name, () => CTX.ragFiles.splice(i, 1)));
    CTX.ragWeb.forEach((w, i) => add('🌐 ' + w.url.slice(0, 28), () => CTX.ragWeb.splice(i, 1)));
    CTX.ragNotes.forEach((n, i) => add('📝 ' + n.slice(0, 24), () => CTX.ragNotes.splice(i, 1)));
    CTX.files.forEach((f, i) => add('📎 ' + f.name, () => CTX.files.splice(i, 1)));
    CTX.skills.forEach((s, i) => add('⚡ ' + s.name, () => CTX.skills.splice(i, 1), 'free'));
    if (S.private) add('🕵️ ' + t('priv.title'), () => setTab('classic'), 'danger');
  }

  // ---------------------------------------------------------------- menus
  function menuAt(anchor, items) {
    document.querySelectorAll('.popmenu').forEach((m) => m.remove());
    const m = el('div', { class: 'popmenu glass', style: 'position:fixed;z-index:50;padding:.4rem;min-width:240px;max-height:70vh;overflow:auto' });
    items.forEach((it) => {
      if (it.hr) { m.appendChild(el('div', { style: 'height:1px;background:var(--border);margin:.35rem 0' })); return; }
      const row = el('div', { class: 'model-row', style: 'border:0;border-radius:10px' });
      if (it.radio !== undefined) row.appendChild(el('span', { class: 'radio' + (it.active ? '' : ''), style: it.active ? 'border-color:var(--accent);background:var(--accent)' : '' }));
      row.appendChild(el('div', { class: 'nm' },
        el('b', { html: it.html || esc(it.label) }),
        it.sub ? el('small', { html: it.sub }) : null,
        it.warn ? el('small', { class: 'bold-red', text: '⚠ ' + it.warn }) : null));
      if (it.tag) row.appendChild(el('span', { class: 'chip ' + (it.tagClass || ''), text: it.tag }));
      row.addEventListener('click', () => { m.remove(); it.onClick && it.onClick(); });
      m.appendChild(row);
    });
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    const top = Math.min(r.bottom + 6, innerHeight - m.offsetHeight - 10);
    m.style.top = Math.max(8, top) + 'px';
    m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 10)) + 'px';
    setTimeout(() => {
      const closer = (ev) => { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('click', closer); } };
      document.addEventListener('click', closer);
    }, 0);
  }

  const EFFORTS = ['ultra_saver', 'mini', 'normal', 'high', 'very_high', 'max', 'ultra'];
  const WARN = ['high', 'very_high', 'max', 'ultra'];
  function openEffortMenu(anchor) {
    const items = EFFORTS.map((k) => ({
      label: t('effort.' + k), active: S.settings.ai.effort === k,
      sub: t('effort.note.' + (k === 'ultra_saver' ? 'ultra_saver' : k === 'mini' ? 'mini' : k === 'normal' ? 'normal' : 'normal')),
      warn: WARN.includes(k) ? t('effort.more') : (k === 'ultra_saver' || k === 'mini' ? t('effort.less') : ''),
      tag: k === 'ultra_saver' ? '🐢💾' : WARN.includes(k) ? '🔥' : '',
      onClick: () => {
        if (WARN.includes(k) && (S.settings.ai.effort !== k)) {
          modal({ title: t('effort.warn.title'), sub: t('effort.warn.body', { level: t('effort.' + k) }),
            body: el('div', { class: 'notice warn', text: t('effort.more') }),
            foot: [el('button', { class: 'btn', text: t('common.cancel'), onclick: () => document.querySelector('.overlay').remove() }),
              el('button', { class: 'btn primary', text: t('common.ok'), onclick: () => { document.querySelector('.overlay').remove(); applyEffort(k); } })] });
        } else applyEffort(k);
      },
    }));
    menuAt(anchor, items);
  }
  function applyEffort(k) { S.settings.ai.effort = k; save('settings'); buildComposer(); }

  async function loadModels(force) {
    if (MODELS.loaded && !force) return MODELS.list;
    const r = await API.call('/api/models' + (S.key ? '?key=' + encodeURIComponent(S.key) : ''));
    MODELS.list = r.models || [];
    MODELS.loaded = true;
    return MODELS.list;
  }

  async function openModelMenu(anchor) {
    if (!MODELS.loaded) { toast(t('common.loading')); await loadModels(); }
    const items = await Promise.all(MODELS.list.slice(0, 80).map(async (m) => ({
      label: m.name, sub: m.id + ' · ' + (m.context ? (m.context / 1000).toFixed(0) + 'k ctx' : '') + (m.vision ? ' · 👁' : ''),
      tag: m.free ? 'FREE' : 'PAID', tagClass: m.free ? 'free' : 'paid', active: m.id === activeModel(),
      onClick: async () => {
        if (!m.free) { await paidWarning(m.id); }
        S.settings.ai.model = m.id; S.model = m.id; save('settings'); save('model');
        if (S.auth && !S.auth.guest) API.call('/api/auth/provision', { method: 'POST', body: { key: S.key, model: m.id } });
        buildComposer(); toast(t('model.selected') + ' : ' + m.id, 'ok');
      },
    })));
    items.unshift({ label: '⚙ ' + t('model.title'), sub: t('model.docs'), onClick: () => window.App.openModelTest() });
    items.splice(1, 0, { hr: true });
    menuAt(anchor, items);
  }

  function paidWarning(model) {
    return new Promise((resolve) => {
      countdownModal({
        title: t('paid.title'), body: t('paid.body', { model }), seconds: 5,
        foot: [
          () => el('button', { class: 'btn', text: t('paid.chooseFree'), onclick: () => { m.close(); resolve(false); } }),
          () => el('button', { class: 'btn', text: t('common.cancel'), onclick: () => { m.close(); resolve(false); } }),
          () => el('button', { class: 'btn primary', text: t('common.ok'), onclick: () => { m.close(); resolve(true); } }),
        ],
      });
    });
  }

  // ---------------------------------------------------------------- plus menu
  function openPlusMenu(anchor) {
    menuAt(anchor, [
      { label: '📚 ' + t('rag.title'), sub: t('rag.desc'), onClick: () => openRag() },
      { label: '📎 ' + t('file.title'), sub: t('file.desc'), onClick: () => pickFiles(false) },
      { label: '⚡ ' + t('skill.title'), sub: t('skill.pre'), onClick: () => openSkills() },
      { hr: true },
      { label: '🧩 ' + t('tab.multitask'), onClick: () => setTab('multitask') },
      { label: '⚖️ ' + t('tab.compare'), onClick: () => setTab('compare') },
      { label: '🗂️ ' + t('nav.history'), onClick: () => window.App.showPanel('history') },
      { label: '🧠 ' + t('nav.memory'), onClick: () => window.App.showPanel('memory') },
    ]);
  }

  function openRag() {
    const body = el('div', { class: 'col' });
    const mk = (titleKey, arr, render, inputNode) => {
      const box = el('div', { class: 'panel-sec' });
      box.appendChild(el('h4', { text: t(titleKey) + ' (' + arr.length + '/5)' }));
      const list = el('div', {});
      arr.forEach((x, i) => list.appendChild(el('div', { class: 'switch-row' },
        el('div', { class: 'tiny', text: typeof x === 'string' ? x : (x.name || x.url) }),
        el('button', { class: 'btn sm', text: '✕', onclick: () => { arr.splice(i, 1); m.close(); openRag(); } }))));
      box.append(list, inputNode);
      return box;
    };
    const fileInput = el('input', { type: 'file', multiple: true, accept: '.txt,.md,.json,.csv,.js,.ts,.py,.html,.css,.pdf,.docx' });
    fileInput.addEventListener('change', async () => {
      for (const f of fileInput.files) {
        if (CTX.ragFiles.length >= 5) return toast(t('rag.limited'), 'err');
        CTX.ragFiles.push({ name: f.name, text: (await f.text()).slice(0, 120000) });
      }
      toast(t('toast.saved'), 'ok'); m.close(); openRag();
    });
    const urlIn = el('input', { type: 'url', placeholder: t('rag.addurl') });
    urlIn.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      if (CTX.ragWeb.length >= 5) return toast(t('rag.limited'), 'err');
      const u = urlIn.value.trim(); if (!u) return;
      CTX.ragWeb.push({ url: u, text: '' }); m.close(); openRag(); toast(t('common.loading'));
      try { const r = await fetch('https://r.jina.ai/' + u); const tx = await r.text(); CTX.ragWeb[CTX.ragWeb.length - 1].text = tx.slice(0, 60000); toast(t('toast.saved'), 'ok'); renderChips(); }
      catch { try { const r2 = await fetch(u); CTX.ragWeb[CTX.ragWeb.length - 1].text = (await r2.text()).slice(0, 60000); } catch { toast(t('toast.error'), 'err'); } }
    });
    const noteIn = el('input', { type: 'text', placeholder: t('rag.addnote') });
    noteIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && noteIn.value.trim()) { if (CTX.ragNotes.length >= 5) return toast(t('rag.limited'), 'err'); CTX.ragNotes.push(noteIn.value.trim()); m.close(); openRag(); renderChips(); } });

    body.append(
      mk('rag.files', CTX.ragFiles, null, fileInput),
      mk('rag.web', CTX.ragWeb, null, urlIn),
      mk('rag.notes', CTX.ragNotes, null, noteIn));
    const m = modal({ title: t('rag.title'), sub: t('rag.desc'), body, vert: false, onClose: renderChips });
  }

  function pickFiles(simple) {
    const input = el('input', { type: 'file', multiple: true });
    input.addEventListener('change', async () => {
      for (const f of input.files) {
        if (CTX.files.length >= 3) { toast(t('file.limited'), 'err'); break; }
        const isImg = /^image\//.test(f.type);
        if (isImg) {
          const dataUrl = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(f); });
          CTX.files.push({ name: f.name, image: dataUrl });
        } else {
          CTX.files.push({ name: f.name, text: (await f.text()).slice(0, 120000) });
        }
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
        el('div', {}, el('div', { class: 'tiny', text: (s.icon || '⚡') + ' ' + s.name }), el('div', { class: 'tiny muted', text: s.instr.slice(0, 60) })),
        el('div', { class: 'row' },
          el('button', { class: 'btn sm', text: t('common.add'), onclick: () => { addSkillChip(s); m.close(); } }),
          el('button', { class: 'btn sm danger', text: '✕', onclick: () => { S.skills.splice(i, 1); save('skills'); drawMine(); } })))));
    };
    drawMine();
    const pre = el('div', { class: 'panel-sec' }, el('h4', { text: t('skill.pre') }));
    PRESET_SKILLS.forEach((s) => pre.appendChild(el('div', { class: 'switch-row' },
      el('div', {}, el('div', { class: 'tiny', text: s.icon + ' ' + s.name }), el('div', { class: 'tiny muted', text: s.instr.slice(0, 58) })),
      el('button', { class: 'btn sm', text: t('common.add'), onclick: () => { addSkillChip(s); m.close(); } }))));

    const name = el('input', { type: 'text', placeholder: t('skill.namet') });
    const instr = el('textarea', { placeholder: t('skill.instrt') });
    const create = el('div', { class: 'panel-sec' }, el('h4', { text: t('skill.create') }), name, instr,
      el('button', { class: 'btn sm primary', text: t('skill.add'), onclick: () => {
        if (!name.value.trim()) return;
        S.skills.unshift({ id: 'sk' + Date.now(), name: name.value.trim(), instr: instr.value, icon: '⚡' });
        save('skills'); name.value = ''; instr.value = ''; drawMine(); toast(t('toast.saved'), 'ok');
      } }));
    function addSkillChip(s) { if (!CTX.skills.find((x) => x.name === s.name)) CTX.skills.push(s); renderChips(); }
    const m = modal({ title: t('skill.title'), body, vert: true });
    body.append(mine, pre, create);
  }

  // ---------------------------------------------------------------- context build
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
      c = { id: 'c' + Date.now(), title: t('nav.new'), mode: S.mode, messages: [], at: Date.now(), private: S.private };
      if (!S.private) { S.conv.unshift(c); S.activeId = c.id; save('conv'); }
      else S.privateConv = c;
    }
    return c;
  }

  // ---------------------------------------------------------------- render messages
  function view() { return document.getElementById('chat-scroll'); }
  function renderMessages() {
    const box = view(); if (!box) return;
    const conv = currentConv();
    box.innerHTML = '';
    if (!conv.messages.length) {
      box.appendChild(el('div', { class: 'center', style: 'padding:clamp(6px, 5vh, 56px) 0 8px;opacity:.95' },
        el('div', { style: 'font-size:3rem', text: profile().avatar || '🤖' }),
        el('h2', { text: t('land.hero') }),
        el('p', { class: 'muted', text: profile().aiName ? profile().aiName + ' — ' + t('land.sub') : t('land.sub') })));
      return;
    }
    conv.messages.forEach((m) => box.appendChild(node(m)));
    if (S.settings.ai.autoScroll) box.scrollTop = box.scrollHeight;
  }

  function node(m) {
    const wrap = el('div', { class: 'msg ' + (m.role === 'user' ? 'user' : 'ai') });
    const av = el('div', { class: 'av', text: m.role === 'user' ? '🧑' : (profile().avatar || '🤖') });
    const bubble = el('div', { class: 'bubble' });
    if (m.reasoning) bubble.appendChild(el('div', { class: 'reason', text: m.reasoning }));
    const content = Array.isArray(m.content) ? m.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n') : m.content;
    bubble.appendChild(el('div', { class: 'md', html: md(content) }));
    if (Array.isArray(m.content)) m.content.filter((c) => c.type === 'image_url').forEach((c) => bubble.appendChild(el('img', { src: c.image_url.url, class: 'screen-shot' })));
    if (m.tools?.length) m.tools.forEach((tl) => bubble.appendChild(el('div', { class: 'tool-line', text: '⌘ ' + tl })));
    if (m.image) bubble.appendChild(el('img', { src: m.image, class: 'screen-shot' }));
    const acts = el('div', { class: 'row', style: 'margin-top:.4rem' });
    acts.appendChild(el('button', { class: 'btn sm ghost', text: '⧉', onclick: () => window.J.copy(content || '') }));
    if (m.role !== 'user') acts.appendChild(el('button', { class: 'btn sm ghost', text: '🔊', onclick: () => window.J.speak(content || '') }));
    if (m.role === 'user') acts.appendChild(el('button', { class: 'btn sm ghost', text: '✎', onclick: () => { if (Chat.ta) { Chat.ta.value = content; Chat.ta.focus(); } } }));
    if (window.App && S.mode === 'agent') acts.appendChild(el('button', { class: 'btn sm ghost', text: '▶ ' + t('code.run'), onclick: () => runOnPC(content) }));
    bubble.appendChild(acts);
    wrap.append(av, bubble);
    return wrap;
  }

  async function runOnPC(text) {
    const cmd = prompt(t('code.run'), (text.match(/`([^`]+)`/) || [])[1] || '');
    if (!cmd) return;
    const r = await API.call('/api/bridge/command', { method: 'POST', body: { command: cmd, sessionId: S.bridge.sessionId } });
    toast(t('approval.request') + ' — ' + (r.risk || ''), 'ok');
  }

  // ---------------------------------------------------------------- send
  async function send(textOverride, opts = {}) {
    const ta = Chat.ta || document.getElementById('input');
    const text = (textOverride !== undefined ? textOverride : ta?.value || '').trim();
    if (!text && !CTX.files.some((f) => f.image)) return;
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
    if (opts.append !== false) { renderMessages(); }
    else { const b = view(); b.appendChild(node(userMsg)); }

    const model = opts.model || activeModel();
    const info = modelInfo(model);
    const aiMsg = { role: 'assistant', content: '', reasoning: '', tools: [] };
    conv.messages.push(aiMsg);
    const aiNode = node(aiMsg);
    view().appendChild(aiNode);
    const bubble = aiNode.querySelector('.bubble');
    const live = el('div', { class: 'md' }); bubble.insertBefore(live, bubble.firstChild);
    const think = el('div', { class: 'tiny muted dots', text: t('common.thinking') });
    bubble.insertBefore(think, live);
    V.sending = true;
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) sendBtn.classList.add('rec');

    const messages = conv.messages.filter((m) => m !== aiMsg).map((m) => ({ role: m.role, content: m.content }));
    try {
      await API.stream('/api/chat', {
        key: S.key, model,
        messages: S.private ? messages.slice(-4) : messages,
        effort: S.settings.ai.effort, mode: S.mode,
        profile: profile(), sessionId: S.bridge.sessionId,
        visionWarning: S.settings.ai.visionWarn && info && !info.vision,
        temperature: S.settings.ai.temperature,
      }, {
        delta: (d) => { aiMsg.content += d.text; live.innerHTML = md(aiMsg.content); if (S.settings.ai.autoScroll) view().scrollTop = view().scrollHeight; },
        reasoning: (d) => { aiMsg.reasoning += d.text; let r = bubble.querySelector('.reason'); if (!r) { r = el('div', { class: 'reason' }); bubble.insertBefore(r, bubble.firstChild); } r.textContent = aiMsg.reasoning; },
        tool: (d) => {
          if (d.phase === 'start') { aiMsg.tools.push((d.name || '') + ' ' + (d.args?.command || d.args?.path || d.args?.query || '')); bubble.appendChild(el('div', { class: 'tool-line dots', text: '⌘ ' + d.name + ' ' + (d.args?.command || d.args?.path || d.args?.query || '') })); }
          else { const lines = bubble.querySelectorAll('.tool-line'); const last = lines[lines.length - 1]; if (last) { last.classList.remove('dots'); last.textContent = '⌘ ' + d.name + ' → ' + String(d.result || '').slice(0, 160); } }
        },
        screen: (d) => { if (d.image) { aiMsg.image = d.image; bubble.appendChild(el('img', { src: d.image, class: 'screen-shot' })); } },
        approval: (d) => window.App.showApproval(d),
        usage: () => {},
        error: (d) => { aiMsg.content += '\n\n⚠ ' + d.message; live.innerHTML = md(aiMsg.content); },
        done: () => {},
      });
    } catch (e) {
      if (String(e.name) !== 'AbortError') { aiMsg.content += '\n\n⚠ ' + String(e.message || e); live.innerHTML = md(aiMsg.content); }
    }
    think.remove();
    V.sending = false;
    sendBtn?.classList.remove('rec');
    if (!S.private) {
      if (S.settings.ai.useHistory) { S.hist.unshift({ q: text, a: aiMsg.content.slice(0, 400), at: Date.now(), conv: conv.id }); save('hist'); }
    }
    if (S.settings.ai.ttsAuto && !opts.noSpeak) window.J.speak(aiMsg.content);
    conv.at = Date.now();
    save('conv');
    if (V.loop && V.on) listenOnce();
    return aiMsg.content;
  }

  // ---------------------------------------------------------------- voice / live
  function hud(show, text) {
    const h = document.getElementById('voice-hud');
    h.classList.toggle('on', show);
    if (text !== undefined) document.getElementById('hud-text').textContent = text;
    const wave = document.getElementById('wave');
    if (show && !wave.children.length) for (let i = 0; i < 14; i++) wave.appendChild(el('i', { style: `animation-delay:${i * 0.07}s;height:${10 + Math.random() * 40}px` }));
  }
  function toggleVoice() {
    V.on = !V.on;
    V.loop = V.on;
    document.getElementById('voice-btn')?.classList.toggle('rec', V.on);
    if (V.on) { hud(true, t('msg.voice.on')); listenOnce(); } else { stopVoice(); }
  }
  function stopVoice() {
    V.on = false; V.loop = false;
    try { V.rec?.stop(); } catch {}
    window.J.stopSpeak(); hud(false);
    document.getElementById('voice-btn')?.classList.remove('rec');
  }
  function listenOnce() {
    if (!V.on) return;
    const rec = window.J.createSTT((full, finalTxt) => {
      hud(true, full);
      if (Chat.ta) Chat.ta.value = full;
      if (finalTxt && finalTxt.trim().length > 1 && /\b(fini|envoyer|send)\b/i.test(finalTxt) === false) { /* keep listening */ }
    }, async (finalTxt) => {
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
        hud(true, t('msg.live'));
        V.on = true; V.loop = true;
        liveLoop();
      } catch (e) { toast(t('live.nocam'), 'err'); V.live = false; }
    } else {
      V.stream?.getTracks().forEach((t) => t.stop());
      video.classList.add('hidden'); video.srcObject = null;
      stopVoice();
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
    const c = document.createElement('canvas'); c.width = 640; c.height = Math.round(640 * v.videoHeight / v.videoWidth);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  }

  // ---------------------------------------------------------------- tabs
  function setTab(tab) {
    const wasPrivate = S.private;
    S.tab = tab;
    document.querySelectorAll('#chat-tabs .tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    S.private = tab === 'private';
    if (wasPrivate && !S.private) S.activeId = S.conv[0]?.id || null;
    renderChips();
    window.Media.close();
    const host = view();
    document.getElementById('view-chat').classList.remove('hidden');
    document.getElementById('studio').classList.add('hidden');
    document.getElementById('composer').classList.toggle('hidden', tab === 'multitask' || tab === 'compare');
    if (tab === 'multitask') { loadModels().then(() => renderMultitask(host)); return; }
    if (tab === 'compare') { loadModels().then(() => renderCompare(host)); return; }
    renderMessages();
    if (tab === 'offline') return renderOfflineBar();
    if (tab === 'private') { toast(t('priv.on')); }
  }

  function renderOfflineBar() {
    const box = view();
    const bar = el('div', { class: 'panel-sec', style: 'margin:0 auto 1rem;max-width:900px' },
      el('b', { text: t('off.title') }), el('div', { class: 'tiny muted', text: t('off.desc') }),
      el('div', { class: 'row', style: 'margin-top:.5rem' },
        el('input', { type: 'text', id: 'local-url', value: window.J.LS.get('localUrl', 'http://127.0.0.1:11434') }),
        el('button', { class: 'btn sm primary', text: t('off.detect'), onclick: detectLocal })),
      el('div', { id: 'local-list', class: 'tiny muted', style: 'margin-top:.4rem' }));
    box.prepend(bar);
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
      out.innerHTML = names.length ? t('off.found', { n: names.length }) + ' — ' + names.slice(0, 12).join(', ') : t('off.none');
      if (names.length) { MODELS.list = names.map((n) => ({ id: 'local/' + n, name: n, free: true, vision: true, local: true, url })); MODELS.loaded = true; }
    } catch { out.textContent = t('off.none'); }
  }

  function cell(model, idx) {
    const box = el('div', { class: 'cell' });
    const head = el('div', { class: 'head' });
    const sel = el('select');
    MODELS.list.slice(0, 60).forEach((m) => sel.appendChild(el('option', { value: m.id, text: (m.free ? '🆓 ' : '💳 ') + m.name, selected: m.id === model })));
    sel.addEventListener('change', () => { box.dataset.model = sel.value; if (sel.value && !modelInfo(sel.value)?.free) paidWarning(sel.value); });
    head.append(sel, el('span', { class: 'spacer' }));
    const body = el('div', { class: 'body' });
    const inp = el('div', { class: 'row', style: 'margin-top:.4rem' },
      el('input', { type: 'text', placeholder: t('msg.placeholder') }),
      el('button', { class: 'btn sm primary', text: '➤' }));
    box.dataset.model = model;
    (async () => {
      const input = inp.querySelector('input');
      inp.querySelector('button').addEventListener('click', async () => {
        const q = input.value.trim(); if (!q) return; input.value = '';
        body.appendChild(el('div', { class: 'bubble', html: md('**' + t('common.you') + ' :** ' + q) }));
        const out = el('div', { class: 'bubble', html: '<span class="dots muted"></span>' }); body.appendChild(out);
        let acc = '';
        await API.stream('/api/chat', { key: S.key, model: box.dataset.model, messages: [{ role: 'user', content: q }], effort: S.settings.ai.effort, profile: profile() }, {
          delta: (d) => { acc += d.text; out.innerHTML = md(acc); }, error: (d) => { out.innerHTML += '<br>⚠ ' + esc(d.message); }, done: () => {},
        });
        body.scrollTop = body.scrollHeight;
      });
    })();
    box.append(head, body, inp);
    return box;
  }
  function renderMultitask(box) {
    box.innerHTML = '';
    const grid = el('div', { id: 'mt-wrap', style: 'grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr' });
    grid.append(cell(activeModel(), 0), cell(MODELS.list[1]?.id || activeModel(), 1), cell(MODELS.list[2]?.id || activeModel(), 2), cell(MODELS.list[3]?.id || activeModel(), 3));
    box.appendChild(el('div', { class: 'tiny muted center', text: t('mt.title') }));
    box.appendChild(grid);
  }
  function renderCompare(box) {
    box.innerHTML = '';
    const m1 = MODELS.list[0]?.id || activeModel();
    const m2 = MODELS.list[1]?.id || m1;
    const wrap = el('div', { id: 'mt-wrap', style: 'grid-template-columns:1fr 1fr;grid-template-rows:1fr' });
    wrap.append(cell(m1, 0), cell(m2, 1));
    box.appendChild(el('div', { class: 'tiny muted center', text: t('cmp.title') }));
    box.appendChild(wrap);
  }

  // ---------------------------------------------------------------- exports
  const Chat = {
    CTX, MODELS, buildComposer, renderMessages, renderChips, setTab, send, toggleVoice, toggleLive,
    stopVoice, loadModels, paidWarning, activeModel, modelInfo, contextBlock, PRESET_SKILLS,
    resumeFromHistory(h) { S.activeId = h.conv || null; setTab('classic'); if (!S.conv.find((c) => c.id === h.conv)) { const c = { id: h.conv || 'c' + Date.now(), title: h.q.slice(0, 40), messages: [{ role: 'user', content: h.q }, { role: 'assistant', content: h.a }], at: Date.now() }; S.conv.unshift(c); S.activeId = c.id; save('conv'); window.App.renderConvList(); } renderMessages(); },
    newConv() { const c = { id: 'c' + Date.now(), title: t('nav.new'), mode: S.mode, messages: [], at: Date.now() }; if (!S.private) { S.conv.unshift(c); S.activeId = c.id; save('conv'); } else { S.privateConv = c; S.activeId = c.id; } renderMessages(); window.App.renderConvList(); },
    openConv(id) { S.activeId = id; renderMessages(); },
    hud,
  };
  window.Chat = Chat;
})();
