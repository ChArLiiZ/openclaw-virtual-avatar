# OpenClaw Virtual Avatar

OpenClaw 的虛擬角色系統專案，整合了：

- **OpenClaw plugin**（部署於 VPS）
- **Local media server**（部署於本地 Windows 電腦）
- **TTS / STT / Live2D / VRM** 的本地推理與控制基礎

目前專案仍在開發中。

---

## Overview

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

### Current stack

- **TTS**: F5-TTS
- **Voice cloning**: supported
- **STT**: faster-whisper
- **Transport**: Tailscale
- **Desktop app target**: Tauri
- **Avatar layer**: Live2D / VRM integration in progress

---

## Project structure

```text
openclaw-virtual-avatar/
├─ app/                    # Tauri-ready desktop UI (React + Vite + shadcn/ui)
├─ plugin/                 # OpenClaw plugin
├─ media-server/           # Local media service
│  ├─ src/                 # Node.js proxy server
│  ├─ python/              # Python FastAPI service
│  ├─ environment.yml      # Conda environment definition (Python 3.13)
│  └─ start.bat            # Windows one-click launcher
├─ README.md
└─ .gitignore
```

---

## media-server

`media-server` handles local heavy workloads, including:

- text-to-speech
- speech-to-text
- future avatar playback / model control

### Start

From the repo root or from `media-server/`, run:

```bat
start.bat
```

The root `start.bat` simply forwards to `media-server\start.bat`, which remains the main Windows launcher.

### What `start.bat` currently does

- checks / installs **Miniforge (conda)**
- creates or updates the conda environment (**Python 3.13**)
- force-reinstalls Python dependencies for the active interpreter
- installs GPU PyTorch
- installs `torchcodec`
- installs `media-server/` Node dependencies
- installs `app/` dependencies when needed
- attempts to install the Rust toolchain for Tauri on Windows when missing
- starts the Python service
- starts the Node.js proxy server
- starts the Tauri desktop window (`app/`) when the toolchain is available

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

The Python service now also supports idle model unload. By default, TTS / STT models are released after 300 seconds without requests (`MODEL_IDLE_SECONDS`, set `0` to disable).

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

## Current status

### Done

- integrated plugin + media-server into a single git project
- F5-TTS voice cloning flow working end-to-end
- local voice upload / storage / reuse flow working
- Python + Node dual-service startup working
- conda-based Windows launcher working
- TTS generation tested successfully
- Python STT and Node proxy STT both working
- lightweight STT preprocessing added

### Next

- continue improving faster-whisper quality
- clean up plugin config and loading workflow
- connect the new `app/` MVP to real media-server APIs
- add local audio playback flow in the desktop app
- continue Live2D / VRM integration
- prepare voice management UI for future desktop builds

---

## Desktop UI MVP

A first Tauri-ready UI shell now lives in `app/`.

Current stack:
- React + Vite + TypeScript
- Tailwind CSS
- shadcn/ui-style component structure (`components.json`, `src/components/ui/*`)

Current first-pass screens include:
- service status cards
- TTS console
- speech input / transcript area
- placeholder Avatar Stage for future Live2D / VRM integration

Run it locally in browser-only mode:

```bash
cd app
npm install
npm run dev
```

Run it as a Tauri desktop app:

```bash
cd app
npm install
npm run tauri:dev
```

On Windows, the project launcher is intended to do this for you via `start.bat`.

## Notes

This project currently targets:

- **OpenClaw on VPS**
- **local media inference on Windows**

Before productization, the launcher flow, environment packaging, desktop UX, and model management will continue to evolve.

---

## License

MIT
