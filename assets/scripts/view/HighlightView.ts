/** 列高亮 / 提示：Border + Fill。 */
import { _decorator, Sprite, UIOpacity, Vec3, tween } from 'cc';
import { UIView } from '../ui/UIView';

const { ccclass, property } = _decorator;

@ccclass('HighlightView')
export class HighlightView extends UIView {
    @property(Sprite) border: Sprite | null = null;
    @property(Sprite) fill: Sprite | null = null;

    flash(durationMs = 300): void {
        const op = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
        this.node.active = true;
        op.opacity = 0;
        tween(op)
            .to(durationMs / 2000, { opacity: 255 })
            .to(durationMs / 2000, { opacity: 0 })
            .call(() => {
                this.node.active = false;
            })
            .start();
        this.node.setScale(0.96, 1, 1);
        tween(this.node).to(durationMs / 1000, { scale: new Vec3(1, 1, 1) }).start();
    }
}
