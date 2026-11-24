# 落块消消（Tetris Match）· Cocos Creator 重制实现提示词

> **用法**：把本文件整体作为需求源交给执行者（人或 AI 编码工具），不需要额外口头补充。
> **权威性**：第 1 章是玩法规格的唯一权威来源，任何实现细节冲突以本章为准；第 3–5 章是实现方案，可按工程需要调整内部结构，但不得改变第 1 章的外部行为。
> **基线**：`tetris-match.html`（单文件 Canvas 实现，约 800 行）。

---

## 0. 角色、目标与硬约束

### 0.1 角色

你是 Cocos Creator 3.8.x + TypeScript 的资深游戏客户端工程师，同时具备微信小游戏上线经验与 2D 休闲游戏手感调优经验。你要把一款已在 HTML 原型中验证过手感的「俄罗斯方块落块 + 同色连通消除」混合玩法，重制为工程化、可发布微信小游戏的 Cocos Creator 项目。

### 0.2 交付目标（按优先级）

1. **可运行**：在 Creator 3.8.8 打开工程即可运行，无报错、无警告堆积；浏览器预览与微信开发者工具预览均通过。
2. **可复现**：重制版的判定结果、计分、难度曲线与原型逐条一致（用第 1 章的表格验收）。
3. **可扩展**：核心逻辑与表现分离，新增方块形状 / 特殊块 / 关卡目标 / 皮肤 / 排行榜时不需要改核心层。
4. **可发布**：满足微信小游戏首包 4MB、竖屏、触摸操作、切后台恢复、安全区适配等平台要求。

### 0.3 硬约束

- **不得改变核心玩法**：棋盘尺寸、消除判定（含"单块不能自消"）、计分公式、连锁倍率、等级阈值、下落速度曲线、输入手势阈值，全部照第 1 章实现。
- **不得依赖单文件 Canvas**：必须走 Cocos 的节点 + 组件 + 资源体系。
- **不得写死分辨率**：禁止出现 `if (width === 750)` 之类的硬编码，布局全部相对计算。
- **不得留占位实现**：所有 `TODO`、`// 后续补`、空函数体都视为未完成。
- **魔法数字必须进配置**：所有时长、阈值、倍率集中在 `GameTuning.ts`，不得散落在业务代码里。
- **本期不接入付费与广告**：仅预留接口（默认关闭），不做真实调用。

---

## 1. 玩法规格（从源码提取，实现必须逐条对齐）

### 1.1 一句话描述

玩家左右移动并旋转一个 4 格同色骨牌，让它从顶部落下。骨牌落地后粘入棋盘；棋盘上**上下左右连通且同色、数量 ≥3、且至少来自 2 个不同骨牌**的格子会被整组消除，随后上方格子下落补位；若某一行被填满则整行清除。消除会连锁，连锁与消行都给分，分数推高等级，等级加快下落。棋盘堆到顶即结束。

### 1.2 棋盘与方块

| 项 | 值 | 说明 |
|---|---|---|
| 列数 COLS | 10 | 固定 |
| 行数 ROWS | 16 | 固定，行 0 为顶部（生成区） |
| 颜色数 | 5 | 索引 0–4 |
| 颜色 | `#FF6B5B` 红 / `#F0B23A` 橙 / `#4ECB8A` 绿 / `#4A9DF0` 蓝 / `#A97BF0` 紫 | 与颜色索引绑定 |
| 形状标记 | 圆 / 菱 / 三角 / 方 / 六边 | 与颜色索引一一绑定，作为色盲冗余识别 |
| 骨牌格数 | 4 | 每块 4 格，**全部同一颜色**（同一 `color` 索引） |
| 形状表 | 7 种 | 见下表，坐标 `[r, c]`，原点左上 |

**形状表（必须原样保留）**

| # | 坐标 | 形态 |
|---|---|---|
| 0 | `[0,0][0,1][0,2][0,3]` | I（横） |
| 1 | `[0,0][0,1][1,0][1,1]` | O（方） |
| 2 | `[0,0][0,1][0,2][1,1]` | T |
| 3 | `[0,1][0,2][1,0][1,1]` | S |
| 4 | `[0,0][0,1][1,1][1,2]` | Z |
| 5 | `[0,0][1,0][1,1][1,2]` | J（竖 + 底横） |
| 6 | `[0,2][1,0][1,1][1,2]` | L（竖 + 顶横） |

- 生成完全随机（`Math.random` 语义）：形状与颜色各自独立均匀随机，**没有 7-bag**。
- 每块有自增 `pid`（piece id），该 id 会随格子写入棋盘，用于"至少来自 2 个不同骨牌"的判定。
- 生成位置：`x = floor((COLS - pieceWidth) / 2)`，`y = 0`。

### 1.3 旋转与踢墙

- 旋转方向：**顺时针**。变换公式：`{r, c} → {c, maxR - r}`，再整体平移使最小 `r`、`c` 归零。
- 踢墙尝试顺序（同一 `y` 下依次试，成功即止）：`dx = 0, -1, +1, -2, +2`。
- 若同一 `y` 全部失败，再把 `y` 上移 1 格重试同样 5 个 `dx`（即 `y-1`）。
- 仍失败则旋转无效（不改动任何状态）。
- **没有** SRS 完整踢墙表，**没有**锁定延迟（lock delay = 0），落地即锁。

### 1.4 碰撞规则

对骨牌每个格子 `(x + c, y + r)`：

- `x + c < 0` 或 `x + c >= COLS` → 碰撞
- `y + r >= ROWS` → 碰撞
- `y + r >= 0` 且该格已有方块 → 碰撞
- `y + r < 0` → **不判碰撞**（允许骨牌部分位于棋盘上方）

### 1.5 主循环与状态机

状态枚举：`playing`（可操作、自动下落）、`resolving`（结算动画中，输入全部失效）、`over`（结束）。

```
playing:
  每帧累加 dt（单帧 dt 上限 80ms）
  if dropAcc >= dropInterval: dropAcc = 0
     if 能下移: y += 1
     else: lock()          // 立即锁定，无延迟
resolving:
  忽略所有输入；不累加下落计时；等结算协程自然结束
over:
  忽略输入，显示结算弹窗
```

**锁定 → 结算 → 生成**的完整时序（必须按此顺序）：

```
lock():
  state = resolving
  把 4 格写入棋盘（仅写 y >= 0 的格；y < 0 的格丢弃）
  当前骨牌置空
  await settle()
  if state != over:
      state = playing
      dropAcc = 0
      spawn()

settle():                        // 最多循环 24 次，防死循环
  chain = 0
  loop (guard < 24):
      groups = findGroups()
      if groups.length > 0:
          chain++
          await popGroups(groups, chain)
          continue
      rows = fullRows()
      if rows.length > 0:
          await clearRows(rows)
          chain = 0            // 消行后连锁计数归零
          continue
      break
  if score >= level * 1500: levelUp()   // 注意：每次 settle 只升 1 级（原版行为）
```

- **优先级**：先消除同色组，再判断满行。只要还存在可消组，就不会消行。
- 消除 → 重力 → 可能再次形成组 → 继续循环，直到既无组也无满行。

### 1.6 消除判定（最容易做错的地方）

用 4 邻域 BFS（上下左右，**不含对角**）找同色连通块，逐格标记 `seen` 避免重复。一个连通块**同时满足**两个条件才可消除：

