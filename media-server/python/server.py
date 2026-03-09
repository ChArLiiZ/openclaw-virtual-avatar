#!/usr/bin/env python3
"""
Virtual Avatar - Python TTS/STT Service
TTS: kokoro-onnx (CUDA via onnxruntime-gpu)
STT: faster-whisper (CUDA)

Install:
    pip install -r requirements.txt

Run:
    python server.py
"""

import os
import io
import tempfile
import base64
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import uvicorn
import soundfile as sf
import numpy as np

app = FastAPI(title="Virtual Avatar Python Service", version="0.1.0")

# ==================== Model auto-download ====================

MODELS_DIR = Path(__file__).parent / "models"
KOKORO_MODEL_PATH  = MODELS_DIR / "kokoro-v1.0.onnx"
KOKORO_VOICES_PATH = MODELS_DIR / "voices-v1.0.bin"

KOKORO_URLS = {
    "kokoro-v1.0.onnx":  "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx",
    "voices-v1.0.bin":   "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin",
}

def download_file(url: str, dest: Path):
    import urllib.request
    MODELS_DIR.mkdir(exist_ok=True)
    print(f"[Download] {dest.name} ...")
    def progress(count, block, total):
        pct = min(count * block / total * 100, 100)
        print(f"\r  {dest.name}: {pct:.1f}%", end="", flush=True)
    urllib.request.urlretrieve(url, dest, reporthook=progress)
    print()  # newline after progress

def ensure_kokoro_models():
    for filename, url in KOKORO_URLS.items():
        dest = MODELS_DIR / filename
        if not dest.exists():
            print(f"[Setup] Model not found: {filename}, downloading...")
            download_file(url, dest)
            print(f"[Setup] {filename} ready.")

# ==================== Lazy-load models ====================
_kokoro = None
_whisper = None

def get_kokoro():
    global _kokoro
    if _kokoro is None:
        ensure_kokoro_models()
        from kokoro_onnx import Kokoro
        print(f"[TTS] Loading kokoro-onnx...")
        _kokoro = Kokoro(str(KOKORO_MODEL_PATH), str(KOKORO_VOICES_PATH))
        print("[TTS] kokoro-onnx loaded")
    return _kokoro

def get_whisper():
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel
        model_size = os.getenv("WHISPER_MODEL", "base")
        print(f"[STT] Loading faster-whisper: {model_size}")
        _whisper = WhisperModel(model_size, device="cuda", compute_type="float16")
        print("[STT] faster-whisper loaded on CUDA")
    return _whisper

# ==================== TTS ====================

# 語言代碼對照
LANG_CODES = {
    "zh": "z",   # 中文
    "ja": "j",   # 日文
    "en": "a",   # 英文 (美式)
    "en-gb": "b", # 英文 (英式)
}

# 各語言推薦預設聲音
DEFAULT_VOICES = {
    "zh": "zf_xiaobei",
    "ja": "jf_alpha",
    "en": "af_heart",
    "en-gb": "bf_emma",
}

class TTSRequest(BaseModel):
    input: str
    voice: str | None = None   # None = 使用語言預設聲音
    speed: float = 1.0
    lang: str = "zh"           # zh / ja / en / en-gb

@app.post("/v1/audio/speech")
async def text_to_speech(req: TTSRequest):
    try:
        kokoro = get_kokoro()
        
        lang_code = LANG_CODES.get(req.lang, "a")
        voice     = req.voice or DEFAULT_VOICES.get(req.lang, "af_heart")
        
        print(f"[TTS] lang={req.lang}({lang_code}) voice={voice} text={req.input[:60]}...")
        
        # kokoro-onnx API
        samples, sample_rate = kokoro.create(
            req.input,
            voice=voice,
            speed=req.speed,
            lang=lang_code,
        )
        
        buf = io.BytesIO()
        sf.write(buf, samples, sample_rate, format="WAV")
        buf.seek(0)
        
        return StreamingResponse(
            buf,
            media_type="audio/wav",
            headers={"Content-Disposition": "attachment; filename=speech.wav"}
        )
        
    except Exception as e:
        print(f"[TTS Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== STT ====================

class STTRequest(BaseModel):
    audio_data: str | None = None   # base64 encoded audio
    language: str | None = None

@app.post("/v1/audio/transcriptions")
async def speech_to_text(req: STTRequest):
    tmp_path = None
    try:
        model = get_whisper()
        
        if req.audio_data:
            audio_bytes = base64.b64decode(req.audio_data)
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                f.write(audio_bytes)
                tmp_path = f.name
        else:
            raise HTTPException(status_code=400, detail="audio_data required")
        
        print(f"[STT] Transcribing lang={req.language or 'auto'}")
        
        segments, info = model.transcribe(
            tmp_path,
            language=req.language,
            beam_size=5
        )
        text = " ".join(seg.text for seg in segments).strip()
        
        return {"text": text, "language": info.language, "duration": info.duration}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[STT Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

@app.post("/v1/audio/transcriptions/upload")
async def speech_to_text_upload(
    file: UploadFile = File(...),
    language: str | None = None
):
    tmp_path = None
    try:
        model = get_whisper()
        contents = await file.read()
        suffix = Path(file.filename).suffix or ".wav"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(contents)
            tmp_path = f.name
        
        segments, info = model.transcribe(tmp_path, language=language, beam_size=5)
        text = " ".join(seg.text for seg in segments).strip()
        return {"text": text, "language": info.language}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

# ==================== Health ====================

@app.get("/health")
def health():
    return {"status": "ok", "service": "python-tts-stt", "version": "0.1.0"}

# ==================== Main ====================

if __name__ == "__main__":
    port = int(os.getenv("PYTHON_PORT", "8081"))
    print(f"[Server] Starting on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
