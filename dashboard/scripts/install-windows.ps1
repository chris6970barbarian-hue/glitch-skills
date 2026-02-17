# Glitch Dashboard Windows Installer
# Run as Administrator: powershell -ExecutionPolicy Bypass -File install-windows.ps1

$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/chris6970barbarian-hue/glitch-skills"
$InstallDir = "$env:LOCALAPPDATA\GlitchDashboard"
$ServiceName = "GlitchDashboard"

Write-Host "=== Glitch Dashboard Windows Installer ===" -ForegroundColor Cyan
Write-Host ""

# Check if running as admin
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "Please run as Administrator"
    exit 1
}

# Check for Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "Installing Node.js..." -ForegroundColor Yellow
    
    # Download Node.js installer
    $nodeUrl = "https://nodejs.org/dist/v20.10.0/node-v20.10.0-x64.msi"
    $nodeInstaller = "$env:TEMP\node-installer.msi"
    
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller
    Start-Process msiexec.exe -ArgumentList "/i", $nodeInstaller, "/quiet", "/norestart" -Wait
    
    Remove-Item $nodeInstaller
    
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

$nodeVersion = (node -v).Replace("v", "").Split(".")[0]
if ([int]$nodeVersion -lt 18) {
    Write-Error "Node.js 18+ required"
    exit 1
}

Write-Host "Node.js: $(node -v)" -ForegroundColor Green

# Create directories
Write-Host "Creating directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.glitch-dashboard" | Out-Null

# Download dashboard
Write-Host "Downloading Glitch Dashboard..." -ForegroundColor Yellow
$tempDir = "$env:TEMP\glitch-skills"
if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }

git clone --depth 1 $RepoUrl $tempDir
Copy-Item -Recurse -Force "$tempDir\dashboard\*" $InstallDir
Remove-Item -Recurse -Force $tempDir

# Create Windows Service using nssm
Write-Host "Creating Windows Service..." -ForegroundColor Yellow

# Download nssm
$nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
$nssmZip = "$env:TEMP\nssm.zip"
$nssmDir = "$env:TEMP\nssm"

Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip
Expand-Archive -Force $nssmZip $nssmDir

$nssmExe = "$nssmDir\nssm-2.24\win64\nssm.exe"

# Install service
& $nssmExe install $ServiceName "C:\Program Files\nodejs\node.exe"
& $nssmExe set $ServiceName Application "$(Get-Command node).Source"
& $nssmExe set $ServiceName AppDirectory $InstallDir
& $nssmExe set $ServiceName AppParameters "$InstallDir\main.js"
& $nssmExe set $ServiceName DisplayName "Glitch Dashboard"
& $nssmExe set $ServiceName Description "Unified system management dashboard"
& $nssmExe set $ServiceName Start SERVICE_AUTO_START

# Install ZeroTier if needed
$ztPath = "${env:ProgramFiles(x86)}\ZeroTier\One\zerotier-cli.exe"
if (-not (Test-Path $ztPath)) {
    Write-Host "Installing ZeroTier..." -ForegroundColor Yellow
    $ztUrl = "https://download.zerotier.com/dist/ZeroTier%20One.msi"
    $ztInstaller = "$env:TEMP\zerotier.msi"
    
    Invoke-WebRequest -Uri $ztUrl -OutFile $ztInstaller
    Start-Process msiexec.exe -ArgumentList "/i", $ztInstaller, "/quiet", "/norestart" -Wait
    Remove-Item $ztInstaller
}

# Start service
Start-Service $ServiceName

# Create CLI shortcut
$cliPath = "$InstallDir\glitch-dashboard.cmd"
@"
@echo off
if "%~1"=="start" (
    net start $ServiceName
) else if "%~1"=="stop" (
    net stop $ServiceName
) else if "%~1"=="restart" (
    net stop $ServiceName
    net start $ServiceName
) else if "%~1"=="status" (
    sc query $ServiceName
) else if "%~1"=="logs" (
    Get-Content "$env:USERPROFILE\.glitch-dashboard\dashboard.log" -Tail 50 -Wait
) else (
    echo Usage: glitch-dashboard {start^|stop^|restart^|status^|logs}
)
"@ | Set-Content $cliPath

# Add to PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (-not $currentPath.Contains($InstallDir)) {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$InstallDir", "User")
}

# Cleanup
Remove-Item -Recurse -Force $nssmDir
Remove-Item $nssmZip

Write-Host ""
Write-Host "=== Installation Complete ===" -ForegroundColor Green
Write-Host "Dashboard URL: http://localhost:3853" -ForegroundColor Cyan
Write-Host ""
Write-Host "Commands:" -ForegroundColor Yellow
Write-Host "  glitch-dashboard start    - Start service"
Write-Host "  glitch-dashboard stop     - Stop service"
Write-Host "  glitch-dashboard logs     - View logs"
Write-Host ""
Write-Host "Please restart your terminal to use the CLI command" -ForegroundColor Yellow
