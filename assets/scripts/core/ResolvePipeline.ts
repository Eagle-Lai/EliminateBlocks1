/**
 * 结算管线：消除组 → 特殊扩展 → 重力 → 满行 → 循环，直到棋盘稳定。
 *
 * 设计要点：
 * 1. 纯逻辑，不依赖引擎；表现层通过 hooks 介入（播放动画 / 等待动画结束）。
 * 2. 每个 await 之后校验取消令牌，重开/切场景可立即中断，避免"串局"。
 * 3. 迭代上限 24 次，防止异常数据导致死循环。
 * 4. v2：可选 rules（特殊块 / 重力方向 / 延迟塌陷）。不传 rules 时与基线逐字节一致。
 */
import { TUNING } from '../config/GameTuning';
import type { Cell } from '../config/PieceShapeTable';
import type { BlockKind, BoardModel } from './BoardModel';
import { applyGravity } from './GravityResolver';
import { findGroups, flattenCells, type GroupInfo } from './MatchFinder';
import type { LevelService } from './LevelService';
import type { ScoreService } from './ScoreService';
import type { ModifierSet } from './Modifiers';
import type { CancelToken } from '../utils/CancelToken';

export interface PopInfo {
    groups: GroupInfo[];
    cells: Cell[];
    chain: number;
    gain: number;
    base: number;
    mult: number;
    biggest: number;
    anchor: Cell;
}

export interface RowClearInfo {
    rows: number[];
    gain: number;
    anchor: Cell;
}

export interface ResolveHooks {
    onPop(info: PopInfo): void;
    onRowClear(info: RowClearInfo): void;
    /** 棋盘数据已变更，表现层在此做一次 diff + 位移动画 */
    onSync(animateMs: number): Promise<void>;
    onScore(gain: number, total: number, anchor: Cell): void;
    onLevelUp(level: number, prevLevel: number): void;
    onGuardExceeded?(iterations: number): void;
    wait(ms: number): Promise<void>;
}

export type ResolveEvent =
    | { type: 'pop'; chain: number; cells: Cell[]; gain: number }
    | { type: 'rowClear'; rows: number[]; gain: number }
    | { type: 'gravity'; dir: 1 | -1; moves: number }
    | { type: 'levelUp'; level: number };

export interface ResolveRules {
    /** 消除阈值（默认 TUNING.rules.minGroupSize） */
    minGroupSize?: number;
    /** 不参与同色连通的阻挡块 */
    skipKinds?: readonly BlockKind[];
    /** 特殊块额外清除格（返回值为新增格） */
    expandPop?: (info: PopInfo, base: readonly Cell[]) => Cell[];
    /** 移除之后写模型（生成特殊块 / 棱镜染色 / 脆霜碎裂） */
    afterRemove?: (info: PopInfo, removed: readonly Cell[]) => void;
    /** 重力方向与策略 */
    gravity?: { dir: 1 | -1; policy: 'immediate' | 'deferred' };
    /** 只读玩法事件 */
    onEvent?: (e: ResolveEvent) => void;
    /** 迭代上限覆盖 */
    maxIterations?: number;
    /** 天赋修正（仅影响计分） */
    modifiers?: ModifierSet;
}

export interface ResolveResult {
    iterations: number;
    chains: number;
}

export class ResolvePipeline {
    constructor(
        private readonly board: BoardModel,
        private readonly score: ScoreService,
        private readonly level: LevelService,
        private readonly hooks: ResolveHooks,
        private readonly rules?: ResolveRules,
    ) {}

