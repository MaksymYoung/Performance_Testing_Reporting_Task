# Usage:
#   .\run_lighthouse.ps1
#   .\run_lighthouse.ps1 -BaseUrl "http://localhost" -Scenario "order-flow"
#   .\run_lighthouse.ps1 -Loops 3          # quick check with 3 runs instead of 10

param(
    [string]$BaseUrl      = "http://localhost",
    [string]$InfluxUrl    = "http://localhost:8086",
    [string]$InfluxOrg    = "a9b242c010a7a78f",
    [string]$InfluxBucket = "lighthouse",
    [string]$Scenario     = "order-flow",
    [int]$Loops           = 10,
    [int]$PauseSeconds    = 5,
    [switch]$InstallDeps
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (-not $env:INFLUX_TOKEN) {
    $secretsFile = Join-Path $PSScriptRoot "secrets.properties"
    if (Test-Path $secretsFile) {
        $line = Get-Content $secretsFile | Where-Object { $_ -match '^\s*influxdb_token\s*=' } | Select-Object -First 1
        if ($line) {
            $env:INFLUX_TOKEN = ($line -split '=', 2)[1].Trim()
        }
    }
}

if (-not $env:INFLUX_TOKEN) {
    Write-Warning "INFLUX_TOKEN is not set: the Lighthouse run will work, but metrics will NOT be sent to InfluxDB."
}

$env:BASE_URL      = $BaseUrl
$env:INFLUX_URL    = $InfluxUrl
$env:INFLUX_ORG    = $InfluxOrg
$env:INFLUX_BUCKET = $InfluxBucket
$env:SCENARIO      = $Scenario

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js was not found in PATH. Install Node 18+ and try again."
}

$nodeMajor = [int]((node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 18) {
    throw "Node 18+ is required (built-in fetch), found v$nodeMajor."
}

$lighthouseApi = Join-Path $PSScriptRoot "node_modules\lighthouse\lighthouse-core\fraggle-rock\api.js"
$puppeteerDir  = Join-Path $PSScriptRoot "node_modules\puppeteer"

if (-not (Test-Path $lighthouseApi) -or -not (Test-Path $puppeteerDir)) {
    if ($InstallDeps) {
        Write-Host "Installing lighthouse@^9.6.8 and puppeteer@^13.7.0 (the versions this script was written for)..."
        npm install "lighthouse@^9.6.8" "puppeteer@^13.7.0"
        if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
    }
    else {
        throw ("Missing dependency (lighthouse 9.x with lighthouse-core, or puppeteer) in node_modules. " +
               "Rerun with -InstallDeps to install lighthouse@^9.6.8 and puppeteer@^13.7.0, " +
               "or run: npm install `"lighthouse@^9.6.8`" `"puppeteer@^13.7.0`"")
    }
}

if (-not (Test-Path $lighthouseApi)) {
    throw "Lighthouse module is still missing: $lighthouseApi"
}

Write-Host ("Using: " + ((npm ls lighthouse puppeteer puppeteer-core --depth=0 2>&1) -join "`n"))

if ($Loops -lt 1) { throw "-Loops must be 1 or greater." }

Get-ChildItem -Path $PSScriptRoot -Filter "performance-testing-essentials-run*.report.*" -ErrorAction SilentlyContinue |
    Remove-Item -Force -Recurse
Get-ChildItem -Path $PSScriptRoot -Directory -Filter "performance-testing-essentials-artifacts-run*" -ErrorAction SilentlyContinue |
    Remove-Item -Force -Recurse

Write-Host "Running Lighthouse flow against $BaseUrl (scenario: $Scenario), $Loops loop(s)..."

$failedRuns = @()
for ($i = 1; $i -le $Loops; $i++) {
    Write-Host ""
    Write-Host "=== Run $i of $Loops ==="
    $env:RUN_INDEX = "$i"

    node .\performance-testing-essentials.js
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Run $i failed with exit code $LASTEXITCODE."
        $failedRuns += $i
    }

    if ($i -lt $Loops) { Start-Sleep -Seconds $PauseSeconds }
}
Remove-Item Env:RUN_INDEX -ErrorAction SilentlyContinue

$okRuns = $Loops - $failedRuns.Count
if ($okRuns -lt 1) { throw "All $Loops runs failed, nothing to aggregate." }

Write-Host ""
Write-Host "Building the averaged report from $okRuns successful run(s)..."
node .\aggregate-lighthouse.js
if ($LASTEXITCODE -ne 0) { throw "aggregate-lighthouse.js failed with exit code $LASTEXITCODE." }

Write-Host ""
Write-Host "Done: $okRuns of $Loops runs succeeded."
if ($failedRuns.Count -gt 0) {
    Write-Warning ("Failed runs: " + ($failedRuns -join ", ") + ". They are NOT included in the summary - rerun if you need exactly $Loops.")
}
Write-Host "Per-run reports:  performance-testing-essentials-run<N>.report.html / .json"
Write-Host "Averaged report:  performance-testing-essentials.summary.html (+ .summary.csv, .runs.csv)"
Write-Host "Metrics reached InfluxDB bucket '$InfluxBucket' only if the output above contains lines 'Sent N Lighthouse steps to InfluxDB' (one per run, tag loop=1..N)."
Write-Host "System metrics (bucket 'telegraf') are written by Telegraf, which must be started separately with telegraf_lighthouse.conf."
