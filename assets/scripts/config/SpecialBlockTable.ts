/** 特殊块表：5 种特殊块 + 生成/触发表现配置。 */
import type { SpecialKind } from '../core/BoardModel';

export interface SpecialDef {
    kind: SpecialKind;
    name: string;
    desc: string;
    icon: string;
    /** 生成音效 key */
    spawnSfx: string;
    /** 触发音效 key */
    triggerSfx: string;
    /** 触发特效 prefab 键 */
    fx: 'shockwave' | 'burst' | 'prism' | 'frost';
}

export const SPECIAL_TABLE: Readonly<Record<SpecialKind, SpecialDef>> = {
    stripeH: {
        kind: 'stripeH',
        name: '横条纹',
        desc: '清空整行',
        icon: 'special_stripe_h',
        spawnSfx: 'special_spawn_stripe',
        triggerSfx: 'special_trigger_stripe',
        fx: 'shockwave',
    },
    stripeV: {
        kind: 'stripeV',
        name: '竖条纹',
        desc: '清空整列',
        icon: 'special_stripe_v',
        spawnSfx: 'special_spawn_stripe',
        triggerSfx: 'special_trigger_stripe',
        fx: 'shockwave',
    },
    rainbow: {
        kind: 'rainbow',
        name: '彩虹',
        desc: '清空最多的颜色',
        icon: 'special_rainbow',
        spawnSfx: 'special_spawn_rainbow',
        triggerSfx: 'special_trigger_rainbow',
        fx: 'prism',
    },
    bomb: {
        kind: 'bomb',
        name: '炸弹',
        desc: '清空 3×3',
        icon: 'special_bomb',
        spawnSfx: 'special_spawn_bomb',
        triggerSfx: 'special_trigger_bomb',
        fx: 'shockwave',
    },
    cross: {
        kind: 'cross',
        name: '十字',
        desc: '清空整行与整列',
        icon: 'special_cross',
        spawnSfx: 'special_spawn_cross',
        triggerSfx: 'special_trigger_cross',
        fx: 'shockwave',
    },
    prism: {
        kind: 'prism',
        name: '棱镜',
        desc: '周围 8 格染成自身色',
        icon: 'special_prism',
        spawnSfx: 'special_spawn_prism',
        triggerSfx: 'special_trigger_prism',
        fx: 'prism',
    },
};

export const SPECIAL_ORDER: readonly SpecialKind[] = [
    'stripeH',
    'stripeV',
    'rainbow',
    'bomb',
    'cross',
    'prism',
];
