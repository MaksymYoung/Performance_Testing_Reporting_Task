$ErrorActionPreference = "Stop"
$ProjectDir = (Get-Location).Path
$Stamp      = Get-Date -Format "yyyyMMdd-HHmm"
$RunDir     = Join-Path $ProjectDir "StabilityTest_$Stamp"
$ReportFull   = Join-Path $RunDir "report_full"
$ReportSteady = Join-Path $RunDir "report_steady"

$SaturationUsers    = 160
$LoadFactor         = 0.80
$Users              = [int][math]::Round($SaturationUsers * $LoadFactor)   # = 128
$RampUpSec          = 600
$TestHoldSec        = 14400
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
$HeartbeatSec       = 900

$IntervalMin        = 15
$EdgeIntervals      = 4
$MinSamplesForVerdict = 200
$MaxP95GrowthPct    = 20
$MaxAvgGrowthPct    = 20
$MaxErrorPct        = 1.0
$MaxErrorGrowthPp   = 0.5

# ---- Опції ----
$BuildFullReport    = $false
$MinFreeDiskGB      = 5
$EnableGcLog        = $true
$JolokiaJar         = "C:\Monitoring\jolokia-agent.jar"
$JolokiaPort        = 8778

# ---- Перевірки ----
if (-not $env:JMETER_HOME)                    { throw "JMETER_HOME is not set." }
$JMeter               = Join-Path $env:JMETER_HOME "bin\jmeter.bat"
$JmxFile              = Join-Path $ProjectDir "PerformanceEssentials.jmx"
$InstabilityGuardFile = Join-Path $ProjectDir "capacity_instability_guard.groovy"
$SecretsFile          = Join-Path $ProjectDir "secrets.properties"
$ResultsFile          = Join-Path $RunDir "results.jtl"
$SteadyFile           = Join-Path $RunDir "results_steady.jtl"
$LogFile              = Join-Path $RunDir "jmeter.log"
$ConsoleLog           = Join-Path $RunDir "console.log"
$GcLog                = Join-Path $RunDir "jmeter_gc.log"

if (-not (Test-Path $JMeter))                 { throw "JMeter executable not found: $JMeter" }
if (-not (Test-Path $JmxFile))                { throw "JMX file not found: $JmxFile" }
if (-not (Test-Path $InstabilityGuardFile))   { throw "Instability guard script not found: $InstabilityGuardFile" }
if (-not (Test-Path $SecretsFile))            { throw "Properties file not found: $SecretsFile" }

$FreeGB = $null
try {
    $Drive = Get-PSDrive -Name ((Get-Item $ProjectDir).PSDrive.Name)
    $FreeGB = [math]::Round($Drive.Free / 1GB, 1)
} catch {
    Write-Host "WARNING: could not determine free disk space (network path?)." -ForegroundColor Yellow
}
if ($null -ne $FreeGB -and $FreeGB -lt $MinFreeDiskGB) { throw "Not enough free disk space: $FreeGB GB (need >= $MinFreeDiskGB GB)." }

New-Item -ItemType Directory -Path $RunDir -Force | Out-Null

