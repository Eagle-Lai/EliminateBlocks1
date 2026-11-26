/**
 * 按钮皮肤表 v4「极光糖晶」：立体厚边按钮 + 玻璃卡片按钮。
 * 按下 = 压暗 + 下沉缩放；禁用 = 半透明 + 灰化；选中 = 换成 selectedFrame（无则染 THEME.selected）。
 */
import { Color } from 'cc';
import { ART } from './AssetKeys';
import { THEME } from './ThemeConfig';

/** tile：列表格子（关卡格/日历格/天赋卡），玻璃卡底，内部文字由 Prefab 负责。 */
export type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'icon' | 'close' | 'tab' | 'tile';

export interface ButtonSkin {
    frame: string;
    textColor: Color;
    /** 是否启用 9-slice */
    sliced: boolean;
    /** 文字描边（立体按钮上的白字需要同色系深描边） */
    outline?: { color: Color; width: number };
    /** 选中态换皮（tab） */
    selectedFrame?: string;
    /** 立体按钮唇边高度：文字上移一半，保证视觉居中 */
    lipOffset?: number;
}

export const BUTTON_SKINS: Record<ButtonKind, ButtonSkin> = {
    primary: {
        frame: ART.ui.btnPrimary,
        textColor: THEME.textOnDark,
        sliced: true,
        outline: { color: THEME.primaryOutline, width: 3 },
        lipOffset: 4,
    },
    secondary: {
        frame: ART.ui.btnSecondary,
        textColor: THEME.textOnDark,
        sliced: true,
        outline: { color: THEME.secondaryOutline, width: 3 },
        lipOffset: 4,
    },
    ghost: { frame: ART.ui.btnGhost, textColor: THEME.ghostText, sliced: true, lipOffset: 4 },
    icon: { frame: ART.ui.btnIcon, textColor: THEME.textOnDark, sliced: false, outline: { color: THEME.iconOutline, width: 2 }, lipOffset: 3 },
    close: { frame: ART.ui.btnClose, textColor: THEME.textOnDark, sliced: false, lipOffset: 3 },
    tab: { frame: ART.ui.panelCard, textColor: THEME.textOnDark, sliced: true, selectedFrame: ART.ui.btnSecondary },
    tile: { frame: ART.ui.panelCard, textColor: THEME.textOnDark, sliced: true },
};

export const BUTTON_FRAME_PATHS: readonly string[] = [
    BUTTON_SKINS.primary.frame,
    BUTTON_SKINS.secondary.frame,
    BUTTON_SKINS.ghost.frame,
    BUTTON_SKINS.icon.frame,
    BUTTON_SKINS.close.frame,
    BUTTON_SKINS.tab.frame,
    BUTTON_SKINS.tile.frame,
];

/** 按下压暗（Sprite.color 乘色） */
export const PRESSED_COLOR = new Color(214, 214, 230, 255);
export const DISABLED_COLOR = new Color(170, 166, 190, 255);
