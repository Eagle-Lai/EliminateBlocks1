#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Prefab 换皮 v4「极光糖晶」：只改表现（颜色/描边/贴图/尺寸/少量装饰节点），不改节点职责与组件绑定语义。

规则：
  1. 文字按「所在表面」取色（见 ThemeConfig 头注释）：
       深色表面（背景/遮罩/玻璃卡/胶囊条/彩色按钮）→ 白 / 淡紫，标题与大数字加深紫描边，小字加柔和投影；
       浅色表面（奶白弹窗/ghost 按钮）               → 墨紫 / 灰紫。
  2. 遮罩/胶囊条/进度条按 THEME 染色；遮罩改为满幅纯色。
  3. 用汉字充当图标的按钮（设/重/‖/旋/←/→/爆/撤/灯）换成图标子节点，并绑定 UIButton.iconSprite/iconNode。
  4. 列表格子（关卡格/日历格/天赋卡）的按钮皮从 secondary 改为 tile（玻璃卡）。
  5. 首页补游戏名标题（Label），弹窗内容按新边框重排。
可重复执行（幂等）。运行：python scripts/ui/restyle-v4.py
"""
import copy
import glob
import json
import os
import random
import string

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PREFABS = os.path.join(ROOT, "assets", "resources", "prefabs")
ART = os.path.join(ROOT, "assets", "resources", "art")
UIBUTTON = "8e99cfcJaxEzpWP1egCKRaR"

# ────────── THEME（与 ThemeConfig.ts 保持一致） ──────────
WHITE = (255, 255, 255, 255)
ON_DARK_SOFT = (200, 190, 255, 255)
INK = (40, 30, 90, 255)
INK_SOFT = (112, 100, 160, 255)
OUTLINE_DARK = (34, 20, 78, 255)
GOLD = (255, 200, 56, 255)
GOLD_OUTLINE = (150, 70, 10, 255)
PRIMARY_OUTLINE = (178, 84, 8, 255)
SECONDARY_OUTLINE = (28, 66, 160, 255)
ICON_OUTLINE = (56, 30, 140, 255)
GHOST_TEXT = (84, 60, 170, 255)
VIOLET = (124, 92, 236, 255)
MASK = (12, 6, 40, 186)
STRIP = (22, 14, 64, 225)
SUGAR = (255, 96, 170, 255)
SHADOW_GHOST = (176, 120, 255, 210)
SOFT_SHADOW = (10, 4, 40, 200)

# 旧色 → 角色
ROLE_BY_RGB = {
    (74, 48, 62): "primary",
    (59, 42, 31): "primary",
    (154, 116, 136): "secondary",
    (139, 115, 85): "secondary",
    (255, 250, 253): "white",
    (255, 252, 245): "white",
    (255, 255, 255): "white",
    (255, 196, 64): "gold",
    (255, 200, 56): "gold",
    (255, 92, 138): "score",
    # v4 自身的值（保证幂等）
    (40, 30, 90): "primary",
    (112, 100, 160): "secondary",
    (200, 190, 255): "secondary",
    (84, 60, 170): "primary",
}

LIGHT_FRAMES = {"panel_popup", "btn_ghost"}
DARK_FRAMES = {
    "panel_card", "panel_strip", "mask", "btn_primary", "btn_secondary", "btn_icon", "btn_close",
    "bar_track", "bar_fill", "board_tray",
}


def rid(n=22):
    return "".join(random.choice(string.ascii_letters + string.digits + "+/") for _ in range(n))


def color_obj(c):
    return {"__type__": "cc.Color", "r": c[0], "g": c[1], "b": c[2], "a": c[3] if len(c) > 3 else 255}


# ────────── 资源 uuid ──────────
FRAMES = {}
for meta in glob.glob(os.path.join(ART, "**", "*.meta"), recursive=True):
    d = json.load(open(meta, encoding="utf-8"))
    for sub in (d.get("subMetas") or {}).values():
        if sub.get("importer") == "sprite-frame":
            FRAMES[os.path.splitext(os.path.basename(meta[:-5]))[0]] = sub["uuid"]
UUID2NAME = {v: k for k, v in FRAMES.items()}


class Prefab:
    def __init__(self, path):
        self.path = path
        self.data = json.load(open(path, encoding="utf-8"))
        self.hits = 0

    # ── 查询 ──
    def node(self, i):
        return self.data[i]

    def root(self):
        return 1

    def children(self, i):
        return [c["__id__"] for c in self.data[i].get("_children", [])]

    def find(self, path):
        cur = self.root()
        if not path:
            return cur
        for name in path.split("/"):
            nxt = None
            for c in self.children(cur):
                if self.data[c].get("_name") == name:
                    nxt = c
                    break
            if nxt is None:
                return None
            cur = nxt
        return cur

    def comp(self, i, t):
        for c in self.data[i].get("_components", []):
            o = self.data[c["__id__"]]
            if o.get("__type__") == t:
                return o
        return None

    def comp_index(self, i, t):
        for c in self.data[i].get("_components", []):
            if self.data[c["__id__"]].get("__type__") == t:
                return c["__id__"]
        return None

    def frame_name(self, i):
        s = self.comp(i, "cc.Sprite")
        if not s or not s.get("_spriteFrame"):
            return None
        return UUID2NAME.get(s["_spriteFrame"].get("__uuid__"))

    def parent(self, i):
        p = self.data[i].get("_parent")
        return p["__id__"] if p else None

    def iter_nodes(self):
        stack = [self.root()]
        while stack:
            i = stack.pop()
            yield i
            stack.extend(self.children(i))

    # ── 修改 ──
    def set_color(self, comp, c):
        cur = comp.get("_color")
        new = color_obj(c)
        if cur != new:
            comp["_color"] = new
            self.hits += 1

    def set_frame(self, i, name):
        s = self.comp(i, "cc.Sprite")
        uuid = FRAMES[name]
        if s.get("_spriteFrame", {}) is None or s.get("_spriteFrame", {}).get("__uuid__") != uuid:
            s["_spriteFrame"] = {"__uuid__": uuid, "__expectedType__": "cc.SpriteFrame"}
            self.hits += 1

    def set_size(self, i, w, h):
        ut = self.comp(i, "cc.UITransform")
        if ut["_contentSize"]["width"] != w or ut["_contentSize"]["height"] != h:
            ut["_contentSize"]["width"], ut["_contentSize"]["height"] = w, h
            self.hits += 1

    def set_pos(self, i, x, y):
        p = self.data[i]["_lpos"]
        if p["x"] != x or p["y"] != y:
            p["x"], p["y"] = x, y
            self.hits += 1

    def set_active(self, i, v):
        if self.data[i].get("_active", True) != v:
            self.data[i]["_active"] = v
            self.hits += 1

    def label_style(self, lb, color=None, outline=None, shadow=None, size=None, bold=None, text=None):
        if color is not None:
            self.set_color(lb, color)
        if outline is not None:
            on = outline is not False
            if lb.get("_enableOutline") != on:
                lb["_enableOutline"] = on
                self.hits += 1
            if on:
                c, w = outline
                lb["_outlineColor"] = color_obj(c)
                lb["_outlineWidth"] = w
        if shadow is not None:
            on = shadow is not False
            if lb.get("_enableShadow") != on:
                lb["_enableShadow"] = on
                self.hits += 1
            if on:
                c, dy, blur = shadow
                lb["_shadowColor"] = color_obj(c)
                lb["_shadowOffset"] = {"__type__": "cc.Vec2", "x": 0, "y": dy}
                lb["_shadowBlur"] = blur
        if size is not None and lb["_fontSize"] != size:
            lb["_fontSize"] = size
            lb["_actualFontSize"] = size
            lb["_lineHeight"] = round(size * 1.25)
            self.hits += 1
        if bold is not None and lb.get("_isBold") != bold:
            lb["_isBold"] = bold
            self.hits += 1
        if text is not None and lb["_string"] != text:
            lb["_string"] = text
            self.hits += 1

    def _template(self, t):
        for o in self.data:
            if o.get("__type__") == t:
                return o
        return None

    def add_node(self, parent, name, w, h, x=0, y=0, index=None):
        existing = None
        for c in self.children(parent):
            if self.data[c].get("_name") == name:
                existing = c
        if existing is not None:
            return existing, False
        layer = self.data[parent].get("_layer", 33554432)
        nid = len(self.data)
        node = {
            "__type__": "cc.Node", "_name": name, "_objFlags": 0, "__editorExtras__": {},
            "_parent": {"__id__": parent}, "_children": [], "_active": True, "_components": [],
            "_prefab": None,
            "_lpos": {"__type__": "cc.Vec3", "x": x, "y": y, "z": 0},
            "_lrot": {"__type__": "cc.Quat", "x": 0, "y": 0, "z": 0, "w": 1},
            "_lscale": {"__type__": "cc.Vec3", "x": 1, "y": 1, "z": 1},
            "_mobility": 0, "_layer": layer,
            "_euler": {"__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0},
            "_id": rid(),
        }
        self.data.append(node)
        kids = self.data[parent]["_children"]
        if index is None:
            kids.append({"__id__": nid})
        else:
            kids.insert(index, {"__id__": nid})
        ut = copy.deepcopy(self._template("cc.UITransform"))
        ut["node"] = {"__id__": nid}
        ut["_contentSize"] = {"__type__": "cc.Size", "width": w, "height": h}
        ut["_anchorPoint"] = {"__type__": "cc.Vec2", "x": 0.5, "y": 0.5}
        ut["_id"] = rid()
        self.data.append(ut)
        node["_components"].append({"__id__": len(self.data) - 1})
        self.hits += 1
        return nid, True

    def add_sprite(self, nid, frame, color=WHITE, sliced=False):
        idx = self.comp_index(nid, "cc.Sprite")
        if idx is None:
            sp = copy.deepcopy(self._template("cc.Sprite"))
            sp["node"] = {"__id__": nid}
            sp["_id"] = rid()
            self.data.append(sp)
            idx = len(self.data) - 1
            self.data[nid]["_components"].append({"__id__": idx})
        sp = self.data[idx]
        sp["_type"] = 1 if sliced else 0
        sp["_sizeMode"] = 0
        sp["_color"] = color_obj(color)
        sp["_spriteFrame"] = {"__uuid__": FRAMES[frame], "__expectedType__": "cc.SpriteFrame"}
        return idx

    def add_label(self, nid, text, size, color, bold=True):
        idx = self.comp_index(nid, "cc.Label")
        if idx is None:
            lb = copy.deepcopy(self._template("cc.Label"))
            lb["node"] = {"__id__": nid}
            lb["_id"] = rid()
            self.data.append(lb)
            idx = len(self.data) - 1
            self.data[nid]["_components"].append({"__id__": idx})
        lb = self.data[idx]
        lb["_string"] = text
        lb["_overflow"] = 0
        self.label_style(lb, color=color, size=size, bold=bold)
        return lb

    def save(self):
        with open(self.path, "w", encoding="utf-8", newline="\n") as fp:
            json.dump(self.data, fp, ensure_ascii=False, indent=2)
            fp.write("\n")


# ────────── 1. 通用文字表面规则 ──────────
def surface_of(pf, i):
    cur = i
    while cur is not None:
        f = pf.frame_name(cur)
        if f in LIGHT_FRAMES:
            return "light"
        if f in DARK_FRAMES or (f and f.startswith("bg_")):
            return "dark"
        cur = pf.parent(cur)
    return "dark"


def restyle_labels(pf):
    for i in pf.iter_nodes():
        lb = pf.comp(i, "cc.Label")
        if not lb:
            continue
        c = lb["_color"]
        role = ROLE_BY_RGB.get((c["r"], c["g"], c["b"]))
        if role is None:
            continue
        surf = surface_of(pf, i)
        fs = lb["_fontSize"]
        on_button = pf.comp(pf.parent(i), UIBUTTON) is not None if pf.parent(i) is not None else False
        if surf == "dark":
            color = {"primary": WHITE, "secondary": ON_DARK_SOFT, "white": WHITE, "gold": GOLD, "score": GOLD}[role]
            if on_button:
                frame = pf.frame_name(pf.parent(i))
                oc = {"btn_primary": PRIMARY_OUTLINE, "btn_secondary": SECONDARY_OUTLINE, "btn_icon": ICON_OUTLINE}.get(frame, OUTLINE_DARK)
                pf.label_style(lb, color=WHITE, outline=(oc, 3 if fs >= 24 else 2), shadow=False)
            elif fs >= 26 or (lb.get("_isBold") and fs >= 20):
                pf.label_style(lb, color=color, outline=(OUTLINE_DARK, 3 if fs >= 26 else 2), shadow=(SOFT_SHADOW, -2, 2))
            else:
                pf.label_style(lb, color=color, outline=False, shadow=(SOFT_SHADOW, -1, 2))
        else:
            if on_button and pf.frame_name(pf.parent(i)) == "btn_ghost":
                pf.label_style(lb, color=GHOST_TEXT, outline=False, shadow=False)
            else:
                color = {"primary": INK, "secondary": INK_SOFT, "white": WHITE, "gold": GOLD, "score": GOLD}[role]
                pf.label_style(lb, color=color, outline=False, shadow=False)


# ────────── 2. 通用贴图染色 ──────────
# 全屏层适配：设计高 1334，高屏（最高 2.3 宽高比 → 1725）下背景按比例放大铺满（cover），遮罩直接超大覆盖
BG_COVER = (976, 1736)
MASK_COVER = (1600, 3200)


def restyle_sprites(pf):
    for i in pf.iter_nodes():
        f = pf.frame_name(i)
        sp = pf.comp(i, "cc.Sprite")
        if not sp:
            continue
        name = pf.node(i)["_name"]
        if name in ("Bg", "BgArt", "BgFill") and (f or "").startswith("bg_"):
            pf.set_size(i, *BG_COVER)
        elif name in ("Mask", "Vignette") and f == "mask":
            pf.set_size(i, *MASK_COVER)
        if f == "mask":
            if name == "Vignette":
                pf.set_color(sp, (6, 2, 24, 70))
            else:
                pf.set_color(sp, MASK)
        elif f == "panel_strip":
            if name == "Fog":
                pf.set_color(sp, (52, 40, 110, 236))
            elif name == "Panel":
                pass  # Banner：运行时按种类染色
            else:
                pf.set_color(sp, STRIP)


# ────────── 3. 图标按钮 ──────────
def icon_button(pf, path, icon, scale=0.56, hide_label=True):
    i = pf.find(path)
    if i is None:
        return
    ut = pf.comp(i, "cc.UITransform")
    w, h = ut["_contentSize"]["width"], ut["_contentSize"]["height"]
    side = round(min(w, h) * scale)
    nid, _ = pf.add_node(i, "Icon", side, side, 0, 3)
    pf.set_size(nid, side, side)
    sidx = pf.add_sprite(nid, icon)
    btn = pf.comp(i, UIBUTTON)
    if btn is not None:
        if btn.get("iconSprite") != {"__id__": sidx} or btn.get("iconNode") != {"__id__": nid}:
            btn["iconSprite"] = {"__id__": sidx}
            btn["iconNode"] = {"__id__": nid}
            pf.hits += 1
    if hide_label:
        lab = pf.find(path + "/Label")
        if lab is not None:
            pf.set_active(lab, False)


def set_skin(pf, path, skin):
    i = pf.find(path)
    if i is None:
        return
    btn = pf.comp(i, UIBUTTON)
    if btn is not None and btn.get("skin") != skin:
        btn["skin"] = skin
        pf.hits += 1


def lab(pf, path, **kw):
    i = pf.find(path)
    if i is None:
        return
    lb = pf.comp(i, "cc.Label")
    if lb:
        pf.label_style(lb, **kw)


def spr(pf, path, frame=None, color=None):
    i = pf.find(path)
    if i is None:
        return
    if frame:
        pf.set_frame(i, frame)
    if color:
        pf.set_color(pf.comp(i, "cc.Sprite"), color)


def pos(pf, path, x, y):
    i = pf.find(path)
    if i is not None:
        pf.set_pos(i, x, y)


def size(pf, path, w, h):
    i = pf.find(path)
    if i is not None:
        pf.set_size(i, w, h)


TITLE_DARK = dict(color=WHITE, outline=(OUTLINE_DARK, 4), shadow=(SOFT_SHADOW, -3, 3))


# ────────── 4. 每个 Prefab 的专项 ──────────
def hud(pf, pre=""):
    # 顶部图标钮原 y=54（56 高）会超出画布上缘 4px：下移到 44
    pos(pf, pre + "Btn_Pause", 330, 44)
    pos(pf, pre + "Btn_Restart", 266, 44)
    icon_button(pf, pre + "Btn_Pause", "ctrl_pause")
    icon_button(pf, pre + "Btn_Restart", "ctrl_restart")
    lab(pf, pre + "Score", )
    for card in ("ScoreCard", "LevelCard", "GoalCard", "NextCard"):
        spr(pf, pre + card, color=WHITE)
    lab(pf, pre + "ScoreCard/Score", color=WHITE, outline=(OUTLINE_DARK, 3), shadow=(SOFT_SHADOW, -2, 2))
    lab(pf, pre + "LevelCard/Level", color=GOLD, outline=(GOLD_OUTLINE, 3), shadow=(SOFT_SHADOW, -2, 2))
    lab(pf, pre + "Brand", color=WHITE, outline=(OUTLINE_DARK, 3), shadow=(SOFT_SHADOW, -2, 2))
    spr(pf, pre + "LevelCard/ProgressFill", color=GOLD)


def pad(pf, pre=""):
    # 控制区水平居中（原布局整体偏左 37px）
    pos(pf, pre + "Btn_Left", -233, 14)
    pos(pf, pre + "Btn_Right", -113, 14)
    pos(pf, pre + "Btn_Rotate", 7, 14)
    pos(pf, pre + "Btn_Drop", 177, 14)
    icon_button(pf, pre + "Btn_Left", "ctrl_left", 0.5)
    icon_button(pf, pre + "Btn_Right", "ctrl_right", 0.5)
    icon_button(pf, pre + "Btn_Rotate", "ctrl_rotate", 0.5)


def sugar_rail(pf, pre=""):
    icon_button(pf, pre + "Btn_Burst", "ctrl_burst", 0.6)
    icon_button(pf, pre + "Btn_Undo", "ctrl_undo", 0.58)
    icon_button(pf, pre + "Btn_Hint", "ctrl_hint", 0.58)
    spr(pf, pre + "Fill", color=SUGAR)
    lab(pf, pre + "Percent", color=ON_DARK_SOFT, shadow=(SOFT_SHADOW, -1, 2))


def shadow_bar(pf, pre=""):
    spr(pf, pre + "Current", color=GOLD)
    spr(pf, pre + "Shadow", color=SHADOW_GHOST)


def banner(pf, pre=""):
    lab(pf, pre + "Panel/Text", color=WHITE, outline=(OUTLINE_DARK, 3), shadow=(SOFT_SHADOW, -2, 2))
    spr(pf, pre + "Panel", color=(255, 128, 40, 245))


def float_text(pf, pre=""):
    for k in range(8):
        lab(pf, f"{pre}SlotRoot/Slot_{k}", outline=(OUTLINE_DARK, 4), shadow=(SOFT_SHADOW, -2, 2))


def board(pf, pre=""):
    size(pf, pre + "Tray", 656, 1028)
    size(pf, pre + "Frame", 660, 1032)


def tab_layout(pf, pre=""):
    pos(pf, pre + "Icon", -38, 0)
    size(pf, pre + "Icon", 32, 32)
    pos(pf, pre + "Name", 10, 12)
    pos(pf, pre + "Stars", 10, -14)
    pos(pf, pre + "Lock", 46, 26)
    size(pf, pre + "Lock", 20, 20)


def special(pf, name):
    if name == "GameScreen.prefab":
        spr(pf, "Bg", frame="bg_home")   # 分包背景加载完成前的兜底，避免首帧露清屏色
        hud(pf, "HUD/")
        pad(pf, "Pad/")
        sugar_rail(pf, "SugarRail/")
        shadow_bar(pf, "ShadowBar/")
        banner(pf, "Banner/")
        float_text(pf, "FloatText/")
        board(pf, "BoardHost/")
        lab(pf, "HUD/MutationBadgeHost/Name", color=WHITE, outline=(OUTLINE_DARK, 2))
    elif name == "HUD.prefab":
        hud(pf)
    elif name == "Pad.prefab":
        pad(pf)
    elif name == "SugarRail.prefab":
        sugar_rail(pf)
    elif name == "ShadowBar.prefab":
        shadow_bar(pf)
    elif name == "Banner.prefab":
        banner(pf)
    elif name == "FloatText.prefab":
        float_text(pf)
    elif name in ("Board.prefab",):
        board(pf)
    elif name == "Replay.prefab":
        board(pf, "BoardHost/")
        lab(pf, "Title", **TITLE_DARK)
        lab(pf, "Score", color=GOLD, outline=(GOLD_OUTLINE, 3), shadow=(SOFT_SHADOW, -2, 2))
    elif name == "GhostCell.prefab":
        spr(pf, "Fill", frame="ghost_fill", color=(255, 78, 140, 70))
        spr(pf, "GoldBorder", frame="ghost_border", color=(255, 128, 190, 235))
    elif name == "Highlight.prefab":
        spr(pf, "Fill", frame="ghost_fill", color=(255, 200, 56, 90))
    elif name == "Home.prefab":
        icon_button(pf, "Btn_Settings", "ctrl_settings", 0.56)
        root = pf.root()
        logo = pf.find("Logo")
        idx = pf.children(root).index(logo) + 1
        nid, _ = pf.add_node(root, "GameTitle", 520, 80, 0, 300, index=idx)
        lb = pf.add_label(nid, "落块消消", 64, WHITE, bold=True)
        pf.label_style(lb, outline=(OUTLINE_DARK, 6), shadow=((120, 60, 255, 200), -5, 6))
        sid, _ = pf.add_node(root, "GameSubtitle", 520, 30, 0, 246, index=idx + 1)
        lb2 = pf.add_label(sid, "同 色 相 连 · 落 块 消 除", 20, ON_DARK_SOFT, bold=True)
        pf.label_style(lb2, shadow=(SOFT_SHADOW, -1, 2))
        pos(pf, "Logo", 0, 430)
        pos(pf, "BestTag", -70, 176)
        size(pf, "BestTag", 300, 60)
        pos(pf, "CoinTag", 180, 176)
        size(pf, "CoinTag", 180, 60)
        pos(pf, "CoinTag/Icon", -56, 0)
        size(pf, "CoinTag/Icon", 36, 36)
        pos(pf, "CoinTag/Coin", 12, 0)
        pos(pf, "Btn_Endless", 0, 40)
        size(pf, "Btn_Endless", 440, 116)
        pos(pf, "Btn_Levels", 0, -96)
        size(pf, "Btn_Levels", 420, 100)
        pos(pf, "Btn_Daily", 0, -212)
        size(pf, "Btn_Daily", 420, 100)
        pos(pf, "Btn_Settings", 310, 580)
        size(pf, "Btn_Settings", 84, 84)
        lab(pf, "BestTag/Best", color=WHITE, bold=True)
        lab(pf, "CoinTag/Coin", color=GOLD, bold=True, outline=(GOLD_OUTLINE, 2))
        lab(pf, "Hint", color=ON_DARK_SOFT, shadow=(SOFT_SHADOW, -1, 2))
    elif name == "Dialog.prefab":
        pos(pf, "Card/Tag", 0, 262)
        lab(pf, "Card/Tag", color=VIOLET, bold=True)
        pos(pf, "Card/Title", 0, 214)
        lab(pf, "Card/Score", color=GOLD, outline=(GOLD_OUTLINE, 5), shadow=((120, 60, 10, 160), -4, 4), size=76)
        pos(pf, "Card/Score", 0, 126)
        pos(pf, "Card/Subtitle", 0, 46)
        pos(pf, "Card/StarRow", 0, -28)
        pos(pf, "Card/Btn_Primary", 0, -134)
        pos(pf, "Card/Btn_Secondary", 0, -230)
    elif name == "Settings.prefab":
        pos(pf, "Card/Title", 0, 206)
        pos(pf, "Card/Btn_Mute", 0, 106)
        pos(pf, "Card/Btn_Credits", 0, 4)
        pos(pf, "Card/Credits", 0, -82)
        pos(pf, "Card/Btn_Back", 0, -184)
    elif name == "MutationIntro.prefab":
        pos(pf, "Card/Icon", 0, 112)
        pos(pf, "Card/Name", 0, 40)
        pos(pf, "Card/Tier", 0, 2)
        pos(pf, "Card/Rule", 0, -50)
        pos(pf, "Card/Btn_Skip", 0, -140)
        size(pf, "Card/Btn_Skip", 260, 72)
        size(pf, "Card/Rule", 460, 32)   # 规则文案不再在词中间折行
    elif name == "ColorPicker.prefab":
        pos(pf, "Card/Title", 0, 112)
        pos(pf, "Card/Btn_Cancel", 0, -104)
        size(pf, "Card/Btn_Cancel", 300, 72)
    elif name == "TalentPicker.prefab":
        lab(pf, "Title", **TITLE_DARK)
    elif name == "TalentCard.prefab":
        set_skin(pf, "", "tile")
        lab(pf, "Name", color=WHITE, outline=(OUTLINE_DARK, 2))
        lab(pf, "Rarity", color=GOLD, bold=True)
        size(pf, "Effect", 184, 25)       # 原 100 宽会把「+0.25」拆成两行
    elif name == "LevelNode.prefab":
        set_skin(pf, "", "tile")
        lab(pf, "Index", color=GOLD, outline=(GOLD_OUTLINE, 2))
        lab(pf, "Stars", color=GOLD, outline=(GOLD_OUTLINE, 2))
    elif name == "DayCell.prefab":
        set_skin(pf, "", "tile")
    elif name == "ChapterMap.prefab":
        lab(pf, "Title", **TITLE_DARK)
        for k in range(1, 7):
            lab(pf, f"Tabs/Tab_{k}/Name", color=WHITE, outline=(OUTLINE_DARK, 2), shadow=False)
            lab(pf, f"Tabs/Tab_{k}/Stars", color=GOLD, shadow=False)
            spr(pf, f"Tabs/Tab_{k}", frame="panel_card")
            tab_layout(pf, f"Tabs/Tab_{k}/")
    elif name == "ChapterTab.prefab":
        lab(pf, "Name", color=WHITE, outline=(OUTLINE_DARK, 2), shadow=False)
        lab(pf, "Stars", color=GOLD, shadow=False)
        spr(pf, "", frame="panel_card")
        tab_layout(pf)
    elif name == "DailyPanel.prefab":
        # 原 Bg 无底图（纯清屏色）：补每日背景；目标/状态/连胜三行收进一张玻璃信息卡
        spr(pf, "Bg", frame="bg_daily")
        root = pf.root()
        goal = pf.find("Goal")
        nid, _ = pf.add_node(root, "InfoCard", 600, 176, 0, 0, index=pf.children(root).index(goal))
        pf.add_sprite(nid, "panel_card", sliced=True)
        lab(pf, "Title", **TITLE_DARK)
        lab(pf, "Month", color=WHITE, outline=(OUTLINE_DARK, 2))
        lab(pf, "Goal", color=WHITE, outline=(OUTLINE_DARK, 2))
        lab(pf, "Streak", color=GOLD, outline=(GOLD_OUTLINE, 2), bold=True)
    elif name == "Boot.prefab":
        spr(pf, "ProgressBar/Fill", color=GOLD)
        lab(pf, "ProgressBar/Label", color=WHITE, outline=(OUTLINE_DARK, 2))
        root = pf.root()
        logo = pf.find("Logo")
        idx = pf.children(root).index(logo) + 1
        nid, _ = pf.add_node(root, "GameTitle", 520, 80, 0, 100, index=idx)
        lb = pf.add_label(nid, "落块消消", 60, WHITE, bold=True)
        pf.label_style(lb, outline=(OUTLINE_DARK, 6), shadow=((120, 60, 255, 200), -5, 6))
        pos(pf, "Logo", 0, 250)
        pos(pf, "ProgressBar", 0, -60)
        pos(pf, "Tip", 0, -116)
    elif name == "ProgressBar.prefab":
        spr(pf, "Fill", color=GOLD)
        lab(pf, "Label", color=WHITE, outline=(OUTLINE_DARK, 2))
    elif name == "Toast.prefab":
        lab(pf, "Text", color=WHITE, outline=False, shadow=False)


def picture(pf, parent, name, frame, w, h, x, y, tint=WHITE, index=0, sliced=False):
    node, _ = pf.add_node(parent, name, w, h, x, y, index=index)
    pf.set_size(node, w, h)
    pf.set_pos(node, x, y)
    sprite = pf.add_sprite(node, frame, color=tint, sliced=sliced)
    return node, sprite


def view_binding(pf, node, field):
    return next(pf.data[c["__id__"]] for c in pf.node(node)["_components"]
                if field in pf.data[c["__id__"]])


def glimmers(pf, points, parent=None, index=1):
    parent = pf.root() if parent is None else parent
    group, _ = pf.add_node(parent, "Glimmers", 0, 0, index=index)
    # Cocos 的压缩脚本 UUID，对应 SceneGlimmers.ts.meta
    component = "f692f9pTilGi6S930MBiOXH"
    if not pf.comp(group, component):
        pf.node(group)["_components"].append({"__id__": len(pf.data)})
        pf.data.append({"__type__": component, "_name": "", "_objFlags": 0,
                        "node": {"__id__": group}, "_enabled": True, "__prefab": None, "_id": rid()})
    for i, (x, y, side) in enumerate(points):
        picture(pf, group, f"Spark_{i}", "spark", side, side, x, y, (205, 231, 255, 195))


def card_grid(pf, path, y, width, height, columns, cw, ch, gap):
    size(pf, path, width, height)
    pos(pf, path, 0, y)
    layout = pf.comp(pf.find(path), "cc.Layout")
    layout.update(_layoutType=3, _resizeMode=0, _constraint=2, _constraintNum=columns,
                  _startAxis=0, _verticalDirection=1, _horizontalDirection=0,
                  _spacingX=gap, _spacingY=gap, _paddingTop=0, _paddingBottom=0,
                  _paddingLeft=0, _paddingRight=0)
    layout["_cellSize"].update(width=cw, height=ch)


def chapter_tile(pf, path, chapter):
    root = pf.find(path)
    pre = path + "/" if path else ""
    pf.set_size(root, 220, 100)
    picture(pf, root, "Artwork", f"scene_{chapter}", 208, 88, 0, 0, (192, 197, 222, 255))
    picture(pf, root, "Caption", "panel_strip", 210, 43, 0, -22, (20, 16, 54, 232), index=1, sliced=True)
    pos(pf, pre + "Icon", -82, -21)
    size(pf, pre + "Icon", 27, 27)
    pos(pf, pre + "Name", -16, -22)
    lab(pf, pre + "Name", size=18)
    pos(pf, pre + "Stars", 70, -22)
    pos(pf, pre + "Lock", 83, 27)
    sel, _ = picture(pf, root, "Selected", "frame_gold", 222, 102, 0, 0, index=len(pf.children(root)), sliced=True)
    pf.set_active(sel, False)
    view_binding(pf, root, "starsLabel")["selection"] = {"__id__": sel}


def illustrated_layout(pf, name):
    root = pf.root()
    if name == "Home.prefab":
        picture(pf, root, "Hero", "scene_1", 694, 302, 0, 365, (155, 165, 198, 255), index=1)
        size(pf, "Logo", 370, 124)
        pos(pf, "Logo", -108, 417)
        pos(pf, "GameTitle", -108, 322)
        pos(pf, "GameSubtitle", -108, 259)
        pos(pf, "BestTag", -105, 148)
        pos(pf, "CoinTag", 151, 148)
        for path, theme, y in [("Btn_Endless", 5, 4), ("Btn_Levels", 1, -158), ("Btn_Daily", 4, -320)]:
            pos(pf, path, 0, y)
            size(pf, path, 640, 142)
            picture(pf, pf.find(path), "Cover", f"scene_{theme}", 217, 96, -176, 4)
            pos(pf, path + "/Label", 77, 4)
            lab(pf, path + "/Label", size=36)
        glimmers(pf, [(-310, 446, 34), (231, 291, 49), (-275, 236, 22), (290, 452, 30),
                       (-327, -404, 36), (298, -469, 24)], index=2)
    elif name == "ChapterMap.prefab":
        pos(pf, "Title", 0, 604)
        pos(pf, "Progress", 0, 548)
        card_grid(pf, "Tabs", 416, 680, 210, 3, 220, 100, 10)
        for ch in range(1, 7):
            chapter_tile(pf, f"Tabs/Tab_{ch}", ch)
        card_grid(pf, "LevelGrid", -105, 682, 776, 4, 163, 147, 10)
        glimmers(pf, [(-246, 599, 35), (230, 585, 25), (320, -562, 45)])
    elif name == "ChapterTab.prefab":
        chapter_tile(pf, "", 1)
    elif name == "LevelNode.prefab":
        size(pf, "", 163, 147)
        _, art = picture(pf, root, "Artwork", "scene_1", 151, 67, 0, 32)
        view_binding(pf, root, "indexLabel")["artwork"] = {"__id__": art}
        pos(pf, "Index", -54, 42)
        lab(pf, "Index", size=24, color=WHITE, outline=(OUTLINE_DARK, 3))
        pos(pf, "Name", 0, -16)
        lab(pf, "Name", size=22)
        pos(pf, "Stars", 0, -48)
        pos(pf, "Lock", 54, -48)
        size(pf, "Lock", 24, 24)
        pos(pf, "MutationIcon", 55, 42)
    elif name == "DailyPanel.prefab":
        pos(pf, "Month", 0, 534)
        card_grid(pf, "Calendar", 191, 692, 574, 7, 92, 106, 8)
        pos(pf, "InfoCard", 0, -218)
        size(pf, "InfoCard", 690, 190)
        _, art = picture(pf, pf.find("InfoCard"), "Artwork", "scene_1", 220, 105, -214, 0)
        view_binding(pf, root, "goalLabel")["detailArt"] = {"__id__": art}
        pos(pf, "Goal", 106, -209)
        lab(pf, "Goal", size=32)
        pos(pf, "Status", 106, -154)
        lab(pf, "Status", size=22)
        pos(pf, "Streak", 106, -269)
        pos(pf, "Btn_Play", 0, -402)
        size(pf, "Btn_Play", 570, 106)
        pos(pf, "Btn_Back", -225, -550)
        pos(pf, "Btn_Hint", 122, -550)
        glimmers(pf, [(-238, 585, 42), (243, 568, 28), (-326, -390, 28), (312, -473, 35)])
    elif name == "DayCell.prefab":
        size(pf, "", 92, 106)
        _, art = picture(pf, root, "Artwork", "scene_1", 80, 41, 0, 24, (202, 210, 237, 255))
        comp = view_binding(pf, root, "dayLabel")
        comp["artwork"] = {"__id__": art}
        frame = pf.find("Selected")
        if frame is None:
            frame = pf.find("Today")
            pf.node(frame)["_name"] = "Selected"
        comp.pop("today", None)
        comp["selection"] = {"__id__": frame}
        pf.set_size(frame, 94, 108)
        pf.comp(frame, "cc.Sprite")["_type"] = 1
        pos(pf, "Day", 0, -6)
        lab(pf, "Day", size=29, color=WHITE, outline=(OUTLINE_DARK, 2))
        pos(pf, "State", 0, -34)
        lab(pf, "State", size=16)
        pos(pf, "Star", 28, 28)
        size(pf, "Star", 20, 20)
    elif name in ("GameScreen.prefab", "HUD.prefab", "Pad.prefab"):
        if name != "Pad.prefab":
            pre = "HUD/" if name == "GameScreen.prefab" else ""
            host = pf.find(pre.rstrip("/"))
            _, art = picture(pf, host, "ModeArt", "scene_5", 270, 62, -214, 43, (115, 126, 158, 255))
            view_binding(pf, host, "brandLabel")["artwork"] = {"__id__": art}
            pos(pf, pre + "Brand", -222, 56)
            pos(pf, pre + "Title", -222, 28)
            lab(pf, pre + "NextCard/NextTitle", text="下一块")
            lab(pf, pre + "Title", text="无尽模式")
        if name != "HUD.prefab":
            pre = "Pad/" if name == "GameScreen.prefab" else ""
            size(pf, pre.rstrip("/"), 750, 136)
            for path, x, w in [("Btn_Left", -255, 118), ("Btn_Right", -123, 118),
                                ("Btn_Rotate", 9, 118), ("Btn_Drop", 202, 238)]:
                pos(pf, pre + path, x, 0)
                size(pf, pre + path, w, 106)
        if name == "GameScreen.prefab":
            glimmers(pf, [(-357, 350, 27), (343, 217, 26), (-354, -309, 21), (350, -388, 32)])
            lab(pf, "Banner/Panel/Text", text="连锁 ×2")
    elif name == "MutationIntro.prefab":
        picture(pf, pf.find("Card"), "Panorama", "scene_1", 500, 143, 0, 102, (174, 190, 219, 255))
        glimmers(pf, [(-174, 112, 36), (187, 81, 28)], parent=pf.find("Card"))
        pos(pf, "Card/Icon", 0, 102)
        pos(pf, "Card/Name", 0, 7)
        pos(pf, "Card/Tier", 0, -35)
        pos(pf, "Card/Rule", 0, -84)
        pos(pf, "Card/Btn_Skip", 0, -156)
    elif name == "Banner.prefab":
        lab(pf, "Panel/Text", text="连锁 ×2")
    elif name == "Dialog.prefab":
        lab(pf, "Card/Tag", text="本局结束")
    elif name == "Boot.prefab":
        # 标题留在夜空，插画中央展示骨牌，进度落在底部暗区。
        pf.add_sprite(pf.find("Bg"), "boot_workshop")
        size(pf, "Bg", 750, 1334)
        pos(pf, "Logo", 0, 544)
        size(pf, "Logo", 197, 66)
        pf.comp(pf.find("Logo"), "cc.Sprite")["_type"] = 0
        pos(pf, "GameTitle", 0, 454)
        lab(pf, "GameTitle", size=84, color=(255, 244, 218, 255),
            outline=((64, 26, 66, 255), 5), shadow=((73, 35, 96, 240), -4, 4))
        rule, _ = pf.add_node(root, "MatchRule", 680, 42, 0, 382)
        label = pf.add_label(rule, "不同落块的同色糖块，三个相连即可消除", 24, (236, 225, 255, 255), bold=False)
        pf.label_style(label, outline=(OUTLINE_DARK, 2))
        glimmers(pf, [(-170, -100, 29), (131, -104, 21), (-60, -158, 34),
                      (176, 195, 20), (-232, 290, 18), (89, -192, 17)])
        pos(pf, "ProgressBar", 0, -534)
        for path in ("ProgressBar", "ProgressBar/Track", "ProgressBar/Fill"):
            size(pf, path, 548, 18)
        pos(pf, "ProgressBar/Label", 226, 43)
        lab(pf, "ProgressBar/Label", size=28, color=GOLD, outline=(OUTLINE_DARK, 2), bold=True)
        pos(pf, "Tip", -44, -491)
        size(pf, "Tip", 460, 48)
        tip = pf.comp(pf.find("Tip"), "cc.Label")
        tip["_horizontalAlign"], tip["_overflow"] = 0, 1
        lab(pf, "Tip", size=24, color=WHITE, outline=(OUTLINE_DARK, 2), text="准备糖块与音效…")
        lab(pf, "Version", text="版本 2.0.0", color=ON_DARK_SOFT)
        view = view_binding(pf, root, "versionLabel")
        view["backdrop"] = {"__id__": pf.comp_index(pf.find("Bg"), "cc.Sprite")}
        view["title"] = {"__id__": pf.find("GameTitle")}
        view["rule"] = {"__id__": rule}


def bind_node(pf, host, existing_field, field, target):
    view_binding(pf, host, existing_field)[field] = {"__id__": target}


def spark_burst(pf, parent, name, count, side, x=0, y=0):
    group, _ = pf.add_node(parent, name, 0, 0, x, y)
    colors = [(255, 202, 83, 255), (144, 250, 255, 255), (255, 156, 224, 255)]
    for i in range(count):
        dim = side if i % 2 == 0 else round(side * 0.64)
        particle, _ = picture(pf, group, f"Fleck_{i}", "star" if i % 2 else "spark",
                              dim, dim, 0, 0, colors[i % len(colors)])
        pf.node(particle)["_lscale"].update(x=0, y=0)
    return group


def illustrated_header(pf, host, theme, width, height, y):
    header, _ = picture(pf, host, "HeaderArt", f"scene_{theme}", width, height, 0, y,
                        (120, 133, 170, 255), index=0)
    glimmers(pf, [(-width * 0.39, 9, 29), (width * 0.41, -9, 20)], parent=header)
    return header


def meter(pf, parent, x, y):
    group, _ = pf.add_node(parent, "Meter", 60, 32, x, y)
    for i, height in enumerate((14, 25, 34, 22, 29)):
        picture(pf, group, f"Light_{i}", "bar_fill", 7, height, (i - 2) * 11, 0,
                (155, 248, 255, 255))
    return group


def motion_layout(pf, name):
    root = pf.root()
    sky = {"Home.prefab": (197, -435), "Boot.prefab": (284, 213),
           "ChapterMap.prefab": (301, 646), "DailyPanel.prefab": (236, 647)}
    if name in sky:
        group = pf.find("Glimmers")
        comet, _ = pf.add_node(group, "Comet", 0, 0, *sky[name])
        picture(pf, comet, "Trail", "glow", 126, 11, 43, 0, (152, 216, 255, 230))
        picture(pf, comet, "Head", "star", 26, 26, 0, 0, (221, 252, 255, 255), index=1)
        picture(pf, comet, "Dust", "spark", 13, 13, 74, 0, (175, 195, 255, 170), index=2)
        pf.node(comet)["_euler"]["z"] = 18
        pf.node(comet)["_lrot"].update(z=0.156434465, w=0.987688341)
        pf.node(comet)["_lscale"].update(x=0, y=0)
        pf.comp(group, "f692f9pTilGi6S930MBiOXH")["comet"] = {"__id__": comet}
    if name == "Home.prefab":
        hero = pf.find("Hero")
        picture(pf, hero, "StageGlow", "glow", 264, 212, 190, 8, (140, 205, 255, 168))
        picture(pf, hero, "LandingHalo", "ring", 186, 38, 190, -53, (175, 236, 255, 220), index=1)
        pieces, _ = pf.add_node(hero, "MatchPieces", 0, 0, 190, -25)
        for i in range(6):
            piece, _ = picture(pf, pieces, f"Jelly_{i}", "block_0", 49, 49, 0, 0, index=i)
            pf.node(piece)["_lscale"].update(x=0, y=0)
        wave, _ = picture(pf, hero, "MatchWave", "shockwave", 176, 176, 190, -25,
                          index=pf.children(hero).index(pieces))
        pf.node(wave)["_lscale"].update(x=0, y=0)
        bind_node(pf, root, "endlessBtn", "matchWave", wave)
        sparks = spark_burst(pf, hero, "MatchSparks", 10, 31, 190, -19)
        bind_node(pf, root, "endlessBtn", "demoPieces", pieces)
        bind_node(pf, root, "endlessBtn", "matchSparks", sparks)
        for path, icon in (("Btn_Endless", "icon_flame"), ("Btn_Levels", "chapter_1"),
                           ("Btn_Daily", "icon_calendar")):
            btn = pf.find(path)
            picture(pf, btn, "Medallion", "panel_strip", 56, 52, -86, -18,
                    (82, 61, 134, 255), index=1, sliced=True)
            picture(pf, btn, "ModeIcon", icon, 39, 39, -86, -16, index=2)
            picture(pf, btn, "Arrow", "ctrl_right", 32, 32, 254, 5, (255, 249, 224, 235), index=3)
        glimmers(pf, [(-44, 31, 27), (48, -32, 18)], parent=pf.find("Btn_Endless/Cover"))
    elif name == "LevelNode.prefab":
        frame, _ = picture(pf, root, "NextLevel", "frame_gold", 163, 147, 0, 0,
                           index=len(pf.children(root)), sliced=True)
        glimmers(pf, [(-63, 53, 22), (56, -56, 19)], parent=frame)
        pf.set_active(frame, False)
    elif name == "DailyPanel.prefab":
        glimmers(pf, [(-84, 31, 27), (89, -30, 21)], parent=pf.find("InfoCard/Artwork"))
    elif name in ("Boot.prefab", "ProgressBar.prefab"):
        bar = pf.find("ProgressBar") if name == "Boot.prefab" else root
        light, _ = picture(pf, bar, "ProgressLight", "spark", 34, 34, 0, 0, index=2)
        bind_node(pf, bar, "fill", "light", light)
    elif name in ("HUD.prefab", "GameScreen.prefab", "SugarRail.prefab"):
        if name != "SugarRail.prefab":
            hud = pf.find("HUD") if name == "GameScreen.prefab" else root
            score = pf.find("HUD/ScoreCard" if name == "GameScreen.prefab" else "ScoreCard")
            sparks = spark_burst(pf, score, "ScoreSparks", 6, 17)
            bind_node(pf, hud, "scoreLabel", "scoreSparks", sparks)
        if name != "HUD.prefab":
            rail = pf.find("SugarRail") if name == "GameScreen.prefab" else root
            button = pf.find("SugarRail/Btn_Burst" if name == "GameScreen.prefab" else "Btn_Burst")
            ring, _ = picture(pf, button, "ReadyRing", "ring", 65, 65, 0, 0, (255, 209, 88, 245))
            pf.set_active(ring, False)
            bind_node(pf, rail, "burstBtn", "readyRing", ring)
    elif name == "Settings.prefab":
        header = illustrated_header(pf, pf.find("Card"), 2, 526, 88, 195)
        pos(pf, "Card/Title", -126, 195)
        lab(pf, "Card/Title", **TITLE_DARK)
        bind_node(pf, root, "muteBtn", "meter", meter(pf, header, 146, 0))
    elif name == "Dialog.prefab":
        header = illustrated_header(pf, pf.find("Card"), 6, 526, 126, 224)
        lab(pf, "Card/Title", **TITLE_DARK)
        lab(pf, "Card/Tag", color=(255, 227, 164, 255), outline=(OUTLINE_DARK, 2))
        sparks = spark_burst(pf, pf.find("Card"), "RewardSparks", 14, 35, 0, 118)
        bind_node(pf, root, "starRow", "header", header)
        bind_node(pf, root, "starRow", "rewardSparks", sparks)
    elif name == "TalentPicker.prefab":
        illustrated_header(pf, root, 6, 610, 116, 420)
        # 标题插画在遮罩上、文字下。
        kids = pf.node(root)["_children"]
        header = {"__id__": pf.find("HeaderArt")}
        kids.remove(header)
        kids.insert(kids.index({"__id__": pf.find("Mask")}) + 1, header)
    elif name == "TalentCard.prefab":
        glimmers(pf, [(-82, 121, 26), (76, 93, 18)], parent=pf.find("RarityFrame"))
    elif name == "ColorPicker.prefab":
        illustrated_header(pf, pf.find("Card"), 5, 526, 76, 108)
        lab(pf, "Card/Title", **TITLE_DARK)
        for i in range(5):
            chip = pf.find(f"Card/Chips/Chip_{i}")
            pf.set_color(pf.comp(chip, "cc.Sprite"), (120, 107, 166, 180))
            picture(pf, chip, "Gem", f"block_{i}", 72, 72, 0, 1)
    elif name == "MutationIntro.prefab":
        picture(pf, pf.find("Card/Panorama"), "EmblemHalo", "ring", 124, 124, 0, 0,
                (182, 236, 255, 214))
    elif name == "Replay.prefab":
        header = illustrated_header(pf, root, 5, 640, 82, 600)
        kids = pf.node(root)["_children"]
        hdr = {"__id__": header}
        kids.remove(hdr)
        kids.insert(kids.index({"__id__": pf.find("Bg")}) + 1, hdr)
        bind_node(pf, root, "playBtn", "meter", meter(pf, header, 189, 0))
        _, fill = picture(pf, pf.find("Slider"), "TimelineFill", "bar_fill", 490, 14, 0, 0)
        pf.data[fill].update(_type=3, _fillType=0, _fillStart=0, _fillRange=0)
        bind_node(pf, root, "playBtn", "timelineFill", fill)


def light_plane(pf, parent, name, material, width, height, x=0, y=0, alpha=255, index=0):
    # 不采样背景颜色。使用未裁剪、不入图集的整图提供稳定的 0..1 UV。
    node, sprite = picture(pf, parent, name, "bg_home", width, height, x, y,
                           (255, 255, 255, alpha), index=index)
    path = os.path.join(ROOT, "assets/resources/materials", material + ".mtl.meta")
    with open(path, encoding="utf8") as fp:
        material_uuid = json.load(fp)["uuid"]
    pf.data[sprite]["_customMaterial"] = {"__uuid__": material_uuid, "__expectedType__": "cc.Material"}
    pf.data[sprite]["_dstBlendFactor"] = 1
    return node


def crystal_emitter(pf, parent, name, frame, x, y, *, count, rate, life, speed,
                    angle, spread, size, start, end, duration=-1, width=0, gravity=0, additive=True):
    node, _ = pf.add_node(parent, name, 0, 0, x, y)
    particle = pf.comp(node, "cc.ParticleSystem2D")
    if particle is None:
        particle = {"__type__": "cc.ParticleSystem2D", "_name": "", "_objFlags": 0,
                    "node": {"__id__": node}, "_id": rid(), "_enabled": True, "__prefab": None}
        pf.node(node)["_components"].append({"__id__": len(pf.data)})
        pf.data.append(particle)
    particle.update(
        _custom=True, _spriteFrame={"__uuid__": FRAMES[frame], "__expectedType__": "cc.SpriteFrame"},
        _totalParticles=count, emissionRate=rate, life=life, lifeVar=life * 0.16,
        speed=speed, speedVar=speed * 0.2, angle=angle, angleVar=spread, duration=duration,
        posVar={"__type__": "cc.Vec2", "x": width, "y": 0},
        gravity={"__type__": "cc.Vec2", "x": 0, "y": gravity},
        _startColor=color_obj(start), _endColor=color_obj(end), _positionType=2,
        startSize=size, startSizeVar=size * 0.25, endSize=size * 0.42,
        startSpinVar=90, endSpin=140, endSpinVar=160,
        _srcBlendFactor=2, _dstBlendFactor=1 if additive else 4,
        playOnLoad=duration < 0, autoRemoveOnFinish=False,
    )
    return node


def screen_vfx(pf, name):
    root = pf.root()
    blue = (160, 228, 255, 235)
    gold = (255, 228, 142, 255)
    fade = (198, 156, 255, 0)
    if name == "Boot.prefab":
        light_plane(pf, root, "WorkshopAurora", "silk", 880, 330, 0, 256, 174, 1)
        crystal_emitter(pf, pf.find("WorkshopAurora"), "Embers", "spark", 0, -480,
                        count=20, rate=6, life=3, speed=115, angle=86, spread=22,
                        size=24, width=280, start=gold, end=fade)
    elif name == "Home.prefab":
        sky = light_plane(pf, root, "CandyAurora", "silk", 850, 350, 0, -508, 239, 1)
        crystal_emitter(pf, sky, "SugarDust", "star", 0, -24, count=24, rate=7,
                        life=3.3, speed=89, angle=72, spread=32, size=27, width=352,
                        start=blue, end=fade)
        light_plane(pf, pf.find("Hero"), "MatchPortal", "orbit", 231, 207, 190, 3, 238, 1)
        light_plane(pf, pf.find("Btn_Endless"), "CandyGlaze", "foil", 604, 102, 0, 5, 100)
    elif name == "ChapterMap.prefab":
        light_plane(pf, root, "ChapterStars", "constellation", 842, 170, 0, 570, 239, 1)
        light_plane(pf, root, "MapHorizon", "silk", 800, 200, 0, -554, 146, 1)
    elif name == "LevelNode.prefab":
        light_plane(pf, pf.find("NextLevel"), "RouteLight", "foil", 154, 136, alpha=98)
    elif name == "DailyPanel.prefab":
        light_plane(pf, root, "CalendarOrbit", "orbit", 255, 253, -237, 560, 204, 1)
        light_plane(pf, root, "Dawn", "silk", 830, 260, 0, -459, 200, 1)
    elif name == "DayCell.prefab":
        light_plane(pf, pf.find("Selected"), "DayGlaze", "foil", 85, 96, alpha=138)
    elif name == "Settings.prefab":
        light_plane(pf, root, "SpeakerHalo", "orbit", 866, 866, alpha=146, index=1)
        wave = light_plane(pf, pf.find("Card/HeaderArt"), "SoundTrace", "wave", 223, 64, 121, 0, 222)
        bind_node(pf, root, "muteBtn", "soundTrace", wave)
    elif name == "Replay.prefab":
        wave = light_plane(pf, root, "PlaybackTrace", "wave", 646, 85, 0, -453, 171, 1)
        bind_node(pf, root, "playBtn", "playbackTrace", wave)
        light_plane(pf, pf.find("HeaderArt"), "RecorderStars", "constellation", 636, 75, alpha=160)
    elif name == "ColorPicker.prefab":
        light_plane(pf, root, "PrismWheel", "prism-wheel", 842, 846, alpha=244, index=1)
        light_plane(pf, pf.find("Card/HeaderArt"), "PrismRefraction", "silk", 520, 72, alpha=175)
    elif name == "MutationIntro.prefab":
        light_plane(pf, root, "MutationVortex", "fracture", 910, 902, alpha=255, index=1)
        light_plane(pf, pf.find("Card/Panorama"), "UnstableCurrent", "wave", 478, 126, alpha=230)
    elif name == "TalentPicker.prefab":
        rays = light_plane(pf, root, "TalentRays", "corona", 1040, 860, 0, -62, 150, 1)
        ring = light_plane(pf, root, "OfferingCircle", "orbit", 805, 186, 0, -136, 186, 2)
        # 换皮会移动标题插画。每次生成都把舞台重新放在遮罩与前景之间。
        kids = pf.node(root)["_children"]
        for ref in ({"__id__": rays}, {"__id__": ring}):
            kids.remove(ref)
        start = kids.index({"__id__": pf.find("Mask")}) + 1
        kids[start:start] = [{"__id__": rays}, {"__id__": ring}]
    elif name == "TalentCard.prefab":
        # tile 按钮共用半透明玻璃皮肤，单独给天赋正文加实心衬底。
        picture(pf, root, "CardFace", "panel_popup", 218, 318, 0, 0,
                (64, 51, 99, 255), index=0, sliced=True)
        light_plane(pf, pf.find("RarityFrame"), "RareFoil", "foil", 151, 16, 0, 142, 108)
    elif name == "Dialog.prefab":
        halo = light_plane(pf, root, "QuietOrbit", "orbit", 862, 826, alpha=150, index=1)
        rays = light_plane(pf, root, "VictoryRays", "corona", 1200, 1360, 0, 58, 255, 2)
        fountains, _ = pf.add_node(root, "VictoryFountains", 0, 0)
        for side, direction, candy in [(-1, 68, "block_0"), (1, 112, "block_3")]:
            crystal_emitter(pf, fountains, "Candy_" + candy, candy, side * 334, -348,
                            count=26, rate=36, life=2.3, speed=921, angle=direction, spread=17,
                            size=27, width=16, gravity=-780, duration=0.64,
                            start=WHITE, end=(255, 231, 204, 0), additive=False)
            crystal_emitter(pf, fountains, "Stars_" + candy, "spark", side * 310, -328,
                            count=22, rate=26, life=1.75, speed=835, angle=direction, spread=24,
                            size=36, gravity=-620, duration=0.74, start=gold, end=fade)
        for field, node in [("quietOrbit", halo), ("victoryRays", rays), ("fountains", fountains)]:
            bind_node(pf, root, "starRow", field, node)
        pf.set_active(rays, False)
        pf.set_active(fountains, False)
    elif name == "GameScreen.prefab":
        light_plane(pf, root, "ArenaSky", "constellation", 800, 216, 0, 440, 145, 1)
        light_plane(pf, pf.find("Pad"), "ControlCurrent", "silk", 742, 132, 0, -40, 144)
    elif name == "BurstFx.prefab":
        node = crystal_emitter(pf, root, "CrystalShards", "star", 0, 0, count=12, rate=180,
                               life=0.32, speed=192, angle=90, spread=180, size=26, gravity=-110,
                               duration=0.075, start=gold, end=(255, 120, 192, 0))
        bind_node(pf, root, "spark", "shards", pf.comp_index(node, "cc.ParticleSystem2D"))
    elif name in ("Banner.prefab", "Toast.prefab"):
        panel = pf.find("Panel" if name == "Banner.prefab" else "Bg")
        light_plane(pf, panel, "NoticeGlaze", "foil", 298, 44, alpha=140)
    if name == "GameScreen.prefab":
        light_plane(pf, pf.find("Banner/Panel"), "NoticeGlaze", "foil", 298, 44, alpha=140)
    if name in ("GameScreen.prefab", "Board.prefab"):
        host = pf.find("BoardHost") if name == "GameScreen.prefab" else root
        trail, _ = pf.add_node(host, "DropTrail", 0, 0)
        if pf.comp(trail, "cc.UIOpacity") is None:
            pf.node(trail)["_components"].append({"__id__": len(pf.data)})
            pf.data.append({"__type__": "cc.UIOpacity", "node": {"__id__": trail},
                            "_enabled": True, "_opacity": 255, "_id": rid()})
        for i in range(4):
            _, ray = picture(pf, trail, f"Ray_{i}", "glow", 24, 240, 0, 0, index=i)
            pf.data[ray]["_dstBlendFactor"] = 1
        pf.set_active(trail, False)
        bind_node(pf, host, "gridRoot", "dropTrail", trail)


def ambient_vfx(pf, name):
    root = pf.root()
    if name in ("Home.prefab", "GameScreen.prefab"):
        in_game = name == "GameScreen.prefab"
        for i, (x, y, blue) in enumerate([(-328, 24, 255), (328, -32, 174)]):
            node = light_plane(pf, root, f"SodaBubbles_{i}", "soda", 143, 1236,
                               x, y, 143 if in_game else 185, 1 if in_game else 2)
            pf.comp(node, "cc.Sprite")["_color"]["b"] = blue
    elif name == "ChapterMap.prefab":
        swarm, _ = pf.add_node(root, "CrystalButterflies", 0, 0, index=4)
        for i, (x, y, size, blue) in enumerate([(-178, 579, 171, 255), (208, 582, 128, 193), (124, -561, 186, 220)]):
            node = light_plane(pf, swarm, f"Wings_{i}", "wings", size, size * 0.70, x, y, 222)
            pf.comp(node, "cc.Sprite")["_color"]["b"] = blue
        bind_node(pf, root, "levelGrid", "butterflies", swarm)
    elif name == "DailyPanel.prefab":
        light_plane(pf, root, "CalendarMint", "mint", 145, 145, 220, 557, 212, 3)
    elif name == "DayCell.prefab":
        light_plane(pf, pf.find("Selected"), "MintSeal", "mint", 48, 48, -28, 32, 240)
    if name in ("GameScreen.prefab", "Replay.prefab", "Board.prefab"):
        host = root if name == "Board.prefab" else pf.find("BoardHost")
        edges, _ = pf.add_node(host, "RimCurrents", 0, 0)
        for i in range(2):
            node = light_plane(pf, edges, f"Edge_{i}", "rim-current", 21, 992,
                               -319 if i == 0 else 319, 0, 226, i)
            pf.comp(node, "cc.Sprite")["_color"]["b"] = 255 - i * 58
        bind_node(pf, host, "gridRoot", "rimCurrents", edges)
    if name == "GameScreen.prefab":
        stars, _ = pf.add_node(root, "FlyingScoreStars", 0, 0)
        for i, color in enumerate([(255, 228, 132, 255), (162, 247, 255, 255), (255, 172, 224, 255)]):
            badge = i == 1
            size = 32 if badge else 49
            star, _ = picture(pf, stars, f"Star_{i}", "icon_star" if badge else "star",
                              size, size, 0, 0, WHITE if badge else color, index=i)
            _, tail = picture(pf, star, "Tail", "glow", 20, 75, 0, -25, (*color[:3], 174))
            pf.data[tail]["_dstBlendFactor"] = 1
            pf.set_active(star, False)
        bind_node(pf, root, "fxLayer", "flyingStars", stars)


def main():
    random.seed(20261125)
    total = 0
    files = sorted(glob.glob(os.path.join(PREFABS, "**", "*.prefab"), recursive=True))
    for f in files:
        pf = Prefab(f)
        name = os.path.basename(f)
        restyle_sprites(pf)
        special(pf, name)       # 先做结构/皮肤调整（影响表面判定）
        restyle_labels(pf)      # 再按表面统一文字
        special(pf, name)       # 专项覆盖通用结果
        illustrated_layout(pf, name)
        motion_layout(pf, name)
        screen_vfx(pf, name)
        ambient_vfx(pf, name)
        if pf.hits:
            pf.save()
            print(f"[restyle-v4] {os.path.relpath(f, ROOT)}: {pf.hits} 处")
            total += pf.hits
    print(f"[restyle-v4] 完成：{len(files)} 个 Prefab，共 {total} 处")


if __name__ == "__main__":
    main()
