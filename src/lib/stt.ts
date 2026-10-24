/**
 * Speech-to-text. One small interface so the provider can be swapped later;
 * today: ElevenLabs Scribe (Hebrew, speaker diarization).
 *
 * Env: ELEVENLABS_API_KEY (required), ELEVENLABS_STT_MODEL (default "scribe_v1").
 * The key is sent only in the request header — never logged.
 */
import { readEnv } from "@/lib/read-env";

export interface TranscriptUtterance {
  speaker: string; // "1", "2", … in order of first appearance
  text: string;
}

export interface Transcript {
  text: string;
  utterances: TranscriptUtterance[];
  languageCode: string | null;
}

export interface AudioInput {
  data: ArrayBuffer;
  contentType: string;
  filename?: string;
}

const ELEVENLABS_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";

interface ScribeWord {
  text?: string;
  type?: string; // "word" | "spacing" | "audio_event"
  speaker_id?: string | null;
}

interface ScribeResponse {
  language_code?: string;
  text?: string;
  words?: ScribeWord[];
}

/** Group Scribe's word stream into consecutive same-speaker utterances. */
export function utterancesFromWords(words: ScribeWord[]): TranscriptUtterance[] {
  const speakerNo = new Map<string, string>();
  const out: TranscriptUtterance[] = [];
  for (const w of words) {
    if (w.type === "audio_event" || !w.text) continue;
    const raw = w.speaker_id ?? "speaker_0";
    if (!speakerNo.has(raw)) speakerNo.set(raw, String(speakerNo.size + 1));
    const speaker = speakerNo.get(raw)!;
    const last = out[out.length - 1];
    if (last && last.speaker === speaker) last.text += w.text;
    else if (w.type !== "spacing") out.push({ speaker, text: w.text });
  }
  return out.map((u) => ({ ...u, text: u.text.replace(/\s+/g, " ").trim() })).filter((u) => u.text);
}

/** "דובר 1: …\nדובר 2: …" — the form handed to the summarizer. */
export function formatTranscript(t: Transcript): string {
  if (!t.utterances.length) return t.text.trim();
  return t.utterances.map((u) => `דובר ${u.speaker}: ${u.text}`).join("\n");
}

function extFor(contentType: string): string {
  if (contentType.includes("wav")) return "wav";
  if (contentType.includes("ogg")) return "ogg";
  if (contentType.includes("mp4") || contentType.includes("m4a")) return "m4a";
  return "mp3";
}

export async function transcribeAudio(
  audio: AudioInput,
  opts: { language: string; diarize?: boolean; timeoutMs?: number } = { language: "he" }
): Promise<Transcript> {
  const apiKey = readEnv("ELEVENLABS_API_KEY");
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");

  const form = new FormData();
  form.append("model_id", readEnv("ELEVENLABS_STT_MODEL") || "scribe_v1");
  form.append("language_code", opts.language);
  form.append("diarize", opts.diarize === false ? "false" : "true");
  form.append("tag_audio_events", "false");
  form.append("timestamps_granularity", "word");
  form.append(
    "file",
    new Blob([audio.data], { type: audio.contentType || "audio/mpeg" }),
    audio.filename ?? `call.${extFor(audio.contentType)}`
  );

  const res = await fetch(ELEVENLABS_STT_URL, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
    signal: AbortSignal.timeout(opts.timeoutMs ?? 180_000),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`ElevenLabs STT failed: HTTP ${res.status} ${detail}`);
  }
  const json = (await res.json()) as ScribeResponse;
  return {
    text: (json.text ?? "").trim(),
    utterances: utterancesFromWords(json.words ?? []),
    languageCode: json.language_code ?? null,
  };
}
