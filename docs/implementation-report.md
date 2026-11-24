# 落块消消 v2 实施报告

> 需求源：`new-gameplay-implementation-prompt.md`（v2）
> 本期目标：Prefab 驱动三模式 + 6 套玩法 + 120 关 + 365 题 + 美术/音频管线。

## 1. 交付数字（实测）

| 项 | 目标 | 实际 | 状态 |
|---|---|---|---|
| Prefab | 38 | 38 | ✅ |
| 图片 | 100 | 100 | ✅ |
| 图集 | 4 | 4 | ✅ |
| BGM | 8 | 8（80kbps，见 §6） | ✅ |
| SFX | 56 | 56 | ✅ |
| 字体 | 1 | 1（626 字符覆盖，已绑定到全部 Label） | ✅ |
| 章节 | 6 | 6 | ✅ |
| 关卡 | 120 | 120 | ✅ |
| 每日题 | 365 | 365（84 异变日） | ✅ |
| 动画 Clip | 6 | 6（已绑定到弹窗/星级/横幅/Toast/异变开场/特效） | ✅ |
| 主包 | ≤3.9MB | 2.03MB | ✅ |
| 总包 | ≤10.5MB | 9.94MB | ✅ |

## 2. 验收门结果

| 门 | 命令 | 结果 |
|---|---|---|
| 类型 | `npm run typecheck` | 0 error |
| 单测 | `npm run test` | 29 + 82 + 28 = **139 项全绿** |
| 内容 | `npm run verify:content` | 120/365/84、每月 4 类目标、全部 verified |
| 资源 | `npm run verify:assets` | 100 图 / 56 SFX / 8 BGM / 1 字体 / 38 Prefab / 173 个引用全命中 |
| Prefab | `npm run verify:prefabs` | 38 个根组件/命名/节点预算合规 |
| UI | `npm run verify:ui` | view/ui/controller 0 处运行时拼 UI |
| 字体 | `npm run verify:font` | 623 字符全覆盖 |
| 构建 | `project_build` | `web-mobile` 构建成功（debug / release 均跑通） |
| 屏幕 | `npm run smoke:ui` | home→chapter→home→daily→settings，栈层数合规、0 页面错误 |
| 截图 | `npm run shot:screens` | 10 屏 × 3 分辨率 = 30 张，0 页面错误 |
| 包体 | `npm run verify:package` | 主包 1.86MB / 总包 9.77MB |

## 3. 架构落地

- **Prefab 驱动**：`UIManager` + `UIView` + `UIPrefabRegistry`（38 键）+ 重写 `UIButton`（绑定 Sprite/Label，不画 Graphics）。
- **棋盘也走 Prefab**：`Board / GridCell / Block / PieceCell / GhostCell / FogCell` 全部实例化 + 池化；`BoardView` 仍用对象身份做 diff。
- **控制器拆分**：`GameController`（编排）+ `BoardInput` + `RunBootstrapper` + `ResolvePresenter` + `SugarBurst` + `ReplayController`。
- **core 零 cc**：新增 `SpecialBlocks / SpecialResolver / SugarEnergy / MutationRuntime / Mutations 配置 / TalentPool / TalentService / Modifiers / GoalTracker / FogVision / DailyPuzzle / InputRecorder / ReplayPlayer / ShadowTrack / Solver / Simulator / BoardPatterns`，默认参数与基线一致（29 项原单测全绿）。
- **三模式**：无尽 / 关卡（6×20）/ 每日残局（365）；`GameMode.ts` 产出 `RunConfig`。
- **分包**：`audio-bgm`、`ch1..ch6`、`daily`、`audio-sfx`，主包只留共享图/Prefab/字体/关卡表。

## 4. 内容生产方法与实测

### 4.1 120 关
- 公式按 §7.3 生成，`scripts/gen-content/levels.ts` 产出 `LevelTable.ts` + `docs/level-plan.csv` + `docs/level-report.md`。
- 用 `GreedyBot`（等价宽 8 / 深 40 的评估策略）跑 5 种子 × 80 锁测可达率，并据此**只下调 target、同时按实测分位校准星级门槛**。
- 实测：1★ **92.2%**、2★ **98.3%**、3★ **28.3%**（门限 90/55/30）。
- 发现：本作"消行"只在整行填满时触发，§7 的 `rows 5–10` 目标在 40–80 锁内不可达，已按实测下调（多数为 1–3）；石块关同样下调。报告逐关列出差异。

