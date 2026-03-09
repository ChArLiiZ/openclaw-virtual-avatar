#!/bin/bash
# Virtual Avatar Media Server - 一鍵啟動 (Mac/Linux)

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "啟動 Virtual Avatar Media Server..."

# Python 背景執行
cd "$DIR/python" && python server.py &
PYTHON_PID=$!

# 等待 Python 啟動
sleep 2

# Node.js 前景執行
cd "$DIR" && node src/index.js

# 結束時一起關掉 Python
trap "kill $PYTHON_PID" EXIT
