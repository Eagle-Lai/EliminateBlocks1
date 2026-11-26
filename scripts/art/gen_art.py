#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
美术生产管线 v4「极光糖晶 Aurora Jelly」：深靛紫极光背景 / 宝石果冻方块 / 立体厚边按钮 / 玻璃卡片。

为什么用程序化绘制而不是逐张生成：
  · 色板与光照必须完全统一（一百多张图要"像一套"）；
  · 9-slice 需要"中心平坦"，生成式图片很难保证；
  · 尺寸/透明/命名要可重复、可校验，CI 里能重跑。

约束（换皮不换结构）：
  · 已有文件名与像素尺寸保持不变（Prefab/meta 引用不受影响）；
  · 图里不放文字（文字一律 Label，便于本地化与字体统一）；
  · 9-slice 图的中心区域保持平坦，边框宽度见 scripts/art/apply-meta.py。

输出：assets/resources/art/**
用法：python scripts/art/gen_art.py
"""
import math
import os
import random
import shutil

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, "assets", "resources", "art")

# ────────────────────────── 风格圣经 v4 ──────────────────────────
# 背景：深靛 → 葡萄紫的夜空渐变 + 洋红/青色极光带 + 散景星点。
# 方块：五色宝石果冻（粉/橙/绿/蓝/紫 色相保持不变，保证玩法辨识与色盲双通道）。
# 按钮：立体厚边（底部 10px 深色唇边）+ 上半截硬高光；主=阳光金橙，次=天空蓝，图标=葡萄紫。
# 卡片：局内/列表用「玻璃卡」（半透明白 + 亮边），模态弹窗用「奶白卡」+ 紫色描边。
PINK = (255, 78, 140)      # 莓果粉
ORANGE = (255, 158, 36)    # 琥珀橙
GREEN = (40, 210, 140)     # 翡翠绿
BLUE = (58, 148, 255)      # 蓝宝石
PURPLE = (172, 96, 255)    # 紫水晶
PALETTE = [PINK, ORANGE, GREEN, BLUE, PURPLE]

NIGHT_TOP = (28, 20, 84)       # 背景顶
NIGHT_BOTTOM = (74, 34, 128)   # 背景底
EDGE = (40, 26, 100)           # 背景边缘主色（留边/清屏色）
GOLD = (255, 200, 56)          # 强调金（星星/金币/金框）
GOLD_DEEP = (214, 120, 20)
INK = (40, 30, 90)             # 浅色卡片上的文字主色
INK_SOFT = (112, 100, 160)
VIOLET = (124, 92, 236)        # 描边/图标按钮主色
VIOLET_DEEP = (74, 46, 170)
OUTLINE = (34, 20, 78)         # 贴纸描边
WHITE = (255, 255, 255)
CREAM = (255, 252, 255)

CHAPTER_THEMES = {
    # (顶色, 底色, 极光 A, 极光 B)
    1: ((34, 22, 92), (96, 36, 132), (255, 90, 170), (90, 190, 255)),    # 莓果极光
    2: ((24, 26, 96), (70, 44, 150), (170, 120, 255), (90, 220, 255)),   # 薰衣草夜
    3: ((52, 22, 78), (128, 52, 96), (255, 150, 60), (255, 90, 150)),    # 琥珀晚霞
    4: ((12, 36, 80), (24, 92, 116), (60, 230, 170), (90, 160, 255)),    # 翡翠深海
    5: ((14, 26, 90), (36, 70, 160), (80, 200, 255), (170, 130, 255)),   # 蓝宝冰川
    6: ((40, 16, 80), (100, 30, 130), (220, 100, 255), (255, 110, 160)), # 紫晶宫
}

SS = 3  # 超采样倍数


# ────────────────────────── 基础工具 ──────────────────────────
def ensure(path):
    os.makedirs(path, exist_ok=True)


def rgba(color, a=255):
    return (int(color[0]), int(color[1]), int(color[2]), int(a))


def mix(c1, c2, t):
    return tuple(int(round(c1[i] + (c2[i] - c1[i]) * t)) for i in range(3))


def darker(c, t):
    return mix(c, (0, 0, 0), t)


def lighter(c, t):
    return mix(c, WHITE, t)


def new_canvas(w, h):
    return Image.new("RGBA", (int(w * SS), int(h * SS)), (0, 0, 0, 0))


def save(img, rel, ss=SS):
    out = img.resize((img.width // ss, img.height // ss), Image.LANCZOS)
    rel = rel[4:] if rel.startswith("art/") else rel
    path = os.path.join(ART, rel)
    ensure(os.path.dirname(path))
    if rel.endswith(".jpg"):
        out.convert("RGB").save(path, "JPEG", quality=84, optimize=True, progressive=True)
    elif rel.split("/")[0] in QUANTIZE_DIRS:
        # 图标/特效/叠加层：256 色调色板（含 alpha），体积约为 RGBA 的 1/3，肉眼无差
        out.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(path, "PNG", optimize=True)
    else:
        out.save(path, "PNG", optimize=True)
    return path


# 9-slice 渐变（ui/board）与方块保留真彩，其余量化
QUANTIZE_DIRS = {"icon", "fx", "special"}


def rr_mask(size, box, r):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([int(v) for v in box], radius=int(r), fill=255)
    return m


def ellipse_mask(size, box):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).ellipse([int(v) for v in box], fill=255)
    return m


def grad_layer(size, top, bottom, a_top=255, a_bottom=None, y0=0, y1=None):
    """竖向渐变层（含透明度渐变），在 [y0, y1] 区间内插值。"""
    w, h = size
    y1 = h if y1 is None else y1
    a_bottom = a_top if a_bottom is None else a_bottom
    ys = np.clip((np.arange(h) - y0) / max(1, (y1 - y0)), 0, 1)[:, None]
    arr = np.zeros((h, w, 4), dtype=np.float32)
    for i in range(3):
        arr[:, :, i] = top[i] + (bottom[i] - top[i]) * ys
    arr[:, :, 3] = a_top + (a_bottom - a_top) * ys
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")


def fill_mask(base, mask, layer_or_color):
    """把颜色/图层按 mask 叠到 base 上。"""
    if isinstance(layer_or_color, tuple):
        layer = Image.new("RGBA", base.size, rgba(layer_or_color[:3], layer_or_color[3] if len(layer_or_color) > 3 else 255))
    else:
        layer = layer_or_color
    a = np.array(layer.getchannel("A"), dtype=np.float32) * (np.array(mask, dtype=np.float32) / 255.0)
    layer = layer.copy()
    layer.putalpha(Image.fromarray(a.astype(np.uint8)))
    base.alpha_composite(layer)


def soft_shadow(canvas, box, r, offset=(0, 10), blur=18, alpha=90, color=(10, 4, 40)):
    m = rr_mask(canvas.size, [box[0] + offset[0], box[1] + offset[1], box[2] + offset[0], box[3] + offset[1]], r)
    m = m.filter(ImageFilter.GaussianBlur(blur))
    layer = Image.new("RGBA", canvas.size, rgba(color, 0))
    layer.putalpha(m.point(lambda v: v * alpha // 255))
    canvas.alpha_composite(layer)


def stroke_ring(canvas, box, r, width, color, alpha=255):
    outer = rr_mask(canvas.size, box, r)
    inner = rr_mask(canvas.size, [box[0] + width, box[1] + width, box[2] - width, box[3] - width], max(0, r - width))
    ring = np.clip(np.array(outer, dtype=np.int16) - np.array(inner, dtype=np.int16), 0, 255).astype(np.uint8)
    fill_mask(canvas, Image.fromarray(ring), rgba(color, alpha))


def sticker_outline(img, width_px, color=OUTLINE, alpha=255):
    """贴纸描边：把 alpha 膨胀后垫一层深色（统一图标风格）。"""
    a = img.getchannel("A")
    grown = a.filter(ImageFilter.MaxFilter(width_px * 2 + 1)) if width_px > 0 else a
    grown = grown.filter(ImageFilter.GaussianBlur(max(1, width_px // 3)))
    under = Image.new("RGBA", img.size, rgba(color, 0))
    under.putalpha(grown.point(lambda v: min(255, v * 2) * alpha // 255))
    under.alpha_composite(img)
    return under


def drop_shadow(img, dy, blur, alpha=110, color=(20, 8, 60)):
    a = img.getchannel("A").filter(ImageFilter.GaussianBlur(blur))
    sh = Image.new("RGBA", img.size, rgba(color, 0))
    sh.putalpha(a.point(lambda v: v * alpha // 255))
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.alpha_composite(sh, (0, int(dy)))
    out.alpha_composite(img)
    return out


def sparkle(d, cx, cy, r, color=(255, 255, 255, 230)):
    """四角星闪光。"""
    pts = []
    for i in range(8):
        ang = -math.pi / 2 + i * math.pi / 4
        rr = r if i % 2 == 0 else r * 0.22
        pts.append((cx + math.cos(ang) * rr, cy + math.sin(ang) * rr))
    d.polygon(pts, fill=color)


# ────────────────────────── 背景（9 张） ──────────────────────────
def make_background(rel, top, bottom, aurora_a, aurora_b, seed):
    rnd = random.Random(seed)
    W, H = 750, 1334
    S = SS
    size = (W * S, H * S)
    img = grad_layer(size, top, bottom)

    # 极光带：两条大弧形色带，强模糊
    for col, cy, amp, thick, alpha in [
        (aurora_a, 0.26, 0.10, 0.11, 120),
        (aurora_b, 0.40, 0.08, 0.08, 95),
        (aurora_a, 0.70, 0.06, 0.10, 60),
    ]:
        layer = Image.new("RGBA", size, (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        phase = rnd.uniform(0, math.pi * 2)
        pts_top, pts_bot = [], []
        for i in range(0, 41):
            x = (i / 40) * W * 1.3 - W * 0.15
            y = H * (cy + amp * math.sin(i / 40 * math.pi * 1.6 + phase))
            t = H * thick * (0.6 + 0.4 * math.sin(i / 40 * math.pi * 2.3 + phase))
            pts_top.append((x * S, (y - t / 2) * S))
            pts_bot.append((x * S, (y + t / 2) * S))
        d.polygon(pts_top + pts_bot[::-1], fill=rgba(col, alpha))
        layer = layer.filter(ImageFilter.GaussianBlur(46 * S))
        img.alpha_composite(layer)

    # 大散景光斑
    for _ in range(9):
        cx = rnd.randint(-80, W + 80) * S
        cy = rnd.randint(-60, H + 60) * S
        r = rnd.randint(60, 200) * S
        col = rnd.choice([aurora_a, aurora_b, WHITE])
        layer = Image.new("RGBA", size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse([cx - r, cy - r, cx + r, cy + r], fill=rgba(col, rnd.randint(18, 42)))
        layer = layer.filter(ImageFilter.GaussianBlur(26 * S))
        img.alpha_composite(layer)

    # 星点 + 闪光
    d = ImageDraw.Draw(img)
    for _ in range(90):
        x = rnd.randint(4, W - 4) * S
        y = rnd.randint(4, int(H * 0.92)) * S
        r = rnd.choice([1, 1, 1, 2, 2, 3]) * S * 0.8
        d.ellipse([x - r, y - r, x + r, y + r], fill=rgba(WHITE, rnd.randint(70, 200)))
    for _ in range(9):
        x = rnd.randint(30, W - 30) * S
        y = rnd.randint(30, int(H * 0.8)) * S
        sparkle(d, x, y, rnd.randint(7, 14) * S, rgba(WHITE, rnd.randint(150, 230)))

    # 底部晶体丘陵剪影（低饱和，不抢棋盘）
    for i in range(3):
        layer = Image.new("RGBA", size, (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        base_y = H * (0.86 + i * 0.05)
        pts = [(0, H * S)]
        steps = 9
        for k in range(steps + 1):
            x = W * k / steps
            y = base_y - rnd.randint(10, 70) * (1 - i * 0.25)
            pts.append((x * S, y * S))
        pts.append((W * S, H * S))
        col = mix(bottom, (8, 4, 30), 0.35 + i * 0.2)
        ld.polygon(pts, fill=rgba(col, 170))
        layer = layer.filter(ImageFilter.GaussianBlur(2 * S))
        img.alpha_composite(layer)

    # 暗角
    vig = Image.new("L", size, 0)
    ImageDraw.Draw(vig).ellipse([-size[0] * 0.3, -size[1] * 0.18, size[0] * 1.3, size[1] * 1.18], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(90 * S))
    dark = Image.new("RGBA", size, (6, 2, 24, 0))
    dark.putalpha(vig.point(lambda v: (255 - v) * 110 // 255))
    img.alpha_composite(dark)
    save(img, rel)


# ────────────────────────── 方块（7 张） ──────────────────────────
def gem_block(S, color, inset=0.04, radius=0.24, gloss=True):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    m = int(S * inset)
    r = int(S * radius)
    box = [m, m, S - m, S - m]
    size = img.size
    # 底部唇边（立体厚度）
    fill_mask(img, rr_mask(size, box, r), rgba(darker(color, 0.32)))
    # 主体：上亮下暗
    face = [m, m, S - m, S - m - int(S * 0.07)]
    fill_mask(img, rr_mask(size, face, r), grad_layer(size, lighter(color, 0.22), darker(color, 0.06), y0=face[1], y1=face[3]))
    # 内斜面（亮边）
    stroke_ring(img, [face[0] + S * 0.02, face[1] + S * 0.02, face[2] - S * 0.02, face[3] - S * 0.02], r * 0.86, int(S * 0.025), lighter(color, 0.45), 150)
    if gloss:
        # 顶部硬高光（果冻感）
        gl = [face[0] + S * 0.12, face[1] + S * 0.07, face[2] - S * 0.12, face[1] + S * 0.36]
        fill_mask(img, rr_mask(size, gl, S * 0.12), grad_layer(size, WHITE, WHITE, 165, 30, y0=gl[1], y1=gl[3]))
        d = ImageDraw.Draw(img)
        d.ellipse([S * 0.18, S * 0.17, S * 0.27, S * 0.26], fill=rgba(WHITE, 230))
    # 外描边
    stroke_ring(img, box, r, max(2, int(S * 0.016)), darker(color, 0.45), 200)
    return img


def make_block(rel, color, stone=False, brittle=False):
    size = 160
    S = size * SS
    # 盘面糖块只留一像素接缝，圆角收在格边附近。图标和首页标志沿用各自的造型。
    tile_style = dict(inset=1 / size, radius=0.085)
    if stone:
        img = gem_block(S, (150, 140, 170), gloss=False, **tile_style)
        d = ImageDraw.Draw(img)
        rnd = random.Random(5)
        for _ in range(4):
            x = rnd.uniform(0.25, 0.75) * S
            y = rnd.uniform(0.25, 0.65) * S
            d.line([x, y, x + rnd.uniform(-0.12, 0.12) * S, y + rnd.uniform(0.08, 0.18) * S],
                   fill=rgba((96, 86, 120)), width=int(S * 0.018))
        for _ in range(5):
            x = rnd.uniform(0.2, 0.8) * S
            y = rnd.uniform(0.2, 0.75) * S
            r = rnd.uniform(0.02, 0.04) * S
            d.ellipse([x - r, y - r, x + r, y + r], fill=rgba((118, 108, 144)))
        save(img, rel)
        return
    if brittle:
        img = gem_block(S, (150, 210, 245), **tile_style)
        d = ImageDraw.Draw(img)
        crack = rgba((255, 255, 255), 220)
        w = int(S * 0.02)
        d.line([S * 0.3, S * 0.2, S * 0.45, S * 0.45, S * 0.36, S * 0.62, S * 0.5, S * 0.82], fill=crack, width=w, joint="curve")
        d.line([S * 0.45, S * 0.45, S * 0.7, S * 0.52, S * 0.8, S * 0.7], fill=crack, width=w, joint="curve")
        save(img, rel)
        return
    img = gem_block(S, color, **tile_style)
    save(img, rel)


# ────────────────────────── 特殊叠加（6 张） ──────────────────────────
def make_special(rel, kind, color):
    size = 160
    S = size * SS
    img = new_canvas(size, size)
    d = ImageDraw.Draw(img)
    c = S / 2
    white = rgba(WHITE, 245)
    if kind in ("stripe_h", "stripe_v"):
        w = int(S * 0.11)
        for p in (0.36, 0.64):
            if kind == "stripe_h":
                d.rounded_rectangle([S * 0.12, S * p - w / 2, S * 0.88, S * p + w / 2], radius=w // 2, fill=white)
            else:
                d.rounded_rectangle([S * p - w / 2, S * 0.12, S * p + w / 2, S * 0.88], radius=w // 2, fill=white)
    elif kind == "rainbow":
        for i, col in enumerate(PALETTE):
            r = S * (0.34 - i * 0.05)
            d.arc([c - r, c - r + S * 0.08, c + r, c + r + S * 0.08], start=190, end=350,
                  fill=rgba(lighter(col, 0.25)), width=int(S * 0.045))
        sparkle(d, c, c + S * 0.06, S * 0.1)
    elif kind == "bomb":
        d.ellipse([c - S * 0.22, c - S * 0.16, c + S * 0.22, c + S * 0.28], fill=rgba((40, 30, 80), 235))
        d.ellipse([c - S * 0.12, c - S * 0.08, c - S * 0.02, c + S * 0.02], fill=rgba(WHITE, 200))
        d.line([c + S * 0.1, c - S * 0.12, c + S * 0.22, c - S * 0.28], fill=white, width=int(S * 0.04))
        sparkle(d, c + S * 0.25, c - S * 0.31, S * 0.08, rgba(GOLD, 255))
    elif kind == "cross":
        w = int(S * 0.11)
        d.rounded_rectangle([S * 0.12, c - w / 2, S * 0.88, c + w / 2], radius=w // 2, fill=white)
        d.rounded_rectangle([c - w / 2, S * 0.12, c + w / 2, S * 0.88], radius=w // 2, fill=white)
    elif kind == "prism":
        pts = [(c, S * 0.16), (S * 0.84, S * 0.76), (S * 0.16, S * 0.76)]
        d.polygon(pts, fill=rgba(WHITE, 90), outline=white, width=int(S * 0.045))
        sparkle(d, c, S * 0.52, S * 0.12)
    img = drop_shadow(img, S * 0.015, S * 0.02, 150, darker(color, 0.6))
    save(img, rel)


# ────────────────────────── UI 面板/按钮 ──────────────────────────
def make_popup(rel, w, h, r):
    """模态奶白卡：紫色厚描边 + 底部唇边 + 投影；中心平坦。"""
    S = SS
    img = new_canvas(w, h)
    size = img.size
    box = [10 * S, 8 * S, (w - 10) * S, (h - 12) * S]
    soft_shadow(img, box, r * S, offset=(0, 6 * S), blur=8 * S, alpha=110)
    # 唇边
    fill_mask(img, rr_mask(size, box, r * S), rgba(VIOLET_DEEP))
    face = [box[0], box[1], box[2], box[3] - 8 * S]
    fill_mask(img, rr_mask(size, face, r * S), grad_layer(size, (160, 130, 255), VIOLET, y0=face[1], y1=face[3]))
    inner = [face[0] + 6 * S, face[1] + 6 * S, face[2] - 6 * S, face[3] - 6 * S]
    fill_mask(img, rr_mask(size, inner, (r - 6) * S), grad_layer(size, CREAM, (240, 236, 255), y0=inner[1], y1=inner[1] + 60 * S))
    stroke_ring(img, [face[0] + 2 * S, face[1] + 2 * S, face[2] - 2 * S, face[3] - 2 * S], (r - 2) * S, 2 * S, WHITE, 90)
    save(img, rel)


def make_glass(rel, w, h, r, alpha=46, rim=90):
    """玻璃卡：半透明白 + 亮边 + 顶部细高光；用于深色背景上的卡片/格子。"""
    S = SS
    img = new_canvas(w, h)
    size = img.size
    box = [4 * S, 4 * S, (w - 4) * S, (h - 4) * S]
    fill_mask(img, rr_mask(size, box, r * S), grad_layer(size, (196, 180, 255), (120, 96, 220), alpha + 14, alpha, y0=box[1], y1=box[3]))
    stroke_ring(img, box, r * S, max(2, int(2 * S)), WHITE, rim)
    # 顶部细高光线
    hl = [box[0] + r * S * 0.6, box[1] + 3 * S, box[2] - r * S * 0.6, box[1] + 6 * S]
    fill_mask(img, rr_mask(size, hl, 2 * S), rgba(WHITE, 90))
    save(img, rel)


def make_strip(rel, w, h):
    """胶囊条：近白中性底（运行时/Prefab 用 color 染色：Toast/横幅/标签/雾）。"""
    S = SS
    img = new_canvas(w, h)
    size = img.size
    r = (h // 2 - 4) * S
    box = [4 * S, 4 * S, (w - 4) * S, (h - 4) * S]
    fill_mask(img, rr_mask(size, box, r), grad_layer(size, (255, 255, 255), (228, 226, 240), y0=box[1], y1=box[3]))
    stroke_ring(img, box, r, 2 * S, (255, 255, 255), 160)
    save(img, rel)


def button3d(w, h, r, top, bottom, lip, rim=WHITE, lip_h=10, shadow=True):
    S = SS
    img = new_canvas(w, h)
    size = img.size
    box = [6 * S, 4 * S, (w - 6) * S, (h - 8) * S]
    if shadow:
        soft_shadow(img, box, r * S, offset=(0, 4 * S), blur=4 * S, alpha=90)
    fill_mask(img, rr_mask(size, box, r * S), rgba(lip))
    face = [box[0], box[1], box[2], box[3] - lip_h * S]
    fill_mask(img, rr_mask(size, face, r * S), grad_layer(size, top, bottom, y0=face[1], y1=face[3]))
    # 上半截硬高光
    hl = [face[0] + 10 * S, face[1] + 5 * S, face[2] - 10 * S, face[1] + (face[3] - face[1]) * 0.46]
    fill_mask(img, rr_mask(size, hl, (r - 6) * S), grad_layer(size, WHITE, WHITE, 120, 26, y0=hl[1], y1=hl[3]))
    stroke_ring(img, face, r * S, max(2, int(2 * S)), rim, 110)
    return img


def make_button(rel, kind):
    w, h = 256, 128
    if kind == "btn_primary":
        img = button3d(w, h, 30, (255, 222, 90), (255, 150, 30), GOLD_DEEP)
    elif kind == "btn_secondary":
        img = button3d(w, h, 30, (110, 206, 255), (52, 124, 240), (34, 78, 186))
    elif kind == "btn_ghost":
        img = button3d(w, h, 30, (236, 230, 255), (204, 190, 255), (150, 128, 230), rim=(150, 128, 230), shadow=False)
    elif kind == "btn_icon":
        w = h = 128
        img = button3d(w, h, 54, (168, 140, 255), (110, 78, 236), VIOLET_DEEP, lip_h=9)
    elif kind == "btn_close":
        w = h = 96
        img = button3d(w, h, 40, (255, 120, 150), (236, 64, 110), (170, 30, 76), lip_h=8)
    else:
        img = button3d(w, h, 30, (244, 240, 255), (220, 210, 255), (170, 152, 236))
    save(img, rel)


def make_bar(rel, kind):
    w, h = 256, 24
    S = SS
    img = new_canvas(w, h)
    size = img.size
    box = [2 * S, 2 * S, (w - 2) * S, (h - 2) * S]
    r = (h // 2 - 2) * S
    if kind == "track":
        fill_mask(img, rr_mask(size, box, r), rgba((14, 8, 44), 190))
        stroke_ring(img, box, r, 2 * S, WHITE, 60)
    else:
        # 近白底：Prefab 里按用途染色（等级金 / 糖能粉 / 影子紫）
        fill_mask(img, rr_mask(size, box, r), grad_layer(size, WHITE, (226, 222, 236), y0=box[1], y1=box[3]))
        hl = [box[0] + 6 * S, box[1] + 2 * S, box[2] - 6 * S, box[1] + (box[3] - box[1]) * 0.45]
        fill_mask(img, rr_mask(size, hl, 3 * S), rgba(WHITE, 170))
    save(img, rel)


def make_board_tray(rel, w, h):
    S = SS
    img = new_canvas(w, h)
    size = img.size
    box = [5 * S, 5 * S, (w - 5) * S, (h - 5) * S]
    r = 12 * S
    soft_shadow(img, box, r, offset=(0, 8 * S), blur=10 * S, alpha=120)
    fill_mask(img, rr_mask(size, box, r), grad_layer(size, (22, 14, 64), (32, 18, 82), 225, 235, y0=box[1], y1=box[3]))
    stroke_ring(img, [box[0] + 3 * S, box[1] + 3 * S, box[2] - 3 * S, box[3] - 3 * S], r - 3 * S, 2 * S, (150, 130, 255), 120)
    save(img, rel)


def make_board_frame(rel, w, h):
    """发光描边：外圈淡紫辉光 + 内圈亮线（不遮挡棋盘内容）。"""
    S = SS
    img = new_canvas(w, h)
    size = img.size
    box = [6 * S, 6 * S, (w - 6) * S, (h - 6) * S]
    r = 13 * S
    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    stroke_ring(glow, box, r, 6 * S, (190, 160, 255), 200)
    glow = glow.filter(ImageFilter.GaussianBlur(5 * S))
    img.alpha_composite(glow)
    stroke_ring(img, box, r, 4 * S, (214, 196, 255), 255)
    save(img, rel)


def make_cell(rel):
    """空格：内凹槽位（顶部暗、底部亮），深色托盘上低调可读。"""
    w = h = 96
    S = SS
    img = new_canvas(w, h)
    size = img.size
    box = [S, S, (w - 1) * S, (h - 1) * S]
    r = 6 * S
    fill_mask(img, rr_mask(size, box, r), grad_layer(size, (8, 2, 30), (70, 56, 150), 84, 60, y0=box[1], y1=box[3]))
    stroke_ring(img, box, r, 2 * S, (160, 140, 255), 34)
    save(img, rel)


def make_ghost_fill(rel):
    w = h = 96
    S = SS
    img = new_canvas(w, h)
    box = [S, S, (w - 1) * S, (h - 1) * S]
    fill_mask(img, rr_mask(img.size, box, 8 * S), rgba(WHITE, 255))
    save(img, rel)


def make_ghost_border(rel):
    w = h = 96
    S = SS
    img = new_canvas(w, h)
    box = [S, S, (w - 1) * S, (h - 1) * S]
    stroke_ring(img, box, 8 * S, 3 * S, WHITE, 255)
    save(img, rel)


def make_frame_gold(rel, w, h, r):
    S = SS
    img = new_canvas(w, h)
    size = img.size
    box = [8 * S, 8 * S, (w - 8) * S, (h - 8) * S]
    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    stroke_ring(glow, box, r * S, 6 * S, GOLD, 220)
    glow = glow.filter(ImageFilter.GaussianBlur(4 * S))
    img.alpha_composite(glow)
    ring = Image.new("RGBA", size, (0, 0, 0, 0))
    stroke_ring(ring, box, r * S, 5 * S, GOLD, 255)
    stroke_ring(ring, [box[0] + 1 * S, box[1] + 1 * S, box[2] - 1 * S, box[3] - 1 * S], (r - 1) * S, 2 * S, (255, 244, 190), 255)
    img.alpha_composite(ring)
    save(img, rel)


def make_mask(rel):
    """遮罩：满幅纯色（不带投影/圆角，避免四周露边）。颜色由 Prefab 的 Sprite.color 决定。"""
    img = Image.new("RGBA", (128 * SS, 128 * SS), (255, 255, 255, 255))
    save(img, rel)


# ────────────────────────── 图标 ──────────────────────────
def glyph_canvas():
    size = 96
    S = size * SS
    return new_canvas(size, size), S


def make_ctrl(rel, symbol):
    """控制类图标：白色粗字形 + 深色投影，放在彩色立体按钮上。"""
    img, S = glyph_canvas()
    d = ImageDraw.Draw(img)
    c = S / 2
    lw = int(S * 0.11)
    col = rgba(WHITE)

    def rr(box, r, fill=None):
        d.rounded_rectangle([int(v) for v in box], radius=int(r), fill=fill)

    if symbol in ("pause", "pause_small"):
        w = int(S * 0.15)
        rr([S * 0.27, S * 0.22, S * 0.27 + w, S * 0.78], w // 2, col)
        rr([S * 0.58, S * 0.22, S * 0.58 + w, S * 0.78], w // 2, col)
    elif symbol == "play":
        d.polygon([(S * 0.34, S * 0.2), (S * 0.8, S * 0.5), (S * 0.34, S * 0.8)], fill=col)
    elif symbol == "home":
        d.polygon([(c, S * 0.14), (S * 0.88, S * 0.5), (S * 0.12, S * 0.5)], fill=col)
        rr([S * 0.24, S * 0.46, S * 0.76, S * 0.86], S * 0.06, col)
        rr([S * 0.43, S * 0.62, S * 0.57, S * 0.86], S * 0.03, (0, 0, 0, 0))
    elif symbol in ("back", "left"):
        d.line([S * 0.64, S * 0.2, S * 0.32, S * 0.5, S * 0.64, S * 0.8], fill=col, width=lw, joint="curve")
        for (x, y) in [(0.64, 0.2), (0.32, 0.5), (0.64, 0.8)]:
            d.ellipse([S * x - lw / 2, S * y - lw / 2, S * x + lw / 2, S * y + lw / 2], fill=col)
    elif symbol == "right":
        d.line([S * 0.36, S * 0.2, S * 0.68, S * 0.5, S * 0.36, S * 0.8], fill=col, width=lw, joint="curve")
        for (x, y) in [(0.36, 0.2), (0.68, 0.5), (0.36, 0.8)]:
            d.ellipse([S * x - lw / 2, S * y - lw / 2, S * x + lw / 2, S * y + lw / 2], fill=col)
    elif symbol == "rotate":
        d.arc([S * 0.2, S * 0.2, S * 0.8, S * 0.8], 60, 350, fill=col, width=lw)
        d.polygon([(S * 0.66, S * 0.08), (S * 0.92, S * 0.26), (S * 0.62, S * 0.4)], fill=col)
    elif symbol == "drop":
        d.line([c, S * 0.14, c, S * 0.56], fill=col, width=lw)
        d.polygon([(c - S * 0.22, S * 0.48), (c + S * 0.22, S * 0.48), (c, S * 0.76)], fill=col)
        rr([S * 0.22, S * 0.8, S * 0.78, S * 0.9], S * 0.05, col)
    elif symbol in ("1x", "2x"):
        n = 1 if symbol == "1x" else 2
        for i in range(n):
            x0 = S * (0.3 + i * 0.22) - (S * 0.11 if n == 2 else 0)
            d.polygon([(x0, S * 0.26), (x0 + S * 0.26, S * 0.5), (x0, S * 0.74)], fill=col)
    elif symbol == "share":
        for (x, y) in [(0.28, 0.5), (0.7, 0.26), (0.7, 0.74)]:
            d.ellipse([S * x - S * 0.11, S * y - S * 0.11, S * x + S * 0.11, S * y + S * 0.11], fill=col)
        d.line([S * 0.28, S * 0.5, S * 0.7, S * 0.26], fill=col, width=int(lw * 0.7))
        d.line([S * 0.28, S * 0.5, S * 0.7, S * 0.74], fill=col, width=int(lw * 0.7))
    elif symbol == "hint":
        d.ellipse([S * 0.24, S * 0.12, S * 0.76, S * 0.62], fill=col)
        rr([S * 0.38, S * 0.6, S * 0.62, S * 0.72], S * 0.03, col)
        rr([S * 0.4, S * 0.76, S * 0.6, S * 0.86], S * 0.04, col)
    elif symbol == "restart":
        d.arc([S * 0.2, S * 0.2, S * 0.8, S * 0.8], 130, 410, fill=col, width=lw)
        d.polygon([(S * 0.12, S * 0.24), (S * 0.42, S * 0.2), (S * 0.3, S * 0.48)], fill=col)
    elif symbol == "undo":
        d.arc([S * 0.26, S * 0.28, S * 0.82, S * 0.84], 200, 450, fill=col, width=lw)
        d.polygon([(S * 0.1, S * 0.46), (S * 0.38, S * 0.3), (S * 0.4, S * 0.6)], fill=col)
    elif symbol == "close":
        d.line([S * 0.26, S * 0.26, S * 0.74, S * 0.74], fill=col, width=lw)
        d.line([S * 0.74, S * 0.26, S * 0.26, S * 0.74], fill=col, width=lw)
    elif symbol == "settings":
        teeth = 8
        for i in range(teeth):
            ang = i * 2 * math.pi / teeth
            x, y = c + math.cos(ang) * S * 0.31, c + math.sin(ang) * S * 0.31
            d.ellipse([x - S * 0.09, y - S * 0.09, x + S * 0.09, y + S * 0.09], fill=col)
        d.ellipse([c - S * 0.3, c - S * 0.3, c + S * 0.3, c + S * 0.3], fill=col)
        d.ellipse([c - S * 0.12, c - S * 0.12, c + S * 0.12, c + S * 0.12], fill=(0, 0, 0, 0))
    elif symbol == "burst":
        d.polygon([(S * 0.56, S * 0.08), (S * 0.24, S * 0.56), (S * 0.48, S * 0.56),
                   (S * 0.4, S * 0.92), (S * 0.78, S * 0.4), (S * 0.54, S * 0.4)], fill=col)
    img = drop_shadow(img, S * 0.03, S * 0.02, 140, OUTLINE)
    save(img, rel)


def make_icon(rel, symbol, color, second=None):
    """内容图标：彩色字形 + 统一深紫贴纸描边（与按钮/卡片同一套语言）。"""
    img, S = glyph_canvas()
    d = ImageDraw.Draw(img)
    c = S / 2
    second = second or lighter(color, 0.45)
    lw = max(3, int(S * 0.08))

    def rr(box, r, fill=None, outline=None, width=0):
        d.rounded_rectangle([int(v) for v in box], radius=int(r), fill=fill, outline=outline, width=width)

    def star_pts(r_out, r_in, cx=c, cy=c):
        pts = []
        for i in range(10):
            ang = -math.pi / 2 + i * math.pi / 5
            r = r_out if i % 2 == 0 else r_in
            pts.append((cx + math.cos(ang) * r, cy + math.sin(ang) * r))
        return pts

    outline = True
    if symbol == "coin":
        d.ellipse([S * 0.14, S * 0.14, S * 0.86, S * 0.86], fill=rgba(GOLD_DEEP))
        d.ellipse([S * 0.14, S * 0.12, S * 0.86, S * 0.8], fill=rgba(GOLD))
        d.ellipse([S * 0.3, S * 0.26, S * 0.7, S * 0.66], outline=rgba(lighter(GOLD, 0.5)), width=int(lw * 0.8))
        d.ellipse([S * 0.24, S * 0.2, S * 0.36, S * 0.3], fill=rgba(WHITE, 220))
    elif symbol == "star":
        d.polygon(star_pts(S * 0.42, S * 0.2, c, c + S * 0.02), fill=rgba(GOLD_DEEP))
        d.polygon(star_pts(S * 0.42, S * 0.2), fill=rgba(GOLD))
        d.polygon(star_pts(S * 0.2, S * 0.09, c - S * 0.04, c - S * 0.06), fill=rgba(lighter(GOLD, 0.55)))
    elif symbol == "star_empty":
        d.polygon(star_pts(S * 0.42, S * 0.2), fill=rgba((214, 206, 240)))
        d.polygon(star_pts(S * 0.3, S * 0.14, c, c + S * 0.02), fill=rgba((196, 186, 230)))
        outline = False
        img = sticker_outline(img, int(S * 0.025), (150, 136, 206))
    elif symbol == "lock":
        d.arc([S * 0.28, S * 0.12, S * 0.72, S * 0.62], 180, 360, fill=rgba((214, 206, 240)), width=int(lw * 1.2))
        rr([S * 0.18, S * 0.42, S * 0.82, S * 0.88], S * 0.12, rgba(GOLD))
        rr([S * 0.18, S * 0.42, S * 0.82, S * 0.6], S * 0.12, rgba(lighter(GOLD, 0.3)))
        d.ellipse([S * 0.44, S * 0.56, S * 0.56, S * 0.68], fill=rgba(GOLD_DEEP))
    elif symbol == "check":
        d.ellipse([S * 0.1, S * 0.1, S * 0.9, S * 0.9], fill=rgba(GREEN))
        d.line([S * 0.28, S * 0.52, S * 0.44, S * 0.68, S * 0.74, S * 0.34], fill=rgba(WHITE), width=lw, joint="curve")
    elif symbol == "flame":
        d.polygon([(c, S * 0.08), (S * 0.8, S * 0.52), (S * 0.7, S * 0.88), (S * 0.3, S * 0.88), (S * 0.2, S * 0.52)], fill=rgba(ORANGE))
        d.polygon([(c, S * 0.4), (S * 0.66, S * 0.66), (S * 0.6, S * 0.86), (S * 0.4, S * 0.86), (S * 0.34, S * 0.66)], fill=rgba(GOLD))
    elif symbol == "calendar":
        rr([S * 0.14, S * 0.2, S * 0.86, S * 0.86], S * 0.12, rgba(WHITE))
        rr([S * 0.14, S * 0.2, S * 0.86, S * 0.42], S * 0.12, rgba(color))
        d.rectangle([S * 0.14, S * 0.32, S * 0.86, S * 0.42], fill=rgba(color))
        for i in range(3):
            d.ellipse([S * 0.26 + i * S * 0.18, S * 0.56, S * 0.36 + i * S * 0.18, S * 0.66], fill=rgba(color))
    elif symbol == "score":
        rr([S * 0.16, S * 0.14, S * 0.84, S * 0.86], S * 0.12, rgba(WHITE))
        for i in range(3):
            rr([S * 0.28, S * 0.3 + i * S * 0.16, S * 0.72, S * 0.38 + i * S * 0.16], S * 0.04, rgba(color if i == 0 else second))
    elif symbol == "chain":
        d.ellipse([S * 0.1, S * 0.32, S * 0.54, S * 0.76], outline=rgba(color), width=int(lw * 1.2))
        d.ellipse([S * 0.46, S * 0.24, S * 0.9, S * 0.68], outline=rgba(second), width=int(lw * 1.2))
    elif symbol == "block":
        rr([S * 0.14, S * 0.14, S * 0.6, S * 0.6], S * 0.12, rgba(color))
        rr([S * 0.4, S * 0.4, S * 0.86, S * 0.86], S * 0.12, rgba(second))
        rr([S * 0.2, S * 0.18, S * 0.5, S * 0.28], S * 0.04, rgba(WHITE, 150))
    elif symbol == "row":
        for i in range(3):
            rr([S * 0.12, S * 0.2 + i * S * 0.22, S * 0.88, S * 0.36 + i * S * 0.22], S * 0.06, rgba(color if i == 1 else second))
    elif symbol == "sugar":
        rr([S * 0.22, S * 0.32, S * 0.78, S * 0.86], S * 0.16, rgba(color))
        rr([S * 0.3, S * 0.38, S * 0.7, S * 0.5], S * 0.06, rgba(WHITE, 140))
        d.ellipse([S * 0.34, S * 0.1, S * 0.66, S * 0.38], fill=rgba(WHITE))
    elif symbol == "start":
        d.polygon([(c, S * 0.08), (S * 0.78, S * 0.62), (S * 0.22, S * 0.62)], fill=rgba(color))
        d.polygon([(S * 0.36, S * 0.62), (S * 0.64, S * 0.62), (c, S * 0.92)], fill=rgba(GOLD))
        d.ellipse([S * 0.42, S * 0.3, S * 0.58, S * 0.46], fill=rgba(WHITE))
    elif symbol == "shield":
        d.polygon([(c, S * 0.1), (S * 0.86, S * 0.28), (S * 0.78, S * 0.68), (c, S * 0.9), (S * 0.22, S * 0.68), (S * 0.14, S * 0.28)], fill=rgba(color))
        d.line([S * 0.34, S * 0.5, S * 0.46, S * 0.62, S * 0.68, S * 0.38], fill=rgba(WHITE), width=lw, joint="curve")
    elif symbol == "slow":
        d.ellipse([S * 0.12, S * 0.12, S * 0.88, S * 0.88], fill=rgba(WHITE))
        d.ellipse([S * 0.12, S * 0.12, S * 0.88, S * 0.88], outline=rgba(color), width=lw)
        d.line([c, c, c, S * 0.28], fill=rgba(INK), width=lw)
        d.line([c, c, S * 0.68, S * 0.62], fill=rgba(INK), width=lw)
    elif symbol == "special":
        pts = []
        for i in range(8):
            ang = i * math.pi / 4
            r = S * (0.44 if i % 2 == 0 else 0.2)
            pts.append((c + math.cos(ang) * r, c + math.sin(ang) * r))
        d.polygon(pts, fill=rgba(GOLD))
        d.ellipse([c - S * 0.08, c - S * 0.08, c + S * 0.08, c + S * 0.08], fill=rgba(WHITE))
    elif symbol == "stone":
        d.polygon([(S * 0.2, S * 0.78), (S * 0.28, S * 0.36), (S * 0.56, S * 0.16), (S * 0.84, S * 0.42), (S * 0.76, S * 0.8)], fill=rgba((150, 140, 170)))
        d.polygon([(S * 0.28, S * 0.36), (S * 0.56, S * 0.16), (S * 0.6, S * 0.4)], fill=rgba((190, 182, 210)))
    elif symbol == "mutation_frost":
        for i in range(3):
            ang = i * math.pi / 3
            dx, dy = math.cos(ang) * S * 0.36, math.sin(ang) * S * 0.36
            d.line([c - dx, c - dy, c + dx, c + dy], fill=rgba((150, 220, 255)), width=lw)
        d.ellipse([c - S * 0.08, c - S * 0.08, c + S * 0.08, c + S * 0.08], fill=rgba(WHITE))
    elif symbol == "mutation_fog":
        for i in range(3):
            rr([S * (0.12 + i * 0.06), S * (0.24 + i * 0.2), S * (0.88 - i * 0.04), S * (0.38 + i * 0.2)], S * 0.07, rgba(mix((200, 196, 230), WHITE, i * 0.25)))
    elif symbol == "mutation_mirror":
        d.line([c, S * 0.1, c, S * 0.9], fill=rgba(WHITE), width=int(lw * 0.7))
        d.polygon([(S * 0.14, S * 0.28), (S * 0.42, S * 0.5), (S * 0.14, S * 0.72)], fill=rgba(PURPLE))
        d.polygon([(S * 0.86, S * 0.28), (S * 0.58, S * 0.5), (S * 0.86, S * 0.72)], fill=rgba(lighter(PURPLE, 0.35)))
    elif symbol == "mutation_inverted":
        d.polygon([(c, S * 0.86), (S * 0.82, S * 0.34), (S * 0.18, S * 0.34)], fill=rgba(ORANGE))
        rr([S * 0.42, S * 0.1, S * 0.58, S * 0.4], S * 0.05, rgba(WHITE))
    elif symbol == "mutation_mono":
        d.ellipse([S * 0.1, S * 0.32, S * 0.56, S * 0.78], fill=rgba(PINK))
        d.ellipse([S * 0.44, S * 0.22, S * 0.9, S * 0.68], fill=rgba(lighter(PINK, 0.3)))
    elif symbol == "mutation_backflow":
        for i in range(2):
            d.arc([S * 0.12, S * 0.24 + i * S * 0.24, S * 0.88, S * 0.74 + i * S * 0.24], 200, 340, fill=rgba(BLUE), width=lw)
        d.polygon([(S * 0.1, S * 0.4), (S * 0.3, S * 0.2), (S * 0.34, S * 0.46)], fill=rgba(BLUE))
    elif symbol == "mutation_brittle":
        d.polygon([(S * 0.5, S * 0.08), (S * 0.84, S * 0.5), (S * 0.58, S * 0.5), (S * 0.7, S * 0.92), (S * 0.2, S * 0.44), (S * 0.46, S * 0.44)], fill=rgba((150, 220, 255)))
    elif symbol == "mutation_magnet":
        d.arc([S * 0.16, S * 0.14, S * 0.84, S * 0.9], 180, 360, fill=rgba(PINK), width=int(lw * 1.6))
        d.rectangle([S * 0.16, S * 0.5, S * 0.32, S * 0.66], fill=rgba(PINK))
        d.rectangle([S * 0.68, S * 0.5, S * 0.84, S * 0.66], fill=rgba(PINK))
        d.rectangle([S * 0.16, S * 0.66, S * 0.32, S * 0.8], fill=rgba(WHITE))
        d.rectangle([S * 0.68, S * 0.66, S * 0.84, S * 0.8], fill=rgba(WHITE))
    elif symbol.startswith("chapter_"):
        idx = int(symbol.split("_")[1])
        col = PALETTE[(idx - 1) % 5]
        outline = False
        orb = gem_block(S, col, inset=0.1, radius=0.5)
        img.alpha_composite(orb)
        d = ImageDraw.Draw(img)
        sparkle(d, S * 0.68, S * 0.3, S * 0.1)
    else:
        d.ellipse([S * 0.12, S * 0.12, S * 0.88, S * 0.88], fill=rgba(lighter(color, 0.3)))

    if outline:
        img = sticker_outline(img, int(S * 0.035))
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
            length = S * (0.44 if i % 2 == 0 else 0.3)
            w = S * 0.035
            pts = [(c + math.cos(ang) * length, c + math.sin(ang) * length),
                   (c + math.cos(ang + 1.57) * w, c + math.sin(ang + 1.57) * w),
                   (c - math.cos(ang) * S * 0.04, c - math.sin(ang) * S * 0.04),
                   (c + math.cos(ang - 1.57) * w, c + math.sin(ang - 1.57) * w)]
            d.polygon(pts, fill=rgba(WHITE, 235))
        img = img.filter(ImageFilter.GaussianBlur(S * 0.004))
    elif kind == "star":
        sparkle(d, c, c, S * 0.44, rgba(WHITE, 245))
    elif kind == "frost":
        for i in range(6):
            ang = i * math.pi / 3
            x2, y2 = c + math.cos(ang) * S * 0.42, c + math.sin(ang) * S * 0.42
            d.line([c, c, x2, y2], fill=rgba((210, 240, 255), 235), width=int(S * 0.024))
            for t in (0.5, 0.75):
                bx, by = c + math.cos(ang) * S * 0.42 * t, c + math.sin(ang) * S * 0.42 * t
                for s in (-1, 1):
                    a2 = ang + s * 0.7
                    d.line([bx, by, bx + math.cos(a2) * S * 0.08, by + math.sin(a2) * S * 0.08], fill=rgba((210, 240, 255), 220), width=int(S * 0.018))
    elif kind == "shockwave":
        for i in range(3):
            r = S * (0.18 + i * 0.1)
            d.ellipse([c - r, c - r, c + r, c + r], outline=rgba(WHITE, 220 - i * 60), width=int(S * 0.024))
        img = img.filter(ImageFilter.GaussianBlur(S * 0.004))
    elif kind == "prism":
        for i, col in enumerate(PALETTE):
            r = S * (0.12 + i * 0.07)
            d.ellipse([c - r, c - r, c + r, c + r], outline=rgba(lighter(col, 0.2), 210), width=int(S * 0.02))
    elif kind == "confetti":
        rnd = random.Random(7)
        for i in range(30):
            x = rnd.randint(int(S * 0.1), int(S * 0.9))
            y = rnd.randint(int(S * 0.1), int(S * 0.9))
            col = PALETTE[i % 5] if i % 6 else GOLD
            w, h = S * rnd.uniform(0.025, 0.04), S * rnd.uniform(0.012, 0.02)
            ang = rnd.uniform(0, math.pi)
            pts = [(x + math.cos(ang) * w - math.sin(ang) * h, y + math.sin(ang) * w + math.cos(ang) * h),
                   (x - math.cos(ang) * w - math.sin(ang) * h, y - math.sin(ang) * w + math.cos(ang) * h),
                   (x - math.cos(ang) * w + math.sin(ang) * h, y - math.sin(ang) * w - math.cos(ang) * h),
                   (x + math.cos(ang) * w + math.sin(ang) * h, y + math.sin(ang) * w - math.cos(ang) * h)]
            d.polygon(pts, fill=rgba(col, 240))
    elif kind == "ring":
        d.ellipse([c - S * 0.4, c - S * 0.4, c + S * 0.4, c + S * 0.4], outline=rgba(WHITE, 230), width=int(S * 0.035))
        img = img.filter(ImageFilter.GaussianBlur(S * 0.006))
    elif kind == "glow":
        yy, xx = np.mgrid[0:S, 0:S]
        dist = np.sqrt((xx - c) ** 2 + (yy - c) ** 2) / (S * 0.48)
        a = np.clip(1 - dist, 0, 1) ** 2.2 * 255
        arr = np.zeros((S, S, 4), dtype=np.uint8)
        arr[:, :, :3] = 255
        arr[:, :, 3] = a.astype(np.uint8)
        img = Image.fromarray(arr, "RGBA")
    save(img, rel)


# ────────────────────────── 品牌（3 张） ──────────────────────────
def make_logo():
    """Logo 图形：一组错落的宝石方块 + 闪光（标题文字由 Label 承担）。"""
    w, h = 600, 200
    img = new_canvas(w, h)
    cells = [(0, 1, PINK), (1, 1, PINK), (1, 0, ORANGE), (2, 0, ORANGE), (3, 0, GREEN), (3, 1, BLUE), (4, 1, PURPLE)]
    cs = 74
    ox = (w - 5 * cs) / 2
    oy = (h - 2 * cs) / 2
    for (cx, cy, col) in cells:
        g = gem_block(cs * SS, col).resize((cs * SS, cs * SS))
        img.alpha_composite(g, (int((ox + cx * cs) * SS), int((oy + cy * cs) * SS)))
    d = ImageDraw.Draw(img)
    sparkle(d, (ox + 4.9 * cs) * SS, (oy + 0.1 * cs) * SS, 22 * SS)
    sparkle(d, (ox - 0.2 * cs) * SS, (oy + 0.5 * cs) * SS, 14 * SS)
    img = drop_shadow(img, 6 * SS, 6 * SS, 150, (8, 2, 30))
    save(img, "art/ui/logo.png")


def make_share_card():
    w, h = 500, 400
    S = SS
    img = grad_layer((w * S, h * S), NIGHT_TOP, NIGHT_BOTTOM)
    d = ImageDraw.Draw(img)
    rnd = random.Random(3)
    for i in range(14):
        x, y = rnd.randint(0, w) * S, rnd.randint(0, h) * S
        r = rnd.randint(20, 70) * S
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse([x - r, y - r, x + r, y + r], fill=rgba(PALETTE[i % 5], 60))
        img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(14 * S)))
    for _ in range(30):
        x, y = rnd.randint(0, w) * S, rnd.randint(0, h) * S
        d.ellipse([x - S, y - S, x + S, y + S], fill=rgba(WHITE, 180))
    fill_mask(img, rr_mask(img.size, [40 * S, 40 * S, (w - 40) * S, (h - 40) * S], 28 * S), rgba(WHITE, 36))
    stroke_ring(img, [40 * S, 40 * S, (w - 40) * S, (h - 40) * S], 28 * S, 2 * S, WHITE, 90)
    save(img, "art/ui/share_card.png")


def make_placeholder():
    size = 64
    S = SS
    img = new_canvas(size, size)
    d = ImageDraw.Draw(img)
    fill_mask(img, rr_mask(img.size, [6 * S, 6 * S, (size - 6) * S, (size - 6) * S], 12 * S), rgba((90, 70, 170), 200))
    d.line([20 * S, 20 * S, 44 * S, 44 * S], fill=rgba(WHITE, 200), width=4 * S)
    d.line([44 * S, 20 * S, 20 * S, 44 * S], fill=rgba(WHITE, 200), width=4 * S)
    save(img, "art/ui/placeholder.png")


# ────────────────────────── 主流程 ──────────────────────────
def main():
    ensure(ART)

    # 9 背景
    make_background("art/bg/bg_home.jpg", NIGHT_TOP, NIGHT_BOTTOM, (255, 90, 170), (80, 200, 255), 1)
    for ch, (top, bottom, a, b) in CHAPTER_THEMES.items():
        make_background(f"art/bg/bg_ch{ch}.jpg", top, bottom, a, b, 10 + ch)
    make_background("art/bg/bg_daily.jpg", (16, 30, 88), (40, 70, 140), (60, 230, 200), (170, 120, 255), 21)
    make_background("art/bg/bg_result.jpg", (44, 18, 84), (120, 40, 120), (255, 170, 60), (255, 90, 170), 22)

    # 棋盘（3 + 2 新增）
    make_board_tray("art/board/board_tray.png", 620, 992)
    make_board_frame("art/board/board_frame.png", 640, 1012)
    make_cell("art/board/cell.png")
    make_ghost_fill("art/board/ghost_fill.png")
    make_ghost_border("art/board/ghost_border.png")

    # 7 方块
    for i, col in enumerate(PALETTE):
        make_block(f"art/blocks/block_{i}.png", col)
    make_block("art/blocks/block_stone.png", None, stone=True)
    make_block("art/blocks/block_brittle.png", None, brittle=True)

    # 6 特殊叠加
    for kind, col in [("stripe_h", GREEN), ("stripe_v", GREEN), ("rainbow", PURPLE), ("bomb", PINK), ("cross", BLUE), ("prism", PURPLE)]:
        make_special(f"art/special/{kind}.png", kind, col)

    # 面板/按钮/条
    make_glass("art/ui/panel_card.png", 256, 256, 24)
    make_popup("art/ui/panel_popup.png", 384, 384, 34)
    make_strip("art/ui/panel_strip.png", 256, 96)
    for kind in ["btn_primary", "btn_secondary", "btn_ghost", "btn_icon", "btn_close"]:
        make_button(f"art/ui/{kind}.png", kind)
    make_bar("art/ui/bar_track.png", "track")
    make_bar("art/ui/bar_fill.png", "fill")
    make_mask("art/ui/mask.png")
    make_frame_gold("art/ui/frame_gold.png", 256, 256, 24)

    # 图标：异变 8
    mutations = ["mutation_frost", "mutation_fog", "mutation_mirror", "mutation_inverted",
                 "mutation_mono", "mutation_backflow", "mutation_brittle", "mutation_magnet"]
    for i, m in enumerate(mutations):
        make_icon(f"art/icon/{m}.png", m, PALETTE[i % 5])

    # 天赋 10
    talents = [("talent_score", "score", PINK), ("talent_chain", "chain", ORANGE),
               ("talent_block", "block", GREEN), ("talent_row", "row", BLUE),
               ("talent_sugar", "sugar", PURPLE), ("talent_start", "start", ORANGE),
               ("talent_shield", "shield", BLUE), ("talent_slow", "slow", GREEN),
               ("talent_special", "special", GOLD), ("talent_stone", "stone", (150, 140, 170))]
    for name, symbol, col in talents:
        make_icon(f"art/icon/{name}.png", symbol, col)

    # 目标 6
    goals = [("goal_score", "score", PINK), ("goal_rows", "row", BLUE),
             ("goal_color", "block", PURPLE), ("goal_special", "special", GOLD),
             ("goal_burst", "sugar", PURPLE), ("goal_stone", "stone", (150, 140, 170))]
    for name, symbol, col in goals:
        make_icon(f"art/icon/{name}.png", symbol, col)

    # 章节 6
    for i in range(1, 7):
        make_icon(f"art/icon/chapter_{i}.png", f"chapter_{i}", PALETTE[(i - 1) % 5])

    # 资源 6
    resources = [("icon_coin", "coin", GOLD), ("icon_star", "star", GOLD), ("icon_lock", "lock", INK_SOFT),
                 ("icon_check", "check", GREEN), ("icon_flame", "flame", ORANGE), ("icon_calendar", "calendar", BLUE)]
    for name, symbol, col in resources:
        make_icon(f"art/icon/{name}.png", symbol, col)

    # 控制 14 + 3 新增（设置/撤销/糖爆）
    controls = [("ctrl_pause", "pause"), ("ctrl_restart", "restart"), ("ctrl_home", "home"),
                ("ctrl_back", "back"), ("ctrl_play", "play"), ("ctrl_pause_small", "pause_small"),
                ("ctrl_1x", "1x"), ("ctrl_2x", "2x"), ("ctrl_share", "share"), ("ctrl_hint", "hint"),
                ("ctrl_left", "left"), ("ctrl_right", "right"), ("ctrl_rotate", "rotate"), ("ctrl_drop", "drop"),
                ("ctrl_settings", "settings"), ("ctrl_undo", "undo"), ("ctrl_burst", "burst")]
    for name, symbol in controls:
        make_ctrl(f"art/icon/{name}.png", symbol)

    # 2 星级
    make_icon("art/icon/star_filled.png", "star", GOLD)
    make_icon("art/icon/star_empty.png", "star_empty", (214, 206, 240))

    # 8 特效
    for kind in ["spark", "star", "frost", "shockwave", "prism", "confetti", "ring", "glow"]:
        make_fx(f"art/fx/{kind}.png", kind)

    # 3 品牌
    make_logo()
    make_share_card()
    make_placeholder()

    # 分包里的局内背景（ch1..ch6 / daily 进章加载）与 resources 同源，必须同步，否则局内仍是旧皮
    bundles = os.path.join(ROOT, "assets", "bundles")
    for ch in range(1, 7):
        shutil.copyfile(os.path.join(ART, "bg", f"bg_ch{ch}.jpg"), os.path.join(bundles, f"ch{ch}", f"bg_ch{ch}.jpg"))
    shutil.copyfile(os.path.join(ART, "bg", "bg_daily.jpg"), os.path.join(bundles, "daily", "bg_daily.jpg"))

    count = 0
    for _, _, files in os.walk(ART):
        count += len([f for f in files if f.endswith((".png", ".jpg"))])
    print(f"[art] 产出 {count} 张图 → {ART}")


if __name__ == "__main__":
    main()
