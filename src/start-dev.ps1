[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$SkipDocker,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Logs = Join-Path $Root ".local\logs"
$RunId = Get-Date -Format "yyyyMMdd-HHmmss"
$WorkerDir = Join-Path $Root "apps\worker"
$WorkerPython = Join-Path $WorkerDir ".venv\Scripts\python.exe"
$Ports = @(4010, 4020, 4101, 4102)

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing required command '$Name'. Install it and run this script again."
    }
}

function Stop-ProjectPorts {
    $listeners = Get-NetTCPConnection -LocalPort $Ports -State Listen -ErrorAction SilentlyContinue
    $processIds = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $processIds) {
        if ($processId -and $processId -ne $PID) {
            Write-Host "Stopping process on project port: PID $processId"
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }
}

function Start-LoggedProcess {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$ArgumentList,
        [string]$WorkingDirectory
    )

    $outFile = Join-Path $Logs "$RunId.$Name.out.log"
    $errFile = Join-Path $Logs "$RunId.$Name.err.log"

    $process = Start-Process `
        -FilePath $FilePath `
        -ArgumentList $ArgumentList `
        -WorkingDirectory $WorkingDirectory `
        -WindowStyle Hidden `
        -RedirectStandardOutput $outFile `
        -RedirectStandardError $errFile `
        -PassThru

    Write-Host "$Name started. PID $($process.Id). Logs: $outFile / $errFile"
    return $process
}

function Wait-HttpOk {
    param(
        [string]$Name,
        [string]$Url,
        [int]$TimeoutSeconds = 45
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try {
            Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 | Out-Null
            Write-Host "$Name ready: $Url" -ForegroundColor Green
            return
        }
        catch {
            Start-Sleep -Milliseconds 750
        }
    } while ((Get-Date) -lt $deadline)

    throw "$Name did not become ready at $Url within $TimeoutSeconds seconds."
}

Set-Location $Root
New-Item -ItemType Directory -Force -Path $Logs | Out-Null

Write-Step "Checking tools"
Assert-Command "node"
Assert-Command "npm"
Assert-Command "python"
if (-not $SkipDocker) {
    Assert-Command "docker"
}

if (-not (Test-Path (Join-Path $Root ".env"))) {
    if (-not (Test-Path (Join-Path $Root ".env.example"))) {
        throw ".env is missing and .env.example could not be found."
    }
    Copy-Item (Join-Path $Root ".env.example") (Join-Path $Root ".env")
    Write-Host "Created .env from .env.example. Add DATAFORDELEREN_API_KEY before using real Datafordeler calls." -ForegroundColor Yellow
}

if (-not $SkipDocker) {
    Write-Step "Starting Docker Compose"
    docker compose up -d
}

if (-not $SkipInstall) {
    Write-Step "Installing Node dependencies"
    if (-not (Test-Path (Join-Path $Root "node_modules"))) {
        npm install
    }
    else {
        Write-Host "node_modules exists. Skipping npm install."
    }

    Write-Step "Preparing Python worker environment"
    if (-not (Test-Path $WorkerPython)) {
        python -m venv (Join-Path $WorkerDir ".venv")
    }
    & $WorkerPython -m pip install -r (Join-Path $WorkerDir "requirements.txt")
}

Write-Step "Stopping old project processes"
Stop-ProjectPorts
Start-Sleep -Seconds 1

Write-Step "Starting app services"
$processes = @()
$processes += Start-LoggedProcess -Name "gateway" -FilePath "npm.cmd" -ArgumentList @("run", "dev:run", "-w", "@tagrende-quote/gateway") -WorkingDirectory $Root
$processes += Start-LoggedProcess -Name "worker" -FilePath $WorkerPython -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4020", "--reload") -WorkingDirectory $WorkerDir
$processes += Start-LoggedProcess -Name "widget" -FilePath "npm.cmd" -ArgumentList @("run", "dev:widget") -WorkingDirectory $Root
$processes += Start-LoggedProcess -Name "admin" -FilePath "npm.cmd" -ArgumentList @("run", "dev:admin") -WorkingDirectory $Root

Write-Step "Waiting for services"
Wait-HttpOk -Name "Gateway" -Url "http://localhost:4010/health"
Wait-HttpOk -Name "Worker" -Url "http://localhost:4020/health"
Wait-HttpOk -Name "Widget" -Url "http://localhost:4101/"
Wait-HttpOk -Name "Admin" -Url "http://localhost:4102/"

Write-Step "Ready"
Write-Host "Gateway: http://localhost:4010"
Write-Host "Worker:  http://localhost:4020"
Write-Host "Widget:  http://localhost:4101"
Write-Host "Admin:   http://localhost:4102"
Write-Host ""
Write-Host "Logs are in $Logs"
Write-Host "Stop later with:"
Write-Host "  .\stop-dev.ps1"

if (-not $NoBrowser) {
    Start-Process "http://localhost:4102"
}
