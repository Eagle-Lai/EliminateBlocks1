/**
 * 结算表现层：把 ResolvePipeline 的 hooks 落到 Prefab 视图上。
 * 规则（特殊块/重力/阈值）也在这里组装，保证"天赋只经 Modifiers"。
 */
import { Vec3, tween } from 'cc';
import { ResolvePipeline, type PopInfo, type ResolveHooks, type ResolveRules, type RowClearInfo } from '../core/ResolvePipeline';
import type { Cell } from '../config/PieceShapeTable';
import type { BlockData, BoardModel } from '../core/BoardModel';
import { expandSpecial } from '../core/SpecialResolver';
import { planSpecials, writeSpecials, type SpecialSpawn } from '../core/SpecialBlocks';
import { breakAdjacentBlockers } from '../core/Simulator';
import { FogVision } from '../core/FogVision';
import { SPECIAL_TABLE } from '../config/SpecialBlockTable';
import { THEME } from '../config/ThemeConfig';
import { TUNING } from '../config/GameTuning';
import type { ScoreService } from '../core/ScoreService';
import type { LevelService } from '../core/LevelService';
import type { RunContext } from '../app/RunContext';
import { GameScreenView } from '../view/GameScreenView';
import { BurstPool } from '../fx/BurstPool';
import { audio } from '../service/AudioService';
import { haptic } from '../service/HapticService';
import { wait } from '../utils/Anim';

export interface ResolveStats {
    removedCells: number;
    chainSum: number;
    maxChain: number;
    rows: number;
    specials: number;
}

export class ResolvePresenter {
    private _pending: SpecialSpawn[] = [];
    private _stats: ResolveStats = { removedCells: 0, chainSum: 0, maxChain: 0, rows: 0, specials: 0 };
    private _allowSpecials = false;
    private _anchor?: Cell;
    private _activeColor = -1;
    private _recolors: ReturnType<typeof expandSpecial>['recolors'] = [];

    constructor(
        private readonly view: GameScreenView,
        private readonly model: BoardModel,
        private readonly score: ScoreService,
        private readonly level: LevelService,
        private readonly pool: BurstPool,
    ) {}

    prepare(allowSpecials: boolean, anchor?: Cell, activeColor = -1): void {
        this._anchor = anchor;
        this._activeColor = activeColor;
        this._recolors = [];
        this._allowSpecials = allowSpecials;
        this._pending = [];
        this._stats = { removedCells: 0, chainSum: 0, maxChain: 0, rows: 0, specials: 0 };
    }

    get stats(): ResolveStats {
        return this._stats;
    }

    async run(run: RunContext, flushGravity = false): Promise<ResolveStats> {
        const pipeline = new ResolvePipeline(this.model, this.score, this.level, this._hooks(run), this._rules(run));
        await pipeline.run(run.token, { flushGravity });
        return this._stats;
    }

    private _rules(run: RunContext): ResolveRules {
        const mods = run.mods;
        const mutation = run.mutation;
        const baseMin = mutation?.minGroupSize || run.config.minGroupSize;
        const minGroupSize = Math.max(2, baseMin + mods.minGroupSizeDelta);

        return {
            minGroupSize,
            skipKinds: ['stone', 'brittle'],
            gravity: {
                dir: mutation?.dir ?? 1,
                policy: mutation && mutation.deferredEvery > 0 ? 'deferred' : 'immediate',
            },
            modifiers: mods,
            expandPop: (info, baseCells) => {
                if (this._allowSpecials && run.config.specials) {
                    this._pending = planSpecials(this.model, info.groups, this._anchor ?? info.anchor, true);
                }
                const expanded = expandSpecial(this.model, baseCells);
                for (const trigger of expanded.triggers) {
                    const def = SPECIAL_TABLE[trigger.special];
                    const pos = this.view.board?.cellToLocal(trigger.at.r, trigger.at.c) ?? new Vec3(0, 0, 0);
                    const fxKey = def.fx === 'shockwave' ? 'shockwaveFx' : def.fx === 'prism' ? 'prismFx' : def.fx === 'frost' ? 'frostFx' : 'burstFx';
                    this.pool.play(fxKey, pos.x, pos.y, 320);
                    audio.play(def.triggerSfx as never, 0.8);
                }
                this._recolors = expanded.recolors;
                return expanded.cells;
            },
            afterRemove: (_info, removedCells) => {
                for (const recolor of this._recolors) {
                    const block = this.model.get(recolor.cell.r, recolor.cell.c);
                    if (block) this.model.set(recolor.cell.r, recolor.cell.c, { ...block, type: recolor.type });
                }
                this._recolors = [];
                if (this._pending.length > 0) {
                    const overflow = writeSpecials(this.model, this._pending);
                    this.score.add(overflow * TUNING.specials.overflowScore + this._pending.length * mods.specialScoreBonus);
                    this._stats.specials += this._pending.length;
                    if (run.goal) run.goal.onSpecialCreated(this._pending.length);
                    const first = this._pending[0];
                    const pos = this.view.board?.cellToLocal(first.cell.r, first.cell.c) ?? new Vec3(0, 0, 0);
                    this.pool.play('burstFx', pos.x, pos.y, 280);
                    audio.play('special_spawn_stripe', 0.8);
                    this._pending = [];
                }
                const broken = breakAdjacentBlockers(this.model, removedCells);
                if (broken.length > 0) {
                    this._stats.removedCells += broken.length;
                    for (const item of broken) {
                        if (item.block.kind === 'stone') {

                            audio.play('stone_break', 0.7);
                        }
                    }
                    run.recordCleared(broken.map(b => b.block));
                }
            },
        };
    }

