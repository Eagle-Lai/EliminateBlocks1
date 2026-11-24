/**
 * 关卡 / 残局目标进度（纯逻辑）。
 * 6 类目标：score / rows / color / special / burst / stone。
 * HUD 每帧只在数值变化时刷新，这里负责"算一次、缓存"。
 */
import type { GoalType } from '../config/GameTuning';
import type { BlockData, BlockKind } from './BoardModel';

export interface GoalDef {
    type: GoalType;
    target: number;
    /** color 目标的目标色 */
    color?: number;
}

export interface GoalSnapshot {
    type: GoalType;
    target: number;
    value: number;
    ratio: number;
    done: boolean;
}

const COLOR_NAMES = ['草莓', '蜜橙', '青柠', '汽水', '葡萄'];

export class GoalTracker {
    private _value = 0;
    private _score = 0;
    private _done = false;

    constructor(readonly goal: GoalDef) {}

    get value(): number {
        return this._value;
    }

    get target(): number {
        return this.goal.target;
    }

    get done(): boolean {
        return this._done || this._value >= this.goal.target;
    }

    get ratio(): number {
        if (this.goal.target <= 0) return 1;
        return Math.max(0, Math.min(1, this._value / this.goal.target));
    }

    reset(): void {
        this._value = 0;
        this._score = 0;
        this._done = false;
    }

    /** 同步总分（score 目标用） */
    syncScore(score: number): void {
        this._score = score;
        if (this.goal.type === 'score') this._value = score;
    }

    get score(): number {
        return this._score;
    }

    /** 一次消除：统计颜色格与石块 */
    onPop(removed: readonly BlockData[]): void {
        if (this.goal.type === 'color') {
            const color = this.goal.color ?? 0;
            for (const b of removed) {
                if (b.kind === 'stone') continue;
                if (b.type === color) this._value++;
            }
        } else if (this.goal.type === 'stone') {
            for (const b of removed) {
                if (b.kind === 'stone') this._value++;
            }
        }
    }

    onRowClear(rows: number): void {
        if (this.goal.type === 'rows') this._value += rows;
    }

    onSpecialCreated(count = 1): void {
        if (this.goal.type === 'special') this._value += count;
    }

    onBurst(count = 1): void {
        if (this.goal.type === 'burst') this._value += count;
    }

    snapshot(): GoalSnapshot {
        return {
            type: this.goal.type,
            target: this.goal.target,
            value: this.goal.type === 'score' ? this._score : this._value,
            ratio: this.ratio,
            done: this.done,
        };
    }

    /** HUD 文案："目标 3200" / "消 8 行" / "清 12 个蜜橙" / "造 4 个特殊糖" / "糖爆 2 次" / "清 10 块霜石" */
    text(): string {
        const t = this.goal.target;
        switch (this.goal.type) {
            case 'score':
                return `目标 ${t}`;
            case 'rows':
                return `消 ${t} 行`;
            case 'color':
                return `清 ${t} 个${COLOR_NAMES[this.goal.color ?? 0] ?? '同色'}`;
            case 'special':
                return `造 ${t} 个特殊糖`;
            case 'burst':
                return `糖爆 ${t} 次`;
            case 'stone':
                return `清 ${t} 块霜石`;
            default:
                return `目标 ${t}`;
        }
    }

    /** 进度文案："3/8" */
    progressText(): string {
        const v = Math.min(this.goal.type === 'score' ? this._score : this._value, this.goal.target);
        return `${v}/${this.goal.target}`;
    }
}

/** 目标定义合法性（内容表校验用） */
export function validateGoal(goal: GoalDef): string | null {
    if (goal.target <= 0) return `目标值必须为正：${goal.type}=${goal.target}`;
    if (goal.type === 'color' && (goal.color === undefined || goal.color < 0 || goal.color > 4)) {
        return `color 目标缺少合法颜色：${goal.color}`;
    }
    return null;
}

export function goalKindLabel(kind: BlockKind): string {
    return kind === 'stone' ? '霜石' : kind === 'brittle' ? '脆霜' : '方块';
}
