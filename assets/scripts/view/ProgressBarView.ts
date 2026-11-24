/** 进度条：Track + Fill（Sprite FILLED）+ 可选 Label。 */
import { _decorator, Label, Sprite } from 'cc';
import { UIView } from '../ui/UIView';
import { setLabel } from './ViewUtils';

const { ccclass, property } = _decorator;

@ccclass('ProgressBarView')
export class ProgressBarView extends UIView {
    @property(Sprite) track: Sprite | null = null;
    @property(Sprite) fill: Sprite | null = null;
    @property(Label) label: Label | null = null;

    onOpen(): void {
        this.assertRefs([
            ['fill', this.fill],
        ]);
        if (this.fill) {
            this.fill.type = Sprite.Type.FILLED;
            this.fill.fillType = Sprite.FillType.HORIZONTAL;
            this.fill.fillStart = 0;
        }
    }

    setProgress(value: number, text?: string): void {
        if (this.fill) this.fill.fillRange = Math.max(0, Math.min(1, value));
        if (text !== undefined) setLabel(this.label, text);
    }
}
