/**
 * 三种模式的配置入口：无尽 / 关卡 / 每日残局。
 * 只产出数据，不碰引擎。
 */
import type { GoalDef } from '../core/GoalTracker';
import type { PieceSpec } from '../core/PieceSource';
import type { MutationTier } from '../config/MutationTable';
import { TUNING } from '../config/GameTuning';

export type GameModeKind = 'endless' | 'level' | 'daily' | 'replay';

export interface LevelLike {
    id: number;
    chapter: number;
    slot: number;
    name: string;
    mutationId: number;
    tier: MutationTier;
    goalType: 'score' | 'rows' | 'color' | 'special' | 'burst' | 'stone';
    target: number;
    goalColor?: number;
    star2: number;
    star3: number;
    seed: number;
    stoneSeed?: number;
    stoneCount?: number;
}

export interface RunConfig {
    mode: GameModeKind;
    seed: number;
    levelId?: number;
    dailyId?: number;
    dailyYear?: number;
    /** 异变 id 列表（空 = 无异变） */
    mutations: number[];
    mutationTier: MutationTier;
    /** 是否启用特殊块 */
    specials: boolean;
    /** 是否启用糖能 */
    sugar: boolean;
    /** 是否启用天赋 */
    talents: boolean;
    /** 是否采样影子 */
    shadow: boolean;
    /** 关卡/残局目标 */
    goal?: GoalDef;
    /** 残局步数上限 */
    moveLimit?: number;
    /** 初始盘面（字符画） */
    initialBoard?: string[];
    /** 固定牌序（残局） */
    pieceQueue?: PieceSpec[];
    colorCount: number;
    minGroupSize: number;
    /** 关卡名（HUD 用） */
    title: string;
    /** 星级门槛 */
    star2?: number;
    star3?: number;
    /** 石块关：开局铺石块数量 */
    stoneCount?: number;
    stoneSeed?: number;
    /** 残局提示首步（P2） */
    hint?: { shape: number; rotation: number; x: number };
}

export interface LevelResult {
    score: number;
    stars: number;
    goalDone: boolean;
    levelId: number;
}

export function endlessConfig(seed: number): RunConfig {
    return {
        mode: 'endless',
        seed,
        mutations: [],
        mutationTier: 'light',
        specials: TUNING.modes.endlessHasSpecials,
        sugar: true,
        talents: TUNING.modes.endlessHasTalents,
        shadow: true,
        colorCount: TUNING.board.colorCount,
        minGroupSize: TUNING.rules.minGroupSize,
        title: '无尽模式',
    };
}

export function levelConfig(level: LevelLike): RunConfig {
    return {
        mode: 'level',
        seed: level.seed,
        levelId: level.id,
        mutations: level.mutationId > 0 ? [level.mutationId] : [],
        mutationTier: level.tier,
        specials: true,
        sugar: true,
        talents: true,
        shadow: false,
        goal: {
            type: level.goalType,
            target: level.target,
            color: level.goalColor,
        },
        colorCount: TUNING.board.colorCount,
        minGroupSize: TUNING.rules.minGroupSize,
        title: level.name,
        star2: level.star2,
        star3: level.star3,
        stoneSeed: level.stoneSeed,
        stoneCount: level.goalType === 'stone' ? (level.stoneCount ?? level.target + 2) : 0,
    };
}

export function dailyConfig(puzzle: {
    id: number;
    moveLimit: number;
    goal: GoalDef;
    board: string[];
    queue: PieceSpec[];
    mutationId?: number;
    hint?: { shape: number; rotation: number; x: number };
}, puzzleYear = new Date().getFullYear()): RunConfig {
    return {
        mode: 'daily',
        seed: puzzle.id * 104729,
        dailyId: puzzle.id,
        dailyYear: puzzleYear,
        mutations: puzzle.mutationId ? [puzzle.mutationId] : [],
        mutationTier: 'standard',
        specials: true,
        sugar: true,
        talents: false,
        shadow: false,
        goal: puzzle.goal,
        moveLimit: puzzle.moveLimit,
        initialBoard: puzzle.board,
        pieceQueue: puzzle.queue,
        hint: puzzle.hint ?? undefined,
        colorCount: TUNING.board.colorCount,
        minGroupSize: TUNING.rules.minGroupSize,
        title: '每日残局',
    };
}

/** 星级：score 目标按 1.4 / 2.0 倍；其他目标按 base*m 的 1.2 / 1.8 倍（由关卡表预先算好） */
export function starsFor(score: number, goal: GoalDef, star2: number, star3: number): number {
    if (score >= star3) return 3;
    if (score >= star2) return 2;
    if (goal.type === 'score') return score >= goal.target ? 1 : 0;
    return 1;
}
