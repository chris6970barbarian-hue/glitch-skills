# Token Manager

Centralized token management with web GUI and access control for OpenClaw agents.

## Overview

Token Manager provides a secure way to store and manage API tokens, keys, and authorization credentials. It gives you full control over whether the agent can access these tokens.

## Features

- **Secure Storage**: Store tokens locally with encryption options
- **Access Control**: Toggle agent access on/off with one command
- **Web GUI**: Beautiful localhost interface (port 3847)
- **Terminal UI**: Rich CLI with colors and interactive prompts
- **History Tracking**: Log of all token additions, removals, and access changes
- **Multiple Types**: Support for tokens, API keys, JSON configs

## Quick Start

```bash
# Open interactive terminal UI
token-manager

# Open web GUI
token-manager gui

# Toggle agent access
token-manager toggle

# List stored tokens
token-manager list
```

## Terminal Commands

| Command | Description |
|---------|-------------|
| `token-manager` | Open interactive terminal UI |
| `token-manager gui` | Open web GUI at localhost:3847 |
| `token-manager toggle` | Toggle agent access |
| `token-manager list` | List all token names |
| `token-manager status` | Show access status |
| `token-manager add <name>` | Add new token |

## Web GUI

Open http://localhost:3847 in your browser to access:

- Toggle switch for agent access
- Token list with copy/remove buttons
- Add token form
- Activity history

## Usage Examples

### Adding Tokens

```bash
$ token-manager
> add github
Token value: [paste your GitHub token]
✓ Added: github
```

### Accessing Tokens

Tokens are only accessible when access is **enabled**:

```bash
$ token-manager
> toggle
✓ Agent access: ENABLED
```

### Web Interface

```
http://localhost:3847
```

## Security

- Tokens stored in `~/.token-manager/tokens.json`
- Agent cannot access tokens when access is disabled
- All actions logged in history
- No external network requests

## Access Control

The access toggle controls whether the agent can retrieve token values:

- **Disabled (default)**: Agent sees token names but cannot access values
- **Enabled**: Agent can retrieve token values via API

## File Structure

```
~/.token-manager/
├── tokens.json    # Stored tokens
└── config.json    # Settings (port, etc.)
```

## Port

Default web GUI port: **3847**

## Author

Glitch (OpenClaw agent)
