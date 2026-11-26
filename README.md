# 落块消消 · Tetris Match（Cocos Creator 3.8.8）

俄罗斯方块式落块 + 同色连通消除的休闲游戏。玩法规格来自 `docs/tetris-match-cocos-prompt.md`，本工程是它的完整实现。

---

## 1. 快速开始

1. 用 **Cocos Creator 3.8.8** 打开本目录（`D:\EliminateBlocks\EliminateBlocks`）。
2. 等待首次资源导入（会自动为 `assets/resources` 下的图片生成 `.meta`）。
3. 打开 `assets/scenes/Main.scene`，点预览（浏览器即可）。
   预览页默认是浏览器窗口大小，但游戏是**竖屏**的：窗口比 750:1334 更宽时，画布会收成竖屏框居中（四周是糖果底色），
   想看得更大可在预览工具栏把分辨率选成竖屏设备（如 iPhone 13）。
4. 操作：
   - 棋盘上拖动 = 左右/向下移动
   - 轻点棋盘 = 顺时针旋转
   - 底部按钮：← → ↻ 直落（← → 支持长按连发）
   - 键盘（浏览器调试）：← → ↓ ↑/X 空格

> 入口：`GameEntry` 按**脚本 uuid（cid）**序列化在 `Main.scene` 的 Canvas 上（`"__type__": "e3b44zIIG5P26wmc+9MfW5v"`）。
> 场景里手写自定义组件时必须用 cid，写成类名 `"__type__": "GameEntry"` 会在预览/构建时报 `Missing class: GameEntry`。
> `assets/scripts/Bootstrap.ts` 只作兜底：组件被删掉时在场景启动后补挂，正常情况不会重复挂载。
> 如果编辑器一直开着、改过 `.scene` 后预览仍报 `Missing class`，说明编辑器内存里还是旧场景：关闭场景不保存 → 重新打开 `Main.scene`（或 `场景 → 重新加载`）。

> 想让 AI 直接操作编辑器（改场景 / 挂组件 / 触发构建），见 §10「AI 工具链（MCP）」。

---

## 2. 目录结构

```
assets/
├── scenes/Main.scene              # 唯一场景：Canvas(750×1334 竖屏) + Camera + GameEntry
├── scripts/
│   ├── Bootstrap.ts               # 场景启动兜底钩子
│   ├── app/                       # GameEntry / GameFSM / RunContext
│   ├── config/                    # GameTuning / PieceShapeTable / ThemeConfig
│   ├── core/                      # 纯 TS 模型与结算（禁止 import 'cc'）
│   ├── controller/                # GameController（唯一改模型的地方）
│   ├── view/                      # Board / Piece / Hud / Banner / Float / Dialog
│   ├── ui/                        # UIButton / UIFactory / LayoutAdapter
│   ├── service/                   # Asset / Audio / Storage / Haptic / Platform
│   ├── fx/                        # 消除碎片池
│   └── utils/                     # EventBus / Rng / CancelToken / Anim / Logger
└── resources/
    ├── art/bg/bg_main.jpg         # 750×1334 糖果背景（AI 生成）
    ├── art/blocks/block_0..4.png  # 5 种方块（AI 生成 + 程序化抠图）
    └── audio/sfx/*.wav            # 10 个短音效（程序化合成）
tests/core.test.ts                 # 纯逻辑单测（Node 运行，不进引擎工程）
docs/                              # 玩法规格与实现提示词
```

---

## 3. 核心数值（全部集中在 `config/GameTuning.ts`）

| 项 | 值 |
|---|---|
| 棋盘 | 10 × 16，5 色 |
| 消除判定 | 4 邻域同色连通 ≥3 格 **且** 至少来自 2 个不同骨牌 |
| 组得分 | `size*(size+1)/2*15`，多组求和 × 连锁倍率 |
| 连锁倍率 | `1 + 0.5×(chain-1)` |
| 消行 | `行数 × 200 × 等级`，不乘倍率，消行后 chain 归零 |
| 升级 | `score ≥ level×1500`，支持一次升多级 |
| 下落 | `max(130, 850-(lv-1)×60)` ms |
| 输入 | 轻点 <420ms 且位移 <0.45 格 = 旋转；按钮长按 250/90ms 连发 |

