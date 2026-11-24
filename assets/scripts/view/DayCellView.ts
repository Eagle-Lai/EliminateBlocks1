/** 日历格：Day / State / Star。 */
import { _decorator, Label, Node, Sprite } from 'cc';
import { UIView } from '../ui/UIView';
import { UIButton } from '../ui/UIButton';
import { setActive, setLabel } from './ViewUtils';
import { DAILY_INDEX } from '../config/DailyIndex';

const { ccclass, property } = _decorator;

@ccclass('DayCellView')
export class DayCellView extends UIView {
    @property(Label) dayLabel: Label | null = null;
    @property(Label) stateLabel: Label | null = null;
    @property(Node) star: Node | null = null;
    @property(Node) today: Node | null = null;
    @property(UIButton) button: UIButton | null = null;

    onOpen(): void {
        this.assertRefs([['dayLabel', this.dayLabel]]);
    }

    setDay(day: number, opts: { isToday: boolean; done: boolean; locked: boolean }): void {
        setLabel(this.dayLabel, String(day));
        setActive(this.star, opts.done);
        setActive(this.today, opts.isToday);
        setLabel(this.stateLabel, opts.done ? '完成' : opts.locked ? '未开放' : '');
        this.button?.setInteractable(!opts.locked);
    }

    bind(onClick: () => void): void {
        if (this.button) this.button.onClick = onClick;
    }
}
