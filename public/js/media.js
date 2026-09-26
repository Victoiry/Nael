/* JARVIS — studio image & vidéo : génération, retouche interactive, export */
(function () {
  const { S, t, el, save, toast, API, icon, esc, modal } = window.J;
  const MAXPX = 3072; // limite 3K imposée à toutes les sorties

  const ST = {
    kind: 'image',
    src: null,        // canvas source (dessin généré ou importé)
    paint: null,      // calque de retouche (pinceau, texte, filigrane)
    out: null,        // canvas de prévisualisation
    pro: false,
    adj: { brightness: 100, contrast: 100, saturate: 100, hue: 0, blur: 0, sepia: 0, gray: 0, invert: 0, vignette: 0, grain: 0, sharpen: 0 },
    tf: { rotate: 0, flipH: false, flipV: false },
    size: { w: 1024, h: 1024 },
    brush: { on: false, color: '#8a8a8a', size: 18 },
    texts: [],
    mark: { on: false, text: 'JARVIS', pos: 'br', opacity: 0.55, size: 34, color: '#ffffff' },
    quality: 'normal',
    busy: false,
  };
  const QUAL = { saver: ['Économiseur', 0.5, 0.9], mini: ['Mini', 0.8, 2], normal: ['Normal', 1.2, 4], high: ['Haut', 2.2, 7], very_high: ['Très haut', 3, 9], max: ['Max', 4, 12], ultra: ['Ultra', 6, 16] };

  const view = () => document.getElementById('chat-scroll');
  // certains environnements (aperçus sans canvas) ne fournissent pas de contexte 2D
  const ctx2d = (c) => { try { return c.getContext('2d'); } catch { return null; } };
  const ok2d = (c) => !!ctx2d(c);

  // ============================================================ structure
  function open(kind) {
    ST.kind = kind;
    const box = view();
    box.classList.remove('grid-mode');
    box.innerHTML = '';
    const studio = el('div', { class: 'studio-grid', id: 'studio' });
    const left = el('div', { class: 'col', id: 'st-left' });
    const right = el('div', {}, el('div', { class: 'canvas-box', id: 'st-canvas' }), el('div', { id: 'st-under', class: 'col', style: 'margin-top:.6rem' }));
    studio.append(left, right);
    box.appendChild(studio);
    buildControls(left);
    redraw(true);
  }

  function buildControls(left) {
    left.innerHTML = '';
    const isImg = ST.kind === 'image';

    // --- génération
    const prompt = el('textarea', { placeholder: t(isImg ? 'img.prompt' : 'vid.prompt'), rows: 2 });
    prompt.value = ST.prompt || '';
    prompt.addEventListener('input', () => { ST.prompt = prompt.value; });
    const gen = el('button', { class: 'btn primary block' }, icon(isImg ? 'image' : 'film', 16), t(isImg ? 'img.generate' : 'vid.generate'));
    gen.addEventListener('click', () => generate(prompt.value.trim(), gen));
    left.appendChild(el('div', { class: 'panel-sec' },
      el('h4', { text: t(isImg ? 'img.title' : 'vid.title') }), prompt, gen));

    // --- taille / résolution (max 3K)
    const wIn = el('input', { type: 'number', min: 64, max: MAXPX, step: 32, value: ST.size.w });
    const hIn = el('input', { type: 'number', min: 64, max: MAXPX, step: 32, value: ST.size.h });
    const clamp = (v) => Math.max(64, Math.min(MAXPX, Number(v) || 512));
    const applySize = () => { ST.size = { w: clamp(wIn.value), h: clamp(hIn.value) }; wIn.value = ST.size.w; hIn.value = ST.size.h; redraw(true); };
    wIn.addEventListener('change', applySize); hIn.addEventListener('change', applySize);
    const preset = (label, w, h) => { const b = el('button', { class: 'btn sm', text: label }); b.addEventListener('click', () => { ST.size = { w, h }; wIn.value = w; hIn.value = h; redraw(true); }); return b; };
    left.appendChild(el('div', { class: 'panel-sec' },
      el('h4', { text: t('img.size') }),
      el('div', { class: 'row' }, wIn, el('span', { class: 'muted', text: '×' }), hIn),
      el('div', { class: 'tiny muted', text: t('img.maxres') + ' — ' + MAXPX + ' px' }),
      el('div', { class: 'row wrap', style: 'margin-top:.4rem' }, preset('1:1', 1024, 1024), preset('16:9', 1536, 864), preset('9:16', 864, 1536), preset('3K', 3072, 1728))));

    // --- qualité
    left.appendChild(el('div', { class: 'panel-sec' }, el('h4', { text: t('img.quality') }),
      (() => {
        const s = el('select');
        Object.entries(QUAL).forEach(([k, v]) => {
          const o = el('option', { value: k, text: t('effort.' + k) });
          if (k === ST.quality) o.selected = true;
          s.appendChild(o);
        });
        s.addEventListener('change', () => { ST.quality = s.value; redraw(true); });
        return s;
      })(),
      el('div', { class: 'tiny muted', text: QUAL[ST.quality][0] + ' · bitrate ' + QUAL[ST.quality][2] + ' Mb/s' })));

    // --- couleurs
    const colors = ['#ffffff', '#d4d4d4', '#8a8a8a', '#404040', '#000000', '#b4713f', '#4f7a52', '#3f5d8a'];
    const palette = el('div', { class: 'row wrap' });
    colors.forEach((c) => {
      const b = el('button', { class: 'chip', style: `background:${c};width:26px;height:26px;border-radius:8px`, title: c });
      b.addEventListener('click', () => { ST.brush.color = c; ST.texts.forEach((x) => { if (x.id === ST.sel) x.color = c; }); redraw(); });
      palette.appendChild(b);
    });
    left.appendChild(el('div', { class: 'panel-sec' }, el('h4', { text: t('img.colors') }), palette,
      el('div', { class: 'row wrap', style: 'margin-top:.4rem' },
        (() => { const b = el('button', { class: 'btn sm', text: t('img.palette') }); b.addEventListener('click', extractPalette); return b; })(),
        (() => { const b = el('button', { class: 'btn sm', text: t('img.gradient') }); b.addEventListener('click', () => fillProcedural(ST.prompt || 'jarvis')); return b; })())));

    if (isImg) buildImageTools(left);
    else buildVideoTools(left);

    // --- pro
    const adv = el('div', { class: 'panel-sec adv' + (ST.pro ? ' on' : '') }, el('h4', { text: t('img.pro') }));
    if (isImg) {
      adv.append(
        sliderRow('img.sharpen', 0, 5, 1, ST.adj.sharpen, (v) => { ST.adj.sharpen = v; redraw(); }),
        sliderRow('img.vignette', 0, 1, 0.05, ST.adj.vignette, (v) => { ST.adj.vignette = v; redraw(); }),
        sliderRow('img.grain', 0, 1, 0.05, ST.adj.grain, (v) => { ST.adj.grain = v; redraw(); }),
        el('div', { class: 'row wrap', style: 'margin-top:.4rem' },
          (() => { const b = el('button', { class: 'btn sm', text: t('img.watermark') }); b.addEventListener('click', () => { ST.mark.on = !ST.mark.on; redraw(); }); return b; })(),
          (() => { const b = el('button', { class: 'btn sm', text: 'ASCII / SVG' }); b.addEventListener('click', () => exportSvg()); return b; })()));
    } else {
      adv.append(
        el('div', { class: 'tiny muted', text: t('vid.motion') }),
        (() => {
          const s = el('select');
          [['zoom-in', t('vid.zoomin')], ['zoom-out', t('vid.zoomout')], ['pan-lr', t('vid.pan')], ['orbit', t('vid.orbit')], ['none', t('common.none')]]
            .forEach(([v, l]) => { const o = el('option', { value: v, text: l }); if (v === (ST.motion || 'zoom-in')) o.selected = true; s.appendChild(o); });
          s.addEventListener('change', () => { ST.motion = s.value; });
          return s;
        })());
    }
    const proBtn = el('button', { class: 'btn sm block' }, icon('bolt', 15), t('img.proTools'));
    proBtn.addEventListener('click', () => { ST.pro = !ST.pro; adv.classList.toggle('on', ST.pro); });
    left.appendChild(proBtn);
    left.appendChild(adv);

    // --- export
    left.appendChild(el('div', { class: 'panel-sec' }, el('h4', { text: t('img.export') }),
      el('div', { class: 'row wrap' },
        (() => { const b = el('button', { class: 'btn sm primary' }, icon('download', 15), 'PNG'); b.addEventListener('click', () => exportImage('image/png')); return b; })(),
        (() => { const b = el('button', { class: 'btn sm' }, icon('download', 15), 'JPEG'); b.addEventListener('click', () => exportImage('image/jpeg')); return b; })(),
        (() => { const b = el('button', { class: 'btn sm' }, icon('download', 15), 'WebP'); b.addEventListener('click', () => exportImage('image/webp')); return b; })(),
        (() => { const b = el('button', { class: 'btn sm' }, icon('refresh', 15), t('img.reset')); b.addEventListener('click', () => { reset(); }); return b; })()),
      el('div', { class: 'tiny muted', style: 'margin-top:.3rem', text: t('img.hint') })));
  }

  function buildImageTools(left) {
    const box = el('div', { class: 'panel-sec' }, el('h4', { text: t('img.tools') }));
    const sliders = el('div', { class: 'sliders' });
    [['img.brightness', 'brightness', 0, 200], ['img.contrast', 'contrast', 0, 200], ['img.saturation', 'saturate', 0, 200],
     ['img.hue', 'hue', -180, 180], ['img.blur', 'blur', 0, 20], ['img.sepia', 'sepia', 0, 100], ['img.gray', 'gray', 0, 100]]
      .forEach(([k, key, min, max]) => sliders.appendChild(sliderRow(k, min, max, min < 0 ? 5 : 1, ST.adj[key], (v) => { ST.adj[key] = v; redraw(); })));
    box.appendChild(sliders);
    box.appendChild(el('div', { class: 'row wrap', style: 'margin-top:.4rem' },
      btn(t('img.rotate'), () => { ST.tf.rotate = (ST.tf.rotate + 90) % 360; redraw(true); }),
      btn(t('img.flipH'), () => { ST.tf.flipH = !ST.tf.flipH; redraw(true); }),
      btn(t('img.flipV'), () => { ST.tf.flipV = !ST.tf.flipV; redraw(true); }),
      btn(t('img.crop'), openCrop)));
    const brushSize = sliderRow('img.brush', 2, 120, 1, ST.brush.size, (v) => { ST.brush.size = v; });
    const brushOn = el('button', { class: 'btn sm' }, icon('pencil', 15), t('img.brushOn'));
    brushOn.addEventListener('click', () => { ST.brush.on = !ST.brush.on; brushOn.classList.toggle('primary', ST.brush.on); });
    const textBtn = btn(t('img.addtext'), addText);
    box.append(brushSize, el('div', { class: 'row wrap' }, brushOn, textBtn,
      btn(t('img.undo'), () => {
        if (ST.stack?.length) { ctx2d(ST.paint)?.putImageData(ST.stack.pop(), 0, 0); redraw(); toast(t('img.undone'), 'ok'); }
        else toast(t('img.nothingUndo'), 'err');
      }),
      btn(t('img.clearLayer'), () => { ctx2d(ST.paint)?.clearRect(0, 0, ST.paint.width, ST.paint.height); ST.stack = []; redraw(); })));
    left.appendChild(box);
  }

  function buildVideoTools(left) {
    const box = el('div', { class: 'panel-sec' }, el('h4', { text: t('vid.title') }));
    box.append(
      sliderRow('vid.duration', 1, 10, 1, ST.dur || 3, (v) => { ST.dur = v; }),
      sliderRow('vid.fps', 12, 30, 1, ST.fps || 24, (v) => { ST.fps = v; }),
      el('div', { class: 'row wrap', style: 'margin-top:.4rem' },
        (() => { const b = el('button', { class: 'btn sm primary' }, icon('film', 15), t('vid.make')); b.addEventListener('click', makeVideo); return b; })(),
        (() => { const b = el('button', { class: 'btn sm' }, icon('refresh', 15), t('vid.anim')); b.addEventListener('click', (ev) => animate(ev.currentTarget)); return b; })()),
      el('div', { class: 'tiny muted', text: t('vid.desc') }));
    left.appendChild(box);
  }

  const btn = (label, fn) => { const b = el('button', { class: 'btn sm', text: label }); b.addEventListener('click', fn); return b; };
  function sliderRow(labelKey, min, max, step, value, onInput) {
    const out = el('span', { class: 'chip tiny', text: String(value) });
    const r = el('input', { type: 'range', min, max, step, value });
    r.addEventListener('input', () => { out.textContent = r.value; onInput(Number(r.value)); });
    return el('div', {}, el('div', { class: 'row' }, el('span', { class: 'tiny muted', text: t(labelKey) }), el('span', { class: 'spacer' }), out), r);
  }

  // ============================================================ génération
  async function generate(prompt, btnEl) {
    if (!prompt) return toast(t('img.needPrompt'), 'err');
    if (!S.key) { toast(t('toast.nokey'), 'err'); return window.App.startOnboarding(true); }
    ST.prompt = prompt;
    btnEl.disabled = true;
    const old = btnEl.innerHTML;
    btnEl.innerHTML = '';
    btnEl.append(icon('loader', 16), t('img.generating'));
    const q = QUAL[ST.quality][0];
    const ask = ST.kind === 'image'
      ? `Génère une illustration au format SVG (code SVG valide uniquement, sans texte autour) pour : "${prompt}". Style demandé : détaillé, harmonieux, palette cohérente, qualité ${q}. Contraintes : viewBox="0 0 ${ST.size.w} ${ST.size.h}", aucun script, aucune image externe, uniquement des formes/chemins/dégradés SVG.`
      : `Décris une animation courte (3 plans clés) pour une vidéo générée : "${prompt}". Réponds en 3 phrases maximum.`;
    try {
      let text = '';
      let imgUrl = null;
      if (ST.kind === 'image') {
        // 1) vrai modèle d'image OpenRouter (renvoie une image)
        const ir = await J.ORapi.image({ key: S.key, model: S.settings.ai.imageModel || undefined, prompt: `${prompt} — qualité ${q}, format ${ST.size.w}x${ST.size.h}`, size: ST.size.w === ST.size.h ? '1:1' : ST.size.w > ST.size.h ? '16:9' : '9:16' });
        if (ir.ok && ir.images && ir.images.length) imgUrl = ir.images[0];
        else if (ir.reason && ir.reason !== 'modele_inconnu') toast(t('or.err.' + ir.reason), 'err');
      }
      if (imgUrl) {
        const ok = await loadImageUrl(imgUrl);
        if (!ok) fillProcedural(prompt);
      } else {
        // 2) sinon : image vectorielle écrite par le modèle texte (mêmes canaux)
        const r = await J.ORapi.chatOnce({ key: S.key, model: window.Chat.activeModel(), messages: [{ role: 'user', content: ask }], effort: S.settings.ai.effort });
        text = r.content || '';
        if (!r.ok) toast(t('or.err.' + (r.reason || 'inconnu')), 'err');
        if (ST.kind === 'image') { if (!(await loadSvg(text))) fillProcedural(prompt); }
        else { ST.scriptText = text; fillProcedural(prompt); toast(t('toast.done'), 'ok'); }
      }
    } catch {
      fillProcedural(prompt);
      toast(t('img.fallback'), 'ok');
    }
    btnEl.disabled = false;
    btnEl.innerHTML = old;
    redraw(true);
  }

  async function loadImageUrl(url) {
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const w = img.naturalWidth || ST.size.w, h = img.naturalHeight || ST.size.h;
      initCanvases(w, h);
      ctx2d(ST.src)?.drawImage(img, 0, 0, w, h);
      toast(t('toast.done'), 'ok');
      return true;
    } catch { return false; }
  }

  async function loadSvg(text) {
    const m = String(text).match(/<svg[\s\S]*?<\/svg>/i);
    if (!m) return false;
    const svg = m[0].replace(/<script[\s\S]*?<\/script>/gi, '');
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      initCanvases(img.naturalWidth || ST.size.w, img.naturalHeight || ST.size.h);
      ctx2d(ST.src)?.drawImage(img, 0, 0, ST.src.width, ST.src.height);
      toast(t('toast.done'), 'ok');
      return true;
    } catch { return false; } finally { URL.revokeObjectURL(url); }
  }

  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); }
  function fillProcedural(seedText) {
    const w = ST.size.w, h = ST.size.h;
    initCanvases(w, h);
    const c = ctx2d(ST.src);
    if (!c) { ST.noCanvas = true; return; }
    const seed = hash(seedText || 'jarvis');
    const rnd = () => { let x = seed + (rnd.i = (rnd.i || 0) + 1); x = Math.sin(x) * 10000; return x - Math.floor(x); };
    const g = c.createLinearGradient(0, 0, w, h);
    const hue = seed % 360;
    g.addColorStop(0, `hsl(${hue} 70% 22%)`);
    g.addColorStop(0.5, `hsl(${(hue + 60) % 360} 65% 12%)`);
    g.addColorStop(1, `hsl(${(hue + 300) % 360} 70% 26%)`);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * (w / 6);
      const rg = c.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `hsla(${(hue + rnd() * 140) % 360} 90% 62% / ${0.05 + rnd() * 0.18})`);
      rg.addColorStop(1, 'transparent');
      c.fillStyle = rg; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    redraw(true);
  }

  // ============================================================ canevas
  function initCanvases(w, h) {
    const mk = () => { const c = el('canvas'); c.width = w; c.height = h; return c; };
    ST.noCanvas = false;
    ST.src = mk(); ST.paint = mk(); ST.out = mk();
    ST.stack = [];
    ST.size = { w, h };
    document.getElementById('st-canvas').innerHTML = '';
    ST.out.style.maxWidth = '100%';
    ST.out.style.borderRadius = '10px';
    document.getElementById('st-canvas').appendChild(ST.out);
    bindPaint();
  }
  function ensure() { if (!ST.src) fillProcedural(ST.prompt || 'jarvis'); }

  /* Un seul rendu à la fois : les appels rapprochés (pinceau, curseurs) ne se
     marchent plus dessus, et aucune erreur de rendu ne peut remonter à l'écran. */
  let REDRAW_SEQ = 0;
  function redraw(resize) {
    const seq = ++REDRAW_SEQ;
    paint(resize, seq).catch(() => {});
  }
  async function paint(resize, seq) {
    ensure();
    if (ST.noCanvas || !ok2d(ST.out)) return;
    if (resize) {
      // ré-échantillonne la source et le calque sur la taille demandée sans perte logique
      const w = ST.size.w, h = ST.size.h;
      if (ST.src.width !== w || ST.src.height !== h) {
        const ns = el('canvas'), np = el('canvas');
        ns.width = w; ns.height = h; np.width = w; np.height = h;
        ctx2d(ns)?.drawImage(ST.src, 0, 0, w, h);
        ctx2d(np)?.drawImage(ST.paint, 0, 0, w, h);
        ST.src = ns; ST.paint = np; ST.stack = [];
      }
      const cont = document.getElementById('st-canvas');
      if (cont && ST.out.parentElement !== cont) { cont.innerHTML = ''; cont.appendChild(ST.out); }
    }
    const w = ST.src.width, h = ST.src.height;
    const rot = ST.tf.rotate % 360;
    const sw = (rot === 90 || rot === 270) ? h : w;
    const sh = (rot === 90 || rot === 270) ? w : h;
    ST.out.width = sw; ST.out.height = sh;
    const c = ctx2d(ST.out);
    if (!c) { ST.noCanvas = true; return; }
    c.clearRect(0, 0, sw, sh);
    c.save();
    c.translate(sw / 2, sh / 2);
    c.rotate(rot * Math.PI / 180);
    c.scale(ST.tf.flipH ? -1 : 1, ST.tf.flipV ? -1 : 1);
    c.filter = filterString();
    c.drawImage(ST.src, -w / 2, -h / 2, w, h);
    c.filter = 'none';
    c.drawImage(ST.paint, -w / 2, -h / 2, w, h);
    c.restore();
    applyTexts(c, sw, sh);
    if (seq !== REDRAW_SEQ) return;                       // un rendu plus récent a pris la main
    applyVignette(c, sw, sh);
    applyGrain(c, sw, sh);
    if (ST.mark.on) drawWatermark(c, sw, sh);
    if (ST.playing) drawOverlay(c, sw, sh);
  }

  function filterString() {
    const a = ST.adj;
    return `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturate}%) hue-rotate(${a.hue}deg) blur(${a.blur}px) sepia(${a.sepia}%) grayscale(${a.gray}%)`;
  }
  function applyTexts(c, w, h) {
    ST.texts.forEach((tx) => {
      c.save();
      c.font = `600 ${tx.size}px Inter, sans-serif`;
      c.fillStyle = tx.color;
      c.globalAlpha = tx.opacity ?? 1;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 8;
      c.fillText(tx.text, tx.x * w, tx.y * h);
      c.restore();
    });
  }
  function drawWatermark(c, w, h) {
    const m = ST.mark;
    c.save();
    c.globalAlpha = m.opacity;
    c.font = `700 ${Math.max(14, m.size * (w / 1024))}px Inter, sans-serif`;
    c.fillStyle = m.color;
    const pad = 18 * (w / 1024);
    const pos = { br: [w - pad, h - pad], bl: [pad, h - pad], tr: [w - pad, pad], tl: [pad, pad], center: [w / 2, h / 2] }[m.pos] || [w - pad, h - pad];
    c.textAlign = m.pos.includes('l') || m.pos === 'center' ? (m.pos === 'center' ? 'center' : 'left') : 'right';
    c.textBaseline = m.pos.startsWith('t') ? 'top' : 'bottom';
    c.fillText(m.text, pos[0], pos[1]);
    c.restore();
  }
  function applyVignette(c, w, h) {
    if (!ST.adj.vignette) return;
    const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'transparent'); g.addColorStop(1, `rgba(0,0,0,${ST.adj.vignette})`);
    c.save(); c.globalCompositeOperation = 'source-over'; c.fillStyle = g; c.fillRect(0, 0, w, h); c.restore();
  }
  function applyGrain(c, w, h) {
    if (!ST.adj.grain) return;
    const img = c.getImageData(0, 0, w, h), d = img.data, n = ST.adj.grain * 40;
    for (let i = 0; i < d.length; i += 4) { const r = (Math.random() - 0.5) * n; d[i] += r; d[i + 1] += r; d[i + 2] += r; }
    c.putImageData(img, 0, 0);
  }
  function drawOverlay(c, w, h) {
    c.save(); c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.font = `600 ${Math.max(18, w / 26)}px Inter, sans-serif`; c.textAlign = 'center';
    c.fillText('● REC ' + (ST.elapsed || 0).toFixed(1) + 's / ' + (ST.dur || 3) + 's', w / 2, h - w / 30);
    c.restore();
  }

  // ============================================================ retouche
  function bindPaint() {
    const c = ST.out;
    c.style.cursor = 'crosshair';
    let drawing = false;
    const pos = (e) => {
      const r = c.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
    };
    c.addEventListener('pointerdown', (e) => {
      if (!ST.brush.on) return;
      drawing = true; c.setPointerCapture(e.pointerId);
      pushStack();
      const p = pos(e);
      const sx = (p.x / c.width) * ST.paint.width, sy = (p.y / c.height) * ST.paint.height;
      const ctx = ctx2d(ST.paint);
      if (!ctx) return;
      ctx.strokeStyle = ST.brush.color;
      ctx.lineWidth = ST.brush.size * (ST.paint.width / c.width);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 0.01, sy); ctx.stroke();
      redraw();
    });
    c.addEventListener('pointermove', (e) => {
      if (!drawing || !ST.brush.on) return;
      const p = pos(e), ctx = ctx2d(ST.paint);
      if (!ctx) return;
      ctx.lineTo((p.x / c.width) * ST.paint.width, (p.y / c.height) * ST.paint.height); ctx.stroke();
      redraw();
    });
    const stop = () => { drawing = false; };
    c.addEventListener('pointerup', stop); c.addEventListener('pointerleave', stop);
  }
  function pushStack() {
    if (!ST.paint) return;
    ST.stack = (ST.stack || []).slice(-8);
    const c2 = ctx2d(ST.paint); if (!c2) return;
    ST.stack.push(c2.getImageData(0, 0, ST.paint.width, ST.paint.height));
  }

  function addText() {
    ST.texts.push({ id: 'tx' + Date.now(), text: t('img.textDefault'), x: 0.5, y: 0.8, size: 64, color: ST.brush.color, opacity: 1 });
    editText(ST.texts[ST.texts.length - 1]);
  }
  function editText(tx) {
    const body = el('div', {});
    const input = el('input', { type: 'text', value: tx.text });
    const color = el('input', { type: 'color', value: tx.color });
    const size = el('input', { type: 'range', min: 12, max: 260, value: tx.size });
    const x = el('input', { type: 'range', min: 0, max: 1, step: 0.01, value: tx.x });
    const y = el('input', { type: 'range', min: 0, max: 1, step: 0.01, value: tx.y });
    const sync = () => { Object.assign(tx, { text: input.value, color: color.value, size: Number(size.value), x: Number(x.value), y: Number(y.value) }); redraw(); };
    [input, color, size, x, y].forEach((i) => i.addEventListener('input', sync));
    body.append(el('label', { class: 'field' }, el('span', { text: t('img.textDefault') }), input),
      el('div', { class: 'row' }, el('span', { class: 'tiny muted', text: t('img.colors') }), color),
      el('div', { class: 'row' }, el('span', { class: 'tiny muted', text: t('img.textSize') }), size),
      el('div', { class: 'row' }, el('span', { class: 'tiny muted', text: 'X' }), x),
      el('div', { class: 'row' }, el('span', { class: 'tiny muted', text: 'Y' }), y));
    modal({ title: t('img.addtext'), body, foot: [btn(t('common.close'), () => document.querySelector('.overlay')?.remove())] });
  }

  function openCrop() {
    const box = el('div', { class: 'row wrap' });
    [['1:1', 1, 1], ['16:9', 16, 9], ['9:16', 9, 16], ['4:5', 4, 5], ['3:2', 3, 2]].forEach(([l, rw, rh]) => {
      const b = btn(l, () => {
        const w = ST.src.width, h = ST.src.height;
        const target = rw / rh;
        let nw = w, nh = Math.round(w / target);
        if (nh > h) { nh = h; nw = Math.round(h * target); }
        const off = el('canvas'); off.width = nw; off.height = nh;
        const g = ctx2d(off);
        if (!g) return;
        g.drawImage(ST.src, (w - nw) / 2, (h - nh) / 2, nw, nh, 0, 0, nw, nh);
        initCanvases(nw, nh);
        ctx2d(ST.src)?.drawImage(off, 0, 0);
        document.querySelector('.overlay')?.remove();
        redraw(true);
      });
      box.appendChild(b);
    });
    modal({ title: t('img.crop'), body: box });
  }

  function extractPalette() {
    ensure();
    const c = ctx2d(ST.src);
    if (!c) return toast(t('img.needPrompt'), 'err');
    const w = Math.min(120, ST.src.width), h = Math.min(120, ST.src.height);
    const d = c.getImageData(0, 0, w, h).data;
    const bins = {};
    for (let i = 0; i < d.length; i += 4) {
      const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
      bins[k] = (bins[k] || 0) + 1;
    }
    const top = Object.entries(bins).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const out = el('div', { class: 'row wrap' });
    top.forEach(([k]) => {
      const r = ((Number(k) >> 8) & 15) * 17, g = ((Number(k) >> 4) & 15) * 17, b = (Number(k) & 15) * 17;
      const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
      const chip = el('button', { class: 'chip tiny', style: `background:${hex};color:#fff`, text: hex });
      chip.addEventListener('click', () => { ST.brush.color = hex; window.J.copy(hex); toast(t('toast.copied')); });
      out.appendChild(chip);
    });
    modal({ title: t('img.palette'), body: out });
  }

  // ============================================================ export
  function exportImage(mime) {
    ensure();
    if (ST.noCanvas || !ok2d(ST.out)) return toast(t('img.empty'), 'err');
    try {
      const q = mime === 'image/png' ? undefined : Math.min(0.95, QUAL[ST.quality][1] / 6 + 0.6);
      ST.out.toBlob((blob) => {
        if (!blob) return toast(t('img.empty'), 'err');
        window.J.download(blob, 'jarvis-' + Date.now() + (mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg'), t('img.saved'));
      }, mime, q);
    } catch (e) { toast(String(e.message || e), 'err'); }
  }
  function exportSvg() {
    ensure();
    if (ST.noCanvas || !ok2d(ST.out)) return toast(t('img.empty'), 'err');
    const url = ST.out.toDataURL('image/png');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ST.out.width}" height="${ST.out.height}"><image href="${url}" width="${ST.out.width}" height="${ST.out.height}"/></svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    window.J.download(blob, 'jarvis-' + Date.now() + '.svg', t('img.saved'));
  }
  function reset() {
    ST.adj = { brightness: 100, contrast: 100, saturate: 100, hue: 0, blur: 0, sepia: 0, gray: 0, invert: 0, vignette: 0, grain: 0, sharpen: 0 };
    ST.tf = { rotate: 0, flipH: false, flipV: false };
    ST.texts = []; ST.mark.on = false;
    if (ST.paint) ctx2d(ST.paint)?.clearRect(0, 0, ST.paint.width, ST.paint.height);
    ST.stack = [];
    buildControls(document.getElementById('st-left'));
    redraw(true);
  }

  // ============================================================ vidéo
  function fitSize(w, h) {
    const max = MAXPX;
    const s = Math.min(1, max / Math.max(w, h));
    return { w: Math.round(w * s), h: Math.round(h * s) };
  }
  function motionAt(t) {
    const k = ST.motion || 'zoom-in';
    const p = t; // 0 → 1
    if (k === 'zoom-in') return { z: 1 + 0.25 * p, dx: 0, dy: 0 };
    if (k === 'zoom-out') return { z: 1.25 - 0.25 * p, dx: 0, dy: 0 };
    if (k === 'pan-lr') return { z: 1.15, dx: -0.12 + 0.24 * p, dy: 0 };
    if (k === 'orbit') return { z: 1.2, dx: Math.sin(p * Math.PI * 2) * 0.08, dy: Math.cos(p * Math.PI * 2) * 0.05 };
    return { z: 1, dx: 0, dy: 0 };
  }
  async function animate(btnEl) {
    ensure();
    if (btnEl) btnEl.disabled = true;
    ST.playing = true;
    const dur = ST.dur || 3, fps = ST.fps || 24;
    const t0 = performance.now();
    await new Promise((res) => {
      const step = () => {
        const el2 = (performance.now() - t0) / 1000;
        ST.elapsed = Math.min(el2, dur);
        redraw();
        const m = motionAt(ST.elapsed / dur);
        const c = ctx2d(ST.out);
        if (!c) { ST.playing = false; return res(); }
        const w = ST.out.width, h = ST.out.height;
        const tw = w * m.z, th = h * m.z;
        const tmp = el('canvas'); tmp.width = w; tmp.height = h;
        ctx2d(tmp)?.drawImage(ST.out, 0, 0);
        c.save(); c.filter = 'none';
        c.clearRect(0, 0, w, h);
        c.drawImage(tmp, (w - tw) / 2 + m.dx * w, (h - th) / 2 + m.dy * h, tw, th);
        c.restore();
        if (ST.elapsed >= dur) { ST.playing = false; redraw(); res(); } else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    if (btnEl) btnEl.disabled = false;
  }
  async function makeVideo() {
    ensure();
    if (typeof MediaRecorder === 'undefined') return toast(t('vid.unsupported'), 'err');
    const dur = ST.dur || 3, fps = ST.fps || 24;
    const size = fitSize(ST.out.width, ST.out.height);
    const rec = el('canvas'); rec.width = size.w; rec.height = size.h;
    const rctx = ctx2d(rec);
    const stream = rec.captureStream(fps);
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: QUAL[ST.quality][2] * 1000000 });
    const chunks = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise((res) => { recorder.onstop = res; });
    const under = document.getElementById('st-under');
    under.innerHTML = '';
    const preview = el('video', { controls: true, playsinline: true });
    under.appendChild(el('div', { class: 'tiny muted', text: t('vid.recording') }));
    recorder.start();
    const t0 = performance.now();
    const total = dur * 1000;
    await new Promise((res) => {
      const step = () => {
        const p = Math.min(1, (performance.now() - t0) / total);
        const m = motionAt(p);
        const tw = ST.out.width * m.z, th = ST.out.height * m.z;
        rctx.fillStyle = '#000'; rctx.fillRect(0, 0, rec.width, rec.height);
        rctx.drawImage(ST.out, (ST.out.width - tw) / 2 + m.dx * ST.out.width, (ST.out.height - th) / 2 + m.dy * ST.out.height, tw, th, 0, 0, rec.width, rec.height);
        if (p >= 1) res(); else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    recorder.stop();
    await done;
    const blob = new Blob(chunks, { type: mime });
    const url = URL.createObjectURL(blob);
    preview.src = url;
    under.appendChild(preview);
    const dl = btn(t('vid.save'), async () => {
      try { const b = await (await fetch(url)).blob(); window.J.download(b, 'jarvis-video-' + Date.now() + '.webm', t('vid.save')); }
      catch { window.J.openLink(url); }
    });
    under.appendChild(el('div', { class: 'row wrap' }, dl, el('span', { class: 'tiny muted', text: (blob.size / 1024 / 1024).toFixed(1) + ' Mo · ' + size.w + '×' + size.h + ' · ' + fps + ' fps' })));
    toast(t('vid.ready'), 'ok');
  }

  window.Media = { open, ST, fillProcedural, MAXPX };
})();
