@echo off
setlocal
title Virtual Avatar Media Server
cd /d "%~dp0"

echo [Virtual Avatar] 啟動中...

:: ====== 尋找 Python 3.12 ======
set PYTHON_CMD=

:: 優先用 py launcher 指定 3.12
where py >nul 2>&1
if not errorlevel 1 (
    py -3.12 --version >nul 2>&1
    if not errorlevel 1 (
        set PYTHON_CMD=py -3.12
        goto :found_python
    )
)

:: 備用：直接找 python3.12
where python3.12 >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=python3.12
    goto :found_python
)

echo [ERROR] 找不到 Python 3.12
echo 請至 https://www.python.org/downloads/release/python-31213/ 下載安裝
echo 安裝時勾選 "Add to PATH"
pause
exit /b 1

:found_python
echo [OK] 使用 %PYTHON_CMD%

:: ====== Python 虛擬環境 ======
if not exist "python\venv" (
    echo [Setup] 建立 Python 3.12 虛擬環境...
    %PYTHON_CMD% -m venv python\venv
    if errorlevel 1 (
        echo [ERROR] 建立虛擬環境失敗
        pause
        exit /b 1
    )
)

:: 安裝 / 更新依賴
echo [Setup] 檢查 Python 依賴...
python\venv\Scripts\pip install -q -r python\requirements.txt
if errorlevel 1 (
    echo [ERROR] pip install 失敗，請檢查 requirements.txt
    pause
    exit /b 1
)

:: ====== Node.js 依賴 ======
if not exist "node_modules" (
    echo [Setup] 安裝 Node.js 依賴...
    call npm install --silent
)

:: ====== 啟動服務 ======
echo [OK] 環境就緒，啟動服務...

start "Virtual Avatar - Python (8081)" python\venv\Scripts\python python\server.py
timeout /t 3 /nobreak > nul
start "Virtual Avatar - Node (8080)" node src/index.js

echo.
echo  Virtual Avatar 已啟動！
echo   Node   ^> http://localhost:8080
echo   Python ^> http://localhost:8081
echo.
echo  關閉兩個視窗即可停止服務。
