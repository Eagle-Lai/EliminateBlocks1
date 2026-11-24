/**
 * 计分（纯计算 + 累计）。
 * 组：每组 size*(size+1)/2*15，全部求和后乘连锁倍率。
 * 行：行数*200*等级，不乘连锁倍率。
 * 天赋只通过可选 ModifierSet 介入；不传时与基线完全一致。
 */
import type { GroupInfo } from './MatchFinder';
import { biggestAnchor } from './MatchFinder';
import type { Cell } from '../config/PieceShapeTable';
import { TUNING } from '../config/GameTuning';
import type { ModifierSet } from './Modifiers';

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
    computeGroupScore(groups: readonly GroupInfo[], chain: number, mods?: ModifierSet): GroupScoreResult {
        let base = 0;
        let biggest = 0;
        for (const g of groups) {
            base += (g.size * (g.size + 1)) / 2 * TUNING.score.groupPair;
            biggest = Math.max(biggest, g.size);
        }
        if (mods) base += mods.groupScoreAdd * groups.length;
        const step = TUNING.score.chainStep + (mods ? mods.chainStepAdd : 0);
        const mult = 1 + (chain - 1) * step;
        const raw = base * mult * (mods ? mods.scoreMul : 1);
        return {
            base,
            mult,
            gain: Math.round(raw),
            biggest,
            anchor: biggestAnchor(groups),
        };
    }

    computeRowScore(rowCount: number, level: number, mods?: ModifierSet): number {
        const base = rowCount * TUNING.score.rowClear * level;
        if (!mods) return base;
        return Math.round(base * mods.rowScoreMul + rowCount * mods.rowsScoreBonus);
    }
}
