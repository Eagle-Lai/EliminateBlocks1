/**
 * 回放播放器：同种子 + 同动作 → 完全一致的分数与棋盘。
 * 用 core 的模拟器重演，不依赖引擎，可在 Node 单测里断言。
 */
import { BoardModel } from './BoardModel';
import { rotationCells } from './PieceSource';
import { simulateLock } from './Simulator';
import type { ReplayData } from './InputRecorder';
import type { SimLockOptions } from './Simulator';

export interface SimulatedReplay {
    score: number;
    dump: string;
    locks: number;
    /** 首个与快照不一致的锁号（null 表示全部一致） */
    mismatchAt: number | null;
}

export class ReplayPlayer {
    static simulate(data: ReplayData, opts: SimLockOptions = {}): SimulatedReplay {
        const rows = data.initialBoard.length;
        const cols = rows > 0 ? data.initialBoard[0].length : 0;
        const board = rows > 0 ? BoardModel.fromPattern(data.initialBoard) : new BoardModel(10, 16);
        void cols;

        let score = 0;
        let locks = 0;
        let mismatchAt: number | null = null;
        const snapshotByLock = new Map<number, { score: number; board: string }>();
        for (const snap of data.snapshots) snapshotByLock.set(snap.lock, snap);

        for (const action of data.actions) {
            if (action.t !== 'lock') continue;
            locks++;
            const cells = rotationCells(action.shape, action.rotation);
            const result = simulateLock(board, cells, action.x, action.y, action.color, locks, opts);
            score += result.gain;
            const snap = snapshotByLock.get(locks);
            if (snap && mismatchAt === null) {
                if (snap.score !== score || snap.board !== board.dump()) mismatchAt = locks;
            }
        }

        return { score, dump: board.dump(), locks, mismatchAt };
    }

    /** 断言回放保真（单测/验收用） */
    static verify(data: ReplayData, opts: SimLockOptions = {}): boolean {
        const sim = ReplayPlayer.simulate(data, opts);
        return sim.mismatchAt === null && sim.score === data.score;
    }
}
