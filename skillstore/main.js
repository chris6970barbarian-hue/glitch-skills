#!/usr/bin/env node

/**
 * SkillStore - OpenClaw Skill Manager
 * Intelligent search with semantic matching and threshold filtering
 * Supports: Local, GitHub, ClawHub, AwesomeList searches
 */

const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const https = require('https');

const C = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  mag: '\x1b[35m'
};

const log = (msg, color = 'reset') => console.log(`${C[color]}${msg}${C.reset}`);
const err = (msg) => console.error(`${C.red}Error:${C.reset} ${msg}`);

const CONFIG_FILE = path.join(__dirname, 'config.json');
const MATCH_THRESHOLD = 0.3; // 30% similarity threshold

// Known skills with detailed descriptions
const SKILL_DATABASE = [
  { name: 'homeassistant', desc: 'Control smart home devices like lights switches thermostats via Home Assistant API', keywords: ['home', 'assistant', 'smart', 'homeassistant', 'ha', 'light', 'switch', 'thermostat', 'iot', 'automation'] },
  { name: 'skillstore', desc: 'Search install and create OpenClaw skills with intelligent matching semantic search threshold filtering', keywords: ['skill', 'store', 'openclaw', 'install', 'search', 'create', 'template', 'manager'] },
  { name: 'openclaw-migrate', desc: 'Migrate OpenClaw from one host to another via SSH sync config skills memory tokens', keywords: ['migrate', 'openclaw', 'ssh', 'sync', 'migration', 'transfer', 'backup'] },
  { name: 'skill-deploy', desc: 'Auto-deploy skills to ClawHub AGDP GitHub AwesomeList with one command', keywords: ['deploy', 'publish', 'release', 'automation', 'github', 'clawhub', 'agdp'] },
  { name: 'openhue', desc: 'Control Philips Hue lights and scenes', keywords: ['hue', 'philips', 'light', 'bulb', 'scene'] },
  { name: 'blucli', desc: 'Control BluOS speakers and streaming devices', keywords: ['bluos', 'speaker', 'audio', 'music', 'streaming', 'bluetooth'] },
  { name: 'sonoscli', desc: 'Control Sonos speakers and groups', keywords: ['sonos', 'speaker', 'audio', 'music', 'streaming'] },
  { name: 'eightctl', desc: 'Control Eight Sleep pods temperature and alarms', keywords: ['eight', 'sleep', 'pod', 'temperature', 'mattress', 'bed'] },
  { name: 'gog', desc: 'Google Workspace CLI for Gmail Calendar Drive Contacts Sheets Docs', keywords: ['google', 'gmail', 'calendar', 'drive', 'workspace', 'email', 'document'] },
  { name: 'himalaya', desc: 'Email client via IMAP SMTP terminal', keywords: ['email', 'imap', 'smtp', 'mail', 'terminal'] },
  { name: 'obsidian', desc: 'Obsidian vault integration and automation', keywords: ['obsidian', 'note', 'markdown', 'vault', 'knowledge'] },
  { name: 'ordercli', desc: 'Food delivery order management Foodora Deliveroo', keywords: ['food', 'order', 'delivery', 'foodora', 'deliveroo', 'eat'] },
  { name: 'weather', desc: 'Weather forecasts current temperature conditions', keywords: ['weather', 'forecast', 'temperature', 'rain', 'sun', 'climate'] },
  { name: 'github', desc: 'GitHub CLI issues pull requests workflows', keywords: ['github', 'git', 'issue', 'pr', 'pull', 'request', 'repo', 'repository'] },
  { name: 'blogwatcher', desc: 'Monitor RSS Atom feeds for blog updates', keywords: ['blog', 'rss', 'feed', 'monitor', 'watch', 'atom', 'news'] },
  { name: 'gifgrep', desc: 'Search and download GIFs from providers', keywords: ['gif', 'image', 'search', 'meme', 'animation'] },
  { name: 'video-frames', desc: 'Extract frames and clips from video files', keywords: ['video', 'frame', 'clip', 'extract', 'ffmpeg'] },
  { name: 'youtube-summarizer', desc: 'Summarize YouTube video transcripts', keywords: ['youtube', 'video', 'transcript', 'summarize', 'summary'] },
  { name: 'ga4', desc: 'Google Analytics 4 query and reporting', keywords: ['analytics', 'ga4', 'google', 'traffic', 'pageview', 'metric'] },
  { name: 'gsc', desc: 'Google Search Console SEO query data', keywords: ['seo', 'search', 'google', 'console', 'ranking', 'clicks'] },
  { name: 'wacli', desc: 'WhatsApp messaging via CLI send messages', keywords: ['whatsapp', 'wa', 'message', 'send', 'chat'] },
  { name: 'browser', desc: 'Automate web browser interactions', keywords: ['browser', 'automation', 'web', 'scraping', 'selenium', 'playwright'] },
  { name: 'healthcheck', desc: 'Security hardening and system monitoring', keywords: ['security', 'hardening', 'monitor', 'health', 'firewall', 'audit'] },
];

