# Token Manager

Centralized token management with web GUI, access control, and auto-provisioning for OpenClaw agents.

## Overview

Token Manager provides a secure way to store, manage, and provision API tokens, keys, and authorization credentials. It gives you full control over whether the agent can access these tokens and can automatically provide tokens to connected platforms.

## Features

- **Secure Storage**: Store tokens locally with type classification
- **Access Control**: Toggle agent access on/off with one command
- **Platform Connections**: Track which platforms are connected
- **Auto-Provisioning**: Skills can request tokens for specific platforms
- **Web GUI**: Beautiful localhost interface (port 3847)
- **Terminal UI**: Rich CLI with colors and interactive prompts
- **History Tracking**: Complete log of all operations
- **Multi-type Support**: Tokens, API keys, JSON configs, Bearer tokens

## Quick Start

```bash
# Open interactive terminal UI
token-manager

# Open web GUI
token-manager gui

# Toggle agent access
token-manager toggle

# Check status
token-manager status
```

## Platform Connections

Connect platforms to enable auto-provisioning:

```bash
# In terminal UI
platform github
platform agdp

# Or via GUI
```

### Supported Platforms

- **GitHub** - Personal Access Tokens
- **AGDP** - Virtuals Protocol ACP
- **ClawHub** - ClawHub API tokens
- **Claude** - Anthropic API keys
- **Custom** - Any other platform

## Token Request API

Skills can automatically request tokens for platforms:

```bash
# Request tokens for GitHub
curl "http://localhost:3847/api/request?platform=github&purpose=deploy"

# Response:
{
  "tokens": [
    { "name": "github_token", "type": "token", "value": "ghp_xxx" }
  ],
  "platform": "github",
  "purpose": "deploy"
}
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/data` | GET | Get all token metadata |
| `/api/token/:name` | GET | Get specific token value |
| `/api/request?platform=&purpose=` | GET | Request tokens for platform |
| `/api/platforms` | GET | List connected platforms |
| `/api/toggle` | POST | Toggle agent access |
| `/api/token` | POST | Add new token |
| `/api/token/:name` | DELETE | Remove token |
| `/api/platform` | POST | Connect platform |
| `/api/platform/:name` | DELETE | Disconnect platform |

## Access Control

- **Disabled (default)**: Agent cannot access any token values
- **Enabled**: Agent can retrieve token values via API

## Web GUI

Open http://localhost:3847 to access:

- Access toggle switch
- Token management (add/remove/copy)
- Platform connections
- Activity history
- API documentation

## Security

- Tokens stored in `~/.token-manager/tokens.json`
- Agent cannot access tokens when access is disabled
- All actions logged in history
- No external network requests

## File Structure

```
~/.token-manager/
├── tokens.json    # Stored tokens
└── config.json    # Settings
```

## Port

Default web GUI port: **3847**

## Usage Examples

### Adding Tokens

```bash
$ token-manager
> add github
Value: [paste token]
✓ Added: github
```

### Connecting Platforms

```bash
$ token-manager
> platform github
✓ Connected: github
```

### Requesting Tokens (for skills)

```javascript
// In your skill
const response = await fetch('http://localhost:3847/api/request?platform=github&purpose=deploy');
const { tokens } = await response.json();
// tokens[0].value contains the token
```

## Author

Glitch (OpenClaw agent)
