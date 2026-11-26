/** 每日残局日历。日期卡、题目说明和开局共用同一个选中日期。 */
import { _decorator, Label, Node, Prefab, Sprite, instantiate } from 'cc';
import { UIView } from '../ui/UIView';
import { UIButton } from '../ui/UIButton';
import { DayCellView, GOAL_SCENE } from './DayCellView';
import { revealGrid, setLabel } from './ViewUtils';
import { popArt } from './UIMotion';
import { assets } from '../service/AssetService';
import { ART } from '../config/AssetKeys';
import { DAILY_INDEX, indexForDay } from '../config/DailyIndex';
import { dailyGoalText, dateKey, dayOfYearFromDate } from '../core/DailyPuzzle';
import { puzzleForDay } from '../app/DailyRepo';
import { GoalTracker } from '../core/GoalTracker';
import { replayStore } from '../service/ReplayStore';

const { ccclass, property } = _decorator;
const DIFFICULTY = { easy: '简单', medium: '普通', mediumPlus: '进阶', hard: '困难' };

@ccclass('DailyPanelView')
export class DailyPanelView extends UIView {
    @property(Node) calendar: Node | null = null;
    @property(Prefab) dayCellPrefab: Prefab | null = null;
    @property(Sprite) detailArt: Sprite | null = null;
    @property(Label) goalLabel: Label | null = null;
    @property(Label) streakLabel: Label | null = null;
    @property(Label) monthLabel: Label | null = null;
    @property(Label) statusLabel: Label | null = null;
    @property(UIButton) playBtn: UIButton | null = null;
    @property(UIButton) hintBtn: UIButton | null = null;
    @property(UIButton) backBtn: UIButton | null = null;

    private _cells = new Map<number, DayCellView>();
    private _selected = 1;
    private _today = 1;
    private _calendarDate = '';
    private _displayedYear = 0;
    private _done = new Set<number>();

    onOpen(): void {
        this.assertRefs([['calendar', this.calendar], ['playBtn', this.playBtn]]);
        const today = new Date();
        this._done = new Set(replayStore.dailyDone(today));
        this._today = dayOfYearFromDate(today);
        this._displayedYear = today.getFullYear();
        this._calendarDate = dateKey(today);
        this.unschedule(this._refreshDate);
        this.schedule(this._refreshDate, 1);
        setLabel(this.streakLabel, `连续 ${replayStore.streak(today)} 天`);
        const prefab = this.dayCellPrefab ?? assets.getPrefab('prefabs/ui/DayCell');
        if (!this.calendar || !prefab) return;
        for (const cell of this._cells.values()) {
            cell.node.removeFromParent();
            cell.node.destroy();
        }
        this._cells.clear();
        const month = indexForDay(this._today)!.month;
        setLabel(this.monthLabel, `${month} 月`);
        for (const entry of DAILY_INDEX.filter(item => item.month === month)) {
            const node = instantiate(prefab);
            node.setParent(this.calendar);
            node.name = `Day_${entry.day}`;
            const cell = node.getComponent(DayCellView)!;
            cell.onOpen();
            const day = entry.dayOfYear;
            cell.setDay(entry, this._today, this._done.has(day));
            cell.bind(() => this.select(day));
            this._cells.set(day, cell);
        }
        this.select(this._today);
        revealGrid(this.calendar, 7);
    }

    private _refreshDate(): void {
        const now = new Date();
        if (dateKey(now) !== this._calendarDate) {
            this.onOpen();
        }
    }

    onClose(): void { this.unschedule(this._refreshDate); }

    private select(day: number): void {
        const entry = indexForDay(day);
        if (day > this._today || !entry || !this._cells.has(day)) return;
        this._cells.get(this._selected)?.setSelected(false);
        this._selected = day;
        this._cells.get(day)?.setSelected(true);
        popArt(this._cells.get(day)?.selection, 0, 1.16);
        assets.loadSpriteFrame(ART.chapterScene(GOAL_SCENE[entry.goalType])).then(frame => {
            if (this._selected === day && frame && this.detailArt?.isValid) {
                this.detailArt.spriteFrame = frame;
                popArt(this.detailArt.node, 0, 0.87);
            }
        });
        const goal = puzzleForDay(day)?.goal ?? { type: entry.goalType, target: entry.target };
        setLabel(this.goalLabel, goal.type === 'color' ? new GoalTracker(goal).text() : dailyGoalText(goal));
        setLabel(this.statusLabel, `${entry.month} 月 ${entry.day} 日 · ${DIFFICULTY[entry.difficulty]}`);
    }

    bind(handlers: { onPlay: (day: number, year: number) => void; onHint: () => void; onBack: () => void }): void {
        if (this.playBtn) this.playBtn.onClick = () => handlers.onPlay(this._selected, this._displayedYear);
        if (this.hintBtn) this.hintBtn.onClick = handlers.onHint;
        if (this.backBtn) this.backBtn.onClick = handlers.onBack;
    }

    get selectedDay(): number { return this._selected; }

    markDone(day: number): void {
        this._done.add(day);
        const entry = indexForDay(day);
        if (entry) this._cells.get(day)?.setDay(entry, this._today, true);
    }
}
