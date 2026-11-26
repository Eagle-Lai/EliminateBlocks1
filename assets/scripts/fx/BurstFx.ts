/** 消除碎片/星光特效：实例化后自转+放大+淡出，然后回池。 */
import { _decorator, ParticleSystem2D, Sprite, UIOpacity, Vec3, tween } from 'cc';
import { Component } from 'cc';
import { playClip } from '../utils/Anim';

const { ccclass, property } = _decorator;

@ccclass('BurstFx')
export class BurstFx extends Component {
    @property(Sprite) spark: Sprite | null = null;
    @property(ParticleSystem2D) shards: ParticleSystem2D | null = null;

    play(durationMs = 260): Promise<void> {
        this.shards?.resetSystem();
        return new Promise((resolve) => {
            const op = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
            op.opacity = 255;
            playClip(this.node, 'burst', () => {
                this.node.setScale(0.6, 0.6, 1);
                tween(this.node)
                    .to(durationMs / 1000, { scale: new Vec3(1.3, 1.3, 1) }, { easing: 'quadOut' })
                    .start();
            });
            tween(op)
                .to(durationMs / 1000, { opacity: 0 })
                .call(() => resolve())
                .start();
        });
    }
}