// Load config
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  }
  return { installed: [], searchHistory: [] };
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Prompt user
function prompt(question) {
  return new Promise(resolve => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    readline.question(question, answer => {
      readline.close();
      resolve(answer);
    });
  });
}

// HTTP request helper
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'OpenClaw-SkillStore/1.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve({}); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// Tokenize text into words
function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

// Calculate similarity between query and skill
function calculateSimilarity(query, skill) {
  const queryWords = new Set(tokenize(query));
  const skillWords = new Set([
    ...tokenize(skill.name),
    ...tokenize(skill.desc),
    ...(skill.keywords || [])
  ]);
  
  // Jaccard similarity
  const intersection = [...queryWords].filter(w => skillWords.has(w));
  const union = new Set([...queryWords, ...skillWords]);
  
  let score = intersection.length / union.size;
  
  // Boost for exact keyword matches
  for (const word of queryWords) {
    if ((skill.keywords || []).includes(word)) score += 0.1;
    if (skill.name.toLowerCase().includes(word)) score += 0.15;
  }
  
  // Boost for name match
  const queryLower = query.toLowerCase();
  if (skill.name.toLowerCase().includes(queryLower.split(' ')[0])) {
    score += 0.1;
  }
  
  return Math.min(score, 1); // Cap at 1.0
}

