[CmdletBinding()]
param(
  [string]$CommitMessage = "Balance enemy damage and fix catapult note drops",
  [switch]$SkipTests
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$remoteUrl = "https://github.com/kirillmalafeev27-ai/Holzhacker.git"
$branch = "claude/game-crash-gameplay-fixes-c7ngcs"
$workspacePath = $PSScriptRoot
$repoPath = Join-Path $workspacePath "_github_upload2"
$safeRepoPath = $repoPath.Replace("\", "/")
$filesToPush = @(
  "package.json",
  "build_first_person_gameplay_assets.py",
  "public/index.html",
  "public/styles.css",
  "public/js/config.js",
  "public/js/fps/config.js",
  "public/js/fps/enemies.js",
  "public/js/fps/fort.js",
  "public/js/fps/guidance.js",
  "public/js/fps/input.js",
  "public/js/fps/learning-system.js",
  "public/js/fps/main.js",
  "public/js/fps/notes.js",
  "public/js/fps/player.js",
  "public/js/fps/projectiles.js",
  "public/js/fps/tower.js",
  "public/js/fps/ui.js",
  "tests/first_person.logic.test.mjs",
  "push-gameplay-fixes.ps1"
)

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArguments)

  & git -c "safe.directory=$safeRepoPath" -C $repoPath @GitArguments
  if ($LASTEXITCODE -ne 0) {
    throw "Git command failed: git $($GitArguments -join ' ')"
  }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is not installed or is unavailable in PATH."
}

if (-not $SkipTests) {
  Write-Host "Running project tests..." -ForegroundColor Cyan
  Push-Location $workspacePath
  try {
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw "npm test failed; push cancelled." }

    & npm.cmd run check
    if ($LASTEXITCODE -ne 0) { throw "npm run check failed; push cancelled." }
  }
  finally {
    Pop-Location
  }
}

if (-not (Test-Path -LiteralPath (Join-Path $repoPath ".git"))) {
  Write-Host "Cloning the target branch..." -ForegroundColor Cyan
  & git clone --branch $branch --single-branch $remoteUrl $repoPath
  if ($LASTEXITCODE -ne 0) { throw "Unable to clone $remoteUrl." }
}

$originUrl = (Invoke-Git remote get-url origin | Select-Object -Last 1).Trim()
if ($originUrl -ne $remoteUrl) {
  throw "Unexpected origin URL: $originUrl"
}

$dirtyFiles = @(Invoke-Git status --porcelain)
if ($dirtyFiles.Count -gt 0) {
  $dirtyPaths = @($dirtyFiles | ForEach-Object {
    $path = $_.Substring(3).Trim('"')
    if ($path -like "* -> *") { $path = ($path -split " -> ")[-1] }
    $path.Replace("\", "/")
  })
  $unexpectedPaths = @($dirtyPaths | Where-Object { $filesToPush -notcontains $_ })
  if ($unexpectedPaths.Count -gt 0) {
    throw "The upload repository contains unrelated changes: $($unexpectedPaths -join ', ')"
  }
  Write-Host "Resuming the previous copy attempt..." -ForegroundColor Yellow
}

if ($dirtyFiles.Count -eq 0) {
  Write-Host "Updating $branch..." -ForegroundColor Cyan
  Invoke-Git fetch origin $branch
  $localBranch = @(Invoke-Git branch --list $branch)
  if ($localBranch.Count -eq 0) {
    Invoke-Git checkout -b $branch --track "origin/$branch"
  }
  else {
    Invoke-Git checkout $branch
  }
  Invoke-Git pull --ff-only origin $branch
}

Write-Host "Copying gameplay fixes..." -ForegroundColor Cyan
foreach ($relativePath in $filesToPush) {
  $sourcePath = Join-Path $workspacePath $relativePath
  if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
    throw "Required source file is missing: $sourcePath"
  }

  $targetPath = Join-Path $repoPath $relativePath
  $targetDirectory = Split-Path -Parent $targetPath
  if (-not (Test-Path -LiteralPath $targetDirectory)) {
    New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
  }
  Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
}

$addArguments = @("add", "--") + $filesToPush
Invoke-Git @addArguments
Invoke-Git diff --cached --check
$diffArguments = @("diff", "--cached", "--name-only", "--") + $filesToPush
$stagedFiles = @(Invoke-Git @diffArguments)
if ($stagedFiles.Count -eq 0) {
  Write-Host "Nothing to push: the target branch already contains these changes." -ForegroundColor Yellow
  return
}

Write-Host "Files to commit:" -ForegroundColor Cyan
$stagedFiles | ForEach-Object { Write-Host "  $_" }
Invoke-Git commit -m $CommitMessage
Invoke-Git push origin "HEAD:refs/heads/$branch"

Write-Host "Push completed successfully:" -ForegroundColor Green
Write-Host "https://github.com/kirillmalafeev27-ai/Holzhacker/tree/$branch"
