/** 日期的金框表示当前选择，文字和星标表示日期状态。 */
import { _decorator, Label, Node, Sprite } from 'cc';
import { UIView } from '../ui/UIView';
import { UIButton } from '../ui/UIButton';
import { loadSprite, setActive, setLabel } from './ViewUtils';
import { ART } from '../config/AssetKeys';
import type { DailyIndexEntry } from '../config/DailyIndex';

const { ccclass, property } = _decorator;
export const GOAL_SCENE = { score: 3, rows: 2, color: 5, special: 4, burst: 6, stone: 1 };

@ccclass('DayCellView')
export class DayCellView extends UIView {
    @property(Label) dayLabel: Label | null = null;
    @property(Label) stateLabel: Label | null = null;
    @property(Node) star: Node | null = null;
    @property(Node) selection: Node | null = null;
    @property(Sprite) artwork: Sprite | null = null;
    @property(UIButton) button: UIButton | null = null;

    onOpen(): void {
        this.assertRefs([['dayLabel', this.dayLabel], ['selection', this.selection]]);
        this.setSelected(false);
    }

    setDay(entry: DailyIndexEntry, today: number, done: boolean): void {
        const locked = entry.dayOfYear > today;
        setLabel(this.dayLabel, String(entry.day));
        setActive(this.star, done);
        setLabel(this.stateLabel, entry.dayOfYear === today ? '今天' : done ? '已完成' : locked ? '未开放' : '');
        this.button?.setInteractable(!locked);
        loadSprite(this.artwork, ART.chapterScene(GOAL_SCENE[entry.goalType]));
    }

    setSelected(selected: boolean): void {
        setActive(this.selection, selected);
    }

    bind(onClick: () => void): void {
        if (this.button) this.button.onClick = onClick;
    }
}
