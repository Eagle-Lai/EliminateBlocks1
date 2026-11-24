/**
 * 主题配置（马卡龙果冻 / 糖果亮色）。
 * 所有颜色、圆角、字号集中在此，换肤只需替换本文件的 token 与 art 图集路径。
 */
import { Color } from 'cc';

export const THEME = {
    /** 设计基准底色（UI 卡片/弹窗的参考色；铺底实际用 bgEdge，与背景图边缘衔接） */
    bgSolid: new Color(255, 247, 236, 255),
    /** 背景图边缘主色：窗口宽高比与设计不一致时用它填满留边，避免露出黑边 */
    bgEdge: new Color(246, 230, 211, 255),
    /** 卡片底色 */
    card: new Color(255, 255, 255, 236),
    cardBorder: new Color(240, 220, 196, 255),
    /** 棋盘托盘 */
    boardTray: new Color(255, 243, 226, 255),
    boardTrayBorder: new Color(233, 209, 178, 255),
    /** 空格 */
    emptyCell: new Color(247, 233, 213, 255),
    textPrimary: new Color(59, 42, 31, 255),
    textSecondary: new Color(139, 115, 85, 255),
    textOnDark: new Color(255, 252, 245, 255),
    /** 主按钮 */
    primary: new Color(78, 203, 138, 255),
    primaryPressed: new Color(63, 181, 119, 255),
    primaryShadow: new Color(46, 143, 94, 255),
    /** 次按钮 */
    secondary: new Color(255, 255, 255, 240),
    secondaryBorder: new Color(233, 209, 178, 255),
    /** 强调 */
    accent: new Color(255, 177, 58, 255),
    danger: new Color(255, 107, 91, 255),
    /** 虚影 */
    ghost: new Color(255, 255, 255, 90),
    /** 遮罩 */
    mask: new Color(26, 18, 8, 153),
    /** 进度条 */
    progressTrack: new Color(243, 228, 207, 255),
    progressFill: new Color(78, 203, 138, 255),
    /** 五色方块（与原型一致，保证辨识度） */
    blockColors: [
        new Color(255, 107, 91, 255),
        new Color(240, 178, 58, 255),
        new Color(78, 203, 138, 255),
        new Color(74, 157, 240, 255),
        new Color(169, 123, 240, 255),
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
    fontFamily: 'PingFang SC',
} as const;

export type ThemeType = typeof THEME;
