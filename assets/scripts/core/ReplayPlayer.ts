/**
 * v2 按实玩记录的棋盘增量、分数还原；v1 走旧动作模拟，并与已有快照核对。
 */
import { rotationCells } from './PieceSource';
import { simulateLock } from './Simulator';
import { applyReplayFrame, replayChecksum, replayStart, type ReplayData } from './InputRecorder';
import { LevelService } from './LevelService';
import type { SimLockOptions } from './Simulator';

export interface SimulatedReplay {
    score: number;
    dump: string;
    locks: number;
    /** 首个与快照不一致的锁号（null 表示全部一致） */
    mismatchAt: number | null;
}

export class ReplayPlayer {
    static renderAt(data: ReplayData, index: number, opts: SimLockOptions = {}) {
        const board = replayStart(data);
        let score = data.initialFrame?.score ?? 0;
        let locks = data.initialLocks ?? 0;
        let mismatchAt: number | null = null;
        const level = new LevelService();
        const snapshots = new Map(data.snapshots.map(s => [s.lock, s] as const));
        for (let i = 0; i < Math.min(index, data.actions.length); i++) {
            const action = data.actions[i];
            if (action.t === 'lock') locks++;
            if (data.version === 2) {
                const frame = data.frames?.[i];
                if (!frame) {
                    if (mismatchAt === null) mismatchAt = locks;
                    continue;
                }
                applyReplayFrame(board, frame);
                score = frame.score;
            } else if (action.t === 'lock') {
                const cells = rotationCells(action.shape, action.rotation);
                score += simulateLock(board, cells, action.x, action.y, action.color, locks, {
                    level: level.level, specials: data.mode !== 'endless', ...opts,
                }).gain;
                level.tryLevelUp(score);
            } else if (mismatchAt === null) {
                mismatchAt = locks;
            }
            if (action.t === 'lock') {
                const snap = snapshots.get(locks);
                if (snap && (snap.score !== score || snap.board !== board.dump()) && mismatchAt === null) mismatchAt = locks;
            }
        }
        return { board, score, locks, mismatchAt };
    }

    static simulate(data: ReplayData, opts: SimLockOptions = {}): SimulatedReplay {
        const { board, score, locks, mismatchAt } = this.renderAt(data, data.actions.length, opts);
        return { score, locks, mismatchAt, dump: board.dump() };
    }

    static verify(data: ReplayData, opts: SimLockOptions = {}): boolean {
        const sim = this.renderAt(data, data.actions.length, opts);
        if (data.version === 2) {
            if (!data.finalChecksum || replayChecksum(sim.board, sim.score, sim.locks) !== data.finalChecksum) return false;
        } else {
            // 仅分数碰巧相同不能证明末盘一致；保留旧版的播放能力，区分可验证记录。
            const final = data.snapshots.find(s => s.lock === sim.locks);
            if (data.partial || !final || final.board !== sim.board.dump() || final.score !== sim.score) return false;
        }
        return sim.mismatchAt === null && sim.score === data.score;
    }
}
