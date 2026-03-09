# OpenClaw Virtual Avatar

OpenClaw 的虛擬角色系統專案，包含：

- **OpenClaw plugin**（跑在 VPS）
- **Local media server**（跑在本地 Windows 電腦）
- **TTS / STT / Live2D / VRM** 的整合基礎

目前仍在開發中。

---

## 目前架構

```text
OpenClaw (VPS)
  └─ plugin
       └─ 透過 Tailscale 呼叫本地 media server

Local Windows PC
  └─ media-server
       ├─ Python service (FastAPI)
       │   ├─ F5-TTS
       │   └─ faster-whisper
       └─ Node.js proxy server
```

### 目前使用方向

- **TTS**：F5-TTS（支援 voice cloning）
- **STT**：faster-whisper
- **傳輸**：Tailscale
- **未來桌面端**：Tauri
- **Live2D / VRM**：預留整合中

---

## 專案結構

```text
openclaw-virtual-avatar/
├─ plugin/                 # OpenClaw plugin
├─ media-server/           # 本地媒體服務
│  ├─ src/                 # Node.js proxy
│  ├─ python/              # Python FastAPI service
│  ├─ environment.yml      # conda environment
│  └─ start.bat            # Windows 一鍵啟動
├─ README.md
└─ .gitignore
```

---

## media-server

`media-server` 負責本地的重型能力：

- 語音合成（TTS）
- 語音辨識（STT）
- 未來的 Live2D / VRM 控制

### 啟動方式

進入 `media-server/` 後直接執行：

```bat
start.bat
```

### `start.bat` 目前會做的事

- 自動檢查 / 安裝 **Miniforge (conda)**
- 建立 / 更新 conda 環境
- 安裝 Python 相依
- 安裝 GPU 版 PyTorch
- 安裝 `torchcodec`
- 啟動 Python service
- 啟動 Node.js proxy

> 目前是開發版流程，後續仍可能調整。

---

## 目前 API

### Python service

預設埠號：`8081`

- `GET /health`
- `GET /voices`
- `POST /voices/{voice_name}`
- `DELETE /voices/{voice_name}`
- `POST /v1/audio/speech`
- `POST /v1/audio/transcriptions`
- `POST /v1/audio/transcriptions/upload`

### Node.js proxy

預設埠號：`8080`

- `GET /health`
- `GET /voices`
- `POST /voices/{voiceName}`
- `DELETE /voices/{voiceName}`
- `POST /v1/audio/speech`
- `POST /v1/audio/transcriptions`
- `POST /live2d/express`
- `POST /live2d/load`
- `GET /live2d/frame`

---

## 聲音克隆

目前已支援：

1. 上傳參考音訊到 `/voices/{voice_name}`
2. 提供對應 `ref_text`
3. 之後用 `/v1/audio/speech` 指定 `voice`

目前已驗證能成功產生自訂 voice 的 TTS 音訊。

---

## OpenClaw plugin

`plugin/` 目標是讓 OpenClaw 可以直接呼叫本地 media server。

目前已包含工具雛形：

- `remote_tts`
- `remote_stt`
- `live2d_express`
- `live2d_load_model`
- `live2d_get_frame`

目前 plugin 仍在開發中，尚未整理成正式可安裝釋出版本。

---

## 開發現況

### 已完成

- 單一 git 專案整合 plugin + media-server
- F5-TTS 基本語音克隆流程打通
- 本地 voice 參考音訊上傳 / 使用流程打通
- Node / Python 雙服務可正常啟動
- conda-based `start.bat` 啟動流程

### 下一步

- 驗證 / 補齊 faster-whisper STT 流程
- 持續整理 plugin 設定與載入方式
- 開始規劃最小可用的 Tauri UI
- 後續整合 Live2D / VRM

---

## 備註

這個專案目前以 **Windows 本地開發 + VPS 上的 OpenClaw** 為主要目標。

正式產品化前，啟動流程、環境封裝、UI 與模型管理方式都還會繼續調整。

---

## License

MIT
