/** 按钮皮肤表：4 种常态皮 + 关闭按钮；按下/禁用由 Sprite.color 派生，不额外出图。 */
import { Color } from 'cc';
import { ART } from './AssetKeys';

export type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'icon' | 'close' | 'tab';

export interface ButtonSkin {
    frame: string;
    textColor: Color;
    /** 是否启用 9-slice */
    sliced: boolean;
}

export const BUTTON_SKINS: Record<ButtonKind, ButtonSkin> = {
    primary: { frame: ART.ui.btnPrimary, textColor: new Color(255, 252, 245, 255), sliced: true },
    secondary: { frame: ART.ui.btnSecondary, textColor: new Color(59, 42, 31, 255), sliced: true },
    ghost: { frame: ART.ui.btnGhost, textColor: new Color(139, 115, 85, 255), sliced: true },
    icon: { frame: ART.ui.btnIcon, textColor: new Color(59, 42, 31, 255), sliced: false },
    close: { frame: ART.ui.btnClose, textColor: new Color(59, 42, 31, 255), sliced: false },
    tab: { frame: ART.ui.btnSecondary, textColor: new Color(139, 115, 85, 255), sliced: true },
};

export const BUTTON_FRAME_PATHS: readonly string[] = [
    BUTTON_SKINS.primary.frame,
    BUTTON_SKINS.secondary.frame,
    BUTTON_SKINS.ghost.frame,
    BUTTON_SKINS.icon.frame,
    BUTTON_SKINS.close.frame,
    BUTTON_SKINS.tab.frame,
];

export const PRESSED_COLOR = new Color(226, 226, 226, 255);
export const DISABLED_COLOR = new Color(190, 190, 190, 255);
