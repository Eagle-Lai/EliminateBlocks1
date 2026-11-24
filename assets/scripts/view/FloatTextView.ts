/**
 * 飘分：消除时在最大组中心弹出 +分数，上浮并淡出。
 * 预创建 8 个 Label 循环复用，运行时零节点创建。
 */
import { _decorator, Color, Component, Label, Node, UITransform, Vec3, tween } from 'cc';
import { THEME } from '../config/ThemeConfig';
import { createLabel, getOpacity } from '../ui/UIFactory';
import { TUNING } from '../config/GameTuning';

const { ccclass } = _decorator;

interface Slot {
    node: Node;
    label: Label;
    busy: boolean;
}

@ccclass('FloatTextView')
export class FloatTextView extends Component {
    private _slots: Slot[] = [];
    private _index = 0;

    build(): void {
        for (let i = 0; i < 8; i++) {
            const label = createLabel(this.node, '', {
                size: 34,
                bold: true,
                color: new Color(255, 255, 255, 255),
                width: 240,
                height: 44,
            });
            label.node.active = false;
            this._slots.push({ node: label.node, label, busy: false });
        }
    }

    spawn(text: string, pos: Vec3, color: Color): void {
        let slot = this._slots.find((s) => !s.busy);
        if (!slot) {
            slot = this._slots[this._index % this._slots.length];
            this._index++;
        }
        if (!slot) return;

        slot.busy = true;
        slot.node.active = true;
        slot.node.setPosition(pos);
        slot.label.string = text;
        slot.label.color = color;
        slot.node.setScale(0.8, 0.8, 1);

        const op = getOpacity(slot.node);
        op.opacity = 255;

        const rise = TUNING.fx.floatRisePx;
        tween(slot.node)
            .to(0.12, { scale: new Vec3(1.05, 1.05, 1) }, { easing: 'backOut' })
            .start();
        tween(slot.node)
            .by(TUNING.fx.popDurationMs / 1000, { position: new Vec3(0, rise, 0) }, { easing: 'quadOut' })
            .start();
        tween(op)
            .delay(0.18)
            .to(TUNING.fx.popDurationMs / 1000 - 0.18, { opacity: 0 })
            .call(() => {
                slot!.node.active = false;
                slot!.busy = false;
            })
            .start();
    }

    clear(): void {
        for (const slot of this._slots) {
            slot.node.active = false;
            slot.busy = false;
        }
    }
}