---

## 4. 关键实现

**模型与表现分离**：`core/` 下 8 个文件零 `import 'cc'`，可直接跑 Node 单测，也能搬到服务端做校验/回放。

**结算管线**（`ResolvePipeline`）：消除组 → 重力 → 满行 → 循环，最多 24 次迭代；每个 `await` 后校验 `CancelToken`，重开/切后台可立即中断，修掉了原型"重开时旧协程改新棋盘"的串局缺陷。

**棋盘 diff**：`BoardView` 用 `BlockData` 对象身份映射节点，重力与消行的位移不需要额外数据就能得到"从哪到哪"，因此动画只做一次 `rebuild`。

**输入**：`TOUCH_START/MOVE/END` 换算到棋盘本地坐标后按格量化；纵向只允许向下（与原型一致）；`TOUCH_CANCEL` 会清理拖拽状态，避免"粘手"。

**异常兜底**：结算异常 → 强制回到 playing 并生成新块；资源缺失 → 方块退化为程序化圆角色块；存档/震动/微信 API 全部能力探测 + 静默降级。

**画面适配（竖屏画布）**：本作是竖屏游戏，所以**画布本身保持竖屏比例**，而不是把竖屏 UI 塞进一块横屏画布。
- **场景里的 Canvas 就是竖屏画布**：`Main.scene` 的 Canvas 固定 `750×1334`、位置 `(375,667)`，
  **不再挂四边拉伸的 `cc.Widget`**（Widget 会按"设计分辨率"拉伸 Canvas，编辑器里的设计分辨率还是横屏时，
  Canvas 就会被显示成 1280×720 的横条）。Canvas 的尺寸/居中所需要的自适应改由 `GameEntry._syncCanvas()` 在运行时同步。
- 项目设置的设计分辨率是 `750×1334 / fitWidth`（`settings/v2/packages/project.json`），编辑器与构建都以它为准；
  ⚠️ 该设置**只在编辑器启动时读取**，改完文件要重启一次 Creator（或在「项目设置 → 项目数据」里手动改成 750×1334）。
- 运行时按窗口比例选容器策略（`GameEntry.onLoad`）：
  - 窗口比设计比例更"宽/矮"（桌面浏览器、编辑器预览、横屏窗口）→ `ContainerStrategy.PROPORTION_TO_FRAME`，
    画布收成 750:1334 的竖屏框居中，游戏铺满这块画布；画布外是页面，不是游戏画面。
  - 窗口本来就够高（手机、竖屏窗口）→ `EQUAL_TO_FRAME`，画布铺满窗口，设计高度跟随窗口比例（上限 2.3）。
- 三种"黑边"来源都对齐成糖果底色：页面底色（`_paintPageBackdrop`，web）、相机清屏色（`_paintBackdrop`）、
  背景图不足处的 `BgFill` 底色（`THEME.bgEdge`）。API 见 `LayoutAdapter.viewport()`。

**落点虚影**：原来用白色半透明描边，在奶白色空格上对比度不足 5%，几乎看不见；改为"骨牌色 22% 淡填充 + 78% 描边"，
既保留虚影的低调感，又能一眼看清落点，且与骨牌颜色一一对应。

---

## 5. 美术与音频

- 背景与 5 个方块由图像生成模型产出，随后用 Python(PIL) 做了**边缘泛洪抠图**、尺寸归一（统一 90% 占位）和压缩：背景 750×1334 JPEG 43KB，方块 5×160² PNG 共约 125KB。
- 音效由 Python 合成（正弦/噪声 + 指数包络），10 个 WAV 合计 136KB，无需外部素材版权。
- 配色仍沿用原型的五色（草莓/蜜橙/青柠/汽水蓝/葡萄紫），并保留"颜色 + 形状"双通道，色盲可辨。

