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
if "%MTR_SILENT%"=="0" echo Checking declared dependencies before build discovery...
call "%~dp0download-dependencies.bat" /s
if errorlevel 1 exit /b %errorlevel%

echo ERROR: No runnable application or build script exists in this repository foundation.
echo ERROR: Add and document a real workspace build before this command may report success.
exit /b 2
