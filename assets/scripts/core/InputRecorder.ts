/**
 * 输入记录器：语义动作日志（落点 / 糖爆 / 天赋）+ 每 4 锁快照。
 * 单条 ≤30KB；最近 10 局 FIFO（由 ReplayStore 负责）。
 */
import { BoardModel } from './BoardModel';
import { SPECIAL_ORDER } from '../config/SpecialBlockTable';

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
    version: 1 | 2;
    frames?: ReplayFrame[];
    /** 根据实玩末盘独立计算，用于发现增量遗漏或存储损坏。 */
    finalChecksum?: string;
    /** 超限重定基准后的首帧，以及在此前完成的锁数。 */
    initialFrame?: ReplayFrame;
    initialLocks?: number;
    partial?: boolean;
    id: string;
    seed: number;
    mode: string;
    score: number;
    initialBoard: string[];
    actions: ReplayAction[];
    snapshots: ReplaySnapshot[];
    createdAt: number;
}

// [一维坐标] 表示清空，非空格保存颜色、来源骨牌、特殊种类和生成顺序。
type ChangedCell = [number, number?, number?, number?, number?];
export interface ReplayFrame {
    score: number;
    cells: ChangedCell[];
}

export function replayChecksum(board: BoardModel, score: number, locks: number): string {
    const cells = board.grid.map(row => row.map(block => block
        ? [block.type, block.pid, block.kind ?? 'normal', block.special ?? '', block.specialOrder ?? 0]
        : null));
    const text = JSON.stringify([board.cols, board.rows, score, locks, cells]);
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
    return (hash >>> 0).toString(16);
}

function diffBoard(previous: BoardModel, current: BoardModel, score: number): ReplayFrame {
    const cells: ChangedCell[] = [];
    for (let r = 0; r < current.rows; r++) {
        for (let c = 0; c < current.cols; c++) {
            const before = previous.get(r, c);
            const block = current.get(r, c);
            if (before?.pid === block?.pid && before?.type === block?.type && before?.special === block?.special
                && before?.kind === block?.kind && before?.specialOrder === block?.specialOrder) continue;
            const change: ChangedCell = [r * current.cols + c];
            if (block) {
                change.push(block.kind === 'brittle' ? -2 : block.type, block.pid);
                if (block.special) {
                    change.push(SPECIAL_ORDER.indexOf(block.special));
                    if (block.specialOrder !== undefined) change.push(block.specialOrder);
                }
            }
            cells.push(change);
        }
    }
    return { cells, score };
}

export function applyReplayFrame(board: BoardModel, frame: ReplayFrame): void {
    for (const change of frame.cells) {
        const [index, type, pid, special, order] = change;
        const r = Math.floor(index / board.cols);
        const c = index % board.cols;
        if (type === undefined) board.set(r, c, null);
        else if (type < 0) board.set(r, c, { pid, type: -1, kind: type === -2 ? 'brittle' : 'stone' });
        else if (special !== undefined) {
            const block = { pid, type, special: SPECIAL_ORDER[special] };
            board.set(r, c, order === undefined ? block : { ...block, specialOrder: order });
        }
        else board.set(r, c, { pid, type });
    }
}

export function replayStart(data: ReplayData): BoardModel {
    const board = data.initialBoard.length ? BoardModel.fromPattern(data.initialBoard) : new BoardModel(10, 16);
    if (data.initialFrame) applyReplayFrame(board, data.initialFrame);
    return board;
}

/** 同时接受已发布的 v1 动作和 v2 增量。校验失败时可跳过该条存档。 */
export function isReplayData(value: unknown): value is ReplayData {
    if (!value || typeof value !== 'object') return false;
    const data = value as Partial<ReplayData>;
    if ((data.version !== 1 && data.version !== 2) || typeof data.id !== 'string'
        || typeof data.mode !== 'string' || !Number.isFinite(data.score) || !Number.isFinite(data.seed)
        || !Array.isArray(data.initialBoard) || !Array.isArray(data.actions) || !Array.isArray(data.snapshots)) return false;
    const rows = data.initialBoard.length || 16;
    const cols = data.initialBoard.length ? data.initialBoard[0]?.length : 10;
    const validPattern = (pattern: readonly string[]) => pattern.length === rows
        && pattern.every(row => typeof row === 'string' && row.length === cols && /^[.0-4SB]+$/.test(row));
    if (!cols || (data.initialBoard.length > 0 && !validPattern(data.initialBoard))) return false;
    const integer = (n: number, low: number, high = Number.MAX_SAFE_INTEGER) =>
        Number.isSafeInteger(n) && n >= low && n <= high;
    if (!data.actions.every(action => {
        if (!action || !integer(action.lock, 0)) return false;
        if (action.t === 'burst') return integer(action.level, 1, 3);
        if (action.t === 'talent') return integer(action.id, 1, 30);
        return action.t === 'lock' && integer(action.shape, 0, 6) && integer(action.color, 0, 4)
            && integer(action.rotation, 0, 3) && integer(action.x, 0, cols - 1) && integer(action.y, -4, rows + 3);
    })) return false;
    if (!data.snapshots.every(s => s && integer(s.lock, 0) && Number.isFinite(s.score)
        && typeof s.board === 'string' && validPattern(s.board.split('\n')))) return false;
    if (data.version === 1) return true;
    const validCell = (cell: ChangedCell): boolean => {
        if (!Array.isArray(cell) || !integer(cell[0], 0, cols * rows - 1)) return false;
        if (cell.length === 1) return true;
        if (!integer(cell[1], -2, 4) || !Number.isSafeInteger(cell[2])) return false;
        if (cell.length === 3) return true;
        if (cell[1] < 0 || !integer(cell[3], 0, SPECIAL_ORDER.length - 1)) return false;
        return cell.length === 4 || (cell.length === 5 && integer(cell[4], 0));
    };
    const validFrame = (frame: ReplayFrame) => !!frame && Number.isFinite(frame.score)
        && Array.isArray(frame.cells) && frame.cells.every(validCell);
    if (data.finalChecksum !== undefined && (typeof data.finalChecksum !== 'string'
        || !/^[0-9a-f]{1,8}$/.test(data.finalChecksum))) return false;
    return Array.isArray(data.frames) && data.frames.length === data.actions.length && data.frames.every(validFrame)
        && (!data.initialFrame || validFrame(data.initialFrame))
        && (data.initialLocks === undefined || integer(data.initialLocks, 0));
}

