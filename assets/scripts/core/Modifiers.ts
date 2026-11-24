/**
 * 天赋修正集合：所有天赋效果只通过这里生效。
 * 叠加规则：数值相加、倍率相乘、布尔取或、次数取最大。
 */

export interface ModifierSet {
    /** 全局分数倍率（乘） */
    scoreMul: number;
    /** 消行分倍率（乘） */
    rowScoreMul: number;
    /** 每组固定加分（加） */
    groupScoreAdd: number;
    /** 连锁步长加成（加） */
    chainStepAdd: number;
    /** 消除阈值变化（加，负数=更宽松） */
    minGroupSizeDelta: number;
    /** 颜色数变化（加） */
    colorCountDelta: number;
    /** 糖能获取倍率（乘） */
    sugarGainMul: number;
    /** 每次锁定额外糖能（加） */
    sugarPerLock: number;
    /** 下落间隔倍率（乘，>1 更慢） */
    dropIntervalMul: number;
    /** 糖爆半径加成（加） */
    burstRadiusBonus: number;
    /** 护盾次数（取最大） */
    shieldCharges: number;
    /** 撤销次数（取最大） */
    undoCharges: number;
    /** 残局提示折扣金币（加） */
    hintDiscount: number;
    /** 生成特殊块额外分（加） */
    specialScoreBonus: number;
    /** 石块清除的额外计数（加） */
    stoneDamageBonus: number;
    /** 糖爆分数倍率（乘） */
    burstScoreMul: number;
    /** 消行额外分（加） */
    rowsScoreBonus: number;
    /** 传说天赋出现概率加成（加） */
    luckBonus: number;
    /** 开局糖能（加） */
    startSugar: number;
    /** 额外一列（P2，布尔或） */
    extraColumn: boolean;
}

export type ModifierKey = keyof ModifierSet;

const MULTIPLICATIVE: ReadonlySet<ModifierKey> = new Set<ModifierKey>([
    'scoreMul',
    'rowScoreMul',
    'sugarGainMul',
    'dropIntervalMul',
    'burstScoreMul',
]);
const MAXIMUM: ReadonlySet<ModifierKey> = new Set<ModifierKey>(['shieldCharges', 'undoCharges']);
const BOOLEAN: ReadonlySet<ModifierKey> = new Set<ModifierKey>(['extraColumn']);

export function emptyModifiers(): ModifierSet {
    return {
        scoreMul: 1,
        rowScoreMul: 1,
        groupScoreAdd: 0,
        chainStepAdd: 0,
        minGroupSizeDelta: 0,
        colorCountDelta: 0,
        sugarGainMul: 1,
        sugarPerLock: 0,
        dropIntervalMul: 1,
        burstRadiusBonus: 0,
        shieldCharges: 0,
        undoCharges: 0,
        hintDiscount: 0,
        specialScoreBonus: 0,
        stoneDamageBonus: 0,
        burstScoreMul: 1,
        rowsScoreBonus: 0,
        luckBonus: 0,
        startSugar: 0,
        extraColumn: false,
    };
}

/** 把 partial 叠加到 base 上，返回新对象（不改 base） */
export function mergeModifiers(base: ModifierSet, add: Partial<ModifierSet>): ModifierSet {
    const out = { ...base };
    for (const rawKey of Object.keys(add)) {
        const key = rawKey as ModifierKey;
        const value = add[key];
        if (value === undefined) continue;
        if (BOOLEAN.has(key)) {
            (out[key] as boolean) = Boolean(out[key]) || Boolean(value);
        } else if (MAXIMUM.has(key)) {
            (out[key] as number) = Math.max(out[key] as number, value as number);
        } else if (MULTIPLICATIVE.has(key)) {
            (out[key] as number) = (out[key] as number) * (value as number);
        } else {
            (out[key] as number) = (out[key] as number) + (value as number);
        }
    }
    return out;
}

export function mergeAll(list: readonly Partial<ModifierSet>[]): ModifierSet {
    let mods = emptyModifiers();
    for (const item of list) mods = mergeModifiers(mods, item);
    return mods;
}