1. `size >= 3`
2. 块内**不同 `pid` 的数量 >= 2`

> 含义：一块骨牌自己形成的 3 连**不算消除**，必须接上棋盘上其它骨牌留下的同色格。这是本作与普通三消最关键的区别，禁止"顺手修复"。

- 一次 `findGroups` 找到的**所有**合格组在同一帧一起消除（不是逐组结算）。
- 分数按组求和，再统一乘连锁倍率。

### 1.7 计分

| 事件 | 公式 | 示例 |
|---|---|---|
| 同色组消除 | 每组 `size × (size+1) / 2 × 15`，多组求和 | 3 格 = 90；4 格 = 150；5 格 = 225；6 格 = 315；8 格 = 540 |
| 连锁倍率 | `mult = 1 + (chain - 1) × 0.5` | 首次 1.0；第二次 1.5；第三次 2.0 |
| 本轮实得 | `round(基础分总和 × mult)` | 两组 4 格 + 连锁 2 → `round(300 × 1.5) = 450` |
| 整行清除 | `行数 × 200 × 当前等级`，**不乘连锁倍率** | 2 行 @L3 = 1200 |

- `chain` 在每次 `settle` 内从 0 开始，遇到合格组 +1；消行后归零（消行之后的组重新从 chain 1 开始）。
- 软降、硬降、移动、旋转**均不计分**。
- 分数无上限，无连击时间窗口。

### 1.8 等级与难度

| 项 | 规则 |
|---|---|
| 升级条件 | `score >= level × 1500`（累计阈值：1500 / 3000 / 4500 …） |
| 检查时机 | 每次 `settle` 结束时检查一次 |
| 升级幅度 | 原版每次 settle **最多升 1 级**（`if`，非 `while`） |
| 下落间隔 | `max(130, 850 - (level - 1) × 60)` ms |
| 速度序列 | L1 850 → L2 790 → … → L13 130 → L13+ 恒定 130 |
| 等级是否改变颜色数/形状 | **否**，只影响速度 |

### 1.9 输入规格

| 操作 | 触摸 | 键盘（仅编辑器/浏览器调试） | 行为 |
|---|---|---|---|
| 左移 / 右移 | 在棋盘上拖动，或点按左右按钮（长按连发） | `←` `→` | 每次 1 格，碰撞即停 |
| 软降 | 在棋盘上向下拖动，或 `↓` | `↓` | 每次 1 格；键盘软降会把 `dropAcc` 归零 |
| 旋转 | **轻点**棋盘（无位移且 <420ms），或旋转按钮 | `↑` 或 `X` | 顺时针 + 踢墙 |
| 硬降 | 「直落」按钮 | `Space` | 直落到底并立即锁定，不计分 |
| 重开 | 顶栏「重开」按钮 | — | 立即重置整局 |
| 长按连发 | 左右按钮：按下触发 1 次，250ms 后每 90ms 重复 | 键盘 `e.repeat` 忽略 | — |
| 手势判定 | 位移 > `0.45 × 格子边长` 视为"拖动过"；<420ms 且未拖动 → 旋转 | — | 阈值必须进配置 |

**拖动量化方式**：把像素位移除以格子边长后 `round` 得到"目标格差"，再逐格移动（每格都做碰撞检测）。横向正负都可；**纵向只允许向下**（`sy` 只增不减，向上拖不会把骨牌拉回）。

**输入拦截**：`state !== playing` 时，所有移动/旋转/硬降/拖动全部无效；长按计时器必须随状态切换取消。

### 1.10 表现元素（原型已有，重制需等价实现）

| 元素 | 原型行为 |
|---|---|
| 落点虚影 | 半透明白色圆角描边，标出硬降落点 |
| 消除动画 | 150ms 内 `scale 1 → 0.1`、`alpha 1 → 0.1`，easeOutCubic |
| 重力回落 | 190ms 位移补间，easeOutCubic，按列独立 |
| 消行动画 | 180ms 淡出 → 整体行下移 200ms |
| 飘分 | 在最大组的中心格弹出 `+分数`，每帧 `life -= 0.02` 淡出（原型缺陷，见 1.11） |
| 横幅 | 最大组 ≥5 → `同色 xN`；否则连锁 ≥2 → `连锁 xN`；消行 → `整行清除 xN`；升级 → `LEVEL N`；每帧 `life -= 0.014` |
| 下一块预览 | 右上角小窗，按包围盒居中缩放 |
| HUD | 得分、等级、下一块 |

### 1.11 已确认的缺陷清单（重制必须修掉）

| # | 缺陷 | 影响 | 修复要求 |
|---|---|---|---|
| D1 | 重开时未取消正在进行的 `settle` 协程 | 在新一局里继续消除/加分/改棋盘，严重串局 | 引入 `runId` 令牌，所有异步段 `await` 后校验，不匹配立即抛 `CancelError` 退出 |
| D2 | 特效寿命按"每帧减固定值"计时 | 120Hz 屏上飘分/横幅淡出速度快一倍 | 全部改为基于 `dt` 的计时 |
| D3 | 升级用 `if` 而非 `while` | 一次性大额得分只升 1 级，等级长期落后 | 改为 `while (score >= level * 1500) level++`，并支持连续升级表现 |
| D4 | 锁定在 `y < 0` 的格子被静默丢弃 | 玩家看不到块"消失"，且不判负 | 默认改为：锁定后若存在 `y < 0` 的格 → 立即 GameOver；用 `gameOverOnLockAboveTop` 开关可切回原行为 |
| D5 | 每帧重算 `getBoundingClientRect` + 全量重绘 | 布局抖动、耗电 | 尺寸变化只在 `view.on('canvas-resize')` / 首次布局时计算 |
| D6 | 拖拽时被阻挡仍递增 `sx` | 手感上"顶住后再往反方向拖要回拖一段才动" | 保留原行为（避免抖动），但需在注释中说明为刻意设计 |
| D7 | 顶栏「重开」无二次确认 | 误触直接清空进度 | 加确认弹窗 `ConfirmPanel`，可配置关闭 |
| D8 | 无暂停、无切后台处理 | 切回来骨牌已落到底 | 监听 `Game.EVENT_HIDE` → 自动暂停并停止计时累加 |

### 1.12 边界情况清单（逐条实现，逐条验收）

1. 生成时即碰撞 → 立即 GameOver，不得先渲染再判。
2. 棋盘为空时，一块 T 形自身 3 连 → **不消**（`pid` 只有 1 个）。
3. 一块落下后与其上方旧块形成 4 格同色连通 → 消 4 格，基础分 150。
4. 同一次结算出现两组（各 3 格、各 4 格）→ 一起消，`(90 + 150) × mult`。
5. 消除后重力补位又形成新组 → 继续消，`chain` 递增，倍率 1.5、2.0…
6. 消行后剩余的组重新从 `chain = 1` 计。
7. 一次填满两行 → `2 × 200 × level`，横幅显示 `整行清除 x2`。
8. 棋盘同时存在可消组和满行 → 先消组（可能消完就不满行了）。
9. 旋转 5 个 `dx` 全失败，且 `y-1` 也全失败 → 状态完全不变。
10. 骨牌部分在棋盘上方（`y = -1`）下落 → 允许；锁定时上方格丢弃或判负（按 D4 配置）。
11. `resolving` 期间狂点按钮/拖动 → 全部无效，无排队。
12. 硬降连点两次 → 只锁一次（第二次因 `piece == null` 或状态非 `playing` 被拦）。
13. 拖动指针移出棋盘 → `TOUCH_CANCEL` 必须清理 `drag` 状态，否则下次点击会"粘手"。
14. 重开发生在 `resolving` 中 → 旧协程必须被令牌杀死，新局从干净棋盘开始。
15. 连续 24 次结算仍未稳定 → 强制退出并 `LogError`（理论上不可达，防御性）。

---

## 2. 假设与偏差声明

### 2.1 源码明确、无需假设

棋盘尺寸、形状表、颜色表、旋转与踢墙、碰撞、消除双条件、计分公式、连锁倍率、消行分、等级阈值、下落曲线、输入阈值、特效时长——均已在第 1 章给出精确值，**不允许"重新设计"**。

### 2.2 源码缺失，按下列假设补齐（标注为"补充设计"，不改变玩法）

| 编号 | 假设 | 处理 |
|---|---|---|
| A1 | 原型无音效、无 BGM、无触感反馈 | 重制版补齐音效与轻震动，全部可在设置中关闭；默认开 |
| A2 | 原型无最高分、无本地存档 | 增加 `bestScore` 本地存档，HUD 显示"最高" |
| A3 | 原型无暂停 | 增加暂停（切后台自动触发），暂停时冻结下落计时 |
| A4 | 原型为无尽模式，无胜利条件 | **主模式保持无尽**；关卡/目标模式列为扩展点，本期不实现 |
| A5 | 原型随机无种子 | 重制版引入可注入种子的确定性 RNG（默认时间种子），为回放/反作弊/每日挑战预留 |
| A6 | 原型无锁定延迟 | 保持 0（落地即锁），不做现代俄罗斯方块的锁定延迟 |
| A7 | 原型无软降加分 | 保持不加分 |
| A8 | 原型美术为深色霓虹 | 按第 4 章改为明亮糖果风（用户授权自主设计） |

### 2.3 建议增强（默认关闭，需产品确认后开启）

- 7-bag 随机（减少连续同形状的挫败感）
- 消行/大连锁的屏幕震动
- 结算页「再来一局 / 返回首页 / 分享成绩」
- 新手引导（首次进入演示拖动与轻点旋转）

---

## 3. 技术实现方案

### 3.1 技术栈与工程约束

| 项 | 选择 | 理由 |
|---|---|---|
| 引擎 | Cocos Creator 3.8.8（工程已创建，uuid `36e082e2-…`） | 与现有工程一致 |
| 语言 | TypeScript，`strict: true`（工程当前为 false，需打开） | 类型安全，减少线上事故 |
| 渲染 | 2D / `custom-pipeline(Builtin)` | 纯 2D，无需 3D 模块 |
| 引擎模块 | 保持现有裁剪（已关 3D/物理 3D/骨骼/terrain）；额外确认关闭 `tiled-map`、`spine`、`dragon-bones`、`video`、`webview` | 减小包体 |
| 设计分辨率 | **750 × 1334**，`ResolutionPolicy.FIXED_WIDTH`，`fitHeight = false` | 竖屏休闲游戏通用基线 |
| 目标平台 | 微信小游戏（主）+ 浏览器（调试） | — |
| 代码组织 | Model（纯 TS）/ View（Component）/ Controller（Component）/ Service（单例）四层 | 可测试、可替换表现层 |

### 3.2 屏幕适配策略

**核心原则：棋盘尺寸运行时算，不用固定像素。**

```
SafeArea 容器（扣掉刘海/底部横条）
  ├─ TopBar      固定高度 H_top = 132（内容随宽度自适应）
  ├─ ControlPad  固定高度 H_pad = 168
  └─ BoardArea   弹性剩余高度 H_board

