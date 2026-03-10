import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

interface RemoteMediaConfig {
  serverUrl: string;
  defaultTtsVoice?: string;
  defaultModel?: string;
}

const PLUGIN_ID = "openclaw-virtual-avatar";

function getConfig(api: OpenClawPluginApi): RemoteMediaConfig {
  const config = api.runtime.config.get(`plugins.entries.${PLUGIN_ID}`);
  return (config as RemoteMediaConfig) || { serverUrl: "" };
}

function getServerUrl(serverUrl: string, endpoint: string): string {
  return `${serverUrl.replace(/\/$/, "")}${endpoint}`;
}

async function callMediaServer(
  serverUrl: string,
  endpoint: string,
  body: object
): Promise<any> {
  const response = await fetch(getServerUrl(serverUrl, endpoint), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Media server error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function readBinaryAsBase64(response: Response): Promise<string> {
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString("base64");
}

async function resolveAudioData(audioUrl?: string): Promise<string | undefined> {
  if (!audioUrl) {
    return undefined;
  }

  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch audioUrl: ${response.status} ${response.statusText}`);
  }

  return readBinaryAsBase64(response);
}

const remoteMediaPlugin = {
  id: "openclaw-virtual-avatar",
  configSchema: {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      serverUrl: { type: "string" },
      defaultTtsVoice: { type: "string" },
      defaultModel: { type: "string" },
    },
    required: ["serverUrl"],
  },
  register(api: OpenClawPluginApi) {
    // Tool: Remote TTS - Text to Speech
    api.registerTool({
      name: "remote_tts",
      description: "Convert text to speech using local TTS engine. Returns base64 audio plus metadata.",
      parameters: Type.Object({
        text: Type.String({ description: "Text to convert to speech" }),
        voice: Type.Optional(Type.String({ description: "Voice ID to use" })),
        speed: Type.Optional(Type.Number({ description: "Speech speed (0.5-2.0)", default: 1.0 })),
        lang: Type.Optional(Type.String({ description: "Language code passed to media server", default: "zh" })),
      }),
      async execute(_id, params, ctx) {
        const config = getConfig(api);

        try {
          const response = await fetch(getServerUrl(config.serverUrl, "/v1/audio/speech"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              input: params.text,
              voice: params.voice || config.defaultTtsVoice || "vivian",
              speed: params.speed || 1.0,
              lang: params.lang || "zh",
            }),
          });

          if (!response.ok) {
            throw new Error(`Media server error: ${response.status} ${response.statusText}`);
          }

          const contentType = response.headers.get("content-type") || "audio/wav";
          const audioBase64 = await readBinaryAsBase64(response);

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                contentType,
                audioBase64,
              }),
            }],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `TTS error: ${error}` }],
            isError: true,
          };
        }
      },
    });

    // Tool: Remote STT - Speech to Text
    api.registerTool({
      name: "remote_stt",
      description: "Convert speech audio to text using local STT engine (whisper.cpp)",
      parameters: Type.Object({
        audioUrl: Type.Optional(Type.String({ description: "URL or path to audio file" })),
        audioData: Type.Optional(Type.String({ description: "Base64 encoded audio data" })),
        language: Type.Optional(Type.String({ description: "Language code (e.g., zh, ja, en)" })),
      }),
      async execute(_id, params, ctx) {
        const config = getConfig(api);

        try {
          const audioData = params.audioData || await resolveAudioData(params.audioUrl);
          if (!audioData) {
            throw new Error("audioUrl or audioData is required");
          }

          const result = await callMediaServer(
            config.serverUrl,
            "/v1/audio/transcriptions",
            {
              audio_data: audioData,
              language: params.language,
            }
          );

          return {
            content: [{ type: "text", text: result.text || result.texts?.[0] || "" }],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `STT error: ${error}` }],
            isError: true,
          };
        }
      },
    });

    // Tool: Live2D Express - Control model expressions
    api.registerTool({
      name: "live2d_express",
      description: "Control Live2D/VRM model expressions (blink, mouth_open, look_at, etc.)",
      parameters: Type.Object({
        expression: Type.Optional(Type.String({ description: "Expression name (happy, sad, surprised, etc.)" })),
        blink: Type.Optional(Type.Boolean({ description: "Trigger blink" })),
        mouthOpen: Type.Optional(Type.Number({ description: "Mouth open amount (0-1)", default: 0 })),
        lookAtX: Type.Optional(Type.Number({ description: "Look at X position (-1 to 1)", default: 0 })),
        lookAtY: Type.Optional(Type.Number({ description: "Look at Y position (-1 to 1)", default: 0 })),
      }),
      async execute(_id, params, ctx) {
        const config = getConfig(api);
        
        try {
          const result = await callMediaServer(
            config.serverUrl,
            "/live2d/express",
            {
              expression: params.expression,
              blink: params.blink,
              mouth_open: params.mouthOpen,
              look_at_x: params.lookAtX,
              look_at_y: params.lookAtY,
            }
          );
          
          return {
            content: [{ type: "text", text: JSON.stringify(result) }],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Live2D error: ${error}` }],
            isError: true,
          };
        }
      },
    });

    // Tool: Live2D Load Model
    api.registerTool({
      name: "live2d_load_model",
      description: "Load a different Live2D or VRM model",
      parameters: Type.Object({
        modelPath: Type.String({ description: "Path or URL to model file (.model3.json, .vrm)" }),
      }),
      async execute(_id, params, ctx) {
        const config = getConfig(api);
        
        try {
          const result = await callMediaServer(
            config.serverUrl,
            "/live2d/load",
            {
              model_path: params.modelPath,
            }
          );
          
          return {
            content: [{ type: "text", text: JSON.stringify(result) }],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Live2D load error: ${error}` }],
            isError: true,
          };
        }
      },
    });

    // Tool: Get Live2D Frame (for sending to OpenClaw)
    api.registerTool({
      name: "live2d_get_frame",
      description: "Get current Live2D model frame as image for display",
      parameters: Type.Object({}),
      async execute(_id, params, ctx) {
        const config = getConfig(api);
        
        try {
          const result = await callMediaServer(
            config.serverUrl,
            "/live2d/frame",
            {}
          );
          
          // Return the image URL or base64
          return {
            content: [{ 
              type: "text", 
              text: result.image_url || result.image_data || "" 
            }],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Live2D frame error: ${error}` }],
            isError: true,
          };
        }
      },
    });
  },
};

export default remoteMediaPlugin;
