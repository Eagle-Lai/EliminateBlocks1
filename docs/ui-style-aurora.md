# UI 视觉规范 v4「极光糖晶 Aurora Jelly」

> 2026-11-25 全量换皮：v3「莓果奶霜」（浅粉奶油）→ v4「极光糖晶」（深靛紫极光 + 宝石果冻）。
> 换皮为主：核心玩法、信息结构、交互逻辑、数据字段、文案内容不变；只改表现层并补齐缺失的视觉状态与适配。
> token 唯一来源：`assets/scripts/config/ThemeConfig.ts`（颜色/描边/字体阶梯）、`ButtonSkinTable.ts`（按钮四态）。

## 0. 一键重建管线

| 步骤 | 命令 | 作用 |
|---|---|---|
| 美术 | `npm run art:gen` | `scripts/art/gen_art.py` 风格圣经，程序化产出 105 张图（尺寸/文件名与 v3 一致）并同步 7 张分包背景 |
| 导入 | `npm run art:meta` | 9-slice 边距（立体按钮底边 42 / 顶边 32）、packable |
| Prefab | `npm run ui:restyle` | `scripts/ui/restyle-v4.py`：按「表面」统一文字色与描边、贴图染色、图标按钮、全屏层 cover 适配（幂等） |
| 字体 | `npm run font:subset` | 从 Windows 自带 Noto Sans SC VF（OFL，与原子集同源 v2.04）补齐缺字 |
| 验收 | `npm run verify:all` → `npm run smoke` → `npm run smoke:ui` → `npm run smoke:release` | 8 道静态门 + 3 套运行冒烟 |

改完美术/Prefab 后需让编辑器重新导入（MCP：`npm run mcp:call -- asset_refresh '{"url":"db://assets"}'`），再构建。

## 1. 色彩体系

| 用途 | Token | 值 |
|---|---|---|
| 背景（夜空渐变） | 图内 | 顶 (28,20,84) → 底 (74,34,128)，洋红/青色极光带 + 散景星点 + 晶体丘陵剪影 |
| 留边/清屏/网页底 | `bgEdge` | (40,26,100) |
| 主按钮（阳光金橙） | `primary` / `primaryOutline` | 渐变 (255,222,90)→(255,150,30)，唇边 (214,120,20)，白字 + (178,84,8) 描边 |
| 次按钮（天空蓝） | `secondary` / `secondaryOutline` | 渐变 (110,206,255)→(52,124,240)，唇边 (34,78,186)，白字 + (28,66,160) 描边 |
| ghost 按钮（浅紫） | `ghostText` | 底 (236,230,255)→(204,190,255)，紫字 (84,60,170)；深/浅表面都可读 |
| 图标按钮（葡萄紫圆钮） | `iconOutline` | (168,140,255)→(110,78,236)，白色图标 |
| 强调金 | `accent` / `accentOutline` | (255,200,56) / (150,70,10)：星星、金币、大分数、关卡号 |
| 遮罩 | `mask` | (12,6,40,186) |
| 胶囊条（Toast/标签） | `strip` | (22,14,64,225) |
| 横幅 | `bannerLevel/Row/Combo` | 翡翠 / 蓝宝 / 琥珀，白字深描边 |
| 五色方块 | `blockColors` | 粉 (255,78,140) / 橙 (255,158,36) / 绿 (40,210,140) / 蓝 (58,148,255) / 紫 (172,96,255)，色相与 v1~v3 一致 |

### 两种表面 → 文字色（所有 Label 遵守）

| 表面 | 典型节点 | 主文字 | 次文字 | 修饰 |
|---|---|---|---|---|
| 深色 | 背景、遮罩、玻璃卡 `panel_card`、胶囊条、彩色按钮 | `textOnDark` 白 | `textOnDarkSoft` (200,190,255) | ≥26 号或粗体标题加 `outlineDark` (34,20,78) 描边；小字柔和投影 |
| 浅色 | 奶白弹窗 `panel_popup`、ghost 按钮 | `textPrimary` (40,30,90) | `textSecondary` (112,100,160) | 无描边 |

