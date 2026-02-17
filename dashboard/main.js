#!/usr/bin/env node

/**
 * Dashboard - Unified web terminal with sidebar navigation
 * 
 * Sidebar sections:
 * - Overview (home)
 * - ZeroTier
 * - Task Queue
 * - Token Manager
 * - System Monitor
 * - Recent Output
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

const DEFAULT_PORT = 3853;

function execPromise(cmd, timeout = 2000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout }, (err, stdout, stderr) => {
      resolve({ stdout: stdout || '', stderr: stderr || '', error: err?.message });
    });
  });
}

// ============ Data Fetchers ============

function getSystemStatus() {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) totalTick += cpu.times[type];
    totalIdle += cpu.times.idle;
  }
  return {
    cpu: { usage: (100 - (totalIdle / totalTick * 100)).toFixed(1), cores: cpus.length },
    memory: { percent: ((1 - os.freemem() / os.totalmem()) * 100).toFixed(1), used: formatBytes(os.totalmem() - os.freemem()), total: formatBytes(os.totalmem()) },
    load: os.loadavg(),
    uptime: os.uptime()
  };
}

function formatBytes(b) {
  return b >= 1073741824 ? `${(b/1073741824).toFixed(1)}G` : `${(b/1048576).toFixed(0)}M`;
}

function formatUptime(s) {
  const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60);
  return `${d}d ${h}h ${m}m`;
}

function getZeroTierStatus() {
  return new Promise(async (resolve) => {
    const r = await execPromise('sudo zerotier-cli listnetworks 2>/dev/null');
    if (r.error) { resolve({installed:false}); return; }
    const lines = r.stdout.trim().split('\n');
    if (lines.length < 2) { resolve({installed:true,networks:[]}); return; }
    const p = lines[1].split(/\s+/);
    resolve({installed:true,online:true,address:'735eb2f8f5',networks:[{id:p[1],name:p[2],status:p[4],ip:p[6]||'N/A'}]});
  });
}

function getTokenManagerStatus() {
  // Mock data for token manager
  return Promise.resolve({
    running: true,
    port: 3847,
    tokens: [
      { name: 'OpenAI', key: 'sk-...abc', status: 'active', used: 85 },
      { name: 'Anthropic', key: 'sk-ant-...xyz', status: 'active', used: 42 },
      { name: 'Brave Search', key: 'BSA...', status: 'active', used: 12 },
      { name: 'ZeroTier', key: 'ZT...', status: 'active', used: 0 }
    ],
    recentActivity: [
      { time: new Date().toISOString(), action: 'Token check', service: 'OpenAI' },
      { time: new Date(Date.now()-60000).toISOString(), action: 'API call', service: 'Anthropic' },
      { time: new Date(Date.now()-120000).toISOString(), action: 'Search', service: 'Brave' }
    ]
  });
}

function getTaskQueueStatus() {
  return Promise.resolve({
    status: 'idle',
    stats: { pending: 2, processing: 0, completed: 5 },
    tasks: [
      { id: 'task_1', content: 'Deploy new skill to production', platform: 'discord', priority: 1, state: 'pending', createdAt: new Date().toISOString(),
        subtasks: [{id:'s1',content:'Update README',state:'pending'},{id:'s2',content:'Push to GitHub',state:'pending'},{id:'s3',content:'Test locally',state:'pending'}] },
      { id: 'task_2', content: 'Fix dashboard UI responsive layout', platform: 'telegram', priority: 2, state: 'pending', createdAt: new Date().toISOString(), subtasks: [] },
      { id: 'task_3', content: 'Monitor system resources', platform: 'lark', priority: 3, state: 'completed', createdAt: new Date().toISOString(), subtasks: [] }
    ]
  });
}

function getOutputBuffer() {
  return Promise.resolve([
    { timestamp: new Date().toISOString(), source: 'system', content: 'Dashboard server started' },
    { timestamp: new Date(Date.now()-60000).toISOString(), source: 'task-queue', content: 'Task added to queue' },
    { timestamp: new Date(Date.now()-120000).toISOString(), source: 'zerotier', content: 'Connected to network' },
    { timestamp: new Date(Date.now()-180000).toISOString(), source: 'token', content: 'Token balance checked' }
  ]);
}

// ============ HTML ============

function generateDashboard(data, activePage = 'overview') {
  const { system, zerotier, tokenManager, taskQueue, outputs } = data;
  const time = new Date().toLocaleString();
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Glitch Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0a0e17;
      --bg-sidebar: #0d1117;
      --bg-card: #111827;
      --bg-hover: #1a1f2e;
      --accent-cyan: #00f5ff;
      --accent-purple: #a855f7;
      --accent-green: #6bcb77;
      --accent-yellow: #ffd93d;
      --accent-red: #ff6b6b;
      --accent-pink: #ff006e;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --border: rgba(255,255,255,0.06);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'JetBrains Mono', monospace; background: var(--bg-primary); color: var(--text-primary); min-height: 100vh; display: flex; }
    
    /* Sidebar */
    .sidebar {
      width: 72px;
      background: var(--bg-sidebar);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      padding: 16px 8px;
      position: fixed;
      height: 100vh;
      z-index: 100;
    }
    .sidebar-logo {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 20px;
      margin: 0 auto 24px;
      box-shadow: 0 0 20px rgba(0,245,255,0.3);
    }
    .nav-item {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s;
      color: var(--text-muted);
      font-size: 20px;
      position: relative;
    }
    .nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
    .nav-item.active { background: rgba(0,245,255,0.1); color: var(--accent-cyan); }
    .nav-item.active::before {
      content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%);
      width: 3px; height: 24px; background: var(--accent-cyan); border-radius: 0 2px 2px 0;
    }
    .nav-tooltip {
      position: absolute;
      left: 64px;
      background: var(--bg-card);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      white-space: nowrap;
      opacity: 0; pointer-events: none; transition: opacity 0.2s;
      border: 1px solid var(--border);
    }
    .nav-item:hover .nav-tooltip { opacity: 1; }
    
    /* Main Content */
    .main { flex: 1; margin-left: 72px; padding: 24px; min-height: 100vh; }
    
    .header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;
      padding-bottom: 16px; border-bottom: 1px solid var(--border);
    }
    .header h1 { font-family: 'Space Grotesk', sans-serif; font-size: 1.5rem; font-weight: 700;
      background: linear-gradient(90deg, var(--accent-cyan), var(--accent-purple)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .header-right { display: flex; align-items: center; gap: 16px; }
    .status-badge { display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: rgba(107,203,119,0.1);
      border-radius: 20px; font-size: 12px; color: var(--accent-green); }
    .status-dot { width: 8px; height: 8px; background: var(--accent-green); border-radius: 50%; animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    .time { color: var(--text-secondary); font-size: 14px; }
    
    /* Cards */
    .card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px;
      padding: 20px; margin-bottom: 16px;
    }
    .card-title {
      font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 600;
      color: var(--text-primary); margin-bottom: 16px; display: flex; align-items: center; gap: 8px;
    }
    .card-icon {
      width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px;
    }
    .card-icon.cyan { background: rgba(0,245,255,0.1); color: var(--accent-cyan); }
    .card-icon.purple { background: rgba(168,85,247,0.1); color: var(--accent-purple); }
    .card-icon.green { background: rgba(107,203,119,0.1); color: var(--accent-green); }
    .card-icon.yellow { background: rgba(255,217,61,0.1); color: var(--accent-yellow); }
    .card-icon.pink { background: rgba(255,0,110,0.1); color: var(--accent-pink); }
    
    /* Overview Grid */
    .overview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .overview-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px;
      cursor: pointer; transition: all 0.2s;
    }
    .overview-card:hover { border-color: var(--accent-cyan); transform: translateY(-2px); }
    .overview-value { font-family: 'Space Grotesk', sans-serif; font-size: 28px; font-weight: 700; }
    .overview-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
    
    /* Progress */
    .progress { margin: 12px 0; }
    .progress-header { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
    .progress-bar { height: 6px; background: var(--bg-hover); border-radius: 3px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 3px; }
    .progress-fill.cyan { background: linear-gradient(90deg, var(--accent-cyan), #00d4ff); }
    .progress-fill.purple { background: linear-gradient(90deg, var(--accent-purple), #c084fc); }
    .progress-fill.green { background: linear-gradient(90deg, var(--accent-green), #4ade80); }
    
    /* Task List */
    .task-item {
      background: var(--bg-hover); border-radius: 8px; padding: 12px; margin-bottom: 8px;
      border-left: 3px solid var(--accent-yellow);
    }
    .task-item.processing { border-left-color: var(--accent-cyan); }
    .task-item.completed { border-left-color: var(--accent-green); opacity: 0.6; }
    .task-content { font-size: 13px; margin-bottom: 6px; }
    .task-meta { font-size: 11px; color: var(--text-muted); display: flex; gap: 12px; }
    .subtasks { margin-top: 8px; padding-left: 12px; border-left: 2px solid var(--border); }
    .subtask { font-size: 12px; color: var(--text-secondary); padding: 4px 0; display: flex; align-items: center; gap: 8px; }
    .subtask.completed { text-decoration: line-through; opacity: 0.5; }
    .subtask input[type="checkbox"] { accent-color: var(--accent-green); }
    
    /* Token List */
    .token-item {
      display: flex; justify-content: space-between; align-items: center; padding: 12px 0;
      border-bottom: 1px solid var(--border);
    }
    .token-item:last-child { border: none; }
    .token-name { font-weight: 600; }
    .token-key { font-size: 11px; color: var(--text-muted); font-family: monospace; }
    .token-status { padding: 4px 10px; border-radius: 12px; font-size: 11px; }
    .token-status.active { background: rgba(107,203,119,0.1); color: var(--accent-green); }
    
    /* Log */
    .log-entry { padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 12px; display: flex; gap: 12px; }
    .log-entry:last-child { border: none; }
    .log-time { color: var(--text-muted); white-space: nowrap; }
    .log-source { color: var(--accent-purple); white-space: nowrap; }
    .log-content { color: var(--text-secondary); }
    
    /* ZT IP */
    .zt-ip { font-family: 'Space Grotesk', sans-serif; font-size: 32px; font-weight: 700; color: var(--accent-cyan);
      text-align: center; padding: 20px; background: var(--bg-hover); border-radius: 12px; margin: 12px 0; }
    .zt-address { text-align: center; font-size: 12px; color: var(--text-muted); }
    .zt-address span { color: var(--accent-purple); font-family: monospace; }
    
    /* Page sections */
    .page { display: none; }
    .page.active { display: block; }
  </style>
</head>
<body>
  <!-- Sidebar -->
  <nav class="sidebar">
    <div class="sidebar-logo">G</div>
    <div class="nav-item ${activePage==='overview'?'active':''}" onclick="navigate('overview')">
      <span>⌂</span>
      <span class="nav-tooltip">Overview</span>
    </div>
    <div class="nav-item ${activePage==='zerotier'?'active':''}" onclick="navigate('zerotier')">
      <span>Z</span>
      <span class="nav-tooltip">ZeroTier</span>
    </div>
    <div class="nav-item ${activePage==='tasks'?'active':''}" onclick="navigate('tasks')">
      <span>Q</span>
      <span class="nav-tooltip">Task Queue</span>
    </div>
    <div class="nav-item ${activePage==='tokens'?'active':''}" onclick="navigate('tokens')">
      <span>T</span>
      <span class="nav-tooltip">Token Manager</span>
    </div>
    <div class="nav-item ${activePage==='system'?'active':''}" onclick="navigate('system')">
      <span>S</span>
      <span class="nav-tooltip">System Monitor</span>
    </div>
    <div class="nav-item ${activePage==='output'?'active':''}" onclick="navigate('output')">
      <span>L</span>
      <span class="nav-tooltip">Recent Output</span>
    </div>
  </nav>
  
  <!-- Main Content -->
  <main class="main">
    <header class="header">
      <h1>Glitch Dashboard</h1>
      <div class="header-right">
        <div class="status-badge"><div class="status-dot"></div> Online</div>
        <div class="time">${time}</div>
      </div>
    </header>
    
    <!-- Overview Page -->
    <div class="page ${activePage==='overview'?'active':''}" id="page-overview">
      <div class="overview-grid">
        <div class="overview-card" onclick="navigate('system')">
          <div class="card-icon cyan" style="width:32px;height:32px;font-size:16px;margin-bottom:8px;">S</div>
          <div class="overview-value" style="color:var(--accent-cyan)">${system.cpu.usage}%</div>
          <div class="overview-label">CPU Usage</div>
        </div>
        <div class="overview-card" onclick="navigate('system')">
          <div class="overview-value" style="color:var(--accent-purple)">${system.memory.percent}%</div>
          <div class="overview-label">Memory Used</div>
        </div>
        <div class="overview-card" onclick="navigate('zerotier')">
          <div class="overview-value" style="color:var(--accent-green)">${zerotier.networks?.[0]?.ip || 'N/A'}</div>
          <div class="overview-label">ZeroTier IP</div>
        </div>
        <div class="overview-card" onclick="navigate('tasks')">
          <div class="overview-value" style="color:var(--accent-yellow)">${taskQueue.stats.pending}</div>
          <div class="overview-label">Pending Tasks</div>
        </div>
        <div class="overview-card" onclick="navigate('tokens')">
          <div class="overview-value" style="color:var(--accent-pink)">${tokenManager.tokens.length}</div>
          <div class="overview-label">Active Tokens</div>
        </div>
      </div>
      
      <div class="card" style="margin-top:16px">
        <div class="card-title"><div class="card-icon cyan">S</div> Quick Status</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px">
          <div>
            <div class="progress">
              <div class="progress-header"><span>CPU</span><span>${system.cpu.usage}%</span></div>
              <div class="progress-bar"><div class="progress-fill cyan" style="width:${system.cpu.usage}%"></div></div>
            </div>
            <div class="progress">
              <div class="progress-header"><span>Memory</span><span>${system.memory.percent}%</span></div>
              <div class="progress-bar"><div class="progress-fill purple" style="width:${system.memory.percent}%"></div></div>
            </div>
          </div>
          <div>
            <div class="task-item">
              <div class="task-content">${taskQueue.tasks[0]?.content || 'No tasks'}</div>
              <div class="task-meta"><span>[${taskQueue.tasks[0]?.platform || '-'}]</span><span>Priority: ${taskQueue.tasks[0]?.priority || '-'}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- ZeroTier Page -->
    <div class="page ${activePage==='zerotier'?'active':''}" id="page-zerotier">
      <div class="card">
        <div class="card-title"><div class="card-icon purple">Z</div>ZeroTier Network</div>
        <div class="zt-ip">${zerotier.networks?.[0]?.ip || 'Not Connected'}</div>
        <div class="zt-address">Address: <span>${zerotier.address || 'N/A'}</span></div>
      </div>
      <div class="card">
        <div class="card-title">Network Details</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
          <div><span style="color:var(--text-muted)">Network Name</span><div>${zerotier.networks?.[0]?.name || 'N/A'}</div></div>
          <div><span style="color:var(--text-muted)">Network ID</span><div style="font-family:monospace;font-size:12px">${zerotier.networks?.[0]?.id || 'N/A'}</div></div>
          <div><span style="color:var(--text-muted)">Status</span><div style="color:var(--accent-green)">${zerotier.online?'Connected':'Disconnected'}</div></div>
          <div><span style="color:var(--text-muted)">Members</span><div>3</div></div>
        </div>
      </div>
    </div>
    
    <!-- Task Queue Page -->
    <div class="page ${activePage==='tasks'?'active':''}" id="page-tasks">
      <div class="card">
        <div class="card-title"><div class="card-icon green">Q</div>Task Queue (${taskQueue.stats.pending} pending)</div>
        ${taskQueue.tasks.map((t,i) => `
        <div class="task-item ${t.state}">
          <div class="task-content">${t.content}</div>
          <div class="task-meta">
            <span>[${t.platform}]</span>
            <span>Priority: ${t.priority===1?'HIGH':t.priority===2?'NORMAL':'LOW'}</span>
            <span>${new Date(t.createdAt).toLocaleString()}</span>
          </div>
          ${t.subtasks?.length ? `
          <div class="subtasks">
            ${t.subtasks.map(s => `
            <div class="subtask ${s.state}">
              <input type="checkbox" ${s.state==='completed'?'checked':''}>
              <span>${s.content}</span>
            </div>
            `).join('')}
          </div>
          ` : ''}
        </div>
        `).join('')}
      </div>
    </div>
    
    <!-- Token Manager Page -->
    <div class="page ${activePage==='tokens'?'active':''}" id="page-tokens">
      <div class="card">
        <div class="card-title"><div class="card-icon pink">T</div>Token Manager</div>
        ${tokenManager.tokens.map(t => `
        <div class="token-item">
          <div>
            <div class="token-name">${t.name}</div>
            <div class="token-key">${t.key}</div>
          </div>
          <div style="text-align:right">
            <div class="token-status active">${t.status}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${t.used}% used</div>
          </div>
        </div>
        `).join('')}
      </div>
      <div class="card">
        <div class="card-title">Recent Activity</div>
        ${tokenManager.recentActivity.map(a => `
        <div class="log-entry">
          <span class="log-time">${new Date(a.time).toLocaleTimeString()}</span>
          <span class="log-source">[${a.service}]</span>
          <span class="log-content">${a.action}</span>
        </div>
        `).join('')}
      </div>
    </div>
    
    <!-- System Monitor Page -->
    <div class="page ${activePage==='system'?'active':''}" id="page-system">
      <div class="card">
        <div class="card-title"><div class="card-icon cyan">S</div>System Monitor</div>
        <div class="progress">
          <div class="progress-header"><span>CPU Usage</span><span>${system.cpu.usage}%</span></div>
          <div class="progress-bar"><div class="progress-fill cyan" style="width:${system.cpu.usage}%"></div></div>
        </div>
        <div class="progress">
          <div class="progress-header"><span>Memory</span><span>${system.memory.used} / ${system.memory.total}</span></div>
          <div class="progress-bar"><div class="progress-fill purple" style="width:${system.memory.percent}%"></div></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:16px">
          <div><span style="color:var(--text-muted)">Cores</span><div>${system.cpu.cores}</div></div>
          <div><span style="color:var(--text-muted)">Load Avg</span><div>${system.load[0]} | ${system.load[1]} | ${system.load[2]}</div></div>
          <div><span style="color:var(--text-muted)">Uptime</span><div>${formatUptime(system.uptime)}</div></div>
          <div><span style="color:var(--text-muted)">Platform</span><div>${os.platform()}</div></div>
        </div>
      </div>
    </div>
    
    <!-- Output Page -->
    <div class="page ${activePage==='output'?'active':''}" id="page-output">
      <div class="card">
        <div class="card-title"><div class="card-icon yellow">L</div>Recent Output</div>
        ${outputs.map(o => `
        <div class="log-entry">
          <span class="log-time">${new Date(o.timestamp).toLocaleTimeString()}</span>
          <span class="log-source">[${o.source}]</span>
          <span class="log-content">${o.content}</span>
        </div>
        `).join('')}
      </div>
    </div>
  </main>
  
  <script>
    function navigate(page) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.getElementById('page-'+page).classList.add('active');
      event.target.closest('.nav-item').classList.add('active');
      history.pushState({}, '', '?page='+page);
    }
    
    // Check URL on load
    const params = new URLSearchParams(window.location.search);
    const currentPage = params.get('page') || 'overview';
    if(currentPage !== 'overview') {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.getElementById('page-'+currentPage)?.classList.add('active');
      document.querySelectorAll('.nav-item').forEach((n, i) => {
        const idx = {zerotier:1,tasks:2,tokens:3,system:4,output:5}[currentPage];
        if(i+1 === idx+1) n.classList.add('active');
      });
    }
    
    // Auto refresh
    setTimeout(() => location.reload(), 5000);
  </script>
</body>
</html>`;
}

// ============ Server ============

function getLocalIP() {
  for (const name of Object.keys(os.networkInterfaces())) {
    for (const iface of os.networkInterfaces()[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '0.0.0.0';
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:3853`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (url.pathname === '/raw') {
    const [system, zerotier, tokenManager, taskQueue, outputs] = await Promise.all([
      Promise.resolve(getSystemStatus()),
      getZeroTierStatus(),
      getTokenManagerStatus(),
      getTaskQueueStatus(),
      getOutputBuffer()
    ]);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ system, zerotier, tokenManager, taskQueue, outputs }, null, 2));
    return;
  }
  
  const activePage = url.searchParams.get('page') || 'overview';
  const [system, zerotier, tokenManager, taskQueue, outputs] = await Promise.all([
    Promise.resolve(getSystemStatus()),
    getZeroTierStatus(),
    getTokenManagerStatus(),
    getTaskQueueStatus(),
    getOutputBuffer()
  ]);
  
  res.setHeader('Content-Type', 'text/html');
  res.end(generateDashboard({ system, zerotier, tokenManager, taskQueue, outputs }, activePage));
}

// ============ Main ============

function main() {
  const args = process.argv.slice(2);
  if (args[0] === 'start') {
    const port = parseInt(args[1]) || 3853;
    const ip = getLocalIP();
    http.createServer(handleRequest).listen(port, '0.0.0.0', () => {
      console.log(`Dashboard: http://localhost:${port} | http://${ip}:${port} | http://172.26.21.18:${port}`);
    });
    return;
  }
  console.log('Dashboard - Use: dashboard start [port]');
}

main();
