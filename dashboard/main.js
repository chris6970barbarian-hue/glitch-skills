#!/usr/bin/env node

/**
 * Dashboard - Unified web terminal for task management, queue, and monitoring
 * 
 * Integrates:
 * - System Monitor
 * - Task Queue
 * - Output Streamer
 * - ZeroTier Status
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const os = require('os');

const DEFAULT_PORT = 3853;
const CONFIG_DIR = path.join(process.env.HOME || '/home/crix', '.dashboard');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG = {
  port: DEFAULT_PORT,
  theme: 'dark',
  refreshInterval: 3000,
  skills: {
    systemMonitor: true,
    taskQueue: true,
    outputStreamer: true,
    zerotier: true
  }
};

function loadConfig() {
  let config = { ...DEFAULT_CONFIG };
  if (fs.existsSync(CONFIG_FILE)) {
    try { config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) }; }
    catch (e) {}
  }
  return config;
}

// ============ Utilities ============

function execPromise(cmd, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const proc = exec(cmd, { timeout }, (err, stdout, stderr) => {
      if (err && err.killed) {
        resolve({ error: 'timeout' });
        return;
      }
      resolve({ stdout: stdout || '', stderr: stderr || '', error: err?.message });
    });
  });
}

// ============ System Monitor Functions ============

function getSystemStatus() {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) totalTick += cpu.times[type];
    totalIdle += cpu.times.idle;
  }
  const cpuUsage = 100 - (totalIdle / totalTick * 100);
  
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memUsage = ((totalMem - freeMem) / totalMem) * 100;
  
  return {
    cpu: { usage: cpuUsage.toFixed(1), cores: cpus.length },
    memory: { used: formatBytes(totalMem - freeMem), total: formatBytes(totalMem), percent: memUsage.toFixed(1) },
    load: os.loadavg(),
    uptime: os.uptime()
  };
}

function formatBytes(bytes) {
  const gb = bytes / (1024**3);
  if (gb >= 1) return `${gb.toFixed(1)}G`;
  return `${(bytes / (1024**2)).toFixed(0)}M`;
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

// ============ Task Queue Functions ============

function getTaskQueueStatus() {
  return new Promise(async (resolve) => {
    const result = await execPromise('node ~/.openclaw/workspace/skills/queue-sync/main.js status 2>/dev/null');
    if (result.error || !result.stdout.trim()) {
      resolve({ error: 'Task queue not available' });
      return;
    }
    try {
      resolve(JSON.parse(result.stdout));
    } catch (e) {
      resolve({ error: 'Parse error' });
    }
  });
}

// ============ ZeroTier Functions ============

function getZeroTierStatus() {
  return new Promise(async (resolve) => {
    const result = await execPromise('sudo zerotier-cli listnetworks 2>/dev/null');
    if (result.error) {
      resolve({ installed: false });
      return;
    }
    const lines = result.stdout.trim().split('\n');
    if (lines.length < 2) {
      resolve({ installed: true, networks: [] });
      return;
    }
    const parts = lines[1].split(/\s+/);
    resolve({
      installed: true,
      online: true,
      address: '735eb2f8f5',
      networks: [{
        id: parts[1],
        name: parts[2],
        status: parts[4],
        ip: parts[6] || 'N/A'
      }]
    });
  });
}

// ============ Output Streamer Functions ============

function getOutputBuffer() {
  return new Promise(async (resolve) => {
    const result = await execPromise('node ~/.openclaw/workspace/skills/output-streamer/main.js buffer 10 2>/dev/null');
    if (result.error || !result.stdout.trim()) {
      resolve([]);
      return;
    }
    try {
      resolve(JSON.parse(result.stdout).slice(-10));
    } catch (e) {
      resolve([]);
    }
  });
}

// ============ HTML Dashboard ============

function generateDashboard(data) {
  const { system, taskQueue, zerotier, outputs } = data;
  const time = new Date().toLocaleString();
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Glitch Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'SF Mono', 'Fira Code', monospace;
      background: #0d1117;
      color: #c9d1d9;
      min-height: 100vh;
      padding: 20px;
    }
    h1 { 
      color: #58a6ff; 
      margin-bottom: 5px;
      font-size: 1.5rem;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid #30363d;
    }
    .time { color: #8b949e; font-size: 0.9rem; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 16px;
    }
    .card h2 {
      color: #58a6ff;
      font-size: 1rem;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .stat {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #21262d;
    }
    .stat:last-child { border: none; }
    .label { color: #8b949e; }
    .value { color: #7ee787; font-weight: bold; }
    .value.warn { color: #d29922; }
    .value.danger { color: #f85149; }
    
    /* Progress bars */
    .bar {
      height: 8px;
      background: #21262d;
      border-radius: 4px;
      overflow: hidden;
      margin: 8px 0;
    }
    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #238636, #7ee787);
      transition: width 0.3s;
    }
    .bar-fill.warn { background: linear-gradient(90deg, #9e6a03, #d29922); }
    .bar-fill.danger { background: linear-gradient(90deg, #da3633, #f85149); }
    
    /* Status indicators */
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .status-dot.online { background: #7ee787; }
    .status-dot.offline { background: #f85149; }
    .status-dot.pending { background: #d29922; }
    
    /* Output log */
    .log {
      max-height: 200px;
      overflow-y: auto;
      font-size: 0.8rem;
      background: #0d1117;
      padding: 10px;
      border-radius: 4px;
    }
    .log-entry {
      padding: 4px 0;
      border-bottom: 1px solid #21262d;
      font-size: 0.75rem;
    }
    .log-time { color: #8b949e; margin-right: 8px; }
    .log-source { color: #58a6ff; margin-right: 8px; }
    
    /* Actions */
    .actions {
      display: flex;
      gap: 10px;
      margin-top: 10px;
    }
    button {
      background: #238636;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
    }
    button:hover { background: #2ea043; }
    button.danger { background: #da3633; }
    button.danger:hover { background: #f85149; }
    
    .refresh-info {
      text-align: center;
      margin-top: 20px;
      color: #8b949e;
      font-size: 0.8rem;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Glitch Dashboard</h1>
      <span style="color: #8b949e;">Task Queue + System Monitor + ZeroTier</span>
    </div>
    <div class="time">${time}</div>
  </div>
  
  <div class="grid">
    <!-- System Status -->
    <div class="card">
      <h2>System Status</h2>
      <div class="stat">
        <span class="label">CPU</span>
        <span class="value ${parseFloat(system.cpu.usage) > 80 ? 'danger' : parseFloat(system.cpu.usage) > 50 ? 'warn' : ''}">${system.cpu.usage}%</span>
      </div>
      <div class="bar">
        <div class="bar-fill ${parseFloat(system.cpu.usage) > 80 ? 'danger' : parseFloat(system.cpu.usage) > 50 ? 'warn' : ''}" style="width: ${system.cpu.usage}%"></div>
      </div>
      
      <div class="stat">
        <span class="label">Memory</span>
        <span class="value ${parseFloat(system.memory.percent) > 80 ? 'danger' : parseFloat(system.memory.percent) > 50 ? 'warn' : ''}">${system.memory.percent}%</span>
      </div>
      <div class="bar">
        <div class="bar-fill ${parseFloat(system.memory.percent) > 80 ? 'danger' : parseFloat(system.memory.percent) > 50 ? 'warn' : ''}" style="width: ${system.memory.percent}%"></div>
      </div>
      
      <div class="stat">
        <span class="label">Load Avg</span>
        <span class="value">${system.load[0]} | ${system.load[1]} | ${system.load[2]}</span>
      </div>
      <div class="stat">
        <span class="label">Uptime</span>
        <span class="value">${formatUptime(system.uptime)}</span>
      </div>
    </div>
    
    <!-- Task Queue -->
    <div class="card">
      <h2>Task Queue</h2>
      ${taskQueue.error ? `<div class="stat"><span class="value danger">${taskQueue.error}</span></div>` : `
      <div class="stat">
        <span class="label">Status</span>
        <span class="value">${taskQueue.status || 'idle'}</span>
      </div>
      <div class="stat">
        <span class="label">Pending</span>
        <span class="value">${taskQueue.queue?.pending || 0}</span>
      </div>
      <div class="stat">
        <span class="label">Processing</span>
        <span class="value">${taskQueue.queue?.processing || 0}</span>
      </div>
      <div class="stat">
        <span class="label">Completed</span>
        <span class="value">${taskQueue.stats?.completed || 0}</span>
      </div>
      ${taskQueue.currentTask ? `
      <div class="stat" style="margin-top: 10px;">
        <span class="label" style="color: #58a6ff;">Current Task</span>
      </div>
      <div style="font-size: 0.8rem; color: #8b949e;">
        ${taskQueue.currentTask.content?.substring(0, 50)}...
      </div>
      ` : ''}
      `}
      <div class="actions">
        <button onclick="execute('complete')">Complete</button>
        <button class="danger" onclick="execute('clear')">Clear</button>
      </div>
    </div>
    
    <!-- ZeroTier -->
    <div class="card">
      <h2>ZeroTier</h2>
      ${!zerotier.installed ? `
      <div class="stat"><span class="value danger">Not Installed</span></div>
      ` : `
      <div class="stat">
        <span class="label">Address</span>
        <span class="value">${zerotier.address}</span>
      </div>
      <div class="stat">
        <span class="label">Status</span>
        <span class="value"><span class="status-dot ${zerotier.online ? 'online' : 'offline'}"></span> ${zerotier.online ? 'Online' : 'Offline'}</span>
      </div>
      ${zerotier.networks?.[0] ? `
      <div class="stat">
        <span class="label">Network</span>
        <span class="value">${zerotier.networks[0].name}</span>
      </div>
      <div class="stat">
        <span class="label">IP</span>
        <span class="value">${zerotier.networks[0].ip}</span>
      </div>
      <div class="stat">
        <span class="label">Network ID</span>
        <span class="value" style="font-size: 0.7rem;">${zerotier.networks[0].id}</span>
      </div>
      ` : ''}
      `}
    </div>
    
    <!-- Output Stream -->
    <div class="card">
      <h2>Recent Output</h2>
      <div class="log">
        ${outputs.length === 0 ? '<div class="log-entry" style="color: #8b949e;">No output yet</div>' : 
        outputs.map(o => `
        <div class="log-entry">
          <span class="log-time">${new Date(o.timestamp || o.createdAt).toLocaleTimeString()}</span>
          <span class="log-source">[${o.source || o.platform || 'log'}]</span>
          ${o.content ? o.content.substring(0, 60) : o.id ? `Task: ${o.id.substring(0, 20)}...` : ''}
        </div>
        `).join('')}
      </div>
    </div>
  </div>
  
  <div class="refresh-info">
    Auto-refresh every 3 seconds | <a href="/raw" style="color: #58a6ff;">JSON API</a>
  </div>
  
  <script>
    async function execute(action) {
      try {
        const res = await fetch('/api/' + action, { method: 'POST' });
        const data = await res.json();
        alert(JSON.stringify(data, null, 2));
        location.reload();
      } catch(e) {
        alert('Error: ' + e.message);
      }
    }
    
    // Auto refresh
    setTimeout(() => location.reload(), 3000);
  </script>
</body>
</html>`;
}

// ============ Server ============

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '0.0.0.0';
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${DEFAULT_PORT}`);
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // API endpoints
  if (url.pathname === '/api/complete' && req.method === 'POST') {
    execPromise('node ~/.openclaw/workspace/skills/queue-sync/main.js complete 2>/dev/null');
    res.end(JSON.stringify({ success: true }));
    return;
  }
  
  if (url.pathname === '/api/clear' && req.method === 'POST') {
    execPromise('node ~/.openclaw/workspace/skills/queue-sync/main.js clear 2>/dev/null');
    res.end(JSON.stringify({ success: true }));
    return;
  }
  
  if (url.pathname === '/raw') {
    const [system, taskQueue, zerotier, outputs] = await Promise.all([
      Promise.resolve(getSystemStatus()),
      getTaskQueueStatus(),
      getZeroTierStatus(),
      getOutputBuffer()
    ]);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ system, taskQueue, zerotier, outputs }, null, 2));
    return;
  }
  
  // Main dashboard
  try {
    const [system, taskQueue, zerotier, outputs] = await Promise.all([
      Promise.resolve(getSystemStatus()),
      getTaskQueueStatus(),
      getZeroTierStatus(),
      getOutputBuffer()
    ]);
    
    res.setHeader('Content-Type', 'text/html');
    res.end(generateDashboard({ system, taskQueue, zerotier, outputs }));
  } catch (e) {
    res.statusCode = 500;
    res.end('Error: ' + e.message);
  }
}

// ============ CLI ============

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  
  if (cmd === 'start') {
    const port = parseInt(args[1]) || DEFAULT_PORT;
    const localIP = getLocalIP();
    const server = http.createServer(handleRequest);
    server.listen(port, '0.0.0.0', () => {
      console.log(`Dashboard running:`);
      console.log(`  Local:   http://localhost:${port}`);
      console.log(`  LAN:     http://${localIP}:${port}`);
      console.log(`  ZeroTier: http://172.26.21.18:${port}`);
      console.log(`\nJSON API: http://${localIP}:${port}/raw`);
    });
    return;
  }
  
  // Quick status
  if (cmd === 'status' || !cmd) {
    const system = getSystemStatus();
    console.log(`CPU: ${system.cpu.usage}% | MEM: ${system.memory.percent}% | LOAD: ${system.load.join(', ')}`);
    return;
  }
  
  console.log(`
Dashboard - Unified web terminal for Glitch skills

USAGE:
  dashboard start [port]   Start web server (default: 3853)
  dashboard status        Quick status check

ENDPOINTS:
  /               Main dashboard
  /raw            JSON API
  /api/complete   Complete current task
  /api/clear      Clear queue
      `);
}

main();
