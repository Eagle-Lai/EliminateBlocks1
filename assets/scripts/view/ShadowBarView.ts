/** 影子线：Track / Current / Shadow / OvertakeFx（金色脉冲一次）。 */
import { _decorator, Node, Sprite, UITransform, Vec3, tween } from 'cc';
import { UIView } from '../ui/UIView';
import { setActive } from './ViewUtils';
import { TUNING } from '../config/GameTuning';

const { ccclass, property } = _decorator;

@ccclass('ShadowBarView')
export class ShadowBarView extends UIView {
    @property(Sprite) track: Sprite | null = null;
    @property(Node) current: Node | null = null;
    @property(Node) shadow: Node | null = null;
    @property(Node) overtakeFx: Node | null = null;

    private _pulsed = false;

    onOpen(): void {
        this.hide();
        this._pulsed = false;
    }

    show(): void {
        setActive(this.node, true);
    }

    hide(): void {
        setActive(this.node, false);
    }

    setProgress(current: number, shadow: number): void {
        const ut = this.track ? this.track.node.getComponent(UITransform) : null;
        const width = ut ? ut.width : TUNING.ui.shadowBarFallbackW;
        const cx = -width / 2 + Math.max(0, Math.min(1, current)) * width;
        const sx = -width / 2 + Math.max(0, Math.min(1, shadow)) * width;
        if (this.current) this.current.setPosition(cx, 0, 0);
        if (this.shadow) this.shadow.setPosition(sx, 0, 0);
    }

    pulse(): void {
        if (this._pulsed || !this.overtakeFx) return;
        this._pulsed = true;
        this.overtakeFx.active = true;
        this.overtakeFx.setScale(0.6, 0.6, 1);
        tween(this.overtakeFx)
            .to(0.25, { scale: new Vec3(1.4, 1.4, 1) })
            .to(0.2, { scale: new Vec3(1, 1, 1) })
            .call(() => setActive(this.overtakeFx, false))
            .start();
    }

    reset(): void {
        this._pulsed = false;
        if (this.overtakeFx) this.overtakeFx.active = false;
    }
}
