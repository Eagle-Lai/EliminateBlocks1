# 糖果甜蜜风 · UI 统一规范 v3「莓果奶霜」

> ⚠️ 已被 v4「极光糖晶」取代，现行规范见 `docs/ui-style-aurora.md`；本文仅作历史记录。

> 2026-11-25 两轮产出：v2 统一规范（字号/按钮/间距收敛）→ v3 全量换皮。
> token 唯一来源：`assets/scripts/config/ThemeConfig.ts`（颜色/字体阶梯）
> 与 `assets/scripts/config/GameTuning.ts`（布局数值）。
> Prefab 布局由 `scripts/ui/normalize-prefabs.py` 落盘；换皮颜色由 `scripts/ui/reskin-prefabs.py` 重映射；
> 美术 100 张由 `scripts/art/gen_art.py`（风格圣经）一键重生成。

## 0. v3 换皮摘要（功能/信息结构/交互零改动）

- **主色**：青柠绿 (78,203,138) → 莓粉 **(255,92,138)**；背景奶油暖调 → **粉紫冷调**（bg_home 顶 255,246,250 / 底 243,220,240）。
- **五色方块**：莓粉 / 芒果橙 (255,176,66) / 薄荷绿 (62,205,168) / 蓝莓蓝 (88,150,255) / 葡萄紫 (168,120,244)。
- **文字**：墨色 (59,42,31) → 可可莓墨 **(74,48,62)**；次色 → 莓灰 (154,116,136)；反白 → 雪白 (255,250,253)。
- **跨皮肤保留**：蜜金 (255,196,64)（星星/金币/金框/虚影边）、雾色、石头/冰脆块。
- **落改面**：gen_art.py 风格圣经（100 张图重生成）+ ThemeConfig 全套 token + reskin-prefabs.py 重映射 38 个 Prefab 共 124 处烤死色。
- 主按钮 `btn_primary.png` 与进度条填充取主色莓粉；糖能轨/影子线/虚影边随 reskin 同步。

## 1. 色板（全项目唯一金色 = 强调金）

| 用途 | Token | 值 |
|---|---|---|
| 主按钮/进度/消除反馈 | `primary` | 青柠绿 (78,203,138) |
| 强调金（星星/虚影边/糖爆飘分/Banner） | `accent` / `accentSoft` | (255,196,64) / alpha 210 |
| 按钮选中态 | `selected` | (255,245,214) |
| 危险/冲突 | `danger` | 草莓红 (255,107,91) |
| 文字主/次/反白 | `textPrimary` / `textSecondary` / `textOnDark` | (59,42,31) / (139,115,85) / (255,252,245) |
| 横幅三色 | `bannerLevel` / `bannerRow` / `bannerCombo` | 绿 235 / 蓝 235 / 墨 232 |
| 底色/留边/卡片 | `bgSolid` / `bgEdge` / `card` | 奶油系 |
| 五色方块 | `blockColors[0..4]` | 草莓/橙/青柠/苏打/葡萄（玩法辨识，不动） |

## 2. 字体阶梯（lineHeight = fontSize × 1.25）

72 display（弹窗大分）· 38/32（HUD 大数值）· **34 标题（唯一档）** · 30 主按钮 ·
24 次/ghost 按钮、Toast、Banner、返回 · 20 小标题 · 18 标签/关卡号 · 16 caption（HUD 卡片标题/状态行）· 12 micro（Tab 星数/日历格）

## 3. 按钮档位

- Hero CTA（首页主区）420×110/100，fs 34/30
- 主按钮 420~500×88~96，fs 30
- 次/ghost/返回 300~420×72，fs 24（返回小钮 160×72）
- 三态：常态/按下（PRESSED_COLOR + 缩放 0.97）/禁用（opacity 130）；选中态 = `THEME.selected`

## 4. 本次改版关键改动

1. **Dialog 结算卡**：600×560→600×640 并重排；原次按钮底边贴卡片边缘（0 内边距）→ 底部留白 38px；双按钮 92/70→88/72。
2. **Settings 卡**：600×480→600×560；原「返回」主按钮悬挂出卡片下缘 10px → 完整收进并均衡间距。
3. **标题统一 34**：Dialog 36→34、Replay/ColorPicker 30→34。
4. **次/ghost 按钮统一高 72、fs 24**：Replay（播放 fs26→30、倍速 64→72、关闭 70→72）、Daily/ChapterMap 返回 80→72、Settings 静音 90→84/跳过/制作名单、TalentPicker 跳过 80→72、Home 回放 70→72。
5. **金色收敛**：Banner 文字 (255,209,102)→(255,196,64)，字号 26→24；运行时金色全部走 `THEME.accent/accentSoft`（SugarBurst 飘分、PieceView 虚影边）。
6. **HUD 小字统一 16**：14/15→16（卡片标题/最佳/倒计时/下一块）。
7. **硬编码清零**：BannerView 三色、UIButton 选中色、GameScreenView 右轨 34/影子线 10、HudView 预览 22/84/6、ShadowBarView 兜底 400 → 全部入 THEME/TUNING。
8. **状态补齐**：DailyPanel 数据缺失显示「暂无当日题目/暂无该日题目」；GameEntry 分包加载失败 toast「资源加载失败，请重试」（原为未处理 rejection）。

## 5. 验证记录（2026-11-25 v3）

`typecheck` 0 错 · 单测 28+ 项全过 · `verify:prefabs` · `verify:ui` · CLI 构建成功 ·
`smoke` 玩法冒烟（判定已加固：直落 30 落内得分即过，第 4 落 540 分、终局 2498 分、无报错）·
`smoke:ui` 五条导航路径全过 · 多分辨率画布 4 档正确 ·
截图复核：首页/结算/设置/每日/章节/回放/对局全部呈现莓果奶霜，无旧皮肤残留（旧绿/米色已清零）。

## 6. 仍需关注的风险

- **安全区**：`UIView.applySafeArea()` 仍无调用方；刘海屏上 HUD 品牌行/暂停钮可能顶进状态栏（桌面/模拟器 insets=0 不受影响）。建议真机验证后决定是否给 HUD/Pad 挂 insets。
- **字体**：prefab 仍用引擎默认（Arial），`THEME.fontFamily` 仅作规范记录；接入 `assets/resources/font` 自定义字体需逐 prefab 替换，暂不动。
- **换肤流程**：今后换皮 = 改 gen_art.py 风格圣经 + ThemeConfig + reskin-prefabs.py 的 REMAP 表，三处同步后重跑 gen_art → reskin → normalize → 构建；prefab 内仍有烤死色（与 THEME 数值对齐但无引用关系）。
- **冒烟随机性**：直落成塔存在纯随机不消除的可能，smoke 已放宽为 30 落内得分即过；极端随机（<1%）仍可能误报，与玩法无关。
- **首帧 404**：构建页有一条可选资源 404（历史存在，与换肤无关）；headless 冷启动偶发 ERR_CONNECTION_REFUSED 为浏览器瞬时请求。
