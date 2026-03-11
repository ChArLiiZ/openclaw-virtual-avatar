#!/usr/bin/env python3
"""
Virtual Avatar - Python TTS/STT Service
TTS: CosyVoice3 (zero-shot voice cloning, CUDA)
STT: faster-whisper (CUDA)

Install:
    pip install -r requirements.txt
    git clone --recursive https://github.com/FunAudioLLM/CosyVoice.git CosyVoice

Run:
    python server.py
"""

import os
import sys
import re
import io
import gc
import time
import threading
import tempfile
import base64
import shutil
import subprocess
import numpy as np
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
import soundfile as sf
import torch

app = FastAPI(title="Virtual Avatar Python Service", version="0.3.0")

# ==================== Paths ====================

DATA_DIR   = Path(__file__).parent / "data"
VOICES_DIR = DATA_DIR / "voices"     # 存放聲音參考音訊
DATA_DIR.mkdir(exist_ok=True)
VOICES_DIR.mkdir(exist_ok=True)

# CosyVoice repo path (cloned by start.bat or manually)
COSYVOICE_DIR = Path(__file__).parent / "CosyVoice"
COSYVOICE_MODEL = os.getenv("COSYVOICE_MODEL", "FunAudioLLM/Fun-CosyVoice3-0.5B-2512")

# 預設參考音訊（首次沒有自訂聲音時使用）
DEFAULT_REF_AUDIO = DATA_DIR / "default_ref.wav"
DEFAULT_REF_TEXT  = "Hello, this is a reference voice for CosyVoice."

# ==================== Lazy-load models ====================

_cosyvoice = None
_whisper   = None
MODEL_IDLE_SECONDS = int(os.getenv("MODEL_IDLE_SECONDS", "300"))
_last_request_ts = time.time()
_model_lock = threading.Lock()


def mark_model_activity():
    global _last_request_ts
    _last_request_ts = time.time()


def unload_models(reason: str = "manual"):
    global _cosyvoice, _whisper

    released = []
    with _model_lock:
        if _cosyvoice is not None:
            _cosyvoice = None
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
        if _cosyvoice is None and _whisper is None:
            continue
        unload_models(reason=f"idle>{MODEL_IDLE_SECONDS}s")


def get_cosyvoice():
    global _cosyvoice
    mark_model_activity()
    if _cosyvoice is None:
        # Add CosyVoice and its Matcha-TTS submodule to sys.path
        cosyvoice_root = str(COSYVOICE_DIR)
        matcha_path = str(COSYVOICE_DIR / "third_party" / "Matcha-TTS")
        for p in [cosyvoice_root, matcha_path]:
            if p not in sys.path:
                sys.path.insert(0, p)

        from cosyvoice.cli.cosyvoice import AutoModel
        print(f"[TTS] Loading CosyVoice3 model: {COSYVOICE_MODEL} (first load may download ~10GB)...")
        _cosyvoice = AutoModel(model_dir=COSYVOICE_MODEL)
        print(f"[TTS] CosyVoice3 loaded (sample_rate={_cosyvoice.sample_rate})")
    return _cosyvoice


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

    speed: float = 1.0

def get_voice_dir(voice: str) -> Path:
    return VOICES_DIR / voice

def get_voice_paths(voice: str) -> dict[str, Path]:
    voice_dir = get_voice_dir(voice)
    return {
        "dir": voice_dir,
        "audio": voice_dir / "ref.wav",
        "text": voice_dir / "ref.txt",
        "speaker": voice_dir / "speaker.pt",
    }

def speaker_file_exists(voice: str) -> bool:
    return get_voice_paths(voice)["speaker"].exists()

def read_voice_info(voice: str) -> dict:
    paths = get_voice_paths(voice)
    ref_text = ""
    if paths["text"].exists():
        ref_text = paths["text"].read_text(encoding="utf-8").strip()
    return {
        "name": voice,
        "ref_text": ref_text,
        "speaker_ready": paths["speaker"].exists(),
    }

def ensure_voice_assets(voice: str) -> tuple[str, str]:
    paths = get_voice_paths(voice)
    if paths["audio"].exists() and paths["text"].exists():
        return str(paths["audio"]), paths["text"].read_text(encoding="utf-8").strip()
    raise HTTPException(status_code=404, detail=f"Voice '{voice}' not found. Please upload a reference audio first.")

def get_ref_audio_path(voice: str) -> tuple[str, str]:
    """取得參考音訊路徑與對應文字"""
    try:
        return ensure_voice_assets(voice)
    except HTTPException:
        pass
    
    # 使用預設
    if DEFAULT_REF_AUDIO.exists():
        return str(DEFAULT_REF_AUDIO), DEFAULT_REF_TEXT
    
    raise HTTPException(status_code=404, detail=f"Voice '{voice}' not found. Please upload a reference audio first.")

# ── Sentence splitting for natural pauses ──

# Punctuation that should produce a longer pause (sentence boundaries)
_SENTENCE_RE = re.compile(r'(?<=[。！？!?\n])\s*')
# Punctuation that should produce a shorter pause (clause boundaries)
_CLAUSE_RE = re.compile(r'(?<=[，,、；;：:…—–])\s*')

# Silence durations in seconds
_SENTENCE_PAUSE = 0.45   # after 。！？
_CLAUSE_PAUSE   = 0.20   # after ，、；：…

