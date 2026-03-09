@echo off
setlocal
title Virtual Avatar Media Server
cd /d "%~dp0"

echo [Virtual Avatar] Checking environment...

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
    echo [ERROR] Python 3.10+ not found. Download here:
    echo https://www.python.org/downloads/
    pause
    exit /b 1
)

:: ====== Python venv setup ======
if not exist "python\venv" (
    echo [Setup] Creating virtual environment...
    %PYTHON_CMD% -m venv python\venv
    if errorlevel 1 (
        echo [ERROR] Failed to create venv.
        pause
        exit /b 1
    )
)

:: ====== Install/Fix Dependencies ======
:: 1. General requirements
echo [Setup] Installing/Fixing dependencies (this might take a moment)...
python\venv\Scripts\pip install -q -r python\requirements.txt

:: 2. Force CUDA-enabled PyTorch (this guarantees GPU works)
echo [Setup] Ensuring CUDA-enabled PyTorch...
python\venv\Scripts\pip install -q torch torchaudio --index-url https://download.pytorch.org/whl/cu121

:: 3. espeak-ng for Windows (required for Kokoro/G2P)
where espeak-ng >nul 2>&1
if errorlevel 1 (
    echo [Setup] espeak-ng not found, installing...
    winget install -e --id eSpeak.eSpeak-NG --silent
)

:: ====== Node.js setup ======
if not exist "node_modules" (
    echo [Setup] Installing Node.js dependencies...
    call npm install --silent
)

:: ====== Start services ======
echo [OK] Starting services...
echo [Note] First run may download F5-TTS / Whisper models, so Python 視窗短時間沒反應是正常的。

start "Virtual Avatar - Python (8081)" python\venv\Scripts\python -u python\server.py
timeout /t 3 /nobreak > nul
start "Virtual Avatar - Node (8080)" node src/index.js

echo.
echo  Virtual Avatar is running!
echo   Node   ^> http://localhost:8080
echo   Python ^> http://localhost:8081
echo.
echo  Close both windows to stop the services.
