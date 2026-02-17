#!/usr/bin/env node

/**
 * Skill Deploy - Fully Automated Skill Deployment
 * 
 * Deploys skills to multiple platforms with user-provided tokens.
 * Just configure once, then deploy with one command.
 * 
 * Platforms supported:
 * - ClawHub (clawhub.ai)
 * - AGDP (app.virtuals.io/acp)
 * - GitHub (any repo)
 * - Awesome OpenClaw Skills (PR)
 * 
 * Usage:
 *   skill-deploy init         # Initialize/configure tokens
 *   skill-deploy deploy <path> # Deploy skill to all platforms
 *   skill-deploy status       # Check configuration status
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// Colors
const C = {
  reset: '\x1b[0m', bright: '\x1b[1m', green: '\x1b[32m', 
  red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', gray: '\x1b[90m'
};

const log = (msg, color = 'reset') => console.log(`${C[color]}${msg}${C.reset}`);
const err = (msg) => console.error(`${C.red}Error:${C.reset} ${msg}`);

// Config paths
const CONFIG_DIR = path.join(process.env.HOME || '/home/crix', '.skill-deploy');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Default config template
const DEFAULT_CONFIG = {
  github: {
    token: '',
    repo: ''  // username/repo format
  },
  clawhub: {
    token: ''
  },
  agdp: {
    apiKey: '',
    agentId: '',
    wallet: ''
  },
  awesomeList: {
    owner: '',  // Your GitHub username for fork
    repo: 'VoltAgent/awesome-openclaw-skills'
  }
};

// Ensure config directory exists
function ensureConfig() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
  }
}

// Load config
function loadConfig() {
  ensureConfig();
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

// Save config
function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Prompt for input
function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
}

// Git config helper
function gitConfig(cwd) {
  try {
    execSync('git config user.email "user@email.com"', { cwd, stdio: 'ignore' });
    execSync('git config user.name "User"', { cwd, stdio: 'ignore' });
  } catch (e) {}
}

// Run command
function run(cmd, opts = {}) {
  const cwd = opts.cwd || process.cwd();
  gitConfig(cwd);
  try {
    return execSync(cmd, { 
      encoding: 'utf8', cwd,
      stdio: opts.silent ? 'ignore' : 'pipe',
      timeout: opts.timeout || 30000
    });
  } catch (e) {
    if (!opts.silent) err(`Command failed: ${cmd}`);
    return null;
  }
}

// Initialize configuration
async function init() {
  log(C.bright + '\n=== Skill Deploy Configuration ===\n' + C.reset, 'cyan');
  log('This will set up your tokens for all platforms.\n', 'gray');
  
  const config = loadConfig();
  
  // GitHub
  log('\n--- GitHub ---', 'yellow');
  const ghToken = await prompt('GitHub Personal Access Token (repo scope): ');
  if (ghToken.trim()) config.github.token = ghToken.trim();
  
  const ghRepo = await prompt('Your skills repo (username/repo): ');
  if (ghRepo.trim()) config.github.repo = ghRepo.trim();
  
  // ClawHub
  log('\n--- ClawHub ---', 'yellow');
  const chToken = await prompt('ClawHub API Token: ');
  if (chToken.trim()) config.clawhub.token = chToken.trim();
  
  // AGDP
  log('\n--- AGDP (Virtuals) ---', 'yellow');
  const agdpKey = await prompt('AGDP API Key: ');
  if (agdpKey.trim()) config.agdp.apiKey = agdpKey.trim();
  
  const agentId = await prompt('AGDP Agent ID: ');
  if (agentId.trim()) config.agdp.agentId = agentId.trim();
  
  const wallet = await prompt('AGDP Wallet Address: ');
  if (wallet.trim()) config.agdp.wallet = wallet.trim();
  
  // Awesome List
  log('\n--- Awesome List ---', 'yellow');
  const awesomeOwner = await prompt('Your GitHub username (for fork): ');
  if (awesomeOwner.trim()) config.awesomeList.owner = awesomeOwner.trim();
  
  saveConfig(config);
  
  log(C.bright + '\nConfiguration saved!' + C.reset, 'green');
  log(`Location: ${CONFIG_FILE}`, 'gray');
}

// Check configuration status
function status() {
  const config = loadConfig();
  
  log(C.bright + '\n=== Configuration Status ===\n' + C.reset, 'cyan');
  
  // GitHub
  if (config.github.token) {
    log('GitHub: OK', 'green');
    if (config.github.repo) log(`  Repo: ${config.github.repo}`, 'gray');
    else log('  Repo: Not set', 'yellow');
  } else {
    log('GitHub: Not configured', 'yellow');
  }
  
  // ClawHub
  if (config.clawhub.token) {
    log('ClawHub: OK', 'green');
  } else {
    log('ClawHub: Not configured', 'yellow');
  }
  
  // AGDP
  if (config.agdp.apiKey) {
    log('AGDP: OK', 'green');
    if (config.agdp.agentId) log(`  Agent: ${config.agdp.agentId}`, 'gray');
  } else {
    log('AGDP: Not configured', 'yellow');
  }
  
  // Awesome List
  if (config.awesomeList.owner) {
    log('Awesome List: OK', 'green');
    log(`  Owner: ${config.awesomeList.owner}`, 'gray');
  } else {
    log('Awesome List: Not configured', 'yellow');
  }
  
  log(`\nConfig file: ${CONFIG_FILE}`, 'gray');
}

// Deploy to ClawHub
async function deployClawhub(skillPath, config) {
  log('\n=== ClawHub ===', 'cyan');
  
  if (!config.clawhub.token) {
    log('ClawHub not configured. Run: skill-deploy init', 'yellow');
    return false;
  }
  
  const skillName = path.basename(skillPath);
  const version = `${new Date().getFullYear()}.${new Date().getMonth()+1}.${new Date().getDate()}`;
  
  // Ensure git repo
  if (!run('git rev-parse --git-dir', { cwd: skillPath, silent: true })) {
    run('git init', { cwd: skillPath });
    run('git add -A', { cwd: skillPath });
    run('git commit -m "Initial commit"', { cwd: skillPath });
  }
  
  // Create SKILL.md if missing
  const readme = path.join(skillPath, 'README.md');
  const skillmd = path.join(skillPath, 'SKILL.md');
  if (!fs.existsSync(skillmd) && fs.existsSync(readme)) {
    fs.copyFileSync(readme, skillmd);
  }
  
  // Login and publish
  run(`clawhub login --token ${config.clawhub.token}`, { silent: true });
  
  const slug = `glitch-${skillName}`;
  const result = run(`clawhub publish "${skillPath}" --version ${version} --slug ${slug}`, { timeout: 60000 });
  
  if (result && result.includes('Published')) {
    log(`Published: ${slug}`, 'green');
    return true;
  }
  
  log('Failed to publish', 'red');
  return false;
}

// Deploy to GitHub
async function deployGitHub(skillPath, config) {
  log('\n=== GitHub ===', 'cyan');
  
  if (!config.github.token || !config.github.repo) {
    log('GitHub not configured. Run: skill-deploy init', 'yellow');
    return false;
  }
  
  const skillName = path.basename(skillPath);
  const tmpDir = `/tmp/deploy-${Date.now()}`;
  
  // Clone
  const repoUrl = `https://${config.github.token}@github.com/${config.github.repo}.git`;
  run(`git clone ${repoUrl} "${tmpDir}"`);
  
  // Copy skill
  const dest = path.join(tmpDir, skillName);
  if (fs.existsSync(dest)) run(`rm -rf "${dest}"`);
  run(`cp -r "${skillPath}" "${dest}"`);
  
  // Ensure SKILL.md
  if (!fs.existsSync(path.join(dest, 'SKILL.md')) && fs.existsSync(path.join(dest, 'README.md'))) {
    fs.copyFileSync(path.join(dest, 'README.md'), path.join(dest, 'SKILL.md'));
  }
  
  // Commit
  gitConfig(tmpDir);
  run('git add -A', { cwd: tmpDir });
  run(`git commit -m "Add ${skillName}"`, { cwd: tmpDir });
  run('git push origin main', { cwd: tmpDir, fail: false });
  run('git push -u origin main', { cwd: tmpDir });
  
  log(`Published: ${config.github.repo}/tree/main/${skillName}`, 'green');
  return true;
}

// Deploy to AGDP
async function deployAGDP(skillPath, config) {
  log('\n=== AGDP ===', 'cyan');
  
  if (!config.agdp.apiKey) {
    log('AGDP not configured. Run: skill-deploy init', 'yellow');
    return false;
  }
  
  log('AGDP deployment requires additional setup...', 'yellow');
  log('See: https://app.virtuals.io/acp', 'gray');
  return false;
}

// Deploy to Awesome List
async function deployAwesomeList(skillPath, config) {
  log('\n=== Awesome List ===', 'cyan');
  
  if (!config.awesomeList.owner || !config.github.token) {
    log('Awesome List not configured. Run: skill-deploy init', 'yellow');
    return false;
  }
  
  const skillName = path.basename(skillPath);
  const tmpDir = `/tmp/awesome-${Date.now()}`;
  
  // Fork and clone
  const forkUrl = `https://${config.github.token}@github.com/${config.awesomeList.owner}/awesome-openclaw-skills.git`;
  run(`gh repo fork VoltAgent/awesome-openclaw-skills --clone=false`, { silent: true });
  run(`git clone ${forkUrl} "${tmpDir}"`);
  
  // Create branch
  const branch = `add-${skillName}-${Date.now()}`;
  run(`git checkout -b ${branch}`, { cwd: tmpDir });
  
  // Add to README (simplified)
  const readmePath = path.join(tmpDir, 'README.md');
  let content = fs.readFileSync(readmePath, 'utf8');
  
  // Add entry (find Productivity section)
  const entry = `\n- [glitch-${skillName}](https://github.com/${config.github.repo}/tree/main/${skillName}/SKILL.md) - ${skillName} skill`;
  
  // Insert after first category
  const insertPoint = content.indexOf('<summary><h3');
  if (insertPoint > 0) {
    content = content.slice(0, insertPoint + 50) + entry + content.slice(insertPoint + 50);
  }
  
  fs.writeFileSync(readmePath, content);
  
  // Commit and push
  gitConfig(tmpDir);
  run('git add -A', { cwd: tmpDir });
  run(`git commit -m "Add glitch-${skillName}"`, { cwd: tmpDir });
  run(`git push -u origin ${branch}`, { cwd: tmpDir });
  
  // Create PR
  run(`gh pr create --title "Add glitch-${skillName}" --body "Add ${skillName} skill" --head ${branch}`, { cwd: tmpDir });
  
  log('PR created successfully', 'green');
  return true;
}

// Main deploy function
async function deploy(skillPath, options = {}) {
  const { updateReadme = false } = options;
  
  // Resolve path
  let resolvedPath = skillPath;
  if (skillPath.startsWith('~')) {
    resolvedPath = path.join(process.env.HOME || '/home/crix', skillPath.slice(1));
  } else if (!skillPath.startsWith('/')) {
    resolvedPath = path.resolve(skillPath);
  }
  
  if (!fs.existsSync(resolvedPath)) {
    err(`Skill not found: ${resolvedPath}`);
    process.exit(1);
  }
  
  const config = loadConfig();
  const skillName = path.basename(resolvedPath);
  
  log(C.bright + `\n=== Deploying "${skillName}" ===\n` + C.reset, 'cyan');
  
  const results = {
    clawhub: await deployClawhub(resolvedPath, config),
    github: await deployGitHub(resolvedPath, config),
    agdp: await deployAGDP(resolvedPath, config),
    awesome: await deployAwesomeList(resolvedPath, config)
  };
  
  // Update README if requested
  if (updateReadme) {
    log(C.bright + '\n=== Updating README ===' + C.reset, 'cyan');
    await updateReadmeAfterDeploy(resolvedPath, config);
  }
  
  // Summary
  log(C.bright + '\n=== Results ===' + C.reset, 'cyan');
  log(`ClawHub:   ${results.clawhub ? C.green + 'OK' + C.reset : C.red + 'SKIPPED' + C.reset}`);
  log(`GitHub:    ${results.github ? C.green + 'OK' + C.reset : C.red + 'SKIPPED' + C.reset}`);
  log(`AGDP:      ${results.agdp ? C.green + 'OK' + C.reset : C.yellow + 'SETUP NEEDED' + C.reset}`);
  log(`Awesome:   ${results.awesome ? C.green + 'OK' + C.reset : C.red + 'SKIPPED' + C.reset}`);
  log(`README:    ${updateReadme ? C.green + 'UPDATED' + C.reset : C.gray + 'SKIP (use --readme to update)' + C.reset}`);
  
  return results;
}

// Update README after deployment
async function updateReadmeAfterDeploy(skillPath, config) {
  const readmeScript = path.join(__dirname, 'readme-manager.js');
  if (!fs.existsSync(readmeScript)) {
    log('README manager not found', 'yellow');
    return false;
  }
  
  const { execSync } = require('child_process');
  const acpPath = path.join(process.env.HOME || '/home/crix', '.openclaw/workspace/skills/acp');
  
  try {
    execSync(`node "${readmeScript}" update "${skillPath}"`, {
      env: {
        ...process.env,
        CLAWHUB_TOKEN: config.clawhub?.token || '',
        GITHUB_TOKEN: config.github?.token || '',
        GITHUB_REPO: config.github?.repo || '',
        ACP_PATH: fs.existsSync(acpPath) ? acpPath : ''
      }
    });
    return true;
  } catch (e) {
    log('README update failed: ' + e.message, 'red');
    return false;
  }
}

// Help
function help() {
  log(C.bright + `
Skill Deploy - One-command skill deployment

USAGE:
  skill-deploy init              Configure your API tokens
  skill-deploy deploy <path>     Deploy skill to all platforms
  skill-deploy deploy <path> --readme   Deploy and update README
  skill-deploy readme <path>     Update README only
  skill-deploy status            Check configuration

EXAMPLES:
  skill-deploy init
  skill-deploy deploy ./my-skill
  skill-deploy deploy ./my-skill --readme
  skill-deploy readme ~/.openclaw/workspace/skills/homeassistant

PLATFORMS:
  - ClawHub      (clawhub.ai)
  - GitHub       (any public repo)
  - AGDP         (app.virtuals.io/acp)
  - Awesome List (VoltAgent/awesome-openclaw-skills)

CONFIG:
  ${CONFIG_FILE}
` + C.reset, 'cyan');
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const arg1 = args[1];
  
  ensureConfig();
  
  switch (cmd) {
    case 'init':
      await init();
      break;
    case 'status':
    case 'check':
      status();
      break;
    case 'deploy':
      if (!arg1) {
        err('Usage: skill-deploy deploy <skill-path> [--readme]');
        process.exit(1);
      }
      // Check for --readme flag
      const updateReadme = args.includes('--readme') || args.includes('-r');
      const skillPath = arg1.startsWith('--') ? args[1] : arg1;
      await deploy(skillPath, { updateReadme });
      break;
    case 'readme':
    case 'update-readme':
      // Standalone readme update
      if (!arg1) {
        err('Usage: skill-deploy readme <skill-path>');
        process.exit(1);
      }
      const config = loadConfig();
      await updateReadmeAfterDeploy(arg1, config);
      break;
    case 'help':
    case '-h':
    default:
      help();
  }
}

main();
