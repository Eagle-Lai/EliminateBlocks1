/** 操作区：← → ↻ 直落 四个 Prefab 按钮。 */
import { _decorator } from 'cc';
import { UIView } from '../ui/UIView';
import { UIButton } from '../ui/UIButton';
import { TUNING } from '../config/GameTuning';

const { ccclass, property } = _decorator;

@ccclass('PadView')
export class PadView extends UIView {
    @property(UIButton) leftBtn: UIButton | null = null;
    @property(UIButton) rightBtn: UIButton | null = null;
    @property(UIButton) rotateBtn: UIButton | null = null;
    @property(UIButton) dropBtn: UIButton | null = null;

    onOpen(): void {
        this.assertRefs([
            ['leftBtn', this.leftBtn],
            ['rightBtn', this.rightBtn],
            ['rotateBtn', this.rotateBtn],
            ['dropBtn', this.dropBtn],
        ]);
    }

    bind(handlers: { onMove: (dx: number) => void; onRotate: () => void; onDrop: () => void }): void {
        if (this.leftBtn) {
            this.leftBtn.onClick = () => handlers.onMove(-1);
            this.leftBtn.setHold(TUNING.input.holdDelayMs, TUNING.input.holdRepeatMs);
        }
        if (this.rightBtn) {
            this.rightBtn.onClick = () => handlers.onMove(1);
            this.rightBtn.setHold(TUNING.input.holdDelayMs, TUNING.input.holdRepeatMs);
        }
        if (this.rotateBtn) this.rotateBtn.onClick = handlers.onRotate;
        if (this.dropBtn) this.dropBtn.onClick = handlers.onDrop;
    }

    setEnabled(enabled: boolean): void {
        for (const btn of [this.leftBtn, this.rightBtn, this.rotateBtn, this.dropBtn]) {
            btn?.setInteractable(enabled);
        }
    }
}
