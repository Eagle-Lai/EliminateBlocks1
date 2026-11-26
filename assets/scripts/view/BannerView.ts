/** 横幅：同色 xN / 连锁 xN / 整行 / LEVEL UP（排队，最多 3 条）。 */
import { _decorator, Label, Node, Sprite, Tween, UIOpacity, Vec3, tween } from 'cc';
import { UIView } from '../ui/UIView';
import { setLabel } from './ViewUtils';
import { playClip } from '../utils/Anim';
import { TUNING } from '../config/GameTuning';
import { THEME } from '../config/ThemeConfig';

const { ccclass, property } = _decorator;

export type BannerKind = 'combo' | 'chain' | 'row' | 'level';

@ccclass('BannerView')
export class BannerView extends UIView {
    @property(Node) panel: Node | null = null;
    @property(Label) label: Label | null = null;
    @property(Sprite) bg: Sprite | null = null;

    private _queue: Array<{ text: string; kind: BannerKind }> = [];
    private _playing = false;

    onOpen(): void {
        this.node.active = false;
    }

    show(text: string, kind: BannerKind = 'combo'): void {
        this._queue.push({ text, kind });
        if (this._queue.length > 3) this._queue.shift();
        if (!this._playing) this._next();
    }

    private _next(): void {
        const item = this._queue.shift();
        if (!item) {
            this._playing = false;
            this.node.active = false;
            return;
        }
        this._playing = true;
        this.node.active = true;
        setLabel(this.label, item.text);
        if (this.bg) {
            this.bg.color =
                item.kind === 'level'
                    ? THEME.bannerLevel
                    : item.kind === 'row'
                      ? THEME.bannerRow
                      : THEME.bannerCombo;
        }
        if (!this.panel) { this.clear(); return; }

        const op = this.panel.getComponent(UIOpacity) || this.panel.addComponent(UIOpacity);
        op.opacity = 0;
        this.panel.setScale(0.9, 0.9, 1);
        tween(op).to(0.14, { opacity: 255 }).start();
        playClip(this.panel, 'banner-in', () => {
            this.panel!.setScale(0.9, 0.9, 1);
            tween(this.panel!).to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        });

        tween(op).delay(TUNING.feedback.bannerMs / 1000).to(0.18, { opacity: 0 })
            .call(() => this._next()).start();
    }

    clear(): void {
        const op = this.panel?.getComponent(UIOpacity);
        if (op) Tween.stopAllByTarget(op);
        if (this.panel) Tween.stopAllByTarget(this.panel);
        this._queue.length = 0;
        this._playing = false;
        this.node.active = false;
    }
}
