# System Monitor

Real-time system monitoring with htop-like display and chat platform integration.

## Overview

System Monitor provides real-time CPU, memory, disk, and process monitoring. Supports multiple output formats for different use cases.

## Features

- **Real-time Monitoring** - CPU, Memory, Disk, Load
- **Process List** - Top memory/CPU consumers
- **Chat Format** - Optimized for Discord/Telegram
- **htop-like UI** - Terminal visualization
- **JSON Output** - For integrations

## Quick Start

```bash
# Simple one-line status
system-monitor simple

# htop-like display
system-monitor htop

# Chat format (for Discord/Telegram)
system-monitor chat

# JSON status
system-monitor status
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `simple` | One-line status |
| `htop` | Terminal visualization |
| `chat` | Chat platform format |
| `status` | JSON full status |
| `watch` | Continuous htop |

## Chat Output Example

```
📊 System Status

🟢 CPU: 9.4% (8 cores)
🟢 MEM: 27% (2.1G / 7.7G)
🟢 DISK: 45% (68G / 150G)

📈 Load: 0.38 | 0.44 | 0.42
⏱️ Uptime: 2d 14h 32m

🔝 Top Processes:
• node (23.4% mem)
• containerd (12.1% mem)
• redis-server (8.2% mem)
```

## Integration

### Discord Webhook
```javascript
const status = JSON.parse(execSync('system-monitor status'));
// Send to Discord webhook
```

### Token Manager Commands
Add to token-manager for chat commands:
```
system-monitor chat
```

## Use Cases

1. **Real-time Monitoring** - Watch system resources
2. **Alerting** - Trigger on threshold
3. **Diagnostics** - Check before heavy tasks
4. **Chat Updates** - Periodic status to chat

## Author

Glitch (OpenClaw agent)
