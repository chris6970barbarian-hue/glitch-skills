#!/usr/bin/env node

/**
 * Token Manager - Centralized token management with GUI
 * 
 * Features:
 * - Store tokens securely (GitHub, AGDP, ClawHub, etc.)
 * - Web GUI on localhost
 * - Access control toggle
 * - Beautiful terminal UI
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec, spawn } = require('child_process');

const C = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m'
};

const CONFIG_DIR = path.join(process.env.HOME || '/home/crix', '.token-manager');
const DATA_FILE = path.join(CONFIG_DIR, 'tokens.json');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Ensure config directory
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Default data structure
const DEFAULT_DATA = {
  accessEnabled: false,
  tokens: {},
  history: []
};

// Load data
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

// Save data
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Load config
function loadConfig() {
  const defaultConfig = { port: 3847 };
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

// Add token
function addToken(name, value, type = 'text') {
  const data = loadData();
  data.tokens[name] = {
    value,
    type,
    addedAt: new Date().toISOString(),
    lastUsed: null
  };
  data.history.push({ action: 'add', name, timestamp: new Date().toISOString() });
  saveData(data);
}

// Remove token
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

// Get token (only if access enabled)
function getToken(name) {
  const data = loadData();
  if (!data.accessEnabled) {
    return null;
  }
  if (data.tokens[name]) {
    data.tokens[name].lastUsed = new Date().toISOString();
    saveData(data);
    return data.tokens[name].value;
  }
  return null;
}

// Toggle access
function toggleAccess(enable = null) {
  const data = loadData();
  if (enable !== null) {
    data.accessEnabled = enable;
  } else {
    data.accessEnabled = !data.accessEnabled;
  }
  data.history.push({ 
    action: data.accessEnabled ? 'enable' : 'disable', 
    timestamp: new Date().toISOString() 
  });
  saveData(data);
  return data.accessEnabled;
}

// List tokens (without values)
function listTokens() {
  const data = loadData();
  return Object.entries(data.tokens).map(([name, info]) => ({
    name,
    type: info.type,
    addedAt: info.addedAt,
    lastUsed: info.lastUsed
  }));
}

// Web GUI
function startWebServer() {
  const config = loadConfig();
  const port = config.port || 3847;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Token Manager</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117; color: #c9d1d9; min-height: 100vh;
    }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #58a6ff; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
    .status-badge {
      padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;
    }
    .status-enabled { background: #238636; color: white; }
    .status-disabled { background: #da3633; color: white; }
    .card {
      background: #161b22; border: 1px solid #30363d; border-radius: 6px;
      padding: 16px; margin-bottom: 16px;
    }
    .toggle-row { display: flex; justify-content: space-between; align-items: center; }
    .toggle {
      position: relative; width: 50px; height: 26px;
    }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle-slider {
      position: absolute; cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background: #da3633; border-radius: 26px;
      transition: 0.3s;
    }
    .toggle-slider:before {
      position: absolute; content: "";
      height: 20px; width: 20px; left: 3px; bottom: 3px;
      background: white; border-radius: 50%;
      transition: 0.3s;
    }
    .toggle input:checked + .toggle-slider { background: #238636; }
    .toggle input:checked + .toggle-slider:before { transform: translateX(24px); }
    .token-list { list-style: none; }
    .token-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px; border-bottom: 1px solid #30363d;
    }
    .token-item:last-child { border-bottom: none; }
    .token-name { font-weight: bold; color: #58a6ff; }
    .token-type { font-size: 12px; color: #8b949e; }
    .token-meta { font-size: 11px; color: #6e7681; }
    .btn {
      padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer;
      font-size: 12px; margin-left: 8px;
    }
    .btn-add { background: #238636; color: white; }
    .btn-remove { background: #da3633; color: white; }
    .btn-copy { background: #30363d; color: #c9d1d9; }
    .form-group { margin-bottom: 12px; }
    label { display: block; margin-bottom: 4px; color: #8b949e; font-size: 12px; }
    input, select {
      width: 100%; padding: 8px; background: #0d1117;
      border: 1px solid #30363d; border-radius: 6px; color: #c9d1d9;
    }
    .history { max-height: 200px; overflow-y: auto; }
    .history-item {
      padding: 8px; font-size: 12px; border-bottom: 1px solid #30363d;
    }
    .history-add { color: #238636; }
    .history-remove { color: #da3633; }
    .history-enable { color: #58a6ff; }
    .history-disable { color: #f0883e; }
    .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
    .tab {
      padding: 8px 16px; background: #21262d; border: 1px solid #30363d;
      border-radius: 6px; cursor: pointer; color: #8b949e;
    }
    .tab.active { background: #58a6ff; color: white; border-color: #58a6ff; }
    .hidden { display: none; }
    .warning {
      background: #f0883e; border: 1px20 solid #f0883e;
      padding: 12px; border-radius: 6px; color: #f0883e; margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Token Manager</h1>
    
    <div class="card">
      <div class="toggle-row">
        <div>
          <strong>Agent Access</strong>
          <p style="font-size: 12px; color: #8b949e;">Allow agent to access tokens</p>
        </div>
        <label class="toggle">
          <input type="checkbox" id="accessToggle" onchange="toggleAccess(this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
    
    <div id="warningMsg" class="warning hidden">
      ⚠️ Agent access is DISABLED. Tokens are locked.
    </div>
    
    <div class="tabs">
      <button class="tab active" onclick="showTab('tokens')">Tokens</button>
      <button class="tab" onclick="showTab('add')">Add Token</button>
      <button class="tab" onclick="showTab('history')">History</button>
    </div>
    
    <div id="tab-tokens" class="card">
      <ul class="token-list" id="tokenList"></ul>
    </div>
    
    <div id="tab-add" class="card hidden">
      <div class="form-group">
        <label>Token Name</label>
        <input type="text" id="tokenName" placeholder="e.g., github, agdp, claude">
      </div>
      <div class="form-group">
        <label>Token Value</label>
        <input type="password" id="tokenValue" placeholder="Paste your token here">
      </div>
      <div class="form-group">
        <label>Type</label>
        <select id="tokenType">
          <option value="text">Text</option>
          <option value="json">JSON</option>
          <option value="api_key">API Key</option>
          <option value="token">Token</option>
        </select>
      </div>
      <button class="btn btn-add" onclick="addToken()">Add Token</button>
    </div>
    
    <div id="tab-history" class="card hidden">
      <div class="history" id="historyList"></div>
    </div>
  </div>
  
  <script>
    let accessEnabled = false;
    
    async function loadData() {
      const res = await fetch('/api/data');
      const data = await res.json();
      accessEnabled = data.accessEnabled;
      
      document.getElementById('accessToggle').checked = accessEnabled;
      document.getElementById('warningMsg').classList.toggle('hidden', accessEnabled);
      
      renderTokens(data.tokens);
      renderHistory(data.history);
    }
    
    function renderTokens(tokens) {
      const list = document.getElementById('tokenList');
      const names = Object.keys(tokens);
      
      if (names.length === 0) {
        list.innerHTML = '<li class="token-item" style="color: #8b949e;">No tokens stored</li>';
        return;
      }
      
      list.innerHTML = names.map(name => {
        const t = tokens[name];
        return \`
          <li class="token-item">
            <div>
              <span class="token-name">\${name}</span>
              <span class="token-type">\${t.type}</span>
              <div class="token-meta">
                Added: \${new Date(t.addedAt).toLocaleString()}
                \${t.lastUsed ? ' | Last used: ' + new Date(t.lastUsed).toLocaleString() : ''}
              </div>
            </div>
            <div>
              <button class="btn btn-copy" onclick="copyToken('\${name}')">Copy</button>
              <button class="btn btn-remove" onclick="removeToken('\${name}')">Remove</button>
            </div>
          </li>
        \`;
      }).join('');
    }
    
    function renderHistory(history) {
      const list = document.getElementById('historyList');
      const icons = { add: '+', remove: '×', enable: '◉', disable: '○' };
      const classes = { add: 'history-add', remove: 'history-remove', enable: 'history-enable', disable: 'history-disable' };
      
      list.innerHTML = history.slice().reverse().slice(0, 50).map(h => \`
        <div class="history-item \${classes[h.action] || ''}">
          <span class="\${classes[h.action] || ''}">\${icons[h.action] || '•'}</span>
          \${h.action} \${h.name || ''}
          <span style="color: #6e7681; float: right;">\${new Date(h.timestamp).toLocaleString()}</span>
        </div>
      \`).join('');
    }
    
    async function toggleAccess(enabled) {
      await fetch('/api/toggle', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      loadData();
    }
    
    async function addToken() {
      const name = document.getElementById('tokenName').value;
      const value = document.getElementById('tokenValue').value;
      const type = document.getElementById('tokenType').value;
      
      if (!name || !value) return alert('Please fill all fields');
      
      await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, value, type })
      });
      
      document.getElementById('tokenName').value = '';
      document.getElementById('tokenValue').value = '';
      loadData();
      showTab('tokens');
    }
    
    async function removeToken(name) {
      if (!confirm('Delete token "' + name + '"?')) return;
      await fetch('/api/token/' + name, { method: 'DELETE' });
      loadData();
    }
    
    async function copyToken(name) {
      const res = await fetch('/api/token/' + name);
      const data = await res.json();
      if (data.value) {
        await navigator.clipboard.writeText(data.value);
        alert('Token copied to clipboard!');
      }
    }
    
    function showTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('#tab-tokens, #tab-add, #tab-history').forEach(t => t.classList.add('hidden'));
      
      event.target.classList.add('active');
      document.getElementById('tab-' + tab).classList.remove('hidden');
      
      if (tab === 'tokens') loadData();
    }
    
    loadData();
  </script>
</body>
</html>
`;
  
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    const data = loadData();
    
    if (req.url === '/api/data') {
      // Return token names but not values (except via separate endpoint)
      const safeData = {
        accessEnabled: data.accessEnabled,
        tokens: Object.fromEntries(
          Object.entries(data.tokens).map(([k, v]) => [k, { 
            type: v.type, 
            addedAt: v.addedAt, 
            lastUsed: v.lastUsed 
          }])
        ),
        history: data.history
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(safeData));
      return;
    }
    
    if (req.url === '/api/toggle' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const { enabled } = JSON.parse(body);
        toggleAccess(enabled);
        res.writeHead(200);
        res.end('{}');
      });
      return;
    }
    
    if (req.url.startsWith('/api/token/') && req.method === 'GET') {
      const name = req.url.replace('/api/token/', '');
      const token = data.tokens[name];
      if (token) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ value: data.accessEnabled ? token.value : null }));
      } else {
        res.writeHead(404);
        res.end('{}');
      }
      return;
    }
    
    if (req.url === '/api/token' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const { name, value, type } = JSON.parse(body);
        addToken(name, value, type);
        res.writeHead(200);
        res.end('{}');
      });
      return;
    }
    
    if (req.url.startsWith('/api/token/') && req.method === 'DELETE') {
      const name = req.url.replace('/api/token/', '');
      removeToken(name);
      res.writeHead(200);
      res.end('{}');
      return;
    }
    
    // Serve HTML
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });
  
  server.listen(port, () => {
    console.log(`\n  🔐 Token Manager GUI: http://localhost:${port}\n`);
    console.log(`  Press Ctrl+C to stop\n`);
  });
  
  return server;
}

// Terminal UI
function showTerminalUI() {
  const data = loadData();
  
  console.clear();
  console.log(C.cyan + C.bright + '\n╔═══════════════════════════════════════╗');
  console.log('║     🔐 TOKEN MANAGER - Terminal UI    ║');
  console.log('╚═══════════════════════════════════════╝' + C.reset);
  
  // Status
  const status = data.accessEnabled ? C.green + 'ENABLED' : C.red + 'DISABLED';
  console.log(`\n  Agent Access: ${status}`);
  console.log(C.gray + '  Type "toggle" to change\n' + C.reset);
  
  // Tokens
  console.log(C.cyan + '  Stored Tokens:' + C.reset);
  const names = Object.keys(data.tokens);
  if (names.length === 0) {
    console.log(C.gray + '    (none)' + C.reset);
  } else {
    names.forEach(name => {
      const t = data.tokens[name];
      console.log(`    ${C.green}●${C.reset} ${C.bright}${name}${C.reset} [${t.type}] ${C.gray}(added ${new Date(t.addedAt).toLocaleDateString()})${C.reset}`);
    });
  }
  
  // Actions
  console.log(C.cyan + '\n  Actions:' + C.reset);
  console.log('    list              - Show all tokens (values hidden)');
  console.log('    show <name>       - Show token value');
  console.log('    add <name>        - Add new token');
  console.log('    remove <name>     - Remove token');
  console.log('    toggle            - Toggle agent access');
  console.log('    gui               - Open web GUI');
  console.log('    exit              - Exit');
  
  console.log(C.gray + '\n  Type command and press Enter:' + C.reset + '\n  ');
}

// Interactive terminal
function startTerminal() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const prompt = () => rl.write('  > ');
  
  console.clear();
  showTerminalUI();
  prompt();
  
  rl.on('line', (line) => {
    const args = line.trim().split(/\s+/);
    const cmd = args[0].toLowerCase();
    const arg = args[1];
    
    switch (cmd) {
      case 'list':
      case 'ls':
        const data = loadData();
        console.log(C.cyan + '\n  Tokens:' + C.reset);
        Object.keys(data.tokens).forEach(name => {
          console.log(`    ${C.green}●${C.reset} ${name}`);
        });
        break;
        
      case 'show':
      case 'cat':
        if (!arg) {
          console.log(C.red + '  Usage: show <name>' + C.reset);
          break;
        }
        const d = loadData();
        if (d.tokens[arg]) {
          if (!d.accessEnabled) {
            console.log(C.red + '  Access disabled! Enable first: toggle' + C.reset);
          } else {
            console.log(C.green + `  ${arg}:${C.reset}`);
            console.log(C.gray + `  ${d.tokens[arg].value}` + C.reset);
          }
        } else {
          console.log(C.red + '  Token not found: ' + arg + C.reset);
        }
        break;
        
      case 'add':
        if (!arg) {
          console.log(C.red + '  Usage: add <name>' + C.reset);
          break;
        }
        rl.question('  Token value: ', (value) => {
          addToken(arg, value, 'token');
          console.log(C.green + `  Added: ${arg}` + C.reset);
          prompt();
        });
        return;
        
      case 'remove':
      case 'rm':
      case 'delete':
        if (!arg) {
          console.log(C.red + '  Usage: remove <name>' + C.reset);
          break;
        }
        if (removeToken(arg)) {
          console.log(C.green + `  Removed: ${arg}` + C.reset);
        } else {
          console.log(C.red + '  Token not found: ' + arg + C.reset);
        }
        break;
        
      case 'toggle':
        const newState = toggleAccess();
        console.log(C.green + `  Agent access: ${newState ? 'ENABLED' : 'DISABLED'}` + C.reset);
        break;
        
      case 'gui':
      case 'web':
        console.log(C.cyan + '\n  Starting web GUI...\n' + C.reset);
        startWebServer();
        return;
        
      case 'help':
      case '?':
        showTerminalUI();
        break;
        
      case 'exit':
      case 'quit':
        console.log(C.gray + '  Goodbye!' + C.reset);
        process.exit(0);
        return;
        
      case '':
        break;
        
      default:
        console.log(C.red + '  Unknown command: ' + cmd + C.reset);
        console.log(C.gray + '  Type "help" for available commands' + C.reset);
    }
    
    prompt();
  });
}

// Main
function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  
  switch (cmd) {
    case 'gui':
    case 'web':
      startWebServer();
      break;
      
    case 'add':
      if (!args[1]) {
        console.log('Usage: token-manager add <name>');
        process.exit(1);
      }
      const name = args[1];
      console.log(`Adding token: ${name}`);
      console.log('(Interactive mode - use "token-manager" for terminal UI)');
      break;
      
    case 'list':
    case 'ls':
      const tokens = listTokens();
      tokens.forEach(t => console.log(`  ${t.name} [${t.type}]`));
      break;
      
    case 'toggle':
      const newState = toggleAccess();
      console.log(`Agent access: ${newState ? 'ENABLED' : 'DISABLED'}`);
      break;
      
    case 'status':
      const data = loadData();
      console.log(`Access: ${data.accessEnabled ? 'ENABLED' : 'DISABLED'}`);
      console.log(`Tokens: ${Object.keys(data.tokens).length}`);
      break;
      
    default:
      startTerminal();
  }
}

main();
