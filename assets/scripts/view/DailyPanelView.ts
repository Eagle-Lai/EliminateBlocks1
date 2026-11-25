/**
 * 每日残局面板：Calendar / Goal / Streak / Btn_Play / Btn_Hint / Btn_Back。
 * 42 个 DayCell 由 Prefab 实例化（Layout 在 Prefab 上）。
 */
import { _decorator, Label, Node, Prefab, instantiate } from 'cc';
import { UIView } from '../ui/UIView';
import { UIButton } from '../ui/UIButton';
import { DayCellView } from './DayCellView';
import { setLabel, setActive } from './ViewUtils';
import { assets } from '../service/AssetService';
import { DAILY_INDEX, indexForDay } from '../config/DailyIndex';
import { dayOfYearFromDate } from '../core/DailyPuzzle';

const { ccclass, property } = _decorator;

@ccclass('DailyPanelView')
export class DailyPanelView extends UIView {
    @property(Node) calendar: Node | null = null;
    @property(Prefab) dayCellPrefab: Prefab | null = null;
    @property(Label) goalLabel: Label | null = null;
    @property(Label) streakLabel: Label | null = null;
    @property(Label) monthLabel: Label | null = null;
    @property(Label) statusLabel: Label | null = null;
    @property(UIButton) playBtn: UIButton | null = null;
    @property(UIButton) hintBtn: UIButton | null = null;
    @property(UIButton) backBtn: UIButton | null = null;

    private _cells: DayCellView[] = [];
    private _selected = 1;
    private _done = new Set<number>();

    onOpen(data?: unknown): void {
        this.assertRefs([
            ['calendar', this.calendar],
            ['playBtn', this.playBtn],
        ]);
        const info = data as { done?: number[]; streak?: number } | undefined;
        this._done = new Set(info?.done ?? []);
        setLabel(this.streakLabel, `连续 ${info?.streak ?? 0} 天`);
        this._selected = Math.min(365, dayOfYearFromDate(new Date()));
        this._build();
    }

    bind(handlers: { onPlay: (day: number) => void; onHint: () => void; onBack: () => void }): void {
        if (this.playBtn) this.playBtn.onClick = () => handlers.onPlay(this._selected);
        if (this.hintBtn) this.hintBtn.onClick = handlers.onHint;
        if (this.backBtn) this.backBtn.onClick = handlers.onBack;
    }

    private _build(): void {
        const prefab = this.dayCellPrefab ?? assets.getPrefab('prefabs/ui/DayCell');
        if (!this.calendar || !prefab) return;
        for (const cell of this._cells) cell.node.destroy();
        this._cells = [];
        const today = Math.min(365, dayOfYearFromDate(new Date()));
        const entry = indexForDay(this._selected);
        const month = entry?.month ?? 1;
        setLabel(this.monthLabel, `${month} 月`);
        setLabel(
            this.goalLabel,
            entry
                ? `${entry.goalType === 'score' ? '得分' : entry.goalType === 'rows' ? '消行' : entry.goalType === 'color' ? '清色' : '清石'} ${entry.target}`
                : '暂无当日题目',
        );

        // 只为本月建格子（≤31 个），不再一次铺 365 个
        const monthEntries = DAILY_INDEX.filter((e) => e.month === month);
        for (const item of monthEntries) {
            const node = instantiate(prefab);
            node.setParent(this.calendar);
            const view = node.getComponent(DayCellView);
            if (!view) continue;
            view.onOpen();
            view.setDay(item.day, {
                isToday: item.dayOfYear === today,
                done: this._done.has(item.dayOfYear),
                locked: item.dayOfYear > today,
            });
            view.bind(() => {
                if (item.dayOfYear > today) return;
                this._selected = item.dayOfYear;
                this._refreshStatus();
                this._updateSelection();
            });
            this._cells.push(view);
        }
        this._refreshStatus();
    }

    private _refreshStatus(): void {
        const entry = indexForDay(this._selected);
        if (!entry) {
            setLabel(this.statusLabel, '暂无该日题目，请选择其他日期');
            return;
        }
        setLabel(
            this.statusLabel,
            `${entry.month}/${entry.day} · ${entry.difficulty} · 目标 ${entry.target}`,
        );
    }

    private _updateSelection(): void {
        const entry = indexForDay(this._selected);
        const month = entry?.month ?? 1;
        const today = Math.min(365, dayOfYearFromDate(new Date()));
        const monthEntries = DAILY_INDEX.filter((e) => e.month === month);
        for (let i = 0; i < this._cells.length; i++) {
            const item = monthEntries[i];
            if (!item) continue;
            this._cells[i].setDay(item.day, {
                isToday: item.dayOfYear === today,
                done: this._done.has(item.dayOfYear),
                locked: item.dayOfYear > today,
            });
        }
    }

    get selectedDay(): number {
        return this._selected;
    }

    markDone(day: number): void {
        this._done.add(day);
        this._updateSelection();
    }
}