cell = floor(min(BoardArea.width - 24, BoardArea.height - 24) / 10, /16) 取两者更小
cell = clamp(cell, 40, 76)
boardW = cell * 10, boardH = cell * 16
BoardRoot 尺寸 = (boardW, boardH)，居中于 BoardArea
```

- 竖屏 19.5:9 多出的高度分配给 BoardArea，棋盘自动变大。
- 4:3 平板下棋盘自动缩小，不裁切。
- 所有 UI 用 `Widget` 锚定四边，禁止绝对坐标。
- 字号不随棋盘缩放（HUD 固定），仅棋盘节点整体缩放。

### 3.3 目录结构

```
assets/
├── scenes/
│   ├── Boot.scene                 # 启动：加载配置与常驻资源，显示进度
│   └── Game.scene                 # 主场景：棋盘 + HUD + 控制 + 弹窗
├── scripts/
│   ├── app/
│   │   ├── GameEntry.ts           # 入口：初始化服务、注册生命周期、进入主场景
│   │   ├── GameFSM.ts             # 状态机：Boot/Ready/Playing/Resolving/Paused/GameOver
│   │   └── RunContext.ts          # 单局上下文：runId、随机源、计分快照、取消令牌
│   ├── core/                      # 纯 TS，禁止 import 'cc'
│   │   ├── BoardModel.ts          # 网格数据、读写格、满行检测、清行
│   │   ├── PieceModel.ts          # 骨牌数据：cells/color/pid/x/y
│   │   ├── PieceFactory.ts        # 形状+颜色生成、居中、种子随机
│   │   ├── Rotator.ts             # 顺时针旋转 + 2 层 × 5 档踢墙
│   │   ├── CollisionService.ts    # 纯函数碰撞检测
│   │   ├── MatchFinder.ts         # 4 邻域 BFS，size>=3 && pidCount>=2
│   │   ├── GravityResolver.ts     # 逐列压缩，返回位移映射
│   │   ├── ResolvePipeline.ts     # 异步结算：组→重力→满行→循环，含令牌校验
│   │   ├── ScoreService.ts        # 组/连锁/消行计分
│   │   └── LevelService.ts        # 阈值、下落间隔、多级连升
│   ├── config/
│   │   ├── GameTuning.ts          # 所有数值常量（见 3.12）
│   │   ├── PieceShapeTable.ts     # 7 形状 × 4 旋转态预计算
│   │   ├── ShapeGlyphTable.ts     # 颜色索引 → 形状标记/贴图名
│   │   └── ThemeConfig.ts         # 颜色、字号、圆角、动效时长（皮肤切换点）
│   ├── controller/
│   │   ├── GameController.ts      # 编排：输入→模型→结算→发事件，唯一修改模型的地方
│   │   ├── InputController.ts     # 统一输入源（触摸/按钮/键盘），输出语义动作
│   │   ├── TouchGesture.ts        # 拖动量化、轻点识别、阈值判定
│   │   └── HoldRepeatButton.ts    # 250/90ms 长按连发
│   ├── view/
│   │   ├── BoardView.ts           # 网格背景绘制、格子节点池、坐标换算
│   │   ├── BlockView.ts           # 单格渲染：颜色+标记+缩放/透明度
│   │   ├── PieceView.ts           # 4 格跟随、落点虚影
│   │   ├── NextPreviewView.ts     # 下一块预览（4 sprite 包围盒居中）
│   │   ├── HudView.ts             # 分数/最高分/等级/进度条（BitmapFont）
│   │   ├── BannerView.ts          # 同色/连锁/消行/升级横幅
│   │   ├── FloatTextView.ts       # 飘分
│   │   └── ResultPanelView.ts     # 结算弹窗
│   ├── ui/
│   │   ├── UIButton.ts            # 统一按压反馈（缩放+下沉+音效）
│   │   ├── SafeArea.ts            # 安全区适配
│   │   ├── LayoutAdapter.ts       # 3.2 的棋盘尺寸计算
│   │   └── ModalStack.ts          # 弹窗栈：遮罩、拦截点击、ESC/返回键
│   ├── service/
│   │   ├── AssetService.ts        # bundle 加载/引用计数/释放/失败重试
│   │   ├── AudioService.ts        # BGM + playOneShot、静音、首次触摸解锁
│   │   ├── StorageService.ts      # 最高分/设置，localStorage 降级
│   │   ├── HapticService.ts       # 震动（平台能力探测）
│   │   └── PlatformAdapter.ts     # 微信 API 隔离层：分享/震动/生命周期/内存告警
│   ├── fx/
│   │   ├── FxPool.ts              # 特效对象池
│   │   ├── ClearBurst.ts          # 消除碎片迸射（8 片）
│   │   └── ScreenShake.ts         # 棋盘轻震
│   └── utils/
│       ├── EventBus.ts            # 类型化事件总线（封装 EventTarget）
│       ├── ObjectPool.ts          # 通用节点池
│       ├── Rng.ts                 # 可注入种子（mulberry32）
│       ├── CancelToken.ts         # 协程取消令牌 + CancelError
│       └── Logger.ts              # 分级日志，生产环境裁剪
├── prefabs/
│   ├── board/Board.prefab  Cell.prefab  Piece.prefab  Ghost.prefab
│   ├── ui/HDCard.prefab  PrimaryButton.prefab  IconButton.prefab  PanelBase.prefab
│   ├── ui/ResultPanel.prefab  PausePanel.prefab  ConfirmPanel.prefab
│   └── fx/Burst.prefab  FloatText.prefab
├── art/
│   ├── atlas/blocks.plist|png     # 5 色块（颜色+高光+标记烘焙在一起）
│   ├── atlas/ui.plist|png         # 卡片/按钮/图标/进度条
│   ├── bg/bg_main.png             # 750×1334 背景
│   └── font/score.fnt|png         # 数字位图字体
├── audio/
│   ├── bgm_main.mp3
│   └── sfx/{move,rotate,lock,clear_s,clear_m,clear_l,chain,levelup,over}.mp3
└── config/
    └── (可选) 远程调参 JSON，本期用 TS 常量
