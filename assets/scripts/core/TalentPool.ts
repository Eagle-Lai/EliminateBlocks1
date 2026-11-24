/**
 * 天赋池与三选一抽取（纯逻辑，按对局种子确定性）。
 * 规则：三张至少 1 张普通；不重复；同类 ≤2；传说 ≤3% 且每局 ≤1；跳过 +15 金币。
 */
import { TALENT_TABLE, TALENT_RARITY_WEIGHT, type TalentDef, type TalentRarity } from '../config/TalentTable';
import type { Rng } from '../utils/Rng';

export interface OfferOptions {
    /** 已拥有的天赋 id */
    owned: readonly number[];
    /** 本局是否已经出过传说 */
    legendaryUsed: boolean;
    /** 是否放开 P2 天赋（默认 false） */
    allowP2?: boolean;
    /** 传说概率加成（天赋 12） */
    luckBonus?: number;
}

export const TALENT_GROUP_TRIGGERS: readonly number[] = [6, 12, 18];
export const TALENT_SKIP_COINS = 15;
export const LEGENDARY_CHANCE = 0.03;
export const SAME_CATEGORY_LIMIT = 2;

function weightOf(t: TalentDef): number {
    return TALENT_RARITY_WEIGHT[t.rarity];
}

function pickWeighted(rng: Rng, pool: readonly TalentDef[]): TalentDef | null {
    if (pool.length === 0) return null;
    let total = 0;
    for (const t of pool) total += weightOf(t);
    let roll = rng.next() * total;
    for (const t of pool) {
        roll -= weightOf(t);
        if (roll <= 0) return t;
    }
    return pool[pool.length - 1];
}

export class TalentPool {
    /** 抽三张；抽不满时放宽类别限制，仍保证至少一张普通 */
    static offer(rng: Rng, opts: OfferOptions): TalentDef[] {
        const owned = new Set(opts.owned);
        const base = TALENT_TABLE.filter((t) => !owned.has(t.id) && (opts.allowP2 === true || !t.p2));
        if (base.length === 0) return [];

        const picked: TalentDef[] = [];
        const categoryCount = new Map<string, number>();

        const accept = (t: TalentDef): boolean => {
            if (picked.some((p) => p.id === t.id)) return false;
            const used = categoryCount.get(t.category) ?? 0;
            return used < SAME_CATEGORY_LIMIT;
        };
        const take = (t: TalentDef): void => {
            picked.push(t);
            categoryCount.set(t.category, (categoryCount.get(t.category) ?? 0) + 1);
        };

        // 1) 保底普通
        const commons = base.filter((t) => t.rarity === 'common');
        const guaranteed = pickWeighted(rng, commons);
        if (guaranteed) take(guaranteed);

        // 2) 传说名额（≤1 且 ≤3% + luckBonus）
        const chance = Math.min(0.5, LEGENDARY_CHANCE + (opts.luckBonus ?? 0));
        let legendaryUsed = opts.legendaryUsed;
        if (!legendaryUsed && picked.every((p) => p.rarity !== 'legendary') && rng.next() < chance) {
            const legends = base.filter((t) => t.rarity === 'legendary' && accept(t));
            const legend = pickWeighted(rng, legends);
            if (legend) {
                take(legend);
                legendaryUsed = true;
            }
        }

        // 3) 补足到 3 张
        let guard = 0;
        while (picked.length < 3 && guard < 40) {
            guard++;
            const pool = base.filter(
                (t) => accept(t) && (t.rarity !== 'legendary' || !legendaryUsed),
            );
            if (pool.length === 0) break;
            const next = pickWeighted(rng, pool);
            if (!next) break;
            take(next);
        }

        // 4) 仍不足时放宽"同类 ≤2"
        guard = 0;
        while (picked.length < 3 && guard < 40) {
            guard++;
            const pool = base.filter(
                (t) => !picked.some((p) => p.id === t.id) && (t.rarity !== 'legendary' || !legendaryUsed),
            );
            if (pool.length === 0) break;
            const next = pickWeighted(rng, pool);
            if (!next) break;
            take(next);
        }

        return picked;
    }
}

/** 传说出现概率（供单测/报告） */
export function legendaryWeightShare(): number {
    let legend = 0;
    let total = 0;
    for (const t of TALENT_TABLE) {
        total += TALENT_RARITY_WEIGHT[t.rarity];
        if (t.rarity === 'legendary') legend += TALENT_RARITY_WEIGHT[t.rarity];
    }
    return total > 0 ? legend / total : 0;
}

export function rarityRank(r: TalentRarity): number {
    return r === 'legendary' ? 2 : r === 'rare' ? 1 : 0;
}
