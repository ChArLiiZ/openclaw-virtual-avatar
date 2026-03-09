# Virtual Avatar (OpenClaw Plugin + Local Media Server)

讓 OpenClaw 擁有虛擬角色互動能力的完整解決方案：TTS (F5-TTS)、STT (faster-whisper)、以及 Live2D/VRM 模型控制。

## 架構說明

- **Plugin (VPS)**: OpenClaw 插件，透過 API 呼叫與本地代理通訊。
- **Media Server (Local Windows PC)**: Python 服務（FastAPI），運用 RTX 4070 GPU 加速計算。

```
┌────────────────┐                      ┌─────────────────────┐
│  OpenClaw      │  ◄── Tailscale ────► │  Local Media Server │
│  (VPS)         │   100.x.x.x          │  (您的本地電腦)      │
│  Plugin        │                      │                     │
└────────────────┘                      └─────────────────────┘
       │                                        │
       │ API 調用 (TTS/STT/Live2D)              │ - F5-TTS (CUDA)
                                                 │ - faster-whisper (CUDA)
                                                 │ - Live2D/VRM 顯示
```

## 快速開始

### 1. 複製倉庫
```bash
git clone https://github.com/ChArLiiZ/openclaw-virtual-avatar.git
cd openclaw-virtual-avatar
```

### 2. 啟動服務 (自動化部署)

直接執行目錄下的 `start.bat`，它會：
1. 自動下載並檢查 Python 3.10+ 環境
2. 建立 `venv` 並安裝所有 Python 相依套件
3. 自動安裝 Node.js 相依套件
4. 自動啟動 Python/Node 雙服務

```bash
cd media-server
start.bat
```

> **提示**：首次啟動會自動從 HuggingFace 下載 F5-TTS 模型（約 ~300MB）。

## 功能說明

| 功能 | 技術 | 狀態 |
|------|------|------|
| **TTS** | F5-TTS (Zero-shot Cloning) | ✅ 測試通過 |
| **STT** | faster-whisper (CUDA) | ✅ 可用 |
| **Live2D** | AIRI stage-ui 橋接 | 規劃中 |

## 聲音克隆 (F5-TTS)

我們的服務支援聲音克隆，只需提供 3 秒的參考音訊：

1. **上傳聲音**： `POST /voices/{name}` (包含 `audio` 檔案與 `ref_text` 文字)
2. **使用聲音**：調用 `/v1/audio/speech` 時，指定 `voice="{name}"`

## Roadmap

### 目前 (v0.x)
- [x] Node.js API 伺服器代理
- [x] Python F5-TTS 服務整合 (CUDA)
- [x] 離線 Whisper STT 整合
- [x] 完善的 Windows 一鍵啟動 (start.bat)

### 未來 (v1.0)
- **Tauri 桌面應用**：將轉語音與 Live2D 畫面整合進獨立 App，支援右下角托盤運作。
- **即時 Lip-sync**：模型嘴型與 TTS 語音即時同步。
- **表情 UI**：在介面上直接調整 Live2D 表情參數。

## License
MIT
