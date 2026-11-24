#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""后处理与审计：尺寸/透明/主色/体积写 art_report.csv（不改图，避免破坏 Prefab 引用）。"""
import csv, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, 'assets', 'resources', 'art')
rows = []
for dirpath, _, files in os.walk(ART):
    for name in sorted(files):
        if not name.lower().endswith(('.png', '.jpg')):
            continue
        full = os.path.join(dirpath, name)
        rel = os.path.relpath(full, ART).replace('\\', '/')
        img = Image.open(full)
        alpha = 'yes' if img.mode in ('RGBA', 'LA') and img.getextrema()[-1][0] < 255 else 'no'
        main = ''
        if img.mode == 'RGBA':
            px = [p[:3] for p in img.getdata() if p[3] > 200][:2000]
            if px:
                main = '#%02X%02X%02X' % max(set(px), key=px.count)
        rows.append({
            'file': rel, 'width': img.width, 'height': img.height,
            'mode': img.mode, 'transparent': alpha,
            'bytes': os.path.getsize(full), 'main': main,
        })
out = os.path.join(ROOT, 'art_report.csv')
with open(out, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=['file', 'width', 'height', 'mode', 'transparent', 'bytes', 'main'])
    w.writeheader()
    w.writerows(rows)
print(f'[art:post] {len(rows)} 张图 → art_report.csv')
