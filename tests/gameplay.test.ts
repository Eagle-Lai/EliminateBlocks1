/**
 * 新玩法单测：特殊块 / 糖能 / 天赋 / 异变 / 目标 / 迷雾 / 模拟器 / 回放。
 * 运行：npx tsx tests/gameplay.test.ts
 */
import assert from 'node:assert';
import { BoardModel } from '../assets/scripts/core/BoardModel';
import { findGroups, groupLineAxis } from '../assets/scripts/core/MatchFinder';
import { planSpecials, specialForGroup, writeSpecials } from '../assets/scripts/core/SpecialBlocks';
import { expandSpecial, dominantColor, countSpecials } from '../assets/scripts/core/SpecialResolver';
import { SugarEnergy } from '../assets/scripts/core/SugarEnergy';
import { emptyModifiers, mergeModifiers } from '../assets/scripts/core/Modifiers';
import { TalentPool, TALENT_GROUP_TRIGGERS, TALENT_SKIP_COINS, LEGENDARY_CHANCE } from '../assets/scripts/core/TalentPool';
import { TalentService } from '../assets/scripts/core/TalentService';
import { TALENT_TABLE } from '../assets/scripts/config/TalentTable';
import { MutationRuntime } from '../assets/scripts/core/MutationRuntime';
import { validateMutationCombo, MUTATION_TABLE } from '../assets/scripts/config/MutationTable';
import { GoalTracker } from '../assets/scripts/core/GoalTracker';
import { FogVision } from '../assets/scripts/core/FogVision';
import { simulateLock, applyBurst, breakAdjacentBlockers, simulateSettle } from '../assets/scripts/core/Simulator';
import { ReplayPlayer } from '../assets/scripts/core/ReplayPlayer';
import { trimReplay, replayBytes, type ReplayData } from '../assets/scripts/core/InputRecorder';
import { GreedyBot, placementsFor } from '../assets/scripts/core/Solver';
import { ShadowTrack } from '../assets/scripts/core/ShadowTrack';
import { difficultyForWeekday, DIFFICULTY_MOVE_LIMIT, monthDayFromDayOfYear, isMutationWeek, dateKey } from '../assets/scripts/core/DailyPuzzle';
import { Rng } from '../assets/scripts/utils/Rng';
import { CancelToken } from '../assets/scripts/utils/CancelToken';
import { ResolvePipeline } from '../assets/scripts/core/ResolvePipeline';
import { ScoreService } from '../assets/scripts/core/ScoreService';
import { LevelService } from '../assets/scripts/core/LevelService';
import { TUNING } from '../assets/scripts/config/GameTuning';

let passed = 0;
function test(name: string, fn: () => void | Promise<void>): Promise<void> {
    return Promise.resolve()
        .then(fn)
        .then(() => {
            passed++;
            console.log(`  ✓ ${name}`);
        })
        .catch((err) => {
            console.error(`  ✗ ${name}`);
            throw err;
        });
}

const board = (pattern: string[]) => BoardModel.fromPattern(pattern);
const b = (type: number, pid: number) => ({ type, pid });
const blank = () => new BoardModel(10, 16);

