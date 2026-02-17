#!/usr/bin/env node

/**
 * Dashboard - Comprehensive system management with sidebar navigation
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

const DEFAULT_PORT = 3853;

function execPromise(cmd, timeout = 3000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout, shell: true }, (err, stdout, stderr) => {
      resolve({ stdout: stdout?.trim() || '', stderr: stderr?.trim() || '', error: err?.message });
    });
  });
}

async function getSystemStatus() {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) totalTick += cpu.times[type];
    totalIdle += cpu.times.idle;
  }
  const cpuUsage = 100 - (totalIdle / totalTick * 100);
  const totalMem = os.totalmem();
  const freeMem = os.freemmem();
  const memUsage = ((totalMem - freeMem) / totalMem) * 100;
  
  const interfaces = os.networkInterfaces();
  let physicalIP = '';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (!physicalIP) physicalIP = iface.address;
      }
    }
  }
  
  return {
    cpu: { usage: parseFloat(cpuUsage.toFixed(1)), cores: cpus.length },
    memory: { percent: parseFloat(memUsage.toFixed(1)), used: formatBytes(totalMem - freeMem), total: formatBytes(totalMem) },
    load: os.loadavg().map(l => l.toFixed(2)),
    uptime: os.uptime(),
    physicalIP,
    platform: os.platform(),
    hostname: os.hostname()
  };
}

function formatBytes(b) {
  return b >= 1073741824 ? `${(b/1073741824).toFixed(1)}G` : `${(b/1048576).toFixed(0)}M`;
}

function formatUptime(s) {
  const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60);
  return `${d}d ${h}h ${m}m`;
}

async function getZeroTierStatus() {
  const result = await execPromise('sudo zerotier-cli listnetworks 2>/dev/null');
  const ztIP = result.stdout.includes('OK') ? (result.stdout.match(/(\d+\.\d+\.\d+\.\d+)/)?.[1] || '') : '';
  
  const interfaces = os.networkInterfaces();
  let physicalIP = '';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && name !== 'zt') {
        physicalIP = iface.address;
      }
    }
  }
  
  return {
    installed: !result.error,
    online: result.stdout.includes('OK'),
    address: '735eb2f8f5',
    ztIP: ztIP || 'Not assigned',
    physicalIP: physicalIP || 'Unknown',
    network: result.stdout.includes('af415e486fc5fca0') ? 'af415e486fc5fca0' : null
  };
}

async function getMihomoStatus() {
  const procResult = await execPromise('pgrep -f mihomo');
  const running = !procResult.error && procResult.stdout.length > 0;
  
  return {
    running,
    subscribe: 'Not configured',
    nodes: [
      { name: 'US-01', latency: 45 },
      { name: 'JP-01', latency: 120 },
      { name: 'SG-01', latency: 85 },
      { name: 'HK-01', latency: 32 }
    ]
  };
}

async function getTokenManagerStatus() {
  const running = await execPromise('pgrep -f token-manager');
  
  let gatewayToken = 'Not set';
  const tokenPath = path.join(os.homedir(), '.openclaw', 'gateway.token');
  if (fs.existsSync(tokenPath)) {
    gatewayToken = fs.readFileSync(tokenPath, 'utf8').trim().substring(0, 20) + '...';
  }
  
  const tokens = [
    { name: 'OpenAI', key: 'sk-...abc123', status: true, used: 85 },
    { name: 'Anthropic', key: 'sk-ant-...xyz', status: true, used: 42 },
    { name: 'Brave Search', key: 'BSA...', status: true, used: 12 },
    { name: 'ZeroTier', key: 'ZT...', status: false, used: 0 }
  ];
  
  return { running: !running.error, port: '3847', tokens, gatewayToken };
}

async function getTaskQueueStatus() {
  const tasks = [
    { id: 'task_1', content: 'Deploy new skill to production', platform: 'discord', priority: 1, state: 'pending', createdAt: new Date().toISOString(),
      subtasks: [{id:'s1',content:'Update README',state:'pending'},{id:'s2',content:'Push to GitHub',state:'pending'}] },
    { id: 'task_2', content: 'Fix dashboard UI layout', platform: 'telegram', priority: 2, state: 'pending', subtasks: [] },
    { id: 'task_3', content: 'Setup Mihomo nodes', platform: 'lark', priority: 1, state: 'completed', subtasks: [] }
  ];
  return { status: 'idle', stats: { pending: 2, processing: 0, completed: 1 }, tasks };
}

async function getOutputBuffer() {
  return [
    { timestamp: new Date().toISOString(), source: 'system', content: 'Dashboard running on port 3853' },
    { timestamp: new Date(Date.now()-30000).toISOString(), source: 'task', content: 'Task queue initialized' },
    { timestamp: new Date(Date.now()-60000).toISOString(), source: 'zerotier', content: 'ZeroTier connected' },
    { timestamp: new Date(Date.now()-90000).toISOString(), source: 'token', content: 'Token manager active' }
  ];
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${DEFAULT_PORT}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (url.pathname === '/api/task') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, action: 'mock' }));
    return;
  }
  
  if (url.pathname === '/raw') {
    const data = await Promise.all([
      getSystemStatus(), getZeroTierStatus(), getMihomoStatus(),
      getTokenManagerStatus(), getTaskQueueStatus(), getOutputBuffer()
    ]);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ system: data[0], zerotier: data[1], mihomo: data[2], tokenManager: data[3], taskQueue: data[4], outputs: data[5] }, null, 2));
    return;
  }
  
  const activePage = url.searchParams.get('page') || 'overview';
  const data = await Promise.all([
    getSystemStatus(), getZeroTierStatus(), getMihomoStatus(),
    getTokenManagerStatus(), getTaskQueueStatus(), getOutputBuffer()
  ]);
  
  res.setHeader('Content-Type', 'text/html');
  res.end(generateHTML({ system: data[0], zerotier: data[1], mihomo: data[2], tokenManager: data[3], taskQueue: data[4], outputs: data[6] }, activePage));
}

function generateHTML(data, page) {
  const { system, zerotier, mihomo, tokenManager, taskQueue, outputs } = data;
  const getCpuColor = v => v > 80 ? '#ef4444' : v > 50 ? '#fbbf24' : '#22c55e';
  const getMemColor = v => v > 80 ? '#ef4444' : v > 50 ? '#fbbf24' : '#a855f7';
  
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Glitch Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#080b12;--sidebar:#0a0e17;--card:#111827;--card-h:#1a2235;--cyan:#00f5ff;--purple:#a855f7;--green:#22c55e;--yellow:#fbbf24;--red:#ef4444;--pink:#ec4899;--text:#f1f5f9;--muted:#64748b;--border:rgba(255,255,255,0.06)}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'JetBrains Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh;display:flex}
.sidebar{width:64px;background:var(--sidebar);border-right:1px solid var(--border);display:flex;flex-direction:column;padding:14px 4px;position:fixed;height:100vh}
.sidebar-logo{width:40px;height:40px;background:linear-gradient(135deg,var(--cyan),var(--purple));border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;margin:0 auto 16px;box-shadow:0 0 20px rgba(0,245,255,0.2)}
.nav{width:48px;height:42px;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:4px;cursor:pointer;transition:all .2s;color:var(--muted);font-size:14px;position:relative}
.nav:hover{background:rgba(255,255,255,0.05);color:var(--text)}
.nav.active{background:rgba(0,245,255,0.08);color:var(--cyan)}
.nav.active::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:16px;background:var(--cyan);border-radius:0 2px 2px 0}
.tooltip{position:absolute;left:52px;background:var(--card);padding:5px 8px;border-radius:4px;font-size:10px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .2s;border:1px solid var(--border);z-index:200}
.nav:hover .tooltip{opacity:1}
.main{flex:1;margin-left:64px;padding:16px 20px}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border)}
.header h1{font-family:'Space Grotesk',sans-serif;font-size:1.2rem;font-weight:600;background:linear-gradient(90deg,var(--cyan),var(--purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.status-badge{display:flex;align-items:center;gap:4px;padding:4px 8px;background:rgba(34,197,94,0.1);border-radius:12px;font-size:10px;color:var(--green)}
.dot{width:5px;height:5px;background:var(--green);border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
.time{color:var(--muted);font-size:11px}
.card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px}
.card-title{font-family:'Space Grotesk',sans-serif;font-size:12px;font-weight:600;margin-bottom:10px;display:flex;align-items:center;gap:6px}
.icon{width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px}
.ic-cyan{background:rgba(0,245,255,0.1);color:var(--cyan)}
.ic-purple{background:rgba(168,85,247,0.1);color:var(--purple)}
.ic-green{background:rgba(34,197,94,0.1);color:var(--green)}
.ic-yellow{background:rgba(251,191,36,0.1);color:var(--yellow)}
.ic-pink{background:rgba(236,72,153,0.1);color:var(--pink)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.grid-item{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:12px;cursor:pointer;transition:all .2s}
.grid-item:hover{border-color:rgba(0,245,255,0.3)}
.grid-val{font-family:'Space Grotesk',sans-serif;font-size:20px;font-weight:700}
.grid-label{font-size:10px;color:var(--muted);margin-top:2px}
.progress{margin:8px 0}
.progress-header{display:flex;justify-content:space-between;font-size:10px;margin-bottom:4px}
.progress-bar{height:4px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden}
.progress-fill{height:100%;border-radius:2px}
.task{background:var(--card-h);border-radius:6px;padding:10px;margin-bottom:6px;border-left:3px solid var(--yellow)}
.task.processing{border-left-color:var(--cyan)}
.task.completed{border-left-color:var(--green);opacity:0.6}
.task-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px}
.task-content{font-size:11px;flex:1}
.task-btns{display:flex;gap:3px}
.btn{padding:3px 6px;font-size:9px;border:none;border-radius:3px;cursor:pointer;font-family:inherit;transition:all .15s}
.btn-c{background:rgba(34,197,94,0.15);color:var(--green)}
.btn-c:hover{background:var(--green);color:#000}
.btn-m{background:rgba(251,191,36,0.15);color:var(--yellow)}
.btn-m:hover{background:var(--yellow);color:#000}
.btn-d{background:rgba(239,68,68,0.15);color:var(--red)}
.btn-d:hover{background:var(--red);color:#fff}
.task-meta{font-size:9px;color:var(--muted);display:flex;gap:8px;margin-top:3px}
.subtasks{margin-top:6px;padding-left:8px;border-left:2px solid var(--border)}
.subtask{font-size:10px;color:var(--muted);padding:2px 0;display:flex;align-items:center;gap:6px}
.subtask.done{text-decoration:line-through;opacity:0.5}
.token{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)}
.token:last-child{border:none}
.tok-info{}
.tok-name{font-weight:600;font-size:11px}
.tok-key{font-size:9px;color:var(--muted);font-family:monospace}
.toggle{position:relative;width:32px;height:18px}
.toggle input{opacity:0;width:0;height:0}
.slider{position:absolute;cursor:pointer;inset:0;background:var(--card-h);border-radius:18px;transition:.3s}
.slider:before{content:"";position:absolute;height:12px;width:12px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.3s}
.toggle input:checked+.slider{background:var(--green)}
.toggle input:checked+.slider:before{transform:translateX(14px)}
.gw-token{background:var(--card-h);border-radius:6px;padding:10px;margin-top:10px}
.gw-label{font-size:9px;color:var(--muted)}
.gw-val{font-family:monospace;font-size:10px;color:var(--cyan);word-break:break-all}
.zt-box{background:var(--card-h);border-radius:8px;padding:16px;text-align:center;margin:10px 0}
.zt-label{font-size:9px;color:var(--muted);margin-bottom:4px}
.zt-val{font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;color:var(--cyan)}
.zt-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.zt-cell{background:var(--card-h);padding:8px;border-radius:6px}
.zt-cell-label{font-size:9px;color:var(--muted)}
.zt-cell-val{font-size:11px;font-weight:500;margin-top:2px}
.node{display:flex;justify-content:space-between;align-items:center;padding:8px;background:var(--card-h);border-radius:6px;margin-bottom:6px}
.node-name{font-size:11px}
.node-lat{font-size:9px;padding:2px 6px;border-radius:8px;background:rgba(34,197,94,0.1);color:var(--green)}
.node-lat.hi{background:rgba(239,68,68,0.1);color:var(--red)}
.node-lat.md{background:rgba(251,191,36,0.1);color:var(--yellow)}
.log{padding:6px 0;border-bottom:1px solid var(--border);font-size:10px;display:flex;gap:8px}
.log:last-child{border:none}
.log-t{color:var(--muted);white-space:nowrap}
.log-s{color:var(--purple);white-space:nowrap}
.log-c{color:var(--muted)}
.page{display:none}
.page.active{display:block}
.input{width:100%;background:var(--card-h);border:1px solid var(--border);border-radius:4px;padding:6px 8px;color:var(--text);font-family:inherit;font-size:11px;margin:4px 0}
.input:focus{outline:none;border-color:var(--cyan)}
.btn-p{padding:6px 10px;border:none;border-radius:4px;font-family:inherit;font-size:10px;cursor:pointer;background:var(--cyan);color:#000}
.btn-p:hover{background:#00d4e0}
.btn-s{background:var(--card-h);color:var(--text);border:1px solid var(--border)}
.btn-s:hover{border-color:var(--cyan)}
</style></head>
<body>
<nav class="sidebar">
<div class="sidebar-logo">G</div>
<div class="nav ${page==='overview'?'active':''}" onclick="navigate('overview')"><span>⌂</span><span class="tooltip">Overview</span></div>
<div class="nav ${page==='zerotier'?'active':''}" onclick="navigate('zerotier')"><span>Z</span><span class="tooltip">ZeroTier</span></div>
<div class="nav ${page==='tasks'?'active':''}" onclick="navigate('tasks')"><span>Q</span><span class="tooltip">Tasks</span></div>
<div class="nav ${page==='tokens'?'active':''}" onclick="navigate('tokens')"><span>T</span><span class="tooltip">Tokens</span></div>
<div class="nav ${page==='system'?'active':''}" onclick="navigate('system')"><span>S</span><span class="tooltip">System</span></div>
<div class="nav ${page==='mihomo'?'active':''}" onclick="navigate('mihomo')"><span>M</span><span class="tooltip">Mihomo</span></div>
<div class="nav ${page==='output'?'active':''}" onclick="navigate('output')"><span>L</span><span class="tooltip">Logs</span></div>
</nav>
<main class="main">
<header class="header"><h1>Glitch Dashboard</h1>
<div class="header-right"><div class="status-badge"><div class="dot"></div>Online</div></div>
</header>
<div class="page ${page==='overview'?'active':''}" id="page-overview">
<div class="grid">
<div class="grid-item" onclick="navigate('system')"><div class="grid-val" style="color:${getCpuColor(system.cpu.usage)}">${system.cpu.usage}%</div><div class="grid-label">CPU</div></div>
<div class="grid-item" onclick="navigate('system')"><div class="grid-val" style="color:${getMemColor(system.memory.percent)}">${system.memory.percent}%</div><div class="grid-label">Memory</div></div>
<div class="grid-item" onclick="navigate('zerotier')"><div class="grid-val" style="color:var(--green)">${zerotier.ztIP.split('.')[3]||'N/A'}</div><div class="grid-label">ZT IP</div></div>
<div class="grid-item" onclick="navigate('tasks')"><div class="grid-val" style="color:var(--yellow)">${taskQueue.stats.pending}</div><div class="grid-label">Tasks</div></div>
<div class="grid-item" onclick="navigate('tokens')"><div class="grid-val" style="color:var(--pink)">${tokenManager.tokens.filter(t=>t.status).length}</div><div class="grid-label">Tokens</div></div>
<div class="grid-item" onclick="navigate('mihomo')"><div class="grid-val" style="color:var(--purple)">${mihomo.running?'ON':'OFF'}</div><div class="grid-label">Mihomo</div></div>
</div>
</div>
<div class="page ${page==='zerotier'?'active':''}" id="page-zerotier">
<div class="card"><div class="card-title"><div class="icon ic-purple">Z</div>ZeroTier</div>
<div class="zt-box"><div class="zt-label">ZeroTier IP</div><div class="zt-val">${zerotier.ztIP}</div></div>
<div class="zt-grid">
<div class="zt-cell"><div class="zt-cell-label">Physical</div><div class="zt-cell-val">${system.physicalIP}</div></div>
<div class="zt-cell"><div class="zt-cell-label">ZT Address</div><div class="zt-cell-val">${zerotier.address}</div></div>
<div class="zt-cell"><div class="zt-cell-label">Network</div><div class="zt-cell-val">${zerotier.network||'N/A'}</div></div>
<div class="zt-cell"><div class="zt-cell-label">Status</div><div class="zt-cell-val" style="color:var(--green)">${zerotier.online?'Connected':'Offline'}</div></div>
</div></div>
<div class="card"><div class="card-title">Config</div>
<input class="input" id="zt-sub" placeholder="Subscribe URL">
<button class="btn btn-p" onclick="applyZT()">Apply</button></div>
</div>
<div class="page ${page==='tasks'?'active':''}" id="page-tasks">
<div class="card"><div class="card-title"><div class="icon ic-green">Q</div>Tasks (${taskQueue.stats.pending} pending)</div>
${taskQueue.tasks.map(t=>`
<div class="task ${t.state}">
<div class="task-head"><div class="task-content">${t.content}</div>
<div class="task-btns"><button class="btn btn-c" onclick="taskAct('complete','${t.id}')">Done</button><button class="btn btn-m" onclick="taskAct('mod','${t.id}')">Mod</button><button class="btn btn-d" onclick="taskAct('del','${t.id}')">X</button></div></div>
<div class="task-meta"><span>[${t.platform}]</span><span>P:${t.priority}</span></div>
${t.subtasks?.length?`<div class="subtasks">${t.subtasks.map(s=>`<div class="subtask ${s.state}"><input type="checkbox" ${s.state==='completed'?'checked':''}> <span>${s.content}</span></div>`).join('')}</div>`:''}
</div>`).join('')}
</div></div>
<div class="page ${page==='tokens'?'active':''}" id="page-tokens">
<div class="card"><div class="card-title"><div class="icon ic-pink">T</div>Tokens</div>
${tokenManager.tokens.map(t=>`<div class="token"><div class="tok-info"><div class="tok-name">${t.name}</div><div class="tok-key">${t.key}</div></div><label class="toggle"><input type="checkbox" ${t.status?'checked':''}><span class="slider"></span></label></div>`).join('')}
<div class="gw-token"><div class="gw-label">Gateway Token</div><div class="gw-val">${tokenManager.gatewayToken}</div></div>
</div></div>
<div class="page ${page==='system'?'active':''}" id="page-system">
<div class="card"><div class="card-title"><div class="icon ic-cyan">S</div>System</div>
<div class="progress"><div class="progress-header"><span>CPU</span><span>${system.cpu.usage}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${system.cpu.usage}%;background:linear-gradient(90deg,${getCpuColor(system.cpu.usage)},${getCpuColor(system.cpu.usage)})"></div></div></div>
<div class="progress"><div class="progress-header"><span>Memory</span><span>${system.memory.percent}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${system.memory.percent}%;background:linear-gradient(90deg,${getMemColor(system.memory.percent)},${getMemColor(system.memory.percent)})"></div></div></div>
<div class="zt-grid" style="margin-top:12px"><div class="zt-cell"><div class="zt-cell-label">Hostname</div><div class="zt-cell-val">${system.hostname}</div></div><div class="zt-cell"><div class="zt-cell-label">Uptime</div><div class="zt-cell-val">${formatUptime(system.uptime)}</div></div></div>
</div></div>
<div class="page ${page==='mihomo'?'active':''}" id="page-mihomo">
<div class="card"><div class="card-title"><div class="icon ic-purple">M</div>Mihomo <span style="color:var(--green);font-size:10px;margin-left:auto">${mihomo.running?'Running':'Stopped'}</span></div>
<div class="input" id="mihomo-sub" placeholder="Subscribe URL" value="${mihomo.subscribe}"></div>
<button class="btn btn-p" style="margin-top:8px" onclick="updateSub()">Update Subscribe</button>
<div style="margin-top:14px"><div class="card-title">Nodes</div>
${mihomo.nodes.map(n=>`<div class="node"><span class="node-name">${n.name}</span><span class="node-lat ${n.latency>100?'hi':n.latency>60?'md':''}">${n.latency}ms</span></div>`).join('')}
</div></div></div>
<div class="page ${page==='output'?'active':''}" id="page-output">
<div class="card"><div class="card-title"><div class="icon ic-yellow">L</div>Logs</div>
${outputs.map(o=>`<div class="log"><span class="log-t">${new Date(o.timestamp).toLocaleTimeString()}</span><span class="log-s">[${o.source}]</span><span class="log-c">${o.content}</span></div>`).join('')}
</div></div>
</main>
<script>
function navigate(p){sessionStorage.setItem('page',p);location.href='?page='+p}
const saved=sessionStorage.getItem('page');if(saved&&saved!=='${page}'){document.getElementById('page-'+saved)?.classList.add('active');document.querySelectorAll('.nav').forEach(n=>n.classList.remove('active'));}
function taskAct(a,i){console.log(a,i);}
function taskAct('complete','+i+'){}function taskAct('mod','+i+'){}function taskAct('del','+i+'){}
setTimeout(()=>location.reload(),10000);
</script></body></html>`;
}

function main() {
  const port = parseInt(process.argv[2]) || DEFAULT_PORT;
  const ip = Object.values(os.networkInterfaces()).flat().find(i=>i.family==='IPv4'&&!i.internal)?.address||'0.0.0.0';
  http.createServer(handleRequest).listen(port,'0.0.0.0',()=>{
    console.log(`Dashboard: http://localhost:${port} | http://${ip}:${port} | http://172.26.21.18:${port}`);
  });
}
main();
