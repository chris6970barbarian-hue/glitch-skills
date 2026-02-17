#!/usr/bin/env node

/**
 * Token Manager - Centralized token management with GUI and auto-provisioning
 * 
 * Features:
 * - Store tokens securely (GitHub, AGDP, ClawHub, etc.)
 * - Web GUI on localhost
 * - Access control toggle
 * - Platform connections tracking
 * - Auto-provision tokens to platforms
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec, spawn } = require('child_process');

const C = {
  reset: '\x1b[0m', bright: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', gray: '\x1b[90m'
};

const CONFIG_DIR = path.join(process.env.HOME || '/home/crix', '.token-manager');
const DATA_FILE = path.join(CONFIG_DIR, 'tokens.json');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

const DEFAULT_DATA = {
  accessEnabled: false,
  tokens: {},
  platforms: {},  // Connected platforms
  history: []
};

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    saveData(DEFAULT_DATA);
    return DEFAULT_DATA;
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return DEFAULT_DATA;
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function loadConfig() {
  const defaultConfig = { port: 3847, autoProvision: true };
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

// Token operations
function addToken(name, value, type = 'text', platform = null) {
  const data = loadData();
  data.tokens[name] = { value, type, platform, addedAt: new Date().toISOString(), lastUsed: null };
  data.history.push({ action: 'add', name, timestamp: new Date().toISOString() });
  saveData(data);
}

function removeToken(name) {
  const data = loadData();
  if (data.tokens[name]) {
    delete data.tokens[name];
    data.history.push({ action: 'remove', name, timestamp: new Date().toISOString() });
    saveData(data);
    return true;
  }
  return false;
}

function getToken(name) {
  const data = loadData();
  if (!data.accessEnabled) return null;
  if (data.tokens[name]) {
    data.tokens[name].lastUsed = new Date().toISOString();
    saveData(data);
    return data.tokens[name].value;
  }
  return null;
}

function toggleAccess(enable = null) {
  const data = loadData();
  data.accessEnabled = enable !== null ? enable : !data.accessEnabled;
  data.history.push({ action: data.accessEnabled ? 'enable' : 'disable', timestamp: new Date().toISOString() });
  saveData(data);
  return data.accessEnabled;
}

function listTokens() {
  const data = loadData();
  return Object.entries(data.tokens).map(([name, info]) => ({
    name, type: info.type, platform: info.platform, addedAt: info.addedAt, lastUsed: info.lastUsed
  }));
}

// Platform management
function connectPlatform(name, config = {}) {
  const data = loadData();
  data.platforms[name] = { ...config, connectedAt: new Date().toISOString(), status: 'active' };
  data.history.push({ action: 'platform_connect', name, timestamp: new Date().toISOString() });
  saveData(data);
  return data.platforms[name];
}

function disconnectPlatform(name) {
  const data = loadData();
  if (data.platforms[name]) {
    delete data.platforms[name];
    data.history.push({ action: 'platform_disconnect', name, timestamp: new Date().toISOString() });
    saveData(data);
    return true;
  }
  return false;
}

function getPlatformTokens(platformName) {
  const data = loadData();
  if (!data.accessEnabled) return {};
  
  const result = {};
  for (const [name, token] of Object.entries(data.tokens)) {
    if (token.platform === platformName || !token.platform) {
      result[name] = token.value;
    }
  }
  return result;
}

function listPlatforms() {
  const data = loadData();
  return data.platforms;
}

// API for skills to request tokens
function requestToken(platform, purpose) {
  const data = loadData();
  if (!data.accessEnabled) {
    return { error: 'Access disabled', code: 'ACCESS_DISABLED' };
  }
  
  // Find matching tokens
  const matching = Object.entries(data.tokens)
    .filter(([_, t]) => t.platform === platform || !t.platform)
    .map(([name, t]) => ({ name, type: t.type, value: t.value }));
  
  if (matching.length === 0) {
    return { error: 'No tokens for platform', code: 'NO_TOKENS', platform };
  }
  
  // Log the request
  data.history.push({ action: 'token_request', platform, purpose, timestamp: new Date().toISOString() });
  saveData(data);
  
  return { tokens: matching, platform, purpose };
}

// Web GUI
function startWebServer() {
  const config = loadConfig();
  const port = config.port || 3847;
  
  const html = `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Token Manager</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; min-height: 100vh; }
    .container { max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #58a6ff; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
    .badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
    .enabled { background: #238636; color: white; }
    .disabled { background: #da3633; color: white; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 16px; margin-bottom: 16px; }
    .row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #30363d; }
    .row:last-child { border-bottom: none; }
    .toggle { position: relative; width: 50px; height: 26px; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #da3633; border-radius: 26px; transition: 0.3s; }
    .toggle-slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; }
    .toggle input:checked + .toggle-slider { background: #238636; }
    .toggle input:checked + .toggle-slider:before { transform: translateX(24px); }
    .btn { padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px; margin-left: 8px; }
    .btn-add { background: #238636; color: white; }
    .btn-remove { background: #da3633; color: white; }
    .btn-copy { background: #30363d; color: #c9d1d9; }
    .btn-connect { background: #1f6feb; color: white; }
    .form-group { margin-bottom: 12px; }
    label { display: block; margin-bottom: 4px; color: #8b949e; font-size: 12px; }
    input, select { width: 100%; padding: 8px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #c9d1d9; }
    .tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .tab { padding: 8px 16px; background: #21262d; border: 1px solid #30363d; border-radius: 6px; cursor: pointer; color: #8b949e; }
    .tab.active { background: #58a6ff; color: white; border-color: #58a6ff; }
    .hidden { display: none; }
    .platform-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
    .platform-card { background: #21262d; border: 1px solid #30363d; border-radius: 6px; padding: 12px; }
    .platform-card h3 { color: #58a6ff; margin-bottom: 8px; }
    .platform-status { font-size: 11px; color: #8b949e; }
    .platform-status.active { color: #238636; }
    .api-endpoint { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 12px; margin-top: 12px; }
    .api-endpoint code { background: #0d1117; padding: 2px 6px; border-radius: 4px; color: #7ee787; }
    .warning { background: #f0883e20; border: 1px solid #f0883e; padding: 12px; border-radius: 6px; color: #f0883e; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Token Manager <span id="accessBadge" class="badge disabled">DISABLED</span></h1>
    
    <div id="warningMsg" class="warning hidden">Agent access is DISABLED. Tokens are locked.</div>
    
    <div class="card">
      <div class="row">
        <div><strong>Agent Access</strong><p style="font-size:12px;color:#8b949e;">Allow skills to retrieve tokens</p></div>
        <label class="toggle"><input type="checkbox" id="accessToggle" onchange="toggleAccess(this.checked)"><span class="toggle-slider"></span></label>
      </div>
    </div>
    
    <div class="tabs">
      <button class="tab active" onclick="showTab('tokens')">Tokens</button>
      <button class="tab" onclick="showTab('platforms')">Platforms</button>
      <button class="tab" onclick="showTab('add')">Add Token</button>
      <button class="tab" onclick="showTab('api')">API</button>
      <button class="tab" onclick="showTab('history')">History</button>
    </div>
    
    <div id="tab-tokens" class="card">
      <div id="tokenList"></div>
    </div>
    
    <div id="tab-platforms" class="card hidden">
      <div class="platform-grid" id="platformList"></div>
      <div style="margin-top:16px">
        <h3>Connect New Platform</h3>
        <div class="form-group"><label>Platform Name</label><input type="text" id="platformName" placeholder="e.g., github, agdp, claude"></div>
        <div class="form-group"><label>Config (JSON)</label><textarea id="platformConfig" rows="3" placeholder='{"apiUrl":"..."}' style="width:100%;padding:8px;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#c9d1d9;"></textarea></div>
        <button class="btn btn-connect" onclick="connectPlatform()">Connect Platform</button>
      </div>
      <div class="api-endpoint">
        <strong>Token Request API:</strong>
        <p style="margin-top:8px;font-size:12px;color:#8b949e;">Skills can request tokens via:</p>
        <code>GET http://localhost:${port}/api/request?platform=github&purpose=deploy</code>
      </div>
    </div>
    
    <div id="tab-add" class="card hidden">
      <div class="form-group"><label>Token Name</label><input type="text" id="tokenName" placeholder="e.g., github_token, agdp_key"></div>
      <div class="form-group"><label>Token Value</label><input type="password" id="tokenValue" placeholder="Paste token here"></div>
      <div class="form-group"><label>Type</label><select id="tokenType"><option value="token">Token</option><option value="api_key">API Key</option><option value="json">JSON</option><option value="bearer">Bearer</option></select></div>
      <div class="form-group"><label>Platform (optional)</label><select id="tokenPlatform"><option value="">All Platforms</option><option value="github">GitHub</option><option value="agdp">AGDP</option><option value="clawhub">ClawHub</option><option value="claude">Claude</option></select></div>
      <button class="btn btn-add" onclick="addToken()">Add Token</button>
    </div>
    
    <div id="tab-api" class="card hidden">
      <h3>API Endpoints</h3>
      <div class="api-endpoint"><code>GET /api/data</code><p style="font-size:12px;color:#8b949e;margin-top:4px;">Get all token metadata (no values)</p></div>
      <div class="api-endpoint"><code>GET /api/token/:name</code><p style="font-size:12px;color:#8b949e;margin-top:4px;">Get specific token value (if access enabled)</p></div>
      <div class="api-endpoint"><code>GET /api/request?platform=:name&purpose=:desc</code><p style="font-size:12px;color:#8b949e;margin-top:4px;">Request tokens for a platform (auto-provides)</p></div>
      <div class="api-endpoint"><code>GET /api/platforms</code><p style="font-size:12px;color:#8b949e;margin-top:4px;">List connected platforms</p></div>
      <div class="api-endpoint"><code>POST /api/toggle</code><p style="font-size:12px;color:#8b949e;margin-top:4px;">Toggle agent access</p></div>
    </div>
    
    <div id="tab-history" class="card hidden"><div id="historyList" style="max-height:300px;overflow-y:auto;"></div></div>
  </div>
  
  <script>
    let accessEnabled = false;
    async function loadData() {
      const res = await fetch('/api/data');
      const data = await res.json();
      accessEnabled = data.accessEnabled;
      document.getElementById('accessBadge').className = 'badge ' + (accessEnabled ? 'enabled' : 'disabled');
      document.getElementById('accessBadge').textContent = accessEnabled ? 'ENABLED' : 'DISABLED';
      document.getElementById('accessToggle').checked = accessEnabled;
      document.getElementById('warningMsg').classList.toggle('hidden', accessEnabled);
      renderTokens(data.tokens);
      renderPlatforms(data.platforms);
      renderHistory(data.history);
    }
    function renderTokens(tokens) {
      const list = document.getElementById('tokenList');
      const names = Object.keys(tokens);
      if (!names.length) { list.innerHTML = '<div style="color:#8b949e;padding:12px;">No tokens stored</div>'; return; }
      list.innerHTML = names.map(name => {
        const t = tokens[name];
        return \`<div class="row"><div><strong>\${name}</strong><span style="font-size:11px;color:#8b949e;margin-left:8px;">\${t.type}\${t.platform ? ' @ ' + t.platform : ''}</span><div style="font-size:11px;color:#6e7681;">Added: \${new Date(t.addedAt).toLocaleString()}</div></div><div><button class="btn btn-copy" onclick="copyToken('\${name}')">Copy</button><button class="btn btn-remove" onclick="removeToken('\${name}')">Remove</button></div></div>\`;
      }).join('');
    }
    function renderPlatforms(platforms) {
      const list = document.getElementById('platformList');
      const names = Object.keys(platforms);
      if (!names.length) { list.innerHTML = '<div style="color:#8b949e;padding:12px;">No platforms connected</div>'; return; }
      list.innerHTML = names.map(name => {
        const p = platforms[name];
        return \`<div class="platform-card"><h3>\${name}</h3><div class="platform-status active">Connected: \${new Date(p.connectedAt).toLocaleString()}</div><button class="btn btn-remove" onclick="disconnectPlatform('\${name}')" style="margin-top:8px;">Disconnect</button></div>\`;
      }).join('');
    }
    function renderHistory(history) {
      const list = document.getElementById('historyList');
      const icons = { add: '+', remove: '×', enable: '◉', disable: '○', platform_connect: '⟷', platform_disconnect: '↮', token_request: '?' };
      const colors = { add: '#238636', remove: '#da3633', enable: '#58a6ff', disable: '#f0883e', platform_connect: '#a371f7', platform_disconnect: '#f0883e', token_request: '#7ee787' };
      list.innerHTML = history.slice().reverse().slice(0, 50).map(h => \`<div style="padding:8px;border-bottom:1px solid #30363d;font-size:12px;"><span style="color:\${colors[h.action]||'#8b949e'}">\${icons[h.action]||'•'}</span> \${h.action} \${h.name||h.platform||''} <span style="color:#6e7681;float:right;">\${new Date(h.timestamp).toLocaleString()}</span></div>\`).join('');
    }
    async function toggleAccess(enabled) {
      await fetch('/api/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) });
      loadData();
    }
    async function addToken() {
      const name = document.getElementById('tokenName').value;
      const value = document.getElementById('tokenValue').value;
      const type = document.getElementById('tokenType').value;
      const platform = document.getElementById('tokenPlatform').value || null;
      if (!name || !value) return alert('Please fill required fields');
      await fetch('/api/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, value, type, platform }) });
      document.getElementById('tokenName').value = '';
      document.getElementById('tokenValue').value = '';
      loadData(); showTab('tokens');
    }
    async function removeToken(name) {
      if (!confirm('Delete "' + name + '"?')) return;
      await fetch('/api/token/' + name, { method: 'DELETE' });
      loadData();
    }
    async function copyToken(name) {
      const res = await fetch('/api/token/' + name);
      const data = await res.json();
      if (data.value) { await navigator.clipboard.writeText(data.value); alert('Copied!'); }
      else alert('Access disabled or token not found');
    }
    async function connectPlatform() {
      const name = document.getElementById('platformName').value;
      const configStr = document.getElementById('platformConfig').value;
      if (!name) return alert('Platform name required');
      let config = {};
      try { config = configStr ? JSON.parse(configStr) : {}; } catch(e) { alert('Invalid JSON'); return; }
      await fetch('/api/platform', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, config }) });
      document.getElementById('platformName').value = '';
      document.getElementById('platformConfig').value = '';
      loadData(); showTab('platforms');
    }
    async function disconnectPlatform(name) {
      await fetch('/api/platform/' + name, { method: 'DELETE' });
      loadData();
    }
    function showTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('#tab-tokens, #tab-platforms, #tab-add, #tab-api, #tab-history').forEach(t => t.classList.add('hidden'));
      event.target.classList.add('active');
      document.getElementById('tab-' + tab).classList.remove('hidden');
      if (tab === 'tokens') loadData();
    }
    loadData();
  </script>
</body></html>`;

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
    
    const url = new URL(req.url, `http://localhost:${port}`);
    const data = loadData();
    
    // API: Get all data
    if (url.pathname === '/api/data') {
      res.end(JSON.stringify({
        accessEnabled: data.accessEnabled,
        tokens: Object.fromEntries(Object.entries(data.tokens).map(([k,v]) => [k, {type:v.type, platform:v.platform, addedAt:v.addedAt, lastUsed:v.lastUsed}])),
        platforms: data.platforms,
        history: data.history
      }));
      return;
    }
    
    // API: Toggle access
    if (url.pathname === '/api/toggle' && req.method === 'POST') {
      let body = ''; req.on('data', c => body += c);
      req.on('end', () => { const { enabled } = JSON.parse(body); toggleAccess(enabled); res.end('{}'); });
      return;
    }
    
    // API: Get single token
    if (url.pathname.startsWith('/api/token/') && req.method === 'GET') {
      const name = url.pathname.replace('/api/token/', '');
      const token = data.tokens[name];
      res.end(JSON.stringify({ value: data.accessEnabled && token ? token.value : null }));
      return;
    }
    
    // API: Add token
    if (url.pathname === '/api/token' && req.method === 'POST') {
      let body = ''; req.on('data', c => body += c);
      req.on('end', () => { const { name, value, type, platform } = JSON.parse(body); addToken(name, value, type, platform); res.end('{}'); });
      return;
    }
    
    // API: Delete token
    if (url.pathname.startsWith('/api/token/') && req.method === 'DELETE') {
      const name = url.pathname.replace('/api/token/', '');
      removeToken(name); res.end('{}'); return;
    }
    
    // API: Request tokens for platform (auto-provision)
    if (url.pathname === '/api/request' && req.method === 'GET') {
      const platform = url.searchParams.get('platform');
      const purpose = url.searchParams.get('purpose') || 'unspecified';
      const result = requestToken(platform, purpose);
      res.end(JSON.stringify(result));
      return;
    }
    
    // API: List platforms
    if (url.pathname === '/api/platforms') {
      res.end(JSON.stringify(data.platforms));
      return;
    }
    
    // API: Connect platform
    if (url.pathname === '/api/platform' && req.method === 'POST') {
      let body = ''; req.on('data', c => body += c);
      req.on('end', () => { const { name, config } = JSON.parse(body); connectPlatform(name, config); res.end('{}'); });
      return;
    }
    
    // API: Disconnect platform
    if (url.pathname.startsWith('/api/platform/') && req.method === 'DELETE') {
      const name = url.pathname.replace('/api/platform/', '');
      disconnectPlatform(name); res.end('{}'); return;
    }
    
    // Serve HTML
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });
  
  server.listen(port, () => console.log(`\n  Token Manager: http://localhost:${port}\n`));
  return server;
}

// Terminal UI
function startTerminal() {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  
  const prompt = () => rl.write('  > ');
  
  console.clear();
  console.log(C.cyan + C.bright + '\n  ╔═══════════════════════════════════════╗');
  console.log('  ║     TOKEN MANAGER - Terminal UI       ║');
  console.log('  ╚═══════════════════════════════════════╝' + C.reset);
  
  const showStatus = () => {
    const data = loadData();
    const status = data.accessEnabled ? C.green + 'ENABLED' : C.red + 'DISABLED';
    console.log(`\n  Agent Access: ${status}`);
    
    console.log(C.cyan + '\n  Connected Platforms:' + C.reset);
    const platforms = Object.keys(data.platforms);
    if (platforms.length === 0) console.log(C.gray + '    (none)' + C.reset);
    platforms.forEach(p => console.log(`    ${C.magenta}◉${C.reset} ${p}`));
    
    console.log(C.cyan + '\n  Stored Tokens:' + C.reset);
    const tokens = Object.keys(data.tokens);
    if (tokens.length === 0) console.log(C.gray + '    (none)' + C.reset);
    tokens.forEach(t => console.log(`    ${C.green}●${C.reset} ${t}`));
    
    console.log(C.cyan + '\n  Commands:' + C.reset);
    console.log('    list, show <name>, add <name>, remove <name>');
    console.log('    platform <name>, disconnect <platform>');
    console.log('    toggle, gui, help, exit');
  };
  
  showStatus();
  prompt();
  
  rl.on('line', (line) => {
    const args = line.trim().split(/\s+/);
    const cmd = args[0].toLowerCase();
    const arg = args[1];
    
    const data = loadData();
    
    switch (cmd) {
      case 'list': case 'ls':
        console.log(C.cyan + '\n  Tokens:' + C.reset);
        Object.keys(data.tokens).forEach(t => console.log(`    ${C.green}●${C.reset} ${t} [${data.tokens[t].type}]`));
        break;
      case 'show':
        if (!arg) { console.log(C.red + '  Usage: show <name>' + C.reset); break; }
        if (!data.accessEnabled) { console.log(C.red + '  Access disabled!' + C.reset); break; }
        if (data.tokens[arg]) console.log(C.gray + `  ${data.tokens[arg].value}` + C.reset);
        else console.log(C.red + '  Not found: ' + arg + C.reset);
        break;
      case 'add':
        if (!arg) { console.log(C.red + '  Usage: add <name>' + C.reset); break; }
        rl.question('  Value: ', (value) => { addToken(arg, value, 'token'); console.log(C.green + `  Added: ${arg}` + C.reset); prompt(); });
        return;
      case 'remove': case 'rm':
        if (!arg) { console.log(C.red + '  Usage: remove <name>' + C.reset); break; }
        removeToken(arg); console.log(C.green + `  Removed: ${arg}` + C.reset);
        break;
      case 'platform':
        if (!arg) { console.log(C.cyan + '\n  Platforms:' + C.reset); Object.keys(data.platforms).forEach(p => console.log(`    ${C.magenta}◉${C.reset} ${p}`)); break; }
        connectPlatform(arg); console.log(C.green + `  Connected: ${arg}` + C.reset);
        break;
      case 'disconnect':
        if (!arg) { console.log(C.red + '  Usage: disconnect <platform>' + C.reset); break; }
        disconnectPlatform(arg); console.log(C.green + `  Disconnected: ${arg}` + C.reset);
        break;
      case 'toggle':
        const newState = toggleAccess();
        console.log(C.green + `  Access: ${newState ? 'ENABLED' : 'DISABLED'}` + C.reset);
        break;
      case 'gui': case 'web':
        console.log(C.cyan + '\n  Starting GUI...\n' + C.reset);
        startWebServer(); return;
      case 'help': case '?':
        showStatus(); break;
      case 'exit': case 'quit':
        console.log(C.gray + '  Bye!' + C.reset); process.exit(0);
      default:
        if (cmd) console.log(C.red + '  Unknown: ' + cmd + C.reset);
    }
    prompt();
  });
}

// Main
function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  
  switch (cmd) {
    case 'gui': case 'web': startWebServer(); break;
    case 'add': case 'set': console.log('Use "token-manager" for interactive mode'); break;
    case 'list': case 'ls': listTokens().forEach(t => console.log(`${t.name} [${t.type}]`)); break;
    case 'toggle': console.log(`Access: ${toggleAccess() ? 'ENABLED' : 'DISABLED'}`); break;
    case 'status': const d = loadData(); console.log(`Access: ${d.accessEnabled ? 'ENABLED' : 'DISABLED'}\nTokens: ${Object.keys(d.tokens).length}\nPlatforms: ${Object.keys(d.platforms).length}`); break;
    case 'platforms': console.log(JSON.stringify(listPlatforms(), null, 2)); break;
    case 'msg': case 'message': 
      // Handle messages from chat platforms
      const message = args.slice(1).join(' ');
      console.log(handleChatMessage(message));
      break;
    case 'webhook':
      // Start webhook server for chat platforms
      startWebhookServer(args[1] || 3848);
      break;
    default: startTerminal();
  }
}

// Handle messages from chat platforms (Discord, Telegram, etc.)
function handleChatMessage(input) {
  const data = loadData();
  const cmd = input.trim().toLowerCase().split(/\s+/)[0];
  const args = input.trim().split(/\s+/).slice(1);
  
  let response = '';
  
  switch (cmd) {
    case 'status':
    case 's':
      response = `🔐 Token Manager Status\n\n` +
        `Agent Access: ${data.accessEnabled ? '✅ ENABLED' : '❌ DISABLED'}\n` +
        `Tokens: ${Object.keys(data.tokens).length}\n` +
        `Platforms: ${Object.keys(data.platforms).length}`;
      break;
      
    case 'tokens':
    case 'list':
    case 'ls':
      const names = Object.keys(data.tokens);
      if (names.length === 0) {
        response = '📭 No tokens stored';
      } else {
        response = '🔑 Stored Tokens:\n' + names.map(n => 
          `• ${n} [${data.tokens[n].type}]`
        ).join('\n');
      }
      break;
      
    case 'platforms':
    case 'platform':
      const platforms = Object.keys(data.platforms);
      if (platforms.length === 0) {
        response = '🔗 No platforms connected';
      } else {
        response = '🔗 Connected Platforms:\n' + platforms.map(p => 
          `• ${p}`
        ).join('\n');
      }
      break;
      
    case 'enable':
    case 'on':
      const newState = toggleAccess(true);
      response = `✅ Agent Access: ${newState ? 'ENABLED' : 'DISABLED'}`;
      break;
      
    case 'disable':
    case 'off':
      toggleAccess(false);
      response = '❌ Agent Access: DISABLED';
      break;
      
    case 'toggle':
    case 'switch':
      const toggled = toggleAccess();
      response = `🔄 Agent Access: ${toggled ? 'ENABLED' : 'DISABLED'}`;
      break;
      
    case 'history':
    case 'log':
      const history = data.history.slice(-10).reverse();
      if (history.length === 0) {
        response = '📝 No history';
      } else {
        response = '📝 Recent History:\n' + history.map(h => {
          const icon = h.action === 'add' ? '➕' : 
                       h.action === 'remove' ? '❌' : 
                       h.action === 'enable' ? '✅' : 
                       h.action === 'disable' ? '❌' : '📝';
          return `${icon} ${h.action}${h.name ? ' ' + h.name : ''}`;
        }).join('\n');
      }
      break;
      
    case 'help':
    case '?':
      response = `🔐 Token Manager Commands:

status (s)    - Show access status
tokens (ls)   - List stored tokens  
platforms     - List connected platforms
enable/on     - Enable agent access
disable/off   - Disable agent access
toggle        - Toggle access
history (log) - Show recent activity
add <name>   - Add token (use GUI)
remove <name> - Remove token (use GUI)
gui           - Open web GUI

Web GUI: http://localhost:3847`;
      break;
      
    default:
      response = `❓ Unknown command: ${cmd}\nType "help" for available commands`;
  }
  
  return response;
}

// Webhook server for chat platforms
function startWebhookServer(port) {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method === 'POST' && req.url === '/webhook') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const message = payload.message || payload.text || payload.content || '';
          const response = handleChatMessage(message);
          res.end(JSON.stringify({ response }));
        } catch (e) {
          res.end(JSON.stringify({ error: 'Invalid payload' }));
        }
      });
      return;
    }
    
    // GET endpoint for status
    if (req.method === 'GET' && req.url === '/status') {
      const data = loadData();
      res.end(JSON.stringify({
        accessEnabled: data.accessEnabled,
        tokens: Object.keys(data.tokens).length,
        platforms: Object.keys(data.platforms).length
      }));
      return;
    }
    
    // OpenClaw message handler endpoint
    if (req.method === 'POST' && req.url === '/message') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const response = handleChatMessage(body);
        res.end(response);
      });
      return;
    }
    
    res.end(JSON.stringify({ error: 'Not found' }));
  });
  
  server.listen(port, () => {
    console.log(`
╔═══════════════════════════════════════╗
║  Token Manager Webhook Server          ║
╠═══════════════════════════════════════╣
║  Webhook: http://localhost:${port}/webhook  ║
║  Status:  http://localhost:${port}/status   ║
║  Message: http://localhost:${port}/message  ║
╚═══════════════════════════════════════╝

Configure your chat platform webhook to point to:
  http://<your-ip>:${port}/webhook

Supported platforms: Discord, Telegram, Lark, etc.
`);
  });
  
  return server;
}

main();
