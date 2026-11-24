/**
 * 核心逻辑单测（不依赖引擎，直接跑在 Node 上）。
 * 运行：npx tsx tests/core.test.ts
 */
import assert from 'node:assert';
import { BoardModel } from '../assets/scripts/core/BoardModel';
import { findGroups } from '../assets/scripts/core/MatchFinder';
import { applyGravity } from '../assets/scripts/core/GravityResolver';
import { ScoreService } from '../assets/scripts/core/ScoreService';
import { LevelService } from '../assets/scripts/core/LevelService';
import { ResolvePipeline, type PopInfo, type RowClearInfo } from '../assets/scripts/core/ResolvePipeline';
import { PieceFactory } from '../assets/scripts/core/PieceFactory';
import { collides, findDropY } from '../assets/scripts/core/CollisionService';
import { tryRotate } from '../assets/scripts/core/Rotator';
import { SHAPES } from '../assets/scripts/config/PieceShapeTable';
import { Rng } from '../assets/scripts/utils/Rng';
import { CancelToken, CancelError } from '../assets/scripts/utils/CancelToken';
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

const b = (type: number, pid: number) => ({ type, pid });
const newBoard = () => new BoardModel(TUNING.board.cols, TUNING.board.rows);

async function main(): Promise<void> {
    console.log('MatchFinder');

    await test('单块自身 3 连不消除', () => {
        const board = newBoard();
        board.set(15, 0, b(0, 1));
        board.set(15, 1, b(0, 1));
        board.set(15, 2, b(0, 1));
        assert.equal(findGroups(board).length, 0);
    });

    await test('两个骨牌的同色 3 连可消除', () => {
        const board = newBoard();
        board.set(15, 0, b(0, 1));
        board.set(15, 1, b(0, 1));
        board.set(15, 2, b(0, 2));
        const groups = findGroups(board);
        assert.equal(groups.length, 1);
        assert.equal(groups[0].size, 3);
        assert.equal(groups[0].pidCount, 2);
    });

    await test('对角不连通', () => {
        const board = newBoard();
        board.set(15, 0, b(1, 1));
        board.set(14, 1, b(1, 2));
        board.set(13, 2, b(1, 3));
        assert.equal(findGroups(board).length, 0);
    });

    await test('同色 2 连不消除', () => {
        const board = newBoard();
        board.set(15, 0, b(2, 1));
        board.set(15, 1, b(2, 2));
        assert.equal(findGroups(board).length, 0);
    });

    await test('十字形连通块整体消除（5 格 / 5 块）', () => {
        const board = newBoard();
        board.set(15, 5, b(3, 1));
        board.set(14, 5, b(3, 2));
        board.set(13, 5, b(3, 3));
        board.set(15, 4, b(3, 4));
        board.set(15, 6, b(3, 5));
        const groups = findGroups(board);
        assert.equal(groups.length, 1);
        assert.equal(groups[0].size, 5);
        assert.equal(groups[0].pidCount, 5);
    });

    await test('两组同时命中时全部返回', () => {
        const board = newBoard();
        board.set(15, 0, b(0, 1));
        board.set(15, 1, b(0, 2));
        board.set(15, 2, b(0, 3));
        board.set(15, 6, b(1, 4));
        board.set(15, 7, b(1, 5));
        board.set(15, 8, b(1, 6));
        board.set(15, 9, b(1, 7));
        const groups = findGroups(board);
        assert.equal(groups.length, 2);
        assert.deepEqual(groups.map((g) => g.size).sort(), [3, 4]);
    });

    console.log('ScoreService');

    await test('组基础分：3 格 90 / 4 格 150 / 5 格 225 / 6 格 315', () => {
        const score = new ScoreService();
        const mk = (n: number) => ({
            cells: Array.from({ length: n }, (_, i) => ({ r: 0, c: i })),
            size: n,
            pidCount: 2,
        });
        assert.equal(score.computeGroupScore([mk(3)], 1).base, 90);
        assert.equal(score.computeGroupScore([mk(4)], 1).base, 150);
        assert.equal(score.computeGroupScore([mk(5)], 1).base, 225);
        assert.equal(score.computeGroupScore([mk(6)], 1).base, 315);
    });

    await test('连锁倍率 1 / 1.5 / 2.0', () => {
        const score = new ScoreService();
        const g = [{ cells: [{ r: 0, c: 0 }], size: 4, pidCount: 2 }];
        assert.equal(score.computeGroupScore(g, 1).gain, 150);
        assert.equal(score.computeGroupScore(g, 2).gain, 225);
        assert.equal(score.computeGroupScore(g, 3).gain, 300);
    });

    await test('消行分 = 行数 × 200 × 等级', () => {
        const score = new ScoreService();
        assert.equal(score.computeRowScore(1, 1), 200);
        assert.equal(score.computeRowScore(2, 3), 1200);
    });

    await test('多组求和后统一乘倍率', () => {
        const score = new ScoreService();
        const groups = [
            { cells: [{ r: 0, c: 0 }], size: 3, pidCount: 2 },
            { cells: [{ r: 1, c: 0 }], size: 4, pidCount: 2 },
        ];
        assert.equal(score.computeGroupScore(groups, 2).gain, Math.round((90 + 150) * 1.5));
    });

    console.log('LevelService');

    await test('阈值 1500 / 3000 / 4500', () => {
        const level = new LevelService();
        assert.deepEqual(level.tryLevelUp(1499), []);
        assert.deepEqual(level.tryLevelUp(1500), [2]);
        assert.deepEqual(level.tryLevelUp(3000), [3]);
        assert.deepEqual(level.tryLevelUp(4500), [4]);
    });

    await test('一次结算可连续升级（修正原型缺陷）', () => {
        const level = new LevelService();
        assert.deepEqual(level.tryLevelUp(4500), [2, 3, 4]);
    });

    await test('下落间隔曲线与下限', () => {
        const level = new LevelService();
        assert.equal(level.dropIntervalMs, 850);
        level.tryLevelUp(1500);
        assert.equal(level.dropIntervalMs, 790);
        level.tryLevelUp(1000000);
        assert.equal(level.dropIntervalMs, 130);
    });

    await test('等级进度 0..1', () => {
        const level = new LevelService();
        assert.equal(level.progress(0), 0);
        assert.equal(level.progress(750), 0.5);
        assert.equal(level.progress(1500), 1, '刚好达标时进度条应为满');
        level.tryLevelUp(1500);
        assert.equal(level.progress(2250), 0.5);
    });

    console.log('GravityResolver / BoardModel');

    await test('逐列下落压缩，且保留对象身份', () => {
        const board = newBoard();
        const block = b(0, 1);
        board.set(10, 0, block);
        const moves = applyGravity(board);
        assert.equal(moves.length, 1);
        assert.equal(board.get(15, 0), block, '同一对象被移动到新位置');
        assert.equal(board.get(10, 0), null);
    });

    await test('竖直同色 3 连可消除（重力后常见形态）', () => {
        const board = newBoard();
        board.set(15, 0, b(0, 1));
        board.set(14, 0, b(0, 2));
        board.set(13, 0, b(0, 3));
        const groups = findGroups(board);
        assert.equal(groups.length, 1);
        assert.equal(groups[0].size, 3);
    });

    await test('clearRows 保留上方行并整体下移', () => {
        const board = newBoard();
        for (let c = 0; c < board.cols; c++) board.set(15, c, b(1, 1));
        const above = b(2, 2);
        board.set(14, 3, above);
        board.clearRows([15]);
        assert.equal(board.get(15, 3), above, '上方行应下移到最底行');
        assert.equal(board.get(14, 3), null);
    });

    await test('fullRows 识别满行', () => {
        const board = newBoard();
        for (let c = 0; c < board.cols; c++) board.set(12, c, b(1, 1));
        assert.deepEqual(board.fullRows(), [12]);
    });

    console.log('Collision / Rotator');

    await test('左右与底部越界判定为碰撞', () => {
        const board = newBoard();
        const cells = [{ r: 0, c: 0 }];
        assert.equal(collides(board, cells, -1, 0), true);
        assert.equal(collides(board, cells, 10, 0), true);
        assert.equal(collides(board, cells, 0, 16), true);
        assert.equal(collides(board, cells, 0, 0), false);
    });

    await test('允许骨牌位于棋盘上方（y < 0）', () => {
        const board = newBoard();
        assert.equal(collides(board, [{ r: 0, c: 0 }], 0, -2), false);
    });

    await test('findDropY 落到最底行', () => {
        const board = newBoard();
        assert.equal(findDropY(board, [{ r: 0, c: 0 }], 0, 0), 15);
    });

    await test('I 形旋转 4 次回到初始态', () => {
        const factory = new PieceFactory(new Rng(1), 10, 5);
        const piece = factory.createByShape(0);
        const original = JSON.stringify(piece.cells);
        const board = newBoard();
        for (let i = 0; i < 4; i++) {
            assert.equal(tryRotate(piece, board), true);
        }
        assert.equal(JSON.stringify(piece.cells), original);
    });

    await test('旋转态长度恒为 4 且被归一化', () => {
        for (const shape of SHAPES) {
            for (const rot of shape.rotations) {
                assert.equal(rot.length, 4);
                const minR = Math.min(...rot.map((p) => p.r));
                const minC = Math.min(...rot.map((p) => p.c));
                assert.equal(minR, 0);
                assert.equal(minC, 0);
            }
        }
    });

    console.log('ResolvePipeline');

    await test('消除 → 计分 → 棋盘清空', async () => {
        const board = newBoard();
        board.set(15, 0, b(0, 1));
        board.set(15, 1, b(0, 2));
        board.set(15, 2, b(0, 3));

        const score = new ScoreService();
        const level = new LevelService();
        const pops: PopInfo[] = [];
        const syncs: number[] = [];
        const token = new CancelToken();

        const pipeline = new ResolvePipeline(board, score, level, {
            onPop: (info) => pops.push(info),
            onRowClear: (_info: RowClearInfo) => void 0,
            onSync: async (ms) => {
                syncs.push(ms);
            },
            onScore: () => void 0,
            onLevelUp: () => void 0,
            wait: async () => void 0,
        });

        const result = await pipeline.run(token);
        assert.equal(pops.length, 1);
        assert.equal(pops[0].gain, 90);
        assert.equal(score.score, 90);
        assert.equal(board.blockCount(), 0);
        assert.equal(result.chains, 1);
        assert.ok(syncs.length >= 1);
    });

    await test('连锁两次的倍率生效', async () => {
        const board = newBoard();
        // 先消 color1 的 3 连；随之三列下落后，三个 color0 块在底行汇合，形成第二次消除
        board.set(14, 0, b(1, 1));
        board.set(15, 0, b(1, 2));
        board.set(15, 1, b(1, 3));
        board.set(13, 0, b(0, 4));
        board.set(14, 1, b(0, 5));
        board.set(14, 2, b(0, 6));

        assert.equal(findGroups(board).length, 1, '初始只有一个可消组');

        const score = new ScoreService();
        const level = new LevelService();
        const gains: number[] = [];

        const pipeline = new ResolvePipeline(board, score, level, {
            onPop: (info) => gains.push(info.gain),
            onRowClear: () => void 0,
            onSync: async () => void 0,
            onScore: () => void 0,
            onLevelUp: () => void 0,
            wait: async () => void 0,
        });

        await pipeline.run(new CancelToken());
        assert.deepEqual(gains, [90, 135], '第二次 90 × 1.5 = 135');
        assert.equal(score.score, 225);
    });

    await test('结算被取消后立刻抛出 CancelError', async () => {
        const board = newBoard();
        board.set(15, 0, b(0, 1));
        board.set(15, 1, b(0, 2));
        board.set(15, 2, b(0, 3));

        const token = new CancelToken();
        const pipeline = new ResolvePipeline(board, new ScoreService(), new LevelService(), {
            onPop: () => token.cancel(),
            onRowClear: () => void 0,
            onSync: async () => void 0,
            onScore: () => void 0,
            onLevelUp: () => void 0,
            wait: async () => void 0,
        });

        await assert.rejects(() => pipeline.run(token), (err) => err instanceof CancelError);
    });

    console.log('Rng');

    await test('同种子结果可复现', () => {
        const a = new Rng(12345);
        const b2 = new Rng(12345);
        for (let i = 0; i < 20; i++) assert.equal(a.next(), b2.next());
    });

    await test('随机形状与颜色覆盖完整', () => {
        const factory = new PieceFactory(new Rng(7), 10, 5);
        const shapes = new Set<number>();
        const colors = new Set<number>();
        for (let i = 0; i < 500; i++) {
            const p = factory.create();
            shapes.add(p.shapeIndex);
            colors.add(p.color);
            assert.ok(p.x >= 0 && p.x + p.width <= 10);
        }
        assert.equal(shapes.size, 7);
        assert.equal(colors.size, 5);
    });

    await test('生成位置居中', () => {
        const factory = new PieceFactory(new Rng(3), 10, 5);
        const p = factory.createByShape(1); // O 形，宽 2
        assert.equal(p.x, 4);
    });

    console.log(`\n全部通过：${passed} 项`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