export class InputRecorder {
    private _actions: ReplayAction[] = [];
    private _snapshots: ReplaySnapshot[] = [];
    private _locks = 0;
    private _frames: ReplayFrame[] = [];
    private _lastBoard: BoardModel | null = null;
    private _beforeFrame: BoardModel | null = null;

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

    recordFrame(board: BoardModel, score: number): void {
        const index = this._actions.length - 1;
        if (index < 0) {
            this._lastBoard = board.clone();
            return;
        }
        const previous = this._lastBoard ?? BoardModel.fromPattern(this.initialBoard);
        // 同一动作（例如保存前的终局）允许再次提交，以该动作开始时的棋盘为基准。
        if (this._frames.length <= index) this._beforeFrame = previous;
        this._frames[index] = diffBoard(this._beforeFrame ?? previous, board, score);
        this._lastBoard = board.clone();
    }

    capture() {
        return { actions: this._actions.length, frames: this._frames.length, snapshots: this._snapshots.length,
            locks: this._locks, last: this._lastBoard, before: this._beforeFrame, lastFrame: this._frames[this._frames.length - 1] };
    }

    restore(state: ReturnType<InputRecorder['capture']>): void {
        this._actions.length = state.actions;
        this._frames.length = state.frames;
        if (state.frames > 0) this._frames[state.frames - 1] = state.lastFrame;
        this._snapshots.length = state.snapshots;
        this._locks = state.locks;
        this._lastBoard = state.last;
        this._beforeFrame = state.before;
    }

    snapshot(board: BoardModel, score: number, everyLocks: number): void {
        if (everyLocks <= 0) return;
        if (this._locks % everyLocks !== 0) return;
        this._snapshots.push({ lock: this._locks, score, board: board.dump() });
    }

    finalize(score: number): ReplayData {
        return {
            version: 2,
            frames: this._frames.slice(),
            finalChecksum: replayChecksum(this._lastBoard ?? BoardModel.fromPattern(this.initialBoard), score, this._locks),
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
        this._frames = [];
        this._lastBoard = null;
        this._beforeFrame = null;
        this._actions = [];
        this._snapshots = [];
        this._locks = 0;
    }
}

/** 序列化体积（字节，UTF-16 估算偏高，用于 30KB 上限判断） */
export function replayBytes(data: ReplayData): number {
    return JSON.stringify(data).length * 2;
}

/** 保留近期动作时，把前缀实际结束的盘面与分数绑定为新的起点。 */
export function trimReplay(data: ReplayData, maxBytes: number): ReplayData {
    if (replayBytes(data) <= maxBytes) return data;
    let out: ReplayData = { ...data, snapshots: [] };
    if (replayBytes(out) <= maxBytes) return out;
    if (data.version === 1) {
        // 旧格式的快照缺少 pid 与特殊糖；保留从原始起盘可重演的前缀，并标示不完整。
        while (out.actions.length && replayBytes(out) > maxBytes) {
            out = { ...out, partial: true, actions: out.actions.slice(0, Math.floor(out.actions.length * 0.75)) };
        }
        return out;
    }
    const base = replayStart(data);
    const blank = new BoardModel(base.cols, base.rows);
    let locks = data.initialLocks ?? 0;
    while (out.actions.length && replayBytes(out) > maxBytes) {
        const cut = Math.max(1, Math.ceil(out.actions.length / 4));
        let score = out.initialFrame?.score ?? 0;
        for (let i = 0; i < cut; i++) {
            if (out.actions[i].t === 'lock') locks++;
            const frame = out.frames?.[i];
            if (frame) { applyReplayFrame(base, frame); score = frame.score; }
        }
        out = { ...out, partial: true, initialLocks: locks, initialBoard: blank.dump().split('\n'),
            initialFrame: diffBoard(blank, base, score), actions: out.actions.slice(cut), frames: out.frames?.slice(cut) };
    }
    return out;
}
