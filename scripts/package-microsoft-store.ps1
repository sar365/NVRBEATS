$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($env:STORE_PACKAGE_NAME) -or [string]::IsNullOrWhiteSpace($env:STORE_PUBLISHER)) {
    throw 'Set STORE_PACKAGE_NAME and STORE_PUBLISHER to the identity reserved for this app in Microsoft Partner Center.'
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$cargoToml = Get-Content (Join-Path $repoRoot 'src-tauri/Cargo.toml') -Raw
$versionMatch = [regex]::Match($cargoToml, '(?m)^version\s*=\s*"(?<version>\d+\.\d+\.\d+)"')
if (-not $versionMatch.Success) {
    throw 'Could not read a three-part version from src-tauri/Cargo.toml.'
}

$version = "$($versionMatch.Groups['version'].Value).0"
$stage = Join-Path $repoRoot 'dist/store/staging'
$output = Join-Path $repoRoot 'dist/store'
$exe = Join-Path $repoRoot 'src-tauri/target/release/dj-set-recorder.exe'
$logo = Join-Path $repoRoot 'src-tauri/icons/128x128.png'

if (-not (Test-Path $exe)) {
    throw "Tauri release executable not found: $exe"
}

New-Item -ItemType Directory -Force -Path $stage, $output | Out-Null
Get-ChildItem $stage -Force | Remove-Item -Recurse -Force
Copy-Item $exe $stage
Get-ChildItem (Split-Path $exe) -Filter '*.dll' -File | Copy-Item -Destination $stage

winapp manifest generate $stage `
    --package-name $env:STORE_PACKAGE_NAME `
    --publisher-name $env:STORE_PUBLISHER `
    --version $version `
    --description 'WASAPI loopback DJ set recorder for Windows' `
    --entrypoint 'dj-set-recorder.exe' `
    --logo-path $logo `
    --if-exists Overwrite

$manifestPath = Join-Path $stage 'Package.appxmanifest'
if (-not (Test-Path $manifestPath)) {
    throw "Microsoft Store manifest was not generated: $manifestPath"
}

[xml]$manifest = Get-Content $manifestPath -Raw
foreach ($node in $manifest.SelectNodes("//*[local-name()='DisplayName']")) {
    $node.InnerText = 'NVRBEATS'
}
foreach ($node in $manifest.SelectNodes("//*[local-name()='PublisherDisplayName']")) {
    $node.InnerText = 'NVRBEATS'
}
foreach ($node in $manifest.SelectNodes("//*[local-name()='VisualElements']")) {
    $node.SetAttribute('DisplayName', 'NVRBEATS')
}
$manifest.Save($manifestPath)

$package = Join-Path $output 'NVRBEATS.msix'
winapp pack $stage --output $package --no-sign

if (-not (Test-Path $package)) {
    throw "Microsoft Store MSIX was not created: $package"
}

Write-Host "Created unsigned Microsoft Store submission package: $package"
