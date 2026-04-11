const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

const configContent = fs.readFileSync(
  path.join(__dirname, "../voiceover-boarding-config.ts"),
  "utf8"
);
const cleaned = configContent
  .replace(/export const BOARDING_SCENES =/, "var BOARDING_SCENES =")
  .replace(/ as const;/, ";")
  .replace(/^\/\/.*/gm, "");
eval(cleaned);

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const OUT_DIR = path.join(__dirname, "../public/voiceover");

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
  const model = client.getGenerativeModel({ model: "gemini-2.5-flash-preview-tts" });
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: scene.text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } },
    },
  });
  const part = result.response.candidates[0].content.parts[0];
  const rawBuffer = Buffer.from(part.inlineData.data, "base64");
  const wavBuffer = buildWav(rawBuffer);
  if (wavBuffer.slice(0, 4).toString() !== "RIFF") {
    throw new Error(`WAV header missing for ${scene.id}!`);
  }
  fs.writeFileSync(outPath, wavBuffer);
  console.log(`  -> ${(wavBuffer.length / 1024).toFixed(0)} KB written`);
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("ERROR: GEMINI_API_KEY environment variable not set");
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const scene of BOARDING_SCENES) {
    await generateOne(scene);
    await new Promise(r => setTimeout(r, 500));
  }
  console.log("Done.");
}

main().catch(console.error);