def _split_sentences(text: str) -> list[tuple[str, float]]:
    """Split text into segments with pause durations after each segment.

    Returns a list of (segment_text, pause_seconds) tuples.
    The last segment has 0 pause.
    """
    text = text.strip()
    if not text:
        return []

    # First split on sentence-ending punctuation
    sentences = _SENTENCE_RE.split(text)

    result: list[tuple[str, float]] = []
    for i, sentence in enumerate(sentences):
        sentence = sentence.strip()
        if not sentence:
            continue

        # Further split long sentences on clause punctuation
        clauses = _CLAUSE_RE.split(sentence)
        for j, clause in enumerate(clauses):
            clause = clause.strip()
            if not clause:
                continue

            # Determine pause: last clause of sentence gets sentence pause,
            # mid-sentence clauses get clause pause, very last segment gets 0
            is_last_overall = (i == len(sentences) - 1) and (j == len(clauses) - 1)
            is_last_clause = (j == len(clauses) - 1)

            if is_last_overall:
                pause = 0.0
            elif is_last_clause:
                pause = _SENTENCE_PAUSE
            else:
                pause = _CLAUSE_PAUSE

            result.append((clause, pause))

    return result if result else [(text, 0.0)]


def _make_silence(sr: int, seconds: float) -> np.ndarray:
    """Create a silence array of the given duration."""
    return np.zeros(int(sr * seconds), dtype=np.float32)

def load_voice_speaker(voice: str, model=None):
    paths = get_voice_paths(voice)
    speaker_path = paths["speaker"]
    if not speaker_path.exists():
        raise HTTPException(status_code=404, detail=f"Speaker for voice '{voice}' not found. Train it first.")

    cosy = model or get_cosyvoice()
    speaker_payload = torch.load(speaker_path, map_location=cosy.frontend.device, weights_only=True)
    cosy.frontend.spk2info[voice] = speaker_payload.get(voice, speaker_payload)
    return cosy.frontend.spk2info[voice]

def train_voice_speaker(voice: str):
    model = get_cosyvoice()
    ref_audio, ref_text = ensure_voice_assets(voice)
    prompt_text = f"You are a helpful assistant.<|endofprompt|>{ref_text}"

    if voice in model.frontend.spk2info:
        del model.frontend.spk2info[voice]

    model.add_zero_shot_spk(prompt_text, ref_audio, voice)
    speaker_info = model.frontend.spk2info[voice]
    torch.save({voice: speaker_info}, get_voice_paths(voice)["speaker"])
    print(f"[Voice] Trained speaker '{voice}'")
    return read_voice_info(voice)


@app.post("/v1/audio/speech")
async def text_to_speech(req: TTSRequest):
    mark_model_activity()
    try:
        model = get_cosyvoice()
        if not speaker_file_exists(req.voice):
            raise HTTPException(status_code=409, detail=f"Speaker for voice '{req.voice}' is not trained yet.")
        load_voice_speaker(req.voice, model)

        segments = _split_sentences(req.input)
        print(f"[TTS] voice={req.voice} segments={len(segments)} text={req.input[:60]}...")

        sr_out = model.sample_rate
        audio_parts: list[np.ndarray] = []

        for seg_text, pause in segments:
            for chunk in model.inference_zero_shot(
                tts_text=seg_text,
                prompt_text="",
                prompt_wav="",
                zero_shot_spk_id=req.voice,
                stream=False,
                speed=req.speed,
            ):
                # chunk['tts_speech'] is a torch tensor of shape (1, N)
                wav = chunk['tts_speech'].squeeze(0).cpu().numpy()
                audio_parts.append(wav)

            if pause > 0:
                audio_parts.append(_make_silence(sr_out, pause))

        if not audio_parts:
            raise HTTPException(status_code=400, detail="No audio generated (empty input?)")

        combined = np.concatenate(audio_parts)

        buf = io.BytesIO()
        sf.write(buf, combined, sr_out, format="WAV")
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
            voices.append(read_voice_info(d.name))
    return {"voices": voices}

@app.post("/voices/{voice_name}")
async def upload_voice(
    voice_name: str,
    audio: UploadFile = File(...),
    ref_text: str = Form(...),
):
    """上傳聲音參考音訊（供克隆使用）"""
    voice_dir = get_voice_dir(voice_name)
    voice_dir.mkdir(exist_ok=True)
    paths = get_voice_paths(voice_name)
    
    # 儲存音訊
    contents = await audio.read()
    paths["audio"].write_bytes(contents)
    
    # 儲存對應文字
    paths["text"].write_text(ref_text, encoding="utf-8")
    if paths["speaker"].exists():
        paths["speaker"].unlink()
    if _cosyvoice is not None and voice_name in _cosyvoice.frontend.spk2info:
        del _cosyvoice.frontend.spk2info[voice_name]
    
    print(f"[Voice] Saved voice '{voice_name}': {len(contents)} bytes")
    return {"status": "ok", "voice": voice_name, "ref_text": ref_text, "speaker_ready": False}

@app.post("/voices/{voice_name}/train")
def train_voice(voice_name: str):
    mark_model_activity()
    try:
        info = train_voice_speaker(voice_name)
        return {"status": "ok", "voice": voice_name, "speaker_ready": True, "voice_info": info}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Voice Train Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/voices/{voice_name}")
def delete_voice(voice_name: str):
    """刪除聲音"""
    voice_dir = get_voice_dir(voice_name)
    if not voice_dir.exists():
        raise HTTPException(status_code=404, detail="Voice not found")
    if _cosyvoice is not None and voice_name in _cosyvoice.frontend.spk2info:
        del _cosyvoice.frontend.spk2info[voice_name]
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
        "version": "0.3.0",
        "tts": "cosyvoice3",
        "model_idle_seconds": MODEL_IDLE_SECONDS,
        "models_loaded": {
            "tts": _cosyvoice is not None,
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
