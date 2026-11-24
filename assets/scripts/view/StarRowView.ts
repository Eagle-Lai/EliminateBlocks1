/** 星级行：3 个 Sprite，逐颗弹入。 */
import { _decorator, Node, Sprite, Vec3, tween } from 'cc';
import { UIView } from '../ui/UIView';
import { assets } from '../service/AssetService';
import { ART } from '../config/AssetKeys';
import { TUNING } from '../config/GameTuning';

const { ccclass, property } = _decorator;

@ccclass('StarRowView')
export class StarRowView extends UIView {
    @property(Sprite) star1: Sprite | null = null;
    @property(Sprite) star2: Sprite | null = null;
    @property(Sprite) star3: Sprite | null = null;

    private _frames: { filled: unknown; empty: unknown } = { filled: null, empty: null };

    onOpen(): void {
        this.assertRefs([
            ['star1', this.star1],
            ['star2', this.star2],
            ['star3', this.star3],
        ]);
        this._loadFrames();
    }

    private _loadFrames(): void {
        assets.loadSpriteFrame(ART.icon('star_filled')).then((sf) => {
            this._frames.filled = sf;
            this.redraw();
        });
        assets.loadSpriteFrame(ART.icon('star_empty')).then((sf) => {
            this._frames.empty = sf;
            this.redraw();
        });
    }

    private _stars(): Array<Sprite | null> {
        return [this.star1, this.star2, this.star3];
    }

    setStars(count: number): void {
        this._count = Math.max(0, Math.min(3, count));
        this.redraw();
        const list = this._stars().filter((s): s is Sprite => !!s);
        list.forEach((sprite, i) => {
            if (i >= this._count) return;
            const node: Node = sprite.node;
            node.setScale(0.2, 0.2, 1);
            tween(node)
                .delay(i * (TUNING.feedback.starPopMs / 1000))
                .to(0.18, { scale: new Vec3(1.15, 1.15, 1) }, { easing: 'backOut' })
                .to(0.1, { scale: new Vec3(1, 1, 1) })
                .start();
        });
    }

    private _count = 0;

    private redraw(): void {
        const list = this._stars();
        list.forEach((sprite, i) => {
            if (!sprite) return;
            const frame = i < this._count ? this._frames.filled : this._frames.empty;
            if (frame) sprite.spriteFrame = frame as never;
        });
    }
}
