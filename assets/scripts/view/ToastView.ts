/** 轻提示：Bg + Icon + Text，自动淡出。 */
import { _decorator, Label, Node, Sprite, Tween, UIOpacity, Vec3, tween } from 'cc';
import { UIView } from '../ui/UIView';
import { setLabel, setActive } from './ViewUtils';
import { TUNING } from '../config/GameTuning';
import { playClip } from '../utils/Anim';

const { ccclass, property } = _decorator;

@ccclass('ToastView')
export class ToastView extends UIView {
    @property(Node) bg: Node | null = null;
    @property(Sprite) icon: Sprite | null = null;
    @property(Label) textLabel: Label | null = null;

    private _seq = 0;

    show(text: string): void {
        this.node.active = true;
        setLabel(this.textLabel, text);
        setActive(this.icon?.node ?? null, false);
        this._seq++;
        const seq = this._seq;
        const bg = this.bg;
        if (!bg) return;
        const op = bg.getComponent(UIOpacity) || bg.addComponent(UIOpacity);
        Tween.stopAllByTarget(op);
        Tween.stopAllByTarget(bg);
        op.opacity = 0;
        bg.setScale(0.9, 0.9, 1);
        tween(op).to(0.14, { opacity: 255 }).start();
        playClip(bg, 'toast-in', () => {
            bg.setScale(0.9, 0.9, 1);
            tween(bg).to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        });
        tween(op)
            .delay(TUNING.feedback.toastMs / 1000)
            .to(0.2, { opacity: 0 })
            .call(() => {
                if (seq !== this._seq) return;
                this.close();
            })
            .start();
    }
}
