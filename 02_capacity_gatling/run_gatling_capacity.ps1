$ErrorActionPreference = "Stop"
$ProjectDir = (Get-Location).Path
$Stamp      = Get-Date -Format "yyyyMMdd-HHmm"
$RunDir     = Join-Path $ProjectDir "target\console\CapacityTest_$Stamp"

$StartUsers         = 1       
$Users              = 200     
                              
$RampUpSec          = 2100    
$TestHoldSec        = 1800    

$Users2             = 400     
$Ramp2Sec           = 6000   

$TtMin              = 2000
$TtMax              = 5000
$ThinkTimeCenter    = ($TtMin + $TtMax) / 2        
$ThinkTimeDeviation = ($TtMax - $TtMin) / 2        
$ConnectTimeout     = 5000
$ResponseTimeout    = 10000                         
$AssertionType      = "smokeTest"   

$ErrorThresholdPct  = 10
$ErrorWindowSec     = 60
$InstabilityHoldSec = 180

if (-not (Test-Path (Join-Path $ProjectDir "pom.xml"))) {
    throw "pom.xml not found in $ProjectDir. Run this script from the project root."
}

New-Item -ItemType Directory -Path $RunDir -Force | Out-Null

$env:MAVEN_OPTS = "-Xms4g -Xmx8g -javaagent:C:\Monitoring\jolokia-agent.jar=host=127.0.0.1,port=8778"

$env:JAVA_TOOL_OPTIONS = "-Duser.language=en -Duser.country=US"

$ConsoleLog = Join-Path $RunDir "console.log"

Write-Host "Starting Gatling capacity test..." -ForegroundColor Cyan
Write-Host "Test title: capacity-$Stamp"
$Stage2On = ($Users2 -gt $Users) -and ($Ramp2Sec -gt 0)
if (-not $Stage2On) { $Users2 = 0; $Ramp2Sec = 0 }
Write-Host "Load model: closed, stage 1: $StartUsers -> $Users concurrent users in $RampUpSec s"
if ($Stage2On) { Write-Host "            stage 2: $Users -> $Users2 concurrent users in $Ramp2Sec s" }
Write-Host "            hold at peak: $TestHoldSec s"
Write-Host "Stop trigger: >= $ErrorThresholdPct% errors in a rolling $ErrorWindowSec-second window, persisting for $InstabilityHoldSec seconds"
Write-Host "Maximum duration if no trigger: $([math]::Round(($RampUpSec + $Ramp2Sec + $TestHoldSec) / 60, 1)) minutes"
Write-Host "Results directory: $RunDir"

$ErrorActionPreference = "Continue"
mvn gatling:test `
    "-DtestTitle=capacity-$Stamp" `
    "-Dgatling.runDescription=capacity-$Stamp" `
    "-DCLOSED_START_USERS=$StartUsers" `
    "-DCLOSED_USERS=$Users" `
    "-DRAMP_UP_PERIOD=$RampUpSec" `
    "-DTEST_HOLD_SEC=$TestHoldSec" `
    "-DRAMP2_USERS=$Users2" `
    "-DRAMP2_PERIOD=$Ramp2Sec" `
    "-DSTEP_TIMEOUT_MS=$ResponseTimeout" `
    "-Dthink_time_center=$ThinkTimeCenter" `
    "-Dthink_time_deviation=$ThinkTimeDeviation" `
    "-Dgatling.socket.connectTimeout=$ConnectTimeout" `
    "-Dgatling.http.requestTimeout=$ResponseTimeout" `
    "-DASSERTION_TYPE=$AssertionType" `
    "-DERROR_THRESHOLD_PCT=$ErrorThresholdPct" `
    "-DERROR_WINDOW_SEC=$ErrorWindowSec" `
    "-DINSTABILITY_HOLD_SEC=$InstabilityHoldSec" 2>&1 |
    ForEach-Object { "$_" } |
    Tee-Object -FilePath $ConsoleLog

$GatlingExitCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"

if ($GatlingExitCode -ne 0) {
    Write-Host "Gatling failed with exit code $GatlingExitCode (simulation error or failed assertions). See $ConsoleLog" -ForegroundColor Red
    throw "Gatling failed with exit code $GatlingExitCode."
}

Write-Host ""
Write-Host "Capacity test completed successfully." -ForegroundColor Green
Write-Host "Console log: $ConsoleLog"
Write-Host "Check target/gatling/ for HTML reports."
