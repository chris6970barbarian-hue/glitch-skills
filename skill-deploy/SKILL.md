# Skill Deploy

Fully automated skill deployment tool for OpenClaw agents.

## Overview

Skill Deploy enables OpenClaw agents to publish skills to multiple platforms with a single command. It handles the complexity of different platform APIs so you can focus on building skills.

## Features

### Multi-Platform Deployment

- **ClawHub** - Publish to clawhub.ai registry
- **AGDP** - Register on Agent Commerce Protocol marketplace
- **GitHub** - Push to your skills repository
- **Awesome List** - Create PR to VoltAgent/awesome-openclaw-skills

### User-Controlled

- No hardcoded tokens or credentials
- Users provide their own API keys
- Fully transparent and auditable

### One-Command Workflow

```bash
# Configure once
skill-deploy init

# Deploy anytime
skill-deploy deploy ./my-skill
```

## Quick Start

### 1. Initialize Configuration

Run the interactive setup to configure your API tokens:

```bash
skill-deploy init
```

You'll be prompted for:
- GitHub Personal Access Token (repo scope)
- Your skills repository (username/repo)
- ClawHub API Token
- AGDP API Key, Agent ID, Wallet
- GitHub username (for Awesome List fork)

### 2. Deploy a Skill

```bash
# Deploy to all platforms
skill-deploy deploy ./my-awesome-skill

# Or use full path
skill-deploy deploy ~/.openclaw/workspace/skills/homeassistant
```

### 3. Check Status

```bash
skill-deploy status
```

Shows which platforms are configured and ready.

## Configuration

Configuration is stored in `~/.skill-deploy/config.json`:

```json
{
  "github": {
    "token": "ghp_xxxx",
    "repo": "username/skills-repo"
  },
  "clawhub": {
    "token": "clh_xxxx"
  },
  "agdp": {
    "apiKey": "acp_xxxx",
    "agentId": "your-agent",
    "wallet": "0x..."
  },
  "awesomeList": {
    "owner": "your-github-username"
  }
}
```

## Platform Details

### ClawHub

1. Get token from [clawhub.ai](https://clawhub.ai)
2. Run `clawhub login --token YOUR_TOKEN`
3. Configure in skill-deploy

### AGDP

1. Create agent at [app.virtuals.io/acp](https://app.virtuals.io/acp)
2. Get API key from settings
3. Configure wallet address

### GitHub

1. Create Personal Access Token with `repo` scope
2. Create a repository for your skills
3. Configure username/repo format

### Awesome List

1. Fork [VoltAgent/awesome-openclaw-skills](https://github.com/VoltAgent/awesome-openclaw-skills)
2. Provide your GitHub username
3. PRs are auto-created on deploy

## Commands

| Command | Description |
|---------|-------------|
| `skill-deploy init` | Interactive token configuration |
| `skill-deploy deploy <path>` | Deploy skill to all platforms |
| `skill-deploy status` | Show configuration status |
| `skill-deploy help` | Display help |

## Examples

### Deploy a New Skill

```bash
$ skill-deploy deploy ./homeassistant
=== Deploying "homeassistant" ===
ClawHub: OK
GitHub: OK
AGDP: SKIPPED (needs setup)
Awesome: PR created
```

### Check Configuration

```bash
$ skill-deploy status
=== Configuration Status ===
GitHub: OK (username/repo)
ClawHub: OK
AGDP: OK (agent: my-agent)
Awesome: OK (owner: username)
```

## Troubleshooting

### "Not logged in"

Run: `clawhub login --token YOUR_TOKEN`

### "AGDP not configured"

Complete AGDP setup at app.virtuals.io/acp

### "GitHub permission denied"

Ensure your token has repo scope

## Security

- Tokens are stored locally in `~/.skill-deploy/config.json`
- Never sent to any server except the respective platforms
- Review the source code to verify

## Requirements

- Node.js 18+
- Git
- Accounts on desired platforms

## License

MIT

## Author

Glitch (OpenClaw agent)

<!-- Updated Tue 17 Feb 22:30:50 CST 2026 -->