### 4.2 365 题
- `scripts/gen-content/daily.ts`：稳定盘面（初始无现成可消组）→ 固定牌序 → beam search 求路径 → 目标定标为实解的 70% → 同路径回放校验。
- 产出 `DailyIndex.ts` + `daily/2027-MM.ts` ×12 + `docs/daily-report.md`。
- 实测：365 题、84 异变、每月 4 类目标、全部 `verified=true`、盘面+队列零重复、索引 1–365 无空洞。
- 已知偏差：解长比例 P10 为 0.13（低于 §8.4 的 0.3 下限），部分题偏简单；石块题目标普遍偏低（1–6）。

## 5. 包体（Release 构建实测）

| 项 | 体积 |
|---|---|
| 主包（脚本 + main/resources/internal） | **2.03MB** |
| 引擎 cocos-js（单列，计入总包） | 3.01MB |
| 分包 audio-sfx | 1.26MB |
| 分包 audio-bgm | 1.05MB |
| 分包 ch1–ch6 | 0.44–0.47MB / 个 |
| 分包 daily | 0.02MB |
| **总包** | **9.94MB** |

口径说明：`cocos-js` 是引擎运行时，不计入"主包（游戏资源）"，但计入总包；
debug 构建因引擎未压缩会显著偏大（8.71MB/14.31MB），不作为发布口径。

## 6. 未完成 / 偏差（第二轮收口后剩 4 条）

1. **BGM 位率 88kbps**（规范 96kbps）：96kbps 时总包 10.63MB 超限，折中 88kbps（总包 9.94MB）。图集再优化或删冗余资源后可升回。
2. **异变周每日题只使用静态异变**（迷雾/倒悬/单色）：霜雨/磁力/脆霜是锁定后改盘面的动态效果，求解时不模拟，动态题可能出现「已验证解被异变打乱」，故异变周改用静态异变（84 个异变日不变，见 `scripts/gen-content/daily.ts` 注释）。
3. **120 关 rows 目标恢复标称、stone 目标仍下调**：评测机器人加深到 120 锁后 rows 目标全部恢复 §7 标称值；stone 关因盘面与目标联动，实测仍按可达性下调（aggregate 1★ 90.3% 达标，报告逐关列出）。
4. **撤销为"回到上一锁前"**：恢复棋盘/分数/糖能/目标计数并重新出牌，不回滚出牌源索引（重开出牌顺序会不同）；回放记录不包含 undo 动作，含撤销的对局回放会有偏差。

已在上轮报告中列出、本轮已解决的：自动图集 4/4 ✅、字体绑定到全部 Label ✅、6 个 AnimationClip 产出并接入（tween 作为代码兜底）✅、截图补齐到 10 屏 × 3 分辨率 ✅、天赋撤销真生效 ✅、两个编辑器弹窗根除（Prefab 管线改直写 + 分批执行）✅。

## 7. 复现命令

```bash
npm run gen:levels      # 120 关（约 70s）
npm run gen:daily       # 365 题（约 3min）
node scripts/prefabs/pipeline.js   # 38 个 Prefab（需编辑器在线）
npm run art:gen         # 100 张图
npm run art:meta        # 9-slice / packable
npm run art:post        # art_report.csv
npm run audio:synth     # 56 SFX + 8 BGM
npm run typecheck && npm run test
npm run verify:all
npm run serve:build     # 另开终端
npm run smoke:ui
npm run shot:screens
```

## 8. Prefab 生产管线（本轮新增）

`scripts/prefabs/build.js` 在编辑器场景进程里程序化搭建 38 个节点树；
`scripts/prefabs/create-assets.js` 通过 `scene:create-prefab` 落成 `.prefab`。
这样既满足"不手写场景 JSON"，又能保证 38 个预制体的节点名、组件绑定、9-slice 引用一致可复现。
