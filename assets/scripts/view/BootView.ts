/** 启动页：Logo / LoadingBar / Version。 */
import { _decorator, Label, Sprite } from 'cc';
import { UIView } from '../ui/UIView';
import { ProgressBarView } from './ProgressBarView';
import { setLabel } from './ViewUtils';

const { ccclass, property } = _decorator;

@ccclass('BootView')
export class BootView extends UIView {
    @property(Sprite) logo: Sprite | null = null;
    @property(ProgressBarView) bar: ProgressBarView | null = null;
    @property(Label) versionLabel: Label | null = null;
    @property(Label) tipLabel: Label | null = null;

    onOpen(data?: unknown): void {
        this.assertRefs([['bar', this.bar]]);
        const version = typeof data === 'string' ? data : 'v2.0.0';
        setLabel(this.versionLabel, version);
        this.setProgress(0, '正在准备糖果…');
    }

    setProgress(p: number, tip?: string): void {
        this.bar?.setProgress(p, `${Math.round(p * 100)}%`);
        if (tip) setLabel(this.tipLabel, tip);
    }
}
