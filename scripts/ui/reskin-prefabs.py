#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Prefab 换皮颜色重映射（v2 马卡龙 → v3 莓果奶霜）。
递归替换全部 Prefab 中烤死的 cc.Color；金色系/雾色/白色系不动。
可重复执行（幂等）。运行：python scripts/ui/reskin-prefabs.py
"""
import json
import glob
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PREFABS = os.path.join(ROOT, "assets", "resources", "prefabs")

# 旧值（r,g,b）→ 新值（a 保持原值）
REMAP = {
    (59, 42, 31): (74, 48, 62),       # 文字主/墨色底 → 可可莓墨
    (139, 115, 85): (154, 116, 136),  # 文字次 → 莓灰
    (255, 252, 245): (255, 250, 253),  # 反白 → 雪白
    (78, 203, 138): (255, 92, 138),   # 旧主绿 → 莓粉
    (169, 123, 240): (168, 120, 244),  # 影子线紫 → 新葡萄紫
    (255, 209, 102): (255, 196, 64),  # 残留浅金 → 强调金
    (40, 20, 10): (44, 20, 34),       # 背景暗角 tint
}


def walk(o, hits):
    if isinstance(o, dict):
        if o.get("__type__") == "cc.Color":
            key = (o.get("r"), o.get("g"), o.get("b"))
            if key in REMAP:
                nr, ng, nb = REMAP[key]
                o["r"], o["g"], o["b"] = nr, ng, nb
                hits[0] += 1
            return
        for v in o.values():
            walk(v, hits)
    elif isinstance(o, list):
        for v in o:
            walk(v, hits)


def main():
    total = 0
    files = glob.glob(os.path.join(PREFABS, "**", "*.prefab"), recursive=True)
    for f in sorted(files):
        data = json.load(open(f, encoding="utf-8"))
        hits = [0]
        walk(data, hits)
        if hits[0]:
            with open(f, "w", encoding="utf-8", newline="\n") as fp:
                json.dump(data, fp, ensure_ascii=False, indent=2)
                fp.write("\n")
            print(f"[reskin] {os.path.relpath(f, ROOT)}: {hits[0]} 处")
            total += hits[0]
    print(f"[reskin] 完成：{len(files)} 个 Prefab，共 {total} 处换色")


if __name__ == "__main__":
    main()