```

> **红线**：`core/` 目录下的文件**不允许出现 `import { ... } from 'cc'`**。这是可测试性与可移植性的前提。

### 3.4 场景与节点设计

**Boot.scene**

```
Canvas
└─ BootRoot
   ├─ Bg            (Sprite, 纯色)
   ├─ Logo          (Sprite)
   ├─ ProgressBar   (Sprite fillType=HORIZONTAL)
   └─ TipLabel      (Label "正在加载…")
```

**Game.scene**

```
Canvas  [Canvas, UITransform 750×1334, Widget 全屏]
├─ Background          [Sprite] bg_main，z=0
├─ SafeArea            [SafeArea, Widget 四边] z=10
│  ├─ TopBar           [Widget top] 高 132
│  │  ├─ ScoreCard     [Sprite 九宫] → Label(score, Bitmap) + Label(best)
│  │  ├─ LevelCard     [Sprite 九宫] → Label(Lv.N) + ProgressBar(fill)
│  │  ├─ NextCard      [Sprite 九宫] → NextPreviewView(4 Sprite) + Label("NEXT")
│  │  └─ BtnPause      [UIButton icon]
│  ├─ BoardArea        [Widget top=TopBar.bottom, bottom=ControlPad.top]
│  │  └─ BoardRoot     [BoardView, LayoutAdapter 运行时定尺寸]
│  │     ├─ GridBg     [Graphics]        # 只在布局变化时重绘一次
│  │     ├─ GhostLayer [Node]            # 4 个 Ghost Sprite
│  │     ├─ BlockLayer [Node]            # 最多 160 个 BlockView（池）
│  │     ├─ PieceLayer [Node]            # 4 个 BlockView（池）
│  │     └─ FxLayer    [Node]            # 碎片/飘分（池）
│  ├─ ControlPad       [Widget bottom] 高 168
│  │  ├─ BtnLeft       [HoldRepeatButton]
│  │  ├─ BtnRight      [HoldRepeatButton]
│  │  ├─ BtnRotate     [UIButton]
│  │  └─ BtnHardDrop   [UIButton primary] "直落"
│  └─ HintLabel        [Label] 小字提示
├─ OverlayLayer        [Node, 不拦截触摸] z=20
│  ├─ BannerRoot       [BannerView]
│  └─ FloatRoot        [FloatTextView]
└─ ModalLayer          [Node, BlockInputEvents] z=30
   ├─ Mask             [Sprite 黑 60%]
   ├─ ConfirmPanel     [prefab, 默认隐藏]
   ├─ PausePanel       [prefab, 默认隐藏]
   └─ ResultPanel      [prefab, 默认隐藏]
```

**层级原则**：背景 → SafeArea 内容 → 特效与飘字 → 模态弹窗。模态层未激活时必须是 `active=false`，避免白占 drawcall。

### 3.5 脚本清单与职责

| 文件 | 类型 | 职责（必须做到） |
|---|---|---|
| `GameEntry.ts` | Component | 初始化各 Service；注册 `Game.EVENT_HIDE/SHOW`；加载配置；跳转主场景；全局异常兜底 |
| `GameFSM.ts` | 纯 TS | 状态枚举与合法迁移表；非法迁移抛错；对外只暴露 `canAcceptInput()` / `transition()` |
| `RunContext.ts` | 纯 TS | 持有 `runId`、`Rng`、`CancelToken`、本局统计；重开时 `runId++` 并 cancel 旧令牌 |
| `BoardModel.ts` | 纯 TS | `grid: (Block|null)[][]`；`get/set/clear/fullRows/compact`；不感知渲染 |
| `PieceModel.ts` | 纯 TS | 骨牌 cells/color/pid/x/y；`width` 计算 |
| `PieceFactory.ts` | 纯 TS | 按 `Rng` 生成形状与颜色；居中落位 |
| `Rotator.ts` | 纯 TS | 4 状态预计算 + 踢墙序列，返回新 cells 或 null |
| `CollisionService.ts` | 纯 TS | `collides(board, cells, x, y)` 纯函数 |
| `MatchFinder.ts` | 纯 TS | BFS 找组，返回 `{cells, size, pidCount}[]`；严格 `size>=3 && pidCount>=2` |
| `GravityResolver.ts` | 纯 TS | 逐列压缩，返回 `{from,to}[]` 位移表供动画使用 |
| `ResolvePipeline.ts` | 纯 TS + 回调 | 异步结算主流程；每步 `await` 后校验令牌；24 次迭代守卫；向外抛事件（非直接改 View） |
| `ScoreService.ts` | 纯 TS | 组基础分、连锁倍率、消行分；返回本次明细（用于飘分与横幅） |
| `LevelService.ts` | 纯 TS | `while` 升级、阈值、`dropInterval(level)` |
| `GameTuning.ts` | 常量 | 见 3.12，所有数值唯一来源 |
| `PieceShapeTable.ts` | 常量 | 7 形状 × 4 旋转态，静态展开，避免运行时三角函数 |
| `GameController.ts` | Component | 唯一编排者：持有 model、调用 pipeline、驱动 view、发事件；输入入口 |
| `InputController.ts` | Component | 汇总触摸/按钮/键盘 → 语义动作 `{Move, Rotate, SoftDrop, HardDrop}`；状态门控 |
| `TouchGesture.ts` | 纯 TS | 拖动量化（round 后逐格）、轻点判定（<420ms & <0.45cell）、cancel 清理 |
| `HoldRepeatButton.ts` | Component | pointerdown 立即触发 + 250ms 后 90ms 重复；状态切换时停止 |
| `BoardView.ts` | Component | 格子坐标 ↔ 像素换算；BlockView 池；静态网格 Graphics 一次性绘制 |
| `BlockView.ts` | Component | 设置颜色/标记/缩放/透明度；提供 `playClear()/playDrop()` 等 tween |
| `PieceView.ts` | Component | 跟随模型位置；落点虚影更新；旋转时的轻微缩放反馈 |
| `NextPreviewView.ts` | Component | 4 个 Sprite 按包围盒居中缩放，无独立相机 |
| `HudView.ts` | Component | 分数滚动（可选数字滚动动画）、等级、进度条、最高分 |
| `BannerView.ts` | Component | 排队播放横幅，避免重叠；基于 dt 的寿命 |
| `FloatTextView.ts` | Component | 飘分对象池，上升 + 淡出，基于 dt |
| `ResultPanelView.ts` | Component | 结算数据填充、按钮回调、输入拦截 |
| `UIButton.ts` | Component | 按下缩放 0.96 + 下沉 2px + 音效；禁用态灰化；防连点 150ms |
| `SafeArea.ts` | Component | `sys.getSafeAreaRect()` → Widget 边距 |
| `LayoutAdapter.ts` | Component | 3.2 的 cell 计算；resize 时重排 |
| `ModalStack.ts` | 纯 TS | 弹窗栈管理、遮罩、返回键/ESC、互斥 |
| `AssetService.ts` | 单例 | bundle 预加载、引用计数、`releaseUnusedAssets`、失败重试与兜底 |
| `AudioService.ts` | 单例 | BGM 循环、`playOneShot`、静音持久化、首次触摸解锁 |
| `StorageService.ts` | 单例 | 读写封装 + try/catch + 内存降级 |
| `HapticService.ts` | 单例 | 能力探测，失败静默 |
| `PlatformAdapter.ts` | 单例 | 微信 API 隔离：分享、震动、生命周期、内存告警、开放数据域占位 |
| `FxPool.ts` | Component | 碎片/飘分池，预热 16，上限 64 |
| `ClearBurst.ts` / `ScreenShake.ts` | Component | 消除迸射；轻震（幅度 6px，120ms，衰减） |
| `EventBus.ts` | 单例 | 类型化 `on/off/emit`，事件名见 3.9 |
| `ObjectPool.ts` | 纯 TS | 通用节点池 |
| `Rng.ts` | 纯 TS | mulberry32，可注入种子 |
| `CancelToken.ts` | 纯 TS | `cancel()` / `throwIfCancelled()` / `CancelError` |
| `Logger.ts` | 单例 | `info/warn/error`，生产只保留 warn/error |

### 3.6 模块关系

```
                     ┌──────────────────────────────┐
   触摸/按钮/键盘 ──▶ │ InputController + TouchGesture│
                     └──────────────┬───────────────┘
                                    │ 语义动作（带状态门控）
                                    ▼
                     ┌──────────────────────────────┐
                     │        GameController         │◀── GameFSM（是否接受输入）
                     └───┬───────────┬───────────┬───┘
            读写下棋      │           │ 触发结算   │ 读分数/等级
                     ┌───▼────┐  ┌───▼──────┐ ┌──▼─────────┐
                     │Board   │  │Resolve   │ │Score/Level │
                     │Model   │◀─│Pipeline  │─▶│Service     │
                     │Piece   │  │Match/    │ └──┬─────────┘
                     │Collision│ │Gravity   │    │
                     └───┬────┘  └───┬──────┘    │
                         │ 变更事件   │ 事件       │
                         ▼            ▼           ▼
                     ┌────────────────────────────────────┐
                     │            EventBus                │
                     └───┬──────────┬──────────┬──────────┘
                         ▼          ▼          ▼
                   BoardView   HudView    Banner/Float/Fx
                         │
                         ▼
                   BlockView 池 / PieceView / Ghost

