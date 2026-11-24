/** 糖能轨：填充条 + 糖爆按钮 + 天赋点 + 撤销按钮。 */
import { _decorator, Label, Node, Sprite, Vec3, tween } from 'cc';
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
    @property(Node) talentDots: Node | null = null;

    private _ready = false;

    onOpen(): void {
        this.assertRefs([
            ['fill', this.fill],
            ['burstBtn', this.burstBtn],
        ]);
        this.setValue(0);
        this.setBurstReady(false);
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
        if (ready !== this._ready) {
            this._ready = ready;
            this.setBurstReady(ready);
        }
    }

    setBurstReady(ready: boolean): void {
        if (!this.burstBtn) return;
        this.burstBtn.setInteractable(ready);
        if (ready) {
            this.burstBtn.node.setScale(1, 1, 1);
            tween(this.burstBtn.node)
                .repeatForever(
                    tween(this.burstBtn.node)
                        .to(0.5, { scale: new Vec3(1.08, 1.08, 1) })
                        .to(0.5, { scale: new Vec3(1, 1, 1) }),
                )
                .start();
        } else {
            this.burstBtn.node.setScale(1, 1, 1);
        }
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

    bind(onBurst: () => void, onUndo: () => void): void {
        if (this.burstBtn) this.burstBtn.onClick = onBurst;
        if (this.undoBtn) this.undoBtn.onClick = onUndo;
    }
}
