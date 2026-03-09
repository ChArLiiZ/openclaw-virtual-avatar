@echo off
setlocal
title Virtual Avatar Media Server
cd /d "%~dp0"

echo [Virtual Avatar] Starting...

:: ====== Find Python 3.12 ======
set PYTHON_CMD=

where py >nul 2>&1
if not errorlevel 1 (
    py -3.12 --version >nul 2>&1
    if not errorlevel 1 (
        set PYTHON_CMD=py -3.12
        goto :found_python
    )
)

where python3.12 >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=python3.12
    goto :found_python
)

echo [ERROR] Python 3.12 not found.
echo Please install from: https://www.python.org/downloads/release/python-31213/
echo Make sure to check "Add to PATH" during installation.
pause
exit /b 1

:found_python
echo [OK] Using %PYTHON_CMD%

:: ====== Python venv ======
if not exist "python\venv" (
    echo [Setup] Creating Python 3.12 virtual environment...
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

start "Virtual Avatar - Python (8081)" python\venv\Scripts\python python\server.py
timeout /t 3 /nobreak > nul
start "Virtual Avatar - Node (8080)" node src/index.js

echo.
echo  Virtual Avatar is running!
echo   Node   ^> http://localhost:8080
echo   Python ^> http://localhost:8081
echo.
echo  Close both windows to stop the services.
