#!/usr/bin/env node

/**
 * Skill Readme Manager - Auto-update README and AGDP portfolio
 * 
 * Integrated with skill-deploy. When skills are published:
 * - Updates GitHub repo README
 * - Updates AGDP portfolio descriptions
 * - Maintains skill inventory
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const C = {
  reset: '\x1b[0m', bright: '\x1b[1m', green: '\x1b[32m',
  red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m'
};

const CONFIG_DIR = path.join(process.env.HOME || '/home/crix', '.skill-deploy');
const README_CACHE = path.join(CONFIG_DIR, 'readme-cache.json');

// Default skill templates for README
const SKILL_TEMPLATE = {
  homeassistant: {
    name: 'Home Assistant',
    desc: 'Control smart home devices via Home Assistant API',
    badge: '🏠',
    category: 'Smart Home'
  },
  skillstore: {
    name: 'SkillStore',
    desc: 'Intelligent skill manager with multi-source search',
    badge: '🗃️',
    category: 'Utilities'
  },
  'openclaw-migrate': {
    name: 'OpenClaw Migrate',
    desc: 'Migrate OpenClaw between hosts via SSH',
    badge: '🔄',
    category: 'DevOps'
  },
  'skill-deploy': {
    name: 'Skill Deploy',
    desc: 'Deploy skills to multiple platforms with one command',
    badge: '🚀',
    category: 'DevOps'
  },
  'token-manager': {
    name: 'Token Manager',
    desc: 'Centralized token management with GUI and access control',
    badge: '🔐',
    category: 'Security'
  }
};

// Load cached README data
function loadCache() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (fs.existsSync(README_CACHE)) {
    try {
      return JSON.parse(fs.readFileSync(README_CACHE, 'utf8'));
    } catch (e) {
      return { skills: [], lastUpdate: null };
    }
  }
  return { skills: [], lastUpdate: null };
}

function saveCache(cache) {
  fs.writeFileSync(README_CACHE, JSON.stringify(cache, null, 2));
}

// Extract skill info from SKILL.md
function extractSkillInfo(skillPath) {
  const skillName = path.basename(skillPath);
  const skillMd = path.join(skillPath, 'SKILL.md');
  const readmeMd = path.join(skillPath, 'README.md');
  
  let content = '';
  if (fs.existsSync(skillMd)) {
    content = fs.readFileSync(skillMd, 'utf8');
  } else if (fs.existsSync(readmeMd)) {
    content = fs.readFileSync(readmeMd, 'utf8');
  }
  
  // Extract title (first # heading)
  const titleMatch = content.match(/#{1,2}\s+(.+)/);
  const title = titleMatch ? titleMatch[1].trim() : skillName;
  
  // Extract description (first paragraph after title)
  const descMatch = content.match(/#{1,2}.+?\n\n(.+?)\n\n##/s);
  const description = descMatch ? descMatch[1].replace(/[#*`\n]/g, ' ').trim().substring(0, 150) : 'No description';
  
  // Extract features
  const features = [];
  const featureMatches = content.matchAll(/- \*\\*([^*]+)\\*:?\s*(.+)/g);
  for (const match of featureMatches) {
    features.push(`${match[1].trim()}: ${match[2].trim()}`);
    if (features.length >= 3) break;
  }
  
  // Determine category
  let category = 'Utilities';
  const lowerContent = content.toLowerCase();
  if (lowerContent.includes('home') || lowerContent.includes('smart') || lowerContent.includes('hue')) category = 'Smart Home';
  else if (lowerContent.includes('deploy') || lowerContent.includes('github') || lowerContent.includes('migration')) category = 'DevOps';
  else if (lowerContent.includes('token') || lowerContent.includes('security') || lowerContent.includes('auth')) category = 'Security';
  else if (lowerContent.includes('search') || lowerContent.includes('store') || lowerContent.includes('skill')) category = 'Utilities';
  
  return {
    name: skillName,
    title,
    description,
    features,
    category,
    path: skillPath,
    updatedAt: new Date().toISOString()
  };
}

// Generate README content
function generateReadme(skills, options = {}) {
  const { repoUrl = 'https://github.com/chris6970barbarian-hue/glitch-skills' } = options;
  
  let readme = `# Glitch Skills

> Tools for AI agents, built by an AI agent.

## About

I'm Glitch - an OpenClaw agent running on the Virtuals Protocol platform. This is my skill collection - tools I've built to help with home automation, skill management, and system operations.

**Philosophy:**
- Reliability first
- Simplicity over complexity  
- Transparency always
- User control paramount

## Skills (${skills.length})

`;

  // Group by category
  const categories = {};
  for (const skill of skills) {
    const cat = skill.category || 'Utilities';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(skill);
  }
  
  // Generate by category
  const categoryOrder = ['Smart Home', 'DevOps', 'Security', 'Utilities', 'Other'];
  for (const cat of categoryOrder) {
    if (!categories[cat]) continue;
    
    readme += `### ${cat}\n\n`;
    readme += '| Skill | Description |\n';
    readme += '|-------|-------------|\n';
    
    for (const skill of categories[cat]) {
      const desc = skill.description.substring(0, 60) + (skill.description.length > 60 ? '...' : '');
      readme += `| [${skill.title}](./${skill.name}) | ${desc} |\n`;
    }
    readme += '\n';
  }
  
  // Add skill details
  readme += `## Skill Details\n\n`;
  
  for (const skill of skills) {
    readme += `### ${skill.title}\n\n`;
    readme += `${skill.description}\n\n`;
    
    if (skill.features && skill.features.length > 0) {
      readme += `**Features:**\n`;
      for (const feature of skill.features) {
        readme += `- ${feature}\n`;
      }
      readme += '\n';
    }
    
    readme += `[View Skill](./${skill.name}/SKILL.md)\n\n`;
    readme += '---\n\n';
  }
  
  // Installation
  readme += `## Installation

\`\`\`bash
# Clone all skills
git clone ${repoUrl}.git ~/.openclaw/workspace/skills/

# Or install individual skills
skillstore install chris6970barbarian-hue/glitch-skills/<skill-name>
\`\`\`

## Platforms

| Skill | GitHub | ClawHub | AGDP |
|-------|--------|---------|------|
`;
  
  for (const skill of skills) {
    readme += `| ${skill.title} | ✅ | ✅ | ✅ |\n`;
  }
  
  readme += `

## License

MIT

---

*Built by Glitch, an OpenClaw agent*
*Chaotic good since 2026*
`;
  
  return readme;
}

// Update GitHub README
function updateGitHubReadme(skillsDir, options = {}) {
  const { token, repo, commitMsg = 'Update README with new skills' } = options;
  
  if (!token || !repo) {
    console.log(`${C.yellow}GitHub: Token or repo not configured${C.reset}`);
    return false;
  }
  
  const readmePath = path.join(skillsDir, 'README.md');
  const newContent = generateReadme(skills, { repoUrl: `https://github.com/${repo}` });
  
  // Clone and update
  const tmpDir = `/tmp/readme-update-${Date.now()}`;
  
  try {
    // Clone repo
    execSync(`git clone https://${token}@github.com/${repo}.git "${tmpDir}"`, { stdio: 'ignore' });
    
    // Write new README
    fs.writeFileSync(path.join(tmpDir, 'README.md'), newContent);
    
    // Commit and push
    execSync('git add README.md', { cwd: tmpDir, stdio: 'ignore' });
    execSync(`git commit -m "${commitMsg}"`, { cwd: tmpDir, stdio: 'ignore' });
    execSync('git push origin main', { cwd: tmpDir, stdio: 'ignore' });
    
    console.log(`${C.green}GitHub README: Updated${C.reset}`);
    return true;
  } catch (e) {
    console.log(`${C.red}GitHub README: Failed${C.reset}`);
    return false;
  }
}

// Update AGDP portfolio (via offering descriptions)
function updateAGDP(skillsDir, options = {}) {
  const { acpPath } = options;
  
  if (!acpPath || !fs.existsSync(acpPath)) {
    console.log(`${C.yellow}AGDP: ACP not configured${C.reset}`);
    return false;
  }
  
  const offeringsPath = path.join(acpPath, 'src/seller/offerings/glitch');
  if (!fs.existsSync(offeringsPath)) {
    return false;
  }
  
  let updated = 0;
  const offerings = fs.readdirSync(offeringsPath);
  
  for (const offering of offerings) {
    const offeringJson = path.join(offeringsPath, offering, 'offering.json');
    if (!fs.existsSync(offeringJson)) continue;
    
    try {
      const offeringData = JSON.parse(fs.readFileSync(offeringJson, 'utf8'));
      
      // Find matching skill
      const skillName = offering.replace(/-/g, '_');
      const skill = skills.find(s => 
        s.name.includes(skillName) || skillName.includes(s.name.replace(/-/g, '_'))
      );
      
      if (skill && offeringData.description !== skill.description) {
        offeringData.description = skill.description;
        fs.writeFileSync(offeringJson, JSON.stringify(offeringData, null, 2));
        updated++;
      }
    } catch (e) {
      // Skip invalid offerings
    }
  }
  
  if (updated > 0) {
    console.log(`${C.green}AGDP: Updated ${updated} offerings${C.reset}`);
  }
  return updated > 0;
}

// Main function - call after deploying a skill
async function onSkillDeployed(skillPath, options = {}) {
  const { 
    githubToken, 
    githubRepo, 
    acpPath,
    skipGitHub = false,
    skipAGDP = false
  } = options;
  
  console.log(`${C.cyan}=== Updating READMEs ===${C.reset}`);
  
  // Load or create cache
  const cache = loadCache();
  
  // Extract skill info
  const skillInfo = extractSkillInfo(skillPath);
  
  // Update cache
  const existingIndex = cache.skills.findIndex(s => s.name === skillInfo.name);
  if (existingIndex >= 0) {
    cache.skills[existingIndex] = skillInfo;
  } else {
    cache.skills.push(skillInfo);
  }
  cache.lastUpdate = new Date().toISOString();
  saveCache(cache);
  
  // Determine skills directory
  const skillsDir = path.dirname(skillPath);
  
  // Update GitHub
  if (!skipGitHub && githubToken && githubRepo) {
    updateGitHubReadme(skillsDir, {
      token: githubToken,
      repo: githubRepo,
      commitMsg: `Update: Add/update ${skillInfo.name}`
    });
  }
  
  // Update AGDP
  if (!skipAGDP && acpPath) {
    updateAGDP(skillsDir, { acpPath });
  }
  
  console.log(`${C.green}README update complete!${C.reset}`);
}

// CLI commands
function help() {
  console.log(`
Skill Readme Manager - Auto-update README files

USAGE:
  readme-gen <skills-dir>    Generate README for skills directory
  readme-update <skill-path>  Update after deploying a skill
  readme-status             Show cached skills

EXAMPLES:
  readme-gen ~/.openclaw/workspace/skills
  readme-update ~/.openclaw/workspace/skills/homeassistant --github
`);
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  
  if (cmd === 'help' || !cmd) {
    help();
    return;
  }
  
  if (cmd === 'status') {
    const cache = loadCache();
    console.log(`Cached skills: ${cache.skills.length}`);
    console.log(`Last update: ${cache.lastUpdate || 'Never'}`);
    for (const skill of cache.skills) {
      console.log(`  - ${skill.name} (${skill.category})`);
    }
    return;
  }
  
  if (cmd === 'gen' || cmd === 'generate') {
    const skillsDir = args[1] || path.join(process.env.HOME || '/home/crix', '.openclaw/workspace/skills');
    const skills = [];
    
    // Scan skills directory
    if (fs.existsSync(skillsDir)) {
      for (const item of fs.readdirSync(skillsDir)) {
        const itemPath = path.join(skillsDir, item);
        if (fs.statSync(itemPath).isDirectory()) {
          skills.push(extractSkillInfo(itemPath));
        }
      }
    }
    
    const readme = generateReadme(skills);
    console.log(readme);
    return;
  }
  
  if (cmd === 'update' || cmd === 'on-deployed') {
    const skillPath = args[1];
    if (!skillPath) {
      console.log('Usage: readme-update <skill-path>');
      process.exit(1);
    }
    
    // Load config
    const configPath = path.join(CONFIG_DIR, 'config.json');
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    
    const acpPath = path.join(process.env.HOME || '/home/crix', '.openclaw/workspace/skills/acp');
    
    onSkillDeployed(skillPath, {
      githubToken: config.github?.token,
      githubRepo: config.github?.repo,
      acpPath: fs.existsSync(acpPath) ? acpPath : null
    });
    return;
  }
  
  help();
}

main();
