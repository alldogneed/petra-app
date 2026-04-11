/**
 * Generates Hebrew voiceover using Google Gemini 2.5 TTS.
 * Uses your existing Gemini API key — no extra setup needed.
 *
 * Usage:
 *   GEMINI_KEY=AIza... npx tsx generate-voiceover.ts
 *
 * Output: public/voiceover/{scene-id}.wav
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { SCENES } from "./voiceover-config.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MODEL = "gemini-2.5-flash-preview-tts";
const VOICE = "Kore"; // clear female voice that handles Hebrew well
const OUTPUT_DIR = "public/voiceover";

/** Wraps raw PCM (16-bit, 24kHz, mono) in a WAV header */
function pcmToWav(pcm: Buffer): Buffer {
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcm.length;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);           // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

async function generateScene(
  sceneId: string,
  text: string,
  apiKey: string
): Promise<void> {
  console.log(`🎙  ${sceneId}: "${text.slice(0, 55)}..."`);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: VOICE },
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini TTS error [${sceneId}] ${response.status}: ${err}`);
  }

  const data = (await response.json()) as {
    candidates: Array<{
      content: { parts: Array<{ inlineData: { data: string; mimeType: string } }> };
    }>;
    error?: { message: string };
  };

  if (data.error) throw new Error(data.error.message);

  const part = data.candidates?.[0]?.content?.parts?.[0];
  if (!part?.inlineData?.data) {
    throw new Error(`No audio data returned for scene "${sceneId}"`);
  }

  const pcm = Buffer.from(part.inlineData.data, "base64");
  const wav = pcmToWav(pcm);
  const outPath = `${OUTPUT_DIR}/${sceneId}.wav`;
  writeFileSync(outPath, wav);

  const durationSec = (pcm.length / (24000 * 2)).toFixed(1);
  console.log(`    ✅ ${outPath} — ${durationSec}s (${(wav.length / 1024).toFixed(0)} KB)`);
}

async function main() {
  const apiKey = process.env.GEMINI_KEY;
  if (!apiKey) {
    console.error("❌  Missing GEMINI_KEY");
    console.error("    Run: GEMINI_KEY=AIza... npx tsx generate-voiceover.ts");
    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`\n🐾 Petra Voiceover — Gemini 2.5 TTS (${VOICE})\n`);

  for (let i = 0; i < SCENES.length; i++) {
    const scene = SCENES[i];
    const outPath = `${OUTPUT_DIR}/${scene.id}.wav`;

    if (existsSync(outPath)) {
      console.log(`⏭  ${scene.id} — already exists, skipping`);
      continue;
    }

    await generateScene(scene.id, scene.text, apiKey);

    // Free tier: 3 req/min → wait 22s between requests
    if (i < SCENES.length - 1) {
      const next = SCENES[i + 1];
      const nextPath = `${OUTPUT_DIR}/${next.id}.wav`;
      if (!existsSync(nextPath)) {
        console.log(`    ⏳ Waiting 22s (rate limit)...`);
        await sleep(22000);
      }
    }
  }

  console.log(`\n✅ Done! Refresh Remotion Studio to hear the audio.`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
