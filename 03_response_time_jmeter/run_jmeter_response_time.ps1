$ErrorActionPreference = "Stop"
$ProjectDir = (Get-Location).Path
$Stamp      = Get-Date -Format "yyyyMMdd-HHmm"
$RunDir     = Join-Path $ProjectDir "ResponseTimeTest_$Stamp"
$ReportFull   = Join-Path $RunDir "report_full"
$ReportSteady = Join-Path $RunDir "report_steady"

$SaturationUsers    = 160
$LoadFactor         = 0.80
$Users              = [int][math]::Round($SaturationUsers * $LoadFactor)   # = 128
$RampUpSec          = 600
$TestHoldSec        = 1800
$ShutdownSec        = 10

$TtMin              = 2000
$TtMax              = 5000
$ThinkTimeCenter    = ($TtMin + $TtMax) / 2        # 3500
$ThinkTimeDeviation = ($TtMax - $TtMin) / 2        # 1500
$ConnectTimeout     = 5000
$ResponseTimeout    = 10000
$FailedIterationPauseMs = 3500
$App                = "localhost"

$ErrorThresholdPct  = 10
$ErrorWindowSec     = 60
$InstabilityHoldSec = 180
$ErrorMinSamples    = 50
$StopOnInstability  = "false"

if (-not $env:JMETER_HOME)                    { throw "JMETER_HOME is not set." }
$JMeter               = Join-Path $env:JMETER_HOME "bin\jmeter.bat"
$JmxFile              = Join-Path $ProjectDir "PerformanceEssentials.jmx"
$InstabilityGuardFile = Join-Path $ProjectDir "capacity_instability_guard.groovy"
$SecretsFile          = Join-Path $ProjectDir "secrets.properties"
$ResultsFile          = Join-Path $RunDir "results.jtl"
$SteadyFile           = Join-Path $RunDir "results_steady.jtl"
$LogFile              = Join-Path $RunDir "jmeter.log"
$ConsoleLog           = Join-Path $RunDir "console.log"

if (-not (Test-Path $JMeter))                 { throw "JMeter executable not found: $JMeter" }
if (-not (Test-Path $JmxFile))                { throw "JMX file not found: $JmxFile" }
if (-not (Test-Path $InstabilityGuardFile))   { throw "Instability guard script not found: $InstabilityGuardFile" }
if (-not (Test-Path $SecretsFile))            { throw "Properties file not found: $SecretsFile" }

New-Item -ItemType Directory -Path $RunDir -Force | Out-Null

$env:JVM_ARGS = "-Xms4g -Xmx8g -Djava.net.preferIPv4Stack=true -javaagent:C:\Monitoring\jolokia-agent.jar=host=127.0.0.1,port=8778"

