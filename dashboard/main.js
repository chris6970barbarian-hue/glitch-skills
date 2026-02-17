#!/usr/bin/env node

/**
 * Dashboard - Unified web terminal for task management, queue, and monitoring
 * 
 * Integrates:
 * - System Monitor
 * - Task Queue
 * - Output Streamer
 * - ZeroTier Status
 * 
 * Beautiful dark theme with neon accents
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
  return new Promise((resolve) => {
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
  // Return mock data for demonstration
  return Promise.resolve({
    status: 'idle',
    queue: {
      pending: 2,
      processing: 0,
      total: 2
    },
    stats: {
      completed: 5,
      failed: 0,
      lastProcessed: 'task_001'
    },
    currentTask: null,
    tasks: [
      {
        id: 'task_deploy_001',
        content: 'Deploy new skill to production',
        platform: 'discord',
        priority: 1,
        state: 'pending',
        subTasks: [
          { id: 'sub_1', content: 'Update README documentation', state: 'pending' },
          { id: 'sub_2', content: 'Push to GitHub repository', state: 'pending' },
          { id: 'sub_3', content: 'Test locally before deploy', state: 'pending' }
        ]
      },
      {
        id: 'task_fix_002',
        content: 'Fix dashboard UI responsive layout',
        platform: 'telegram',
        priority: 2,
        state: 'pending',
        subTasks: []
      }
    ]
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
  // Return mock log data for demonstration
  return Promise.resolve([
    { timestamp: new Date().toISOString(), source: 'system', content: 'Dashboard server started on port 3853' },
    { timestamp: new Date(Date.now() - 60000).toISOString(), source: 'task-queue', content: 'Task task_deploy_001 added to queue' },
    { timestamp: new Date(Date.now() - 120000).toISOString(), source: 'zerotier', content: 'Connected to network af415e486fc5fca0' },
    { timestamp: new Date(Date.now() - 180000).toISOString(), source: 'system', content: 'ZeroTier One service started' },
    { timestamp: new Date(Date.now() - 240000).toISOString(), source: 'deploy', content: 'Pushed 3 commits to master' },
    { timestamp: new Date(Date.now() - 300000).toISOString(), source: 'task-queue', content: 'Completed task: Update README' }
  ]);
}

// ============ HTML Dashboard ============

function generateDashboard(data) {
  const { system, taskQueue, zerotier, outputs } = data;
  const time = new Date().toLocaleString();
  
  const cpuColor = parseFloat(system.cpu.usage) > 80 ? '#ff6b6b' : parseFloat(system.cpu.usage) > 50 ? '#ffd93d' : '#6bcb77';
  const memColor = parseFloat(system.memory.percent) > 80 ? '#ff6b6b' : parseFloat(system.memory.percent) > 50 ? '#ffd93d' : '#6bcb77';
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Glitch Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0a0e17;
      --bg-secondary: #111827;
      --bg-card: #1a1f2e;
      --bg-card-hover: #242b3d;
      --accent-cyan: #00f5ff;
      --accent-purple: #a855f7;
      --accent-pink: #ff006e;
      --accent-green: #6bcb77;
      --accent-yellow: #ffd93d;
      --accent-red: #ff6b6b;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --border: rgba(255,255,255,0.08);
      --glow-cyan: 0 0 20px rgba(0, 245, 255, 0.3);
      --glow-purple: 0 0 20px rgba(168, 85, 247, 0.3);
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'JetBrains Mono', monospace;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      padding: 24px;
      background-image: 
        radial-gradient(ellipse at top, rgba(0,245,255,0.05) 0%, transparent 50%),
        radial-gradient(ellipse at bottom right, rgba(168,85,247,0.05) 0%, transparent 50%);
    }
    
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }
    
    .logo {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .logo-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      box-shadow: var(--glow-cyan);
    }
    
    .logo-text h1 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 1.75rem;
      font-weight: 700;
      background: linear-gradient(90deg, var(--accent-cyan), var(--accent-purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .logo-text span {
      font-size: 0.75rem;
      color: var(--text-muted);
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    
    .header-right {
      display: flex;
      align-items: center;
      gap: 24px;
    }
    
    .time {
      color: var(--text-secondary);
      font-size: 0.875rem;
    }
    
    .status-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: rgba(107, 203, 119, 0.1);
      border: 1px solid rgba(107, 203, 119, 0.3);
      border-radius: 20px;
      color: var(--accent-green);
      font-size: 0.75rem;
      font-weight: 500;
    }
    
    .status-dot {
      width: 8px;
      height: 8px;
      background: var(--accent-green);
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    /* Grid */
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
    }
    
    /* Cards */
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      position: relative;
      overflow: hidden;
      transition: all 0.3s ease;
    }
    
    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--accent-cyan), var(--accent-purple));
      opacity: 0;
      transition: opacity 0.3s;
    }
    
    .card:hover {
      transform: translateY(-2px);
      border-color: rgba(0, 245, 255, 0.2);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    
    .card:hover::before {
      opacity: 1;
    }
    
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    
    .card-title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
    }
    
    .card-icon {
      width: 36px;
      height: 36px;
      background: rgba(0, 245, 255, 0.1);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
    
    .card-icon.cyan { background: rgba(0, 245, 255, 0.1); color: var(--accent-cyan); }
    .card-icon.purple { background: rgba(168, 85, 247, 0.1); color: var(--accent-purple); }
    .card-icon.green { background: rgba(107, 203, 119, 0.1); color: var(--accent-green); }
    .card-icon.pink { background: rgba(255, 0, 110, 0.1); color: var(--accent-pink); }
    
    /* Stats */
    .stat {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid var(--border);
    }
    
    .stat:last-of-type { border-bottom: none; }
    
    .stat-label {
      color: var(--text-muted);
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .stat-value {
      font-weight: 600;
      font-size: 1rem;
      color: var(--text-primary);
    }
    
    .stat-value.highlight {
      color: var(--accent-cyan);
    }
    
    /* Progress bars */
    .progress-section {
      margin: 16px 0;
    }
    
    .progress-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    
    .progress-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .progress-value {
      font-size: 0.875rem;
      font-weight: 600;
    }
    
    .progress-bar {
      height: 8px;
      background: var(--bg-secondary);
      border-radius: 4px;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.5s ease;
    }
    
    .progress-fill.cyan { background: linear-gradient(90deg, var(--accent-cyan), #00d4ff); }
    .progress-fill.purple { background: linear-gradient(90deg, var(--accent-purple), #c084fc); }
    .progress-fill.green { background: linear-gradient(90deg, var(--accent-green), #4ade80); }
    .progress-fill.yellow { background: linear-gradient(90deg, var(--accent-yellow), #fbbf24); }
    .progress-fill.red { background: linear-gradient(90deg, var(--accent-red), #f87171); }
    
    /* Queue stats */
    .queue-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin: 16px 0;
    }
    
    .queue-stat {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
    }
    
    .queue-stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      font-family: 'Space Grotesk', sans-serif;
    }
    
    .queue-stat-value.pending { color: var(--accent-yellow); }
    .queue-stat-value.processing { color: var(--accent-cyan); }
    .queue-stat-value.completed { color: var(--accent-green); }
    
    .queue-stat-label {
      font-size: 0.7rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 4px;
    }
    
    /* Current task */
    .current-task {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 16px;
      margin-top: 16px;
      border-left: 3px solid var(--accent-cyan);
    }
    
    .current-task-label {
      font-size: 0.7rem;
      color: var(--accent-cyan);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    
    .current-task-content {
      font-size: 0.875rem;
      color: var(--text-secondary);
      word-break: break-word;
    }
    
    /* Actions */
    .actions {
      display: flex;
      gap: 12px;
      margin-top: 20px;
    }
    
    button {
      flex: 1;
      padding: 12px 20px;
      border: none;
      border-radius: 10px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      color: var(--bg-primary);
    }
    
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: var(--glow-cyan);
    }
    
    .btn-danger {
      background: transparent;
      border: 1px solid var(--accent-red);
      color: var(--accent-red);
    }
    
    .btn-danger:hover {
      background: rgba(255, 107, 107, 0.1);
    }
    
    /* ZeroTier specific */
    .zt-ip {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 2rem;
      font-weight: 700;
      color: var(--accent-cyan);
      text-align: center;
      padding: 20px;
      background: var(--bg-secondary);
      border-radius: 12px;
      margin: 16px 0;
      border: 1px solid rgba(0, 245, 255, 0.2);
    }
    
    .zt-address {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-align: center;
    }
    
    .zt-address span {
      color: var(--accent-purple);
      font-family: 'JetBrains Mono', monospace;
    }
    
    /* Log */
    .log {
      max-height: 220px;
      overflow-y: auto;
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 12px;
    }
    
    .log::-webkit-scrollbar {
      width: 6px;
    }
    
    .log::-webkit-scrollbar-track {
      background: transparent;
    }
    
    .log::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 3px;
    }
    
    .log-entry {
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
      font-size: 0.75rem;
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    
    .log-entry:last-child { border-bottom: none; }
    
    .log-time {
      color: var(--text-muted);
      white-space: nowrap;
    }
    
    .log-source {
      color: var(--accent-purple);
      font-weight: 500;
      white-space: nowrap;
    }
    
    .log-content {
      color: var(--text-secondary);
      word-break: break-word;
    }
    
    .log-empty {
      text-align: center;
      color: var(--text-muted);
      padding: 40px;
      font-size: 0.875rem;
    }
    
    /* Footer */
    .footer {
      text-align: center;
      margin-top: 32px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 0.75rem;
    }
    
    .footer a {
      color: var(--accent-cyan);
      text-decoration: none;
    }
    
    .footer a:hover {
      text-decoration: underline;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .header {
        flex-direction: column;
        gap: 16px;
        text-align: center;
      }
      
      .grid {
        grid-template-columns: 1fr;
      }
      
      .queue-stats {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="logo">
      <div class="logo-icon">G</div>
      <div class="logo-text">
        <h1>Glitch Dashboard</h1>
        
      </div>
    </div>
    <div class="header-right">
      <div class="status-badge">
        <div class="status-dot"></div>
        Online
      </div>
      <div class="time">${time}</div>
    </div>
  </header>
  
  <div class="grid">
    <!-- System Status -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <div class="card-icon cyan">CPU</div>
          System Status
        </div>
      </div>
      
      <div class="progress-section">
        <div class="progress-header">
          <span class="progress-label">CPU Usage</span>
          <span class="progress-value" style="color: ${cpuColor}">${system.cpu.usage}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${parseFloat(system.cpu.usage) > 80 ? 'red' : parseFloat(system.cpu.usage) > 50 ? 'yellow' : 'cyan'}" style="width: ${system.cpu.usage}%"></div>
        </div>
      </div>
      
      <div class="progress-section">
        <div class="progress-header">
          <span class="progress-label">Memory</span>
          <span class="progress-value" style="color: ${memColor}">${system.memory.percent}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${parseFloat(system.memory.percent) > 80 ? 'red' : parseFloat(system.memory.percent) > 50 ? 'yellow' : 'purple'}" style="width: ${system.memory.percent}%"></div>
        </div>
      </div>
      
      <div class="stat">
        <span class="stat-label">Cores</span>
        <span class="stat-value highlight">${system.cpu.cores}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Memory Used</span>
        <span class="stat-value">${system.memory.used} / ${system.memory.total}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Load Average</span>
        <span class="stat-value">${system.load[0]} | ${system.load[1]} | ${system.load[2]}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Uptime</span>
        <span class="stat-value">${formatUptime(system.uptime)}</span>
      </div>
    </div>
    
    <!-- Task Queue -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <div class="card-icon green">Q</div>
          Task Queue
        </div>
      </div>
      
      ${taskQueue.error ? `
      <div class="log-empty">${taskQueue.error}</div>
      ` : `
      <div class="queue-stats">
        <div class="queue-stat">
          <div class="queue-stat-value pending">${taskQueue.queue?.pending || 0}</div>
          <div class="queue-stat-label">Pending</div>
        </div>
        <div class="queue-stat">
          <div class="queue-stat-value processing">${taskQueue.queue?.processing || 0}</div>
          <div class="queue-stat-label">Processing</div>
        </div>
        <div class="queue-stat">
          <div class="queue-stat-value completed">${taskQueue.stats?.completed || 0}</div>
          <div class="queue-stat-label">Completed</div>
        </div>
      </div>
      
      <div class="stat">
        <span class="stat-label">Status</span>
        <span class="stat-value highlight">${taskQueue.status || 'idle'}</span>
      </div>
      
      ${taskQueue.tasks ? `
      <div style="margin-top: 16px; max-height: 150px; overflow-y: auto;">
        ${taskQueue.tasks.map((task, idx) => `
        <div style="background: var(--bg-secondary); border-radius: 8px; padding: 12px; margin-bottom: 8px; ${task.state === 'processing' ? 'border-left: 3px solid var(--accent-cyan);' : ''}">
          <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
            ${idx + 1}. ${task.content}
          </div>
          <div style="font-size: 0.7rem; color: var(--text-muted); display: flex; gap: 12px;">
            <span>[${task.platform}]</span>
            <span>Priority: ${task.priority === 1 ? 'HIGH' : task.priority === 2 ? 'NORMAL' : 'LOW'}</span>
          </div>
          ${task.subTasks.length > 0 ? `
          <div style="margin-top: 8px; padding-left: 12px; border-left: 2px solid var(--border);">
            ${task.subTasks.map(sub => `
            <div style="font-size: 0.75rem; color: var(--text-secondary); padding: 2px 0;">
              ${sub.state === 'completed' ? '✓' : '○'} ${sub.content}
            </div>
            `).join('')}
          </div>
          ` : ''}
        </div>
        `).join('')}
      </div>
      ` : ''}
      
      ${taskQueue.currentTask ? `
      <div class="current-task">
        <div class="current-task-label">Current Task</div>
        <div class="current-task-content">${taskQueue.currentTask.content?.substring(0, 100)}${taskQueue.currentTask.content?.length > 100 ? '...' : ''}</div>
      </div>
      ` : ''}
      `}
      
      <div class="actions">
        <button class="btn-primary" onclick="execute('complete')">Complete</button>
        <button class="btn-danger" onclick="execute('clear')">Clear</button>
      </div>
    </div>
    
    <!-- ZeroTier -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <div class="card-icon purple">Z</div>
          ZeroTier Network
        </div>
      </div>
      
      ${!zerotier.installed ? `
      <div class="log-empty">ZeroTier not installed</div>
      ` : `
      <div class="zt-ip">${zerotier.networks?.[0]?.ip || 'N/A'}</div>
      <div class="zt-address">Address: <span>${zerotier.address}</span></div>
      
      <div class="stat">
        <span class="stat-label">Network</span>
        <span class="stat-value">${zerotier.networks?.[0]?.name || 'N/A'}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Status</span>
        <span class="stat-value" style="color: ${zerotier.online ? 'var(--accent-green)' : 'var(--accent-red)'}">${zerotier.online ? 'Connected' : 'Disconnected'}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Network ID</span>
        <span class="stat-value">${zerotier.networks?.[0]?.id || 'N/A'}</span>
      </div>
      `}
    </div>
    
    <!-- Output Stream -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <div class="card-icon pink">L</div>
          Recent Output
        </div>
      </div>
      
      <div class="log">
        ${outputs.length === 0 ? '<div class="log-empty">No output yet</div>' : 
        outputs.map(o => `
        <div class="log-entry">
          <span class="log-time">${new Date(o.timestamp || o.createdAt).toLocaleTimeString()}</span>
          <span class="log-source">[${o.source || o.platform || 'log'}]</span>
          <span class="log-content">${o.content ? o.content.substring(0, 50) : o.id ? `Task: ${o.id.substring(0, 15)}...` : ''}</span>
        </div>
        `).join('')}
      </div>
    </div>
  </div>
  
  <footer class="footer">
    Auto-refresh every 3 seconds | <a href="/raw" target="_blank">JSON API</a>
  </footer>
  
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
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  
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
  
  if (cmd === 'status' || !cmd) {
    const system = getSystemStatus();
    console.log(`CPU: ${system.cpu.usage}% | MEM: ${system.memory.percent}% | LOAD: ${system.load.join(', ')}`);
    return;
  }
  
  console.log(`
Dashboard - Unified web terminal for Glitch skills

USAGE:
  dashboard start [port]   Start web server (default: 3853)
  dashboard status        Quick CLI status

ENDPOINTS:
  /               Main dashboard
  /raw            JSON status
  /api/complete   Complete task
  /api/clear      Clear queue
      `);
}

main();
