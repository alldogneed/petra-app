---
name: petra-video
description: Produce Petra marketing videos end to end — promo/explainer videos (16:9) and Instagram/Facebook Reels (9:16) with Hebrew AI voiceover, background music, burned-in subtitles and REAL screenshots of the Petra app. Use when asked to make a promo video, reel, "סרטון", "רילס", "סרטון תדמית", "סרטון הסבר", to dub/voice a video ("דיבוב", "קריינות"), add or fix background music, or continue/edit an existing video in marketing/. Covers feature verification against the code, script writing, screenshot capture from a locally seeded app, OpenAI TTS with automatic pronunciation QA, music prep (vocal removal, stop/ending alignment), HTML-animation rendering, mixing and loudness.
---

# Petra video production

Two working productions live in the repo — copy the closest one as the template:

| | Promo (16:9, ~1:50) | Reel (9:16, ~50s) |
|---|---|---|
| Folder | `marketing/promo-video/` | `marketing/reel-boarding/` |
| Page | `promo.html` (hand-written scenes) | `reel.html` **generated** by `build.py html` |
| Voice | `dub.py voice / redo` (one take per line) | `voice.py continuous` (one continuous read, split per line) — **preferred** |
| Render + mix | `render.py`, `dub.py mix`, `dub.py music` | `build.py video` / `remix` / `preview N` |
| Screens | `shots/`, `capture/` | `shots/`, `capture/` (seed + Playwright scripts) |

`dub.py` is the shared library (imported by the reel): `tts()`, `transcribe()`, `score()`, `best_take()`, `duration()`, `FF` (ffmpeg path). Reuse it; don't re-implement.

## Owner preferences (Or) — follow unless told otherwise
- Female voice **`coral`**. Tone: natural Israeli Hebrew, like a WhatsApp voice message to a friend — never announcer/sales voice.
- **Music at a constant level — do NOT duck under the voice** (he explicitly rejected ducking). Keep the voice clear with a constant EQ carve + voice compression/presence and a lower constant music gain instead.
- Music must be purely instrumental — he hears and rejects any voice/vocal chop in the music.
- Petra logo everywhere: persistent corner logo on app screens, big logo after the hook, logo at the end.
- Reels CTA: "דברו איתנו בוואטסאפ" + 054-256-0964 (from `src/app/landing/`); promo CTA: petra-app.com, "מתחילים בחינם".
- Show real app screens, not mockups. Rooms, timeline, yards, feeding/meds, permissions etc. — whatever the video claims must be on screen.
- Ask for approval of the script (table: time | narration | on screen) before recording; ask the 2–3 real decisions (length, hook, CTA), recommend defaults.

## Workflow

### 1. Verify every claim against the code
Spawn an Explore agent to map the module (exact Hebrew UI labels, routes, file paths) and mark EXISTS / PARTIAL / MISSING. Never script a feature that is partial or missing (e.g. boarding has no photo updates to owners, no conflict alert when incompatible dogs share a yard — only behaviour warnings in the check-in dialog). Tell the user what was left out and why.

