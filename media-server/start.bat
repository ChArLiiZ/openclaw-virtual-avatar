@echo off
setlocal
title Virtual Avatar Media Server
cd /d "%~dp0"

echo [Virtual Avatar] 啟動中...

:: ====== Python 環境 ======
if not exist "python\venv" (
    echo [Setup] 首次執行，建立 Python 虛擬環境...
    python -m venv python\venv
    if errorlevel 1 (
        echo [ERROR] 找不到 Python，請先安裝 Python 3.10+
        pause
        exit /b 1
    )
)

:: 安裝 / 更新依賴（只在 requirements.txt 有變動時才慢）
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
