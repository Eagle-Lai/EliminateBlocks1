/**
 * 等级与难度曲线。
 * 升级：score >= level * 1500；修正了原型「一次结算只能升 1 级」的缺陷，改为可连续升级。
 */
import { TUNING } from '../config/GameTuning';

export class LevelService {
    private _level = 1;

    get level(): number {
        return this._level;
    }

    /** 撤销快照恢复：直接回到指定等级 */
    setLevel(value: number): void {
        this._level = Math.max(1, value);
    }

    reset(): void {
        this._level = 1;
    }

    /** 返回本次跨过的全部等级 */
    tryLevelUp(score: number): number[] {
        const gained: number[] = [];
        if (!Number.isFinite(score)) return gained;
        const target = 1 + Math.floor(score / TUNING.level.threshold);
        while (this._level < target) {
            this._level++;
            gained.push(this._level);
        }
        return gained;
    }

    /** 当前等级对应的下落间隔（毫秒） */
    get dropIntervalMs(): number {
        const ms = TUNING.speed.startMs - (this._level - 1) * TUNING.speed.stepMs;
        return Math.max(TUNING.speed.minMs, ms);
    }

    /** 当前等级的进度（0..1），用于进度条 */
    progress(score: number): number {
        const prev = (this._level - 1) * TUNING.level.threshold;
        const next = this._level * TUNING.level.threshold;
        if (next <= prev) return 0;
        return Math.max(0, Math.min(1, (score - prev) / (next - prev)));
    }
}
