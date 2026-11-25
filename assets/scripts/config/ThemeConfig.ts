/**
 * 主题配置（v3「莓果奶霜」：莓粉主色 / 粉紫冷调 / 蜜金强调 / 雪白卡片）。
 * 所有颜色、圆角、字号集中在此：prefab 里烤死的数值以本文件为唯一参考标准，
 * 运行时颜色一律引用本文件，不得在业务代码里 new Color 硬编码。
 * 换肤只需替换本文件的 token 与 art 图集路径（美术由 scripts/art/gen_art.py 同步生成）。
 *
 * ── 字体阶梯（prefab fontSize 以此为准，lineHeight = fontSize × 1.25）──
 *   display 72  弹窗大分数（Dialog.Score）
 *   hudScore 38 32  对局 HUD 大数值（Score/Level，游戏内特例）
 *   title   34  页面/弹窗标题（Home CTA 同级 34）
 *   btnL    30  主按钮文字
 *   btnS    24  次/ghost 按钮文字、Toast、Banner、返回按钮
 *   body    20  面板小标题、月/目标等强调小字
 *   small   18  进度说明、标签、关卡号
 *   caption 16  HUD 卡片标题、目标值、状态行
 *   micro   12  Tab 星数、日历格状态
 * ── 按钮尺寸档 ──
 *   Hero CTA 420×110/100（首页主区）· 主按钮 420~500×88~96 · 次/ghost 300~420×72 · 返回 160×72
 */
import { Color } from 'cc';

export const THEME = {
    /** 设计基准底色（UI 卡片/弹窗的参考色；铺底实际用 bgEdge，与背景图边缘衔接） */
    bgSolid: new Color(255, 250, 253, 255),
    /** 背景图边缘主色：窗口宽高比与设计不一致时用它填满留边，避免露出黑边 */
    bgEdge: new Color(240, 222, 238, 255),
    /** 卡片底色 */
    card: new Color(255, 255, 255, 236),
    cardBorder: new Color(244, 214, 230, 255),
    /** 棋盘托盘 */
    boardTray: new Color(255, 246, 250, 255),
    boardTrayBorder: new Color(240, 214, 228, 255),
    /** 空格 */
    emptyCell: new Color(250, 236, 244, 255),
    textPrimary: new Color(74, 48, 62, 255),
    textSecondary: new Color(154, 116, 136, 255),
    textOnDark: new Color(255, 250, 253, 255),
    /** 主按钮（莓粉） */
    primary: new Color(255, 92, 138, 255),
    primaryPressed: new Color(235, 74, 120, 255),
    primaryShadow: new Color(196, 52, 94, 255),
    /** 次按钮 */
    secondary: new Color(255, 255, 255, 240),
    secondaryBorder: new Color(240, 214, 228, 255),
    /** 强调金（星星/虚影边/糖爆飘分/Banner 金字，全项目唯一金色，跨皮肤保留） */
    accent: new Color(255, 196, 64, 255),
    /** 强调金·半透明（虚影描边等叠加用） */
    accentSoft: new Color(255, 196, 64, 210),
    /** 按钮选中态底色（tab/色块选中） */
    selected: new Color(255, 240, 248, 255),
    danger: new Color(240, 84, 74, 255),
    /** 虚影 */
    ghost: new Color(255, 255, 255, 90),
    /** 遮罩 */
    mask: new Color(30, 16, 24, 153),
    /** 进度条 */
    progressTrack: new Color(243, 230, 240, 255),
    progressFill: new Color(255, 92, 138, 255),
    /** 横幅（同色 xN / 连锁用墨色，整行用蓝莓蓝，升级用薄荷绿） */
    bannerLevel: new Color(62, 205, 168, 235),
    bannerRow: new Color(88, 150, 255, 235),
    bannerCombo: new Color(74, 48, 62, 232),
    /** 五色方块（莓果奶霜，保证五色辨识度） */
    blockColors: [
        new Color(255, 92, 138, 255),
        new Color(255, 176, 66, 255),
        new Color(62, 205, 168, 255),
        new Color(88, 150, 255, 255),
        new Color(168, 120, 244, 255),
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
    /**
     * 字体族参考值。内置 Label 当前使用引擎默认字体（prefab 中为 Arial），
     * 接入自定义字体资产（assets/resources/font）后统一替换；该 token 暂作规范记录。
     */
    fontFamily: 'PingFang SC',
} as const;

export type ThemeType = typeof THEME;
