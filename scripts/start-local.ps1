param([string]$Distro = 'Debian')

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectRoot
try {
    Write-Host 'Avvio Docker in WSL...'
    & wsl.exe -d $Distro -u root -- bash -lc 'service docker start'
    if ($LASTEXITCODE -ne 0) { throw 'Docker non è partito.' }

    & wsl.exe -d $Distro -- bash -lc 'npm run dev:full'
    if ($LASTEXITCODE -ne 0) { throw 'Avvio locale non riuscito.' }
}
finally {
    Pop-Location
}
