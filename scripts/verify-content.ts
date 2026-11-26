import { verifyDaily, type Move } from './gen-content/daily-proof';
import { RunBootstrapper } from '../assets/scripts/controller/RunBootstrapper';
import { levelConfig } from '../assets/scripts/app/GameMode';
import { GreedyBot } from '../assets/scripts/core/Solver';
/**
 * 内容门：120 关 / 365 题 / 84 异变 / 每月 4 类目标 / 唯一性 / 索引无空洞。
 * 运行：npx tsx scripts/verify-content.ts
 */
import { LEVELS, CHAPTERS } from '../assets/scripts/config/LevelTable';
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
import { readFileSync, existsSync } from 'node:fs';

const MONTHS = [
    PUZZLES_2027_01, PUZZLES_2027_02, PUZZLES_2027_03, PUZZLES_2027_04,
    PUZZLES_2027_05, PUZZLES_2027_06, PUZZLES_2027_07, PUZZLES_2027_08,
    PUZZLES_2027_09, PUZZLES_2027_10, PUZZLES_2027_11, PUZZLES_2027_12,
] as const;
const DAILY: DailyPuzzleData[] = MONTHS.reduce<DailyPuzzleData[]>((a, m) => a.concat(m.slice()), []);

const errors: string[] = [];
const ok = (cond: boolean, msg: string): void => {
    if (!cond) errors.push(msg);
};

ok(LEVELS.length === 120, `关卡数 ${LEVELS.length} ≠ 120`);
ok(CHAPTERS.length === 6, `章节数 ${CHAPTERS.length} ≠ 6`);
ok(new Set(LEVELS.map((l) => l.id)).size === 120, '关卡 id 重复');
ok(new Set(LEVELS.map((l) => l.name)).size === 120, '关卡名重复');
for (let c = 1; c <= 6; c++) ok(LEVELS.filter((l) => l.chapter === c).length === 20, `第 ${c} 章不是 20 关`);
for (const l of LEVELS) {
    ok(l.target > 0, `#${l.id} 目标值非正`);
    ok(l.star2 > 0 && l.star3 > l.star2, `#${l.id} 星级未递增`);
    ok(validateMutationCombo([l.mutationId]) === null, `#${l.id} 异变禁忌`);
    const config = levelConfig(l);
    const board = RunBootstrapper.buildBoard(config);
    if (l.goalType === 'stone') {
        ok(l.stoneCount === l.target + 2, `#${l.id} 石块数不等于 target+2`);
        ok(board.countKind('stone') === l.stoneCount, `#${l.id} 实际铺石数不符`);
    }
    const run = new GreedyBot(config.seed, { mutationId: l.mutationId, tier: l.tier }).play(board, 120, config.goal!);
    ok(run.done, `#${l.id} 正式种子校准机器人未达标，进度 ${run.goalValue}/${l.target}`);
    if (l.goalType === 'color') ok(l.goalColor !== undefined && l.goalColor >= 0 && l.goalColor <= 4, `#${l.id} 目标色非法`);
}
let same = 1;
for (let i = 1; i < LEVELS.length; i++) {
    same = LEVELS[i].mutationId === LEVELS[i - 1].mutationId ? same + 1 : 1;
    ok(same <= 3, `#${LEVELS[i].id} 同异变连续超过 3`);
}

ok(DAILY.length === 365, `每日题数 ${DAILY.length} ≠ 365`);
ok(DAILY_INDEX.length === 365, `索引数 ${DAILY_INDEX.length} ≠ 365`);
const days = DAILY_INDEX.map((e) => e.dayOfYear).sort((a, b) => a - b);
for (let i = 0; i < 365; i++) ok(days[i] === i + 1, `索引缺 ${i + 1}`);
ok(DAILY.filter((p) => p.mutationId).length === 84, `异变题 ${DAILY.filter((p) => p.mutationId).length} ≠ 84`);
for (const month of MONTHS) {
    ok(new Set(month.map((p) => p.goal.type)).size === 4, `某月目标类型不足 4 类`);
}
ok(DAILY.every((p) => p.verified), '存在未校验题目');
const witnesses = JSON.parse(readFileSync('scripts/gen-content/daily-solutions.json', 'utf8')) as Record<number, Move[]>;
ok(Object.keys(witnesses).length === DAILY.length, '参考解数量错误');
const seen = new Set<string>();
for (const p of DAILY) {
    try { verifyDaily(p, witnesses[p.id]); } catch (e) { errors.push(`day ${p.id}: ${e}`); }
    const key = `${p.board.join('|')}#${p.queue.map((q) => `${q.shape}${q.color}`).join(',')}`;
    ok(!seen.has(key), `题目重复：day ${p.dayOfYear}`);
    seen.add(key);
    ok(p.board.length === 16 && p.board.every((r) => r.length === 10), `day ${p.dayOfYear} 盘面尺寸错误`);
    ok(p.solutionLength > 0 && p.solutionLength <= p.moveLimit, `day ${p.dayOfYear} 解长越界`);
}

for (const report of ['docs/level-report.md', 'docs/daily-report.md']) {
    ok(existsSync(report), `缺少报告 ${report}`);
}
if (existsSync('docs/level-report.md')) {
    const text = readFileSync('docs/level-report.md', 'utf8');
    ok(/1★ 可达率/.test(text), '关卡报告缺少可达率');
}
if (existsSync('docs/daily-report.md')) {
    const text = readFileSync('docs/daily-report.md', 'utf8');
    ok(/全部 verified：是/.test(text), '每日报告未标记全部通过');
}

if (errors.length > 0) {
    console.error('[verify-content] 失败：');
    for (const e of errors.slice(0, 30)) console.error(' -', e);
    process.exit(1);
}
console.log(`[verify-content] OK：120 关 / 365 题 / 84 异变 / 每月 4 类目标 / 全部 verified`);
