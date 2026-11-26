#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""批量写入导入设置：9-slice border / packable / 背景不打包。可重复执行。"""
import json, os, glob

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, 'assets', 'resources', 'art')

# v4「极光糖晶」：数字 = 四边相同；元组 = (top, bottom, left, right)。
# 立体按钮底部带 10px 唇边 + 投影，所以 bottom 比 top 大。
BORDERS = {
    'ui/panel_card': 26, 'ui/panel_popup': (46, 54, 46, 46), 'ui/panel_strip': 44,
    'ui/btn_primary': (32, 42, 38, 38), 'ui/btn_secondary': (32, 42, 38, 38), 'ui/btn_ghost': (32, 42, 38, 38),
    'ui/frame_gold': 34, 'board/board_tray': 42, 'board/board_frame': 46, 'board/cell': 22,
    'board/ghost_fill': 22, 'board/ghost_border': 24,
    'ui/bar_track': 10, 'ui/bar_fill': 10,
}

def apply(meta_path, rel):
    meta = json.load(open(meta_path, encoding='utf-8'))
    changed = False
    for key, sub in meta.get('subMetas', {}).items():
        if sub.get('importer') != 'sprite-frame':
            continue
        ud = sub.setdefault('userData', {})
        border = BORDERS.get(rel)
        if border:
            # border 必须小于对应边长的一半
            w, h = ud.get('width', 0), ud.get('height', 0)
            t, btm, l, r = border if isinstance(border, tuple) else (border,) * 4
            vals = {
                'borderTop': min(t, max(1, h // 2 - 1)),
                'borderBottom': min(btm, max(1, h // 2 - 1)),
                'borderLeft': min(l, max(1, w // 2 - 1)),
                'borderRight': min(r, max(1, w // 2 - 1)),
            }
            for side, b in vals.items():
                if ud.get(side) != b:
                    ud[side] = b
                    changed = True
        packable = not rel.startswith('bg/')
        if ud.get('packable') != packable:
            ud['packable'] = packable
            changed = True
    if changed:
        json.dump(meta, open(meta_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    return changed

count = 0
for meta_path in glob.glob(os.path.join(ART, '**', '*.meta'), recursive=True):
    rel = os.path.relpath(meta_path[:-5], ART).replace('\\', '/')
    rel = os.path.splitext(rel)[0]
    if apply(meta_path, rel):
        count += 1
print(f'[art:meta] 更新 {count} 个 .meta')
