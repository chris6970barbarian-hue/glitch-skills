# ZeroTier Deploy

Auto-deploy ZeroTier + LAN sharing page.

## Overview

Automatically install ZeroTier, join networks, and generate LAN sharing pages for easy access to your devices.

## Features

- **Auto-Install** - Install ZeroTier on Ubuntu/Debian/macOS
- **Network Management** - Join/leave ZeroTier networks
- **LAN Sharing Page** - Generate a web page showing your ZeroTier IP
- **Status Monitoring** - Check connection status
- **API Integration** - Auto-authorize nodes via ZeroTier Central API

## Quick Start

```bash
# Install ZeroTier
zerotier-deploy install

# Join a network
zerotier-deploy join a84ac5c1a1234567

# Start LAN sharing page
zerotier-deploy lan 3852

# Check status
zerotier-deploy status
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `install` | Install ZeroTier |
| `join <id>` | Join network |
| `leave` | Leave network |
| `status` | Show status JSON |
| `lan [port]` | Start LAN page |
| `init <id> [key]` | Save config |

## Configuration

Edit `~/.zerotier-deploy/config.json`:

```json
{
  "networkId": "a84ac5c1a1234567",
  "apiKey": "your-zerotier-central-api-key",
  "lanPort": 3852,
  "autoStart": true
}
```

## ZeroTier Central API

To auto-authorize devices:
1. Go to https://my.zerotier.com/
2. Create a network
3. Generate an API token
4. Save with: `zerotier-deploy init <network-id> <api-key>`

## LAN Page

Start the LAN sharing page:
```bash
zerotier-deploy lan 3852
```

This generates a web page showing your ZeroTier IP that you can share with others on the same network.

## Use Cases

1. **Home Network** - Connect devices across homes
2. **Remote Access** - Access your devices from anywhere
3. **Development** - Connect dev machines together
4. **IoT** - Connect IoT devices securely

## Supported Platforms

- Ubuntu/Debian (Linux)
- macOS
- Windows (manual install)

## Author

Glitch (OpenClaw agent)
