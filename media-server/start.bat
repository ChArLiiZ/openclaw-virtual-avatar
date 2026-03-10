@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Virtual Avatar Media Server
cd /d "%~dp0"

echo [Virtual Avatar] Checking conda-based environment...

set "ENV_NAME=openclaw-virtual-avatar"
set "ENV_FILE=%CD%\environment.yml"
set "CONDA_EXE="
set "CONDA_ROOT="

:: ====== Ensure Conda / Miniforge ======
where conda >nul 2>&1
if not errorlevel 1 (
    for /f "delims=" %%C in ('where conda') do (
        set "CONDA_EXE=%%C"
        goto :conda_found
    )
)

echo [Setup] Conda not found. Installing Miniforge3...
winget install -e --id CondaForge.Miniforge3 --silent --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
    echo [ERROR] Failed to install Miniforge3 automatically.
    pause
    exit /b 1
)

echo [Setup] Refreshing PATH after Miniforge install...
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"`) do set "PATH=%%P"

where conda >nul 2>&1
if not errorlevel 1 (
    for /f "delims=" %%C in ('where conda') do (
        set "CONDA_EXE=%%C"
        goto :conda_found
    )
)

for %%D in ("%UserProfile%\miniforge3" "%LocalAppData%\miniforge3" "%ProgramData%\miniforge3" "%UserProfile%\Miniforge3" "%LocalAppData%\Miniforge3" "%ProgramData%\Miniforge3") do (
    if exist "%%~fD\Scripts\conda.exe" (
        set "CONDA_EXE=%%~fD\Scripts\conda.exe"
        goto :conda_found
    )
)

echo [ERROR] Conda was installed but could not be found.
echo [ERROR] Please reopen start.bat once, or check Miniforge installation.
pause
exit /b 1

:conda_found
for %%D in ("%CONDA_EXE%") do set "CONDA_ROOT=%%~dpD.."
set "CONDA_ROOT=%CONDA_ROOT:\\=\%"

echo [Virtual Avatar] Using conda: %CONDA_EXE%

:: ====== Optional Windows dependencies ======
echo [Setup] Ensuring Microsoft VC++ Runtime...
winget install -e --id Microsoft.VCRedist.2015+.x64 --silent --accept-package-agreements --accept-source-agreements >nul 2>&1

where espeak-ng >nul 2>&1
if errorlevel 1 (
    echo [Setup] espeak-ng not found, attempting install...
    winget install -e --id eSpeak-NG.eSpeak-NG --silent --accept-package-agreements --accept-source-agreements
    if errorlevel 1 (
        echo [WARN] Automatic espeak-ng install failed. Continuing for now.
    )
)

:: ====== Create / update Conda env ======
if not exist "%ENV_FILE%" (
    echo [ERROR] environment.yml not found: %ENV_FILE%
    pause
    exit /b 1
)

echo [Setup] Ensuring conda environment "%ENV_NAME%"...
call "%CONDA_EXE%" env list | findstr /R /C:"^%ENV_NAME% " >nul 2>&1
if errorlevel 1 (
    echo [Setup] Creating conda environment from environment.yml...
    call "%CONDA_EXE%" env create -f "%ENV_FILE%"
    if errorlevel 1 goto :conda_fail
) else (
    echo [Setup] Updating conda environment from environment.yml...
    call "%CONDA_EXE%" env update -n "%ENV_NAME%" -f "%ENV_FILE%" --prune
    if errorlevel 1 goto :conda_fail
)

:: ====== Refresh Python packages for current interpreter ======
echo [Setup] Force-reinstalling Python packages for the current conda interpreter...
call "%CONDA_EXE%" run -n "%ENV_NAME%" python -m pip install --no-cache-dir --force-reinstall -r python\requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to reinstall Python requirements inside conda env.
    pause
    exit /b 1
)

call "%CONDA_EXE%" run -n "%ENV_NAME%" python -c "import sys, fastapi, pydantic, pydantic_core; print('[Python]', sys.version); print('[FastAPI]', fastapi.__version__); print('[Pydantic]', pydantic.__version__); print('[Pydantic Core]', pydantic_core.__version__)"
if errorlevel 1 (
    echo [ERROR] Python package verification failed inside conda env.
    pause
    exit /b 1
)

:: ====== GPU stack inside Conda env ======
echo [Setup] Installing GPU PyTorch inside conda env...
call "%CONDA_EXE%" run -n "%ENV_NAME%" python -m pip uninstall -y torch torchaudio torchvision torchcodec >nul 2>&1
set TORCH_OK=
for %%I in (
    https://download.pytorch.org/whl/cu128
    https://download.pytorch.org/whl/cu126
    https://download.pytorch.org/whl/cu124
    https://download.pytorch.org/whl/cu121
) do (
    if not defined TORCH_OK (
        echo [Setup] Trying PyTorch index: %%I
        call "%CONDA_EXE%" run -n "%ENV_NAME%" python -m pip install -q --no-cache-dir --force-reinstall torch torchaudio torchvision --index-url %%I
        if not errorlevel 1 (
            call "%CONDA_EXE%" run -n "%ENV_NAME%" python -c "import sys, torch; print('[Torch]', torch.__version__); print('[CUDA]', torch.version.cuda); ok=torch.cuda.is_available() and '+cpu' not in torch.__version__; sys.exit(0 if ok else 1)"
            if not errorlevel 1 (
                set TORCH_OK=1
                set TORCH_INDEX=%%I
            ) else (
                echo [Setup] Installed torch is not a usable GPU build, retrying...
                call "%CONDA_EXE%" run -n "%ENV_NAME%" python -m pip uninstall -y torch torchaudio torchvision torchcodec >nul 2>&1
            )
        )
    )
)

if not defined TORCH_OK (
    echo [ERROR] Failed to install a usable GPU PyTorch build automatically.
    pause
    exit /b 1
)

echo [Setup] Selected PyTorch index: %TORCH_INDEX%

echo [Setup] Installing TorchCodec in conda env...
call "%CONDA_EXE%" run -n "%ENV_NAME%" python -m pip install -q --no-cache-dir --force-reinstall torchcodec
if errorlevel 1 (
    echo [ERROR] Failed to install torchcodec in conda env.
    pause
    exit /b 1
)

call "%CONDA_EXE%" run -n "%ENV_NAME%" python -c "import torch, torchcodec; print('[TorchCodec] OK'); print('[Torch]', torch.__version__); print('[CUDA available]', torch.cuda.is_available())"
if errorlevel 1 (
    echo [ERROR] TorchCodec verification failed inside conda env.
    pause
    exit /b 1
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

start "Virtual Avatar - Python (8081)" cmd /k "call "%CONDA_EXE%" run -n "%ENV_NAME%" python -u python\server.py"
timeout /t 3 /nobreak > nul
start "Virtual Avatar - Node (8080)" node src/index.js

echo.
echo  Virtual Avatar is running!
echo   Node   ^> http://localhost:8080
echo   Python ^> http://localhost:8081

echo  Conda env ^> %ENV_NAME%
echo.
echo  Close both windows to stop the services.
exit /b 0

:conda_fail
echo [ERROR] Conda environment setup failed.
pause
exit /b 1
