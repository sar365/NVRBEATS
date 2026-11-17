$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$cargoToml = Join-Path $repoRoot 'src-tauri/Cargo.toml'
$releaseDir = Join-Path $repoRoot 'src-tauri/target/release'
$portableRoot = Join-Path $repoRoot 'dist/portable'
$stageDir = Join-Path $portableRoot 'NVRBEATS-portable'

$versionLine = Select-String -Path $cargoToml -Pattern '^version\s*=\s*"([^"]+)"' | Select-Object -First 1
if (-not $versionLine) { throw 'Could not read the app version from src-tauri/Cargo.toml.' }
$appVersion = $versionLine.Matches[0].Groups[1].Value
if ($env:GITHUB_REF -like 'refs/tags/v*') {
  $releaseVersion = $env:GITHUB_REF_NAME
} else {
  $runNumber = if ($env:GITHUB_RUN_NUMBER) { $env:GITHUB_RUN_NUMBER } else { 'local' }
  $releaseVersion = "v$appVersion-build.$runNumber"
}

$exePath = Join-Path $releaseDir 'dj-set-recorder.exe'
if (-not (Test-Path -LiteralPath $exePath -PathType Leaf)) {
  throw "Built NVRBEATS executable was not found: $exePath"
}

if (Test-Path -LiteralPath $stageDir) { Remove-Item -LiteralPath $stageDir -Recurse -Force }
New-Item -ItemType Directory -Path $stageDir -Force | Out-Null
Copy-Item -LiteralPath $exePath -Destination (Join-Path $stageDir 'NVRBEATS.exe')
Get-ChildItem -LiteralPath $releaseDir -Filter '*.dll' -File | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $stageDir
}
New-Item -ItemType File -Path (Join-Path $stageDir 'nvrbeats.portable') -Force | Out-Null

$readme = @'
NVRBEATS Portable

1. Extract this ZIP to a folder where you have permission to save files.
2. Run NVRBEATS.exe. No installer is needed.
3. Your NVRBEATS settings and WebView data are kept in the portable-data folder beside the app.
4. New recordings go into portable-data\Recordings by default. Back up or move the whole extracted folder to keep your settings and recordings together.

Windows 10 or 11 with the Microsoft Edge WebView2 Runtime is required. If the app does not open, install the Evergreen WebView2 Runtime from Microsoft and try again. If you choose another recording folder in settings, recordings will be saved there instead.
'@
Set-Content -LiteralPath (Join-Path $stageDir 'README.txt') -Value $readme -Encoding UTF8

$zipPath = Join-Path $portableRoot "NVRBEATS-portable-$releaseVersion.zip"
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -Path (Join-Path $stageDir '*') -DestinationPath $zipPath -CompressionLevel Optimal

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $entries = @($archive.Entries | ForEach-Object { $_.FullName })
  if ($entries -notcontains 'NVRBEATS.exe' -or $entries -notcontains 'nvrbeats.portable' -or $entries -notcontains 'README.txt') {
    throw "Portable ZIP is missing required files: $($entries -join ', ')"
  }
} finally {
  $archive.Dispose()
}
Write-Host "Created portable package: $zipPath"