---

## 6. 微信小游戏

1. 构建面板选「微信小游戏」，填入自己的 AppID。
2. 设备方向设为 **竖屏**（`game.json` 的 `deviceOrientation: portrait`）。
3. 可在构建面板给 `assets/resources` 配分包；当前资源合计 < 400KB，主包压力很小。
4. 已接：安全区（`wx.getSystemInfoSync().safeArea`）、分享菜单与结算分享、切后台自动暂停、震动、静音开关（`StorageService`）。
5. 已预留未启用：激励视频复活（`PlatformAdapter.showRewardedVideo` 固定返回 false）、开放数据域排行榜（`openLeaderboard` 为空实现）。

---

## 7. 自测结果

**已验证**

| 项目 | 方式 | 结果 |
|---|---|---|
| 类型检查 | `npm run typecheck` | 0 错误（对照引擎真实 `cc.d.ts`） |
| 纯逻辑单测 | `npm run test` | **29 项全通过**（消除双条件、对角不连通、计分、升级、下落曲线、重力、旋转、取消、随机复现） |
| 引擎构建 | `CocosCreator.exe --build platform=web-mobile` | 成功，脚本进入 `assets/main/index.js`（约 185KB） |
| 运行冒烟 | `npm run smoke`（puppeteer 驱动本机 Chrome，轮询等启动） | 场景加载 → `state=playing`；10 次直落有消除加分（分数随随机序列浮动）；继续直落至判负 → `state=over`，结算弹窗正常 |
| 触摸 | 同一冒烟脚本拖动 + 轻点 | 无报错，骨牌正常移动/旋转 |
| 多分辨率 | `node scripts/shot-multi.cjs`（750×1334 / 656×900 / 375×667 / 1280×720） | 横屏窗口下画布仍是 750:1334 竖屏框（337×600），游戏铺满画布、四周为糖果底色；竖屏窗口铺满窗口 |
| 资源体积 | 构建产物 | 背景 43KB + 方块 125KB + 音效 136KB，合计 < 400KB |

截图：`docs/screenshots/gameplay.png`、`docs/screenshots/gameover.png`。

> 冒烟测试用的 Node 脚本在 `scripts/smoke.cjs`，需要本机 Chrome；
> 先 `npm run build`（或在编辑器构建）再 `npm run serve:build` 起服务，最后 `npm run smoke`。
> 多分辨率检查用 `scripts/shot-multi.cjs`（同样先起服务，再 `node scripts/shot-multi.cjs http://127.0.0.1:8123/`）。

**仍需你在真机确认**

- 微信开发者工具真机预览（安全区、震动、分享、音频解锁）。
- 各机型布局观感（当前按 750 宽、1.4~2.3 宽高比自适应）。

---

## 8. 与原型的差异（有意修正）

| 项 | 原型 | 本实现 | 原因 |
|---|---|---|---|
| 重开 | 旧结算协程会继续改新棋盘 | 令牌取消，立即中断 | 修 Bug |
| 特效寿命 | 按帧递减 | 按时间 | 高刷屏一致 |
| 升级 | 每次结算最多 1 级 | 可连续升级 | 修 Bug |
| 越顶锁块 | 静默丢弃 | 判负（`gameOverOnLockAboveTop` 可关） | 标准做法 |
| 重开按钮 | 直接重置 | 二次确认 | 防误触 |
| 美术 | 深色霓虹 | 糖果亮色 | 需求指定 |
| 落点虚影 | 半透明白色描边 | 骨牌色淡填充 + 同色描边 | 白色在奶白格子上几乎看不见 |
| 背景铺满 | 只铺设计框 | 画布本身收成竖屏框，画布外刷成糖果底色 | 竖屏游戏不该用横屏画布（两侧黑边） |

