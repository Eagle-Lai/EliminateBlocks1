/**
 * 异变表：8 条 × 3 档。
 * 数值单位=锁定次数（"每 {间隔} 次锁定触发一次"）；迷雾为覆盖行数。
 * 禁忌组合在配置层拦截：一关只允许一条异变，但校验器仍会拒绝非法组合。
 */
export type MutationTier = 'light' | 'standard' | 'strong';

export interface MutationParams {
    /** 触发间隔（锁定次数）；0 表示常驻 */
    every: number;
    /** 霜雨：每行缺口数 */
    gaps?: number;
    /** 迷雾：覆盖行数（自顶部起） */
    fogRows?: number;
    /** 镜像：镜像副本数 */
    mirrors?: number;
    /** 镜像强档：独立取色 */
    independentColor?: boolean;
    /** 单色诅咒：消除阈值 */
    minGroupSize?: number;
    /** 单色诅咒：颜色数 */
    colorCount?: number;
    /** 脆霜：每次变脆的格数 */
    brittleCount?: number;
    /** 磁力：每步位移格数 */
    shift?: number;
}

export interface MutationDef {
    id: number;
    key:
        | 'frostRain'
        | 'fog'
        | 'mirror'
        | 'inverted'
        | 'monoCurse'
        | 'backflow'
        | 'brittle'
        | 'magnet';
    name: string;
    desc: string;
    icon: string;
    /** 与哪些异变互斥（id） */
    forbids: number[];
    tiers: Record<MutationTier, MutationParams>;
}

export const MUTATION_TABLE: readonly MutationDef[] = [
    {
        id: 1,
        key: 'frostRain',
        name: '糖霜雨',
        desc: '每 {间隔} 次锁定从底部插入一行霜石',
        icon: 'mutation_frost',
        forbids: [4],
        tiers: {
            light: { every: 9, gaps: 2 },
            standard: { every: 6, gaps: 2 },
            strong: { every: 4, gaps: 2 },
        },
    },
    {
        id: 2,
        key: 'fog',
        name: '迷雾',
        desc: '顶部若干行被迷雾覆盖，靠近或同色才显形',
        icon: 'mutation_fog',
        forbids: [],
        tiers: {
            light: { every: 0, fogRows: 5 },
            standard: { every: 0, fogRows: 8 },
            strong: { every: 0, fogRows: 11 },
        },
    },
    {
        id: 3,
        key: 'mirror',
        name: '镜像',
        desc: '左右同时落块，两侧都合法才可移动',
        icon: 'mutation_mirror',
        forbids: [8, 4],
        tiers: {
            light: { every: 0, mirrors: 1 },
            standard: { every: 0, mirrors: 2 },
            strong: { every: 0, mirrors: 2, independentColor: true },
        },
    },
    {
        id: 4,
        key: 'inverted',
        name: '倒悬',
        desc: '底部生成、向上移动、向上压实',
        icon: 'mutation_inverted',
        forbids: [1, 6, 3],
        tiers: {
            light: { every: 0 },
            standard: { every: 0 },
            strong: { every: 0 },
        },
    },
    {
        id: 5,
        key: 'monoCurse',
        name: '单色诅咒',
        desc: '只有 2 种颜色，但需要 4 连才消除',
        icon: 'mutation_mono',
        forbids: [],
        tiers: {
            light: { every: 0, minGroupSize: 3, colorCount: 2 },
            standard: { every: 0, minGroupSize: 4, colorCount: 2 },
            strong: { every: 0, minGroupSize: 5, colorCount: 2 },
        },
    },
    {
        id: 6,
        key: 'backflow',
        name: '逆流',
        desc: '消除后不塌陷，每 {间隔} 步统一塌陷一次',
        icon: 'mutation_backflow',
        forbids: [4],
        tiers: {
            light: { every: 3 },
            standard: { every: 5 },
            strong: { every: 7 },
        },
    },
    {
        id: 7,
        key: 'brittle',
        name: '脆霜',
        desc: '每 {间隔} 步 2 格变脆霜，邻接消除时碎裂',
        icon: 'mutation_brittle',
        forbids: [],
        tiers: {
            light: { every: 6, brittleCount: 2 },
            standard: { every: 4, brittleCount: 2 },
            strong: { every: 3, brittleCount: 2 },
        },
    },
    {
        id: 8,
        key: 'magnet',
        name: '磁力',
        desc: '每 {间隔} 步一列整体位移，遇边界反向',
        icon: 'mutation_magnet',
        forbids: [3],
        tiers: {
            light: { every: 8, shift: 1 },
            standard: { every: 5, shift: 1 },
            strong: { every: 3, shift: 1 },
        },
    },
] as const;

export function mutationById(id: number): MutationDef | null {
    return MUTATION_TABLE.find((m) => m.id === id) ?? null;
}

/** 禁忌校验：返回错误信息，null 表示合法 */
export function validateMutationCombo(ids: readonly number[]): string | null {
    const seen = new Set<number>();
    for (const id of ids) {
        if (seen.has(id)) return `异变重复：${id}`;
        seen.add(id);
    }
    for (const id of ids) {
        const def = mutationById(id);
        if (!def) return `未知异变：${id}`;
        for (const other of ids) {
            if (other === id) continue;
            if (def.forbids.indexOf(other) >= 0) {
                return `禁忌组合：${def.name} + ${mutationById(other)?.name ?? other}`;
            }
        }
    }
    return null;
}
