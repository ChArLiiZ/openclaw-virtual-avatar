#!/usr/bin/env python3
"""
Virtual Avatar - Python TTS/STT Service
TTS: F5-TTS (zero-shot voice cloning, CUDA)
STT: faster-whisper (CUDA)

Install:
    pip install -r requirements.txt

Run:
    python server.py
"""

import os
import io
import gc
import time
import threading
import tempfile
import base64
import shutil
import subprocess
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
import soundfile as sf

app = FastAPI(title="Virtual Avatar Python Service", version="0.2.0")

# ==================== Paths ====================

DATA_DIR   = Path(__file__).parent / "data"
VOICES_DIR = DATA_DIR / "voices"     # 存放聲音參考音訊
DATA_DIR.mkdir(exist_ok=True)
VOICES_DIR.mkdir(exist_ok=True)

# 預設參考音訊（首次沒有自訂聲音時使用）
DEFAULT_REF_AUDIO = DATA_DIR / "default_ref.wav"
DEFAULT_REF_TEXT  = "Hello, this is a reference voice for F5-TTS."

# ==================== Lazy-load models ====================

_f5tts   = None
_whisper = None
MODEL_IDLE_SECONDS = int(os.getenv("MODEL_IDLE_SECONDS", "300"))
_last_request_ts = time.time()
_model_lock = threading.Lock()


def mark_model_activity():
    global _last_request_ts
    _last_request_ts = time.time()


def unload_models(reason: str = "manual"):
    global _f5tts, _whisper

    released = []
    with _model_lock:
        if _f5tts is not None:
            _f5tts = None
            released.append("tts")
        if _whisper is not None:
            _whisper = None
            released.append("stt")

    gc.collect()

    try:
        import torch  # type: ignore
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass

    if released:
        print(f"[Models] Unloaded ({', '.join(released)}) reason={reason}")


