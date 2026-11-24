#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
音频生产管线：合成 56 个 SFX + 8 首 BGM。
SFX：44.1k / 16bit / mono WAV，指数衰减 + 噪声瞬态。
BGM：45s 循环，96kbps stereo MP3（lameenc）；循环点对齐小节线，不淡入淡出。

用法：python scripts/audio/synth.py
"""
import math
import os
import struct
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_SFX = os.path.join(ROOT, "assets", "resources", "audio", "sfx")
OUT_BGM = os.path.join(ROOT, "assets", "resources", "audio", "bgm")
SR = 44100
rng = np.random.default_rng(20271124)


def ensure(p):
    os.makedirs(p, exist_ok=True)


def env_ad(n, attack=0.005, decay=0.25, power=3.0):
    a = max(1, int(attack * SR))
    d = max(1, n - a)
    e = np.concatenate([np.linspace(0, 1, a), np.power(np.linspace(1, 0, d), power)])
    return e[:n]


def sine(freq, dur, amp=0.5, phase=0.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return amp * np.sin(2 * np.pi * freq * t + phase)


def sweep(f0, f1, dur, amp=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = np.linspace(f0, f1, n)
    phase = 2 * np.pi * np.cumsum(f) / SR
    return amp * np.sin(phase)


def noise(dur, amp=0.3, lowpass=0.3):
    n = int(dur * SR)
    x = rng.uniform(-1, 1, n)
    # 简单一阶低通
    y = np.zeros(n)
    acc = 0.0
    for i in range(n):
        acc += lowpass * (x[i] - acc)
        y[i] = acc
    return amp * y / (np.max(np.abs(y)) + 1e-9)


def bell(freq, dur, amp=0.4):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * t) + 0.5 * np.sin(2 * np.pi * freq * 2.01 * t) + 0.25 * np.sin(2 * np.pi * freq * 3.02 * t)
    return amp * x * np.exp(-t * (3.0 / dur))


def normalize(x, peak=0.85):
    m = np.max(np.abs(x))
    if m < 1e-9:
        return x
    return x / m * peak


def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[: len(p)] += p
    return out


def write_wav(path, x):
    ensure(os.path.dirname(path))
    x = np.clip(normalize(x, 0.9), -1, 1)
    data = (x * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


# ─────────────────────────── SFX 配方 ───────────────────────────
def sfx_ui_click():
    return mix(noise(0.004, 0.5, 0.9), sine(800, 0.05, 0.5) * env_ad(int(0.05 * SR), 0.001, 0.05, 4))


def sfx_ui_back():
    return mix(sine(600, 0.08, 0.4) * env_ad(int(0.08 * SR), 0.002, 0.08),
               sine(400, 0.1, 0.35) * np.concatenate([np.zeros(int(0.04 * SR)), env_ad(int(0.06 * SR), 0.002, 0.06)]))


def sfx_ui_error():
    return mix(sine(300, 0.1, 0.4) * env_ad(int(0.1 * SR), 0.002, 0.1),
               sine(200, 0.12, 0.35) * np.concatenate([np.zeros(int(0.05 * SR)), env_ad(int(0.07 * SR), 0.002, 0.07)]))


def sfx_coin():
    return mix(sine(1200, 0.06, 0.35) * env_ad(int(0.06 * SR), 0.001, 0.06),
               sine(1800, 0.08, 0.3) * np.concatenate([np.zeros(int(0.03 * SR)), env_ad(int(0.05 * SR), 0.001, 0.05)]))


def sfx_star():
    parts = []
    for i, f in enumerate([523, 659, 784]):
        seg = bell(f, 0.12, 0.3)
        seg = np.concatenate([np.zeros(int(i * 0.03 * SR)), seg])
        parts.append(seg)
    return mix(*parts)


def sfx_unlock():
    parts = []
    for i, f in enumerate([392, 523, 659, 784]):
        seg = bell(f, 0.16, 0.25)
        seg = np.concatenate([np.zeros(int(i * 0.05 * SR)), seg])
        parts.append(seg)
    return mix(*parts)


def sfx_flip():
    return mix(noise(0.03, 0.4, 0.6), sine(500, 0.04, 0.2) * env_ad(int(0.04 * SR), 0.001, 0.04))


def sfx_toggle():
    return mix(sine(660, 0.04, 0.3) * env_ad(int(0.04 * SR), 0.001, 0.04),
               sine(880, 0.05, 0.25) * np.concatenate([np.zeros(int(0.02 * SR)), env_ad(int(0.03 * SR), 0.001, 0.03)]))


def sfx_swipe():
    return noise(0.12, 0.35, 0.15) * np.linspace(0.2, 1, int(0.12 * SR))


def sfx_hint():
    return mix(bell(1046, 0.18, 0.35), bell(1318, 0.18, 0.2))


def sfx_countdown():
    return mix(sine(880, 0.06, 0.35) * env_ad(int(0.06 * SR), 0.001, 0.06),
               sine(660, 0.08, 0.3) * np.concatenate([np.zeros(int(0.04 * SR)), env_ad(int(0.04 * SR), 0.001, 0.04)]))


def sfx_close():
    return mix(sine(520, 0.06, 0.3) * env_ad(int(0.06 * SR), 0.001, 0.06),
               noise(0.02, 0.25, 0.7))


def sfx_move():
    return sine(520, 0.035, 0.22) * env_ad(int(0.035 * SR), 0.001, 0.035, 4)


def sfx_rotate():
    return sweep(520, 720, 0.07, 0.3) * env_ad(int(0.07 * SR), 0.002, 0.07)


def sfx_lock():
    return mix(sine(160, 0.09, 0.5) * env_ad(int(0.09 * SR), 0.001, 0.09),
               noise(0.03, 0.35, 0.4))


def sfx_pop(i):
    base = [300, 500, 700][i]
    top = [900, 1200, 1600][i]
    dur = [0.09, 0.10, 0.12][i]
    return mix(sweep(base, top, dur, 0.45) * env_ad(int(dur * SR), 0.002, dur),
               noise(0.02, 0.2, 0.5))


def sfx_row():
    return mix(noise(0.18, 0.35, 0.2), bell(523, 0.18, 0.25), bell(659, 0.18, 0.22), bell(784, 0.18, 0.2))


def sfx_levelup():
    parts = []
    for i, f in enumerate([523, 659, 784, 1046]):
        seg = bell(f, 0.25, 0.28)
        seg = np.concatenate([np.zeros(int(i * 0.06 * SR)), seg])
        parts.append(seg)
    return mix(*parts)


def sfx_over():
    return mix(sweep(440, 110, 0.6, 0.4) * env_ad(int(0.6 * SR), 0.01, 0.6, 2),
               sine(110, 0.6, 0.2) * env_ad(int(0.6 * SR), 0.02, 0.6, 2))


def sfx_start():
    parts = []
    for i, f in enumerate([392, 523, 659]):
        seg = bell(f, 0.22, 0.3)
        seg = np.concatenate([np.zeros(int(i * 0.05 * SR)), seg])
        parts.append(seg)
    return mix(*parts)


def sfx_sugar_full():
    return mix(bell(1046, 0.2, 0.4), bell(1568, 0.2, 0.3), noise(0.12, 0.15, 0.8))


def sfx_sugar_burst():
    return mix(sweep(120, 60, 0.4, 0.5) * env_ad(int(0.4 * SR), 0.01, 0.4, 2),
               noise(0.3, 0.3, 0.5), bell(1200, 0.4, 0.2))


def sfx_talent_appear():
    return mix(noise(0.06, 0.35, 0.7), bell(880, 0.3, 0.25), bell(1174, 0.3, 0.2))


def sfx_talent_pick():
    return mix(bell(659, 0.25, 0.3), bell(988, 0.25, 0.25), bell(1318, 0.25, 0.2))


def sfx_talent_skip():
    return mix(sine(440, 0.08, 0.3) * env_ad(int(0.08 * SR), 0.002, 0.08),
               sine(330, 0.1, 0.25) * np.concatenate([np.zeros(int(0.06 * SR)), env_ad(int(0.04 * SR), 0.002, 0.04)]))


def sfx_shadow_overtake():
    return mix(bell(1568, 0.4, 0.35), bell(2093, 0.4, 0.25), sweep(400, 1200, 0.35, 0.2))


def sfx_daily_done():
    parts = []
    for i, f in enumerate([523, 659, 784, 1046, 1318]):
        seg = bell(f, 0.3, 0.25)
        seg = np.concatenate([np.zeros(int(i * 0.08 * SR)), seg])
        parts.append(seg)
    return mix(*parts)


def sfx_chapter_unlock():
    return mix(sfx_unlock(), sfx_chapter_unlock_extra())


def sfx_chapter_unlock_extra():
    return mix(bell(392, 0.5, 0.25), bell(523, 0.5, 0.2), noise(0.2, 0.15, 0.4))


def sfx_mutation(i):
    base = [70, 90, 110, 130, 150, 170, 190, 210][i]
    drone = sine(base, 0.6, 0.35) * env_ad(int(0.6 * SR), 0.05, 0.6, 2)
    riser = sweep(base * 2, base * 6, 0.5, 0.2) * np.linspace(0, 1, int(0.5 * SR))
    return mix(drone, riser)


def sfx_special_spawn(kind):
    f = {"stripe": 880, "rainbow": 1046, "bomb": 440, "cross": 660, "prism": 1318}[kind]
    return mix(bell(f, 0.2, 0.35), bell(f * 1.5, 0.2, 0.2))


def sfx_special_trigger(kind):
    if kind == "rainbow":
        return mix(sweep(600, 1800, 0.3, 0.3), bell(1568, 0.3, 0.2))
    if kind == "prism":
        return mix(sweep(300, 1200, 0.35, 0.25), bell(1046, 0.35, 0.2))
    return mix(sweep(180, 60, 0.35, 0.45), noise(0.2, 0.3, 0.3))


def sfx_frost_insert():
    return mix(noise(0.19, 0.35, 0.25), sweep(900, 300, 0.19, 0.2))


def sfx_magnet_shift():
    return mix(sweep(300, 900, 0.15, 0.3), noise(0.06, 0.2, 0.6))


def sfx_brittle_break():
    return mix(noise(0.12, 0.5, 0.9), bell(1800, 0.12, 0.2))


def sfx_fog_reveal():
    return mix(noise(0.2, 0.3, 0.1), bell(880, 0.2, 0.15))


def sfx_stone_break():
    return mix(noise(0.18, 0.5, 0.35), sine(120, 0.18, 0.35) * env_ad(int(0.18 * SR), 0.001, 0.18))


def sfx_undo():
    return mix(sweep(700, 400, 0.14, 0.3), noise(0.03, 0.2, 0.6))


def sfx_replay_play():
    return mix(sine(660, 0.05, 0.3) * env_ad(int(0.05 * SR), 0.001, 0.05), bell(880, 0.1, 0.2))


def sfx_replay_pause():
    return mix(sine(440, 0.05, 0.3) * env_ad(int(0.05 * SR), 0.001, 0.05), sine(330, 0.08, 0.25) * np.concatenate([np.zeros(int(0.03 * SR)), env_ad(int(0.05 * SR), 0.001, 0.05)]))


SFX = {
    "ui_click": sfx_ui_click, "ui_back": sfx_ui_back, "ui_error": sfx_ui_error,
    "ui_coin": sfx_coin, "ui_star": sfx_star, "ui_unlock": sfx_unlock,
    "ui_flip": sfx_flip, "ui_toggle": sfx_toggle, "ui_swipe": sfx_swipe,
    "ui_hint": sfx_hint, "ui_countdown": sfx_countdown, "ui_close": sfx_close,
    "move": sfx_move, "rotate": sfx_rotate, "lock": sfx_lock,
    "pop_low": lambda: sfx_pop(0), "pop_mid": lambda: sfx_pop(1), "pop_high": lambda: sfx_pop(2),
    "row": sfx_row, "levelup": sfx_levelup, "over": sfx_over, "start": sfx_start,
    "sugar_full": sfx_sugar_full, "sugar_burst": sfx_sugar_burst,
    "talent_appear": sfx_talent_appear, "talent_pick": sfx_talent_pick, "talent_skip": sfx_talent_skip,
    "shadow_overtake": sfx_shadow_overtake, "daily_done": sfx_daily_done, "chapter_unlock": sfx_chapter_unlock,
    "special_spawn_stripe": lambda: sfx_special_spawn("stripe"),
    "special_spawn_rainbow": lambda: sfx_special_spawn("rainbow"),
    "special_spawn_bomb": lambda: sfx_special_spawn("bomb"),
    "special_spawn_cross": lambda: sfx_special_spawn("cross"),
    "special_spawn_prism": lambda: sfx_special_spawn("prism"),
    "special_trigger_stripe": lambda: sfx_special_trigger("stripe"),
    "special_trigger_rainbow": lambda: sfx_special_trigger("rainbow"),
    "special_trigger_bomb": lambda: sfx_special_trigger("bomb"),
    "special_trigger_cross": lambda: sfx_special_trigger("cross"),
    "special_trigger_prism": lambda: sfx_special_trigger("prism"),
    "frost_insert": sfx_frost_insert, "magnet_shift": sfx_magnet_shift,
    "brittle_break": sfx_brittle_break, "fog_reveal": sfx_fog_reveal,
    "stone_break": sfx_stone_break, "undo": sfx_undo,
    "replay_play": sfx_replay_play, "replay_pause": sfx_replay_pause,
}
for i in range(8):
    SFX[f"mutation_{i + 1}"] = (lambda idx: lambda: sfx_mutation(idx))(i)


# ─────────────────────────── BGM ───────────────────────────
def note_freq(semi):
    return 440.0 * (2 ** ((semi - 9) / 12.0))


def synth_note(freq, dur, kind="bell", amp=0.25):
    n = int(dur * SR)
    t = np.arange(n) / SR
    if kind == "bell":
        x = np.sin(2 * np.pi * freq * t) + 0.4 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t * 4)
        e = np.exp(-t * (2.2 / max(0.1, dur)))
    elif kind == "pluck":
        x = np.sin(2 * np.pi * freq * t) + 0.3 * np.sign(np.sin(2 * np.pi * freq * t))
        e = np.exp(-t * (8 / max(0.1, dur)))
    elif kind == "pad":
        x = np.sin(2 * np.pi * freq * t) + 0.5 * np.sin(2 * np.pi * freq * 1.005 * t)
        e = np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.15)
    elif kind == "bass":
        x = np.sin(2 * np.pi * freq * t) + 0.2 * np.sin(2 * np.pi * freq * 0.5 * t)
        e = np.exp(-t * 3)
    else:
        x, e = np.sin(2 * np.pi * freq * t), np.exp(-t * 4)
    return amp * x * np.clip(e, 0, 1)


def bgm_track(prog, melody, bpm, bars, style):
    """prog: 每小节一个和弦（半音偏移数组）；melody: 每拍音符（None 休止）"""
    beat = 60.0 / bpm
    total = int(bars * 4 * beat * SR) + SR // 2
    out = np.zeros(total)
    for bar in range(bars):
        chord = prog[bar % len(prog)]
        start = int(bar * 4 * beat * SR)
        # pad：整小节
        for semi in chord:
            seg = synth_note(note_freq(semi), 4 * beat * 0.98, "pad", 0.09)
            out[start:start + len(seg)] += seg
        # bass：1、3 拍
        for b in (0, 2):
            seg = synth_note(note_freq(chord[0] - 12), beat * 0.9, "bass", 0.16)
            s = start + int(b * beat * SR)
            out[s:s + len(seg)] += seg
        # 旋律：每拍
        for b in range(4):
            idx = (bar * 4 + b) % len(melody)
            semis = melody[idx]
            if semis is None:
                continue
            seg = synth_note(note_freq(semis), beat * 0.85, style, 0.18)
            s = start + int(b * beat * SR)
            out[s:s + len(seg)] += seg
    # 首尾 5ms 淡入淡出（循环点不处理）
    fade = int(0.005 * SR)
    out[:fade] *= np.linspace(0, 1, fade)
    out[-fade:] *= np.linspace(1, 0, fade)
    return out


def write_mp3(path, x):
    import lameenc

    ensure(os.path.dirname(path))
    x = np.clip(normalize(x, 0.8), -1, 1)
    pcm = (x * 32767).astype(np.int16)
    stereo = np.column_stack([pcm, pcm]).reshape(-1)
    enc = lameenc.Encoder()
    enc.set_bit_rate(96)
    enc.set_in_sample_rate(SR)
    enc.set_channels(2)
    enc.set_quality(5)
    data = enc.encode(stereo.tobytes())
    data += enc.flush()
    with open(path, "wb") as f:
        f.write(data)


BGM = {
    "home": (dict(prog=[[0, 4, 7, 11], [5, 9, 12, 16], [7, 11, 14, 17], [5, 9, 12, 16]], bpm=96, bars=18,
                  melody=[12, 16, 19, 16, 14, 12, 11, 12, None, 9, 11, 12, 16, 19, 21, 19], style="bell")),
    "ch1_musicbox": (dict(prog=[[5, 9, 12, 16], [0, 4, 7, 11], [7, 11, 14, 17], [5, 9, 12, 16]], bpm=92, bars=18,
                          melody=[17, 16, 14, 12, 14, 16, 17, 19, 17, 16, 14, 12, 11, 12, 14, 16], style="bell")),
    "ch2_bells": (dict(prog=[[9, 12, 16, 19], [5, 9, 12, 16], [4, 7, 11, 14], [5, 9, 12, 16]], bpm=100, bars=19,
                        melody=[21, 19, 16, 14, 12, 14, 16, 19, None, 16, 14, 12, 14, 16, 19, 21], style="bell")),
    "ch3_waltz": (dict(prog=[[2, 5, 9, 12], [7, 11, 14, 17], [0, 4, 7, 11], [5, 9, 12, 16]], bpm=108, bars=20,
                       melody=[14, None, 12, 14, 17, None, 14, 12, 11, None, 9, 11, 14, None, 12, 11], style="pluck")),
    "ch4_pads": (dict(prog=[[4, 7, 11, 14], [0, 4, 7, 11], [5, 9, 12, 16], [7, 11, 14, 17]], bpm=84, bars=16,
                      melody=[11, None, None, 14, 12, None, 11, None, 9, None, 11, 12, None, 14, 16, None], style="pluck")),
    "ch5_synth": (dict(prog=[[7, 11, 14, 17], [4, 7, 11, 14], [0, 4, 7, 11], [5, 9, 12, 16]], bpm=118, bars=22,
                       melody=[19, 21, 23, 21, 19, 16, 14, 16, 19, 21, 19, 16, 14, 16, 19, 23], style="pluck")),
    "ch6_ensemble": (dict(prog=[[0, 3, 7, 10], [5, 8, 12, 15], [7, 10, 14, 17], [5, 8, 12, 15]], bpm=112, bars=20,
                          melody=[12, 15, 19, 15, 14, 12, 10, 12, 15, 19, 22, 19, 17, 15, 14, 12], style="bell")),
    "result": (dict(prog=[[0, 4, 7, 11], [5, 9, 12, 16], [7, 11, 14, 17], [0, 4, 7, 11]], bpm=90, bars=17,
                    melody=[19, 16, 14, 12, 14, 16, 19, 21, 19, 16, 14, 12, 11, 12, 14, 12], style="bell")),
}


def main():
    ensure(OUT_SFX)
    ensure(OUT_BGM)
    for name, fn in SFX.items():
        write_wav(os.path.join(OUT_SFX, f"{name}.wav"), fn())
    for name, cfg in BGM.items():
        buf = bgm_track(cfg["prog"], cfg["melody"], cfg["bpm"], cfg["bars"], cfg["style"])
        write_mp3(os.path.join(OUT_BGM, f"{name}.mp3"), buf)
    n_sfx = len([f for f in os.listdir(OUT_SFX) if f.endswith(".wav")])
    n_bgm = len([f for f in os.listdir(OUT_BGM) if f.endswith(".mp3")])
    print(f"[audio] SFX {n_sfx} / BGM {n_bgm}")


if __name__ == "__main__":
    main()
