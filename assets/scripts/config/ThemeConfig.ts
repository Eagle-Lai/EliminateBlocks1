/**
 * 主题配置 v4「极光糖晶 Aurora Jelly」：深靛紫极光背景 / 宝石果冻方块 / 立体厚边按钮 / 玻璃卡片 + 奶白弹窗。
 * 所有颜色、描边、字号集中在此：prefab 里烤死的数值以本文件为唯一参考标准（由 scripts/ui/restyle-v4.py 落盘），
 * 运行时颜色一律引用本文件，不得在业务代码里 new Color 硬编码。
 * 换肤只需替换本文件的 token 与 art 图集（美术由 scripts/art/gen_art.py 同步生成）。
 *
 * ── 两套「表面」与对应文字色（决定所有 Label 用哪组颜色）──
 *   深色表面（背景 / 遮罩 / 玻璃卡 panel_card / 胶囊条）→ textOnDark + textOnDarkSoft，标题加 outlineDark 描边
 *   浅色表面（奶白弹窗 panel_popup / ghost 按钮）       → textPrimary + textSecondary
 * ── 字体阶梯（Noto Sans SC 子集 game_sc.ttf，lineHeight = fontSize × 1.25）──
 *   display 72  弹窗大分数（金色 + 深描边）
 *   hero    56  首页游戏名
 *   hudScore 38 32  对局 HUD 大数值
 *   title   34  页面/弹窗标题
 *   btnL    30  主按钮文字
 *   btnS    24  次/ghost 按钮文字、Toast、Banner、返回按钮
 *   body    20  面板小标题、强调小字
 *   small   18  进度说明、标签、关卡号
 *   caption 16  HUD 卡片标题、状态行
 *   micro   12  Tab 星数、日历格状态
 * ── 按钮尺寸档（立体按钮底部 10px 唇边，文字视觉中心上移 4px）──
 *   Hero CTA 420×110/100 · 主按钮 420~500×88~96 · 次/ghost 300~420×72 · 返回 160×72 · 图标钮 56~80 圆
 */
import { Color } from 'cc';

export const THEME = {
    /** 设计基准底色（深色表面参考色） */
    bgSolid: new Color(32, 22, 90, 255),
    /** 背景图边缘主色：窗口比例与设计不一致时填满留边 / 相机清屏色 / 网页底色 */
    bgEdge: new Color(40, 26, 100, 255),
    /** 玻璃卡（panel_card 原图已含半透明，这里保持白色不染） */
    card: new Color(255, 255, 255, 255),
    cardBorder: new Color(255, 255, 255, 90),
    /** 棋盘托盘 / 空格（原图已着色） */
    boardTray: new Color(255, 255, 255, 255),
    boardTrayBorder: new Color(150, 130, 255, 120),
    emptyCell: new Color(255, 255, 255, 255),

    /** 浅色表面文字 */
    textPrimary: new Color(40, 30, 90, 255),
    textSecondary: new Color(112, 100, 160, 255),
    /** 深色表面文字 */
    textOnDark: new Color(255, 255, 255, 255),
    textOnDarkSoft: new Color(200, 190, 255, 255),
    /** 深色表面标题/大数字描边 */
    outlineDark: new Color(34, 20, 78, 255),

    /** 主按钮（阳光金橙） */
    primary: new Color(255, 176, 40, 255),
    primaryPressed: new Color(230, 140, 24, 255),
    primaryShadow: new Color(214, 120, 20, 255),
    primaryOutline: new Color(178, 84, 8, 255),
    /** 次按钮（天空蓝） */
    secondary: new Color(70, 150, 245, 255),
    secondaryBorder: new Color(34, 78, 186, 255),
    secondaryOutline: new Color(28, 66, 160, 255),
    /** ghost 按钮文字（浅紫底） */
    ghostText: new Color(84, 60, 170, 255),
    /** 图标按钮（葡萄紫）描边 */
    iconOutline: new Color(56, 30, 140, 255),

    /** 强调金（星星/金币/金框/大分数，全项目唯一金色） */
    accent: new Color(255, 200, 56, 255),
    /** 强调金·半透明（叠加用） */
    accentSoft: new Color(255, 200, 56, 210),
    /** 大分数描边（金字深橙边） */
    accentOutline: new Color(150, 70, 10, 255),
    /** 选中态：玻璃卡选中用蓝色按钮皮（见 ButtonSkinTable.tab.selectedFrame），此色作兜底染色 */
    selected: new Color(190, 220, 255, 255),
    danger: new Color(255, 84, 112, 255),

    /** 落点虚影：填充 alpha / 描边 alpha（颜色取骨牌色） */
    ghostFillAlpha: 70,
    ghostBorderAlpha: 235,
    /** 旧口径（白色虚影），保留给兜底 */
    ghost: new Color(255, 255, 255, 90),

    /** 遮罩（深靛，压暗 70%） */
    mask: new Color(12, 6, 40, 186),
    /** 胶囊条（Toast / 标签 / 雾格）深色底 */
    strip: new Color(22, 14, 64, 225),
    /** 进度条 */
    progressTrack: new Color(14, 8, 44, 190),
    progressFill: new Color(255, 200, 56, 255),
    /** 糖能轨（热粉） */
    sugarFill: new Color(255, 96, 170, 255),
    /** 影子线：当前 / 影子 */
    shadowCurrent: new Color(255, 200, 56, 255),
    shadowGhost: new Color(176, 120, 255, 210),

    /** 横幅（白字深描边；底色：升级=翡翠、整行=蓝宝、同色/连锁=琥珀） */
    bannerLevel: new Color(40, 200, 140, 245),
    bannerRow: new Color(58, 140, 255, 245),
    bannerCombo: new Color(255, 128, 40, 245),
    bannerText: new Color(255, 255, 255, 255),
    bannerOutline: new Color(30, 16, 70, 255),

    /** 飘分：普通消除 / 糖爆 */
    floatScore: new Color(255, 255, 255, 255),
    floatOutline: new Color(34, 20, 78, 255),

    /** 五色方块（宝石果冻；色相与 v1~v3 一致：粉/橙/绿/蓝/紫） */
    blockColors: [
        new Color(255, 78, 140, 255),
        new Color(255, 158, 36, 255),
        new Color(40, 210, 140, 255),
        new Color(58, 148, 255, 255),
        new Color(172, 96, 255, 255),
    ],
    /** 方块高光/暗边 */
    blockHighlight: new Color(255, 255, 255, 72),
    blockShade: new Color(0, 0, 0, 30),
    /** 资源路径（相对 assets/resources/） */
    art: {
        bg: 'art/bg/bg_home',
        blocks: [
            'art/blocks/block_0',
            'art/blocks/block_1',
            'art/blocks/block_2',
            'art/blocks/block_3',
            'art/blocks/block_4',
        ],
    },
    /** 字体：assets/resources/font/game_sc.ttf（Noto Sans SC 子集，OFL），所有 Prefab Label 已引用 */
    fontFamily: 'Noto Sans SC',
} as const;

export type ThemeType = typeof THEME;