横切：AssetService（资源）、AudioService（音效）、StorageService（存档）、
      PlatformAdapter（微信）、Logger（日志）
```

**铁律**：
1. 只有 `GameController` 能改模型；View 只读模型 + 响应事件。
2. `ResolvePipeline` 通过回调/事件通知表现层，不直接 `getComponent(BoardView)`。
3. Service 单例不反向依赖 Controller（用事件或注入回调）。

### 3.7 关键实现逻辑（伪代码级，实现时按此展开）

**① 旋转 + 踢墙**

```ts
function rotate(piece: Piece, board: Board): boolean {
  const next = ROTATIONS[piece.shapeId][(piece.rot + 1) % 4];  // 预计算
  for (const dy of [0, -1]) {
    for (const dx of [0, -1, 1, -2, 2]) {
      if (!collides(board, next, piece.x + dx, piece.y + dy)) {
        piece.cells = next; piece.x += dx; piece.y += dy;
        piece.rot = (piece.rot + 1) % 4;
        return true;
      }
    }
  }
  return false;
}
```

**② 结算管线（带取消）**

```ts
async function resolve(ctx: RunContext, board: BoardModel, onStep: StepHandler) {
  let chain = 0;
  for (let guard = 0; guard < MAX_SETTLE_ITER; guard++) {
    ctx.token.throwIfCancelled();

    const groups = MatchFinder.find(board);
    if (groups.length) {
      chain++;
      const detail = Score.applyGroups(groups, chain);      // 纯计算
      onStep({ type: 'pop', groups, detail });               // 表现层播放
      await waitAnimation(detail.duration, ctx.token);        // 150ms
      board.remove(groups.flatMap(g => g.cells));
      onStep({ type: 'score', value: detail.gain, anchor: detail.anchor });

      const moves = GravityResolver.apply(board);            // 改数据
      onStep({ type: 'drop', moves });                       // 190ms
      await waitAnimation(190, ctx.token);
      continue;
    }

    const rows = board.fullRows();
    if (rows.length) {
      const gain = rows.length * ROW_CLEAR_BASE * level.value;
      onStep({ type: 'rowClear', rows, gain });              // 180ms + 200ms
      await waitAnimation(380, ctx.token);
      board.clearRows(rows);
      score.add(gain);
      chain = 0;
      continue;
    }
    break;
  }
  if (guardExceeded) Logger.error('settle guard exceeded', board.dump());
}
```

**③ 组判定**

```ts
// 4 邻域 BFS，seen 用一维 Uint8Array
// 若 cells.length >= 3 && pids.size >= 2 → 合格组
// 注意：不合格的连通块也必须标记 seen，避免重复遍历
```

**④ 拖动量化**

```ts
const cell = boardView.cellSize;
const tx = Math.round((e.x - start.x) / cell);
const ty = Math.round((e.y - start.y) / cell);
while (drag.sx < tx) { tryMove(1, 0); drag.sx++; drag.moved = true; }
while (drag.sx > tx) { tryMove(-1, 0); drag.sx--; drag.moved = true; }
while (drag.sy < ty) { tryMove(0, 1); drag.sy++; drag.moved = true; }
// sy 只增不减：向上拖不会回升
```

**⑤ 重开**

```ts
restart() {
  ctx.cancel();            // 杀死所有 await
  ctx = new RunContext(++runSeq, new Rng(seed));
  board.reset();
  score.reset(); level.reset();
  view.clearAll();         // 回收所有 BlockView 到池
  fsm.to(Playing);
  spawnNext();
}
```

**⑥ 计时（帧率无关）**

```ts
update(dt: number) {
  if (!fsm.canAcceptInput()) return;
  this.dropAcc += Math.min(dt, 0.08) * 1000;   // 与原型 80ms 上限一致
  if (this.dropAcc >= level.dropIntervalMs) { this.dropAcc = 0; this.stepDown(); }
}
```

### 3.8 资源加载与释放

| 阶段 | 动作 |
|---|---|
| Boot | `assetManager.loadBundle('ui')` + `('audio')`；加载 `blocks` 图集、`score.fnt`、9 个 sfx、1 个 bgm；进度条按 `onProgress` 更新；全部完成才进主场景 |
| 主场景 | 加载 `game` bundle 的 prefab（Board/Panel），实例化 |
| 游戏中 | **零加载**。所有方块、特效、飘分走对象池，不 new 节点、不 `load` 资源 |
| 返回首页 | `releaseUnusedAssets()`；保留 ui/audio bundle（常驻） |
| 内存告警 | `wx.onMemoryWarning` → `assetManager.releaseUnusedAssets()` + 清空 FX 池 |
| 引用计数 | `AssetService.acquire(path)` / `release(path)` 包装，`SpriteFrame` 一律成对使用，避免被提前释放导致白块 |

- 微信分包：`game` bundle 设为小游戏分包，主包只留 Boot + UI 图集 + 引擎。
- 图集：`blocks` 一张（5 色块 + 5 虚影 + 碎片），`ui` 一张（卡片/按钮/图标），保证面板与棋盘合并后 drawcall ≤ 6。
- 禁止使用 `resources.load` 动态路径；全部走 bundle 的静态路径常量。

### 3.9 事件契约（EventBus）

| 事件 | 载荷 | 发送方 | 接收方 |
|---|---|---|---|
| `game:start` | `{runId, seed}` | Controller | View 层全部重置 |
| `piece:spawn` | `{cells, color, x, y, nextCells, nextColor}` | Controller | PieceView / NextPreviewView |
| `piece:move` | `{x, y, cells, ghostY}` | Controller | PieceView |
| `piece:lock` | `{cells, color, pid}` | Controller | BoardView（新增格） |
| `board:pop` | `{groups, duration}` | Pipeline | BoardView / FxPool / Audio |
| `board:drop` | `{moves, duration}` | Pipeline | BoardView |
| `board:rowClear` | `{rows, duration}` | Pipeline | BoardView / FxPool |
| `score:change` | `{score, delta, anchor}` | ScoreService | HudView / FloatTextView |
| `level:change` | `{level, from, to}` | LevelService | HudView / BannerView |
| `banner` | `{text, kind}` | Controller | BannerView |
| `game:over` | `{score, level, rows, best, isNewBest}` | Controller | ResultPanelView |
| `game:pause` / `game:resume` | `{}` | FSM | View / AudioService |
| `sfx` | `{key}` | 各处 | AudioService（也可直接调用 Service，二选一，不允许两套并存） |

约定：事件名用 `域:动作` 小驼峰；一个事件只允许一个语义；禁止用事件传大对象（传 id 或坐标）。

### 3.10 状态管理

- 单一真源：`BoardModel + PieceModel + ScoreService + LevelService`，全部挂在 `GameController` 下，禁止 View 存副本状态。
- `GameFSM` 迁移表：

| From | 允许到 | 触发 |
|---|---|---|
| Boot | Ready | 资源就绪 |
| Ready | Playing | 首块生成 |
| Playing | Resolving | 锁定 |
| Playing | Paused | 暂停 / 切后台 |
| Resolving | Playing | 结算完成且未死 |
| Resolving | GameOver | 生成碰撞 / 锁块越顶 |
| Paused | Playing | 恢复（重置 dropAcc） |
| Playing / Resolving | GameOver | 判负 |
| GameOver | Ready | 重开 |

- 非法迁移直接 `Logger.error` 并忽略（不抛给玩家）。
- 所有可写状态变更必须经 Controller 方法，命名 `tryMove/rotate/lock/restart`。

### 3.11 动画与手感参数

| 动作 | 时长 | 缓动 | 形变 |
|---|---|---|---|
| 横移 / 软降 | 60ms | easeOutQuad | 位置吸附到格心，无缩放 |
| 硬降 | 90ms | easeInQuad | 落地瞬间 scaleY 0.88 → 1（80ms），轻微 dust |
| 旋转 | 80ms | backOut(1.4) | 整体 scale 1 → 1.06 → 1 |
| 锁定 | 60ms | — | 落点块 squash 1.06/0.94 → 1 |
| 消除 | 150ms | easeOutCubic | scale → 0.1，alpha → 0.1；同时 8 片碎屑飞散 |
| 重力回落 | 190ms | easeOutCubic | 位移补间，列内独立 |
| 消行 | 180ms + 200ms | linear + easeOutCubic | 白闪 → 整行下坠 |
| 飘分 | 700ms | easeOutCubic | 上移 42px，alpha 1 → 0 |
| 横幅 | 进 180ms / 停 600ms / 出 200ms | backOut / linear / easeIn | scale 0.9 → 1，位移 -8px |
| 面板弹出 | 220ms | backOut(1.2) | scale 0.86 → 1，遮罩 alpha 0 → 0.6 |
| 屏幕震动 | 120ms | 衰减正弦 | 幅度 6px，chain≥2 或消行触发 |

**手感红线**：输入到画面反馈 ≤ 1 帧（16ms）；禁止给移动/旋转加"平滑插值"导致迟滞；消行动画期间禁止接受输入（`resolving`）。

### 3.12 数据配置（`GameTuning.ts` 必含项）

```ts
export const TUNING = {
  board: { cols: 10, rows: 16, colorCount: 5 },
  speed: { startMs: 850, stepMs: 60, minMs: 130 },
  score: { groupPair: 15, chainStep: 0.5, rowClear: 200 },
  level: { threshold: 1500, multiLevelUp: true },
  settle: { maxIterations: 24, popMs: 150, dropMs: 190, rowFadeMs: 180, rowShiftMs: 200 },
  input: { tapMaxMs: 420, tapMaxCellRatio: 0.45, holdDelayMs: 250, holdRepeatMs: 90, frameClampMs: 80 },
  rules: { requireTwoPieces: true, minGroupSize: 3, gameOverOnLockAboveTop: true, confirmRestart: true },
  fx: { shakeOnChain: true, burstCount: 8, floatRisePx: 42 },
} as const;
```

- 所有值必须可被 `ThemeConfig` 之外的模块只读引用，不允许运行时改写（调试面板例外，需 `DEBUG` 开关）。

### 3.13 异常处理与自愈

| 场景 | 处理 |
|---|---|
| 结算卡死 | 进入 `Resolving` 时启动 2.5s 看门狗；超时则强制提交剩余删除与重力、回到 `Playing`，并上报日志 |
| 迭代超限 | `guard` 达到 24 → 记录棋盘快照 → 强制结束本次结算 |
| 资源加载失败 | 重试 1 次（500ms 退避）→ 仍失败用兜底图（品红方块）并 Toast「资源加载失败」 |
| 存档读写异常 | try/catch，降级为内存变量，不阻塞游戏 |
| 微信 API 不存在 | `PlatformAdapter` 全部方法先做 `typeof wx !== 'undefined' && wx.xxx` 探测，缺能力静默 no-op |
| 音频播放失败 | 捕获后静音，不弹错 |
| 未捕获异常 | `window.onerror` / `wx.onError` 记录，避免白屏（至少回到可重开状态） |
| 重复判负 | `gameOver()` 幂等，`state === over` 时直接 return |

### 3.14 微信小游戏适配

| 项 | 做法 |
|---|---|
| 方向 | `game.json` → `"deviceOrientation": "portrait"`；工程内锁定竖屏 |
| 适配 | `view.setDesignResolutionSize(750, 1334, FIXED_WIDTH)`；`SafeArea` 组件读 `sys.getSafeAreaRect()` |
| 首包 | 主包 ≤ 4MB（引擎 + UI 图集 + Boot）；`game` bundle 走分包；构建后必须实测体积并输出报告 |
| 平台判断 | `sys.platform === sys.Platform.WECHAT_GAME`，所有微信 API 只出现在 `PlatformAdapter` |
| 生命周期 | `game.on(Game.EVENT_HIDE)` → 暂停 + 停止计时 + BGM 暂停；`EVENT_SHOW` → 重置 `dropAcc` 后恢复 |
| 分享 | 预留 `shareScore()`：`wx.shareAppMessage({ title, imageUrl, query })`；`wx.showShareMenu({ withShareTicket: false })` |
| 开放数据域 | 预留 `openDataContext/` 目录与 `SubContextView` 挂点，本期不实现排行榜逻辑 |
| 激励视频 | `PlatformAdapter.showRewardedVideo(): Promise<boolean>`，本期直接 `resolve(false)` |
| 震动 | `wx.vibrateShort({ type: 'light' })`，失败忽略 |
| 音频 | 首次 `TOUCH_START` 后解锁；`wx.setInnerAudioOption({ obeyMuteSwitch: true, mixWithOther: false })` |
| 帧率 | `game.frameRate = 60`；低端机（`wx.getDeviceBenchmarkInfo` 或机型白名单外）降 30 |
| 性能面板 | DEBUG 下显示 `profiler`，生产关闭 |
| 触摸 | 统一用 Cocos `input.on(Input.EventType.TOUCH_*)`，不使用 DOM 事件；`TOUCH_CANCEL` 必须处理 |
| 内存 | `wx.onMemoryWarning` → 释放未用资源 + 清特效池 |
| 包体资源 | 纹理用 PNG（图集），音频 mp3 48kbps 单声道，BGM ≤ 300KB |

### 3.15 性能预算

| 指标 | 上限 | 保障手段 |
|---|---|---|
| DrawCall | ≤ 10 | 图集合并；静态网格用单 Graphics；UI 同图集 |
| 节点数 | ≤ 260 | BlockView 池复用（不销毁重建）；弹窗 active 切换 |
| 纹理内存 | ≤ 40MB | 图集 1024×1024 ×2；不用超大背景 |
| 首包 | ≤ 4MB | 引擎模块裁剪 + 分包 |
| 冷启动 | ≤ 3s（中端机） | Boot 只加载必需资源；配置内联为 TS |
| 帧率 | 60fps（骁龙 660 级） | update 内不做查找/分配；`getComponent` 结果缓存；避免字符串拼接 |
| GC | 每帧 0 次 new | 池化 + 复用数组；禁止在 update 里 `[]`、`{}`、模板字符串 |

**禁止事项**：`update()` 里遍历 160 个节点改位置；每帧 `draw()` 重绘 Graphics；每帧 `Label.string = ...`（分数变化时才更新）；`find()` / `getChildByName()` 在热路径。

### 3.16 验收标准（DoD）

**功能**
1. 7 种形状均可生成，旋转 4 态正确，踢墙 5 档生效。
2. 单块自身 3 连不消除；两块的 3 连消除。
3. 计分与 1.7 表格逐项吻合（至少覆盖：3/4/5/6 格组、chain 2/3、双行清除）。
4. 等级在 1500/3000/4500 分准确触发，下落间隔与公式一致。
5. 满行优先于零（先组后行），消行后 chain 归零。
6. 生成碰撞判负；锁块越顶按配置判负。
7. 重开在任何状态下都干净重置，无幽灵加分。

**体验**
8. 输入到画面 ≤ 1 帧；长按连发 250/90ms 手感与原型一致。
9. 切后台 30s 回来不瞬移、不跳帧。
10. 120Hz 设备上特效时长与 60Hz 一致。

**工程**
11. `core/` 下 0 个 `import 'cc'`。
12. 单元测试覆盖 `MatchFinder / GravityResolver / Rotator / ScoreService / LevelService`，用例 ≥ 25 条，通过率 100%。
13. 随机 200 局自动 `hardDrop` 压测：无异常、无死锁、分数单调、`resolving` 平均时长 < 1.2s。
14. 微信开发者工具真机预览通过；首包体积截图证明 ≤ 4MB。

---

## 4. 美术 UI 规范：马卡龙果冻（Macaron Jelly）

### 4.1 视觉基调

明亮、软糯、有食欲感。用"糖果柜台"的联想替代原型的深色霓虹：奶油底 + 果冻方块 + 厚实圆角。目标是**微信休闲用户第一眼敢点、三秒内看懂**，同时保留原型优秀的形状编码（颜色 + 图形双通道），做到色盲可玩。

- 关键词：奶油、果冻、圆润、克制的高光、无重投影
- 排除：暗色赛博、写实材质、金属质感、大面积渐变、发光描边
- 情绪节奏：平时安静（低对比背景），消除时爆发（高饱和碎屑 + 轻震）

### 4.2 色彩 token

| 用途 | 色值 | 说明 |
|---|---|---|
| 背景上 | `#FFF7EC` | 奶油白 |
| 背景下 | `#FFE7CE` | 蜜桃色（用 9-slice 图实现，不用运行时渐变） |
| 卡片面 | `#FFFFFF` @ 92% | 半透白卡 |
| 卡片描边 | `#F0DCC4` | 1px 暖灰描边 |
| 主文字 | `#3B2A1F` | 深可可，不用纯黑 |
| 次文字 | `#8B7355` | 驼色 |
| 主按钮 | `#4ECB8A` | 果绿；按下 `#3FB577`，底边 `#2E8F5E` |
| 警示/危险 | `#FF6B5B` | 与红色方块同源 |
| 高亮/横幅 | `#FFB13A` | 蜜橙 |
| 阴影 | `rgba(90,60,30,0.12)` | 只用于卡片底部 6px 柔边 |