    async run(token: CancelToken, opts?: { flushGravity?: boolean }): Promise<ResolveResult> {
        let chain = 0;
        let iterations = 0;
        const max = this.rules?.maxIterations ?? TUNING.settle.maxIterations;

        const gravityDir = this.rules?.gravity?.dir ?? 1;
        const deferred = this.rules?.gravity?.policy === 'deferred';
        const minGroup = this.rules?.minGroupSize ?? TUNING.rules.minGroupSize;
        const skipKinds = this.rules?.skipKinds;

        // 逆流：进入结算时先把悬挂的方块统一塌陷（糖爆/到期时也会走这里）
        if (deferred && opts?.flushGravity) {
            const moves = applyGravity(this.board, gravityDir);
            if (moves.length > 0) {
                this.rules?.onEvent?.({ type: 'gravity', dir: gravityDir, moves: moves.length });
                await this.hooks.onSync(TUNING.settle.dropMs);
                token.throwIfCancelled();
            }
        }

        let coalesce = false;
        for (; iterations < max; iterations++) {
            token.throwIfCancelled();

            const groups = findGroups(
                this.board,
                minGroup,
                TUNING.rules.requireTwoPieces,
                skipKinds,
            );

            if (groups.length > 0) {
                chain++;
                const scored = this.score.computeGroupScore(groups, chain, this.rules?.modifiers);
                const baseCells = flattenCells(groups);
                const info: PopInfo = {
                    groups,
                    cells: baseCells,
                    chain,
                    gain: scored.gain,
                    base: scored.base,
                    mult: scored.mult,
                    biggest: scored.biggest,
                    anchor: scored.anchor,
                };

                // 特殊块扩展：命中特殊块时把影响范围并入本次消除
                let cells = baseCells;
                if (this.rules?.expandPop) {
                    const extra = this.rules.expandPop(info, baseCells);
                    if (extra.length > 0) {
                        const seen = new Set(baseCells.map((p) => `${p.r},${p.c}`));
                        const merged = baseCells.slice();
                        for (const p of extra) {
                            const k = `${p.r},${p.c}`;
                            if (seen.has(k)) continue;
                            seen.add(k);
                            merged.push(p);
                        }
                        cells = merged;
                        info.cells = cells;
                    }
                }

                this.score.add(scored.gain);
                this.hooks.onPop(info);
                this.hooks.onScore(scored.gain, this.score.score, scored.anchor);
                this.rules?.onEvent?.({ type: 'pop', chain, cells, gain: scored.gain });

                await this.hooks.wait(TUNING.settle.popMs);
                token.throwIfCancelled();

                this.board.removeCells(cells);
                if (this.rules?.afterRemove) this.rules.afterRemove(info, cells);

                if (!deferred) {
                    const moves = applyGravity(this.board, gravityDir);
                    this.rules?.onEvent?.({ type: 'gravity', dir: gravityDir, moves: moves.length });
                }
                await this.hooks.onSync(TUNING.settle.dropMs);
                token.throwIfCancelled();
                coalesce = true;
                continue;
            }

            const rows = this.board.fullRows();
            if (rows.length > 0) {
                const gain = this.score.computeRowScore(rows.length, this.level.level, this.rules?.modifiers);
                const middleRow = rows[Math.floor(rows.length / 2)];
                this.hooks.onRowClear({
                    rows,
                    gain,
                    anchor: { r: middleRow, c: Math.floor(this.board.cols / 2) },
                });
                this.rules?.onEvent?.({ type: 'rowClear', rows, gain });

                await this.hooks.wait(TUNING.settle.rowFadeMs);
                token.throwIfCancelled();

                this.score.add(gain);
                this.hooks.onScore(gain, this.score.score, {
                    r: middleRow,
                    c: Math.floor(this.board.cols / 2),
                });

                this.board.clearRows(rows, gravityDir);
                await this.hooks.onSync(TUNING.settle.rowShiftMs);
                token.throwIfCancelled();

                // 消行后连锁计数归零（与原型一致）
                chain = 0;
                coalesce = true;
                continue;
            }

            break;
        }

        if (iterations >= max && this.hooks.onGuardExceeded) {
            this.hooks.onGuardExceeded(iterations);
        }

        const levels = this.level.tryLevelUp(this.score.score);
        for (const lv of levels) {
            this.hooks.onLevelUp(lv, lv - 1);
            this.rules?.onEvent?.({ type: 'levelUp', level: lv });
        }

        void coalesce;
        return { iterations, chains: chain };
    }
}
