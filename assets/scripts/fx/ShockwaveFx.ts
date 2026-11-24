/** 炸弹/十字冲击波：环扩散 + 淡出。 */
import { _decorator, Component, Sprite, UIOpacity, Vec3, tween } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ShockwaveFx')
export class ShockwaveFx extends Component {
    @property(Sprite) ring: Sprite | null = null;

    play(durationMs = 320): Promise<void> {
        return new Promise((resolve) => {
            const op = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
            op.opacity = 255;
            this.node.setScale(0.3, 0.3, 1);
            tween(this.node)
                .to(durationMs / 1000, { scale: new Vec3(1.8, 1.8, 1) }, { easing: 'quadOut' })
                .start();
            tween(op)
                .to(durationMs / 1000, { opacity: 0 })
                .call(() => resolve())
                .start();
        });
    }
}
