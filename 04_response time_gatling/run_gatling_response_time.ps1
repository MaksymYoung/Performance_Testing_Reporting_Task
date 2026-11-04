$ErrorActionPreference = "Stop"
$ProjectDir = (Get-Location).Path
$Stamp      = Get-Date -Format "yyyyMMdd-HHmm"
$RunDir     = Join-Path $ProjectDir "target\console\ResponseTimeTest_$Stamp"

$SaturationUsers    = 160     
$LoadPercent        = 80      
$Users              = [int][math]::Round($SaturationUsers * $LoadPercent / 100)   
$StartUsers         = 1       
$RampUpSec          = 600     
$TestHoldSec        = 1800    

$TtMin              = 2000
$TtMax              = 5000
$ThinkTimeCenter    = ($TtMin + $TtMax) / 2        
$ThinkTimeDeviation = ($TtMax - $TtMin) / 2        
$ConnectTimeout     = 5000
$ResponseTimeout    = 10000                         

$AssertionType      = "responseTime"
$MinSuccessPct      = 99

$StopOnInstability  = $false
$ErrorThresholdPct  = 10
$ErrorWindowSec     = 60
$InstabilityHoldSec = 180

if (-not (Test-Path (Join-Path $ProjectDir "pom.xml"))) {
    throw "pom.xml not found in $ProjectDir. Run this script from the project root."
}

New-Item -ItemType Directory -Path $RunDir -Force | Out-Null

$env:MAVEN_OPTS = "-Xms4g -Xmx8g -javaagent:C:\Monitoring\jolokia-agent.jar=host=127.0.0.1,port=8778"

# preferIPv4Stack: 'localhost' always resolves to 127.0.0.1 (no random ::1, which Gatling shuffles between iterations).
# BASE_URL is NOT changed to 127.0.0.1: WordPress builds links from its siteurl (localhost) and may redirect.
# The env variable is inherited by the JVM that the Gatling Maven plugin forks for the simulation.
$env:JAVA_TOOL_OPTIONS = "-Duser.language=en -Duser.country=US -Djava.net.preferIPv4Stack=true"

$ConsoleLog     = Join-Path $RunDir "console.log"
$MonitorEnabled = $StopOnInstability.ToString().ToLower()
$TotalSec       = $RampUpSec + $TestHoldSec
$ExpectedEnd    = (Get-Date).AddSeconds($TotalSec)
$SteadyFrom     = (Get-Date).AddSeconds($RampUpSec)

Write-Host "Starting Gatling response time test..." -ForegroundColor Cyan
Write-Host "Test title: responsetime-$Stamp"
Write-Host "Load model: closed, $LoadPercent% of saturation point ($SaturationUsers VU) = $Users concurrent users"
Write-Host "            ramp-up: $StartUsers -> $Users users in $RampUpSec s"
Write-Host "            steady state: $Users users for $TestHoldSec s ($([math]::Round($TestHoldSec / 60, 1)) min)"
Write-Host "Total duration: $([math]::Round($TotalSec / 60, 1)) minutes (without Maven startup and session drain)"
Write-Host "Approximate steady-state window: $($SteadyFrom.ToString('HH:mm:ss')) - $($ExpectedEnd.ToString('HH:mm:ss')) (exact times are printed by the simulation: 'STEADY STATE')"
Write-Host "Assertions: $AssertionType (P95 per step, success >= $MinSuccessPct%)"
Write-Host "Early stop on instability: $StopOnInstability"
Write-Host "Results directory: $RunDir"

$ErrorActionPreference = "Continue"
mvn gatling:test `
    "-DtestTitle=responsetime-$Stamp" `
    "-Dgatling.runDescription=responsetime-$Stamp" `
    "-DCLOSED_START_USERS=$StartUsers" `
    "-DCLOSED_USERS=$Users" `
    "-DRAMP_UP_PERIOD=$RampUpSec" `
    "-DTEST_HOLD_SEC=$TestHoldSec" `
    "-DSTEP_TIMEOUT_MS=$ResponseTimeout" `
    "-Dthink_time_center=$ThinkTimeCenter" `
    "-Dthink_time_deviation=$ThinkTimeDeviation" `
    "-Dgatling.socket.connectTimeout=$ConnectTimeout" `
    "-Dgatling.http.requestTimeout=$ResponseTimeout" `
    "-DASSERTION_TYPE=$AssertionType" `
    "-DSUCCESSFUL_REQUESTS_PERCENT=$MinSuccessPct" `
    "-DCAPACITY_MONITOR_ENABLED=$MonitorEnabled" `
    "-DERROR_THRESHOLD_PCT=$ErrorThresholdPct" `
    "-DERROR_WINDOW_SEC=$ErrorWindowSec" `
    "-DINSTABILITY_HOLD_SEC=$InstabilityHoldSec" 2>&1 |
    ForEach-Object { "$_" } |
    Tee-Object -FilePath $ConsoleLog

$GatlingExitCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"

if ($GatlingExitCode -ne 0) {
    Write-Host "Gatling failed with exit code $GatlingExitCode (simulation error or failed assertions: P95 / success rate). See $ConsoleLog" -ForegroundColor Red
    throw "Gatling failed with exit code $GatlingExitCode."
}

Write-Host ""
Write-Host "Response time test completed successfully." -ForegroundColor Green
Write-Host "Console log: $ConsoleLog"
Write-Host "Check target/gatling/ for HTML reports. For steady-state-only statistics use the 'STEADY STATE' window from the console log in Grafana."
