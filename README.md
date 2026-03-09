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

## 相關資源

- [AIRI 專案](https://github.com/moeru-ai/airi) - 重要的參考來源
- [Kokoro TTS](https://github.com/remsky/Kokoro)
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp)
- [Vtuber Studio](https://dena.com玩的/vtuber-studio/)

## License

MIT