def idle_unload_worker():
    if MODEL_IDLE_SECONDS <= 0:
        print("[Models] Idle auto-unload disabled")
        return

    print(f"[Models] Idle auto-unload enabled: {MODEL_IDLE_SECONDS}s")
    while True:
        time.sleep(min(30, max(5, MODEL_IDLE_SECONDS // 2 or 5)))
        idle_for = time.time() - _last_request_ts
        if idle_for < MODEL_IDLE_SECONDS:
            continue
        if _f5tts is None and _whisper is None:
            continue
        unload_models(reason=f"idle>{MODEL_IDLE_SECONDS}s")


def get_f5tts():
    global _f5tts
    mark_model_activity()
    if _f5tts is None:
        from f5_tts.api import F5TTS
        print("[TTS] Loading F5-TTS model (first load may take a moment)...")
        _f5tts = F5TTS()
        print("[TTS] F5-TTS loaded")
    return _f5tts


def get_whisper():
    global _whisper
    mark_model_activity()
    if _whisper is None:
        from faster_whisper import WhisperModel
        model_size = os.getenv("WHISPER_MODEL", "medium")
        print(f"[STT] Loading faster-whisper: {model_size}")
        _whisper = WhisperModel(model_size, device="cuda", compute_type="float16")
        print("[STT] faster-whisper loaded")
    return _whisper

# ==================== TTS ====================

class TTSRequest(BaseModel):
    input: str
    voice: str = "default"   # 對應 voices/ 資料夾內的聲音名稱
    speed: float = 1.0

def get_ref_audio_path(voice: str) -> tuple[str, str]:
    """取得參考音訊路徑與對應文字"""
    voice_dir = VOICES_DIR / voice
    audio_path = voice_dir / "ref.wav"
    text_path  = voice_dir / "ref.txt"

    if audio_path.exists() and text_path.exists():
        return str(audio_path), text_path.read_text(encoding="utf-8").strip()
    
    # 使用預設
    if DEFAULT_REF_AUDIO.exists():
        return str(DEFAULT_REF_AUDIO), DEFAULT_REF_TEXT
    
    raise HTTPException(status_code=404, detail=f"Voice '{voice}' not found. Please upload a reference audio first.")

@app.post("/v1/audio/speech")
async def text_to_speech(req: TTSRequest):
    mark_model_activity()
    try:
        model = get_f5tts()
        ref_audio, ref_text = get_ref_audio_path(req.voice)
        
        print(f"[TTS] voice={req.voice} text={req.input[:60]}...")
        
        # F5-TTS 推理
        wav, sr, _ = model.infer(
            ref_file=ref_audio,
            ref_text=ref_text,
            gen_text=req.input,
            speed=req.speed,
        )
        
        buf = io.BytesIO()
        sf.write(buf, wav, sr, format="WAV")
        buf.seek(0)
        
        return StreamingResponse(
            buf,
            media_type="audio/wav",
            headers={"Content-Disposition": "attachment; filename=speech.wav"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[TTS Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== 聲音克隆管理 ====================

@app.get("/voices")
def list_voices():
    """列出所有已儲存的聲音"""
    voices = []
    for d in VOICES_DIR.iterdir():
        if d.is_dir() and (d / "ref.wav").exists():
            voices.append(d.name)
    return {"voices": voices}

@app.post("/voices/{voice_name}")
async def upload_voice(
    voice_name: str,
    audio: UploadFile = File(...),
    ref_text: str = Form(...),
):
    """上傳聲音參考音訊（供克隆使用）"""
    voice_dir = VOICES_DIR / voice_name
    voice_dir.mkdir(exist_ok=True)
    
    audio_path = voice_dir / "ref.wav"
    text_path  = voice_dir / "ref.txt"
    
    # 儲存音訊
    contents = await audio.read()
    audio_path.write_bytes(contents)
    
    # 儲存對應文字
    text_path.write_text(ref_text, encoding="utf-8")
    
    print(f"[Voice] Saved voice '{voice_name}': {len(contents)} bytes")
    return {"status": "ok", "voice": voice_name, "ref_text": ref_text}

@app.delete("/voices/{voice_name}")
def delete_voice(voice_name: str):
    """刪除聲音"""
    voice_dir = VOICES_DIR / voice_name
    if not voice_dir.exists():
        raise HTTPException(status_code=404, detail="Voice not found")
    shutil.rmtree(voice_dir)
    return {"status": "ok", "deleted": voice_name}

# ==================== STT ====================

class STTRequest(BaseModel):
    audio_data: str | None = None
    language: str | None = None


def preprocess_audio_for_stt(input_path: str) -> str:
    """Lightweight preprocessing for Whisper: mono + 16kHz + mild highpass."""
    fd, output_path = tempfile.mkstemp(suffix="_stt.wav")
    os.close(fd)

    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-ac", "1",
        "-ar", "16000",
        "-af", "highpass=f=80",
        "-c:a", "pcm_s16le",
        output_path,
    ]

    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return output_path
    except Exception:
        if os.path.exists(output_path):
            os.unlink(output_path)
        raise


@app.post("/v1/audio/transcriptions")
async def speech_to_text(req: STTRequest):
    mark_model_activity()
    tmp_path = None
    processed_path = None
    try:
        model = get_whisper()
        
        if not req.audio_data:
            raise HTTPException(status_code=400, detail="audio_data required")
        
        audio_bytes = base64.b64decode(req.audio_data)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        processed_path = preprocess_audio_for_stt(tmp_path)
        
        segments, info = model.transcribe(
            processed_path,
            language=req.language,
            beam_size=5,
            vad_filter=True,
            condition_on_previous_text=False,
            temperature=0.0,
        )
        text = " ".join(seg.text for seg in segments).strip()
        
        return {"text": text, "language": info.language, "duration": info.duration}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        if processed_path and os.path.exists(processed_path):
            os.unlink(processed_path)

@app.post("/v1/audio/transcriptions/upload")
async def speech_to_text_upload(
    file: UploadFile = File(...),
    language: str | None = None,
):
    mark_model_activity()
    tmp_path = None
    processed_path = None
    try:
        model = get_whisper()
        suffix = Path(file.filename).suffix or ".wav"
        contents = await file.read()
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(contents)
            tmp_path = f.name

        processed_path = preprocess_audio_for_stt(tmp_path)
        
        segments, info = model.transcribe(
            processed_path,
            language=language,
            beam_size=5,
            vad_filter=True,
            condition_on_previous_text=False,
            temperature=0.0,
        )
        text = " ".join(seg.text for seg in segments).strip()
        return {"text": text, "language": info.language}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        if processed_path and os.path.exists(processed_path):
            os.unlink(processed_path)

# ==================== Health ====================

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "python-tts-stt",
        "version": "0.2.0",
        "tts": "f5-tts",
        "model_idle_seconds": MODEL_IDLE_SECONDS,
        "models_loaded": {
            "tts": _f5tts is not None,
            "stt": _whisper is not None,
        },
    }


@app.on_event("startup")
def startup_event():
    mark_model_activity()
    thread = threading.Thread(target=idle_unload_worker, daemon=True)
    thread.start()

# ==================== Main ====================

if __name__ == "__main__":
    port = int(os.getenv("PYTHON_PORT", "8081"))
    print(f"[Server] Starting on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
