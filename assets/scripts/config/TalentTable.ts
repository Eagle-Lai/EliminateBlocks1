/**
 * 天赋表（30 个）。效果只写 Modifiers，不允许在业务层散落判断。
 * 天赋 26 为"残局提示 -10 金币"（无道具系统的等价改写）；
 * 天赋 29 "+1 列" 属 P2，默认不进池（allowP2=false）。
 */
import type { ModifierSet } from '../core/Modifiers';

export type TalentRarity = 'common' | 'rare' | 'legendary';
export type TalentCategory = 'score' | 'board' | 'sugar' | 'special' | 'luck';

export interface TalentDef {
    id: number;
    name: string;
    desc: string;
    rarity: TalentRarity;
    category: TalentCategory;
    icon: string;
    mods: Partial<ModifierSet>;
    /** P2 天赋，默认关闭 */
    p2?: boolean;
}

export const TALENT_RARITY_WEIGHT: Record<TalentRarity, number> = {
    common: 70,
    rare: 27,
    legendary: 3,
};

export const TALENT_TABLE: readonly TalentDef[] = [
    { id: 1, name: '甜度加成', desc: '所有得分 +8%', rarity: 'common', category: 'score', icon: 'talent_score', mods: { scoreMul: 1.08 } },
    { id: 2, name: '连绵不绝', desc: '连锁倍率 +0.15', rarity: 'common', category: 'score', icon: 'talent_chain', mods: { chainStepAdd: 0.15 } },
    { id: 3, name: '大方块', desc: '每组额外 +25 分', rarity: 'common', category: 'score', icon: 'talent_block', mods: { groupScoreAdd: 25 } },
    { id: 4, name: '整行专精', desc: '消行分 +15%', rarity: 'common', category: 'score', icon: 'talent_row', mods: { rowScoreMul: 1.15 } },
    { id: 5, name: '糖能加速', desc: '糖能获取 +20%', rarity: 'common', category: 'sugar', icon: 'talent_sugar', mods: { sugarGainMul: 1.2 } },
    { id: 6, name: '甜蜜开局', desc: '开局糖能 +25', rarity: 'common', category: 'sugar', icon: 'talent_start', mods: { startSugar: 25 } },
    { id: 7, name: '软垫', desc: '获得 1 次护盾', rarity: 'common', category: 'board', icon: 'talent_shield', mods: { shieldCharges: 1 } },
    { id: 8, name: '慢速齿轮', desc: '下落间隔 +12%（更慢）', rarity: 'common', category: 'board', icon: 'talent_slow', mods: { dropIntervalMul: 1.12 } },
    { id: 9, name: '碎石锤', desc: '石块清除计数 +2', rarity: 'common', category: 'special', icon: 'talent_stone', mods: { stoneDamageBonus: 2 } },
    { id: 10, name: '特殊养成', desc: '生成特殊块 +50 分', rarity: 'common', category: 'special', icon: 'talent_special', mods: { specialScoreBonus: 50 } },
    { id: 11, name: '稳固根基', desc: '每次消行 +40 分', rarity: 'common', category: 'score', icon: 'talent_row', mods: { rowsScoreBonus: 40 } },
    { id: 12, name: '好运连连', desc: '传说天赋概率 +5%', rarity: 'common', category: 'luck', icon: 'talent_luck', mods: { luckBonus: 0.05 } },
    { id: 13, name: '连锁大师', desc: '连锁倍率 +0.25', rarity: 'rare', category: 'score', icon: 'talent_chain', mods: { chainStepAdd: 0.25 } },
    { id: 14, name: '双倍糖能', desc: '糖能获取 +40%', rarity: 'rare', category: 'sugar', icon: 'talent_sugar', mods: { sugarGainMul: 1.4 } },
    { id: 15, name: '大爆发', desc: '糖爆半径 +1', rarity: 'rare', category: 'special', icon: 'talent_burst', mods: { burstRadiusBonus: 1 } },
    { id: 16, name: '撤销卷轴', desc: '获得 1 次撤销', rarity: 'rare', category: 'board', icon: 'talent_undo', mods: { undoCharges: 1 } },
    { id: 17, name: '双子护盾', desc: '获得 2 次护盾', rarity: 'rare', category: 'board', icon: 'talent_shield', mods: { shieldCharges: 2 } },
    { id: 18, name: '分数狂热', desc: '所有得分 +15%', rarity: 'rare', category: 'score', icon: 'talent_score', mods: { scoreMul: 1.15 } },
    { id: 19, name: '行家里手', desc: '消行分 +30%', rarity: 'rare', category: 'score', icon: 'talent_row', mods: { rowScoreMul: 1.3 } },
    { id: 20, name: '甜心罐', desc: '开局糖能 +50', rarity: 'rare', category: 'sugar', icon: 'talent_start', mods: { startSugar: 50 } },
    { id: 21, name: '同色加成', desc: '每组额外 +50 分', rarity: 'rare', category: 'score', icon: 'talent_block', mods: { groupScoreAdd: 50 } },
    { id: 22, name: '从容不迫', desc: '下落间隔 +25%（更慢）', rarity: 'rare', category: 'board', icon: 'talent_slow', mods: { dropIntervalMul: 1.25 } },
    { id: 23, name: '宝石猎手', desc: '生成特殊块 +120 分', rarity: 'rare', category: 'special', icon: 'talent_special', mods: { specialScoreBonus: 120 } },
    { id: 24, name: '余韵悠长', desc: '每次消行 +80 分', rarity: 'rare', category: 'score', icon: 'talent_row', mods: { rowsScoreBonus: 80 } },
    { id: 25, name: '糖爆共振', desc: '糖爆分数 ×1.5', rarity: 'legendary', category: 'sugar', icon: 'talent_burst', mods: { burstScoreMul: 1.5 } },
    { id: 26, name: '提示专家', desc: '残局提示便宜 10 金币', rarity: 'legendary', category: 'luck', icon: 'talent_hint', mods: { hintDiscount: 10 } },
    { id: 27, name: '二次机会', desc: '获得 3 次护盾', rarity: 'legendary', category: 'board', icon: 'talent_shield', mods: { shieldCharges: 3 } },
    { id: 28, name: '全场狂欢', desc: '所有得分 +25%', rarity: 'legendary', category: 'score', icon: 'talent_score', mods: { scoreMul: 1.25 } },
    { id: 29, name: '加宽棋盘', desc: '棋盘 +1 列', rarity: 'legendary', category: 'board', icon: 'talent_block', mods: { extraColumn: true }, p2: true },
    { id: 30, name: '天赋馈赠', desc: '撤销 2 次 + 开局糖能 +30', rarity: 'legendary', category: 'sugar', icon: 'talent_undo', mods: { undoCharges: 2, startSugar: 30 } },
] as const;

export function talentById(id: number): TalentDef | null {
    return TALENT_TABLE.find((t) => t.id === id) ?? null;
}
