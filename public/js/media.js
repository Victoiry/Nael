/* JARVIS — studios image & vidéo (génération, réglages pro, interactif) */
(function () {
  const { S, t, el, toast, modal, API, esc } = window.J;
  const QUAL = ['saver', 'low', 'normal', 'high', 'maximum', 'ultra'];
  const ASPECTS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '21:9'];
  const STYLES = ['photo réaliste', 'cinématique', 'anime', '3D render', 'aquarelle', 'cyberpunk', 'minimaliste', 'huile'];

  const M = {
    kind: 'image',
    params: {
      prompt: '', negative: '', style: 'photo réaliste', quality: 'normal', aspect: '1:1', pixels: 1024,
      colors: ['#22d3ee', '#a855f7', '#0b1220'], seed: '', guidance: 7, lighting: 'naturelle', lens: '50mm',
      mood: 'neutre', duration: 6, fps: 24, motion: 'léger', pro: false, model: '', count: 1,
    },
    result: null, gallery: window.J.LS.get('gallery', []),
  };

  function studioHost() { return document.getElementById('studio'); }

  function open(kind) {
    M.kind = kind || 'image';
    document.getElementById('view-chat').classList.add('hidden');
    const host = studioHost();
    host.classList.remove('hidden');
    render(host);
  }
  function close() {
    const host = studioHost();
    if (host) { host.classList.add('hidden'); host.innerHTML = ''; }
    document.getElementById('view-chat')?.classList.remove('hidden');
  }

  function sliderRow(labelKey, key, min, max, step, suffix = '') {
    const v = M.params[key];
    const out = el('span', { class: 'chip tiny', text: v + suffix });
    const r = el('input', { type: 'range', min, max, step, value: v });
    r.addEventListener('input', () => { M.params[key] = Number(r.value); out.textContent = r.value + suffix; if (key === 'pixels') mirrorPixels(); });
    return el('div', {}, el('div', { class: 'row' }, el('span', { class: 'tiny muted', text: t(labelKey) }), el('span', { class: 'spacer' }), out), r);
  }
  function mirrorPixels() {
    const el2 = document.getElementById('px-out'); if (el2) el2.textContent = M.params.pixels + ' px (max 3072)';
  }

  function colorRow() {
    const box = el('div', { class: 'row wrap' });
    M.params.colors.forEach((c, i) => {
      const inp = el('input', { type: 'color', value: c, style: 'width:52px' });
      inp.addEventListener('input', () => { M.params.colors[i] = inp.value; });
      box.appendChild(inp);
    });
    box.appendChild(el('button', { class: 'btn sm', text: '+', onclick: () => { M.params.colors.push('#ffffff'); render(studioHost()); } }));
    if (M.params.colors.length > 1) box.appendChild(el('button', { class: 'btn sm', text: '−', onclick: () => { M.params.colors.pop(); render(studioHost()); } }));
    return box;
  }

  function render(host) {
    host.innerHTML = '';
    const isImg = M.kind === 'image';
    const wrap = el('div', { class: 'studio-grid' });

    // ---------------- controls
    const ctrl = el('div', { class: 'col' });
    ctrl.appendChild(el('div', { class: 'row' },
      el('button', { class: 'btn sm ' + (isImg ? 'primary' : ''), text: '🖼️ ' + t('tab.image'), onclick: () => open('image') }),
      el('button', { class: 'btn sm ' + (!isImg ? 'primary' : ''), text: '🎬 ' + t('tab.video'), onclick: () => open('video') }),
      el('span', { class: 'spacer' }),
      el('button', { class: 'btn sm', text: '✕ ' + t('common.close'), onclick: close })));

    ctrl.appendChild(el('div', { class: 'panel-sec' },
      el('h4', { text: isImg ? t('img.title') : t('vid.title') }),
      (() => { const ta = el('textarea', { placeholder: t('img.prompt'), rows: 3 }); ta.value = M.params.prompt; ta.addEventListener('input', () => M.params.prompt = ta.value); return ta; })(),
      el('div', { class: 'tiny muted', text: isImg ? t('img.interactive') : t('vid.desc') })));

    // quality + model
    const qSel = el('select');
    QUAL.forEach((q) => qSel.appendChild(el('option', { value: q, text: t('qual.' + q), selected: M.params.quality === q })));
    qSel.addEventListener('change', () => M.params.quality = qSel.value);
    const mSel = el('select');
    (window.Chat.MODELS.list.length ? window.Chat.MODELS.list : []).slice(0, 60).forEach((m) => mSel.appendChild(el('option', { value: m.id, text: (m.free ? '🆓 ' : '💳 ') + m.name, selected: (M.params.model || window.Chat.activeModel()) === m.id })));
    mSel.addEventListener('change', () => M.params.model = mSel.value);
    if (!mSel.children.length) mSel.appendChild(el('option', { value: window.Chat.activeModel(), text: window.Chat.activeModel() }));

    ctrl.appendChild(el('div', { class: 'panel-sec' },
      el('h4', { text: t('img.quality') }),
      el('div', { class: 'field' }, el('span', { text: t('img.quality') }), qSel),
      el('div', { class: 'field' }, el('span', { text: t('model.selected') }), mSel),
      el('div', { class: 'field' }, el('span', { text: t('img.style') }),
        (() => { const s = el('select'); STYLES.forEach((x) => s.appendChild(el('option', { value: x, text: x, selected: M.params.style === x }))); s.addEventListener('change', () => M.params.style = s.value); return s; })()),
      el('div', { class: 'field' }, el('span', { text: t('img.aspect') }),
        (() => { const s = el('select'); ASPECTS.forEach((x) => s.appendChild(el('option', { value: x, text: x, selected: M.params.aspect === x }))); s.addEventListener('change', () => M.params.aspect = s.value); return s; })())));

    ctrl.appendChild(el('div', { class: 'panel-sec' },
      el('h4', { text: t('img.resolution') }),
      el('div', { id: 'px-out', class: 'chip tiny', text: M.params.pixels + ' px (max 3072)' }),
      sliderRow('img.pixels', 'pixels', 256, 3072, 64, ' px'),
      el('div', { class: 'field' }, el('span', { text: t('img.colors') }), colorRow()),
      isImg ? null : sliderRow('vid.duration', 'duration', 2, 30, 1, ' s'),
      isImg ? null : sliderRow('vid.fps', 'fps', 12, 60, 1, ' fps'),
      isImg ? null : sliderRow('vid.motion', 'motion', 0, 10, 1)));

    // pro mode
    const adv = el('div', { class: 'adv' + (M.params.pro ? ' on' : '') });
    const neg = el('textarea', { placeholder: t('img.negative'), rows: 2 }); neg.value = M.params.negative; neg.addEventListener('input', () => M.params.negative = neg.value);
    const seed = el('input', { type: 'text', placeholder: t('img.seed') }); seed.value = M.params.seed; seed.addEventListener('input', () => M.params.seed = seed.value);
    adv.append(
      el('div', { class: 'field' }, el('span', { text: t('img.negative') }), neg),
      el('div', { class: 'field' }, el('span', { text: t('img.seed') }), seed),
      sliderRow('img.guidance', 'guidance', 1, 20, 0.5),
      el('div', { class: 'field' }, el('span', { text: t('img.lighting') }), (() => { const s = el('select'); ['naturelle', 'studio', 'contre-jour', 'néon', 'coucher de soleil', 'nocturne'].forEach((x) => s.appendChild(el('option', { value: x, text: x, selected: M.params.lighting === x }))); s.addEventListener('change', () => M.params.lighting = s.value); return s; })()),
      el('div', { class: 'field' }, el('span', { text: t('img.lens') }), (() => { const s = el('select'); ['14mm', '35mm', '50mm', '85mm', '135mm', 'macro'].forEach((x) => s.appendChild(el('option', { value: x, text: x, selected: M.params.lens === x }))); s.addEventListener('change', () => M.params.lens = s.value); return s; })()),
      el('div', { class: 'field' }, el('span', { text: t('img.mood') }), (() => { const s = el('select'); ['neutre', 'joyeuse', 'sombre', 'épique', 'calme', 'énergique'].forEach((x) => s.appendChild(el('option', { value: x, text: x, selected: M.params.mood === x }))); s.addEventListener('change', () => M.params.mood = s.value); return s; })()));
    const proToggle = el('div', { class: 'switch-row' }, el('div', { text: t('img.pro') }), el('div', { class: 'switch' + (M.params.pro ? ' on' : '') }));
    proToggle.addEventListener('click', () => { M.params.pro = !M.params.pro; render(host); });
    ctrl.appendChild(el('div', { class: 'panel-sec' }, proToggle, adv));

    ctrl.appendChild(el('div', { class: 'row' },
      el('button', { class: 'btn primary', text: '✨ ' + (isImg ? t('img.generate') : t('vid.generate')), onclick: () => generate(host) }),
      el('button', { class: 'btn', text: '🎲 ' + t('img.variations'), onclick: () => variations(host) })));
    ctrl.appendChild(el('div', { class: 'tiny muted', text: 'Nael Hamouche — ' + t('nav.creator') }));

    // ---------------- canvas
    const right = el('div', { class: 'col' });
    const box = el('div', { class: 'canvas-box', id: 'gen-box' });
    if (M.result?.image) box.appendChild(resultNode(M.result.image));
    else if (M.result?.video) box.appendChild(el('video', { src: M.result.video, controls: true, autoplay: true, loop: true }));
    else box.appendChild(el('div', { class: 'muted', text: t('img.prompt') }));
    right.appendChild(box);

    if (M.result?.image) {
      right.appendChild(el('div', { class: 'panel-sec' },
        el('h4', { text: t('img.interactiveTitle') }),
        el('div', { class: 'sliders' },
          filterRow(t('img.brightness'), 'brightness', 0.2, 2, 0.05, 1),
          filterRow(t('img.contrast'), 'contrast', 0.2, 2, 0.05, 1),
          filterRow(t('img.saturation'), 'saturate', 0, 2.5, 0.05, 1),
          filterRow(t('img.hue'), 'hue-rotate', 0, 360, 1, 0, 'deg'),
          filterRow(t('img.blur'), 'blur', 0, 10, 0.1, 0, 'px')),
        el('div', { class: 'row', style: 'margin-top:.5rem' },
          el('button', { class: 'btn sm', text: '⤓ ' + t('img.download'), onclick: downloadImage }),
          el('button', { class: 'btn sm', text: '✨ ' + t('img.enhance'), onclick: () => { M.params.prompt += ' , ultra détaillé, haute qualité, 8k'; generate(host); } }),
          el('button', { class: 'btn sm', text: '🔁 ' + t('img.regen'), onclick: () => generate(host) }))));
    }

    if (M.gallery.length) {
      const g = el('div', { class: 'panel-sec' }, el('h4', { text: t('img.gallery') }));
      const grid = el('div', { class: 'row wrap' });
      M.gallery.slice(0, 8).forEach((src) => { const im = el('img', { src, style: 'width:84px;height:84px;object-fit:cover;border-radius:10px;cursor:pointer' }); im.addEventListener('click', () => { M.result = { image: src }; render(host); }); grid.appendChild(im); });
      g.appendChild(grid);
      right.appendChild(g);
    }

    wrap.append(ctrl, right);
    host.appendChild(wrap);
  }

  const FILTERS = {};
  function filterRow(label, key, min, max, step, val, unit = '') {
    const out = el('span', { class: 'chip tiny', text: val + unit });
    const r = el('input', { type: 'range', min, max, step, value: val });
    r.addEventListener('input', () => { FILTERS[key] = r.value; out.textContent = r.value + unit; applyFilters(); });
    return el('div', {}, el('div', { class: 'row' }, el('span', { class: 'tiny muted', text: label }), el('span', { class: 'spacer' }), out), r);
  }
  function applyFilters() {
    const img = document.querySelector('#gen-box img');
    if (!img) return;
    img.style.filter = Object.entries(FILTERS).map(([k, v]) => `${k}(${v}${k === 'hue-rotate' ? 'deg' : k === 'blur' ? 'px' : ''})`).join(' ');
  }
  function resultNode(src) {
    const img = el('img', { src });
    img.style.filter = Object.entries(FILTERS).map(([k, v]) => `${k}(${v}${k === 'hue-rotate' ? 'deg' : k === 'blur' ? 'px' : ''})`).join(' ');
    return img;
  }
  function downloadImage() {
    const img = document.querySelector('#gen-box img');
    if (!img) return;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || 1024; c.height = img.naturalHeight || 1024;
    const ctx = c.getContext('2d');
    ctx.filter = img.style.filter || 'none';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const a = el('a', { href: c.toDataURL('image/png'), download: 'jarvis-image.png' }); a.click();
  }

  function buildPrompt() {
    const p = M.params;
    return [
      p.prompt,
      p.style ? 'style: ' + p.style : '',
      'aspect ratio ' + p.aspect,
      'resolution about ' + p.pixels + 'px',
      'palette: ' + p.colors.join(', '),
      p.pro ? `lighting: ${p.lighting}, lens: ${p.lens}, mood: ${p.mood}, guidance: ${p.guidance}` : '',
      p.pro && p.negative ? 'avoid: ' + p.negative : '',
      M.kind === 'video' ? `video storyboard frames, motion: ${p.motion}/10, ${p.duration}s at ${p.fps}fps` : '',
    ].filter(Boolean).join('. ');
  }

  async function generate(host, seedShift = 0) {
    const p = M.params;
    if (!p.prompt.trim()) return toast(t('img.prompt'), 'err');
    if (!S.key) return window.App.startOnboarding(true);
    const box = document.getElementById('gen-box');
    box.innerHTML = '';
    box.appendChild(el('div', { class: 'dots muted', text: t('common.loading') }));
    const model = p.model || window.Chat.activeModel();
    const info = window.Chat.modelInfo(model);
    if (info && !info.free) { const ok = await window.Chat.paidWarning(model); if (!ok) return render(host); }
    try {
      const r = await API.call('/api/image', { method: 'POST', body: { key: S.key, model, prompt: buildPrompt(), size: p.aspect, quality: p.quality, seed: p.seed ? Number(p.seed) + seedShift : undefined } });
      if (r.images?.length) {
        M.result = { image: r.images[0] };
        M.gallery.unshift(r.images[0]); M.gallery = M.gallery.slice(0, 16); window.J.LS.set('gallery', M.gallery);
        if (M.kind === 'video') await makeVideo(host, r.images);
        else render(host);
        return;
      }
      throw new Error(r.error || r.text || 'no image returned');
    } catch (e) {
      if (M.kind === 'video') { await storyboardVideo(host); return; }
      box.innerHTML = '';
      const n = el('div', { class: 'notice danger' }, el('b', { text: t('toast.error') }), el('div', { class: 'tiny', text: String(e.message || e) }),
        el('div', { class: 'tiny muted', text: t('img.tip') }));
      box.appendChild(n);
    }
  }

  async function variations(host) {
    if (!M.params.prompt.trim()) return toast(t('img.prompt'), 'err');
    const g = el('div', { class: 'row wrap' });
    const host2 = studioHost();
    host2.prepend(el('div', { class: 'panel-sec', id: 'var-box' }, el('h4', { text: t('img.variations') }), g));
    for (let i = 1; i <= 4; i++) {
      try {
        const r = await API.call('/api/image', { method: 'POST', body: { key: S.key, model: M.params.model || window.Chat.activeModel(), prompt: buildPrompt() + ` (variation ${i})`, size: M.params.aspect, quality: M.params.quality } });
        if (r.images?.[0]) g.appendChild(el('img', { src: r.images[0], style: 'width:120px;height:120px;object-fit:cover;border-radius:10px;cursor:pointer', onclick: () => { M.result = { image: r.images[0] }; render(studioHost()); } }));
      } catch {}
    }
    if (!g.children.length) document.getElementById('var-box')?.remove();
  }

  // --- vidéo : assemblage à partir d'images clés (MediaRecorder -> webm)
  async function storyboardVideo(host) {
    const frames = [];
    for (let i = 0; i < 6; i++) {
      try {
        const r = await API.call('/api/image', { method: 'POST', body: { key: S.key, model: M.params.model || window.Chat.activeModel(), prompt: buildPrompt() + ` — keyframe ${i + 1}/6`, size: M.params.aspect, quality: M.params.quality } });
        if (r.images?.[0]) frames.push(await loadImg(r.images[0]));
      } catch {}
    }
    if (!frames.length) { document.getElementById('gen-box').innerHTML = '<div class="notice danger">' + t('vid.desc') + '</div>'; return; }
    await makeVideo(host, frames.map((f) => f.src));
  }

  function loadImg(src) { return new Promise((res) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }

  async function makeVideo(host, sources) {
    const imgs = (await Promise.all(sources.slice(0, 6).map(loadImg))).filter(Boolean);
    if (!imgs.length) return;
    const w = 640, h = Math.round(640 / imgs[0].width * imgs[0].height) || 360;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const stream = c.captureStream(M.params.fps || 24);
    const chunks = [];
    let rec = null;
    try { rec = new MediaRecorder(stream, { mimeType: 'video/webm' }); } catch { rec = new MediaRecorder(stream); }
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise((res) => { rec.onstop = () => res(new Blob(chunks, { type: 'video/webm' })); });
    rec.start();
    const total = (M.params.duration || 6) * 1000;
    const t0 = performance.now();
    const box = document.getElementById('gen-box');
    box.innerHTML = ''; box.appendChild(c);
    await new Promise((res) => {
      function frame() {
        const p = (performance.now() - t0) / total;
        if (p >= 1) return res();
        const idx = Math.min(imgs.length - 1, Math.floor(p * imgs.length));
        const local = (p * imgs.length) % 1;
        const zoom = 1 + local * 0.08 * (1 + M.params.motion / 10);
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        ctx.save();
        ctx.globalAlpha = 1 - Math.max(0, local - 0.85) * 4;
        ctx.translate(w / 2, h / 2); ctx.scale(zoom, zoom); ctx.translate(-w / 2, -h / 2);
        ctx.drawImage(imgs[idx], 0, 0, w, h);
        ctx.restore();
        requestAnimationFrame(frame);
      }
      frame();
    });
    rec.stop();
    const blob = await done;
    M.result = { video: URL.createObjectURL(blob) };
    render(host);
    const a = el('a', { href: M.result.video, download: 'jarvis-video.webm' });
    document.getElementById('gen-box')?.appendChild(el('div', { class: 'row', style: 'margin-top:.5rem' },
      el('button', { class: 'btn sm primary', text: '⤓ ' + t('img.download'), onclick: () => a.click() })));
  }

  window.Media = { open, close, M };
})();
