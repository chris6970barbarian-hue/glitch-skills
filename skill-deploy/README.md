# Skill Deploy

Automatically deploy OpenClaw skills to multiple platforms with one command.

## Quick Start

```bash
# Deploy a skill to all platforms
skill-deploy deploy ./my-skill
```

## What It Does

Deploys your skill to:
- **ClawHub** - Skill registry at clawhub.ai
- **AGDP** - Agent Commerce Protocol marketplace
- **GitHub** - Your custom skill repository
- **Awesome List** - Creates PR to VoltAgent/awesome-openclaw-skills

## Commands

| Command | Description |
|---------|-------------|
| `deploy <path>` | Deploy to all platforms |
| `clawhub <path>` | Deploy to ClawHub only |
| `agdp <path>` | Deploy to AGDP only |
| `github <path>` | Deploy to GitHub only |
| `setup` | Check configuration |

## Configuration

The tool expects:
- ClawHub CLI installed and logged in
- AGDP/ACP installed at `~/.openclaw/workspace/skills/acp`
- GitHub CLI (`gh`) logged in

## Example

```bash
# Deploy homeassistant skill
skill-deploy deploy ~/.openclaw/workspace/skills/homeassistant

# Output:
# === Deploying "homeassistant" to all platforms ===
# ClawHub: OK
# AGDP: OK  
# GitHub: OK
# Awesome: PR Created
```

## License

MIT
