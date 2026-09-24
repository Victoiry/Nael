// Auth: scrypt password hashing + HMAC signed tokens. No external deps.
const crypto = require('crypto');
const store = require('./store');

const SECRET = process.env.JARVIS_SECRET ||
  store.get('secret', null) ||
  (() => { const s = crypto.randomBytes(32).toString('hex'); store.set('secret', s); return s; })();

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return `${salt}:${h}`;
}
function verifyPassword(password, stored) {
  try {
    const [salt, h] = String(stored).split(':');
    const test = crypto.scryptSync(String(password), salt, 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(test, 'hex'));
  } catch { return false; }
}

function b64url(obj) { return Buffer.from(JSON.stringify(obj)).toString('base64url'); }
function sign(payload) {
  const body = b64url(payload);
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verify(token) {
  try {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return null;
    const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

function users() { return store.get('users', {}); }

function register(email, password, name) {
  email = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'email' };
  if (String(password || '').length < 6) return { error: 'password' };
  const u = users();
  if (u[email]) return { error: 'exists' };
  u[email] = { email, name: name || email.split('@')[0], pass: hashPassword(password), createdAt: Date.now(), cloud: {} };
  store.set('users', u);
  return { token: issue(email, u[email].name), user: publicUser(u[email]) };
}

function login(email, password) {
  email = String(email || '').trim().toLowerCase();
  const u = users()[email];
  if (!u || !verifyPassword(password, u.pass)) return { error: 'invalid' };
  return { token: issue(email, u.name), user: publicUser(u) };
}

function issue(email, name) {
  return sign({ sub: email, name, exp: Date.now() + 1000 * 60 * 60 * 24 * 60 });
}
function issueGuest() {
  const id = 'guest-' + crypto.randomBytes(6).toString('hex');
  return { token: sign({ sub: id, name: 'Invité', guest: true, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }), user: { email: id, name: 'Invité', guest: true } };
}
function publicUser(u) { return { email: u.email, name: u.name, createdAt: u.createdAt }; }
function get(email) { const u = users()[email]; return u ? publicUser(u) : null; }

function saveCloud(email, key, value) {
  const all = users();
  if (!all[email]) return false;
  all[email].cloud = all[email].cloud || {};
  all[email].cloud[key] = value;
  store.set('users', all);
  return true;
}
function loadCloud(email) { return (users()[email] || {}).cloud || {}; }

module.exports = { register, login, verify, get, saveCloud, loadCloud, publicUser, issueGuest };
