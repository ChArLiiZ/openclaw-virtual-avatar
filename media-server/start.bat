@echo off
:: Virtual Avatar Media Server - 一鍵啟動
:: 把這個捷徑放到「啟動」資料夾就可以開機自動啟動

cd /d "%~dp0"

:: 啟動 Python 服務（背景執行）
start "Virtual Avatar - Python" cmd /k "cd python && python server.py"

:: 等 Python 服務啟動
timeout /t 3 /nobreak > nul

:: 啟動 Node.js 服務
start "Virtual Avatar - Node" cmd /k "node src/index.js"

echo.
echo Virtual Avatar Media Server 已啟動！
echo   Node:   http://localhost:8080
echo   Python: http://localhost:8081
echo.
