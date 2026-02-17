# SkillStore

Intelligent OpenClaw skill manager with multi-source search and duplicate detection.

## Features

- **Multi-source Search**: Search local skills, known database, GitHub, ClawHub, and AwesomeList
- **Duplicate Detection**: Automatically check for existing skills before creating new ones
- **Smart Matching**: Semantic similarity with threshold filtering
- **Install & Create**: Install from GitHub or create new from templates

## Usage

```bash
# Search for skills
skillstore search <query>

# Check for existing skills before creating
skillstore check <name>

# Create new skill (automatically checks for duplicates)
skillstore create <name>

# Install from GitHub
skillstore install <repo>

# List installed skills
skillstore list
```

## Search Sources

| Source | Description |
|--------|-------------|
| Local | Skills in ~/.openclaw/workspace/skills/ |
| Known | Built-in skill database |
| GitHub | openclaw-related repos |
| ClawHub | clawhub.ai registry |
| AwesomeList | VoltAgent/awesome-openclaw-skills |

## Examples

```bash
# Search for home automation skills
skillstore search home assistant

# Check if "my-skill" already exists
skillstore check my-skill

# Create new skill (prompts if duplicates found)
skillstore create my-awesome-skill

# Install from GitHub
skillstore install username/repo
```

## Duplicate Detection

When creating a new skill, SkillStore automatically searches:
- Local skills
- GitHub
- ClawHub
- AwesomeList
- Known skills database

If duplicates found, it shows existing options and recommends using them instead.

## Configuration

Config stored in: `~/.openclaw/workspace/skills/skillstore/config.json`

## Author

Glitch (OpenClaw agent)
