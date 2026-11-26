#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
字体子集重建：从 Noto Sans SC 可变字体（OFL，Windows 自带 C:\\Windows\\Fonts\\NotoSansSC-VF.ttf，
与现有 game_sc.ttf 同源同版本 2.04）重新抽取「现有字符 ∪ 代码/Prefab 用到的字符」，保留可变轴。
运行：python scripts/ui/subset-font.py [源字体路径]；之后 python scripts/verify-font.py 应为 OK。
"""
import glob
import os
import re
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "assets", "resources", "font", "game_sc.ttf")
SRC = sys.argv[1] if len(sys.argv) > 1 else r"C:\Windows\Fonts\NotoSansSC-VF.ttf"


def strip_comments(src):
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    return re.sub(r"//[^\n]*", "", src)


def used_chars():
    chars = set()
    for sub in ("config", "app", "view", "controller"):
        for p in glob.glob(os.path.join(ROOT, "assets", "scripts", sub, "**", "*.ts"), recursive=True):
            chars.update(ch for ch in strip_comments(open(p, encoding="utf-8").read()) if ord(ch) > 127)
    daily = os.path.join(ROOT, "assets", "scripts", "core", "DailyPuzzle.ts")
    chars.update(ch for ch in strip_comments(open(daily, encoding="utf-8").read()) if ord(ch) > 127)
    for p in glob.glob(os.path.join(ROOT, "assets", "resources", "prefabs", "**", "*.prefab"), recursive=True):
        for m in re.finditer(r'"_string":\s*"([^"]*)"', open(p, encoding="utf-8").read()):
            chars.update(ch for ch in m.group(1) if ord(ch) > 127)
    return chars


def main():
    current = set()
    for table in TTFont(OUT)["cmap"].tables:
        current.update(table.cmap.keys())
    need = {ord(c) for c in used_chars()} | current | set(range(0x20, 0x7F))
    opts = subset.Options()
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.name_languages = ["*"]
    opts.notdef_outline = True
    opts.glyph_names = False
    opts.hinting = False
    font = subset.load_font(SRC, opts)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=sorted(need))
    sub.subset(font)
    subset.save_font(font, OUT, opts)
    print(f"[subset-font] {len(current)} → {len(need)} 个码位，{os.path.getsize(OUT) // 1024}KB → {OUT}")


if __name__ == "__main__":
    main()
