const fs = require("fs");
const path = require("path");

const configContent = fs.readFileSync(
  path.join(__dirname, "../voiceover-settings-config.ts"),
  "utf8"
);
const cleaned = configContent
  .replace(/export const SETTINGS_SCENES =/, "var SETTINGS_SCENES =")
  .replace(/ as const;/, ";")
  .replace(/^\/\/.*/gm, "");
eval(cleaned);

const API_KEY = process.env.GEMINI_KEY || process.env.GEMINI_API_KEY;
const OUT_DIR = path.join(__dirname, "../public/voiceover");

const HEBREW_PREFIX =
  "דבר בעברית ישראלית טבעית ורהוטה. קצב דיבור רגיל לחלוטין — לא מהיר ולא איטי, כמו שיחה יומיומית מקצועית. הגייה ברורה, ניקוד נכון, ללא הפסקות מיותרות. הטקסט:\n\n";

function buildWav(pcmData, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const dataSize = pcmData.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28);
  header.writeUInt16LE(channels * bitsPerSample / 8, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmData]);
}

async function generateOne(scene) {
  const outPath = path.join(OUT_DIR, `${scene.id}.wav`);
  if (fs.existsSync(outPath)) {
    console.log(`SKIP (exists): ${scene.id}`);
    return;
  }
  console.log(`Generating: ${scene.id} ...`);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: HEBREW_PREFIX + scene.text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } },
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini error [${scene.id}] ${response.status}: ${err}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  const part = data.candidates?.[0]?.content?.parts?.[0];
  if (!part?.inlineData?.data) throw new Error(`No audio data for ${scene.id}`);

  const rawBuffer = Buffer.from(part.inlineData.data, "base64");
  const wavBuffer = buildWav(rawBuffer);
  fs.writeFileSync(outPath, wavBuffer);

  const durSec = (rawBuffer.length / 48000).toFixed(1);
  console.log(`  -> ${outPath} — ${durSec}s (${(wavBuffer.length / 1024).toFixed(0)} KB)`);
}

async function main() {
  if (!API_KEY) {
    console.error("ERROR: set GEMINI_KEY or GEMINI_API_KEY");
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (let i = 0; i < SETTINGS_SCENES.length; i++) {
    await generateOne(SETTINGS_SCENES[i]);
    if (i < SETTINGS_SCENES.length - 1) {
      const nextPath = path.join(OUT_DIR, `${SETTINGS_SCENES[i + 1].id}.wav`);
      if (!fs.existsSync(nextPath)) {
        console.log("  waiting 22s (rate limit)...");
        await new Promise(r => setTimeout(r, 22000));
      }
    }
  }
  console.log("Done.");
}

main().catch(console.error);
