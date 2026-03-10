@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Virtual Avatar Launcher
cd /d "%~dp0"

echo [Virtual Avatar] Checking environment...

set "ENV_NAME=openclaw-virtual-avatar"
set "ENV_FILE=%CD%\environment.yml"
set "PY_REQ=%CD%\python\requirements.txt"
set "APP_DIR=%CD%\..\app"
set "STATE_DIR=%CD%\.state"
set "CONDA_EXE="
set "CONDA_ROOT="
set "TAURI_READY="

if not exist "%STATE_DIR%" mkdir "%STATE_DIR%" >nul 2>&1

:: ====== helpers ======
set "PS_HASH_CMD=$p=$env:TARGET_FILE; if (Test-Path $p) {(Get-FileHash -Algorithm SHA256 $p).Hash }"

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
set "CONDA_ROOT=%CONDA_ROOT:\=\%"

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

:: ====== Create / update Conda env only when needed ======
if not exist "%ENV_FILE%" (
    echo [ERROR] environment.yml not found: %ENV_FILE%
    pause
    exit /b 1
)

set "ENV_EXISTS="
call "%CONDA_EXE%" env list | findstr /R /C:"^%ENV_NAME% " >nul 2>&1
if not errorlevel 1 set "ENV_EXISTS=1"

if not defined ENV_EXISTS (
    echo [Setup] Creating conda environment from environment.yml...
    call "%CONDA_EXE%" env create -f "%ENV_FILE%"
    if errorlevel 1 goto :conda_fail
    call :update_hash "%ENV_FILE%" "%STATE_DIR%\environment.sha256"
) else (
    call :hash_changed "%ENV_FILE%" "%STATE_DIR%\environment.sha256"
    if errorlevel 1 (
        echo [Setup] environment.yml changed. Updating conda environment...
        call "%CONDA_EXE%" env update -n "%ENV_NAME%" -f "%ENV_FILE%" --prune
        if errorlevel 1 goto :conda_fail
        call :update_hash "%ENV_FILE%" "%STATE_DIR%\environment.sha256"
    ) else (
        echo [Setup] Conda environment unchanged. Skipping env update.
    )
)

:: ====== Python packages: update when requirements change or verification fails ======
set "NEED_PIP_INSTALL="
call :hash_changed "%PY_REQ%" "%STATE_DIR%\python-requirements.sha256"
if errorlevel 1 set "NEED_PIP_INSTALL=1"

call "%CONDA_EXE%" run -n "%ENV_NAME%" python -c "import sys, fastapi, pydantic, pydantic_core; print('[Python]', sys.version); print('[FastAPI]', fastapi.__version__); print('[Pydantic]', pydantic.__version__); print('[Pydantic Core]', pydantic_core.__version__)"
if errorlevel 1 set "NEED_PIP_INSTALL=1"

if defined NEED_PIP_INSTALL (
    echo [Setup] Installing Python requirements inside conda env...
    call "%CONDA_EXE%" run -n "%ENV_NAME%" python -m pip install --no-cache-dir -r python\requirements.txt
    if errorlevel 1 (
        echo [ERROR] Failed to install Python requirements inside conda env.
        pause
        exit /b 1
    )
    call "%CONDA_EXE%" run -n "%ENV_NAME%" python -c "import fastapi, pydantic, pydantic_core"
    if errorlevel 1 (
        echo [ERROR] Python package verification failed after install.
        pause
        exit /b 1
    )
    call :update_hash "%PY_REQ%" "%STATE_DIR%\python-requirements.sha256"
) else (
    echo [Setup] Python requirements unchanged. Skipping pip install.
)

