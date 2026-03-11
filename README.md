# OpenClaw Virtual Avatar

OpenClaw 的虛擬角色系統專案，整合了：

- **OpenClaw plugin**（部署於 VPS）
- **Local media server**（部署於本地 Windows 電腦）
- **Tauri desktop app**（桌面角色入口）
- **TTS / STT / Live2D / VRM** 的本地推理與控制基礎

目前專案仍在開發中，但本地媒體鏈路與桌面殼已經有可運作的第一版。

---

## Overview

```text
OpenClaw (VPS)
  └─ plugin
       └─ 透過 Tailscale 呼叫本地 media server

Local Windows PC
  └─ media-server
       ├─ Python service (FastAPI)
       │   ├─ CosyVoice3
       │   └─ faster-whisper
       ├─ Node.js proxy server
       └─ Tauri desktop app
            ├─ Avatar window
            ├─ Chat window
            ├─ Record window
            └─ Settings window
```

### Current stack

- **TTS**: CosyVoice3
- **Voice cloning**: supported
- **STT**: faster-whisper
- **Transport**: Tailscale
- **Desktop app**: Tauri + React + Vite + shadcn/ui-style structure
- **Dialogue target**: OpenClaw Gateway `/v1/responses`
- **Avatar layer**: Live2D / VRM integration in progress

---

## Project structure

```text
openclaw-virtual-avatar/
├─ app/                    # Tauri desktop UI (React + Vite + shadcn/ui style)
├─ plugin/                 # OpenClaw plugin
├─ media-server/           # Local media service
│  ├─ src/                 # Node.js proxy server
│  ├─ python/              # Python FastAPI service
│  ├─ environment.yml      # Conda environment definition (Python 3.12)
│  └─ start.bat            # Windows one-click launcher
├─ start.bat               # Root launcher, forwards to media-server/start.bat
├─ README.md
└─ .gitignore
```

---

## Windows launcher

From the repo root or from `media-server/`, run:

```bat
start.bat
```

The root `start.bat` simply forwards to `media-server\start.bat`, which remains the main Windows launcher.

### What `start.bat` currently does

- checks / installs **Miniforge (conda)**
- creates the conda environment on first run
- updates the conda environment only when `environment.yml` changes
- installs Python requirements only when `python/requirements.txt` changes or import verification fails
- repairs GPU PyTorch only when verification fails
- installs `torchcodec` only when verification fails
- installs `media-server/` and `app/` Node dependencies only when lockfiles change or `node_modules` is missing
- attempts to install the Rust toolchain for Tauri on Windows when missing
- starts the Python service
- starts the Node.js proxy server
- starts the Tauri desktop app (`app/`) when the toolchain is available
- stores dependency hashes under `media-server/.state/` to avoid repeating expensive setup on every launch

The current launcher behavior is optimized for repeat use on Windows: after the first successful setup, `start.bat` should usually skip most installs unless dependency files changed or runtime verification detects a broken environment.

---

## Current API

### Python service (`8081`)

- `GET /health`
- `GET /voices`
- `POST /voices/{voice_name}`
- `DELETE /voices/{voice_name}`
- `POST /v1/audio/speech`
- `POST /v1/audio/transcriptions`
- `POST /v1/audio/transcriptions/upload`

### Node.js proxy (`8080`)

- `GET /health`
- `GET /voices`
- `POST /voices/{voiceName}`
- `DELETE /voices/{voiceName}`
- `POST /v1/audio/speech`
- `POST /v1/audio/transcriptions`
- `POST /live2d/express`
- `POST /live2d/load`
- `GET /live2d/frame`

### OpenClaw Gateway (optional dialogue backend)

The desktop app is now being wired toward:

- `POST /v1/responses`

When a Gateway URL is configured in the desktop app, the intended flow becomes:

```text
Chat input / STT result
  → OpenClaw Gateway /v1/responses
  → assistant text
  → local TTS playback
```