$TotalSec = $RampUpSec + $TestHoldSec + $ShutdownSec
Write-Host "Starting JMeter response time test..." -ForegroundColor Cyan
Write-Host "Test title: responsetime-$Stamp"
Write-Host "Target application: $App"
Write-Host "Load model: closed, 0 -> $Users VU in $RampUpSec s, then stable hold at $Users VU for $TestHoldSec s ($([int]($LoadFactor*100))% of $SaturationUsers VU)"
Write-Host "Instability guard: observe-only = $(-not [bool]::Parse($StopOnInstability))"
Write-Host "Expected duration: $([math]::Round($TotalSec / 60, 1)) minutes"
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
    "-Jcapacity_stop_enabled=$StopOnInstability" `
    "-Jtest_title=responsetime-$Stamp" `
    -l $ResultsFile `
    -j $LogFile `
    -e `
    -o $ReportFull 2>&1 |
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

$Reader = [System.IO.File]::OpenText($ResultsFile)
$Writer = New-Object System.IO.StreamWriter($SteadyFile, $false, (New-Object System.Text.UTF8Encoding($false)))
$Header = $null; $FirstTs = 0L; $SteadyStart = 0L; $SteadyEnd = 0L; $Keep = $false; $Total = 0; $Kept = 0
try {
    $Header = $Reader.ReadLine()
    if ([string]::IsNullOrWhiteSpace($Header)) { throw "results.jtl is empty. See $LogFile and $ConsoleLog" }
    $Writer.WriteLine($Header)
    while ($null -ne ($Line = $Reader.ReadLine())) {
        $Comma = $Line.IndexOf(',')
        $Ts = 0L
        if ($Comma -gt 0 -and [long]::TryParse($Line.Substring(0, $Comma), [ref]$Ts)) {
            $Total++
            if ($FirstTs -eq 0L) {
                $FirstTs     = $Ts
                $SteadyStart = $FirstTs + $RampUpSec * 1000L
                $SteadyEnd   = $SteadyStart + $TestHoldSec * 1000L
            }
            $Keep = ($Ts -ge $SteadyStart -and $Ts -lt $SteadyEnd)
            if ($Keep) { $Kept++ }
        }
        if ($Keep) { $Writer.WriteLine($Line) }
    }
}
finally {
    $Reader.Dispose()
    $Writer.Dispose()
}

if ($Total -eq 0) { throw "JMeter completed without samples. See $LogFile and $ConsoleLog" }
if ($Kept -eq 0)  { throw "No samples in the steady-state window (test stopped before ramp-up finished?). See $LogFile" }

Write-Host "Building steady-state report ($Kept of $Total samples)..." -ForegroundColor Cyan
$ErrorActionPreference = "Continue"
& $JMeter -g $SteadyFile -o $ReportSteady "-Jjmeter.reportgenerator.overall_granularity=30000" 2>&1 |
    ForEach-Object { "$_" } | Tee-Object -FilePath $ConsoleLog -Append
$ReportExit = $LASTEXITCODE
$ErrorActionPreference = "Stop"
if ($ReportExit -ne 0) { throw "Steady-state report generation failed with exit code $ReportExit. See $ConsoleLog" }

$Rows = Import-Csv -Path $SteadyFile
$DurationSec = ($SteadyEnd - $SteadyStart) / 1000.0
function Get-Pct($Sorted, [double]$P) {
    if ($Sorted.Count -eq 0) { return 0 }
    $Idx = [math]::Min($Sorted.Count - 1, [int][math]::Ceiling($P / 100.0 * $Sorted.Count) - 1)
    return $Sorted[[math]::Max(0, $Idx)]
}
$Summary = $Rows | Group-Object label | Sort-Object Name | ForEach-Object {
    $El  = @($_.Group | ForEach-Object { [double]$_.elapsed } | Sort-Object)
    $Err = @($_.Group | Where-Object { $_.success -ne 'true' }).Count
    [pscustomobject]@{
        Label  = $_.Name
        Count  = $_.Count
        Err_pct = [math]::Round($Err * 100.0 / $_.Count, 2)
        Avg_ms = [math]::Round(($El | Measure-Object -Average).Average, 0)
        P90_ms = Get-Pct $El 90
        P95_ms = Get-Pct $El 95
        P99_ms = Get-Pct $El 99
        Max_ms = $El[-1]
    }
}
$SummaryFile = Join-Path $RunDir "steady_summary.csv"
$Summary | Export-Csv -Path $SummaryFile -NoTypeInformation -Encoding UTF8

$GuardNote = Select-String -Path $LogFile -Pattern "Capacity instability detected" -Quiet
$StoppedByGuard = Select-String -Path $LogFile -Pattern "Stopping load generator" -Quiet

Write-Host ""
Write-Host "Response time test completed." -ForegroundColor Green
Write-Host ("Steady-state window: {0} VU, {1} s, {2} samples, throughput {3} samples/s" -f $Users, $TestHoldSec, $Kept, [math]::Round($Kept / $DurationSec, 2))
$Summary | Format-Table -AutoSize
if ($GuardNote)      { Write-Host "WARNING: error rate exceeded $ErrorThresholdPct% at some point (see 'Capacity instability detected' in $LogFile). Check validity of the run." -ForegroundColor Yellow }
if ($StoppedByGuard) { Write-Host "WARNING: test was stopped early by the guard - the 30-minute window is incomplete." -ForegroundColor Red }
Write-Host "JMeter exit code: $JMeterExitCode"
Write-Host "Results (full):   $ResultsFile"
Write-Host "Results (steady): $SteadyFile"
Write-Host "Summary CSV:      $SummaryFile"
Write-Host "HTML report (steady state, USE THIS): $ReportSteady"
Write-Host "HTML report (full, with ramp-up):     $ReportFull"
Write-Host "JMeter log: $LogFile"
