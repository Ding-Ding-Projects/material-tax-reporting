@echo off
setlocal EnableExtensions

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
    call "%~dp0download-dependencies.bat" /s
) else (
    call "%~dp0download-dependencies.bat"
)
if errorlevel 1 exit /b %ERRORLEVEL%

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\release\invoke-build.ps1" -Mode Application %MTR_SILENT_ARG%
set "MTR_EXIT=%ERRORLEVEL%"
if not "%MTR_EXIT%"=="0" exit /b %MTR_EXIT%

if "%MTR_SILENT%"=="1" exit /b 0
set "MTR_RUN="
set /p "MTR_RUN=Run the built desktop application now? [y/N] "
if /I not "%MTR_RUN%"=="Y" exit /b 0
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\release\invoke-build.ps1" -Mode Run
exit /b %ERRORLEVEL%
