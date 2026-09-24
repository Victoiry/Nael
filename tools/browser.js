// Lance Chromium headless avec ses bibliothèques (extraction automatique, réutilisable)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// extraction d'une archive .tar.br sans dépendance (brotli + tar minimal)
function untar(buf, dest) {
  let off = 0;
  while (off + 512 <= buf.length) {
    const name = buf.toString('utf8', off, off + 100).replace(/\0.*$/, '').trim();
    if (!name) { off += 512; continue; }
    const size = parseInt(buf.toString('utf8', off + 124, off + 136).replace(/\0.*$/, '').trim() || '0', 8);
    const type = buf.toString('utf8', off + 156, off + 157);
    const data = buf.subarray(off + 512, off + 512 + size);
    const target = path.join(dest, name);
    if (type === '5' || name.endsWith('/')) fs.mkdirSync(target, { recursive: true });
    else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      try { fs.writeFileSync(target, data, { mode: 0o755 }); } catch {}
    }
    off += 512 + Math.ceil(size / 512) * 512;
  }
}

async function libs() {
  const chromium = require('@sparticuz/chromium');
  const c = chromium.default || chromium;
  const binDir = path.join(path.dirname(require.resolve('@sparticuz/chromium')), '..', 'bin');
  const dir = '/tmp/jarvis-libs';
  if (fs.existsSync(path.join(dir, 'libnspr4.so'))) return { c, dir };

  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  if (typeof c.inflate === 'function') await c.inflate(path.join(binDir, 'al2023.tar.br'), dir);
  else untar(zlib.brotliDecompressSync(fs.readFileSync(path.join(binDir, 'al2023.tar.br'))), dir);

  // toutes les bibliothèques à la racine du dossier
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const f = path.join(d, e.name);
    return e.isDirectory() ? walk(f) : [f];
  });
  for (const f of walk(dir)) {
    if (f.endsWith('.so') || f.endsWith('.so.1') || f.endsWith('.chk')) {
      const target = path.join(dir, path.basename(f));
      if (f !== target) { try { fs.renameSync(f, target); } catch {} }
    }
  }
  return { c, dir };
}

async function launch(opts = {}) {
  const puppeteer = require('puppeteer-core');
  const { c, dir } = await libs();
  return puppeteer.launch({
    args: [...c.args, '--no-sandbox', '--disable-gpu', '--single-process', '--no-zygote', '--disable-dev-shm-usage', '--font-render-hinting=none'],
    executablePath: await c.executablePath(),
    headless: true,
    env: { ...process.env, LD_LIBRARY_PATH: dir + ':' + (process.env.LD_LIBRARY_PATH || '') },
    ...opts,
  });
}

module.exports = { launch, libs };