---

## 9. 后续可扩展

- 特殊块（炸弹/彩虹）：给 `BlockData` 加 `kind`，在 `MatchFinder` 之后接规则链。
- 关卡模式：新增 `LevelDirector` 读取目标配置，复用现有主循环。
- 排行榜：补 `openDataContext` 子域 + `SubContextView`。
- 皮肤：替换 `ThemeConfig` 的色值与 `art` 路径即可。

---

## 10. AI 工具链（MCP）

工程按「编辑器内改工程 / 浏览器里验玩法」两条链路各接了一个 MCP，配置写在 `~/.workbuddy/mcp.json`（用户级，全局生效）：

| 名称 | 传输 | 端点 / 启动方式 | 能干什么 |
|---|---|---|---|
| `cocos-creator` | HTTP | `http://127.0.0.1:3945/mcp` | 连正在打开的编辑器：场景/节点/组件/Prefab/资源/构建/控制台，**72 个工具** |
| `playwright` | stdio | `@playwright/mcp` 0.0.86 + 本机 Chrome | 跑 `build/web-mobile`：按坐标点击/拖拽（iPhone 13 触屏模拟）、截图、读 console/network |

编辑器侧实现装在 `extensions/ccreator-mcp`（v0.1.1，MIT，源自 `github.com/blackbeans-1301/cocos-mcp`，release 包自带预编译 `dist`，无需 `npm install`）。

### 启用步骤

1. **重启 Cocos Creator**（扩展只在编辑器启动时扫描），打开本工程。
2. 菜单 `扩展 → ccreator-mcp`（快捷键 `Ctrl+Shift+M`）可看服务状态；默认随编辑器自动启动，端口 `3945`。
3. 跑 `npm run mcp:check`，正常输出 `[OK] 已连接 ... 工具数: 72`。
4. 重启 WorkBuddy 会话 → 连接器管理里对新出现的 MCP 点「信任」，工具才会挂上。

### 命令行直连（不改代码就能修编辑器里的状态）

`scripts/mcp-call.cjs` 是一个零依赖的 MCP 客户端，Agent 和人都能直接用：

```bash
npm run mcp:call -- editor_status
npm run mcp:call -- component_list '{"path":"Canvas"}'
npm run mcp:call -- component_remove '{"path":"Canvas","type":"GameEntry","index":1}'   # 删掉重复挂的组件
npm run mcp:call -- project_setting_set '{"package":"project","key":"general.designResolution","value":{"width":750,"height":1334,"fitWidth":true,"fitHeight":false}}'
npm run mcp:call -- scene_save
npm run mcp:call -- --schema component_remove            # 查某个工具的入参
```

> 关键经验：`settings/`、`profiles/` 由编辑器**启动时**读取，手改文件不重启不生效；
> 但通过 MCP 的 `project_setting_set` 改，是直接改运行时内存 + 落盘并立即刷新（预览「Default 画布」当场就变 750×1334）。

### 分工建议

| 场景 | 用哪个 |
|---|---|
| 改场景结构、加节点、挂组件、改 Prefab、触发一次 `web-mobile` 构建、读编辑器控制台 | `cocos-creator` |
| 「点一下看看」、验证拖拽/旋转手感、截图留档、查浏览器报错 | `playwright` |
| 纯数值/逻辑回归 | `npm test`（29 项单测，不经过 MCP） |

### 已知事项

