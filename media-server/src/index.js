/**
 * Virtual Avatar Media Server
 * 
 * Provides HTTP API for:
 * - TTS (Text-to-Speech) using Kokoro
 * - STT (Speech-to-Text) using whisper.cpp
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
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// Config
const CONFIG = {
  kokoroPath: process.env.KOKORO_PATH || './kokoro',
  whisperModelPath: process.env.WHISPER_MODEL_PATH || './models/ggml-base.bin',
  live2dModelPath: process.env.LIVE2D_MODEL_PATH || './models',
};

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

    // TODO: Integrate Kokoro TTS
    // For now, return a placeholder response
    // In production, you would:
    // 1. Call Kokoro CLI: ./kokoro -t "Hello" -v af_sarah -o output.wav
    // 2. Read the audio file and return it as base64 or a URL
    
    // Placeholder - replace with actual Kokoro integration
    const response = {
      message: 'TTS endpoint ready - integrate Kokoro CLI here',
      input,
      voice: voice || 'af_sarah',
      speed: speed || 1.0,
      note: 'Install Kokoro and configure kokoroPath in config'
    };
    
    res.json(response);
  } catch (error) {
    console.error('[TTS Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== STT Endpoints ====================

/**
 * POST /v1/audio/transcriptions
 * Speech-to-Text using whisper.cpp
 * 
 * Body: { audio_url?: string, audio_data?: string, language?: string }
 * Returns: { text?: string }
 */
app.post('/v1/audio/transcriptions', upload.single('audio'), async (req, res) => {
  try {
    let audioPath = req.body.audio_path;
    const language = req.body.language;
    
    // Handle file upload
    if (req.file) {
      audioPath = req.file.path;
    } else if (req.body.audio_data) {
      // Decode base64 audio and save to temp file
      const buffer = Buffer.from(req.body.audio_data, 'base64');
      audioPath = '/tmp/input_audio.wav';
      fs.writeFileSync(audioPath, buffer);
    }

    if (!audioPath) {
      return res.status(400).json({ error: 'audio file is required' });
    }

    console.log(`[STT] Processing: ${audioPath}`);
    console.log(`[STT] Language: ${language || 'auto'}`);

    // TODO: Integrate whisper.cpp
    // In production, you would:
    // 1. Run: ./main -m models/ggml-base.bin -f input.wav
    // 2. Parse the output text
    
    // Placeholder
    const response = {
      message: 'STT endpoint ready - integrate whisper.cpp here',
      audio_path: audioPath,
      language: language || 'auto',
      note: 'Install whisper.cpp and configure whisperModelPath in config'
    };
    
    // Clean up temp file
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    
    res.json(response);
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