// Search local skills with content analysis
function searchLocal(query) {
  const skillsDir = path.join(__dirname, '..');
  if (!fs.existsSync(skillsDir)) return [];
  
  const results = [];
  const items = fs.readdirSync(skillsDir);
  const q = query.toLowerCase();
  
  for (const item of items) {
    const itemPath = path.join(skillsDir, item);
    if (!fs.statSync(itemPath).isDirectory()) continue;
    
    let content = '';
    let fullDesc = '';
    
    // Read SKILL.md and README.md
    for (const file of ['SKILL.md', 'README.md']) {
      const fpath = path.join(itemPath, file);
      if (fs.existsSync(fpath)) {
        content += fs.readFileSync(fpath, 'utf8') + ' ';
      }
    }
    
    fullDesc = content;
    
    const score = calculateSimilarity(query, {
      name: item,
      desc: fullDesc.substring(0, 500),
      keywords: tokenize(fullDesc)
    });
    
    if (score >= MATCH_THRESHOLD) {
      results.push({
        name: item,
        score,
        type: 'local',
        desc: fullDesc.substring(0, 200).replace(/[#*`\n]/g, ' ').trim()
      });
    }
  }
  
  return results.sort((a, b) => b.score - a.score);
}

// Search GitHub with semantic matching
async function searchGitHub(query) {
  log(`Searching GitHub...`, 'gray');
  
  try {
    const results = await httpGet(
      `https://api.github.com/search/repositories?q=openclaw+${encodeURIComponent(query)}+in:name,description&per_page=10`
    );
    
    if (!results.items) return [];
    
    const scoredResults = [];
    
    for (const r of results.items) {
      const score = calculateSimilarity(query, {
        name: r.name,
        desc: r.description || '',
        keywords: tokenize(r.name + ' ' + (r.description || ''))
      });
      
      if (score >= MATCH_THRESHOLD) {
        scoredResults.push({
          name: r.name,
          fullName: r.full_name,
          desc: r.description || 'No description',
          url: r.html_url,
          stars: r.stargazers_count,
          score,
          type: 'github'
        });
      }
    }
    
    return scoredResults.sort((a, b) => b.score - a.score);
    
  } catch (e) {
    return [];
  }
}

// Search ClawHub for existing skills
async function searchClawHub(query) {
  log(`Searching ClawHub...`, 'gray');
  
  try {
    // Check if clawhub CLI is available
    const check = execSync('which clawhub', { encoding: 'utf8' }).trim();
    if (!check) return [];
    
    // Use clawhub search
    const result = execSync(`clawhub search ${query} 2>&1`, { 
      encoding: 'utf8',
      timeout: 15000 
    });
    
    const lines = result.split('\n').filter(l => l.includes('http'));
    const scoredResults = [];
    
    for (const line of lines) {
      const match = line.match(/- \[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        const name = match[1];
        const url = match[2];
        
        const score = calculateSimilarity(query, {
          name: name,
          desc: name,
          keywords: tokenize(name)
        });
        
        if (score >= MATCH_THRESHOLD * 0.8) { // Lower threshold for external search
          scoredResults.push({
            name,
            url,
            desc: `Published on ClawHub`,
            score,
            type: 'clawhub'
          });
        }
      }
    }
    
    return scoredResults.sort((a, b) => b.score - a.score);
    
  } catch (e) {
    return [];
  }
}

// Search AwesomeList for existing skills
async function searchAwesomeList(query) {
  log(`Searching AwesomeList...`, 'gray');
  
  try {
    // Search the awesome-openclaw-skills README
    const data = await httpGet(
      'https://raw.githubusercontent.com/VoltAgent/awesome-openclaw-skills/main/README.md'
    );
    
    if (!data || typeof data !== 'string') return [];
    
    const lines = data.split('\n');
    const scoredResults = [];
    const q = query.toLowerCase();
    
    for (const line of lines) {
      if (line.includes('- [')) {
        const match = line.match(/- \[([^\]]+)\]\(([^)]+)\)/);
        if (match) {
          const name = match[1];
          const url = match[2];
          
          // Extract description from line
          const descMatch = line.match(/\]\([^)]+\)\s*-\s*(.+)/);
          const desc = descMatch ? descMatch[1] : '';
          
          const score = calculateSimilarity(query, {
            name: name,
            desc: desc,
            keywords: tokenize(name + ' ' + desc)
          });
          
          if (score >= MATCH_THRESHOLD * 0.8) {
            scoredResults.push({
              name,
              url,
              desc: desc.substring(0, 100),
              score,
              type: 'awesome'
            });
          }
        }
      }
    }
    
    return scoredResults.sort((a, b) => b.score - a.score);
    
  } catch (e) {
    return [];
  }
}

// Search known skills database
function searchKnown(query) {
  const scoredResults = [];
  
  for (const skill of SKILL_DATABASE) {
    const score = calculateSimilarity(query, skill);
    
    if (score >= MATCH_THRESHOLD) {
      scoredResults.push({
        name: skill.name,
        desc: skill.desc,
        score,
        type: 'known'
      });
    }
  }
  
  return scoredResults.sort((a, b) => b.score - a.score);
}