- **端口冲突**：3945 被占时，在扩展面板改端口或在启动前设 `CCREATOR_MCP_PORT`，并同步改 `~/.workbuddy/mcp.json` 的 `url`。
- **执行能力**：扩展带 `editor_script` / `scene_script`（在编辑器内执行 JS）与 `asset_delete` 这类写操作，服务仅监听 `127.0.0.1`、无遥测；但仍属「能改工程」的工具，别在不受信任的会话里放开。
- **升级扩展**：删掉 `extensions/ccreator-mcp`，把新 release 解压到同名目录，重启编辑器。
- **Playwright MCP** 装在 `C:\Users\78296\.workbuddy\mcp-servers`，用 WorkBuddy 自带 node 启动（`mcp.json` 里是绝对路径）；WorkBuddy 升级换 node 版本后要同步改这个路径。
- 截图默认落在 `.workbuddy/shots/`。
- `mcp.json` 里另有 `unityMCP`，只对 Unity 工程有用，与本工程无关。

---

## 11. v2 更新（Prefab 化 + 三模式 + 内容/美术/音频管线）

### 新增能力

- **三模式**：无尽 / 关卡（6 章 × 20 关）/ 每日残局（365 题，84 个异变日）。
- **6 套玩法**：异变 8×3、特殊块 5 种、糖能糖爆、天赋 30 个、影子、回放。
- **UI 100% Prefab**：38 个预制体（`assets/resources/prefabs/**`），`view/`、`ui/`、`controller/` 0 处 `new Node` / `Graphics`。
- **棋盘也 Prefab 化**：`GridCell / Block / PieceCell / GhostCell / FogCell` 全部实例化 + 池化。
- **分包**：`audio-bgm`、`ch1..ch6`、`daily`、`audio-sfx`；章节背景与 BGM 进章加载，SFX 开机预载。

### 命令

```bash
npm run gen:levels    # 120 关（公式 + 机器人可达率校准）
npm run gen:daily     # 365 题（beam search + 回放校验）
npm run art:gen       # 100 张图（程序化，色板统一）
npm run art:meta      # 9-slice / packable
npm run audio:synth   # 56 SFX + 8 BGM
npm run typecheck
npm run test          # 139 项（29 基线 + 82 玩法 + 28 内容）
npm run verify:all
npm run smoke:ui      # 逐屏打开 + UI 栈断言
npm run shot:screens  # 5 关键屏 × 3 分辨率
```

### 文档

- 实施报告与缺口：`docs/implementation-report.md`
- 120 关计划与可达率：`docs/level-plan.csv`、`docs/level-report.md`
- 365 题报告：`docs/daily-report.md`
- 美术审计：`art_report.csv`
- 关键屏幕截图：`docs/screenshots/`

### 备注

- 场景新增 `UIRoot`（四层 + `UIManager`），`GameEntry` 绑定其 `uiRoot`；入口仍是 Canvas 上的 cid 序列化组件。
- 单测口径已从 29 项扩到 137 项；`npm test` 会依次跑三组。

---

## 12. v4 换皮「极光糖晶」（2026-11-25）

全量视觉重设计：深靛紫极光背景 + 宝石果冻方块 + 立体厚边按钮 + 玻璃卡片/奶白弹窗。玩法、信息结构、交互、数据字段不变。
规范与改动清单见 `docs/ui-style-aurora.md`。

```bash
npm run art:gen && npm run art:meta   # 美术（含分包背景同步）
npm run ui:restyle                    # Prefab 换皮（幂等）
npm run font:subset                   # 字体补字
npm run smoke:release                 # 上线冒烟：6 种屏幕 × 34 项真实点击检查
```

| 验收项 | 结果 |
|---|---|
| typecheck + 单测 | 0 错误；29 + 82 + 28 项全过 |
| verify:all（8 道门） | 全过：112 图 / 341 引用全命中 / 38 Prefab / 字体覆盖 436 字 / 总包 10.35MB ≤ 10.5MB |
| smoke（玩法） | 得分、判负、结算、触摸均正常，无报错 |
| smoke:ui（导航） | 5 条路径全过 |
| smoke:release | 750×1334 / 390×844@3x / 360×640 / 360×828 / 768×1024 / 1280×720 全部 0 失败 |

仍需真机确认：微信刘海屏安全区（已接 Widget 偏移，模拟器 insets=0 未覆盖）、低端机 Label 描边性能。