This endpoint must be enabled on the Gateway side and authenticated according to your OpenClaw config.

---

## Voice cloning

Voice cloning is currently supported through:

1. upload reference audio to `/voices/{voice_name}`
2. upload matching `ref_text`
3. call `/v1/audio/speech` with the target `voice`

This flow has been validated end-to-end with custom voice generation.

---

## STT status

The faster-whisper pipeline is connected and working.

Current implementation includes:

- `medium` model by default
- lightweight preprocessing before transcription
  - mono conversion
  - 16kHz resampling
  - mild high-pass filter
- VAD enabled

The current STT path is functional, but transcription quality for game voice lines and uncommon proper nouns still needs further tuning.

The Python service also supports idle model unload. By default, TTS / STT models are released after 300 seconds without requests (`MODEL_IDLE_SECONDS`, set `0` to disable).

---

## OpenClaw plugin

The `plugin/` directory is intended to expose local avatar/media features to OpenClaw.

Current tool stubs include:

- `remote_tts`
- `remote_stt`
- `live2d_express`
- `live2d_load_model`
- `live2d_get_frame`

The plugin is still in development and is not yet packaged as a final installable release.

---

## Desktop app status

A Tauri desktop app now lives in `app/`.

### Current UI direction

The desktop UX is moving toward a multi-window assistant layout:

- **Avatar Window**
  - small desktop-style character window
  - transparent / undecorated / always-on-top direction
  - hover actions to open other windows
- **Chat Window**
  - lightweight dialogue window
  - text input + message history
- **Record Window**
  - lightweight STT / recording entry window
  - currently focused on audio upload → Whisper STT → route back to chat
- **Settings Window**
  - larger control center
  - server URLs, voice settings, OpenClaw Gateway settings, health/debug information

### Current implementation progress

Implemented so far:

- multi-window routing via:
  - `#avatar`
  - `#chat`
  - `#record`
  - `#settings`
- Tauri startup creates four windows:
  - `avatar`
  - `chat`
  - `record`
  - `settings`
- Avatar / Chat / Record / Settings views are split into separate React views
- cross-window bridge exists for:
  - shared draft sync
  - chat message sync
  - STT result handoff from Record → Chat
- Chat send flow can now target OpenClaw Gateway `/v1/responses`
- assistant reply can then be sent to local TTS for playback
- Chat / Record / Settings window close behavior is being normalized toward **hide instead of destroy**

### Not done yet

- full Windows-side validation of all Tauri window focus / hide / close behavior
- complete OpenClaw Gateway integration verification against a real enabled `/v1/responses` endpoint
- realtime microphone / push-to-talk flow
- VRM / Live2D renderer integration in the Avatar window

---

## Local development

### Browser-only frontend

```bash
cd app
npm install
npm run dev
```

### Tauri desktop app

```bash
cd app
npm install
npm run tauri:dev
```

### Full Windows flow

Use the project `start.bat` and let the launcher bring up the local stack for you.

---

## Current status summary

### Working now

- integrated plugin + media-server into a single git project
- conda-first Windows launcher working
- dependency change detection in launcher working
- CosyVoice3 voice cloning flow working end-to-end
- local voice upload / storage / reuse flow working
- Python + Node dual-service startup working
- Python STT and Node proxy STT both working
- lightweight STT preprocessing added
- first Tauri desktop shell running on Windows
- multi-window architecture scaffold in progress

### Next priorities

- continue improving multi-window behavior on Windows
- finish routing STT / Chat / OpenClaw / TTS into a smoother assistant loop
- continue improving faster-whisper quality
- clean up plugin config and loading workflow
- continue Live2D / VRM integration
- prepare voice management UI for later builds

---

## Notes

This project currently targets:

- **OpenClaw on VPS**
- **local media inference on Windows**

Before productization, the launcher flow, environment packaging, desktop UX, and model management will continue to evolve.

---

## License

MIT
