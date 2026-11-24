#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""字体门：cmap 覆盖 config/ 与 Prefab 里的全部字符。"""
import glob, re, sys
from fontTools.ttLib import TTFont

FONT = 'assets/resources/font/game_sc.ttf'
chars = set()
for p in glob.glob('assets/scripts/config/**/*.ts', recursive=True) + glob.glob('assets/scripts/app/**/*.ts', recursive=True):
    for ch in open(p, encoding='utf-8').read():
        if ord(ch) > 127:
            chars.add(ch)
for p in glob.glob('assets/resources/prefabs/**/*.prefab', recursive=True):
    txt = open(p, encoding='utf-8').read()
    for m in re.finditer(r'"_string":\s*"([^"]*)"', txt):
        for ch in m.group(1):
            if ord(ch) > 127:
                chars.add(ch)
font = TTFont(FONT)
cmap = set()
for table in font['cmap'].tables:
    cmap.update(table.cmap.keys())
missing = sorted(ch for ch in chars if ord(ch) not in cmap)
if missing:
    print('[verify-font] 缺字', len(missing), ''.join(missing[:80]))
    sys.exit(1)
print('[verify-font] OK：覆盖', len(chars), '个字符')
