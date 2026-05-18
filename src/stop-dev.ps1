[CmdletBinding()]
param(
    [switch]$StopDocker
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Ports = @(4010, 4020, 4101, 4102)

Set-Location $Root

$listeners = Get-NetTCPConnection -LocalPort $Ports -State Listen -ErrorAction SilentlyContinue
$processIds = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($processId in $processIds) {
    if ($processId -and $processId -ne $PID) {
        Write-Host "Stopping PID $processId"
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
}

if ($StopDocker) {
    docker compose down
}

Write-Host "TagrendeQuote dev services stopped."