**5 个方块色（沿用原型，保证与原版辨识度一致）**

| 索引 | 色值 | 形状标记 |
|---|---|---|
| 0 | `#FF6B5B` 草莓 | 圆 |
| 1 | `#F0B23A` 蜜橙 | 菱形 |
| 2 | `#4ECB8A` 青柠 | 三角 |
| 3 | `#4A9DF0` 汽水蓝 | 方形 |
| 4 | `#A97BF0` 葡萄紫 | 六边形 |

**方块质感配方**（10 秒能画完，程序化实现优先）：圆角 22% 的底色矩形 → 顶部 20% 高度叠 `#FFFFFF` 28% 高光 → 底部 14% 高度叠 `#000000` 12% 暗边 → 1px 内描边 `#FFFFFF` 35% → 中心白色 86% 的图形标记，标记尺寸为格子的 46%。

### 4.3 字体与字号层级

| 层级 | 字号 | 字重 | 用途 |
|---|---|---|---|
| 数字大 | 40 | 700 | 结算总分（位图字体） |
| 数字中 | 28 | 700 | HUD 得分 |
| 标题 | 30 | 600 | 弹窗标题 |
| 正文 | 22 | 400 | 说明文字 |
| 标签 | 18 | 500 | 卡片标签（"得分""最高""NEXT"） |
| 提示 | 16 | 400 | 底部操作提示 |