### 2. Script
- Reel ≈ 30–50s, hook in the first 2 seconds (pain question: "עדיין מנהלים את הפנסיון על לוח מחיק? ביומן גוגל? במחברת?"). Promo can run ~1:30–2:00.
- One line per scene. Everyday spoken Hebrew. **On-screen text must match the narration word for word** (headline/subtitle = what she says; no extra claims on screen that aren't said, no "שלכם" on screen when the voice says "העסק"). Avoid repeating "שלכם"/"אצלכם" (sounded unnatural; rephrase: "כל העסק במסך אחד", "ישר ליומן", "נשמר במערכת").
- Pronunciation traps found so far (rephrase rather than fight them):
  - Brand name **at the start of a sentence gets garbled** ("פטרה, מערכת…" → "פטה/SoftPetra"). Put it mid-sentence: "הכירו את פטרה, …", "בשביל זה בנינו את פטרה", "בפטרה, כל כלב…".
  - "שיבוץ" at sentence start → "שיפוץ/טיפות"; "גוררים" → "בוררים" (use "בגרירה"); "וכל בוקר" → model says "בכל בוקר" (just use that).
  - Niqqud: full niqqud made every model WORSE. Only niqqud a single word that keeps failing (worked: "לַעֲסָקִים"). Never strip niqqud to get plain text — it leaves defective spelling (העינים, הצות) that the TTS then misreads; keep a full-spelling copy.
  - TTS input for acronyms/URLs: "איי איי" for AI, "פטרה אפ דוט קום".

### 3. Screens (real app, local)
Delegate to a background general-purpose agent (it takes ~10–25 min). Give it: target folder `marketing/<video>/shots/`, the exact screens and states, desktop 1600×1000 @2x and mobile 390×844 @3x, JPEG q90, element screenshots (`c_*.png`) for callouts, "Read every image and redo until polished", cleanup at the end. Prior capture code: `marketing/*/capture/` (seed scripts + `shoot*.py`). Setup that works in the cloud container:
- Postgres 16 at `/usr/lib/postgresql/16`, `prisma db push`, `npm run db:seed` **then `npm run db:seed-admin`** (creates owner@petra.local / Admin1234!), then the promo seed scripts (business `demo-business-001`), `npm run build && npm start`.
- Playwright Chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Wait for `.petra-loader-toe` to disappear. No PIL/ImageMagick — save JPEG from Playwright, crop with ffmpeg (`-vf crop=w:h:x:y`).
- Login is rate-limited (vary `x-forwarded-for` locally); staff users need a `UserConsent` row or they land on the terms screen.
- Look at each shot yourself before using it; agents may re-shoot files after you crop them — re-crop from the final versions.

### 4. Voice (OpenAI)
Requires `OPENAI_API_KEY` and `api.openai.com` allowed in the environment's network settings (if 403 from the proxy: user adds the domain under the cloud environment → Edit → Network access; 429 `insufficient_quota` = add credits).
- Model **`gpt-audio-1.5`** via chat completions with audio output (`dub.tts`). `gpt-4o-mini-tts` mispronounced Hebrew and was too slow — don't use it.
- **Record the whole script as ONE continuous take** (`voice.py continuous`): natural flow between sentences. Recording each line separately sounded robotic ("every line starts from zero"). The pool (`vo/pool/`) keeps several takes; each is split into lines at the pauses (whisper word timestamps), every line is transcribed twice, and the best version of each line wins. Add takes until every line is 1.00.
- QA = `gpt-4o-transcribe` back to text, `dub.score()` against the script. **A take passes only if two separate transcriptions are exact** — single passes let borderline words through. `ט/ת`, `ההאכלות/האכלות` spelling variants are transcriber noise, not errors.
- **Clean sentence edges**: `voice.tidy()` (called by `split_take`) cuts each clip right before the first word and right after the last word, before the next inhale, with short fades. A clip that ends on the start of a breath sounds like a caught breath ("תקיעה של נשימה") — the owner noticed it immediately. Check: audio after the last whisper word should be ≤ ~0.15s.
- Pick borderline lines by the **average of 4 transcriptions** (min-of-2 can pick a bad take by luck).
- Word timings for subtitles: `whisper-1` `verbose_json` + `timestamp_granularities[]=word` → `vo/words.json`.

### 5. Music
- Ask the user to generate it in Gemini; give a prompt: instrumental, BPM, structure with timestamps matching the scenes, **"no vocals, no vocal chops, no voice samples, no spoken words, no humming"**, clean ending.
- Always check for voices: whisper `verbose_json` segments with low `no_speech_prob` / repeated phrases = voice. Random multilingual text on 5s windows is normal hallucination.
- If there is a voice, **separate it**: `pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision` + `pip install "audio-separator[cpu]"`, put ffmpeg on PATH (symlink `dub.FF` as `ffmpeg`), run `audio-separator track.mp3 --model_filename UVR-MDX-NET-Inst_HQ_3.onnx --output_format WAV`. Models download from GitHub (fbaipublicfiles/Demucs is blocked). Use the `(Instrumental)` stem.
- Structure: find the track's built-in stop and natural ending (`silencedetect`). Align the stop to the CTA phrase ("דברו איתנו בוואטסאפ" said in the silence) and let the reel end on the track's final chord (`build.py`: `MUSIC_STOP`, `MUSIC_END`, `CTA_STOP_WORD`). If the track is too short, loop whole bars (estimate beat with onset autocorrelation; crossfade 0.25–0.5s at a bar boundary).

### 6. Build, render, mix
- Scenes are CSS animations; `renderAt(t)` freezes them; Playwright screenshots every frame into ffmpeg (30fps). Scene start/duration come from voice clip lengths (`LEAD` + clip + `TAIL`), never shorten scenes the visuals need.
- Reel layout (1080×1920): headline top (~y190), media card 960×860 at y470, subtitle pill ~y1390, **nothing important in the bottom ~360px or top ~150px** (Instagram UI). Subtitles = voice text in chunks timed from `words.json`.
- Mix chain (see `build.py video`): voice `highpass 90 → acompressor → +2dB → EQ +3dB@3.2k`; music constant gain (-12dB for the reel) with a constant -5dB EQ dip @2.5k; `alimiter`; final gain tuned so integrated loudness = **-14 LUFS** (promo: -15 after the owner asked for a softer voice — voice -2dB relative to the music) (measure with `ebur128`, adjust the fixed `volume=` and `build.py remix` — audio-only, no re-render).
- `build.py preview 17.6` renders the first N seconds — send a preview early so the user can react to style/voice before the full render.

### 7. QA before sending
1. Transcribe each scene segment **from the final mp4** (2×). If a line is clean alone but broken in the mix, the music is masking it: a drum hit on the first word (delay that one line 0.3s via `EXTRA_LEAD`, if it doesn't collide with the next line) or the music is too loud there (lower the constant gain; don't duck).
2. Check stills of every scene (`build.py stills t1 t2 …`, Read the PNGs): no empty strips at pan ends, callouts not covering subtitles, logo visible.
3. Loudness -14 LUFS, duration, 9:16/16:9, audio stream present.
4. Send with `SendUserFile` (display `render`), then commit + push. Report honestly what is still imperfect (e.g. a soft "ו" that one transcription misses).

## Environment gotchas
- Kill stray ffmpeg by PID, never `pkill -f ffmpeg…` (matches your own shell and kills it).
- `apad` + `-shortest` with a copied video stream never terminates — use `apad=whole_dur=` + `-t`.
- `sidechaincompress` stops when its key input ends — `apad` the key.
- When the auto-mode classifier stalls, write the long command into a script file and run it; commit as soon as access returns.
- Keep big intermediates out of git (`.gitignore`: `music-bed.wav`, `reel-silent.mp4`, `still_*.png`, previews).
