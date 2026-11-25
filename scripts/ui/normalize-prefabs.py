#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Prefab 规范化：把 UI Prefab 里烤死的字号/高度/位置统一到糖果甜蜜风规范
（规范定义见 assets/scripts/config/ThemeConfig.ts 头注释与 docs/ui-style-candy.md）。

规则摘要：
  · 弹窗/页面标题统一 34/43（ColorPicker 30→34、Replay 30→34、Dialog 36→34）
  · Dialog 卡片 600×560→600×640 并重排内容（原次按钮底边贴卡片边缘，0 内边距）
  · Dialog 主/次按钮 500×92/500×70 → 500×88/500×72（同卡内高度差 22px→16px）
  · 次/ghost/返回按钮统一高 72、字号 24（Replay/Daily/ChapterMap/Settings/TalentPicker）
  · 主按钮文字统一 30（Settings 返回、Replay 播放）
  · HUD 卡片小字统一 caption 16（14/15 → 16）
  · Banner 金字统一强调金 (255,196,64)，字号 26→24
  · Home 回放 ghost 按钮 70→72
运行：python scripts/ui/normalize-prefabs.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UI = os.path.join(ROOT, "assets", "resources", "prefabs", "ui")
GAME = os.path.join(ROOT, "assets", "resources", "prefabs", "game")

# { prefab 相对名: { 节点路径(根下): 操作 } }
# 操作：pos=[x,y] / size=[w,h] / label={fontSize,lineHeight} / color=[r,g,b(,a)]
FIXES = {
    "Dialog.prefab": {
        "Card": {"size": [600, 640]},
        "Card/Tag": {"pos": [0, 286]},
        "Card/Title": {"pos": [0, 235], "label": {"fontSize": 34, "lineHeight": 43}},
        "Card/Score": {"pos": [0, 140]},
        "Card/Subtitle": {"pos": [0, 54]},
        "Card/StarRow": {"pos": [0, -22]},
        "Card/Btn_Primary": {"pos": [0, -130], "size": [500, 88]},
        "Card/Btn_Secondary": {"pos": [0, -226], "size": [500, 72]},
    },
    "ColorPicker.prefab": {
        "Card/Title": {"label": {"fontSize": 34, "lineHeight": 43}},
    },
    "Replay.prefab": {
        "Title": {"label": {"fontSize": 34, "lineHeight": 43}},
        "Btn_Play/Label": {"label": {"fontSize": 30, "lineHeight": 38}},
        "Btn_Speed": {"size": [110, 72]},
        "Btn_Speed/Label": {"label": {"fontSize": 24, "lineHeight": 30}},
        "Btn_Close": {"size": [160, 72]},
    },
    "DailyPanel.prefab": {
        "Status": {"label": {"fontSize": 16, "lineHeight": 20}},
        "Btn_Back": {"size": [160, 72]},
        "Btn_Back/Label": {"label": {"fontSize": 24, "lineHeight": 30}},
    },
    "ChapterMap.prefab": {
        "Btn_Back": {"size": [160, 72]},
        "Btn_Back/Label": {"label": {"fontSize": 24, "lineHeight": 30}},
        **{f"Tabs/Tab_{i}/Name": {"label": {"fontSize": 16, "lineHeight": 20}} for i in range(1, 7)},
    },
    "ChapterTab.prefab": {
        "Name": {"label": {"fontSize": 16, "lineHeight": 20}},
    },
    "Settings.prefab": {
        # 卡片 600x480→600x560：原 Btn_Back(y-210,h80) 底边 -250 超出卡片下缘(-240)，贴边悬挂
        "Card": {"size": [600, 560]},
        "Card/Title": {"pos": [0, 222]},
        "Card/Btn_Mute": {"pos": [0, 120], "size": [420, 84]},
        "Card/Btn_Mute/Label": {"label": {"fontSize": 24, "lineHeight": 30}},
        "Card/Btn_Credits": {"pos": [0, 10], "size": [420, 72]},
        "Card/Credits": {"pos": [0, -80]},
        "Card/Btn_Back": {"pos": [0, -196]},
        "Card/Btn_Back/Label": {"label": {"fontSize": 30, "lineHeight": 38}},
    },
    "TalentPicker.prefab": {
        "Btn_Skip": {"size": [300, 72]},
        "Btn_Skip/Label": {"label": {"fontSize": 24, "lineHeight": 30}},
    },
    "Banner.prefab": {
        "Panel/Text": {"label": {"fontSize": 24, "lineHeight": 30}, "color": [255, 196, 64]},
    },
    "Home.prefab": {
        "Btn_Replay": {"size": [300, 72]},
    },
    os.path.join("..", "game", "HUD.prefab"): {
        "Title": {"label": {"fontSize": 16, "lineHeight": 20}},
        "MutationBadgeHost/Countdown": {"label": {"fontSize": 16, "lineHeight": 20}},
        "ScoreCard/ScoreTitle": {"label": {"fontSize": 16, "lineHeight": 20}},
        "ScoreCard/Best": {"label": {"fontSize": 16, "lineHeight": 20}},
        "LevelCard/LevelTitle": {"label": {"fontSize": 16, "lineHeight": 20}},
        "NextCard/NextTitle": {"label": {"fontSize": 16, "lineHeight": 20}},
    },
}


def find_child(node, data, name):
    for ch in node.get("_children", []):
        o = data[ch["__id__"]]
        if o.get("_name") == name:
            return o
    return None


def apply_ops(data, root, ops, path):
    parts = path.split("/")
    node = root
    for part in parts:
        node = find_child(node, data, part)
        if node is None:
            return False
    changed = []
    for comp_ref in node.get("_components", []):
        comp = data[comp_ref["__id__"]]
        t = comp.get("__type__")
        if t == "cc.UITransform" and "size" in ops:
            comp["_contentSize"]["width"] = ops["size"][0]
            comp["_contentSize"]["height"] = ops["size"][1]
            changed.append("size")
        if t == "cc.Label" and "label" in ops:
            for k, v in ops["label"].items():
                comp[f"_{k}"] = v
            changed.append("label")
        if t in ("cc.Sprite", "cc.Label") and "color" in ops:
            c = ops["color"]
            comp["_color"] = {
                "__type__": "cc.Color",
                "r": c[0], "g": c[1], "b": c[2], "a": c[3] if len(c) > 3 else 255,
            }
            changed.append("color")
    if "pos" in ops:
        pos = node.get("_lpos", {})
        pos["x"], pos["y"] = ops["pos"]
        changed.append("pos")
    return bool(changed)


def main():
    total, missing = 0, []
    for rel, ops in FIXES.items():
        path = os.path.join(UI, rel)
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        pidx = next(i for i, o in enumerate(data) if o.get("__type__") == "cc.Prefab")
        root = data[data[pidx]["data"]["__id__"]]
        for node_path, _ in ops.items():
            if not apply_ops(data, root, ops[node_path], node_path):
                missing.append(f"{rel}:{node_path}")
            else:
                total += 1
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"[normalize] {rel}: {len(ops)} 处已应用")
    print(f"[normalize] 完成：共 {total} 处修改")
    if missing:
        print("[normalize] 未找到的节点：")
        for m in missing:
            print(" -", m)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
