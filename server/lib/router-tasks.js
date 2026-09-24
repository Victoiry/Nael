// Task router for the local bridge runner: creates pending approvals, mirrors to the runner
const bridge = require('./bridge');
const security = require('./security');
const auth = require('./auth');
const store = require('./store');

const WAIT_MS = 120000;

function approvalMode(email) {
  if (!email) return 'ask';
  const prefs = (auth.loadCloud(email) || {}).prefs || {};
  return prefs.approvalMode || 'ask';
}

function isAlwaysAllowed(email, family) {
  const list = store.get('allowFamilies', {});
  const arr = list[email] || [];
  return arr.includes(family);
}
function addAlwaysAllowed(email, family) {
  const list = store.get('allowFamilies', {});
  list[email] = list[email] || [];
  if (!list[email].includes(family)) list[email].push(family);
  store.set('allowFamilies', list);
}
function removeAlwaysAllowed(email, family) {
  const list = store.get('allowFamilies', {});
  list[email] = (list[email] || []).filter((f) => f !== family);
  store.set('allowFamilies', list);
}

function sessionFor(sessionId) { return bridge.state.sessions.get(sessionId); }

// Ask the runner to do something. type: run|read_file|write_file|list_dir|open_url|screenshot|web_search|calendar_add|screen
function requestTask({ sessionId, type, payload, risk, email, needsApproval }) {
  const p = bridge.createPending({ command: payload.command || payload.path || type, cwd: payload.cwd, risk, sessionId, family: security.family(payload.command || '') });
  p.type = type;
  p.payload = payload;
  p.needsApproval = !!needsApproval;
  p.status = needsApproval ? 'pending' : 'approved';
  return p;
}

function waitFor(p, timeout = WAIT_MS) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = setInterval(() => {
      if (p.status === 'denied') { clearInterval(tick); resolve({ denied: true }); return; }
      if (p.result) { clearInterval(tick); resolve({ result: p.result }); return; }
      if (!sessionFor(p.sessionId)) { clearInterval(tick); resolve({ offline: true }); return; }
      if (Date.now() - t0 > timeout) { clearInterval(tick); resolve({ timeout: true }); return; }
    }, 500);
  });
}

// Decide whether a tool call needs the user's approval, honouring the 3 modes
function needsUserApproval(email, toolName, args) {
  if (toolName === 'run_command') {
    const risk = security.classify(args.command);
    const mode = approvalMode(email);
    if (mode === 'all') return { need: risk !== 'safe' ? false : false, risk };
    if (mode === 'safe') return { need: risk !== 'safe', risk };
    return { need: true, risk };
  }
  if (toolName === 'write_file') {
    const mode = approvalMode(email);
    return { need: mode !== 'all', risk: 'medium' };
  }
  return { need: false, risk: 'safe' };
}

module.exports = { requestTask, waitFor, needsUserApproval, approvalMode, isAlwaysAllowed, addAlwaysAllowed, removeAlwaysAllowed, sessionFor };
