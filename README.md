# Virtual Avatar

讓 OpenClaw 擁有虛擬角色能力（TTS、STT、Live2D/VRM）的完整解決方案。

## 專案結構

```
virtual-avatar/
├── plugin/                 # OpenClaw Plugin
│   ├── openclaw.plugin.json
│   ├── package.json
│   └── src/
│       └── index.ts       # 工具定義
├── media-server/           # 本地端媒體伺服器
│   ├── package.json
│   └── src/
│       └── index.js       # API 伺服器
├── README.md
└── .gitignore
```

## 功能

| 功能 | 說明 | 狀態 |
|------|------|------|
| **TTS** | 文字轉語音 (Kokoro) | 待整合 |
| **STT** | 語音轉文字 (whisper.cpp) | 待整合 |
| **Live2D/VRM** | 模型控制與顯示 | 待整合 |

## 快速開始

### 1. Clone 到本地電腦

```bash
git clone <repository-url>
cd virtual-avatar
```

### 2. 安裝媒體伺服器依賴

```bash
cd media-server
npm install
```

### 3. 安裝 TTS/STT 工具

#### Kokoro TTS
```bash
# 下載 Kokoro
git clone https://github.com/remsky/Kokoro.git
cd Kokoro

# 根據您的系統編譯
# Linux/Mac:
make

# 下載聲音模型
# 參考: https://github.com/remsky/Kokoro#voices
```

#### whisper.cpp
```bash
# 下載 whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp

# 編譯
make

# 下載模型
# 例如: bash models/download-ggml-base.sh
```

### 4. 啟動媒體伺服器

```bash
cd media
-server
npm start```

伺服器會在 `http://localhost:8080` 啟動。

### 5. 配置 OpenClaw Plugin

（待完成：需要先發布插件到 npm 或設定本地載入）

## API 端點

### TTS
```bash
POST /v1/audio/speech
Content-Type: application/json

{
  "input": "你好，我是虛擬角色",
  "voice": "af_sarah",
  "speed": 1.0
}
```

### STT
```bash
POST /v1/audio/transcriptions
Content-Type: multipart/form-data

# 上傳音訊檔案
```

### Live2D 控制
```bash
POST /live2d/express
Content-Type: application/json

{
  "expression": "happy",
  "blink": true,
  "mouth_open": 0.5,
  "look_at_x": 0.5,
  "look_at_y": 0.5
}
```

## 技術栈

- **TTS**: [Kokoro](https://github.com/remsky/Kokoro) - 離線、高品質多語言 TTS
- **STT**: [whisper.cpp](https://github.com/ggerganov/whisper.cpp) - 高效能本地 STT
- **Live2D**: [AIRI stage-ui](https://github.com/moeru-ai/airi) 或 Vtuber Studio
- **通訊**: Tailnet (Tailscale) - 讓 VPS 與本地伺服器通訊

## 網路架構

```
┌────────────────┐                      ┌─────────────────────┐
│  OpenClaw      │  ◄── Tailscale ────► │  Local Media Server │
│  (VPS)         │   100.x.x.x          │  (本地電腦)        │
│  Plugin        │                      │                     │
└────────────────┘                      └─────────────────────┘
```

## Roadmap

### 目前（v0.x）— 基礎服務架構
- [x] Node.js HTTP API 伺服器骨架
- [x] Python FastAPI 服務（Kokoro TTS + faster-whisper STT）
- [x] Tailscale 通訊（VPS ↔ 本地電腦）
- [x] 一鍵啟動腳本（start.bat / start.sh）
- [ ] OpenClaw Plugin 正式載入
- [ ] Live2D / VRM 顯示整合（AIRI stage-ui）

### 未來（v1.0）— Tauri 桌面應用程式
將整個媒體伺服器打包為 **Tauri 桌面應用程式**，參考 [AIRI 專案](https://github.com/moeru-ai/airi) 的架構：

- **系統托盤常駐**：右下角圖示，一鍵開關服務
- **Live2D / VRM 渲染視窗**：使用 Web 技術（Three.js / PIXI.js）在本地視窗顯示角色
- **Lip-sync**：TTS 語音 ↔ 模型嘴型同步
- **表情控制**：由 OpenClaw Agent 驅動角色表情與動作
- **設定 UI**：可視化設定 serverUrl、聲音、模型路徑等

```
Tauri App（本地電腦）
├── 後端（Rust）       ← 輕量系統服務、托盤管理
├── Python sidecar    ← Kokoro TTS / faster-whisper
└── 前端（Vue + Web） ← Live2D/VRM 渲染 + 設定介面
```

> 參考：AIRI 採用 Tauri + Vue + PIXI.js/Three.js 實作，Live2D 與 VRM 均有良好支援。

## 相關資源

- [AIRI 專案](https://github.com/moeru-ai/airi) — 主要架構參考
- [Kokoro TTS](https://huggingface.co/hexgrad/Kokoro-82M) — 離線 TTS 模型
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) — 高效能本地 STT
- [Tauri](https://tauri.app/) — 桌面應用程式框架

## License

MIT
