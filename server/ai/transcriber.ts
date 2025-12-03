import OpenAI from "openai";

import { getVideoConfig, getAIConfig } from "@/config/server-config-loader";
import { aiLogger } from "@/server/logger";

export async function transcribeAudio(audioPath: string): Promise<string> {
  const [videoConfig, aiConfig] = await Promise.all([
    getVideoConfig(true), // Include secrets
    getAIConfig(true), // Include secrets (fallback for API key)
  ]);

  if (!videoConfig?.enabled) {
    throw new Error("Video parsing is not enabled. Enable it in admin settings.");
  }

  const provider = videoConfig.transcriptionProvider;

  if (provider === "disabled") {
    throw new Error(
      "Transcription is disabled. Configure a transcription provider in admin settings."
    );
  }

  // Get API key - prefer transcription-specific, fall back to AI config
  const apiKey = videoConfig.transcriptionApiKey || aiConfig?.apiKey;

  if (!apiKey) {
    throw new Error("No API key configured for transcription. Set it in admin settings.");
  }

  // Get endpoint for generic-openai provider
  const endpoint =
    provider === "generic-openai"
      ? videoConfig.transcriptionEndpoint || aiConfig?.endpoint
      : undefined;

  try {
    const client = new OpenAI({
      apiKey,
      ...(endpoint && { baseURL: endpoint }),
    });

    const fs = await import("node:fs");
    const audioFile = fs.createReadStream(audioPath);

    const response = await client.audio.transcriptions.create({
      file: audioFile,
      model: videoConfig.transcriptionModel || "whisper-1",
      language: "en", // Force English transcription (Whisper will translate if needed)
      response_format: "text",
    });

    if (!response || typeof response !== "string") {
      throw new Error("Invalid transcription response from OpenAI Whisper");
    }

    const transcript = response.trim();

    if (!transcript || transcript.length === 0) {
      throw new Error("Transcription returned empty text");
    }

    return transcript;
  } catch (error: any) {
    aiLogger.error({ err: error }, "Transcription failed");

    if (error.code === "ENOENT") {
      throw new Error("Audio file not found");
    }
    if (error.status === 429) {
      throw new Error("Rate limit exceeded on transcription service. Please try again later.");
    }
    if (error.status === 401 || error.status === 403) {
      throw new Error(
        `Invalid API key for transcription service. Check your API key in admin settings.`
      );
    }

    const errorMessage = error.message || "Unknown error";

    throw new Error(`Failed to transcribe audio: ${errorMessage}`);
  }
}
