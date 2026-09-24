// Bridge state: pairing, live agent sessions, pending command approvals, screenshots
const crypto = require('crypto');

const state = {
  pairCode: null,
  pairCodeAt: 0,
  token: crypto.randomBytes(24).toString('hex'), // secret shared with the installed runner
  sessions: new Map(), // sessionId -> { lastSeen, info }
  pending: new Map(), // id -> { id, command, cwd, risk, sessionId, createdAt, resolve }
  pairing: new Map(), // pairingId -> { code, sessionId, createdAt, done }
  events: [], // recent bridge log for the UI
  lastScreenshot: null,
};

function newPairCode() {
  state.pairCode = String(Math.floor(100000 + Math.random() * 900000));
  state.pairCodeAt = Date.now();
  return state.pairCode;
}
function checkPairCode(code) {
  // the code stays valid until the site itself verifies it (or it expires)
  return !!(state.pairCode && String(code).trim() === state.pairCode && Date.now() - state.pairCodeAt < 1000 * 60 * 30);
}
function log(kind, message) {
  state.events.unshift({ kind, message, at: Date.now() });
  state.events = state.events.slice(0, 120);
}
function createPending({ command, cwd, risk, sessionId, family }) {
  const id = crypto.randomBytes(8).toString('hex');
  const p = { id, command, cwd, risk, family, sessionId, createdAt: Date.now(), status: 'pending' };
  state.pending.set(id, p);
  return p;
}
function resolvePending(id, decision) {
  const p = state.pending.get(id);
  if (!p) return null;
  p.status = decision; p.decidedAt = Date.now();
  return p;
}

module.exports = { state, newPairCode, checkPairCode, log, createPending, resolvePending };
