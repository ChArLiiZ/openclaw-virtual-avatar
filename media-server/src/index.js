/**
 * Virtual Avatar Media Server
 *
 * Provides HTTP API for:
 * - TTS (Text-to-Speech) using F5-TTS via Python service
 * - STT (Speech-to-Text) using faster-whisper via Python service
 * - Live2D/VRM model control
 *
 * Run: npm install && npm start
 */

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import multer from 'multer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// Config
const CONFIG = {
  pythonServiceUrl: process.env.PYTHON_SERVICE_URL || 'http://localhost:8081',
  live2dModelPath: process.env.LIVE2D_MODEL_PATH || './models',
};

// Proxy helper to Python service
async function proxyToPython(endpoint, body) {
  const url = `${CONFIG.pythonServiceUrl}${endpoint}`;
  const pyRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!pyRes.ok) {
    const err = await pyRes.text();
    throw new Error(`Python service error: ${pyRes.status} ${err}`);
  }
  return pyRes;
}

// Proxy voice endpoints
app.post('/voices/:voiceName', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'audio file is required' });
    }
    if (!req.body.ref_text) {
      return res.status(400).json({ error: 'ref_text is required' });
    }

    const formData = new FormData();
    formData.append('audio', new Blob([req.file.buffer]), req.file.originalname || 'ref.wav');
    formData.append('ref_text', req.body.ref_text);

    const url = `${CONFIG.pythonServiceUrl}/voices/${req.params.voiceName}`;
    const pyRes = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!pyRes.ok) {
      const err = await pyRes.text();
      throw new Error(`Python service error: ${pyRes.status} ${err}`);
    }

    const result = await pyRes.json();
    res.json(result);
  } catch (error) {
    console.error('[Voice Upload Error]', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/voices', async (req, res) => {
  try {
    const pyRes = await fetch(`${CONFIG.pythonServiceUrl}/voices`);
    const result = await pyRes.json();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/voices/:voiceName', async (req, res) => {
  try {
    const pyRes = await fetch(`${CONFIG.pythonServiceUrl}/voices/${req.params.voiceName}`, {
      method: 'DELETE',
    });
    const result = await pyRes.json();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== TTS Endpoints ====================

/**
 * POST /v1/audio/speech
 * Text-to-Speech using Kokoro
 * 
 * Body: { input: string, voice?: string, speed?: number }
 * Returns: { audio_url?: string, audio_data?: string }
 */
app.post('/v1/audio/speech', async (req, res) => {
  try {
    const { input, voice, speed } = req.body;
    
    if (!input) {
      return res.status(400).json({ error: 'input is required' });
    }

    console.log(`[TTS] Generating speech for: ${input.substring(0, 50)}...`);
    console.log(`[TTS] Voice: ${voice || 'default'}, Speed: ${speed || 1.0}`);

    const pyRes = await proxyToPython('/v1/audio/speech', {
      input,
      voice: voice || 'zf_xiaobei',
      speed: speed || 1.0,
      lang: req.body.lang || 'zh',
    });
    
    // Stream WAV audio back
    res.set('Content-Type', 'audio/wav');
    const buf = Buffer.from(await pyRes.arrayBuffer());
    res.send(buf);
  } catch (error) {
    console.error('[TTS Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== STT Endpoints ====================

/**
 * POST /v1/audio/transcriptions
 * Speech-to-Text using faster-whisper via Python service
 *
 * Accepts multipart file upload or base64 audio_data.
 */
app.post('/v1/audio/transcriptions', upload.single('audio'), async (req, res) => {
  try {
    const language = req.body.language;
    let audioData = req.body.audio_data || null;

    if (req.file?.buffer) {
      audioData = req.file.buffer.toString('base64');
      console.log(`[STT] Processing uploaded file: ${req.file.originalname || 'audio'}`);
    } else if (audioData) {
      console.log('[STT] Processing base64 audio payload');
    } else {
      return res.status(400).json({ error: 'audio file is required' });
    }

    console.log(`[STT] Language: ${language || 'auto'}`);

    const pyRes = await proxyToPython('/v1/audio/transcriptions', {
      audio_data: audioData,
      language: language || null,
    });
    const result = await pyRes.json();

    res.json(result);
  } catch (error) {
    console.error('[STT Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Live2D Endpoints ====================

/**
 * POST /live2d/express
 * Control Live2D model expressions
 * 
 * Body: { expression?: string, blink?: boolean, mouth_open?: number, look_at_x?: number, look_at_y?: number }
 */
app.post('/live2d/express', async (req, res) => {
  try {
    const { expression, blink, mouth_open, look_at_x, look_at_y } = req.body;
    
    console.log(`[Live2D] Expression: ${expression}, Blink: ${blink}`);
    
    // TODO: Integrate with Live2D viewer/controller
    // Options:
    // 1. Vtuber Studio HTTP API
    // 2. AIRI stage-ui
    // 3. Custom WebSocket server for Live2D
    
    res.json({
      message: 'Live2D express endpoint ready',
      received: { expression, blink, mouth_open, look_at_x, look_at_y },
      note: 'Integrate with Vtuber Studio or AIRI stage-ui'
    });
  } catch (error) {
    console.error('[Live2D Error]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /live2d/load
 * Load a different Live2D/VRM model
 */
app.post('/live2d/load', async (req, res) => {
  try {
    const { model_path } = req.body;
    
    if (!model_path) {
      return res.status(400).json({ error: 'model_path is required' });
    }
    
    console.log(`[Live2D] Loading model: ${model_path}`);
    
    res.json({
      message: 'Live2D load endpoint ready',
      model_path,
      note: 'Integrate with Live2D viewer'
    });
  } catch (error) {
    console.error('[Live2D Load Error]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /live2d/frame
 * Get current Live2D model frame as image
 */
app.get('/live2d/frame', async (req, res) => {
  try {
    // TODO: Return current frame as image
    res.json({
      message: 'Live2D frame endpoint ready',
      note: 'Integrate with Live2D rendering engine'
    });
  } catch (error) {
    console.error('[Live2D Frame Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Health Check ====================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    server: 'virtual-avatar-media-server',
    version: '0.1.0',
    endpoints: [
      'POST /v1/audio/speech',
      'POST /v1/audio/transcriptions',
      'POST /live2d/express',
      'POST /live2d/load',
      'GET /live2d/frame'
    ]
  });
});

// ==================== Start Server ====================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Virtual Avatar Media Server                                ║
║  Listening on http://localhost:${PORT}                        ║
║                                                            ║
║  Endpoints:                                                ║
║  - POST /v1/audio/speech       (TTS)                       ║
║  - POST /v1/audio/transcriptions (STT)                     ║
║  - POST /live2d/express        (Live2D control)            ║
║  - POST /live2d/load           (Load model)                 ║
║  - GET  /live2d/frame          (Get frame)                 ║
╚════════════════════════════════════════════════════════════╝
  `);
});
