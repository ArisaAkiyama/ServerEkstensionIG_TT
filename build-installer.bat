@echo off
title Building Media Downloader Installer
cd /d "%~dp0"

echo ============================================
echo   Building Media Downloader Installer
echo ============================================
echo.

:: Check if Inno Setup is installed
set "ISCC_PATH="

:: Try common installation paths
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" (
    set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
) else if exist "C:\Program Files\Inno Setup 6\ISCC.exe" (
    set "ISCC_PATH=C:\Program Files\Inno Setup 6\ISCC.exe"
) else if exist "C:\Program Files (x86)\Inno Setup 5\ISCC.exe" (
    set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 5\ISCC.exe"
)

if "%ISCC_PATH%"=="" (
    echo ERROR: Inno Setup not found!
    echo.
    echo Please install Inno Setup from:
    echo   https://jrsoftware.org/isdl.php
    echo.
    pause
    exit /b 1
)

echo Found Inno Setup at: %ISCC_PATH%
echo.

:: Create output directory
if not exist "installer_output" mkdir installer_output

:: Build the installer
echo Building installer...
echo.
"%ISCC_PATH%" installer.iss

echo.
echo ============================================
if exist "installer_output\MediaDownloaderSetup.exe" (
    echo SUCCESS! Installer created at:
    echo   installer_output\MediaDownloaderSetup.exe
) else (
    echo ERROR: Failed to create installer
)
echo ============================================
echo.
pause
