#!/usr/bin/env node

/**
 * Dashboard - Unified web terminal for task management, queue, and monitoring
 * 
 * Integrates:
 * - System Monitor
 * - Task Queue (with interactive actions)
 * - Output Streamer
 * - ZeroTier Status
 * 
 * Beautiful dark theme with neon accents + interactive task management
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const os = require('os');

const DEFAULT_PORT = 3853;

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

// ============ Task Queue Functions - Mock Data ============

function getTaskQueueStatus() {
  return Promise.resolve({
    status: 'idle',
    queue: {
      pending: 2,
      processing: 0,
      completed: 5,
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
        createdAt: '2026-02-18T01:00:00.000Z',
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
        createdAt: '2026-02-18T01:05:00.000Z',
        subTasks: []
      },
      {
        id: 'task_monitor_003',
        content: 'Monitor system resources during peak hours',
        platform: 'lark',
        priority: 3,
        state: 'completed',
        createdAt: '2026-02-18T00:30:00.000Z',
        completedAt: '2026-02-18T00:45:00.000Z',
        subTasks: []
      }
    ]
  });
}

function getOutputBuffer() {
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
      padding: 20px;
      background-image: 
        radial-gradient(ellipse at top, rgba(0,245,255,0.05) 0%, transparent 50%),
        radial-gradient(ellipse at bottom right, rgba(168,85,247,0.05) 0%, transparent 50%);
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    
    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .logo-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: bold;
      box-shadow: var(--glow-cyan);
    }
    
    .logo-text h1 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 1.5rem;
      font-weight: 700;
      background: linear-gradient(90deg, var(--accent-cyan), var(--accent-purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .header-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .status-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: rgba(107, 203, 119, 0.1);
      border: 1px solid rgba(107, 203, 119, 0.3);
      border-radius: 20px;
      color: var(--accent-green);
      font-size: 0.7rem;
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
    
    .time {
      color: var(--text-secondary);
      font-size: 0.8rem;
    }
    
    /* Layout: 2x2 with Task Queue taking more space */
    .grid {
      display: grid;
      grid-template-columns: 1fr 2fr;
      grid-template-rows: auto auto;
      gap: 16px;
    }
    
    /* Make first row: System + ZeroTier smaller */
    .grid > .card:nth-child(1),
    .grid > .card:nth-child(2) {
      grid-row: 1;
    }
    
    /* Make second row: Task Queue takes full width, Output takes second */
    .grid > .card:nth-child(3) {
      grid-column: 1 / -1;
      grid-row: 2;
    }
    
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      position: relative;
      overflow: hidden;
      transition: all 0.3s ease;
    }
    
    .card:hover {
      border-color: rgba(0, 245, 255, 0.2);
    }
    
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    
    .card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-primary);
    }
    
    .card-icon {
      width: 28px;
      height: 28px;
      background: rgba(0, 245, 255, 0.1);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
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
      padding: 6px 0;
      font-size: 0.75rem;
    }
    
    .stat-label { color: var(--text-muted); }
    .stat-value { color: var(--text-primary); font-weight: 500; }
    .stat-value.highlight { color: var(--accent-cyan); }
    
    /* Progress bars */
    .progress-section { margin: 8px 0; }
    
    .progress-header {
      display: flex;
      justify-content: space-between;
      font-size: 0.7rem;
      margin-bottom: 4px;
    }
    
    .progress-label { color: var(--text-muted); }
    .progress-value { font-weight: 600; }
    
    .progress-bar {
      height: 6px;
      background: var(--bg-secondary);
      border-radius: 3px;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.5s ease;
    }
    
    .progress-fill.cyan { background: linear-gradient(90deg, var(--accent-cyan), #00d4ff); }
    .progress-fill.purple { background: linear-gradient(90deg, var(--accent-purple), #c084fc); }
    .progress-fill.green { background: linear-gradient(90deg, var(--accent-green), #4ade80); }
    .progress-fill.yellow { background: linear-gradient(90deg, var(--accent-yellow), #fbbf24); }
    .progress-fill.red { background: linear-gradient(90deg, var(--accent-red), #f87171); }
    
    /* Queue Stats - Clickable */
    .queue-stats {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    
    .queue-stat {
      flex: 1;
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 10px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid transparent;
    }
    
    .queue-stat:hover {
      border-color: var(--accent-cyan);
      background: var(--bg-card-hover);
    }
    
    .queue-stat.active {
      border-color: var(--accent-cyan);
      background: rgba(0, 245, 255, 0.1);
    }
    
    .queue-stat-value {
      font-size: 1.25rem;
      font-weight: 700;
      font-family: 'Space Grotesk', sans-serif;
    }
    
    .queue-stat-value.pending { color: var(--accent-yellow); }
    .queue-stat-value.processing { color: var(--accent-cyan); }
    .queue-stat-value.completed { color: var(--accent-green); }
    
    .queue-stat-label {
      font-size: 0.65rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    
    /* Task List */
    .task-list {
      max-height: 280px;
      overflow-y: auto;
    }
    
    .task-item {
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 8px;
      border-left: 3px solid var(--accent-yellow);
    }
    
    .task-item.processing {
      border-left-color: var(--accent-cyan);
    }
    
    .task-item.completed {
      border-left-color: var(--accent-green);
      opacity: 0.7;
    }
    
    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
    }
    
    .task-content {
      font-size: 0.8rem;
      color: var(--text-primary);
      flex: 1;
    }
    
    .task-meta {
      font-size: 0.65rem;
      color: var(--text-muted);
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }
    
    .task-actions {
      display: flex;
      gap: 4px;
    }
    
    .task-btn {
      padding: 4px 8px;
      font-size: 0.65rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s;
    }
    
    .task-btn.complete {
      background: rgba(107, 203, 119, 0.2);
      color: var(--accent-green);
    }
    
    .task-btn.complete:hover {
      background: var(--accent-green);
      color: var(--bg-primary);
    }
    
    .task-btn.clear {
      background: rgba(255, 107, 107, 0.2);
      color: var(--accent-red);
    }
    
    .task-btn.clear:hover {
      background: var(--accent-red);
      color: white;
    }
    
    .task-btn.modify {
      background: rgba(255, 217, 61, 0.2);
      color: var(--accent-yellow);
    }
    
    .task-btn.modify:hover {
      background: var(--accent-yellow);
      color: var(--bg-primary);
    }
    
    /* Subtasks */
    .subtasks {
      margin-top: 8px;
      padding-left: 10px;
      border-left: 2px solid var(--border);
    }
    
    .subtask {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }
    
    .subtask-checkbox {
      width: 14px;
      height: 14px;
      cursor: pointer;
      accent-color: var(--accent-green);
    }
    
    .subtask.completed {
      text-decoration: line-through;
      opacity: 0.5;
    }
    
    .subtask-actions {
      margin-left: auto;
      display: flex;
      gap: 4px;
    }
    
    .subtask-btn {
      padding: 2px 6px;
      font-size: 0.6rem;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      background: rgba(255,255,255,0.1);
      color: var(--text-muted);
    }
    
    .subtask-btn:hover {
      background: var(--accent-cyan);
      color: var(--bg-primary);
    }
    
    /* ZeroTier IP */
    .zt-ip {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--accent-cyan);
      text-align: center;
      padding: 12px;
      background: var(--bg-secondary);
      border-radius: 8px;
      margin: 8px 0;
    }
    
    .zt-address {
      font-size: 0.7rem;
      color: var(--text-muted);
      text-align: center;
    }
    
    .zt-address span {
      color: var(--accent-purple);
      font-family: 'JetBrains Mono', monospace;
    }
    
    /* Log */
    .log {
      max-height: 120px;
      overflow-y: auto;
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 8px;
    }
    
    .log-entry {
      padding: 4px 8px;
      font-size: 0.7rem;
      display: flex;
      gap: 8px;
    }
    
    .log-time { color: var(--text-muted); white-space: nowrap; }
    .log-source { color: var(--accent-purple); white-space: nowrap; }
    .log-content { color: var(--text-secondary); word-break: break-word; }
    
    /* Footer */
    .footer {
      text-align: center;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 0.7rem;
    }
    
    .footer a {
      color: var(--accent-cyan);
      text-decoration: none;
    }
    
    @media (max-width: 900px) {
      .grid {
        grid-template-columns: 1fr;
      }
      .grid > .card:nth-child(3) {
        grid-column: 1;
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
    <!-- System Status - Smaller -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <div class="card-icon cyan">CPU</div>
          System
        </div>
      </div>
      
      <div class="progress-section">
        <div class="progress-header">
          <span class="progress-label">CPU</span>
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
        <span class="stat-label">Load</span>
        <span class="stat-value">${system.load[0]} | ${system.load[1]}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Uptime</span>
        <span class="stat-value">${formatUptime(system.uptime)}</span>
      </div>
    </div>
    
    <!-- ZeroTier - Smaller -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <div class="card-icon purple">Z</div>
          ZeroTier
        </div>
      </div>
      
      <div class="zt-ip">${zerotier.networks?.[0]?.ip || 'N/A'}</div>
      <div class="zt-address">Address: <span>${zerotier.address}</span></div>
      
      <div class="stat">
        <span class="stat-label">Network</span>
        <span class="stat-value">${zerotier.networks?.[0]?.name || 'N/A'}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Status</span>
        <span class="stat-value" style="color: ${zerotier.online ? 'var(--accent-green)' : 'var(--accent-red)'}">${zerotier.online ? 'Connected' : 'Offline'}</span>
      </div>
    </div>
    
    <!-- Task Queue - Larger -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <div class="card-icon green">Q</div>
          Task Queue
        </div>
        <span class="stat-value highlight">${taskQueue.status || 'idle'}</span>
      </div>
      
      <!-- Clickable Queue Stats -->
      <div class="queue-stats">
        <div class="queue-stat active" data-filter="pending" onclick="filterTasks('pending', this)">
          <div class="queue-stat-value pending">${taskQueue.queue?.pending || 0}</div>
          <div class="queue-stat-label">Pending</div>
        </div>
        <div class="queue-stat" data-filter="processing" onclick="filterTasks('processing', this)">
          <div class="queue-stat-value processing">${taskQueue.queue?.processing || 0}</div>
          <div class="queue-stat-label">Processing</div>
        </div>
        <div class="queue-stat" data-filter="completed" onclick="filterTasks('completed', this)">
          <div class="queue-stat-value completed">${taskQueue.stats?.completed || 0}</div>
          <div class="queue-stat-label">Completed</div>
        </div>
      </div>
      
      <!-- Task List -->
      <div class="task-list" id="taskList">
        ${taskQueue.tasks.map(task => `
        <div class="task-item ${task.state}" data-state="${task.state}">
          <div class="task-header">
            <div class="task-content">${task.content}</div>
            <div class="task-actions">
              <button class="task-btn complete" onclick="completeTask('${task.id}')">Complete</button>
              <button class="task-btn modify" onclick="modifyTask('${task.id}')">Modify</button>
              <button class="task-btn clear" onclick="clearTask('${task.id}')">Clear</button>
            </div>
          </div>
          <div class="task-meta">
            <span>[${task.platform}]</span>
            <span>Priority: ${task.priority === 1 ? 'HIGH' : task.priority === 2 ? 'NORMAL' : 'LOW'}</span>
            <span>${new Date(task.createdAt).toLocaleString()}</span>
          </div>
          ${task.subTasks && task.subTasks.length > 0 ? `
          <div class="subtasks">
            ${task.subTasks.map(sub => `
            <div class="subtask ${sub.state === 'completed' ? 'completed' : ''}">
              <input type="checkbox" class="subtask-checkbox" 
                ${sub.state === 'completed' ? 'checked' : ''} 
                onchange="toggleSubtask('${task.id}', '${sub.id}')">
              <span>${sub.content}</span>
              <div class="subtask-actions">
                <button class="subtask-btn" onclick="completeSubtask('${task.id}', '${sub.id}')">Done</button>
                <button class="subtask-btn" onclick="clearSubtask('${task.id}', '${sub.id}')">X</button>
              </div>
            </div>
            `).join('')}
          </div>
          ` : ''}
        </div>
        `).join('')}
      </div>
    </div>
  </div>
  
  <footer class="footer">
    Auto-refresh every 5 seconds | <a href="/raw" target="_blank">JSON API</a>
  </footer>
  
  <script>
    let currentFilter = 'pending';
    
    function filterTasks(state, element) {
      currentFilter = state;
      document.querySelectorAll('.queue-stat').forEach(el => el.classList.remove('active'));
      element.classList.add('active');
      
      document.querySelectorAll('.task-item').forEach(task => {
        if (state === 'all' || task.dataset.state === state) {
          task.style.display = 'block';
        } else {
          task.style.display = 'none';
        }
      });
    }
    
    function completeTask(taskId) {
      if (confirm('Complete this task?')) {
        fetch('/api/task/complete', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ taskId })
        }).then(() => location.reload());
      }
    }
    
    function modifyTask(taskId) {
      const newContent = prompt('Enter new task description:');
      if (newContent) {
        fetch('/api/task/modify', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ taskId, content: newContent })
        }).then(() => location.reload());
      }
    }
    
    function clearTask(taskId) {
      if (confirm('Remove this task?')) {
        fetch('/api/task/clear', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ taskId })
        }).then(() => location.reload());
      }
    }
    
    function toggleSubtask(taskId, subtaskId) {
      fetch('/api/task/subtask/toggle', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ taskId, subtaskId })
      });
    }
    
    function completeSubtask(taskId, subtaskId) {
      fetch('/api/task/subtask/complete', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ taskId, subtaskId })
      }).then(() => location.reload());
    }
    
    function clearSubtask(taskId, subtaskId) {
      fetch('/api/task/subtask/clear', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ taskId, subtaskId })
      }).then(() => location.reload());
    }
    
    // Initialize filter
    filterTasks('pending', document.querySelector('.queue-stat.active'));
    
    // Auto refresh
    setTimeout(() => location.reload(), 5000);
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
  const url = new URL(req.url, `http://localhost:3853`);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  // Task API endpoints
  if (url.pathname.startsWith('/api/task/')) {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        
        if (url.pathname === '/api/task/complete') {
          console.log('Complete task:', data.taskId);
          res.end(JSON.stringify({ success: true, action: 'complete', taskId: data.taskId }));
          return;
        }
        
        if (url.pathname === '/api/task/modify') {
          console.log('Modify task:', data.taskId, data.content);
          res.end(JSON.stringify({ success: true, action: 'modify', taskId: data.taskId, content: data.content }));
          return;
        }
        
        if (url.pathname === '/api/task/clear') {
          console.log('Clear task:', data.taskId);
          res.end(JSON.stringify({ success: true, action: 'clear', taskId: data.taskId }));
          return;
        }
        
        if (url.pathname === '/api/task/subtask/toggle') {
          console.log('Toggle subtask:', data.taskId, data.subtaskId);
          res.end(JSON.stringify({ success: true }));
          return;
        }
        
        if (url.pathname === '/api/task/subtask/complete') {
          console.log('Complete subtask:', data.taskId, data.subtaskId);
          res.end(JSON.stringify({ success: true }));
          return;
        }
        
        if (url.pathname === '/api/task/subtask/clear') {
          console.log('Clear subtask:', data.taskId, data.subtaskId);
          res.end(JSON.stringify({ success: true }));
          return;
        }
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  
  if (url.pathname === '/raw') {
    const [system, taskQueue, zerotier, outputs] = await Promise.all([
      Promise.resolve(getSystemStatus()),
      getTaskQueueStatus(),
      getZeroTierStatus(),
      getOutputBuffer()
    ]);
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
    const port = parseInt(args[1]) || 3853;
    const localIP = getLocalIP();
    const server = http.createServer(handleRequest);
    server.listen(port, '0.0.0.0', () => {
      console.log(`Dashboard running:`);
      console.log(`  Local:   http://localhost:${port}`);
      console.log(`  LAN:     http://${localIP}:${port}`);
      console.log(`  ZeroTier: http://172.26.21.18:${port}`);
    });
    return;
  }
  
  if (cmd === 'status' || !cmd) {
    const system = getSystemStatus();
    console.log(`CPU: ${system.cpu.usage}% | MEM: ${system.memory.percent}%`);
    return;
  }
  
  console.log(`
Dashboard - Interactive task queue management

USAGE:
  dashboard start [port]
  dashboard status
      `);
}

main();
