/**
 * 计分（纯计算 + 累计）。
 * 组：每组 size*(size+1)/2*15，全部求和后乘连锁倍率。
 * 行：行数*200*等级，不乘连锁倍率。
 */
import type { GroupInfo } from './MatchFinder';
import { biggestAnchor } from './MatchFinder';
import type { Cell } from '../config/PieceShapeTable';
import { TUNING } from '../config/GameTuning';

export interface GroupScoreResult {
    base: number;
    mult: number;
    gain: number;
    biggest: number;
    anchor: Cell;
}

export class ScoreService {
    private _score = 0;

    get score(): number {
        return this._score;
    }

    reset(): void {
        this._score = 0;
    }

    add(delta: number): void {
        this._score += delta;
    }

    /** 组消除得分（chain 从 1 开始） */
    computeGroupScore(groups: readonly GroupInfo[], chain: number): GroupScoreResult {
        let base = 0;
        let biggest = 0;
        for (const g of groups) {
            base += (g.size * (g.size + 1)) / 2 * TUNING.score.groupPair;
            biggest = Math.max(biggest, g.size);
        }
        const mult = 1 + (chain - 1) * TUNING.score.chainStep;
        return {
            base,
            mult,
            gain: Math.round(base * mult),
            biggest,
            anchor: biggestAnchor(groups),
        };
    }

    computeRowScore(rowCount: number, level: number): number {
        return rowCount * TUNING.score.rowClear * level;
    }
}
