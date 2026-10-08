---
name: petra-reel
description: Make a Petra Instagram/Facebook Reel (9:16, ~45s) narrated by the Petra dog mascot — Hebrew script, ElevenLabs voice (Liam), Hedra/Kling lip-sync dog in a corner circle, real app screens, music, CTA to petra-app.com/landing. Use for "רילס", "סרטון קצר לסושיאל", "הכלב של פטרה", "עוד רילס כמו של הפנסיון", or to fix/re-render the boarding reel in marketing/reel-boarding. Builds on the petra-video skill (which holds the general pipeline and gotchas).
---

# Petra dog Reel — end-to-end

Template: `marketing/reel-boarding/` (46–48s). Copy it to `marketing/<name>/`. The dog is the ONE leading voice in social shorts (promo videos keep a single professional narrator, no dog — owner decision 2026-10-07).

## 0. Setup (once per machine)
- `.env.video` in the repo root (untracked): `ELEVENLABS_API_KEY=...`, `HEDRA_API_KEY=key_id:secret`. Owner pastes keys via `read -s` in the terminal, never in chat; verify with a read-only call (never print).
- ffmpeg `/opt/homebrew/bin/ffmpeg`, Playwright + installed Chrome, Pillow. Hedra wallet funded (`GET https://api.hedra.com/v3/balance`, header `Authorization: Key ...`).

## 1. Script (owner approves)
7 lines, one per scene, short sentences (2–8 s each; Kling needs audio >= 2 s). Hook = pain question in the first 2 s. On-screen text = narration word for word. Verify every claim against the code first (petra-video §1). CTA (owner, 2026-10): "רוצים לנסות? היכנסו לפטרה אפ דוט קום, ותתחילו בחינם" + `petra-app.com/landing` + "מסלול חינמי, בלי כרטיס אשראי". Put the lines in `voice.py LINES`; subtitle chunks in `build.py SUBS` (word index into `vo/words.json`).

## 2. Voice — `python3 eleven_voice.py` (in the reel folder)
ElevenLabs `eleven_v3`, premade voice Liam (`TX3LPaxmHKxFdv7VOQHJ`). Each line is read with prev+next as context (`eleven.tts`), double-checked with Scribe, written to `vo/NN.wav` + `vo/timing.json` + `vo/words.json`. `פטרה` is spoken `פֶּטרָה`.
- A word that fails in all takes: niqqud on that ONE word only (`הפַּנְסִיוֹן`).
- **Pronunciation is judged by ear.** Scribe cannot hear a bad "PET-ra". When the owner flags a word, generate 6–8 passing takes, send the first ~2 s of each as ONE numbered mp3 (concat with gaps), and use the chosen take verbatim (copy to `vo/NN.wav`, re-run Scribe words, update `timing.json`/`words.json`).
- "פטרה," + comma can melt into the next word ("בפטרכל"); keep a clear gap (0.2–0.6 s) and the full ending.

## 3. Dog clips — `python3 ../dog-avatar/reel_clips.py [lines]`
Hedra v3 `kling-ai-avatar-v2`, `quality: pro`, 720p, 1:1, image `marketing/dog-avatar/dog-closed-mouth.png` (closed mouth lip-syncs best), audio = `vo/NN.wav`. ~11.5¢/s, ~$0.5–0.9 per 4–8 s line, ~$4.3 per reel. Clips cache in `dog-avatar/reel/NN.mp4`; delete one to redo it. Don't re-generate speculatively — decide the voice first.

## 4. Build
`python3 build.py html` → check stills (`build.py stills 3 14 …`) → `python3 build.py video` (render + dog overlay + voice + music) → `python3 build.py remix` redoes audio only. Layout (1080×1920): app screens have the dog top-left (190 px, beside the headline); hook and CTA have it top-centre; keep the top ~150 px and bottom ~360 px of the platform UI free. Consecutive lines hard-cut (`dog_overlay.py`): a cross-fade shows two dogs. Scene titles must clear the dog (scene 3 title is 68 px).
Music: instrumental track, constant gain, stop aligned to the CTA key word (`CTA_STOP_WORD` = index of "ותתחילו"), final `volume=2.9dB` → about -13.8 LUFS (target -14).

## 5. QA and delivery
`python3 .claude/skills/petra-video/scripts/qa_video.py reel` (uses Scribe when no OPENAI key). `~` = one run off (spelling/music masking — listen), BAD in both runs = fix. Look at stills around every scene boundary (no double dog). `SendUserFile` (render), then ask what is still imperfect by ear.

## Cost (boarding reel, 2026-10)
Kling pro clips $4.24 for the first 7 + $2.40 for 4 re-generations after pronunciation/CTA changes; dog experiments for the promo $1.20; ElevenLabs inside the Creator plan. Total Hedra spend for the whole dog project ≈ $7.8.

