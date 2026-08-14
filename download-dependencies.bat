@echo off
setlocal EnableExtensions

set "MTR_SILENT=0"
if /I "%SILENT%"=="1" set "MTR_SILENT=1"

:parse_args
if "%~1"=="" goto run
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

:run
set "MTR_SILENT_ARG="
if "%MTR_SILENT%"=="1" set "MTR_SILENT_ARG=-Silent"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\release\download-dependencies.ps1" %MTR_SILENT_ARG%
set "MTR_EXIT=%ERRORLEVEL%"
if not "%MTR_EXIT%"=="0" echo ERROR: Dependency bootstrap failed with exit code %MTR_EXIT%.
exit /b %MTR_EXIT%
