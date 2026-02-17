#!/usr/bin/env node

/**
 * System Monitor - Enhanced with chat platform commands
 * 
 * Features:
 * - CPU/Memory/Disk monitoring
 * - Process management
 * - Chat platform integration
 * - htop-like display
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');

const C = {
  reset: '\x1b[0m', bright: '\x1b[1m', green: '\x1b[32m',
  red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', gray: '\x1b[90m'
};

const log = (msg, color = 'reset') => console.log(`${C[color]}${msg}${C.reset}`);

// Get CPU usage
function getCPU() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }
  
  return {
    cores: cpus.length,
    usage: 100 - (totalIdle / totalTick * 100),
    model: cpus[0].model
  };
}

// Get Memory info
function getMemory() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  
  return {
    total: formatBytes(total),
    used: formatBytes(used),
    free: formatBytes(free),
    percent: Math.round(used / total * 100)
  };
}

// Get Disk usage
function getDisk() {
  return new Promise((resolve) => {
    exec('df -h / | tail -1 | awk \'{print $2,$3,$4,$5}\'', (err, stdout) => {
      if (err) {
        resolve(null);
        return;
      }
      const parts = stdout.trim().split(/\s+/);
      resolve({
        total: parts[0] || 'N/A',
        used: parts[1] || 'N/A',
        free: parts[2] || 'N/A',
        percent: parseInt(parts[3]) || 0
      });
    });
  });
}

// Get top processes
function getTopProcesses(count = 10) {
  return new Promise((resolve) => {
    exec(`ps aux --sort=-%mem | head -${count + 1} | tail -${count}`, (err, stdout) => {
      if (err) {
        resolve([]);
        return;
      }
      
      const processes = [];
      const lines = stdout.trim().split('\n');
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 11) {
          processes.push({
            pid: parseInt(parts[1]),
            user: parts[0],
            mem: parseFloat(parts[3]),
            cpu: parseFloat(parts[2]),
            command: parts.slice(10).join(' ').substring(0, 30)
          });
        }
      }
      
      resolve(processes);
    });
  });
}

// Get load average
function getLoadAvg() {
  return os.loadavg();
}

// Get uptime
function getUptime() {
  const uptime = os.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  return { days, hours, minutes, formatted: `${days}d ${hours}h ${minutes}m` };
}

// Format bytes
function formatBytes(bytes) {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)}G`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)}M`;
}

// Get full status
async function getStatus() {
  const cpu = getCPU();
  const memory = getMemory();
  const disk = await getDisk();
  const load = getLoadAvg();
  const uptime = getUptime();
  const processes = await getTopProcesses(5);
  
  return {
    cpu,
    memory,
    disk,
    load: load.map(l => l.toFixed(2)),
    uptime,
    processes,
    timestamp: new Date().toISOString()
  };
}

// CLI Display
async function displayHtop() {
  const status = await getStatus();
  
  console.clear();
  console.log(C.cyan + C.bright + '╔══════════════════════════════════════════════════════════╗' + C.reset);
  console.log(C.cyan + '║              SYSTEM MONITOR - ' + status.uptime.formatted.padEnd(30) + '║' + C.reset);
  console.log(C.cyan + '╚══════════════════════════════════════════════════════════╝' + C.reset);
  
  // CPU
  const cpuColor = status.cpu.usage > 80 ? 'red' : status.cpu.usage > 50 ? 'yellow' : 'green';
  console.log(`\n${C.bright}CPU:${C.reset} ${C[cpuColor]}${status.cpu.usage.toFixed(1)}%${C.reset} (${status.cpu.cores} cores) - ${status.cpu.model.substring(0, 40)}`);
  
  // Memory
  const memColor = status.memory.percent > 80 ? 'red' : status.memory.percent > 50 ? 'yellow' : 'green';
  console.log(`${C.bright}MEM:${C.reset} ${C[memColor]}${status.memory.percent}%${C.reset} ${status.memory.used} / ${status.memory.total}`);
  
  // Disk
  if (status.disk) {
    const diskColor = status.disk.percent > 80 ? 'red' : status.disk.percent > 50 ? 'yellow' : 'green';
    console.log(`${C.bright}DISK:${C.reset} ${C[diskColor]}${status.disk.percent}%${C.reset} ${status.disk.used} / ${status.disk.total}`);
  }
  
  // Load
  console.log(`${C.bright}LOAD:${C.reset} ${status.load.join(' | ')}`);
  
  // Top processes
  console.log(`\n${C.bright}Top Processes:${C.reset}`);
  console.log(C.gray + '  PID    USER       %MEM    %CPU   COMMAND' + C.reset);
  for (const p of status.processes) {
    const memColor = p.mem > 50 ? 'red' : p.mem > 20 ? 'yellow' : 'reset';
    console.log(`  ${p.pid.toString().padStart(5)}  ${p.user.substring(0,10).padEnd(10)}  ${C[memColor]}${p.mem.toFixed(1).padStart(5)}%${C.reset}  ${p.cpu.toFixed(1).padStart(5)}%  ${p.command}`);
  }
  
  console.log('');
}

// Chat format
function formatForChat(status) {
  const cpuColor = status.cpu.usage > 80 ? '🔴' : status.cpu.usage > 50 ? '🟡' : '🟢';
  const memColor = status.memory.percent > 80 ? '🔴' : status.memory.percent > 50 ? '🟡' : '🟢';
  
  let msg = `📊 *System Status*\n\n`;
  msg += `${cpuColor} CPU: ${status.cpu.usage.toFixed(1)}% (${status.cpu.cores} cores)\n`;
  msg += `${memColor} MEM: ${status.memory.percent}% (${status.memory.used} / ${status.memory.total})\n`;
  
  if (status.disk) {
    const diskColor = status.disk.percent > 80 ? '🔴' : status.disk.percent > 50 ? '🟡' : '🟢';
    msg += `${diskColor} DISK: ${status.disk.percent}% (${status.disk.used} / ${status.disk.total})\n`;
  }
  
  msg += `\n📈 Load: ${status.load.join(' | ')}\n`;
  msg += `⏱️ Uptime: ${status.uptime.formatted}\n`;
  
  msg += `\n🔝 *Top Processes:*\n`;
  for (const p of status.processes.slice(0, 3)) {
    msg += `• ${p.command} (${p.mem.toFixed(1)}% mem)\n`;
  }
  
  return msg;
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  
  switch (cmd) {
    case 'status':
    case 'stat':
      const status = await getStatus();
      console.log(JSON.stringify(status, null, 2));
      break;
      
    case 'htop':
    case 'top':
      await displayHtop();
      break;
      
    case 'chat':
    case 'format':
      const chatStatus = await getStatus();
      console.log(formatForChat(chatStatus));
      break;
      
    case 'watch':
      await displayHtop();
      setInterval(async () => {
        await displayHtop();
      }, 2000);
      break;
      
    case 'simple':
      const simple = await getStatus();
      console.log(`CPU: ${simple.cpu.usage.toFixed(1)}% | MEM: ${simple.memory.percent}% | LOAD: ${simple.load.join(', ')}`);
      break;
      
    default:
      console.log(`
System Monitor - Enhanced with chat platform support

USAGE:
  system-monitor status    JSON status
  system-monitor htop     htop-like display
  system-monitor chat     Chat format output
  system-monitor watch    Continuous htop
  system-monitor simple   One-line status

CONFIG:
  Thresholds can be customized in code
      `);
  }
}

main();
