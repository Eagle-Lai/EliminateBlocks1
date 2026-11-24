# EliminateBlocks 项目长期记忆

Cocos Creator 3.8.8 休闲游戏「落块消消」（10×16 落块 + 同色连通消除）。规格见 `docs/tetris-match-cocos-prompt.md`，工程说明见 `README.md`。

## 硬约定

- **场景里序列化自定义组件必须用脚本 cid**（meta uuid 的压缩形式，23 字符），不能用 `@ccclass` 名。
  写类名会在预览/构建报 `Missing class: xxx`。
  - 取 cid 的最快办法：在构建产物 `build/web-mobile/assets/main/index.js` 里搜 `_RF.push(` 对应该脚本的那一行。
  - 追加组件时把对象**追加到 scene JSON 数组末尾**、`_components` 里加 `{"__id__": N}`，避免重排既有 `__id__`。
  - 验证：构建产物页面里 `cc.js.getClassById(cid)` + `cc.deserialize(场景JSON)`，比开编辑器快。
- **UI 一律走 `LayoutAdapter` 算出来的坐标与格子尺寸**，不写裸像素；`GameTuning` 里集中数值。
- **一个节点只能挂一个 UIRenderer**：底色/美术/兜底图各占独立子节点。
- **竖屏游戏 → 画布也必须竖屏**：项目设计分辨率 `750×1334 / fitWidth`（`settings/v2/packages/project.json`）；
  窗口比 750:1334 更宽/矮时用 `ContainerStrategy.PROPORTION_TO_FRAME` 把画布收成竖屏框居中，
  只有窗口本来就够高（手机）才用 `EQUAL_TO_FRAME` 铺满 + 设计高度跟随窗口。**不要把竖屏 UI 塞进横屏画布再靠 SHOW_ALL 留边**。
- **Canvas 节点上不要挂四边拉伸的 `cc.Widget`**：它按"设计分辨率"拉伸 Canvas，而设计分辨率只在编辑器启动时读取，
  改完 `settings/` 不重启就会把 Canvas 显示成旧尺寸（本次就表现为"Canvas 1280×720 横屏"）。
  现在 Canvas 固定 750×1334、位置 (375,667)，运行时由 `GameEntry._syncCanvas()` 按可视区域同步尺寸与位置。
  - 注意：`cc.Canvas` 的 "Align Canvas With Screen" 在**编辑器里**也会把节点对齐到设计分辨率 —— 所以 Canvas 显示成横的，
    除了 Widget，还可能是编辑器内存里的设计分辨率不对。
- **改编辑器状态优先走 MCP**：`npm run mcp:call -- <tool> '<json>'`（工具 72 个：`component_*`、`project_setting_set`、`scene_save`…）。
  `settings/`、`profiles/` 手改要重启，但 `project_setting_set` 是直接改内存+落盘、**立即生效**。
- **一个节点上重复挂同一组件会各自 onLoad**（本次 Canvas 上出现 5 个 `GameEntry`）：`GameEntry.onLoad` 已加"非首个自毁"的保护。
- **`settings/` 与 `profiles/` 都是编辑器启动时读**：改了要重启 Creator 才在设置面板/预览「Default 画布」里生效；
  预览页 canvas 尺寸 = 预览设备（Default = 设计分辨率），不是"窗口大小"。
- 三层底色必须同色（`THEME.bgEdge`）：页面背景（web）、相机清屏色、`BgFill` 兜底，否则任何一处都会露出"黑边"。

## 验证链路（改完必跑）

1. `npm run typecheck`（对照引擎真实 d.ts，现在 0 错）
2. `npm run test`（29 项纯逻辑单测）
3. 构建：`env -u ELECTRON_RUN_AS_NODE -u NODE_OPTIONS "<Creator>/CocosCreator.exe" --project <工程> --build "platform=web-mobile;debug=true"`
   - CLI 退出码 36 是常态，看日志里 `build Task (web-mobile) Finished` 判断成功。
4. `npm run serve:build` + `node scripts/shot-multi.cjs http://127.0.0.1:8123/`（多分辨率截图）；`npm run smoke`（玩法冒烟）

## 环境坑

- 编辑器常驻不关时改 `.ts`/`.scene`，asset-db 可能长时间不重编译；跑一次 CLI 构建（日志出现 `Asset DB is resume!`）后 preview target 才更新。要"立刻在编辑器看到效果"就重启编辑器。
- 编辑器内存里的场景可能比磁盘新（历史手写坏组件就是这样残留的）；磁盘干净但预览报 `Missing class` 时，先怀疑编辑器内存是旧场景，关掉重开 `Main.scene`。
- MCP：`extensions/ccreator-mcp`（127.0.0.1:3945）+ `scripts/mcp-check.cjs`；扩展只在编辑器启动时加载。
