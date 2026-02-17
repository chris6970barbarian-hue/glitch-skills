#!/usr/bin/env node

/**
 * SkillStore - OpenClaw Skill Manager with Self-Learning
 * Intelligent search with semantic matching, duplicate detection, and memory
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
const MEMORY_FILE = path.join(__dirname, 'memory.json');
const MATCH_THRESHOLD = 0.25; // Lowered for better recall
const LEARN_THRESHOLD = 0.4; // Threshold to auto-learn

// Default known skills
const DEFAULT_SKILLS = [
  { name: 'homeassistant', desc: 'Control smart home devices like lights switches thermostats via Home Assistant API', keywords: ['home', 'assistant', 'smart', 'homeassistant', 'ha', 'light', 'switch', 'thermostat', 'iot', 'automation'], learned: false },
  { name: 'skillstore', desc: 'Search install and create OpenClaw skills with intelligent matching semantic search threshold filtering', keywords: ['skill', 'store', 'openclaw', 'install', 'search', 'create', 'template', 'manager'], learned: false },
  { name: 'openclaw-migrate', desc: 'Migrate OpenClaw from one host to another via SSH sync config skills memory tokens', keywords: ['migrate', 'openclaw', 'ssh', 'sync', 'migration', 'transfer', 'backup'], learned: false },
  { name: 'skill-deploy', desc: 'Auto-deploy skills to ClawHub AGDP GitHub AwesomeList with one command', keywords: ['deploy', 'publish', 'release', 'automation', 'github', 'clawhub', 'agdp'], learned: false },
  { name: 'openhue', desc: 'Control Philips Hue lights and scenes', keywords: ['hue', 'philips', 'light', 'bulb', 'scene'], learned: false },
  { name: 'blucli', desc: 'Control BluOS speakers and streaming devices', keywords: ['bluos', 'speaker', 'audio', 'music', 'streaming', 'bluetooth'], learned: false },
  { name: 'sonoscli', desc: 'Control Sonos speakers and groups', keywords: ['sonos', 'speaker', 'audio', 'music', 'streaming'], learned: false },
  { name: 'eightctl', desc: 'Control Eight Sleep pods temperature and alarms', keywords: ['eight', 'sleep', 'pod', 'temperature', 'mattress', 'bed'], learned: false },
  { name: 'gog', desc: 'Google Workspace CLI for Gmail Calendar Drive Contacts Sheets Docs', keywords: ['google', 'gmail', 'calendar', 'drive', 'workspace', 'email', 'document'], learned: false },
  { name: 'himalaya', desc: 'Email client via IMAP SMTP terminal', keywords: ['email', 'imap', 'smtp', 'mail', 'terminal'], learned: false },
  { name: 'obsidian', desc: 'Obsidian vault integration and automation', keywords: ['obsidian', 'note', 'markdown', 'vault', 'knowledge'], learned: false },
  { name: 'weather', desc: 'Weather forecasts current temperature conditions', keywords: ['weather', 'forecast', 'temperature', 'rain', 'sun', 'climate'], learned: false },
  { name: 'github', desc: 'GitHub CLI issues pull requests workflows', keywords: ['github', 'git', 'issue', 'pr', 'pull', 'request', 'repo', 'repository'], learned: false },
  { name: 'ga4', desc: 'Google Analytics 4 query and reporting', keywords: ['analytics', 'ga4', 'google', 'traffic', 'pageview', 'metric'], learned: false },
  { name: 'gsc', desc: 'Google Search Console SEO query data', keywords: ['seo', 'search', 'google', 'console', 'ranking', 'clicks'], learned: false },
  { name: 'browser', desc: 'Automate web browser interactions', keywords: ['browser', 'automation', 'web', 'scraping', 'selenium', 'playwright'], learned: false },
  { name: 'healthcheck', desc: 'Security hardening and system monitoring', keywords: ['security', 'hardening', 'monitor', 'health', 'firewall', 'audit'], learned: false },
];

// Load or initialize config
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  }
  return { installed: [], searchHistory: [] };
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Load or initialize memory (learned skills)
function loadMemory() {
  const defaultMemory = {
    learnedSkills: [],
    searchHistory: [],
    installHistory: [],
    usageCount: {},
    lastUpdated: new Date().toISOString()
  };
  
  if (fs.existsSync(MEMORY_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
    } catch (e) {
      return defaultMemory;
    }
  }
  return defaultMemory;
}

function saveMemory(memory) {
  memory.lastUpdated = new Date().toISOString();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

// Learn a new skill from local installation
function learnFromLocal(skillPath) {
  const memory = loadMemory();
  const name = path.basename(skillPath);
  
  // Check if already learned
  if (memory.learnedSkills.find(s => s.name === name)) {
    return false;
  }
  
  // Extract info from SKILL.md and README.md
  let content = '';
  let desc = '';
  let keywords = [];
  
  for (const file of ['SKILL.md', 'README.md', 'main.js']) {
    const fpath = path.join(skillPath, file);
    if (fs.existsSync(fpath)) {
      content += fs.readFileSync(fpath, 'utf8') + ' ';
    }
  }
  
  // Extract description (first paragraph after title)
  const descMatch = content.match(/#{1,2}\s*\w+.*?\n\n([^#\n]+)/);
  if (descMatch) {
    desc = descMatch[1].replace(/[#*`]/g, '').trim().substring(0, 200);
  }
  
  // Extract keywords (words that appear frequently)
  const words = content.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);
  
  // Count word frequency
  const freq = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }
  
  // Get top keywords
  keywords = Object.entries(freq)
    .filter(([w]) => !['skill', 'openclaw', 'command', 'description', 'usage', 'config'].includes(w))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([w]) => w);
  
  // Add to learned skills
  memory.learnedSkills.push({
    name,
    desc: desc || `${name} skill`,
    keywords,
    learnedFrom: 'local',
    learnedAt: new Date().toISOString(),
    source: skillPath
  });
  
  saveMemory(memory);
  log(`Learned: ${name} (${keywords.length} keywords)`, 'green');
  return true;
}

// Learn from search behavior
function learnFromSearch(query) {
  const memory = loadMemory();
  memory.searchHistory.push({ query, timestamp: new Date().toISOString() });
  
  // Keep only last 100 searches
  if (memory.searchHistory.length > 100) {
    memory.searchHistory = memory.searchHistory.slice(-100);
  }
  
  saveMemory(memory);
}

// Learn from installation
function learnFromInstall(name, repo) {
  const memory = loadMemory();
  memory.installHistory.push({ name, repo, timestamp: new Date().toISOString() });
  memory.usageCount[name] = (memory.usageCount[name] || 0) + 1;
  saveMemory(memory);
  
  // Also learn from local if just installed
  const skillsDir = path.join(__dirname, '..');
  const skillPath = path.join(skillsDir, name);
  if (fs.existsSync(skillPath)) {
    learnFromLocal(skillPath);
  }
}

// Scan local skills and auto-learn
function scanLocalSkills() {
  const memory = loadMemory();
  const skillsDir = path.join(__dirname, '..');
  
  if (!fs.existsSync(skillsDir)) return [];
  
  const learnedNames = new Set(memory.learnedSkills.map(s => s.name));
  const newSkills = [];
  
  const items = fs.readdirSync(skillsDir);
  for (const item of items) {
    const itemPath = path.join(skillsDir, item);
    if (!fs.statSync(itemPath).isDirectory()) continue;
    if (item === 'skillstore') continue; // Skip self
    
    if (!learnedNames.has(item)) {
      learnFromLocal(itemPath);
      newSkills.push(item);
    }
  }
  
  return newSkills;
}

// Get all learned skills
function getLearnedSkills() {
  const memory = loadMemory();
  return memory.learnedSkills;
}

// Recommend based on usage
function getRecommendations(limit = 5) {
  const memory = loadMemory();
  
  // Sort by usage count
  const sorted = Object.entries(memory.usageCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  
  return sorted.map(([name, count]) => {
    const skill = memory.learnedSkills.find(s => s.name === name);
    return { name, count, ...skill };
  });
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

// Tokenize text
function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

// Calculate similarity
function calculateSimilarity(query, skill) {
  const queryWords = new Set(tokenize(query));
  const skillWords = new Set([
    ...tokenize(skill.name),
    ...tokenize(skill.desc),
    ...(skill.keywords || [])
  ]);
  
  const intersection = [...queryWords].filter(w => skillWords.has(w));
  const union = new Set([...queryWords, ...skillWords]);
  
  let score = intersection.length / union.size;
  
  for (const word of queryWords) {
    if ((skill.keywords || []).includes(word)) score += 0.1;
    if (skill.name.toLowerCase().includes(word)) score += 0.15;
  }
  
  const queryLower = query.toLowerCase();
  if (skill.name.toLowerCase().includes(queryLower.split(' ')[0])) {
    score += 0.1;
  }
  
  return Math.min(score, 1);
}

// Search local skills
function searchLocal(query) {
  const skillsDir = path.join(__dirname, '..');
  if (!fs.existsSync(skillsDir)) return [];
  
  const results = [];
  const items = fs.readdirSync(skillsDir);
  
  for (const item of items) {
    const itemPath = path.join(skillsDir, item);
    if (!fs.statSync(itemPath).isDirectory()) continue;
    
    let content = '';
    for (const file of ['SKILL.md', 'README.md', 'main.js']) {
      const fpath = path.join(itemPath, file);
      if (fs.existsSync(fpath)) {
        content += fs.readFileSync(fpath, 'utf8') + ' ';
      }
    }
    
    const score = calculateSimilarity(query, {
      name: item,
      desc: content.substring(0, 500),
      keywords: tokenize(content)
    });
    
    if (score >= MATCH_THRESHOLD) {
      results.push({
        name: item,
        score,
        type: 'local',
        desc: content.substring(0, 200).replace(/[#*`\n]/g, ' ').trim()
      });
    }
  }
  
  return results.sort((a, b) => b.score - a.score);
}

// Search learned skills (memory)
function searchLearned(query) {
  const memory = loadMemory();
  const results = [];
  
  for (const skill of memory.learnedSkills) {
    const score = calculateSimilarity(query, skill);
    
    if (score >= MATCH_THRESHOLD) {
      results.push({
        ...skill,
        score,
        type: 'learned'
      });
    }
  }
  
  return results.sort((a, b) => b.score - a.score);
}

// Search GitHub
async function searchGitHub(query) {
  try {
    const results = await httpGet(
      `https://api.github.com/search/repositories?q=openclaw+${encodeURIComponent(query)}+in:name,description&per_page=10`
    );
    
    if (!results.items) return [];
    
    return results.items.map(r => ({
      name: r.name,
      fullName: r.full_name,
      desc: r.desc || 'No description',
      url: r.html_url,
      stars: r.stargazers_count,
      score: calculateSimilarity(query, { name: r.name, desc: r.description || '', keywords: [] }),
      type: 'github'
    })).filter(r => r.score >= MATCH_THRESHOLD * 0.8)
      .sort((a, b) => b.score - a.score);
  } catch (e) {
    return [];
  }
}

// Search ClawHub
async function searchClawHub(query) {
  try {
    const result = execSync(`clawhub search ${query} 2>&1`, { 
      encoding: 'utf8',
      timeout: 15000 
    });
    
    const lines = result.split('\n').filter(l => l.includes('http'));
    return lines.map(line => {
      const match = line.match(/- \[([^\]]+)\]\(([^)]+)\)/);
      if (!match) return null;
      
      return {
        name: match[1],
        url: match[2],
        desc: 'Published on ClawHub',
        score: calculateSimilarity(query, { name: match[1], desc: '', keywords: [] }),
        type: 'clawhub'
      };
    }).filter(Boolean).filter(r => r.score >= MATCH_THRESHOLD * 0.6);
  } catch (e) {
    return [];
  }
}

// Search AwesomeList
async function searchAwesomeList(query) {
  try {
    const data = await httpGet(
      'https://raw.githubusercontent.com/VoltAgent/awesome-openclaw-skills/main/README.md'
    );
    
    if (!data || typeof data !== 'string') return [];
    
    const lines = data.split('\n');
    const results = [];
    
    for (const line of lines) {
      if (line.includes('- [')) {
        const match = line.match(/- \[([^\]]+)\]\(([^)]+)\)/);
        if (match) {
          const descMatch = line.match(/\]\([^)]+\)\s*-\s*(.+)/);
          const desc = descMatch ? descMatch[1] : '';
          
          const score = calculateSimilarity(query, {
            name: match[1],
            desc,
            keywords: tokenize(match[1] + ' ' + desc)
          });
          
          if (score >= MATCH_THRESHOLD * 0.8) {
            results.push({
              name: match[1],
              url: match[2],
              desc: desc.substring(0, 100),
              score,
              type: 'awesome'
            });
          }
        }
      }
    }
    
    return results.sort((a, b) => b.score - a.score);
  } catch (e) {
    return [];
  }
}

// Search known/default skills
function searchKnown(query) {
  return DEFAULT_SKILLS.map(skill => ({
    ...skill,
    score: calculateSimilarity(query, skill),
    type: 'known'
  })).filter(r => r.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}

// Check for existing skills before creating
async function checkExistingSkills(name) {
  log(C.bright + `\n=== Checking for Existing Skills: "${name}" ===` + C.reset, 'cyan');
  
  const [local, learned, github, clawhub, awesome, known] = await Promise.all([
    searchLocal(name),
    searchLearned(name),
    searchGitHub(name),
    searchClawHub(name),
    searchAwesomeList(name),
    searchKnown(name)
  ]);
  
  const allResults = [...local, ...learned, ...github, ...clawhub, ...awesome, ...known];
  
  if (allResults.length > 0) {
    log(`\n${C.yellow}Found ${allResults.length} existing skill(s):${C.reset}\n`, 'yellow');
    
    const types = {
      local: { name: 'Local', color: 'green', items: [] },
      learned: { name: 'Learned', color: 'mag', items: [] },
      known: { name: 'Known', color: 'blue', items: [] },
      github: { name: 'GitHub', color: 'cyan', items: [] },
      clawhub: { name: 'ClawHub', color: 'yellow', items: [] },
      awesome: { name: 'AwesomeList', color: 'gray', items: [] }
    };
    
    for (const r of allResults.slice(0, 10)) {
      if (types[r.type]) types[r.type].items.push(r);
    }
    
    for (const [type, info] of Object.entries(types)) {
      if (info.items.length > 0) {
        log(`${C[info.color]}${info.name}:${C.reset}`, info.color);
        for (const item of info.items.slice(0, 3)) {
          log(`  - ${item.name}${item.url ? ` (${item.url})` : ''}`, 'gray');
        }
      }
    }
    
    log(`\n${C.yellow}Recommendation: Consider using an existing skill.${C.reset}`, 'yellow');
    return allResults;
  }
  
  log(`\n${C.green}No existing skills found. Safe to create new!${C.reset}`, 'green');
  return [];
}

// Main search with learning
async function search(query) {
  // Learn from this search
  learnFromSearch(query);
  
  const [local, learned, github, clawhub, awesome, known] = await Promise.all([
    searchLocal(query),
    searchLearned(query),
    searchGitHub(query),
    searchClawHub(query),
    searchAwesomeList(query),
    searchKnown(query)
  ]);
  
  const results = [...local, ...learned, ...github, ...clawhub, ...awesome, ...known];
  return results.sort((a, b) => b.score - a.score);
}

// Show results
function showResults(query, results) {
  log(`\n${C.bright}Search Results for "${query}"${C.reset}`, 'cyan');
  log(`Found: ${results.length} results\n`, 'gray');
  
  if (results.length === 0) {
    log('No skills found.', 'yellow');
    return false;
  }
  
  const typeLabels = { local: '[LOCAL]', learned: '[LEARN]', known: '[KNOWN]', github: '[GIT]', clawhub: '[CLAW]', awesome: '[AWESOME]' };
  const typeColors = { local: 'green', learned: 'mag', known: 'blue', github: 'cyan', clawhub: 'yellow', awesome: 'gray' };
  
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
  
  return new Promise((resolve) => {
    exec(`git clone https://github.com/${repo}.git "${targetDir}"`, (error) => {
      if (error) {
        err(`Failed: ${error.message}`);
        resolve(false);
        return;
      }
      
      log(`Installed to ${targetDir}`, 'green');
      
      // Learn from installed skill
      learnFromInstall(name, repo);
      
      const config = loadConfig();
      config.installed.push({ name, repo, installedAt: new Date().toISOString() });
      saveConfig(config);
      
      resolve(true);
    });
  });
}

// Create new skill
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
    'SKILL.md': `# ${name}\n\nBrief description.\n\n## Setup\n\n## Usage\n\n## Config`,
    'README.md': `# ${name}\n\nDescription.\n\n## Features\n\n- Feature 1\n\n## Quick Start\n\n1. Install\n2. Use`,
    'config.json': `{\n  "name": "${name}",\n  "version": "1.0.0",\n  "description": "Skill description"\n}`
  };
  
  for (const [filename, content] of Object.entries(templates)) {
    fs.writeFileSync(path.join(targetDir, filename), content);
  }
  
  log(`Created skill at ${targetDir}`, 'green');
  
  // Learn the new skill
  learnFromLocal(targetDir);
  
  let config = { installed: [], searchHistory: [] };
  if (fs.existsSync(CONFIG_FILE)) {
    try { config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } 
    catch (e) {}
  }
  config.installed = config.installed || [];
  config.installed.push({ name, createdAt: new Date().toISOString() });
  saveConfig(config);
  
  return true;
}

// Show memory/stats
function showMemory() {
  const memory = loadMemory();
  const config = loadConfig();
  
  log(C.bright + '\n=== SkillStore Memory ===\n' + C.reset, 'cyan');
  
  log(`Learned skills: ${memory.learnedSkills.length}`, 'green');
  memory.learnedSkills.forEach(s => {
    log(`  - ${s.name} (${s.keywords?.slice(0, 3).join(', ')})`, 'gray');
  });
  
  log(`\nSearches: ${memory.searchHistory.length}`, 'cyan');
  log(`Installs: ${memory.installHistory.length}`, 'cyan');
  
  log(`\nMost used:`, 'yellow');
  const top = getRecommendations(5);
  top.forEach(s => {
    log(`  - ${s.name} (${s.count} uses)`, 'gray');
  });
  
  log(`\nLocal skills: ${config.installed.length}`, 'mag');
}

// Help
function help() {
  log(C.bright + `
SkillStore - OpenClaw Skill Manager with Self-Learning

USAGE:
  skillstore search <query>     Search skills (learns from search)
  skillstore check <name>       Check duplicates before creating
  skillstore create <name>      Create new skill (auto-learns)
  skillstore install <repo>     Install from GitHub (learns)
  skillstore scan               Scan and learn local skills
  skillstore memory             Show learning memory
  skillstore list               List installed skills
  skillstore help               Show help

FEATURES:
  - Multi-source search (Local, Learned, Known, GitHub, ClawHub, AwesomeList)
  - Auto-learn from local skills
  - Memory of search/install history
  - Usage-based recommendations
  - Duplicate detection

EXAMPLES:
  skillstore search home
  skillstore scan
  skillstore memory
` + C.reset, 'cyan');
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const arg = args[1];
  
  // Auto-scan local skills on startup
  if (cmd && cmd !== 'help' && cmd !== '-h') {
    scanLocalSkills();
  }
  
  if (!cmd || cmd === 'help' || cmd === '-h') {
    help();
    return;
  }
  
  switch (cmd) {
    case 'search':
    case 's':
      if (!arg) { err('Usage: skillstore search <query>'); process.exit(1); }
      const results = await search(arg);
      showResults(arg, results);
      break;
      
    case 'check':
      if (!arg) { err('Usage: skillstore check <name>'); process.exit(1); }
      await checkExistingSkills(arg);
      break;
      
    case 'install':
    case 'i':
      if (!arg) { err('Usage: skillstore install <repo>'); process.exit(1); }
      const [repoName] = arg.split('/').slice(-1);
      await installFromGitHub(arg, repoName.replace('.git', ''));
      break;
      
    case 'create':
    case 'c':
      if (!arg) { err('Usage: skillstore create <name>'); process.exit(1); }
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
      
    case 'scan':
      const newSkills = scanLocalSkills();
      log(`\nScanned local skills. New learned: ${newSkills.length}`, 'green');
      break;
      
    case 'memory':
    case 'stats':
      showMemory();
      break;
      
    case 'list':
    case 'ls':
      const config = loadConfig();
      log(`\nInstalled: ${config.installed.length}`, 'cyan');
      config.installed.forEach(s => log(`  - ${s.name}`, 'green'));
      break;
      
    default:
      err(`Unknown: ${cmd}`);
      help();
  }
}

main();
