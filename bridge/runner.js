// JARVIS bridge runner — installs on the user machine, polls this server, executes approved tasks.
// No npm dependency. Runs on Windows / macOS / Linux.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec, spawn } = require('child_process');

const HOME = path.join(os.homedir(), '.jarvis');
const CFG = path.join(HOME, 'config.json');

function loadCfg() {
  try { return JSON.parse(fs.readFileSync(CFG, 'utf8')); }
  catch {
    const cfg = {
      base: process.env.JARVIS_BASE || 'http://localhost:8787',
      token: process.env.JARVIS_TOKEN || '',
      pair: process.env.JARVIS_PAIR || '',
    };
    try { fs.mkdirSync(HOME, { recursive: true }); fs.writeFileSync(CFG, JSON.stringify(cfg, null, 2)); } catch {}
    return cfg;
  }
}

const cfg = loadCfg();
const base = String(cfg.base || '').replace(/\/$/, '');
const token = cfg.token;
const sessionId = 'sess_' + Math.random().toString(36).slice(2, 10);
const log = (...a) => console.log('[JARVIS]', ...a);

async function api(p, body) {
  const r = await fetch(base + p, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'x-jarvis-token': token },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { raw: t }; }
}

function runShell(command, cwd, timeout = 60000) {
  return new Promise((resolve) => {
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
    const args = process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-c', command];
    const child = spawn(shell, args, { cwd: cwd && fs.existsSync(cwd) ? cwd : os.homedir(), windowsHide: true });
    let out = '';
    const t = setTimeout(() => { try { child.kill(); } catch {} }, timeout);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => { clearTimeout(t); resolve(out.slice(0, 60000) + `\n[exit ${code}]`); });
    child.on('error', (e) => { clearTimeout(t); resolve('ERROR: ' + e.message); });
  });
}

async function screenshot() {
  const out = path.join(HOME, 'screen-' + Date.now() + '.png');
  try {
    if (process.platform === 'win32') {
      const ps = `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; ` +
        `$bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g=[System.Drawing.Graphics]::FromImage($bmp); ` +
        `$g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size); $bmp.Save('${out.replace(/\\/g, '\\\\')}');`;
      await runShell(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, HOME);
    } else if (process.platform === 'darwin') {
      await runShell(`screencapture -x "${out}"`, HOME);
    } else {
      await runShell(`(import -window root "${out}" || scrot "${out}" || gnome-screenshot -f "${out}") 2>/dev/null`, HOME);
    }
    if (fs.existsSync(out)) {
      const b64 = fs.readFileSync(out).toString('base64');
      return 'data:image/png;base64,' + b64;
    }
  } catch (e) { return null; }
  return null;
}

async function webSearch(query) {
  try {
    const r = await fetch('https://duckduckgo.com/html/?q=' + encodeURIComponent(query), { headers: { 'User-Agent': 'Mozilla/5.0 JARVIS' } });
    const html = await r.text();
    const items = [...html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)].slice(0, 6)
      .map((m) => ({ url: m[1], title: m[2].replace(/<[^>]+>/g, '') }));
    return items.length ? items : [{ title: 'Aucun resultat exploitable', url: '' }];
  } catch (e) { return [{ title: 'search error: ' + e.message, url: '' }]; }
}

async function handle(task) {
  const p = task.payload || {};
  switch (task.type) {
    case 'run': return { output: await runShell(p.command, p.cwd) };
    case 'read_file':
      try { return { output: fs.readFileSync(p.path, 'utf8').slice(0, 60000) }; }
      catch (e) { return { output: 'ERROR: ' + e.message }; }
    case 'write_file':
      try { fs.mkdirSync(path.dirname(p.path), { recursive: true }); fs.writeFileSync(p.path, p.content || ''); return { output: 'OK written ' + p.path }; }
      catch (e) { return { output: 'ERROR: ' + e.message }; }
    case 'list_dir':
      try { return { output: fs.readdirSync(p.path || os.homedir()).slice(0, 500).join('\n') }; }
      catch (e) { return { output: 'ERROR: ' + e.message }; }
    case 'open_url': {
      const url = p.url;
      const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
      return { output: await runShell(cmd) };
    }
    case 'screenshot': {
      const data = await screenshot();
      return { output: data ? 'screenshot taken' : 'screenshot failed', image: data };
    }
    case 'web_search': return { output: JSON.stringify(await webSearch(p.query)) };
    case 'calendar_add':
      return { output: 'calendar service not connected on this machine — ask the user to connect one in Settings > Integrations' };
    default: return { output: 'unknown task ' + task.type };
  }
}

async function pair() {
  const code = cfg.pair || process.env.JARVIS_PAIR;
  if (code) {
    const r = await api('/api/bridge/pair', { code, sessionId, info: { platform: process.platform, host: os.hostname(), user: os.userInfo().username, node: process.version } });
    if (r.ok) log('paired with server ✔');
    else log('pairing failed:', r.error || r);
  } else {
    await api('/api/bridge/pair', { sessionId, info: { platform: process.platform, host: os.hostname(), user: os.userInfo().username, node: process.version } });
  }
}

async function loop() {
  for (;;) {
    try {
      const r = await api('/api/bridge/poll', { sessionId });
      const tasks = (r && r.tasks) || [];
      for (const t of tasks) {
        log('task', t.type, t.payload && (t.payload.command || t.payload.path || t.payload.query));
        const res = await handle(t);
        await api('/api/bridge/result', { sessionId, id: t.id, output: res.output, image: res.image });
      }
    } catch (e) { log('poll error', e.message); }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

(async () => {
  log('JARVIS bridge starting on', os.hostname());
  await pair();
  loop();
})();
