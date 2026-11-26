/** 糖能轨：填充条 + 糖爆按钮 + 天赋点 + 撤销按钮。 */
import { _decorator, Label, Node, Sprite, Tween, Vec3, tween } from 'cc';
import { UIView } from '../ui/UIView';
import { UIButton } from '../ui/UIButton';
import { setActive, setLabel } from './ViewUtils';

const { ccclass, property } = _decorator;

@ccclass('SugarRailView')
export class SugarRailView extends UIView {
    @property(Sprite) track: Sprite | null = null;
    @property(Sprite) fill: Sprite | null = null;
    @property(Label) percentLabel: Label | null = null;
    @property(UIButton) burstBtn: UIButton | null = null;
    @property(UIButton) undoBtn: UIButton | null = null;
    @property(UIButton) hintBtn: UIButton | null = null;
    @property(Node) talentDots: Node | null = null;
    @property(Node) readyRing: Node | null = null;

    private _ready: boolean | null = null;

    onOpen(): void {
        this.assertRefs([
            ['fill', this.fill],
            ['burstBtn', this.burstBtn],
        ]);
        this.setValue(0);
        this.setTalentCount(0);
    }

    setValue(value: number, max = 100): void {
        const ratio = Math.max(0, Math.min(1, value / max));
        if (this.fill) {
            this.fill.type = Sprite.Type.FILLED;
            this.fill.fillType = Sprite.FillType.VERTICAL;
            this.fill.fillStart = 0;
            this.fill.fillRange = ratio;
        }
        setLabel(this.percentLabel, `${Math.round(value)}`);
        const ready = ratio >= 1;
        if (ready !== this._ready) this.setBurstReady(ready);
    }

    setBurstReady(ready: boolean): void {
        this._ready = ready;
        this.burstBtn?.setInteractable(ready);
        const ring = this.readyRing;
        if (!ring) return;
        Tween.stopAllByTarget(ring);
        ring.active = ready;
        if (!ready) return;
        ring.setScale(0.82, 0.82, 1);
        tween(ring).repeatForever(tween<Node>()
            .to(0.65, { scale: new Vec3(1.12, 1.12, 1) }, { easing: 'sineInOut' })
            .to(0.65, { scale: new Vec3(0.82, 0.82, 1) }, { easing: 'sineInOut' })
        ).start();
    }

    setTalentCount(count: number): void {
        if (!this.talentDots) return;
        const dots = this.talentDots.children;
        for (let i = 0; i < dots.length; i++) dots[i].active = i < count;
    }

    setUndoEnabled(enabled: boolean, count = 0): void {
        setActive(this.undoBtn?.node ?? null, count > 0);
        this.undoBtn?.setInteractable(enabled && count > 0);
    }

    bind(onBurst: () => void, onUndo: () => void, onHint?: () => void): void {
        if (this.burstBtn) this.burstBtn.onClick = onBurst;
        if (this.undoBtn) this.undoBtn.onClick = onUndo;
        if (this.hintBtn && onHint) this.hintBtn.onClick = onHint;
    }

    /** 残局提示按钮：只有残局局内可见 */
    setHintVisible(visible: boolean): void {
        if (this.hintBtn) this.hintBtn.node.active = visible;
    }
}
