# Leon API 一键启动脚本
# 启动 9880 adapter 和 9881 official API

Write-Host "=== Leon API 启动脚本 ===" -ForegroundColor Cyan
Write-Host ""

# 检查并停止旧进程
Write-Host "[1/3] 检查旧进程..." -ForegroundColor Yellow
$oldProcesses = Get-Process python -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -like "*Leon_api*" -or $_.Path -like "*gpt-sovits-official*"
}
if ($oldProcesses) {
    Write-Host "  发现 $($oldProcesses.Count) 个旧进程，正在停止..." -ForegroundColor Yellow
    $oldProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Write-Host "  ✓ 旧进程已停止" -ForegroundColor Green
} else {
    Write-Host "  ✓ 没有旧进程" -ForegroundColor Green
}
Write-Host ""

# 启动 9880 adapter
Write-Host "[2/3] 启动 9880 adapter..." -ForegroundColor Yellow
& "$PSScriptRoot\dev_tools\start_adapter_lan.ps1"
Write-Host "  ✓ 9880 adapter 启动成功 (0.0.0.0:9880)" -ForegroundColor Green
Write-Host ""

# 启动 9881 official API
Write-Host "[3/3] 启动 9881 official API..." -ForegroundColor Yellow
$root = $PSScriptRoot
$workspace = Split-Path -Parent $root
$officialRoot = Join-Path $workspace "gpt-sovits-official"
$logDir = Join-Path $root "outputs\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$env:PYTHONUTF8 = "1"
$env:PYTHONUNBUFFERED = "1"
$env:NO_PROXY = "127.0.0.1,localhost,192.168.8.100"
$env:no_proxy = $env:NO_PROXY

$python = Join-Path $root ".venvs\official\Scripts\python.exe"
$out = Join-Path $logDir "official_api_9881_task.out.log"
$err = Join-Path $logDir "official_api_9881_task.err.log"

$officialArgs = "api_v2.py -a 127.0.0.1 -p 9881 -c GPT_SoVITS/configs/tts_infer.yaml"
Start-Process -FilePath $python -ArgumentList $officialArgs -WindowStyle Hidden -WorkingDirectory $officialRoot -RedirectStandardOutput $out -RedirectStandardError $err
Start-Sleep -Seconds 5
Write-Host "  ✓ 9881 official API 启动成功 (127.0.0.1:9881)" -ForegroundColor Green

Write-Host ""
Write-Host "=== 启动完成 ===" -ForegroundColor Cyan
Write-Host "  9880 adapter:      http://0.0.0.0:9880 (LAN: http://192.168.8.100:9880)" -ForegroundColor White
Write-Host "  9881 official API: http://127.0.0.1:9881 (adapter 内部调用)" -ForegroundColor White
Write-Host ""
Write-Host "日志目录: outputs\logs" -ForegroundColor Gray
