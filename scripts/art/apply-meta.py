#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""批量写入导入设置：9-slice border / packable / 背景不打包。可重复执行。"""
import json, os, glob

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, 'assets', 'resources', 'art')

BORDERS = {
    'ui/panel_card': 24, 'ui/panel_popup': 24, 'ui/panel_strip': 20,
    'ui/btn_primary': 20, 'ui/btn_secondary': 20, 'ui/btn_ghost': 20,
    'ui/frame_gold': 24, 'board/board_tray': 24, 'board/board_frame': 24, 'board/cell': 16,
    'ui/bar_track': 8, 'ui/bar_fill': 8,
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
            # border 必须小于短边的一半
            w, h = ud.get('width', 0), ud.get('height', 0)
            b = min(border, max(1, min(w, h) // 2 - 1))
            for side in ('borderTop', 'borderBottom', 'borderLeft', 'borderRight'):
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
