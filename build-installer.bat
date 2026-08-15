@echo off
setlocal EnableExtensions
set "MTR_REPO_ROOT=%~dp0"

set "MTR_SILENT=0"
if /I "%SILENT%"=="1" set "MTR_SILENT=1"

:parse_args
if "%~1"=="" goto bootstrap
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

:bootstrap
set "MTR_SILENT_ARG="
if "%MTR_SILENT%"=="1" set "MTR_SILENT_ARG=-Silent"
if "%MTR_SILENT%"=="1" (
    call "%MTR_REPO_ROOT%download-dependencies.bat" /s
) else (
    call "%MTR_REPO_ROOT%download-dependencies.bat"
)
if errorlevel 1 exit /b %ERRORLEVEL%

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%MTR_REPO_ROOT%scripts\release\invoke-build.ps1" -Mode Installer %MTR_SILENT_ARG%
exit /b %ERRORLEVEL%
