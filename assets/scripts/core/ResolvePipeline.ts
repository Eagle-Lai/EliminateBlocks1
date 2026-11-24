/**
 * 结算管线：消除组 → 重力 → 满行 → 循环，直到棋盘稳定。
 *
 * 设计要点：
 * 1. 纯逻辑，不依赖引擎；表现层通过 hooks 介入（播放动画 / 等待动画结束）。
 * 2. 每个 await 之后校验取消令牌，重开/切场景可立即中断，避免"串局"。
 * 3. 迭代上限 24 次，防止异常数据导致死循环。
 */
import { TUNING } from '../config/GameTuning';
import type { Cell } from '../config/PieceShapeTable';
import type { BoardModel } from './BoardModel';
import { applyGravity } from './GravityResolver';
import { findGroups, flattenCells, type GroupInfo } from './MatchFinder';
import type { LevelService } from './LevelService';
import type { ScoreService } from './ScoreService';
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
    ) {}

    async run(token: CancelToken): Promise<ResolveResult> {
        let chain = 0;
        let iterations = 0;
        const max = TUNING.settle.maxIterations;

        for (; iterations < max; iterations++) {
            token.throwIfCancelled();

            const groups = findGroups(
                this.board,
                TUNING.rules.minGroupSize,
                TUNING.rules.requireTwoPieces,
            );

            if (groups.length > 0) {
                chain++;
                const scored = this.score.computeGroupScore(groups, chain);
                const cells = flattenCells(groups);

                this.score.add(scored.gain);
                this.hooks.onPop({
                    groups,
                    cells,
                    chain,
                    gain: scored.gain,
                    base: scored.base,
                    mult: scored.mult,
                    biggest: scored.biggest,
                    anchor: scored.anchor,
                });
                this.hooks.onScore(scored.gain, this.score.score, scored.anchor);

                await this.hooks.wait(TUNING.settle.popMs);
                token.throwIfCancelled();

                this.board.removeCells(cells);
                applyGravity(this.board);
                await this.hooks.onSync(TUNING.settle.dropMs);
                token.throwIfCancelled();
                continue;
            }

            const rows = this.board.fullRows();
            if (rows.length > 0) {
                const gain = this.score.computeRowScore(rows.length, this.level.level);
                const middleRow = rows[Math.floor(rows.length / 2)];
                this.hooks.onRowClear({
                    rows,
                    gain,
                    anchor: { r: middleRow, c: Math.floor(this.board.cols / 2) },
                });

                await this.hooks.wait(TUNING.settle.rowFadeMs);
                token.throwIfCancelled();

                this.score.add(gain);
                this.hooks.onScore(gain, this.score.score, {
                    r: middleRow,
                    c: Math.floor(this.board.cols / 2),
                });

                this.board.clearRows(rows);
                await this.hooks.onSync(TUNING.settle.rowShiftMs);
                token.throwIfCancelled();

                // 消行后连锁计数归零（与原型一致）
                chain = 0;
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
        }

        return { iterations, chains: chain };
    }
}
