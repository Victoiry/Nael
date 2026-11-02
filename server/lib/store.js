// Tiny JSON file store (no dependency)
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function file(name) { return path.join(DATA_DIR, name + '.json'); }

function read(name, fallback) {
  try { return JSON.parse(fs.readFileSync(file(name), 'utf8')); }
  catch { return fallback; }
}

function write(name, data) {
  const tmp = file(name) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file(name));
}

const cache = new Map();
function get(name, fallback) {
  if (!cache.has(name)) cache.set(name, read(name, fallback));
  return cache.get(name);
}
function set(name, data) { cache.set(name, data); write(name, data); }

module.exports = { get, set, DATA_DIR };