$JvmArgs = "-Xms4g -Xmx8g -XX:+UseG1GC -XX:MaxGCPauseMillis=200"
if ($EnableGcLog) {
    $JvmArgs += " -Xlog:gc*:file=`"$GcLog`":time,uptime:filecount=5,filesize=20m"
}
if (Test-Path $JolokiaJar) {
    $JvmArgs += " -javaagent:$JolokiaJar=host=127.0.0.1,port=$JolokiaPort"
} else {
    Write-Host "WARNING: Jolokia agent not found ($JolokiaJar) - JVM metrics via Jolokia will be unavailable." -ForegroundColor Yellow
}
$env:JVM_ARGS = $JvmArgs

try {
    Add-Type -Namespace Win32 -Name Power -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("kernel32.dll")]
public static extern uint SetThreadExecutionState(uint esFlags);
'@
    [void][Win32.Power]::SetThreadExecutionState([uint32]2147483649)
} catch {
    Write-Host "WARNING: could not disable system sleep: $($_.Exception.Message)" -ForegroundColor Yellow
}

$TotalSec = $RampUpSec + $TestHoldSec + $ShutdownSec
Write-Host "Starting JMeter stability (soak) test..." -ForegroundColor Cyan
Write-Host "Test title: soak-$Stamp"
Write-Host "Target application: $App"
Write-Host "Load model: closed, 0 -> $Users VU in $RampUpSec s, then stable hold at $Users VU for $TestHoldSec s ($([math]::Round($TestHoldSec / 3600, 2)) h; $([int]($LoadFactor*100))% of $SaturationUsers VU)"
Write-Host "Instability guard: observe-only = $(-not [bool]::Parse($StopOnInstability))"
Write-Host "Expected duration: $([math]::Round($TotalSec / 60, 1)) minutes (finish around $((Get-Date).AddSeconds($TotalSec).ToString('yyyy-MM-dd HH:mm')))"
Write-Host "Free disk: $FreeGB GB"
Write-Host "Results directory: $RunDir"

$JMeterArgs = @(
    "-n",
    "-t", $JmxFile,
    "-q", $SecretsFile,
    "-Japp=$App",
    "-Jramp_threads=$Users",
    "-Jramp_sec=$RampUpSec",
    "-Jtest_hold_sec=$TestHoldSec",
    "-Jshutdown_sec=$ShutdownSec",
    "-Jtt_min=$TtMin",
    "-Jtt_max=$TtMax",
    "-Jthink_time_center=$ThinkTimeCenter",
    "-Jthink_time_deviation=$ThinkTimeDeviation",
    "-Jconnect_timeout=$ConnectTimeout",
    "-Jresponse_timeout=$ResponseTimeout",
    "-Jstep_timeout_ms=$ResponseTimeout",
    "-Jfailed_iteration_pause_ms=$FailedIterationPauseMs",
    "-Jerror_threshold_pct=$ErrorThresholdPct",
    "-Jerror_window_sec=$ErrorWindowSec",
    "-Jinstability_hold_sec=$InstabilityHoldSec",
    "-Jerror_min_samples=$ErrorMinSamples",
    "-Jcapacity_stop_enabled=$StopOnInstability",
    "-Jheartbeat_sec=$HeartbeatSec",
    "-Jsummariser.interval=60",
    "-Jtest_title=soak-$Stamp",
    "-l", $ResultsFile,
    "-j", $LogFile
)
if ($BuildFullReport) {
    $JMeterArgs += @("-e", "-o", $ReportFull)
}

$ErrorActionPreference = "Continue"
& $JMeter @JMeterArgs 2>&1 |
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

Write-Host "Building steady-state HTML report ($Kept of $Total samples)..." -ForegroundColor Cyan
$env:JVM_ARGS = "-Xms2g -Xmx8g -XX:+UseG1GC"      # без Jolokia: окремий процес лише будує звіт
$ErrorActionPreference = "Continue"
& $JMeter -g $SteadyFile -o $ReportSteady "-Jjmeter.reportgenerator.overall_granularity=60000" 2>&1 |
    ForEach-Object { "$_" } | Tee-Object -FilePath $ConsoleLog -Append
$ReportExit = $LASTEXITCODE
$ErrorActionPreference = "Stop"
if ($ReportExit -ne 0) { throw "Steady-state report generation failed with exit code $ReportExit. See $ConsoleLog" }

function Get-Pct($Sorted, [double]$P) {
    if ($Sorted.Count -eq 0) { return 0 }
    $Idx = [math]::Min($Sorted.Count - 1, [int][math]::Ceiling($P / 100.0 * $Sorted.Count) - 1)
    return $Sorted[[math]::Max(0, $Idx)]
}

function Get-Stats($Values, [int]$Errors) {
    $N = $Values.Count
    if ($N -eq 0) { return [pscustomobject]@{ Count = 0; Err_pct = 0.0; Avg_ms = 0; P90_ms = 0; P95_ms = 0; P99_ms = 0; Max_ms = 0 } }
    $Arr = $Values.ToArray()
    [array]::Sort($Arr)
    $Sum = 0.0
    foreach ($V in $Arr) { $Sum += $V }
    [pscustomobject]@{
        Count   = $N
        Err_pct = [math]::Round($Errors * 100.0 / $N, 2)
        Avg_ms  = [math]::Round($Sum / $N, 0)
        P90_ms  = Get-Pct $Arr 90
        P95_ms  = Get-Pct $Arr 95
        P99_ms  = Get-Pct $Arr 99
        Max_ms  = $Arr[$Arr.Length - 1]
    }
}

Write-Host "Analyzing stability trend (streaming pass over steady-state samples)..." -ForegroundColor Cyan
$IntervalMs  = $IntervalMin * 60 * 1000L
$IntervalCnt = [int][math]::Ceiling($TestHoldSec * 1000.0 / $IntervalMs)
$Lists  = @{}
$Errs   = @{}
$Labels = New-Object 'System.Collections.Generic.HashSet[string]'

Import-Csv -Path $SteadyFile | ForEach-Object {
    $Ts = 0L
    if (-not [long]::TryParse($_.timeStamp, [ref]$Ts)) { return }
    $Idx = [int][math]::Floor(($Ts - $SteadyStart) / $IntervalMs)
    if ($Idx -lt 0) { return }
    if ($Idx -ge $IntervalCnt) { $Idx = $IntervalCnt - 1 }
    $El = [int]$_.elapsed
    $IsErr = if ($_.success -ne 'true') { 1 } else { 0 }
    foreach ($Lbl in @($_.label, 'ALL')) {
        $Key = "$Lbl|$Idx"
        if (-not $Lists.ContainsKey($Key)) {
            $Lists[$Key] = New-Object 'System.Collections.Generic.List[int]'
            $Errs[$Key]  = 0
        }
        $Lists[$Key].Add($El)
        $Errs[$Key] += $IsErr
        [void]$Labels.Add($Lbl)
    }
}

$LabelList = @($Labels | Where-Object { $_ -ne 'ALL' } | Sort-Object) + @('ALL')

function Merge-Intervals([string]$Label, [int[]]$Indexes) {
    $All = New-Object 'System.Collections.Generic.List[int]'
    $E = 0
    foreach ($I in $Indexes) {
        $Key = "$Label|$I"
        if ($Lists.ContainsKey($Key)) { $All.AddRange($Lists[$Key]); $E += $Errs[$Key] }
    }
    return @{ Values = $All; Errors = $E }
}

$AllIdx = 0..($IntervalCnt - 1)
$Summary = foreach ($Lbl in $LabelList) {
    $M = Merge-Intervals $Lbl $AllIdx
    $S = Get-Stats $M.Values $M.Errors
    [pscustomobject]@{ Label = $Lbl; Count = $S.Count; Err_pct = $S.Err_pct; Avg_ms = $S.Avg_ms
                       P90_ms = $S.P90_ms; P95_ms = $S.P95_ms; P99_ms = $S.P99_ms; Max_ms = $S.Max_ms }
}
$SummaryFile = Join-Path $RunDir "steady_summary.csv"
$Summary | Export-Csv -Path $SummaryFile -NoTypeInformation -Encoding UTF8

# --- Тренд по інтервалах ---
$Trend = foreach ($Lbl in $LabelList) {
    for ($I = 0; $I -lt $IntervalCnt; $I++) {
        $Key = "$Lbl|$I"
        if (-not $Lists.ContainsKey($Key)) { continue }
        $S = Get-Stats $Lists[$Key] $Errs[$Key]
        [pscustomobject]@{
            Label         = $Lbl
            Interval      = $I + 1
            StartMin      = $I * $IntervalMin
            Count         = $S.Count
            Throughput_s  = [math]::Round($S.Count / ($IntervalMin * 60.0), 2)
            Err_pct       = $S.Err_pct
            Avg_ms        = $S.Avg_ms
            P95_ms        = $S.P95_ms
            P99_ms        = $S.P99_ms
        }
    }
}
$TrendFile = Join-Path $RunDir "soak_trend.csv"
$Trend | Export-Csv -Path $TrendFile -NoTypeInformation -Encoding UTF8

function Get-SlopePerHour($Points) {
    $N = $Points.Count
    if ($N -lt 3) { return 0.0 }
    $Sx = 0.0; $Sy = 0.0; $Sxx = 0.0; $Sxy = 0.0
    foreach ($P in $Points) { $Sx += $P.X; $Sy += $P.Y; $Sxx += $P.X * $P.X; $Sxy += $P.X * $P.Y }
    $Den = $N * $Sxx - $Sx * $Sx
    if ([math]::Abs($Den) -lt 1e-9) { return 0.0 }
    return ($N * $Sxy - $Sx * $Sy) / $Den
}

$Edge = [math]::Min($EdgeIntervals, [int][math]::Floor($IntervalCnt / 2))
if ($Edge -lt 1) { $Edge = 1 }
$FirstIdx = 0..($Edge - 1)
$LastIdx  = ($IntervalCnt - $Edge)..($IntervalCnt - 1)

$Verdicts = foreach ($Lbl in $LabelList) {
    $F = Merge-Intervals $Lbl $FirstIdx
    $L = Merge-Intervals $Lbl $LastIdx
    $SF = Get-Stats $F.Values $F.Errors
    $SL = Get-Stats $L.Values $L.Errors
    if ($SF.Count -lt $MinSamplesForVerdict -or $SL.Count -lt $MinSamplesForVerdict) { continue }

    $Pts = @()
    for ($I = 0; $I -lt $IntervalCnt; $I++) {
        $Key = "$Lbl|$I"
        if ($Lists.ContainsKey($Key) -and $Lists[$Key].Count -ge 20) {
            $Sorted = $Lists[$Key].ToArray(); [array]::Sort($Sorted)
            $Pts += @{ X = ($I + 0.5) * $IntervalMin / 60.0; Y = [double](Get-Pct $Sorted 95) }
        }
    }
    $Slope = Get-SlopePerHour $Pts

    $P95Growth = if ($SF.P95_ms -gt 0) { [math]::Round(($SL.P95_ms - $SF.P95_ms) * 100.0 / $SF.P95_ms, 1) } else { 0.0 }
    $AvgGrowth = if ($SF.Avg_ms -gt 0) { [math]::Round(($SL.Avg_ms - $SF.Avg_ms) * 100.0 / $SF.Avg_ms, 1) } else { 0.0 }
    $ErrGrowth = [math]::Round($SL.Err_pct - $SF.Err_pct, 2)

    $Issues = @()
    if ($P95Growth -gt $MaxP95GrowthPct) { $Issues += "p95 +$P95Growth% (> $MaxP95GrowthPct%)" }
    if ($AvgGrowth -gt $MaxAvgGrowthPct) { $Issues += "avg +$AvgGrowth% (> $MaxAvgGrowthPct%)" }
    if ($SL.Err_pct -gt $MaxErrorPct -and $Lbl -eq 'ALL') { $Issues += "errors in last hour $($SL.Err_pct)% (> $MaxErrorPct%)" }
    if ($ErrGrowth -gt $MaxErrorGrowthPp) { $Issues += "errors +$ErrGrowth pp (> $MaxErrorGrowthPp pp)" }

    [pscustomobject]@{
        Label          = $Lbl
        First_Avg_ms   = $SF.Avg_ms
        Last_Avg_ms    = $SL.Avg_ms
        Avg_growth_pct = $AvgGrowth
        First_P95_ms   = $SF.P95_ms
        Last_P95_ms    = $SL.P95_ms
        P95_growth_pct = $P95Growth
        P95_slope_ms_h = [math]::Round($Slope, 1)
        First_Err_pct  = $SF.Err_pct
        Last_Err_pct   = $SL.Err_pct
        Verdict        = if ($Issues.Count -eq 0) { 'STABLE' } else { 'DEGRADATION' }
        Details        = ($Issues -join '; ')
    }
}
$VerdictFile = Join-Path $RunDir "soak_verdict.csv"
$Verdicts | Export-Csv -Path $VerdictFile -NoTypeInformation -Encoding UTF8

$InstabilityEvents = @(Select-String -Path $LogFile -Pattern "Capacity instability detected")
$RecoveryEvents    = @(Select-String -Path $LogFile -Pattern "Error rate recovered")
$StoppedByGuard    = Select-String -Path $LogFile -Pattern "Stopping load generator" -Quiet
$OomInLog          = Select-String -Path $LogFile, $ConsoleLog -Pattern "OutOfMemoryError" -Quiet

try { [void][Win32.Power]::SetThreadExecutionState([uint32]2147483648) } catch { }

$DurationSec = ($SteadyEnd - $SteadyStart) / 1000.0
Write-Host ""
Write-Host "Stability (soak) test completed." -ForegroundColor Green
Write-Host ("Steady-state window: {0} VU, {1} s ({2} h), {3} samples, throughput {4} samples/s" -f $Users, $TestHoldSec, [math]::Round($TestHoldSec / 3600, 2), $Kept, [math]::Round($Kept / $DurationSec, 2))
Write-Host ""
Write-Host "== Summary over the whole 4 h window ==" -ForegroundColor Cyan
$Summary | Format-Table -AutoSize
Write-Host "== First hour vs last hour (stability verdict) ==" -ForegroundColor Cyan
$Verdicts | Format-Table Label, First_Avg_ms, Last_Avg_ms, Avg_growth_pct, First_P95_ms, Last_P95_ms, P95_growth_pct, P95_slope_ms_h, Last_Err_pct, Verdict -AutoSize

$Degraded = @($Verdicts | Where-Object { $_.Verdict -eq 'DEGRADATION' })
if (@($Verdicts).Count -eq 0) {
    Write-Host "RESULT: UNKNOWN - not enough samples in the first/last hour to evaluate stability (need >= $MinSamplesForVerdict per step)." -ForegroundColor Yellow
} elseif ($Degraded.Count -eq 0) {
    Write-Host "RESULT: STABLE - no degradation detected between the first and the last hour." -ForegroundColor Green
} else {
    Write-Host "RESULT: DEGRADATION detected in $($Degraded.Count) step(s):" -ForegroundColor Red
    foreach ($D in $Degraded) { Write-Host ("  - {0}: {1}" -f $D.Label, $D.Details) -ForegroundColor Red }
}
if ($InstabilityEvents.Count -gt 0) {
    Write-Host "WARNING: error rate exceeded $ErrorThresholdPct% in $($InstabilityEvents.Count) episode(s), recovered $($RecoveryEvents.Count) time(s) (see 'Capacity instability detected' in $LogFile). The run may not be valid for steady-state analysis." -ForegroundColor Yellow
}
if ($StoppedByGuard) { Write-Host "WARNING: test was stopped early by the guard - the 4-hour window is incomplete." -ForegroundColor Red }
if ($OomInLog)       { Write-Host "WARNING: OutOfMemoryError found in JMeter logs - the load generator itself ran out of memory, results are not reliable." -ForegroundColor Red }

Write-Host ""
Write-Host "JMeter exit code: $JMeterExitCode"
Write-Host "Results (full):    $ResultsFile"
Write-Host "Results (steady):  $SteadyFile"
Write-Host "Summary CSV:       $SummaryFile"
Write-Host "Trend CSV:         $TrendFile   (по інтервалах $IntervalMin хв, для графіка деградації)"
Write-Host "Verdict CSV:       $VerdictFile"
if ($EnableGcLog) { Write-Host "JMeter GC log:     $GcLog" }
Write-Host "HTML report (steady state, USE THIS): $ReportSteady"
if ($BuildFullReport) { Write-Host "HTML report (full, with ramp-up):     $ReportFull" }
Write-Host "JMeter log: $LogFile"
