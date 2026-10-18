# NVRBEATS - Windows build launcher
# Checks required tools, then builds the desktop installer.
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $root

function Ok($m)   { Write-Host "  [OK]      $m" -ForegroundColor Green }
function Bad($m)  { Write-Host "  [MISSING] $m" -ForegroundColor Red }
function Info($m) { Write-Host "            $m" -ForegroundColor Yellow }

Write-Host ""
Write-Host "NVRBEATS - build launcher" -ForegroundColor Cyan
Write-Host "Checking required tools..." -ForegroundColor Cyan
Write-Host ""

$missing = 0

# Make freshly installed tools visible in this window
$env:Path += ";$env:USERPROFILE\.bun\bin;$env:USERPROFILE\.cargo\bin"

if (Get-Command bun -ErrorAction SilentlyContinue) { Ok "Bun $(bun --version)" } else {
  Bad "Bun"; $missing++
  Info "Install: open PowerShell and run:  powershell -c `"irm bun.sh/install.ps1 | iex`""
}

if ((Get-Command cargo -ErrorAction SilentlyContinue) -and (Get-Command rustc -ErrorAction SilentlyContinue)) {
  Ok "Rust $((rustc --version) -replace 'rustc ','')"
} else {
  Bad "Rust"; $missing++
  Info "Install: download rustup-init.exe from https://rustup.rs and accept the defaults."
}

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vc = $null
if (Test-Path $vswhere) {
  $vc = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
}
if ($vc) { Ok "Microsoft C++ Build Tools" } else {
  Bad "Microsoft C++ Build Tools"; $missing++
  Info "Install: https://visualstudio.microsoft.com/visual-cpp-build-tools/"
  Info "Tick the 'Desktop development with C++' workload."
}

$wv = $null
foreach ($k in @(
  "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
  "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
  "HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}")) {
  if (Test-Path $k) { $wv = (Get-ItemProperty $k).pv; if ($wv) { break } }
}
if ($wv) { Ok "WebView2 $wv" } else {
  Bad "WebView2 runtime"; $missing++
  Info "Install: https://developer.microsoft.com/microsoft-edge/webview2/ (Evergreen Bootstrapper)."
}

Write-Host ""
if ($missing -gt 0) {
  Write-Host "$missing item(s) missing. Install them using the links above," -ForegroundColor Red
  Write-Host "then CLOSE this window and double-click BUILD-WINDOWS.bat again." -ForegroundColor Red
  Write-Host "Full guide: docs\WINDOWS-SETUP.md"
  exit 1
}

Write-Host "All tools found. Installing app packages..." -ForegroundColor Cyan
bun install
if ($LASTEXITCODE -ne 0) { Write-Host "Package install failed. Check your internet connection and try again." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "Building the desktop app (first build can take 10-30 minutes)..." -ForegroundColor Cyan
bun run desktop:build
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Build failed. Scroll up for the first red error line," -ForegroundColor Red
  Write-Host "see the troubleshooting table in docs\WINDOWS-SETUP.md, or paste the error into chat." -ForegroundColor Red
  exit 1
}

$bundle = Join-Path $root "src-tauri\target\release\bundle"
Write-Host ""
Write-Host "Done! Your installer is in:" -ForegroundColor Green
Write-Host "  $bundle"
if (Test-Path $bundle) { Start-Process explorer.exe $bundle }
Write-Host "Run the installer, then set Traktor's output to the Windows default device (WASAPI/DirectSound, not ASIO)."