- 字体：`PingFang SC` / `Microsoft YaHei` / 系统 sans；数字必须用位图字体（等宽、免重排、省 drawcall）。
- 数字全部 `tabular`（等宽），避免跳动。

### 4.4 界面层级与布局栅格

```
┌──────────────────────────────┐
│ 顶栏 132                     │  得分卡(宽) / 等级卡 / NEXT / 暂停
├──────────────────────────────┤
│                              │
│        棋盘区（弹性）         │  10×16，居中，四周 ≥12 留白
│                              │
├──────────────────────────────┤
│ 控制区 168                    │  ← → │ ↻ │ 直落(主按钮，宽)
├──────────────────────────────┤
│ 提示 16px                     │  拖动移动 · 轻点旋转 · 同色 3+ 即消
└──────────────────────────────┘
```

- 外边距统一 24，卡片间距 16，圆角 20–24。
- 信息优先级：棋盘 > 得分 > 直落按钮 > 等级/下一块 > 提示。
- 顶栏三卡等高分栏：得分卡 `flex:1`，等级卡 `flex:0.7`，NEXT 卡固定 132×132。
- 棋盘外圈加 2px `#FFFFFF` 40% 描边 + 内阴影，形成"托盘"感。

### 4.5 组件规范

| 组件 | 规格 |
|---|---|
| 主按钮（直落） | 高 92，圆角 24，绿底，底部 6px `#2E8F5E` 实边（厚度感），文字 28 白；按下整体下移 3px + 底边缩到 3px + scale 0.97 |
| 次级按钮（方向/旋转） | 高 92，宽 92，圆角 24，白 92% + 2px 描边，图标 40 深可可色；按下同主按钮 |
| 图标按钮（暂停/静音） | 64×64 圆形，白 80%，无描边，图标 28 |
| 卡片 | 圆角 20，白 92%，1px `#F0DCC4`，底部 6px 柔阴影图 |
| 进度条 | 高 12，圆角 6，底 `#F3E4CF`，填充 `#4ECB8A`，升级时 300ms 补满再重置 |
| 弹窗 | 宽 620，圆角 28，标题 30 + 副文案 20 + 主按钮（高 92）+ 次按钮（文字链） |
| 遮罩 | `#1A1208` 60%，点击不关闭（结算类）；确认类允许点遮罩取消 |
| Toast | 底部 22% 处，`#3B2A1F` 88% 胶囊，白字 20，1.6s 自动消失 |
| 横幅 | 胶囊，`#3B2A1F` 86%，文字 `#FFD166` 26，居中于棋盘上方 16% 处 |

