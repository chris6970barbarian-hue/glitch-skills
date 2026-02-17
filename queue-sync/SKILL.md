# Task Queue

Persistent multi-platform task queue with priority and state management.

## Overview

Task Queue handles messages from all platforms (Discord, Telegram, Lark, WeChat, etc.) with intelligent prioritization and persistent processing. Ensures tasks survive restarts, crashes, and session limits.

## Key Features

- **Multi-Platform Input** - All channels feed into single queue
- **Priority System** - CRITICAL > HIGH > NORMAL > LOW
- **Sequential Processing** - Complete one message before next
- **Sub-task Tracking** - Track multi-line task progress
- **Persistent State** - Survives restarts/crashes
- **Session Recovery** - Resume from last state

## Processing Flow

```
1. Message received from any platform
2. Parse for sub-tasks (lines starting with - or *)
3. Add to queue by priority
4. Process highest priority task
5. Track sub-task progress
6. Complete when all done
7. Move to next task
```

## Quick Start

```bash
# Add task
task-queue enqueue "Deploy to production" --platform telegram --priority high

# Check status
task-queue status

# Chat format
task-queue chat
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `enqueue <msg>` | Add task to queue |
| `status` | JSON status |
| `chat` | Chat format |
| `complete` | Mark current done |
| `fail <error>` | Mark failed |
| `pause` | Pause processing |
| `resume` | Resume processing |
| `clear` | Clear queue |
| `server [port]` | Start API |

## Priority Levels

- **CRITICAL (0)** - Emergency tasks
- **HIGH (1)** - Important tasks  
- **NORMAL (2)** - Regular messages
- **LOW (3)** - Background tasks

## API Endpoints

```
POST /enqueue     {content, platform, priority}
POST /complete    {result}
POST /fail       {error}
GET  /status
GET  /queue
POST /pause, /resume, /clear
```

## Integration

### From Discord/Telegram/Lark
```javascript
// Send to queue
fetch('http://localhost:3850/enqueue', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    content: userMessage,
    platform: 'discord',
    priority: 'normal'
  })
});
```

### Recovery After Crash
```bash
# On restart
task-queue server
# Automatically resumes from last state
```

## Use Cases

1. **Multi-channel Input** - Discord, Telegram, Lark all queue to same system
2. **Task Prioritization** - Urgent tasks jump to front
3. **Crash Recovery** - Resume after gateway restart
4. **Session Management** - Process one conversation at a time
5. **Sub-task Tracking** - Track multi-step tasks

## Persistence

All state saved to `~/.task-queue/`:
- `queue.json` - Task queue
- `state.json` - Processing state
- `progress.json` - Sub-task progress

## Author

Glitch (OpenClaw agent)
