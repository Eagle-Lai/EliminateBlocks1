/**
 * 糖能：总消除格数 × 2 + chain × 4，上限 100；满槽后每次锁定额外 +5。
 * 释放等级按本局第 1/2/3 次：Lv1 清最多颜色，Lv2 再清四邻一圈，Lv3 点色（P2）。
 * 统计只算普通块；平票取色号最小。
 */
import type { BoardModel } from './BoardModel';
import { TUNING } from '../config/GameTuning';

export type BurstLevel = 1 | 2 | 3;

export class SugarEnergy {
    private _value = 0;
    private _bursts = 0;

    get value(): number {
        return this._value;
    }

    get max(): number {
        return TUNING.sugar.max;
    }

    get full(): boolean {
        return this._value >= this.max;
    }

    get bursts(): number {
        return this._bursts;
    }

    /** 下一次释放的等级（1..3） */
    get nextLevel(): BurstLevel {
        return Math.min(3, this._bursts + 1) as BurstLevel;
    }

    reset(start = 0): void {
        this._value = Math.max(0, Math.min(this.max, start));
        this._bursts = 0;
    }

    /** 累加；返回是否刚满（本帧首次） */
    add(removedCells: number, chain: number, gainMul = 1): boolean {
        const wasFull = this.full;
        const gain = Math.round((removedCells * TUNING.sugar.perCell + chain * TUNING.sugar.perChain) * gainMul);
        this._value = Math.min(this.max, this._value + gain);
        return !wasFull && this.full;
    }

    /** 撤销快照恢复：槽值与已释放次数 */
    restore(value: number, bursts: number): void {
        this._value = Math.max(0, Math.min(this.max, value));
        this._bursts = Math.max(0, bursts);
    }

    /** 直接加值（天赋/补偿） */
    bonus(amount: number): void {
        if (amount <= 0) return;
        this._value = Math.min(this.max, this._value + amount);
    }

    /** 满槽时每次锁定 +5（一次） */
    addLockBonus(amount = TUNING.sugar.lockBonus): void {
        if (!this.full) return;
        this._value = Math.min(this.max, this._value + amount);
    }

    /** 释放：返回本次等级并归零 */
    consume(): BurstLevel {
        const level = this.nextLevel;
        this._bursts++;
        this._value = 0;
        return level;
    }

    /** Lv1/Lv2 的目标颜色：盘面最多（平票取色号最小） */
    static targetColor(board: BoardModel): number {
        const counts = board.countByColor();
        let best = 0;
        let bestCount = -1;
        for (let i = 0; i < counts.length; i++) {
            const n = counts[i] ?? 0;
            if (n > bestCount) {
                bestCount = n;
                best = i;
            }
        }
        return best;
    }
}
