$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

$env:UV_CACHE_DIR = Join-Path $root ".cache\uv"
$env:PIP_CACHE_DIR = Join-Path $root ".cache\pip"
$env:HF_HOME = Join-Path $root ".cache\hf"
$env:HUGGINGFACE_HUB_CACHE = Join-Path $env:HF_HOME "hub"
$env:TRANSFORMERS_CACHE = Join-Path $env:HF_HOME "transformers"
$env:XDG_CACHE_HOME = Join-Path $root ".cache"
$env:GENIE_DATA_DIR = Join-Path $root "Leon_api\models\GenieData"
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

New-Item -ItemType Directory -Force -Path $env:UV_CACHE_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $env:PIP_CACHE_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $env:HF_HOME | Out-Null
New-Item -ItemType Directory -Force -Path $env:GENIE_DATA_DIR | Out-Null

$env:PATH = (Join-Path $root "Leon_api\.venvs\genie\Scripts") + ";" + $env:PATH