async function main(): Promise<void> {
    console.log('特殊块生成');
    await test('4 格横线 → 横条纹', () => {
        const g = { cells: [{ r: 15, c: 0 }, { r: 15, c: 1 }, { r: 15, c: 2 }, { r: 15, c: 3 }], size: 4, pidCount: 2 };
        assert.equal(specialForGroup(g), 'stripeH');
    });
    await test('4 格竖线 → 竖条纹', () => {
        const g = { cells: [{ r: 12, c: 2 }, { r: 13, c: 2 }, { r: 14, c: 2 }, { r: 15, c: 2 }], size: 4, pidCount: 2 };
        assert.equal(specialForGroup(g), 'stripeV');
    });
    await test('5 格横线 → 彩虹', () => {
        const g = { cells: [0, 1, 2, 3, 4].map((c) => ({ r: 15, c })), size: 5, pidCount: 2 };
        assert.equal(specialForGroup(g), 'rainbow');
    });
    await test('5 格十字 → 十字块', () => {
        const g = { cells: [{ r: 15, c: 2 }, { r: 14, c: 2 }, { r: 16, c: 2 }, { r: 15, c: 1 }, { r: 15, c: 3 }], size: 5, pidCount: 2 };
        assert.equal(specialForGroup(g), 'cross');
    });
    await test('5 格非共线非十字 → 炸弹', () => {
        const g = { cells: [{ r: 15, c: 0 }, { r: 15, c: 1 }, { r: 14, c: 1 }, { r: 14, c: 2 }, { r: 13, c: 2 }], size: 5, pidCount: 2 };
        assert.equal(specialForGroup(g), 'bomb');
    });
    await test('6 格 → 棱镜', () => {
        const g = { cells: [0, 1, 2, 3, 4, 5].map((c) => ({ r: 15, c })), size: 6, pidCount: 2 };
        assert.equal(specialForGroup(g), 'prism');
    });
    await test('3 格不生成', () => {
        const g = { cells: [{ r: 15, c: 0 }, { r: 15, c: 1 }, { r: 15, c: 2 }], size: 3, pidCount: 2 };
        assert.equal(specialForGroup(g), null);
    });
    await test('锚点不在组内时取最近格', () => {
        const bd = board(['..........', '..........', '..........', '..........', '..........', '..........', '..........', '..........', '..........', '..........', '..........', '..........', '..........', '..........', '..........', '0000......']);
        const groups = findGroups(bd);
        const spawns = planSpecials(bd, groups, { r: 8, c: 0 }, true);
        assert.equal(spawns.length, 1);
        assert.deepEqual(spawns[0].cell, { r: 15, c: 0 });
    });
    await test('close 上限：allow=false 不生成', () => {
        const bd = board(['0000......']);
        void bd;
        assert.equal(planSpecials(blank(), [{ cells: [{ r: 15, c: 0 }], size: 4, pidCount: 2 }], { r: 15, c: 0 }, false).length, 0);
    });
    await test('writeSpecials 写回并保留形状', () => {
        const bd = blank();
        writeSpecials(bd, [{ cell: { r: 15, c: 0 }, special: 'bomb', type: 2, pid: 7 }]);
        const block = bd.get(15, 0);
        assert.equal(block?.special, 'bomb');
        assert.equal(block?.type, 2);
        assert.equal(block?.pid, 7);
    });

    console.log('特殊块触发');
    await test('横条纹清整行', () => {
        const bd = blank();
        for (let c = 0; c < 10; c++) bd.set(15, c, b(0, c + 1));
        bd.set(15, 3, { type: 0, pid: 1, special: 'stripeH' });
        const res = expandSpecial(bd, [{ r: 15, c: 3 }]);
        assert.equal(res.cells.length, 10);
        assert.equal(res.triggers.length, 1);
    });
    await test('竖条纹清整列', () => {
        const bd = blank();
        for (let r = 0; r < 16; r++) bd.set(r, 5, b(1, r + 1));
        bd.set(10, 5, { type: 1, pid: 1, special: 'stripeV' });
        const res = expandSpecial(bd, [{ r: 10, c: 5 }]);
        assert.equal(res.cells.length, 16);
    });
    await test('炸弹清 3×3', () => {
        const bd = blank();
        for (let r = 13; r <= 15; r++) for (let c = 3; c <= 5; c++) bd.set(r, c, b(2, r * 10 + c));
        bd.set(14, 4, { type: 2, pid: 1, special: 'bomb' });
        const res = expandSpecial(bd, [{ r: 14, c: 4 }]);
        assert.equal(res.cells.length, 9);
    });
    await test('十字清整行 + 整列', () => {
        const bd = blank();
        for (let c = 0; c < 10; c++) bd.set(14, c, b(3, c + 1));
        for (let r = 0; r < 16; r++) bd.set(r, 4, b(3, 100 + r));
        bd.set(14, 4, { type: 3, pid: 1, special: 'cross' });
        const res = expandSpecial(bd, [{ r: 14, c: 4 }]);
        assert.equal(res.cells.length, 10 + 16 - 1);
    });
    await test('彩虹清最多颜色（平票取小）', () => {
        const bd = blank();
        bd.set(15, 0, { type: 0, pid: 1, special: 'rainbow' });
        bd.set(15, 1, b(1, 2));
        bd.set(15, 2, b(1, 3));
        bd.set(14, 0, b(0, 4));
        bd.set(14, 1, b(0, 5));
        assert.equal(dominantColor(bd), 0);
        const res = expandSpecial(bd, [{ r: 15, c: 0 }]);
        assert.ok(res.cells.length >= 3);
    });
    await test('棱镜把 8 邻格染色（不加入清除）', () => {
        const bd = blank();
        bd.set(8, 5, { type: 2, pid: 1, special: 'prism' });
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            bd.set(8 + dr, 5 + dc, b(0, dr * 10 + dc + 50));
        }
        const res = expandSpecial(bd, [{ r: 8, c: 5 }]);
        assert.equal(res.recolors.length, 8);
    });
    await test('countSpecials 统计场上特殊块', () => {
        const bd = blank();
        bd.set(15, 0, { type: 0, pid: 1, special: 'bomb' });
        bd.set(15, 1, { type: 0, pid: 2, special: 'rainbow' });
        assert.equal(countSpecials(bd), 2);
    });

    console.log('糖能');
    await test('公式：格数×2 + 连锁×4', () => {
        const s = new SugarEnergy();
        s.add(10, 2);
        assert.equal(s.value, 28);
    });
    await test('上限 100', () => {
        const s = new SugarEnergy();
        s.add(100, 10);
        assert.equal(s.value, 100);
        assert.equal(s.full, true);
    });
    await test('满槽每锁 +5', () => {
        const s = new SugarEnergy();
        s.add(60, 0);
        s.addLockBonus();
        assert.equal(s.value, 100);
    });
    await test('释放等级 1/2/3', () => {
        const s = new SugarEnergy();
        assert.equal(s.nextLevel, 1);
        s.add(60, 0);
        assert.equal(s.consume(), 1);
        s.add(60, 0);
        assert.equal(s.consume(), 2);
        s.add(60, 0);
        assert.equal(s.consume(), 3);
        assert.equal(s.bursts, 3);
    });
    await test('目标色平票取色号最小', () => {
        const bd = blank();
        bd.set(15, 0, b(3, 1));
        bd.set(15, 1, b(1, 2));
        assert.equal(SugarEnergy.targetColor(bd), 1);
    });
    await test('reset 清零', () => {
        const s = new SugarEnergy();
        s.add(80, 0);
        s.consume();
        s.reset();
        assert.equal(s.value, 0);
        assert.equal(s.bursts, 0);
    });

    console.log('天赋修正');
    await test('数值相加', () => {
        const mods = mergeModifiers(emptyModifiers(), { groupScoreAdd: 10 });
        assert.equal(mergeModifiers(mods, { groupScoreAdd: 5 }).groupScoreAdd, 15);
    });
    await test('倍率相乘', () => {
        const mods = mergeModifiers(emptyModifiers(), { scoreMul: 1.1 });
        assert.ok(Math.abs(mergeModifiers(mods, { scoreMul: 1.2 }).scoreMul - 1.32) < 1e-9);
    });
    await test('次数取最大', () => {
        const mods = mergeModifiers(emptyModifiers(), { shieldCharges: 2 });
        assert.equal(mergeModifiers(mods, { shieldCharges: 3 }).shieldCharges, 3);
    });
    await test('布尔取或', () => {
        const mods = mergeModifiers(emptyModifiers(), { extraColumn: true });
        assert.equal(mergeModifiers(mods, { extraColumn: false }).extraColumn, true);
    });

    console.log('天赋池');
    await test('三张至少一张普通', () => {
        for (let seed = 1; seed < 40; seed++) {
            const offer = TalentPool.offer(new Rng(seed), { owned: [], legendaryUsed: false });
            assert.equal(offer.length, 3);
            assert.ok(offer.some((t) => t.rarity === 'common'), `seed ${seed}`);
        }
    });
    await test('不重复', () => {
        const offer = TalentPool.offer(new Rng(9), { owned: [], legendaryUsed: false });
        assert.equal(new Set(offer.map((t) => t.id)).size, offer.length);
    });
    await test('同类 ≤2', () => {
        for (let seed = 1; seed < 80; seed++) {
            const offer = TalentPool.offer(new Rng(seed), { owned: [], legendaryUsed: false });
            const counts = new Map<string, number>();
            for (const t of offer) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
            for (const n of counts.values()) assert.ok(n <= 2);
        }
    });
    await test('传说每局 ≤1', () => {
        for (let seed = 1; seed < 100; seed++) {
            const offer = TalentPool.offer(new Rng(seed), { owned: [], legendaryUsed: false });
            assert.ok(offer.filter((t) => t.rarity === 'legendary').length <= 1);
        }
    });
    await test('同种子同三卡', () => {
        const a = TalentPool.offer(new Rng(1234), { owned: [1, 2], legendaryUsed: false });
        const b2 = TalentPool.offer(new Rng(1234), { owned: [1, 2], legendaryUsed: false });
        assert.deepEqual(a.map((t) => t.id), b2.map((t) => t.id));
    });
    await test('传说概率 3%', () => {
        assert.ok(Math.abs(LEGENDARY_CHANCE - 0.03) < 1e-9);
    });
    await test('选卡应用修正', () => {
        const svc = new TalentService();
        const offers = svc.offer(new Rng(5));
        const pick = offers[0];
        assert.equal(svc.pick(pick.id), true);
        assert.ok(svc.mods.scoreMul >= 1);
        assert.equal(svc.offersUsed, 1);
    });
    await test('跳过 +15 金币', () => {
        const svc = new TalentService();
        svc.offer(new Rng(6));
        assert.equal(svc.skip(), TALENT_SKIP_COINS);
        assert.equal(svc.skipCoins, 15);
    });
    await test('触发点 6/12/18', () => {
        assert.deepEqual([...TALENT_GROUP_TRIGGERS], [6, 12, 18]);
        const svc = new TalentService();
        assert.equal(svc.shouldOffer(5), false);
        assert.equal(svc.shouldOffer(6), true);
    });
    await test('30 个天赋 id 唯一', () => {
        assert.equal(TALENT_TABLE.length, 30);
        assert.equal(new Set(TALENT_TABLE.map((t) => t.id)).size, 30);
    });
    await test('天赋效果只走 Modifiers 字段', () => {
        const allowed = new Set(Object.keys(emptyModifiers()));
        for (const t of TALENT_TABLE) {
            for (const k of Object.keys(t.mods)) assert.ok(allowed.has(k), `${t.id} ${k}`);
        }
    });

    console.log('异变');
    await test('霜雨插行并留缺口', () => {
        const bd = blank();
        const m = new MutationRuntime(1, 'standard', new Rng(1));
        const events = m.onLock(bd, 6, 0);
        const row = bd.grid[15];
        const filled = row.filter((x) => !!x).length;
        assert.equal(filled, 8);
        assert.equal(events[0].type, 'frostRain');
    });
    await test('霜雨挤出顶部计入 pushedOut', () => {
        const bd = blank();
        for (let c = 0; c < 10; c++) bd.set(0, c, b(0, c + 1));
        const m = new MutationRuntime(1, 'strong', new Rng(2));
        const events = m.onLock(bd, 4, 0);
        assert.ok(events[0].type === 'frostRain' && events[0].pushedOut > 0);
    });
    await test('脆霜每 4 步冻结 2 格', () => {
        const bd = blank();
        for (let c = 0; c < 6; c++) bd.set(15, c, b(0, c + 1));
        const m = new MutationRuntime(7, 'standard', new Rng(3));
        const events = m.onLock(bd, 4, 0);
        assert.equal(events[0].type, 'brittle');
        assert.equal(bd.countKind('brittle'), 2);
    });
    await test('脆霜邻接消除碎裂', () => {
        const bd = blank();
        bd.set(15, 0, b(0, 1));
        bd.set(15, 1, { type: -1, pid: -1, kind: 'brittle' });
        const broken = breakAdjacentBlockers(bd, [{ r: 15, c: 0 }]);
        assert.equal(broken.length, 1);
        assert.equal(bd.get(15, 1), null);
    });
    await test('磁力整列位移', () => {
        const bd = blank();
        bd.set(15, 3, b(0, 1));
        const m = new MutationRuntime(8, 'strong', new Rng(4));
        const events = m.onLock(bd, 3, 0);
        assert.equal(events[0].type, 'magnet');
        assert.equal(bd.blockCount(), 1, '位移不增删方块');
    });
    await test('磁力遇阻反向', () => {
        const bd = blank();
        for (let c = 0; c < 10; c++) bd.set(15, c, b(0, c + 1));
        const m = new MutationRuntime(8, 'strong', new Rng(5));
        const events = m.onLock(bd, 3, 0);
        assert.ok(events[0].type === 'magnet');
    });
    await test('倒悬方向 dir=-1', () => {
        const m = new MutationRuntime(4, 'standard', new Rng(6));
        assert.equal(m.dir, -1);
    });
    await test('迷雾行数 5/8/11', () => {
        assert.equal(new MutationRuntime(2, 'light', new Rng(1)).fogRows, 5);
        assert.equal(new MutationRuntime(2, 'standard', new Rng(1)).fogRows, 8);
        assert.equal(new MutationRuntime(2, 'strong', new Rng(1)).fogRows, 11);
    });
    await test('单色诅咒阈值与颜色数', () => {
        const m = new MutationRuntime(5, 'standard', new Rng(1));
        assert.equal(m.minGroupSize, 4);
        assert.equal(m.colorCount, 2);
    });
    await test('逆流延迟塌陷间隔', () => {
        const m = new MutationRuntime(6, 'standard', new Rng(1));
        assert.equal(m.deferredEvery, 5);
    });
    await test('镜像位置正确', () => {
        const m = new MutationRuntime(3, 'standard', new Rng(1));
        const cells = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 1 }, { r: 1, c: 2 }];
        const mirrored = m.mirrorOf(cells, 2, 10);
        assert.equal(mirrored.x, 5);
        assert.deepEqual(mirrored.cells.map((p) => p.c), [2, 1, 1, 0]);
    });
    await test('插入整行并整体上移', () => {
        const bd = blank();
        bd.set(15, 0, b(0, 1));
        bd.insertBottomRow([null, null, null, null, null, null, null, null, null, b(1, 9)]);
        assert.equal(bd.get(14, 0)?.type, 0);
        assert.equal(bd.get(15, 9)?.type, 1);
    });
    await test('clearRows dir=-1 向上压实', () => {
        const bd = blank();
        bd.set(0, 0, b(0, 1));
        bd.set(1, 0, b(0, 2));
        bd.clearRows([0], -1);
        assert.equal(bd.get(0, 0)?.type, 0);
    });
    await test('禁忌组合被拦截', () => {
        assert.ok(validateMutationCombo([1, 4]));
        assert.ok(validateMutationCombo([3, 8]));
        assert.equal(validateMutationCombo([1, 2]), null);
    });
    await test('8 条异变 × 3 档齐全', () => {
        assert.equal(MUTATION_TABLE.length, 8);
        for (const m of MUTATION_TABLE) {
            assert.ok(m.tiers.light && m.tiers.standard && m.tiers.strong);
        }
    });

    console.log('目标 / 迷雾');
    await test('颜色目标只统计目标色', () => {
        const g = new GoalTracker({ type: 'color', target: 3, color: 1 });
        g.onPop([{ type: 1, pid: 1 }, { type: 2, pid: 1 }, { type: 1, pid: 2 }]);
        assert.equal(g.value, 2);
    });
    await test('石块目标只统计 stone', () => {
        const g = new GoalTracker({ type: 'stone', target: 2 });
        g.onPop([{ type: -1, pid: -1, kind: 'stone' }, { type: 0, pid: 1 }]);
        assert.equal(g.value, 1);
    });
    await test('消行目标', () => {
        const g = new GoalTracker({ type: 'rows', target: 2 });
        g.onRowClear(2);
        assert.equal(g.done, true);
    });
    await test('特殊块目标', () => {
        const g = new GoalTracker({ type: 'special', target: 2 });
        g.onSpecialCreated(2);
        assert.equal(g.done, true);
    });
    await test('糖爆目标', () => {
        const g = new GoalTracker({ type: 'burst', target: 1 });
        g.onBurst();
        assert.equal(g.done, true);
    });
    await test('分数目标同步', () => {
        const g = new GoalTracker({ type: 'score', target: 100 });
        g.syncScore(120);
        assert.equal(g.done, true);
        assert.equal(g.ratio, 1);
    });
    await test('迷雾下方永远可见', () => {
        const bd = blank();
        const visible = FogVision.compute(bd, 5);
        assert.equal(visible[10][0], true);
        assert.equal(visible[0][0], false);
    });
    await test('迷雾内同色相邻显形', () => {
        const bd = blank();
        bd.set(5, 3, b(1, 1));
        bd.set(4, 3, b(1, 2));
        const visible = FogVision.compute(bd, 5);
        assert.equal(visible[4][3], true);
    });
    await test('当前骨牌同色显形', () => {
        const bd = blank();
        bd.set(2, 2, b(3, 1));
        const visible = FogVision.compute(bd, 5, 3);
        assert.equal(visible[2][2], true);
    });

    console.log('模拟器 / 回放');
    await test('simulateLock 计分并清盘', () => {
        const bd = blank();
        bd.set(15, 0, b(0, 1));
        bd.set(15, 1, b(0, 2));
        const res = simulateLock(bd, [{ r: 0, c: 0 }], 2, 15, 0, 3);
        assert.ok(res.gain > 0);
        assert.equal(bd.blockCount(), 0);
    });
    await test('模拟器按规则生成特殊块', () => {
        const bd = blank();
        bd.set(15, 0, b(0, 1));
        bd.set(15, 1, b(0, 2));
        bd.set(15, 2, b(0, 3));
        const res = simulateLock(bd, [{ r: 0, c: 0 }], 3, 15, 0, 4, { specials: true });
        assert.equal(res.specials, 1);
        assert.equal(countSpecials(bd), 1);
    });
    await test('糖爆清除目标色', () => {
        const bd = blank();
        bd.set(15, 0, b(1, 1));
        bd.set(15, 1, b(1, 2));
        bd.set(15, 2, b(2, 3));
        const cells = applyBurst(bd, 1, 0);
        assert.equal(cells.length, 2);
        assert.equal(bd.get(15, 2)?.type, 2);
    });
    await test('回放同种子完全一致', () => {
        const bd = blank();
        const data: ReplayData = {
            version: 1, id: 'x', seed: 1, mode: 'level', score: 0,
            initialBoard: bd.dump().split('\n'),
            actions: [
                { t: 'lock', lock: 1, shape: 1, color: 0, rotation: 0, x: 4, y: 14 },
                { t: 'lock', lock: 2, shape: 1, color: 0, rotation: 0, x: 6, y: 14 },
            ],
            snapshots: [], createdAt: 0,
        };
        const sim = ReplayPlayer.simulate(data);
        assert.equal(sim.locks, 2);
        assert.equal(sim.mismatchAt, null);
    });
    await test('回放超过 30KB 会被裁剪', () => {
        const data: ReplayData = {
            version: 1, id: 'y', seed: 1, mode: 'level', score: 0,
            initialBoard: blank().dump().split('\n'),
            actions: Array.from({ length: 400 }, (_, i) => ({ t: 'lock' as const, lock: i + 1, shape: 1, color: 0, rotation: 0, x: 4, y: 14 })),
            snapshots: Array.from({ length: 50 }, (_, i) => ({ lock: i, score: i, board: blank().dump() })),
            createdAt: 0,
        };
        const trimmed = trimReplay(data, 30 * 1024);
        assert.ok(replayBytes(trimmed) <= 30 * 1024);
    });
    await test('影子反超只触发一次', () => {
        const track = new ShadowTrack(5000, 120);
        track.load({ bestScore: 1000, samples: [{ t: 0, score: 0 }, { t: 10000, score: 100 }], seed: 1, recordId: 'r' });
        assert.equal(track.feed(1000, 50), true);
        assert.equal(track.feed(2000, 60), false);
    });
    await test('倒悬落点向上', () => {
        const bd = blank();
        const placements = placementsFor(bd, 1, -1, false);
        assert.ok(placements.length > 0);
        assert.ok(placements[0].y < 16);
    });
    await test('贪心机器人不会立刻堆顶', () => {
        const res = new GreedyBot(7).play(blank(), 20, { type: 'score', target: 999999 });
        assert.equal(res.topOut, false);
        assert.ok(res.score > 0);
    });
    await test('deferred 重力在 flush 时才塌陷', async () => {
        const bd = blank();
        bd.set(15, 0, b(0, 1));
        bd.set(15, 1, b(0, 2));
        bd.set(15, 2, b(0, 3));
        bd.set(10, 0, b(2, 4));
        const score = new ScoreService();
        const level = new LevelService();
        let syncs = 0;
        const pipeline = new ResolvePipeline(bd, score, level, {
            onPop: () => void 0,
            onRowClear: () => void 0,
            onSync: async () => { syncs++; },
            onScore: () => void 0,
            onLevelUp: () => void 0,
            wait: async () => void 0,
        }, { gravity: { dir: 1, policy: 'deferred' } });
        await pipeline.run(new CancelToken());
        assert.equal(bd.get(10, 0)?.type, 2, '消除后不塌陷');
        await pipeline.run(new CancelToken(), { flushGravity: true });
        assert.equal(bd.get(10, 0), null);
        assert.ok(syncs > 0);
    });

    console.log('日期');
    await test('星期 → 难度', () => {
        assert.equal(difficultyForWeekday(1), 'easy');
        assert.equal(difficultyForWeekday(3), 'medium');
        assert.equal(difficultyForWeekday(5), 'mediumPlus');
        assert.equal(difficultyForWeekday(6), 'hard');
    });
    await test('难度 → 步数', () => {
        assert.equal(DIFFICULTY_MOVE_LIMIT.easy, 10);
        assert.equal(DIFFICULTY_MOVE_LIMIT.hard, 6);
    });
    await test('day-of-year → 月日', () => {
        assert.deepEqual(monthDayFromDayOfYear(1), { month: 1, day: 1 });
        assert.deepEqual(monthDayFromDayOfYear(32), { month: 2, day: 1 });
        assert.deepEqual(monthDayFromDayOfYear(365), { month: 12, day: 31 });
    });
    await test('异变周 1–7 日', () => {
        assert.equal(isMutationWeek(1, 1), true);
        assert.equal(isMutationWeek(1, 7), true);
        assert.equal(isMutationWeek(1, 8), false);
    });
    await test('日期键补零', () => {
        assert.equal(dateKey(new Date(2027, 0, 5)), '2027-01-05');
    });
    await test('升级曲线不变', () => {
        const level = new LevelService();
        level.tryLevelUp(1500);
        assert.equal(level.dropIntervalMs, 790);
        level.tryLevelUp(1000000);
        assert.equal(level.dropIntervalMs, 130);
    });
    await test('六不变量：10×16 / 5 色 / 7 形状 / 阈值 3 / 下落 850', () => {
        assert.equal(TUNING.board.cols, 10);
        assert.equal(TUNING.board.rows, 16);
        assert.equal(TUNING.board.colorCount, 5);
        assert.equal(TUNING.rules.minGroupSize, 3);
        assert.equal(TUNING.speed.startMs, 850);
    });
    await test('单块自身不消（pidCount<2）', () => {
        const bd = blank();
        bd.set(15, 0, b(0, 9));
        bd.set(15, 1, b(0, 9));
        bd.set(15, 2, b(0, 9));
        assert.equal(findGroups(bd).length, 0);
    });
    await test('line axis 判定', () => {
        assert.equal(groupLineAxis([{ r: 1, c: 0 }, { r: 1, c: 1 }]), 'h');
        assert.equal(groupLineAxis([{ r: 0, c: 1 }, { r: 1, c: 1 }]), 'v');
        assert.equal(groupLineAxis([{ r: 0, c: 0 }, { r: 1, c: 1 }]), null);
    });

    console.log(`\n新玩法单测通过：${passed} 项`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
