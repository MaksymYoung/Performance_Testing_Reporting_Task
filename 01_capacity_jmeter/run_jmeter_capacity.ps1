$ErrorActionPreference = "Stop"
$ProjectDir = (Get-Location).Path
$Stamp      = Get-Date -Format "yyyyMMdd-HHmm"
$RunDir     = Join-Path $ProjectDir "CapacityTest_$Stamp"
$ReportDir  = Join-Path $RunDir "report"

$Users              = 200     
                              
$RampUpSec          = 2100    
$TestHoldSec        = 1800   
$ShutdownSec        = 10      

$Users2             = 400     
$Ramp2Sec           = 6000   

$TtMin              = 2000
$TtMax              = 5000
$ThinkTimeCenter    = ($TtMin + $TtMax) / 2       
$ThinkTimeDeviation = ($TtMax - $TtMin) / 2       
$ConnectTimeout     = 5000
$ResponseTimeout    = 10000                         
$FailedIterationPauseMs = 3500                     
$App                = "localhost"

$ErrorThresholdPct  = 10
$ErrorWindowSec     = 60
$InstabilityHoldSec = 180
$ErrorMinSamples    = 50

$JMeter               = Join-Path $env:JMETER_HOME "bin\jmeter.bat"
$JmxFile              = Join-Path $ProjectDir "PerformanceEssentials.jmx"
$InstabilityGuardFile = Join-Path $ProjectDir "capacity_instability_guard.groovy"
$SecretsFile          = Join-Path $ProjectDir "secrets.properties"
$ResultsFile          = Join-Path $RunDir "results.jtl"
$LogFile              = Join-Path $RunDir "jmeter.log"
$ConsoleLog           = Join-Path $RunDir "console.log"

if (-not $env:JMETER_HOME)                    { throw "JMETER_HOME is not set." }
if (-not (Test-Path $JMeter))                 { throw "JMeter executable not found: $JMeter" }
if (-not (Test-Path $JmxFile))                { throw "JMX file not found: $JmxFile" }
if (-not (Test-Path $InstabilityGuardFile))   { throw "Instability guard script not found: $InstabilityGuardFile" }
if (-not (Test-Path $SecretsFile))            { throw "Properties file not found: $SecretsFile" }

$Stage2On = ($Users2 -gt $Users) -and ($Ramp2Sec -gt 0)
if (-not $Stage2On) { $Users2 = 0; $Ramp2Sec = 0 }

New-Item -ItemType Directory -Path $RunDir -Force | Out-Null

$env:JVM_ARGS = "-Xms4g -Xmx8g -javaagent:C:\Monitoring\jolokia-agent.jar=host=127.0.0.1,port=8778"

Write-Host "Starting JMeter capacity test..." -ForegroundColor Cyan
Write-Host "Test title: capacity-$Stamp"
Write-Host "Target application: $App"
Write-Host "Load model: closed, stage 1: 0 -> $Users concurrent users in $RampUpSec s"
if ($Stage2On) { Write-Host "            stage 2: $Users -> $Users2 concurrent users in $Ramp2Sec s" }
Write-Host "            hold at peak: $TestHoldSec s"
Write-Host "Stop trigger: >= $ErrorThresholdPct% errors in a rolling $ErrorWindowSec-second window (min $ErrorMinSamples steps), persisting for $InstabilityHoldSec seconds"
Write-Host "Maximum duration if no trigger: $([math]::Round(($RampUpSec + $Ramp2Sec + $TestHoldSec) / 60, 1)) minutes"
Write-Host "Results directory: $RunDir"

$ErrorActionPreference = "Continue"
& $JMeter `
    -n `
    -t $JmxFile `
    -q $SecretsFile `
    "-Japp=$App" `
    "-Jramp_threads=$Users" `
    "-Jramp_sec=$RampUpSec" `
    "-Jtest_hold_sec=$TestHoldSec" `
    "-Jramp2_users=$Users2" `
    "-Jramp2_sec=$Ramp2Sec" `
    "-Jshutdown_sec=$ShutdownSec" `
    "-Jtt_min=$TtMin" `
    "-Jtt_max=$TtMax" `
    "-Jthink_time_center=$ThinkTimeCenter" `
    "-Jthink_time_deviation=$ThinkTimeDeviation" `
    "-Jconnect_timeout=$ConnectTimeout" `
    "-Jresponse_timeout=$ResponseTimeout" `
    "-Jstep_timeout_ms=$ResponseTimeout" `
    "-Jfailed_iteration_pause_ms=$FailedIterationPauseMs" `
    "-Jerror_threshold_pct=$ErrorThresholdPct" `
    "-Jerror_window_sec=$ErrorWindowSec" `
    "-Jinstability_hold_sec=$InstabilityHoldSec" `
    "-Jerror_min_samples=$ErrorMinSamples" `
    "-Jtest_title=capacity-$Stamp" `
    -l $ResultsFile `
    -j $LogFile `
    -e `
    -o $ReportDir 2>&1 |
    ForEach-Object { "$_" } |
    Tee-Object -FilePath $ConsoleLog

$JMeterExitCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"

if ($JMeterExitCode -ne 0) {
    throw "JMeter failed with exit code $JMeterExitCode. See $ConsoleLog"
}

if (-not (Test-Path $ResultsFile)) {
    throw "Results file not found: $ResultsFile"
}

$ResultsReader = [System.IO.File]::OpenText($ResultsFile)
try {
    $Header = $ResultsReader.ReadLine()
    $FirstSample = $ResultsReader.ReadLine()
}
finally {
    $ResultsReader.Dispose()
}

if ([string]::IsNullOrWhiteSpace($FirstSample)) {
    throw "JMeter completed without samples. See $LogFile and $ConsoleLog"
}

$StoppedByGuard = Select-String -Path $LogFile -Pattern "Stopping load generator" -Quiet

Write-Host ""
Write-Host "Capacity test completed successfully." -ForegroundColor Green
if ($StoppedByGuard) {
    Write-Host "Test was stopped early by the capacity instability guard (see 'Capacity instability detected' in $LogFile)." -ForegroundColor Yellow
}
Write-Host "JMeter exit code: $JMeterExitCode"
Write-Host "Results: $ResultsFile"
Write-Host "JMeter log: $LogFile"
Write-Host "Console log: $ConsoleLog"
Write-Host "HTML report: $ReportDir"
