#!/usr/bin/env node

/**
 * Output Streamer - Real-time terminal output synchronization
 * 
 * Features:
 * - Real-time output streaming
 * - Multi-platform push (Discord, Telegram, webhook)
 * - Log level filtering
 * - Pattern matching and alerts
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, exec } = require('child_process');
const { EventEmitter } = require('events');

const C = {
  reset: '\x1b[0m', bright: '\x1b[1m', green: '\x1b[32m',
  red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', gray: '\x1b[90m'
};

const log = (msg, color = 'reset') => console.log(`${C[color]}${msg}${C.reset}`);

const CONFIG_DIR = path.join(process.env.HOME || '/home/crix', '.output-streamer');

const DEFAULT_CONFIG = {
  logLevels: ['error', 'warn', 'info', 'debug'],
  maxBuffer: 100,
  filter: {
    include: [],
    exclude: ['^DEBUG:', '^TRACE:']
  },
  outputs: {
    console: true,
    webhook: [],
    file: null
  },
  stream: {
    enabled: true,
    bufferSize: 50
  }
};

class OutputStreamer extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.buffer = [];
    this.streaming = false;
    this.watchedProcesses = [];
  }

  // ============ Stream Management ============

  // Watch a process stdout/stderr
  watchProcess(command, args = [], options = {}) {
    const proc = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env }
    });

    const processInfo = {
      command,
      args,
      proc,
      startedAt: new Date().toISOString(),
      pid: proc.pid
    };

    this.watchedProcesses.push(processInfo);

    proc.stdout.on('data', (data) => {
      this.handleOutput('stdout', data.toString(), processInfo);
    });

    proc.stderr.on('data', (data) => {
      this.handleOutput('stderr', data.toString(), processInfo);
    });

    proc.on('close', (code) => {
      this.handleOutput('exit', `Process exited with code ${code}`, processInfo);
      const idx = this.watchedProcesses.findIndex(p => p.pid === proc.pid);
      if (idx >= 0) this.watchedProcesses.splice(idx, 1);
    });

    log(`Watching process: ${command} (PID: ${proc.pid})`, 'cyan');
    return proc;
  }

  // Watch existing output (tail -f)
  watchFile(filepath) {
    if (!fs.existsSync(filepath)) {
      log(`File not found: ${filepath}`, 'red');
      return null;
    }

    let position = fs.statSync(filepath).size;

    const watcher = fs.watch(filepath, (eventType) => {
      if (eventType === 'change') {
        const stats = fs.statSync(filepath);
        if (stats.size > position) {
          const stream = fs.createReadStream(filepath, {
            start: position,
            end: stats.size
          });
          let data = '';
          stream.on('data', (chunk) => data += chunk);
          stream.on('end', () => {
            if (data.trim()) {
              this.handleOutput('file', data, { command: `tail -f ${filepath}` });
            }
          });
          position = stats.size;
        }
      }
    });

    log(`Watching file: ${filepath}`, 'cyan');
    return watcher;
  }

  // Handle output with filtering
  handleOutput(source, text, processInfo) {
    const lines = text.split('\n').filter(l => l.trim());

    for (const line of lines) {
      // Apply filters
      if (!this.shouldInclude(line)) continue;

      const entry = {
        timestamp: new Date().toISOString(),
        source,
        content: line,
        process: processInfo.command,
        pid: processInfo.pid
      };

      // Add to buffer
      this.buffer.push(entry);
      if (this.buffer.length > this.config.maxBuffer) {
        this.buffer.shift();
      }

      // Emit event
      this.emit('output', entry);

      // Console output
      if (this.config.outputs.console) {
        const color = source === 'stderr' ? 'red' : source === 'exit' ? 'yellow' : 'gray';
        log(`[${source}] ${line}`, color);
      }

      // Webhook push
      this.pushToWebhooks(entry);

      // File output
      this.writeToFile(entry);
    }
  }

  shouldInclude(line) {
    // Exclude patterns
    for (const pattern of this.config.filter.exclude) {
      if (new RegExp(pattern).test(line)) return false;
    }

    // Include patterns (if specified)
    if (this.config.filter.include.length > 0) {
      for (const pattern of this.config.filter.include) {
        if (new RegExp(pattern).test(line)) return true;
      }
      return false;
    }

    return true;
  }

  // ============ Output Destinations ============

  pushToWebhooks(entry) {
    for (const webhook of this.config.outputs.webhook) {
      this.sendWebhook(webhook, entry);
    }
  }

  sendWebhook(webhook, entry) {
    const body = JSON.stringify({
      text: `\`[${entry.source}]\` ${entry.content}`,
      username: 'Output Streamer',
      embeds: [{
        title: entry.process,
        description: entry.content,
        timestamp: entry.timestamp,
        color: entry.source === 'stderr' ? 16711680 : 65280
      }]
    });

    const url = new URL(webhook.url);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
      if (res.statusCode >= 400) {
        log(`Webhook failed: ${res.statusCode}`, 'yellow');
      }
    });

    req.on('error', (e) => {
      log(`Webhook error: ${e.message}`, 'yellow');
    });

    req.write(body);
    req.end();
  }

  writeToFile(entry) {
    if (!this.config.outputs.file) return;
    const line = `[${entry.timestamp}] [${entry.source}] ${entry.content}\n`;
    fs.appendFileSync(this.config.outputs.file, line);
  }

  // ============ Buffer Operations ============

  getBuffer(count = 50) {
    return this.buffer.slice(-count);
  }

  clearBuffer() {
    this.buffer = [];
  }

  // ============ Server Mode ============

  startServer(port = 3851) {
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');

      const url = new URL(req.url, `http://localhost:${port}`);

      if (req.method === 'GET' && url.pathname === '/buffer') {
        const count = parseInt(url.searchParams.get('count') || '50');
        res.end(JSON.stringify(this.getBuffer(count)));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/status') {
        res.end(JSON.stringify({
          streaming: this.streaming,
          bufferSize: this.buffer.length,
          watchedProcesses: this.watchedProcesses.length
        }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/clear') {
        this.clearBuffer();
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/stream') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
          try {
            const { content, level } = JSON.parse(body);
            this.handleOutput('http', content, { command: 'http' });
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    server.listen(port, () => {
      log(`Output Streamer server: http://localhost:${port}`, 'cyan');
    });

    return server;
  }

  // ============ Process Management ============

  stopAll() {
    for (const procInfo of this.watchedProcesses) {
      try {
        process.kill(procInfo.pid);
      } catch (e) {}
    }
    this.watchedProcesses = [];
  }
}

// CLI
function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  // Load config
  let config = DEFAULT_CONFIG;
  const configPath = path.join(CONFIG_DIR, 'config.json');
  if (fs.existsSync(configPath)) {
    try { config = { ...config, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) }; }
    catch (e) {}
  }

  const streamer = new OutputStreamer(config);

  switch (cmd) {
    case 'watch':
      const command = args[1];
      const procArgs = args.slice(2);
      if (!command) {
        log('Usage: output-streamer watch <command> [args...]');
        process.exit(1);
      }
      streamer.watchProcess(command, procArgs);
      process.on('SIGINT', () => {
        streamer.stopAll();
        process.exit(0);
      });
      break;

    case 'file':
      const filepath = args[1];
      if (!filepath) {
        log('Usage: output-streamer file <path>');
        process.exit(1);
      }
      streamer.watchFile(filepath);
      break;

    case 'server':
      streamer.startServer(parseInt(args[1]) || 3851);
      break;

    case 'buffer':
    case 'log':
      console.log(JSON.stringify(streamer.getBuffer(parseInt(args[1]) || 50), null, 2));
      break;

    case 'clear':
      streamer.clearBuffer();
      log('Buffer cleared', 'green');
      break;

    case 'status':
      console.log(JSON.stringify({
        bufferSize: streamer.buffer.length,
        watchedProcesses: streamer.watchedProcesses.length
      }, null, 2));
      break;

    case 'init':
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      log(`Config created at ${configPath}`, 'green');
      break;

    default:
      log(`
Output Streamer - Real-time terminal output synchronization

USAGE:
  output-streamer watch <cmd> [args...]  Watch process output
  output-streamer file <path>            Watch file tail
  output-streamer server [port]          Start web server
  output-streamer buffer [count]         Show buffer
  output-streamer status                 Show status
  output-streamer clear                   Clear buffer

WEB API:
  GET  /buffer?count=N   - Get N lines
  GET  /status          - Server status
  POST /clear           - Clear buffer
  POST /stream          - Push output

CONFIG:
  ${configPath}
      `, 'cyan');
  }
}

main();
