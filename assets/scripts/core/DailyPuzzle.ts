/**
 * 每日残局：题目结构、日历映射、步数与目标规则。
 * 同一天所有人同题（day-of-year 取题）；2 月 29 日复用 2 月 28 日。
 */
import type { GoalDef } from './GoalTracker';
import type { PieceSpec } from './PieceSource';

export type DailyDifficulty = 'easy' | 'medium' | 'mediumPlus' | 'hard';

export interface DailyHint {
    shape: number;
    rotation: number;
    x: number;
}

export interface DailyPuzzleData {
    id: number;
    dayOfYear: number;
    month: number;
    day: number;
    difficulty: DailyDifficulty;
    moveLimit: number;
    goal: GoalDef;
    board: string[];
    queue: PieceSpec[];
    mutationId?: number;
    solutionLength: number;
    hint: DailyHint | null;
    verified: boolean;
}

export const DIFFICULTY_MOVE_LIMIT: Record<DailyDifficulty, number> = {
    easy: 10,
    medium: 8,
    mediumPlus: 7,
    hard: 6,
};

export const DIFFICULTY_ORDER: readonly DailyDifficulty[] = ['easy', 'medium', 'mediumPlus', 'hard'];

/** 星期一=0 ... 星期日=6（与 Date.getDay 的 0=周日对齐转换） */
export function mondayIndex(dow: number): number {
    return (dow + 6) % 7;
}

export function difficultyForWeekday(dow: number): DailyDifficulty {
    const i = mondayIndex(dow);
    if (i <= 1) return 'easy';
    if (i <= 3) return 'medium';
    if (i === 4) return 'mediumPlus';
    return 'hard';
}

export function moveLimitForWeekday(dow: number): number {
    return DIFFICULTY_MOVE_LIMIT[difficultyForWeekday(dow)];
}

/** 解长比例区间：易 ≤0.6×步数，中 ≤0.8×，难 ≤1.0×；且 ≥0.3× */
export function solutionRatioRange(difficulty: DailyDifficulty): { min: number; max: number } {
    switch (difficulty) {
        case 'easy':
            return { min: 0.3, max: 0.6 };
        case 'medium':
            return { min: 0.3, max: 0.8 };
        case 'mediumPlus':
            return { min: 0.3, max: 0.9 };
        case 'hard':
            return { min: 0.3, max: 1.0 };
        default:
            return { min: 0.3, max: 1.0 };
    }
}

/** day-of-year（1–365）→ 月/日（2027 非闰年） */
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function monthDayFromDayOfYear(dayOfYear: number): { month: number; day: number } {
    let remaining = Math.max(1, Math.min(365, dayOfYear));
    for (let m = 0; m < MONTH_DAYS.length; m++) {
        if (remaining <= MONTH_DAYS[m]) return { month: m + 1, day: remaining };
        remaining -= MONTH_DAYS[m];
    }
    return { month: 12, day: 31 };
}

export function dayOfYearFromDate(date: Date): number {
    const start = Date.UTC(date.getUTCFullYear(), 0, 1);
    const now = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    return Math.floor((now - start) / 86400000) + 1;
}

/** 本地日期键（存档用；时钟回拨只会重玩，不重复计连续） */
export function dateKey(date: Date): string {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const mm = m < 10 ? `0${m}` : `${m}`;
    const dd = d < 10 ? `0${d}` : `${d}`;
    return `${y}-${mm}-${dd}`;
}

/** 异变周：每月 1–7 日 */
export function isMutationWeek(month: number, day: number): boolean {
    return day >= 1 && day <= 7;
}

export function dailyGoalText(goal: GoalDef): string {
    switch (goal.type) {
        case 'score':
            return `得分达到 ${goal.target}`;
        case 'rows':
            return `消除 ${goal.target} 行`;
        case 'color':
            return `清除 ${goal.target} 个目标色`;
        case 'stone':
            return `清除 ${goal.target} 块霜石`;
        default:
            return `完成目标 ${goal.target}`;
    }
}

/** 残局是否达成 */
export function isDailyComplete(goal: GoalDef, value: number): boolean {
    return value >= goal.target;
}
