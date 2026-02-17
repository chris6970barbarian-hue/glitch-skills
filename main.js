#!/usr/bin/env node

/**
 * Task Queue - Persistent message/task queue with priority and state management
 * 
 * Designed for:
 * - Multi-platform input (Discord, Telegram, Lark, WeChat)
 * - Priority-based task ordering
 * - Persistent state across restarts/crashes
 * - Sequential processing (complete one message before next)
 * - Session recovery
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const C = {
  reset: '\x1b[0m', bright: '\x1b[1m', green: '\x1b[32m',
  red: '\x1b[1m', yellow: '\x1b[33m', cyan: '\x1b[36m',
  magenta: '\x1b[35m', gray: '\x1b[90m'
};

const log = (msg, color = 'reset') => console.log(`${C[color]}${msg}${C.reset}`);

const CONFIG_DIR = path.join(process.env.HOME || '/home/crix', '.task-queue');
const QUEUE_FILE = path.join(CONFIG_DIR, 'queue.json');
const STATE_FILE = path.join(CONFIG_DIR, 'state.json');
const PROGRESS_FILE = path.join(CONFIG_DIR, 'progress.json');

// Default config
const DEFAULT_CONFIG = {
  maxRetries: 3,
  retryDelay: 5000,
  persistInterval: 5000,
  autoProcess: true,
  platforms: ['discord', 'telegram', 'lark', 'wechat', 'signal', 'whatsapp']
};

// Priority levels
const PRIORITY = {
  CRITICAL: 0,  // Emergency/urgent
  HIGH: 1,       // Important tasks
  NORMAL: 2,     // Regular messages
  LOW: 3         // Background tasks
};

// Task states
const TASK_STATE = {
  PENDING: 'pending',
  PROCESSING: 'processing', 
  COMPLETED: 'completed',
  FAILED: 'failed',
  WAITING: 'waiting'  // Waiting for sub-tasks
};

class TaskQueue {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.queue = [];        // Main queue
    this.currentTask = null; // Currently processing
    this.state = {
      status: 'idle',        // idle, processing, paused, error
      lastProcessed: null,
      totalProcessed: 0,
      totalFailed: 0,
      sessionId: null,
      startedAt: new Date().toISOString()
    };
    this.progress = {};      // Track sub-task progress
    
    this.load();
    
    // Auto-save interval
    if (this.config.autoProcess) {
      this.saveInterval = setInterval(() => this.persist(), this.config.persistInterval);
    }
  }

  // ============ Persistence ============

  load() {
    // Load queue
    if (fs.existsSync(QUEUE_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
        this.queue = data.messages || [];
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
    
    // Load progress
    if (fs.existsSync(PROGRESS_FILE)) {
      try {
        this.progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
      } catch (e) {
        this.progress = {};
      }
    }
  }

  persist() {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    fs.writeFileSync(QUEUE_FILE, JSON.stringify({
      messages: this.queue,
      updatedAt: new Date().toISOString()
    }, null, 2));
    
    fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
    
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(this.progress, null, 2));
  }

  // ============ Queue Operations ============

  // Add message to queue
  enqueue(content, options = {}) {
    const {
      platform = 'unknown',
      userId = 'unknown',
      priority = PRIORITY.NORMAL,
      metadata = {},
      sessionId = null
    } = options;
    
    const task = {
      id: `task_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      content,
      platform,
      userId,
      priority,
      metadata,
      sessionId,
      state: TASK_STATE.PENDING,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      subTasks: [],
      retryCount: 0
    };
    
    // Parse content for sub-tasks (lines starting with - or numbered)
    const lines = content.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        task.subTasks.push({
          id: `${task.id}_sub_${task.subTasks.length}`,
          content: trimmed.substring(2),
          state: TASK_STATE.PENDING
        });
      }
    }
    
    // Add to queue by priority
    const insertIndex = this.queue.findIndex(t => t.priority > priority);
    if (insertIndex >= 0) {
      this.queue.splice(insertIndex, 0, task);
    } else {
      this.queue.push(task);
    }
    
    this.persist();
    log(`Enqueued: ${task.id} [${platform}] priority:${priority}`, 'green');
    
    // Auto-start processing if idle
    if (this.config.autoProcess && this.state.status === 'idle') {
      this.processNext();
    }
    
    return task;
  }

  // Get next task (highest priority, oldest)
  getNextTask() {
    return this.queue.find(t => t.state === TASK_STATE.PENDING);
  }

  // Start processing a task
  async processNext() {
    // Find next pending task
    const task = this.getNextTask();
    
    if (!task) {
      this.state.status = 'idle';
      this.currentTask = null;
      this.persist();
      log('Queue empty, waiting...', 'gray');
      return null;
    }
    
    this.currentTask = task;
    this.state.status = 'processing';
    task.state = TASK_STATE.PROCESSING;
    task.startedAt = new Date().toISOString();
    
    this.persist();
    log(`Processing: ${task.id} [${task.platform}]`, 'cyan');
    
    return task;
  }

  // Complete current task
  completeTask(result = {}) {
    if (!this.currentTask) return false;
    
    const task = this.currentTask;
    task.state = TASK_STATE.COMPLETED;
    task.completedAt = new Date().toISOString();
    task.result = result;
    
    // Remove from queue
    this.queue = this.queue.filter(t => t.id !== task.id);
    
    this.state.lastProcessed = task.id;
    this.state.totalProcessed++;
    this.state.status = 'idle';
    this.currentTask = null;
    
    // Clear progress for this task
    delete this.progress[task.id];
    
    this.persist();
    log(`Completed: ${task.id}`, 'green');
    
    // Process next
    if (this.config.autoProcess && this.queue.length > 0) {
      setTimeout(() => this.processNext(), 1000);
    }
    
    return true;
  }

  // Mark sub-task complete
  completeSubTask(subTaskId) {
    if (!this.currentTask) return false;
    
    const subTask = this.currentTask.subTasks.find(st => st.id === subTaskId);
    if (subTask) {
      subTask.state = TASK_STATE.COMPLETED;
      this.progress[this.currentTask.id] = {
        completed: this.currentTask.subTasks.filter(st => st.state === TASK_STATE.COMPLETED).length,
        total: this.currentTask.subTasks.length
      };
      this.persist();
      return true;
    }
    return false;
  }

  // Fail task
  failTask(error) {
    if (!this.currentTask) return false;
    
    const task = this.currentTask;
    task.retryCount++;
    
    if (task.retryCount >= this.config.maxRetries) {
      task.state = TASK_STATE.FAILED;
      task.error = error;
      this.state.totalFailed++;
      this.queue = this.queue.filter(t => t.id !== task.id);
      log(`Failed: ${task.id} after ${task.retryCount} retries`, 'red');
    } else {
      task.state = TASK_STATE.PENDING;
      log(`Retrying: ${task.id} (${task.retryCount}/${this.config.maxRetries})`, 'yellow');
    }
    
    this.state.status = 'idle';
    this.currentTask = null;
    this.persist();
    
    // Next
    if (this.config.autoProcess) {
      this.processNext();
    }
    
    return true;
  }

  // Pause processing
  pause() {
    this.state.status = 'paused';
    this.persist();
    log('Queue paused', 'yellow');
  }

  // Resume processing
  resume() {
    this.state.status = 'idle';
    this.persist();
    log('Queue resumed', 'green');
    if (this.config.autoProcess) {
      this.processNext();
    }
  }

  // Clear completed/failed
  clear() {
    this.queue = this.queue.filter(t => 
      t.state === TASK_STATE.PROCESSING || t.state === TASK_STATE.PENDING
    );
    this.persist();
    log('Queue cleared', 'cyan');
  }

  // ============ Status ============

  getStatus() {
    const pending = this.queue.filter(t => t.state === TASK_STATE.PENDING).length;
    const processing = this.queue.filter(t => t.state === TASK_STATE.PROCESSING).length;
    const completed = this.state.totalProcessed;
    const failed = this.state.totalFailed;
    const total = this.queue.length;
    
    return {
      status: this.state.status,
      queue: {
        pending,
        processing,
        total
      },
      stats: {
        completed,
        failed,
        lastProcessed: this.state.lastProcessed
      },
      currentTask: this.currentTask ? {
        id: this.currentTask.id,
        content: this.currentTask.content.substring(0, 100),
        platform: this.currentTask.platform,
        progress: this.progress[this.currentTask.id] || null
      } : null
    };
  }

  // Format for chat
  formatForChat() {
    const status = this.getStatus();
    
    let msg = `📋 *Task Queue Status*\n\n`;
    msg += `Status: ${status.status === 'processing' ? '⚙️ Processing' : '💤 Idle'}\n`;
    msg += `Queue: ${status.queue.pending} pending, ${status.queue.processing} processing\n`;
    msg += `Stats: ✅ ${status.stats.completed} completed, ❌ ${status.stats.failed} failed\n`;
    
    if (status.currentTask) {
      msg += `\n🔄 *Current Task:*\n`;
      msg += `ID: ${status.currentTask.id}\n`;
      msg += `Platform: ${status.currentTask.platform}\n`;
      msg += `Content: ${status.currentTask.content}...\n`;
      if (status.currentTask.progress) {
        msg += `Progress: ${status.currentTask.progress.completed}/${status.currentTask.progress.total} sub-tasks\n`;
      }
    }
    
    return msg;
  }

  // ============ API Server ============

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
      
      // GET /queue
      if (req.method === 'GET' && url.pathname === '/queue') {
        res.end(JSON.stringify(this.queue));
        return;
      }
      
      // POST /enqueue
      if (req.method === 'POST' && url.pathname === '/enqueue') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const task = this.enqueue(data.content, {
              platform: data.platform || 'api',
              userId: data.userId,
              priority: data.priority || PRIORITY.NORMAL,
              metadata: data.metadata || {}
            });
            res.end(JSON.stringify({ success: true, taskId: task.id }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }
      
      // POST /complete
      if (req.method === 'POST' && url.pathname === '/complete') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const result = this.completeTask(data.result);
            res.end(JSON.stringify({ success: result }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }
      
      // POST /fail
      if (req.method === 'POST' && url.pathname === '/fail') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const result = this.failTask(data.error);
            res.end(JSON.stringify({ success: result }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }
      
      // POST /pause, /resume, /clear
      if (req.method === 'POST') {
        if (url.pathname === '/pause') {
          this.pause();
          res.end(JSON.stringify({ success: true }));
          return;
        }
        if (url.pathname === '/resume') {
          this.resume();
          res.end(JSON.stringify({ success: true }));
          return;
        }
        if (url.pathname === '/clear') {
          this.clear();
          res.end(JSON.stringify({ success: true }));
          return;
        }
      }
      
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
    });
    
    server.listen(port, () => {
      log(`Task Queue server: http://localhost:${port}`, 'cyan');
    });
    
    return server;
  }

  shutdown() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    this.persist();
    log('Task Queue saved and shutdown', 'gray');
  }
}

// CLI
function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  
  let config = DEFAULT_CONFIG;
  const configPath = path.join(CONFIG_DIR, 'config.json');
  if (fs.existsSync(configPath)) {
    try { config = { ...config, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) }; }
    catch (e) {}
  }
  
  const queue = new TaskQueue(config);
  
  switch (cmd) {
    case 'enqueue':
    case 'add':
      const content = args.slice(1).join(' ');
      if (!content) {
        log('Usage: task-queue enqueue <message> [--platform discord] [--priority high]');
        process.exit(1);
      }
      const platform = args.includes('--platform') ? args[args.indexOf('--platform') + 1] : 'cli';
      const priority = args.includes('--priority') ? 
        (args[args.indexOf('--priority') + 1] === 'high' ? PRIORITY.HIGH : PRIORITY.NORMAL) : 
        PRIORITY.NORMAL;
      console.log(queue.enqueue(content, { platform, priority }));
      break;
      
    case 'status':
    case 'stat':
      console.log(JSON.stringify(queue.getStatus(), null, 2));
      break;
      
    case 'chat':
      console.log(queue.formatForChat());
      break;
      
    case 'complete':
    case 'done':
      queue.completeTask();
      break;
      
    case 'fail':
      queue.failTask(args.slice(1).join(' ') || 'Unknown error');
      break;
      
    case 'pause':
      queue.pause();
      break;
      
    case 'resume':
      queue.resume();
      break;
      
    case 'clear':
      queue.clear();
      break;
      
    case 'server':
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
      console.log(`
Task Queue - Persistent multi-platform task queue

USAGE:
  task-queue enqueue <msg> [--platform discord] [--priority high]
  task-queue status           JSON status
  task-queue chat             Chat format
  task-queue complete         Mark current complete
  task-queue fail <error>     Mark current failed
  task-queue pause            Pause processing
  task-queue resume           Resume processing
  task-queue clear           Clear queue
  task-queue server [port]   Start API server

PLATFORMS: discord, telegram, lark, wechat, signal, whatsapp

PRIORITY: critical, high, normal, low

API:
  POST /enqueue {content, platform, priority}
  POST /complete {result}
  POST /fail {error}
  GET  /status
  GET  /queue
  POST /pause, /resume, /clear

CONFIG:
  ${configPath}
      `);
  }
}

main();