// Check for existing skills before creating new one
async function checkExistingSkills(name) {
  log(C.bright + `\n=== Checking for Existing Skills: "${name}" ===` + C.reset, 'cyan');
  
  const allResults = [];
  
  // Search all sources in parallel
  const [local, github, clawhub, awesome, known] = await Promise.all([
    searchLocal(name),
    searchGitHub(name),
    searchClawHub(name),
    searchAwesomeList(name),
    searchKnown(name)
  ]);
  
  allResults.push(...local, ...github, ...clawhub, ...awesome, ...known);
  
  if (allResults.length > 0) {
    log(`\n${C.yellow}Found ${allResults.length} existing skill(s):${C.reset}\n`, 'yellow');
    
    // Group by type
    const types = {
      local: { name: 'Local', color: 'green', items: [] },
      known: { name: 'Known', color: 'mag', items: [] },
      github: { name: 'GitHub', color: 'cyan', items: [] },
      clawhub: { name: 'ClawHub', color: 'yellow', items: [] },
      awesome: { name: 'AwesomeList', color: 'blue', items: [] }
    };
    
    for (const r of allResults.slice(0, 10)) {
      if (types[r.type]) {
        types[r.type].items.push(r);
      }
    }
    
    for (const [type, info] of Object.entries(types)) {
      if (info.items.length > 0) {
        log(`${C[info.color]}${info.name}:${C.reset}`, info.color);
        for (const item of info.items.slice(0, 3)) {
          log(`  - ${item.name}${item.url ? ` (${item.url})` : ''}`, 'gray');
        }
      }
    }
    
    log(`\n${C.yellow}Recommendation: Consider using an existing skill instead of creating a duplicate.${C.reset}`, 'yellow');
    
    return allResults;
  }
  
  log(`\n${C.green}No existing skills found. Safe to create new!${C.reset}`, 'green');
  return [];
}

// Show search results with scores
function showResults(query, results) {
  const matchCount = results.filter(r => r.score >= MATCH_THRESHOLD).length;
  
  log(`\n${C.bright}Search Results for "${query}"${C.reset}`, 'cyan');
  log(`Found: ${results.length} results\n`, 'gray');
  
  if (results.length === 0) {
    log('No skills found.', 'yellow');
    return false;
  }
  
  const typeLabels = {
    local: '[LOCAL]',
    known: '[KNOWN]',
    github: '[GIT]',
    clawhub: '[CLAW]',
    awesome: '[AWESOME]'
  };
  
  const typeColors = {
    local: 'green',
    known: 'mag',
    github: 'cyan',
    clawhub: 'yellow',
    awesome: 'blue'
  };
  
  results.slice(0, 15).forEach((r, i) => {
    const bar = '█'.repeat(Math.max(1, Math.floor(r.score * 10)));
    const barColor = r.score >= 0.5 ? 'green' : (r.score >= 0.3 ? 'yellow' : 'gray');
    const prefix = typeLabels[r.type] || '[???]';
    const prefixColor = typeColors[r.type] || 'gray';
    
    log(`${i + 1}. ${C[prefixColor]}${prefix}${C.reset} ${C.bright}${r.name}${C.reset} ${C[barColor]}${bar}${C.reset} ${Math.round(r.score * 100)}%`, prefixColor);
    log(`   ${r.desc ? r.desc.substring(0, 80) : ''}${r.url ? ` | ${r.url}` : ''}`, 'gray');
  });
  
  return true;
}

// Install from GitHub
async function installFromGitHub(repo, name) {
  log(`\nInstalling ${name} from GitHub...`, 'cyan');
  
  const skillsDir = path.join(__dirname, '..');
  const targetDir = path.join(skillsDir, name);
  
  if (fs.existsSync(targetDir)) {
    log(`Skill "${name}" already exists`, 'yellow');
    return false;
  }
  
  const cmd = `git clone https://github.com/${repo}.git "${targetDir}"`;
  
  return new Promise((resolve) => {
    exec(cmd, (error) => {
      if (error) {
        err(`Failed to install: ${error.message}`);
        resolve(false);
        return;
      }
      
      log(`Installed to ${targetDir}`, 'green');
      
      const config = loadConfig();
      config.installed.push({ name, repo, installedAt: new Date().toISOString() });
      saveConfig(config);
      
      resolve(true);
    });
  });
}