    private _hooks(run: RunContext): ResolveHooks {
        return {
            onPop: (info: PopInfo) => {
                const blocks: BlockData[] = [];
                for (const cell of info.cells) {
                    const block = this.model.get(cell.r, cell.c);
                    if (block) blocks.push(block);
                }
                this._stats.chainSum += info.chain;
                this._stats.maxChain = Math.max(this._stats.maxChain, info.chain);
                this._stats.removedCells += info.cells.length;
                run.groupCount += info.groups.length;
                run.recordCleared(blocks);

                void this.view.board?.playPop(this.model, info.cells, TUNING.settle.popMs);
                const board = this.view.board;
                if (board) {
                    // 同一轮最多三簇，爆点落在各组自身的中心。
                    for (const group of info.groups.slice(0, 3)) {
                        let row = 0;
                        let col = 0;
                        for (const cell of group.cells) { row += cell.r; col += cell.c; }
                        const center = board.cellToLocal(row / group.size, col / group.size);
                        this.pool.play('burstFx', center.x, center.y, 390);
                    }
                    if (info.chain >= 2 || info.biggest >= 5) {
                        this.view.flyScoreStars(board.cellToLocal(info.anchor.r, info.anchor.c), info.chain >= 2 ? 3 : 2);
                    }
                }

                if (info.biggest >= 5) this.view.banner?.show(`同色 ×${info.biggest}`, 'combo');
                else if (info.chain >= 2) this.view.banner?.show(`连锁 ×${info.chain}`, 'chain');

                audio.play(info.biggest >= 6 ? 'pop_high' : info.biggest >= 4 ? 'pop_mid' : 'pop_low');
                if (info.chain >= 2) {
                    this.shake(6);
                    haptic.medium();
                } else {
                    haptic.light();
                }
            },
            onRowClear: (info: RowClearInfo) => {
                void this.view.board?.playRowFlash(this.model, info.rows, TUNING.settle.rowFadeMs);
                const anchor = this.view.board?.cellToLocal(info.anchor.r, info.anchor.c);
                if (anchor) this.view.flyScoreStars(anchor, 3);
                this.view.banner?.show(info.rows.length > 1 ? `整行清除 ×${info.rows.length}` : '整行清除', 'row');
                audio.play('row');
                this.shake(8);
                haptic.medium();
                const removed: BlockData[] = [];
                for (const row of info.rows) {
                    for (let col = 0; col < this.model.cols; col++) {
                        const block = this.model.get(row, col);
                        if (block) removed.push(block);
                    }
                }
                run.recordCleared(removed);
                this._stats.removedCells += removed.length;
                run.rowsCleared += info.rows.length;
                this._stats.rows += info.rows.length;
                run.goal?.onRowClear(info.rows.length);
            },
            onSync: async (ms: number) => {
                const fogRows = run.mutation?.fogRows ?? 0;
                const visible = fogRows > 0
                    ? FogVision.compute(this.model, fogRows, this._activeColor)
                    : undefined;
                await this.view.board?.rebuild(this.model, ms, { fogRows, visible });
            },
            onScore: (gain: number, total: number, anchor) => {
                this.view.hud?.setScore(total);
                this.view.hud?.setProgress(this.level.progress(total));
                const pos = this.view.board?.cellToLocal(anchor.r, anchor.c) ?? new Vec3(0, 0, 0);
                this.view.floats?.spawn(`+${gain}`, pos, THEME.floatScore);
                run.goal?.syncScore(total);
            },
            onLevelUp: (level: number) => {
                this.view.hud?.setLevel(level);
                this.view.hud?.setProgress(this.level.progress(this.score.score));
                this.view.banner?.show(`升至 ${level} 级`, 'level');
                audio.play('levelup');
            },
            wait: (ms: number) => wait(ms),
        };
    }

    private shake(strength: number): void {
        const host = this.view.boardHost;
        if (!host) return;
        const base = host.position.clone();
        tween(host)
            .to(0.03, { position: new Vec3(base.x + strength, base.y, 0) })
            .to(0.03, { position: new Vec3(base.x - strength * 0.8, base.y, 0) })
            .to(0.03, { position: new Vec3(base.x + strength * 0.4, base.y, 0) })
            .to(0.04, { position: new Vec3(base.x, base.y, 0) })
            .start();
    }
}
