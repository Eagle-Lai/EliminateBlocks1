/** 飘分：8 个 Prefab Label 循环复用，运行时零节点创建。 */
import { _decorator, Color, Label, Node, UIOpacity, Vec3, tween } from 'cc';
import { UIView } from '../ui/UIView';
import { TUNING } from '../config/GameTuning';

const { ccclass, property } = _decorator;

interface Slot {
    node: Node;
    label: Label | null;
    opacity: UIOpacity | null;
    busy: boolean;
}

@ccclass('FloatTextView')
export class FloatTextView extends UIView {
    @property(Node) slotRoot: Node | null = null;

    private _slots: Slot[] = [];
    private _index = 0;

    onOpen(): void {
        this._slots = [];
        if (!this.slotRoot) return;
        for (let i = 0; i < this.slotRoot.children.length; i++) {
            const node = this.slotRoot.children[i];
            node.active = false;
            this._slots.push({
                node,
                label: node.getComponent(Label),
                opacity: node.getComponent(UIOpacity),
                busy: false,
            });
        }
    }

    spawn(text: string, pos: Vec3, color: Color): void {
        if (this._slots.length === 0) return;
        let slot = this._slots.find((s) => !s.busy);
        if (!slot) {
            slot = this._slots[this._index % this._slots.length];
            this._index++;
        }
        if (!slot) return;

        slot.busy = true;
        slot.node.active = true;
        slot.node.setPosition(pos);
        if (slot.label) {
            slot.label.string = text;
            slot.label.color = color;
        }
        slot.node.setScale(0.8, 0.8, 1);
        if (slot.opacity) slot.opacity.opacity = 255;

        const rise = TUNING.fx.floatRisePx;
        tween(slot.node).to(0.12, { scale: new Vec3(1.05, 1.05, 1) }, { easing: 'backOut' }).start();
        tween(slot.node)
            .by(TUNING.fx.popDurationMs / 1000, { position: new Vec3(0, rise, 0) }, { easing: 'quadOut' })
            .start();
        if (slot.opacity) {
            tween(slot.opacity)
                .delay(0.18)
                .to(TUNING.fx.popDurationMs / 1000 - 0.18, { opacity: 0 })
                .call(() => {
                    slot!.node.active = false;
                    slot!.busy = false;
                })
                .start();
        } else {
            setTimeout(() => {
                slot!.node.active = false;
                slot!.busy = false;
            }, TUNING.fx.popDurationMs);
        }
    }

    clear(): void {
        for (const slot of this._slots) {
            slot.node.active = false;
            slot.busy = false;
        }
    }
}