### 4.6 动效与反馈风格

- **弹性但不夸张**：所有缩放回弹 `backOut`，幅度 ≤ 1.08，时长 ≤ 220ms。
- **反馈三件套**：视觉（缩放/碎屑）+ 听觉（短音效 ≤ 180ms）+ 触觉（轻震 1 次），三者可分别关闭。
- **消除反馈分级**：3 格 = 小碎屑 + `pop_low`；4–5 格 = 中碎屑 + `pop_mid` + 轻震；≥6 格或 chain ≥2 = 大碎屑 + 轻微棋盘震动 + `pop_high` + 横幅。
- **禁止**：全屏闪白、持续抖动、音效叠加超过 3 层。
- **声音设计**：木质/糖果系短音（`marimba`、`pop`），BGM 轻快 100–110 BPM，音量默认 60%，可独立关闭。

### 4.7 美术资源清单（需产出）

| 资源 | 规格 |
|---|---|
| `blocks.png` + `.plist` | 1024²，5 色块 ×(常态/高光版) + 5 虚影 + 碎屑 4 片 |
| `ui.png` + `.plist` | 1024²，卡片 9-slice ×3、按钮 9-slice ×4、图标 8 个、进度条、遮罩 |
| `bg_main.png` | 750×1334，奶油渐变 + 极淡几何点缀（≤ 8% 对比） |
| `score.fnt/png` | 0–9 + `+`，等宽，含描边 |
| 音效 9 个 | mp3，单声道 48kbps，单个 ≤ 20KB |
| BGM 1 个 | mp3，≤ 300KB，可循环无缝 |

> 若美术资源暂缺：先用纯色 + 程序化圆角矩形跑通（`Graphics` 绘制），资源就位后只替换 `SpriteFrame`，不得改动逻辑代码。

---

## 5. 扩展点路线图

| 扩展 | 落点 | 改动范围 |
|---|---|---|
| 新形状 | `PieceShapeTable` 增加条目 + 4 旋转态 | 仅配置 |
| 7-bag 随机 | `PieceFactory` 换 `IRandomizer` 实现 | 单文件 |
| 特殊块（炸弹/彩虹/十字） | `BlockModel.kind` + `IMatchModifier` 链，在 `MatchFinder` 后追加规则 | core 增加策略，不改 View |
| 关卡目标（限步/限时/达标） | `ILevelGoal` 接口 + `LevelConfig` 数据表 | 新增 `LevelDirector`，主循环复用 |
| 皮肤 | `ThemeConfig` 换色 + 换图集 | 资源 + 配置 |
| 排行榜 | 开放数据域 + `SubContextView` | 新增子域工程，主域只加按钮 |
| 每日挑战 | `Rng(seed = yyyymmdd)` + 固定开局 | 配置 + 入口 |
| 回放/反作弊 | 记录 `seed + 输入序列`，复用确定性模型 | 新增 `ReplayService` |
| 多人对战 | 确定性帧同步（模型已是纯函数） | 远期，需网络层 |

**为了这些扩展现在就必须守住的约束**：
1. 模型层纯 TS、无引擎依赖 → 才能跑在 Node/服务端做校验。
2. 随机必须可注入种子 → 才能回放。
3. 结算流程必须可中断 → 才能做关卡切换与断线重连。
4. 所有数值在 `GameTuning` → 才能做远程调参与 A/B。

---

## 6. 交付要求

### 6.1 实施顺序（必须按里程碑推进，每步可运行）

| 里程碑 | 内容 | 完成标志 |
|---|---|---|
| M1 骨架 | 目录、Tuning、BoardModel、PieceModel、Collision、Rotator、BoardView（纯色块）、输入 | 能移动/旋转/落下/堆叠，无消除 |
| M2 玩法 | MatchFinder、Gravity、Score、Level、ResolvePipeline、重开、判负 | 与第 1 章判定完全一致，可连续玩 |
| M3 表现 | 虚影、消除/重力/消行动画、飘分、横幅、NEXT、HUD、对象池 | 手感接近原型，60fps |
| M4 平台 | Boot 场景、AssetService、微信适配、安全区、生命周期、分享占位 | 微信开发者工具真机预览通过 |
| M5 打磨 | 美术接入、音效、震动、结算页、最高分、异常兜底、压测 | 通过 3.16 全部 DoD |

### 6.2 输出要求

1. 先给**文件树 + 每个文件的职责一句话**，再给代码，不要边写边解释。
2. 每个脚本文件完整可运行，不留 `TODO`；配置文件与逻辑文件分离。
3. 关键算法（MatchFinder / ResolvePipeline / Rotator）在文件头用 3–5 行注释说明复杂度与不变量。
4. 所有常量引用 `TUNING`，不出现裸数字（0/1/2 等索引除外）。
5. 交付时附一份 `README.md`：如何打开、如何预览、如何构建微信包、验收自测清单勾选结果。
6. 每完成一个里程碑，回报：改了哪些文件、如何验证、遗留问题。

### 6.3 明确不做

- 不做后端、不做账号体系、不做内购。
- 不引入第三方框架（ECS、状态库、UI 框架），用引擎原生能力。
- 不改第 1 章的数值与判定，除非同时给出"A/B 对比数据 + 产品确认"。
- 不做横屏适配。

---

## 附录 A：从原型到重制的规则等价性速查

| 行为 | 原型 | 重制 | 是否必须一致 |
|---|---|---|---|
| 棋盘 | 10×16 | 10×16 | ✅ |
| 单块同色 4 格 | 是 | 是 | ✅ |
| 旋转 | 顺时针 + 5 档踢墙 × 2 层 | 同 | ✅ |
| 落地锁定 | 立即，0 延迟 | 同 | ✅ |
| 组判定 | ≥3 格 且 ≥2 pid | 同 | ✅ |
| 组消除顺序 | 先组后行 | 同 | ✅ |
| 连锁倍率 | 1 + 0.5×(chain-1) | 同 | ✅ |
| 消行分 | 行数 × 200 × level | 同 | ✅ |
| 升级 | score ≥ level×1500，每次 settle 1 级 | 改为可连续升级（D3） | ⚠️ 有意修正 |
| 下落间隔 | max(130, 850-(lv-1)×60) | 同 | ✅ |
| 越顶锁块 | 静默丢弃 | 默认判负（D4，可配置） | ⚠️ 有意修正 |
| 特效计时 | 按帧递减 | 按 dt | ⚠️ 有意修正 |
| 随机 | 纯随机 | 纯随机 + 可注入种子 | ✅ 行为一致 |
| 美术主题 | 深色霓虹 | 马卡龙果冻 | ⚠️ 授权变更 |
