/** 横幅：同色 xN / 连锁 xN / 整行 / LEVEL UP（排队，最多 3 条）。 */
import { _decorator, Color, Label, Node, Sprite, UIOpacity, Vec3, tween } from 'cc';
import { UIView } from '../ui/UIView';
import { setLabel } from './ViewUtils';
import { TUNING } from '../config/GameTuning';

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
        if (!this._playing) void this._next();
    }

    private async _next(): Promise<void> {
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
                    ? new Color(78, 203, 138, 235)
                    : item.kind === 'row'
                      ? new Color(74, 157, 240, 235)
                      : new Color(59, 42, 31, 232);
        }
        if (!this.panel) return;

        const op = this.panel.getComponent(UIOpacity) || this.panel.addComponent(UIOpacity);
        op.opacity = 0;
        this.panel.setScale(0.9, 0.9, 1);
        tween(op).to(0.14, { opacity: 255 }).start();
        tween(this.panel).to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();

        await new Promise<void>((resolve) => setTimeout(resolve, TUNING.feedback.bannerMs));
        await new Promise<void>((resolve) => {
            tween(op).to(0.18, { opacity: 0 }).call(() => resolve()).start();
        });
        await this._next();
    }

    clear(): void {
        this._queue.length = 0;
        this._playing = false;
        this.node.active = false;
    }
}