:: ====== GPU stack: verify first, repair only if needed ======
call "%CONDA_EXE%" run -n "%ENV_NAME%" python -c "import sys, torch; ok=torch.cuda.is_available() and '+cpu' not in torch.__version__; print('[Torch]', torch.__version__); print('[CUDA]', torch.version.cuda); sys.exit(0 if ok else 1)"
if errorlevel 1 (
    echo [Setup] GPU PyTorch missing or unusable. Repairing torch stack...
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
            call "%CONDA_EXE%" run -n "%ENV_NAME%" python -m pip install -q --no-cache-dir torch torchaudio torchvision --index-url %%I
            if not errorlevel 1 (
                call "%CONDA_EXE%" run -n "%ENV_NAME%" python -c "import sys, torch; ok=torch.cuda.is_available() and '+cpu' not in torch.__version__; print('[Torch]', torch.__version__); print('[CUDA]', torch.version.cuda); sys.exit(0 if ok else 1)"
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
) else (
    echo [Setup] GPU PyTorch looks healthy. Skipping reinstall.
)

call "%CONDA_EXE%" run -n "%ENV_NAME%" python -c "import torch, torchcodec; print('[TorchCodec] OK'); print('[CUDA available]', torch.cuda.is_available())"
if errorlevel 1 (
    echo [Setup] TorchCodec missing or broken. Installing torchcodec...
    call "%CONDA_EXE%" run -n "%ENV_NAME%" python -m pip install -q --no-cache-dir torchcodec
    if errorlevel 1 (
        echo [ERROR] Failed to install torchcodec in conda env.
        pause
        exit /b 1
    )
    call "%CONDA_EXE%" run -n "%ENV_NAME%" python -c "import torch, torchcodec"
    if errorlevel 1 (
        echo [ERROR] TorchCodec verification failed inside conda env.
        pause
        exit /b 1
    )
) else (
    echo [Setup] TorchCodec looks healthy. Skipping reinstall.
)

:: ====== Node.js setup: update when lockfiles change ======
call :npm_sync "%CD%" "%CD%\package-lock.json" "media-server"
if errorlevel 1 exit /b 1

if exist "%APP_DIR%\package.json" (
    call :npm_sync "%APP_DIR%" "%APP_DIR%\package-lock.json" "desktop app"
    if errorlevel 1 exit /b 1
) else (
    echo [WARN] app\package.json not found. Desktop UI will be skipped.
)

:: ====== Optional Rust / Tauri toolchain ======
where cargo >nul 2>&1
if errorlevel 1 (
    echo [Setup] Rust toolchain not found, attempting install via winget...
    winget install -e --id Rustlang.Rustup --silent --accept-package-agreements --accept-source-agreements
    if errorlevel 1 (
        echo [WARN] Automatic Rust install failed. Tauri window will be skipped for this run.
    ) else (
        call "%UserProfile%\.cargo\env.bat" >nul 2>&1
    )
)

where cargo >nul 2>&1
if not errorlevel 1 set "TAURI_READY=1"

:: ====== Start services ======
echo [OK] Starting services...
echo [Note] First run may download F5-TTS / Whisper models, so Python 視窗短時間沒反應是正常的。

start "Virtual Avatar - Python (8081)" cmd /k "call "%CONDA_EXE%" run -n "%ENV_NAME%" python -u python\server.py"
timeout /t 3 /nobreak > nul
start "Virtual Avatar - Node (8080)" cmd /k "node src/index.js"

if defined TAURI_READY if exist "%APP_DIR%\package.json" (
    timeout /t 2 /nobreak > nul
    start "Virtual Avatar - Desktop UI" cmd /k "cd /d "%APP_DIR%" && npm run tauri:dev"
) else (
    echo [WARN] Rust/Tauri not ready yet. Skipping desktop window launch.
)

echo.
echo  Virtual Avatar is running!
echo   Node   ^> http://localhost:8080
echo   Python ^> http://localhost:8081
if defined TAURI_READY (
    echo   Desktop^> Tauri window launch requested
) else (
    echo   Desktop^> skipped ^(Rust / Tauri toolchain missing^)
)
echo  Conda env ^> %ENV_NAME%
echo.
echo  Close all opened windows to stop the services.
exit /b 0

:npm_sync
set "NPM_DIR=%~1"
set "NPM_LOCK=%~2"
set "NPM_LABEL=%~3"
set "NPM_STATE=%STATE_DIR%\%NPM_LABEL: =-%-package-lock.sha256"
set "NPM_NEEDS="

if not exist "%NPM_DIR%\node_modules" set "NPM_NEEDS=1"
call :hash_changed "%NPM_LOCK%" "%NPM_STATE%"
if errorlevel 1 set "NPM_NEEDS=1"

if defined NPM_NEEDS (
    echo [Setup] Installing %NPM_LABEL% dependencies...
    pushd "%NPM_DIR%"
    call npm install --silent
    set "NPM_RC=!errorlevel!"
    popd
    if not "!NPM_RC!"=="0" (
        echo [ERROR] %NPM_LABEL% npm install failed.
        pause
        exit /b 1
    )
    call :update_hash "%NPM_LOCK%" "%NPM_STATE%"
) else (
    echo [Setup] %NPM_LABEL% dependencies unchanged. Skipping npm install.
)
exit /b 0

:hash_changed
set "TARGET_FILE=%~1"
set "HASH_FILE=%~2"
set "CURRENT_HASH="
set "STORED_HASH="
if not exist "%TARGET_FILE%" exit /b 1
for /f "usebackq delims=" %%H in (`powershell -NoProfile -Command "%PS_HASH_CMD%"`) do set "CURRENT_HASH=%%H"
if not defined CURRENT_HASH exit /b 1
if not exist "%HASH_FILE%" exit /b 1
set /p STORED_HASH=<"%HASH_FILE%"
if /I "%CURRENT_HASH%"=="%STORED_HASH%" (
    exit /b 0
) else (
    exit /b 1
)

:update_hash
set "TARGET_FILE=%~1"
set "HASH_FILE=%~2"
set "NEW_HASH="
if not exist "%TARGET_FILE%" exit /b 1
for /f "usebackq delims=" %%H in (`powershell -NoProfile -Command "%PS_HASH_CMD%"`) do set "NEW_HASH=%%H"
if not defined NEW_HASH exit /b 1
echo %NEW_HASH%>"%HASH_FILE%"
exit /b 0

:conda_fail
echo [ERROR] Conda environment setup failed.
pause
exit /b 1
