/** 每月题目表聚合：主包内置 12 个月（离线可用），按 day-of-year 取题。 */
import { PUZZLES_2027_01 } from '../config/daily/2027-01';
import { PUZZLES_2027_02 } from '../config/daily/2027-02';
import { PUZZLES_2027_03 } from '../config/daily/2027-03';
import { PUZZLES_2027_04 } from '../config/daily/2027-04';
import { PUZZLES_2027_05 } from '../config/daily/2027-05';
import { PUZZLES_2027_06 } from '../config/daily/2027-06';
import { PUZZLES_2027_07 } from '../config/daily/2027-07';
import { PUZZLES_2027_08 } from '../config/daily/2027-08';
import { PUZZLES_2027_09 } from '../config/daily/2027-09';
import { PUZZLES_2027_10 } from '../config/daily/2027-10';
import { PUZZLES_2027_11 } from '../config/daily/2027-11';
import { PUZZLES_2027_12 } from '../config/daily/2027-12';
import type { DailyPuzzleData } from '../core/DailyPuzzle';

const MONTHS: ReadonlyArray<readonly DailyPuzzleData[]> = [
    PUZZLES_2027_01,
    PUZZLES_2027_02,
    PUZZLES_2027_03,
    PUZZLES_2027_04,
    PUZZLES_2027_05,
    PUZZLES_2027_06,
    PUZZLES_2027_07,
    PUZZLES_2027_08,
    PUZZLES_2027_09,
    PUZZLES_2027_10,
    PUZZLES_2027_11,
    PUZZLES_2027_12,
];

export const DAILY_TOTAL = MONTHS.reduce((n, m) => n + m.length, 0);

export function puzzleForDay(dayOfYear: number): DailyPuzzleData | null {
    const day = dayOfYear === 366 ? 59 : Math.max(1, Math.min(365, dayOfYear));
    for (const list of MONTHS) {
        const found = list.find((p) => p.dayOfYear === day);
        if (found) return found;
    }
    return null;
}

export function puzzlesOfMonth(month: number): readonly DailyPuzzleData[] {
    return MONTHS[Math.max(0, Math.min(11, month - 1))] ?? [];
}
