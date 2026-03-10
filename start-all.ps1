$ErrorActionPreference = 'Stop'

$root = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$backendDir = Join-Path $root 'packages\backend'
$dashboardDir = Join-Path $root 'packages\dashboard'

if (-not (Test-Path (Join-Path $backendDir 'package.json'))) {
  Write-Error "Backend nao encontrado em: $backendDir"
}
if (-not (Test-Path (Join-Path $dashboardDir 'package.json'))) {
  Write-Error "Dashboard nao encontrado em: $dashboardDir"
}

function Start-DevWindow {
  param(
    [Parameter(Mandatory = $true)][string]$Title,
    [Parameter(Mandatory = $true)][string]$Workdir,
    [Parameter(Mandatory = $true)][string]$Command
  )

  Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-Command',
    "`$Host.UI.RawUI.WindowTitle = '$Title'; Set-Location -LiteralPath '$Workdir'; $Command"
  ) | Out-Null
}

Write-Host 'Iniciando backend...'
Start-DevWindow -Title 'Minha Viagem - Backend' -Workdir $backendDir -Command 'npm run dev'

Start-Sleep -Seconds 2

Write-Host 'Iniciando dashboard...'
Start-DevWindow -Title 'Minha Viagem - Dashboard' -Workdir $dashboardDir -Command 'npm run dev'

Write-Host ''
Write-Host 'Aguardando backend responder em http://127.0.0.1:3001/api/health ...'

$ok = $false
for ($i = 0; $i -lt 15; $i++) {
  try {
    $res = Invoke-WebRequest -Uri 'http://127.0.0.1:3001/api/health' -UseBasicParsing -TimeoutSec 2
    if ($res.StatusCode -eq 200) {
      $ok = $true
      Write-Host 'Backend OK.'
      break
    }
  } catch {
    Start-Sleep -Seconds 1
  }
}

if (-not $ok) {
  Write-Warning 'Backend ainda nao respondeu. Veja a janela "Minha Viagem - Backend".'
}

Write-Host ''
Write-Host 'Links:'
Write-Host '- Dashboard: http://localhost:3000'
Write-Host '- API health: http://127.0.0.1:3001/api/health'
Write-Host '- WhatsApp Web: https://web.whatsapp.com'
