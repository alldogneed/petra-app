"""Seed the take pool with the first continuous take, then add more takes and keep the best line versions."""
import voice

clips = voice.split_take("vo/pool/t0_full.wav", "vo/pool/t0")
print("t0 split ok", len(clips) if clips else None)
voice.continuous(takes=4)
