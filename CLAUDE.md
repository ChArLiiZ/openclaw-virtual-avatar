# CLAUDE.md

## Project Overview

OpenClaw Virtual Avatar — a virtual avatar system integrating local TTS/STT inference, avatar rendering (Live2D/VRM), and OpenClaw Gateway for dialogue. Consists of three main components:

1. **app/** — Tauri 2 desktop app (React + Vite + TypeScript)
2. **media-server/** — Local inference backend (Node.js proxy + Python FastAPI)
3. **plugin/** — OpenClaw plugin for remote media access

## Tech Stack

| Layer | Tech |
|-------|------|
| Desktop shell | Tauri 2.8 (Rust) |
| Frontend | React 18, Vite 5, TypeScript 5.9, Tailwind CSS 3.4 |
| UI components | shadcn/ui-style custom components, lucide-react icons |
| Node.js proxy | Express 4.18 (port 8080) |
| Python service | FastAPI + Uvicorn (port 8081) |
| TTS | CosyVoice3 (CUDA) |
| STT | faster-whisper (CUDA) |
| Plugin schema | @sinclair/typebox |
| Transport | Tailscale VPN |

## Development Commands

```bash
# Frontend only (browser)
cd app && npm run dev          # Vite dev server on :5173

# Tauri desktop app (with Rust backend)
cd app && npm run tauri:dev    # Hot-reload Tauri debug build

# Full stack on Windows
start.bat                      # Launches conda env, Python, Node, and Tauri

# Media server standalone
cd media-server
python python/server.py        # Python service on :8081
npm start                      # Node proxy on :8080
```

## Architecture

### Multi-Window Desktop (Tauri)

Four windows routed by URL hash:

| Window | Hash | Size | Traits |
|--------|------|------|--------|
| Avatar | `#avatar` | 320x520 | Transparent, always-on-top, undecorated, draggable |
| Chat | `#chat` | 480x720 | Dialogue interface, message history |
| Record | `#record` | 420x520 | Audio upload → STT |
| Settings | `#settings` | 1440x960 | Control center, health, config |

Single React App (`App.tsx`) renders the appropriate view based on `currentWindowKind()`. Windows communicate via **localStorage-based bridge** (`lib/bridge.ts`) with deduplication via packet IDs.

### Request Flow

```
User input / STT → OpenClaw Gateway /v1/responses → assistant text → local TTS playback
```

### Node.js Proxy Pattern

Express proxies requests to Python FastAPI, handles file uploads via multer, streams audio responses.

### Python Model Management

Models load on-demand and auto-unload after 300s idle (`MODEL_IDLE_SECONDS`). Thread-safe with locks.

## Key Directories

```
app/src/views/         — React view components (AvatarView, ChatView, RecordView, SettingsView)
app/src/lib/           — Utilities (api.ts, bridge.ts, windows.ts)
app/src/components/ui/ — shadcn-style UI primitives
app/src-tauri/src/     — Rust backend (lib.rs = window lifecycle)
app/src-tauri/tauri.conf.json — Window definitions, bundle config
media-server/src/      — Node.js Express proxy (index.js)
media-server/python/   — FastAPI service (server.py)
plugin/src/            — OpenClaw plugin (index.ts)
```

## Conventions

- **File naming**: camelCase for React/TS (`ChatView.tsx`), snake_case for Python (`server.py`)
- **Exports**: Default exports for views, named exports for utilities
- **Types**: PascalCase (`ViewMode`, `ChatMessage`, `AvatarState`) defined in `app/src/types.ts`
- **API paths**: `/v1/` prefix, OpenAI-compatible format
- **Tauri window labels**: lowercase (`avatar`, `chat`, `record`, `settings`)
- **Error format**: `{ error: "message" }` (Node) or `{ detail: "message" }` (Python)
- **Styling**: Tailwind dark theme by default, purple primary (`#8146ff`), HSL design tokens
- **State**: React useState + localStorage events for cross-window sync
- **Language**: README and comments use a mix of English and Traditional Chinese (zh-TW)

## API Endpoints

### Node.js Proxy (8080)

- `GET /health` — Service health
- `GET /voices` — List available voices
- `POST /voices/:voiceName` — Upload reference audio
- `DELETE /voices/:voiceName` — Remove voice
- `POST /v1/audio/speech` — TTS (proxied to Python)
- `POST /v1/audio/transcriptions` — STT (proxied to Python)
- `POST /live2d/express` — Avatar expression (stub)
- `POST /live2d/load` — Load model (stub)
- `GET /live2d/frame` — Get frame (stub)

### Python Service (8081)

- `GET /health` — Service + model status
- `POST /v1/audio/speech` — CosyVoice3 inference
- `POST /v1/audio/transcriptions` — faster-whisper STT
- `POST /v1/audio/transcriptions/upload` — File upload STT variant

## Important Notes

- Windows-only launcher (`start.bat`) with Miniforge/Conda for Python env
- CUDA GPU required for TTS/STT inference
- `.state/` directory stores dependency hashes to skip redundant installs
- Close behavior for Chat/Record/Settings windows: hide instead of destroy
- Live2D/VRM renderer is not yet integrated (placeholder UI)
- Realtime microphone / push-to-talk not yet implemented
