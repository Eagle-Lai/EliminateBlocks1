/** 单局上下文：runId + 取消令牌 + 随机源 + 本局统计。重开时整体替换。 */
import { CancelToken } from '../utils/CancelToken';
import { Rng } from '../utils/Rng';
import { emptyModifiers, type ModifierSet } from '../core/Modifiers';
import { SugarEnergy } from '../core/SugarEnergy';
import { TalentService } from '../core/TalentService';
import { MutationRuntime } from '../core/MutationRuntime';
import { GoalTracker } from '../core/GoalTracker';
import { InputRecorder } from '../core/InputRecorder';
import { ShadowTrack } from '../core/ShadowTrack';
import type { RunConfig } from './GameMode';
import { endlessConfig } from './GameMode';
import { TUNING } from '../config/GameTuning';

export class RunContext {
    readonly token = new CancelToken();
    readonly rng: Rng;
    rowsCleared = 0;
    maxChain = 0;
    pieces = 0;

    /** v2 新增 */
    readonly config: RunConfig;
    readonly sugar = new SugarEnergy();
    readonly talents = new TalentService();
    readonly goal: GoalTracker | null;
    readonly shadow: ShadowTrack;
    recorder: InputRecorder | null = null;
    mutation: MutationRuntime | null = null;

    score = 0;
    groupCount = 0;
    lockCount = 0;
    burstsUsed = 0;
    undoUsed = 0;
    lastLockAt = 0;
    elapsedMs = 0;
    shieldsUsed = 0;
    stoneCleared = 0;
    rows = 0;
    specialsCreated = 0;
    /** 逆流：延迟塌陷计数 */
    deferredLocks = 0;

    constructor(
        readonly runId: number,
        seed: number,
        config: RunConfig = endlessConfig(seed),
    ) {
        this.rng = new Rng(seed);
        this.config = config;
        this.goal = config.goal ? new GoalTracker(config.goal) : null;
        this.shadow = new ShadowTrack(TUNING.shadow.sampleMs, TUNING.shadow.maxSamples);
        if (config.mutations.length > 0) {
            this.mutation = new MutationRuntime(config.mutations[0], config.mutationTier, this.rng);
        }
        this.sugar.reset(this.mods.startSugar);
    }

    /** 撤销快照用 */
    get sugarValue(): number {
        return this.sugar.value;
    }

    get sugarBursts(): number {
        return this.sugar.bursts;
    }

    get mods(): ModifierSet {
        return this.talents.mods || emptyModifiers();
    }

    get isLevelMode(): boolean {
        return this.config.mode === 'level' || this.config.mode === 'daily';
    }

    get moveLimit(): number {
        return this.config.moveLimit ?? 0;
    }

    get movesLeft(): number {
        if (!this.config.moveLimit) return Number.POSITIVE_INFINITY;
        return Math.max(0, this.config.moveLimit - this.lockCount);
    }

    cancel(): void {
        this.token.cancel();
    }

    get cancelled(): boolean {
        return this.token.cancelled;
    }
}
