@echo off
setlocal
title Virtual Avatar Media Server
cd /d "%~dp0"

echo [Virtual Avatar] Starting...

:: ====== Find Python 3.10+ ======
set PYTHON_CMD=

:: Try py launcher first
where py >nul 2>&1
if not errorlevel 1 (
    for %%v in (3.13 3.12 3.11 3.10) do (
        if not defined PYTHON_CMD (
            py -%%v --version >nul 2>&1
            if not errorlevel 1 set PYTHON_CMD=py -%%v
        )
    )
)

:: Fallback: plain python
if not defined PYTHON_CMD (
    where python >nul 2>&1
    if not errorlevel 1 (
        python -c "import sys; exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>&1
        if not errorlevel 1 set PYTHON_CMD=python
    )
)

if not defined PYTHON_CMD (
    echo [ERROR] Python 3.10+ not found.
    echo Please install from: https://www.python.org/downloads/
    echo Make sure to check "Add to PATH" during installation.
    pause
    exit /b 1
)

echo [OK] Using %PYTHON_CMD%

:: ====== Python venv ======
if not exist "python\venv" (
    echo [Setup] Creating virtual environment...
    %PYTHON_CMD% -m venv python\venv
    if errorlevel 1 (
        echo [ERROR] Failed to create venv.
        pause
        exit /b 1
    )
)

echo [Setup] Checking Python dependencies...
python\venv\Scripts\pip install -q -r python\requirements.txt
if errorlevel 1 (
    echo [ERROR] pip install failed. Check requirements.txt.
    pause
    exit /b 1
)

:: ====== Node.js deps ======
if not exist "node_modules" (
    echo [Setup] Installing Node.js dependencies...
    call npm install --silent
)

:: ====== Start services ======
echo [OK] Starting services...
echo [Note] First run will download TTS models (~300MB), please wait.

start "Virtual Avatar - Python (8081)" python\venv\Scripts\python python\server.py
timeout /t 3 /nobreak > nul
start "Virtual Avatar - Node (8080)" node src/index.js

echo.
echo  Virtual Avatar is running!
echo   Node   ^> http://localhost:8080
echo   Python ^> http://localhost:8081
echo.
echo  Close both windows to stop the services.
