$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$logDir = Join-Path $root "outputs\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$privateLlmConfig = Join-Path $root "local_private\gsv_tavo_llm.ps1"
if (Test-Path -Path $privateLlmConfig) {
  . $privateLlmConfig
}

$python = Join-Path $root ".venvs\official\Scripts\python.exe"
if (-not (Test-Path -Path $python)) {
  $python = "python"
}

$portPids = @(netstat -ano | Select-String ':9880' | ForEach-Object { ($_ -split '\s+')[-1] } | Where-Object { $_ -match '^\d+$' } | Select-Object -Unique)
foreach ($procId in $portPids) {
  if ([int]$procId -gt 0) {
    Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
  }
}

Start-Process -FilePath $python `
  -ArgumentList @('-m','uvicorn','gsv_tavo_adapter:APP','--host','0.0.0.0','--port','9880') `
  -WorkingDirectory $root `
  -RedirectStandardOutput (Join-Path $logDir 'gsv_tavo_adapter_lan.out.log') `
  -RedirectStandardError (Join-Path $logDir 'gsv_tavo_adapter_lan.err.log') `
  -WindowStyle Hidden

Start-Sleep -Seconds 2
netstat -ano | Select-String ':9880'
Write-Host "Adapter: http://127.0.0.1:9880"
Write-Host "LAN:     http://192.168.8.100:9880"
Write-Host "P2 UI:   http://192.168.8.100:9880/p2_test"
