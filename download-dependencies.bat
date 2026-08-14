@echo off
setlocal EnableExtensions

set "MTR_SILENT=0"
if /I "%SILENT%"=="1" set "MTR_SILENT=1"

:parse_args
if "%~1"=="" goto validate
if /I "%~1"=="/s" (
    set "MTR_SILENT=1"
) else if /I "%~1"=="--silent" (
    set "MTR_SILENT=1"
) else (
    echo ERROR: Unsupported argument "%~1". Use /s or --silent.
    exit /b 64
)
shift
goto parse_args

:validate
if "%MTR_SILENT%"=="0" echo Validating the foundation dependency declarations...

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference = 'Stop';" ^
    "$root = [IO.Path]::GetFullPath('%~dp0');" ^
    "$manifest = Get-Content -Raw -LiteralPath (Join-Path $root 'dependency-manifest.json') | ConvertFrom-Json;" ^
    "if ($manifest.schemaVersion -ne 1 -or $manifest.status -ne 'foundation-only') { throw 'dependency-manifest.json does not describe the supported foundation schema.' };" ^
    "foreach ($field in @('toolchains', 'binaries', 'dependencies')) { if (@($manifest.$field).Count -ne 0) { throw ('dependency-manifest.json declares ' + $field + '; fetching is not implemented yet.') } };" ^
    "$packageFiles = @('package.json', 'apps/desktop/package.json', 'apps/site/package.json', 'packages/tax-domain/package.json', 'packages/cra-pdf/package.json');" ^
    "foreach ($relativePath in $packageFiles) { $package = Get-Content -Raw -LiteralPath (Join-Path $root $relativePath) | ConvertFrom-Json; foreach ($field in @('dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies')) { $value = $package.$field; if ($null -ne $value -and @($value.PSObject.Properties).Count -ne 0) { throw ($relativePath + ' declares ' + $field + '; fetching is not implemented yet.') } } };" ^
    "$lock = Get-Content -Raw -LiteralPath (Join-Path $root 'package-lock.json') | ConvertFrom-Json;" ^
    "if ($lock.lockfileVersion -ne 3) { throw 'package-lock.json must use lockfileVersion 3.' };" ^
    "foreach ($entry in $lock.packages.PSObject.Properties) { foreach ($field in @('dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies')) { $value = $entry.Value.$field; if ($null -ne $value -and @($value.PSObject.Properties).Count -ne 0) { throw ('package-lock.json entry ' + $entry.Name + ' declares ' + $field + '; fetching is not implemented yet.') } } }"

if errorlevel 1 (
    echo ERROR: Dependency validation failed. No files were downloaded.
    exit /b 1
)

echo Dependency bootstrap complete: this foundation declares no dependencies, so nothing was downloaded.
exit /b 0
