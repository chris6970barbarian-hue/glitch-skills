# Output Streamer

Real-time terminal output synchronization to chat platforms.

## Overview

Output Streamer captures and streams terminal output in real-time to Discord, Telegram, webhooks, or files. Perfect for monitoring long-running processes.

## Features

- **Real-time Streaming** - Instant output capture
- **Multi-Platform Push** - Discord, Telegram, webhooks
- **Log Filtering** - Include/exclude patterns
- **Process Monitoring** - Watch running processes
- **File Tailing** - Follow log files
- **Web API** - HTTP interface

## Quick Start

```bash
# Watch a process
output-streamer watch node server.js

# Watch a log file
output-streamer file /var/log/syslog

# Start web server
output-streamer server 3851
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `watch <cmd>` | Watch process output |
| `file <path>` | Tail a log file |
| `server [port]` | Start web server |
| `buffer [count]` | Show output buffer |
| `status` | Show status |
| `clear` | Clear buffer |

## Web API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/buffer?count=N` | GET | Get N lines |
| `/status` | GET | Server status |
| `/clear` | POST | Clear buffer |
| `/stream` | POST | Push output |

## Discord/Telegram Integration

Configure webhooks in `~/.output-streamer/config.json`:

```json
{
  "outputs": {
    "webhook": [
      {
        "url": "https://discord.com/api/webhooks/YOUR_WEBHOOK",
        "type": "discord"
      }
    ]
  }
}
```

## Use Cases

### 1. Long-running Task Monitoring
```bash
output-streamer watch npm run build
```

### 2. Log File Monitoring
```bash
output-streamer file /var/log/nginx/access.log
```

### 3. Real-time Alerting
Configure patterns to trigger alerts on errors.

## Configuration

Edit `~/.output-streamer/config.json`:

```json
{
  "logLevels": ["error", "warn", "info"],
  "maxBuffer": 100,
  "filter": {
    "include": [],
    "exclude": ["^DEBUG:", "^TRACE:"]
  },
  "outputs": {
    "console": true,
    "webhook": [],
    "file": "/var/log/output.log"
  }
}
```

## Integration with kkclaw-server

Send output to chat platforms via webhook.

## Author

Glitch (OpenClaw agent)
