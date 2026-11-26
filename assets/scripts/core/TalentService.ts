/**
 * 天赋服务：管理本局已拥有天赋、三选一进度与修正集合。
 * 触发点：第 6 / 12 / 18 组（最多 3 次），结算后、目标判定后、spawn 前。
 */
import { talentById, type TalentDef } from '../config/TalentTable';
import { emptyModifiers, mergeModifiers, type ModifierSet } from './Modifiers';
import { TALENT_GROUP_TRIGGERS, TALENT_SKIP_COINS, TalentPool } from './TalentPool';
import type { Rng } from '../utils/Rng';

export interface TalentOfferState {
    offers: TalentDef[];
    index: number;
    total: number;
}

export class TalentService {
    private _owned: number[] = [];
    private _mods: ModifierSet = emptyModifiers();
    private _offersUsed = 0;
    private _legendaryUsed = false;
    private _pending: TalentDef[] = [];
    private _skipCoins = 0;

    reset(): void {
        this._owned = [];
        this._mods = emptyModifiers();
        this._offersUsed = 0;
        this._legendaryUsed = false;
        this._pending = [];
        this._skipCoins = 0;
    }

    capture() {
        return { owned: this._owned.slice(), mods: { ...this._mods }, offersUsed: this._offersUsed,
            legendaryUsed: this._legendaryUsed, pending: this._pending.slice(), skipCoins: this._skipCoins };
    }

    restore(state: ReturnType<TalentService['capture']>): void {
        this._owned = state.owned.slice();
        this._mods = { ...state.mods };
        this._offersUsed = state.offersUsed;
        this._legendaryUsed = state.legendaryUsed;
        this._pending = state.pending.slice();
        this._skipCoins = state.skipCoins;
    }

    get owned(): readonly number[] {
        return this._owned;
    }

    get mods(): ModifierSet {
        return this._mods;
    }

    get offersUsed(): number {
        return this._offersUsed;
    }

    get pending(): readonly TalentDef[] {
        return this._pending;
    }

    get skipCoins(): number {
        return this._skipCoins;
    }

    /** 当前组数是否触发三选一 */
    shouldOffer(groupCount: number): boolean {
        if (this._offersUsed >= TALENT_GROUP_TRIGGERS.length) return false;
        const target = TALENT_GROUP_TRIGGERS[this._offersUsed];
        return groupCount >= target;
    }

    /** 抽三张（确定性：同一 rng 序列同一结果） */
    offer(rng: Rng, allowP2 = false, options: { allowHints?: boolean; allowStoneBonus?: boolean } = {}): TalentDef[] {
        const offers = TalentPool.offer(rng, {
            owned: this._owned,
            legendaryUsed: this._legendaryUsed,
            allowP2,
            ...options,
            luckBonus: this._mods.luckBonus,
        });
        this._pending = offers;
        if (offers.some((t) => t.rarity === 'legendary')) this._legendaryUsed = true;
        return offers;
    }

    /** 选中一张；返回是否成功 */
    pick(id: number): boolean {
        const def = talentById(id);
        if (!def) return false;
        if (this._owned.indexOf(id) >= 0) return false;
        if (!this._pending.some((t) => t.id === id)) return false;
        this._owned.push(id);
        this._mods = mergeModifiers(this._mods, def.mods);
        this._pending = [];
        this._offersUsed++;
        return true;
    }

    /** 跳过：+15 金币 */
    skip(): number {
        if (this._pending.length === 0) return 0;
        this._pending = [];
        this._offersUsed++;
        this._skipCoins += TALENT_SKIP_COINS;
        return TALENT_SKIP_COINS;
    }

    /** 关卡结束时清空（下一局重置） */
    clear(): void {
        this.reset();
    }

    describe(): Array<{ id: number; name: string; desc: string }> {
        return this._owned.map((id) => {
            const def = talentById(id);
            return { id, name: def?.name ?? `#${id}`, desc: def?.desc ?? '' };
        });
    }
}
