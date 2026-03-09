@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Virtual Avatar Media Server
cd /d "%~dp0"

echo [Virtual Avatar] Checking environment...

:: ====== Find Python 3.10+ (prefer newer) ======
set PYTHON_CMD=

where py >nul 2>&1
if not errorlevel 1 (
    for %%v in (3.13 3.12 3.11 3.10) do (
        if not defined PYTHON_CMD (
            py -%%v --version >nul 2>&1
            if not errorlevel 1 set PYTHON_CMD=py -%%v
        )
    )
)

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

echo [Virtual Avatar] Using Python command: %PYTHON_CMD%

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

set VENV_PY=python\venv\Scripts\python.exe
if not exist "%VENV_PY%" (
    echo [ERROR] venv python not found: %VENV_PY%
    pause
    exit /b 1
)

:: ====== Install/Fix Dependencies ======
echo [Setup] Upgrading pip tooling...
%VENV_PY% -m pip install -q --upgrade pip setuptools wheel
if errorlevel 1 goto :pip_fail

echo [Setup] Installing Python dependencies...
%VENV_PY% -m pip install -q -r python\requirements.txt
if errorlevel 1 goto :pip_fail

:: ====== GPU PyTorch bootstrap ======
echo [Setup] Reinstalling GPU PyTorch...
%VENV_PY% -m pip uninstall -y torch torchaudio torchvision torchcodec >nul 2>&1

set TORCH_OK=
for %%I in (
    https://download.pytorch.org/whl/cu128
    https://download.pytorch.org/whl/cu126
    https://download.pytorch.org/whl/cu124
    https://download.pytorch.org/whl/cu121
) do (
    if not defined TORCH_OK (
        echo [Setup] Trying PyTorch index: %%I
        %VENV_PY% -m pip install -q --no-cache-dir --force-reinstall torch torchaudio torchvision --index-url %%I
        if not errorlevel 1 (
            %VENV_PY% -c "import sys, torch; print('[Torch]', torch.__version__); print('[CUDA]', torch.version.cuda); ok=torch.cuda.is_available() and '+cpu' not in torch.__version__; sys.exit(0 if ok else 1)"
            if not errorlevel 1 (
                set TORCH_OK=1
                set TORCH_INDEX=%%I
            ) else (
                echo [Setup] Installed torch is not a usable GPU build, retrying...
                %VENV_PY% -m pip uninstall -y torch torchaudio torchvision torchcodec >nul 2>&1
            )
        )
    )
)

if not defined TORCH_OK (
    echo [ERROR] Failed to install a usable GPU PyTorch build automatically.
    echo [ERROR] start.bat will stop here instead of launching a broken server.
    echo [HINT] Check NVIDIA driver / CUDA support on this machine.
    pause
    exit /b 1
)

echo [Setup] Selected PyTorch index: %TORCH_INDEX%

:: ====== Optional Windows dependencies ======
where espeak-ng >nul 2>&1
if errorlevel 1 (
    echo [Setup] espeak-ng not found, installing...
    winget install -e --id eSpeak.eSpeak-NG --silent
)

:: ====== Node.js setup ======
if not exist "node_modules" (
    echo [Setup] Installing Node.js dependencies...
    call npm install --silent
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

:: ====== Start services ======
echo [OK] Starting services...
echo [Note] First run may download F5-TTS / Whisper models, so Python 視窗短時間沒反應是正常的。

start "Virtual Avatar - Python (8081)" %VENV_PY% -u python\server.py
timeout /t 3 /nobreak > nul
start "Virtual Avatar - Node (8080)" node src/index.js

echo.
echo  Virtual Avatar is running!
echo   Node   ^> http://localhost:8080
echo   Python ^> http://localhost:8081
echo.
echo  Close both windows to stop the services.
exit /b 0

:pip_fail
echo [ERROR] pip install failed.
pause
exit /b 1
