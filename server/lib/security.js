// Risk analysis + command-approval rules for the PC agent
const SAFE = [
  /^(ls|dir|pwd|cd|whoami|echo|cat|type|head|tail|wc|date|hostname|uname|ver|tree|find|grep|rg|stat|du|df|free|uptime|id|env|printenv|which|where|git (status|log|diff|branch|show|remote -v)|node -v|npm -v|python --version|pip list|npm ls)\b/i,
];
const HIGH = [
  /rm\s+-rf\s+\/\s*$/i, /mkfs/i, /dd\s+if=.*of=\/dev\//i, /:\(\)\s*\{.*\};:/, /shutdown|reboot|halt|poweroff/i,
  /format\s+[a-z]:/i, /del\s+\/[sq]\s+[a-z]:\\/i, /reg\s+delete/i, /vssadmin/i, /bcdedit/i, /diskpart/i,
  />\s*\/dev\/sd/i, /chmod\s+-R\s+777\s+\//i, /curl.*\|\s*(ba)?sh/i, /iwr.*\|\s*iex/i,
  /cipher\s+\/w/i, /net\s+user\s+\S+\s+\S+\s+\/add/i, /takeown|icacls/i,
];
const MEDIUM = [
  /\b(nano|vim|vi|emacs|code|notepad)\b/i,
  /\b(rm|del|rmdir|mv|move|cp|copy|touch|mkdir|md)\b/i,
  /\b(npm|yarn|pnpm|pip|pip3|apt|apt-get|brew|choco|winget|scoop)\s+(install|i|add|uninstall|remove|upgrade|update)\b/i,
  /\bgit\s+(commit|push|pull|clone|reset|checkout|merge|rebase|clean)\b/i,
  /\b(start|open|xdg-open|explorer|taskkill|kill|pkill)\b/i,
];

function classify(command) {
  const cmd = String(command || '').trim();
  if (!cmd) return 'medium';
  if (HIGH.some((r) => r.test(cmd))) return 'high';
  if (SAFE.some((r) => r.test(cmd)) && !/[|><;&]{1,2}/.test(cmd)) return 'safe';
  if (MEDIUM.some((r) => r.test(cmd))) return 'medium';
  return 'medium';
}

// Extract the "program family" used for "always allow commands like this one"
// e.g. "npm install express" -> "npm", "nano notes.txt" -> "nano"
function family(command) {
  const cmd = String(command || '').trim();
  const m = cmd.match(/^([a-zA-Z0-9_.:\/\\-]+)/);
  if (!m) return cmd.split(/\s+/)[0] || cmd;
  const first = m[1].toLowerCase().replace(/\.(exe|cmd|bat|sh|ps1)$/, '');
  return first.split(/[\\/]/).pop();
}

const DANGER_TEXT = {
  warning: 'COMMAND_EXECUTION',
  note: 'JARVIS executes commands on YOUR machine. You are solely responsible. We decline all liability for data loss, damage or misuse.',
};

module.exports = { classify, family, DANGER_TEXT };
