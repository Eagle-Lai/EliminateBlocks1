/** 霜降/脆霜碎屑：下落 + 淡出。 */
import { _decorator, Component, Sprite, UIOpacity, Vec3, tween } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('FrostFx')
export class FrostFx extends Component {
    @property(Sprite) flake: Sprite | null = null;

    play(durationMs = 380): Promise<void> {
        return new Promise((resolve) => {
            const op = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
            op.opacity = 235;
            this.node.setScale(1, 1, 1);
            tween(this.node)
                .by(durationMs / 1000, { position: new Vec3(0, -60, 0) }, { easing: 'quadIn' })
                .start();
            tween(op)
                .to(durationMs / 1000, { opacity: 0 })
                .call(() => resolve())
                .start();
        });
    }
}
