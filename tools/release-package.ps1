param(
  [string]$OutputPath = "site-connect-release.zip"
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$output = [System.IO.Path]::GetFullPath((Join-Path $root $OutputPath))
if (-not $output.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Output must stay inside the workspace."
}

$include = @(
  "android", "public", "src", "supabase", "tools",
  ".env.example", ".gitignore", "capacitor.config.ts", "eslint.config.js",
  "index.html", "package.json", "package-lock.json", "postcss.config.js",
  "README.md", "tailwind.config.ts", "tsconfig.app.json", "tsconfig.json",
  "tsconfig.node.json", "vercel.json", "vite.config.ts", "vitest.config.ts"
)
$staging = Join-Path $env:TEMP ("site-connect-release-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $staging | Out-Null
try {
  foreach ($entry in $include) {
    $source = Join-Path $root $entry
    if (Test-Path -LiteralPath $source) {
      if ((Get-Item -LiteralPath $source) -is [System.IO.DirectoryInfo]) {
        $destination = Join-Path $staging $entry
        New-Item -ItemType Directory -Path $destination -Force | Out-Null
        & robocopy $source $destination /E /NFL /NDL /NJH /NJS /NP /XD node_modules dist build .gradle .git .temp /XF *.log *.tmp .env.local .env.production | Out-Null
        if ($LASTEXITCODE -ge 8) { throw "Unable to copy release directory: $entry" }
      } else {
        Copy-Item -LiteralPath $source -Destination $staging
      }
    }
  }
  Get-ChildItem -LiteralPath $staging -Recurse -Force | Where-Object {
    $_.Name -in @(".git", "node_modules", "dist", ".env.local", ".env.production") -or
    $_.Name -match "\.(log|tmp)$"
  } | Sort-Object FullName -Descending | Remove-Item -Recurse -Force
  if (Test-Path -LiteralPath $output) { Remove-Item -LiteralPath $output -Force }
  Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $output -CompressionLevel Optimal
  Write-Output $output
} finally {
  if ((Test-Path -LiteralPath $staging) -and $staging.StartsWith($env:TEMP, [System.StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $staging -Recurse -Force
  }
}
