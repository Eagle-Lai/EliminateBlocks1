#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
美术生产管线：按风格圣经程序化产出 100 张图（v3「莓果奶霜」：莓粉 / 粉紫 / 蜜金 / 雪白）。

为什么用程序化绘制而不是逐张生成：
  · 色板与光照必须完全统一（100 张图不能"每张都好看但不像一套"）；
  · 9-slice 需要"中心平坦"，生成式图片很难保证；
  · 尺寸/透明/命名要可重复、可校验，CI 里能重跑。

输出：assets/resources/art/**
用法：python scripts/art/gen_art.py
"""
import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, "assets", "resources", "art")

# ────────────────────────── 风格圣经 ──────────────────────────
# v3「莓果奶霜」：莓粉主色 / 粉紫冷调背景 / 蜜金强调 / 可可莓墨文字。
# 槽位名沿用 v2（STRAWBERRY=主色、ORANGE=橙、LIME=绿、SODA=蓝、GRAPE=紫），
# 保证 make_special / 图标 / 章节等的取色语义不变。
STRAWBERRY = (255, 92, 138)     # 莓粉（主色）
ORANGE = (255, 176, 66)         # 芒果橙
LIME = (62, 205, 168)           # 薄荷绿
SODA = (88, 150, 255)           # 蓝莓蓝
GRAPE = (168, 120, 244)         # 葡萄紫
CREAM = (255, 250, 253)         # 雪白
EDGE = (240, 222, 238)          # 背景边缘主色（粉紫，配 bg_home 底部渐变）
GOLD = (255, 196, 64)           # 蜜金（星星/金币/金框，跨皮肤保留）
INK = (74, 48, 62)              # 可可莓墨（文字主色）
INK_SOFT = (154, 116, 136)      # 莓灰（文字次色）
WHITE = (255, 255, 255)
PALETTE = [STRAWBERRY, ORANGE, LIME, SODA, GRAPE]

CHAPTER_THEMES = {
    1: ((255, 248, 250), (255, 222, 236), (255, 182, 208)),   # 莓粉奶霜
    2: ((248, 244, 255), (216, 214, 250), (190, 180, 244)),   # 薰衣草
    3: ((255, 246, 240), (250, 214, 196), (255, 170, 120)),   # 蜜橙
    4: ((240, 250, 248), (190, 238, 224), (120, 210, 186)),   # 薄荷
    5: ((244, 246, 255), (196, 220, 255), (120, 180, 250)),   # 蓝莓冰
    6: ((252, 244, 252), (236, 208, 240), (210, 150, 230)),   # 桑葚
}

SS = 3  # 超采样倍数


def ensure(path):
    os.makedirs(path, exist_ok=True)


def rgba(color, a=255):
    return (color[0], color[1], color[2], a)


def mix(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def new_canvas(w, h):
    return Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))


def save(img, rel, ss=SS):
    out = img.resize((img.width // ss, img.height // ss), Image.LANCZOS)
    rel = rel[4:] if rel.startswith("art/") else rel
    path = os.path.join(ART, rel)
    ensure(os.path.dirname(path))
    if rel.endswith(".jpg"):
        out.convert("RGB").save(path, "JPEG", quality=85, optimize=True)
    else:
        out.save(path, "PNG", optimize=True)
    return path


def rounded_mask(w, h, r):
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=255)
    return mask


def paste_rounded(base, box, r, fill, outline=None, width=0):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)
    base.alpha_composite(layer)


def vertical_gradient(w, h, top, bottom):
    img = Image.new("RGBA", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([(0, y), (w, y)], fill=rgba(mix(top, bottom, t)))
    return img


def soft_shadow(canvas, box, r, offset=(0, 10), blur=18, alpha=52):
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(
        [box[0] + offset[0], box[1] + offset[1], box[2] + offset[0], box[3] + offset[1]],
        radius=r,
        fill=(80, 48, 66, alpha),
    )
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(layer)


# ────────────────────────── 背景（9 张） ──────────────────────────
def make_background(rel, top, mid, accent, seed):
    rnd = random.Random(seed)
    W, H = 750, 1334
    img = vertical_gradient(W * SS, H * SS, top, mid)
    d = ImageDraw.Draw(img)
    # 大色块（马卡龙光斑）
    for i in range(7):
        cx = rnd.randint(-120, W + 120) * SS
        cy = rnd.randint(-80, H + 80) * SS
        r = rnd.randint(140, 340) * SS
        col = mix(accent, WHITE, rnd.uniform(0.3, 0.75))
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse([cx - r, cy - r, cx + r, cy + r], fill=rgba(col, rnd.randint(40, 80)))
        layer = layer.filter(ImageFilter.GaussianBlur(30 * SS))
        img.alpha_composite(layer)
    # 底部糖果丘陵
    for i in range(3):
        cy = H * (0.78 + i * 0.07) * SS
        r = (420 - i * 90) * SS
        col = mix(accent, WHITE, 0.25 + i * 0.2)
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse([W * 0.5 * SS - r, cy, W * 0.5 * SS + r, cy + r], fill=rgba(col, 90))
        layer = layer.filter(ImageFilter.GaussianBlur(10 * SS))
        img.alpha_composite(layer)
    # 星点
    for i in range(26):
        x = rnd.randint(20, W - 20) * SS
        y = rnd.randint(20, int(H * 0.6)) * SS
        r = rnd.randint(2, 5) * SS
        d.ellipse([x - r, y - r, x + r, y + r], fill=rgba(WHITE, rnd.randint(90, 180)))
    # 暗角
    vig = Image.new("RGBA", img.size, (0, 0, 0, 0))
    vd = ImageDraw.Draw(vig)
    vd.rectangle([0, 0, img.width, img.height], fill=(44, 20, 34, 40))
    mask = Image.new("L", img.size, 0)
    md = ImageDraw.Draw(mask)
    md.ellipse([-img.width * 0.25, -img.height * 0.2, img.width * 1.25, img.height * 1.2], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(60 * SS))
    vig.putalpha(Image.composite(vig.getchannel("A"), Image.new("L", img.size, 0), mask))
    img.alpha_composite(vig)
    save(img, rel)


# ────────────────────────── 方块（7 张） ──────────────────────────
def make_block(rel, color, stone=False, brittle=False):
    size = 160
    S = size * SS
    img = new_canvas(size, size)
    margin = int(S * 0.04)
    r = int(S * 0.22)
    box = [margin, margin, S - margin, S - margin]

    if stone:
        base = (196, 186, 174)
        paste_rounded(img, box, r, rgba(base))
        d = ImageDraw.Draw(img)
        for i in range(5):
            x = margin + (S - 2 * margin) * (0.2 + 0.15 * i)
            d.line([(x, margin + S * 0.2), (x - S * 0.06, S - margin - S * 0.2)],
                   fill=rgba((150, 140, 128)), width=int(S * 0.02))
        paste_rounded(img, [box[0], box[1], box[2], box[1] + int(S * 0.28)], r, rgba(WHITE, 40))
        save(img, rel)
        return

    if brittle:
        base = (206, 228, 240)
        paste_rounded(img, box, r, rgba(base))
        d = ImageDraw.Draw(img)
        for i in range(4):
            x = margin + (S - 2 * margin) * (0.18 + 0.2 * i)
            d.line([(x, margin + S * 0.12), (x + S * 0.05, S - margin - S * 0.1)],
                   fill=rgba((140, 186, 214)), width=int(S * 0.018))
        paste_rounded(img, [box[0], box[1], box[2], box[1] + int(S * 0.26)], r, rgba(WHITE, 60))
        save(img, rel)
        return

    # 果冻方块：底色 + 顶部高光 + 内阴影 + 细边
    soft_shadow(img, box, r, offset=(0, int(S * 0.02)), blur=int(S * 0.03), alpha=40)
    paste_rounded(img, box, r, rgba(mix(color, WHITE, 0.06)))
    # 内阴影（右下）
    paste_rounded(img, [box[0] + int(S * 0.03), box[1] + int(S * 0.05), box[2] - int(S * 0.03), box[3] - int(S * 0.03)],
                  r, rgba(mix(color, (0, 0, 0), 0.08)))
    # 顶部高光
    gloss = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(gloss)
    gd.rounded_rectangle([box[0] + S * 0.08, box[1] + S * 0.07, box[2] - S * 0.08, box[1] + S * 0.38],
                         radius=int(r * 0.8), fill=rgba(WHITE, 92))
    gloss = gloss.filter(ImageFilter.GaussianBlur(int(S * 0.012)))
    img.alpha_composite(gloss)
    # 边框
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box, radius=r, outline=rgba(mix(color, (0, 0, 0), 0.18)), width=max(2, int(S * 0.012)))
    save(img, rel)


# ────────────────────────── 特殊叠加（6 张） ──────────────────────────
def make_special(rel, kind, color):
    size = 160
    S = size * SS
    img = new_canvas(size, size)
    d = ImageDraw.Draw(img)
    c = S / 2
    white = rgba(WHITE, 232)
    if kind in ("stripe_h", "stripe_v"):
        w = int(S * 0.10)
        if kind == "stripe_h":
            for y in (0.34, 0.66):
                d.rounded_rectangle([S * 0.1, S * y - w / 2, S * 0.9, S * y + w / 2], radius=w // 2, fill=white)
        else:
            for x in (0.34, 0.66):
                d.rounded_rectangle([S * x - w / 2, S * 0.1, S * x + w / 2, S * 0.9], radius=w // 2, fill=white)
    elif kind == "rainbow":
        for i in range(6):
            r = S * (0.16 + i * 0.05)
            d.arc([c - r, c - r, c + r, c + r], start=200 + i * 12, end=340 - i * 6,
                  fill=rgba(mix(color, WHITE, 0.4 + i * 0.08)), width=int(S * 0.035))
        d.ellipse([c - S * 0.06, c - S * 0.06, c + S * 0.06, c + S * 0.06], fill=rgba(WHITE, 230))
    elif kind == "bomb":
        d.ellipse([c - S * 0.2, c - S * 0.2, c + S * 0.2, c + S * 0.2], outline=rgba(WHITE, 235), width=int(S * 0.05))
        d.line([c + S * 0.12, c - S * 0.14, c + S * 0.24, c - S * 0.26], fill=rgba(WHITE, 235), width=int(S * 0.04))
    elif kind == "cross":
        w = int(S * 0.09)
        d.rounded_rectangle([S * 0.12, c - w / 2, S * 0.88, c + w / 2], radius=w // 2, fill=white)
        d.rounded_rectangle([c - w / 2, S * 0.12, c + w / 2, S * 0.88], radius=w // 2, fill=white)
    elif kind == "prism":
        pts = [(c, S * 0.18), (S * 0.84, S * 0.74), (S * 0.16, S * 0.74)]
        d.polygon(pts, outline=rgba(WHITE, 240), width=int(S * 0.04))
        d.line([c, S * 0.18, c, S * 0.74], fill=rgba(WHITE, 180), width=int(S * 0.03))
    save(img, rel)


# ────────────────────────── UI 面板/按钮（12 张） ──────────────────────────
def make_panel(rel, w, h, r, fill, border, shadow=True, gold=False):
    img = new_canvas(w, h)
    S = SS
    box = [int(10 * S), int(10 * S), int((w - 10) * S), int((h - 10) * S)]
    if shadow:
        soft_shadow(img, box, r * S, offset=(0, int(6 * S)), blur=int(10 * S), alpha=46)
    paste_rounded(img, box, r * S, rgba(fill))
    if gold:
        paste_rounded(img, [box[0] + 4 * S, box[1] + 4 * S, box[2] - 4 * S, box[3] - 4 * S], (r - 4) * S,
                      rgba(WHITE, 0), outline=rgba(GOLD), width=int(5 * S))
    else:
        paste_rounded(img, box, r * S, rgba(WHITE, 0), outline=rgba(border), width=max(2, int(2 * S)))
    # 顶部柔光（中心仍然平坦，9-slice 安全）
    gloss = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(gloss).rounded_rectangle(
        [box[0] + 8 * S, box[1] + 6 * S, box[2] - 8 * S, box[1] + int(h * 0.34) * S], radius=r * S, fill=rgba(WHITE, 44)
    )
    gloss = gloss.filter(ImageFilter.GaussianBlur(6 * S))
    img.alpha_composite(gloss)
    save(img, rel)


def make_button(rel, kind):
    w, h = 256, 128
    if kind == "btn_icon":
        w, h = 128, 128
    if kind == "btn_close":
        w, h = 96, 96
    if kind == "btn_primary":
        fill, border = STRAWBERRY, mix(STRAWBERRY, (0, 0, 0), 0.16)  # 主按钮 = 主色莓粉
    elif kind == "btn_secondary":
        fill, border = WHITE, EDGE
    elif kind == "btn_ghost":
        fill, border = (255, 244, 250), (238, 214, 228)
    elif kind == "btn_icon":
        fill, border = WHITE, EDGE
    else:
        fill, border = (255, 240, 246), (242, 204, 220)
    r = 20 if kind not in ("btn_icon", "btn_close") else min(w, h) // 2
    make_panel(rel, w, h, r, fill, border, shadow=(kind == "btn_primary"))


def make_bar(rel, kind):
    w, h = 256, 24
    img = new_canvas(w, h)
    S = SS
    if kind == "bar_track":
        paste_rounded(img, [2 * S, 2 * S, (w - 2) * S, (h - 2) * S], (h // 2 - 2) * S, rgba(EDGE))
    else:
        paste_rounded(img, [2 * S, 2 * S, (w - 2) * S, (h - 2) * S], (h // 2 - 2) * S, rgba(STRAWBERRY))
        paste_rounded(img, [4 * S, 4 * S, (w - 4) * S, (h // 2 + 1) * S], (h // 2 - 4) * S, rgba(WHITE, 70))
    save(img, rel)


# ────────────────────────── 图标（50 张） ──────────────────────────
def make_icon(rel, symbol, color, second=None):
    size = 96
    S = size * SS
    img = new_canvas(size, size)
    d = ImageDraw.Draw(img)
    c = S / 2
    second = second or mix(color, WHITE, 0.45)
    lw = max(3, int(S * 0.075))

    def rr(box, r, fill=None, outline=None, width=0):
        d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)

    if symbol == "coin":
        d.ellipse([S * 0.16, S * 0.16, S * 0.84, S * 0.84], fill=rgba(GOLD), outline=rgba(mix(GOLD, (0, 0, 0), 0.18)), width=lw)
        d.ellipse([S * 0.3, S * 0.3, S * 0.7, S * 0.7], outline=rgba(WHITE, 200), width=int(lw * 0.8))
    elif symbol == "star":
        pts = []
        for i in range(10):
            ang = -math.pi / 2 + i * math.pi / 5
            r = S * (0.4 if i % 2 == 0 else 0.18)
            pts.append((c + math.cos(ang) * r, c + math.sin(ang) * r))
        d.polygon(pts, fill=rgba(GOLD), outline=rgba(mix(GOLD, (0, 0, 0), 0.2)), width=lw)
    elif symbol == "star_empty":
        pts = []
        for i in range(10):
            ang = -math.pi / 2 + i * math.pi / 5
            r = S * (0.4 if i % 2 == 0 else 0.18)
            pts.append((c + math.cos(ang) * r, c + math.sin(ang) * r))
        d.polygon(pts, fill=rgba((240, 228, 238)), outline=rgba((220, 202, 220)), width=lw)
    elif symbol == "lock":
        rr([S * 0.2, S * 0.44, S * 0.8, S * 0.86], S * 0.08, rgba(mix(color, WHITE, 0.2)))
        d.arc([S * 0.3, S * 0.14, S * 0.7, S * 0.6], 180, 360, fill=rgba(color), width=lw)
    elif symbol == "check":
        d.line([S * 0.2, S * 0.52, S * 0.42, S * 0.74, S * 0.82, S * 0.26], fill=rgba(color), width=lw, joint="curve")
    elif symbol == "flame":
        d.polygon([(c, S * 0.1), (S * 0.78, S * 0.55), (S * 0.68, S * 0.86), (S * 0.32, S * 0.86), (S * 0.22, S * 0.55)],
                  fill=rgba(ORANGE))
        d.ellipse([S * 0.36, S * 0.48, S * 0.64, S * 0.82], fill=rgba((255, 230, 150)))
    elif symbol == "calendar":
        rr([S * 0.14, S * 0.22, S * 0.86, S * 0.86], S * 0.1, rgba(WHITE), outline=rgba(color), width=lw)
        d.line([S * 0.14, S * 0.4, S * 0.86, S * 0.4], fill=rgba(color), width=lw)
        for i in range(3):
            d.ellipse([S * 0.26 + i * S * 0.18, S * 0.54, S * 0.34 + i * S * 0.18, S * 0.62], fill=rgba(color))
    elif symbol in ("pause", "pause_small"):
        w = int(S * 0.12)
        rr([S * 0.28, S * 0.2, S * 0.28 + w, S * 0.8], w // 2, rgba(INK))
        rr([S * 0.6, S * 0.2, S * 0.6 + w, S * 0.8], w // 2, rgba(INK))
    elif symbol == "play":
        d.polygon([(S * 0.34, S * 0.2), (S * 0.8, S * 0.5), (S * 0.34, S * 0.8)], fill=rgba(INK))
    elif symbol == "home":
        d.polygon([(c, S * 0.14), (S * 0.86, S * 0.5), (S * 0.14, S * 0.5)], fill=rgba(color))
        rr([S * 0.22, S * 0.48, S * 0.78, S * 0.86], S * 0.04, rgba(color))
    elif symbol == "back":
        d.line([S * 0.66, S * 0.2, S * 0.3, S * 0.5, S * 0.66, S * 0.8], fill=rgba(INK), width=lw, joint="curve")
    elif symbol in ("left", "right", "rotate", "drop"):
        if symbol == "left":
            d.line([S * 0.66, S * 0.24, S * 0.3, S * 0.5, S * 0.66, S * 0.76], fill=rgba(INK), width=lw, joint="curve")
        elif symbol == "right":
            d.line([S * 0.34, S * 0.24, S * 0.7, S * 0.5, S * 0.34, S * 0.76], fill=rgba(INK), width=lw, joint="curve")
        elif symbol == "rotate":
            d.arc([S * 0.18, S * 0.18, S * 0.82, S * 0.82], 40, 320, fill=rgba(INK), width=lw)
            d.polygon([(S * 0.74, S * 0.16), (S * 0.9, S * 0.34), (S * 0.66, S * 0.36)], fill=rgba(INK))
        else:
            d.line([c, S * 0.16, c, S * 0.7], fill=rgba(INK), width=lw)
            d.polygon([(c - S * 0.14, S * 0.62), (c + S * 0.14, S * 0.62), (c, S * 0.84)], fill=rgba(INK))
    elif symbol in ("1x", "2x"):
        d.text((S * 0.5, S * 0.5), "1x" if symbol == "1x" else "2x", fill=rgba(INK), anchor="mm",
               font=None, stroke_width=0)
    elif symbol == "share":
        for (x, y) in [(0.26, 0.5), (0.7, 0.26), (0.7, 0.74)]:
            d.ellipse([S * x - S * 0.09, S * y - S * 0.09, S * x + S * 0.09, S * y + S * 0.09], fill=rgba(color))
        d.line([S * 0.34, S * 0.46, S * 0.62, S * 0.3], fill=rgba(color), width=lw)
        d.line([S * 0.34, S * 0.54, S * 0.62, S * 0.7], fill=rgba(color), width=lw)
    elif symbol == "hint":
        d.ellipse([S * 0.2, S * 0.16, S * 0.8, S * 0.66], fill=rgba((255, 232, 160)), outline=rgba(GOLD), width=lw)
        rr([S * 0.38, S * 0.66, S * 0.62, S * 0.84], S * 0.05, rgba(GOLD))
    elif symbol == "restart":
        d.arc([S * 0.2, S * 0.2, S * 0.8, S * 0.8], 120, 420, fill=rgba(INK), width=lw)
        d.polygon([(S * 0.2, S * 0.3), (S * 0.36, S * 0.18), (S * 0.4, S * 0.4)], fill=rgba(INK))
    elif symbol == "close":
        d.line([S * 0.26, S * 0.26, S * 0.74, S * 0.74], fill=rgba(INK), width=lw)
        d.line([S * 0.74, S * 0.26, S * 0.26, S * 0.74], fill=rgba(INK), width=lw)
    elif symbol == "score":
        rr([S * 0.14, S * 0.3, S * 0.86, S * 0.8], S * 0.1, rgba(WHITE), outline=rgba(color), width=lw)
        for i in range(3):
            d.line([S * 0.28, S * 0.44 + i * S * 0.12, S * 0.72, S * 0.44 + i * S * 0.12], fill=rgba(color), width=int(lw * 0.6))
    elif symbol == "chain":
        d.ellipse([S * 0.12, S * 0.34, S * 0.52, S * 0.74], outline=rgba(color), width=lw)
        d.ellipse([S * 0.48, S * 0.26, S * 0.88, S * 0.66], outline=rgba(second), width=lw)
    elif symbol == "block":
        rr([S * 0.16, S * 0.16, S * 0.6, S * 0.6], S * 0.1, rgba(color))
        rr([S * 0.42, S * 0.42, S * 0.86, S * 0.86], S * 0.1, rgba(second))
    elif symbol == "row":
        for i in range(3):
            rr([S * 0.14, S * 0.22 + i * S * 0.2, S * 0.86, S * 0.36 + i * S * 0.2], S * 0.05, rgba(color if i == 1 else second))
    elif symbol == "sugar":
        d.rounded_rectangle([S * 0.24, S * 0.3, S * 0.76, S * 0.82], radius=S * 0.14, fill=rgba((255, 236, 250)), outline=rgba(color), width=lw)
        d.ellipse([S * 0.34, S * 0.14, S * 0.66, S * 0.4], fill=rgba(WHITE), outline=rgba(color), width=int(lw * 0.7))
    elif symbol == "start":
        d.polygon([(c, S * 0.12), (S * 0.82, S * 0.7), (S * 0.18, S * 0.7)], fill=rgba(color))
        d.ellipse([S * 0.3, S * 0.56, S * 0.7, S * 0.86], fill=rgba(second))
    elif symbol == "shield":
        d.polygon([(c, S * 0.12), (S * 0.84, S * 0.3), (S * 0.76, S * 0.68), (c, S * 0.88), (S * 0.24, S * 0.68), (S * 0.16, S * 0.3)],
                  fill=rgba(color))
        d.line([S * 0.34, S * 0.48, S * 0.46, S * 0.62, S * 0.68, S * 0.36], fill=rgba(WHITE), width=lw, joint="curve")
    elif symbol == "slow":
        d.ellipse([S * 0.14, S * 0.14, S * 0.86, S * 0.86], outline=rgba(color), width=lw)
        d.line([c, c, c, S * 0.3], fill=rgba(INK), width=lw)
        d.line([c, c, S * 0.68, S * 0.62], fill=rgba(INK), width=lw)
    elif symbol == "special":
        pts = []
        for i in range(8):
            ang = i * math.pi / 4
            r = S * (0.42 if i % 2 == 0 else 0.2)
            pts.append((c + math.cos(ang) * r, c + math.sin(ang) * r))
        d.polygon(pts, fill=rgba(GOLD))
    elif symbol == "stone":
        d.polygon([(S * 0.24, S * 0.76), (S * 0.3, S * 0.38), (S * 0.56, S * 0.2), (S * 0.8, S * 0.44), (S * 0.72, S * 0.78)],
                  fill=rgba((186, 176, 164)))
        d.line([S * 0.38, S * 0.4, S * 0.5, S * 0.62, S * 0.66, S * 0.52], fill=rgba((140, 130, 120)), width=int(lw * 0.7))
    elif symbol == "mutation_frost":
        for i in range(3):
            x = S * (0.3 + i * 0.2)
            d.line([x, S * 0.18, x, S * 0.82], fill=rgba(SODA), width=int(lw * 0.8))
            d.line([x - S * 0.1, S * 0.34, x + S * 0.1, S * 0.34], fill=rgba(SODA), width=int(lw * 0.7))
    elif symbol == "mutation_fog":
        for i in range(3):
            d.arc([S * 0.1, S * 0.28 + i * S * 0.16, S * 0.9, S * 0.62 + i * S * 0.16], 180, 360,
                  fill=rgba(mix(INK_SOFT, WHITE, 0.3)), width=lw)
    elif symbol == "mutation_mirror":
        d.line([c, S * 0.12, c, S * 0.88], fill=rgba(mix(INK_SOFT, WHITE, 0.4)), width=int(lw * 0.7))
        d.polygon([(S * 0.18, S * 0.3), (S * 0.42, S * 0.5), (S * 0.18, S * 0.7)], fill=rgba(GRAPE))
        d.polygon([(S * 0.82, S * 0.3), (S * 0.58, S * 0.5), (S * 0.82, S * 0.7)], fill=rgba(GRAPE))
    elif symbol == "mutation_inverted":
        d.polygon([(c, S * 0.84), (S * 0.78, S * 0.3), (S * 0.22, S * 0.3)], fill=rgba(ORANGE))
        d.line([c, S * 0.3, c, S * 0.16], fill=rgba(INK), width=lw)
    elif symbol == "mutation_mono":
        d.ellipse([S * 0.14, S * 0.34, S * 0.56, S * 0.76], fill=rgba(STRAWBERRY))
        d.ellipse([S * 0.44, S * 0.24, S * 0.86, S * 0.66], fill=rgba(STRAWBERRY))
    elif symbol == "mutation_backflow":
        for i in range(3):
            d.arc([S * 0.1, S * 0.2 + i * S * 0.2, S * 0.9, S * 0.7 + i * S * 0.2], 20, 160, fill=rgba(SODA), width=lw)
        d.polygon([(S * 0.2, S * 0.24), (S * 0.34, S * 0.14), (S * 0.36, S * 0.32)], fill=rgba(SODA))
    elif symbol == "mutation_brittle":
        d.polygon([(S * 0.5, S * 0.12), (S * 0.82, S * 0.5), (S * 0.56, S * 0.5), (S * 0.68, S * 0.88), (S * 0.24, S * 0.46), (S * 0.48, S * 0.46)],
                  fill=rgba((150, 210, 240)))
    elif symbol == "mutation_magnet":
        d.arc([S * 0.18, S * 0.2, S * 0.82, S * 0.96], 180, 360, fill=rgba(STRAWBERRY), width=int(lw * 1.3))
        d.rectangle([S * 0.18, S * 0.52, S * 0.3, S * 0.72], fill=rgba(STRAWBERRY))
        d.rectangle([S * 0.7, S * 0.52, S * 0.82, S * 0.72], fill=rgba(STRAWBERRY))
    elif symbol.startswith("chapter_"):
        idx = int(symbol.split("_")[1])
        col = PALETTE[(idx - 1) % 5]
        d.ellipse([S * 0.12, S * 0.12, S * 0.88, S * 0.88], fill=rgba(mix(col, WHITE, 0.25)), outline=rgba(mix(col, INK, 0.2)), width=lw)
        d.ellipse([S * 0.3, S * 0.3, S * 0.7, S * 0.7], fill=rgba(mix(col, WHITE, 0.6)))
    else:
        # 兜底：圆 + 首字母（不会出现在正式包，占位图另有专门文件）
        d.ellipse([S * 0.12, S * 0.12, S * 0.88, S * 0.88], fill=rgba(mix(color, WHITE, 0.3)), outline=rgba(color), width=lw)

    save(img, rel)


# ────────────────────────── 特效（8 张） ──────────────────────────
def make_fx(rel, kind):
    size = 256
    S = size * SS
    img = new_canvas(size, size)
    d = ImageDraw.Draw(img)
    c = S / 2
    if kind == "spark":
        for i in range(8):
            ang = i * math.pi / 4
            x2 = c + math.cos(ang) * S * 0.42
            y2 = c + math.sin(ang) * S * 0.42
            d.line([c, c, x2, y2], fill=rgba(WHITE, 220), width=int(S * 0.02))
    elif kind == "star":
        pts = []
        for i in range(10):
            ang = -math.pi / 2 + i * math.pi / 5
            r = S * (0.42 if i % 2 == 0 else 0.16)
            pts.append((c + math.cos(ang) * r, c + math.sin(ang) * r))
        d.polygon(pts, fill=rgba(WHITE, 235))
    elif kind == "frost":
        for i in range(6):
            ang = i * math.pi / 3
            d.line([c, c, c + math.cos(ang) * S * 0.4, c + math.sin(ang) * S * 0.4],
                   fill=rgba((200, 236, 255), 220), width=int(S * 0.018))
    elif kind == "shockwave":
        for i in range(3):
            r = S * (0.16 + i * 0.1)
            d.ellipse([c - r, c - r, c + r, c + r], outline=rgba(WHITE, 200 - i * 50), width=int(S * 0.02))
    elif kind == "prism":
        for i in range(5):
            r = S * (0.1 + i * 0.07)
            d.ellipse([c - r, c - r, c + r, c + r], outline=rgba(PALETTE[i % 5], 190), width=int(S * 0.014))
    elif kind == "confetti":
        rnd = random.Random(7)
        for i in range(26):
            x = rnd.randint(int(S * 0.12), int(S * 0.88))
            y = rnd.randint(int(S * 0.12), int(S * 0.88))
            col = PALETTE[i % 5]
            d.rectangle([x, y, x + S * 0.03, y + S * 0.015], fill=rgba(col, 230))
    elif kind == "ring":
        d.ellipse([c - S * 0.4, c - S * 0.4, c + S * 0.4, c + S * 0.4], outline=rgba(WHITE, 220), width=int(S * 0.03))
    elif kind == "glow":
        for i in range(10, 0, -1):
            r = S * 0.04 * i
            d.ellipse([c - r, c - r, c + r, c + r], fill=rgba(WHITE, 8))
    save(img, rel)


# ────────────────────────── 品牌（3 张） ──────────────────────────
def make_logo():
    w, h = 600, 200
    img = new_canvas(w, h)
    d = ImageDraw.Draw(img)
    # 三颗糖果方块 + 文字留白（文字一律 Label，图片里不放字）
    for i, col in enumerate([STRAWBERRY, ORANGE, LIME]):
        x = 40 + i * 96
        paste_rounded(img, [x * SS, 48 * SS, (x + 78) * SS, 152 * SS], 20 * SS, rgba(col))
        paste_rounded(img, [(x + 8) * SS, 56 * SS, (x + 70) * SS, 92 * SS], 14 * SS, rgba(WHITE, 70))
    save(img, "art/ui/logo.png")


def make_share_card():
    w, h = 500, 400
    img = vertical_gradient(w * SS, h * SS, CREAM, (255, 224, 240))
    d = ImageDraw.Draw(img)
    for i in range(12):
        x = random.Random(i).randint(0, w) * SS
        y = random.Random(i + 99).randint(0, h) * SS
        r = random.Random(i + 7).randint(30, 90) * SS
        d.ellipse([x - r, y - r, x + r, y + r], fill=rgba(PALETTE[i % 5], 40))
    paste_rounded(img, [40 * SS, 40 * SS, (w - 40) * SS, (h - 40) * SS], 28 * SS, rgba(WHITE, 210))
    save(img, "art/ui/share_card.png")


def make_placeholder():
    size = 64
    S = size * SS
    img = new_canvas(size, size)
    d = ImageDraw.Draw(img)
    paste_rounded(img, [6 * SS, 6 * SS, (size - 6) * SS, (size - 6) * SS], 12 * SS, rgba((240, 228, 238)))
    d.line([16 * SS, 16 * SS, 48 * SS, 48 * SS], fill=rgba(INK_SOFT), width=4 * SS)
    d.line([48 * SS, 16 * SS, 16 * SS, 48 * SS], fill=rgba(INK_SOFT), width=4 * SS)
    save(img, "art/ui/placeholder.png")


# ────────────────────────── 主流程 ──────────────────────────
def main():
    ensure(ART)

    # 9 背景
    make_background("art/bg/bg_home.jpg", (255, 246, 250), (243, 220, 240), STRAWBERRY, 1)
    for ch, (top, mid, accent) in CHAPTER_THEMES.items():
        make_background(f"art/bg/bg_ch{ch}.jpg", top, mid, accent, 10 + ch)
    make_background("art/bg/bg_daily.jpg", (250, 246, 255), (226, 222, 250), GRAPE, 21)
    make_background("art/bg/bg_result.jpg", (255, 248, 244), (255, 224, 234), STRAWBERRY, 22)

    # 3 棋盘
    make_panel("art/board/board_tray.png", 620, 992, 26, (255, 246, 250, 255), (240, 214, 228, 255))
    make_panel("art/board/board_frame.png", 640, 1012, 30, (255, 255, 255, 0), GOLD, shadow=False, gold=True)
    make_panel("art/board/cell.png", 96, 96, 16, (250, 236, 244, 255), (242, 224, 234, 255), shadow=False)

    # 7 方块
    for i, col in enumerate(PALETTE):
        make_block(f"art/blocks/block_{i}.png", col)
    make_block("art/blocks/block_stone.png", (196, 186, 174), stone=True)
    make_block("art/blocks/block_brittle.png", (206, 228, 240), brittle=True)

    # 6 特殊叠加
    for kind, col in [("stripe_h", LIME), ("stripe_v", LIME), ("rainbow", GRAPE), ("bomb", STRAWBERRY), ("cross", SODA), ("prism", GRAPE)]:
        make_special(f"art/special/{kind}.png", kind, col)

    # 12 面板/按钮/条
    make_panel("art/ui/panel_card.png", 256, 256, 24, (255, 255, 255, 240), (244, 214, 230, 255))
    make_panel("art/ui/panel_popup.png", 384, 384, 32, (255, 255, 255, 248), (244, 214, 230, 255))
    make_panel("art/ui/panel_strip.png", 256, 96, 20, (74, 48, 62, 228), (74, 48, 62, 228), shadow=False)
    for kind in ["btn_primary", "btn_secondary", "btn_ghost", "btn_icon", "btn_close"]:
        make_button(f"art/ui/{kind}.png", kind)
    make_bar("art/ui/bar_track.png", "track")
    make_bar("art/ui/bar_fill.png", "fill")
    make_panel("art/ui/mask.png", 128, 128, 0, (26, 18, 8, 160), (26, 18, 8, 160), shadow=False)
    make_panel("art/ui/frame_gold.png", 256, 256, 24, (255, 255, 255, 0), GOLD, shadow=False, gold=True)

    # 50 图标
    mutations = ["mutation_frost", "mutation_fog", "mutation_mirror", "mutation_inverted",
                 "mutation_mono", "mutation_backflow", "mutation_brittle", "mutation_magnet"]
    for i, m in enumerate(mutations):
        make_icon(f"art/icon/{m}.png", m, PALETTE[i % 5])

    talents = [("talent_score", "score", STRAWBERRY), ("talent_chain", "chain", ORANGE),
               ("talent_block", "block", LIME), ("talent_row", "row", SODA),
               ("talent_sugar", "sugar", GRAPE), ("talent_start", "start", ORANGE),
               ("talent_shield", "shield", SODA), ("talent_slow", "slow", LIME),
               ("talent_special", "special", GOLD), ("talent_stone", "stone", (170, 160, 150))]
    for name, symbol, col in talents:
        make_icon(f"art/icon/{name}.png", symbol, col)

    goals = [("goal_score", "score", STRAWBERRY), ("goal_rows", "row", SODA),
             ("goal_color", "block", GRAPE), ("goal_special", "special", GOLD),
             ("goal_burst", "sugar", GRAPE), ("goal_stone", "stone", (170, 160, 150))]
    for name, symbol, col in goals:
        make_icon(f"art/icon/{name}.png", symbol, col)

    for i in range(1, 7):
        make_icon(f"art/icon/chapter_{i}.png", f"chapter_{i}", PALETTE[(i - 1) % 5])

    resources = [("icon_coin", "coin", GOLD), ("icon_star", "star", GOLD), ("icon_lock", "lock", INK_SOFT),
                 ("icon_check", "check", LIME), ("icon_flame", "flame", ORANGE), ("icon_calendar", "calendar", SODA)]
    for name, symbol, col in resources:
        make_icon(f"art/icon/{name}.png", symbol, col)

    controls = [("ctrl_pause", "pause"), ("ctrl_restart", "restart"), ("ctrl_home", "home"),
                ("ctrl_back", "back"), ("ctrl_play", "play"), ("ctrl_pause_small", "pause_small"),
                ("ctrl_1x", "1x"), ("ctrl_2x", "2x"), ("ctrl_share", "share"), ("ctrl_hint", "hint"),
                ("ctrl_left", "left"), ("ctrl_right", "right"), ("ctrl_rotate", "rotate"), ("ctrl_drop", "drop")]
    for name, symbol in controls:
        make_icon(f"art/icon/{name}.png", symbol, INK)

    # 2 星级
    make_icon("art/icon/star_filled.png", "star", GOLD)
    make_icon("art/icon/star_empty.png", "star_empty", (214, 196, 175))

    # 8 特效
    for kind in ["spark", "star", "frost", "shockwave", "prism", "confetti", "ring", "glow"]:
        make_fx(f"art/fx/{kind}.png", kind)

    # 3 品牌
    make_logo()
    make_share_card()
    make_placeholder()

    # 统计
    count = 0
    for _, _, files in os.walk(ART):
        count += len([f for f in files if f.endswith((".png", ".jpg"))])
    print(f"[art] 产出 {count} 张图 → {ART}")


if __name__ == "__main__":
    main()
