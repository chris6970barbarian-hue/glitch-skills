#!/usr/bin/env node

/**
 * ZeroTier Deploy - Auto-deploy ZeroTier + LAN sharing page
 * 
 * Features:
 * - Auto-install ZeroTier
 * - Join network
 * - Generate LAN sharing page
 * - Status monitoring
 */

const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');

const C = {
  reset: '\x1b[0m', bright: '\x1b[1m', green: '\x1b[32m',
  red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m'
};

const log = (msg, color = 'reset') => console.log(`${C[color]}${msg}${C.reset}`);

const CONFIG_DIR = path.join(process.env.HOME || '/home/crix', '.zerotier-deploy');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Default config
const DEFAULT_CONFIG = {
  networkId: '',        // ZeroTier network ID
  apiKey: '',           // ZeroTier Central API key (for management)
  lanPort: 3852,        // LAN sharing page port
  autoStart: true,
  installDependencies: true
};

function loadConfig() {
  let config = { ...DEFAULT_CONFIG };
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
    } catch (e) {}
  }
  return config;
}

function saveConfig(config) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Execute shell command
function execCmd(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout, stderr });
    });
  });
}

// Check if ZeroTier is installed
async function isInstalled() {
  try {
    await execCmd('which zerotier-cli');
    return true;
  } catch (e) {
    return false;
  }
}

// Install ZeroTier
async function install() {
  const platform = os.platform();
  
  log(`Installing ZeroTier on ${platform}...`, 'cyan');
  
  try {
    if (platform === 'linux') {
      // Ubuntu/Debian
      await execCmd('curl -s https://install.zerotier.com | bash');
    } else if (platform === 'darwin') {
      // macOS
      await execCmd('brew install zerotier-cli');
    } else if (platform === 'win32') {
      log('Windows: Download from https://www.zerotier.com/download/', 'yellow');
      return false;
    }
    log('ZeroTier installed successfully', 'green');
    return true;
  } catch (e) {
    log(`Installation failed: ${e.message}`, 'red');
    return false;
  }
}

// Join network
async function joinNetwork(networkId) {
  if (!networkId) {
    log('No network ID provided', 'red');
    return false;
  }
  
  log(`Joining network: ${networkId}`, 'cyan');
  
  try {
    // Check if already joined
    const { stdout } = await execCmd(`zerotier-cli listnetworks`);
    if (stdout.includes(networkId)) {
      log('Already member of this network', 'yellow');
      return true;
    }
    
    // Join network
    await execCmd(`zerotier-cli join ${networkId}`);
    
    // Authorize node (requires API key)
    const config = loadConfig();
    if (config.apiKey) {
      try {
        await execCmd(`curl -s -X POST "https://api.zerotier.com/api/v1/network/${networkId}/member" \
          -H "Authorization: Bearer ${config.apiKey}" \
          -H "Content-Type: application/json" \
          -d '{"config": {"authorized": true}}'`);
      } catch (e) {
        log('Could not auto-authorize (may need manual approval)', 'yellow');
      }
    }
    
    log(`Joined network ${networkId}`, 'green');
    return true;
  } catch (e) {
    log(`Failed to join: ${e.message}`, 'red');
    return false;
  }
}

// Leave network
async function leaveNetwork(networkId) {
  if (!networkId) return false;
  
  try {
    await execCmd(`zerotier-cli leave ${networkId}`);
    log(`Left network ${networkId}`, 'green');
    return true;
  } catch (e) {
    log(`Failed to leave: ${e.message}`, 'red');
    return false;
  }
}

// Get status
async function getStatus() {
  const installed = await isInstalled();
  const config = loadConfig();
  
  let networkStatus = null;
  if (installed && config.networkId) {
    try {
      const { stdout } = await execCmd(`zerotier-cli listnetworks`);
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        if (line.includes(config.networkId)) {
          const parts = line.split('\t');
          networkStatus = {
            id: parts[0],
            name: parts[1],
            type: parts[2],
            status: parts[3],
            ip: parts[4]
          };
          break;
        }
      }
    } catch (e) {}
  }
  
  return {
    installed,
    networkId: config.networkId,
    networkStatus,
    lanPort: config.lanPort,
    version: installed ? (await execCmd('zerotier-cli version').then(r => r.stdout.trim()).catch(() => 'unknown')) : null
  };
}

// Generate LAN page
function generateLANPage(ip, networkId) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ZeroTier LAN Access</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    .card {
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 2rem;
      margin: 1rem 0;
      backdrop-filter: blur(10px);
    }
    .ip { font-size: 2.5rem; font-weight: bold; color: #00ff88; }
    .info { color: #888; margin-top: 1rem; }
    .status { 
      display: inline-block;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      background: #00ff88;
      color: #1a1a2e;
      font-weight: bold;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>ZeroTier LAN Access</h1>
    <div class="card">
      <div class="ip">${ip}</div>
      <div class="info">Network ID: ${networkId}</div>
      <div class="status">CONNECTED</div>
    </div>
    <p class="info">Access this device using the IP above</p>
  </div>
</body>
</html>
`;
}

// Start LAN server
async function startLANServer(port = 3852) {
  const status = await getStatus();
  
  if (!status.installed) {
    log('ZeroTier not installed', 'red');
    return false;
  }
  
  if (!status.networkStatus) {
    log('Not connected to any network', 'red');
    return false;
  }
  
  const ip = status.networkStatus.ip;
  const networkId = status.networkId;
  
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(generateLANPage(ip, networkId));
  });
  
  server.listen(port, () => {
    log(`LAN page: http://${ip}:${port}`, 'green');
    log(`Alternative: http://localhost:${port}`, 'green');
  });
  
  return server;
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const config = loadConfig();
  
  switch (cmd) {
    case 'install':
      await install();
      break;
      
    case 'join':
      const networkId = args[1] || config.networkId;
      if (!networkId) {
        log('Usage: zerotier-deploy join <network-id>');
        process.exit(1);
      }
      await joinNetwork(networkId);
      break;
      
    case 'leave':
      const leaveId = args[1] || config.networkId;
      await leaveNetwork(leaveId);
      break;
      
    case 'status':
    case 'stat':
      const status = await getStatus();
      console.log(JSON.stringify(status, null, 2));
      break;
      
    case 'lan':
    case 'share':
      const port = parseInt(args[1]) || config.lanPort;
      await startLANServer(port);
      break;
      
    case 'init':
      const initConfig = { ...DEFAULT_CONFIG };
      if (args[1]) initConfig.networkId = args[1];
      if (args[2]) initConfig.apiKey = args[2];
      saveConfig(initConfig);
      log(`Config saved to ${CONFIG_FILE}`, 'green');
      break;
      
    default:
      console.log(`
ZeroTier Deploy - Auto-deploy ZeroTier + LAN sharing page

USAGE:
  zerotier-deploy install           Install ZeroTier
  zerotier-deploy join <network>   Join network
  zerotier-deploy leave             Leave network
  zerotier-deploy status            Show status
  zerotier-deploy lan [port]        Start LAN page
  zerotier-deploy init <network> [api-key]  Save config

EXAMPLES:
  zerotier-deploy install
  zerotier-deploy join a84ac5c1a1234567
  zerotier-deploy lan 3852
  zerotier-deploy init a84ac5c1a1234567 your-api-key

CONFIG:
  ${CONFIG_FILE}
      `);
  }
}

main();
