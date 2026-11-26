/**
 * 内容表校验单测：120 关 + 365 题。
 * 运行：npx tsx tests/content.test.ts
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { verifyDaily, type Move } from '../scripts/gen-content/daily-proof';
import { LEVELS, CHAPTERS, chapterCleared, chapterUnlocked } from '../assets/scripts/config/LevelTable';
import { DAILY_INDEX } from '../assets/scripts/config/DailyIndex';
import { PUZZLES_2027_01 } from '../assets/scripts/config/daily/2027-01';
import { PUZZLES_2027_02 } from '../assets/scripts/config/daily/2027-02';
import { PUZZLES_2027_03 } from '../assets/scripts/config/daily/2027-03';
import { PUZZLES_2027_04 } from '../assets/scripts/config/daily/2027-04';
import { PUZZLES_2027_05 } from '../assets/scripts/config/daily/2027-05';
import { PUZZLES_2027_06 } from '../assets/scripts/config/daily/2027-06';
import { PUZZLES_2027_07 } from '../assets/scripts/config/daily/2027-07';
import { PUZZLES_2027_08 } from '../assets/scripts/config/daily/2027-08';
import { PUZZLES_2027_09 } from '../assets/scripts/config/daily/2027-09';
import { PUZZLES_2027_10 } from '../assets/scripts/config/daily/2027-10';
import { PUZZLES_2027_11 } from '../assets/scripts/config/daily/2027-11';
import { PUZZLES_2027_12 } from '../assets/scripts/config/daily/2027-12';
import { validateMutationCombo } from '../assets/scripts/config/MutationTable';
import type { DailyPuzzleData } from '../assets/scripts/core/DailyPuzzle';

let passed = 0;
function test(name: string, fn: () => void): void {
    try {
        fn();
        passed++;
        console.log(`  ✓ ${name}`);
    } catch (err) {
        console.error(`  ✗ ${name}`);
        throw err;
    }
}

const MONTHS: readonly (readonly DailyPuzzleData[])[] = [
    PUZZLES_2027_01, PUZZLES_2027_02, PUZZLES_2027_03, PUZZLES_2027_04,
    PUZZLES_2027_05, PUZZLES_2027_06, PUZZLES_2027_07, PUZZLES_2027_08,
    PUZZLES_2027_09, PUZZLES_2027_10, PUZZLES_2027_11, PUZZLES_2027_12,
];
const ALL_DAILY = MONTHS.reduce<DailyPuzzleData[]>((acc, m) => acc.concat(m.slice()), []);

console.log('关卡表');
test('120 条', () => assert.equal(LEVELS.length, 120));
test('id 1–120 唯一', () => {
    const ids = LEVELS.map((l) => l.id);
    assert.deepEqual(ids, Array.from({ length: 120 }, (_, i) => i + 1));
    assert.equal(new Set(ids).size, 120);
});
test('名字唯一', () => assert.equal(new Set(LEVELS.map((l) => l.name)).size, 120));
test('6 章 × 20 关', () => {
    for (let c = 1; c <= 6; c++) assert.equal(LEVELS.filter((l) => l.chapter === c).length, 20);
    assert.equal(CHAPTERS.length, 6);
});
test('档位曲线与章节表一致', () => {
    const expect: Record<number, [number, number, number]> = {
        1: [8, 8, 4], 2: [6, 10, 4], 3: [4, 10, 6], 4: [4, 8, 8], 5: [0, 10, 10], 6: [0, 6, 14],
    };
    for (let c = 1; c <= 6; c++) {
        const list = LEVELS.filter((l) => l.chapter === c);
        const counts = ['light', 'standard', 'strong'].map((t) => list.filter((l) => l.tier === t).length);
        assert.deepEqual(counts, expect[c], `chapter ${c}`);
    }
});
test('同一异变连续 ≤3', () => {
    let run = 1;
    for (let i = 1; i < LEVELS.length; i++) {
        run = LEVELS[i].mutationId === LEVELS[i - 1].mutationId ? run + 1 : 1;
        assert.ok(run <= 3, `level ${LEVELS[i].id}`);
    }
});
test('星级严格递增', () => {
    for (const l of LEVELS) {
        assert.ok(l.star2 > 0 && l.star3 > l.star2, `level ${l.id}`);
        if (l.goalType === 'score') assert.ok(l.target > 0 && l.star3 > l.target);
    }
});
test('目标色合法', () => {
    for (const l of LEVELS.filter((x) => x.goalType === 'color')) {
        assert.ok(l.goalColor !== undefined && l.goalColor >= 0 && l.goalColor <= 4, `level ${l.id}`);
    }
});
test('石块关 stoneCount = target + 2', () => {
    for (const l of LEVELS.filter((x) => x.goalType === 'stone')) {
        assert.equal(l.stoneCount, l.target + 2, `level ${l.id}`);
    }
});
test('seed = id × 7919', () => {
    for (const l of LEVELS) assert.equal(l.seed, l.id * 7919);
});
test('异变 id 合法且无禁忌组合', () => {
    for (const l of LEVELS) {
        assert.ok(l.mutationId >= 1 && l.mutationId <= 8);
        assert.equal(validateMutationCombo([l.mutationId]), null);
    }
});
test('解锁链：本章 12 关 1★ 解锁下一章', () => {
    const stars: Record<number, number> = {};
    assert.equal(chapterUnlocked(stars, 1), true);
    assert.equal(chapterUnlocked(stars, 2), false);
    for (let s = 1; s <= 12; s++) stars[s] = 1;
    assert.equal(chapterCleared(stars, 1), 12);
    assert.equal(chapterUnlocked(stars, 2), true);
});
test('目标类型 6 类齐全', () => {
    const types = new Set(LEVELS.map((l) => l.goalType));
    assert.equal(types.size, 6);
});

console.log('每日残局');
test('365 条', () => assert.equal(ALL_DAILY.length, 365));
test('索引 1–365 无空洞', () => {
    const days = DAILY_INDEX.map((e) => e.dayOfYear).sort((a, b) => a - b);
    assert.equal(days.length, 365);
    for (let i = 0; i < 365; i++) assert.equal(days[i], i + 1);
});
test('84 条异变题', () => assert.equal(ALL_DAILY.filter((p) => p.mutationId).length, 84));
test('每月目标 4 类齐全', () => {
    for (const list of MONTHS) {
        const types = new Set(list.map((p) => p.goal.type));
        assert.equal(types.size, 4, `month size ${list.length}`);
    }
});
test('全部 verified', () => assert.equal(ALL_DAILY.filter((p) => p.verified).length, 365));
test('盘面 + 队列不重复', () => {
    const seen = new Set<string>();
    for (const p of ALL_DAILY) {
        const key = `${p.board.join('|')}#${p.queue.map((q) => `${q.shape}${q.color}`).join(',')}`;
        assert.ok(!seen.has(key), `day ${p.dayOfYear}`);
        seen.add(key);
    }
});
test('步数与难度一致', () => {
    const limits: Record<string, number> = { easy: 10, medium: 8, mediumPlus: 7, hard: 6 };
    for (const p of ALL_DAILY) assert.equal(p.moveLimit, limits[p.difficulty], `day ${p.dayOfYear}`);
});
test('365 题无预消、默认首落无消除；每条输入解限步达标', () => {
    const witnesses = JSON.parse(readFileSync('scripts/gen-content/daily-solutions.json', 'utf8')) as Record<number, Move[]>;
    for (const p of ALL_DAILY) {
        assert.doesNotThrow(() => verifyDaily(p, witnesses[p.id]), `day ${p.id}`);
    }
});
test('目标值为正', () => {
    for (const p of ALL_DAILY) assert.ok(p.goal.target > 0, `day ${p.dayOfYear}`);
});
test('解长比例在 (0, 1]', () => {
    for (const p of ALL_DAILY) {
        const ratio = p.solutionLength / p.moveLimit;
        assert.ok(ratio > 0 && ratio <= 1.0001, `day ${p.dayOfYear} ${ratio}`);
    }
});
test('异变 id 合法', () => {
    for (const p of ALL_DAILY.filter((x) => x.mutationId)) assert.ok(p.mutationId! >= 1 && p.mutationId! <= 8);
});
test('月度文件题数合计 365', () => {
    const counts = MONTHS.map((m) => m.length);
    assert.equal(counts.reduce((a, b) => a + b, 0), 365);
    for (const n of counts) assert.ok(n >= 28 && n <= 31);
});
test('每题有提示首步', () => {
    assert.ok(ALL_DAILY.filter((p) => p.hint).length >= 360);
});
test('id 与 dayOfYear 一致', () => {
    for (const p of ALL_DAILY) assert.equal(p.id, p.dayOfYear);
});
test('索引与题目目标一致', () => {
    for (const e of DAILY_INDEX) {
        const p = ALL_DAILY.find((x) => x.dayOfYear === e.dayOfYear);
        assert.ok(p, `day ${e.dayOfYear}`);
        assert.equal(e.goalType, p!.goal.type);
        assert.equal(e.target, p!.goal.target);
    }
});

console.log(`\n内容表单测通过：${passed} 项`);