// Create new skill with templates
function createNewSkill(name) {
  log(`\nCreating new skill: ${name}`, 'cyan');
  
  const skillsDir = path.join(__dirname, '..');
  const targetDir = path.join(skillsDir, name);
  
  if (fs.existsSync(targetDir)) {
    err(`Skill "${name}" already exists!`);
    return false;
  }
  
  fs.mkdirSync(targetDir, { recursive: true });
  
  const templates = {
    'SKILL.md': `# ${name}

Brief description of what this skill does.

## Setup

\`\`\`bash
# Installation steps
\`\`\`

## Usage

\`\`\`bash
${name} command
\`\`\`

## Configuration

Required environment variables or config options.

## Supported Commands

- \`command1\` - Description
- \`command2\` - Description`,
    
    'README.md': `# ${name}

Brief description.

## Features

- Feature 1
- Feature 2

## Quick Start

1. Install
2. Configure
3. Use

## Documentation

See SKILL.md for full details.`,
    
    'config.json': `{
  "name": "${name}",
  "version": "1.0.0",
  "description": "Skill description"
}`
  };
  
  for (const [filename, content] of Object.entries(templates)) {
    fs.writeFileSync(path.join(targetDir, filename), content);
  }
  
  log(`Created skill at ${targetDir}`, 'green');
  
  // Ensure config exists
  let config = { installed: [], searchHistory: [] };
  if (fs.existsSync(CONFIG_FILE)) {
    try { config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } 
    catch (e) { config = { installed: [], searchHistory: [] }; }
  }
  
  config.installed = config.installed || [];
  config.installed.push({ name, createdAt: new Date().toISOString() });
  saveConfig(config);
  
  return true;
}

// Main search function
async function search(query) {
  const results = [];
  
  // Search all sources in parallel
  const [local, github, clawhub, awesome, known] = await Promise.all([
    searchLocal(query),
    searchGitHub(query),
    searchClawHub(query),
    searchAwesomeList(query),
    searchKnown(query)
  ]);
  
  results.push(...local, ...github, ...clawhub, ...awesome, ...known);
  
  // Sort by score
  results.sort((a, b) => b.score - a.score);
  
  return results;
}

// Show help
function help() {
  log(C.bright + `
SkillStore - OpenClaw Skill Manager

USAGE:
  skillstore search <query>     Search for skills
  skillstore install <repo>    Install from GitHub
  skillstore create <name>     Create new skill
  skillstore check <name>      Check for existing skills before creating
  skillstore list              List installed skills
  skillstore help              Show this help

SEARCH SOURCES:
  - Local skills (${path.join(__dirname, '..')})
  - Known skills database
  - GitHub (openclaw repos)
  - ClawHub (clawhub.ai)
  - Awesome OpenClaw Skills list

EXAMPLES:
  skillstore search home
  skillstore search weather
  skillstore check my-new-skill
  skillstore create my-awesome-skill

THRESHOLD: ${Math.round(MATCH_THRESHOLD * 100)}% similarity required
` + C.reset, 'cyan');
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const arg = args[1];
  
  if (!cmd || cmd === 'help' || cmd === '-h') {
    help();
    return;
  }
  
  switch (cmd) {
    case 'search':
    case 's':
      if (!arg) {
        err('Usage: skillstore search <query>');
        process.exit(1);
      }
      const results = await search(arg);
      showResults(arg, results);
      break;
      
    case 'check':
      if (!arg) {
        err('Usage: skillstore check <name>');
        process.exit(1);
      }
      await checkExistingSkills(arg);
      break;
      
    case 'install':
    case 'i':
      if (!arg) {
        err('Usage: skillstore install <repo>');
        process.exit(1);
      }
      const [repoName] = arg.split('/').slice(-1);
      await installFromGitHub(arg, repoName.replace('.git', ''));
      break;
      
    case 'create':
    case 'c':
      if (!arg) {
        err('Usage: skillstore create <name>');
        process.exit(1);
      }
      // First check for existing
      const existing = await checkExistingSkills(arg);
      if (existing.length > 0) {
        const response = await prompt('\nCreate anyway? (y/N): ');
        if (response.toLowerCase() !== 'y') {
          log('Cancelled.', 'yellow');
          break;
        }
      }
      createNewSkill(arg);
      break;
      
    case 'list':
    case 'ls':
      const config = loadConfig();
      log(`\nInstalled skills: ${config.installed.length}`, 'cyan');
      config.installed.forEach(s => {
        log(`  - ${s.name}`, 'green');
      });
      break;
      
    default:
      err(`Unknown command: ${cmd}`);
      help();
  }
}

main();
