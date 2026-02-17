#!/usr/bin/env node

/**
 * Queue Sync - Message queue persistence and synchronization
 * 
 * Features:
 * - Persistent message queue storage
 * - Cross-instance synchronization
 * - Message deduplication
 * - Multiple backend support (file, Redis)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const C = {
  reset: '\x1b[0m', bright: '\x1b[1m', green: '\x1b[32m',
  red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m'
};

const log = (msg, color = 'reset') => console.log(`${C[color]}${msg}${C.reset}`);

const CONFIG_DIR = path.join(process.env.HOME || '/home/crix', '.queue-sync');
const QUEUE_FILE = path.join(CONFIG_DIR, 'queue.json');
const STATE_FILE = path.join(CONFIG_DIR, 'state.json');

// Default config
const DEFAULT_CONFIG = {
  backend: 'file', // 'file' or 'redis'
  redis: {
    host: 'localhost',
    port: 6379,
    password: '',
    db: 0
  },
  maxSize: 1000,
  deduplication: true,
  ttl: 86400, // 24 hours
  syncInterval: 5000,
  instanceId: `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
};

class QueueSync {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.queue = [];
    this.state = {
      lastSync: null,
      processed: 0,
      failed: 0,
      instanceId: this.config.instanceId
    };
    this.load();
  }

  // ============ Storage ============

  load() {
    // Load queue
    if (fs.existsSync(QUEUE_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
        this.queue = data.messages || [];
        // Filter expired
        if (this.config.ttl) {
          const now = Date.now();
          this.queue = this.queue.filter(m => !m.expiresAt || m.expiresAt > now);
        }
      } catch (e) {
        this.queue = [];
      }
    }

    // Load state
    if (fs.existsSync(STATE_FILE)) {
      try {
        this.state = { ...this.state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
      } catch (e) {}
    }
  }

  save() {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(QUEUE_FILE, JSON.stringify({
      messages: this.queue,
      updatedAt: new Date().toISOString()
    }, null, 2));
    fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
  }

  // ============ Queue Operations ============

  // Generate message ID
  generateId(content) {
    if (this.config.deduplication) {
      return crypto.createHash('sha256').update(content + Date.now()).digest('hex').substr(0, 16);
    }
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Add message to queue
  enqueue(content, metadata = {}) {
    const message = {
      id: this.generateId(content),
      content,
      metadata,
      enqueuedAt: new Date().toISOString(),
      expiresAt: this.config.ttl ? Date.now() + this.config.ttl : null,
      retries: 0,
      instanceId: this.config.instanceId
    };

    // Deduplication check
    if (this.config.deduplication) {
      const exists = this.queue.find(m => m.content === content);
      if (exists) {
        log(`Message already in queue: ${exists.id}`, 'yellow');
        return { queued: false, id: exists.id, reason: 'duplicate' };
      }
    }

    // Size limit
    if (this.queue.length >= this.config.maxSize) {
      // Remove oldest
      this.queue.shift();
      log('Queue full, removed oldest message', 'yellow');
    }

    this.queue.push(message);
    this.save();
    log(`Enqueued: ${message.id}`, 'green');
    return { queued: true, id: message.id };
  }

  // Get next message
  dequeue() {
    if (this.queue.length === 0) {
      return null;
    }
    const message = this.queue.shift();
    this.state.processed++;
    this.state.lastSync = new Date().toISOString();
    this.save();
    return message;
  }

  // Peek without removing
  peek(count = 1) {
    return this.queue.slice(0, count);
  }

  // Get queue length
  length() {
    return this.queue.length;
  }

  // Clear queue
  clear() {
    this.queue = [];
    this.save();
    log('Queue cleared', 'green');
  }

  // Retry failed message
  retry(messageId) {
    const message = this.queue.find(m => m.id === messageId);
    if (message) {
      message.retries++;
      this.save();
      return true;
    }
    return false;
  }

  // ============ Sync Operations ============

  // Export queue for sync
  export() {
    return {
      messages: this.queue,
      state: this.state,
      exportedAt: new Date().toISOString()
    };
  }

  // Import messages from another instance
  import(data) {
    if (!data || !data.messages) return false;

    let imported = 0;
    for (const msg of data.messages) {
      // Skip if already exists
      const exists = this.queue.find(m => m.id === msg.id);
      if (!exists) {
        this.queue.push(msg);
        imported++;
      }
    }

    if (imported > 0) {
      this.save();
      log(`Imported ${imported} messages`, 'green');
    }
    return imported;
  }

  // Sync with file (for manual sync)
  syncToFile(filepath) {
    const data = this.export();
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    log(`Synced to ${filepath}`, 'green');
  }

  syncFromFile(filepath) {
    if (!fs.existsSync(filepath)) {
      log(`File not found: ${filepath}`, 'red');
      return false;
    }
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    return this.import(data);
  }

  // ============ Status ============

  getStatus() {
    return {
      length: this.queue.length,
      maxSize: this.config.maxSize,
      processed: this.state.processed,
      failed: this.state.failed,
      lastSync: this.state.lastSync,
      instanceId: this.state.instanceId,
      deduplication: this.config.deduplication
    };
  }

  // ============ Web Server ============

  startServer(port = 3850) {
    const http = require('http');
    
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      
      const url = new URL(req.url, `http://localhost:${port}`);
      
      // GET /status
      if (req.method === 'GET' && url.pathname === '/status') {
        res.end(JSON.stringify(this.getStatus()));
        return;
      }
      
      // GET /queue - peek
      if (req.method === 'GET' && url.pathname === '/queue') {
        const count = parseInt(url.searchParams.get('count') || '10');
        res.end(JSON.stringify(this.peek(count)));
        return;
      }
      
      // POST /queue - enqueue
      if (req.method === 'POST' && url.pathname === '/queue') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
          try {
            const { content, metadata } = JSON.parse(body);
            const result = this.enqueue(content, metadata);
            res.end(JSON.stringify(result));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      }
      
      // POST /dequeue - dequeue
      if (req.method === 'POST' && url.pathname === '/dequeue') {
        const msg = this.dequeue();
        res.end(JSON.stringify(msg || { empty: true }));
        return;
      }
      
      // POST /sync - import
      if (req.method === 'POST' && url.pathname === '/sync') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const count = this.import(data);
            res.end(JSON.stringify({ imported: count }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      }
      
      // GET /export
      if (req.method === 'GET' && url.pathname === '/export') {
        res.end(JSON.stringify(this.export()));
        return;
      }
      
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
    });
    
    server.listen(port, () => {
      log(`Queue Sync server: http://localhost:${port}`, 'cyan');
    });
    
    return server;
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
  
  const queue = new QueueSync(config);
  
  switch (cmd) {
    case 'enqueue':
    case 'add':
      const content = args.slice(1).join(' ');
      if (!content) {
        log('Usage: queue-sync enqueue <message>'); 
        process.exit(1);
      }
      console.log(queue.enqueue(content));
      break;
      
    case 'dequeue':
    case 'get':
      const msg = queue.dequeue();
      if (msg) {
        console.log(JSON.stringify(msg, null, 2));
      } else {
        console.log('{ empty: true }');
      }
      break;
      
    case 'peek':
      console.log(JSON.stringify(queue.peek(parseInt(args[1] || 10)), null, 2));
      break;
      
    case 'status':
    case 'stat':
      console.log(JSON.stringify(queue.getStatus(), null, 2));
      break;
      
    case 'clear':
      queue.clear();
      break;
      
    case 'length':
    case 'size':
      console.log(queue.length());
      break;
      
    case 'export':
      queue.syncToFile(args[1] || path.join(CONFIG_DIR, 'sync.json'));
      break;
      
    case 'import':
      queue.syncFromFile(args[1] || path.join(CONFIG_DIR, 'sync.json'));
      break;
      
    case 'server':
    case 'serve':
      queue.startServer(parseInt(args[1]) || 3850);
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
Queue Sync - Message queue persistence and synchronization

USAGE:
  queue-sync enqueue <msg>    Add message to queue
  queue-sync dequeue           Get next message
  queue-sync peek [count]      Peek at messages
  queue-sync status           Show queue status
  queue-sync length           Show queue size
  queue-sync clear            Clear queue
  queue-sync export [file]   Export to file
  queue-sync import [file]   Import from file
  queue-sync server [port]   Start web server

WEB API:
  GET  /status        - Queue status
  GET  /queue?count=N  - Peek N messages
  POST /queue          - Enqueue {content, metadata}
  POST /dequeue        - Dequeue message
  POST /sync           - Import messages
  GET  /export         - Export all

CONFIG:
  ${configPath}
      `, 'cyan');
  }
}

main();