## 2. 字体层级（Noto Sans SC 子集 `game_sc.ttf`）

hero 56~64（首页游戏名，6px 描边 + 紫色辉光投影）· display 72~76（结算大分，金字深橙描边）· hudScore 38/32 · title 34 · btnL 30 · btnS 24 · body 20 · small 18 · caption 16 · micro 12。

## 3. 组件

- **按钮四态**（`UIButton` + `ButtonSkinTable`）：常态 / 按下（压暗 + 缩到 0.94）/ 松手回弹（1.04→1 backOut）/ 禁用（灰化 + 60% 不透明）/ 选中（页签换成蓝色按钮皮）。立体按钮底部 10px 唇边，文字与图标自动上移 3~4px 视觉居中。
- **图标按钮**：原来用汉字充当图标的 9 个按钮（设/重/‖/←/→/旋/爆/撤/灯）全部换成白色图标（新增 `ctrl_settings`/`ctrl_undo`/`ctrl_burst`），通过 `UIButton.iconSprite/iconNode` 绑定。
- **卡片**：局内与列表用玻璃卡（半透明 + 亮边 + 顶部细高光）；模态弹窗用奶白卡（紫色厚边 + 底部唇边 + 投影）。关卡格/日历格/天赋卡按钮皮由 `secondary` 改为 `tile`。
- **棋盘**：深色玻璃托盘 + 淡紫发光描边 + 内凹槽位；托盘/描边比格子区外扩 18/20px，布局留白同步加大（`TUNING.ui.boardPadding`）。
- **落点虚影**：骨牌同色 70 透明度填充 + 提亮同色描边（原金色虚影与骨牌颜色无对应），并修复虚影比格子大一圈的旧 Bug。
- **动效**：沿用 dialog-in / banner-in / toast-in / star-pop 等 Prefab 动画；新增按钮果冻回弹；星级弹入现已真正点亮（见 §5）。

## 4. 布局与适配

- 全屏背景改为 976×1736 等比 cover（覆盖 750×1334 ~ 750×1725 全部高宽比），遮罩改为超大满幅：高屏不再出现上下纯色带/遮罩露边。
- 高屏下棋盘按宽度放大时把糖能轨挤出右边缘（360×828 上爆按钮越界）：`LayoutAdapter` 按「棋盘半宽 + 轨道间距 + 轨道半宽」限制格子边长。
- HUD 顶部暂停/重开钮原 y=54 超出画布上缘 4px → 44。控制区整体偏左 37px → 居中。
- 安全区：`GameScreenView` 把 `safeTop/safeBottom` 叠加到 HUD/Pad 的 Widget（微信刘海屏/Home 条），此前只有棋盘避让。

## 5. 顺带修复的缺陷（非新增功能）

1. 结算星级永远是空星：`StarRowView` 作为 Dialog 子节点时 `onOpen` 不会被调用，星星图从未加载 → 改为 `onLoad`/`setStars` 兜底加载。
2. 天赋选择标题在深色遮罩上用墨色字（不可读）。
3. 遮罩图带圆角与投影，四周露出棕色边 → 满幅纯色。
4. 局内背景：分包 `bundles/ch1..6`、`daily` 里的背景一直是 v2 旧图（v3 换皮漏同步）→ 美术管线自动同步。
5. 每日残局面板背景为空（只露清屏色）→ 补 `bg_daily`，目标/状态/连胜收进玻璃信息卡。
6. 天赋效果「+0.25」、异变规则在词中间折行 → 加宽文本框。
7. 字体子集缺 20 个运行时用字（稀有/传说/挤/降…）→ 重建子集；字体门改为扫描 view/controller 字符串并忽略注释。

## 6. 验收记录（2026-11-25）

见 README §12。截图：`docs/screenshots/`（9 屏 × 3 分辨率 + gameplay/gameover/level）。
