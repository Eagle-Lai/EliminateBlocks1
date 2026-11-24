/** 菜单共用背景：BgFill / BgArt / Vignette（换图不换结构）。 */
import { _decorator, Sprite, SpriteFrame } from 'cc';
import { UIView } from '../ui/UIView';
import { assets } from '../service/AssetService';

const { ccclass, property } = _decorator;

@ccclass('BackgroundView')
export class BackgroundView extends UIView {
    @property(Sprite) bgFill: Sprite | null = null;
    @property(Sprite) bgArt: Sprite | null = null;
    @property(Sprite) vignette: Sprite | null = null;

    onOpen(data?: unknown): void {
        const path = typeof data === 'string' ? data : null;
        if (path) this.setFrame(path);
    }

    setFrame(path: string): void {
        assets.loadSpriteFrame(path).then((sf: SpriteFrame | null) => {
            if (sf && this.bgArt && this.bgArt.isValid) this.bgArt.spriteFrame = sf;
        });
    }
}
