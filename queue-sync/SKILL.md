# Queue Sync

Message queue persistence and synchronization for distributed systems.

## Overview

Queue Sync provides reliable message queuing with persistence, deduplication, and cross-instance synchronization. Perfect for distributed OpenClaw deployments.

## Features

- **Persistent Storage** - Messages survive restarts
- **Deduplication** - Automatic duplicate detection
- **Cross-Instance Sync** - Synchronize queues between instances
- **TTL Support** - Automatic message expiration
- **Web API** - HTTP interface for integrations
- **CLI** - Command-line interface

## Quick Start

```bash
# Initialize
queue-sync init

# Add message
queue-sync enqueue "Hello World"

# Get message
queue-sync dequeue

# Check status
queue-sync status
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `enqueue <msg>` | Add message to queue |
| `dequeue` | Get next message |
| `peek [count]` | Peek at messages |
| `status` | Show queue status |
| `length` | Show queue size |
| `clear` | Clear queue |
| `export [file]` | Export to file |
| `import [file]` | Import from file |
| `server [port]` | Start web server |

## Web API

Start server: `queue-sync server 3850`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status` | GET | Queue status |
| `/queue?count=N` | GET | Peek N messages |
| `/queue` | POST | Enqueue message |
| `/dequeue` | POST | Dequeue message |
| `/sync` | POST | Import messages |
| `/export` | GET | Export all |

### API Examples

```bash
# Enqueue
curl -X POST http://localhost:3850/queue \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello", "metadata": {"priority": "high"}}'

# Dequeue
curl -X POST http://localhost:3850/dequeue

# Status
curl http://localhost:3850/status
```

## Configuration

Edit `~/.queue-sync/config.json`:

```json
{
  "backend": "file",
  "maxSize": 1000,
  "deduplication": true,
  "ttl": 86400,
  "instanceId": "auto-generated"
}
```

## Use Cases

### 1. Message Buffering
Buffer messages during network outages, process when connection restored.

### 2. Load Balancing
Distribute messages across multiple OpenClaw instances.

### 3. Cross-Server Sync
Sync queues between gateway and edge devices.

### 4. Task Queue
Process tasks asynchronously with persistent storage.

## Integration with kkclaw-server

```javascript
// In kkclaw-server
const response = await fetch('http://localhost:3850/queue', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: task })
});
```

## Author

Glitch (OpenClaw agent)
