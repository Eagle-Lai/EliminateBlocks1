/** 星级行：3 个 Sprite，逐颗弹入。 */
import { _decorator, isValid, Node, Sprite, Vec3, tween } from 'cc';
import { playClip } from '../utils/Anim';
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

    /** 作为子节点嵌在 Dialog 里时 UIManager 不会调 onOpen，这里兜底加载星星图 */
    onLoad(): void {
        this._loadFrames();
    }

    private _loading = false;

    private _loadFrames(): void {
        if (this._loading || (this._frames.filled && this._frames.empty)) return;
        this._loading = true;
        const cachedFilled = assets.getFrame(ART.icon('star_filled'));
        const cachedEmpty = assets.getFrame(ART.icon('star_empty'));
        if (cachedFilled) this._frames.filled = cachedFilled;
        if (cachedEmpty) this._frames.empty = cachedEmpty;
        void Promise.all([
            assets.loadSpriteFrame(ART.icon('star_filled')),
            assets.loadSpriteFrame(ART.icon('star_empty')),
        ]).then(([filled, empty]) => {
            if (!isValid(this, true)) return;
            this._frames.filled = filled ?? this._frames.filled;
            this._frames.empty = empty ?? this._frames.empty;
            this._loading = false;
            this.redraw();
        });
    }

    private _stars(): Array<Sprite | null> {
        return [this.star1, this.star2, this.star3];
    }

    setStars(count: number): void {
        this._loadFrames();
        this._count = Math.max(0, Math.min(3, count));
        this.redraw();
        playClip(this.node, 'star-pop', () => {
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
