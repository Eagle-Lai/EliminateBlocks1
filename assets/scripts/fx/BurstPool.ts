/**
 * 消除碎片特效池：每个特效节点用 Graphics 画一圈小圆点，整体缩放淡出。
 * 池化复用，避免运行时创建节点造成 GC 抖动。
 */
import { Color, Graphics, Node, UIOpacity, Vec3, tween } from 'cc';
import { createNode } from '../ui/UIFactory';
import { THEME } from '../config/ThemeConfig';

interface BurstSlot {
    node: Node;
    graphics: Graphics;
    opacity: UIOpacity;
    busy: boolean;
}

export class BurstPool {
    private _slots: BurstSlot[] = [];

    constructor(
        private readonly parent: Node,
        private readonly capacity = 8,
        private readonly dots = 7,
    ) {
        for (let i = 0; i < capacity; i++) {
            const node = createNode(`Burst_${i}`, parent);
            const graphics = node.addComponent(Graphics);
            const opacity = node.addComponent(UIOpacity);
            node.active = false;
            this._slots.push({ node, graphics, opacity, busy: false });
        }
    }

    spawn(pos: Vec3, color: Color, radius: number): void {
        const slot = this._slots.find((s) => !s.busy) ?? this._slots[0];
        if (!slot) return;

        slot.busy = true;
        slot.node.active = true;
        slot.node.setPosition(pos);
        slot.node.setScale(0.45, 0.45, 1);
        slot.opacity.opacity = 255;

        const g = slot.graphics;
        g.clear();
        g.fillColor = color;
        for (let i = 0; i < this.dots; i++) {
            const angle = (Math.PI * 2 * i) / this.dots + Math.random() * 0.4;
            const dist = radius * (0.55 + Math.random() * 0.5);
            const r = radius * (0.1 + Math.random() * 0.08);
            g.circle(Math.cos(angle) * dist, Math.sin(angle) * dist, r);
            g.fill();
        }

        tween(slot.node)
            .to(0.32, { scale: new Vec3(1.35, 1.35, 1) }, { easing: 'quadOut' })
            .call(() => {
                slot.node.active = false;
                slot.busy = false;
            })
            .start();
        tween(slot.opacity).to(0.32, { opacity: 0 }).start();
    }

    clear(): void {
        for (const slot of this._slots) {
            slot.node.active = false;
            slot.busy = false;
        }
    }
}

export const BURST_COLORS = THEME.blockColors;
