/** 糖爆选色（Lv3，P2 预留）：Chips / Btn_Cancel。 */
import { _decorator, Node } from 'cc';
import { UIView } from '../ui/UIView';
import { UIButton } from '../ui/UIButton';

const { ccclass, property } = _decorator;

@ccclass('ColorPickerView')
export class ColorPickerView extends UIView {
    @property(Node) chipsRoot: Node | null = null;
    @property(UIButton) cancelBtn: UIButton | null = null;

    private _resolve: ((color: number | null) => void) | null = null;

    onOpen(): void {
        this.assertRefs([['chipsRoot', this.chipsRoot], ['cancelBtn', this.cancelBtn]]);
        if (this.cancelBtn) this.cancelBtn.onClick = () => this._finish(null);
        if (this.chipsRoot) {
            this.chipsRoot.children.forEach((chip, i) => {
                const btn = chip.getComponent(UIButton);
                if (btn) btn.onClick = () => this._finish(i);
            });
        }
    }

    play(): Promise<number | null> {
        return new Promise((resolve) => {
            this._resolve = resolve;
        });
    }

    private _finish(color: number | null): void {
        const resolve = this._resolve;
        this._resolve = null;
        resolve?.(color);
    }
}