## Reel with REAL screen recordings of the AI agent (marketing/reel-ai-agent, 2026-10)
Template for "show the product working" reels: the dog narrates, the card shows real recordings of Claude (claude.ai) connected to the demo business.
- **Never use the owner's real business.** Create a throw-away connection in the demo business (Settings -> "עוזרי AI" -> "חבר עוזר חדש", token URL `https://petra-app.com/api/mcp/u/<token>`), add it in claude.ai (Customize -> Connectors -> Add custom connector, "No sign-in"). The OAuth "easy way" needs the owner to type the Petra password himself. The owner's account already has other "petra" connectors: never touch them. Revoke both the Petra connection ("נתק" -> "כן, בטל") and the claude.ai connector (Remove) when done.
- **Recording**: `screencapture -v -V <sec> take.mov` (Screen Recording permission; the file only exists once `-V` expires, never SIGINT it), driving the page from the built-in browser pane with a JS driver that types char by char, sends, and clicks "Allow once" (claude.ai asks approval per tool by default: show that card, it sells the safety story). Crop the pane (`crop=1380:1560:1530:215`), then `cut_cards.py`: typing and waits sped up 2-14x, approval card and answer at 1x. Look at a 1 fps contact sheet to pick the segments (this ffmpeg has no drawtext) and avoid stale banners ("Your connection to petra stopped working").
- **Overlay**: `build.py add_cards()` lays `cards/sceneN.mp4` (762x860) over the white card (x=159, y=470) and holds the last frame; scene length = max(voice, clip + 0.7). Order matters: cards first, then the dog.
- **Claude Desktop cannot be driven by Claude** (own app); claude.ai in the browser pane works.
- **Voice traps**: "ליד" is read "ליעד" even with niqqud — say "פנייה". "AI" is spoken "איי איי" (`.replace("AI", "איי איי")`), shown as "AI".
- **Hook** must be specific to the reel (not a copy of another reel's): here five screens pop in and strike out, then the logo, leading into "מה יש לי היום".
- CTA for AI-agent reels: WhatsApp + 054-256-0964 + "הקמה אישית במתנה" (the agent is PRO-only, so no "start free").

## Rules learned on the "how to start" reel (marketing/reel-ai-start, 2026-10-08, owner: "יצא מושלם")
**1. Choose takes by SOUND, never by transcript.** Scribe writes "פטרה"/"AI" correctly even when the owner hears them wrong (a swallowed "פטרה" lasts 0.24 s instead of ~0.66 s). Use `marketing/voice_match.py` (log-mel + DTW, pure numpy) through `pick_take.py <lines>`: ~8 takes per line, keep the one whose word is closest to an owner-approved reference.
- References: "בפטרה" = `reel-boarding/vo/01.wav` 0.12-0.78 s; "AI" = `reel-ai-agent/vo/01.wav` 1.84-2.28 s and `05.wav` 1.06-1.42 s.
- Scale: approved-vs-approved ~2.0; bad takes 2.6-3.2; aim for <= 2.1 ("AI") and <= 1.8 ("בפטרה"). If no take gets there, change the sentence, not the threshold.
- "פטרה" right after a colon or a full stop failed in every take. Say the brand ONCE, mid-sentence after another word ("עכשיו בפטרה בוחרים...") or drop it and let the screen carry it.
- When a new word gets approved by ear, add it to `REF` in `pick_take.py`.

**2. The dog never sits frozen.** Scene length = max(voice, screen clip + 0.7). `cut_cards.py` now fits every clip to `voice - 0.3` (uniform speed-up), so the dog stops talking as the scene ends. If a clip cannot be shortened, lengthen the sentence instead. On the CTA (which holds for the music ending) the dog fades out 0.5 s after its line.

**3. Lip-sync.** `dog-avatar/sync_check.py clip.mp4 line.wav` -> (corr at lag 0, best corr, lag in frames). The measure is rough (approved clips also score 0.2-0.3); only act on a clear peak (corr >= 0.5 with |lag| >= 2) by setting `DOG_LAG = {scene: frames}` in `build.py`, or regenerate the clip. The owner flagged the CTA clip; a regenerated clip + 3-frame shift fixed it.

**4. Recording the real connect flow (no password typed).** With the owner logged in to Petra and to claude.ai in the built-in browser pane: claude.ai -> Customize -> Connectors -> Add custom connector -> `https://petra-app.com/api/mcp` -> Add -> Connect -> Petra consent page `/oauth/authorize` ("חיבור Claude לפטרה": business, "רמת גישה", "אשר חיבור") -> "Connected to Petra". If the account already has a connector for that URL claude.ai refuses ("already exists in your organization"); `?v=2` on the URL passes (a trailing slash does not). Pick "קריאה בלבד" for demos. Afterwards: Petra settings -> "נתק" -> "כן, בטל", and claude.ai -> the connector -> ⋮ -> Remove (check the URL shown first: the owner has his own "petra" connectors).

**5. Privacy of screen recordings.** `screencapture -v` records the whole display; the pane is cropped later. Anything the owner puts on top of the pane is recorded (his platform-admin screens with real customer data were). Ask him not to touch the Mac, look at a contact sheet of every take before using it, and delete takes (raw + cropped + test stills) that show anything but the demo business. Never keep or commit them.

**6. Cost / budget.** A 6-line reel is ~$3 of Kling pro clips, every changed line ~$0.4-1.0. Check `GET /v3/balance` before starting and decide the wording BEFORE generating clips (voice takes are cheap, clips are not).
