$ErrorActionPreference = "Continue"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$workspace = Split-Path -Parent $root
$officialRoot = Join-Path $workspace "gpt-sovits-official"
$logDir = Join-Path $root "outputs\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$env:PYTHONUTF8 = "1"
$env:PYTHONUNBUFFERED = "1"
$env:NO_PROXY = "127.0.0.1,localhost,192.168.8.100"
$env:no_proxy = $env:NO_PROXY

$python = Join-Path $root ".venvs\official\Scripts\python.exe"
if (-not (Test-Path -Path $python)) {
  $python = "python"
}

$out = Join-Path $logDir "official_api_9881_task.out.log"
$err = Join-Path $logDir "official_api_9881_task.err.log"

Set-Location $officialRoot
& $python api_v2.py -a 127.0.0.1 -p 9881 -c GPT_SoVITS/configs/tts_infer.yaml 1>> $out 2>> $err
exit $LASTEXITCODE
