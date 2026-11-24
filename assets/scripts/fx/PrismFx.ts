/** 棱镜染色波纹：多彩环扩散。 */
import { _decorator, Component, Sprite, UIOpacity, Vec3, tween } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('PrismFx')
export class PrismFx extends Component {
    @property(Sprite) wave: Sprite | null = null;

    play(durationMs = 420): Promise<void> {
        return new Promise((resolve) => {
            const op = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
            op.opacity = 220;
            this.node.setScale(0.5, 0.5, 1);
            tween(this.node)
                .to(durationMs / 1000, { scale: new Vec3(1.6, 1.6, 1) }, { easing: 'sineOut' })
                .start();
            tween(op)
                .to(durationMs / 1000, { opacity: 0 })
                .call(() => resolve())
                .start();
        });
    }
}
