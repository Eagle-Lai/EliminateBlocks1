/**
 * 撤销快照（纯逻辑）：一次锁定的"事前状态"。
 * 棋盘用 dump 字符串保存（16×10 = 176 字节），其余是标量计数。
 */
import { BoardModel } from '../core/BoardModel';
import type { ScoreService } from '../core/ScoreService';
import type { LevelService } from '../core/LevelService';

export interface RunLike {
    sugarValue: number;
    sugarBursts: number;
    groupCount: number;
    lockCount: number;
    rowsCleared: number;
    deferredLocks: number;
}

export interface UndoSnapshot {
    dump: string;
    score: number;
    levelLevel: number;
    sugarValue: number;
    sugarBursts: number;
    groupCount: number;
    lockCount: number;
    rowsCleared: number;
    deferredLocks: number;

    /** 把棋盘写回模型（其余标量由调用方赋回） */
    restore(board: BoardModel): void;
}

/** 在锁定前调用：捕获"这一锁还没发生"的完整状态 */
export function captureUndo(
    board: BoardModel,
    score: ScoreService,
    level: LevelService,
    run: RunLike,
): UndoSnapshot {
    const original = board.clone();
    const dump = original.dump();
    return {
        dump,
        score: score.score,
        levelLevel: level.level,
        sugarValue: run.sugarValue,
        sugarBursts: run.sugarBursts,
        groupCount: run.groupCount,
        lockCount: run.lockCount,
        rowsCleared: run.rowsCleared,
        deferredLocks: run.deferredLocks,
        restore(target: BoardModel): void {
            target.copyFrom(original);
        },
    };
}

/** 供控制器透传的轻量适配 */
export function captureFromRun(
    board: BoardModel,
    score: ScoreService,
    level: LevelService,
    fields: {
        sugarValue: number;
        sugarBursts: number;
        groupCount: number;
        lockCount: number;
        rowsCleared: number;
        deferredLocks: number;
    },
): UndoSnapshot {
    return captureUndo(board, score, level, fields);
}
