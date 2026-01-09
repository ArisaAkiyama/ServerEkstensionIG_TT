@echo off
title Building Server Launcher EXE
cd /d "%~dp0"

echo ============================================
echo   Building Media Downloader Server Launcher
echo ============================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python from https://www.python.org/
    pause
    exit /b 1
)

:: Check if PyInstaller is installed
pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    echo Installing PyInstaller...
    pip install pyinstaller
)

echo.
echo Building EXE file...
echo.

pyinstaller --onefile --windowed --name "MediaDownloaderServer" --icon=NONE server_launcher.py

echo.
echo ============================================
if exist "dist\MediaDownloaderServer.exe" (
    echo SUCCESS! EXE created at:
    echo   dist\MediaDownloaderServer.exe
    echo.
    echo You can move this file to the main folder.
    copy "dist\MediaDownloaderServer.exe" "MediaDownloaderServer.exe" >nul
    echo Copied to: MediaDownloaderServer.exe
) else (
    echo ERROR: Failed to create EXE
)
echo ============================================
echo.
pause
