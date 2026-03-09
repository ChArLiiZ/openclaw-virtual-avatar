#!/usr/bin/env python3
"""
Virtual Avatar - Python TTS/STT Service
TTS: Kokoro (CUDA)
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

# ==================== Lazy-load models ====================
_kokoro = None
_whisper = None

def get_kokoro():
    global _kokoro
    if _kokoro is None:
        from kokoro import KPipeline
        # 'z' = Chinese (zh), 'j' = Japanese (ja), 'a' = English (en-us)
        # We'll load Chinese by default; switch per request
        _kokoro = {}
        print("[TTS] Kokoro models will be loaded on first use")
    return _kokoro

def get_pipeline(lang: str):
    kokoro = get_kokoro()
    if lang not in kokoro:
        from kokoro import KPipeline
        lang_code = {
            "zh": "z",
            "ja": "j",
            "en": "a",
        }.get(lang, "a")
        print(f"[TTS] Loading Kokoro pipeline for lang={lang} (code={lang_code})")
        kokoro[lang] = KPipeline(lang_code=lang_code)
    return kokoro[lang]

def get_whisper():
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel
        # Use GPU if available
        model_size = os.getenv("WHISPER_MODEL", "base")
        print(f"[STT] Loading faster-whisper model: {model_size}")
        _whisper = WhisperModel(model_size, device="cuda", compute_type="float16")
        print("[STT] faster-whisper loaded on CUDA")
    return _whisper

# ==================== TTS ====================

class TTSRequest(BaseModel):
    input: str
    voice: str = "zf_xiaobei"   # default: Chinese female
    speed: float = 1.0
    lang: str = "zh"             # zh / ja / en

@app.post("/v1/audio/speech")
async def text_to_speech(req: TTSRequest):
    try:
        pipeline = get_pipeline(req.lang)
        
        print(f"[TTS] Generating: {req.input[:60]}... voice={req.voice}")
        
        audio_chunks = []
        sample_rate = 24000
        
        generator = pipeline(
            req.input,
            voice=req.voice,
            speed=req.speed,
            split_pattern=r'\n+'
        )
        
        for _, _, audio in generator:
            if audio is not None:
                audio_chunks.append(audio)
        
        if not audio_chunks:
            raise HTTPException(status_code=500, detail="No audio generated")
        
        audio_data = np.concatenate(audio_chunks)
        
        # Write to WAV in memory
        buf = io.BytesIO()
        sf.write(buf, audio_data, sample_rate, format='WAV')
        buf.seek(0)
        
        return StreamingResponse(
            buf,
            media_type="audio/wav",
            headers={"Content-Disposition": "attachment; filename=speech.wav"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== STT ====================

class STTRequest(BaseModel):
    audio_data: str | None = None   # base64 encoded audio
    audio_url: str | None = None
    language: str | None = None

@app.post("/v1/audio/transcriptions")
async def speech_to_text(req: STTRequest):
    try:
        model = get_whisper()
        
        tmp_path = None
        
        if req.audio_data:
            audio_bytes = base64.b64decode(req.audio_data)
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                f.write(audio_bytes)
                tmp_path = f.name
        else:
            raise HTTPException(status_code=400, detail="audio_data required")
        
        print(f"[STT] Transcribing: {tmp_path}, lang={req.language or 'auto'}")
        
        segments, info = model.transcribe(
            tmp_path,
            language=req.language,
            beam_size=5
        )
        
        text = " ".join(seg.text for seg in segments).strip()
        
        return {
            "text": text,
            "language": info.language,
            "duration": info.duration
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

# File upload endpoint for STT
@app.post("/v1/audio/transcriptions/upload")
async def speech_to_text_upload(
    file: UploadFile = File(...),
    language: str | None = None
):
    try:
        model = get_whisper()
        
        contents = await file.read()
        with tempfile.NamedTemporaryFile(suffix=Path(file.filename).suffix or ".wav", delete=False) as f:
            f.write(contents)
            tmp_path = f.name
        
        print(f"[STT] Transcribing uploaded file: {file.filename}, lang={language or 'auto'}")
        
        segments, info = model.transcribe(tmp_path, language=language, beam_size=5)
        text = " ".join(seg.text for seg in segments).strip()
        
        return {"text": text, "language": info.language}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(tmp_path):
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
