/** 背景上的晶光依次浮动；离开页面时停下并复位。 */
import { _decorator, Component, Node, Tween, tween, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('SceneGlimmers')
export class SceneGlimmers extends Component {
    @property(Node) comet: Node | null = null;
    private _origins: Vec3[] = [];

    onEnable(): void {
        this._origins = this.node.children.map(child => child.position.clone());
        this.node.children.forEach((child, i) => {
            const duration = 1.1 + i * 0.13;
            const rise = new Vec3(i % 2 ? 6 : -6, 5 + i, 0);
            const origin = this._origins[i];
            if (child === this.comet) {
                child.setScale(0, 0, 1);
                const middle = new Vec3(origin.x - 90, origin.y - 30);
                const end = new Vec3(origin.x - 260, origin.y - 87);
                tween(child).delay(0.8).repeatForever(tween<Node>()
                    .set({ position: origin, scale: new Vec3(0, 0, 1) })
                    .to(0.38, { position: middle, scale: Vec3.ONE }, { easing: 'sineIn' })
                    .to(0.72, { position: end, scale: new Vec3(0, 0, 1) }, { easing: 'sineOut' })
                    .delay(4.8)
                ).start();
                return;
            }
            child.setScale(0.3, 0.3, 1);
            tween(child).delay(i * 0.23).repeatForever(tween<Node>()
                .to(duration, { position: Vec3.add(new Vec3(), origin, rise), angle: 24, scale: Vec3.ONE }, { easing: 'sineInOut' })
                .to(duration, { position: origin, angle: -12, scale: new Vec3(0.3, 0.3, 1) }, { easing: 'sineInOut' })
                .delay(0.25 + i * 0.08)
            ).start();
        });
    }

    onDisable(): void {
        this.node.children.forEach((child, i) => {
            Tween.stopAllByTarget(child);
            if (this._origins[i]) child.setPosition(this._origins[i]);
            child.setScale(1, 1, 1);
            if (child !== this.comet) child.angle = 0;
        });
    }
}
