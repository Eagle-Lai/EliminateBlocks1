/**
 * 输入记录器：语义动作日志（落点 / 糖爆 / 天赋）+ 每 4 锁快照。
 * 单条 ≤30KB；最近 10 局 FIFO（由 ReplayStore 负责）。
 */
import type { BoardModel } from './BoardModel';

export interface ReplayPlacement {
    shape: number;
    color: number;
    rotation: number;
    x: number;
    y: number;
}

export type ReplayAction =
    | ({ t: 'lock'; lock: number } & ReplayPlacement)
    | { t: 'burst'; lock: number; level: number }
    | { t: 'talent'; lock: number; id: number };

export interface ReplaySnapshot {
    lock: number;
    score: number;
    board: string;
}

export interface ReplayData {
    version: 1;
    id: string;
    seed: number;
    mode: string;
    score: number;
    initialBoard: string[];
    actions: ReplayAction[];
    snapshots: ReplaySnapshot[];
    createdAt: number;
}

export class InputRecorder {
    private _actions: ReplayAction[] = [];
    private _snapshots: ReplaySnapshot[] = [];
    private _locks = 0;

    constructor(
        readonly seed: number,
        readonly mode: string,
        private readonly initialBoard: string[],
        private readonly id: string,
    ) {}

    get locks(): number {
        return this._locks;
    }

    get actions(): readonly ReplayAction[] {
        return this._actions;
    }

    recordLock(piece: ReplayPlacement): void {
        this._locks++;
        this._actions.push({ t: 'lock', lock: this._locks, ...piece });
    }

    recordBurst(level: number): void {
        this._actions.push({ t: 'burst', lock: this._locks, level });
    }

    recordTalent(id: number): void {
        this._actions.push({ t: 'talent', lock: this._locks, id });
    }

    snapshot(board: BoardModel, score: number, everyLocks: number): void {
        if (everyLocks <= 0) return;
        if (this._locks % everyLocks !== 0) return;
        this._snapshots.push({ lock: this._locks, score, board: board.dump() });
    }

    finalize(score: number): ReplayData {
        return {
            version: 1,
            id: this.id,
            seed: this.seed,
            mode: this.mode,
            score,
            initialBoard: this.initialBoard.slice(),
            actions: this._actions.slice(),
            snapshots: this._snapshots.slice(),
            createdAt: Date.now(),
        };
    }

    reset(): void {
        this._actions = [];
        this._snapshots = [];
        this._locks = 0;
    }
}

/** 序列化体积（字节，UTF-16 估算偏高，用于 30KB 上限判断） */
export function replayBytes(data: ReplayData): number {
    return JSON.stringify(data).length * 2;
}

/** 超限时裁剪：优先丢早期快照与早期动作（保留最后 40% 动作） */
export function trimReplay(data: ReplayData, maxBytes: number): ReplayData {
    const out: ReplayData = { ...data, actions: data.actions.slice(), snapshots: data.snapshots.slice() };
    while (replayBytes(out) > maxBytes && out.snapshots.length > 1) out.snapshots.shift();
    while (replayBytes(out) > maxBytes && out.actions.length > 8) out.actions.shift();
    return out;
}
